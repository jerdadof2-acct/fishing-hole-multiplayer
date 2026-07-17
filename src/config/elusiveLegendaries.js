/**
 * Journal-shore legendaries stay locked until the player has put in enough casts
 * at that location and caught every other species there first.
 */

/** Location indices — must match `locations.js` order. */
export const ELUSIVE_CORTEZ_LOCATION_INDEX = 11;
export const ELUSIVE_BAYOU_LOCATION_INDEX = 12;
export const ELUSIVE_CONGO_LOCATION_INDEX = 13;
export const ELUSIVE_STARFALL_LOCATION_INDEX = 14;

/** @typedef {{ locationIndex: number, fishId: number, castsRequired: number, name: string, locationName: string, revealBanner: string, revealBark: string }} ElusiveLegendaryGate */

/** @type {ElusiveLegendaryGate[]} */
export const ELUSIVE_LEGENDARY_GATES = [
    {
        locationIndex: ELUSIVE_CORTEZ_LOCATION_INDEX,
        fishId: 44, // Tarpon
        castsRequired: 28,
        name: 'Tarpon',
        locationName: 'Cortez Backwaters',
        revealBanner: 'A silver shadow stirs in the pass… the Silver King may finally take a bait.',
        revealBark: 'Something huge is out there, Dad. I can feel it.'
    },
    {
        locationIndex: ELUSIVE_BAYOU_LOCATION_INDEX,
        fishId: 61, // Paddlefish
        castsRequired: 32,
        name: 'Paddlefish',
        locationName: 'Louisiana Bayou',
        revealBanner: 'Deep in the channel, an ancient paddle cuts the dark water…',
        revealBark: 'The bayou’s holding something rare. I won’t leave empty-handed.'
    },
    {
        locationIndex: ELUSIVE_CONGO_LOCATION_INDEX,
        fishId: 65, // Goliath Tigerfish
        castsRequired: 36,
        name: 'Goliath Tigerfish',
        locationName: 'Congo River',
        revealBanner: 'The great current hides a hunter with knives for teeth…',
        revealBark: 'This is the fish from your journal sketches. It’s here.'
    },
    {
        locationIndex: ELUSIVE_STARFALL_LOCATION_INDEX,
        fishId: 71, // Treasurekeeper Octopus
        castsRequired: 40,
        name: 'Treasurekeeper Octopus',
        locationName: 'Starfall Lagoon',
        revealBanner: 'Gold glints among the wrecks… the Treasurekeeper may finally take the bait.',
        revealBark: 'Dad’s stories were true. The treasurekeeper is real.'
    }
];

/**
 * @param {{ name?: string }|null|undefined} location
 * @param {number} locationIndex
 * @returns {ElusiveLegendaryGate|null}
 */
export function getElusiveLegendaryGate(location, locationIndex = -1) {
    if (Number.isInteger(locationIndex) && locationIndex >= 0) {
        const byIndex = ELUSIVE_LEGENDARY_GATES.find((gate) => gate.locationIndex === locationIndex);
        if (byIndex) {
            return byIndex;
        }
    }
    const name = location?.name;
    if (!name) {
        return null;
    }
    return ELUSIVE_LEGENDARY_GATES.find((gate) => gate.locationName === name) || null;
}

/**
 * @param {import('../player.js').Player|null|undefined} player
 * @param {number} locationIndex
 * @returns {number}
 */
export function getLocationCastCount(player, locationIndex) {
    const counts = player?.locationCastCounts;
    if (!counts || typeof counts !== 'object') {
        return 0;
    }
    const value = counts[String(locationIndex)] ?? counts[locationIndex];
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * True when every non-legendary fish at this location is already in the catalog.
 * @param {import('../player.js').Player|null|undefined} player
 * @param {{ fish?: number[] }|null|undefined} location
 * @param {ElusiveLegendaryGate} gate
 */
export function hasCaughtAllOtherLocationFish(player, location, gate) {
    const fishIds = location?.fish;
    if (!player || !Array.isArray(fishIds) || fishIds.length === 0) {
        return false;
    }
    return fishIds
        .filter((id) => id !== gate.fishId)
        .every((fishId) => player.isFishUnlocked?.(fishId) === true);
}

/**
 * @param {import('../player.js').Player|null|undefined} player
 * @param {{ fish?: number[], name?: string }|null|undefined} location
 * @param {ElusiveLegendaryGate} gate
 * @param {number} [locationIndex]
 */
export function canSpawnElusiveLegendary(player, location, gate, locationIndex = gate.locationIndex) {
    if (!player || !gate) {
        return false;
    }
    if (getLocationCastCount(player, locationIndex) < gate.castsRequired) {
        return false;
    }
    // Already landed once — still rare after the cast gate, but stay in the pool for repeats.
    if (player.isFishUnlocked?.(gate.fishId) === true) {
        return true;
    }
    return hasCaughtAllOtherLocationFish(player, location, gate);
}

/**
 * Remove the locked legendary from the spawn pool when gates are not met.
 * @param {number[]} fishIds
 * @param {{ fish?: number[], name?: string }|null|undefined} location
 * @param {import('../player.js').Player|null|undefined} player
 * @param {number} [locationIndex]
 * @returns {number[]}
 */
export function applyElusiveLegendaryPoolFilter(fishIds, location, player, locationIndex = -1) {
    if (!Array.isArray(fishIds) || fishIds.length === 0) {
        return fishIds;
    }
    const gate = getElusiveLegendaryGate(location, locationIndex);
    if (!gate || !fishIds.includes(gate.fishId)) {
        return fishIds;
    }
    if (canSpawnElusiveLegendary(player, location, gate, gate.locationIndex)) {
        return fishIds;
    }
    return fishIds.filter((id) => id !== gate.fishId);
}
