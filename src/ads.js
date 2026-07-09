/** Google AdSense publisher ID (PWA — manual placement only; disable Auto ads in AdSense dashboard). */
export const ADSENSE_CLIENT = 'ca-pub-8602130362499092';

/** Top banner — `#ad-banner` only. See DOCS/adsense-manual-placement.md */
export const ADSENSE_BANNER_SLOT = '7906348086';

/** Energy reward — shown only when user taps Watch Ad on out-of-energy modal. */
export const ADSENSE_ENERGY_SLOT = '1178086965';

/** Minimum view time before granting energy reward (real AdSense unit). */
export const ADSENSE_ENERGY_VIEW_MS = 15000;

/** Fictional cat-product ads — emoji mini “product shots”, no real sponsors. */
const ADS = [
    {
        id: 'captain-claw-tuna-tubes',
        label: 'Emergency rations',
        badge: '9 OUT OF 9 LIVES',
        headline: "Captain Claw's Tuna Tubes",
        tagline: "For cats who haven't eaten since almost eight minutes ago.",
        emoji: ['🐱', '🥫', '🐟'],
        gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 55%, #c2410c 100%)'
    },
    {
        id: 'halley-os-star-kibble',
        label: 'Comet fuel',
        badge: 'COSMICALLY CRUNCHY',
        headline: "Halley-O's Star Kibble",
        tagline: 'Now with 30% more mysterious glowing crumbs.',
        emoji: ['☄️', '🥣', '✨'],
        gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 55%, #4c1d95 100%)'
    },
    {
        id: 'toebean-pro-gloves',
        label: 'Casting technology',
        badge: 'NO THUMBS NEEDED',
        headline: 'ToeBean Pro Casting Gloves',
        tagline: 'Grip the rod. Miss the fish. Blame the gloves.',
        emoji: ['🧤', '🐾', '🎣'],
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 55%, #1e3a8a 100%)'
    },
    {
        id: 'reeliner-9000',
        label: 'Dock furniture',
        badge: 'NAP TESTED',
        headline: 'The Reeliner 9000',
        tagline: 'Reclines before you do. Includes one completely useless cupholder.',
        emoji: ['🪑', '😴', '🥤'],
        gradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #15803d 100%)'
    },
    {
        id: 'salm-on-sunscreen',
        label: 'Sensitive nose care',
        badge: 'SPF 9 LIVES',
        headline: 'Salm-On Sunscreen',
        tagline: 'Protects pink noses. Attracts suspicious seagulls.',
        emoji: ['🧴', '☀️', '🐟'],
        gradient: 'linear-gradient(135deg, #fda4af 0%, #fb7185 55%, #e11d48 100%)'
    },
    {
        id: 'nine-lives-braid',
        label: 'Premium fishing line',
        badge: 'CLAWPROOF-ISH',
        headline: 'Nine Lives Braided Line',
        tagline: 'Strong enough for a marlin. Apparently not strong enough for curtains.',
        emoji: ['🧶', '💪', '🐈'],
        gradient: 'linear-gradient(135deg, #facc15 0%, #f59e0b 55%, #b45309 100%)'
    },
    {
        id: 'purr-polish-hull-wax',
        label: 'Boat maintenance',
        badge: 'LICK-SAFE SHINE',
        headline: 'Purr & Polish Hull Wax',
        tagline: 'So shiny, Halley spent twenty minutes arguing with his reflection.',
        emoji: ['⛵', '✨', '🐱'],
        gradient: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 55%, #0891b2 100%)'
    },
    {
        id: 'autopaw-bait-drone',
        label: 'Advanced laziness',
        badge: 'TOTALLY NECESSARY',
        headline: 'The AutoPaw Bait Drone',
        tagline: 'Because walking six feet down the dock is for dogs.',
        emoji: ['🚁', '🎣', '🐕'],
        gradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 55%, #7c3aed 100%)'
    },
    {
        id: 'kibblevault-ice-chest',
        label: 'Cooler security',
        badge: 'GUARDS THE SNACKS',
        headline: 'KibbleVault Ice Chest',
        tagline: 'Keeps bait cold and sandwiches under constant surveillance.',
        emoji: ['🧊', '🔒', '🥪'],
        gradient: 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 55%, #2563eb 100%)'
    },
    {
        id: 'bass-blinding-fish-oil',
        label: 'Coat enhancement',
        badge: 'SHED RESPONSIBLY',
        headline: 'Bass-Blinding Fish Oil',
        tagline: 'A coat so glossy, nearby fish must wear tiny sunglasses.',
        emoji: ['💧', '🕶️', '🐟'],
        gradient: 'linear-gradient(135deg, #86efac 0%, #4ade80 55%, #16a34a 100%)'
    },
    {
        id: 'mousetail-bobbers',
        label: 'Questionable tackle',
        badge: 'SQUEAKS ON IMPACT',
        headline: 'MouseTail Bobbers',
        tagline: 'Half fishing gear. Half emotional crisis.',
        emoji: ['🐭', '🎈', '😿'],
        gradient: 'linear-gradient(135deg, #fcd34d 0%, #fbbf24 55%, #d97706 100%)'
    },
    {
        id: 'starpurr-glow-serum',
        label: 'Dockside beauty',
        badge: 'UNNATURALLY RADIANT',
        headline: 'StarPurr Glow Serum',
        tagline: 'Glow like a legend. Shed like an ordinary cat.',
        emoji: ['⭐', '✨', '🐱'],
        gradient: 'linear-gradient(135deg, #818cf8 0%, #6366f1 55%, #312e81 100%)'
    },
    {
        id: 'catnip-chum-deluxe',
        label: 'Definitely fishing bait',
        badge: 'DO NOT LICK',
        headline: 'Catnip Chum Deluxe',
        tagline: 'Brings fish to the boat and Halley to another dimension.',
        emoji: ['🪣', '🌿', '😵‍💫'],
        gradient: 'linear-gradient(135deg, #a3e635 0%, #65a30d 55%, #365314 100%)'
    },
    {
        id: 'hairball-bucket-hat',
        label: 'Dock couture',
        badge: 'FASHION EMERGENCY',
        headline: 'The Hairball Bucket Hat',
        tagline: 'Looks ridiculous. Blocks the sun. Collects loose fur.',
        emoji: ['👒', '🧶', '☀️'],
        gradient: 'linear-gradient(135deg, #f9a8d4 0%, #ec4899 55%, #9d174d 100%)'
    }
];

