import { VOICEOVER_LINES } from '../config/voiceover.js';

/**
 * Random voice lines for Halley (tap + future animation VO).
 */
export class Voiceover {
    constructor(sfx = null) {
        this.sfx = sfx;
        this.enabled = true;
        this._lastIndex = {};
    }

    setEnabled(on) {
        this.enabled = !!on;
    }

    pickLine(category) {
        const lines = VOICEOVER_LINES[category];
        if (!lines?.length) {
            return null;
        }

        if (lines.length === 1) {
            return lines[0];
        }

        let index = Math.floor(Math.random() * lines.length);
        const last = this._lastIndex[category];
        let guard = 0;
        while (index === last && guard < 8) {
            index = Math.floor(Math.random() * lines.length);
            guard += 1;
        }
        this._lastIndex[category] = index;
        return lines[index];
    }

    /**
     * @param {string} category
     * @param {{ onSpeak?: (text: string) => void }} [hooks]
     */
    async playRandom(category, hooks = {}) {
        if (!this.enabled) {
            return null;
        }

        const line = this.pickLine(category);
        if (!line) {
            return null;
        }

        hooks.onSpeak?.(line.text);

        if (line.audio && this.sfx) {
            const cacheKey = `vo_${category}_${line.audio}`;
            try {
                await this.sfx.load(cacheKey, line.audio);
                this.sfx.play2D(cacheKey, 0.92, 1);
            } catch (error) {
                console.warn('[VOICEOVER] Failed to play:', line.audio, error);
            }
        }

        return line;
    }
}
