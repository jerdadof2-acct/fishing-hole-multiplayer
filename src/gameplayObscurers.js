import { removeLoadingOverlay } from './loadingProgress.js';

/**
 * Remove or hide layers that can sit above the WebGL canvas on mobile
 * (loading screen, onboarding dimmer, stale pickers).
 */
export function dismissAllGameplayObscurers() {
    removeLoadingOverlay();

    document.getElementById('gameplay-onboarding')?.remove();
    document.body.classList.remove('gameplay-onboarding-active');

    document.querySelectorAll('.location-picker-overlay').forEach((node) => node.remove());

    const prologue = document.getElementById('story-prologue');
    if (prologue?.classList.contains('hidden')) {
        prologue.style.display = 'none';
        prologue.style.pointerEvents = 'none';
    }

    document.body.classList.add('game-ready');
}

/**
 * The game page must not load adsbygoogle.js — ads live in ad-banner.html / ad-energy.html iframes.
 * Any ins.adsbygoogle on the parent document means script leaked onto the game page.
 */
export function warnAboutUnmanagedAdsenseUnits() {
    const onGamePage = [...document.querySelectorAll('ins.adsbygoogle')];
    const inFrames = [...document.querySelectorAll('iframe[data-halley-ad]')];

    if (onGamePage.length > 0) {
        const details = onGamePage.map((node) => ({
            slot: node.getAttribute('data-ad-slot') || '(no slot)',
            classes: node.className,
            parent: node.parentElement?.id || String(node.parentElement?.className || '').slice(0, 40)
        }));
        console.warn(
            '[ads] AdSense <ins> found on the game page — ads should only load inside iframes.',
            details,
            onGamePage
        );
        return;
    }

    if (inFrames.length > 0) {
        console.info(
            '[ads] Game page clean —',
            inFrames.length,
            'isolated ad iframe(s). AdSense runs only inside ad-banner.html / ad-energy.html.'
        );
    }
}
