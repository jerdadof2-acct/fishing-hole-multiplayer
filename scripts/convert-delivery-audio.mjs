#!/usr/bin/env node
/**
 * Convert remaining delivery WAVs to transparent-quality MP3/Opus for production.
 * Source WAVs are kept as .wav.bak outside the preferred delivery path.
 * Requires ffmpeg on PATH.
 *
 * Run: npm run convert:delivery-audio
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TARGETS = [
    {
        input: path.join(ROOT, 'assets', 'audio', 'tug.wav'),
        mp3: path.join(ROOT, 'assets', 'audio', 'tug.mp3'),
        args: '-codec:a libmp3lame -b:a 128k -ar 44100'
    },
    {
        input: path.join(ROOT, 'assets', 'audio', 'halleys-big-catch-prologue.wav'),
        mp3: path.join(ROOT, 'assets', 'audio', 'halleys-big-catch-prologue.mp3'),
        args: '-codec:a libmp3lame -b:a 96k -ac 1 -ar 44100'
    },
    {
        input: path.join(ROOT, 'src', 'audio', "Halley's Big Catch Intro 2.wav"),
        mp3: path.join(ROOT, 'src', 'audio', 'halleys-big-catch-intro-2.mp3'),
        args: '-codec:a libmp3lame -b:a 128k -ar 44100'
    }
];

function mb(bytes) {
    return (bytes / 1024 / 1024).toFixed(2);
}

try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
    console.error('ffmpeg not found. Install with: winget install Gyan.FFmpeg');
    process.exit(1);
}

let converted = 0;

for (const target of TARGETS) {
    if (!fs.existsSync(target.input)) {
        console.warn('[audio] Skip missing:', path.relative(ROOT, target.input));
        continue;
    }

    if (fs.existsSync(target.mp3)) {
        const wavSize = fs.statSync(target.input).size;
        const mp3Size = fs.statSync(target.mp3).size;
        if (mp3Size > 0 && mp3Size < wavSize) {
            console.log(`[audio] Already compressed: ${path.relative(ROOT, target.mp3)} (${mb(mp3Size)} MB)`);
            // Prefer keeping WAV as backup only for delivery exclusion.
            const bak = `${target.input}.bak`;
            if (!fs.existsSync(bak)) {
                fs.renameSync(target.input, bak);
                console.log(`[audio] Moved source WAV → ${path.basename(bak)}`);
            }
            continue;
        }
    }

    const temp = `${target.mp3}.tmp.mp3`;
    const before = fs.statSync(target.input).size;
    execSync(`ffmpeg -y -i "${target.input}" ${target.args} "${temp}"`, { stdio: 'inherit' });
    const after = fs.statSync(temp).size;
    fs.renameSync(temp, target.mp3);

    const bak = `${target.input}.bak`;
    if (!fs.existsSync(bak)) {
        fs.renameSync(target.input, bak);
    } else {
        fs.unlinkSync(target.input);
    }

    console.log(
        `[audio] ${path.relative(ROOT, target.mp3)}: ${mb(before)} → ${mb(after)} MB`
    );
    converted += 1;
}

console.log(`[audio] Done (${converted} newly converted). Re-run npm run generate:manifest.`);
