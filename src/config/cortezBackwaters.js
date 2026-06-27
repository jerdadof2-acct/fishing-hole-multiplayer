/** Cortez Backwaters — post-Starfish hidden Gulf Coast location. */

import { STARFISH_ID } from './starfishEncounter.js';

export const CORTEZ_BACKWATERS_LOCATION_INDEX = 11;

/** Weighted spawn table for Cortez species (see DOCS/future-locations/cortez-backwaters.md). */
export const CORTEZ_FISH_SPAWN_WEIGHTS = {
    39: 34, // Speckled Trout
    40: 25, // Southern Flounder
    41: 18, // Sheepshead
    42: 12, // Redfish
    43: 8,  // Snook
    44: 3   // Tarpon — Silver King of Cortez
};

export function canAccessCortezBackwaters(player) {
    return player?.isFishUnlocked?.(STARFISH_ID) === true;
}

export function pickCortezFishId(random = Math.random) {
    const entries = Object.entries(CORTEZ_FISH_SPAWN_WEIGHTS);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;

    for (const [id, weight] of entries) {
        roll -= weight;
        if (roll <= 0) {
            return Number(id);
        }
    }

    return Number(entries[entries.length - 1][0]);
}
