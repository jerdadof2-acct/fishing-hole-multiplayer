import { FishTypes } from './fishTypes.js';

const RARE_RARITIES = ['Rare', 'Epic', 'Legendary', 'Trophy'];

function getRareCatchCount(player) {
    if (!player?.caughtFishCollection) return 0;
    let total = 0;
    for (const [id, data] of Object.entries(player.caughtFishCollection)) {
        if (!data || !data.caught) continue;
        const fishType = FishTypes.find(f => f.id === Number(id));
        if (fishType && RARE_RARITIES.includes(fishType.rarity)) {
            total += data.count || 1;
        }
    }
    return total;
}

function getLegendaryCatchCount(player) {
    if (!player?.caughtFishCollection) return 0;
    let total = 0;
    for (const [id, data] of Object.entries(player.caughtFishCollection)) {
        if (!data || !data.caught) continue;
        const fishType = FishTypes.find(f => f.id === Number(id));
        if (fishType && ['Legendary', 'Trophy'].includes(fishType.rarity)) {
            total += data.count || 1;
        }
    }
    return total;
}

function getUnlockedFishCount(player) {
    if (!player?.caughtFishCollection) return 0;
    return Object.values(player.caughtFishCollection).filter(entry => entry?.caught).length;
}

function getGearCount(player) {
    if (!player?.tackleUnlocks) return 0;
    return Object.values(player.tackleUnlocks).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function getTop10BagWeight(player) {
    if (!Array.isArray(player?.top10BiggestFish)) return 0;
    return player.top10BiggestFish.reduce((sum, fishCatch) => sum + (fishCatch?.weight || 0), 0);
}

// Helper to get current tier for an achievement
function getAchievementTier(player, achievementId) {
    if (!player?.achievements) return 0;
    if (typeof player.achievements === 'object' && player.achievements !== null) {
        return player.achievements[achievementId] || 0;
    }
    // Legacy support: if achievements is an array, check if id exists
    if (Array.isArray(player.achievements)) {
        return player.achievements.includes(achievementId) ? 1 : 0;
    }
    return 0;
}

// Helper to set achievement tier
function setAchievementTier(player, achievementId, tier) {
    if (!player.achievements || typeof player.achievements !== 'object') {
        player.achievements = {};
    }
    player.achievements[achievementId] = tier;
}

// Tiered Achievement Definitions
export const ACHIEVEMENTS = [
    {
        id: 'first_catch',
        name: '🐱 Purr-novice Angler',
        description: 'Catch your first fish',
        getValue: (player) => player.totalCaught,
        unit: 'fish',
        tiers: [
            { target: 1, reward: { experience: 50, money: 25 } }
        ]
    },
    {
        id: 'fish_catcher',
        name: '🐠 Fish Catcher',
        description: 'Catch fish',
        getValue: (player) => player.totalCaught,
        unit: 'fish',
        tiers: [
            { target: 10, reward: { experience: 75, money: 50 } },
            { target: 50, reward: { experience: 200, money: 100 } },
            { target: 100, reward: { experience: 400, money: 200 } },
            { target: 250, reward: { experience: 600, money: 300 } },
            { target: 500, reward: { experience: 1000, money: 500 } },
            { target: 1000, reward: { experience: 2000, money: 1000 } },
            { target: 2500, reward: { experience: 4000, money: 2000 } },
            { target: 5000, reward: { experience: 8000, money: 4000 } }
        ]
    },
    {
        id: 'big_fish',
        name: '🐟 Big Fish Hunter',
        description: 'Catch a big fish',
        getValue: (player) => player.biggestCatch,
        unit: 'lbs',
        tiers: [
            { target: 5, reward: { experience: 100, money: 50 } },
            { target: 10, reward: { experience: 200, money: 100 } },
            { target: 15, reward: { experience: 350, money: 175 } },
            { target: 20, reward: { experience: 500, money: 250 } },
            { target: 30, reward: { experience: 750, money: 375 } },
            { target: 50, reward: { experience: 1500, money: 750 } },
            { target: 75, reward: { experience: 2500, money: 1250 } },
            { target: 100, reward: { experience: 5000, money: 2500 } }
        ]
    },
    {
        id: 'level_reacher',
        name: '⭐ Level Master',
        description: 'Reach levels',
        getValue: (player) => player.level,
        unit: 'level',
        tiers: [
            { target: 5, reward: { experience: 150, money: 75 } },
            { target: 10, reward: { experience: 300, money: 150 } },
            { target: 15, reward: { experience: 500, money: 250 } },
            { target: 20, reward: { experience: 750, money: 375 } },
            { target: 25, reward: { experience: 1000, money: 500 } },
            { target: 30, reward: { experience: 1500, money: 750 } },
            { target: 40, reward: { experience: 2500, money: 1250 } },
            { target: 50, reward: { experience: 5000, money: 2500 } }
        ]
    },
    {
        id: 'money_earner',
        name: '💰 Money Earner',
        description: 'Earn money',
        getValue: (player) => player.money,
        unit: '$',
        prefix: '$',
        tiers: [
            { target: 500, reward: { experience: 50, money: 25 } },
            { target: 1000, reward: { experience: 100, money: 50 } },
            { target: 2500, reward: { experience: 200, money: 100 } },
            { target: 5000, reward: { experience: 400, money: 200 } },
            { target: 10000, reward: { experience: 800, money: 400 } },
            { target: 25000, reward: { experience: 1500, money: 750 } },
            { target: 50000, reward: { experience: 3000, money: 1500 } },
            { target: 100000, reward: { experience: 6000, money: 3000 } }
        ]
    },
    {
        id: 'rare_collector',
        name: '💎 Rare Fish Collector',
        description: 'Catch rare or better fish',
        getValue: (player) => getRareCatchCount(player),
        unit: 'fish',
        tiers: [
            { target: 5, reward: { experience: 150, money: 75 } },
            { target: 10, reward: { experience: 250, money: 125 } },
            { target: 20, reward: { experience: 350, money: 175 } },
            { target: 50, reward: { experience: 600, money: 300 } },
            { target: 100, reward: { experience: 1000, money: 500 } },
            { target: 250, reward: { experience: 2000, money: 1000 } },
            { target: 500, reward: { experience: 4000, money: 2000 } },
            { target: 1000, reward: { experience: 8000, money: 4000 } }
        ]
    },
    {
        id: 'legendary_hunter',
        name: '✨ Legendary Hunter',
        description: 'Catch legendary or trophy fish',
        getValue: (player) => getLegendaryCatchCount(player),
        unit: 'fish',
        tiers: [
            { target: 1, reward: { experience: 500, money: 250 } },
            { target: 3, reward: { experience: 1000, money: 500 } },
            { target: 5, reward: { experience: 1500, money: 750 } },
            { target: 10, reward: { experience: 2500, money: 1250 } },
            { target: 25, reward: { experience: 5000, money: 2500 } },
            { target: 50, reward: { experience: 10000, money: 5000 } },
            { target: 100, reward: { experience: 20000, money: 10000 } }
        ]
    },
    {
        id: 'gear_collector',
        name: '🎒 Gear Collector',
        description: 'Own tackle pieces',
        getValue: (player) => getGearCount(player),
        unit: 'pieces',
        tiers: [
            { target: 5, reward: { experience: 100, money: 50 } },
            { target: 10, reward: { experience: 200, money: 100 } },
            { target: 15, reward: { experience: 350, money: 175 } },
            { target: 20, reward: { experience: 500, money: 250 } },
            { target: 30, reward: { experience: 750, money: 375 } },
            { target: 40, reward: { experience: 1000, money: 500 } },
            { target: 50, reward: { experience: 1500, money: 750 } }
        ]
    },
    {
        id: 'location_explorer',
        name: '🗺️ Location Explorer',
        description: 'Unlock fishing locations',
        getValue: (player, context) => player.locationUnlocks?.length || 0,
        unit: 'locations',
        tiers: [
            { target: 3, reward: { experience: 150, money: 75 } },
            { target: 5, reward: { experience: 300, money: 150 } },
            { target: 8, reward: { experience: 500, money: 250 } },
            { target: 10, reward: { experience: 750, money: 375 } },
            { target: 12, reward: { experience: 1000, money: 500 } },
            { target: 15, reward: { experience: 1500, money: 750 } }
        ]
    },
    {
        id: 'collection_complete',
        name: '📚 Fish Archivist',
        description: 'Unlock fish in collection',
        getValue: (player, context) => getUnlockedFishCount(player),
        unit: 'fish',
        tiers: [
            { target: 5, reward: { experience: 100, money: 50 } },
            { target: 10, reward: { experience: 200, money: 100 } },
            { target: 17, reward: { experience: 400, money: 200 } }, // Half (33/2 = 16.5, rounded up)
            { target: 25, reward: { experience: 600, money: 300 } },
            { target: 30, reward: { experience: 800, money: 400 } },
            { target: 33, reward: { experience: 1000, money: 500 } } // Complete
        ]
    },
    {
        id: 'biggest_bag',
        name: '🎣 Biggest Bag',
        description: 'Reach top 10 bag weight',
        getValue: (player) => getTop10BagWeight(player),
        unit: 'lbs',
        tiers: [
            { target: 25, reward: { experience: 200, money: 100 } },
            { target: 50, reward: { experience: 300, money: 150 } },
            { target: 100, reward: { experience: 500, money: 250 } },
            { target: 200, reward: { experience: 1000, money: 500 } },
            { target: 300, reward: { experience: 1500, money: 750 } },
            { target: 500, reward: { experience: 3000, money: 1500 } },
            { target: 750, reward: { experience: 5000, money: 2500 } },
            { target: 1000, reward: { experience: 10000, money: 5000 } }
        ]
    }
];

// Evaluate achievements and return newly unlocked tiers
export function evaluateAchievements(player, context = {}) {
    const newlyUnlocked = [];
    
    ACHIEVEMENTS.forEach(achievement => {
        const currentTier = getAchievementTier(player, achievement.id);
        const currentValue = achievement.getValue(player, context);
        
        // Check each tier to see if player has reached it
        achievement.tiers.forEach((tier, index) => {
            const tierNumber = index + 1;
            
            // Skip if already unlocked this tier
            if (tierNumber <= currentTier) {
                return;
            }
            
            // Check if player has reached this tier's target
            if (currentValue >= tier.target) {
                newlyUnlocked.push({
                    achievementId: achievement.id,
                    tier: tierNumber,
                    maxTier: achievement.tiers.length,
                    target: tier.target,
                    reward: tier.reward,
                    name: achievement.name,
                    description: achievement.description,
                    unit: achievement.unit,
                    prefix: achievement.prefix || ''
                });
            }
        });
    });
    
    return newlyUnlocked;
}

// Get all achievement statuses with tier information
export function getAchievementStatuses(player, context = {}) {
    return ACHIEVEMENTS.map(achievement => {
        const currentTier = getAchievementTier(player, achievement.id);
        const currentValue = achievement.getValue(player, context);
        const maxTier = achievement.tiers.length;
        
        // Find the next tier to work toward
        let nextTierIndex = currentTier;
        let nextTier = null;
        
        if (currentTier < maxTier) {
            nextTier = achievement.tiers[currentTier];
            nextTierIndex = currentTier;
        } else {
            // All tiers completed
            nextTier = achievement.tiers[maxTier - 1];
            nextTierIndex = maxTier - 1;
        }
        
        const nextTarget = nextTier?.target || 0;
        const progressPercent = nextTarget > 0 ? Math.min(100, (currentValue / nextTarget) * 100) : 100;
        
        return {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            unit: achievement.unit,
            prefix: achievement.prefix || '',
            currentTier,
            maxTier,
            currentValue,
            nextTarget,
            progressPercent,
            nextReward: nextTier?.reward || null,
            isComplete: currentTier >= maxTier,
            allTiers: achievement.tiers.map((tier, index) => ({
                tier: index + 1,
                target: tier.target,
                reward: tier.reward,
                unlocked: (index + 1) <= currentTier
            }))
        };
    });
}
