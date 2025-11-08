const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images'));

// PostgreSQL connection pool
const dbUrl = process.env.DATABASE_URL;
console.log('DATABASE_URL exists:', !!dbUrl);
console.log('DATABASE_URL starts with:', dbUrl ? dbUrl.substring(0, 20) : 'N/A');

// Parse connection string for Railway
let poolConfig = {
    connectionString: dbUrl,
    ssl: dbUrl?.includes('railway') || dbUrl?.includes('postgres') ? { rejectUnauthorized: false } : false
};

// Handle Railway internal hostname issue
if (dbUrl && dbUrl.includes('postgres.railway.internal')) {
    // Try to use external connection if internal fails
    console.log('Warning: Using Railway internal hostname, connection may fail');
    // Railway services should be able to connect via internal networking
    // But if not, you may need to use the external URL from PostgreSQL service
}

const pool = new Pool(poolConfig);

// Handle connection errors gracefully
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Initialize database tables
async function initDatabase() {
    if (!dbUrl) {
        console.log('No DATABASE_URL found, skipping database initialization');
        return;
    }
    
    try {
        // Test connection first
        await pool.query('SELECT NOW()');
        console.log('Database connection successful');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                level INTEGER DEFAULT 1,
                money INTEGER DEFAULT 100,
                experience INTEGER DEFAULT 0,
                total_caught INTEGER DEFAULT 0,
                total_weight DECIMAL(10,2) DEFAULT 0,
                biggest_catch DECIMAL(10,2) DEFAULT 0,
                top10_biggest_fish JSONB DEFAULT '[]',
                location_unlocks INTEGER[] DEFAULT ARRAY[0,1],
                tackle_unlocks JSONB DEFAULT '{}',
                gear JSONB DEFAULT '{}',
                stats JSONB DEFAULT '{}',
                achievements TEXT[] DEFAULT ARRAY[]::TEXT[],
                recent_catches JSONB DEFAULT '[]',
                seasonal_catches JSONB DEFAULT '{}',
                tournament_stats JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tournament_results (
                id SERIAL PRIMARY KEY,
                tournament_id VARCHAR(255) NOT NULL,
                player_name VARCHAR(255) NOT NULL,
                total_weight DECIMAL(10,2) DEFAULT 0,
                fish_count INTEGER DEFAULT 0,
                biggest_catch DECIMAL(10,2) DEFAULT 0,
                catches JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS player_tracking (
                id SERIAL PRIMARY KEY,
                player_name VARCHAR(255) NOT NULL,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_sessions INTEGER DEFAULT 1,
                CONSTRAINT unique_player UNIQUE(player_name)
            )
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
        console.log('Server will continue but database features may be limited');
    }
}

// Store active players
const activePlayers = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join-game', async (playerData) => {
        try {
            const { name } = playerData;
            
            // Load or create player in database
            let player = await pool.query(
                'SELECT * FROM players WHERE name = $1',
                [name]
            );

            if (player.rows.length === 0) {
                // Create new player
                await pool.query(`
                    INSERT INTO players (name, level, money, experience, location_unlocks, tackle_unlocks, gear, stats)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    name,
                    playerData.level || 1,
                    playerData.money || 100,
                    playerData.experience || 0,
                    playerData.locationUnlocks || [0, 1],
                    JSON.stringify(playerData.tackleUnlocks || {}),
                    JSON.stringify(playerData.gear || {}),
                    JSON.stringify(playerData.stats || {})
                ]);
            }

            // Track player activity
            await pool.query(`
                INSERT INTO player_tracking (player_name, first_seen, last_seen, total_sessions)
                VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
                ON CONFLICT (player_name) 
                DO UPDATE SET 
                    last_seen = CURRENT_TIMESTAMP,
                    total_sessions = player_tracking.total_sessions + 1
            `, [name]);

            // Store active player with full data including character avatar
            activePlayers.set(socket.id, { 
                name, 
                socket,
                level: playerData.level || 1,
                money: playerData.money || 100,
                experience: playerData.experience || 0,
                character: playerData.character || `https://robohash.org/cat-${name}?set=set4&size=200x200` // Default cat avatar
            });
            
            // Broadcast player joined with character
            socket.broadcast.emit('player-joined', { 
                name,
                character: playerData.character || `https://robohash.org/cat-${name}?set=set4&size=200x200`
            });
            
            // Send list of active players with their data including character
            const playerList = Array.from(activePlayers.values()).map(p => ({
                name: p.name,
                level: p.level || 1,
                character: p.character || `https://robohash.org/cat-${p.name}?set=set4&size=200x200`
            }));
            io.emit('player-list', playerList);
            
            socket.emit('game-joined', { success: true });
        } catch (error) {
            console.error('Join game error:', error);
            socket.emit('error', { message: 'Failed to join game' });
        }
    });

    socket.on('cast-line', () => {
        const player = activePlayers.get(socket.id);
        if (!player) return;
        
        // Broadcast casting to other players
        socket.broadcast.emit('player-casting', { name: player.name });
    });

    socket.on('catch-fish', async (catchData) => {
        try {
            const player = activePlayers.get(socket.id);
            if (!player) return;

            const isRare = catchData.isRare || false;
            const isHuge = catchData.isHuge || false;
            const isLegendary = catchData.isLegendary || false;
            const isTrophy = catchData.isTrophy || false;

            const tournamentId = catchData.tournamentId || null;

            // For special catches (rare, huge, legendary, trophy), broadcast globally to ALL players
            if (isRare || isHuge || isLegendary || isTrophy) {
                io.emit('special-catch', {
                    player: player.name,
                    fish: catchData.fish,
                    weight: catchData.weight,
                    value: catchData.value,
                    isRare: isRare,
                    isHuge: isHuge,
                    isLegendary: isLegendary,
                    isTrophy: isTrophy,
                    tournamentId: tournamentId
                });
            } else if (tournamentId) {
                // Regular catches during tournaments - broadcast for scoring purposes only
                // Don't show chat messages, just update tournament scores silently
                socket.broadcast.emit('fish-caught', {
                    player: player.name,
                    fish: catchData.fish,
                    weight: catchData.weight,
                    value: catchData.value,
                    tournamentId: tournamentId,
                    silent: true // Flag to prevent chat spam
                });
            }
            // Outside tournaments, regular catches are NOT broadcast to reduce chat spam
        } catch (error) {
            console.error('Catch fish error:', error);
        }
    });

    socket.on('chat-message', (message) => {
        const player = activePlayers.get(socket.id);
        if (!player) return;

        io.emit('chat-message', {
            player: player.name,
            message: message,
            timestamp: Date.now()
        });
    });

    socket.on('tournament-start', (data) => {
        const player = activePlayers.get(socket.id);
        if (!player) return;

        // Broadcast tournament start to all players
        io.emit('tournament-start', {
            tournamentId: data.tournamentId,
            participants: data.participants
        });
    });

    socket.on('tournament-countdown', (data) => {
        const player = activePlayers.get(socket.id);
        if (!player) return;

        // Broadcast countdown to all players
        io.emit('tournament-countdown', {
            seconds: data.seconds
        });
    });

    socket.on('tournament-active', (data) => {
        const player = activePlayers.get(socket.id);
        if (!player) return;

        // Broadcast tournament active to all players
        io.emit('tournament-active', {
            tournamentId: data.tournamentId
        });
    });

    socket.on('tournament-end', (data) => {
        const player = activePlayers.get(socket.id);
        if (!player) return;

        // Broadcast tournament end to all players
        io.emit('tournament-end', {
            tournamentId: data.tournamentId,
            winner: data.winner,
            scores: data.scores,
            catches: data.catches,
            prizeAmount: data.prizeAmount || 0
        });
    });

    socket.on('save-game', async (playerData) => {
        try {
            const player = activePlayers.get(socket.id);
            if (!player) return;

            await pool.query(`
                UPDATE players SET
                    level = $1,
                    money = $2,
                    experience = $3,
                    total_caught = $4,
                    total_weight = $5,
                    biggest_catch = $6,
                    top10_biggest_fish = $7,
                    location_unlocks = $8,
                    tackle_unlocks = $9,
                    gear = $10,
                    stats = $11,
                    achievements = $12,
                    recent_catches = $13,
                    seasonal_catches = $14,
                    tournament_stats = $15,
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = $16
            `, [
                playerData.level,
                playerData.money,
                playerData.experience,
                playerData.totalCaught,
                playerData.totalWeight,
                playerData.biggestCatch,
                JSON.stringify(playerData.top10BiggestFish || []),
                playerData.locationUnlocks,
                JSON.stringify(playerData.tackleUnlocks || {}),
                JSON.stringify(playerData.gear || {}),
                JSON.stringify(playerData.stats || {}),
                playerData.achievements || [],
                JSON.stringify(playerData.recentCatches || []),
                JSON.stringify(playerData.seasonalCatches || {}),
                JSON.stringify(playerData.tournamentStats || {}),
                player.name
            ]);

            socket.emit('game-saved', { success: true });
        } catch (error) {
            console.error('Save game error:', error);
            socket.emit('error', { message: 'Failed to save game' });
        }
    });

    socket.on('disconnect', () => {
        const player = activePlayers.get(socket.id);
        if (player) {
            activePlayers.delete(socket.id);
            socket.broadcast.emit('player-left', { name: player.name });
            
            const playerList = Array.from(activePlayers.values()).map(p => ({
                name: p.name,
                level: p.level || 1,
                character: p.character || `https://robohash.org/cat-${p.name}?set=set4&size=200x200`
            }));
            io.emit('player-list', playerList);
        }
        console.log('Client disconnected:', socket.id);
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'fishing-hole-multiplayer.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
    try {
        const players = await pool.query(`
            SELECT name, biggest_catch, top10_biggest_fish 
            FROM players 
            WHERE biggest_catch > 0 OR (top10_biggest_fish IS NOT NULL AND jsonb_array_length(top10_biggest_fish) > 0)
            ORDER BY biggest_catch DESC
            LIMIT 10
        `);
        
        res.json(players.rows);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.json([]);
    }
});

// Get player tracking data
app.get('/api/player-tracking', async (req, res) => {
    try {
        const tracking = await pool.query(`
            SELECT player_name, first_seen, last_seen, total_sessions
            FROM player_tracking
            ORDER BY last_seen DESC
            LIMIT 100
        `);
        
        res.json(tracking.rows);
    } catch (error) {
        console.error('Player tracking error:', error);
        res.json([]);
    }
});

// Start server
const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`Fishing Hole server running on port ${PORT}`);
    });
});