const ROTATION_MS = 8000;
const DEFAULT_ADS_ENABLED = true;
const BANNER_MOUNT_DELAY_MS = 320;
const MAX_BANNER_MOUNT_ATTEMPTS = 80;

let currentIndex = 0;
let rotationTimer = null;
let bannerContentMounted = false;
let bannerMountInFlight = false;
let bannerMountAttempts = 0;

function isBannerReady(banner) {
    if (!banner || banner.classList.contains('hidden')) {
        return false;
    }

    const gameContainer = document.getElementById('game-container');
    if (gameContainer?.classList.contains('pre-entry')) {
        return false;
    }

    const loading = document.getElementById('loading');
    if (loading && !loading.classList.contains('hidden')) {
        return false;
    }

    return true;
}

function resolveBannerAdWidth(banner, bannerContent) {
    const measured = Math.max(
        banner?.getBoundingClientRect?.().width ?? 0,
        bannerContent?.getBoundingClientRect?.().width ?? 0,
        document.documentElement?.clientWidth ?? 0,
        window.innerWidth ?? 0
    );

    return Math.min(728, Math.max(320, Math.floor(measured) || 320));
}

function mountFictionalAdRotator(bannerContent) {
    if (ADS.length === 0) {
        bannerContent.appendChild(createPlaceholder());
        return;
    }

    const rotator = document.createElement('div');
    rotator.className = 'ad-rotator';
    bannerContent.appendChild(rotator);

    currentIndex = 0;
    renderAd(rotator, ADS[currentIndex]);
    startRotation(rotator);

    rotator.addEventListener('mouseenter', () => stopRotation());
    rotator.addEventListener('mouseleave', () => startRotation(rotator));
    rotator.setAttribute('tabindex', '0');
}

function mountBannerContent() {
    if (bannerContentMounted) {
        return;
    }

    const banner = document.getElementById('ad-banner');
    const bannerContent = banner?.querySelector('.ad-banner-content');

    if (!banner || !bannerContent) {
        return;
    }

    if (!isBannerReady(banner)) {
        if (bannerMountAttempts < MAX_BANNER_MOUNT_ATTEMPTS) {
            bannerMountAttempts += 1;
            requestAnimationFrame(mountBannerContent);
        } else {
            mountBannerContentForced(banner, bannerContent, 320);
        }
        return;
    }

    const adWidth = resolveBannerAdWidth(banner, bannerContent);
    if (adWidth <= 0) {
        if (bannerMountAttempts < MAX_BANNER_MOUNT_ATTEMPTS) {
            bannerMountAttempts += 1;
            requestAnimationFrame(mountBannerContent);
        } else {
            mountBannerContentForced(banner, bannerContent, 320);
        }
        return;
    }

    bannerMountAttempts = 0;
    mountBannerContentWithWidth(bannerContent, adWidth);
}

