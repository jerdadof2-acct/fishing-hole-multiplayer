/**
 * Mobile-safe viewport sizing for Android Chrome / iOS Safari.
 * 100dvh can exceed the visible area on first paint; sync to visualViewport instead.
 */

let syncBound = false;
const syncListeners = new Set();

export function isMobileViewport() {
    if (typeof navigator === 'undefined') {
        return false;
    }
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function syncViewportShell() {
    const visualViewport = window.visualViewport;
    const width = Math.round(visualViewport?.width ?? window.innerWidth ?? 1);
    const height = Math.round(visualViewport?.height ?? window.innerHeight ?? 1);
    const offsetTop = Math.round(visualViewport?.offsetTop ?? 0);

    document.documentElement.style.setProperty('--app-width', `${Math.max(width, 1)}px`);
    document.documentElement.style.setProperty('--app-height', `${Math.max(height, 1)}px`);
    document.documentElement.style.setProperty('--app-offset-top', `${offsetTop}px`);

    if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
    }

    return { width: Math.max(width, 1), height: Math.max(height, 1) };
}

export function getGameViewportSize() {
    syncViewportShell();

    const container = document.getElementById('game-container');
    const canvas = container?.querySelector('canvas');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (width > 0 && height > 0) {
            return { width, height };
        }
    }

    const visualViewport = window.visualViewport;
    return {
        width: Math.max(
            Math.round(visualViewport?.width ?? container?.clientWidth ?? window.innerWidth ?? 1),
            1
        ),
        height: Math.max(
            Math.round(visualViewport?.height ?? container?.clientHeight ?? window.innerHeight ?? 1),
            1
        )
    };
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
        window.setTimeout(notify, 100);
    });
    window.addEventListener('pageshow', notify);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', notify);
        window.visualViewport.addEventListener('scroll', notify);
    }
}
