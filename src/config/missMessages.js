/**
 * Miss / escape banter — fish trash talk, Halley quips, and sized-rarity flair.
 */

export const FISH_TRASH_TALK = [
    'Nice try, whiskers.',
    'Too slow, land cat!',
    'Catch me? That\'s adorable.',
    'Wrong fish, furball.',
    'You almost had me. Almost.',
    'Tell your friends I was enormous.',
    'I\'ve seen faster seaweed.',
    'Was that supposed to be a hook?',
    'Better luck after your catnap.',
    'You fish like a dog.',
    'Thanks for the free snack!',
    'Hook rejected.',
    'Not today, kitty.',
    'Keep dreaming, tuna breath.',
    'I slipped the hook on purr-pose.',
    'You\'ll have to earn this trophy.',
    'Back to the litter box, rookie.',
    'That bait needed more seasoning.',
    'I felt that. Barely.',
    'My grandma swims faster than that.',
    'Tell Halley I said… too slow!',
    'That was your best cast?',
    'No paws allowed underwater.',
    'You brought a hook to a fin fight.',
    'The legend escapes again!',
    'I\'m not dinner tonight!',
    'You were this close. Actually, no.',
    'Maybe try knitting instead.',
    'Nine lives, zero fish.',
    'Your reflexes need a tune-up.',
    'Enjoy the empty hook!',
    'You nearly caught my shadow.',
    'I\'m a fish, not a volunteer.',
    'That worm works for me now.',
    'Come back when you have thumbs.',
    'Too much cat. Not enough fisherman.',
    'The lake belongs to us!',
    'You can\'t catch what you can\'t see.',
    'That hook tickled.',
    'I\'ve escaped better cats than you.',
    'Keep practicing, Captain Whiskers.',
    'Is your reel on vacation?',
    'Fish: 1. Cat: 0.',
    'That one\'s going in my memoir.',
    'Another heroic escape!',
    'I knew that bait looked suspicious.',
    'Do you accept fishing lessons?',
    'Close only counts with catnip.',
    'I\'m telling the whole school.',
    'Thanks for playing!'
];

export const HALLEY_THINKING = [
    'I meant to let that one go.',
    'That fish cheated.',
    'Nobody saw that… right?',
    'I blame the bobber.',
    'Clearly, the sun was in my eyes.',
    'I was testing the release system.',
    'That one looked suspicious anyway.',
    'The next fish is definitely mine.',
    'Maybe I need more snacks.',
    'Was the lake always this slippery?',
    'I should have stayed in my sunbeam.',
    'All part of the master plan.',
    'I loosened the reel on purpose.',
    'That fish owes me bait.',
    'I\'m still counting that as a catch.',
    'The hook must be defective.',
    'I need a bigger fishing hat.',
    'This never happens in practice.',
    'Perhaps one quick catnap…',
    'I almost had its autograph.',
    'That fish was clearly overqualified.',
    'Note to self: reel faster.',
    'Maybe staring harder will help.',
    'I knew I should\'ve brought tuna.',
    'My paws are not built for this.',
    'Good escape. I respect it.',
    'That was only the warm-up.',
    'The fish are getting smarter.',
    'I think it winked at me.',
    'Do fish understand revenge?',
    'No fish. No witnesses.',
    'Next time, less dramatic reeling.',
    'I\'m going to pretend that was seaweed.',
    'Patience, Halley. Delicious patience.',
    'The lake and I need to talk.',
    'I may have underestimated that guppy.',
    'One day, fish. One day.',
    'I still looked cool doing it.',
    'Let us never speak of this again.',
    'I need to sharpen my whiskers.'
];

/** @type {{ fish: string, halley: string }[]} */
export const FISH_HALLEY_EXCHANGES = [
    { fish: 'Too slow!', halley: 'Too lucky.' },
    { fish: 'Thanks for the worm!', halley: 'Put that on your tab.' },
    { fish: 'Catch you later!', halley: 'That is supposed to be my line.' },
    { fish: 'Nine lives won\'t help you!', halley: 'I\'ve only used three.' },
    { fish: 'You missed!', halley: 'I was aiming beside you.' },
    { fish: 'Back to shore, kitty!', halley: 'Back to the hook, fish.' },
    { fish: 'I\'m too smart for you!', halley: 'You ate a worm on a hook.' },
    { fish: 'Tell everyone I escaped!', halley: 'I\'ll tell them you were tiny.' },
    { fish: 'Your bait is terrible!', halley: 'You still ate it.' },
    { fish: 'Better luck next cast!', halley: 'Better swim faster.' }
];

