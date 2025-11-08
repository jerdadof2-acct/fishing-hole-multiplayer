/**
 * Player State Management System
 * Handles player stats, progression, unlocks, and save/load
 */

export class Player {
    constructor(initialData = null) {
        // Basic stats
        this.name = 'Guest';
        this.level = 1;
        this.money = 100;
        this.experience = 0;
        
        // Player stats (0-100, default 50)
        this.stats = {
            accuracy: 50,
            luck: 50,
            patience: 50,
            strength: 50
        };
        
        // Inventory tracking
        this.totalCaught = 0;
        this.totalWeight = 0;
        this.biggestCatch = 0;
        
        // Unlocks
        this.locationUnlocks = [0, 1]; // Start with first two locations
        this.tackleUnlocks = {
            rods: [0],      // Basic Rod
            reels: [0],     // Basic Reel
            lines: [0],     // Monofilament
            hooks: [0],     // Basic Hook
            baits: [0]      // Basic Bait
        };
        
        // Last visited location
        this.currentLocationIndex = 0;
        
        // Current gear
        this.gear = {
            rod: 'Basic Rod',
            reel: 'Basic Reel',
            line: 'Monofilament',
            hook: 'Basic Hook',
            bait: 'Basic Bait'
        };
        
        // Catch tracking
        this.recentCatches = []; // Last 10 catches
        this.top10BiggestFish = []; // Top 10 biggest fish ever
        this.caughtFish = {}; // Dictionary: {fishName: true}
        
        // Fish collection
        this.caughtFishCollection = {}; // {fishId: {caught: boolean, firstCatchDate: timestamp, count: number}}

        // Achievements tracking (object: {achievementId: tier})
        this.achievements = {};

        // Server sync context
        this.api = null;
        this.userId = null;
        this.friendCode = null;
        this.syncEnabled = false;
        this._syncTimeout = null;

        // Load from localStorage if available
        this.load();

        // Apply server data if provided
        if (initialData) {
            this.applyServerData(initialData);
        }
    }
    
    /**
     * Calculate experience needed for a given level
     * @param {number} level - Target level
     * @returns {number} Experience needed
     */
    calculateExpForLevel(level) {
        // Exponential progression: 100 * level^1.5
        return Math.floor(100 * Math.pow(level, 1.5));
    }
    
    /**
     * Add experience and check for level up
     * @param {number} exp - Experience to add
     * @param {Object} locations - Locations system instance (optional, for unlocks)
     * @param {Object} tackleShop - TackleShop system instance (optional, for unlocks)
     * @returns {Object|null} New unlocks object if leveled up, null otherwise
     */
    addExperience(exp, locations = null, tackleShop = null) {
        if (exp <= 0) return null;
        
        const previousLevel = this.level;
        this.experience += exp;
        const unlockResult = this.checkLevelUp(locations, tackleShop);
        const leveledUp = this.level > previousLevel;
        
        if (unlockResult || leveledUp) {
            console.log(`[PLAYER] Leveled up to ${this.level}!`);
        }
        
        this.save();

        if (!leveledUp) {
            return null;
        }

        const levelsGained = Math.max(1, this.level - previousLevel);

        return {
            type: 'level',
            level: this.level,
            levelsGained,
            unlock: unlockResult || null
        };
    }
    
    /**
     * Check if player should level up
     * @param {Object} locations - Locations system instance (optional, for unlocks)
     * @param {Object} tackleShop - TackleShop system instance (optional, for unlocks)
     * @returns {Object|null} New unlocks object if leveled up, null otherwise
     */
    checkLevelUp(locations = null, tackleShop = null) {
        // Calculate experience needed to reach next level
        const expForCurrentLevel = this.calculateExpForLevel(this.level);
        const expForNextLevel = this.calculateExpForLevel(this.level + 1);
        const expNeededForNext = expForNextLevel - expForCurrentLevel;
        
        // Check if player has enough experience to level up
        if (this.experience >= expNeededForNext) {
            return this.levelUp(locations, tackleShop);
        }
        
        return null;
    }
    
