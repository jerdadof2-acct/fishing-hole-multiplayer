/**
 * Prologue audio bed — ocean SFX + background music under voiceover.
 * Voiceover stays on top; bed layers duck and fade together after narration ends.
 */

function createLayer(ctx, destination, url, peakVolume, duckRatio) {
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    source.connect(gain);
    gain.connect(destination);

    return {
        audio,
        source,
        gain,
        peakVolume,
        duckRatio,
        ducked: false,
        fadingOut: false
    };
}

export class PrologueAudioBed {
    /**
     * @param {{
     *   ocean?: { url: string, volume?: number, duckRatio?: number },
     *   music?: { url: string, volume?: number, duckRatio?: number }
     * }} tracks
     */
    constructor(tracks = {}) {
        this.oceanConfig = tracks.ocean ?? null;
        this.musicConfig = tracks.music ?? null;

        this.ctx = null;
        this.masterGain = null;
        this.oceanLayer = null;
        this.musicLayer = null;
        this.running = false;
        this._fadingOut = false;
        this._stopTimer = null;
    }

    async start() {
        if (this.running) {
            return;
        }

        const oceanUrl = this.oceanConfig?.url;
        const musicUrl = this.musicConfig?.url;
        if (!oceanUrl && !musicUrl) {
            return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            return;
        }

        this.ctx = new AudioCtx();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        if (oceanUrl) {
            this.oceanLayer = createLayer(
                this.ctx,
                this.masterGain,
                oceanUrl,
                this.oceanConfig.volume ?? 0.32,
                this.oceanConfig.duckRatio ?? 0.38
            );
        }

        if (musicUrl) {
            this.musicLayer = createLayer(
                this.ctx,
                this.masterGain,
                musicUrl,
                this.musicConfig.volume ?? 0.24,
                this.musicConfig.duckRatio ?? 0.34
            );
        }

        const playTargets = [this.oceanLayer, this.musicLayer].filter(Boolean);
        try {
            await Promise.all(playTargets.map((layer) => layer.audio.play()));
        } catch (error) {
            console.warn('[PROLOGUE] Audio bed play failed:', error);
            this.stop();
            return;
        }

        const now = this.ctx.currentTime;
        playTargets.forEach((layer) => {
            layer.gain.gain.linearRampToValueAtTime(layer.peakVolume, now + 1.8);
        });

        this.running = true;
    }

    _duckLayer(layer) {
        if (!layer || layer.ducked || layer.fadingOut || !this.ctx) {
            return;
        }

        layer.ducked = true;
        const now = this.ctx.currentTime;
        const ducked = layer.peakVolume * layer.duckRatio;

        layer.gain.gain.cancelScheduledValues(now);
        layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
        layer.gain.gain.linearRampToValueAtTime(ducked, now + 0.5);
    }

    duckForVoiceover() {
        if (!this.running || this._fadingOut) {
            return;
        }
        this._duckLayer(this.oceanLayer);
        this._duckLayer(this.musicLayer);
    }

    startFadeOut(durationSec = 3) {
        if (!this.running || !this.ctx || this._fadingOut) {
            return;
        }

        this._fadingOut = true;
        const now = this.ctx.currentTime;
        const layers = [this.oceanLayer, this.musicLayer].filter(Boolean);

        layers.forEach((layer) => {
            layer.fadingOut = true;
            layer.gain.gain.cancelScheduledValues(now);
            layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
            layer.gain.gain.linearRampToValueAtTime(0, now + durationSec);
        });

        if (this._stopTimer) {
            clearTimeout(this._stopTimer);
        }
        this._stopTimer = window.setTimeout(() => {
            this._stopTimer = null;
            this.stop();
        }, durationSec * 1000 + 120);
    }

    stop() {
        if (!this.running && !this.ctx) {
            return;
        }

        this.running = false;

        if (this._stopTimer) {
            clearTimeout(this._stopTimer);
            this._stopTimer = null;
        }

        if (this.ctx && this.masterGain && !this._fadingOut) {
            const now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
            this.masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
        }

        window.setTimeout(() => {
            [this.oceanLayer, this.musicLayer].forEach((layer) => {
                if (!layer) return;
                try {
                    layer.audio.pause();
                } catch {
                    /* ignore */
                }
                try {
                    layer.source.disconnect();
                    layer.gain.disconnect();
                } catch {
                    /* ignore */
                }
            });

            try {
                this.masterGain?.disconnect();
            } catch {
                /* ignore */
            }

            this.ctx?.close?.();
            this.oceanLayer = null;
            this.musicLayer = null;
            this.masterGain = null;
            this.ctx = null;
            this._fadingOut = false;
        }, 900);
    }
}

/** @deprecated Use PrologueAudioBed */
export const PrologueAmbience = PrologueAudioBed;
