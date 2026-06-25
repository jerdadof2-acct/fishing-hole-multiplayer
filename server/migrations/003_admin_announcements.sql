-- Admin broadcasts (toasts / banners) from the Halley account to all players

CREATE TABLE IF NOT EXISTS admin_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES players(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT,
    display_type TEXT NOT NULL DEFAULT 'toast',
    toast_type TEXT NOT NULL DEFAULT 'info',
    banner_color TEXT DEFAULT '#fde68a',
    duration_ms INTEGER NOT NULL DEFAULT 6000,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_acks (
    announcement_id UUID REFERENCES admin_announcements(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    acked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (announcement_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_created_at
    ON admin_announcements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_player
    ON announcement_acks (player_id);
