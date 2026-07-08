import { HIDDEN_RELICS, CELESTIAL_DEPTHS_LOCATION_INDEX } from './config/hiddenRelics.js';
import {
    getRelicDiscoveryChance,
    getRelicProgressionStep,
    getRelicProgressionStepByLocationIndex,
    getTierConfig,
    MEDALLION_CLUES,
    STORY_RELIC_SEQUENCE
} from './config/relicProgression.js';
import { getChapterForRelicCompletion, POST_STARFISH_CHAPTERS } from './config/storyChapters.js';
import { CORTEZ_BACKWATERS_LOCATION_INDEX } from './config/cortezBackwaters.js';
import {
    LOUISIANA_BAYOU_LOCATION_INDEX,
    CONGO_RIVER_LOCATION_INDEX,
    CRAZYCATCH_COVE_LOCATION_INDEX,
    hasCaughtStarfish,
    isComingSoonLocationIndex
} from './config/storyLocations.js';
import { STARFISH_ID } from './config/starfishEncounter.js';

export { STORY_RELIC_SEQUENCE } from './config/relicProgression.js';

/** @returns {string|null} Next relic id in story order, or null if all found. */
export function getNextStoryRelicId(player) {
    if (!player) return STORY_RELIC_SEQUENCE[0]?.relicId ?? null;
    for (const step of STORY_RELIC_SEQUENCE) {
        if (!player.hasHiddenRelic?.(step.relicId)) {
            return step.relicId;
        }
    }
    return null;
}

/** Location indices reachable in the current story arc (before level filter). */
export function getStoryAvailableLocationIndices(player) {
    const indices = new Set();
    const first = STORY_RELIC_SEQUENCE[0];
    if (first) {
        indices.add(first.locationIndex);
    }

    for (let i = 0; i < STORY_RELIC_SEQUENCE.length; i++) {
        const step = STORY_RELIC_SEQUENCE[i];
        if (!player?.hasHiddenRelic?.(step.relicId)) {
            break;
        }
        const next = STORY_RELIC_SEQUENCE[i + 1];
        if (next) {
            indices.add(next.locationIndex);
        }
    }

    return indices;
}

export function isStoryLocationAvailable(player, locationIndex) {
    if (locationIndex === 0) {
        return true;
    }
    return getStoryAvailableLocationIndices(player).has(locationIndex);
}

export function canDiscoverRelicAtLocation(player, locationIndex) {
    const nextRelicId = getNextStoryRelicId(player);
    if (!nextRelicId) {
        return false;
    }
    const step = getRelicProgressionStep(nextRelicId);
    return step?.locationIndex === locationIndex;
}

function getProgressKey(locationName) {
    return locationName?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'unknown';
}

export function getRelicLocationProgress(player, locationName) {
    if (!player) {
        return { successfulCatches: 0, uniqueSpecies: [], cluesShown: [], flags: {} };
    }
    if (!player.relicLocationProgress || typeof player.relicLocationProgress !== 'object') {
        player.relicLocationProgress = {};
    }
    const key = getProgressKey(locationName);
    if (!player.relicLocationProgress[key]) {
        player.relicLocationProgress[key] = {
            successfulCatches: 0,
            uniqueSpecies: [],
            cluesShown: [],
            flags: {}
        };
    }
    return player.relicLocationProgress[key];
}

/**
 * @param {import('./player.js').Player} player
 * @param {string} locationName
 * @param {number} fishId
 * @param {{ game?: import('./main.js').default }} [context]
 */
export function recordSuccessfulCatchForRelicProgress(player, locationName, fishId, context = {}) {
    const step = getRelicProgressionStepByLocationIndex(
        context.game?.locations?.getCurrentLocationIndex?.() ?? -1
    );
    if (!step || !canDiscoverRelicAtLocation(player, step.locationIndex)) {
        return { clues: [] };
    }

    const progress = getRelicLocationProgress(player, locationName);
    progress.successfulCatches += 1;

    if (typeof fishId === 'number' && !progress.uniqueSpecies.includes(fishId)) {
        progress.uniqueSpecies.push(fishId);
    }

    evaluateSpecialCondition(player, progress, step, context);

    const tier = getTierConfig(step.tier);
    const clues = MEDALLION_CLUES.filter((clue) => {
        if (progress.cluesShown.includes(clue.id)) {
            return false;
        }
        if (progress.successfulCatches < clue.atCatches) {
            return false;
        }
        if (clue.minSpecies && progress.uniqueSpecies.length < clue.minSpecies) {
            return false;
        }
        progress.cluesShown.push(clue.id);
        return true;
    });

    player.save({ skipSync: true });
    return { clues, progress, tier, step };
}

function evaluateSpecialCondition(player, progress, step, context) {
    if (progress.flags.specialConditionMet) {
        return;
    }

    switch (step.specialCondition) {
        case 'dock_catch':
            progress.flags.specialConditionMet = progress.successfulCatches >= 3;
            break;
        case 'amazon_anaconda':
            progress.flags.specialConditionMet = Boolean(
                progress.flags.anacondaSighted || context.game?._lastAnacondaBarkAt
            );
            break;
        case 'species_variety':
        default:
            progress.flags.specialConditionMet = true;
            break;
    }
}