    /**
     * Level up the player
     * @param {Object} locations - Locations system instance (optional)
     * @param {Object} tackleShop - TackleShop system instance (optional)
     * @returns {Object|null} New unlocks object if level increased, null otherwise
     */
    levelUp(locations = null, tackleShop = null) {
        let leveledUp = false;
        let newUnlock = null;
        
        // Keep leveling up while player has enough experience for the next level
        while (true) {
            const expForCurrentLevel = this.calculateExpForLevel(this.level);
            const expForNextLevel = this.calculateExpForLevel(this.level + 1);
            const expNeededForNext = expForNextLevel - expForCurrentLevel;
            
            if (this.experience < expNeededForNext) {
                break; // Not enough experience to level up
            }
            
            // Deduct the experience needed for this level up
            this.experience -= expNeededForNext;
            this.level++;
            leveledUp = true;
            
            // Check for ONE new unlock when level increases (only last level up gets unlock)
            // This ensures we return the unlock for the final level reached
            const unlock = this.checkUnlocks(locations, tackleShop);
            if (unlock) {
                newUnlock = unlock;
            }
        }
        
        if (leveledUp) {
            this.save();
        }
        
        return newUnlock; // Return single unlock (or null if no unlock)
    }
    
    /**
     * Check for new unlocks based on level
     * Returns ONE unlock per level (prioritizes locations, then tackle)
     * @param {Object} locations - Locations system instance
     * @param {Object} tackleShop - TackleShop system instance
     * @returns {Object|null} Single unlock object or null if no unlocks
     */
    checkUnlocks(locations = null, tackleShop = null) {
        // Priority 1: Check for location unlocks first
        if (locations && locations.locations) {
            for (const [index, location] of locations.locations.entries()) {
                if (!this.locationUnlocks.includes(index) && this.level >= location.unlockLevel) {
                    this.locationUnlocks.push(index);
                    console.log(`[PLAYER] Location unlocked: ${location.name} (Level ${location.unlockLevel})`);
                    this.save();
                    return {
                        type: 'location',
                        location: {
                            index,
                            name: location.name,
                            unlockLevel: location.unlockLevel
                        }
                    };
                }
            }
        }
        
        // Priority 2: Check for tackle unlocks (in order: rods, reels, lines, hooks, baits)
        if (tackleShop) {
            const categories = ['rods', 'reels', 'lines', 'hooks', 'baits'];
            
            for (const category of categories) {
                if (tackleShop[category] && Array.isArray(this.tackleUnlocks[category])) {
                    // Sort by unlock level to get the lowest level item first
                    const availableItems = tackleShop[category]
                        .filter(item => !this.tackleUnlocks[category].includes(item.id) && this.level >= item.unlockLevel)
                        .sort((a, b) => a.unlockLevel - b.unlockLevel);
                    
                    if (availableItems.length > 0) {
                        const item = availableItems[0]; // Get first available item
                        this.tackleUnlocks[category].push(item.id);
                        console.log(`[PLAYER] Tackle unlocked: ${item.name} (Level ${item.unlockLevel})`);
                        this.save();
                        return {
                            type: 'tackle',
                            tackle: {
                                category,
                                id: item.id,
                                name: item.name,
                                unlockLevel: item.unlockLevel
                            }
                        };
                    }
                }
            }
        }
        
        return null; // No unlocks available at this level
    }
    
    /**
     * Add money
     * @param {number} amount - Money to add
     */
    addMoney(amount) {
        if (amount > 0) {
            this.money += amount;
            this.save();
        }
    }
    
