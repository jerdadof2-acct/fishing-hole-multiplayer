import Game from './main.js?v=20250625-pine-shape';
import { api } from './api.js';
import { initAdRotator } from './ads.js';
import { ensureProloguePack, prefetchProloguePack, startDeferredPackDownload } from './assetPack.js';
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
    switchToDifferentAccount,
    validatePinInput
} from './savePinSetup.js';
import { readIsAdmin } from './admin/adminAuth.js';

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

    let prologuePack = null;

    if (needsPreEntry) {
        loadingProgress.suppress(false);
        loadingProgress.update(16, 'Loading story…');
        try {
            prologuePack = await ensureProloguePack({
                full: playFullPrologue,
                onProgress: (percent, message) => {
                    loadingProgress.update(16 + Math.round(percent * 0.14), message);
                }
            });
        } catch (error) {
            console.error('[BOOTSTRAP] Prologue pack failed:', error);
            loadingProgress.fail('Could not load story assets. Check your connection and refresh.');
            throw error;
        }
        loadingProgress.suppress(true);
        loadingProgress.update(18, 'Loading Halley\'s Big Catch…');
    } else {
        loadingProgress.update(18, 'Starting the lake...');
    }

    startDeferredPackDownload({ silent: true, delayMs: 5000 });

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
            preloadedPack: prologuePack,
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
            preloadedPack: prologuePack,
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
    const helper = document.getElementById('username-helper');
    const pinInput = document.getElementById('pin-input');
    const pinConfirm = document.getElementById('pin-confirm-input');
    const submitButton = document.getElementById('username-submit');
    const tabNew = document.getElementById('auth-tab-new');
    const tabReturning = document.getElementById('auth-tab-returning');

    tabNew?.classList.toggle('active', isNew);
    tabReturning?.classList.toggle('active', isReturning);
    tabNew?.setAttribute('aria-selected', String(isNew));
    tabReturning?.setAttribute('aria-selected', String(isReturning));

    if (helper) {
        if (isReturning) {
            helper.textContent =
                'Enter your username. If you already set a save PIN, enter it too. ' +
                'If this is an older account you never secured, leave PIN blank — we\'ll ask you to set one and claim the save.';
        } else {
            helper.textContent = 'Pick a username and a private save PIN. You\'ll use both to restore progress on a new device.';
        }
    }

    pinInput?.classList.toggle('hidden', false);
    pinConfirm?.classList.toggle('hidden', !isNew);

    if (pinInput) {
        pinInput.required = isNew;
        pinInput.placeholder = isReturning
            ? 'Save PIN (optional — leave blank to claim older account)'
            : 'Save PIN (4–6 digits)';
    }
    if (pinConfirm) {
        pinConfirm.required = isNew;
    }

    if (submitButton) {
        submitButton.textContent = isReturning ? 'Continue' : 'Create Profile';
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

async function finishClaimedAccount(claimed) {
    if (!claimed?.userId) {
        throw new Error('Could not claim account');
    }

    api.setUserId(claimed.userId);
    setAuthStorage({
        userId: claimed.userId,
        username: claimed.username,
        friendCode: claimed.friendCode
    });

    if (claimed.gameSave) {
        applyGameSaveToLocal(claimed.gameSave);
    }

    await promptForSavePin(api, { friendCode: claimed.friendCode });

    const { profile, collection } = await fetchPlayerState(claimed.userId);
    return {
        profile,
        collection,
        auth: {
            userId: claimed.userId,
            username: claimed.username,
            friendCode: claimed.friendCode
        }
    };
}

async function promptForUsername(options = {}) {
    const { offline = false, defaultMode = 'new' } = options;
    const modal = document.getElementById('username-modal');
    const form = document.getElementById('username-form');
    const input = document.getElementById('username-input');
    const pinInput = document.getElementById('pin-input');
    const pinConfirmInput = document.getElementById('pin-confirm-input');
    const errorElement = document.getElementById('username-error');
    const submitButton = document.getElementById('username-submit');
    const helperText = document.getElementById('username-helper');
    const switchAccountButton = document.getElementById('auth-switch-account');
    const tabNew = document.getElementById('auth-tab-new');
    const tabReturning = document.getElementById('auth-tab-returning');

    if (!modal || !form || !input || !pinInput || !submitButton) {
        throw new Error('Username modal elements are missing');
    }

    let authMode = defaultMode === 'returning' ? 'returning' : 'new';

    hideError(errorElement);
    helperText?.classList.remove('hidden');
    modal.classList.remove('hidden');
    input.value = '';
    pinInput.value = '';
    if (pinConfirmInput) pinConfirmInput.value = '';

    if (offline) {
        tabNew?.classList.add('hidden');
        tabReturning?.classList.add('hidden');
        switchAccountButton?.classList.add('hidden');
        pinInput.classList.add('hidden');
        pinInput.required = false;
        pinConfirmInput?.classList.add('hidden');
        if (pinConfirmInput) pinConfirmInput.required = false;
        if (helperText) {
            helperText.textContent = 'Pick a username — progress saves on this device only while offline.';
        }
        if (submitButton) submitButton.textContent = 'Continue';
    } else {
        tabNew?.classList.remove('hidden');
        tabReturning?.classList.remove('hidden');
        switchAccountButton?.classList.toggle('hidden', !getAuthStorage()?.userId);
        pinInput.classList.remove('hidden');
        setAuthMode(authMode);
    }

    input.focus();

    return new Promise((resolve) => {
        const cleanupListeners = () => {
            form.removeEventListener('submit', handleSubmit);
            input.removeEventListener('input', handleInput);
            pinInput.removeEventListener('input', handleInput);
            pinConfirmInput?.removeEventListener('input', handleInput);
            tabNew?.removeEventListener('click', onNewTab);
            tabReturning?.removeEventListener('click', onReturningTab);
            switchAccountButton?.removeEventListener('click', onSwitchAccount);
        };

        const onSwitchAccount = () => {
            switchToDifferentAccount();
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

        const handleSubmit = async (event) => {
            event.preventDefault();
            hideError(errorElement);

            const username = input.value.trim();
            const pin = pinInput.value.trim();

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

            if (authMode === 'returning') {
                if (!pin) {
                    // Claim older account — username only, then set save PIN
                } else {
                    const pinError = validatePinInput(pin);
                    if (pinError) {
                        showError(errorElement, pinError);
                        return;
                    }
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
            helperText?.classList.add('hidden');
            submitButton.textContent =
                authMode === 'returning'
                    ? (pin ? 'Signing in...' : 'Claiming account...')
                    : 'Creating profile...';

            try {
                if (authMode === 'returning' && !pin) {
                    const claimed = await api.claimAccount(username);
                    modal.classList.add('hidden');
                    cleanupListeners();
                    resolve(await finishClaimedAccount(claimed));
                    return;
                }

                if (authMode === 'returning') {
                    try {
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
                    } catch (loginError) {
                        const message = loginError?.message || '';
                        if (message.toLowerCase().includes('no save pin')) {
                            showError(
                                errorElement,
                                'This account is not secured yet. Clear the PIN field and tap Continue to claim it and set a save PIN.'
                            );
                            return;
                        }
                        throw loginError;
                    }
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
                submitButton.textContent = authMode === 'returning' ? 'Continue' : 'Create Profile';
                helperText?.classList.remove('hidden');
            }
        };

        const handleInput = () => {
            hideError(errorElement);
        };

        tabNew?.addEventListener('click', onNewTab);
        tabReturning?.addEventListener('click', onReturningTab);
        switchAccountButton?.addEventListener('click', onSwitchAccount);
        form.addEventListener('submit', handleSubmit);
        input.addEventListener('input', handleInput);
        pinInput.addEventListener('input', handleInput);
        pinConfirmInput?.addEventListener('input', handleInput);
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

    // Begin loading prologue media during auth — does not block server connect.
    if (shouldPlayStoryPrologue()) {
        prefetchProloguePack({ full: true });
    } else if (shouldShowReturnSplash()) {
        prefetchProloguePack({ full: false });
    }

    const health = await api.healthCheck(10000);
    if (!health || health.status !== 'ok') {
        console.warn('[BOOTSTRAP] Health check failed, starting offline mode.', health?.message);
        await handleOfflineMode(health?.message);
        return;
    }

    try {
        loadingProgress.update(8, 'Server connected. Loading profile...');

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('signin')) {
            clearAuthStorage();
        }

        let preferReturning = false;
        try {
            preferReturning = sessionStorage.getItem('preferReturningAuth') === '1';
            if (preferReturning) {
                sessionStorage.removeItem('preferReturningAuth');
            }
        } catch {
            /* ignore */
        }

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
            const result = await promptForUsername({
                defaultMode: preferReturning || urlParams.has('signin') ? 'returning' : 'new'
            });
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
            friendCode: profile?.friend_code ?? profile?.friendCode ?? auth?.friendCode,
            isAdmin: readIsAdmin(profile)
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


