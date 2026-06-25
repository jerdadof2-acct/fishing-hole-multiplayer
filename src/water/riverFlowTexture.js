import * as THREE from 'three';

let cachedTexture = null;

function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/**
 * Small procedural streak texture for river surface flow (left-to-right on screen).
 * @returns {THREE.CanvasTexture}
 */
export function createRiverFlowTexture() {
    if (cachedTexture) {
        return cachedTexture;
    }

    const width = 256;
    const height = 128;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const rand = seededRandom(0x7a4e21);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    for (let band = 0; band < 6; band++) {
        const y = (band + rand() * 0.6) * (height / 6);
        const bandH = 6 + rand() * 10;
        const grad = ctx.createLinearGradient(0, y, 0, y + bandH);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.45, `rgba(180,210,230,${0.04 + rand() * 0.05})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, width, bandH);
    }

    for (let i = 0; i < 110; i++) {
        const y = rand() * height;
        const x = rand() * width;
        const len = 28 + rand() * 200;
        const alpha = 0.12 + rand() * 0.55;
        const wobble = (rand() - 0.5) * 5;

        const grad = ctx.createLinearGradient(x, y, x + len, y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.25, `rgba(210,235,255,${alpha * 0.55})`);
        grad.addColorStop(0.5, `rgba(240,250,255,${alpha})`);
        grad.addColorStop(0.75, `rgba(200,225,245,${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8 + rand() * 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
            x + len * 0.25,
            y + wobble,
            x + len * 0.65,
            y - wobble * 0.6,
            x + len,
            y + wobble * 0.25
        );
        ctx.stroke();
    }

    for (let i = 0; i < 40; i++) {
        const y = rand() * height;
        const x = rand() * width;
        const len = 60 + rand() * 140;
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + rand() * 0.08})`;
        ctx.lineWidth = 3 + rand() * 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + (rand() - 0.5) * 3);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    cachedTexture = texture;
    return texture;
}
