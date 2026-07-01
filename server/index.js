/**
 * Halley's Big Catch Friends System Backend Server
 * Express.js server with PostgreSQL integration
 */

import dotenv from 'dotenv';
import express from 'express';
import compression from 'compression';
import { Pool } from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { hashPin, validatePin, verifyPin } from './pinAuth.js';
import { mapAnnouncementRow, normalizeAnnouncementInput } from './adminAnnouncements.js';
import { runMigrations } from './migrate.js';
import { isAdminUsername, withAdminFlag, getAdminUsername } from './adminAuth.js';
import {
    backfillAllPlayersWithHalley,
    decorateFriendRow,
    ensureHalleyFriendship,
    getHalleyPlayer,
    isHalleyPlayerId,
    syncHalleyFriendships
} from './halleyFriend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

function getDatabaseSsl(connectionString) {
    if (!connectionString) return false;
    if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
        return false;
    }
    return { rejectUnauthorized: false };
}

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getDatabaseSsl(process.env.DATABASE_URL)
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || (NODE_ENV === 'production' ? false : '*'),
    credentials: true
}));
app.use(express.json());
app.use(compression());

// Serve static files (game files) — avoid stale HTML/JS on mobile browsers
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders(res, filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        if (
            normalized.endsWith('.html')
            || normalized.includes('/src/')
            || normalized.endsWith('/service-worker.js')
        ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Helper: Generate friend code (6-8 alphanumeric, uppercase)
function generateFriendCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0, O, I, 1)
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Helper: Authenticate user from Bearer token
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = authHeader.substring(7);
    req.userId = userId;
    next();
}

// Helper: Validate UUID
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

