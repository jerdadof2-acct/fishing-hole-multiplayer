/**
 * Build asset-manifest.json for offline / install pack precaching.
 * Run: npm run generate:manifest
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** Bump when adding/removing pack files — clients re-download on change. */
export const PACK_VERSION = '20250624-1';

const EXTRA_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/images/halley-splash.png',
    '/images/prologue-background.png',
    '/assets/glb/Cat.glb',
    '/assets/audio/halleys-big-catch-intro.wav',
    '/assets/audio/prologue-ocean-seagulls.mp3',
    '/assets/audio/prologue-music.mp3',
    '/assets/audio/splash-6213.mp3',
    '/assets/audio/water-splashing-202979.mp3',
    '/assets/audio/tug.wav',
    '/src/audio/reel-78063.mp3',
    '/src/audio/mouse-click-7-411633.mp3',
    '/assets/textures/particle.png',
    '/assets/textures/waterNormals1.jpg',
    '/assets/textures/waterNormals2.jpg',
    '/assets/textures/waterNormals1-sm.jpg',
    '/assets/textures/waterNormals2-sm.jpg',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

const MEDIA_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
    '.mp3', '.wav', '.ogg',
    '.glb'
]);

function walkFiles(dir, baseUrl = '') {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkFiles(fullPath, `${baseUrl}/${entry.name}`));
            continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!MEDIA_EXTENSIONS.has(ext)) {
            continue;
        }

        const url = `${baseUrl}/${entry.name}`.replace(/\\/g, '/');
        results.push(url.startsWith('/') ? url : `/${url}`);
    }

    return results;
}

const fromAssets = walkFiles(path.join(ROOT, 'assets'), '/assets');
const fromImages = walkFiles(path.join(ROOT, 'images'), '/images');

const urls = [...new Set([
    ...EXTRA_URLS,
    ...fromAssets,
    ...fromImages
])].sort();

const manifest = {
    version: PACK_VERSION,
    generatedAt: new Date().toISOString(),
    count: urls.length,
    urls
};

const outPath = path.join(ROOT, 'asset-manifest.json');
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${urls.length} URLs to asset-manifest.json (${PACK_VERSION})`);
