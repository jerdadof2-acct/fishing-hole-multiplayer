/**
 * Story prologue — first-time entrance sequence (see DOCS/halleys-big-catch-story.md).
 * Adjust scroll speed for voiceover sync via playStoryPrologue({ scrollSpeedMultiplier }).
 */

export const PROLOGUE_SEEN_STORAGE_KEY = 'kittyCreekPrologueSeen';
export const PROLOGUE_VERSION_STORAGE_KEY = 'kittyCreekPrologueVersion';
export const PROLOGUE_SPEED_STORAGE_KEY = 'kittyCreekPrologueScrollSpeed';

/**
 * Bump this when shipping an update that should replay the entrance prologue.
 * Tied to deploys — change alongside package.json version when you release.
 */
export const PROLOGUE_GAME_VERSION = '20250621-1';

/** Base upward scroll speed in pixels per second at multiplier 1.0. */
export const PROLOGUE_BASE_SCROLL_PX_PER_SEC = 42;

export const PROLOGUE_SCROLL_SPEED_MIN = 0.35;
export const PROLOGUE_SCROLL_SPEED_MAX = 3.5;
export const PROLOGUE_SCROLL_SPEED_STEP = 0.15;

/** Seconds on title/logo screen before Enter button appears. */
export const PROLOGUE_ENTER_BUTTON_DELAY_SEC = 3.5;

/** Fade duration between credits and title (ms). */
export const PROLOGUE_PHASE_FADE_MS = 1200;

export const PROLOGUE_ENTRANCE_IMAGE = "images/Halley's Big Catch entrance screen.jpg";

export const PROLOGUE_STORY_PARAGRAPHS = [
    'Forty years ago, a comet crossed the sky — a streak of light that touched both sea and shore.',
    'On that night, a kitten named Halley was born… and the ocean hasn\'t been quiet since.',
    'While others chased mice, Halley chased horizons — building his boat, The Shooting Star, and setting out to see what waited beyond the tide.',
    'He\'s sailed through jungle rivers, coral kingdoms, and frozen seas… chasing the biggest, wildest catches the world has ever known.',
    'But there\'s something out there he still can\'t name — something ancient, calling to him from the deep.',
    'Maybe it\'s a legend.',
    'Maybe it\'s destiny.',
    'Either way, Halley\'s not done casting yet.'
];
