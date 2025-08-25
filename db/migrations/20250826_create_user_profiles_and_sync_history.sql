-- Migration: create user_profiles and sync_history tables
-- Run this in Supabase SQL editor or via psql / supabase CLI.

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create user_profiles table to mirror auth users with is_admin flag
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY,
  email text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create sync_history table to record manual syncs
CREATE TABLE IF NOT EXISTS public.sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  inserted_count integer,
  status text DEFAULT 'started' CHECK (status IN ('started','success','failed')),
  error text,
  requested_by uuid,
  requested_email text
);

CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON public.sync_history (started_at);