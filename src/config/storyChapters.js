/**
 * Story chapters — father/comet narrative gates tied to relic progress.
 */

import { CELESTIAL_DEPTHS_LOCATION_INDEX } from './hiddenRelics.js';
import { CORTEZ_BACKWATERS_LOCATION_INDEX } from './cortezBackwaters.js';
import {
    LOUISIANA_BAYOU_LOCATION_INDEX,
    CONGO_RIVER_LOCATION_INDEX,
    CRAZYCATCH_COVE_LOCATION_INDEX
} from './storyLocations.js';

/** @typedef {{
 *   id: string,
 *   title: string,
 *   requiredRelics?: string[],
 *   narration: string[],
 *   halleyLine?: string,
 *   fatherLine?: string,
 *   unlocksLocationMessage?: string,
 *   unlocksLocationIndex?: number
 * }} StoryChapter */

/** @type {StoryChapter[]} */
export const STORY_CHAPTERS = [
    {
        id: 'chapter_1',
        title: "His Father's Bobber",
        requiredRelics: ['weathered_bobber'],
        narration: [
            'The first relic was waiting at the place where Halley had learned to fish.',
            'It was his father\'s old bobber, faded by sunlight and worn by years upon the water.',
            'When Halley touched it, the medallion began to glow.',
            '"The smallest ripples remember where they began."',
            'Halley had heard words like those before — beside this very pond.',
            'Whatever was calling from beneath the water knew where Halley\'s story began.'
        ],
        halleyLine: 'Dad always said the water remembers more than we do.',
        unlocksLocationMessage: 'Sandy Shoals stirs on the horizon.',
        unlocksLocationIndex: 1
    },
    {
        id: 'chapter_2',
        title: 'Lessons Carried by the Water',
        requiredRelics: ['driftwood_compass', 'sunken_treasure'],
        narration: [
            'Three relics had now answered Halley\'s medallion.',
            'Listen to the water. Do not mistake a prize for a treasure. Remember where you began.',
            'They were lessons Halley had learned long before this journey — lessons taught by his father.',
            'Halley began to wonder whether the relics were leading him somewhere, or reminding him of something he had forgotten.'
        ],
        halleyLine: 'It\'s like I can hear Dad in every message.',
        unlocksLocationMessage: 'Amazon Depths awaits on the map.',
        unlocksLocationIndex: 3
    },
    {
        id: 'chapter_3',
        title: 'The Seeker and the Hunter',
        requiredRelics: ['message_in_bottle', 'broken_harpoon'],
        narration: [
            '"The seeker finds what the hunter cannot."',
            'Halley remembered the greatest fish his father had ever caught — and watching him release it.',
            'His father had taught him that not every remarkable thing was meant to become a trophy.',
            'For the first time, Halley stopped wondering what awaited him beneath the water.',
            'He began wondering why it wanted to be found.'
        ],
        halleyLine: 'Maybe this was never supposed to be a hunt.',
        unlocksLocationMessage: 'Frozen Fjords opens to the north.',
        unlocksLocationIndex: 5
    },
    {
        id: 'chapter_4',
        title: 'Time Spent Together',
        requiredRelics: ['frozen_pocket_watch'],
        narration: [
            'The pocket watch had been frozen for years, its hands trapped upon a single moment.',
            'Halley thought about all the hours he had spent fishing beside his father.',
            'At the time, they had seemed like ordinary days. Only now could Halley see how precious they had been.',
            'Perhaps the best moments simply sank deeper, waiting for something to bring them back to the surface.'
        ],
        halleyLine: 'We thought we were passing the time. I think we were building something.',
        unlocksLocationMessage: 'Desert Lagoon shimmers beyond the dunes.',
        unlocksLocationIndex: 6
    },
    {
        id: 'chapter_5',
        title: 'Another Fragment Below',
        requiredRelics: ['buried_telescope'],
        narration: [
            'Another fragment of Halley\'s Comet had fallen into the sea.',
            'The stone inside Halley\'s medallion was answering its light.',
            'But the medallion had been silent for most of Halley\'s life. Why had it awakened only now?',
            'Perhaps the stone had needed time to learn who Halley was — and who his father had helped him become.'
        ],
        halleyLine: 'This medallion has been with me through everything. Maybe it remembers Dad too.',
        unlocksLocationMessage: 'Stormbreaker Bay roars into view.',
        unlocksLocationIndex: 7
    },
    {
        id: 'chapter_6',
        title: 'The Light Knows Him',
        requiredRelics: ['map_fragment', 'coral_pendant'],
        narration: [
            'When the ninth relic answered, Halley heard a voice he knew better than his own.',
            'It was his father, guiding him through a fishing lesson from long ago.',
            'The fragment carried the comet\'s light. It also carried the memories formed around it.',
            'Something beneath the sea was using those memories to guide Halley forward.',
            'It was speaking through the person Halley trusted most.'
        ],
        halleyLine: 'It isn\'t copying Dad\'s words. It\'s finding them inside me.',
        unlocksLocationMessage: 'Twilight Trench waits in the deep.',
        unlocksLocationIndex: 9
    },
    {
        id: 'chapter_7',
        title: 'The Starlight Lure',
        requiredRelics: ['luminescent_shell'],
        narration: [
            'Ten relics. Ten echoes. Together, they formed the image of a starfish.',
            'The fragment inside Halley\'s medallion released a strand of blue light, creating a lure unlike any Halley had ever seen.',
            'Halley tied it to his line with the first fishing knot his father had taught him.',
            'The road ahead had been revealed by the comet.',
            'But every skill Halley needed to follow it had come from somewhere much closer to home.'
        ],
        halleyLine: 'You gave me the medallion, Dad. But that wasn\'t the only thing you gave me.',
        unlocksLocationMessage: 'The Celestial Depths are opening.',
        unlocksLocationIndex: CELESTIAL_DEPTHS_LOCATION_INDEX
    }
];

