import * as THREE from 'three';

let dockWoodTexture = null;
let dockWoodLoadPromise = null;
let logEndRingTexture = null;

function isMobileDevice() {
    return typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Procedural fallback when the JPEG is missing (no extra download).
 */
export function createProceduralDockWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    for (let row = 0; row < 14; row++) {
        const y = row * 18;
        const shade = 95 + (row % 3) * 12;
        ctx.fillStyle = `rgb(${shade + 28}, ${shade + 8}, ${shade - 18})`;
        ctx.fillRect(0, y + 1, 256, 16);
        ctx.fillStyle = `rgb(${shade - 12}, ${shade - 22}, ${shade - 32})`;
        ctx.fillRect(0, y, 256, 1);
        ctx.strokeStyle = `rgba(40, 28, 18, 0.25)`;
        ctx.lineWidth = 1;
        for (let g = 0; g < 4; g++) {
            ctx.beginPath();
            const gy = y + 4 + g * 3;
            ctx.moveTo(0, gy);
            ctx.bezierCurveTo(64, gy + 2, 192, gy - 2, 256, gy);
            ctx.stroke();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/**
 * @returns {Promise<THREE.Texture>}
 */
export function preloadDockWoodTexture() {
    if (dockWoodTexture) {
        return Promise.resolve(dockWoodTexture);
    }
    if (dockWoodLoadPromise) {
        return dockWoodLoadPromise;
    }

    dockWoodLoadPromise = new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        const useSmall = isMobileDevice();
        const primary = useSmall ? '/assets/textures/dockWood-sm.jpg' : '/assets/textures/dockWood.jpg';
        const fallback = '/assets/textures/dockWood-sm.jpg';

        const finish = (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(4, 8);
            dockWoodTexture = texture;
            resolve(texture);
        };

        loader.load(
            primary,
            finish,
            undefined,
            () => {
                if (primary !== fallback) {
                    loader.load(fallback, finish, undefined, () => {
                        finish(createProceduralDockWoodTexture());
                    });
                    return;
                }
                finish(createProceduralDockWoodTexture());
            }
        );
    });

    return dockWoodLoadPromise;
}

export function getDockWoodTexture() {
    return dockWoodTexture;
}

/**
 * @param {THREE.Texture} texture
 * @param {{ tint?: number, roughness?: number, repeat?: [number, number] }} [options]
 */
export function createDockWoodMaterial(texture, options = {}) {
    const {
        tint = 0xffffff,
        roughness = 0.86,
        repeat = [1, 1]
    } = options;

    const map = texture.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat[0], repeat[1]);

    return new THREE.MeshStandardMaterial({
        map,
        color: tint,
        roughness,
        metalness: 0.04,
        envMapIntensity: 0
    });
}

export function createRopeMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xc4a574,
        roughness: 0.95,
        metalness: 0.0
    });
}

/**
 * Radial tree-ring texture for cut log ends (center = heartwood, rings outward).
 * @returns {THREE.CanvasTexture}
 */
export function createLogEndRingTexture() {
    if (logEndRingTexture) {
        return logEndRingTexture;
    }

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size / 2 - 3;

    const baseGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    baseGradient.addColorStop(0, '#e6d4b0');
    baseGradient.addColorStop(0.12, '#dcc8a0');
    baseGradient.addColorStop(0.55, '#ccb88a');
    baseGradient.addColorStop(1, '#b09068');
    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    const ringCount = 16;
    for (let i = 1; i <= ringCount; i++) {
        const r = (i / ringCount) * maxR;
        const isDark = i % 2 === 0;
        ctx.strokeStyle = isDark ? 'rgba(105, 72, 42, 0.62)' : 'rgba(195, 158, 108, 0.38)';
        ctx.lineWidth = isDark ? 2.4 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(145, 108, 68, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.07, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2 + 0.18;
        ctx.strokeStyle = 'rgba(85, 58, 34, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * maxR * 0.06, cy + Math.sin(angle) * maxR * 0.06);
        ctx.lineTo(cx + Math.cos(angle) * maxR * 0.9, cy + Math.sin(angle) * maxR * 0.9);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(62, 40, 24, 0.55)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    logEndRingTexture = texture;
    return texture;
}

/**
 * Lighter fresh-cut wood material for piling tops.
 * @returns {THREE.MeshStandardMaterial}
 */
export function createLogEndCapMaterial() {
    return new THREE.MeshStandardMaterial({
        map: createLogEndRingTexture(),
        color: 0xe8d8bc,
        roughness: 0.84,
        metalness: 0.02,
        envMapIntensity: 0
    });
}
