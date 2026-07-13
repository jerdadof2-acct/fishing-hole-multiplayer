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

export function hasCaughtStarfish(player) {
    return player?.isFishUnlocked?.(STARFISH_ID) === true;
}

export function isComingSoonLocationIndex(locationIndex) {
    return locationIndex === CRAZYCATCH_COVE_LOCATION_INDEX;
}

export function isComingSoonLocation(location) {
    return location?.comingSoon === true;
}
