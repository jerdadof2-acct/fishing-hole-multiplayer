import * as THREE from 'three';

/** CC0 Poly Haven clean_pebbles 1K — shared with lake bed. */
const DIFF_PATH = '/assets/textures/lakeBed/clean_pebbles_diff_1k.jpg';
const NORMAL_PATH = '/assets/textures/lakeBed/clean_pebbles_nor_gl_1k.jpg';
const ROUGH_PATH = '/assets/textures/lakeBed/clean_pebbles_rough_1k.jpg';

let groundMaps = null;
let loadPromise = null;

function loadTexture(loader, path) {
    return new Promise((resolve) => {
        loader.load(path, resolve, undefined, () => resolve(null));
    });
}

/**
 * @returns {Promise<{ map: THREE.Texture, normalMap: THREE.Texture, roughnessMap: THREE.Texture } | null>}
 */
export function preloadFarShoreGroundTextures() {
    if (groundMaps) {
        return Promise.resolve(groundMaps);
    }
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = (async () => {
        const loader = new THREE.TextureLoader();
        const [map, normalMap, roughnessMap] = await Promise.all([
            loadTexture(loader, DIFF_PATH),
            loadTexture(loader, NORMAL_PATH),
            loadTexture(loader, ROUGH_PATH)
        ]);

        if (!map) {
            groundMaps = null;
            return null;
        }

        [map, normalMap, roughnessMap].forEach((tex) => {
            if (!tex) return;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.anisotropy = 4;
        });
        map.colorSpace = THREE.SRGBColorSpace;

        groundMaps = { map, normalMap, roughnessMap };
        return groundMaps;
    })();

    return loadPromise;
}

function cloneRepeatingTexture(texture, repeatX, repeatY) {
    if (!texture) return null;
    const clone = new THREE.Texture(texture.image);
    clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
    clone.anisotropy = texture.anisotropy || 4;
    if (texture.colorSpace) {
        clone.colorSpace = texture.colorSpace;
    }
    clone.repeat.set(repeatX, repeatY);
    clone.needsUpdate = true;
    return clone;
}

/**
 * Rocky ground material for far-shore bank meshes.
 * @param {{ tint?: number, repeatX?: number, repeatY?: number, roughness?: number }} [options]
 * @returns {THREE.MeshStandardMaterial}
 */
export function createFarShoreGroundMaterial(options = {}) {
    const {
        tint = 0xffffff,
        repeatX = 8,
        repeatY = 8,
        roughness = 0.92
    } = options;

    if (!groundMaps) {
        return new THREE.MeshStandardMaterial({
            color: tint,
            roughness,
            metalness: 0
        });
    }

    const material = new THREE.MeshStandardMaterial({
        color: tint,
        map: cloneRepeatingTexture(groundMaps.map, repeatX, repeatY),
        normalMap: cloneRepeatingTexture(groundMaps.normalMap, repeatX, repeatY),
        roughnessMap: cloneRepeatingTexture(groundMaps.roughnessMap, repeatX, repeatY),
        roughness,
        metalness: 0,
        normalScale: new THREE.Vector2(0.85, 0.85)
    });

    if (material.normalMap) {
        material.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
    }

    return material;
}

/**
 * @param {THREE.Mesh} mesh
 * @param {number} tint
 * @param {number} [worldUnitsPerTile=3.2]
 */
export function applyRockyGroundToMesh(mesh, tint, worldUnitsPerTile = 3.2) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const spanX = Math.max(1, bb.max.x - bb.min.x);
    const spanZ = Math.max(1, bb.max.z - bb.min.z);

    mesh.material = createFarShoreGroundMaterial({
        tint,
        repeatX: spanX / worldUnitsPerTile,
        repeatY: spanZ / worldUnitsPerTile
    });
    mesh.receiveShadow = true;
}
