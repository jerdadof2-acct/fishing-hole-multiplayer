import {
    CELESTIAL_DEPTHS_LOCATION_INDEX,
    getRelicForGameLocation,
    HIDDEN_RELICS,
    RELIC_DISCOVERY_CHANCE,
    STARLIGHT_LURE_BAIT_ID
} from './config/hiddenRelics.js';

export { HIDDEN_RELICS, getRelicById, getRelicForGameLocation } from './config/hiddenRelics.js';

/**
 * Roll whether a relic surfaces on this cast (only if one remains at this location).
 * @param {import('./player.js').Player} player
 * @param {{ id: string }} relic
 * @returns {boolean}
 */
export function rollRelicDiscovery(player, relic) {
    if (!player || !relic || player.hasHiddenRelic(relic.id)) {
        return false;
    }

    const luckBonus = ((player.stats?.luck ?? 50) - 50) * 0.001;
    const chance = Math.min(0.22, RELIC_DISCOVERY_CHANCE + luckBonus);
    return Math.random() < chance;
}

/**
 * @param {import('./player.js').Player} player
 * @param {string} relicId
 * @returns {boolean} True if this was the final relic and lure was forged
 */
export function collectHiddenRelic(player, relicId) {
    if (!player || player.hasHiddenRelic(relicId)) {
        return false;
    }

    if (!Array.isArray(player.hiddenRelicsCollected)) {
        player.hiddenRelicsCollected = [];
    }

    player.hiddenRelicsCollected.push(relicId);
    const forged = player.hiddenRelicsCollected.length >= HIDDEN_RELICS.length;

    if (forged) {
        player.starlightLureCrafted = true;
        player.unlockStarlightLure();
    }

    player.syncStoryUnlocks();
    player.save({ skipSync: true });
    return forged;
}

export function getRelicCollectionProgress(player) {
    const collected = player?.hiddenRelicsCollected?.length ?? 0;
    return { collected, total: HIDDEN_RELICS.length };
}
