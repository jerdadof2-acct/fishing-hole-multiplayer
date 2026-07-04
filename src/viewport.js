/**
 * Keep the game shell locked to the visible browser window.
 * Avoid visualViewport.offsetTop — on Android it can push the shell down and
 * leave a black band above the WebGL canvas while HUD overlays stay put.
 */

let syncBound = false;
const syncListeners = new Set();

export function getGameViewportSize() {
    return {
        width: Math.max(window.innerWidth || 1, 1),
        height: Math.max(window.innerHeight || 1, 1)
    };
}

export function syncViewportShell() {
    if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
    }
    return getGameViewportSize();
}

export function bindViewportSync(onChange) {
    if (typeof onChange === 'function') {
        syncListeners.add(onChange);
    }

    if (syncBound) {
        return;
    }
    syncBound = true;

    const notify = () => {
        syncViewportShell();
        syncListeners.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                console.warn('[VIEWPORT] Resize listener failed:', error);
            }
        });
    };

    notify();

    window.addEventListener('resize', notify);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(notify, 50);
        window.setTimeout(notify, 250);
        window.setTimeout(notify, 500);
    });
    window.addEventListener('pageshow', notify);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', notify);
    }
}
