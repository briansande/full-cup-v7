-- Migration: add google photo columns for coffee_shops
-- Run via `npx supabase db push --project-ref {your-project-ref}`

ALTER TABLE IF EXISTS public.coffee_shops
  ADD COLUMN IF NOT EXISTS google_photo_reference text,
  ADD COLUMN IF NOT EXISTS main_photo_url text,
  ADD COLUMN IF NOT EXISTS photo_attribution text;