/**
 * Location system - manages fishing locations with water body types and platforms
 * Region names match DOCS/halleys-big-catch-story.md
 */

export class Locations {
    constructor() {
        this.locations = [
            {
                name: 'Crescent Pond',
                difficulty: 'Easy',
                fish: [0, 1, 2],
                cost: 0,
                unlockLevel: 1,
                description: "Halley's home pond — where the smallest ripples began",
                waterBodyType: 'POND',
                platformType: 'DOCK'
            },
            {
                name: 'Amazon Depths',
                difficulty: 'Easy',
                fish: [0, 1, 2, 3],
                cost: 0,
                unlockLevel: 2,
                description: 'Jungle rivers where the stars still whisper their names',
                waterBodyType: 'RIVER',
                platformType: 'DOCK'
            },
            {
                name: 'Coral Kingdoms',
                difficulty: 'Medium',
                fish: [2, 3, 4, 5],
                cost: 50,
                unlockLevel: 3,
                description: 'Shallow reefs hiding treasures that remember your name',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: 'Frozen Fjords',
                difficulty: 'Hard',
                fish: [15, 16, 17, 18],
                cost: 200,
                unlockLevel: 9,
                description: 'Ice-bound waters where even time can sleep',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: 'Craggy Coast',
                difficulty: 'Expert',
                fish: [6, 7, 8, 9],
                cost: 300,
                unlockLevel: 12,
                description: 'Rugged shores where hunters become seekers',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: 'Sandy Shoals',
                difficulty: 'Medium',
                fish: [10, 11, 12],
                cost: 100,
                unlockLevel: 6,
                description: 'Sun-warmed shallows — the sea never forgets its course',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Stormbreaker Bay',
                difficulty: 'Hard',
                fish: [12, 13, 14],
                cost: 250,
                unlockLevel: 10,
                description: 'Storm-lashed waters — the path forward rides the current',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Forgotten Reefs',
                difficulty: 'Expert',
                fish: [25, 26, 27, 28, 29, 30, 31, 32],
                cost: 500,
                unlockLevel: 15,
                description: 'Lost coral gardens where two lights were born as one',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Twilight Trench',
                difficulty: 'Expert',
                fish: [19, 20, 21, 22, 23],
                cost: 400,
                unlockLevel: 14,
                description: 'The deepest trench — the ocean remembers every spark',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Celestial Depths',
                difficulty: 'Legendary',
                fish: [33],
                cost: 0,
                unlockLevel: 1,
                description: 'A star-lit abyss where ocean and sky become one',
                waterBodyType: 'CELESTIAL',
                platformType: 'LARGE_BOAT',
                requiresStarlightLure: true
            },
            {
                name: 'Desert Lagoon',
                difficulty: 'Hard',
                fish: [4, 5, 6, 7],
                cost: 150,
                unlockLevel: 8,
                description: 'Hidden oasis — look to the stars that guide the waves',
                waterBodyType: 'POND',
                platformType: 'DOCK'
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
