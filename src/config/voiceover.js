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
    miss: [],
    anaconda: [
        { text: '…That is NOT a fish.' },
        { text: 'Note to self: stay on the dock.' },
        { text: 'My worm suddenly feels very, very small.' },
        { text: 'Was that a snake or did the river grow eyebrows?' },
        { text: 'I only catch fish. That catches nightmares.' },
        { text: 'Purr-fectly fine. Totally fine. Not moving.' },
        { text: 'Tell me that was a floating log. Lie to me.' },
        { text: 'The jungle special just swam by…' },
        { text: 'My tail says we should have brought a bigger boat.' },
        { text: 'I came for catfish. Not… whatever THAT is.' },
        { text: 'He does not look so big—OH, THERE\'S THE REST OF HIM.' },
        { text: 'There is not enough dock between me and that thing.' },
        { text: 'I am going to stand very still and look unappetizing.' },
        { text: 'This seems like a good time to become an indoor cat.' }
    ]
};

/** Minimum ms between tap barks (avoid spam). */
export const VOICEOVER_TAP_COOLDOWN_MS = 1400;

/** Minimum ms between anaconda sighting barks. */
export const VOICEOVER_ANACONDA_COOLDOWN_MS = 8000;
