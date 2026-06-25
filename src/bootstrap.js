import Game from './main.js?v=20250624-recover-pin';
import { api } from './api.js';
import { initAdRotator } from './ads.js';
import { loadingProgress } from './loadingProgress.js';
import {
    markPrologueSeenForVersion,
    playStoryPrologue,
    shouldPlayStoryPrologue,
    shouldShowReturnSplash
} from './prologue.js';
import { applyGameSaveToLocal, captureLocalGameSave, getNewerGameSave } from './cloudSave.js';
import {
    ensureSavePin,
    normalizeHasPin,
    promptForSavePin,
    validatePinInput
} from './savePinSetup.js';

const AUTH_STORAGE_KEY = 'kittyCreekAuth';

function registerServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
            console.log('[BOOTSTRAP] Service worker registered:', registration.scope);
        })
        .catch(error => {
            console.warn('[BOOTSTRAP] Service worker registration failed:', error);
        });
}

function getAuthStorage() {
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to read auth storage:', error);
        return null;
    }
}

function setAuthStorage(auth) {
    try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to persist auth storage:', error);
    }
}

function clearAuthStorage() {
    try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to clear auth storage:', error);
    }
}

async function startOfflineGame(reason) {
    console.warn('[BOOTSTRAP] API unavailable. Starting offline mode.', reason || '');
    loadingProgress.update(12, 'Offline mode — loading local save data...');
    api.setUserId(null);
    return launchGame({});
}

async function launchGame(gameOptions) {
    const playFullPrologue = shouldPlayStoryPrologue();
    const playReturnSplash = shouldShowReturnSplash();
    const needsPreEntry = playFullPrologue || playReturnSplash;

    if (needsPreEntry) {
        loadingProgress.suppress(true);
        loadingProgress.update(18, 'Loading Halley\'s Big Catch…');
    } else {
        loadingProgress.update(18, 'Starting the lake...');
    }

    const modal = document.getElementById('username-modal');
    const pinModal = document.getElementById('save-pin-setup-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    if (pinModal) {
        pinModal.classList.add('hidden');
    }

    const game = new Game({
        ...gameOptions,
        deferReveal: needsPreEntry
    });
    window.game = game;

    if (playFullPrologue) {
        await playStoryPrologue({
            waitForReady: () => game.ready,
            onLoadProgress: () => loadingProgress.getPercent()
        });
        markPrologueSeenForVersion();
        loadingProgress.suppress(false);
        game.reveal();
        registerServiceWorker();
        return game;
    }

    if (playReturnSplash) {
        await playStoryPrologue({
            skipCredits: true,
            waitForReady: () => game.ready,
            onLoadProgress: () => loadingProgress.getPercent()
        });
        loadingProgress.suppress(false);
        game.reveal();
        registerServiceWorker();
        return game;
    }

    await game.ready;
    registerServiceWorker();
    return game;
}

function getLocalPlayerData() {
    try {
        const saved = localStorage.getItem('kittyCreekPlayer');
        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        console.warn('[BOOTSTRAP] Failed to read local player data:', error);
        return null;
    }
}

function setLocalPlayerData(data) {
    try {
        const current = getLocalPlayerData() || {};
        const updated = { ...current, ...data };
        const serialized = JSON.stringify(updated);
        localStorage.setItem('kittyCreekPlayer', serialized);
        localStorage.setItem('kittyCreekPlayer_backup', serialized);
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to persist local player data:', error);
    }
}

async function handleOfflineMode(message) {
    const existingAuth = getAuthStorage();
    let localData = getLocalPlayerData();
    let needsUsername =
        (!existingAuth || !existingAuth.username) &&
        (
            !localData ||
            !localData.name ||
            localData.name.trim() === '' ||
            localData.name === 'Guest'
        );

    if (needsUsername) {
        const result = await promptForUsername({ offline: true });
        const offlineUsername = result?.offlineUsername;
        if (offlineUsername) {
            localData = localData || {};
            localData.name = offlineUsername;
            localData.friendCode = localData.friendCode || 'OFFLINE';
            setLocalPlayerData(localData);
            setAuthStorage({
                userId: null,
                username: offlineUsername,
                friendCode: 'OFFLINE'
            });
        }
    } else {
        if (existingAuth && !localData) {
            setLocalPlayerData({
                name: existingAuth.username,
                friendCode: existingAuth.friendCode || 'OFFLINE'
            });
        } else if (localData && !localData.friendCode) {
            setLocalPlayerData({ friendCode: existingAuth?.friendCode || 'OFFLINE' });
        }
    }

    await startOfflineGame(message);
}

