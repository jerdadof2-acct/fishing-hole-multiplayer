-- Track who initiated a friend request (sent vs received was wrongly inferred from UUID order).
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS requested_by_id UUID REFERENCES players(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_friendships_requested_by ON friendships(requested_by_id);
