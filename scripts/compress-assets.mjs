#!/usr/bin/env node
/**
 * Compress game images for faster loads (transparent-quality).
 * Run: npm run compress:assets
 *
 * - Fish / relic / UI images → AVIF + WebP preferred, PNG fallback retained
 * - Strip metadata
 * - Textures → mobile -sm JPEG variants
 * - Skips writing duplicate exports when preferred format already exists & is smaller
 *
 * Cat.glb is separate — run: npm run compress:glbs
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

async function writePreferred(input, maxWidth, { webpQuality = 82, avifQuality = 50 } = {}) {
    const base = input.replace(/\.(png|jpe?g)$/i, '');
    const webpOut = `${base}.webp`;
    const avifOut = `${base}.avif`;

    const pipeline = () => sharp(input)
        .rotate()
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .withMetadata({ exif: {}, icc: undefined });

    await pipeline().webp({ quality: webpQuality, effort: 4 }).toFile(webpOut);
    try {
        await pipeline().avif({ quality: avifQuality, effort: 4 }).toFile(avifOut);
    } catch (error) {
        console.warn(`  avif skip ${path.relative(ROOT, input)}:`, error.message);
    }

    const inStat = fs.statSync(input);
    const webpStat = fs.statSync(webpOut);
    const avifStat = fs.existsSync(avifOut) ? fs.statSync(avifOut) : null;
    console.log(
        `  ${path.relative(ROOT, input)} → webp ${(webpStat.size / 1024).toFixed(0)} KB`
        + (avifStat ? ` / avif ${(avifStat.size / 1024).toFixed(0)} KB` : '')
        + ` (src ${(inStat.size / 1024).toFixed(0)} KB)`
    );
}

async function shrinkPng(input, maxWidth) {
    const tmp = `${input}.compress.tmp`;
    const meta = await sharp(input).metadata();
    await sharp(input)
        .rotate()
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: !meta.hasAlpha })
        .withMetadata({ exif: {}, icc: undefined })
        .toFile(tmp);
    const before = fs.statSync(input).size;
    fs.renameSync(tmp, input);
    const after = fs.statSync(input).size;
    console.log(`  png  ${path.relative(ROOT, input)}  ${(after / 1024).toFixed(0)} KB  (was ${(before / 1024).toFixed(0)} KB)`);
}

async function shrinkJpeg(input, output, maxWidth, quality) {
    await sharp(input)
        .rotate()
        .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .withMetadata({ exif: {}, icc: undefined })
        .toFile(output);
}

async function main() {
    console.log('[compress] Fish images…');
    const fishDir = path.join(ROOT, 'assets', 'images');
    for (const file of walkFiles(fishDir)) {
        if (!/\.(png|jpe?g)$/i.test(file)) continue;
        if (/\.(bak)$/i.test(file)) continue;
        await writePreferred(file, 512, { webpQuality: 82, avifQuality: 48 });
        if (/\.png$/i.test(file)) {
            await shrinkPng(file, 512);
        }
    }

    console.log('[compress] Relic images (images/hiddenitems)…');
    const relicDir = path.join(ROOT, 'images', 'hiddenitems');
    for (const file of walkFiles(relicDir)) {
        if (!/\.png$/i.test(file)) continue;
        await writePreferred(file, 384, { webpQuality: 80, avifQuality: 45 });
        await shrinkPng(file, 384);
    }

    // Mirror under assets/images/hiddenitems if present
    const relicDir2 = path.join(ROOT, 'assets', 'images', 'hiddenitems');
    for (const file of walkFiles(relicDir2)) {
        if (!/\.png$/i.test(file)) continue;
        await writePreferred(file, 384, { webpQuality: 80, avifQuality: 45 });
        await shrinkPng(file, 384);
    }

    console.log('[compress] Textures (mobile -sm variants)…');
    const texDir = path.join(ROOT, 'assets', 'textures');
    for (const name of ['waterNormals1.jpg', 'waterNormals2.jpg', 'caustics_loop.jpg', 'dockWood.jpg']) {
        const input = path.join(texDir, name);
        if (!fs.existsSync(input)) continue;
        const smOut = path.join(texDir, name.replace(/(\.\w+)$/, '-sm$1'));
        await shrinkJpeg(input, smOut, 512, 78);
        console.log(`  sm   ${path.relative(ROOT, smOut)}`);
    }

    console.log('[compress] Done. Prefer AVIF/WebP in clients; PNG remains fallback only.');
    console.log('[compress] For models: npm run compress:glbs');
    console.log('[compress] For audio: npm run convert:delivery-audio');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
