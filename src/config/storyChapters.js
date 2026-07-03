/**
 * Story chapters — father/comet narrative gates tied to relic progress.
 */

/** @typedef {{
 *   id: string,
 *   title: string,
 *   requiredRelics: string[],
 *   narration: string[],
 *   halleyLine?: string,
 *   fatherLine?: string,
 *   unlocksLocationMessage?: string
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
        unlocksLocationMessage: 'Sandy Shoals stirs on the horizon.'
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
        unlocksLocationMessage: 'Amazon Depths awaits on the map.'
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
        unlocksLocationMessage: 'Frozen Fjords opens to the north.'
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
        unlocksLocationMessage: 'Desert Lagoon shimmers beyond the dunes.'
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
        unlocksLocationMessage: 'Stormbreaker Bay roars into view.'
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
        unlocksLocationMessage: 'Twilight Trench waits in the deep.'
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
        unlocksLocationMessage: 'The Celestial Depths are opening.'
    }
];

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
            'He was honoring the fisherman his father had raised him to become.'
        ],
        halleyLine: 'The comet may have started this journey. But you\'re the reason I was ready for it.',
        fatherLine: null
    },
    chapter_10_cortez: {
        id: 'chapter_10_cortez',
        title: 'Cortez Backwaters',
        narration: [
            'The first current brought Halley back to Cortez Backwaters.',
            'These were the waters where his father had taught him how to read a tide, repair a reel, and release a fish that deserved to swim another day.',
            'Halley had crossed the world searching for the meaning of the medallion.',
            'But the answer was waiting beside the same old dock.'
        ],
        fatherLine: 'The stone was never the miracle, Halley. You were.',
        halleyLine: 'I thought you gave me a piece of the comet. What you really gave me was a lifetime.'
    },
    chapter_11_journal: {
        id: 'chapter_11_journal',
        title: 'The Unfinished Journal',
        narration: [
            'Inside his father\'s old fishing journal were three unfinished adventures.',
            'A bayou of cypress trees and hidden channels.',
            'A mighty river in the heart of Africa.',
            'And a ridiculous cove his father had invented to make a young kitten laugh.',
            'The three remaining golden currents pointed toward the same places.',
            'The Starfish had listened to the memories within the medallion.',
            'Now it was opening the waters Halley and his father had once dreamed of exploring together.'
        ],
        fatherLine: 'Looks like our old fishing stories still have a few chapters left.'
    },
    chapter_12_bayou: {
        id: 'chapter_12_bayou',
        title: 'Louisiana Bayou',
        narration: [
            'Halley and his father had talked about fishing here for years.',
            'They had always said they would come someday.',
            'As Halley opened the journal beneath the hanging moss, he smiled.',
            'Someday had finally arrived.'
        ],
        halleyLine: 'This one\'s for both of us, Dad.'
    },
    chapter_13_congo: {
        id: 'chapter_13_congo',
        title: 'Congo River',
        narration: [
            'No destination filled more pages of his father\'s journal.',
            'Halley had once believed that adventures belonged only to the person who took them.',
            'Now he understood that a dream could be shared.',
            'His father had imagined this river. Halley would carry that dream the rest of the way.'
        ],
        halleyLine: 'I wish you could see it through my eyes. Maybe, in a way, you can.'
    },
    chapter_14_crazycatch: {
        id: 'chapter_14_crazycatch',
        title: 'CrazyCatch Cove',
        narration: [
            'The final page of the journal did not contain a real map.',
            'It showed a place Halley\'s father had invented when Halley was a kitten.',
            'Some places are discovered by explorers. Others are created by the stories we love enough to remember.'
        ],
        halleyLine: 'You made this place for me a long time ago, Dad. The Starfish just helped me find it.'
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
