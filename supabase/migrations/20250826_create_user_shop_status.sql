-- Migration: create user_shop_status to track per-user status for coffee shops
-- Run via Supabase SQL editor or `npx supabase db push` / psql against your database.

-- Ensure pgcrypto for gen_random_uuid() (should already exist from earlier migrations)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table to track each user's relationship with a shop
CREATE TABLE IF NOT EXISTS public.user_shop_status (
  user_id uuid NOT NULL,
  shop_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('want_to_try', 'visited', 'favorite')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, shop_id),
  CONSTRAINT fk_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_shop
    FOREIGN KEY (shop_id)
    REFERENCES public.coffee_shops (id)
    ON DELETE CASCADE
);

-- Index to speed lookups per shop
CREATE INDEX IF NOT EXISTS idx_user_shop_status_shop_id ON public.user_shop_status (shop_id);

-- Index to speed lookups per user
CREATE INDEX IF NOT EXISTS idx_user_shop_status_user_id ON public.user_shop_status (user_id);