export const BIG_FISH_ESCAPES = [
    'You need a bigger everything.',
    'That reel was never ready for me.',
    'The trophy lives another day.',
    'You almost became famous.',
    'I don\'t fit in your little bucket.',
    'Come back with stronger string.',
    'I\'ve broken boats tougher than you.',
    'The lake keeps its champion.',
    'That was merely a warning tug.',
    'You hooked a legend and lost.',
    'Some fish are meant to remain stories.',
    'Your wall will stay empty tonight.',
    'I felt your paws shaking.',
    'Tell them how big I was.',
    'The monster returns to the deep.'
];

export const TINY_FISH_ESCAPES = [
    'You missed all three inches of me!',
    'Small fish, huge victory!',
    'Too tiny to catch!',
    'I may be little, but I\'m slippery.',
    'Imagine losing to me.',
    'I weigh less than your bait.',
    'I\'m telling my mom.',
    'Tiny but undefeated.',
    'You nearly caught a snack.',
    'That\'s Captain Minnow to you.'
];

export const RARE_LEGENDARY_ESCAPES = [
    'Legends are not caught so easily.',
    'The stars did not choose you today.',
    'Another chapter for my legend.',
    'You were close to greatness.',
    'The deep has reclaimed me.',
    'Your destiny needs stronger line.',
    'Not every treasure can be taken.',
    'We will meet again, Halley.',
    'The lake is still testing you.',
    'Today, the legend remains free.'
];

const RARE_RARITIES = new Set(['Rare', 'Epic', 'Legendary', 'Trophy']);

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * @param {{ species?: string, rarity?: string, weight?: number }} [fish]
 * @returns {'rare' | 'big' | 'tiny' | null}
 */
export function classifyEscapedFish(fish) {
    if (!fish) {
        return null;
    }
    if (fish.rarity && RARE_RARITIES.has(fish.rarity)) {
        return 'rare';
    }
    const weight = typeof fish.weight === 'number' ? fish.weight : 0;
    if (weight >= 15) {
        return 'big';
    }
    if (weight > 0 && weight < 1.5) {
        return 'tiny';
    }
    return null;
}

function formatExchange(exchange) {
    return `🐟 "${exchange.fish}"\n😺 "${exchange.halley}"`;
}

/**
 * @param {{ reason?: string, fish?: { species?: string, rarity?: string, weight?: number } }} [options]
 * @returns {string}
 */
export function pickMissMessage(options = {}) {
    const { reason, fish } = options;
    const reasonLower = (reason || '').toLowerCase();

    if (reasonLower.includes('nothing stirs')) {
        return pickRandom([
            'The lake and I need to talk.',
            'No fish. No witnesses.',
            'I\'m going to pretend that was seaweed.',
            'Patience, Halley. Delicious patience.'
        ]);
    }

    if (reasonLower.includes('error')) {
        return pickRandom(HALLEY_THINKING);
    }

    const sizeClass = classifyEscapedFish(fish);
    const tooEager = reasonLower.includes('too eager');

    if (sizeClass === 'rare' && Math.random() < 0.38) {
        return pickRandom(RARE_LEGENDARY_ESCAPES);
    }
    if (sizeClass === 'big' && Math.random() < 0.38) {
        return pickRandom(BIG_FISH_ESCAPES);
    }
    if (sizeClass === 'tiny' && Math.random() < 0.38) {
        return pickRandom(TINY_FISH_ESCAPES);
    }

    if (Math.random() < 0.16) {
        return formatExchange(pickRandom(FISH_HALLEY_EXCHANGES));
    }

    if (tooEager && Math.random() < 0.45) {
        return pickRandom(HALLEY_THINKING);
    }

    if (Math.random() < 0.58) {
        return pickRandom(FISH_TRASH_TALK);
    }

    return pickRandom(HALLEY_THINKING);
}
