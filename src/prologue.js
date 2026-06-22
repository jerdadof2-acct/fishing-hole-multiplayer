import {
    PROLOGUE_BASE_SCROLL_PX_PER_SEC,
    PROLOGUE_ENTER_BUTTON_DELAY_SEC,
    PROLOGUE_ENTRANCE_IMAGE,
    PROLOGUE_GAME_VERSION,
    PROLOGUE_PHASE_FADE_MS,
    PROLOGUE_SCROLL_BACKGROUND,
    PROLOGUE_SCROLL_SPEED_MAX,
    PROLOGUE_SCROLL_SPEED_MIN,
    PROLOGUE_SCROLL_SPEED_STEP,
    PROLOGUE_SCROLL_SPEED_DEFAULT,
    PROLOGUE_SPEED_STORAGE_KEY,
    PROLOGUE_STORY_PARAGRAPHS,
    PROLOGUE_VERSION_STORAGE_KEY
} from './config/prologue.js';
import { loadingProgress } from './loadingProgress.js';

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function loadSavedScrollMultiplier() {
    try {
        const raw = localStorage.getItem(PROLOGUE_SPEED_STORAGE_KEY);
        const parsed = raw ? parseFloat(raw) : PROLOGUE_SCROLL_SPEED_DEFAULT;
        return Number.isFinite(parsed)
            ? clamp(parsed, PROLOGUE_SCROLL_SPEED_MIN, PROLOGUE_SCROLL_SPEED_MAX)
            : PROLOGUE_SCROLL_SPEED_DEFAULT;
    } catch {
        return PROLOGUE_SCROLL_SPEED_DEFAULT;
    }
}

function saveScrollMultiplier(multiplier) {
    try {
        localStorage.setItem(PROLOGUE_SPEED_STORAGE_KEY, String(multiplier));
    } catch {
        /* ignore */
    }
}

/** True when this build's prologue has not been shown yet (replay on each PROLOGUE_GAME_VERSION bump). */
export function shouldPlayStoryPrologue() {
    try {
        return localStorage.getItem(PROLOGUE_VERSION_STORAGE_KEY) !== PROLOGUE_GAME_VERSION;
    } catch {
        return true;
    }
}

export function markPrologueSeenForVersion() {
    try {
        localStorage.setItem(PROLOGUE_VERSION_STORAGE_KEY, PROLOGUE_GAME_VERSION);
    } catch {
        /* ignore */
    }
}

/** True when the player finished a prior prologue and should see splash-only on return visits. */
export function shouldShowReturnSplash() {
    try {
        const seenVersion = localStorage.getItem(PROLOGUE_VERSION_STORAGE_KEY);
        return seenVersion != null && !shouldPlayStoryPrologue();
    } catch {
        return false;
    }
}

/**
 * Full-screen cinematic prologue: scrolling story → splash art → tap anywhere to enter.
 * @param {{
 *   scrollSpeedMultiplier?: number,
 *   skipCredits?: boolean,
 *   waitForReady?: () => Promise<unknown>,
 *   onLoadProgress?: (percent: number) => void
 * }} options
 * @returns {Promise<void>}
 */
