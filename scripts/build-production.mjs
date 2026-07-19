#!/usr/bin/env node
/**
 * Production build: minify/tree-shake local modules with esbuild,
 * content-hash JS/CSS, write dist/ for immutable caching.
 *
 * Three.js and addons are bundled so esbuild can tree-shake unused exports
 * and production/offline startup has no CDN dependency.
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

async function buildCss() {
    ensureDir(ASSETS_CSS);
    const cssPath = path.join(ROOT, 'css', 'styles.css');
    const source = fs.readFileSync(cssPath, 'utf8');
    const transformed = await esbuild.transform(source, {
        loader: 'css',
        minify: true,
        legalComments: 'none'
    });
    const css = Buffer.from(transformed.code);
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
    const criticalCss = [
        '*{box-sizing:border-box;margin:0;padding:0}',
        'html,body{width:100%;height:100%;overflow:hidden}',
        'body{background:#0a0a18;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}',
        '#game-container{position:fixed;inset:0;width:100%;height:100%;overflow:hidden}',
        '.loading-screen{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:500;overflow:hidden;background:#0a0a18}',
        '.loading-screen picture{position:absolute;inset:0;width:100%;height:100%}',
        '.loading-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top}',
        '.loading-overlay{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:24px 20px 28px;text-align:center;background:linear-gradient(180deg,rgba(10,10,24,0),rgba(10,10,24,.72) 35%,rgba(10,10,24,.96))}',
        '.loading-message{font-size:.98rem;color:rgba(255,255,255,.92);margin-bottom:16px;min-height:1.4em}',
        '.loading-bar-track{width:100%;height:12px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.08)}',
        '.loading-bar-fill{width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4a90e2,#6ec6ff);transition:width .25s ease}',
        '.loading-percent{margin-top:10px;font-size:.9rem;font-weight:600;color:rgba(255,255,255,.88);letter-spacing:.04em}',
        '.hidden{display:none!important}'
    ].join('');
    let html = srcHtml
        .replace(
            /href="css\/styles\.css[^"]*"/,
            `href="${cssUrl}" media="print" onload="this.media='all'"`
        )
        .replace(
            /src="src\/bootstrap\.js[^"]*"/,
            `src="${bootstrapUrl}"`
        )
        // Production bundles Three.js, so remove the CDN-only compatibility
        // shim/import map while retaining them in source HTML for local fallback.
        .replace(/\s*<script async src="https:\/\/cdn\.jsdelivr\.net\/npm\/es-module-shims[^"]*"><\/script>\s*<script type="importmap">[\s\S]*?<\/script>/, '')
        .replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin>/, '')
        .replace(
            /(<link rel="stylesheet" href="[^"]+" media="print" onload="this\.media='all'">)/,
            `<style>${criticalCss}</style>\n    $1\n    <noscript><link rel="stylesheet" href="${cssUrl}"></noscript>`
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
        '/assets/images/loading-poster.avif',
        '/assets/images/loading-poster.webp',
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
    const css = await buildCss();

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
