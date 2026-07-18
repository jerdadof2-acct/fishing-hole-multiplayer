/**
 * Fish / relic image paths — prefer AVIF → WebP → PNG/JPG.
 */

function buildImagePathSet(basePathWithoutExt, bust = '') {
    return {
        primary: `${basePathWithoutExt}.webp${bust}`,
        avif: `${basePathWithoutExt}.avif${bust}`,
        fallback: `${basePathWithoutExt}.png${bust}`
    };
}

export function getFishImagePaths(fishName) {
    if (fishName === 'Starfish of Eternity') {
        // Cache-bust: SW may retain older art; bump when starfish art changes.
        const bust = '?v=20260717b';
        return buildImagePathSet('assets/images/StarfishofEternity', bust);
    }
    return buildImagePathSet(`assets/images/${fishName}`);
}

/** Relic art lives under images/hiddenitems/ — WebP/AVIF siblings from compress-assets. */
export function getRelicImagePaths(pngOrWebpPath) {
    const fallback = pngOrWebpPath
        .replace(/\.avif$/i, '.png')
        .replace(/\.webp$/i, '.png');
    const base = fallback.replace(/\.(png|jpe?g)$/i, '');
    return {
        primary: `${base}.webp`,
        avif: `${base}.avif`,
        fallback
    };
}

/** @deprecated Use getFishImagePaths — PNG fallback for legacy callers */
export function getFishImagePath(fishName) {
    return getFishImagePaths(fishName).fallback;
}

/**
 * Build img onerror handler for preferred → next fallback.
 * Supports one or two fallbacks (WebP→PNG or AVIF→WebP→PNG).
 */
export function fishImageOnErrorAttr(fallbackSrc, finalFallbackSrc = null) {
    const mid = String(fallbackSrc).replace(/'/g, "\\'");
    if (!finalFallbackSrc) {
        return `onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${mid}';}"`;
    }
    const last = String(finalFallbackSrc).replace(/'/g, "\\'");
    return `onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${mid}';}else if(this.dataset.fallback==='1'){this.dataset.fallback='2';this.src='${last}';}"`;
}

export function relicImageOnErrorAttr(fallbackSrc) {
    return fishImageOnErrorAttr(fallbackSrc);
}

/**
 * Warm browser + service-worker cache for image URLs without blocking the main thread.
 * @param {string[]} urls
 * @param {{ batchSize?: number, gapMs?: number }} options
 */
export function warmImageCache(urls, { batchSize = 6, gapMs = 100 } = {}) {
    const unique = [...new Set(urls.filter(Boolean))];
    if (!unique.length) {
        return Promise.resolve();
    }

    const run = async () => {
        for (let i = 0; i < unique.length; i += batchSize) {
            const batch = unique.slice(i, i + batchSize);
            await Promise.all(
                batch.map((url) => fetch(url, { credentials: 'same-origin' }).catch(() => null))
            );
            if (i + batchSize < unique.length && gapMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, gapMs));
            }
        }
    };

    return run();
}

/** Collect primary WebP URLs for all fish + relic gallery images. */
export async function collectGalleryImageUrls() {
    const [{ FishTypes }, { HIDDEN_RELICS, STARLIGHT_LURE_IMAGE }] = await Promise.all([
        import('../fishTypes.js'),
        import('../config/hiddenRelics.js')
    ]);

    const urls = FishTypes.map((fish) => getFishImagePaths(fish.name).primary);
    HIDDEN_RELICS.forEach((relic) => urls.push(getRelicImagePaths(relic.image).primary));
    urls.push(getRelicImagePaths(STARLIGHT_LURE_IMAGE).primary);
    return urls;
}
