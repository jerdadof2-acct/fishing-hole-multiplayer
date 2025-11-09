/**
 * Kitty Creek Friends System Backend Server
 * Express.js server with PostgreSQL integration
 */

import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || (NODE_ENV === 'production' ? false : '*'),
    credentials: true
}));
app.use(express.json());

// Serve static files (game files)
app.use(express.static(path.join(__dirname, '..')));

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

// ==================== Player Routes ====================

// Register new player
app.post('/api/players/register', async (req, res) => {
    try {
        const { username } = req.body;
        
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
        
        // Insert player
        const result = await pool.query(
            `INSERT INTO players (username, friend_code, display_name)
             VALUES ($1, $2, $1)
             RETURNING id, username, friend_code, level, experience, money, player_stats, created_at`,
            [username, friendCode]
        );
        
        const player = result.rows[0];
        
        // Initialize collection
        await pool.query(
            'INSERT INTO player_collections (player_id, caught_fish) VALUES ($1, $2)',
            [player.id, JSON.stringify({})]
        );
        
        res.json({
            userId: player.id,
            username: player.username,
            friendCode: player.friend_code,
            level: player.level,
            experience: player.experience,
            money: player.money,
            stats: player.player_stats
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Username already taken' });
        }
        console.error('[API] Register error:', error);
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
                    total_caught, biggest_catch, player_stats, last_active, created_at
             FROM players
             WHERE id = $1`,
            [req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        // Update last_active
        await pool.query('UPDATE players SET last_active = NOW() WHERE id = $1', [req.userId]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[API] Get player error:', error);
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
            'SELECT id FROM players WHERE friend_code = $1',
            [friendCode.toUpperCase()]
        );
        
        if (friendResult.rows.length === 0) {
            return res.status(404).json({ error: 'Friend code not found' });
        }
        
        const friendId = friendResult.rows[0].id;
        
        if (friendId === req.userId) {
            return res.status(400).json({ error: 'Cannot add yourself as a friend' });
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
            `INSERT INTO friendships (player1_id, player2_id, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (player1_id, player2_id) 
             DO UPDATE SET status = 'pending', created_at = NOW()`,
            [player1, player2]
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
             WHERE (f.player1_id = $1 OR f.player2_id = $1) AND f.status = 'accepted'
             ORDER BY p.last_active DESC`,
            [req.userId]
        );
        
        res.json(result.rows);
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
        
        // Sent requests
        const sentResult = await pool.query(
            `SELECT f.id, f.created_at, p.id as player_id, p.username, p.friend_code, p.level
             FROM friendships f
             JOIN players p ON (
                 CASE 
                     WHEN f.player1_id = $1 THEN f.player2_id = p.id
                     ELSE f.player1_id = p.id
                 END
             )
             WHERE (f.player1_id = $1 OR f.player2_id = $1) 
                   AND f.status = 'pending'
                   AND (
                       (f.player1_id = $1 AND f.player1_id < f.player2_id) OR
                       (f.player2_id = $1 AND f.player2_id < f.player1_id)
                   )
             ORDER BY f.created_at DESC`,
            [req.userId]
        );
        
        // Received requests
        const receivedResult = await pool.query(
            `SELECT f.id, f.created_at, p.id as player_id, p.username, p.friend_code, p.level
             FROM friendships f
             JOIN players p ON (
                 CASE 
                     WHEN f.player1_id = $1 THEN f.player2_id = p.id
                     ELSE f.player1_id = p.id
                 END
             )
             WHERE (f.player1_id = $1 OR f.player2_id = $1) 
                   AND f.status = 'pending'
                   AND (
                       (f.player2_id = $1 AND f.player1_id < f.player2_id) OR
                       (f.player1_id = $1 AND f.player2_id < f.player1_id)
                   )
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

// Log a catch (for activity feed)
app.post('/api/activities/catch', authenticate, async (req, res) => {
    try {
        if (!isValidUUID(req.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const { fishName, fishWeight, fishRarity, locationName, experienceGained } = req.body;
        
        // Only log big catches or rare fish (Epic, Legendary, Trophy, or >6 lbs)
        const isRare = ['Epic', 'Legendary', 'Trophy'].includes(fishRarity);
        const isLarge = fishWeight > 6.0;
        
        if (isRare || isLarge) {
            await pool.query(
                `INSERT INTO friend_activities (player_id, fish_name, fish_weight, fish_rarity, location_name, experience_gained)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.userId, fishName, fishWeight, fishRarity, locationName, experienceGained || 0]
            );
        }
        
        res.json({ success: true });
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
            if (Number.isFinite(parsedReaction) && parsedReaction >= 0) {
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
            `SELECT fa.id, fa.player_id, p.username, fa.fish_name, fa.fish_weight,
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

// Start server
app.listen(PORT, () => {
    console.log(`[SERVER] Kitty Creek Friends API running on port ${PORT}`);
    console.log(`[SERVER] Environment: ${NODE_ENV}`);
});



