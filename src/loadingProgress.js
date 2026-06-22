/**
 * Full-screen loading progress for bootstrap + game init.
 */
class LoadingProgress {
    constructor() {
        this.root = null;
        this.messageEl = null;
        this.fillEl = null;
        this.percentEl = null;
        this.percent = 0;
        this._bound = false;
        this._suppressed = false;
        this.failed = false;
        this.failMessage = '';
    }

    bind() {
        if (this._bound) return;

        this.root = document.getElementById('loading');
        this.messageEl = document.getElementById('loading-message');
        this.fillEl = document.getElementById('loading-bar-fill');
        this.percentEl = document.getElementById('loading-percent');

        if (!this.root) {
            console.warn('[LOADING] #loading element not found');
            return;
        }

        this._bound = true;
    }

    /** When true, progress updates internally but the loading screen stays hidden (e.g. during prologue). */
    suppress(shouldSuppress = true) {
        this._suppressed = !!shouldSuppress;
    }

    getPercent() {
        return this.percent;
    }

    show(message = 'Loading...') {
        this.bind();
        if (!this.root || this._suppressed) return;

        this.percent = 0;
        this.failed = false;
        this.failMessage = '';
        this.root.classList.remove('hidden', 'is-error');
        this._render(0, message);
    }

    update(percent, message) {
        this.bind();
        const next = Math.max(this.percent, Math.min(100, percent));
        if (this._suppressed) {
            this.percent = next;
            return;
        }

        if (!this.root || this.root.classList.contains('hidden')) {
            this.show(message || 'Loading...');
        }

        this._render(next, message);
    }

    hide() {
        this.bind();
        if (!this.root) return;

        this._render(100, 'Ready!');
        if (this._suppressed) {
            this.percent = 100;
            return;
        }

        window.setTimeout(() => {
            this.root.classList.add('hidden');
        }, 250);
    }

    isFailed() {
        return this.failed;
    }

    getFailMessage() {
        return this.failMessage || 'Loading failed. Please refresh.';
    }

    fail(message = 'Loading failed. Please refresh.') {
        this.bind();
        this.failed = true;
        this.failMessage = message;
        this.suppress(false);
        if (!this.root) return;

        this.root.classList.remove('hidden');
        this.root.classList.add('is-error');
        if (this.messageEl) {
            this.messageEl.textContent = message;
        }
        if (this.percentEl) {
            this.percentEl.textContent = '';
        }
    }

    _render(percent, message) {
        this.percent = percent;

        if (this.messageEl && message) {
            this.messageEl.textContent = message;
        }
        if (this.fillEl) {
            this.fillEl.style.width = `${percent}%`;
        }
        const track = this.root?.querySelector('.loading-bar-track');
        if (track) {
            track.setAttribute('aria-valuenow', String(Math.round(percent)));
        }
        if (this.percentEl) {
            this.percentEl.textContent = `${Math.round(percent)}%`;
        }
    }
}

export const loadingProgress = new LoadingProgress();
