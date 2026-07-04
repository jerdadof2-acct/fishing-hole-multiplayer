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
 * AdSense Auto ads (anchor/vignette) inject extra units outside #ad-banner on mobile.
 * Hiding them in CSS violates policy — disable Auto ads in the AdSense dashboard.
 */
export function warnAboutUnmanagedAdsenseUnits() {
    const managed = new Set(
        [
            ...document.querySelectorAll('#ad-banner ins.adsbygoogle, #adsense-energy-host ins.adsbygoogle')
        ].map((node) => node)
    );
    const all = [...document.querySelectorAll('ins.adsbygoogle')];
    const extra = all.filter((node) => !managed.has(node));
    if (extra.length > 0) {
        console.warn(
            '[ads] Found AdSense units outside the game banner/energy slots.',
            'Disable Auto ads (anchor/vignette) for this site in AdSense — they cover gameplay on phones.',
            extra
        );
    }
}
