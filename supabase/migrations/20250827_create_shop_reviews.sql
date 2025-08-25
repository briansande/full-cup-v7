-- Migration: create shop_reviews for simple user reviews (rating 1-5)
-- Run via Supabase SQL editor or `npx supabase db push` / psql against your database.

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table for shop reviews
CREATE TABLE IF NOT EXISTS public.shop_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_review_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_shop
    FOREIGN KEY (shop_id)
    REFERENCES public.coffee_shops (id)
    ON DELETE CASCADE
);

-- Prevent duplicate reviews from same user for the same shop (one review per user/shop).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_reviews_user_shop ON public.shop_reviews (user_id, shop_id);

-- Index to quickly fetch reviews for a shop
CREATE INDEX IF NOT EXISTS idx_shop_reviews_shop_id ON public.shop_reviews (shop_id);

-- Index to quickly fetch reviews by user
CREATE INDEX IF NOT EXISTS idx_shop_reviews_user_id ON public.shop_reviews (user_id);