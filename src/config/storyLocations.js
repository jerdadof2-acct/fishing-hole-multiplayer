/** Story location indices — match `locations.js` array order (unlock progression). */

import { STARFISH_ID } from './starfishEncounter.js';

export const CRESCENT_POND_LOCATION_INDEX = 0;
export const SANDY_SHOALS_LOCATION_INDEX = 1;
export const CORAL_KINGDOMS_LOCATION_INDEX = 2;
export const AMAZON_DEPTHS_LOCATION_INDEX = 3;
export const CRAGGY_COAST_LOCATION_INDEX = 4;
export const FROZEN_FJORDS_LOCATION_INDEX = 5;
export const DESERT_LAGOON_LOCATION_INDEX = 6;
export const STORMBREAKER_BAY_LOCATION_INDEX = 7;
export const FORGOTTEN_REEFS_LOCATION_INDEX = 8;
export const TWILIGHT_TRENCH_LOCATION_INDEX = 9;

export const LOUISIANA_BAYOU_LOCATION_INDEX = 12;
export const CONGO_RIVER_LOCATION_INDEX = 13;
export const CRAZYCATCH_COVE_LOCATION_INDEX = 14;

export const LOUISIANA_BAYOU_NAME = 'Louisiana Bayou';
export const CONGO_RIVER_NAME = 'Congo River';
export const CRAZYCATCH_COVE_NAME = 'Starfall Lagoon';

export const TARPON_FISH_ID = 44;
export const TREASUREKEEPER_OCTOPUS_FISH_ID = 71;

export function hasCaughtStarfish(player) {
    return player?.isFishUnlocked?.(STARFISH_ID) === true;
}

/**
 * True when every fish assigned to this location is in the player's catalog.
 * @param {import('../player.js').Player|null|undefined} player
 * @param {{ fish?: number[] }|null|undefined} location
 */
export function hasCaughtAllLocationFish(player, location) {
    const fishIds = location?.fish;
    if (!player || !Array.isArray(fishIds) || fishIds.length === 0) {
        return false;
    }
    return fishIds.every((fishId) => player.isFishUnlocked?.(fishId) === true);
}

/**
 * Only Starfall Lagoon uses the Coming Soon label.
 * Congo River (and every other shore) is playable once unlocked.
 */
export function isComingSoonLocationIndex(locationIndex, player = null) {
    if (locationIndex !== CRAZYCATCH_COVE_LOCATION_INDEX) {
        return false;
    }
    if (player && Array.isArray(player.locationUnlocks)
        && player.locationUnlocks.includes(CRAZYCATCH_COVE_LOCATION_INDEX)) {
        return false;
    }
    return true;
}

export function isComingSoonLocation(location, player = null) {
    if (!location?.comingSoon || location.name !== CRAZYCATCH_COVE_NAME) {
        return false;
    }
    if (
        player
        && Array.isArray(player.locationUnlocks)
        && player.locationUnlocks.includes(CRAZYCATCH_COVE_LOCATION_INDEX)
    ) {
        return false;
    }
    return true;
}
