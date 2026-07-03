/** Starfish of Eternity — Celestial Depths reunion (Ch. 5–6). */

export const STARFISH_ID = 33;
export const STARLIGHT_LURE_BAIT_NAME = 'Starlight Lure';

/** First reunion — the Starfish opens guide destinations, not a trophy wall. */
export const STARFISH_FIRST_CATCH_QUOTE =
    "You've spent your life chasing wonders.\n\nBut the light you sought was always within you.";

export const STARFISH_FIRST_CATCH_NARRATION = [
    'The sea grows still. The air feels weightless.',
    'For a moment, Halley isn\'t holding a catch — he\'s holding a reflection.',
    'The glow from the Starfish mirrors the same spark in his own eyes,',
    'and the waves whisper with the voice of every journey he\'s taken.',
    '',
    'He realizes this was never about the biggest fish,',
    'or the rarest treasure.',
    'It was about coming home —',
    'to the light that\'s been with him since the beginning.'
].join('\n');

export const STARFISH_GUIDE_DESTINATIONS_HEADLINE =
    'The Starfish has been your guide — not your trophy.';

export const STARFISH_GUIDE_DESTINATIONS_BODY =
    'In the hush after the reunion, new waters stir on the horizon. The Starfish has whispered of exciting places now open to you — waters that were always out there, waiting for the right light to find them.';

/** Post-Starfish destinations the Starfish reveals (more coming later). */
export const STARFISH_GUIDE_DESTINATIONS_OPEN = [
    { name: 'Cortez Backwaters', label: 'Now open to visit' }
];

export const STARFISH_GUIDE_COMING_SOON =
    'Three more waters await — coming soon.';

export const STARFISH_FIRST_CATCH_BANNER =
    'The Starfish has shown you the way — Cortez Backwaters is open to visit.';

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
