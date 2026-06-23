/**
 * Fish / relic image paths — prefer WebP (smaller) with PNG/JPG fallback.
 */

export function getFishImagePaths(fishName) {
    if (fishName === 'Starfish of Eternity') {
        return {
            primary: 'assets/images/StarfishofEternity.webp',
            fallback: 'assets/images/StarfishofEternity.jpg'
        };
    }
    const base = `assets/images/${fishName}`;
    return {
        primary: `${base}.webp`,
        fallback: `${base}.png`
    };
}

/** @deprecated Use getFishImagePaths — PNG fallback for legacy callers */
export function getFishImagePath(fishName) {
    return getFishImagePaths(fishName).fallback;
}

/** Build img tag attrs: lazy WebP with automatic fallback */
export function fishImageOnErrorAttr(fallbackSrc) {
    const safe = String(fallbackSrc).replace(/'/g, "\\'");
    return `onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${safe}';}"`;
}
