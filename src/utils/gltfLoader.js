import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

let meshoptReady = null;

function ensureMeshoptDecoder() {
    if (!meshoptReady) {
        meshoptReady = MeshoptDecoder.ready
            ? MeshoptDecoder.ready
            : Promise.resolve();
    }
    return meshoptReady;
}

const MESHOPT_READY_TIMEOUT_MS = 15000;

/** GLTFLoader configured for meshopt-compressed models (Cat.glb after compress:cat). */
export async function createGLTFLoader() {
    const loader = new GLTFLoader();
    try {
        await Promise.race([
            ensureMeshoptDecoder(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Meshopt decoder init timed out')), MESHOPT_READY_TIMEOUT_MS);
            })
        ]);
        loader.setMeshoptDecoder(MeshoptDecoder);
    } catch (error) {
        console.warn('[GLTF] Meshopt decoder unavailable:', error);
    }
    return loader;
}
