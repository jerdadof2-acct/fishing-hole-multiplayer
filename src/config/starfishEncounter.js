/** Starfish of Eternity — Celestial Depths reunion (Ch. 5–6). */

export const STARFISH_ID = 33;
export const STARLIGHT_LURE_BAIT_NAME = 'Starlight Lure';

export const STARFISH_GUIDE_DESTINATIONS_HEADLINE =
    'The Starfish opened the path — your father gave it meaning.';

export const STARFISH_GUIDE_DESTINATIONS_BODY =
    'Two golden currents are open now — Cortez Backwaters and Louisiana Bayou. Two more adventures from your father\'s journal are still on the horizon.';

/** Post-Starfish destinations the Starfish reveals after the reunion. */
export const STARFISH_GUIDE_DESTINATIONS_OPEN = [
    { name: 'Cortez Backwaters', label: 'Return home — tell your father' },
    { name: 'Louisiana Bayou', label: 'An unfinished page in his journal' },
    { name: 'Congo River', label: 'Coming soon — his greatest fishing dream' },
    { name: 'CrazyCatch Cove', label: 'Coming soon — a story that became real' }
];

export const STARFISH_GUIDE_COMING_SOON =
    'Congo River and CrazyCatch Cove are coming in a future update.';

export const STARFISH_FIRST_CATCH_QUOTE =
    "The comet may have started this journey.\n\nBut you're the reason I was ready for it.";

export const STARFISH_FIRST_CATCH_NARRATION = [
    'The line pulsed once — a heartbeat shared between Halley and something ancient beneath the stars.',
    'Golden currents spread across the water, pointing toward shores he knew and shores he had only dreamed about.',
    '',
    'The reunion is only beginning. What comes next belongs in his heart.'
].join('\n');

export const STARFISH_FIRST_CATCH_BANNER =
    'Cortez Backwaters and Louisiana Bayou await — more journal journeys are coming soon.';

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
