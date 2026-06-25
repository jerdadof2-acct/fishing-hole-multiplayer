import * as THREE from 'three';

let rockyMaps = null;

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

function createStaticRockMaps() {
    if (rockyMaps) {
        return rockyMaps;
    }

    const size = 256;
    const rand = mulberry32(0x51a7c0de);

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext('2d');

    ctx.fillStyle = '#5c5045';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 520; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 2 + rand() * 16;
        const lift = rand();
        const rCol = Math.floor(72 + lift * 58);
        const gCol = Math.floor(64 + lift * 48);
        const bCol = Math.floor(52 + lift * 34);
        ctx.fillStyle = `rgb(${rCol}, ${gCol}, ${bCol})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.72 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 90; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const w = 8 + rand() * 28;
        const h = 4 + rand() * 10;
        ctx.fillStyle = `rgba(${40 + rand() * 30}, ${36 + rand() * 24}, ${28 + rand() * 18}, 0.55)`;
        ctx.fillRect(x, y, w, h);
    }

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const nctx = normalCanvas.getContext('2d');
    const imageData = nctx.createImageData(size, size);
    const heightField = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = y * size + x;
            const u = x / size;
            const v = y / size;
            const n1 = Math.sin(u * 38.0) * Math.cos(v * 31.0);
            const n2 = Math.sin(u * 17.0 + 1.7) * Math.sin(v * 23.0 + 0.8);
            heightField[idx] = n1 * 0.35 + n2 * 0.25;
        }
    }

    for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
            const idx = y * size + x;
            const dx = heightField[idx + 1] - heightField[idx - 1];
            const dy = heightField[idx + size] - heightField[idx - size];
            const nx = -dx * 3.2;
            const ny = -dy * 3.2;
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

    const map = new THREE.CanvasTexture(colorCanvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.colorSpace = THREE.LinearSRGBColorSpace;

    rockyMaps = { map, normalMap };
    return rockyMaps;
}

function cloneRepeatingTexture(texture, repeatX, repeatY) {
    if (!texture?.image) return null;
    const clone = new THREE.Texture(texture.image);
    clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
    clone.colorSpace = texture.colorSpace;
    clone.repeat.set(repeatX, repeatY);
    clone.needsUpdate = true;
    return clone;
}

/**
 * Static rocky ground — no caustics or underwater pebble tiling.
 * @param {{ tint?: number, repeatX?: number, repeatY?: number }} [options]
 * @returns {THREE.MeshStandardMaterial}
 */
export function createShoreRockMaterial(options = {}) {
    const {
        tint = 0xffffff,
        repeatX = 8,
        repeatY = 8
    } = options;

    const { map, normalMap } = createStaticRockMaps();

    return new THREE.MeshStandardMaterial({
        color: tint,
        map: cloneRepeatingTexture(map, repeatX, repeatY),
        normalMap: cloneRepeatingTexture(normalMap, repeatX, repeatY),
        roughness: 0.96,
        metalness: 0,
        normalScale: new THREE.Vector2(0.65, 0.65)
    });
}

/**
 * @param {THREE.Mesh} mesh
 * @param {number} tint
 * @param {number} [worldUnitsPerTile=2.8]
 */
export function applyShoreRockToMesh(mesh, tint, worldUnitsPerTile = 2.8) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const spanX = Math.max(1, bb.max.x - bb.min.x);
    const spanZ = Math.max(1, bb.max.z - bb.min.z);

    mesh.material = createShoreRockMaterial({
        tint,
        repeatX: spanX / worldUnitsPerTile,
        repeatY: spanZ / worldUnitsPerTile
    });
    mesh.receiveShadow = true;
}