async function fetchPlayerState(userId) {
    try {
        const profile = await api.getPlayer();
        const saveResponse = await api.getGameSave().catch(() => null);
        const localSave = captureLocalGameSave();
        const remoteSave = saveResponse?.gameSave;
        const mergedSave = getNewerGameSave(localSave, remoteSave);
        if (mergedSave) {
            applyGameSaveToLocal(mergedSave);
        }

        const collectionResponse = await api.getPlayerCollection(profile?.id || userId);
        let collection = null;

        if (collectionResponse) {
            if (Array.isArray(collectionResponse.caughtFish)) {
                collection = {};
                collectionResponse.caughtFish.forEach(entry => {
                    if (entry && entry.fishId !== undefined) {
                        collection[entry.fishId] = {
                            caught: true,
                            count: entry.count ?? 1,
                            firstCatchDate: entry.firstCatchDate || Date.now()
                        };
                    }
                });
            } else if (collectionResponse.caughtFish && typeof collectionResponse.caughtFish === 'object') {
                collection = collectionResponse.caughtFish;
            }
        }

        const localCollection = captureLocalGameSave()?.collection?.caughtFishCollection;
        if (localCollection && typeof localCollection === 'object') {
            collection = { ...collection, ...localCollection };
        }

        return {
            profile,
            collection,
            hasPin: normalizeHasPin(profile?.has_pin) || normalizeHasPin(saveResponse?.hasPin)
        };
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to fetch player state:', error);
        throw error;
    }
}

