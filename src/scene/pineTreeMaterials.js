import * as THREE from 'three';

let barkMaps = null;
let foliageMaps = null;

function mulberry32(seed) {
    let state = seed;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getBarkMaps() {
    if (barkMaps) return barkMaps;

    const w = 128;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const rand = mulberry32(0x8b3c1a04);

    ctx.fillStyle = '#9a7558';
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x++) {
        const shade = 0.92 + rand() * 0.14;
        ctx.fillStyle = `rgba(${Math.floor(118 * shade)}, ${Math.floor(88 * shade)}, ${Math.floor(62 * shade)}, 0.22)`;
        ctx.fillRect(x, 0, 1, h);
    }

    for (let i = 0; i < 140; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const len = 12 + rand() * 40;
        ctx.strokeStyle = `rgba(${72 + rand() * 28}, ${52 + rand() * 22}, ${34 + rand() * 16}, ${0.12 + rand() * 0.16})`;
        ctx.lineWidth = 0.5 + rand() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 2.5, y + len);
        ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = w;
    normalCanvas.height = h;
    const nctx = normalCanvas.getContext('2d');
    const imageData = nctx.createImageData(w, h);
    const heightField = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const u = x / w;
            const v = y / h;
            heightField[idx] = Math.sin(u * 48.0) * 0.08 + Math.sin(v * 22.0 + u * 8.0) * 0.05;
        }
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            const dx = heightField[idx + 1] - heightField[idx - 1];
            const dy = heightField[idx + w] - heightField[idx - w];
            const nx = -dx * 1.6;
            const ny = -dy * 1.6;
            const nz = 1.0;
            const len = Math.hypot(nx, ny, nz) || 1;
            const i4 = idx * 4;
            imageData.data[i4] = Math.floor((nx / len * 0.5 + 0.5) * 255);
            imageData.data[i4 + 1] = Math.floor((ny / len * 0.5 + 0.5) * 255);
            imageData.data[i4 + 2] = Math.floor((nz / len * 0.5 + 0.5) * 255);
            imageData.data[i4 + 3] = 255;
        }
    }
    nctx.putImageData(imageData, 0, 0);

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;

    barkMaps = { map, normalMap };
    return barkMaps;
}

/**
 * Mid-tone detail map — material color supplies the green; map adds variation only.
 */
function getFoliageMaps() {
    if (foliageMaps) return foliageMaps;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rand = mulberry32(0x2f6e4a11);

    ctx.fillStyle = '#b8d4b4';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 320; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 3 + rand() * 12;
        const lift = rand();
        const g = Math.floor(140 + lift * 70);
        const rCol = Math.floor(70 + lift * 40);
        const bCol = Math.floor(68 + lift * 36);
        ctx.fillStyle = `rgba(${rCol}, ${g}, ${bCol}, ${0.18 + rand() * 0.28})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.65 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 160; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 2 + rand() * 8;
        ctx.fillStyle = `rgba(${45 + rand() * 30}, ${90 + rand() * 40}, ${48 + rand() * 24}, ${0.1 + rand() * 0.18})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.8, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 180; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const len = 4 + rand() * 9;
        const angle = rand() * Math.PI * 2;
        ctx.strokeStyle = `rgba(${55 + rand() * 35}, ${110 + rand() * 50}, ${58 + rand() * 28}, ${0.15 + rand() * 0.22})`;
        ctx.lineWidth = 0.4 + rand() * 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;

    foliageMaps = { map };
    return foliageMaps;
}

function cloneRepeatingTexture(texture, repeatX, repeatY) {
    const clone = new THREE.Texture(texture.image);
    clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
    clone.colorSpace = texture.colorSpace;
    clone.repeat.set(repeatX, repeatY);
    clone.needsUpdate = true;
    return clone;
}

/**
 * @param {{ repeatV?: number }} [options]
 */
export function createPineTrunkMaterial(options = {}) {
    const { repeatV = 2.2 } = options;
    const maps = getBarkMaps();

    const material = new THREE.MeshStandardMaterial({
        color: 0xc4a078,
        map: cloneRepeatingTexture(maps.map, 1, repeatV),
        normalMap: cloneRepeatingTexture(maps.normalMap, 1, repeatV),
        roughness: 0.9,
        metalness: 0,
        normalScale: new THREE.Vector2(0.14, 0.14),
        envMapIntensity: 0.42
    });
    material.userData.sharedMaps = true;
    return material;
}

/**
 * @param {number} tint
 * @param {{ repeat?: number, variation?: number }} [options]
 */
export function createPineFoliageMaterial(tint, options = {}) {
    const { repeat = 2.4, variation = 0 } = options;
    const maps = getFoliageMaps();
    const color = new THREE.Color(tint);
    if (variation) {
        color.offsetHSL(variation * 0.03, variation * 0.05, variation * 0.04);
    }

    const material = new THREE.MeshStandardMaterial({
        color,
        map: cloneRepeatingTexture(maps.map, repeat, repeat),
        roughness: 0.88,
        metalness: 0,
        envMapIntensity: 0.38
    });
    material.userData.sharedMaps = true;
    return material;
}
