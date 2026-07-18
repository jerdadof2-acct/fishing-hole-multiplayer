/**
 * Deterministic GPU resource disposal for location scenery trees.
 * Safe to call on null / already-disposed graphs.
 *
 * @param {import('three').Object3D | null | undefined} root
 * @param {{ removeFromParent?: boolean }} [options]
 */
export function disposeObject3D(root, options = {}) {
    if (!root) {
        return;
    }

    const removeFromParent = options.removeFromParent !== false;

    root.traverse((obj) => {
        if (obj.geometry?.dispose) {
            obj.geometry.dispose();
        }

        const materials = Array.isArray(obj.material)
            ? obj.material
            : (obj.material ? [obj.material] : []);

        for (const material of materials) {
            if (!material) {
                continue;
            }
            for (const key of Object.keys(material)) {
                const value = material[key];
                if (value && typeof value === 'object' && typeof value.dispose === 'function') {
                    // Dispose texture maps / render targets attached to materials.
                    try {
                        value.dispose();
                    } catch {
                        // Ignore already-disposed textures.
                    }
                }
            }
            material.dispose?.();
        }
    });

    if (removeFromParent && root.parent) {
        root.parent.remove(root);
    }
}

/**
 * Keep a small LRU of heavy location scenery so cycling two locations
 * does not thrash GPU memory, while older locations are fully disposed.
 */
export class LocationSceneryCache {
    /**
     * @param {number} [maxEntries]
     */
    constructor(maxEntries = 2) {
        this.maxEntries = Math.max(1, maxEntries);
        /** @type {Map<string, { root: import('three').Object3D, dispose?: Function }>} */
        this.entries = new Map();
    }

    /**
     * @param {string} key
     * @param {import('three').Object3D} root
     * @param {() => void} [customDispose]
     */
    remember(key, root, customDispose) {
        if (!key || !root) {
            return;
        }
        if (this.entries.has(key)) {
            this.entries.delete(key);
        }
        this.entries.set(key, { root, dispose: customDispose });
        this._evict();
    }

    /**
     * @param {string} key
     */
    touch(key) {
        const entry = this.entries.get(key);
        if (!entry) {
            return;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
    }

    /**
     * @param {string} key
     * @returns {import('three').Object3D | null}
     */
    get(key) {
        const entry = this.entries.get(key);
        if (!entry) {
            return null;
        }
        this.touch(key);
        return entry.root;
    }

    /**
     * Drop everything except the given keys (current + recent).
     * @param {string[]} keepKeys
     */
    retainOnly(keepKeys = []) {
        const keep = new Set(keepKeys.filter(Boolean));
        for (const [key, entry] of [...this.entries.entries()]) {
            if (keep.has(key)) {
                continue;
            }
            this.entries.delete(key);
            try {
                if (typeof entry.dispose === 'function') {
                    entry.dispose();
                } else {
                    disposeObject3D(entry.root);
                }
            } catch (error) {
                console.warn('[SCENERY CACHE] Dispose failed for', key, error);
            }
        }
    }

    _evict() {
        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            const entry = this.entries.get(oldestKey);
            this.entries.delete(oldestKey);
            try {
                if (typeof entry?.dispose === 'function') {
                    entry.dispose();
                } else {
                    disposeObject3D(entry?.root);
                }
            } catch (error) {
                console.warn('[SCENERY CACHE] Evict dispose failed for', oldestKey, error);
            }
        }
    }
}
