/**
 * Hidden sea relics — one per region (see DOCS/halleys-big-catch-story.md).
 * Collect all ten to forge the Starlight Lure and unlock the Celestial Depths.
 */

export const STARLIGHT_LURE_BAIT_ID = 6;
export const CELESTIAL_DEPTHS_LOCATION_INDEX = 9;

/** Chance per cast that an undiscovered relic surfaces instead of a normal bite. */
export const RELIC_DISCOVERY_CHANCE = 0.11;

export const HIDDEN_RELICS = [
    {
        id: 'weathered_bobber',
        name: 'Weathered Fishing Bobber',
        storyLocation: "Crescent Pond",
        gameLocation: 'Willow Pond',
        image: 'images/hiddenitems/weatheredbobber.png',
        message: 'The smallest ripples remember where they began.',
        meaning: "Halley's nostalgic connection to his childhood; the spark that began his love for fishing."
    },
    {
        id: 'driftwood_compass',
        name: 'Driftwood Compass',
        storyLocation: 'Sandy Shoals',
        gameLocation: 'Ocean Pier',
        image: 'images/hiddenitems/driftwoodcompass.png',
        message: 'The sea never forgets its course — only those who stop listening.',
        meaning: 'Unseen forces guide Halley toward his destiny.'
    },
    {
        id: 'sunken_treasure',
        name: 'Sunken Treasure Chest',
        storyLocation: 'Coral Kingdoms',
        gameLocation: 'Deep Sea',
        image: 'images/hiddenitems/sunkentreasure.png',
        message: 'Not all that glitters is gold. Some treasures remember your name.',
        meaning: 'The true treasure, the Starfish, is alive and aware.'
    },
    {
        id: 'message_in_bottle',
        name: 'Message in a Bottle',
        storyLocation: 'Amazon Depths',
        gameLocation: 'River Bend',
        image: 'images/hiddenitems/messageinthebottle.png',
        message: 'The stars once fell, and the sea still whispers their names.',
        meaning: 'A direct reference to the comet that birthed both Halley and the Starfish.'
    },
    {
        id: 'broken_harpoon',
        name: 'Broken Harpoon',
        storyLocation: 'Craggy Coast',
        gameLocation: 'Legendary Waters',
        image: 'images/hiddenitems/brokenharpoon.png',
        message: 'The hunter becomes the seeker when he lowers his spear.',
        meaning: 'Halley shifts from chasing trophies to seeking meaning.'
    },
    {
        id: 'frozen_pocket_watch',
        name: 'Frozen Pocket Watch',
        storyLocation: 'Frozen Fjords',
        gameLocation: 'Crystal Lake',
        image: 'images/hiddenitems/pocketwatch.png',
        message: 'Even time can sleep beneath the ice… but not forever.',
        meaning: 'Time stands still for what lies waiting in the depths.'
    },
    {
        id: 'buried_telescope',
        name: 'Half-Buried Telescope',
        storyLocation: 'Desert Lagoon',
        gameLocation: 'Secret Pond',
        image: 'images/hiddenitems/buriedtelescope.png',
        message: 'Look to the stars — the same light that guides the waves guides you.',
        meaning: "The comet's light still leads the way."
    },
    {
        id: 'map_fragment',
        name: 'Torn Map Fragment',
        storyLocation: 'Stormbreaker Bay',
        gameLocation: 'Abyss',
        image: 'images/hiddenitems/mapfragment.png',
        message: "The path forward isn't drawn in ink — it's carried in the current.",
        meaning: "The ocean's rhythm is Halley's only map."
    },
    {
        id: 'coral_pendant',
        name: 'Coral Pendant',
        storyLocation: 'Forgotten Reefs',
        gameLocation: 'Trophy Waters',
        image: 'images/hiddenitems/coralpendant.png',
        message: 'Two lights were born as one — one of the sky, one of the sea.',
        meaning: 'Confirms the bond between Halley and the Starfish of Eternity.'
    },
    {
        id: 'luminescent_shell',
        name: 'Luminescent Shell',
        storyLocation: 'Twilight Trench',
        gameLocation: 'Deep Lake',
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
    return HIDDEN_RELICS.find((relic) => relic.gameLocation === locationName) || null;
}
