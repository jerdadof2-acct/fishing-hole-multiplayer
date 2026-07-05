/**
 * Location system - manages fishing locations with water body types and platforms
 * Region names match DOCS/halleys-big-catch-story.md
 */

export const AMAZON_DEPTHS_NAME = 'Amazon Depths';
export const FROZEN_FJORDS_NAME = 'Frozen Fjords';
export const CORAL_KINGDOMS_NAME = 'Coral Kingdoms';
export const CORTEZ_BACKWATERS_NAME = 'Cortez Backwaters';
export const LOUISIANA_BAYOU_NAME = 'Louisiana Bayou';
export const CONGO_RIVER_NAME = 'Congo River';
export const CRAZYCATCH_COVE_NAME = 'CrazyCatch Cove';
export const CRAGGY_COAST_NAME = 'Craggy Coast';
export const STORMBREAKER_BAY_NAME = 'Stormbreaker Bay';
export const FORGOTTEN_REEFS_NAME = 'Forgotten Reefs';
export const TWILIGHT_TRENCH_NAME = 'Twilight Trench';
export const SANDY_SHOALS_NAME = 'Sandy Shoals';
export const DESERT_LAGOON_NAME = 'Desert Lagoon';

/** Collection / progression order — matches story unlock path (same as `locations` array order). */
export const COLLECTION_LOCATION_PROGRESSION = [
    'Crescent Pond',
    SANDY_SHOALS_NAME,
    CORAL_KINGDOMS_NAME,
    AMAZON_DEPTHS_NAME,
    CRAGGY_COAST_NAME,
    FROZEN_FJORDS_NAME,
    DESERT_LAGOON_NAME,
    STORMBREAKER_BAY_NAME,
    FORGOTTEN_REEFS_NAME,
    TWILIGHT_TRENCH_NAME,
    'Celestial Depths',
    CORTEZ_BACKWATERS_NAME,
    LOUISIANA_BAYOU_NAME,
    CONGO_RIVER_NAME,
    CRAZYCATCH_COVE_NAME
];

