import { getAdminUsername, isAdminUsername } from './adminAuth.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPlayerId(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ id: string, username: string }|null>}
 */
export async function getHalleyPlayer(pool) {
    const result = await pool.query(
        `SELECT id, username FROM players WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [getAdminUsername()]
    );
    return result.rows[0] || null;
}

/**
 * Accepted friendship between a player and Halley (no-op if Halley does not exist yet).
 * @param {import('pg').Pool} pool
 * @param {string} playerId
 * @returns {Promise<boolean>}
 */
export async function ensureHalleyFriendship(pool, playerId) {
    if (!isValidPlayerId(playerId)) {
        return false;
    }

    const halley = await getHalleyPlayer(pool);
    if (!halley || halley.id === playerId) {
        return false;
    }

    const [player1, player2] = playerId < halley.id
        ? [playerId, halley.id]
        : [halley.id, playerId];

    await pool.query(
        `INSERT INTO friendships (player1_id, player2_id, status, requested_by_id)
         VALUES ($1, $2, 'accepted', $3)
         ON CONFLICT (player1_id, player2_id)
         DO UPDATE SET status = 'accepted'`,
        [player1, player2, halley.id]
    );

    return true;
}

/**
 * When Halley registers (or on server start), link every other player automatically.
 * @param {import('pg').Pool} pool
 * @param {string} halleyId
 */
export async function backfillAllPlayersWithHalley(pool, halleyId) {
    if (!isValidPlayerId(halleyId)) {
        return;
    }

    await pool.query(
        `INSERT INTO friendships (player1_id, player2_id, status, requested_by_id)
         SELECT
             LEAST(p.id, $1::uuid),
             GREATEST(p.id, $1::uuid),
             'accepted',
             $1::uuid
         FROM players p
         WHERE p.id != $1::uuid
         ON CONFLICT (player1_id, player2_id)
         DO UPDATE SET status = 'accepted'`,
        [halleyId]
    );
}

/**
 * @param {object} friendRow
 * @returns {object}
 */
export function decorateFriendRow(friendRow) {
    if (!friendRow || typeof friendRow !== 'object') {
        return friendRow;
    }
    return {
        ...friendRow,
        is_auto_friend: isAdminUsername(friendRow.username)
    };
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} friendId
 * @returns {Promise<boolean>}
 */
export async function isHalleyPlayerId(pool, friendId) {
    const halley = await getHalleyPlayer(pool);
    return Boolean(halley && halley.id === friendId);
}

/**
 * Startup / deploy hook — keep every account paired with Halley when the star account exists.
 * @param {import('pg').Pool} pool
 */
export async function syncHalleyFriendships(pool) {
    const halley = await getHalleyPlayer(pool);
    if (!halley) {
        return;
    }
    await backfillAllPlayersWithHalley(pool, halley.id);
}
