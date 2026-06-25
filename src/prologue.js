import {
    PROLOGUE_BASE_SCROLL_PX_PER_SEC,
    PROLOGUE_ENTER_BUTTON_DELAY_SEC,
    PROLOGUE_ENTRANCE_IMAGE,
    PROLOGUE_GAME_VERSION,
    PROLOGUE_INTERSTITIAL_HOLD_MS,
    PROLOGUE_INTERSTITIAL_TEXT,
    PROLOGUE_PHASE_FADE_MS,
    PROLOGUE_SCROLL_BACKGROUND,
    PROLOGUE_SCROLL_SPEED,
    PROLOGUE_STORY_PARAGRAPHS,
    PROLOGUE_VERSION_STORAGE_KEY,
    PROLOGUE_AMBIENCE_DUCK_RATIO,
    PROLOGUE_AMBIENCE_FADE_DELAY_AFTER_VO_SEC,
    PROLOGUE_AMBIENCE_FADE_DURATION_SEC,
    PROLOGUE_AMBIENCE_URL,
    PROLOGUE_AMBIENCE_VOLUME,
    PROLOGUE_MUSIC_DUCK_RATIO,
    PROLOGUE_MUSIC_URL,
    PROLOGUE_MUSIC_VOLUME,
    PROLOGUE_VOICEOVER_DELAY_SEC,
    PROLOGUE_VOICEOVER_URL,
    PROLOGUE_VOICEOVER_VOLUME
} from './config/prologue.js';
import { PrologueAudioBed } from './audio/prologueAmbience.js';
import { ensureProloguePack } from './assetPack.js';
import { loadingProgress } from './loadingProgress.js';

/** True when this build's prologue has not been shown yet (replay on each PROLOGUE_GAME_VERSION bump). */
export function shouldPlayStoryPrologue() {
    try {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.has('prologue')) {
                return true;
            }
        }
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
 * Full-screen cinematic prologue: scrolling story → interstitial card → splash art → tap anywhere to enter.
 * @param {{
 *   skipCredits?: boolean,
 *   preloadedPack?: object,
 *   waitForReady?: () => Promise<unknown>,
 *   onLoadProgress?: (percent: number) => void
 * }} options
 * @returns {Promise<void>}
 */
