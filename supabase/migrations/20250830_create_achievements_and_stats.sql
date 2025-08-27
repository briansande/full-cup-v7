-- Migration: create achievements, user_achievements, user_stats, user_photos
-- Adds functions and triggers to update stats and award achievements
-- Run via `npx supabase db push --project-ref {your-project-ref}` or in Supabase SQL editor.

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Achievements master table (definitions)
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL, -- machine key: e.g. explorer_5, critic_10
  name text NOT NULL,
  description text,
  icon text,
  category text,
  requirements jsonb NOT NULL, -- structured JSON describing requirement
  points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_key ON public.achievements (key);

-- Per-user earned achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  earned_at timestamptz DEFAULT now(),
  progress jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT fk_user_achiv_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_achiv_ach
    FOREIGN KEY (achievement_id)
    REFERENCES public.achievements (id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_achievement_user_ach ON public.user_achievements (user_id, achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements (user_id);

-- Lightweight user stats table (cached counters)
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY,
  total_points integer DEFAULT 0,
  level integer DEFAULT 1,
  shops_visited integer DEFAULT 0,
  reviews_written integer DEFAULT 0,
  photos_uploaded integer DEFAULT 0,
  votes_received integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT fk_user_stats_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats (user_id);

-- Table to record user-uploaded photos (if app stores them)
CREATE TABLE IF NOT EXISTS public.user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_id uuid,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_photos_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_photos_shop
    FOREIGN KEY (shop_id)
    REFERENCES public.coffee_shops (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_photos_user_id ON public.user_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_shop_id ON public.user_photos (shop_id);

-- Helper: ensure user_stats row exists for a user
CREATE OR REPLACE FUNCTION public.ensure_user_stats_row(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_stats (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: check achievements for a user and award new ones
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid)
RETURNS void AS $$
DECLARE
  ach RECORD;
  us RECORD;
  threshold int;
  already boolean;
  review_exists boolean;
  night_exists boolean;
  weekend_visits_count int;
  photos_count int;
BEGIN
  PERFORM public.ensure_user_stats_row(p_user_id);
  SELECT * INTO us FROM public.user_stats WHERE user_id = p_user_id;

  FOR ach IN SELECT * FROM public.achievements ORDER BY created_at LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = p_user_id AND ua.achievement_id = ach.id
    ) INTO already;

    IF already THEN
      CONTINUE;
    END IF;

    -- Interpret requirement JSON structure. Common shapes used below:
    -- { "kind": "shops_visited", "value": 5 }
    -- { "kind": "reviews_written", "value": 5 }
    -- { "kind": "photos_uploaded", "value": 10 }
    -- { "kind": "votes_received", "value": 10 }
    -- { "kind": "review_time_early", "before_hour": 8 }
    -- { "kind": "review_time_night", "after_hour": 20 }
    -- { "kind": "weekend_visits", "value": 5 }

    IF ach.requirements->>'kind' = 'shops_visited' THEN
      threshold := (ach.requirements->>'value')::int;
      IF COALESCE(us.shops_visited,0) >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('shops_visited', us.shops_visited));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'reviews_written' THEN
      threshold := (ach.requirements->>'value')::int;
      IF COALESCE(us.reviews_written,0) >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('reviews_written', us.reviews_written));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'photos_uploaded' THEN
      threshold := (ach.requirements->>'value')::int;
      SELECT COUNT(*) INTO photos_count FROM public.user_photos WHERE user_id = p_user_id;
      IF photos_count >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('photos_uploaded', photos_count));
        UPDATE public.user_stats SET photos_uploaded = photos_count, total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'votes_received' THEN
      threshold := (ach.requirements->>'value')::int;
      IF COALESCE(us.votes_received,0) >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('votes_received', us.votes_received));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    ELSIF ach.requirements->>'kind' = 'review_time_early' THEN
      -- Award if user has any review before the specified hour (in America/Chicago timezone)
      IF ach.requirements ? 'before_hour' THEN
        IF EXISTS (
          SELECT 1 FROM public.shop_reviews r
          WHERE r.user_id = p_user_id
            AND EXTRACT(HOUR FROM timezone('America/Chicago', r.created_at)) < (ach.requirements->>'before_hour')::int
          LIMIT 1
        ) THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
          VALUES (p_user_id, ach.id, now(), jsonb_build_object('note','Has early review'));
          UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
        END IF;
      END IF;

    ELSIF ach.requirements->>'kind' = 'review_time_night' THEN
      IF ach.requirements ? 'after_hour' THEN
        IF EXISTS (
          SELECT 1 FROM public.shop_reviews r
          WHERE r.user_id = p_user_id
            AND EXTRACT(HOUR FROM timezone('America/Chicago', r.created_at)) >= (ach.requirements->>'after_hour')::int
          LIMIT 1
        ) THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
          VALUES (p_user_id, ach.id, now(), jsonb_build_object('note','Has late-night review'));
          UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
        END IF;
      END IF;

    ELSIF ach.requirements->>'kind' = 'weekend_visits' THEN
      threshold := (ach.requirements->>'value')::int;
      SELECT COUNT(*) INTO weekend_visits_count
      FROM public.user_shop_status uss
      WHERE uss.user_id = p_user_id
        AND uss.status = 'visited'
        AND EXTRACT(DOW FROM uss.created_at) IN (0,6); -- Sunday=0, Saturday=6

      IF weekend_visits_count >= threshold THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, earned_at, progress)
        VALUES (p_user_id, ach.id, now(), jsonb_build_object('weekend_visits', weekend_visits_count));
        UPDATE public.user_stats SET total_points = total_points + ach.points, last_updated = now() WHERE user_id = p_user_id;
      END IF;

    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: after insert on shop_reviews -> update user_stats and run achievement checks
