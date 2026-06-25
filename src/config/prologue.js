/**
 * Story prologue — first-time entrance sequence (see DOCS/halleys-big-catch-story.md).
 * Scroll speed is fixed at PROLOGUE_SCROLL_SPEED for voiceover sync.
 */

export const PROLOGUE_SEEN_STORAGE_KEY = 'kittyCreekPrologueSeen';
export const PROLOGUE_VERSION_STORAGE_KEY = 'kittyCreekPrologueVersion';

/**
 * Bump this when shipping an update that should replay the entrance prologue.
 * Tied to deploys — change alongside package.json version when you release.
 */
export const PROLOGUE_GAME_VERSION = '20250624-1';

/** Base upward scroll speed in pixels per second at multiplier 1.0. */
export const PROLOGUE_BASE_SCROLL_PX_PER_SEC = 42;

/** Fixed scroll multiplier — synced to intro voiceover (not user-adjustable). */
export const PROLOGUE_SCROLL_SPEED = 0.7;

/** @deprecated Use PROLOGUE_SCROLL_SPEED */
export const PROLOGUE_SCROLL_SPEED_DEFAULT = PROLOGUE_SCROLL_SPEED;

/** Intro narration — plays after credits begin scrolling. */
export const PROLOGUE_VOICEOVER_URL = '/assets/audio/halleys-big-catch-intro.wav';

/** Ocean + seagulls loop under the voiceover. */
export const PROLOGUE_AMBIENCE_URL = '/assets/audio/prologue-ocean-seagulls.mp3';

/** Universfield dark mysterious atmosphere — background music bed. */
export const PROLOGUE_MUSIC_URL = '/assets/audio/prologue-music.mp3';

/** Peak ocean SFX volume (0–1) — below voiceover. */
export const PROLOGUE_AMBIENCE_VOLUME = 0.3;

/** Ocean level while voiceover plays (ratio of peak). */
export const PROLOGUE_AMBIENCE_DUCK_RATIO = 0.36;

/** Peak music volume (0–1) — below voiceover and ocean SFX. */
export const PROLOGUE_MUSIC_VOLUME = 0.28;

/** Music level while voiceover plays (ratio of peak). */
export const PROLOGUE_MUSIC_DUCK_RATIO = 0.32;

/** Seconds after voiceover ends before ocean ambience begins fading. */
export const PROLOGUE_AMBIENCE_FADE_DELAY_AFTER_VO_SEC = 1;

/** Duration of the ocean fade-out (seconds). */
export const PROLOGUE_AMBIENCE_FADE_DURATION_SEC = 3;

/** Voiceover playback volume (0–1). */
export const PROLOGUE_VOICEOVER_VOLUME = 1;

/** Seconds of scroll before voiceover starts (scroll begins immediately). */
export const PROLOGUE_VOICEOVER_DELAY_SEC = 2;

/** Seconds on splash screen before tap-to-enter is enabled. */
export const PROLOGUE_ENTER_BUTTON_DELAY_SEC = 3.5;

/** Fade duration between prologue phases (ms). */
export const PROLOGUE_PHASE_FADE_MS = 1200;

/** How long the “A long time ago…” card holds before the entry graphic (ms). */
export const PROLOGUE_INTERSTITIAL_HOLD_MS = 2800;

export const PROLOGUE_INTERSTITIAL_TEXT = 'A long time ago, on a lake not so far away…';

export const PROLOGUE_ENTRANCE_IMAGE = 'images/halley-splash.png';

/** Full-screen art behind scrolling story credits. */
export const PROLOGUE_SCROLL_BACKGROUND = 'images/prologue-background.png';

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
