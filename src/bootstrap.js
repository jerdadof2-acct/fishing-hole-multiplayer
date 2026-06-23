import Game from './main.js?v=20250622-15';
import { api } from './api.js';
import { initAdRotator } from './ads.js';
import { loadingProgress } from './loadingProgress.js';
import {
    markPrologueSeenForVersion,
    playStoryPrologue,
    shouldPlayStoryPrologue,
    shouldShowReturnSplash
} from './prologue.js';

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
    if (modal) {
        modal.classList.add('hidden');
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

        return { profile, collection };
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to fetch player state:', error);
        throw error;
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
    const errorElement = document.getElementById('username-error');
    const submitButton = document.getElementById('username-submit');
    const helperText = document.getElementById('username-helper');

    if (!modal || !form || !input || !submitButton) {
        throw new Error('Username modal elements are missing');
    }

    hideError(errorElement);
    helperText?.classList.remove('hidden');
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();

    return new Promise((resolve) => {
        const handleSubmit = async (event) => {
            event.preventDefault();
            hideError(errorElement);

            const username = input.value.trim();
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

            disableForm(input, submitButton);
            helperText?.classList.add('hidden');
            submitButton.textContent = 'Creating profile...';

            try {
                if (offline) {
                    modal.classList.add('hidden');
                    submitButton.textContent = 'Create Profile';
                    enableForm(input, submitButton);
                    form.removeEventListener('submit', handleSubmit);
                    input.removeEventListener('input', handleInput);
                    resolve({ offlineUsername: username });
                    return;
                }

                const registration = await api.registerPlayer(username);
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
                form.removeEventListener('submit', handleSubmit);
                input.removeEventListener('input', handleInput);
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
                console.error('[BOOTSTRAP] Registration failed:', error);
                showError(errorElement, error.message || 'Failed to create user. Please try again.');
                enableForm(input, submitButton);
                submitButton.textContent = 'Create Profile';
                helperText?.classList.remove('hidden');
            }
        };

        const handleInput = () => {
            hideError(errorElement);
        };

        form.addEventListener('submit', handleSubmit);
        input.addEventListener('input', handleInput);
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

        if (auth?.userId) {
            api.setUserId(auth.userId);
            try {
                loadingProgress.update(12, 'Syncing your fisher cat profile...');
                const result = await fetchPlayerState(auth.userId);
                profile = result.profile;
                collection = result.collection;

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
            }
        }

        if (!profile) {
            loadingProgress.update(14, 'Choose your fisher name...');
            const result = await promptForUsername();
            auth = result.auth;
            profile = result.profile;
            collection = result.collection;
        }

        const playerContext = {
            userId: profile?.id ?? auth?.userId,
            username: profile?.username ?? auth?.username,
            friendCode: profile?.friend_code ?? profile?.friendCode ?? auth?.friendCode
        };

        api.setUserId(playerContext.userId);

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


