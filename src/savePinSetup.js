/**
 * Save PIN setup and validation — shared by bootstrap and in-game UI.
 */

import { captureLocalGameSave } from './cloudSave.js';

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

    if (!modal || !form || !pinInput || !pinConfirm || !submitButton) {
        throw new Error('Save PIN setup modal elements are missing');
    }

    if (helper) {
        const codeHint = friendCode
            ? ` Your friend code is ${friendCode} — use it with your username under "No PIN yet" if you reinstall before finishing this step.`
            : '';
        helper.textContent =
            `Set a private save PIN now so you can restore progress on a new device.${codeHint} ` +
            'Your PIN is secret. Your friend code is only for one-time recovery until a PIN is set.';
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
