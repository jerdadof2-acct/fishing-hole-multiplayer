/**
 * Looping location ambience (Celestial Depths music, Amazon river flow, etc.)
 */

import {
    CELESTIAL_DEPTHS_MUSIC_VOLUME,
    PROLOGUE_MUSIC_URL
} from '../config/prologue.js';
import { getPrologueMusicSource } from '../assetPack.js';

const FADE_IN_SEC = 2.5;
const FADE_OUT_SEC = 1.8;

function clampVolume(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
}

export const AMAZON_DEPTHS_AMBIENCE_URL = '/src/audio/lookingnorth-river-flow-473686.mp3';
export const AMAZON_DEPTHS_AMBIENCE_VOLUME = 0.38;

export const CRESCENT_POND_AMBIENCE_URL =
    '/src/audio/freesound_community-water-lap-against-rocks-lake-27442.mp3';
export const CRESCENT_POND_AMBIENCE_VOLUME = 0.34;

export const CORTEZ_BACKWATERS_AMBIENCE_URL =
    '/src/audio/jonathanslattermusic-sea-gently-lapping-waves-far-away-seagulls-486892.mp3';
/** Below prologue ocean ambience (0.3). */
export const CORTEZ_BACKWATERS_AMBIENCE_VOLUME = 0.22;

export const CRAGGY_COAST_AMBIENCE_URL =
    '/src/audio/soundreality-wind-blowing-457954.mp3';
export const CRAGGY_COAST_AMBIENCE_VOLUME = 0.32;

export class LoopingLocationAmbience {
    /**
     * @param {{ resolveSource: () => string, peakVolume: number }} options
     */
    constructor({ resolveSource, peakVolume }) {
        this.resolveSource = resolveSource;
        this.peakVolume = peakVolume;
        this.audio = null;
        this.active = false;
        this._fading = false;
        this._fadeFrame = null;
        this._fadeId = 0;
        this._pendingStart = false;
        this._gestureHandler = null;
    }

    _getSource() {
        return this.resolveSource();
    }

    _ensureAudio() {
        const source = this._getSource();
        if (this.audio && this.audio.src && !this.audio.src.endsWith(source)) {
            this.audio.pause();
            this.audio = null;
        }

        if (this.audio) {
            return this.audio;
        }

        const audio = new Audio(source);
        audio.loop = true;
        audio.preload = 'auto';
        this.audio = audio;
        return audio;
    }

    _cancelFade() {
        if (this._fadeFrame) {
            cancelAnimationFrame(this._fadeFrame);
            this._fadeFrame = null;
        }
        this._fading = false;
        this._fadeId += 1;
    }

    _fadeVolume(from, to, durationSec, onDone) {
        this._cancelFade();
        const fadeId = this._fadeId;
        const audio = this._ensureAudio();
        const start = performance.now();
        const durationMs = Math.max(1, durationSec * 1000);
        const startVol = clampVolume(from);
        const endVol = clampVolume(to);

        this._fading = true;
        audio.volume = startVol;

        const step = (now) => {
            if (fadeId !== this._fadeId) {
                return;
            }

            const t = Math.min(1, (now - start) / durationMs);
            audio.volume = clampVolume(startVol + (endVol - startVol) * t);

            if (t < 1) {
                this._fadeFrame = requestAnimationFrame(step);
                return;
            }

            this._fadeFrame = null;
            this._fading = false;
            audio.volume = endVol;
            onDone?.();
        };

        this._fadeFrame = requestAnimationFrame(step);
    }

    _bindGestureRetry() {
        if (this._gestureHandler) {
            return;
        }

        this._gestureHandler = () => {
            if (!this._pendingStart) {
                return;
            }
            this._tryPlay();
        };

        window.addEventListener('pointerdown', this._gestureHandler, { passive: true });
        window.addEventListener('touchstart', this._gestureHandler, { passive: true });
    }

