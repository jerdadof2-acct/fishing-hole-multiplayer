/** Starfish of Eternity — Celestial Depths reunion (Ch. 5–6). */

export const STARFISH_ID = 33;

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
