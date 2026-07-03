/**
 * Remap saved location indices when the world map order changes.
 * v1 = layout before Amazon premium move (Jul 2026).
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
    TWILIGHT_TRENCH_NAME
} from './locations.js';

export const LOCATION_LAYOUT_VERSION = 2;

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

/**
 * @param {number} oldIndex
 * @param {Array<{ name: string }>} locations
 */
export function remapLegacyLocationIndex(oldIndex, locations) {
    const name = V1_INDEX_TO_NAME[oldIndex];
    if (!name) {
        return oldIndex;
    }
    const next = locations.findIndex((loc) => loc.name === name);
    return next >= 0 ? next : oldIndex;
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
    if (!playerData || (playerData.locationLayoutVersion ?? 1) >= LOCATION_LAYOUT_VERSION) {
        return playerData;
    }

    const remap = (idx) => remapLegacyLocationIndex(idx, locations);

    if (Array.isArray(playerData.locationUnlocks)) {
        playerData.locationUnlocks = [...new Set(playerData.locationUnlocks.map(remap))];
    }
    if (typeof playerData.currentLocationIndex === 'number') {
        playerData.currentLocationIndex = remap(playerData.currentLocationIndex);
    }
    playerData.locationLayoutVersion = LOCATION_LAYOUT_VERSION;
    return playerData;
}
