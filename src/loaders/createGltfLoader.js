import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let sharedKtx2 = null;
let meshoptReady = false;

/**
 * GLTF loader with Meshopt + optional KTX2 support for GPU-compressed textures.
 * @param {import('three').WebGLRenderer | null} [renderer]
 * @returns {GLTFLoader}
 */
export function createGltfLoader(renderer = null) {
    const loader = new GLTFLoader();

    try {
        if (!meshoptReady && MeshoptDecoder) {
            loader.setMeshoptDecoder(MeshoptDecoder);
            meshoptReady = true;
        } else if (MeshoptDecoder) {
            loader.setMeshoptDecoder(MeshoptDecoder);
        }
    } catch (error) {
        console.warn('[GLTF] MeshoptDecoder unavailable:', error);
    }

    if (renderer) {
        try {
            if (!sharedKtx2) {
                sharedKtx2 = new KTX2Loader()
                    .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/')
                    .detectSupport(renderer);
            }
            loader.setKTX2Loader(sharedKtx2);
        } catch (error) {
            console.warn('[GLTF] KTX2Loader unavailable:', error);
        }
    }

    return loader;
}

/**
 * Load a texture preferring a sibling .ktx2 when present (GPU memory win).
 * Falls back to TextureLoader for PNG/JPG/WebP.
 *
 * @param {import('three').WebGLRenderer} renderer
 * @param {string} url
 * @returns {Promise<import('three').Texture>}
 */
export async function loadTexturePreferKtx2(renderer, url) {
    const THREE = await import('three');
    const ktx2Url = url.replace(/\.(png|jpe?g|webp)$/i, '.ktx2');
    const tryKtx2 = ktx2Url !== url;

    if (tryKtx2 && renderer) {
        try {
            if (!sharedKtx2) {
                sharedKtx2 = new KTX2Loader()
                    .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/')
                    .detectSupport(renderer);
            }
            const tex = await sharedKtx2.loadAsync(ktx2Url);
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        } catch {
            // Fall through to standard loader.
        }
    }

    const loader = new THREE.TextureLoader();
    return loader.loadAsync(url);
}
