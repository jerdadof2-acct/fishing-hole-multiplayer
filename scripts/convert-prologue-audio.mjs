/**
 * Compress prologue ambience + music for faster mobile load.
 * Requires ffmpeg on PATH. Run: npm run convert:prologue-audio
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '../assets/audio');

const TARGETS = [
    {
        name: 'prologue-ocean-seagulls.mp3',
        /** Mono 80k — ambient loop, ducked under voiceover */
        args: '-codec:a libmp3lame -b:a 80k -ac 1 -ar 44100'
    },
    {
        name: 'prologue-music.mp3',
        /** Stereo 96k — background bed, ducked under voiceover */
        args: '-codec:a libmp3lame -b:a 96k -ar 44100'
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

let totalBefore = 0;
let totalAfter = 0;

for (const { name, args } of TARGETS) {
    const input = path.join(AUDIO_DIR, name);
    const backup = `${input}.bak`;
    const temp = `${input}.tmp.mp3`;

    if (!fs.existsSync(input)) {
        console.warn('Skipping missing file:', input);
        continue;
    }

    const before = fs.statSync(input).size;
    totalBefore += before;

    if (!fs.existsSync(backup)) {
        fs.copyFileSync(input, backup);
        console.log(`Backup: ${path.basename(backup)}`);
    }

    execSync(`ffmpeg -y -i "${input}" ${args} "${temp}"`, { stdio: 'inherit' });

    const after = fs.statSync(temp).size;
    fs.renameSync(temp, input);
    totalAfter += after;

    const saved = ((1 - after / before) * 100).toFixed(0);
    console.log(`${name}: ${mb(before)} MB → ${mb(after)} MB (${saved}% smaller)\n`);
}

console.log(`Total: ${mb(totalBefore)} MB → ${mb(totalAfter)} MB`);
