/**
 * Server-side admin identity — only this username receives admin powers.
 * Override on Render with ADMIN_USERNAME if needed.
 */
const DEFAULT_ADMIN_USERNAME = 'Halley';

export function getAdminUsername() {
    const configured = process.env.ADMIN_USERNAME?.trim();
    return configured || DEFAULT_ADMIN_USERNAME;
}

export function isAdminUsername(username) {
    if (!username || typeof username !== 'string') {
        return false;
    }
    return username.trim().toLowerCase() === getAdminUsername().toLowerCase();
}

export function withAdminFlag(playerRow) {
    if (!playerRow || typeof playerRow !== 'object') {
        return playerRow;
    }
    return {
        ...playerRow,
        isAdmin: isAdminUsername(playerRow.username)
    };
}
