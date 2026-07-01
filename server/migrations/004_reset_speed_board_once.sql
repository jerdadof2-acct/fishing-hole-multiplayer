-- One-time wipe of hook reaction times (clears global speed board source data).
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'speed_board_reset_v1') THEN
        UPDATE player_catches
        SET reaction_time_ms = NULL
        WHERE reaction_time_ms IS NOT NULL;

        UPDATE leaderboard_catches
        SET reaction_time_ms = NULL
        WHERE reaction_time_ms IS NOT NULL;

        INSERT INTO app_meta (key, value)
        VALUES ('speed_board_reset_v1', '2026-06-24');
    END IF;
END $$;