function setAuthMode(mode) {
    const isNew = mode === 'new';
    const isReturning = mode === 'returning';
    const isRecover = mode === 'recover';
    const helper = document.getElementById('username-helper');
    const pinInput = document.getElementById('pin-input');
    const pinConfirm = document.getElementById('pin-confirm-input');
    const friendCodeInput = document.getElementById('friend-code-input');
    const submitButton = document.getElementById('username-submit');
    const tabNew = document.getElementById('auth-tab-new');
    const tabReturning = document.getElementById('auth-tab-returning');
    const tabRecover = document.getElementById('auth-tab-recover');

    tabNew?.classList.toggle('active', isNew);
    tabReturning?.classList.toggle('active', isReturning);
    tabRecover?.classList.toggle('active', isRecover);
    tabNew?.setAttribute('aria-selected', String(isNew));
    tabReturning?.setAttribute('aria-selected', String(isReturning));
    tabRecover?.setAttribute('aria-selected', String(isRecover));

    if (helper) {
        if (isRecover) {
            helper.textContent =
                'Played before but never set a save PIN? Enter your username and friend code (Friends → Your Friend Code). You\'ll set a PIN right after.';
        } else if (isReturning) {
            helper.textContent = 'Enter your username and save PIN to restore your fisher cat on this device.';
        } else {
            helper.textContent = 'Pick a username and a private save PIN. You\'ll use both to restore progress on a new device.';
        }
    }

    pinInput?.classList.toggle('hidden', isRecover);
    pinConfirm?.classList.toggle('hidden', !isNew);
    friendCodeInput?.classList.toggle('hidden', !isRecover);

    if (pinInput) {
        pinInput.required = !isRecover;
        pinInput.placeholder = isRecover ? '' : 'Save PIN (4–6 digits)';
    }
    if (pinConfirm) {
        pinConfirm.required = isNew;
    }
    if (friendCodeInput) {
        friendCodeInput.required = isRecover;
    }

    if (submitButton) {
        if (isRecover) {
            submitButton.textContent = 'Recover My Save';
        } else if (isReturning) {
            submitButton.textContent = 'Restore My Save';
        } else {
            submitButton.textContent = 'Create Profile';
        }
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

function enableForm(input, button) {
    if (input) input.disabled = false;
    if (button) button.disabled = false;
}

function disableForm(input, button) {
    if (input) input.disabled = true;
    if (button) button.disabled = true;
}

async function promptForUsername(options = {}) {
    const { offline = false } = options;
    const modal = document.getElementById('username-modal');
    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');
    const pinInput = document.getElementById('pin-input');
    const pinConfirmInput = document.getElementById('pin-confirm-input');
    const friendCodeInput = document.getElementById('friend-code-input');
    const errorElement = document.getElementById('username-error');
    const submitButton = document.getElementById('username-submit');
    const helperText = document.getElementById('username-helper');
    const tabNew = document.getElementById('auth-tab-new');
    const tabReturning = document.getElementById('auth-tab-returning');
    const tabRecover = document.getElementById('auth-tab-recover');

    if (!modal || !form || !input || !pinInput || !submitButton) {
        throw new Error('Username modal elements are missing');
    }

    let authMode = 'new';

    hideError(errorElement);
    helperText?.classList.remove('hidden');
    modal.classList.remove('hidden');
    input.value = '';
    pinInput.value = '';
    if (pinConfirmInput) pinConfirmInput.value = '';
    if (friendCodeInput) friendCodeInput.value = '';

    if (offline) {
        tabNew?.classList.add('hidden');
        tabReturning?.classList.add('hidden');
        tabRecover?.classList.add('hidden');
        pinInput.classList.add('hidden');
        pinInput.required = false;
        pinConfirmInput?.classList.add('hidden');
        friendCodeInput?.classList.add('hidden');
        if (pinConfirmInput) pinConfirmInput.required = false;
        if (friendCodeInput) friendCodeInput.required = false;
        if (helperText) {
            helperText.textContent = 'Pick a username — progress saves on this device only while offline.';
        }
        if (submitButton) submitButton.textContent = 'Continue';
    } else {
        tabNew?.classList.remove('hidden');
        tabReturning?.classList.remove('hidden');
        tabRecover?.classList.remove('hidden');
        pinInput.classList.remove('hidden');
        friendCodeInput?.classList.remove('hidden');
        setAuthMode('new');
    }

    input.focus();

    return new Promise((resolve) => {
        const cleanupListeners = () => {
            form.removeEventListener('submit', handleSubmit);
            input.removeEventListener('input', handleInput);
            pinInput.removeEventListener('input', handleInput);
            pinConfirmInput?.removeEventListener('input', handleInput);
            friendCodeInput?.removeEventListener('input', handleInput);
            tabNew?.removeEventListener('click', onNewTab);
            tabReturning?.removeEventListener('click', onReturningTab);
            tabRecover?.removeEventListener('click', onRecoverTab);
        };

        const onNewTab = () => {
            authMode = 'new';
            setAuthMode('new');
            hideError(errorElement);
        };

        const onReturningTab = () => {
            authMode = 'returning';
            setAuthMode('returning');
            hideError(errorElement);
        };

        const onRecoverTab = () => {
            authMode = 'recover';
            setAuthMode('recover');
            hideError(errorElement);
        };

        const handleSubmit = async (event) => {
            event.preventDefault();
            hideError(errorElement);

            const username = input.value.trim();
            const pin = pinInput.value.trim();
            const friendCode = friendCodeInput?.value?.trim().toUpperCase() || '';

            if (!username) {
                showError(errorElement, 'Please enter a username.');
                return;
            }
            if (username.length < 3 || username.length > 20) {
                showError(errorElement, 'Username must be 3-20 characters.');
                return;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                showError(errorElement, 'Use letters, numbers, or underscores only.');
                return;
            }

            if (offline) {
                disableForm(input, submitButton);
                helperText?.classList.add('hidden');
                submitButton.textContent = 'Loading...';
                modal.classList.add('hidden');
                cleanupListeners();
                resolve({ offlineUsername: username });
                return;
            }

            if (authMode === 'recover') {
                if (!friendCode) {
                    showError(errorElement, 'Enter your friend code.');
                    return;
                }
            } else {
                const pinError = validatePinInput(pin);
                if (pinError) {
                    showError(errorElement, pinError);
                    return;
                }

                if (authMode === 'new' && pin !== pinConfirmInput?.value?.trim()) {
                    showError(errorElement, 'Save PINs do not match.');
                    return;
                }
            }

            disableForm(input, submitButton);
            pinInput.disabled = true;
            pinConfirmInput && (pinConfirmInput.disabled = true);
            friendCodeInput && (friendCodeInput.disabled = true);
            helperText?.classList.add('hidden');
            submitButton.textContent =
                authMode === 'recover' ? 'Recovering...' :
                authMode === 'returning' ? 'Restoring...' : 'Creating profile...';

            try {
                if (authMode === 'recover') {
                    const recovered = await api.recoverAccount(username, friendCode);
                    if (!recovered?.userId) {
                        throw new Error('Recovery failed');
                    }

                    api.setUserId(recovered.userId);
                    setAuthStorage({
                        userId: recovered.userId,
                        username: recovered.username,
                        friendCode: recovered.friendCode
                    });

                    if (recovered.gameSave) {
                        applyGameSaveToLocal(recovered.gameSave);
                    }

                    modal.classList.add('hidden');
                    cleanupListeners();

                    await promptForSavePin(api, { friendCode: recovered.friendCode });

                    const { profile, collection } = await fetchPlayerState(recovered.userId);
                    resolve({
                        profile,
                        collection,
                        auth: {
                            userId: recovered.userId,
                            username: recovered.username,
                            friendCode: recovered.friendCode
                        }
                    });
                    return;
                }

                if (authMode === 'returning') {
                    const login = await api.loginPlayer(username, pin);
                    if (!login?.userId) {
                        throw new Error('Sign in failed');
                    }

                    api.setUserId(login.userId);
                    setAuthStorage({
                        userId: login.userId,
                        username: login.username,
                        friendCode: login.friendCode
                    });

                    if (login.gameSave) {
                        applyGameSaveToLocal(login.gameSave);
                    }

                    const { profile, collection } = await fetchPlayerState(login.userId);

                    modal.classList.add('hidden');
                    cleanupListeners();
                    resolve({
                        profile,
                        collection,
                        auth: {
                            userId: login.userId,
                            username: login.username,
                            friendCode: login.friendCode
                        }
                    });
                    return;
                }

                const registration = await api.registerPlayer(username, pin);
                if (!registration?.userId) {
                    throw new Error('Registration failed');
                }

                api.setUserId(registration.userId);
                setAuthStorage({
                    userId: registration.userId,
                    username: registration.username,
                    friendCode: registration.friendCode
                });

                const { profile, collection } = await fetchPlayerState(registration.userId);

                modal.classList.add('hidden');
                cleanupListeners();
                resolve({
                    profile,
                    collection,
                    auth: {
                        userId: registration.userId,
                        username: registration.username,
                        friendCode: registration.friendCode
                    }
                });
            } catch (error) {
                console.error('[BOOTSTRAP] Auth failed:', error);
                showError(errorElement, error.message || 'Failed to sign in. Please try again.');
                enableForm(input, submitButton);
                pinInput.disabled = false;
                if (pinConfirmInput) pinConfirmInput.disabled = false;
                if (friendCodeInput) friendCodeInput.disabled = false;
                submitButton.textContent =
                    authMode === 'recover' ? 'Recover My Save' :
                    authMode === 'returning' ? 'Restore My Save' : 'Create Profile';
                helperText?.classList.remove('hidden');
            }
        };

        const handleInput = () => {
            hideError(errorElement);
        };

        tabNew?.addEventListener('click', onNewTab);
        tabReturning?.addEventListener('click', onReturningTab);
        tabRecover?.addEventListener('click', onRecoverTab);
        form.addEventListener('submit', handleSubmit);
        input.addEventListener('input', handleInput);
        pinInput.addEventListener('input', handleInput);
        pinConfirmInput?.addEventListener('input', handleInput);
        friendCodeInput?.addEventListener('input', handleInput);
    });
}

async function bootstrapGame() {
    try {
        await bootstrapGameInner();
    } catch (error) {
        console.error('[BOOTSTRAP] Fatal bootstrap error:', error);
        loadingProgress.suppress(false);
        loadingProgress.fail('Loading failed. Refresh the page or try again on Wi‑Fi.');
    }
}

async function bootstrapGameInner() {
    initAdRotator();
    loadingProgress.show('Connecting to Halley\'s Big Catch...');
    loadingProgress.update(2, 'Connecting to server...');

    const health = await api.healthCheck(10000);
    if (!health || health.status !== 'ok') {
        console.warn('[BOOTSTRAP] Health check failed, starting offline mode.', health?.message);
        await handleOfflineMode(health?.message);
        return;
    }

    try {
        loadingProgress.update(8, 'Server connected. Loading profile...');
        let auth = getAuthStorage();
        let profile = null;
        let collection = null;
        let hasPin = false;

        if (auth?.userId) {
            api.setUserId(auth.userId);
            try {
                loadingProgress.update(12, 'Syncing your fisher cat profile...');
                const result = await fetchPlayerState(auth.userId);
                profile = result.profile;
                collection = result.collection;
                hasPin = normalizeHasPin(result.hasPin);

                // Update stored data with latest canonical values
                auth = {
                    userId: profile?.id ?? auth.userId,
                    username: profile?.username ?? auth.username,
                    friendCode: profile?.friend_code ?? auth.friendCode
                };
                setAuthStorage(auth);
            } catch (error) {
                console.warn('[BOOTSTRAP] Existing auth invalid, requesting new username.', error);
                clearAuthStorage();
                auth = null;
                profile = null;
                collection = null;
                hasPin = false;
            }
        }

        if (!profile) {
            loadingProgress.update(14, 'Choose your fisher name...');
            const result = await promptForUsername();
            auth = result.auth;
            profile = result.profile;
            collection = result.collection;
            hasPin = true;
        } else if (!hasPin) {
            loadingProgress.update(14, 'Set your save PIN...');
            const friendCode = profile?.friend_code ?? profile?.friendCode ?? auth?.friendCode ?? null;
            await promptForSavePin(api, { friendCode });
            hasPin = true;
        }

        const playerContext = {
            userId: profile?.id ?? auth?.userId,
            username: profile?.username ?? auth?.username,
            friendCode: profile?.friend_code ?? profile?.friendCode ?? auth?.friendCode
        };

        api.setUserId(playerContext.userId);

        await ensureSavePin(api).catch((error) => {
            console.warn('[BOOTSTRAP] Save PIN safety check failed:', error);
        });

        await launchGame({
            api,
            playerContext,
            playerData: profile,
            fishCollection: collection
        });
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to start online mode, falling back to offline.', error);
        await handleOfflineMode(error?.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapGame);
} else {
    bootstrapGame();
}