CREATE OR REPLACE FUNCTION public.trg_after_insert_shop_review()
RETURNS trigger AS $$
BEGIN
  -- Ensure user_stats exists
  PERFORM public.ensure_user_stats_row(NEW.user_id);

  -- Increment reviews_written
  UPDATE public.user_stats
  SET reviews_written = COALESCE(reviews_written,0) + 1,
      last_updated = now()
  WHERE user_id = NEW.user_id;

  -- Call achievement checker
  PERFORM public.check_and_award_achievements(NEW.user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to shop_reviews AFTER INSERT
DROP TRIGGER IF EXISTS tr_shop_reviews_after_insert ON public.shop_reviews;
CREATE TRIGGER tr_shop_reviews_after_insert
AFTER INSERT ON public.shop_reviews
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_insert_shop_review();

-- Trigger function: after insert/update on user_shop_status -> update shops_visited when status becomes 'visited'
CREATE OR REPLACE FUNCTION public.trg_user_shop_status_change()
RETURNS trigger AS $$
BEGIN
  PERFORM public.ensure_user_stats_row(NEW.user_id);

  -- If new status is 'visited' and old wasn't 'visited', increment counter
  IF (TG_OP = 'INSERT' AND NEW.status = 'visited')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'visited' AND (OLD.status IS DISTINCT FROM NEW.status AND OLD.status <> 'visited')) THEN

    UPDATE public.user_stats
    SET shops_visited = COALESCE(shops_visited,0) + 1,
        last_updated = now()
    WHERE user_id = NEW.user_id;

    PERFORM public.check_and_award_achievements(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to user_shop_status for INSERT and UPDATE
DROP TRIGGER IF EXISTS tr_user_shop_status_on_change ON public.user_shop_status;
CREATE TRIGGER tr_user_shop_status_on_change
AFTER INSERT OR UPDATE ON public.user_shop_status
FOR EACH ROW
EXECUTE FUNCTION public.trg_user_shop_status_change();

-- Trigger function: after insert on user_photos -> update photos_uploaded and check achievements
CREATE OR REPLACE FUNCTION public.trg_after_insert_user_photo()
RETURNS trigger AS $$
BEGIN
  PERFORM public.ensure_user_stats_row(NEW.user_id);

  UPDATE public.user_stats
  SET photos_uploaded = (SELECT COUNT(*) FROM public.user_photos WHERE user_id = NEW.user_id),
      last_updated = now()
  WHERE user_id = NEW.user_id;

  PERFORM public.check_and_award_achievements(NEW.user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_user_photos_after_insert ON public.user_photos;
CREATE TRIGGER tr_user_photos_after_insert
AFTER INSERT ON public.user_photos
FOR EACH ROW
EXECUTE FUNCTION public.trg_after_insert_user_photo();

-- Seed: pre-populate achievement definitions if not already present
-- Explorer: Visit 5, 10, 25, 50 different shops
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
SELECT v.key, v.name, v.description, v.icon, v.category, v.requirements::jsonb, v.points
FROM (VALUES
  ('explorer_5','Explorer — 5','Visit 5 different shops','map-pin','explorer','{"kind":"shops_visited","value":5}',5),
  ('explorer_10','Explorer — 10','Visit 10 different shops','map-pin','explorer','{"kind":"shops_visited","value":10}',10),
  ('explorer_25','Explorer — 25','Visit 25 different shops','map-pin','explorer','{"kind":"shops_visited","value":25}',20),
  ('explorer_50','Explorer — 50','Visit 50 different shops','map-pin','explorer','{"kind":"shops_visited","value":50}',40)
) AS v(key,name,description,icon,category,requirements,points)
ON CONFLICT (key) DO NOTHING;

-- Critic: Write 5, 10, 25 reviews
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
SELECT v.key, v.name, v.description, v.icon, v.category, v.requirements::jsonb, v.points
FROM (VALUES
  ('critic_5','Critic — 5','Write 5 reviews','star','critic','{"kind":"reviews_written","value":5}',5),
  ('critic_10','Critic — 10','Write 10 reviews','star','critic','{"kind":"reviews_written","value":10}',10),
  ('critic_25','Critic — 25','Write 25 reviews','star','critic','{"kind":"reviews_written","value":25}',25)
) AS v(key,name,description,icon,category,requirements,points)
ON CONFLICT (key) DO NOTHING;

-- Photographer: Upload 10, 25 photos
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
SELECT v.key, v.name, v.description, v.icon, v.category, v.requirements::jsonb, v.points
FROM (VALUES
  ('photographer_10','Photographer — 10','Upload 10 photos','camera','photographer','{"kind":"photos_uploaded","value":10}',5),
  ('photographer_25','Photographer — 25','Upload 25 photos','camera','photographer','{"kind":"photos_uploaded","value":25}',15)
) AS v(key,name,description,icon,category,requirements,points)
ON CONFLICT (key) DO NOTHING;

-- Social: Get 10, 25 votes on your tags/reviews
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
SELECT v.key, v.name, v.description, v.icon, v.category, v.requirements::jsonb, v.points
FROM (VALUES
  ('social_10','Social — 10','Receive 10 votes on your content','thumb-up','social','{"kind":"votes_received","value":10}',5),
  ('social_25','Social — 25','Receive 25 votes on your content','thumb-up','social','{"kind":"votes_received","value":25}',15)
) AS v(key,name,description,icon,category,requirements,points)
ON CONFLICT (key) DO NOTHING;

-- Early Bird: Review before 8am (America/Chicago)
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
VALUES (
  'early_bird',
  'Early Bird',
  'Write a review before 8:00 AM local time (America/Chicago)',
  'sunrise',
  'time',
  '{"kind":"review_time_early","before_hour":8}',
  3
)
ON CONFLICT (key) DO NOTHING;

-- Night Owl: Review after 8pm (America/Chicago)
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
VALUES (
  'night_owl',
  'Night Owl',
  'Write a review after 8:00 PM local time (America/Chicago)',
  'moon',
  'time',
  '{"kind":"review_time_night","after_hour":20}',
  3
)
ON CONFLICT (key) DO NOTHING;

-- Weekend Warrior: Visit 5 shops on weekends (Sat/Sun)
INSERT INTO public.achievements (key, name, description, icon, category, requirements, points)
VALUES (
  'weekend_warrior_5',
  'Weekend Warrior — 5',
  'Visit 5 shops on weekends (Saturday or Sunday)',
  'calendar-weekend',
  'weekend',
  '{"kind":"weekend_visits","value":5}',
  10
)
ON CONFLICT (key) DO NOTHING;

-- Done.