export async function playStoryPrologue(options = {}) {
    const skipCredits = options.skipCredits === true;

    let pack = options.preloadedPack;
    if (!pack) {
        pack = await ensureProloguePack({ full: !skipCredits });
    }

    const preloadedVoiceover = pack.voiceover?.audio ?? null;
    const preloadedOcean = pack.ocean?.audio ?? null;
    const preloadedMusic = pack.music?.audio ?? null;
    const backgroundUrl = pack.background?.blobUrl ?? PROLOGUE_SCROLL_BACKGROUND;
    const splashUrl = pack.splash?.blobUrl ?? PROLOGUE_ENTRANCE_IMAGE;

    const overlay = document.getElementById('story-prologue');
    const creditsPhase = document.getElementById('prologue-credits-phase');
    const interstitialPhase = document.getElementById('prologue-interstitial-phase');
    const titlePhase = document.getElementById('prologue-title-phase');
    const creditsInner = document.getElementById('prologue-credits-inner');
    const interstitialText = interstitialPhase?.querySelector('.prologue-interstitial-text');
    const tapHint = document.getElementById('prologue-tap-hint');
    const loadHint = document.getElementById('prologue-load-hint');
    const startGate = document.getElementById('prologue-start-gate');

    if (!overlay || !creditsPhase || !interstitialPhase || !titlePhase || !creditsInner) {
        console.warn('[PROLOGUE] Missing DOM — skipping prologue');
        return Promise.resolve();
    }

    const scrollMultiplier = PROLOGUE_SCROLL_SPEED;
    let rafId = null;
    let enterTimer = null;
    let loadPollId = null;
    let phase = 'credits';
    let scrollY = 0;
    let lastTs = 0;
    let done = false;
    let canEnter = false;
    let ambienceFadeTimer = null;
    let audioBed = null;
    let interstitialTimer = null;
    let lastCreditLine = null;
    let creditsFinished = false;

    const scheduleAmbienceFadeAfterVoiceover = () => {
        if (ambienceFadeTimer) {
            clearTimeout(ambienceFadeTimer);
        }
        ambienceFadeTimer = window.setTimeout(() => {
            ambienceFadeTimer = null;
            audioBed?.startFadeOut(PROLOGUE_AMBIENCE_FADE_DURATION_SEC);
        }, PROLOGUE_AMBIENCE_FADE_DELAY_AFTER_VO_SEC * 1000);
    };

    const haveLastWordsExited = () => {
        if (!lastCreditLine) {
            return false;
        }
        const lineBottom = scrollY + lastCreditLine.offsetTop + lastCreditLine.offsetHeight;
        return lineBottom <= 0;
    };

    const stopAudioBed = () => {
        audioBed?.stop();
        audioBed = null;
    };

    const startAudioBed = () => {
        if (skipCredits) {
            return;
        }

        const tracks = {};
        if (PROLOGUE_AMBIENCE_URL || preloadedOcean) {
            tracks.ocean = {
                audio: preloadedOcean ?? undefined,
                url: preloadedOcean ? undefined : PROLOGUE_AMBIENCE_URL,
                volume: PROLOGUE_AMBIENCE_VOLUME,
                duckRatio: PROLOGUE_AMBIENCE_DUCK_RATIO
            };
        }
        if (PROLOGUE_MUSIC_URL || preloadedMusic) {
            tracks.music = {
                audio: preloadedMusic ?? undefined,
                url: preloadedMusic ? undefined : PROLOGUE_MUSIC_URL,
                volume: PROLOGUE_MUSIC_VOLUME,
                duckRatio: PROLOGUE_MUSIC_DUCK_RATIO
            };
        }
        if (PROLOGUE_VOICEOVER_URL) {
            tracks.voiceover = {
                audio: preloadedVoiceover ?? undefined,
                url: preloadedVoiceover ? undefined : PROLOGUE_VOICEOVER_URL,
                volume: PROLOGUE_VOICEOVER_VOLUME,
                delaySec: PROLOGUE_VOICEOVER_DELAY_SEC,
                onEnded: scheduleAmbienceFadeAfterVoiceover
            };
        }

        if (!tracks.ocean && !tracks.music && !tracks.voiceover) {
            return;
        }

        audioBed = new PrologueAudioBed(tracks);
        audioBed.startFromUserGesture();
    };

    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }

    creditsInner.innerHTML = PROLOGUE_STORY_PARAGRAPHS
        .map((text) => `<p class="prologue-credit-line">${text}</p>`)
        .join('');

    lastCreditLine = creditsInner.querySelector('.prologue-credit-line:last-child');

    const creditsViewport = creditsPhase.querySelector('.prologue-credits-viewport');
    if (creditsViewport) {
        creditsViewport.style.backgroundImage =
            `linear-gradient(to bottom, rgba(0, 8, 28, 0.55) 0%, rgba(0, 12, 40, 0.25) 40%, rgba(0, 8, 28, 0.45) 100%), url('${backgroundUrl}')`;
    }

    const titleImg = document.getElementById('prologue-title-image');
    if (titleImg) {
        titleImg.src = splashUrl;
        titleImg.alt = "Halley's Big Catch — Adventure awaits";
    }

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

    return new Promise((resolve) => {
        const cleanup = () => {
            if (ambienceFadeTimer) {
                clearTimeout(ambienceFadeTimer);
                ambienceFadeTimer = null;
            }
            stopAudioBed();
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
            if (interstitialTimer) {
                clearTimeout(interstitialTimer);
                interstitialTimer = null;
            }
            document.removeEventListener('keydown', onKeyDown);
            overlay.removeEventListener('click', onOverlayTap);
            overlay.classList.remove('can-enter', 'is-splash-only', 'is-interstitial-phase', 'is-fading-interstitial');
            overlay.removeAttribute('role');
            overlay.removeAttribute('tabindex');
            overlay.classList.add('hidden');
            overlay.classList.remove('is-title-phase', 'is-fading', 'is-fading-credits');
            creditsPhase.classList.remove('hidden');
            interstitialPhase.classList.add('hidden');
            interstitialPhase.setAttribute('aria-hidden', 'true');
            titlePhase.classList.add('hidden');
            tapHint?.classList.add('hidden');
            if (tapHint) {
                tapHint.textContent = 'Tap anywhere to cast off';
            }
            canEnter = false;
            creditsInner.style.transform = '';
            loadHint?.classList.add('hidden');
            startGate?.classList.add('hidden');
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
            onEnter();
        };

        const startTitlePhase = () => {
            phase = 'title';
            overlay.classList.remove('is-fading', 'is-fading-credits', 'is-fading-interstitial', 'is-interstitial-phase');
            overlay.classList.add('is-title-phase');
            if (skipCredits) {
                overlay.classList.add('is-splash-only');
            }
            creditsPhase.classList.add('hidden');
            interstitialPhase.classList.add('hidden');
            interstitialPhase.setAttribute('aria-hidden', 'true');
            titlePhase.classList.remove('hidden');
            updateLoadHint();

            enterTimer = window.setTimeout(enableEnter, PROLOGUE_ENTER_BUTTON_DELAY_SEC * 1000);
        };

        const goToTitlePhase = ({ immediate = false } = {}) => {
            if (phase === 'title') return;
            if (interstitialTimer) {
                clearTimeout(interstitialTimer);
                interstitialTimer = null;
            }
            if (immediate) {
                stopAudioBed();
                stopAudioBed();
            }

            phase = 'title';
            overlay.classList.add('is-fading-interstitial');
            window.setTimeout(startTitlePhase, PROLOGUE_PHASE_FADE_MS);
        };

        const goToInterstitialPhase = ({ immediate = false } = {}) => {
            if (phase !== 'credits' || creditsFinished) return;
            creditsFinished = true;
            if (immediate) {
                stopAudioBed();
                stopAudioBed();
            }
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            phase = 'interstitial';
            overlay.classList.add('is-fading-credits');
            window.setTimeout(() => {
                creditsPhase.classList.add('hidden');
                interstitialPhase.classList.remove('hidden');
                interstitialPhase.setAttribute('aria-hidden', 'false');
                overlay.classList.remove('is-fading-credits');
                overlay.classList.add('is-interstitial-phase');

                interstitialTimer = window.setTimeout(() => {
                    interstitialTimer = null;
                    goToTitlePhase();
                }, PROLOGUE_INTERSTITIAL_HOLD_MS);
            }, PROLOGUE_PHASE_FADE_MS);
        };

        const tick = (ts) => {
            if (phase !== 'credits') return;

            if (!lastTs) {
                lastTs = ts;
            }
            const dt = Math.min(0.05, (ts - lastTs) / 1000);
            lastTs = ts;

            scrollY -= PROLOGUE_BASE_SCROLL_PX_PER_SEC * scrollMultiplier * dt;
            creditsInner.style.transform = `translate3d(0, ${scrollY}px, 0)`;

            if (haveLastWordsExited()) {
                goToInterstitialPhase();
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
                    goToInterstitialPhase({ immediate: true });
                } else if (phase === 'interstitial') {
                    goToTitlePhase({ immediate: true });
                }
            }
        };

        overlay.addEventListener('click', onOverlayTap);
        document.addEventListener('keydown', onKeyDown);

        updateLoadHint();
        loadPollId = window.setInterval(updateLoadHint, 350);

        const beginCreditsSequence = () => {
            startGate?.classList.add('hidden');
            startAudioBed();
            lastTs = 0;
            rafId = requestAnimationFrame(tick);
        };

        const waitForPrologueStart = () => new Promise((resolveStart) => {
            if (!startGate) {
                beginCreditsSequence();
                resolveStart();
                return;
            }

            const onStart = () => {
                startGate.removeEventListener('click', onStart);
                startGate.removeEventListener('keydown', onStartKey);
                beginCreditsSequence();
                resolveStart();
            };

            const onStartKey = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onStart();
                }
            };

            startGate.classList.remove('hidden');
            startGate.addEventListener('click', onStart);
            startGate.addEventListener('keydown', onStartKey);
        });

        if (skipCredits) {
            overlay.classList.remove('hidden', 'is-title-phase', 'is-fading', 'is-fading-credits', 'is-fading-interstitial', 'is-interstitial-phase', 'can-enter');
            creditsPhase.classList.add('hidden');
            interstitialPhase.classList.add('hidden');
            titlePhase.classList.add('hidden');
            tapHint?.classList.add('hidden');
            canEnter = false;
            startTitlePhase();
            return;
        }

        if (interstitialText) {
            interstitialText.textContent = PROLOGUE_INTERSTITIAL_TEXT;
        }

        phase = 'credits';
        overlay.classList.remove('hidden', 'is-title-phase', 'is-fading', 'is-fading-credits', 'is-fading-interstitial', 'is-interstitial-phase', 'can-enter');
        creditsPhase.classList.remove('hidden');
        interstitialPhase.classList.add('hidden');
        titlePhase.classList.add('hidden');
        tapHint?.classList.add('hidden');
        canEnter = false;

        const viewport = creditsPhase.querySelector('.prologue-credits-viewport');
        const viewportH = viewport?.clientHeight || window.innerHeight;
        scrollY = viewportH * 0.92;
        creditsInner.style.transform = `translate3d(0, ${scrollY}px, 0)`;
        lastTs = 0;

        waitForPrologueStart();
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

    const pack = await ensureProloguePack({ full: true });

    await playStoryPrologue({
        preloadedPack: pack,
        waitForReady,
        onLoadProgress: () => loadingProgress.getPercent()
    });
}
