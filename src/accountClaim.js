/**
 * In-game claim flow for older accounts that never received a save PIN.
 */

import { applyGameSaveToLocal } from './cloudSave.js';
import {
    normalizeHasPin,
    promptForSavePin,
    setAuthStorage
} from './savePinSetup.js';

/**
 * Claim an unclaimed account by username, set save PIN, reload with that save.
 * @param {import('./api.js').API} api
 * @param {string} username
 */
export async function claimAccountByUsername(api, username) {
    const trimmed = (username || '').trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
        throw new Error('Username must be 3–20 characters.');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        throw new Error('Use letters, numbers, or underscores only.');
    }

    const claimed = await api.claimAccount(trimmed);
    if (!claimed?.userId) {
        throw new Error('Could not claim that account.');
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

    window.location.reload();
}

export async function getAccountSecurityStatus(api) {
    if (!api?.userId) {
        return { online: false, username: null, hasPin: false };
    }

    try {
        const [profile, saveInfo] = await Promise.all([
            api.getPlayer(),
            api.getGameSave()
        ]);

        return {
            online: true,
            username: profile?.username ?? null,
            friendCode: profile?.friend_code ?? profile?.friendCode ?? null,
            hasPin: normalizeHasPin(saveInfo?.hasPin) || normalizeHasPin(profile?.has_pin)
        };
    } catch (error) {
        console.warn('[ACCOUNT] Failed to load security status:', error);
        return { online: true, username: null, hasPin: false, error };
    }
}
