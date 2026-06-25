/**
 * First-time gameplay onboarding — dock tour after the story prologue.
 */

export const GAMEPLAY_ONBOARDING_VERSION = 1;

/** @typedef {{ id: string, icon?: string, title: string, body: string, target?: string, center?: boolean, placement?: 'above'|'below'|'center' }} OnboardingStep */

/** @type {OnboardingStep[]} */
export const GAMEPLAY_ONBOARDING_STEPS = [
    {
        id: 'welcome',
        icon: '🎣',
        title: "Welcome to Halley's Big Catch!",
        body: 'A quick tour of the dock — how to fish and what each tab does. Skip anytime; replay from Inventory → Settings.',
        center: true
    },
    {
        id: 'hud',
        target: '#player-info',
        title: 'Your captain stats',
        body: 'Name, level, cash, and XP live up here. Level up to unlock new fishing spots and tackle in the shop.',
        placement: 'below'
    },
    {
        id: 'fishing',
        target: '#ui-controls',
        title: 'How to fish',
        body: 'Pick a location, tap CAST, and wait. When you get a bite the button becomes SET HOOK! — tap it quickly. Better gear and stats help you land more fish.',
        placement: 'above'
    },
    {
        id: 'game-tab',
        target: '.tab-button[data-tab="game"]',
        title: 'Game tab',
        body: 'Your home dock. Cast here anytime and watch Halley fish in 3D.',
        placement: 'above'
    },
    {
        id: 'shop',
        target: '.tab-button[data-tab="shop"]',
        title: 'Shop',
        body: 'Buy rods, reels, line, hooks, and bait. Upgrades boost catch odds, strength, and how long you have to set the hook.',
        placement: 'above'
    },
    {
        id: 'inventory',
        target: '.tab-button[data-tab="inventory"]',
        title: 'Inventory',
        body: 'Fish Collection, hidden sea Relics, Achievements, and Settings (account, story replay, and this tour).',
        placement: 'above'
    },
    {
        id: 'friends',
        target: '.tab-button[data-tab="friends"]',
        title: 'Friends',
        body: 'Share your friend code, send requests, and see what your crew is catching.',
        placement: 'above'
    },
    {
        id: 'leaderboard',
        target: '.tab-button[data-tab="leaderboard"]',
        title: 'Leaderboard',
        body: 'Local top catches, reaction-time Speed Board, and global rankings.',
        placement: 'above'
    },
    {
        id: 'done',
        icon: '🌟',
        title: "You're ready to cast!",
        body: 'Try Crescent Pond and land your first fish. Good luck, Captain!',
        center: true
    }
];
