/**
 * Tackle Shop System
 * Handles all tackle items (rods, reels, lines, hooks, baits) with costs, bonuses, and unlocks
 */

export const TackleShop = {
    rods: [
        { id: 0, name: 'Basic Rod', cost: 0, catchBonus: 0, strength: 10, description: 'Starting rod', unlockLevel: 1 },
        { id: 1, name: 'Fiberglass Rod', cost: 250, catchBonus: 5, strength: 15, description: 'Better durability', unlockLevel: 3 },
        { id: 2, name: 'Carbon Fiber Rod', cost: 1000, catchBonus: 10, strength: 20, description: 'Lightweight and strong', unlockLevel: 6 },
        { id: 3, name: 'Pro Rod', cost: 3500, catchBonus: 15, strength: 25, description: 'Professional grade', unlockLevel: 9 },
        { id: 4, name: 'Master Rod', cost: 10000, catchBonus: 20, strength: 30, description: 'Master angler equipment', unlockLevel: 12 },
        { id: 5, name: 'Legendary Rod', cost: 30000, catchBonus: 25, strength: 40, description: 'Legendary craftsmanship', unlockLevel: 15 },
        { id: 6, name: 'Trophy Rod', cost: 100000, catchBonus: 30, strength: 50, description: 'Trophy fishing specialist', unlockLevel: 18 }
    ],
    
    reels: [
        { id: 0, name: 'Basic Reel', cost: 0, speedBonus: 0, smoothness: 10, description: 'Simple reel', unlockLevel: 1 },
        { id: 1, name: 'Spinning Reel', cost: 200, speedBonus: 5, smoothness: 15, description: 'Smooth retrieval', unlockLevel: 4 },
        { id: 2, name: 'Baitcasting Reel', cost: 750, speedBonus: 10, smoothness: 20, description: 'Precision casting', unlockLevel: 7 },
        { id: 3, name: 'Fly Reel', cost: 2500, speedBonus: 15, smoothness: 25, description: 'Fly fishing specialist', unlockLevel: 10 },
        { id: 4, name: 'Big Game Reel', cost: 8000, speedBonus: 20, smoothness: 30, description: 'Heavy duty fishing', unlockLevel: 13 },
        { id: 5, name: 'Trophy Reel', cost: 25000, speedBonus: 25, smoothness: 40, description: 'Trophy fishing specialist', unlockLevel: 16 }
    ],
    
    lines: [
        { id: 0, name: 'Monofilament', cost: 0, strength: 10, visibility: 5, description: 'Basic fishing line', unlockLevel: 1 },
        { id: 1, name: 'Braided Line', cost: 150, strength: 15, visibility: 3, description: 'Strong and thin', unlockLevel: 5 },
        { id: 2, name: 'Fluorocarbon', cost: 500, strength: 12, visibility: 1, description: 'Nearly invisible', unlockLevel: 8 },
        { id: 3, name: 'Wire Line', cost: 2000, strength: 25, visibility: 8, description: 'Heavy duty fishing', unlockLevel: 12 },
        { id: 4, name: 'Titanium Line', cost: 8000, strength: 35, visibility: 2, description: 'Ultimate strength', unlockLevel: 16 }
    ],
    
    hooks: [
        { id: 0, name: 'Basic Hook', cost: 0, catchBonus: 0, size: 8, timingWindow: 600, description: 'Standard hook - 600ms timing window', unlockLevel: 1 },
        { id: 1, name: 'Barbed Hook', cost: 100, catchBonus: 5, size: 8, timingWindow: 700, description: 'Better fish retention - 700ms timing window', unlockLevel: 3 },
        { id: 2, name: 'Circle Hook', cost: 300, catchBonus: 3, size: 6, timingWindow: 800, description: 'Fish-friendly design - 800ms timing window', unlockLevel: 5 },
        { id: 3, name: 'Treble Hook', cost: 800, catchBonus: 8, size: 6, timingWindow: 900, description: 'Triple hook design - 900ms timing window', unlockLevel: 7 },
        { id: 4, name: 'Jig Hook', cost: 2500, catchBonus: 10, size: 4, timingWindow: 1000, description: 'Jig fishing specialist - 1000ms timing window', unlockLevel: 10 },
        { id: 5, name: 'Trophy Hook', cost: 10000, catchBonus: 15, size: 2, timingWindow: 1100, description: 'Trophy fish specialist - 1100ms timing window', unlockLevel: 15 }
    ],
    
    baits: [
        { id: 0, name: 'Basic Bait', cost: 0, catchBonus: 0, durability: 10, description: 'Simple worm bait', unlockLevel: 1 },
        { id: 1, name: 'Live Bait', cost: 75, catchBonus: 8, durability: 15, description: 'Live worm', unlockLevel: 2 },
        { id: 2, name: 'Artificial Lure', cost: 250, catchBonus: 5, durability: 25, description: 'Reusable lure', unlockLevel: 4 },
        { id: 3, name: 'Premium Bait', cost: 1000, catchBonus: 12, durability: 20, description: 'High-quality bait', unlockLevel: 6 },
        { id: 4, name: 'Specialty Bait', cost: 4000, catchBonus: 18, durability: 15, description: 'Rare fish attractant', unlockLevel: 10 },
        { id: 5, name: 'Trophy Bait', cost: 15000, catchBonus: 25, durability: 10, description: 'Trophy fish magnet', unlockLevel: 15 }
    ]
};