function mountBannerContentForced(banner, bannerContent, adWidth) {
    if (bannerContentMounted) {
        return;
    }
    bannerMountAttempts = 0;
    mountBannerContentWithWidth(bannerContent, adWidth);
}

async function mountBannerContentWithWidth(bannerContent, adWidth) {
    if (bannerContentMounted || bannerMountInFlight || !bannerContent) {
        return;
    }

    bannerMountInFlight = true;

    try {
        bannerContent.innerHTML = '';
        stopRotation();

        const adsEnabled = getAdsEnabled();

        if (!adsEnabled) {
            bannerContent.appendChild(createPlaceholder());
            bannerContentMounted = true;
            return;
        }

        if (hasConfiguredBannerAd() && await mountAdsenseUnit(bannerContent, ADSENSE_BANNER_SLOT, {
            width: adWidth,
            height: 50,
            fullWidthResponsive: false,
            managedLabel: 'banner'
        })) {
            bannerContentMounted = true;
            return;
        }

        mountFictionalAdRotator(bannerContent);
        bannerContentMounted = true;
    } finally {
        bannerMountInFlight = false;
    }
}

export function hasConfiguredBannerAd() {
    return Boolean(ADSENSE_CLIENT && ADSENSE_BANNER_SLOT);
}

export function hasConfiguredEnergyAd() {
    return Boolean(ADSENSE_CLIENT && ADSENSE_ENERGY_SLOT);
}

/** Slot IDs we intentionally mount — used to spot orphan injections. */
export const MANAGED_ADSENSE_SLOT_IDS = new Set([
    ADSENSE_BANNER_SLOT,
    ADSENSE_ENERGY_SLOT
]);

export function isManagedAdsenseUnit(node) {
    if (!node || typeof node.getAttribute !== 'function') {
        return false;
    }
    const slot = node.getAttribute('data-ad-slot');
    if (slot && MANAGED_ADSENSE_SLOT_IDS.has(slot)) {
        return true;
    }
    if (node.closest?.('#ad-banner, #adsense-energy-host')) {
        return true;
    }
    return node.getAttribute('data-halley-managed') === 'true';
}

function getAdsEnabled() {
    if (typeof window !== 'undefined' && typeof window.__KITTY_CREEK_ADS_ENABLED__ === 'boolean') {
        return window.__KITTY_CREEK_ADS_ENABLED__;
    }
    return DEFAULT_ADS_ENABLED;
}

let adsenseScriptPromise = null;
let pageLevelAdsDisabled = false;

/**
 * Prevent page-level / Auto-style injection (orphan ins on body with no data-ad-slot).
 * Must be the first adsbygoogle.push() on the page.
 */
function disablePageLevelAds() {
    if (pageLevelAdsDisabled || !ADSENSE_CLIENT) {
        return;
    }
    pageLevelAdsDisabled = true;
    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({
            google_ad_client: ADSENSE_CLIENT,
            enable_page_level_ads: false
        });
    } catch (err) {
        console.warn('[ads] Failed to disable page-level AdSense:', err);
    }
}

/** Load adsbygoogle.js only when we mount a manual unit (not on loading/login screens). */
export function ensureAdsenseScriptLoaded() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.resolve();
    }
    if (window.adsbygoogle) {
        disablePageLevelAds();
        return Promise.resolve();
    }
    if (adsenseScriptPromise) {
        return adsenseScriptPromise;
    }

    adsenseScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = true;
        // No ?client= on the script URL — publisher id lives on each <ins> only (manual units).
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            disablePageLevelAds();
            resolve();
        };
        script.onerror = () => {
            adsenseScriptPromise = null;
            reject(new Error('AdSense script failed to load'));
        };
        document.head.appendChild(script);
    });

    return adsenseScriptPromise;
}

