/**
 * Pause game audio, animation, and background work when the app loses focus.
 * Location ambience uses detached HTMLAudioElement instances (not in the DOM),
 * so handlers must route through Game + prologue pause hooks.
 */

import { pauseActivePrologue, resumeActivePrologue } from './prologue.js';

let installed = false;
/** @type {import('./main.js').Game | null} */
let activeGame = null;

export function isPageHidden() {
    return document.visibilityState === 'hidden' || document.hidden === true;
}

export function shouldGamePause() {
    if (typeof document === 'undefined') {
        return false;
    }
    return isPageHidden() || !document.hasFocus();
}

export function shouldGameResume() {
    if (typeof document === 'undefined') {
        return false;
    }
    return !isPageHidden() && document.hasFocus();
}

/** @param {import('./main.js').Game | null} game */
export function bindGameBackgroundPause(game) {
    activeGame = game;
}

export function pauseForPageBackground() {
    pauseActivePrologue();
    activeGame?.pauseForBackground?.();
}

export function resumeFromPageForeground() {
    if (!shouldGameResume()) {
        return;
    }
    activeGame?.resumeFromBackground?.();
    resumeActivePrologue();
}

function syncBackgroundState() {
    if (shouldGamePause()) {
        pauseForPageBackground();
        return;
    }
    resumeFromPageForeground();
}

export function installBackgroundPauseHandlers() {
    if (installed || typeof document === 'undefined') {
        return;
    }
    installed = true;

    document.addEventListener('visibilitychange', syncBackgroundState);
    window.addEventListener('pagehide', pauseForPageBackground);
    window.addEventListener('pageshow', syncBackgroundState);

    window.addEventListener('blur', () => {
        window.requestAnimationFrame(() => {
            if (shouldGamePause()) {
                pauseForPageBackground();
            }
        });
    });

    window.addEventListener('focus', () => {
        window.requestAnimationFrame(() => {
            if (shouldGameResume()) {
                resumeFromPageForeground();
            }
        });
    });

    document.addEventListener('freeze', pauseForPageBackground);
    document.addEventListener('resume', syncBackgroundState);

    if (shouldGamePause()) {
        pauseForPageBackground();
    }
}
