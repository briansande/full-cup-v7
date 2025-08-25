-- Migration: Adjust coffee_shops table for Places API (New)
-- 1. Add google_user_ratings_total column
-- 2. Widen price_level check constraint to allow 0 (for "FREE")

ALTER TABLE public.coffee_shops
ADD COLUMN IF NOT EXISTS google_user_ratings_total integer;

-- First, drop the old constraint if it exists
ALTER TABLE public.coffee_shops
DROP CONSTRAINT IF EXISTS coffee_shops_price_level_check;

-- Then, add the new, corrected constraint
ALTER TABLE public.coffee_shops
ADD CONSTRAINT coffee_shops_price_level_check CHECK (price_level >= 0 AND price_level <= 4);