/**
 * Get tackle by category
 * @param {string} category - 'rods', 'reels', 'lines', 'hooks', or 'baits'
 * @returns {Array} Array of tackle items
 */
export function getTackleByCategory(category) {
    return TackleShop[category] || [];
}

/**
 * Get tackle item by name
 * @param {string} category - Category name
 * @param {string} name - Item name
 * @returns {Object|null} Tackle item or null
 */
export function getTackleByName(category, name) {
    const items = getTackleByCategory(category);
    return items.find(item => item.name === name) || null;
}

/**
 * Check if player can afford item
 * @param {number} cost - Item cost
 * @param {number} playerMoney - Player's money
 * @returns {boolean} True if can afford
 */
export function canAfford(cost, playerMoney) {
    return playerMoney >= cost;
}

/**
 * Check if item is unlocked
 * @param {number} unlockLevel - Required level
 * @param {number} playerLevel - Player's level
 * @param {Array} unlockedIds - Array of unlocked item IDs
 * @param {number} itemId - Item ID to check
 * @returns {boolean} True if unlocked
 */
export function canUnlock(unlockLevel, playerLevel, unlockedIds, itemId) {
    // Check if already unlocked
    if (unlockedIds.includes(itemId)) {
        return true;
    }
    
    // Check if level requirement met
    return playerLevel >= unlockLevel;
}

/**
 * Purchase tackle item
 * @param {Object} player - Player instance
 * @param {string} category - Category name
 * @param {number} itemId - Item ID
 * @returns {Object} {success: boolean, message: string}
 */
export function purchase(player, category, itemId) {
    const items = getTackleByCategory(category);
    const item = items.find(i => i.id === itemId);
    
    if (!item) {
        return { success: false, message: 'Item not found' };
    }
    
    // Check if already owned (unlocked)
    if (player.tackleUnlocks[category].includes(itemId)) {
        return { success: false, message: 'Already owned' };
    }
    
    // Check if unlocked by level
    if (!canUnlock(item.unlockLevel, player.level, player.tackleUnlocks[category], itemId)) {
        return { success: false, message: `Requires level ${item.unlockLevel}` };
    }
    
    // Check if can afford
    if (!canAfford(item.cost, player.money)) {
        return { success: false, message: 'Not enough money' };
    }
    
    // Purchase
    if (player.spendMoney(item.cost)) {
        player.tackleUnlocks[category].push(itemId);
        if (player.tackleNotified && Array.isArray(player.tackleNotified[category])) {
            player.tackleNotified[category] = player.tackleNotified[category].filter(id => id !== itemId);
        }
        player.save();
        return { success: true, message: `Purchased ${item.name}` };
    }
    
    return { success: false, message: 'Purchase failed' };
}

/**
 * Equip tackle item
 * @param {Object} player - Player instance
 * @param {string} category - Category name
 * @param {number} itemId - Item ID
 * @returns {Object} {success: boolean, message: string}
 */
export function equip(player, category, itemId) {
    const items = getTackleByCategory(category);
    const item = items.find(i => i.id === itemId);
    
    if (!item) {
        return { success: false, message: 'Item not found' };
    }
    
    // Check if owned
    if (!player.tackleUnlocks[category].includes(itemId)) {
        return { success: false, message: 'Item not owned' };
    }
    
    // Equip
    const gearKey = category.slice(0, -1); // Remove 's' from category (rods -> rod)
    player.gear[gearKey] = item.name;
    player.save();
    
    return { success: true, message: `Equipped ${item.name}` };
}

/**
 * Get total catch bonus from equipped gear
 * @param {Object} player - Player instance
 * @returns {number} Total catch bonus
 */
export function getTotalCatchBonus(player) {
    let bonus = 0;
    
    // Rod bonus
    const rod = getTackleByName('rods', player.gear.rod);
    if (rod) bonus += rod.catchBonus;
    
    // Hook bonus
    const hook = getTackleByName('hooks', player.gear.hook);
    if (hook) bonus += hook.catchBonus;
    
    // Bait bonus
    const bait = getTackleByName('baits', player.gear.bait);
    if (bait) bonus += bait.catchBonus;
    
    return bonus;
}

/**
 * Get hook timing window from equipped hook, adjusted by player level
 * @param {Object} player - Player instance
 * @returns {number} Timing window in milliseconds
 */
export function getHookTimingWindow(player) {
    // Base timing window starts at 1000ms
    const baseWindow = 1000;
    
    // Decrease by 30ms per level (player gets faster with experience)
    const reductionPerLevel = 30;
    const levelReduction = (player.level || 1) * reductionPerLevel;
    
    // Calculate timing window: base - level reduction, minimum 500ms
    const timingWindow = Math.max(500, baseWindow - levelReduction);
    
    return timingWindow;
}

