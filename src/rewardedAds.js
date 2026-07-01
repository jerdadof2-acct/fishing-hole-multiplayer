/**
 * Rewarded ads — energy boost (+20) when out of energy.
 * Uses manual AdSense unit when ADSENSE_ENERGY_SLOT is set; otherwise mock overlay.
 */

import {
    mountAdsenseUnit,
    ADSENSE_ENERGY_SLOT,
    ADSENSE_ENERGY_VIEW_MS,
    hasConfiguredEnergyAd
} from './ads.js';

const MOCK_REWARDED_AD_DURATION_MS = 5200;

const ENERGY_ADS = [
    {
        badge: 'NOT A REAL AD',
        label: 'Emergency casting fuel',
        headline: "Halley's Energy Shot™",
        tagline: 'One sip = 20 energy. Two sips = your vet calls Halley.',
        emoji: ['⚡', '🐱', '🥤'],
        gradient: 'linear-gradient(145deg, #facc15 0%, #f59e0b 45%, #b45309 100%)',
        finePrint: 'Do not operate heavy fishing rods while napping.'
    },
    {
        badge: 'SPONSORED BY DENIAL',
        label: 'River recovery',
        headline: 'Anaconda-Grade Adrenaline',
        tagline: 'Side effects may include staring at the water and whispering "that is NOT a fish."',
        emoji: ['🐍', '💦', '😳'],
        gradient: 'linear-gradient(145deg, #4ade80 0%, #16a34a 45%, #14532d 100%)',
        finePrint: 'Not approved by docks, fish, or responsible adults.'
    },
    {
        badge: 'CAT SCIENCE',
        label: 'Metabolic nonsense',
        headline: "Halley's Fish Oil Chews",
        tagline: 'Replaces sleep with confidence. Does not replace sleep.',
        emoji: ['🐟', '💊', '😺'],
        gradient: 'linear-gradient(145deg, #38bdf8 0%, #0ea5e9 50%, #1e3a8a 100%)',
        finePrint: 'FDA stands for "Felines Demand Attention."'
    },
    {
        badge: 'LIMITED TIME*',
        label: '*forever',
        headline: 'ToeBean Turbo Treats',
        tagline: 'Lick once for energy. Lick twice and the tackle box is yours now.',
        emoji: ['🐾', '🍪', '⚡'],
        gradient: 'linear-gradient(145deg, #f9a8d4 0%, #ec4899 50%, #9d174d 100%)',
        finePrint: '*Halley already ate the limited time.'
    },
    {
        badge: 'DOCK APPROVED',
        label: 'Questionable hydration',
        headline: 'Catfish Coffee — Extra Bold',
        tagline: "You'll cast faster. You'll also hear colors.",
        emoji: ['☕', '🎣', '👁️'],
        gradient: 'linear-gradient(145deg, #a8a29e 0%, #57534e 50%, #292524 100%)',
        finePrint: 'Milk optional. Regrets included.'
    },
    {
        badge: 'SOLAR POWERED',
        label: 'Renewable laziness',
        headline: 'Tail-Mounted Solar Panel',
        tagline: 'Charges while you sunbathe. Useless at night. Perfect for Halley.',
        emoji: ['☀️', '🐈', '🔋'],
        gradient: 'linear-gradient(145deg, #fde047 0%, #eab308 50%, #ca8a04 100%)',
        finePrint: 'Cloudy days sold separately.'
    }
];

const DOUBLE_COINS_ADS = [
    {
        badge: 'COIN MULTIPLIER',
        headline: 'Captain Claw\'s Treasure Map',
        tagline: 'X marks the spot. Halley marks the couch.',
        emoji: ['🗺️', '💰', '🐱'],
        gradient: 'linear-gradient(145deg, #fbbf24 0%, #d97706 100%)',
        finePrint: 'Map may lead to litter box.'
    },
    {
        badge: 'DOUBLE YOUR CATCH*',
        headline: 'Golden Lure Polish',
        tagline: '*Doubles coins, not talent.',
        emoji: ['✨', '🪙', '🐟'],
        gradient: 'linear-gradient(145deg, #fde68a 0%, #f59e0b 100%)',
        finePrint: 'Fish not impressed.'
    }
];

const REWARD_LABELS = {
    energy: '+20 Energy',
    double_coins: 'Double Coins'
};

function pickAd(rewardType) {
    const pool = rewardType === 'energy' ? ENERGY_ADS : DOUBLE_COINS_ADS;
    return pool[Math.floor(Math.random() * pool.length)];
}

function buildEmojiStack(emojis = ['📺']) {
    const slots = ['rewarded-ad-emoji-main', 'rewarded-ad-emoji-a', 'rewarded-ad-emoji-b'];
    return emojis
        .slice(0, 3)
        .map((char, index) => `<span class="rewarded-ad-emoji ${slots[index] || 'rewarded-ad-emoji-b'}">${char}</span>`)
        .join('');
}

function removeOverlay(overlay) {
    if (!overlay?.parentNode) return;
    overlay.classList.add('rewarded-ad-overlay--out');
    window.setTimeout(() => overlay.remove(), 280);
}

