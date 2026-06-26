import * as THREE from 'three';

function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function smoothNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
    let value = 0;
    let amp = 0.6;
    let freq = 1;
    for (let i = 0; i < 3; i++) {
        value += smoothNoise(x * freq, y * freq) * amp;
        amp *= 0.48;
        freq *= 1.9;
    }
    return value;
}

/**
 * Soft tropical sand albedo — large gentle grain, no visible tile grid.
 */
export function createReefSandTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const nx = x / size;
            const ny = y / size;
            const grain = fbm(nx * 4.2, ny * 4.2);
            const fine = fbm(nx * 11 + 3.1, ny * 11 + 1.9) * 0.1;
            const base = 0.7 + grain * 0.18 + fine;
            data[i] = Math.floor(198 * base);
            data[i + 1] = Math.floor(218 * base);
            data[i + 2] = Math.floor(232 * base);
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}
