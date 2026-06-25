/**
 * Wipe global leaderboard + speed board tables.
 * Run: npm run reset:leaderboards
 * Requires DATABASE_URL in server/.env (or environment).
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
}

const host = url.split('@')[1]?.split('/')[0]?.split(':')[0] || '';
const pool = new pg.Pool({
    connectionString: url,
    ssl: host.includes('localhost') || host.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

try {
    const catches = await pool.query('DELETE FROM player_catches RETURNING id');
    const board = await pool.query('DELETE FROM leaderboard_catches RETURNING id');
    await pool.query('UPDATE players SET biggest_catch = 0');

    console.log(`Deleted ${board.rowCount} global leaderboard entries.`);
    console.log(`Deleted ${catches.rowCount} catch history rows (speed board source).`);
    console.log('Reset players.biggest_catch to 0.');
} catch (error) {
    console.error('Reset failed:', error.message);
    process.exit(1);
} finally {
    await pool.end();
}
