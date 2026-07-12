import {
    CELESTIAL_DEPTHS_LOCATION_INDEX,
    HIDDEN_RELICS,
    STARLIGHT_LURE_BAIT_ID
} from './config/hiddenRelics.js';
import { reconcileStoryLocationUnlocks } from './storyProgress.js';

export { HIDDEN_RELICS, getRelicById, getRelicForGameLocation } from './config/hiddenRelics.js';
export {
    getNextStoryRelicId,
    getRelicForActiveRelic,
    isRelicEligible,
    rollStoryRelicDiscovery,
    recordSuccessfulCatchForRelicProgress,
    markAmazonAnacondaSighted,
    getPendingChapterForRelic,
    markChapterComplete,
    canTravelToStoryLocation,
    isStoryLocationAvailable
} from './storyProgress.js';

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
    // Must sync: location unlocks depend on relics and must follow the account across devices.
    player.save();
    return forged;
}

export function getRelicCollectionProgress(player) {
    const collected = player?.hiddenRelicsCollected?.length ?? 0;
    return { collected, total: HIDDEN_RELICS.length };
}

export { CELESTIAL_DEPTHS_LOCATION_INDEX, STARLIGHT_LURE_BAIT_ID };
