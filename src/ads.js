const ADS = [
    {
        id: 'aqua-sense',
        badge: 'New Release',
        headline: 'AquaSense Hydration Tracker Bottle',
        subheadline: 'Smart bottle that syncs with Kitty Creek to keep your angler hydrated all day.',
        cta: 'Preorder for $39',
        emoji: '💧',
        url: 'https://example.com/kit-cc/aquasense',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 55%, #1e3a8a 100%)'
    },
    {
        id: 'whisker-wave',
        badge: 'Just Dropped',
        headline: 'WhiskerWave Casting Drone',
        subheadline: 'Drone-assisted precision casting. Perfect for trophy hunters chasing legendary fish.',
        cta: 'See it in action',
        emoji: '🚁',
        url: 'https://example.com/kit-cc/whiskerwave',
        gradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 55%, #7c3aed 100%)'
    },
    {
        id: 'luminous-line',
        badge: 'Limited Run',
        headline: 'Luminous Line Pro Kit',
        subheadline: 'Night-glow braided line with adaptive tension sensors for late-night expeditions.',
        cta: 'Grab the bundle',
        emoji: '🌙',
        url: 'https://example.com/kit-cc/luminousline',
        gradient: 'linear-gradient(135deg, #facc15 0%, #f59e0b 55%, #b45309 100%)'
    },
    {
        id: 'catnap-chair',
        badge: 'Comfort Pick',
        headline: 'CatNap Ergonomic Dock Chair',
        subheadline: 'Foldable chair with lumbar support, insulated mug holder, and purring massage mode.',
        cta: 'Upgrade your dock',
        emoji: '🪑',
        url: 'https://example.com/kit-cc/catnap',
        gradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #15803d 100%)'
    },
    {
        id: 'tidal-tunes',
        badge: 'Staff Favorite',
        headline: 'Tidal Tunes Waterproof Speaker',
        subheadline: 'Immersive 360° audio with adaptive wave-sync lighting for your fishing sessions.',
        cta: 'Listen now',
        emoji: '🔊',
        url: 'https://example.com/kit-cc/tidaltunes',
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 55%, #312e81 100%)'
    },
    {
        id: 'bait-bistro',
        badge: 'Seasonal',
        headline: 'Bait Bistro Craft Snack Box',
        subheadline: 'Chef-crafted trail mix for anglers. Sweet, savory, and bait-safe—cat approved!',
        cta: 'Subscribe & save',
        emoji: '🍱',
        url: 'https://example.com/kit-cc/baitbistro',
        gradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 55%, #be123c 100%)'
    }
];

const ROTATION_MS = 8000;

let currentIndex = 0;
let rotationTimer = null;

function createAdElement(ad) {
    const wrapper = document.createElement('a');
    wrapper.className = 'ad-card';
    wrapper.href = ad.url;
    wrapper.target = '_blank';
    wrapper.rel = 'noopener noreferrer';
    wrapper.style.background = ad.gradient;

    wrapper.innerHTML = `
        <span class="ad-accent"></span>
        <div class="ad-copy">
            <span class="ad-badge">${ad.badge}</span>
            <span class="ad-headline">${ad.headline}</span>
            <span class="ad-subheadline">${ad.subheadline}</span>
            <span class="ad-cta">Learn more →</span>
        </div>
        <div class="ad-artwork" aria-hidden="true">${ad.emoji}</div>
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

    if (!banner || !bannerContent || ADS.length === 0) {
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

