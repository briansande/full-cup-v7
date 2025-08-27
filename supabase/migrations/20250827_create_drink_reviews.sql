-- Migration: create drink_reviews for user-submitted drink reviews
-- Run via Supabase SQL editor or `npx supabase db push` / psql against your database.

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.drink_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  drink_name text NOT NULL,
  rating text NOT NULL CHECK (rating IN ('pass','good','awesome')),
  drink_type text,
  review_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_drink_review_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_drink_review_shop
    FOREIGN KEY (shop_id)
    REFERENCES public.coffee_shops (id)
    ON DELETE CASCADE
);

-- Index to quickly fetch reviews for a shop
CREATE INDEX IF NOT EXISTS idx_drink_reviews_shop_id ON public.drink_reviews (shop_id);

-- Index to quickly fetch reviews by user
CREATE INDEX IF NOT EXISTS idx_drink_reviews_user_id ON public.drink_reviews (user_id);