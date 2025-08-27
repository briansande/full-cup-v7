-- Migration: create tag system for shops (tags, shop_tags, user_tag_votes)
-- Adds tables, indexes, trigger to maintain votes, functions to compute popularity, and seed common tags.
-- Run via Supabase SQL editor or `npx supabase db push` / psql against your database.

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: name + category (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_tags_name_category'
  ) THEN
    CREATE UNIQUE INDEX uq_tags_name_category ON public.tags (lower(name), category);
  END IF;
END;
$$;

-- 2) Create shop_tags table (a user attaching a tag to a shop)
CREATE TABLE IF NOT EXISTS public.shop_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  user_id uuid NOT NULL,
  votes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_shop_tags_shop FOREIGN KEY (shop_id) REFERENCES public.coffee_shops (id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_tags_tag FOREIGN KEY (tag_id) REFERENCES public.tags (id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_tags_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Prevent the same user re-creating identical tag on same shop
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_tags_shop_tag_user ON public.shop_tags (shop_id, tag_id, user_id);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_shop_tags_shop_id ON public.shop_tags (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_tags_tag_id ON public.shop_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_shop_tags_user_id ON public.shop_tags (user_id);

-- 3) Create user_tag_votes table (voting on a shop_tag)
CREATE TABLE IF NOT EXISTS public.user_tag_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_tag_id uuid NOT NULL,
  user_id uuid NOT NULL,
  vote_type smallint NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_tag_votes_shop_tag FOREIGN KEY (shop_tag_id) REFERENCES public.shop_tags (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_tag_votes_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT ck_user_tag_votes_vote_type CHECK (vote_type IN (-1, 1))
);

-- Prevent multiple votes by same user on same shop_tag (one active vote record)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tag_votes_shop_tag_user ON public.user_tag_votes (shop_tag_id, user_id);

-- Indexes for efficient vote queries
CREATE INDEX IF NOT EXISTS idx_user_tag_votes_shop_tag_id ON public.user_tag_votes (shop_tag_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_votes_user_id ON public.user_tag_votes (user_id);

-- 4) Trigger function to recalculate shop_tags.votes when user_tag_votes change
CREATE OR REPLACE FUNCTION public.recalc_shop_tag_votes()
RETURNS trigger AS $$
DECLARE
  target_shop_tag uuid;
  total integer;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_shop_tag := NEW.shop_tag_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- When updating, NEW.shop_tag_id may be present or the same as OLD
    target_shop_tag := COALESCE(NEW.shop_tag_id, OLD.shop_tag_id);
  ELSIF (TG_OP = 'DELETE') THEN
    target_shop_tag := OLD.shop_tag_id;
  ELSE
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(vote_type), 0) INTO total FROM public.user_tag_votes WHERE shop_tag_id = target_shop_tag;

  UPDATE public.shop_tags SET votes = total WHERE id = target_shop_tag;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Attach trigger to user_tag_votes for insert/update/delete
DROP TRIGGER IF EXISTS trg_recalc_shop_tag_votes ON public.user_tag_votes;
CREATE TRIGGER trg_recalc_shop_tag_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_tag_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_shop_tag_votes();

-- 5) Function to compute popularity summary for a shop (aggregated by tag)
-- Note: SUM and COUNT return bigint in Postgres; use bigint types to avoid RPC type mismatches.
-- If an older function exists with different OUT parameters, drop it first (required to change return types).
DROP FUNCTION IF EXISTS public.get_shop_tag_popularity(uuid);
CREATE OR REPLACE FUNCTION public.get_shop_tag_popularity(p_shop_id uuid)
RETURNS TABLE(
  tag_id uuid,
  tag_name text,
  category text,
  total_votes bigint,
  user_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tag_id,
    t.name AS tag_name,
    t.category,
    COALESCE(SUM(st.votes), 0) AS total_votes,
    COUNT(st.*) FILTER (WHERE st.id IS NOT NULL) AS user_count
  FROM public.tags t
  JOIN public.shop_tags st ON st.tag_id = t.id
  WHERE st.shop_id = p_shop_id
  GROUP BY t.id, t.name, t.category
  ORDER BY total_votes DESC, user_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6) Function to compute popularity for a specific tag at a shop (sums user votes)
-- Drop previous version first if it exists to avoid return-type conflicts.
DROP FUNCTION IF EXISTS public.get_shop_tag_score(uuid, uuid);
-- Use bigint to match SUM() return type
CREATE OR REPLACE FUNCTION public.get_shop_tag_score(p_shop_id uuid, p_tag_id uuid)
RETURNS bigint AS $$
DECLARE
  s bigint;
BEGIN
  SELECT COALESCE(SUM(utv.vote_type), 0) INTO s
  FROM public.user_tag_votes utv
  JOIN public.shop_tags st ON st.id = utv.shop_tag_id
  WHERE st.shop_id = p_shop_id AND st.tag_id = p_tag_id;

  RETURN COALESCE(s, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7) Seed common tags (idempotent)
INSERT INTO public.tags (name, category, description)
VALUES
  ('Good for studying', 'Work/Study', 'Quiet, reliable place for studying and working'),
  ('Fast WiFi', 'Work/Study', 'High-speed internet suitable for video calls and uploads'),
  ('Quiet atmosphere', 'Work/Study', 'Low noise levels, good for concentration'),
  ('Great for meetings', 'Social', 'Comfortable for group meetings and conversations'),
  ('Friendly staff', 'Social', 'Helpful and welcoming employees'),
  ('Community vibe', 'Social', 'Local community atmosphere and events'),
  ('Cozy', 'Ambiance', 'Warm, inviting space with comfortable seating'),
  ('Modern', 'Ambiance', 'Contemporary decor and design'),
  ('Rustic', 'Ambiance', 'Characterful and vintage-inspired interior'),
  ('Artistic', 'Ambiance', 'Creative decor, art, or music presence'),
  ('Good parking', 'Practical', 'Easily accessible parking nearby'),
  ('Outdoor seating', 'Practical', 'Patio or sidewalk seating available'),
  ('Pet friendly', 'Practical', 'Pets are welcome on premises')
ON CONFLICT (lower(name), category) DO NOTHING;

-- 8) Additional indexes to speed queries that join tags to shops
CREATE INDEX IF NOT EXISTS idx_tags_category ON public.tags (category);
CREATE INDEX IF NOT EXISTS idx_tags_name_lower ON public.tags (lower(name));

-- 9) Backfill votes for existing shop_tags from user_tag_votes (in case there are any pre-existing vote rows)
UPDATE public.shop_tags st
SET votes = COALESCE((
  SELECT SUM(vote_type) FROM public.user_tag_votes utv WHERE utv.shop_tag_id = st.id
), 0)
WHERE EXISTS (SELECT 1 FROM public.user_tag_votes utv WHERE utv.shop_tag_id = st.id);

-- End migration.