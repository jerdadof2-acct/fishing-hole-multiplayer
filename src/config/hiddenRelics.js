/**
 * Hidden sea relics — one per region (see DOCS/halleys-big-catch-story.md).
 * Collect all ten to forge the Starlight Lure and unlock the Celestial Depths.
 */

export const STARLIGHT_LURE_BAIT_ID = 6;
export const CELESTIAL_DEPTHS_LOCATION_INDEX = 9;

/** Art for the forged Starlight Lure (shop, forge popup, relics logbook). */
export const STARLIGHT_LURE_IMAGE = 'images/hiddenitems/starlightlure.png';

/** Chance per cast that an undiscovered relic surfaces instead of a normal bite. */
export const RELIC_DISCOVERY_CHANCE = 0.11;

export const HIDDEN_RELICS = [
    {
        id: 'weathered_bobber',
        name: 'Weathered Fishing Bobber',
        location: 'Crescent Pond',
        image: 'images/hiddenitems/weatheredbobber.png',
        message: 'The smallest ripples remember where they began.',
        meaning: "Halley's nostalgic connection to his childhood; the spark that began his love for fishing."
    },
    {
        id: 'driftwood_compass',
        name: 'Driftwood Compass',
        location: 'Sandy Shoals',
        image: 'images/hiddenitems/driftwoodcompass.png',
        message: 'The sea never forgets its course — only those who stop listening.',
        meaning: 'Unseen forces guide Halley toward his destiny.'
    },
    {
        id: 'sunken_treasure',
        name: 'Sunken Treasure Chest',
        location: 'Coral Kingdoms',
        image: 'images/hiddenitems/sunkentreasure.png',
        message: 'Not all that glitters is gold. Some treasures remember your name.',
        meaning: 'The true treasure, the Starfish, is alive and aware.'
    },
    {
        id: 'message_in_bottle',
        name: 'Message in a Bottle',
        location: 'Amazon Depths',
        image: 'images/hiddenitems/messageinthebottle.png',
        message: 'The stars once fell, and the sea still whispers their names.',
        meaning: 'A direct reference to the comet that birthed both Halley and the Starfish.'
    },
    {
        id: 'broken_harpoon',
        name: 'Broken Harpoon',
        location: 'Craggy Coast',
        image: 'images/hiddenitems/brokenharpoon.png',
        message: 'The hunter becomes the seeker when he lowers his spear.',
        meaning: 'Halley shifts from chasing trophies to seeking meaning.'
    },
    {
        id: 'frozen_pocket_watch',
        name: 'Frozen Pocket Watch',
        location: 'Frozen Fjords',
        image: 'images/hiddenitems/pocketwatch.png',
        message: 'Even time can sleep beneath the ice… but not forever.',
        meaning: 'Time stands still for what lies waiting in the depths.'
    },
    {
        id: 'buried_telescope',
        name: 'Half-Buried Telescope',
        location: 'Desert Lagoon',
        image: 'images/hiddenitems/buriedtelescope.png',
        message: 'Look to the stars — the same light that guides the waves guides you.',
        meaning: "The comet's light still leads the way."
    },
    {
        id: 'map_fragment',
        name: 'Torn Map Fragment',
        location: 'Stormbreaker Bay',
        image: 'images/hiddenitems/mapfragment.png',
        message: "The path forward isn't drawn in ink — it's carried in the current.",
        meaning: "The ocean's rhythm is Halley's only map."
    },
    {
        id: 'coral_pendant',
        name: 'Coral Pendant',
        location: 'Forgotten Reefs',
        image: 'images/hiddenitems/coralpendant.png',
        message: 'Two lights were born as one — one of the sky, one of the sea.',
        meaning: 'Confirms the bond between Halley and the Starfish of Eternity.'
    },
    {
        id: 'luminescent_shell',
        name: 'Luminescent Shell',
        location: 'Twilight Trench',
        image: 'images/hiddenitems/luminescentshell.png',
        message: 'The ocean remembers every spark. Follow its glow — it remembers you.',
        meaning: 'The final message; the Starfish remembers Halley and awaits the reunion.'
    }
];

export function getRelicById(id) {
    return HIDDEN_RELICS.find((relic) => relic.id === id) || null;
}

export function getRelicForGameLocation(locationName) {
    if (!locationName) return null;
    return HIDDEN_RELICS.find((relic) => relic.location === locationName) || null;
}
