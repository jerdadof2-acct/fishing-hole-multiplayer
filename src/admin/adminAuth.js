import { isDevMode } from '../dev/devMode.js';

/**
 * Read admin flag from server profile/auth payloads.
 * @param {object|null|undefined} source
 * @returns {boolean}
 */
export function readIsAdmin(source) {
    if (!source || typeof source !== 'object') {
        return false;
    }
    return source.isAdmin === true || source.is_admin === true;
}

/**
 * Localhost dev tools or the Halley admin account (server-verified).
 * @param {{ isAdmin?: boolean }|null|undefined} player
 * @returns {boolean}
 */
export function hasPrivilegedAccess(player = null) {
    if (isDevMode()) {
        return true;
    }
    return player?.isAdmin === true;
}
