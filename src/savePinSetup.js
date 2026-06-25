import { captureLocalGameSave } from './cloudSave.js';

const AUTH_STORAGE_KEY = 'kittyCreekAuth';

export function clearAuthStorage() {
    try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

export function getAuthStorage() {
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

export function setAuthStorage(auth) {
    try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } catch {
        /* ignore */
    }
}

export function switchToDifferentAccount() {
    clearAuthStorage();
    try {
        sessionStorage.setItem('preferReturningAuth', '1');
    } catch {
        /* ignore */
    }
    window.location.reload();
}

export function validatePinInput(pin) {
    if (!/^\d{4,6}$/.test(pin)) {
        return 'Save PIN must be 4–6 digits.';
    }
    return null;
}

export function normalizeHasPin(value) {
    return value === true || value === 't' || value === 'true' || value === 1;
}

export async function uploadCloudSaveAfterPin(api) {
    if (!api?.userId) {
        return;
    }
    const gameSave = captureLocalGameSave();
    if (gameSave) {
        await api.updateGameSave(gameSave);
    }
}

function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('hidden');
}

function hideError(element) {
    if (!element) return;
    element.textContent = '';
    element.classList.add('hidden');
}

function disableForm(input, button) {
    if (input) input.disabled = true;
    if (button) button.disabled = true;
}

function enableForm(input, button) {
    if (input) input.disabled = false;
    if (button) button.disabled = false;
}

/**
 * Blocking modal — required before play when an online account has no save PIN.
 */
export async function promptForSavePin(api, options = {}) {
    const { friendCode = null } = options;
    const modal = document.getElementById('save-pin-setup-modal');
    const form = document.getElementById('save-pin-setup-form');
    const pinInput = document.getElementById('save-pin-setup-input');
    const pinConfirm = document.getElementById('save-pin-setup-confirm');
    const errorElement = document.getElementById('save-pin-setup-error');
    const submitButton = document.getElementById('save-pin-setup-submit');
    const helper = document.getElementById('save-pin-setup-helper');
    const switchAccountButton = document.getElementById('save-pin-switch-account');

    if (!modal || !form || !pinInput || !pinConfirm || !submitButton) {
        throw new Error('Save PIN setup modal elements are missing');
    }

    if (helper) {
        const codeHint = friendCode
            ? ` Wrong account? Tap "Sign in as a different account" below.`
            : '';
        helper.textContent =
            `Set a private save PIN now to claim and secure this account.${codeHint} ` +
            'After that, use your username and PIN on Returning to sign in on other devices.';
    }

    hideError(errorElement);
    modal.classList.remove('hidden');
    pinInput.value = '';
    pinConfirm.value = '';
    pinInput.focus();

    return new Promise((resolve) => {
        const cleanup = () => {
            form.removeEventListener('submit', handleSubmit);
            pinInput.removeEventListener('input', handleInput);
            pinConfirm.removeEventListener('input', handleInput);
            switchAccountButton?.removeEventListener('click', onSwitchAccount);
        };

        const onSwitchAccount = () => {
            switchToDifferentAccount();
        };

        const handleSubmit = async (event) => {
            event.preventDefault();
            hideError(errorElement);

            const pin = pinInput.value.trim();
            const confirm = pinConfirm.value.trim();
            const pinError = validatePinInput(pin);

            if (pinError) {
                showError(errorElement, pinError);
                return;
            }
            if (pin !== confirm) {
                showError(errorElement, 'Save PINs do not match.');
                return;
            }

            disableForm(pinInput, submitButton);
            pinConfirm.disabled = true;
            submitButton.textContent = 'Saving...';

            try {
                await api.setSavePin(pin);
                await uploadCloudSaveAfterPin(api);
                modal.classList.add('hidden');
                cleanup();
                resolve();
            } catch (error) {
                console.error('[SAVE PIN] Setup failed:', error);
                showError(errorElement, error.message || 'Failed to set save PIN.');
                enableForm(pinInput, submitButton);
                pinConfirm.disabled = false;
                submitButton.textContent = 'Save PIN & Continue';
            }
        };

        const handleInput = () => hideError(errorElement);

        form.addEventListener('submit', handleSubmit);
        pinInput.addEventListener('input', handleInput);
        pinConfirm.addEventListener('input', handleInput);
        switchAccountButton?.addEventListener('click', onSwitchAccount);
    });
}

/**
 * Safety net if bootstrap was skipped or an old session is missing a PIN.
 */
export async function ensureSavePin(api) {
    if (!api?.userId) {
        return;
    }

    try {
        const saveInfo = await api.getGameSave();
        if (normalizeHasPin(saveInfo?.hasPin)) {
            return;
        }

        const profile = await api.getPlayer().catch(() => null);
        const friendCode = profile?.friend_code ?? profile?.friendCode ?? null;
        await promptForSavePin(api, { friendCode });
    } catch (error) {
        console.error('[SAVE PIN] ensureSavePin failed:', error);
        throw error;
    }
}
