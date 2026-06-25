-- Cloud save PIN + full game state (run once on existing databases)
ALTER TABLE players ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS game_save JSONB DEFAULT '{}'::jsonb;
ALTER TABLE players ADD COLUMN IF NOT EXISTS game_save_updated_at TIMESTAMP;
