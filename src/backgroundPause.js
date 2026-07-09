/**
 * Pause game audio/rendering when the tab or PWA is backgrounded.
 * Location ambience uses detached HTMLAudioElement instances (not in the DOM),
 * so visibility handlers must route through the Game pause hooks.
 */

let installed = false;
/** @type {import('./main.js').Game | null} */
let activeGame = null;

export function isPageHidden() {
    return document.visibilityState === 'hidden' || document.hidden === true;
}

/** @param {import('./main.js').Game | null} game */
export function bindGameBackgroundPause(game) {
    activeGame = game;
}

export function pauseForPageBackground() {
    activeGame?.pauseForBackground?.();
}

export function resumeFromPageForeground() {
    if (isPageHidden()) {
        return;
    }
    activeGame?.resumeFromBackground?.();
}

export function installBackgroundPauseHandlers() {
    if (installed || typeof document === 'undefined') {
        return;
    }
    installed = true;

    const sync = () => {
        if (isPageHidden()) {
            pauseForPageBackground();
            return;
        }
        resumeFromPageForeground();
    };

    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', pauseForPageBackground);
    window.addEventListener('pageshow', () => {
        if (!isPageHidden()) {
            resumeFromPageForeground();
        }
    });

    // iOS / Android often background the PWA on blur before visibility settles.
    window.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (isPageHidden()) {
                pauseForPageBackground();
            }
        }, 0);
    });

    document.addEventListener('freeze', pauseForPageBackground);
    document.addEventListener('resume', resumeFromPageForeground);

    if (isPageHidden()) {
        pauseForPageBackground();
    }
}