export class Locations {
    constructor() {
        this.locations = [
            {
                name: 'Crescent Pond',
                difficulty: 'Easy',
                fish: [0, 1, 2, 3],
                cost: 0,
                unlockLevel: 1,
                description: "Halley's home pond — where the smallest ripples began",
                briefTheme: 'crescent-pond',
                tagline: 'Quiet morning water',
                waterBodyType: 'POND',
                platformType: 'DOCK'
            },
            {
                name: SANDY_SHOALS_NAME,
                difficulty: 'Medium',
                fish: [45, 46, 11],
                cost: 100,
                unlockLevel: 2,
                description: 'The Shooting Star anchored in warm, shallow water just offshore — the beach is close enough to hear the break. Steady bites and sunny conditions make this an easy favorite along the coast.',
                briefTheme: 'sandy-shoals',
                tagline: 'The Shooting Star, close to the beach',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT',
                fishSpawnWeights: {
                    11: 28,
                    45: 44,
                    46: 28
                }
            },
            {
                name: CORAL_KINGDOMS_NAME,
                difficulty: 'Medium',
                fish: [34, 35, 36, 37, 38],
                cost: 50,
                unlockLevel: 3,
                description: 'A shallow inland bay with stunning clear blue water over lively reefs. Color and life are everywhere below — an easy place to fall in love with fishing.',
                briefTheme: 'coral-kingdoms',
                tagline: 'Clear blue water, living reefs',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: AMAZON_DEPTHS_NAME,
                difficulty: 'Hard',
                fish: [53, 54, 55, 56],
                cost: 200,
                unlockLevel: 7,
                description: 'A remote jungle river charter — tangled banks, murky channels, and predators that do not forgive a careless cast. Premium water for anglers ready to earn every bite.',
                briefTheme: 'amazon-depths',
                tagline: 'Premium jungle river charter',
                waterBodyType: 'RIVER',
                platformType: 'DOCK',
                premium: true,
                fishSpawnWeights: {
                    53: 38,
                    54: 32,
                    55: 22,
                    56: 8
                }
            },
            {
                name: CRAGGY_COAST_NAME,
                difficulty: 'Expert',
                fish: [6, 7, 8, 9, 10, 12],
                cost: 300,
                unlockLevel: 12,
                description: 'Great Lakes country: cold wind, rocky shore, and heavy water hammering the ledges. Rough fishing, but the rewards along this craggy coast can be huge.',
                briefTheme: 'craggy-coast',
                tagline: 'Wind, rock, and big-lake water',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: FROZEN_FJORDS_NAME,
                difficulty: 'Hard',
                fish: [15, 16, 17, 18],
                cost: 200,
                unlockLevel: 9,
                description: 'Dark, deep, and brutally cold — a walled-in fjord where the water runs deep and the air bites. Only the toughest anglers — and fish — belong here.',
                briefTheme: 'frozen-fjords',
                tagline: 'Ice-walled and unforgiving',
                waterBodyType: 'FJORD',
                platformType: 'SMALL_BOAT'
            },
            {
                name: DESERT_LAGOON_NAME,
                difficulty: 'Hard',
                fish: [4, 5, 6, 7],
                cost: 150,
                unlockLevel: 8,
                description: 'A small tropical oasis lake — palms, still warm water, and quiet green against the desert. Easy to reach, harder to leave.',
                briefTheme: 'desert-lagoon',
                tagline: 'Palm-shaded desert oasis',
                waterBodyType: 'POND',
                platformType: 'DOCK'
            },
            {
                name: STORMBREAKER_BAY_NAME,
                difficulty: 'Hard',
                fish: [13, 14, 47],
                cost: 250,
                unlockLevel: 10,
                description: 'Rough bay water where chop and tide collide. Hold on to the rail — the fish that thrive in these waves fight hard and run deep.',
                briefTheme: 'stormbreaker-bay',
                tagline: 'Choppy bay, hard-fighting fish',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: FORGOTTEN_REEFS_NAME,
                difficulty: 'Expert',
                fish: [49, 50, 51, 52, 48],
                cost: 500,
                unlockLevel: 15,
                description: 'Remote coral reefs far off the main routes — overgrown gardens and pockets of clear water few boats ever reach. Expert water worth the long run.',
                briefTheme: 'forgotten-reefs',
                tagline: 'Reefs most charts never show',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT',
                fishSpawnWeights: {
                    49: 30,
                    50: 24,
                    51: 22,
                    52: 14,
                    48: 10
                }
            },
            {
                name: TWILIGHT_TRENCH_NAME,
                difficulty: 'Expert',
                fish: [19, 20, 21, 22, 23],
                cost: 400,
                unlockLevel: 14,
                description: 'A very dark, very deep stretch of open ocean. Strange creatures rise from the trench when the light gives out — not for the faint of heart.',
                briefTheme: 'twilight-trench',
                tagline: 'Deep water, strange company',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Celestial Depths',
                difficulty: 'Legendary',
                fish: [33],
                cost: 0,
                unlockLevel: 99,
                description: 'When every relic falls into place, the sea stills and starlight gathers below. Halley\'s medallion brought you this far — what rises from the depths remembers why.',
                briefTheme: 'celestial-depths',
                tagline: 'Where Halley\'s journey leads',
                waterBodyType: 'CELESTIAL',
                platformType: 'LARGE_BOAT',
                requiresStarlightLure: true
            },
            {
                name: CORTEZ_BACKWATERS_NAME,
                difficulty: 'Hard',
                fish: [39, 40, 41, 42, 43, 44],
                cost: 0,
                unlockLevel: 99,
                description: 'Nestled among the mangroves — weathered docks, warm Gulf tides, and old Florida fishing water. These backwaters feel like childhood mornings on the dock; somewhere out there, the Silver King still waits.',
                briefTheme: 'cortez-backwaters',
                tagline: 'Mangroves, docks, and Gulf tides',
                waterBodyType: 'LAKE',
                platformType: 'DOCK',
                requiresStarfishCatch: true,
                fishSpawnWeights: {
                    39: 34,
                    40: 25,
                    41: 18,
                    42: 12,
                    43: 8,
                    44: 3
                }
            },
            {
                name: LOUISIANA_BAYOU_NAME,
                difficulty: 'Hard',
                fish: [57, 58, 59, 60, 61],
                cost: 0,
                unlockLevel: 99,
                description: 'Cypress trees, hidden channels, and muddy banks — the bayou trip Halley and his father always promised they would take someday. This location was inspired by Halley\'s friend Henry, who grew up fishing these backwaters.',
                briefTheme: 'louisiana-bayou',
                tagline: 'An old promise, finally kept',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT',
                requiresStarfishCatch: true,
                fishSpawnWeights: {
                    57: 30,
                    58: 28,
                    59: 22,
                    60: 12,
                    61: 3
                }
            },
            {
                name: CONGO_RIVER_NAME,
                difficulty: 'Expert',
                fish: [56, 55, 53, 54],
                cost: 0,
                unlockLevel: 99,
                description: 'The greatest destination in his father\'s old journal — a vast river of green shoreline, powerful currents, and creatures the sketches never captured.',
                briefTheme: 'congo-river',
                tagline: 'Carrying a dream the rest of the way',
                waterBodyType: 'RIVER',
                platformType: 'LARGE_BOAT',
                requiresPostStarfishGuide: true,
                comingSoon: true,
                fishSpawnWeights: {
                    56: 12,
                    55: 28,
                    53: 30,
                    54: 30
                }
            },
            {
                name: CRAZYCATCH_COVE_NAME,
                difficulty: 'Legendary',
                fish: [34, 35, 36, 48, 52],
                cost: 0,
                unlockLevel: 99,
                description: 'A hidden cove his father invented in stories when Halley was a kitten — impossible fish, ridiculous names, and laughter when nothing was biting. The Starfish remembered.',
                briefTheme: 'crazycatch-cove',
                tagline: 'Where imagination became real',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT',
                requiresPostStarfishGuide: true,
                comingSoon: true,
                fishSpawnWeights: {
                    34: 22,
                    35: 22,
                    36: 22,
                    48: 18,
                    52: 16
                }
            }
        ];

        this.currentLocationIndex = 0; // Crescent Pond
    }

