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

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

// Handle connection errors gracefully
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Initialize database tables
async function initDatabase() {
    try {
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

            // Store active player
            activePlayers.set(socket.id, { name, socket });
            
            // Broadcast player joined
            socket.broadcast.emit('player-joined', { name });
            
            // Send list of active players
            const playerList = Array.from(activePlayers.values()).map(p => p.name);
            io.emit('player-list', playerList);
            
            socket.emit('game-joined', { success: true });
        } catch (error) {
            console.error('Join game error:', error);
            socket.emit('error', { message: 'Failed to join game' });
        }
    });

    socket.on('catch-fish', async (catchData) => {
        try {
            const player = activePlayers.get(socket.id);
            if (!player) return;

            // Broadcast catch to all players
            socket.broadcast.emit('fish-caught', {
                player: player.name,
                fish: catchData.fish,
                weight: catchData.weight,
                value: catchData.value
            });
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
            
            const playerList = Array.from(activePlayers.values()).map(p => p.name);
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

// Start server
const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`Fishing Hole server running on port ${PORT}`);
    });
});

