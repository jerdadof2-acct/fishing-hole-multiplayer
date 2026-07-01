/** Google AdSense publisher ID (PWA — set banner slot when AdSense provides one). */
export const ADSENSE_CLIENT = 'ca-pub-8602130362499092';
/** Create a Display ad unit in AdSense, then paste the slot ID here (e.g. '1234567890'). */
export const ADSENSE_BANNER_SLOT = '';

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

let currentIndex = 0;
let rotationTimer = null;

function getAdsEnabled() {
    if (typeof window !== 'undefined' && typeof window.__KITTY_CREEK_ADS_ENABLED__ === 'boolean') {
        return window.__KITTY_CREEK_ADS_ENABLED__;
    }
    return DEFAULT_ADS_ENABLED;
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

function mountAdsenseBanner(container) {
    if (!ADSENSE_CLIENT || !ADSENSE_BANNER_SLOT) {
        return false;
    }

    container.innerHTML = '';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
    ins.setAttribute('data-ad-slot', ADSENSE_BANNER_SLOT);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    container.appendChild(ins);

    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
        console.warn('[ads] AdSense push failed:', err);
        return false;
    }

    return true;
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
    const banner = document.getElementById('ad-banner');
    const bannerContent = banner?.querySelector('.ad-banner-content');

    if (!banner || !bannerContent) {
        return;
    }

    bannerContent.innerHTML = '';
    stopRotation();

    const adsEnabled = getAdsEnabled();

    if (!adsEnabled) {
        bannerContent.appendChild(createPlaceholder());
        return;
    }

    if (mountAdsenseBanner(bannerContent)) {
        return;
    }

    if (ADS.length === 0) {
        bannerContent.appendChild(createPlaceholder());
        return;
    }

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

    rotator.setAttribute('tabindex', '0');
}

export function showAdBanner() {
    document.getElementById('ad-banner')?.classList.remove('hidden');
}
