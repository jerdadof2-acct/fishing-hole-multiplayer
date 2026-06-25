/**
 * Compress prologue narration WAV → MP3 for faster mobile load.
 * Requires ffmpeg on PATH. Run: npm run convert:prologue-vo
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, '../assets/audio/halleys-big-catch-intro.wav');
const output = path.join(__dirname, '../assets/audio/halleys-big-catch-intro.mp3');

if (!fs.existsSync(input)) {
    console.error('Missing source WAV:', input);
    process.exit(1);
}

try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
    console.error('ffmpeg not found. Install with: winget install Gyan.FFmpeg');
    process.exit(1);
}

execSync(
    `ffmpeg -y -i "${input}" -codec:a libmp3lame -b:a 128k "${output}"`,
    { stdio: 'inherit' }
);

const inMb = (fs.statSync(input).size / 1024 / 1024).toFixed(2);
const outMb = (fs.statSync(output).size / 1024 / 1024).toFixed(2);
console.log(`Done: ${inMb} MB WAV → ${outMb} MB MP3`);
