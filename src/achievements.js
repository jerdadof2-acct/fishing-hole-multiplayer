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
            { target: 1, reward: { experience: 25, money: 50 } }
        ]
    },
    {
        id: 'fish_catcher',
        name: '🐠 Fish Catcher',
        description: 'Catch fish',
        getValue: (player) => player.totalCaught,
        unit: 'fish',
        tiers: [
            { target: 10, reward: { experience: 40, money: 75 } },
            { target: 50, reward: { experience: 90, money: 125 } },
            { target: 100, reward: { experience: 140, money: 200 } },
            { target: 250, reward: { experience: 220, money: 350 } },
            { target: 500, reward: { experience: 320, money: 500 } },
            { target: 1000, reward: { experience: 450, money: 750 } },
            { target: 2500, reward: { experience: 650, money: 1200 } },
            { target: 5000, reward: { experience: 900, money: 2000 } }
        ]
    },
    {
        id: 'big_fish',
        name: '🐟 Big Fish Hunter',
        description: 'Catch a big fish',
        getValue: (player) => player.biggestCatch,
        unit: 'lbs',
        tiers: [
            { target: 5, reward: { experience: 60, money: 80 } },
            { target: 10, reward: { experience: 90, money: 140 } },
            { target: 15, reward: { experience: 130, money: 220 } },
            { target: 20, reward: { experience: 170, money: 320 } },
            { target: 30, reward: { experience: 230, money: 450 } },
            { target: 50, reward: { experience: 320, money: 650 } },
            { target: 75, reward: { experience: 420, money: 900 } },
            { target: 100, reward: { experience: 550, money: 1300 } }
        ]
    },
    {
        id: 'level_reacher',
        name: '⭐ Level Master',
        description: 'Reach levels',
        getValue: (player) => player.level,
        unit: 'level',
        tiers: [
            { target: 5, reward: { experience: 120, money: 150 } },
            { target: 10, reward: { experience: 170, money: 200 } },
            { target: 15, reward: { experience: 230, money: 275 } },
            { target: 20, reward: { experience: 290, money: 350 } },
            { target: 25, reward: { experience: 360, money: 450 } },
            { target: 30, reward: { experience: 440, money: 575 } },
            { target: 40, reward: { experience: 550, money: 750 } },
            { target: 50, reward: { experience: 700, money: 1000 } }
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
            { target: 500, reward: { experience: 40, money: 80 } },
            { target: 1000, reward: { experience: 70, money: 150 } },
            { target: 2500, reward: { experience: 120, money: 250 } },
            { target: 5000, reward: { experience: 180, money: 400 } },
            { target: 10000, reward: { experience: 250, money: 600 } },
            { target: 25000, reward: { experience: 340, money: 900 } },
            { target: 50000, reward: { experience: 460, money: 1400 } },
            { target: 100000, reward: { experience: 600, money: 2200 } }
        ]
    },
    {
        id: 'rare_collector',
        name: '💎 Rare Fish Collector',
        description: 'Catch rare or better fish',
        getValue: (player) => getRareCatchCount(player),
        unit: 'fish',
        tiers: [
            { target: 5, reward: { experience: 110, money: 160 } },
            { target: 10, reward: { experience: 160, money: 240 } },
            { target: 20, reward: { experience: 210, money: 320 } },
            { target: 50, reward: { experience: 280, money: 450 } },
            { target: 100, reward: { experience: 360, money: 650 } },
            { target: 250, reward: { experience: 460, money: 900 } },
            { target: 500, reward: { experience: 580, money: 1300 } },
            { target: 1000, reward: { experience: 720, money: 1800 } }
        ]
    },
    {
        id: 'legendary_hunter',
        name: '✨ Legendary Hunter',
        description: 'Catch legendary or trophy fish',
        getValue: (player) => getLegendaryCatchCount(player),
        unit: 'fish',
        tiers: [
            { target: 1, reward: { experience: 180, money: 400 } },
            { target: 3, reward: { experience: 240, money: 600 } },
            { target: 5, reward: { experience: 320, money: 850 } },
            { target: 10, reward: { experience: 420, money: 1200 } },
            { target: 25, reward: { experience: 520, money: 1700 } },
            { target: 50, reward: { experience: 640, money: 2400 } },
            { target: 100, reward: { experience: 780, money: 3200 } }
        ]
    },
    {
        id: 'gear_collector',
        name: '🎒 Gear Collector',
        description: 'Own tackle pieces',
        getValue: (player) => getGearCount(player),
        unit: 'pieces',
        tiers: [
            { target: 5, reward: { experience: 70, money: 120 } },
            { target: 10, reward: { experience: 110, money: 180 } },
            { target: 15, reward: { experience: 160, money: 260 } },
            { target: 20, reward: { experience: 210, money: 340 } },
            { target: 30, reward: { experience: 280, money: 450 } },
            { target: 40, reward: { experience: 360, money: 600 } },
            { target: 50, reward: { experience: 450, money: 800 } }
        ]
    },
    {
        id: 'location_explorer',
        name: '🗺️ Location Explorer',
        description: 'Unlock fishing locations',
        getValue: (player, context) => player.locationUnlocks?.length || 0,
        unit: 'locations',
        tiers: [
            { target: 3, reward: { experience: 120, money: 150 } },
            { target: 5, reward: { experience: 160, money: 220 } },
            { target: 8, reward: { experience: 210, money: 310 } },
            { target: 10, reward: { experience: 260, money: 400 } },
            { target: 12, reward: { experience: 320, money: 520 } },
            { target: 15, reward: { experience: 390, money: 680 } }
        ]
    },
    {
        id: 'collection_complete',
        name: '📚 Fish Archivist',
        description: 'Unlock fish in collection',
        getValue: (player, context) => getUnlockedFishCount(player),
        unit: 'fish',
        tiers: [
            { target: 5, reward: { experience: 70, money: 100 } },
            { target: 10, reward: { experience: 110, money: 170 } },
            { target: 17, reward: { experience: 160, money: 240 } }, // Half (33/2 = 16.5, rounded up)
            { target: 25, reward: { experience: 210, money: 340 } },
            { target: 30, reward: { experience: 270, money: 450 } },
            { target: 33, reward: { experience: 330, money: 600 } } // Complete
        ]
    },
    {
        id: 'biggest_bag',
        name: '🎣 Biggest Bag',
        description: 'Reach top 10 bag weight',
        getValue: (player) => getTop10BagWeight(player),
        unit: 'lbs',
        tiers: [
            { target: 25, reward: { experience: 110, money: 160 } },
            { target: 50, reward: { experience: 150, money: 240 } },
            { target: 100, reward: { experience: 200, money: 350 } },
            { target: 200, reward: { experience: 260, money: 520 } },
            { target: 300, reward: { experience: 330, money: 700 } },
            { target: 500, reward: { experience: 420, money: 950 } },
            { target: 750, reward: { experience: 520, money: 1300 } },
            { target: 1000, reward: { experience: 640, money: 1800 } }
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
