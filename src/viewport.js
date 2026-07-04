/**
 * Size the WebGL canvas from the game container's real painted size.
 * window.innerHeight alone is unreliable on Android Chrome (URL bar, visual viewport).
 */

let syncBound = false;
const syncListeners = new Set();
let cachedSize = null;
let containerObserver = null;

function updateCachedSize(width, height) {
    const w = Math.round(width);
    const h = Math.round(height);
    if (w > 0 && h > 0) {
        cachedSize = { width: w, height: h };
    }
}

function measureContainer() {
    const container = document.getElementById('game-container');
    if (!container) {
        return null;
    }
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        updateCachedSize(rect.width, rect.height);
        return cachedSize;
    }
    return null;
}

export function getGameViewportSize() {
    const measured = measureContainer();
    if (measured) {
        return { ...measured };
    }

    const visualViewport = window.visualViewport;
    return {
        width: Math.max(
            Math.round(visualViewport?.width ?? window.innerWidth ?? 1),
            1
        ),
        height: Math.max(
            Math.round(visualViewport?.height ?? window.innerHeight ?? 1),
            1
        )
    };
}

export function syncViewportShell() {
    if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
    }
    measureContainer();
    return getGameViewportSize();
}

function notifyListeners() {
    syncViewportShell();
    syncListeners.forEach((listener) => {
        try {
            listener();
        } catch (error) {
            console.warn('[VIEWPORT] Resize listener failed:', error);
        }
    });
}

export function bindViewportSync(onChange) {
    if (typeof onChange === 'function') {
        syncListeners.add(onChange);
    }

    const container = document.getElementById('game-container');
    if (container && typeof ResizeObserver !== 'undefined') {
        containerObserver?.disconnect();
        containerObserver = new ResizeObserver(() => {
            notifyListeners();
        });
        containerObserver.observe(container);
    }

    if (syncBound) {
        notifyListeners();
        return;
    }
    syncBound = true;

    notifyListeners();

    window.addEventListener('resize', notifyListeners);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(notifyListeners, 50);
        window.setTimeout(notifyListeners, 250);
        window.setTimeout(notifyListeners, 500);
    });
    window.addEventListener('pageshow', notifyListeners);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', notifyListeners);
    }
}

export function runMobileLayoutBurst(onChange, frameCount = 90) {
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) {
        return;
    }

    let frames = 0;
    const tick = () => {
        notifyListeners();
        onChange?.();
        frames += 1;
        if (frames < frameCount) {
            requestAnimationFrame(tick);
        }
    };
    requestAnimationFrame(tick);
}
