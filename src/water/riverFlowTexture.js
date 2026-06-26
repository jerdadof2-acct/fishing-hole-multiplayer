import * as THREE from 'three';

let cachedTexture = null;
const TEXTURE_VERSION = 6;

function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/**
 * Blend left/right margin columns so RepeatWrapping has no hard seam.
 */
function blendHorizontalSeams(ctx, width, height, margin = 36) {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < margin; x++) {
            const t = x / margin;
            const li = (y * width + x) * 4;
            const ri = (y * width + (width - margin + x)) * 4;

            for (let c = 0; c < 3; c++) {
                const left = d[li + c];
                const right = d[ri + c];
                const blended = left * (1.0 - t) + right * t;
                d[li + c] = blended;
                d[ri + c] = blended;
            }
        }
    }

    ctx.putImageData(img, 0, 0);
}

/**
 * Draw a horizontal flow streak that can wrap across the texture edge.
 */
function drawWrappedStreak(ctx, width, xStart, y, length, lineWidth, alpha) {
    const drawSegment = (x0, x1) => {
        if (x1 <= x0) return;

        const grad = ctx.createLinearGradient(x0, y, x1, y);
        grad.addColorStop(0.0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.12, `rgba(235,245,255,${alpha * 0.35})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(0.88, `rgba(235,245,255,${alpha * 0.35})`);
        grad.addColorStop(1.0, 'rgba(255,255,255,0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
    };

    const xEnd = xStart + length;
    if (xEnd <= width) {
        drawSegment(xStart, xEnd);
        return;
    }

    drawSegment(xStart, width);
    drawSegment(0, xEnd - width);
}

/**
 * Horizontal flow streaks for Amazon river (elongated along U, seamless wrap).
 * @returns {THREE.CanvasTexture}
 */
export function createRiverFlowTexture() {
    if (cachedTexture?.userData?.version === TEXTURE_VERSION) {
        return cachedTexture;
    }

    if (cachedTexture) {
        cachedTexture.dispose();
        cachedTexture = null;
    }

    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(0x7a4e21);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Soft horizontal bands — constant across U (no vertical striping), seamless by nature.
    for (let band = 0; band < 9; band++) {
        const y = (band + rand() * 0.55) * (height / 9);
        const bandH = 12 + rand() * 22;
        const grad = ctx.createLinearGradient(0, y - bandH * 0.5, 0, y + bandH * 0.5);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, `rgba(200,220,240,${0.02 + rand() * 0.026})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - bandH * 0.5, width, bandH);
    }

    // Long horizontal streaks with soft ends; wrap-aware so tiles cleanly.
    for (let i = 0; i < 72; i++) {
        const y = rand() * height;
        const x = rand() * width;
        const length = 90 + rand() * 300;
        const alpha = 0.09 + rand() * 0.26;
        const wobble = (rand() - 0.5) * 3.2;

        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1.1 + rand() * 3.0;
        ctx.lineCap = 'round';

        const xEnd = x + length;
        const drawCurve = (x0, x1) => {
            if (x1 <= x0) return;
            const len = x1 - x0;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.bezierCurveTo(
                x0 + len * 0.25,
                y + wobble,
                x0 + len * 0.65,
                y - wobble * 0.55,
                x1,
                y + wobble * 0.2
            );
            ctx.stroke();
        };

        if (xEnd <= width) {
            drawCurve(x, xEnd);
        } else {
            drawCurve(x, width);
            drawCurve(0, xEnd - width);
        }
    }

    // Broad soft streaks with gradient caps (primary flow read).
    for (let i = 0; i < 36; i++) {
        const y = rand() * height;
        const x = rand() * width;
        const length = 130 + rand() * 290;
        const alpha = 0.065 + rand() * 0.15;
        drawWrappedStreak(ctx, width, x, y, length, 4 + rand() * 7, alpha);
    }

    blendHorizontalSeams(ctx, width, height, 54);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.version = TEXTURE_VERSION;
    texture.needsUpdate = true;
    cachedTexture = texture;
    return texture;
}
