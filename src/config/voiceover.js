/**
 * Halley voice lines — random pick per category.
 * Add `audio` paths when VO files are ready; text shows in a bubble until then.
 */

export const VOICEOVER_LINES = {
    tap: [
        { text: 'Hey!' },
        { text: 'Hey!' },
        { text: 'What?' },
        { text: "I'm fishing here!" },
        { text: 'Paws off!' },
        { text: 'Do you mind?' }
    ],
    cast: [],
    reel: [],
    bigCatch: [],
    miss: []
};

/** Minimum ms between tap barks (avoid spam). */
export const VOICEOVER_TAP_COOLDOWN_MS = 1400;
