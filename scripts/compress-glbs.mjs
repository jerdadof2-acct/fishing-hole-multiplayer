#!/usr/bin/env node
/**
 * Optimize every shipped GLB with gltf-transform (Meshopt-friendly settings via optimize).
 * Backs up originals as *.glb.bak once.
 *
 * Run: npm run compress:glbs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_DIR = path.join(__dirname, '..', 'assets', 'glb');

function listGlbs(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir)
        .filter((name) => name.toLowerCase().endsWith('.glb') && !name.includes('.opt.'))
        .map((name) => path.join(dir, name));
}

const files = listGlbs(GLB_DIR);
if (!files.length) {
    console.log('[compress:glbs] No GLB files found.');
    process.exit(0);
}

const isWin = process.platform === 'win32';
const quoted = (p) => (isWin ? `"${p}"` : p);

for (const input of files) {
    const temp = input.replace(/\.glb$/i, '.opt.glb');
    const before = fs.statSync(input).size;
    console.log(`[compress:glbs] ${path.basename(input)} ${(before / 1024 / 1024).toFixed(2)} MB`);

    const cmd = [
        'npx --yes @gltf-transform/cli optimize',
        quoted(input),
        quoted(temp),
        '--compress meshopt',
        '--texture-compress webp',
        '--texture-size 1024',
        '--simplify false'
    ].join(' ');

    const result = spawnSync(cmd, {
        stdio: 'inherit',
        shell: true,
        windowsHide: true
    });

    if (result.status !== 0 || !fs.existsSync(temp)) {
        console.error('[compress:glbs] Failed for', path.basename(input));
        if (fs.existsSync(temp)) {
            fs.unlinkSync(temp);
        }
        continue;
    }

    const after = fs.statSync(temp).size;
    const backup = `${input}.bak`;
    if (!fs.existsSync(backup)) {
        fs.renameSync(input, backup);
    } else {
        fs.unlinkSync(input);
    }
    fs.renameSync(temp, input);
    console.log(
        `[compress:glbs] → ${(after / 1024 / 1024).toFixed(2)} MB `
        + `(${Math.round((1 - after / before) * 100)}% smaller)`
    );
}

console.log('[compress:glbs] Done. Spot-check Cat visuals before shipping.');
