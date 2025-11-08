/**
 * Leaderboard System
 * Tracks top catches per location and global top 10
 */

export class Leaderboard {
    constructor() {
        // Structure: { locationId: [{playerName, fishName, weight, timestamp}], global: [...] }
        this.leaderboards = {};
        this.global = [];
        
        this.load();
    }
    
    /**
     * Add a catch to leaderboards
     * @param {Object} catchData - {playerName, fishName, weight, locationId, timestamp}
     */
    addCatch(catchData) {
        const { playerName, fishName, weight, locationId, timestamp } = catchData;
        const catchEntry = {
            playerName,
            fishName,
            weight,
            timestamp: timestamp || Date.now()
        };
        
        // Add to location leaderboard
        if (locationId !== undefined && locationId !== null) {
            if (!this.leaderboards[locationId]) {
                this.leaderboards[locationId] = [];
            }
            
            this.leaderboards[locationId].push(catchEntry);
            
            // Sort by weight (descending) and keep top 10
            this.leaderboards[locationId].sort((a, b) => b.weight - a.weight);
            if (this.leaderboards[locationId].length > 10) {
                this.leaderboards[locationId] = this.leaderboards[locationId].slice(0, 10);
            }
        }
        
        // Add to global leaderboard
        this.global.push(catchEntry);
        
        // Sort by weight (descending) and keep top 10
        this.global.sort((a, b) => b.weight - a.weight);
        if (this.global.length > 10) {
            this.global = this.global.slice(0, 10);
        }
        
        this.save();
    }
    
    /**
     * Get top 10 for a location
     * @param {number} locationId - Location ID
     * @returns {Array} Top 10 catches for location
     */
    getTop10ForLocation(locationId) {
        return this.leaderboards[locationId] || [];
    }
    
    /**
     * Get global top 10
     * @returns {Array} Global top 10 catches
     */
    getGlobalTop10() {
        return this.global.slice(0, 10);
    }
    
    /**
     * Get player rank in location leaderboard
     * @param {string} playerName - Player name
     * @param {number} locationId - Location ID
     * @returns {number} Rank (1-based, or -1 if not in top 10)
     */
    getPlayerRankInLocation(playerName, locationId) {
        const top10 = this.getTop10ForLocation(locationId);
        
        for (let i = 0; i < top10.length; i++) {
            if (top10[i].playerName === playerName) {
                return i + 1;
            }
        }
        
        return -1;
    }
    
    /**
     * Get player rank in global leaderboard
     * @param {string} playerName - Player name
     * @returns {number} Rank (1-based, or -1 if not in top 10)
     */
    getPlayerRankInGlobal(playerName) {
        const top10 = this.getGlobalTop10();
        
        for (let i = 0; i < top10.length; i++) {
            if (top10[i].playerName === playerName) {
                return i + 1;
            }
        }
        
        return -1;
    }
    
    /**
     * Get leaderboard data for display (top 10 + player if not in top 10)
     * @param {string} playerName - Player name
     * @param {number} locationId - Location ID (optional, for location leaderboard)
     * @returns {Object} {top10: Array, playerEntry: Object|null, playerRank: number}
     */
    getLeaderboardData(playerName, locationId = null) {
        const top10 = locationId !== null 
            ? this.getTop10ForLocation(locationId)
            : this.getGlobalTop10();
        
        const playerRank = locationId !== null
            ? this.getPlayerRankInLocation(playerName, locationId)
            : this.getPlayerRankInGlobal(playerName);
        
        // Check if player is in top 10
        let playerEntry = null;
        if (playerRank === -1) {
            // Player not in top 10, need to find their entry
            const allEntries = locationId !== null
                ? this.leaderboards[locationId] || []
                : this.global;
            
            // Find player's best catch
            let bestCatch = null;
            for (const entry of allEntries) {
                if (entry.playerName === playerName) {
                    if (!bestCatch || entry.weight > bestCatch.weight) {
                        bestCatch = entry;
                    }
                }
            }
            playerEntry = bestCatch;
        }
        
        return {
            top10,
            playerEntry,
            playerRank
        };
    }
    
    /**
     * Save leaderboards to localStorage
     */
    save() {
        try {
            const leaderboardData = {
                leaderboards: this.leaderboards,
                global: this.global
            };
            
            localStorage.setItem('kittyCreekLeaderboard', JSON.stringify(leaderboardData));
            
            // Create backup
            localStorage.setItem('kittyCreekLeaderboard_backup', JSON.stringify(leaderboardData));
        } catch (error) {
            console.error('[LEADERBOARD] Failed to save:', error);
        }
    }
    
    /**
     * Load leaderboards from localStorage
     */
    load() {
        try {
            const savedData = localStorage.getItem('kittyCreekLeaderboard');
            
            if (savedData) {
                const leaderboardData = JSON.parse(savedData);
                
                this.leaderboards = leaderboardData.leaderboards || {};
                this.global = leaderboardData.global || [];
            }
        } catch (error) {
            console.error('[LEADERBOARD] Failed to load:', error);
            // Try backup
            try {
                const backupData = localStorage.getItem('kittyCreekLeaderboard_backup');
                if (backupData) {
                    const leaderboardData = JSON.parse(backupData);
                    this.leaderboards = leaderboardData.leaderboards || {};
                    this.global = leaderboardData.global || [];
                }
            } catch (backupError) {
                console.error('[LEADERBOARD] Backup load also failed:', backupError);
            }
        }
    }
}







