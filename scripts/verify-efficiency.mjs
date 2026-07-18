#!/usr/bin/env node
/**
 * Smoke checks for the efficiency upgrade:
 * - asset-manifest groups exist
 * - production build meta (optional)
 * - service worker version
 * - no accidental .bak delivery in preferred groups
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
let failed = 0;

function ok(label) {
    console.log(`  ✓ ${label}`);
}

function fail(label, detail = '') {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('[verify] Efficiency checks\n');

// Manifest
const manifestPath = path.join(ROOT, 'asset-manifest.json');
if (!fs.existsSync(manifestPath)) {
    fail('asset-manifest.json missing', 'run npm run generate:manifest');
} else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.groups || typeof manifest.groups !== 'object') {
        fail('manifest.groups missing');
    } else {
        ok(`manifest groups: ${Object.keys(manifest.groups).length}`);
        for (const required of ['core', 'gallery', 'location:Crescent Pond', 'offlineFull']) {
            if (!Array.isArray(manifest.groups[required])) {
                fail(`group ${required} missing`);
            } else {
                ok(`${required}: ${manifest.groups[required].length} urls`);
            }
        }
        const core = manifest.groups.core || [];
        const pngWhenWebp = core.filter((url) =>
            /\.png$/i.test(url)
            && core.includes(url.replace(/\.png$/i, '.webp'))
        );
        if (pngWhenWebp.length) {
            fail('core still lists PNG when WebP exists', pngWhenWebp.slice(0, 3).join(', '));
        } else {
            ok('core prefers compressed image formats');
        }
        const bakHits = JSON.stringify(manifest).match(/\.bak/gi);
        if (bakHits) {
            fail('manifest includes .bak paths');
        } else {
            ok('manifest excludes .bak artifacts');
        }
    }
}

// Service worker
const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
if (!/CACHE_VERSION\s*=\s*'v3[5-9]'/.test(sw) && !/CACHE_VERSION\s*=\s*'v[4-9]\d*'/.test(sw)) {
    fail('service-worker CACHE_VERSION looks stale');
} else {
    ok('service-worker cache version bumped');
}
if (!sw.includes('staleWhileRevalidate') && !sw.includes('stale-while-revalidate')) {
    // function name in our SW
    if (!/function staleWhileRevalidate/.test(sw)) {
        fail('service-worker missing stale-while-revalidate strategy');
    } else {
        ok('service-worker uses stale-while-revalidate');
    }
} else {
    ok('service-worker uses stale-while-revalidate');
}
if (!sw.includes('MAX_MEDIA_ENTRIES')) {
    fail('service-worker missing cache size bound');
} else {
    ok('service-worker enforces cache size bound');
}

// Perf monitor + asset pack APIs
const assetPack = fs.readFileSync(path.join(ROOT, 'src', 'assetPack.js'), 'utf8');
for (const name of ['startLocationPackDownload', 'startGalleryPackDownload', 'resolveGroupUrls']) {
    if (!assetPack.includes(name)) {
        fail(`assetPack missing ${name}`);
    } else {
        ok(`assetPack exports/uses ${name}`);
    }
}

const perf = path.join(ROOT, 'src', 'perf', 'perfMonitor.js');
if (!fs.existsSync(perf)) {
    fail('perfMonitor.js missing');
} else {
    ok('perfMonitor present');
}

// Dist build (optional but preferred)
const buildMeta = path.join(ROOT, 'dist', 'build-meta.json');
if (fs.existsSync(buildMeta)) {
    const meta = JSON.parse(fs.readFileSync(buildMeta, 'utf8'));
    ok(`dist build ${meta.bootstrapUrl} (${Math.round((meta.jsBytes || 0) / 1024)} KB JS)`);
    if (!(meta.jsBytes > 0)) {
        fail('dist jsBytes is zero');
    }
} else {
    console.log('  · dist/build-meta.json not found (run npm run build)');
}

// Server cache headers
const server = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
if (!server.includes('immutable') || !server.includes('applyStaticCacheHeaders')) {
    fail('server missing immutable cache headers');
} else {
    ok('server applies immutable/hashed cache headers');
}

console.log('');
if (failed) {
    console.error(`[verify] ${failed} check(s) failed`);
    process.exit(1);
}
console.log('[verify] All checks passed');
