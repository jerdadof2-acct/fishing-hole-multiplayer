#!/usr/bin/env node
/**
 * Compress game images for faster loads.
 * Run: npm run compress:assets
 *
 * - Fish PNGs → WebP + smaller PNG fallback (max 512px wide)
 * - Relics → WebP (max 384px)
 * - Textures → mobile -sm variants (max 512px)
 *
 * Cat.glb (~8MB) is separate — run: npm run compress:cat
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function walkFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, out);
        else out.push(full);
    }
    return out;
}

async function toWebp(input, output, maxWidth, quality) {
    await sharp(input)
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toFile(output);
    const inStat = fs.statSync(input);
    const outStat = fs.statSync(output);
    console.log(`  webp ${path.relative(ROOT, output)}  ${(outStat.size / 1024).toFixed(0)} KB  (was ${(inStat.size / 1024).toFixed(0)} KB)`);
}

async function shrinkPng(input, maxWidth) {
    const tmp = `${input}.compress.tmp`;
    await sharp(input)
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true })
        .toFile(tmp);
    const before = fs.statSync(input).size;
    fs.renameSync(tmp, input);
    const after = fs.statSync(input).size;
    console.log(`  png  ${path.relative(ROOT, input)}  ${(after / 1024).toFixed(0)} KB  (was ${(before / 1024).toFixed(0)} KB)`);
}

async function shrinkJpeg(input, output, maxWidth, quality) {
    await sharp(input)
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toFile(output);
}

async function main() {
    console.log('[compress] Fish images…');
    const fishDir = path.join(ROOT, 'assets', 'images');
    for (const file of walkFiles(fishDir)) {
        if (!/\.(png|jpe?g)$/i.test(file) || file.endsWith('.webp')) continue;
        const rel = path.relative(fishDir, file);
        const isRelic = rel.includes('hiddenitems');
        const maxW = isRelic ? 384 : 512;
        const webpOut = file.replace(/\.(png|jpe?g)$/i, '.webp');
        await toWebp(file, webpOut, maxW, isRelic ? 80 : 82);
        if (/\.png$/i.test(file)) {
            await shrinkPng(file, maxW);
        }
    }

    console.log('[compress] Textures (mobile -sm variants)…');
    const texDir = path.join(ROOT, 'assets', 'textures');
    for (const name of ['waterNormals1.jpg', 'waterNormals2.jpg', 'caustics_loop.jpg']) {
        const input = path.join(texDir, name);
        if (!fs.existsSync(input)) continue;
        const smOut = path.join(texDir, name.replace(/(\.\w+)$/, '-sm$1'));
        await shrinkJpeg(input, smOut, 512, 78);
        console.log(`  sm   ${path.relative(ROOT, smOut)}`);
    }

    console.log('[compress] Done. Commit .webp files and run deploy.');
    console.log('[compress] For Cat.glb: npm run compress:cat');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
