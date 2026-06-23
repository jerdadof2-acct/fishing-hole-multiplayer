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

/** GLTFLoader configured for meshopt-compressed models (Cat.glb after compress:cat). */
export async function createGLTFLoader() {
    await ensureMeshoptDecoder();
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
}
