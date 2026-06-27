/**
 * Halley quips for the catch presentation card — one random line per catch.
 */

const COMMON_LINES = [
    'Another one for the cooler. My cooler is imaginary but very full.',
    'Fish secured. Dignity… pending review.',
    'That one fought like it owed me rent.',
    'Hook, line, and swagger.',
    'I would look humble, but the fish asked me not to.',
    'Tell the lake I said thanks. Politely.',
    'My whiskers knew that was coming.',
    'Not bad for a cat with no thumbs.',
    'Scale model success. Literally.',
    'The worm sends its regards.'
];

const UNCOMMON_LINES = [
    'Ooh, a little fancier than usual. I respect the hustle.',
    'That fish had main-character energy.',
    'Lake said “surprise” and I said “yes.”',
    'Adding this to my autobiography, chapter: obvious.',
    'My tail is doing a victory twitch.',
    'That catch had plot armor. I had a rod.',
    'Uncommon? More like uncommonly handsome on my hook.',
    'The dock crowd goes mild — but they are impressed.'
];

const RARE_LINES = [
    'Rare fish, rare charisma. Mostly the fish.',
    'I should charge admission for this hook.',
    'That one glittered like my ego.',
    'Legends whisper when I reel. It is mostly me whispering.',
    'Rare enough that I will brag at least twice.',
    'My rod bent. My heart sang. My neighbors sighed.',
    'That fish picked the wrong legendary angler.',
    'Diamonds are forever. This one is dinner.'
];

const EPIC_LINES = [
    'Epic catch. Epic hair day. Coincidence? No.',
    'The lake just filed a complaint. I filed a trophy photo.',
    'That fish had its own theme music. I hummed along.',
    'Epic enough to skip my nap. Almost.',
    'I came for peace and quiet. I got a blockbuster.',
    'My reel screamed. I whispered “thank you.”',
    'That is going straight to the brag board and the group chat.',
    'Epic fish, epic me. Mostly epic me.'
];

const LEGENDARY_LINES = [
    'Legendary! I will pretend I planned that.',
    'The fish bowed. I nodded. We understood each other.',
    'History books, prepare a chapter called “Halley.”',
    'I should build a statue. Of me. Holding this fish.',
    'Legendary catch. Legendary cat. You are looking at one of them.',
    'That fish had a résumé. I had claws.',
    'Even the seagulls are jealous. Rude birds.',
    'I will never financially recover from how cool that was.'
];

const TROPHY_LINES = [
    'Trophy fish! My mantle is mostly imaginary but this counts.',
    'That is not a fish. That is a flex.',
    'Trophy secured. Humble mode: disabled.',
    'Mount it? I am the mount.',
    'The lake apologized. I accepted.',
    'Trophy tier. Tail tier. Peak tier.',
    'I will tell this story until everyone stops inviting me places.',
    'Big fish energy. Bigger cat energy.'
];

const HUGE_LINES = [
    'That is less “fish” and more “submarine with scales.”',
    'My arms are short but my dreams are wide.',
    'Size check: passed. Pants check: still fits. Somehow.',
    'That fish brought friends. I brought attitude.',
    'Huge catch. Huge nap later.',
    'The scale broke. I did not.'
];

const BY_RARITY = {
    Common: COMMON_LINES,
    Uncommon: UNCOMMON_LINES,
    Rare: RARE_LINES,
    Epic: EPIC_LINES,
    Legendary: LEGENDARY_LINES,
    Trophy: TROPHY_LINES,
    Mythic: LEGENDARY_LINES
};

const FIRST_CATCH_LINES = [
    'New species! My collection just got dangerously impressive.',
    'First time seeing this one. Hello, dinner acquaintance.',
    'Added to the logbook. My logbook is very smug now.',
    'A new fish enters the legend. The legend is me.',
    'Catalogued! Science thanks me. The fish less so.'
];

function pickRandom(lines) {
    if (!lines?.length) return '';
    return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * @param {{ rarity?: string, weight?: number, species?: string, name?: string }} fish
 * @param {{ isFirstCatch?: boolean, isHuge?: boolean }} [options]
 */
export function pickCatchHalleyLine(fish, options = {}) {
    const rarity = fish?.rarity || 'Common';
    const weight = typeof fish?.weight === 'number' ? fish.weight : 0;
    const maxWeight = fish?.maxWeight;
    const isHuge = options.isHuge
        ?? (typeof maxWeight === 'number' && maxWeight > 0 && weight > maxWeight * 0.8);

    if (options.isFirstCatch && Math.random() < 0.55) {
        return pickRandom(FIRST_CATCH_LINES);
    }
    if (isHuge && Math.random() < 0.45) {
        return pickRandom(HUGE_LINES);
    }
    return pickRandom(BY_RARITY[rarity] || COMMON_LINES);
}

export function getCatchWeightClass(weight) {
    if (weight < 3) return 'catch-weight-small';
    if (weight < 4) return 'catch-weight-medium';
    if (weight < 6) return 'catch-weight-large';
    if (weight < 10) return 'catch-weight-huge';
    return 'catch-weight-monster';
}

export function normalizeCatchRarityClass(rarity = 'Common') {
    return String(rarity).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
