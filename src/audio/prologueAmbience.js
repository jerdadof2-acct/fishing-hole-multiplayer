/**
 * Prologue audio bed — ocean SFX + background music + voiceover on one Web Audio graph.
 */

function createLoopLayer(ctx, destination, audioOrUrl, peakVolume, duckRatio) {
    const audio = typeof audioOrUrl === 'string'
        ? Object.assign(new Audio(audioOrUrl), { loop: true, preload: 'auto' })
        : audioOrUrl;
    if (!audio.loop) {
        audio.loop = true;
    }

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

function createVoiceoverLayer(ctx, destination, audioElement, peakVolume) {
    const source = ctx.createMediaElementSource(audioElement);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    source.connect(gain);
    gain.connect(destination);

    return {
        audio: audioElement,
        source,
        gain,
        peakVolume,
        ducked: false,
        fadingOut: false
    };
}

export class PrologueAudioBed {
    constructor(tracks = {}) {
        this.oceanConfig = tracks.ocean ?? null;
        this.musicConfig = tracks.music ?? null;
        this.voiceoverConfig = tracks.voiceover ?? null;

        this.ctx = null;
        this.masterGain = null;
        this.oceanLayer = null;
        this.musicLayer = null;
        this.voiceoverLayer = null;
        this.running = false;
        this._fadingOut = false;
        this._stopTimer = null;
    }

    async start() {
        return this.startFromUserGesture();
    }

    startFromUserGesture() {
        if (this.running) {
            return Promise.resolve();
        }

        const oceanUrl = this.oceanConfig?.url;
        const musicUrl = this.musicConfig?.url;
        const oceanAudio = this.oceanConfig?.audio;
        const musicAudio = this.musicConfig?.audio;
        const voiceoverAudio = this.voiceoverConfig?.audio;
        const voiceoverUrl = this.voiceoverConfig?.url;

        if (!oceanUrl && !musicUrl && !oceanAudio && !musicAudio && !voiceoverAudio && !voiceoverUrl) {
            return Promise.resolve();
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            return Promise.resolve();
        }

        this.ctx = new AudioCtx();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        if (oceanUrl || oceanAudio) {
            this.oceanLayer = createLoopLayer(
                this.ctx,
                this.masterGain,
                oceanAudio ?? oceanUrl,
                this.oceanConfig.volume ?? 0.32,
                this.oceanConfig.duckRatio ?? 0.38
            );
        }

        if (musicUrl || musicAudio) {
            this.musicLayer = createLoopLayer(
                this.ctx,
                this.masterGain,
                musicAudio ?? musicUrl,
                this.musicConfig.volume ?? 0.24,
                this.musicConfig.duckRatio ?? 0.34
            );
        }

        if (voiceoverAudio) {
            this.voiceoverLayer = createVoiceoverLayer(
                this.ctx,
                this.masterGain,
                voiceoverAudio,
                this.voiceoverConfig.volume ?? 1
            );
        } else if (voiceoverUrl) {
            const audio = new Audio(voiceoverUrl);
            audio.preload = 'auto';
            this.voiceoverLayer = createVoiceoverLayer(
                this.ctx,
                this.masterGain,
                audio,
                this.voiceoverConfig.volume ?? 1
            );
        }

        const playTargets = [this.oceanLayer, this.musicLayer, this.voiceoverLayer].filter(Boolean);
        const playPromises = playTargets.map((layer) => layer.audio.play());

        const now = this.ctx.currentTime;
        [this.oceanLayer, this.musicLayer].filter(Boolean).forEach((layer) => {
            layer.gain.gain.linearRampToValueAtTime(layer.peakVolume, now + 1.8);
        });

        if (this.voiceoverLayer) {
            const delaySec = this.voiceoverConfig?.delaySec ?? 2;
            const peak = this.voiceoverLayer.peakVolume;
            this.voiceoverLayer.gain.gain.setValueAtTime(0, now);
            this.voiceoverLayer.gain.gain.linearRampToValueAtTime(peak, now + delaySec + 0.35);
            this._duckLayer(this.oceanLayer);
            this._duckLayer(this.musicLayer);

            if (this.voiceoverConfig?.onEnded) {
                this.voiceoverLayer.audio.addEventListener('ended', this.voiceoverConfig.onEnded);
            }
        }

        this.running = true;

        return Promise.all(playPromises).catch((error) => {
            console.warn('[PROLOGUE] Audio bed play failed:', error);
            this.stop();
        });
    }

    _duckLayer(layer) {
        if (!layer || layer.ducked || layer.fadingOut || !this.ctx || layer.duckRatio == null) {
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
        const layers = [this.oceanLayer, this.musicLayer, this.voiceoverLayer].filter(Boolean);

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
            [this.oceanLayer, this.musicLayer, this.voiceoverLayer].forEach((layer) => {
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
            this.voiceoverLayer = null;
            this.masterGain = null;
            this.ctx = null;
            this._fadingOut = false;
        }, 900);
    }
}

export const PrologueAmbience = PrologueAudioBed;
