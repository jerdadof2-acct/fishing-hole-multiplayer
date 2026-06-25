import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Apply all SQL migrations in server/migrations/ (sorted by filename).
 * Safe to run on every boot — migrations use IF NOT EXISTS where needed.
 */
export async function runMigrations(pool) {
    if (!pool) {
        throw new Error('Database pool is required for migrations');
    }

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.log('[MIGRATE] No migrations directory — skipping');
        return;
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('[MIGRATE] No migration files found — skipping');
        return;
    }

    for (const file of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await pool.query(sql);
        console.log(`[MIGRATE] Applied: ${file}`);
    }
}
