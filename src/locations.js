/**
 * Location system - manages fishing locations with water body types and platforms
 */

export class Locations {
    constructor() {
        // Initial locations from reference file with water body type and platform mappings
        this.locations = [
            // POND locations (use dock) - starter pond uses dock
            {
                name: 'Willow Pond',
                difficulty: 'Easy',
                fish: [0, 1, 2],
                cost: 0,
                unlockLevel: 1,
                description: 'Quiet freshwater pond perfect for beginners',
                waterBodyType: 'POND',
                platformType: 'DOCK'
            },
            
            // RIVER locations (use dock)
            {
                name: 'River Bend',
                difficulty: 'Easy',
                fish: [0, 1, 2, 3],
                cost: 0,
                unlockLevel: 2,
                description: 'Gentle flowing waters',
                waterBodyType: 'RIVER',
                platformType: 'DOCK'
            },
            
            // LAKE locations (use small boat)
            {
                name: 'Deep Lake',
                difficulty: 'Medium',
                fish: [2, 3, 4, 5],
                cost: 50,
                unlockLevel: 3,
                description: 'Deep waters with bigger fish',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: 'Crystal Lake',
                difficulty: 'Hard',
                fish: [15, 16, 17, 18],
                cost: 200,
                unlockLevel: 9,
                description: 'Magical crystal-clear waters',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            {
                name: 'Legendary Waters',
                difficulty: 'Expert',
                fish: [6, 7, 8, 9],
                cost: 300,
                unlockLevel: 12,
                description: 'Where legends are born',
                waterBodyType: 'LAKE',
                platformType: 'SMALL_BOAT'
            },
            
            // OCEAN locations (use large boat)
            {
                name: 'Ocean Pier',
                difficulty: 'Medium',
                fish: [10, 11, 12],
                cost: 100,
                unlockLevel: 6,
                description: 'Saltwater fishing spot',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Deep Sea',
                difficulty: 'Hard',
                fish: [12, 13, 14],
                cost: 250,
                unlockLevel: 10,
                description: 'Deep ocean fishing',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Trophy Waters',
                difficulty: 'Expert',
                fish: [25, 26, 27, 28, 29, 30, 31, 32],
                cost: 500,
                unlockLevel: 15,
                description: 'Trophy fish paradise',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            {
                name: 'Abyss',
                difficulty: 'Expert',
                fish: [19, 20, 21, 22, 23],
                cost: 400,
                unlockLevel: 14,
                description: 'Bottomless depths',
                waterBodyType: 'OCEAN',
                platformType: 'LARGE_BOAT'
            },
            
            // POND locations (use dock) - Added at end
            {
                name: 'Secret Pond',
                difficulty: 'Hard',
                fish: [4, 5, 6, 7], // Fish type indices
                cost: 150,
                unlockLevel: 8,
                description: 'Hidden treasure spot',
                waterBodyType: 'POND',
                platformType: 'DOCK'
            }
        ];
        
        this.currentLocationIndex = 0; // Default to first location (Willow Pond - uses POND/DOCK)
    }
    
    /**
     * Get all locations
     */
    getLocations() {
        return this.locations;
    }
    
    /**
     * Get location by index
     */
    getLocation(index) {
        if (index < 0 || index >= this.locations.length) {
            console.warn('[LOCATIONS] Invalid location index:', index);
            return this.locations[0]; // Return first location as fallback
        }
        return this.locations[index];
    }
    
    /**
     * Get current location
     */
    getCurrentLocation() {
        return this.getLocation(this.currentLocationIndex);
    }
    
    /**
     * Get current location index
     */
    getCurrentLocationIndex() {
        return this.currentLocationIndex;
    }
    
    /**
     * Set current location by index
     */
    setCurrentLocation(index) {
        if (index < 0 || index >= this.locations.length) {
            console.warn('[LOCATIONS] Invalid location index:', index);
            return;
        }
        this.currentLocationIndex = index;
    }
    
    /**
     * Get available fish types for current location
     */
    getAvailableFish() {
        const location = this.getCurrentLocation();
        return location ? location.fish : [];
    }
    
    /**
     * Get water body type for current location
     */
    getWaterBodyType() {
        const location = this.getCurrentLocation();
        return location ? location.waterBodyType : 'LAKE';
    }
    
    /**
     * Get platform type for current location
     */
    getPlatformType() {
        const location = this.getCurrentLocation();
        return location ? location.platformType : 'DOCK';
    }
}
