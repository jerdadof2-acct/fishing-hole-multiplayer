import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { isGpuSafeMode } from '../scene.js';

/** Session cache — avoid re-decoding HDR + rebuilding PMREM on location revisits. */
const envCache = new Map();

/**
 * Prefer a prefiltered LDR environment when present (offline bake),
 * otherwise decode HDR once per path and cache the PMREM result.
 *
 * Place optional asset at:
 *   /assets/textures/hdri/kloppenheim_06_1k.env.jpg  (equirect LDR)
 * to skip HDR decode on weak devices.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {{ mobile?: boolean }} [options]
 * @returns {Promise<{ envMap: THREE.Texture } | null>}
 */
export async function loadSkyEnvironment(renderer, options = {}) {
    if (!renderer) return null;

    // GPU safe mode (after a driver crash): skip the HDRI + PMREM cubemap,
    // one of the biggest single GPU allocations. The color sky fallback is fine.
    if (isGpuSafeMode()) {
        console.warn('[environment] GPU safe mode — skipping HDRI environment.');
        return null;
    }

    const isMobile = options.mobile ?? (
        typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );

    const hdrPath = isMobile
        ? '/assets/textures/hdri/kloppenheim_06_1k.hdr'
        : '/assets/textures/hdri/kloppenheim_06_2k.hdr';
    const prefilteredPath = hdrPath.replace(/\.hdr$/i, '.env.jpg');

    const cacheKey = `${hdrPath}|dpr=${renderer.getPixelRatio?.() ?? 1}`;
    if (envCache.has(cacheKey)) {
        return envCache.get(cacheKey);
    }

    const pending = (async () => {
        try {
            // Optional offline-prefiltered equirect — cheaper decode, still PMREM'd once.
            const prefiltered = await tryLoadPrefilteredEquirect(prefilteredPath);
            const sourceTex = prefiltered || await loadHdr(hdrPath);

            const pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
            const envMap = pmrem.fromEquirectangular(sourceTex).texture;
            envMap.colorSpace = THREE.LinearSRGBColorSpace;

            sourceTex.dispose();
            pmrem.dispose();

            return { envMap };
        } catch (err) {
            console.warn('[environment] HDRI load failed, using default sky:', err);
            return null;
        }
    })();

    envCache.set(cacheKey, pending);
    return pending;
}

async function loadHdr(hdrPath) {
    const loader = new RGBELoader();
    const hdr = await loader.loadAsync(hdrPath);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    return hdr;
}

async function tryLoadPrefilteredEquirect(path) {
    try {
        const res = await fetch(path, { method: 'HEAD' });
        if (!res.ok) {
            return null;
        }
    } catch {
        return null;
    }

    try {
        const loader = new THREE.TextureLoader();
        const tex = await loader.loadAsync(path);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        console.info('[environment] Using prefiltered LDR environment:', path);
        return tex;
    } catch {
        return null;
    }
}

/**
 * Apply environment lighting and soft sky background to the scene.
 * @param {THREE.Scene} scene
 * @param {{ envMap: THREE.Texture }} env
 */
export function applySkyEnvironment(scene, env) {
    if (!scene || !env?.envMap) return;

    scene.environment = env.envMap;
    scene.environmentIntensity = 0.85;

    // Cube background matches environment — avoids 2D equirect vs cube bind conflicts.
    scene.background = env.envMap;
    if ('backgroundBlurriness' in scene) {
        scene.backgroundBlurriness = 0.35;
    }
    if ('backgroundIntensity' in scene) {
        scene.backgroundIntensity = 0.9;
    }

    if (scene.fog) {
        scene.fog.color.setHex(0xa8cce8);
        scene.fog.near = 55;
        scene.fog.far = 210;
    }
}

/**
 * Night / moonlight locations — drop bright HDRI IBL so boats are not sun-lit.
 * @param {THREE.Scene} scene
 * @param {{ background?: number, environmentIntensity?: number }} [options]
 */
export function applyDarkMoonlightSky(scene, options = {}) {
    if (!scene) return;

    const {
        background = 0x02040c,
        environmentIntensity = 0.06
    } = options;

    scene.environment = null;

    if (scene.background?.isColor) {
        scene.background.set(background);
    } else {
        scene.background = new THREE.Color(background);
    }

    if ('environmentIntensity' in scene) {
        scene.environmentIntensity = environmentIntensity;
    }
    if ('backgroundBlurriness' in scene) {
        scene.backgroundBlurriness = 0;
    }
    if ('backgroundIntensity' in scene) {
        scene.backgroundIntensity = 1.0;
    }
}