/** Call when the Amazon anaconda is sighted. */
export function markAmazonAnacondaSighted(player, locationName) {
    const progress = getRelicLocationProgress(player, locationName);
    progress.flags.anacondaSighted = true;
    progress.flags.specialConditionMet = true;
    player?.save?.({ skipSync: true });
}

export function isRelicEligible(player, locationName, locationIndex) {
    const activeRelic = getRelicForActiveRelic(player);
    if (!player || !activeRelic) {
        return false;
    }

    if (player.hasHiddenRelic(activeRelic.id)) {
        return false;
    }

    const step = getRelicProgressionStep(activeRelic.id);
    if (!step || step.locationIndex !== locationIndex) {
        return false;
    }

    const progress = getRelicLocationProgress(player, locationName);
    const tier = getTierConfig(step.tier);

    if (progress.successfulCatches < tier.minimumCatches) {
        return false;
    }
    if (progress.uniqueSpecies.length < tier.minimumSpecies) {
        return false;
    }
    if (!progress.flags.specialConditionMet) {
        return false;
    }

    return true;
}

export function getRelicForActiveRelic(player) {
    const nextId = getNextStoryRelicId(player);
    if (!nextId) {
        return null;
    }
    return HIDDEN_RELICS.find((relic) => relic.id === nextId) || null;
}

/**
 * Roll whether the active relic surfaces on this bite window.
 * @returns {import('./config/hiddenRelics.js').HIDDEN_RELICS[number]|null}
 */
export function rollStoryRelicDiscovery(player, locationName, locationIndex) {
    const relic = getRelicForActiveRelic(player);
    if (!relic || !canDiscoverRelicAtLocation(player, locationIndex)) {
        return null;
    }

    if (player.hasHiddenRelic(relic.id)) {
        return null;
    }

    if (!isRelicEligible(player, locationName, locationIndex)) {
        return null;
    }

    const step = getRelicProgressionStep(relic.id);
    const progress = getRelicLocationProgress(player, locationName);
    const tier = getTierConfig(step.tier);
    const chance = getRelicDiscoveryChance(progress.successfulCatches, tier);

    if (Math.random() < chance) {
        return relic;
    }

    return null;
}

export function getPendingChapterForRelic(player, relicId) {
    if (!player) {
        return null;
    }
    const completed = player.hiddenRelicsCollected || [];
    const chapter = getChapterForRelicCompletion(relicId, completed);
    if (!chapter) {
        return null;
    }
    if (player.storyChaptersCompleted?.includes?.(chapter.id)) {
        return null;
    }
    return chapter;
}

export function markChapterComplete(player, chapterId) {
    if (!player || !chapterId) return;
    if (!Array.isArray(player.storyChaptersCompleted)) {
        player.storyChaptersCompleted = [];
    }
    if (!player.storyChaptersCompleted.includes(chapterId)) {
        player.storyChaptersCompleted.push(chapterId);
        player.save({ skipSync: true });
    }
}

export function hasCompletedChapter(player, chapterId) {
    return Boolean(player?.storyChaptersCompleted?.includes?.(chapterId));
}

/** Chapters that play the first time Halley arrives at a story location. */
const ARRIVAL_CHAPTER_BY_LOCATION = {
    [CELESTIAL_DEPTHS_LOCATION_INDEX]: POST_STARFISH_CHAPTERS.chapter_8_celestial,
    [CORTEZ_BACKWATERS_LOCATION_INDEX]: POST_STARFISH_CHAPTERS.chapter_10_cortez,
    [LOUISIANA_BAYOU_LOCATION_INDEX]: POST_STARFISH_CHAPTERS.chapter_12_bayou,
    [CONGO_RIVER_LOCATION_INDEX]: POST_STARFISH_CHAPTERS.chapter_13_congo,
    [CRAZYCATCH_COVE_LOCATION_INDEX]: POST_STARFISH_CHAPTERS.chapter_14_crazycatch
};

/**
 * Story chapter modal to show after traveling to a location (first visit only).
 * @returns {import('./config/storyChapters.js').StoryChapter|null}
 */
export function getPendingArrivalChapter(player, locationIndex) {
    if (!player || locationIndex == null) {
        return null;
    }

    const chapter = ARRIVAL_CHAPTER_BY_LOCATION[locationIndex];
    if (!chapter || hasCompletedChapter(player, chapter.id)) {
        return null;
    }

    if (locationIndex === CELESTIAL_DEPTHS_LOCATION_INDEX) {
        return player.canAccessCelestialDepths?.() ? chapter : null;
    }

    if (locationIndex === CORTEZ_BACKWATERS_LOCATION_INDEX) {
        return player.isFishUnlocked?.(STARFISH_ID) ? chapter : null;
    }

    if (locationIndex === LOUISIANA_BAYOU_LOCATION_INDEX) {
        return hasCaughtStarfish(player) ? chapter : null;
    }

    if (isComingSoonLocationIndex(locationIndex)) {
        return null;
    }

    return null;
}