    /**
     * Spend money
     * @param {number} amount - Money to spend
     * @returns {boolean} True if successful
     */
    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            this.save();
            return true;
        }
        return false;
    }
    
    /**
     * Add a catch to tracking
     * @param {Object} catchData - {fishName, weight, fishId, value, experience}
     * @param {Object} locations - Locations system instance (optional, for unlocks)
     * @param {Object} tackleShop - TackleShop system instance (optional, for unlocks)
     * @returns {Object|null} New unlocks object if leveled up, null otherwise
     */
    addCatch(catchData, locations = null, tackleShop = null) {
        const { fishName, weight, fishId, value, experience } = catchData;
        
        // Update totals
        this.totalCaught++;
        this.totalWeight += weight;
        
        if (weight > this.biggestCatch) {
            this.biggestCatch = weight;
        }
        
        // Add to recent catches (keep last 10)
        this.recentCatches.unshift({
            fishName,
            weight,
            fishId,
            value,
            experience,
            timestamp: Date.now()
        });
        
        if (this.recentCatches.length > 10) {
            this.recentCatches.pop();
        }
        
        // Mark as caught
        this.caughtFish[fishName] = true;
        
        // Add experience and money (returns unlocks if leveled up)
        const newUnlocks = this.addExperience(experience, locations, tackleShop);
        this.addMoney(value);
        
        this.save();
        return newUnlocks;
    }
    
    /**
     * Update fish collection
     * @param {number} fishId - Fish ID
     * @returns {boolean} True if first catch
     */
    unlockFish(fishId) {
        if (!this.caughtFishCollection[fishId]) {
            this.caughtFishCollection[fishId] = {
                caught: true,
                firstCatchDate: Date.now(),
                count: 1
            };
            this.save();
            return true; // First catch
        } else {
            this.caughtFishCollection[fishId].count++;
            this.save();
            return false; // Already caught before
        }
    }
    
    /**
     * Check if fish is in collection
     * @param {number} fishId - Fish ID
     * @returns {boolean} True if caught
     */
    isFishUnlocked(fishId) {
        return this.caughtFishCollection[fishId]?.caught || false;
    }
    
    /**
     * Get collection stats
     * @returns {Object} {caught, total, percentage}
     */
    getCollectionStats() {
        const total = 33; // Total fish types
        const caught = Object.values(this.caughtFishCollection).filter(f => f.caught).length;
        const percentage = Math.round((caught / total) * 100);
        
        return { caught, total, percentage };
    }
    
    /**
     * Save player data to localStorage without triggering a server sync
     */
    saveLocal() {
        try {
            const playerData = {
                name: this.name,
                level: this.level,
                money: this.money,
                experience: this.experience,
                stats: this.stats,
                totalCaught: this.totalCaught,
                totalWeight: this.totalWeight,
                biggestCatch: this.biggestCatch,
                locationUnlocks: this.locationUnlocks,
                tackleUnlocks: this.tackleUnlocks,
                gear: this.gear,
                recentCatches: this.recentCatches,
                top10BiggestFish: this.top10BiggestFish,
                caughtFish: this.caughtFish,
                caughtFishCollection: this.caughtFishCollection,
                achievements: this.achievements,
                currentLocationIndex: this.currentLocationIndex
            };
            
            if (this.userId) {
                playerData.userId = this.userId;
            }
            if (this.friendCode) {
                playerData.friendCode = this.friendCode;
            }
            
            localStorage.setItem('kittyCreekPlayer', JSON.stringify(playerData));
            
            // Create backup
            localStorage.setItem('kittyCreekPlayer_backup', JSON.stringify(playerData));
            
            console.log('[PLAYER] Data saved');
        } catch (error) {
            console.error('[PLAYER] Failed to save:', error);
        }
    }

    /**
     * Save player data and optionally sync with the server
     * @param {Object} options
     * @param {boolean} options.skipSync - When true, skip server synchronization
     */
    save(options = {}) {
        this.saveLocal();
        if (!options.skipSync) {
            this.scheduleSync();
        }
    }

    /**
     * Attach API client for server synchronization
     * @param {Object} apiInstance
     */
    setAPI(apiInstance) {
        this.api = apiInstance;
    }

    /**
     * Update user context (userId, username, friend code)
     * @param {{ userId?: string, username?: string, friendCode?: string }} context
     */
    setUserContext(context = {}) {
        if (context.userId) {
            this.userId = context.userId;
        }
        if (context.username) {
            this.name = context.username;
        }
        if (context.friendCode) {
            this.friendCode = context.friendCode;
        }

        // Persist context locally without triggering sync back to server
        this.save({ skipSync: true });
    }

    /**
     * Allow background synchronization once initial data has been loaded
     */
    enableSync() {
        this.syncEnabled = true;
    }

    /**
     * Merge data fetched from the server into local state
     * @param {Object} serverData
     */
    applyServerData(serverData) {
        if (!serverData || typeof serverData !== 'object') {
            return;
        }

        const level = serverData.level ?? serverData.playerLevel;
        const experience = serverData.experience ?? serverData.playerExperience;
        const money = serverData.money ?? serverData.balance;
        const totalCaught = serverData.total_caught ?? serverData.totalCaught;
        const biggestCatch = serverData.biggest_catch ?? serverData.biggestCatch;
        const stats = serverData.player_stats ?? serverData.stats;
        const username = serverData.username ?? serverData.name;
        const friendCode = serverData.friend_code ?? serverData.friendCode;
        const userId = serverData.id ?? serverData.userId;

        if (typeof level === 'number') this.level = level;
        if (typeof experience === 'number') this.experience = experience;
        if (typeof money === 'number') this.money = money;
        if (typeof totalCaught === 'number') this.totalCaught = totalCaught;
        if (biggestCatch !== undefined && biggestCatch !== null) {
            const parsedCatch = typeof biggestCatch === 'string' ? parseFloat(biggestCatch) : biggestCatch;
            if (!Number.isNaN(parsedCatch)) {
                this.biggestCatch = parsedCatch;
            }
        }
        if (stats && typeof stats === 'object') {
            this.stats = { ...this.stats, ...stats };
        }
        if (username) {
            this.name = username;
        }
        if (friendCode) {
            this.friendCode = friendCode;
        }
        if (userId) {
            this.userId = userId;
        }

        this.save({ skipSync: true });
    }

    /**
     * Schedule a background sync to the backend
     */
    scheduleSync() {
        if (!this.syncEnabled || !this.api || !this.userId) {
            return;
        }

        if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
        }

        this._syncTimeout = setTimeout(() => {
            this.syncToServer().catch(error => {
                console.error('[PLAYER] Failed to sync with server:', error);
            });
        }, 500);
    }

    /**
     * Push the latest state to the backend
     */
    async syncToServer() {
        if (!this.api || !this.userId) {
            return;
        }

        await this.api.updatePlayer({
            level: this.level,
            experience: this.experience,
            money: this.money,
            totalCaught: this.totalCaught,
            biggestCatch: this.biggestCatch,
            stats: this.stats
        });
    }
    
    /**
     * Load player data from localStorage
     */
    load() {
        try {
            const savedData = localStorage.getItem('kittyCreekPlayer');
            
            if (savedData) {
                const playerData = JSON.parse(savedData);
                
                // Merge saved data with defaults
                this.name = playerData.name || this.name;
                this.level = playerData.level || this.level;
                this.money = playerData.money !== undefined ? playerData.money : this.money;
                this.experience = playerData.experience || this.experience;
                this.stats = { ...this.stats, ...(playerData.stats || {}) };
                this.totalCaught = playerData.totalCaught || 0;
                this.totalWeight = playerData.totalWeight || 0;
                this.biggestCatch = playerData.biggestCatch || 0;
                this.locationUnlocks = playerData.locationUnlocks || this.locationUnlocks;
                this.tackleUnlocks = playerData.tackleUnlocks || this.tackleUnlocks;
                this.gear = { ...this.gear, ...(playerData.gear || {}) };
                this.recentCatches = playerData.recentCatches || [];
                this.top10BiggestFish = playerData.top10BiggestFish || [];
                this.caughtFish = playerData.caughtFish || {};
                this.caughtFishCollection = playerData.caughtFishCollection || {};
                if (typeof playerData.currentLocationIndex === 'number') {
                    this.currentLocationIndex = playerData.currentLocationIndex;
                }
                // Migrate old array-based achievements to object-based
                if (Array.isArray(playerData.achievements)) {
                    const oldAchievements = playerData.achievements;
                    this.achievements = {};
                    oldAchievements.forEach(id => {
                        this.achievements[id] = 1; // Convert to tier 1
                    });
                } else {
                    this.achievements = playerData.achievements || {};
                }

                if (playerData.userId) {
                    this.userId = playerData.userId;
                }
                if (playerData.friendCode) {
                    this.friendCode = playerData.friendCode;
                }
                
                console.log('[PLAYER] Data loaded');
            }
        } catch (error) {
            console.error('[PLAYER] Failed to load:', error);
            // Try backup if main save fails
            try {
                const backupData = localStorage.getItem('kittyCreekPlayer_backup');
                if (backupData) {
                    const playerData = JSON.parse(backupData);
                    Object.assign(this, playerData);
                    console.log('[PLAYER] Loaded from backup');
                }
            } catch (backupError) {
                console.error('[PLAYER] Backup load also failed:', backupError);
            }
        }
    }
    
    /**
     * Get player data for display
     * @returns {Object} Player data
     */
    getData() {
        return {
            name: this.name,
            level: this.level,
            money: this.money,
            experience: this.experience,
            expNeeded: this.calculateExpForLevel(this.level),
            stats: this.stats,
            totalCaught: this.totalCaught,
            totalWeight: this.totalWeight,
            biggestCatch: this.biggestCatch,
            gear: this.gear,
            collectionStats: this.getCollectionStats()
        };
    }
}

