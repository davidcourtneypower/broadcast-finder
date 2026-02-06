-- Migration: Reference Tables for Sports, Leagues, Countries, and Channels
-- Date: 2026-02-07
-- Description: Creates lookup tables to replace hardcoded frontend configuration.
--              Tables start empty and are auto-populated by edge functions.

-- ============================================
-- SPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sports (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  accent_color TEXT NOT NULL DEFAULT '#00e5ff',
  bg_color TEXT NOT NULL DEFAULT 'rgba(0,229,255,0.12)',
  duration_minutes INTEGER NOT NULL DEFAULT 150,
  pregame_window_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_name ON sports(name);

-- ============================================
-- LEAGUES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leagues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  sportsdb_league_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, sport_id)
);

CREATE INDEX IF NOT EXISTS idx_leagues_sport_id ON leagues(sport_id);
CREATE INDEX IF NOT EXISTS idx_leagues_sportsdb_id ON leagues(sportsdb_league_id);

-- ============================================
-- COUNTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  flag_emoji TEXT NOT NULL DEFAULT '🌍',
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_name ON countries(name);

-- ============================================
-- COUNTRY_CHANNELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS country_channels (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_id, channel_name)
);

CREATE INDEX IF NOT EXISTS idx_country_channels_country_id ON country_channels(country_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Sports: public read, service role write (service_role bypasses RLS)
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sports are viewable by everyone"
  ON sports FOR SELECT
  USING (true);

-- Leagues: public read, service role write
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leagues are viewable by everyone"
  ON leagues FOR SELECT
  USING (true);

-- Countries: public read, service role write
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Countries are viewable by everyone"
  ON countries FOR SELECT
  USING (true);

-- Country Channels: public read, service role write
ALTER TABLE country_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country channels are viewable by everyone"
  ON country_channels FOR SELECT
  USING (true);
