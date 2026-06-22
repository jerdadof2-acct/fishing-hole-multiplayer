/** Fictional cat-product ads — emoji mini “product shots”, no real sponsors. */
const ADS = [
    {
        id: 'whiskerlux-tuna',
        label: 'Sponsored purr',
        badge: 'MEOW APPROVED',
        headline: 'WhiskerLuxe Tuna Treats',
        tagline: 'So good he forgot he caught the fish.',
        emoji: ['😺', '🐟', '😋'],
        gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 55%, #c2410c 100%)'
    },
    {
        id: 'comet-crunch',
        label: 'Halley eats this',
        badge: 'COSMIC CRUNCH',
        headline: 'Comet Crunch Kibble',
        tagline: 'Born under a streak. Crunchy as destiny.',
        emoji: ['☄️', '🐱', '✨'],
        gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 55%, #4c1d95 100%)'
    },
    {
        id: 'pawgrip-gloves',
        label: 'Toe beans edition',
        badge: 'GRIP GUARANTEED*',
        headline: 'PawGrip Casting Gloves',
        tagline: '*Guarantee valid for cats only.',
        emoji: ['🧤', '🐾', '🎣'],
        gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 55%, #1e3a8a 100%)'
    },
    {
        id: 'catnap-chair',
        label: 'Dock luxury',
        badge: 'ZZZ RATED',
        headline: 'CatNap Recliner 9000',
        tagline: 'Warmer than sunbeam. Louder purr motor.',
        emoji: ['🪑', '😴', '🔥'],
        gradient: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #15803d 100%)'
    },
    {
        id: 'salmon-snooze-spf',
        label: 'Pink nose science',
        badge: 'SPF: Salmon',
        headline: 'Salmon Snooze SPF',
        tagline: 'Smells fishy. Works purrfectly.',
        emoji: ['🧴', '👃', '🐟'],
        gradient: 'linear-gradient(135deg, #fda4af 0%, #fb7185 55%, #e11d48 100%)'
    },
    {
        id: 'clawguard-line',
        label: 'Nine lives strong',
        badge: 'CLAW TESTED',
        headline: 'ClawGuard Braid',
        tagline: 'Survived one angry tabby. Twice.',
        emoji: ['🧶', '🐈‍⬛', '💪'],
        gradient: 'linear-gradient(135deg, #facc15 0%, #f59e0b 55%, #b45309 100%)'
    },
    {
        id: 'meowtorboat-polish',
        label: 'Boat glam',
        badge: 'SHINY HULL',
        headline: 'Meowtorboat Polish',
        tagline: 'The Shooting Star deserves sparkle.',
        emoji: ['⛵', '✨', '🐱'],
        gradient: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 55%, #0891b2 100%)'
    },
    {
        id: 'whiskercast-drone',
        label: 'Overkill cast',
        badge: 'AS SEEN ON DOCK',
        headline: 'WhiskerCast Drone',
        tagline: 'Delivers bait. Judges your form.',
        emoji: ['🚁', '🎣', '😼'],
        gradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 55%, #7c3aed 100%)'
    },
    {
        id: 'kibble-kong-cooler',
        label: 'Chill zone',
        badge: 'COLD SNACKS',
        headline: 'Kibble Kong Cooler',
        tagline: 'Bait on ice. Treats on top.',
        emoji: ['🧊', '🍱', '😸'],
        gradient: 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 55%, #2563eb 100%)'
    },
    {
        id: 'purrolane-oil',
        label: 'Salon dock',
        badge: 'SHINY COAT',
        headline: 'Purrrolane Fish Oil',
        tagline: 'Glossy enough to blind a bass.',
        emoji: ['💧', '🐟', '💅'],
        gradient: 'linear-gradient(135deg, #86efac 0%, #4ade80 55%, #16a34a 100%)'
    },
    {
        id: 'mouse-bobber-set',
        label: 'Beginner bait',
        badge: 'SQUEAK!',
        headline: 'Mouse-Tail Bobbers',
        tagline: 'Fish bite. Cat stares. Everyone wins?',
        emoji: ['🐭', '🎈', '🐱'],
        gradient: 'linear-gradient(135deg, #fcd34d 0%, #fbbf24 55%, #d97706 100%)'
    },
    {
        id: 'starfish-serum',
        label: 'Legend juice',
        badge: 'GLOW UP',
        headline: 'Starfish Glow Serum',
        tagline: 'Illegal in 0 lakes. Looks amazing.',
        emoji: ['⭐', '🌟', '🐱'],
        gradient: 'linear-gradient(135deg, #818cf8 0%, #6366f1 55%, #312e81 100%)'
    },
    {
        id: 'catnip-chum',
        label: 'Questionable',
        badge: 'USE RESPONSIBLY',
        headline: 'Catnip Chum Bucket',
        tagline: 'Fish love it. You might too.',
        emoji: ['🪣', '🌿', '😵‍💫'],
        gradient: 'linear-gradient(135deg, #a3e635 0%, #65a30d 55%, #365314 100%)'
    },
    {
        id: 'hairball-hat',
        label: 'Fashion dock',
        badge: 'TRENDING',
        headline: 'Hairball Bucket Hat',
        tagline: 'Sun protection. Questionable style.',
        emoji: ['👒', '🐱', '💀'],
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

    banner.classList.remove('hidden');
    bannerContent.innerHTML = '';
    stopRotation();

    const adsEnabled = getAdsEnabled() && ADS.length > 0;

    if (!adsEnabled) {
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
