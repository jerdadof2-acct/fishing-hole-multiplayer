/** Halley's Big Catch — Energy System v1.0 */

export const MAX_ENERGY = 100;
export const CAST_ENERGY_COST = 4;
export const REGEN_INTERVAL_MS = 5 * 60 * 1000;
export const REGEN_AMOUNT = 1;
export const DAILY_BONUS_ENERGY = 25;
export const DAILY_BONUS_COINS = 100;
export const FIRST_CATCH_BONUS_COINS = 50;
export const FIRST_CATCH_BONUS_ENERGY = 10;
export const LEVEL_UP_ENERGY_BONUS = 25;
export const AD_ENERGY_REWARD = 20;
export const NINE_LIVES_ENERGY = 50;
export const NINE_LIVES_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Halley-flavored lines when out of energy (random pick). */
export const OUT_OF_ENERGY_LINES = [
    "Halley's getting tired.",
    'Time for a quick break.',
    'The fish will still be here later.',
    'Even great fishermen need to recharge.',
    'Your next big catch can wait a few minutes.',
    "I think I've made enough casts for now.",
    'My paws are getting tired.',
    "Those fish aren't going anywhere.",
    'I could really use a tuna sandwich.'
];
