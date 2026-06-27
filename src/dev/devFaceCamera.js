import { isDevMode } from './devMode.js';

export const DEV_FACE_CAMERA_STORAGE_KEY = 'kittyCreekDevFaceCamera';

/**
 * Dev-only: lock Halley and the camera in portrait pose for gem placement tuning.
 * Toggle in the Dev panel or use ?facecam=1 / ?facecam=0 on localhost.
 */
export function isDevFaceCameraEnabled() {
    if (!isDevMode()) {
        return false;
    }
    try {
        return localStorage.getItem(DEV_FACE_CAMERA_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function setDevFaceCameraEnabled(enabled) {
    if (!isDevMode()) {
        return;
    }
    try {
        if (enabled) {
            localStorage.setItem(DEV_FACE_CAMERA_STORAGE_KEY, '1');
        } else {
            localStorage.removeItem(DEV_FACE_CAMERA_STORAGE_KEY);
        }
    } catch {
        /* ignore */
    }
}

/** Apply ?facecam=1 or ?facecam=0 when dev mode is active. */
export function initDevFaceCameraFromUrl() {
    if (!isDevMode() || typeof window === 'undefined') {
        return;
    }
    const params = new URLSearchParams(window.location.search);
    if (!params.has('facecam')) {
        return;
    }
    setDevFaceCameraEnabled(params.get('facecam') !== '0');
}
