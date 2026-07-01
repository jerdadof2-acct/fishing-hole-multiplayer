import {
    MAX_ENERGY,
    CAST_ENERGY_COST,
    REGEN_INTERVAL_MS,
    REGEN_AMOUNT,
    DAILY_BONUS_ENERGY,
    DAILY_BONUS_COINS,
    FIRST_CATCH_BONUS_COINS,
    FIRST_CATCH_BONUS_ENERGY
} from './config/energy.js';

/** @returns {string} YYYY-MM-DD in local timezone */
export function getCalendarDateString(date = new Date()) {
    return date.toLocaleDateString('en-CA');
}

/**
 * Apply offline / passive regen (+1 per 5 minutes, even while closed).
 * @returns {number} Energy gained this tick
 */
export function applyOfflineEnergyRegen(player) {
    if (!player) return 0;

    const max = player.maxEnergy ?? MAX_ENERGY;
    if (player.energy >= max) {
        player.lastEnergyRegenAt = Date.now();
        return 0;
    }

    if (!player.lastEnergyRegenAt) {
        player.lastEnergyRegenAt = Date.now();
        return 0;
    }

    const now = Date.now();
    const elapsed = now - player.lastEnergyRegenAt;
    const ticks = Math.floor(elapsed / REGEN_INTERVAL_MS);
    if (ticks <= 0) return 0;

    const gained = Math.min(ticks * REGEN_AMOUNT, max - player.energy);
    if (gained > 0) {
        player.energy += gained;
        player.lastEnergyRegenAt += ticks * REGEN_INTERVAL_MS;
    }
    return gained;
}

export function canAffordCast(player) {
    if (!player) return false;
    return (player.energy ?? 0) >= CAST_ENERGY_COST;
}

export function spendCastEnergy(player) {
    if (!canAffordCast(player)) return false;
    player.energy -= CAST_ENERGY_COST;
    return true;
}

export function restoreFullEnergy(player) {
    if (!player) return;
    player.energy = player.maxEnergy ?? MAX_ENERGY;
    player.lastEnergyRegenAt = Date.now();
}

/** Passive regen / level-up fills — never above maxEnergy. */
export function addEnergy(player, amount) {
    if (!player || amount <= 0) return 0;
    const max = player.maxEnergy ?? MAX_ENERGY;
    const before = player.energy ?? 0;
    player.energy = Math.min(max, before + amount);
    return player.energy - before;
}

/** Daily bonus, ads — may stack above max (e.g. 125/100). */
export function addBonusEnergy(player, amount) {
    if (!player || amount <= 0) return 0;
    const before = player.energy ?? 0;
    player.energy = before + amount;
    return amount;
}

export function isDailyBonusAvailable(player) {
    return player?.lastDailyBonusDate !== getCalendarDateString();
}

/**
 * @returns {{ energyGained: number, coins: number }|null}
 */
export function claimDailyBonus(player) {
    if (!player || !isDailyBonusAvailable(player)) return null;
    player.lastDailyBonusDate = getCalendarDateString();
    const energyGained = addBonusEnergy(player, DAILY_BONUS_ENERGY);
    player.addMoney(DAILY_BONUS_COINS);
    player.save();
    return { energyGained, coins: DAILY_BONUS_COINS };
}

export function isFirstCatchOfDayAvailable(player) {
    return player?.lastFirstCatchBonusDate !== getCalendarDateString();
}

/**
 * First successful catch each calendar day — extra coins + energy.
 * @returns {{ coins: number, energyGained: number }|null}
 */
export function applyFirstCatchOfDayBonus(player) {
    if (!player || !isFirstCatchOfDayAvailable(player)) {
        return null;
    }
    player.lastFirstCatchBonusDate = getCalendarDateString();
    const energyGained = addBonusEnergy(player, FIRST_CATCH_BONUS_ENERGY);
    player.addMoney(FIRST_CATCH_BONUS_COINS);
    player.save();
    return { coins: FIRST_CATCH_BONUS_COINS, energyGained };
}

export function getEnergyRegenProgress(player) {
    if (!player || player.energy >= (player.maxEnergy ?? MAX_ENERGY)) {
        return 1;
    }
    const anchor = player.lastEnergyRegenAt || Date.now();
    const elapsed = Date.now() - anchor;
    return Math.min(1, elapsed / REGEN_INTERVAL_MS);
}

export function getMsUntilNextEnergy(player) {
    if (!player || player.energy >= (player.maxEnergy ?? MAX_ENERGY)) {
        return 0;
    }
    const anchor = player.lastEnergyRegenAt || Date.now();
    const elapsed = Date.now() - anchor;
    return Math.max(0, REGEN_INTERVAL_MS - elapsed);
}

export { CAST_ENERGY_COST, MAX_ENERGY };
