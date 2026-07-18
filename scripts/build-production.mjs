#!/usr/bin/env node
/**
 * Production build: minify/tree-shake local modules with esbuild,
 * content-hash JS/CSS, write dist/ for immutable caching.
 *
 * three / three/addons stay on the CDN import map (external).
 *
 * Run: npm run build
 */
import esbuild from 'esbuild';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS_JS = path.join(DIST, 'assets', 'js');
const ASSETS_CSS = path.join(DIST, 'assets', 'css');

function hashBuffer(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

function rmrf(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

/** Strip ?v= cache-bust suffixes used in source imports. */
const stripQueryPlugin = {
    name: 'strip-query',
    setup(build) {
        build.onResolve({ filter: /.*/ }, async (args) => {
            if (!args.path.includes('?')) {
                return null;
            }
            const cleaned = args.path.split('?')[0];
            const result = await build.resolve(cleaned, {
                kind: args.kind,
                resolveDir: args.resolveDir,
                importer: args.importer
            });
            if (result.errors?.length) {
                return { errors: result.errors };
            }
            return { path: result.path, namespace: result.namespace || 'file' };
        });
    }
};

async function buildJs() {
    ensureDir(ASSETS_JS);

    const result = await esbuild.build({
        entryPoints: [path.join(ROOT, 'src', 'bootstrap.js')],
        bundle: true,
        splitting: true,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        minify: true,
        sourcemap: true,
        metafile: true,
        outdir: ASSETS_JS,
        entryNames: 'bootstrap-[hash]',
        chunkNames: 'chunk-[name]-[hash]',
        assetNames: 'asset-[name]-[hash]',
        external: ['three', 'three/*'],
        plugins: [stripQueryPlugin],
        logLevel: 'info',
        legalComments: 'none'
    });

    const outputs = Object.keys(result.metafile.outputs)
        .filter((p) => p.endsWith('.js'))
        .map((p) => path.relative(DIST, path.resolve(p)).replace(/\\/g, '/'));

    const bootstrapRel = outputs.find((p) => p.includes('bootstrap-'))
        || outputs[0];

    return {
        bootstrapUrl: `/${bootstrapRel}`,
        jsUrls: outputs.map((p) => `/${p}`),
        metafile: result.metafile
    };
}

function buildCss() {
    ensureDir(ASSETS_CSS);
    const cssPath = path.join(ROOT, 'css', 'styles.css');
    const css = fs.readFileSync(cssPath);
    const hash = hashBuffer(css);
    const outName = `styles-${hash}.css`;
    const outPath = path.join(ASSETS_CSS, outName);
    fs.writeFileSync(outPath, css);
    return {
        cssUrl: `/assets/css/${outName}`,
        bytes: css.length
    };
}

function writeIndexHtml({ bootstrapUrl, cssUrl }) {
    const srcHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    let html = srcHtml
        .replace(
            /href="css\/styles\.css[^"]*"/,
            `href="${cssUrl}"`
        )
        .replace(
            /src="src\/bootstrap\.js[^"]*"/,
            `src="${bootstrapUrl}"`
        );

    // Point relative poster / icons at site root (dist is served as overlay).
    fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
}

function writeSwPrecache({ bootstrapUrl, cssUrl, jsUrls }) {
    const precache = [
        '/',
        '/index.html',
        '/manifest.json',
        '/asset-manifest.json',
        cssUrl,
        bootstrapUrl,
        ...jsUrls.filter((u) => u !== bootstrapUrl),
        '/assets/images/loading-poster.png',
        '/assets/icons/icon-192.png',
        '/assets/icons/icon-512.png',
        '/images/prologue-background.png'
    ];
    const unique = [...new Set(precache)];
    fs.writeFileSync(
        path.join(DIST, 'sw-precache.json'),
        JSON.stringify({ version: Date.now().toString(36), urls: unique }, null, 2)
    );
    return unique;
}

function writeBuildMeta(meta) {
    fs.writeFileSync(
        path.join(DIST, 'build-meta.json'),
        JSON.stringify(meta, null, 2)
    );
}

async function main() {
    console.log('[build] Cleaning dist/…');
    rmrf(DIST);
    ensureDir(DIST);

    console.log('[build] Bundling JS…');
    const js = await buildJs();

    console.log('[build] Hashing CSS…');
    const css = buildCss();

    console.log('[build] Writing index.html…');
    writeIndexHtml({ bootstrapUrl: js.bootstrapUrl, cssUrl: css.cssUrl });

    const precache = writeSwPrecache({
        bootstrapUrl: js.bootstrapUrl,
        cssUrl: css.cssUrl,
        jsUrls: js.jsUrls
    });

    const jsBytes = Object.entries(js.metafile.outputs)
        .filter(([p]) => p.endsWith('.js'))
        .reduce((sum, [, info]) => sum + (info.bytes || 0), 0);

    const meta = {
        builtAt: new Date().toISOString(),
        bootstrapUrl: js.bootstrapUrl,
        cssUrl: css.cssUrl,
        jsBytes,
        cssBytes: css.bytes,
        chunkCount: js.jsUrls.length,
        precacheCount: precache.length
    };
    writeBuildMeta(meta);

    console.log(`[build] Done → dist/ (${js.jsUrls.length} JS chunks, ${(jsBytes / 1024).toFixed(0)} KB JS, ${(css.bytes / 1024).toFixed(0)} KB CSS)`);
    console.log(`[build] Entry: ${js.bootstrapUrl}`);
}

main().catch((error) => {
    console.error('[build] Failed:', error);
    process.exit(1);
});
