import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const url = process.env.DATABASE_URL;

if (!url) {
    console.error('DATABASE_URL is not set in server/.env');
    process.exit(1);
}

function getDatabaseSsl(connectionString) {
    if (!connectionString) return false;
    if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
        return false;
    }
    return { rejectUnauthorized: false };
}

const pool = new pg.Pool({
    connectionString: url,
    ssl: getDatabaseSsl(url)
});

try {
    await runMigrations(pool);
    console.log('[MIGRATE] All migrations applied.');
} catch (error) {
    console.error('[MIGRATE] Failed:', error.message);
    process.exit(1);
} finally {
    await pool.end();
}