/** Short beats when a journal destination is "finished" (first catch). Replace copy in DOCS/story-narration-placeholders.md */
export const JOURNEY_COMPLETE_BEATS = {
    louisiana_bayou: {
        halleyLine: 'We made it to the bayou, Dad. Just like we always said we would.',
        banner: 'Louisiana Bayou — promise kept.'
    },
    congo_river: {
        halleyLine: 'Your journal never did this river justice. It\'s even bigger than I imagined.',
        banner: 'Congo River — dream carried home.'
    },
    crazycatch_cove: {
        halleyLine: 'Your stories were memories, Dad. I found where they live.',
        banner: 'Starfall Lagoon — the stories were true.'
    }
};

/** First cast at Celestial Depths (after Chapter 8). Replace in DOCS/story-narration-placeholders.md */
export const CELESTIAL_FIRST_CAST_NARRATION = {
    lines: [
        'Halley tied on the Starlight Lure — the only bait the depths would answer.',
        'The sea below mirrored the sky. For a moment, every star seemed within reach.'
    ],
    halleyLine: 'Show me what you remember.',
    voiceover: 'I\'ve spent my life chasing wonders… and all along, one of them was chasing me.'
};

/** Post-Starfish chapters (location-based, not relic-gated). */
export const POST_STARFISH_CHAPTERS = {
    chapter_8_celestial: {
        id: 'chapter_8_celestial',
        title: 'The Celestial Depths',
        narration: [
            'The sea opened beneath Halley like a doorway into the night.',
            'For a moment, Halley felt as small as he had during his first storm upon the water.',
            'Then he remembered his father\'s paw upon his shoulder.',
            'The water was still deep. But Halley was not facing it alone.'
        ],
        halleyLine: 'You\'ve been with me the whole way, Dad.'
    },
    chapter_9_starfish: {
        id: 'chapter_9_starfish',
        title: 'The Starfish of Eternity',
        narration: [
            'The Starfish showed Halley the night his father made the medallion.',
            'The stone had fallen from the sky, but his father had turned it into a gift.',
            'The fragment carried the light of the comet — and every lesson, laugh, and quiet moment shared beside the water.',
            'The medallion had shown Halley where to go. His father had taught him how to get there.',
            'When Halley released the Starfish, he was not surrendering the greatest catch of his life.',
            'He was honoring the fisherman his father had raised him to become.',
            'The Starfish did not speak — yet Halley understood exactly what it wanted.',
            'It wanted him to follow.'
        ],
        halleyLine: 'The comet may have started this journey. But you\'re the reason I was ready for it.',
        fatherLine: null
    },
    chapter_10_cortez: {
        id: 'chapter_10_cortez',
        title: 'Cortez Backwaters',
        narration: [
            'The Starfish first led Halley to Cortez Backwaters — the waters where his father had learned to fish.',
            'The tides changed constantly. Fish held close to the mangroves. Success depended on careful observation.',
            'Halley remembered: fishing was never about casting the most times. It was about noticing what the water was trying to tell you.',
            'Here he began to understand that his father had not simply been born a gifted fisherman.',
            'He had earned his skill one quiet cast at a time — and passed that patience on to his son.'
        ],
        fatherLine: 'The stone was never the miracle, Halley. You were.',
        halleyLine: 'Patience. That\'s what you were teaching me all those years on the dock.'
    },
    chapter_11_journal: {
        id: 'chapter_11_journal',
        title: 'The Path Ahead',
        narration: [
            'The Starfish did not lead Halley straight to the end of the journey.',
            'Three more shores still waited — a bayou of courage, a mighty river of determination,',
            'and a hidden lagoon from his father\'s stories, the place Halley had once believed was only imagination.',
            'The Starfish could show him the direction.',
            'Only Halley could complete the journey.'
        ],
        fatherLine: 'Looks like our old fishing stories still have a few chapters left.',
        unlocksLocationMessage: 'Louisiana Bayou opens in the journal.',
        unlocksLocationIndex: LOUISIANA_BAYOU_LOCATION_INDEX
    },
    chapter_12_bayou: {
        id: 'chapter_12_bayou',
        title: 'Louisiana Bayou',
        narration: [
            'Unlike Cortez, the bayou felt dangerous and unpredictable.',
            'Alligators moved beneath the surface. Fog settled over narrow waterways.',
            'Halley could easily have turned back.',
            'Instead he trusted the Starfish and continued deeper — remembering his father\'s belief',
            'that the most remarkable places were often beyond the point where most people became afraid.'
        ],
        halleyLine: 'Courage. You never let fear decide for you, Dad. Neither will I.'
    },
    chapter_13_congo: {
        id: 'chapter_13_congo',
        title: 'Congo River',
        narration: [
            'The Congo was vast, powerful, and untamed.',
            'At times the Starfish disappeared from sight. For the first time, Halley had to continue without always seeing his guide.',
            'Deep within the river country waited proof he did not yet know he needed —',
            'an old explorer\'s journal, and sketches of creatures from his father\'s impossible stories.',
            'Determination would carry him the rest of the way.'
        ],
        halleyLine: 'Even when I can\'t see the path, I\'ll keep going. Just like you taught me.'
    },
    chapter_14_crazycatch: {
        id: 'chapter_14_crazycatch',
        title: 'Starfall Lagoon',
        narration: [
            'Beyond a narrow passage between towering cliffs lay a lagoon forgotten by the world.',
            'Turquoise water glowed with soft celestial light. An ancient wreck rested below. Tiny fish moved like stars through a night sky.',
            'Every creature his father had described was real.',
            'Halley finally understood — years before he was born, his father had found this place and chosen to protect its secret.',
            'What Halley had mistaken for imaginative stories had been his father\'s way of keeping the wonder alive.'
        ],
        halleyLine: 'You knew I\'d find it someday, didn\'t you, Dad?'
    },
    epilogue: {
        id: 'epilogue',
        title: 'One More Cast',
        narration: [
            'Halley had traveled across the world.',
            'But his greatest discovery was waiting where his journey began.',
            'Fishing had never been only about the fish.',
            'It was the hours shared upon the water, the lessons passed from one generation to the next, and the simple comfort of knowing someone was beside you.',
            'The comet gave Halley a path across the world.',
            'His father gave him someone worth returning home to.',
            'And in the end, that was the greatest catch of all.'
        ],
        fatherLine: 'Think anything\'s biting?',
        halleyLine: 'Does it matter?'
    }
};

export function getChapterForRelicCompletion(relicId, completedRelicIds) {
    const allCompleted = new Set(completedRelicIds);
    allCompleted.add(relicId);

    for (const chapter of STORY_CHAPTERS) {
        if (!chapter.requiredRelics.every((id) => allCompleted.has(id))) {
            continue;
        }
        if (chapter.requiredRelics[chapter.requiredRelics.length - 1] === relicId) {
            return chapter;
        }
    }
    return null;
}

export function getChapterById(chapterId) {
    const main = STORY_CHAPTERS.find((chapter) => chapter.id === chapterId);
    if (main) return main;
    return POST_STARFISH_CHAPTERS[chapterId] || Object.values(POST_STARFISH_CHAPTERS).find((c) => c.id === chapterId) || null;
}
