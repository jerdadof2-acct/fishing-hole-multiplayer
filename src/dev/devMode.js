/** Large-boat locations for local boat / ocean preview. */
export const DEV_OCEAN_BOAT_LOCATION_INDICES = [5, 6, 7, 8, 9];

/** Post-story hidden locations for local preview. */
export const DEV_HIDDEN_LOCATION_INDICES = [11];

/**
 * True on localhost, 127.0.0.1, or when ?dev=1 / ?storytest=1 is in the URL.
 */
export function isDevMode() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const params = new URLSearchParams(window.location.search);
    return isLocalHost || params.has('dev') || params.has('storytest');
}

/**
 * Unlock all ocean / large-boat locations for local preview.
 * @param {import('../player.js').Player} player
 * @param {import('../locations.js').Locations} locations
 * @returns {boolean} whether any unlock was added
 */
export function applyDevOceanUnlocks(player, locations) {
    if (!isDevMode() || !player || !locations?.locations) return false;

    let added = false;
    for (const index of DEV_OCEAN_BOAT_LOCATION_INDICES) {
        if (index < 0 || index >= locations.locations.length) continue;
        if (!player.locationUnlocks.includes(index)) {
            player.locationUnlocks.push(index);
            added = true;
        }
    }

    for (const index of DEV_HIDDEN_LOCATION_INDICES) {
        if (index < 0 || index >= locations.locations.length) continue;
        if (!player.locationUnlocks.includes(index)) {
            player.locationUnlocks.push(index);
            added = true;
        }
    }

    if (added) {
        player.save({ skipSync: true });
        console.info('[DEV] Ocean / large-boat locations unlocked for preview:', DEV_OCEAN_BOAT_LOCATION_INDICES);
    }

    return added;
}

/**
 * @param {import('../locations.js').Locations} locations
 * @returns {{ index: number, name: string, waterBodyType: string }[]}
 */
export function getDevOceanBoatLocations(locations) {
    if (!locations?.locations) return [];
    return DEV_OCEAN_BOAT_LOCATION_INDICES
        .map((index) => {
            const loc = locations.locations[index];
            if (!loc) return null;
            return { index, name: loc.name, waterBodyType: loc.waterBodyType };
        })
        .filter(Boolean);
}