export function playStoryPrologue(options = {}) {
    const skipCredits = options.skipCredits === true;
    const overlay = document.getElementById('story-prologue');
    const creditsPhase = document.getElementById('prologue-credits-phase');
    const titlePhase = document.getElementById('prologue-title-phase');
    const creditsInner = document.getElementById('prologue-credits-inner');
    const speedLabel = document.getElementById('prologue-speed-label');
    const tapHint = document.getElementById('prologue-tap-hint');
    const loadHint = document.getElementById('prologue-load-hint');

    if (!overlay || !creditsPhase || !titlePhase || !creditsInner) {
        console.warn('[PROLOGUE] Missing DOM — skipping prologue');
        return Promise.resolve();
    }

    let scrollMultiplier = options.scrollSpeedMultiplier ?? loadSavedScrollMultiplier();
    let rafId = null;
    let enterTimer = null;
    let loadPollId = null;
    let phase = 'credits';
    let scrollY = 0;
    let lastTs = 0;
    let done = false;
    let canEnter = false;

    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }

    creditsInner.innerHTML = PROLOGUE_STORY_PARAGRAPHS
        .map((text) => `<p class="prologue-credit-line">${text}</p>`)
        .join('');

    const creditsViewport = creditsPhase.querySelector('.prologue-credits-viewport');
    if (creditsViewport) {
        creditsViewport.style.backgroundImage =
            `linear-gradient(to bottom, rgba(0, 8, 28, 0.55) 0%, rgba(0, 12, 40, 0.25) 40%, rgba(0, 8, 28, 0.45) 100%), url('${PROLOGUE_SCROLL_BACKGROUND}')`;
    }

    const titleImg = document.getElementById('prologue-title-image');
    if (titleImg) {
        titleImg.src = PROLOGUE_ENTRANCE_IMAGE;
        titleImg.alt = "Halley's Big Catch — Adventure awaits";
    }

    const slowerBtn = document.getElementById('prologue-slower');
    const fasterBtn = document.getElementById('prologue-faster');

    const updateSpeedLabel = () => {
        if (speedLabel) {
            speedLabel.textContent = `${scrollMultiplier.toFixed(2)}×`;
        }
    };

    const updateLoadHint = () => {
        if (!loadHint) return;
        if (loadingProgress.isFailed?.()) {
            loadHint.textContent = loadingProgress.getFailMessage?.() || 'Loading failed — refresh and try again.';
            loadHint.classList.remove('hidden');
            loadHint.classList.add('is-error');
            return;
        }
        const pct = Math.round(options.onLoadProgress?.() ?? loadingProgress.getPercent());
        if (pct > 0 && pct < 100) {
            const stallHint = pct >= 55 && pct < 65 ? ' (building boat & loading Halley…)' : '';
            loadHint.textContent = `Loading game resources… ${pct}%${stallHint}`;
            loadHint.classList.remove('hidden');
        } else if (pct >= 100) {
            loadHint.textContent = 'Ready to cast!';
            loadHint.classList.remove('hidden');
        }
    };

    const setScrollMultiplier = (next) => {
        scrollMultiplier = clamp(next, PROLOGUE_SCROLL_SPEED_MIN, PROLOGUE_SCROLL_SPEED_MAX);
        saveScrollMultiplier(scrollMultiplier);
        updateSpeedLabel();
    };

    const onSlower = () => setScrollMultiplier(scrollMultiplier - PROLOGUE_SCROLL_SPEED_STEP);
    const onFaster = () => setScrollMultiplier(scrollMultiplier + PROLOGUE_SCROLL_SPEED_STEP);

    return new Promise((resolve) => {
        const cleanup = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (enterTimer) {
                clearTimeout(enterTimer);
                enterTimer = null;
            }
            if (loadPollId) {
                clearInterval(loadPollId);
                loadPollId = null;
            }
            document.removeEventListener('keydown', onKeyDown);
            slowerBtn?.removeEventListener('click', onSlower);
            fasterBtn?.removeEventListener('click', onFaster);
            overlay.removeEventListener('click', onOverlayTap);
            overlay.classList.remove('can-enter', 'is-splash-only');
            overlay.removeAttribute('role');
            overlay.removeAttribute('tabindex');
            overlay.classList.add('hidden');
            overlay.classList.remove('is-title-phase', 'is-fading', 'is-fading-credits');
            creditsPhase.classList.remove('hidden');
            titlePhase.classList.add('hidden');
            tapHint?.classList.add('hidden');
            if (tapHint) {
                tapHint.textContent = 'Tap anywhere to cast off';
            }
            canEnter = false;
            creditsInner.style.transform = '';
            loadHint?.classList.add('hidden');
        };

        const finish = () => {
            if (done) return;
            done = true;
            cleanup();
            resolve();
        };

        const onEnter = async () => {
            if (!canEnter) return;

            if (options.waitForReady) {
                canEnter = false;
                if (tapHint) {
                    tapHint.textContent = 'Preparing the lake…';
                    tapHint.classList.remove('hidden');
                }
                try {
                    await options.waitForReady();
                } catch (error) {
                    console.error('[PROLOGUE] Game failed to load:', error);
                    canEnter = true;
                    if (tapHint) {
                        tapHint.textContent = 'Loading failed — tap to retry';
                    }
                    return;
                }
            }
            finish();
        };

        const enableEnter = () => {
            canEnter = true;
            overlay.classList.add('can-enter');
            overlay.setAttribute('role', 'button');
            overlay.setAttribute('tabindex', '0');
            tapHint?.classList.remove('hidden');
        };

        const onOverlayTap = (event) => {
            if (phase !== 'title' || !canEnter) return;
            if (event.target.closest('.prologue-speed-controls')) return;
            onEnter();
        };

        const startTitlePhase = () => {
            phase = 'title';
            overlay.classList.remove('is-fading', 'is-fading-credits');
            overlay.classList.add('is-title-phase');
            if (skipCredits) {
                overlay.classList.add('is-splash-only');
            }
            creditsPhase.classList.add('hidden');
            titlePhase.classList.remove('hidden');
            updateLoadHint();

            enterTimer = window.setTimeout(enableEnter, PROLOGUE_ENTER_BUTTON_DELAY_SEC * 1000);
        };

        const goToTitlePhase = () => {
            if (phase !== 'credits') return;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            overlay.classList.add('is-fading-credits');
            window.setTimeout(startTitlePhase, PROLOGUE_PHASE_FADE_MS);
        };

        const tick = (ts) => {
            if (phase !== 'credits') return;

            if (!lastTs) {
                lastTs = ts;
            }
            const dt = Math.min(0.05, (ts - lastTs) / 1000);
            lastTs = ts;

            const viewport = creditsPhase.querySelector('.prologue-credits-viewport');
            const viewportH = viewport?.clientHeight || window.innerHeight;
            const innerH = creditsInner.scrollHeight;
            const endY = -(innerH + viewportH * 0.35);

            scrollY -= PROLOGUE_BASE_SCROLL_PX_PER_SEC * scrollMultiplier * dt;
            creditsInner.style.transform = `translate3d(0, ${scrollY}px, 0)`;

            if (scrollY <= endY) {
                goToTitlePhase();
                return;
            }

            rafId = requestAnimationFrame(tick);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Enter' && phase === 'title' && canEnter) {
                event.preventDefault();
                onEnter();
                return;
            }
            if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                if (phase === 'credits') {
                    goToTitlePhase();
                }
                return;
            }
            if (event.key === '-' || event.key === '_') {
                setScrollMultiplier(scrollMultiplier - PROLOGUE_SCROLL_SPEED_STEP);
            } else if (event.key === '=' || event.key === '+') {
                setScrollMultiplier(scrollMultiplier + PROLOGUE_SCROLL_SPEED_STEP);
            }
        };

        overlay.addEventListener('click', onOverlayTap);
        slowerBtn?.addEventListener('click', onSlower);
        fasterBtn?.addEventListener('click', onFaster);
        document.addEventListener('keydown', onKeyDown);

        updateSpeedLabel();
        updateLoadHint();
        loadPollId = window.setInterval(updateLoadHint, 350);

        if (skipCredits) {
            overlay.classList.remove('hidden', 'is-title-phase', 'is-fading', 'is-fading-credits', 'can-enter');
            creditsPhase.classList.add('hidden');
            titlePhase.classList.add('hidden');
            tapHint?.classList.add('hidden');
            canEnter = false;
            startTitlePhase();
            return;
        }

        phase = 'credits';
        overlay.classList.remove('hidden', 'is-title-phase', 'is-fading', 'is-fading-credits', 'can-enter');
        creditsPhase.classList.remove('hidden');
        titlePhase.classList.add('hidden');
        tapHint?.classList.add('hidden');
        canEnter = false;
        updateSpeedLabel();
        updateLoadHint();
        loadPollId = window.setInterval(updateLoadHint, 350);

        const viewport = creditsPhase.querySelector('.prologue-credits-viewport');
        const viewportH = viewport?.clientHeight || window.innerHeight;
        scrollY = viewportH * 0.92;
        creditsInner.style.transform = `translate3d(0, ${scrollY}px, 0)`;
        lastTs = 0;

        requestAnimationFrame(() => {
            rafId = requestAnimationFrame(tick);
        });
    });
}

/**
 * Replay the opening story from in-game (e.g. Inventory → Settings).
 * Game may already be loaded; tap anywhere returns to gameplay.
 */
export async function replayStoryPrologue() {
    const game = typeof window !== 'undefined' ? window.game : null;
    const waitForReady = game?.ready
        ? () => game.ready
        : () => Promise.resolve();

    await playStoryPrologue({
        waitForReady,
        onLoadProgress: () => loadingProgress.getPercent()
    });
}
