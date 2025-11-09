const ADS = [
    {
        id: 'aqua-sense',
        label: 'New gear',
        headline: 'AquaSense smart bottle',
        tagline: 'Hydration reminders for long fishing days.',
        emoji: '💧',
        url: 'https://example.com/kit-cc/aquasense',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 55%, #1e3a8a 100%)'
    },
    {
        id: 'whisker-wave',
        label: 'Pro tip',
        headline: 'WhiskerWave casting drone',
        tagline: 'Drop baits perfectly every time.',
        emoji: '🚁',
        url: 'https://example.com/kit-cc/whiskerwave',
        gradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 55%, #7c3aed 100%)'
    },
    {
        id: 'luminous-line',
        label: 'Night kit',
        headline: 'Luminous Line pro spool',
        tagline: 'Glow braid with tension alerts.',
        emoji: '🌙',
        url: 'https://example.com/kit-cc/luminousline',
        gradient: 'linear-gradient(135deg, #facc15 0%, #f59e0b 55%, #b45309 100%)'
    },
    {
        id: 'catnap-chair',
        label: 'Comfort pick',
        headline: 'CatNap dock chair',
        tagline: 'Built-in warmer and purr massage.',
        emoji: '🪑',
        url: 'https://example.com/kit-cc/catnap',
        gradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #15803d 100%)'
    },
    {
        id: 'tidal-tunes',
        label: 'Boat vibes',
        headline: 'Tidal Tunes speaker',
        tagline: '360° sound that syncs with waves.',
        emoji: '🔊',
        url: 'https://example.com/kit-cc/tidaltunes',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 55%, #312e81 100%)'
    },
    {
        id: 'bait-bistro',
        label: 'Snack box',
        headline: 'Bait Bistro trail mix',
        tagline: 'Fuel for anglers, safe for bait.',
        emoji: '🍱',
        url: 'https://example.com/kit-cc/baitbistro',
        gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 55%, #be123c 100%)'
    }
];

const ROTATION_MS = 8000;
const DEFAULT_ADS_ENABLED = true;

let currentIndex = 0;
let rotationTimer = null;

function getAdsEnabled() {
    if (typeof window !== 'undefined' && typeof window.__KITTY_CREEK_ADS_ENABLED__ === 'boolean') {
        return window.__KITTY_CREEK_ADS_ENABLED__;
    }
    return DEFAULT_ADS_ENABLED;
}

function createPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'ad-placeholder';
    placeholder.innerHTML = `
        <span>Ad space 320×50</span>
    `;
    return placeholder;
}

function createAdElement(ad) {
    const wrapper = document.createElement('a');
    wrapper.className = 'ad-card';
    wrapper.href = ad.url;
    wrapper.target = '_blank';
    wrapper.rel = 'noopener noreferrer';
    wrapper.style.background = ad.gradient;

    wrapper.innerHTML = `
        <div class="ad-icon" aria-hidden="true">${ad.emoji}</div>
        <div class="ad-copy">
            <span class="ad-label">${ad.label}</span>
            <span class="ad-headline">${ad.headline}</span>
            ${ad.tagline ? `<span class="ad-tagline">${ad.tagline}</span>` : ''}
        </div>
    `;

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
    const banner = document.getElementById('ad-banner');
    const bannerContent = banner?.querySelector('.ad-banner-content');

    if (!banner || !bannerContent) {
        return;
    }

    banner.classList.remove('hidden');
    bannerContent.innerHTML = '';
    stopRotation();

    const adsEnabled = getAdsEnabled() && ADS.length > 0;

    if (!adsEnabled) {
        bannerContent.appendChild(createPlaceholder());
        return;
    }

    banner.classList.remove('hidden');

    let rotator = bannerContent.querySelector('.ad-rotator');
    if (!rotator) {
        rotator = document.createElement('div');
        rotator.className = 'ad-rotator';
        bannerContent.innerHTML = '';
        bannerContent.appendChild(rotator);
    }

    currentIndex = 0;
    renderAd(rotator, ADS[currentIndex]);
    startRotation(rotator);

    rotator.addEventListener('mouseenter', () => stopRotation());
    rotator.addEventListener('mouseleave', () => startRotation(rotator));

    // Basic keyboard support for focus
    rotator.setAttribute('tabindex', '0');
}

