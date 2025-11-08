/**
 * Bite Detection & Catch Algorithm
 * Implements the bite detection algorithm from reference file
 */

import { getTotalCatchBonus, getHookTimingWindow } from './tackleShop.js';

/**
 * Calculate catch probability based on player stats, gear, and location
 * @param {Object} player - Player instance
 * @param {Object} location - Current location
 * @param {Object} tackleShop - Tackle shop instance
 * @returns {number} Catch probability (0-1)
 */
export function calculateCatchChance(player, location, tackleShop) {
    // Base chance: 90% (increased from 80% in reference)
    let chance = 0.9;
    
    // Progressive difficulty: catch rate DECREASES at higher levels
    if (player.level >= 16) {
        chance -= 0.20; // -20% penalty
    } else if (player.level >= 11) {
        chance -= 0.15; // -15% penalty
    } else if (player.level >= 6) {
        chance -= 0.10; // -10% penalty
    }
    
    // Progressive difficulty based on location difficulty
    if (location.difficulty === 'Easy') {
        chance += 0.05; // Easy locations: +5% catch rate
    } else if (location.difficulty === 'Medium') {
        chance -= 0.02; // -2% penalty
    } else if (location.difficulty === 'Hard') {
        chance -= 0.08; // -8% penalty
    } else if (location.difficulty === 'Expert') {
        chance -= 0.12; // -12% penalty
    }
    
    // Add tackle bonuses
    const totalCatchBonus = getTotalCatchBonus(player);
    chance += totalCatchBonus / 80; // Convert bonus to percentage
    
    // Add player stats bonuses
    const accuracyBonus = (player.stats.accuracy - 50) * 0.0015;
    const luckBonus = (player.stats.luck - 50) * 0.002;
    const patienceBonus = (player.stats.patience - 50) * 0.0008;
    const strengthBonus = (player.stats.strength - 50) * 0.001;
    
    chance += accuracyBonus + luckBonus + patienceBonus + strengthBonus;
    
    // Cap between 20% and 85%
    return Math.min(0.85, Math.max(0.20, chance));
}

/**
 * Calculate bite timing based on player level
 * @param {number} playerLevel - Player level
 * @returns {Object} {min: number, max: number} in milliseconds
 */
export function calculateBiteTiming(playerLevel) {
    // Progressive bite timing based on level
    // Levels 1-5: Quick paced (0.5 to 2 seconds)
    // Levels 6+: Progressively slower (2 to 6+ seconds)
    let minBiteTime = 500; // 0.5 seconds
    let maxBiteTime = 2000; // 2 seconds
    
    if (playerLevel >= 6) {
        // Levels 6-10: 2 to 4 seconds
        minBiteTime = 2000;
        maxBiteTime = 4000;
        
        if (playerLevel >= 11) {
            // Levels 11-15: 3 to 5.5 seconds
            minBiteTime = 3000;
            maxBiteTime = 5500;
            
            if (playerLevel >= 16) {
                // Levels 16+: 4 to 7 seconds
                minBiteTime = 4000;
                maxBiteTime = 7000;
            }
        }
    }
    
    return { min: minBiteTime, max: maxBiteTime };
}

/**
 * Determine if catch is successful based on timing and probability
 * @param {number} catchProbability - Catch probability (0-1)
 * @param {number} reactionTime - Time player took to react (ms)
 * @param {number} timingWindow - Hook timing window (ms)
 * @returns {boolean} True if catch successful
 */
export function determineCatch(catchProbability, reactionTime, timingWindow) {
    // Check if reaction was within timing window
    if (reactionTime > timingWindow) {
        return false; // Too slow - miss
    }
    
    // Apply catch probability
    const random = Math.random();
    return random < catchProbability;
}

/**
 * Get reaction time window (how long player has to react)
 * @returns {number} Reaction time in milliseconds (3-5 seconds)
 */
export function getReactionTimeWindow() {
    return 3000 + Math.random() * 2000; // 3-5 seconds
}







