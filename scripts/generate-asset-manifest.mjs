/**
 * Build asset-manifest.json for offline / install pack precaching.
 * Run: npm run generate:manifest
 *
 * Groups keep deferred downloads small:
 * - boot: prologue splash images
 * - core: shell + shared gameplay media (preferred formats only)
 * - location:<Name>: per-location textures/audio
 * - gallery: collection WebP images (fetched when Collection opens)
 * - offlineFull: optional everything preferred-format pack
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** Bump when adding/removing pack files — clients re-download on change. */
export const PACK_VERSION = '20260718-efficiency-1';

/** Prologue-only — story background + title poster; audio streams when the story plays. */
const BOOT_URLS = [
    '/images/prologue-background.png',
    '/assets/images/loading-poster.png'
];

const CORE_CANDIDATES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/assets/glb/Cat.glb',
    '/assets/audio/splash-6213.mp3',
    '/assets/audio/water-splashing-202979.mp3',
    '/assets/audio/tug.mp3',
    '/assets/audio/tug.wav',
    '/src/audio/reel-78063.mp3',
    '/src/audio/mouse-click-7-411633.mp3',
    '/assets/textures/particle.png',
    '/assets/textures/waterNormals1-sm.jpg',
    '/assets/textures/waterNormals2-sm.jpg',
    '/assets/textures/dockWood-sm.jpg',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/textures/hdri/kloppenheim_06_1k.hdr'
];

function urlExistsOnDisk(url) {
    if (url === '/' || url === '/index.html' || url === '/manifest.json' || url === '/css/styles.css') {
        return true;
    }
    const diskPath = path.join(ROOT, url.replace(/^\//, ''));
    return fs.existsSync(diskPath);
}

/** Location-ish path hints → group name. Unmatched media goes to "shared". */
const LOCATION_HINTS = [
    {
        group: 'location:Crescent Pond',
        patterns: [
            /crescent/i,
            /dockWood/i,
            /farShore/i,
            /water-lap-against-rocks-lake/i,
            /pondSubmerged/i
        ]
    },
    { group: 'location:Louisiana Bayou', patterns: [/bayou/i, /cypress/i, /mosquito/i, /swamp/i] },
    { group: 'location:Congo River', patterns: [/congo/i, /river-flow/i, /lookingnorth-river/i] },
    {
        group: 'location:Cortez Backwaters',
        patterns: [/cortez/i, /mangrove/i, /sea-gently-lapping-waves/i]
    },
    { group: 'location:Frozen Fjords', patterns: [/fjord/i, /ice-break/i, /frozen/i] },
    { group: 'location:Craggy Coast', patterns: [/craggy/i, /coast_land/i, /wind-blowing/i] },
    { group: 'location:Stormbreaker Bay', patterns: [/stormbreaker/i] },
    { group: 'location:Coral Kingdoms', patterns: [/coral/i, /soft-ocean/i] },
    { group: 'location:Forgotten Reefs', patterns: [/reef/i, /forgotten/i] },
    { group: 'location:Twilight Trench', patterns: [/twilight/i, /trench/i] },
    { group: 'location:Amazon Depths', patterns: [/amazon/i, /anaconda/i] },
    { group: 'location:Desert Lagoon', patterns: [/desert/i, /lagoonPalm/i] },
    { group: 'location:Sandy Shoals', patterns: [/sandy/i, /shoal/i] },
    { group: 'location:Starfall Lagoon', patterns: [/starfall/i, /crazycatch/i] },
    { group: 'location:Celestial Depths', patterns: [/celestial/i, /dark-mysterious/i] }
];

const MEDIA_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif',
    '.mp3', '.wav', '.ogg', '.opus', '.m4a',
    '.glb', '.hdr'
]);

const SKIP_NAME_RE = /\.(bak|blend|blend1|fbx)$/i;
const SKIP_DIR_RE = /(Cat_With_Animations|\.git|node_modules)/i;

