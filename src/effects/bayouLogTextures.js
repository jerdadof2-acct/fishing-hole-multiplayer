import * as THREE from 'three';

const SURFACE_SIZE = { w: 512, h: 256 };
const END_SIZE = 128;

function clamp01(value) {
    return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function hashNoise(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Bark color — silvery dry top band, grey-brown mid, dark waterlogged base with algae.
 */
function createWeatheredLogColorMap() {
    const { w, h } = SURFACE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const v = y / h;
            const angle = u * Math.PI * 2;
            const noise = hashNoise(x * 0.07, y * 0.11) * 0.14;
            const grain = Math.sin(v * 140 + Math.sin(u * 28) * 2.4) * 0.045;

            const bottomWet = Math.pow(Math.max(0, -Math.cos(angle)), 1.65);
            const topDry = Math.pow(Math.max(0, Math.cos(angle)), 0.85);
            const lengthWear = smoothstep(0.08, 0.92, v);

            let r = 0.34 + topDry * 0.12 + lengthWear * 0.04;
            let g = 0.33 + topDry * 0.1 + lengthWear * 0.03;
            let b = 0.3 + topDry * 0.08 + lengthWear * 0.02;

            r -= bottomWet * 0.1;
            g -= bottomWet * 0.06;
            b -= bottomWet * 0.08;

            g += bottomWet * 0.04;
            b += bottomWet * 0.02;

            const algae = bottomWet * hashNoise(x * 0.03, y * 0.05) * 0.08;
            g += algae * 0.9;
            b += algae * 0.25;

            r += grain + noise;
            g += grain * 0.95 + noise;
            b += grain * 0.9 + noise;

            const crack = Math.pow(
                Math.max(0, Math.sin(v * 220 + u * 12) * hashNoise(x * 0.2, y * 0.08)),
                3
            ) * 0.07;
            r -= crack;
            g -= crack;
            b -= crack;

            const i = (y * w + x) * 4;
            image.data[i] = Math.floor(clamp01(r) * 255);
            image.data[i + 1] = Math.floor(clamp01(g) * 255);
            image.data[i + 2] = Math.floor(clamp01(b) * 255);
            image.data[i + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/** Worn smooth below the waterline, rougher weathered grey above. */
function createWeatheredLogRoughnessMap() {
    const { w, h } = SURFACE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const v = y / h;
            const angle = u * Math.PI * 2;
            const bottomWet = Math.pow(Math.max(0, -Math.cos(angle)), 1.4);
            const topDry = Math.pow(Math.max(0, Math.cos(angle)), 0.75);
            const noise = hashNoise(x * 0.09, y * 0.13) * 0.12;

            let rough = 0.72 + topDry * 0.18 + noise;
            rough -= bottomWet * 0.22;

            const i = (y * w + x) * 4;
            const value = Math.floor(clamp01(rough) * 255);
            image.data[i] = value;
            image.data[i + 1] = value;
            image.data[i + 2] = value;
            image.data[i + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

/** Dark weathered end grain with soft ring lines. */
function createWeatheredLogEndColorMap() {
    const size = END_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size * 0.5;
    const cy = size * 0.5;
    const maxR = size * 0.5;

    const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    base.addColorStop(0, '#3a3834');
    base.addColorStop(0.35, '#45423c');
    base.addColorStop(0.72, '#3c3a36');
    base.addColorStop(1, '#2e2c28');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.22;
    for (let ring = 0; ring < 9; ring++) {
        const radius = maxR * (0.18 + ring * 0.085);
        ctx.strokeStyle = ring % 2 === 0 ? '#2a2824' : '#5a5650';
        ctx.lineWidth = 1 + (ring % 3 === 0 ? 1 : 0);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        ctx.strokeStyle = '#1e1c18';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

let sharedColorMap = null;
let sharedRoughnessMap = null;
let sharedEndColorMap = null;

function ensureSharedLogMaps() {
    if (!sharedColorMap) {
        sharedColorMap = createWeatheredLogColorMap();
        sharedRoughnessMap = createWeatheredLogRoughnessMap();
        sharedEndColorMap = createWeatheredLogEndColorMap();
    }
}

function cloneMap(texture, repeatX, repeatY) {
    const map = texture.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    return map;
}

/**
 * @param {number} length Log length along the hull axis.
 * @param {number} radius Log radius.
 */
export function createWeatheredLogSurfaceMaterial(length, radius) {
    ensureSharedLogMaps();

    const repeatX = Math.max(1.4, length * 0.34);
    const repeatY = Math.max(0.85, radius * 1.75);

    return new THREE.MeshStandardMaterial({
        map: cloneMap(sharedColorMap, repeatX, repeatY),
        roughnessMap: cloneMap(sharedRoughnessMap, repeatX, repeatY),
        color: 0xffffff,
        roughness: 1,
        metalness: 0.015,
        envMapIntensity: 0.72
    });
}

export function createWeatheredLogEndMaterial() {
    ensureSharedLogMaps();

    return new THREE.MeshStandardMaterial({
        map: sharedEndColorMap.clone(),
        color: 0xffffff,
        roughness: 0.92,
        metalness: 0.01,
        envMapIntensity: 0.65
    });
}
