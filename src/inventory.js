/**
 * Inventory & Catch Tracking System
 * Tracks recent catches and top 10 biggest fish
 */

export class Inventory {
    constructor() {
        this.recentCatches = []; // Last 10 catches
        this.top10BiggestFish = []; // Top 10 biggest fish ever (sorted by weight)
        this.caughtFish = {}; // Dictionary: {fishName: true}
    }
    
    /**
     * Add a catch to inventory
     * @param {Object} catchData - {fishName, weight, fishId, value, experience, timestamp}
     */
    addCatch(catchData) {
        const { fishName, weight, fishId, value, experience, reactionTimeMs = null } = catchData;
        const timestamp = catchData.timestamp || Date.now();
        
        // Add to recent catches (keep last 10)
        this.recentCatches.unshift({
            fishName,
            weight,
            fishId,
            value,
            experience,
            reactionTimeMs,
            timestamp
        });
        
        if (this.recentCatches.length > 10) {
            this.recentCatches.pop();
        }
        
        // Update top 10 biggest fish
        this.updateTop10({
            fishName,
            weight,
            fishId,
            value,
            experience,
            timestamp
        });
        
        // Mark as caught
        this.caughtFish[fishName] = true;
    }
    
    /**
     * Update top 10 biggest fish list
     * @param {Object} catchData - Catch data to add
     */
    updateTop10(catchData) {
        // Add new catch
        this.top10BiggestFish.push({
            ...catchData,
            timestamp: catchData.timestamp || Date.now()
        });
        
        // Sort by weight (descending)
        this.top10BiggestFish.sort((a, b) => b.weight - a.weight);
        
        // Keep only top 10
        if (this.top10BiggestFish.length > 10) {
            this.top10BiggestFish = this.top10BiggestFish.slice(0, 10);
        }
    }
    
    /**
     * Get recent catches
     * @param {number} limit - Maximum number to return (default: 10)
     * @returns {Array} Recent catches
     */
    getRecentCatches(limit = 10) {
        return this.recentCatches.slice(0, limit);
    }
    
    /**
     * Get top 10 biggest fish
     * @returns {Array} Top 10 biggest fish
     */
    getTop10() {
        return this.top10BiggestFish.slice(0, 10);
    }
    
    /**
     * Check if fish has been caught
     * @param {string} fishName - Fish name
     * @returns {boolean} True if caught
     */
    hasCaughtFish(fishName) {
        return this.caughtFish[fishName] === true;
    }
    
    /**
     * Get inventory stats
     * @returns {Object} Inventory statistics
     */
    getStats() {
        return {
            totalCatches: this.recentCatches.length,
            top10Count: this.top10BiggestFish.length,
            uniqueFish: Object.keys(this.caughtFish).length,
            biggestFish: this.top10BiggestFish.length > 0 ? this.top10BiggestFish[0] : null
        };
    }
    
    /**
     * Save inventory to localStorage
     */
    save() {
        try {
            const inventoryData = {
                recentCatches: this.recentCatches,
                top10BiggestFish: this.top10BiggestFish,
                caughtFish: this.caughtFish
            };
            
            localStorage.setItem('kittyCreekInventory', JSON.stringify(inventoryData));
            
            // Create backup
            localStorage.setItem('kittyCreekInventory_backup', JSON.stringify(inventoryData));
        } catch (error) {
            console.error('[INVENTORY] Failed to save:', error);
        }
    }
    
    /**
     * Load inventory from localStorage
     */
    load() {
        try {
            const savedData = localStorage.getItem('kittyCreekInventory');
            
            if (savedData) {
                const inventoryData = JSON.parse(savedData);
                
                this.recentCatches = inventoryData.recentCatches || [];
                this.top10BiggestFish = inventoryData.top10BiggestFish || [];
                this.caughtFish = inventoryData.caughtFish || {};
            }
        } catch (error) {
            console.error('[INVENTORY] Failed to load:', error);
            // Try backup
            try {
                const backupData = localStorage.getItem('kittyCreekInventory_backup');
                if (backupData) {
                    const inventoryData = JSON.parse(backupData);
                    this.recentCatches = inventoryData.recentCatches || [];
                    this.top10BiggestFish = inventoryData.top10BiggestFish || [];
                    this.caughtFish = inventoryData.caughtFish || {};
                }
            } catch (backupError) {
                console.error('[INVENTORY] Backup load also failed:', backupError);
            }
        }
    }
}