function walkFiles(dir, baseUrl = '') {
    const results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (SKIP_NAME_RE.test(entry.name) || SKIP_DIR_RE.test(fullPath)) {
            continue;
        }
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

/** Prefer WebP/AVIF over PNG/JPG siblings; MP3/Opus over WAV; keep unique preferred URLs only. */
function preferModernFormats(urls) {
    const set = new Set(urls);
    const preferred = [];

    for (const url of urls) {
        const lower = url.toLowerCase();
        if (/\.(png|jpe?g)$/.test(lower)) {
            const webp = url.replace(/\.(png|jpe?g)$/i, '.webp');
            const avif = url.replace(/\.(png|jpe?g)$/i, '.avif');
            if (set.has(avif) || set.has(webp)) {
                continue;
            }
        }
        // Prefer AVIF over WebP when both exist (gallery still lists WebP for broad decode).
        if (/\.webp$/.test(lower)) {
            const avif = url.replace(/\.webp$/i, '.avif');
            if (set.has(avif) && /\/assets\/textures\//i.test(url)) {
                continue;
            }
        }
        if (/\.wav$/.test(lower)) {
            const mp3 = url.replace(/\.wav$/i, '.mp3');
            const opus = url.replace(/\.wav$/i, '.opus');
            const m4a = url.replace(/\.wav$/i, '.m4a');
            if (set.has(mp3) || set.has(opus) || set.has(m4a)) {
                continue;
            }
        }
        // Drop full-size texture when -sm sibling exists.
        if (/\/assets\/textures\/(?!.*-sm).+\.(jpe?g|png)$/i.test(url)) {
            const sm = url.replace(/(\.\w+)$/, '-sm$1');
            if (set.has(sm)) {
                continue;
            }
        }
        // Prefer 1k HDRI when both exist.
        if (/kloppenheim_06_2k\.hdr$/i.test(url) && set.has('/assets/textures/hdri/kloppenheim_06_1k.hdr')) {
            continue;
        }
        preferred.push(url);
    }

    return preferred;
}

const CORE_URLS = preferModernFormats(CORE_CANDIDATES.filter(urlExistsOnDisk));

function classifyUrl(url) {
    if (BOOT_URLS.includes(url)) {
        return 'boot';
    }
    if (CORE_URLS.includes(url)) {
        return 'core';
    }
    if (
        /\/assets\/images\/.+\.(webp|avif)$/i.test(url)
        || /\/images\/hiddenitems\/.+\.(webp|avif)$/i.test(url)
    ) {
        return 'gallery';
    }
    for (const hint of LOCATION_HINTS) {
        if (hint.patterns.some((re) => re.test(url))) {
            return hint.group;
        }
    }
    return 'shared';
}

const fromAssets = walkFiles(path.join(ROOT, 'assets'), '/assets');
const fromImages = walkFiles(path.join(ROOT, 'images'), '/images');
const fromSrcAudio = walkFiles(path.join(ROOT, 'src', 'audio'), '/src/audio');

const allDiscovered = [...new Set([
    ...CORE_URLS,
    ...BOOT_URLS,
    ...fromAssets,
    ...fromImages,
    ...fromSrcAudio
])].sort();

const preferred = preferModernFormats(allDiscovered);

const groups = {
    boot: [],
    core: [],
    gallery: [],
    shared: [],
    offlineFull: []
};

// Always expose every known location group (even if currently empty).
for (const hint of LOCATION_HINTS) {
    groups[hint.group] = [];
}

for (const url of preferred) {
    const group = classifyUrl(url);
    if (!groups[group]) {
        groups[group] = [];
    }
    groups[group].push(url);
    groups.offlineFull.push(url);
}

// Ensure core always includes explicit CORE_URLS (preferred formats only).
const corePreferred = preferModernFormats(CORE_URLS);
for (const url of corePreferred) {
    if (!groups.core.includes(url)) {
        groups.core.push(url);
    }
}
groups.boot = BOOT_URLS.filter((url) => preferred.includes(url) || BOOT_URLS.includes(url));

const deferred = preferred.filter((url) => !BOOT_URLS.includes(url));

const manifest = {
    version: PACK_VERSION,
    generatedAt: new Date().toISOString(),
    count: preferred.length,
    bootCount: groups.boot.length,
    deferredCount: deferred.length,
    strategy: 'preferred-format-groups',
    boot: groups.boot,
    deferred,
    groups,
    urls: preferred
};

const outPath = path.join(ROOT, 'asset-manifest.json');
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
    `Wrote ${preferred.length} preferred URLs ` +
    `(boot ${groups.boot.length}, core ${groups.core.length}, gallery ${groups.gallery.length}, ` +
    `groups ${Object.keys(groups).length}) to asset-manifest.json (${PACK_VERSION})`
);