    _unbindGestureRetry() {
        if (!this._gestureHandler) {
            return;
        }
        window.removeEventListener('pointerdown', this._gestureHandler);
        window.removeEventListener('touchstart', this._gestureHandler);
        this._gestureHandler = null;
    }

    _tryPlay() {
        const audio = this._ensureAudio();

        if (this.active && !audio.paused) {
            this._pendingStart = false;
            this._unbindGestureRetry();
            return;
        }

        audio.currentTime = 0;
        audio.volume = 0;

        const playAttempt = audio.play();
        if (!playAttempt) {
            this._pendingStart = false;
            this._fadeVolume(0, this.peakVolume, FADE_IN_SEC);
            return;
        }

        playAttempt
            .then(() => {
                this.active = true;
                this._pendingStart = false;
                this._unbindGestureRetry();
                this._fadeVolume(0, this.peakVolume, FADE_IN_SEC);
            })
            .catch(() => {
                this._pendingStart = true;
                this._bindGestureRetry();
            });
    }

    start() {
        if (this.active && this.audio && !this.audio.paused) {
            return;
        }

        this._cancelFade();
        this._tryPlay();
    }

    resumeAfterGesture() {
        if (this._pendingStart) {
            this._tryPlay();
        }
    }

    stop() {
        this._pendingStart = false;
        this._unbindGestureRetry();

        if (!this.audio || !this.active) {
            this.active = false;
            return;
        }

        this._cancelFade();
        const audio = this.audio;
        const from = clampVolume(audio.volume);

        this._fadeVolume(from, 0, FADE_OUT_SEC, () => {
            audio.pause();
            this.active = false;
        });
    }
}

export class CelestialDepthsMusic extends LoopingLocationAmbience {
    constructor() {
        super({
            resolveSource: () => getPrologueMusicSource() ?? PROLOGUE_MUSIC_URL,
            peakVolume: CELESTIAL_DEPTHS_MUSIC_VOLUME
        });
    }
}

export class AmazonDepthsAmbience extends LoopingLocationAmbience {
    constructor() {
        super({
            resolveSource: () => AMAZON_DEPTHS_AMBIENCE_URL,
            peakVolume: AMAZON_DEPTHS_AMBIENCE_VOLUME
        });
    }
}

export class CrescentPondAmbience extends LoopingLocationAmbience {
    constructor() {
        super({
            resolveSource: () => CRESCENT_POND_AMBIENCE_URL,
            peakVolume: CRESCENT_POND_AMBIENCE_VOLUME
        });
    }
}

export class CortezBackwatersAmbience extends LoopingLocationAmbience {
    constructor() {
        super({
            resolveSource: () => CORTEZ_BACKWATERS_AMBIENCE_URL,
            peakVolume: CORTEZ_BACKWATERS_AMBIENCE_VOLUME
        });
    }
}

export class CraggyCoastAmbience extends LoopingLocationAmbience {
    constructor() {
        super({
            resolveSource: () => CRAGGY_COAST_AMBIENCE_URL,
            peakVolume: CRAGGY_COAST_AMBIENCE_VOLUME
        });
    }
}

/** Stormbreaker Bay — wind + distant surf/seagulls layered together. */
export class StormbreakerBayAmbience {
    constructor() {
        this.wind = new LoopingLocationAmbience({
            resolveSource: () => CRAGGY_COAST_AMBIENCE_URL,
            peakVolume: CRAGGY_COAST_AMBIENCE_VOLUME
        });
        this.surf = new LoopingLocationAmbience({
            resolveSource: () => CORTEZ_BACKWATERS_AMBIENCE_URL,
            peakVolume: CORTEZ_BACKWATERS_AMBIENCE_VOLUME
        });
    }

    start() {
        this.wind.start();
        this.surf.start();
    }

    stop() {
        this.wind.stop();
        this.surf.stop();
    }

    resumeAfterGesture() {
        this.wind.resumeAfterGesture();
        this.surf.resumeAfterGesture();
    }
}
