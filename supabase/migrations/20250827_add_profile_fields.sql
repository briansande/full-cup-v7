-- Migration: add display_name and bio to user_profiles
-- Run this in Supabase SQL editor or via psql / supabase CLI.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text;