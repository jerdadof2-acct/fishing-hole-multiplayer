const DISMISS_STORAGE_KEY = 'kittyCreekInstallDismissedAt';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

let deferredInstallPrompt = null;
let initialized = false;

function isStandaloneMode() {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia?.('(display-mode: standalone)')?.matches === true
        || window.navigator.standalone === true
    );
}

function isIOSDevice() {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function wasDismissedRecently() {
    try {
        const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
        if (!raw) return false;
        const dismissedAt = Number(raw);
        if (!Number.isFinite(dismissedAt)) return false;
        return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
    } catch {
        return false;
    }
}

function markDismissed() {
    try {
        localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
        /* ignore */
    }
}

function getModalElements() {
    return {
        modal: document.getElementById('pwa-install-modal'),
        message: document.getElementById('pwa-install-message'),
        iosHint: document.getElementById('pwa-install-ios-hint'),
        installBtn: document.getElementById('pwa-install-btn'),
        laterBtn: document.getElementById('pwa-install-later-btn')
    };
}

function isBlockingUiActive() {
    if (document.body?.classList.contains('gameplay-onboarding-active')) {
        return true;
    }

    const blockingIds = [
        'username-modal',
        'save-pin-setup-modal',
        'daily-bonus-modal',
        'energy-modal',
        'pwa-install-modal'
    ];

    return blockingIds.some((id) => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
}

function hideInstallModal() {
    const { modal } = getModalElements();
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function showInstallModal() {
    const { modal, message, iosHint, installBtn } = getModalElements();
    if (!modal) return;

    const ios = isIOSDevice();
    const canNativePrompt = Boolean(deferredInstallPrompt);

    if (ios) {
        message.textContent = 'Add Halley\'s Big Catch to your home screen for the full game pack, faster loading, and offline play.';
        iosHint?.classList.remove('hidden');
        if (installBtn) {
            installBtn.textContent = 'Got It';
        }
    } else if (canNativePrompt) {
        message.textContent = 'Install Halley\'s Big Catch on your device for the full game pack, faster loading, and offline play.';
        iosHint?.classList.add('hidden');
        if (installBtn) {
            installBtn.textContent = 'Install App';
        }
    } else {
        message.textContent = 'Install Halley\'s Big Catch from your browser menu for the full game pack and offline play.';
        iosHint?.classList.add('hidden');
        if (installBtn) {
            installBtn.textContent = 'OK';
        }
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

export function initPwaInstallPrompt() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;

    if (window.__deferredPwaInstallPrompt) {
        deferredInstallPrompt = window.__deferredPwaInstallPrompt;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        window.__deferredPwaInstallPrompt = event;
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        window.__deferredPwaInstallPrompt = null;
        hideInstallModal();
    });

    const { modal, installBtn, laterBtn } = getModalElements();

    installBtn?.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            try {
                await deferredInstallPrompt.prompt();
                const choice = await deferredInstallPrompt.userChoice;
                if (choice?.outcome === 'accepted') {
                    deferredInstallPrompt = null;
                    hideInstallModal();
                    return;
                }
            } catch (error) {
                console.warn('[PWA] Install prompt failed:', error);
            }
        }

        hideInstallModal();
        if (!deferredInstallPrompt) {
            markDismissed();
        }
    });

    laterBtn?.addEventListener('click', () => {
        markDismissed();
        hideInstallModal();
    });

    modal?.addEventListener('click', (event) => {
        if (event.target === modal) {
            markDismissed();
            hideInstallModal();
        }
    });
}

export function canShowInstallPrompt() {
    if (isStandaloneMode()) return false;
    if (wasDismissedRecently()) return false;
    if (isIOSDevice()) return true;
    return Boolean(deferredInstallPrompt);
}

export function maybeShowInstallPrompt() {
    if (!canShowInstallPrompt()) return false;
    showInstallModal();
    return true;
}

export function scheduleInstallPromptWhenIdle(options = {}) {
    const initialDelayMs = options.initialDelayMs ?? 3000;
    const retryDelayMs = options.retryDelayMs ?? 1500;
    const maxAttempts = options.maxAttempts ?? 12;

    let attempts = 0;

    const tryShow = () => {
        attempts += 1;

        if (!canShowInstallPrompt()) {
            return;
        }

        if (isBlockingUiActive()) {
            if (attempts < maxAttempts) {
                window.setTimeout(tryShow, retryDelayMs);
            }
            return;
        }

        maybeShowInstallPrompt();
    };

    window.setTimeout(tryShow, initialDelayMs);
}
