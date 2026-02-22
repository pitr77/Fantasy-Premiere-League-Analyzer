-- FPL Studio: Scout Articles Table
-- Run this in Supabase SQL Editor (or via migration)

CREATE TABLE IF NOT EXISTS scout_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  gameweek INT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  captain_pick TEXT,
  differential_pick TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Enable Row Level Security
ALTER TABLE scout_articles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published articles
CREATE POLICY "Public read access" ON scout_articles
  FOR SELECT USING (published = true);

-- Allow public insert/upsert for development (WARNING: Secure this in production)
CREATE POLICY "Public insert access" ON scout_articles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update access" ON scout_articles
  FOR UPDATE USING (true);

-- Create index for faster slug lookups and ordering
CREATE INDEX IF NOT EXISTS idx_scout_articles_slug ON scout_articles (slug);
CREATE INDEX IF NOT EXISTS idx_scout_articles_gameweek ON scout_articles (gameweek DESC);
CREATE INDEX IF NOT EXISTS idx_scout_articles_generated_at ON scout_articles (generated_at DESC);
