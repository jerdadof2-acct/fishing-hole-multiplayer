/**
 * Fish Collection System
 * Tracks which fish have been caught and unlocked in collection
 */

export class FishCollection {
    constructor(initialData = null) {
        // Structure: { fishId: {caught: boolean, firstCatchDate: timestamp, count: number} }
        this.caughtFishCollection = {};
        this.api = null;
        this.userId = null;
        this.syncEnabled = false;
        this._syncTimeout = null;

        this.load();

        if (initialData) {
            this.applyServerData(initialData);
        }
    }
    
    /**
     * Unlock a fish in the collection (first catch)
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
     * Check if fish is unlocked
     * @param {number} fishId - Fish ID
     * @returns {boolean} True if caught
     */
    isFishUnlocked(fishId) {
        return this.caughtFishCollection[fishId]?.caught || false;
    }
    
    /**
     * Get fish collection data
     * @param {number} fishId - Fish ID
     * @returns {Object|null} Collection data or null
     */
    getFishData(fishId) {
        return this.caughtFishCollection[fishId] || null;
    }
    
    /**
     * Get collection statistics
     * @returns {Object} {caught, total, percentage}
     */
    getCollectionStats() {
        const total = 33; // Total fish types
        const caught = Object.values(this.caughtFishCollection).filter(f => f.caught).length;
        const percentage = Math.round((caught / total) * 100);
        
        return { caught, total, percentage };
    }
    
    /**
     * Get all collection data
     * @returns {Object} All fish collection data
     */
    getAllCollectionData() {
        return this.caughtFishCollection;
    }
    
    /**
     * Get fish image path
     * @param {string} fishName - Fish name
     * @returns {string} Image path
     */
    getFishImagePath(fishName) {
        // Fish images are in assets/images/ with Title Case names (e.g., "Bass.png", "Ancient Sturgeon.png")
        // Keep the fish name as-is (Title Case with spaces) since that's how the files are named
        return `assets/images/${fishName}.png`;
    }
    
    /**
     * Preload fish images
     * @param {Array} fishIds - Array of fish IDs to preload
     */
    preloadImages(fishIds) {
        // This will be implemented when we have fish images
        // For now, just a placeholder
    }
    
    /**
     * Save collection to localStorage without syncing
     */
    saveLocal() {
        try {
            const collectionData = {
                caughtFishCollection: this.caughtFishCollection
            };

            if (this.userId) {
                collectionData.userId = this.userId;
            }
            
            localStorage.setItem('kittyCreekCollection', JSON.stringify(collectionData));
            
            // Create backup
            localStorage.setItem('kittyCreekCollection_backup', JSON.stringify(collectionData));
        } catch (error) {
            console.error('[FISH_COLLECTION] Failed to save:', error);
        }
    }
    
    /**
     * Save collection and optionally sync with backend
     * @param {Object} options
     * @param {boolean} options.skipSync - When true, do not sync to server
     */
    save(options = {}) {
        this.saveLocal();
        if (!options.skipSync) {
            this.scheduleSync();
        }
    }

    /**
     * Load collection from localStorage
     */
    load() {
        try {
            const savedData = localStorage.getItem('kittyCreekCollection');
            
            if (savedData) {
                const collectionData = JSON.parse(savedData);
                
                this.caughtFishCollection = collectionData.caughtFishCollection || {};
                if (collectionData.userId) {
                    this.userId = collectionData.userId;
                }
            }
        } catch (error) {
            console.error('[FISH_COLLECTION] Failed to load:', error);
            // Try backup
            try {
                const backupData = localStorage.getItem('kittyCreekCollection_backup');
                if (backupData) {
                    const collectionData = JSON.parse(backupData);
                    this.caughtFishCollection = collectionData.caughtFishCollection || {};
                }
            } catch (backupError) {
                console.error('[FISH_COLLECTION] Backup load also failed:', backupError);
            }
        }
    }

    /**
     * Attach API client
     * @param {Object} apiInstance
     */
    setAPI(apiInstance) {
        this.api = apiInstance;
    }

    /**
     * Update user context
     * @param {{ userId?: string }} context
     */
    setUserContext(context = {}) {
        if (context.userId) {
            this.userId = context.userId;
        }
    }

    /**
     * Enable synchronization with backend
     */
    enableSync() {
        this.syncEnabled = true;
    }

    /**
     * Merge data retrieved from server
     * @param {Object} serverData
     */
    applyServerData(serverData) {
        if (!serverData || typeof serverData !== 'object') {
            return;
        }

        this.caughtFishCollection = { ...serverData };
        this.save({ skipSync: true });
    }

    /**
     * Schedule sync to backend
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
                console.error('[FISH_COLLECTION] Failed to sync with server:', error);
            });
        }, 500);
    }

    /**
     * Send latest collection to backend
     */
    async syncToServer() {
        if (!this.api || !this.userId) {
            return;
        }

        await this.api.updatePlayerCollection(this.caughtFishCollection);
    }
}

