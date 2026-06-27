import { isDevMode } from './devMode.js';

export const DEV_GEM_OFFSET_STORAGE_KEY = 'kittyCreekDevGemOffset';

/**
 * @param {THREE.Vector3} fallback
 * @returns {THREE.Vector3}
 */
export function loadDevGemOffset(fallback) {
    if (!isDevMode() || !fallback) {
        return fallback?.clone?.() ?? fallback;
    }
    try {
        const raw = localStorage.getItem(DEV_GEM_OFFSET_STORAGE_KEY);
        if (!raw) {
            return fallback.clone();
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 3) {
            return new THREE.Vector3(parsed[0], parsed[1], parsed[2]);
        }
    } catch {
        /* ignore */
    }
    return fallback.clone();
}

/**
 * @param {THREE.Vector3} offset
 */
export function saveDevGemOffset(offset) {
    if (!isDevMode() || !offset) {
        return;
    }
    try {
        localStorage.setItem(
            DEV_GEM_OFFSET_STORAGE_KEY,
            JSON.stringify([offset.x, offset.y, offset.z])
        );
    } catch {
        /* ignore */
    }
}

export function clearDevGemOffset() {
    if (!isDevMode()) {
        return;
    }
    try {
        localStorage.removeItem(DEV_GEM_OFFSET_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
