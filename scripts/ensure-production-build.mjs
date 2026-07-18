#!/usr/bin/env node
/**
 * Runs before `npm start` so hosted deploys (Render) get a hashed dist shell.
 *
 * Builds when any of these are true:
 *   - NODE_ENV=production
 *   - FORCE_BUILD=1
 *   - running on Render (RENDER env var)
 * Skips in plain local dev unless dist is missing + FORCE_BUILD.
 *
 * IMPORTANT: a build failure never fails the deploy — the server falls back
 * to serving the repo-root index.html (unhashed) so the site always comes up.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');

const isProd = (process.env.NODE_ENV || 'development') === 'production';
const isRender = !!process.env.RENDER;
const force = process.env.FORCE_BUILD === '1';
const rebuild = process.env.REBUILD_ON_START === '1';
const hasDist = fs.existsSync(DIST_INDEX);

const shouldBuild = force || isProd || isRender;

if (!shouldBuild) {
    if (!hasDist) {
        console.log('[ensure-build] Local dev — skipping bundle (run `npm run build` to enable dist overlay)');
    }
    process.exit(0);
}

if (hasDist && !force && !rebuild) {
    console.log('[ensure-build] dist/ present — skipping rebuild');
    process.exit(0);
}

console.log('[ensure-build] Building production bundle…');
const result = spawnSync(process.execPath, [path.join(__dirname, 'build-production.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env
});

if (result.status !== 0) {
    console.warn('[ensure-build] Build failed — server will serve unhashed root shell (site stays up).');
}

// Never fail the deploy on a build hiccup.
process.exit(0);
