import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Load a CC0 HDRI (Poly Haven) and build a PMREM environment map for reflections.
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ mobile?: boolean }} [options]
 * @returns {Promise<{ envMap: THREE.Texture, background: THREE.Texture } | null>}
 */
export async function loadSkyEnvironment(renderer, options = {}) {
    if (!renderer) return null;

    const isMobile = options.mobile ?? (
        typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );

    const hdrPath = isMobile
        ? '/assets/textures/hdri/kloppenheim_06_1k.hdr'
        : '/assets/textures/hdri/kloppenheim_06_2k.hdr';

    try {
        const loader = new RGBELoader();
        const hdr = await loader.loadAsync(hdrPath);
        hdr.mapping = THREE.EquirectangularReflectionMapping;

        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(hdr).texture;
        envMap.colorSpace = THREE.LinearSRGBColorSpace;

        const background = hdr;
        background.colorSpace = THREE.LinearSRGBColorSpace;

        pmrem.dispose();
        return { envMap, background };
    } catch (err) {
        console.warn('[environment] HDRI load failed, using default sky:', err);
        return null;
    }
}

/**
 * Apply environment lighting and soft sky background to the scene.
 * @param {THREE.Scene} scene
 * @param {{ envMap: THREE.Texture, background: THREE.Texture }} env
 */
export function applySkyEnvironment(scene, env) {
    if (!scene || !env?.envMap) return;

    scene.environment = env.envMap;
    scene.environmentIntensity = 0.85;

    if (env.background) {
        scene.background = env.background;
        if ('backgroundBlurriness' in scene) {
            scene.backgroundBlurriness = 0.35;
        }
        if ('backgroundIntensity' in scene) {
            scene.backgroundIntensity = 0.9;
        }
    }

    if (scene.fog) {
        scene.fog.color.setHex(0xa8cce8);
        scene.fog.near = 55;
        scene.fog.far = 210;
    }
}
