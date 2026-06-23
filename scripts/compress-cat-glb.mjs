#!/usr/bin/env node
/**
 * Optimize Cat.glb with gltf-transform (run once after npm install).
 * Output overwrites Cat.glb — backup saved as Cat.glb.bak
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, '..', 'assets', 'glb', 'Cat.glb');
const temp = path.join(__dirname, '..', 'assets', 'glb', 'Cat.opt.glb');

if (!fs.existsSync(input)) {
    console.error('Cat.glb not found at', input);
    process.exit(1);
}

const before = fs.statSync(input).size;
console.log(`[compress:cat] Input ${(before / 1024 / 1024).toFixed(2)} MB`);

const isWin = process.platform === 'win32';
const quoted = (p) => (isWin ? `"${p}"` : p);
const cmd = [
    'npx --yes @gltf-transform/cli optimize',
    quoted(input),
    quoted(temp),
    '--compress false',
    '--texture-compress webp',
    '--texture-size 1024',
    '--simplify false'
].join(' ');

const result = spawnSync(cmd, {
    stdio: 'inherit',
    shell: true,
    windowsHide: true
});

if (result.status !== 0) {
    console.error('[compress:cat] gltf-transform failed');
    if (result.error) {
        console.error(result.error.message);
    }
    process.exit(result.status || 1);
}

if (!fs.existsSync(temp)) {
    console.error('[compress:cat] Output file was not created:', temp);
    process.exit(1);
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
    `[compress:cat] Output ${(after / 1024 / 1024).toFixed(2)} MB `
    + `(${Math.round((1 - after / before) * 100)}% smaller). Backup: ${path.basename(backup)}`
);