/** Next map index offered by relic chapter "Travel to New Location". */
export function getChapterTravelLocationIndex(chapter) {
    if (!chapter || typeof chapter.unlocksLocationIndex !== 'number') {
        return null;
    }
    return chapter.unlocksLocationIndex;
}

/**
 * Whether the player can open the map and travel to this index right now.
 * @param {import('./player.js').Player} player
 * @param {number} locationIndex
 * @param {Array<{ unlockLevel?: number, name?: string }>} locations
 */
export function canPlayerTravelToLocationIndex(player, locationIndex) {
    if (!player || locationIndex == null) {
        return false;
    }
    return Array.isArray(player.locationUnlocks) && player.locationUnlocks.includes(locationIndex);
}

/**
 * Offer chapter travel only when the destination is actually on the map.
 * @returns {{
 *   travelLocationIndex: number|null,
 *   travelLockedNote: string|null,
 *   pendingTravelLocationIndex: number|null
 * }}
 */
export function resolveChapterTravelOffer(player, chapter, locations) {
    const travelLocationIndex = getChapterTravelLocationIndex(chapter);
    if (travelLocationIndex == null || !locations?.[travelLocationIndex]) {
        return { travelLocationIndex: null, travelLockedNote: null, pendingTravelLocationIndex: null };
    }

    const location = locations[travelLocationIndex];
    const requiredLevel = location.unlockLevel ?? 1;

    if (canPlayerTravelToLocationIndex(player, travelLocationIndex)) {
        return { travelLocationIndex, travelLockedNote: null, pendingTravelLocationIndex: null };
    }

    if (player.level < requiredLevel) {
        return {
            travelLocationIndex: null,
            travelLockedNote: `${location.name} opens at Level ${requiredLevel}. Keep fishing here to level up first.`,
            pendingTravelLocationIndex: travelLocationIndex
        };
    }

    return {
        travelLocationIndex: null,
        travelLockedNote: `${location.name} is on the horizon — finish exploring here, then check the map.`,
        pendingTravelLocationIndex: travelLocationIndex
    };
}

export function notifyPendingStoryTravelUnlock(player, locations) {
    if (player?.pendingStoryTravelIndex == null || !locations) {
        return null;
    }

    const index = player.pendingStoryTravelIndex;
    if (!canPlayerTravelToLocationIndex(player, index)) {
        return null;
    }

    const name = locations[index]?.name || 'A new location';
    player.pendingStoryTravelIndex = null;
    player.save({ skipSync: true });
    return name;
}

/** Reconcile level + story gates into locationUnlocks. */
export function reconcileStoryLocationUnlocks(player, locations) {
    if (!player || !locations) {
        return [];
    }

    const storyAvailable = getStoryAvailableLocationIndices(player);
    const unlocked = new Set();

    for (const [index, location] of locations.entries()) {
        if (location.waterBodyType === 'CELESTIAL' || location.requiresStarlightLure) {
            continue;
        }
        if (location.requiresStarfishCatch || location.requiresPostStarfishGuide) {
            continue;
        }

        if (!storyAvailable.has(index)) {
            continue;
        }

        if (player.level >= location.unlockLevel || index === 0) {
            unlocked.add(index);
        }
    }

    if (player.canAccessCelestialDepths?.()) {
        unlocked.add(CELESTIAL_DEPTHS_LOCATION_INDEX);
    }

    if (hasCaughtStarfish(player)) {
        unlocked.add(CORTEZ_BACKWATERS_LOCATION_INDEX);
        unlocked.add(LOUISIANA_BAYOU_LOCATION_INDEX);
    }

    // Journal chain: first catch at the Bayou opens the Congo River (see DOCS/halleys-big-catch-story.md).
    if (hasCaughtStarfish(player) && player.louisianaBayouComplete === true) {
        unlocked.add(CONGO_RIVER_LOCATION_INDEX);
    }

    return [...unlocked].sort((a, b) => a - b);
}

export function canTravelToStoryLocation(player, locationIndex, locations) {
    const location = locations?.[locationIndex];
    if (!player || !location) {
        return false;
    }

    if (location.waterBodyType === 'CELESTIAL') {
        return player.canAccessCelestialDepths?.() === true;
    }

    if (isComingSoonLocationIndex(locationIndex) || location.comingSoon) {
        return false;
    }

    if (location.requiresStarfishCatch) {
        return hasCaughtStarfish(player);
    }

    if (!isStoryLocationAvailable(player, locationIndex)) {
        return false;
    }

    if (player.level < location.unlockLevel && locationIndex !== 0) {
        return false;
    }

    return player.locationUnlocks.includes(locationIndex);
}
