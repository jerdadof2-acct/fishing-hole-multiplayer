import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL is not set in server/.env');
    process.exit(1);
}

const host = url.split('@')[1]?.split('/')[0]?.split(':')[0] || '';
const pool = new pg.Pool({
    connectionString: url,
    ssl: host.includes('localhost') || host.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

try {
    await pool.query(sql);

    const { rows } = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
    );

    console.log('Schema applied successfully.');
    console.log('Tables:', rows.map((r) => r.table_name).join(', '));
} catch (error) {
    console.error('Schema failed:', error.message);
    process.exit(1);
} finally {
    await pool.end();
}