function requireAdmin(req, res, next) {
    if (!isValidUUID(req.userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    pool.query('SELECT username FROM players WHERE id = $1', [req.userId])
        .then((result) => {
            const username = result.rows[0]?.username;
            if (!username || !isAdminUsername(username)) {
                return res.status(403).json({ error: 'Admin access required' });
            }
            req.adminUsername = username;
            next();
        })
        .catch((error) => {
            console.error('[API] Admin auth error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
}

// ==================== Player Routes ====================

// Register new player (username + save PIN)
app.post('/api/players/register', async (req, res) => {
    try {
        const { username, pin } = req.body;
        
        // Validate username
        if (!username || typeof username !== 'string') {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be 3-20 characters' });
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
        }

        const pinCheck = validatePin(pin);
        if (!pinCheck.ok) {
            return res.status(400).json({ error: pinCheck.error });
        }
        
        // Generate unique friend code
        let friendCode;
        let attempts = 0;
        do {
            friendCode = generateFriendCode();
            attempts++;
            if (attempts > 10) {
                return res.status(500).json({ error: 'Failed to generate unique friend code' });
            }
        } while (await pool.query('SELECT id FROM players WHERE friend_code = $1', [friendCode]).then(r => r.rows.length > 0));
        
        const pinHash = hashPin(pin);

        // Insert player
        const result = await pool.query(
            `INSERT INTO players (username, friend_code, display_name, pin_hash)
             VALUES ($1, $2, $1, $3)
             RETURNING id, username, friend_code, level, experience, money, player_stats, created_at`,
            [username, friendCode, pinHash]
        );
        
        const player = result.rows[0];
        
        // Initialize collection
        await pool.query(
            'INSERT INTO player_collections (player_id, caught_fish) VALUES ($1, $2)',
            [player.id, JSON.stringify({})]
        );

        if (isAdminUsername(player.username)) {
            await backfillAllPlayersWithHalley(pool, player.id);
        } else {
            await ensureHalleyFriendship(pool, player.id);
        }
        
        res.json({
            userId: player.id,
            username: player.username,
            friendCode: player.friend_code,
            level: player.level,
            experience: player.experience,
            money: player.money,
            stats: player.player_stats,
            isAdmin: isAdminUsername(player.username)
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Username already taken' });
        }
        console.error('[API] Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign in on a new device / after reinstall (username + save PIN)
app.post('/api/players/login', async (req, res) => {
    try {
        const { username, pin } = req.body;

        if (!username || typeof username !== 'string') {
            return res.status(400).json({ error: 'Username is required' });
        }

        const pinCheck = validatePin(pin);
        if (!pinCheck.ok) {
            return res.status(400).json({ error: pinCheck.error });
        }

        const result = await pool.query(
            `SELECT id, username, friend_code, display_name, level, experience, money,
                    total_caught, biggest_catch, player_stats, pin_hash, game_save,
                    game_save_updated_at, last_active, created_at
             FROM players
             WHERE username = $1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Username or save PIN is incorrect.' });
        }

        const player = result.rows[0];

        if (!player.pin_hash) {
            return res.status(403).json({
                error: 'This account has no save PIN yet. On Returning, enter your username and leave PIN blank to claim it.',
                code: 'NO_SAVE_PIN'
            });
        }

        if (!verifyPin(pin, player.pin_hash)) {
            return res.status(401).json({ error: 'Username or save PIN is incorrect.' });
        }

        await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [player.id]);
        await ensureHalleyFriendship(pool, player.id);

        const gameSave = player.game_save && typeof player.game_save === 'object' ? player.game_save : {};

        res.json({
            userId: player.id,
            username: player.username,
            friendCode: player.friend_code,
            level: player.level,
            experience: player.experience,
            money: player.money,
            stats: player.player_stats,
            totalCaught: player.total_caught,
            biggestCatch: player.biggest_catch,
            gameSave,
            gameSaveUpdatedAt: player.game_save_updated_at,
            hasPin: true,
            isAdmin: isAdminUsername(player.username)
        });
    } catch (error) {
        console.error('[API] Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function buildPinlessAuthResponse(player) {
    const gameSave = player.game_save && typeof player.game_save === 'object' ? player.game_save : {};
    return {
        userId: player.id,
        username: player.username,
        friendCode: player.friend_code,
        level: player.level,
        experience: player.experience,
        money: player.money,
        stats: player.player_stats,
        totalCaught: player.total_caught,
        biggestCatch: player.biggest_catch,
        gameSave,
        gameSaveUpdatedAt: player.game_save_updated_at,
        hasPin: false,
        requiresPinSetup: true,
        isAdmin: isAdminUsername(player.username)
    };
}

// Claim an older account by username only (no save PIN set yet) — then set a PIN in-game
app.post('/api/players/claim', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username || typeof username !== 'string') {
            return res.status(400).json({ error: 'Username is required' });
        }

        const result = await pool.query(
            `SELECT id, username, friend_code, display_name, level, experience, money,
                    total_caught, biggest_catch, player_stats, pin_hash, game_save,
                    game_save_updated_at, last_active, created_at
             FROM players
             WHERE username = $1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No account found with that username.' });
        }

        const player = result.rows[0];

        if (player.pin_hash) {
            return res.status(403).json({
                error: 'This account already has a save PIN. Enter your username and PIN on Returning.',
                code: 'HAS_SAVE_PIN'
            });
        }

        await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [player.id]);
        await ensureHalleyFriendship(pool, player.id);

        res.json(buildPinlessAuthResponse(player));
    } catch (error) {
        console.error('[API] Claim error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Recover account without a save PIN (username + friend code) — only when pin_hash is NULL
app.post('/api/players/recover', async (req, res) => {
    try {
        const { username, friendCode } = req.body;

        if (!username || typeof username !== 'string') {
            return res.status(400).json({ error: 'Username is required' });
        }
        if (!friendCode || typeof friendCode !== 'string') {
            return res.status(400).json({ error: 'Friend code is required' });
        }

        const normalizedCode = friendCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{6,8}$/.test(normalizedCode)) {
            return res.status(400).json({ error: 'Enter a valid friend code' });
        }

        const result = await pool.query(
            `SELECT id, username, friend_code, display_name, level, experience, money,
                    total_caught, biggest_catch, player_stats, pin_hash, game_save,
                    game_save_updated_at, last_active, created_at
             FROM players
             WHERE username = $1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Username or friend code is incorrect.' });
        }

        const player = result.rows[0];

        if (player.pin_hash) {
            return res.status(403).json({
                error: 'This account already has a save PIN. Sign in with your username and save PIN instead.',
                code: 'HAS_SAVE_PIN'
            });
        }

        if ((player.friend_code || '').toUpperCase() !== normalizedCode) {
            return res.status(401).json({ error: 'Username or friend code is incorrect.' });
        }

        await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [player.id]);
        await ensureHalleyFriendship(pool, player.id);

        res.json(buildPinlessAuthResponse(player));
    } catch (error) {
        console.error('[API] Recover error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current player
app.get('/api/players/me', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const result = await pool.query(
            `SELECT id, username, friend_code, display_name, level, experience, money,
                    total_caught, biggest_catch, player_stats, last_active, created_at,
                    (pin_hash IS NOT NULL) AS has_pin
             FROM players
             WHERE id = $1`,
            [req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        // Update last_active
        await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [req.userId]);
        
        res.json(withAdminFlag(result.rows[0]));
    } catch (error) {
        console.error('[API] Get player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lightweight heartbeat so friends see this player as online
app.post('/api/players/me/presence', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [req.userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Presence ping error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify admin status for the Halley account
app.get('/api/admin/status', authenticate, requireAdmin, async (req, res) => {
    res.json({
        isAdmin: true,
        username: req.adminUsername
    });
});

// How many players were active recently (for Halley live ops)
app.get('/api/admin/online-count', authenticate, requireAdmin, async (req, res) => {
    try {
        const minutes = Math.min(Math.max(Number(req.query.minutes) || 5, 1), 60);
        const result = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM players
             WHERE last_active >= NOW() - ($1::text || ' minutes')::interval`,
            [String(minutes)]
        );
        res.json({
            onlineCount: result.rows[0]?.count ?? 0,
            windowMinutes: minutes
        });
    } catch (error) {
        console.error('[API] Admin online count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Registered anglers — count who have played, plus full username roster (Halley admin only)
app.get('/api/admin/players/registry', authenticate, requireAdmin, async (req, res) => {
    try {
        const adminName = getAdminUsername();
        const [countResult, namesResult] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM players
                 WHERE LOWER(username) != LOWER($1)
                   AND (
                       total_caught > 0
                       OR experience > 0
                       OR level > 1
                   )`,
                [adminName]
            ),
            pool.query(
                `SELECT username
                 FROM players
                 WHERE LOWER(username) != LOWER($1)
                 ORDER BY LOWER(username) ASC`,
                [adminName]
            )
        ]);

        res.json({
            activePlayerCount: countResult.rows[0]?.count ?? 0,
            usernames: namesResult.rows.map((row) => row.username)
        });
    } catch (error) {
        console.error('[API] Admin player registry error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send a toast or banner to every player (delivered on their next poll)
app.post('/api/admin/announcements', authenticate, requireAdmin, async (req, res) => {
    try {
        const parsed = normalizeAnnouncementInput(req.body);
        if (!parsed.ok) {
            return res.status(400).json({ error: parsed.error });
        }

        const { title, body, displayType, toastType, bannerColor, durationMs, expiresAt } = parsed.value;

        const result = await pool.query(
            `INSERT INTO admin_announcements
                (created_by, title, body, display_type, toast_type, banner_color, duration_ms, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, title, body, display_type, toast_type, banner_color, duration_ms, expires_at, created_at`,
            [req.userId, title, body || null, displayType, toastType, bannerColor, durationMs, expiresAt]
        );

        res.json({
            success: true,
            announcement: mapAnnouncementRow(result.rows[0])
        });
    } catch (error) {
        console.error('[API] Admin announcement create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Recent broadcasts Halley has sent
app.get('/api/admin/announcements/recent', authenticate, requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
        const result = await pool.query(
            `SELECT id, title, body, display_type, toast_type, banner_color, duration_ms, expires_at, created_at
             FROM admin_announcements
             ORDER BY created_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows.map(mapAnnouncementRow));
    } catch (error) {
        console.error('[API] Admin announcement list error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Look up a player by username or friend code (Halley admin only)
app.get('/api/admin/players/lookup', authenticate, requireAdmin, async (req, res) => {
    try {
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Enter a username or friend code to look up.' });
        }

        const result = await pool.query(
            `SELECT id, username, friend_code, level, experience, total_caught, biggest_catch, last_active, created_at
             FROM players
             WHERE LOWER(username) = LOWER($1) OR UPPER(friend_code) = UPPER($1)
             LIMIT 1`,
            [query]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No player found with that username or friend code.' });
        }

        const player = result.rows[0];
        res.json({
            id: player.id,
            username: player.username,
            friendCode: player.friend_code,
            level: player.level,
            experience: player.experience,
            totalCaught: player.total_caught,
            biggestCatch: player.biggest_catch,
            lastActive: player.last_active,
            createdAt: player.created_at,
            isAdmin: isAdminUsername(player.username),
            isSelf: player.id === req.userId
        });
    } catch (error) {
        console.error('[API] Admin player lookup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Permanently delete a player account (requires exact username confirmation)
app.delete('/api/admin/players/:playerId', authenticate, requireAdmin, async (req, res) => {
    try {
        const { playerId } = req.params;
        const confirmUsername = typeof req.body?.confirmUsername === 'string'
            ? req.body.confirmUsername.trim()
            : '';

        if (!isValidUUID(playerId)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }

        if (!confirmUsername) {
            return res.status(400).json({ error: 'Type the exact username to confirm deletion.' });
        }

        if (playerId === req.userId) {
            return res.status(403).json({ error: 'You cannot delete your own Halley account.' });
        }

        const result = await pool.query(
            `SELECT id, username FROM players WHERE id = $1`,
            [playerId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const player = result.rows[0];

        if (isAdminUsername(player.username)) {
            return res.status(403).json({ error: 'The Halley admin account cannot be deleted.' });
        }

        if (player.username !== confirmUsername) {
            return res.status(400).json({ error: 'Confirmation username does not match.' });
        }

        await pool.query('DELETE FROM players WHERE id = $1', [playerId]);

        res.json({
            success: true,
            deletedUsername: player.username
        });
    } catch (error) {
        console.error('[API] Admin player delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Pending announcements for the signed-in player
app.get('/api/announcements/pending', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await pool.query(
            `SELECT a.id, a.title, a.body, a.display_type, a.toast_type, a.banner_color, a.duration_ms, a.expires_at, a.created_at
             FROM admin_announcements a
             LEFT JOIN announcement_acks ack
                 ON ack.announcement_id = a.id AND ack.player_id = $1
             WHERE ack.announcement_id IS NULL
               AND (a.expires_at IS NULL OR a.expires_at > NOW())
             ORDER BY a.created_at ASC
             LIMIT 10`,
            [req.userId]
        );

        res.json(result.rows.map(mapAnnouncementRow));
    } catch (error) {
        console.error('[API] Pending announcements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark an announcement as shown to this player
app.post('/api/announcements/:announcementId/ack', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { announcementId } = req.params;
        if (!isValidUUID(announcementId)) {
            return res.status(400).json({ error: 'Invalid announcement ID' });
        }

        await pool.query(
            `INSERT INTO announcement_acks (announcement_id, player_id)
             VALUES ($1, $2)
             ON CONFLICT (announcement_id, player_id) DO NOTHING`,
            [announcementId, req.userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Announcement ack error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update player data (sync from game)
app.put('/api/players/me', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { level, experience, money, totalCaught, biggestCatch, stats } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 1;
        
        if (level !== undefined) {
            updates.push(`level = $${paramCount++}`);
            values.push(level);
        }
        if (experience !== undefined) {
            updates.push(`experience = $${paramCount++}`);
            values.push(experience);
        }
        if (money !== undefined) {
            updates.push(`money = $${paramCount++}`);
            values.push(money);
        }
        if (totalCaught !== undefined) {
            updates.push(`total_caught = $${paramCount++}`);
            values.push(totalCaught);
        }
        if (biggestCatch !== undefined) {
            updates.push(`biggest_catch = $${paramCount++}`);
            values.push(biggestCatch);
        }
        if (stats !== undefined) {
            updates.push(`player_stats = $${paramCount++}::jsonb`);
            values.push(JSON.stringify(stats));
        }
        
        updates.push(`last_active = NOW()`);
        values.push(req.userId);
        
        const query = `
            UPDATE players
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, username, friend_code, level, experience, money, 
                      total_caught, biggest_catch, player_stats, last_active
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[API] Update player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Set save PIN (existing accounts on their original device)
app.put('/api/players/me/pin', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { pin } = req.body;
        const pinCheck = validatePin(pin);
        if (!pinCheck.ok) {
            return res.status(400).json({ error: pinCheck.error });
        }

        const existing = await pool.query(
            'SELECT pin_hash FROM players WHERE id = $1',
            [req.userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        if (existing.rows[0].pin_hash) {
            return res.status(409).json({ error: 'Save PIN is already set for this account.' });
        }

        await pool.query(
            'UPDATE players SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
            [hashPin(pin), req.userId]
        );

        res.json({ success: true, hasPin: true });
    } catch (error) {
        console.error('[API] Set PIN error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download full cloud save
app.get('/api/players/me/save', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await pool.query(
            `SELECT game_save, game_save_updated_at,
                    (pin_hash IS NOT NULL) AS has_pin
             FROM players WHERE id = $1`,
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const row = result.rows[0];
        res.json({
            gameSave: row.game_save && typeof row.game_save === 'object' ? row.game_save : {},
            gameSaveUpdatedAt: row.game_save_updated_at,
            hasPin: row.has_pin
        });
    } catch (error) {
        console.error('[API] Get save error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload full cloud save
app.put('/api/players/me/save', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { gameSave } = req.body;
        if (!gameSave || typeof gameSave !== 'object') {
            return res.status(400).json({ error: 'Invalid save data' });
        }

        const payload = JSON.stringify(gameSave);
        if (payload.length > 2_000_000) {
            return res.status(413).json({ error: 'Save data too large' });
        }

        const result = await pool.query(
            `UPDATE players
             SET game_save = $1::jsonb,
                 game_save_updated_at = NOW(),
                 last_active = NOW(),
                 level = COALESCE($2, level),
                 experience = COALESCE($3, experience),
                 money = COALESCE($4, money),
                 total_caught = COALESCE($5, total_caught),
                 biggest_catch = COALESCE($6, biggest_catch),
                 player_stats = COALESCE($7::jsonb, player_stats)
             WHERE id = $8
             RETURNING game_save_updated_at`,
            [
                payload,
                gameSave.player?.level ?? null,
                gameSave.player?.experience ?? null,
                gameSave.player?.money ?? null,
                gameSave.player?.totalCaught ?? null,
                gameSave.player?.biggestCatch ?? null,
                gameSave.player?.stats ? JSON.stringify(gameSave.player.stats) : null,
                req.userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        if (gameSave.collection?.caughtFishCollection) {
            await pool.query(
                `INSERT INTO player_collections (player_id, caught_fish, updated_at)
                 VALUES ($1, $2::jsonb, NOW())
                 ON CONFLICT (player_id)
                 DO UPDATE SET caught_fish = EXCLUDED.caught_fish, updated_at = NOW()`,
                [req.userId, JSON.stringify(gameSave.collection.caughtFishCollection)]
            );
        }

        res.json({
            success: true,
            gameSaveUpdatedAt: result.rows[0].game_save_updated_at
        });
    } catch (error) {
        console.error('[API] Update save error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get player by friend code
app.get('/api/players/:friendCode', async (req, res) => {
    try {
        const { friendCode } = req.params;
        
        if (!friendCode || friendCode.length < 6 || friendCode.length > 8) {
            return res.status(400).json({ error: 'Invalid friend code' });
        }
        
        const result = await pool.query(
            `SELECT id, username, friend_code, level, experience, money,
                    total_caught, biggest_catch, player_stats, last_active
             FROM players
             WHERE friend_code = $1`,
            [friendCode.toUpperCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[API] Get player by code error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get player's fish collection
app.get('/api/players/:playerId/collection', authenticate, async (req, res) => {
    try {
        const { playerId } = req.params;
        
        if (!isValidUUID(playerId)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }
        
        const result = await pool.query(
            'SELECT caught_fish FROM player_collections WHERE player_id = $1',
            [playerId]
        );
        
        if (result.rows.length === 0) {
            return res.json({ caughtFish: {}, caughtFishList: [] });
        }
        
        const caughtFish = result.rows[0].caught_fish || {};
        const fishList = Object.entries(caughtFish)
            .filter(([_, data]) => data?.caught)
            .map(([fishId, data]) => ({
                fishId: parseInt(fishId, 10),
                count: data.count || 0,
                firstCatchDate: data.firstCatchDate || null
            }));
        
        res.json({ caughtFish, caughtFishList: fishList });
    } catch (error) {
        console.error('[API] Get collection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update player's fish collection
app.put('/api/players/me/collection', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { caughtFishCollection } = req.body;
        
        if (!caughtFishCollection || typeof caughtFishCollection !== 'object') {
            return res.status(400).json({ error: 'Invalid collection data' });
        }
        
        await pool.query(
            `INSERT INTO player_collections (player_id, caught_fish, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (player_id) 
             DO UPDATE SET caught_fish = $2::jsonb, updated_at = NOW()`,
            [req.userId, JSON.stringify(caughtFishCollection)]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Update collection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Friends Routes ====================

// Send friend request
app.post('/api/friends/request', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { friendCode } = req.body;
        
        if (!friendCode) {
            return res.status(400).json({ error: 'Friend code is required' });
        }
        
        // Get friend's user ID
        const friendResult = await pool.query(
            'SELECT id, username FROM players WHERE friend_code = $1',
            [friendCode.toUpperCase()]
        );
        
        if (friendResult.rows.length === 0) {
            return res.status(404).json({ error: 'Friend code not found' });
        }
        
        const friendId = friendResult.rows[0].id;
        const friendUsername = friendResult.rows[0].username;
        
        if (friendId === req.userId) {
            return res.status(400).json({ error: 'Cannot add yourself as a friend' });
        }

        if (isAdminUsername(friendUsername)) {
            await ensureHalleyFriendship(pool, req.userId);
            return res.json({
                success: true,
                message: 'Halley is already on your crew!',
                autoFriend: true
            });
        }
        
        // Check if friendship already exists
        const existingResult = await pool.query(
            `SELECT id, status FROM friendships
             WHERE (player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1)`,
            [req.userId, friendId]
        );
        
        if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            if (existing.status === 'accepted') {
                return res.status(400).json({ error: 'Already friends' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Friend request already sent' });
            }
        }
        
        // Create friend request (always store with smaller UUID first for consistency)
        const [player1, player2] = req.userId < friendId ? [req.userId, friendId] : [friendId, req.userId];
        
        await pool.query(
            `INSERT INTO friendships (player1_id, player2_id, status, requested_by_id)
             VALUES ($1, $2, 'pending', $3)
             ON CONFLICT (player1_id, player2_id) 
             DO UPDATE SET status = 'pending', requested_by_id = $3, created_at = NOW()`,
            [player1, player2, req.userId]
        );
        
        res.json({ success: true, message: 'Friend request sent' });
    } catch (error) {
        console.error('[API] Send friend request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all friends
app.get('/api/friends', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        await ensureHalleyFriendship(pool, req.userId);

        const viewerResult = await pool.query(
            'SELECT username FROM players WHERE id = $1',
            [req.userId]
        );
        const viewerUsername = viewerResult.rows[0]?.username;
        const viewerIsAdmin = isAdminUsername(viewerUsername);

        const recentMinutesRaw = Number(req.query.recentMinutes);
        const recentMinutes = viewerIsAdmin && Number.isFinite(recentMinutesRaw) && recentMinutesRaw > 0
            ? Math.min(Math.max(Math.round(recentMinutesRaw), 1), 1440)
            : null;

        const params = [req.userId, getAdminUsername()];
        let recentFilter = '';
        if (recentMinutes) {
            params.push(String(recentMinutes));
            recentFilter = ` AND p.last_active >= NOW() - ($3::text || ' minutes')::interval`;
        }

        const result = await pool.query(
            `SELECT p.id, p.username, p.friend_code, p.level, p.experience,
                    p.total_caught, p.biggest_catch, p.player_stats, p.last_active
             FROM friendships f
             JOIN players p ON (
                 CASE 
                     WHEN f.player1_id = $1 THEN f.player2_id = p.id
                     ELSE f.player1_id = p.id
                 END
             )
             WHERE (f.player1_id = $1 OR f.player2_id = $1) AND f.status = 'accepted'${recentFilter}
             ORDER BY
                 CASE WHEN LOWER(p.username) = LOWER($2) THEN 0 ELSE 1 END,
                 p.last_active DESC NULLS LAST`,
            params
        );
        
        res.json(result.rows.map(decorateFriendRow));
    } catch (error) {
        console.error('[API] Get friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get pending friend requests
app.get('/api/friends/pending', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // Sent requests (initiated by current user)
        const sentResult = await pool.query(
            `SELECT f.id, f.created_at, p.id as player_id, p.username, p.friend_code, p.level
             FROM friendships f
             JOIN players p ON p.id = CASE WHEN f.player1_id = $1 THEN f.player2_id ELSE f.player1_id END
             WHERE f.status = 'pending' AND f.requested_by_id = $1
             ORDER BY f.created_at DESC`,
            [req.userId]
        );
        
        // Received requests (initiated by someone else)
        const receivedResult = await pool.query(
            `SELECT f.id, f.created_at, p.id as player_id, p.username, p.friend_code, p.level
             FROM friendships f
             JOIN players p ON p.id = f.requested_by_id
             WHERE f.status = 'pending'
                   AND f.requested_by_id IS NOT NULL
                   AND f.requested_by_id != $1
                   AND (f.player1_id = $1 OR f.player2_id = $1)
             ORDER BY f.created_at DESC`,
            [req.userId]
        );
        
        res.json({
            sent: sentResult.rows,
            received: receivedResult.rows
        });
    } catch (error) {
        console.error('[API] Get pending requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Accept friend request
app.post('/api/friends/accept/:requestId', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { requestId } = req.params;
        
        if (!isValidUUID(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }
        
        // Verify request exists and user is recipient
        const result = await pool.query(
            `UPDATE friendships
             SET status = 'accepted'
             WHERE id = $1 
                   AND status = 'pending'
                   AND (player1_id = $2 OR player2_id = $2)
                   AND requested_by_id IS NOT NULL
                   AND requested_by_id != $2
             RETURNING id`,
            [requestId, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Accept request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Decline friend request
app.post('/api/friends/decline/:requestId', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { requestId } = req.params;
        
        if (!isValidUUID(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }
        
        // Delete the request
        const result = await pool.query(
            `DELETE FROM friendships
             WHERE id = $1 
                   AND status = 'pending'
                   AND (player1_id = $2 OR player2_id = $2)
             RETURNING id`,
            [requestId, req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Decline request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove friend
app.delete('/api/friends/:friendId', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { friendId } = req.params;
        
        if (!isValidUUID(friendId)) {
            return res.status(400).json({ error: 'Invalid friend ID' });
        }

        if (await isHalleyPlayerId(pool, friendId)) {
            return res.status(403).json({ error: 'Halley is always on your crew.' });
        }
        
        const result = await pool.query(
            `DELETE FROM friendships
             WHERE ((player1_id = $1 AND player2_id = $2) OR (player1_id = $2 AND player2_id = $1))
                   AND status = 'accepted'
             RETURNING id`,
            [req.userId, friendId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Friendship not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Remove friend error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get friend collection summary
app.get('/api/friends/:friendId/collection', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { friendId } = req.params;
        if (!isValidUUID(friendId)) {
            return res.status(400).json({ error: 'Invalid friend ID' });
        }

        const friendResult = await pool.query(
            `SELECT id, username, display_name, level FROM players WHERE id = $1`,
            [friendId]
        );

        if (friendResult.rows.length === 0) {
            return res.status(404).json({ error: 'Friend not found' });
        }

        const friend = friendResult.rows[0];
        const isSelf = friendId === req.userId;

        if (!isSelf) {
            const relationResult = await pool.query(
                `SELECT status FROM friendships
                 WHERE (player1_id = $1 AND player2_id = $2)
                    OR (player1_id = $2 AND player2_id = $1)`,
                [req.userId, friendId]
            );

            if (relationResult.rows.length === 0 || relationResult.rows[0].status !== 'accepted') {
                return res.status(403).json({ error: 'Friendship not found' });
            }
        }

        const collectionResult = await pool.query(
            `SELECT caught_fish FROM player_collections WHERE player_id = $1`,
            [friendId]
        );

        const caughtFish = collectionResult.rows[0]?.caught_fish || {};
        const topFishResult = await pool.query(
            `SELECT fish_name, MAX(fish_weight) AS max_weight
             FROM player_catches
             WHERE player_id = $1
             GROUP BY fish_name
             ORDER BY MAX(fish_weight) DESC`,
            [friendId]
        );

        const topFish = topFishResult.rows
            .filter(row => row.fish_name)
            .map(row => ({
                fishName: row.fish_name,
                maxWeight: row.max_weight !== null ? Number(row.max_weight) : null
            }));

        const caughtEntries = Object.values(caughtFish);
        const uniqueFish = caughtEntries.filter(entry => entry && entry.caught !== false).length;
        const totalCatches = caughtEntries.reduce((sum, entry) => sum + (entry?.count || 0), 0);

        res.json({
            playerId: friend.id,
            username: friend.username,
            displayName: friend.display_name,
            level: friend.level,
            caughtFish,
            topFish,
            totals: {
                uniqueFish,
                totalCatches
            }
        });
    } catch (error) {
        console.error('[API] Friend collection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Activity Routes ====================

// Log a catch (for activity feed) — Epic, Legendary, and Trophy only
app.post('/api/activities/catch', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { fishName, fishWeight, fishRarity, locationName, experienceGained } = req.body;
        const notableRarities = ['Epic', 'Legendary', 'Trophy'];
        
        if (!notableRarities.includes(fishRarity)) {
            return res.json({ success: true, logged: false });
        }

        await pool.query(
            `INSERT INTO friend_activities (player_id, fish_name, fish_weight, fish_rarity, location_name, experience_gained)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.userId, fishName, fishWeight, fishRarity, locationName, experienceGained || 0]
        );
        
        res.json({ success: true, logged: true });
    } catch (error) {
        console.error('[API] Log catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Log a level-up (for activity feed)
app.post('/api/activities/level', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { level, levelsGained } = req.body;
        const numericLevel = Number(level);
        const gain = Number(levelsGained) || 1;

        if (!Number.isFinite(numericLevel) || numericLevel <= 0) {
            return res.status(400).json({ error: 'Invalid level value' });
        }

        await pool.query(
            `INSERT INTO friend_activities (player_id, fish_name, fish_weight, fish_rarity, location_name, experience_gained)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.userId, 'Level Up', numericLevel, 'LEVEL_UP', null, gain]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Log level-up error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Leaderboard Routes ====================

// Record or update a player's best catch for the global leaderboard
app.post('/api/leaderboard/catch', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { fishName, fishWeight, locationName, reactionTimeMs } = req.body;

        if (!fishName || typeof fishName !== 'string' || fishName.trim().length === 0) {
            return res.status(400).json({ error: 'Fish name is required' });
        }

        const weight = Number(fishWeight);
        if (!Number.isFinite(weight) || weight <= 0) {
            return res.status(400).json({ error: 'Fish weight must be a positive number' });
        }

        const playerResult = await pool.query(
            'SELECT username FROM players WHERE id = $1',
            [req.userId]
        );

        if (playerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const username = playerResult.rows[0].username;
        const location = locationName && typeof locationName === 'string' && locationName.trim().length > 0
            ? locationName.trim()
            : null;

        let reactionTime = null;
        if (reactionTimeMs !== undefined && reactionTimeMs !== null) {
            const parsedReaction = Number(reactionTimeMs);
            if (Number.isFinite(parsedReaction) && parsedReaction >= 200) {
                reactionTime = Math.round(parsedReaction);
            }
        }

        await pool.query(
            `INSERT INTO leaderboard_catches (player_id, username, fish_name, fish_weight, location_name, reaction_time_ms)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (player_id) DO UPDATE SET
                 username = EXCLUDED.username,
                 fish_name = CASE 
                     WHEN EXCLUDED.fish_weight > leaderboard_catches.fish_weight THEN EXCLUDED.fish_name
                     ELSE leaderboard_catches.fish_name
                 END,
                 fish_weight = GREATEST(leaderboard_catches.fish_weight, EXCLUDED.fish_weight),
                 location_name = CASE 
                     WHEN EXCLUDED.fish_weight > leaderboard_catches.fish_weight THEN EXCLUDED.location_name
                     ELSE leaderboard_catches.location_name
                 END,
                 reaction_time_ms = CASE
                     WHEN EXCLUDED.reaction_time_ms IS NULL THEN leaderboard_catches.reaction_time_ms
                     WHEN leaderboard_catches.reaction_time_ms IS NULL THEN EXCLUDED.reaction_time_ms
                     WHEN EXCLUDED.fish_weight > leaderboard_catches.fish_weight THEN EXCLUDED.reaction_time_ms
                     ELSE LEAST(leaderboard_catches.reaction_time_ms, EXCLUDED.reaction_time_ms)
                 END,
                 recorded_at = CASE 
                     WHEN EXCLUDED.fish_weight > leaderboard_catches.fish_weight THEN NOW()
                     ELSE leaderboard_catches.recorded_at
                 END,
                 updated_at = NOW()`,
            [req.userId, username, fishName.trim(), weight, location, reactionTime]
        );

        await pool.query(
            `UPDATE players
             SET biggest_catch = GREATEST(COALESCE(biggest_catch, 0), $2),
                 last_active = NOW()
             WHERE id = $1`,
            [req.userId, weight]
        );

        await pool.query(
            `INSERT INTO player_catches (player_id, fish_name, fish_weight, location_name, reaction_time_ms)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.userId, fishName.trim(), weight, location, reactionTime]
        );

        const bestResult = await pool.query(
            `SELECT player_id, username, fish_name, fish_weight, location_name, reaction_time_ms, recorded_at
             FROM leaderboard_catches
             WHERE player_id = $1`,
            [req.userId]
        );

        res.json({ success: true, bestCatch: bestResult.rows[0] });
    } catch (error) {
        console.error('[API] Leaderboard catch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get global leaderboard (top catches across all players)
app.get('/api/leaderboard/global', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const limit = Math.min(Number(req.query.limit) || 20, 100);

        const result = await pool.query(
            `SELECT lc.player_id, lc.username, lc.fish_name, lc.fish_weight, lc.location_name, lc.recorded_at
             FROM leaderboard_catches lc
             ORDER BY lc.fish_weight DESC, lc.recorded_at ASC
             LIMIT $1`,
            [limit]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('[API] Leaderboard fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear all hook reaction times (Halley admin — resets global speed board)
app.post('/api/admin/leaderboard/speed/reset', authenticate, requireAdmin, async (req, res) => {
    try {
        const [catchesResult, leaderboardResult] = await Promise.all([
            pool.query(
                `UPDATE player_catches
                 SET reaction_time_ms = NULL
                 WHERE reaction_time_ms IS NOT NULL`
            ),
            pool.query(
                `UPDATE leaderboard_catches
                 SET reaction_time_ms = NULL
                 WHERE reaction_time_ms IS NOT NULL`
            )
        ]);

        res.json({
            success: true,
            playerCatchesCleared: catchesResult.rowCount ?? 0,
            leaderboardEntriesCleared: leaderboardResult.rowCount ?? 0
        });
    } catch (error) {
        console.error('[API] Admin speed board reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get global speed leaderboard (fastest hook reactions)
app.get('/api/leaderboard/speed', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const limit = Math.min(Number(req.query.limit) || 20, 100);

        const result = await pool.query(
            `WITH best_reactions AS (
                SELECT
                    pc.player_id,
                    p.username,
                    pc.fish_name,
                    pc.fish_weight,
                    pc.location_name,
                    pc.reaction_time_ms,
                    pc.created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY pc.player_id
                        ORDER BY pc.reaction_time_ms ASC, pc.created_at ASC
                    ) AS rn
                FROM player_catches pc
                JOIN players p ON pc.player_id = p.id
                WHERE pc.reaction_time_ms IS NOT NULL
            )
            SELECT player_id, username, fish_name, fish_weight, location_name, reaction_time_ms, created_at
            FROM best_reactions
            WHERE rn = 1
            ORDER BY reaction_time_ms ASC, created_at ASC
            LIMIT $1`,
            [limit]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('[API] Speed leaderboard fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a player's catch history (top catches)
app.get('/api/players/:playerId/catches', authenticate, async (req, res) => {
    try {
        const { playerId } = req.params;
        if (!isValidUUID(playerId) || !isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }

        const limit = Math.min(Number(req.query.limit) || 50, 200);

        // Ensure requester is the player
        if (playerId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const result = await pool.query(
            `SELECT id, fish_name, fish_weight, location_name, reaction_time_ms, created_at
             FROM player_catches
             WHERE player_id = $1
             ORDER BY fish_weight DESC, created_at DESC
             LIMIT $2`,
            [playerId, limit]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('[API] Get player catches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get friends' recent activities
app.get('/api/activities/friends', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const limit = parseInt(req.query.limit) || 20;
        
        const result = await pool.query(
            `SELECT fa.id, fa.player_id, p.username, p.last_active,
                    fa.fish_name, fa.fish_weight,
                    fa.fish_rarity, fa.location_name, fa.experience_gained, fa.created_at
             FROM friend_activities fa
             JOIN players p ON fa.player_id = p.id
             JOIN friendships f ON (
                 (f.player1_id = $1 AND f.player2_id = fa.player_id) OR
                 (f.player2_id = $1 AND f.player1_id = fa.player_id)
             )
             WHERE f.status = 'accepted'
             ORDER BY fa.created_at DESC
             LIMIT $2`,
            [req.userId, limit]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('[API] Get activities error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});

// Start server (migrations run automatically before listen)
async function startServer() {
    try {
        await runMigrations(pool);
        await syncHalleyFriendships(pool);
    } catch (error) {
        console.error('[SERVER] Database migration failed:', error);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`[SERVER] Halley's Big Catch Friends API running on port ${PORT}`);
        console.log(`[SERVER] Environment: ${NODE_ENV}`);
    });
}

startServer();