function runRewardTimer(overlay, durationMs, onComplete) {
    const progressBar = overlay.querySelector('[data-progress]');
    const timerEl = overlay.querySelector('[data-timer]');
    const skipEl = overlay.querySelector('[data-skip]');
    const startedAt = performance.now();

    const tick = () => {
        const elapsed = performance.now() - startedAt;
        const t = Math.min(1, elapsed / durationMs);
        if (progressBar) {
            progressBar.style.width = `${t * 100}%`;
        }
        const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
        if (timerEl) {
            timerEl.textContent = `${remaining}s`;
        }
        if (skipEl && remaining > 0) {
            skipEl.textContent = `Reward in ${remaining}s…`;
        }
        if (t < 1) {
            requestAnimationFrame(tick);
        } else if (skipEl) {
            skipEl.textContent = 'Thanks for watching! 🐱';
        }
    };
    requestAnimationFrame(tick);

    window.setTimeout(() => {
        removeOverlay(overlay);
        onComplete();
    }, durationMs);
}

/**
 * Full-screen manual AdSense unit — only when user opts in via energy modal.
 */
function showAdsenseEnergyReward() {
    return new Promise((resolve, reject) => {
        const durationMs = ADSENSE_ENERGY_VIEW_MS;
        const durationSec = Math.ceil(durationMs / 1000);

        const overlay = document.createElement('div');
        overlay.className = 'rewarded-ad-overlay rewarded-ad-overlay--adsense';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Sponsored message');
        overlay.innerHTML = `
            <div class="rewarded-ad-frame rewarded-ad-frame--adsense">
                <div class="rewarded-ad-top">
                    <span class="rewarded-ad-reward-tag">Reward: +20 Energy</span>
                    <span class="rewarded-ad-timer" data-timer>${durationSec}s</span>
                </div>
                <div class="adsense-energy-host" id="adsense-energy-host"></div>
                <div class="rewarded-ad-progress-track">
                    <div class="rewarded-ad-progress-bar" data-progress></div>
                </div>
                <p class="rewarded-ad-skip" data-skip>Reward in ${durationSec}s…</p>
            </div>
        `;

        document.body.appendChild(overlay);

        const host = overlay.querySelector('#adsense-energy-host');
        const mounted = mountAdsenseUnit(host, ADSENSE_ENERGY_SLOT, {
            format: 'auto',
            fullWidthResponsive: true
        });

        if (!mounted) {
            removeOverlay(overlay);
            reject(new Error('AdSense energy unit failed to mount'));
            return;
        }

        runRewardTimer(overlay, durationMs, () => {
            resolve({ success: true, type: 'energy' });
        });
    });
}

function showMockRewardedAd(rewardType) {
    return new Promise((resolve) => {
        const ad = pickAd(rewardType);
        const rewardLabel = REWARD_LABELS[rewardType] || 'Reward';
        const durationMs = MOCK_REWARDED_AD_DURATION_MS;
        const durationSec = Math.ceil(durationMs / 1000);

        const overlay = document.createElement('div');
        overlay.className = 'rewarded-ad-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Rewarded advertisement');
        overlay.innerHTML = `
            <div class="rewarded-ad-frame">
                <div class="rewarded-ad-top">
                    <span class="rewarded-ad-reward-tag">Reward: ${rewardLabel}</span>
                    <span class="rewarded-ad-timer" data-timer>${durationSec}s</span>
                </div>
                <div class="rewarded-ad-screen" style="background: ${ad.gradient}">
                    <span class="rewarded-ad-badge">${ad.badge}</span>
                    <div class="rewarded-ad-emoji-stack" aria-hidden="true">${buildEmojiStack(ad.emoji)}</div>
                    ${ad.label ? `<span class="rewarded-ad-label">${ad.label}</span>` : ''}
                    <h2 class="rewarded-ad-headline">${ad.headline}</h2>
                    <p class="rewarded-ad-tagline">${ad.tagline}</p>
                    <p class="rewarded-ad-fine-print">${ad.finePrint || 'This is a joke ad. Halley insists.'}</p>
                </div>
                <div class="rewarded-ad-progress-track">
                    <div class="rewarded-ad-progress-bar" data-progress></div>
                </div>
                <p class="rewarded-ad-skip" data-skip>Skip in ${durationSec}s… (Halley says watch it)</p>
                <p class="rewarded-ad-disclaimer">Placeholder ad — real sponsors coming later. Halley needed a laugh.</p>
            </div>
        `;

        document.body.appendChild(overlay);

        runRewardTimer(overlay, durationMs, () => {
            resolve({ success: true, type: rewardType });
        });
    });
}

/**
 * @param {'energy'|'double_coins'} rewardType
 * @returns {Promise<{ success: boolean, type: string }>}
 */
export function showRewardedAd(rewardType) {
    if (rewardType === 'energy' && hasConfiguredEnergyAd()) {
        return showAdsenseEnergyReward();
    }
    return showMockRewardedAd(rewardType);
}
