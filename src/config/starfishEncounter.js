/** Starfish of Eternity — Celestial Depths reunion (Ch. 5–6). */

export const STARFISH_ID = 33;
export const STARLIGHT_LURE_BAIT_NAME = 'Starlight Lure';

export const STARFISH_GUIDE_DESTINATIONS_HEADLINE =
    'The Starfish opened the path — your father gave it meaning.';

export const STARFISH_GUIDE_DESTINATIONS_BODY =
    'Four golden currents spread from the Celestial Depths. One leads home to Cortez Backwaters. Three more toward the unfinished adventures in your father\'s journal.';

/** Post-Starfish destinations the Starfish reveals after the reunion. */
export const STARFISH_GUIDE_DESTINATIONS_OPEN = [
    { name: 'Cortez Backwaters', label: 'Return home — tell your father' },
    { name: 'Louisiana Bayou', label: 'An unfinished page in his journal' },
    { name: 'Congo River', label: 'His greatest fishing dream' },
    { name: 'CrazyCatch Cove', label: 'A story that became real' }
];

export const STARFISH_GUIDE_COMING_SOON = '';

export const STARFISH_FIRST_CATCH_QUOTE =
    "The comet may have started this journey.\n\nBut you're the reason I was ready for it.";

export const STARFISH_FIRST_CATCH_NARRATION = [
    'The Starfish showed Halley the night his father made the medallion.',
    'The stone had fallen from the sky, but his father had turned it into a gift.',
    'Over the years it had carried every lesson, every laugh, and every quiet moment shared beside the water.',
    'The medallion had shown Halley where to go.',
    'His father had taught him how to get there.',
    '',
    'Four golden currents spread across the water.',
    'One flows toward Cortez Backwaters — home.',
    'Three more toward adventures he and his father once dreamed about together.'
].join('\n');

export const STARFISH_FIRST_CATCH_BANNER =
    'Cortez Backwaters awaits — and three unfinished journeys stir on the horizon.';

/** Starfish only at Celestial Depths once the full relic quest is complete. */
export function canSpawnStarfish(location, player) {
    return location?.waterBodyType === 'CELESTIAL'
        && player?.canAccessCelestialDepths?.() === true
        && player?.gear?.bait === STARLIGHT_LURE_BAIT_NAME;
}

/**
 * Fish IDs available for the current cast (never includes Starfish outside Celestial + lure).
 * @param {import('../locations.js').Locations['locations'][number]|null} location
 * @param {import('../player.js').Player|null} [player]
 * @returns {number[]}
 */
export function resolveLocationFishIds(location, player = null) {
    if (!location) return [0, 1, 2];
    if (location.waterBodyType === 'CELESTIAL') {
        if (!player?.canAccessCelestialDepths?.()) {
            return [];
        }
        if (player?.gear?.bait !== STARLIGHT_LURE_BAIT_NAME) {
            return [];
        }
        return [STARFISH_ID];
    }
    const ids = Array.isArray(location.fish) && location.fish.length ? location.fish : [0, 1, 2];
    return ids.filter((id) => id !== STARFISH_ID);
}

/** Unhurried approach: the presence drifts homeward (~16s). */
export const STARFISH_APPROACH_DURATION_SEC = 16;

/** Line tightens with deliberate, gentle weight before movement. */
export const STARFISH_HOOK_FREEZE_SEC = 0.7;

/** Drift speed toward the boat (m/s) — slow, steady. */
export const STARFISH_DRIFT_SPEED = 0.26;

/** Soft homeward glide during landing. */
export const STARFISH_LANDING_REEL_RATE = 0.38;
export const STARFISH_LANDING_FISH_SPEED = 1.05;

/** Heartbeat pulse on the line (rad/s). */
export const STARFISH_PULSE_HZ = 0.95;

export function isStarfishReunionEncounter(fishInstance, fishing) {
    const location = fishing?.game?.locations?.getCurrentLocation?.();
    const fishId = fishInstance?.currentFish?.fishId ?? fishInstance?.currentFish?.id;
    return location?.waterBodyType === 'CELESTIAL' && fishId === STARFISH_ID;
}

export function isCelestialStarfishHook(fishing) {
    return fishing?.game?.locations?.getCurrentLocation?.()?.waterBodyType === 'CELESTIAL';
}
