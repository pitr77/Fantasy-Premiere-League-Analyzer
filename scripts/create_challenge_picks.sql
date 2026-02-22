-- FPL Studio: Challenge Picks Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS challenge_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  gameweek INT NOT NULL,
  gk_id INT NOT NULL,
  def_id INT NOT NULL,
  mid_id INT NOT NULL,
  fwd_id INT NOT NULL,
  captain_id INT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gameweek)
);

-- Enable Row Level Security
ALTER TABLE challenge_picks ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own picks
CREATE POLICY "Users can manage their own picks" ON challenge_picks
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_picks_gw ON challenge_picks (gameweek);
