import * as THREE from 'three';

/** Matches near-layer palette in `congoRiverBanks.js`. */
const DEEP_GREEN = [12, 28, 13];
const MID_GREEN = [18, 40, 19];
const FOLIAGE_DARK = [13, 30, 13];
const SHADOW_GREEN = [8, 18, 8];
const MUD_GREEN = [18, 30, 14];

const BACKDROP_Z = 62;
const BACKDROP_WIDTH = 76;
const BACKDROP_HEIGHT = 52;
const BACKDROP_FAR_Z = 92;
/** Plane center Y = water + height * this (lower = horizon drops in portrait view). */
const BACKDROP_CENTER_Y_FACTOR = 0.24;
/** Shift texture down on the plane (raises visible ridgeline). */
const BACKDROP_TEXTURE_OFFSET_Y = 0.14;
const BACKDROP_FAR_SCALE = 1.14;

let mountainTexture = null;

function mulberry32(seed) {
    let state = seed | 0;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rgb([r, g, b], alpha = 1) {
    return alpha >= 1
        ? `rgb(${r},${g},${b})`
        : `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Layered jungle backdrop — static distant ridgeline with dark foliage (no triangle trees).
 */
function createMountainBackdropTexture() {
    if (mountainTexture) {
        return mountainTexture;
    }

    const width = 1024;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const rand = mulberry32(8843);

    const pickFoliageColor = () => {
        const roll = rand();
        if (roll < 0.38) return SHADOW_GREEN;
        if (roll < 0.72) return FOLIAGE_DARK;
        if (roll < 0.9) return DEEP_GREEN;
        return MID_GREEN;
    };

    const paintFoliageBlob = (cx, cy, rx, ry, rotation, color, alpha) => {
        ctx.fillStyle = rgb(color, alpha);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
        ctx.fill();
    };

    ctx.fillStyle = rgb(DEEP_GREEN);
    ctx.fillRect(0, 0, width, height);

    const haze = ctx.createLinearGradient(0, 0, 0, height * 0.42);
    haze.addColorStop(0, rgb(DEEP_GREEN, 0.72));
    haze.addColorStop(0.45, rgb(FOLIAGE_DARK, 0.28));
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = rgb(MUD_GREEN);
    ctx.fillRect(0, height * 0.58, width, height);

    const layers = [
        { rgb: SHADOW_GREEN, base: 0.68, amp: 0.1, freq: 1.1, yOff: 0.02 },
        { rgb: DEEP_GREEN, base: 0.62, amp: 0.12, freq: 1.7, yOff: 0.04 },
        { rgb: FOLIAGE_DARK, base: 0.54, amp: 0.14, freq: 2.4, yOff: 0.06 },
        { rgb: MID_GREEN, base: 0.46, amp: 0.11, freq: 3.6, yOff: 0.05 },
        { rgb: DEEP_GREEN, base: 0.38, amp: 0.08, freq: 5.2, yOff: 0.03 }
    ];

    for (const layer of layers) {
        ctx.fillStyle = rgb(layer.rgb);
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x++) {
            const t = (x / width) * Math.PI * 2;
            const n =
                Math.sin(t * layer.freq) * 0.42 +
                Math.sin(t * layer.freq * 2.1 + 0.8) * 0.28 +
                Math.sin(t * layer.freq * 3.7 + 1.6) * 0.16 +
                (rand() - 0.5) * 0.06;
            const y = height * (layer.base + n * layer.amp - layer.yOff);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
    }

    const forestTop = height * 0.08;
    const forestBottom = height * 0.62;
    const forestSpan = forestBottom - forestTop;

    for (let i = 0; i < 72; i++) {
        const x = rand() * width;
        const cy = forestTop + rand() * forestSpan;
        paintFoliageBlob(
            x,
            cy,
            10 + rand() * 28,
            8 + rand() * 22,
            rand() * Math.PI,
            pickFoliageColor(),
            0.42 + rand() * 0.32
        );
    }

    for (let i = 0; i < 96; i++) {
        const x = rand() * width;
        const cy = forestTop + rand() * forestSpan;
        paintFoliageBlob(
            x,
            cy,
            3 + rand() * 12,
            2 + rand() * 10,
            rand() * Math.PI,
            rand() > 0.5 ? SHADOW_GREEN : FOLIAGE_DARK,
            0.35 + rand() * 0.35
        );
    }

    for (let i = 0; i < 28; i++) {
        const x = rand() * width;
        const hangTop = forestTop + rand() * forestSpan * 0.55;
        const hangLen = forestSpan * (0.1 + rand() * 0.22);
        paintFoliageBlob(
            x,
            hangTop + hangLen * 0.5,
            5 + rand() * 9,
            hangLen * 0.5,
            rand() * 0.25,
            rand() > 0.35 ? FOLIAGE_DARK : SHADOW_GREEN,
            0.45 + rand() * 0.28
        );
    }

    for (let i = 0; i < 40; i++) {
        const x = rand() * width;
        const cy = forestTop + rand() * forestSpan * 0.9;
        paintFoliageBlob(
            x,
            cy,
            14 + rand() * 22,
            10 + rand() * 18,
            rand() * Math.PI * 2,
            SHADOW_GREEN,
            0.26 + rand() * 0.22
        );
    }

    mountainTexture = new THREE.CanvasTexture(canvas);
    mountainTexture.colorSpace = THREE.SRGBColorSpace;
    mountainTexture.anisotropy = 4;
    mountainTexture.needsUpdate = true;
    return mountainTexture;
}

function createBackdropPlane({
    waterLevel,
    z,
    width,
    height,
    opacity = 1,
    name
}) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
        map: createMountainBackdropTexture(),
        transparent: opacity < 1,
        opacity,
        depthWrite: true,
        fog: true
    });
    if (material.map) {
        material.map.offset.y = BACKDROP_TEXTURE_OFFSET_Y;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(0, waterLevel + height * BACKDROP_CENTER_Y_FACTOR, z);
    mesh.rotation.y = Math.PI;
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;
    return mesh;
}

/**
 * Distant jungle mountains filling the channel gap (portrait + gameplay horizon).
 * @param {THREE.Scene} scene
 * @param {{ waterLevel?: number }} [options]
 */
export function createCongoRiverBackdrop(scene, { waterLevel = 0 } = {}) {
    const root = new THREE.Group();
    root.name = 'congoRiverBackdrop';

    root.add(createBackdropPlane({
        waterLevel,
        z: BACKDROP_FAR_Z,
        width: BACKDROP_WIDTH * BACKDROP_FAR_SCALE,
        height: BACKDROP_HEIGHT * 1.08,
        opacity: 0.88,
        name: 'congoMountainFar'
    }));

    root.add(createBackdropPlane({
        waterLevel,
        z: BACKDROP_Z,
        width: BACKDROP_WIDTH,
        height: BACKDROP_HEIGHT,
        opacity: 1,
        name: 'congoMountainNear'
    }));

    root.visible = false;
    scene.add(root);
    return root;
}

export function syncCongoRiverBackdropVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}
