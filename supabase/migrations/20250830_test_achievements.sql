-- Verification script for achievements, user_stats and triggers
-- Replace __TEST_USER_ID__ with an existing auth.users.id in your database before running.
-- Example: SELECT id FROM auth.users LIMIT 1;
--
-- Run via psql or Supabase SQL editor:
--   1) Replace '__TEST_USER_ID__' with a real user UUID
--   2) Run the whole file
-- The script will:
--   - Create a set of test shops
--   - Insert 'visited' statuses for multiple shops to trigger Explorer achievements
--   - Insert reviews (including early and late times) to trigger Critic, Early Bird, Night Owl
--   - Insert photos to trigger Photographer achievements
--   - Query user_stats and earned achievements

BEGIN;

-- IMPORTANT: replace this with a real user id from auth.users BEFORE running
-- e.g. \set REAL_USER_ID '...'
-- Then search-and-replace __TEST_USER_ID__ with the real id in this file.
-- For safety this script uses simple inserts; you may run in a disposable/dev DB.
-- ------------------------------------------------------------------------------

-- Ensure a user_stats row exists for the test user
INSERT INTO public.user_stats (user_id)
VALUES ('__TEST_USER_ID__')
ON CONFLICT (user_id) DO NOTHING;

-- Create a handful of test shops (these are minimal; google_place_id must be unique)
INSERT INTO public.coffee_shops (id, google_place_id, name)
VALUES
  (gen_random_uuid(), 'test-shop-1', 'Test Shop 1'),
  (gen_random_uuid(), 'test-shop-2', 'Test Shop 2'),
  (gen_random_uuid(), 'test-shop-3', 'Test Shop 3'),
  (gen_random_uuid(), 'test-shop-4', 'Test Shop 4'),
  (gen_random_uuid(), 'test-shop-5', 'Test Shop 5'),
  (gen_random_uuid(), 'test-shop-6', 'Test Shop 6')
ON CONFLICT (google_place_id) DO NOTHING;

-- Insert 'visited' statuses for each distinct shop for the test user
-- This simulates visiting multiple different shops (Explorer achievement)
INSERT INTO public.user_shop_status (user_id, shop_id, status, created_at, updated_at)
SELECT
  '__TEST_USER_ID__'::uuid,
  cs.id,
  'visited',
  now() - (interval '1 day' * (row_number() OVER (ORDER BY cs.google_place_id))),
  now() - (interval '1 day' * (row_number() OVER (ORDER BY cs.google_place_id)))
FROM public.coffee_shops cs
WHERE cs.google_place_id LIKE 'test-shop-%'
ORDER BY cs.google_place_id
ON CONFLICT (user_id, shop_id) DO UPDATE
  SET status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;

-- Insert reviews to simulate writing multiple reviews (Critic achievement)
-- and include one early (before 8am America/Chicago) and one late (after 8pm)
-- Find two shop ids to attach reviews to
-- Insert reviews to simulate writing multiple reviews (Critic achievement)
-- Use distinct shops so we don't violate the unique constraint (one review per user/shop)
INSERT INTO public.shop_reviews (id, user_id, shop_id, rating, review_text, created_at, updated_at)
SELECT gen_random_uuid(), '__TEST_USER_ID__'::uuid, cs.id,
       5, 'Automated test review',
       now() - (interval '10 days') + (gs || ' minutes')::interval,
       now() - (interval '10 days') + (gs || ' minutes')::interval
FROM public.coffee_shops cs
JOIN generate_series(1,5) gs ON TRUE
WHERE cs.google_place_id LIKE 'test-shop-%'
ORDER BY cs.google_place_id
LIMIT 5
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- Add a specific early review (07:30 America/Chicago)
INSERT INTO public.shop_reviews (id, user_id, shop_id, rating, review_text, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '__TEST_USER_ID__'::uuid,
  (SELECT id FROM public.coffee_shops WHERE google_place_id = 'test-shop-3' LIMIT 1),
  4,
  'Early bird test review',
  '2025-08-27T07:30:00-05:00'::timestamptz,
  '2025-08-27T07:30:00-05:00'::timestamptz
)
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- Add a specific late-night review (21:00 America/Chicago)
INSERT INTO public.shop_reviews (id, user_id, shop_id, rating, review_text, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '__TEST_USER_ID__'::uuid,
  (SELECT id FROM public.coffee_shops WHERE google_place_id = 'test-shop-4' LIMIT 1),
  5,
  'Night owl test review',
  '2025-08-27T21:00:00-05:00'::timestamptz,
  '2025-08-27T21:00:00-05:00'::timestamptz
)
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- Insert photos (Photographer achievement)
INSERT INTO public.user_photos (id, user_id, shop_id, url, created_at)
SELECT gen_random_uuid(),
       '__TEST_USER_ID__'::uuid,
       cs.id,
       'https://example.com/photo-' || generate_series || '.jpg',
       now() - (interval '1 hour' * generate_series)
FROM public.coffee_shops cs, generate_series(1,12);

-- At this point triggers should have updated user_stats and possibly inserted user_achievements.
-- Query current stats and earned achievements for verification.
-- ------------------------------------------------------------------------------

-- Show user_stats
SELECT * FROM public.user_stats WHERE user_id = '__TEST_USER_ID__'::uuid;

-- Show earned achievements
SELECT a.key, a.name, ua.earned_at, ua.progress
FROM public.user_achievements ua
JOIN public.achievements a ON a.id = ua.achievement_id
WHERE ua.user_id = '__TEST_USER_ID__'::uuid
ORDER BY ua.earned_at;

-- Show all achievements definitions (to inspect thresholds)
SELECT key, name, requirements, points FROM public.achievements ORDER BY category, key;

COMMIT;

-- If you want to run in a transaction and rollback after inspection, replace BEGIN/COMMIT with BEGIN/ROLLBACK
-- End of script