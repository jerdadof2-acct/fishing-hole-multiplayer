/**
 * Remap saved location indices when the world map order changes.
 * v1 = layout before Amazon premium move (Jul 2026).
 * v2 = Coral second, Amazon premium (Jul 2026).
 * v3 = Louisiana Bayou, Congo River, Starfall Lagoon (display; internal CrazyCatch keys) (Jul 2026).
 * v4 = Story unlock order — Sandy Shoals before Coral Kingdoms, relic indices 0–9 sequential (Jul 2026).
 */

import {
    AMAZON_DEPTHS_NAME,
    CORAL_KINGDOMS_NAME,
    CORTEZ_BACKWATERS_NAME,
    CRAGGY_COAST_NAME,
    DESERT_LAGOON_NAME,
    FORGOTTEN_REEFS_NAME,
    FROZEN_FJORDS_NAME,
    SANDY_SHOALS_NAME,
    STORMBREAKER_BAY_NAME,
    TWILIGHT_TRENCH_NAME,
    LOUISIANA_BAYOU_NAME,
    CONGO_RIVER_NAME,
    CRAZYCATCH_COVE_NAME
} from './locations.js';

export const LOCATION_LAYOUT_VERSION = 4;

/** Location names in array order before v2 reorder. */
const V1_INDEX_TO_NAME = [
    'Crescent Pond',
    AMAZON_DEPTHS_NAME,
    CORAL_KINGDOMS_NAME,
    FROZEN_FJORDS_NAME,
    CRAGGY_COAST_NAME,
    SANDY_SHOALS_NAME,
    STORMBREAKER_BAY_NAME,
    FORGOTTEN_REEFS_NAME,
    TWILIGHT_TRENCH_NAME,
    'Celestial Depths',
    DESERT_LAGOON_NAME,
    CORTEZ_BACKWATERS_NAME
];

/** v2 layout — before post-Starfish expansion. */
const V2_INDEX_TO_NAME = [
    'Crescent Pond',
    CORAL_KINGDOMS_NAME,
    SANDY_SHOALS_NAME,
    DESERT_LAGOON_NAME,
    FROZEN_FJORDS_NAME,
    AMAZON_DEPTHS_NAME,
    STORMBREAKER_BAY_NAME,
    CRAGGY_COAST_NAME,
    TWILIGHT_TRENCH_NAME,
    FORGOTTEN_REEFS_NAME,
    'Celestial Depths',
    CORTEZ_BACKWATERS_NAME
];

/** v3 layout — before story-order reorder (Jul 2026). */
const V3_INDEX_TO_NAME = [
    'Crescent Pond',
    CORAL_KINGDOMS_NAME,
    SANDY_SHOALS_NAME,
    DESERT_LAGOON_NAME,
    FROZEN_FJORDS_NAME,
    AMAZON_DEPTHS_NAME,
    STORMBREAKER_BAY_NAME,
    CRAGGY_COAST_NAME,
    TWILIGHT_TRENCH_NAME,
    FORGOTTEN_REEFS_NAME,
    'Celestial Depths',
    CORTEZ_BACKWATERS_NAME,
    LOUISIANA_BAYOU_NAME,
    CONGO_RIVER_NAME,
    CRAZYCATCH_COVE_NAME
];

/**
 * @param {number} oldIndex
 * @param {string[]} indexToName
 * @param {Array<{ name: string }>} locations
 */
function remapByNameTable(oldIndex, indexToName, locations) {
    const name = indexToName[oldIndex];
    if (!name) {
        return oldIndex;
    }
    const next = locations.findIndex((loc) => loc.name === name);
    return next >= 0 ? next : oldIndex;
}

/**
 * @param {number} oldIndex
 * @param {Array<{ name: string }>} locations
 */
export function remapLegacyLocationIndex(oldIndex, locations) {
    return remapByNameTable(oldIndex, V1_INDEX_TO_NAME, locations);
}

/**
 * @param {{
 *   locationLayoutVersion?: number,
 *   locationUnlocks?: number[],
 *   currentLocationIndex?: number
 * }} playerData
 * @param {Array<{ name: string }>} locations
 */
export function migrateLocationSaveData(playerData, locations) {
    if (!playerData) {
        return playerData;
    }

    const version = playerData.locationLayoutVersion ?? 1;

    if (version < 2) {
        const remap = (idx) => remapByNameTable(idx, V1_INDEX_TO_NAME, locations);
        if (Array.isArray(playerData.locationUnlocks)) {
            playerData.locationUnlocks = [...new Set(playerData.locationUnlocks.map(remap))];
        }
        if (typeof playerData.currentLocationIndex === 'number') {
            playerData.currentLocationIndex = remap(playerData.currentLocationIndex);
        }
        playerData.locationLayoutVersion = 2;
    }

    if ((playerData.locationLayoutVersion ?? 2) < 3) {
        const remap = (idx) => remapByNameTable(idx, V2_INDEX_TO_NAME, locations);
        if (Array.isArray(playerData.locationUnlocks)) {
            playerData.locationUnlocks = [...new Set(playerData.locationUnlocks.map(remap))];
        }
        if (typeof playerData.currentLocationIndex === 'number') {
            playerData.currentLocationIndex = remap(playerData.currentLocationIndex);
        }
        playerData.locationLayoutVersion = 3;
    }

    if ((playerData.locationLayoutVersion ?? 3) < 4) {
        const remap = (idx) => remapByNameTable(idx, V3_INDEX_TO_NAME, locations);
        if (Array.isArray(playerData.locationUnlocks)) {
            playerData.locationUnlocks = [...new Set(playerData.locationUnlocks.map(remap))];
        }
        if (typeof playerData.currentLocationIndex === 'number') {
            playerData.currentLocationIndex = remap(playerData.currentLocationIndex);
        }
        playerData.locationLayoutVersion = LOCATION_LAYOUT_VERSION;
    }

    return playerData;
}

export {
    LOUISIANA_BAYOU_NAME,
    CONGO_RIVER_NAME,
    CRAZYCATCH_COVE_NAME
};
