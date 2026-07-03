#!/usr/bin/env node
/** Regenerate WebP + shrink PNG for the 12 location-specific fish only. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const IMAGES = path.join(ROOT, 'assets', 'images');

const NEW_FISH = [
    'Spanish Mackerel',
    'King Mackerel',
    'Barracuda',
    'Goliath Grouper',
    'Amberjack',
    'Hogfish',
    'Red Snapper',
    'Reef Shark',
    'Piranha',
    'Peacock Bass',
    'Payara',
    'Arapaima'
];

const MAX_W = 512;

async function main() {
    for (const name of NEW_FISH) {
        const png = path.join(IMAGES, `${name}.png`);
        if (!fs.existsSync(png)) continue;

        const webp = path.join(IMAGES, `${name}.webp`);
        await sharp(png)
            .resize(MAX_W, MAX_W, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82, effort: 4, alphaQuality: 100 })
            .toFile(webp);

        const tmp = `${png}.tmp`;
        await sharp(png)
            .resize(MAX_W, MAX_W, { fit: 'inside', withoutEnlargement: true })
            .png({ compressionLevel: 9, palette: false })
            .toFile(tmp);
        fs.renameSync(tmp, png);

        const pngKb = (fs.statSync(png).size / 1024).toFixed(0);
        const webpKb = (fs.statSync(webp).size / 1024).toFixed(0);
        console.log(`  ${name}.webp ${webpKb} KB  |  ${name}.png ${pngKb} KB`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
