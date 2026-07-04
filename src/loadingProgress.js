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
        this._dismissed = false;
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
        if (this._dismissed) return;

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
        this.percent = next;

        if (this._dismissed || this._suppressed || !this.root) {
            return;
        }

        if (this.root.classList.contains('hidden')) {
            // Hidden on purpose (e.g. during prologue) — never resurrect the overlay.
            return;
        }

        this._render(next, message);
    }

    hide() {
        this.bind();
        this._dismissed = true;
        this.percent = 100;

        const root = this.root || document.getElementById('loading');
        if (!root) {
            return;
        }

        this._render(100, 'Ready!');
        root.classList.add('hidden');
        root.remove();

        this.root = null;
        this.messageEl = null;
        this.fillEl = null;
        this.percentEl = null;
        this._bound = false;
    }

    isFailed() {
        return this.failed;
    }

    getFailMessage() {
        return this.failMessage || 'Loading failed. Please refresh.';
    }

    fail(message = 'Loading failed. Please refresh.') {
        this._dismissed = false;
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

/** Remove the loading overlay from the DOM so it cannot cover WebGL on mobile. */
export function removeLoadingOverlay() {
    document.getElementById('loading')?.remove();
}
