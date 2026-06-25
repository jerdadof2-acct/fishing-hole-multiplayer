import * as THREE from 'three';

let dockWoodTexture = null;
let dockWoodLoadPromise = null;

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
        metalness: 0.04
    });
}

export function createRopeMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xc4a574,
        roughness: 0.95,
        metalness: 0.0
    });
}
