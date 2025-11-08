-- Kitty Creek Friends System Database Schema
-- Run this script to set up the PostgreSQL database

-- Players table (extends existing player data)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    friend_code TEXT UNIQUE NOT NULL, -- 6-8 character alphanumeric code
    display_name TEXT,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    money INTEGER DEFAULT 100,
    total_caught INTEGER DEFAULT 0,
    biggest_catch DECIMAL(10, 2) DEFAULT 0,
    player_stats JSONB DEFAULT '{"accuracy": 50, "luck": 50, "patience": 50, "strength": 50}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW()
);

-- Friendships table (bidirectional, symmetric)
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES players(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player1_id, player2_id),
    CHECK (player1_id != player2_id)
);

-- Friend activity feed (recent big catches)
CREATE TABLE IF NOT EXISTS friend_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    fish_name TEXT NOT NULL,
    fish_weight DECIMAL(10, 2) NOT NULL,
    fish_rarity TEXT,
    location_name TEXT,
    experience_gained INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Player fish collections (sync from game)
CREATE TABLE IF NOT EXISTS player_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE UNIQUE,
    caught_fish JSONB DEFAULT '{}'::jsonb, -- {fishId: {caught: bool, count: int, firstCatchDate: timestamp}}
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_player1 ON friendships(player1_id);
CREATE INDEX IF NOT EXISTS idx_friendships_player2 ON friendships(player2_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friend_activities_player ON friend_activities(player_id);
CREATE INDEX IF NOT EXISTS idx_friend_activities_created ON friend_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_friend_code ON players(friend_code);
CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_player_collections_player ON player_collections(player_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_collections_updated_at BEFORE UPDATE ON player_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();