/**
 * Mount one manual AdSense unit inside a container we own (never page-wide Auto ads).
 * @param {HTMLElement} container
 * @param {string} slotId
 * @param {{ format?: string, fullWidthResponsive?: boolean, width?: number, height?: number, managedLabel?: string }} [options]
 * @returns {Promise<boolean>}
 */
export async function mountAdsenseUnit(container, slotId, options = {}) {
    if (!ADSENSE_CLIENT || !slotId || !container) {
        return false;
    }

    const {
        format = 'auto',
        fullWidthResponsive = true,
        width = null,
        height = null,
        managedLabel = 'unit'
    } = options;

    container.innerHTML = '';
    container.style.width = '100%';
    if (height) {
        container.style.minHeight = `${height}px`;
    }

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-halley-managed', 'true');
    ins.setAttribute('data-halley-ad', managedLabel);

    if (width && height) {
        ins.style.display = 'inline-block';
        ins.style.width = `${width}px`;
        ins.style.height = `${height}px`;
        if (format && format !== 'auto') {
            ins.setAttribute('data-ad-format', format);
        }
    } else {
        ins.style.display = 'block';
        ins.style.width = '100%';
        ins.style.minWidth = '320px';
        ins.style.minHeight = `${height || 50}px`;
        ins.setAttribute('data-ad-format', format);
        if (fullWidthResponsive) {
            ins.setAttribute('data-full-width-responsive', 'true');
        }
    }

    container.appendChild(ins);
    void ins.offsetWidth;

    if (!ins.isConnected) {
        return false;
    }

    try {
        await ensureAdsenseScriptLoaded();
        if (!ins.isConnected) {
            return false;
        }
        // One push per <ins> — extra push() calls inject orphan units elsewhere on the page.
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
        console.warn('[ads] AdSense push failed:', err);
        return false;
    }

    return true;
}

function normalizeEmojiList(ad) {
    if (Array.isArray(ad.emoji)) {
        return ad.emoji;
    }
    if (ad.emoji) {
        return [ad.emoji];
    }
    return ['🐱'];
}

function buildEmojiStack(emojis) {
    const slots = ['ad-emoji-main', 'ad-emoji-float-a', 'ad-emoji-float-b'];
    return emojis
        .slice(0, 3)
        .map((char, index) => `<span class="ad-emoji ${slots[index] || 'ad-emoji-float-b'}">${char}</span>`)
        .join('');
}

function createPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'ad-placeholder';
    placeholder.innerHTML = '<span>🐱 Kitty Creek sponsors 🎣</span>';
    return placeholder;
}

function createAdElement(ad) {
    const wrapper = document.createElement('a');
    wrapper.className = 'ad-card';
    wrapper.href = '#';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('aria-label', `${ad.headline}. ${ad.tagline || ''}`);
    wrapper.style.background = ad.gradient;

    const badge = ad.badge
        ? `<span class="ad-badge">${ad.badge}</span>`
        : '';

    wrapper.innerHTML = `
        ${badge}
        <div class="ad-icon-stack" aria-hidden="true">${buildEmojiStack(normalizeEmojiList(ad))}</div>
        <div class="ad-copy">
            <span class="ad-label">${ad.label}</span>
            <span class="ad-headline">${ad.headline}</span>
            ${ad.tagline ? `<span class="ad-tagline">${ad.tagline}</span>` : ''}
        </div>
    `;

    wrapper.addEventListener('click', (event) => {
        event.preventDefault();
    });

    return wrapper;
}

function renderAd(container, ad) {
    container.innerHTML = '';
    container.appendChild(createAdElement(ad));
}

function nextAd(container) {
    currentIndex = (currentIndex + 1) % ADS.length;
    renderAd(container, ADS[currentIndex]);
}

function startRotation(container) {
    stopRotation();
    rotationTimer = window.setInterval(() => {
        nextAd(container);
    }, ROTATION_MS);
}

function stopRotation() {
    if (rotationTimer) {
        clearInterval(rotationTimer);
        rotationTimer = null;
    }
}

export function initAdRotator() {
    // Banner mounts in showAdBanner() once #ad-banner is visible (AdSense needs width > 0).
}

export function showAdBanner() {
    const banner = document.getElementById('ad-banner');
    if (!banner) {
        return;
    }

    banner.classList.remove('hidden');
    bannerMountAttempts = 0;

    // Wait for loading overlay to hide and layout to settle before AdSense measures the slot.
    window.setTimeout(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(mountBannerContent);
        });
    }, BANNER_MOUNT_DELAY_MS);
}
