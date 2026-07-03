/**
 * Story relic order and discovery gates — see DOCS/halleys-big-catch-story.md
 */

/** @typedef {'tier1'|'tier2'|'tier3'|'tier4'} RelicTier */

/** @type {Record<RelicTier, { minimumCatches: number, minimumSpecies: number, guaranteedCatch: number, startingChance: number }>} */
export const RELIC_TIER_CONFIG = {
    tier1: { minimumCatches: 9, minimumSpecies: 2, guaranteedCatch: 23, startingChance: 0.02 },
    tier2: { minimumCatches: 10, minimumSpecies: 3, guaranteedCatch: 21, startingChance: 0.02 },
    tier3: { minimumCatches: 12, minimumSpecies: 3, guaranteedCatch: 24, startingChance: 0.02 },
    tier4: { minimumCatches: 15, minimumSpecies: 4, guaranteedCatch: 28, startingChance: 0.02 }
};

/**
 * Sequential story relics — order matches chapter progression.
 * @type {Array<{
 *   relicId: string,
 *   locationIndex: number,
 *   tier: RelicTier,
 *   specialCondition?: string
 * }>}
 */
export const STORY_RELIC_SEQUENCE = [
    { relicId: 'weathered_bobber', locationIndex: 0, tier: 'tier1', specialCondition: 'dock_catch' },
    { relicId: 'driftwood_compass', locationIndex: 2, tier: 'tier1', specialCondition: 'species_variety' },
    { relicId: 'sunken_treasure', locationIndex: 1, tier: 'tier1', specialCondition: 'species_variety' },
    { relicId: 'message_in_bottle', locationIndex: 5, tier: 'tier2', specialCondition: 'amazon_anaconda' },
    { relicId: 'broken_harpoon', locationIndex: 7, tier: 'tier2', specialCondition: 'species_variety' },
    { relicId: 'frozen_pocket_watch', locationIndex: 4, tier: 'tier2', specialCondition: 'species_variety' },
    { relicId: 'buried_telescope', locationIndex: 3, tier: 'tier3', specialCondition: 'species_variety' },
    { relicId: 'map_fragment', locationIndex: 6, tier: 'tier3', specialCondition: 'species_variety' },
    { relicId: 'coral_pendant', locationIndex: 9, tier: 'tier3', specialCondition: 'species_variety' },
    { relicId: 'luminescent_shell', locationIndex: 8, tier: 'tier4', specialCondition: 'species_variety' }
];

/** Medallion clue thresholds (successful catches at current relic location). */
export const MEDALLION_CLUES = [
    {
        id: 'clue_first_pulse',
        atCatches: 5,
        halleyLine: 'Something here is reacting to the medallion.',
        banner: 'The medallion gives off a faint pulse…'
    },
    {
        id: 'clue_brightens',
        atCatches: 8,
        minSpecies: 2,
        halleyLine: "It's stronger near this water. The relic must be somewhere close.",
        banner: 'The medallion glows brighter when the line touches the water.'
    },
    {
        id: 'clue_flash',
        atCatches: 13,
        halleyLine: 'I saw it that time. Something is definitely down there.',
        banner: 'A soft flash moves beneath the surface, then fades.'
    },
    {
        id: 'clue_close',
        atCatches: 18,
        halleyLine: "I'm close. I can feel it.",
        banner: 'The medallion pulses with every cast.'
    }
];

export function getRelicProgressionStep(relicId) {
    return STORY_RELIC_SEQUENCE.find((step) => step.relicId === relicId) || null;
}

export function getRelicProgressionStepByLocationIndex(locationIndex) {
    return STORY_RELIC_SEQUENCE.find((step) => step.locationIndex === locationIndex) || null;
}

export function getTierConfig(tier) {
    return RELIC_TIER_CONFIG[tier] || RELIC_TIER_CONFIG.tier1;
}

/**
 * Rising discovery chance after minimum catches (never before eligibility).
 * @param {number} successfulCatches
 * @param {{ minimumCatches: number, guaranteedCatch: number, startingChance: number }} config
 */
export function getRelicDiscoveryChance(successfulCatches, config) {
    if (successfulCatches < config.minimumCatches) {
        return 0;
    }
    if (successfulCatches >= config.guaranteedCatch) {
        return 1;
    }
    const span = config.guaranteedCatch - config.minimumCatches;
    const progress = span > 0 ? (successfulCatches - config.minimumCatches) / span : 1;
    return config.startingChance + Math.pow(progress, 2) * (1 - config.startingChance);
}
