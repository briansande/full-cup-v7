-- Migration: Enhance shop_reviews with multiple rating criteria and computed overall rating
-- - Adds coffee_quality_rating (migrates existing rating -> coffee_quality_rating)
-- - Adds atmosphere_rating, noise_level_rating, wifi_quality_rating, work_friendliness_rating, service_rating
-- - Makes rating nullable and converts it to numeric(3,2) to store averaged overall rating
-- - Adds trigger to compute overall rating as the average of provided criteria (ignores NULLs)
-- - Preserves compatibility: incoming writes that set "rating" (existing client behavior) will be treated as coffee_quality_rating if other criteria are not provided
-- Run via Supabase SQL editor or `npx supabase db push` / psql against your database.

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Add new rating columns (nullable, checks allow NULL)
ALTER TABLE public.shop_reviews
  ADD COLUMN IF NOT EXISTS coffee_quality_rating smallint,
  ADD COLUMN IF NOT EXISTS atmosphere_rating smallint,
  ADD COLUMN IF NOT EXISTS noise_level_rating smallint,
  ADD COLUMN IF NOT EXISTS wifi_quality_rating smallint,
  ADD COLUMN IF NOT EXISTS work_friendliness_rating smallint,
  ADD COLUMN IF NOT EXISTS service_rating smallint;

-- Add range checks that allow NULL (partial reviews allowed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_coffee_quality_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_coffee_quality_rating_range CHECK (coffee_quality_rating IS NULL OR (coffee_quality_rating >= 1 AND coffee_quality_rating <= 5))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_atmosphere_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_atmosphere_rating_range CHECK (atmosphere_rating IS NULL OR (atmosphere_rating >= 1 AND atmosphere_rating <= 5))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_noise_level_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_noise_level_rating_range CHECK (noise_level_rating IS NULL OR (noise_level_rating >= 1 AND noise_level_rating <= 5))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_wifi_quality_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_wifi_quality_rating_range CHECK (wifi_quality_rating IS NULL OR (wifi_quality_rating >= 1 AND wifi_quality_rating <= 5))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_work_friendliness_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_work_friendliness_rating_range CHECK (work_friendliness_rating IS NULL OR (work_friendliness_rating >= 1 AND work_friendliness_rating <= 5))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_service_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_service_rating_range CHECK (service_rating IS NULL OR (service_rating >= 1 AND service_rating <= 5))';
  END IF;
END;
$$;

-- 2) Make existing "rating" column nullable and convert to numeric(3,2) so it can store averaged values
-- If the column is NOT NULL, drop the constraint; first drop NOT NULL if present
ALTER TABLE public.shop_reviews ALTER COLUMN rating DROP NOT NULL;

-- Change type to numeric(3,2) to allow decimal averages. If already numeric this will be a no-op.
ALTER TABLE public.shop_reviews
  ALTER COLUMN rating TYPE numeric(3,2) USING rating::numeric(3,2);

-- Add a more explicit range constraint for the overall rating (allows NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_shop_reviews_rating_range') THEN
    EXECUTE 'ALTER TABLE public.shop_reviews ADD CONSTRAINT ck_shop_reviews_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))';
  END IF;
END;
$$;

-- 3) Create trigger function to compute overall rating from available criteria
CREATE OR REPLACE FUNCTION public.compute_shop_review_overall()
RETURNS trigger AS $$
DECLARE
  sum_vals integer := 0;
  cnt integer := 0;
  avg_val numeric(3,2);
BEGIN
  -- Backward compatibility: if client wrote `rating` (legacy single-field), and coffee_quality_rating is not set,
  -- treat the incoming rating value as coffee_quality_rating (cast/truncate if necessary).
  IF (NEW.coffee_quality_rating IS NULL) AND (NEW.rating IS NOT NULL) THEN
    -- If rating is a decimal (e.g. existing rows after type change), cast to nearest integer for coffee_quality_rating
    NEW.coffee_quality_rating := CAST(ROUND(NEW.rating)::int AS smallint);
  END IF;

  -- Sum up non-null rating criteria
  IF NEW.coffee_quality_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.coffee_quality_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.atmosphere_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.atmosphere_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.noise_level_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.noise_level_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.wifi_quality_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.wifi_quality_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.work_friendliness_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.work_friendliness_rating;
    cnt := cnt + 1;
  END IF;
  IF NEW.service_rating IS NOT NULL THEN
    sum_vals := sum_vals + NEW.service_rating;
    cnt := cnt + 1;
  END IF;

  IF cnt = 0 THEN
    NEW.rating := NULL; -- no criteria provided
  ELSE
    avg_val := (sum_vals::numeric / cnt)::numeric(3,2);
    NEW.rating := avg_val;
  END IF;

  -- Keep updated_at fresh
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 4) Attach trigger to compute overall rating before insert/update
DROP TRIGGER IF EXISTS trg_compute_overall_rating ON public.shop_reviews;
CREATE TRIGGER trg_compute_overall_rating
  BEFORE INSERT OR UPDATE ON public.shop_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_shop_review_overall();

-- 5) Migrate existing rows:
--   - Populate coffee_quality_rating from the old integer rating values (safe because previous values were 1..5)
--   - Re-run the trigger logic by touching rows to compute averaged rating (which for existing rows will be same as coffee_quality_rating until other criteria are filled)
UPDATE public.shop_reviews
SET coffee_quality_rating = CAST(ROUND(rating)::int AS smallint)
WHERE coffee_quality_rating IS NULL AND rating IS NOT NULL;

-- Force update so trigger recomputes the overall rating (sets rating to averaged value; currently only coffee_quality present)
UPDATE public.shop_reviews
SET updated_at = now();

-- 6) Notes:
-- - Existing application code that reads/writes the `rating` field will continue to work:
--     * On INSERT/UPDATE when clients supply `rating`, the trigger will copy that value into coffee_quality_rating (if not already set),
--       then compute the overall `rating` as the average of available criteria.
-- - Ratings are optional: any subset of criteria may be provided. The overall rating will be the average of provided criteria.
-- - If you prefer to migrate the application to write `coffee_quality_rating` explicitly and read `rating` as overall,
--   update client forms / APIs in the next step (as requested, UI changes are deferred).
-- End migration.