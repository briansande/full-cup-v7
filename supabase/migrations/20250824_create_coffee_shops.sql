-- Migration: create coffee_shops table with full schema requested
-- Run via `npx supabase db push --project-ref {your-project-ref}`

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.coffee_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id text UNIQUE NOT NULL,
  name text NOT NULL,
  address text,
  formatted_address text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  phone text,
  website text,
  google_rating numeric(2,1),
  price_level integer CHECK (price_level >= 1 AND price_level <= 4),
  opening_hours jsonb,
  photos text[],
  types text[],
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'temporarily_closed')),
  is_chain_excluded boolean DEFAULT false,
  date_added timestamptz DEFAULT now(),
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coffee_shops_google_place_id ON public.coffee_shops (google_place_id);