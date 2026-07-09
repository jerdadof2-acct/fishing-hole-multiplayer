import { removeLoadingOverlay } from './loadingProgress.js';
import {
    ADSENSE_BANNER_SLOT,
    ADSENSE_ENERGY_SLOT,
    isManagedAdsenseUnit
} from './ads.js';

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

function describeAdsenseUnit(node) {
    const slot = node.getAttribute('data-ad-slot') || '(no slot id)';
    const parent = node.parentElement;
    const ancestry = [];
    let current = parent;
    while (current && ancestry.length < 4) {
        const label = current.id
            ? `#${current.id}`
            : current.className
                ? `.${String(current.className).split(/\s+/).slice(0, 2).join('.')}`
                : current.tagName?.toLowerCase();
        ancestry.push(label);
        current = current.parentElement;
    }

    return {
        slot,
        halleyAd: node.getAttribute('data-halley-ad') || null,
        status: node.getAttribute('data-adsbygoogle-status') || null,
        parentChain: ancestry.join(' ← ')
    };
}

/**
 * Warn when Google injects ad units we did not mount in #ad-banner or #adsense-energy-host.
 * Also flags our slot IDs if they appear outside those containers (orphan from double push).
 */
export function warnAboutUnmanagedAdsenseUnits() {
    const all = [...document.querySelectorAll('ins.adsbygoogle')];
    const managed = all.filter((node) => isManagedAdsenseUnit(node));
    const extra = all.filter((node) => !isManagedAdsenseUnit(node));

    if (all.length === 0) {
        return;
    }

    const orphansWithOurSlots = all.filter((node) => {
        const slot = node.getAttribute('data-ad-slot');
        return (slot === ADSENSE_BANNER_SLOT || slot === ADSENSE_ENERGY_SLOT)
            && !node.closest('#ad-banner, #adsense-energy-host');
    });

    if (orphansWithOurSlots.length > 0) {
        console.warn(
            '[ads] Found our ad slot(s) outside the banner/energy containers —',
            'usually caused by calling adsbygoogle.push() more than once per <ins>.',
            orphansWithOurSlots.map(describeAdsenseUnit)
        );
    }

    if (extra.length === 0) {
        if (managed.length > 1) {
            console.info(
                '[ads] Multiple managed AdSense units on page (expected: 1 banner during play,',
                '+ 1 energy unit only while the reward overlay is open).',
                managed.map(describeAdsenseUnit)
            );
        }
        return;
    }

    console.warn(
        '[ads] Found AdSense units we did not mount:',
        extra.map(describeAdsenseUnit),
        'Slot "(no slot id)" on <body> is page-level injection — code now sends enable_page_level_ads:false.',
        'Also confirm AdSense → Ads → By site → Auto ads is OFF for every domain.',
        extra
    );
}