    getLocations() {
        return this.locations;
    }

    getLocation(index) {
        if (index < 0 || index >= this.locations.length) {
            console.warn('[LOCATIONS] Invalid location index:', index);
            return this.locations[0];
        }
        return this.locations[index];
    }

    getCurrentLocation() {
        return this.getLocation(this.currentLocationIndex);
    }

    getCurrentLocationIndex() {
        return this.currentLocationIndex;
    }

    setCurrentLocation(index) {
        if (index < 0 || index >= this.locations.length) {
            console.warn('[LOCATIONS] Invalid location index:', index);
            return;
        }
        this.currentLocationIndex = index;
    }

    getAvailableFish() {
        const location = this.getCurrentLocation();
        return location ? location.fish : [];
    }

    getWaterBodyType() {
        const location = this.getCurrentLocation();
        return location ? location.waterBodyType : 'LAKE';
    }

    getPlatformType() {
        const location = this.getCurrentLocation();
        return location ? location.platformType : 'DOCK';
    }
}

/**
 * Fish IDs assigned to at least one location (excludes orphaned species).
 * @param {Array<{ fish?: number[], unlockLevel?: number }>} [locations]
 */
export function getLocationAssignedFishIdSet(locations = new Locations().locations) {
    const ids = new Set();
    for (const location of locations) {
        for (const fishId of location.fish || []) {
            ids.add(fishId);
        }
    }
    return ids;
}

/**
 * Collection display order: locations by unlock level, fish in each location's list
 * (first appearance only when a species appears in multiple locations).
 * @param {Array<{ fish?: number[], unlockLevel?: number }>} [locations]
 * @returns {number[]}
 */
export function getFishCollectionOrder(locations = new Locations().locations) {
    const progressionIndex = new Map(
        COLLECTION_LOCATION_PROGRESSION.map((name, index) => [name, index])
    );

    const sorted = [...locations].sort((a, b) => {
        const ai = progressionIndex.get(a.name) ?? 999;
        const bi = progressionIndex.get(b.name) ?? 999;
        return ai - bi;
    });

    const seen = new Set();
    const orderedIds = [];
    for (const loc of sorted) {
        for (const fishId of loc.fish || []) {
            if (!seen.has(fishId)) {
                seen.add(fishId);
                orderedIds.push(fishId);
            }
        }
    }
    return orderedIds;
}
