#!/usr/bin/env node
/**
 * Strip backgrounds from new fish PNGs (requires: pip install rembg).
 * Run: npm run fish:transparent
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const py = path.join(__dirname, 'remove_fish_backgrounds.py');

console.log('[fish:transparent] Removing backgrounds…');
execSync(`python "${py}"`, { stdio: 'inherit', cwd: ROOT });
console.log('[fish:transparent] Done. Refreshing WebP…');
execSync('node scripts/compress-new-fish-images.mjs', { stdio: 'inherit', cwd: ROOT });
