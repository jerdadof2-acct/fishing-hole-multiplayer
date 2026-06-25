#!/usr/bin/env node
/**
 * Generate a small seamless stylized dock wood texture (CC0 / project-owned).
 * Run: node scripts/generate-dock-wood-texture.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'assets', 'textures');
const SIZE = 256;

function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function buildWoodPixels() {
    const rand = seededRandom(42);
    const data = Buffer.alloc(SIZE * SIZE * 3);
    const plankH = 18;

    for (let y = 0; y < SIZE; y++) {
        const plank = Math.floor(y / plankH);
        const inGap = (y % plankH) < 1;

        for (let x = 0; x < SIZE; x++) {
            const i = (y * SIZE + x) * 3;
            const wave = Math.sin(x * 0.09 + plank * 1.7) * 8 + Math.sin(x * 0.031 + y * 0.05) * 5;
            const grain = Math.sin(y * 0.42 + x * 0.02) * 3;
            const knot = Math.exp(-((x - 64 - plank * 23) ** 2 + (y - plank * plankH - 9) ** 2) / 180) * 35;
            const base = inGap ? 72 : 118 + wave + grain * 6 - knot;
            const r = Math.max(40, Math.min(175, base + rand() * 10 - 5));
            const g = Math.max(30, Math.min(130, r * 0.72 + rand() * 6));
            const b = Math.max(20, Math.min(95, r * 0.48 + rand() * 4));
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
    }
    return data;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const pixels = buildWoodPixels();
    const smPath = path.join(OUT_DIR, 'dockWood-sm.jpg');
    const fullPath = path.join(OUT_DIR, 'dockWood.jpg');

    await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(smPath);

    await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .resize(512, 512, { kernel: 'lanczos3' })
        .jpeg({ quality: 84, mozjpeg: true })
        .toFile(fullPath);

    const smSize = fs.statSync(smPath).size;
    const fullSize = fs.statSync(fullPath).size;
    console.log(`[dock-wood] ${smPath} (${(smSize / 1024).toFixed(1)} KB)`);
    console.log(`[dock-wood] ${fullPath} (${(fullSize / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
