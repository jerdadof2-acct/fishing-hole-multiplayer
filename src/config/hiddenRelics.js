/**
 * Hidden sea relics — one per region (see DOCS/halleys-big-catch-story.md).
 * Collect all ten to forge the Starlight Lure and unlock the Celestial Depths.
 */

export const STARLIGHT_LURE_BAIT_ID = 6;
export const STARLIGHT_LURE_BAIT_NAME = 'Starlight Lure';
export const CELESTIAL_DEPTHS_LOCATION_INDEX = 10;

/** True when the item/id/name is the relic-forged Starlight Lure bait. */
export function isStarlightLureBait(itemOrId) {
    if (typeof itemOrId === 'number') {
        return itemOrId === STARLIGHT_LURE_BAIT_ID;
    }
    if (typeof itemOrId === 'string') {
        return itemOrId === STARLIGHT_LURE_BAIT_NAME;
    }
    return itemOrId?.id === STARLIGHT_LURE_BAIT_ID || itemOrId?.name === STARLIGHT_LURE_BAIT_NAME;
}

/** Art for the forged Starlight Lure (shop, forge popup, relics logbook). */
export const STARLIGHT_LURE_IMAGE = 'images/hiddenitems/starlightlure.png';

/** @deprecated Relic discovery uses storyProgress.js (successful catches + tier curve). */
export const RELIC_DISCOVERY_CHANCE = 0.11;
/** @deprecated */
export const RELIC_DISCOVERY_PITY_CASTS = 18;
/** @deprecated */
export const RELIC_DISCOVERY_PITY_STEP = 0.028;

export function isStoryGatedLocation(location) {
    return location?.requiresStarlightLure === true || location?.waterBodyType === 'CELESTIAL';
}

export const HIDDEN_RELICS = [
    {
        id: 'weathered_bobber',
        name: 'Weathered Fishing Bobber',
        location: 'Crescent Pond',
        image: 'images/hiddenitems/weatheredbobber.png',
        message: 'The smallest ripples remember where they began.',
        meaning: "Halley's first fishing lessons with his father — where the smallest ripples began."
    },
    {
        id: 'driftwood_compass',
        name: 'Driftwood Compass',
        location: 'Sandy Shoals',
        image: 'images/hiddenitems/driftwoodcompass.png',
        message: 'The sea never forgets its course — only those who stop listening.',
        meaning: 'A lesson his father taught: listen before you command the water.'
    },
    {
        id: 'sunken_treasure',
        name: 'Sunken Treasure Chest',
        location: 'Coral Kingdoms',
        image: 'images/hiddenitems/sunkentreasure.png',
        message: 'Not all that glitters is gold. Some treasures remember your name.',
        meaning: 'His father taught that the value of a trip is never measured by what you bring home.'
    },
    {
        id: 'message_in_bottle',
        name: 'Message in a Bottle',
        location: 'Amazon Depths',
        image: 'images/hiddenitems/messageinthebottle.png',
        message: 'The stars once fell, and the waters carried their voices.',
        meaning: 'The comet scattered its light — Halley\'s medallion is answering something far below.'
    },
    {
        id: 'broken_harpoon',
        name: 'Broken Harpoon',
        location: 'Craggy Coast',
        image: 'images/hiddenitems/brokenharpoon.png',
        message: 'The seeker finds what the hunter cannot.',
        meaning: 'Halley remembers his father releasing the greatest fish they ever hooked — and finally understands why.'
    },
    {
        id: 'frozen_pocket_watch',
        name: 'Frozen Pocket Watch',
        location: 'Frozen Fjords',
        image: 'images/hiddenitems/pocketwatch.png',
        message: 'Some moments wait beneath the surface until their time returns.',
        meaning: 'Ordinary fishing days with his father were building a bond Halley only now sees clearly.'
    },
    {
        id: 'buried_telescope',
        name: 'Half-Buried Telescope',
        location: 'Desert Lagoon',
        image: 'images/hiddenitems/buriedtelescope.png',
        message: 'One light crossed the sky. Another waits below.',
        meaning: 'A second comet fragment fell into the sea the night Halley was born.'
    },
    {
        id: 'map_fragment',
        name: 'Torn Map Fragment',
        location: 'Stormbreaker Bay',
        image: 'images/hiddenitems/mapfragment.png',
        message: 'No map can mark a place that moves with the stars and tide.',
        meaning: 'The path forward is carried in memory as much as in water.'
    },
    {
        id: 'coral_pendant',
        name: 'Coral Pendant',
        location: 'Forgotten Reefs',
        image: 'images/hiddenitems/coralpendant.png',
        message: 'Two fragments still answer the same light.',
        meaning: 'The medallion carries comet-light and the memories formed around it — including his father\'s voice.'
    },
    {
        id: 'luminescent_shell',
        name: 'Luminescent Shell',
        location: 'Twilight Trench',
        image: 'images/hiddenitems/luminescentshell.png',
        message: 'Return every echo to the light, and the hidden depths will open.',
        meaning: 'Ten echoes form the path; Halley ties the Starlight Lure with the knot his father taught him.'
    }
];

export function getRelicById(id) {
    return HIDDEN_RELICS.find((relic) => relic.id === id) || null;
}

export function getRelicForGameLocation(locationName) {
    if (!locationName) return null;
    return HIDDEN_RELICS.find((relic) => relic.location === locationName) || null;
}
