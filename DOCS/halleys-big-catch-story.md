## Halley’s Big Catch Story Bible

**Framing rule:** The player-facing story begins when Halley is born. Ancient world history (1607 impact, pirates, explorers) is canon he **discovers during the game** — never opening dump text.

**Central truth:** The comet gave Halley a mystery; his father gave that mystery meaning. The Starfish reunion is the midpoint — not the end. The Starfish then guides Halley through four final shores: **Cortez Backwaters** (patience), **Louisiana Bayou** (courage), **Congo River** (determination), and **Starfall Lagoon** (truth / homecoming).

**Runtime implementation:** `src/config/storyChapters.js`, `src/config/relicProgression.js`, `src/storyProgress.js`, `src/ui.js`

**Narration placeholders:** `DOCS/story-narration-placeholders.md` — lists every beat, config key, and what final copy should cover.

**Story flow (2026):** Prologue (Halley’s birth) → Chapters 1–7 (sequential relics) → Celestial Depths (Ch.8 on arrival) → Starfish reunion (Ch.9) → Cortez (Ch.10) → Tarpon / path forward (Ch.11) → Louisiana Bayou (Ch.12) → Congo (Ch.13) → Starfall Lagoon (Ch.14) → Epilogue. Journal destinations unlock on first catch; arrival chapters play when you travel there.

**Relic progression:** Sequential — one relic at a time, minimum ~15 successful catches before discovery (never on first cast), rising odds, guaranteed by catch ~32 depending on tier. Medallion clues at catches 8 / 13 / 20 / 26. Misses do not count.

**Early location unlocks:** Story order matches the location list — Crescent Pond → Sandy Shoals (Lv 2) → Coral Kingdoms (Lv 3) → … → Celestial Depths → post-Starfish destinations. Chapter travel buttons only appear when the destination is on the map.

### Title Card

```
✨ Halley’s Big Catch ✨
```

---

## Player Story — Begins at Halley’s Birth

### Prologue — Born Under the Comet (1986)

On the night a small orange kitten was born, Halley’s Comet crossed the sky.

His father looked toward the brilliant comet and smiled.

“I think I’ll call you Halley.”

That same night, another small fragment broke away from the comet and landed in his father’s yard. The following morning, Halley’s father discovered the unusual blue stone. He carefully shaped it and placed it inside a medallion.

Years later, sitting with young Halley on a dock after a day of fishing, his father held out the medallion and gave it to him.

It became Halley’s most treasured possession.

> **Gameplay tie-in:** Halley’s chest medallion is a comet fragment in a faint always-on blue glow (see `MEDALLION_GEM_OFFSET` / comet gem in `src/cat.js`).

### His Father’s Stories

Halley grew up fishing beside his father.

During the quiet spaces between casts, his father told him stories about places he had visited and fish no one else had ever seen — a fish whose fins flowed like pirate banners; a pufferfish like living glass; a wrasse marked with every phase of the moon; a grouper whose fins moved like butterfly wings; an octopus that collected shining objects from shipwrecks.

Halley loved those stories.

As he grew older, he assumed his father had invented them to make their fishing trips more exciting.

### The Call to Adventure

One quiet morning, Halley was fishing alone at Crescent Pond when the medallion suddenly began to glow.

A warmth spread through him. He felt something calling from far away.

There were no words and no clear instructions. He simply knew that he needed to begin searching.

That moment started Halley’s journey across the world.

### The Ten Relics

As Halley explored new fishing locations, the medallion led him toward ten mysterious relics:

| # | Location | Hidden Item | Message | Meaning |
| --- | --- | --- | --- | --- |
| 1 | Crescent Pond | Weathered Fishing Bobber | “The smallest ripples remember where they began.” | Childhood and the spark of fishing. |
| 2 | Sandy Shoals | Driftwood Compass | “The sea never forgets its course — only those who stop listening.” | Unseen forces guide him. |
| 3 | Coral Kingdoms | Sunken Treasure Chest | “Not all that glitters is gold. Some treasures remember your name.” | The true treasure is alive. |
| 4 | Amazon Depths | Message in a Bottle | “The stars once fell, and the sea still whispers their names.” | Comet and Starfish. |
| 5 | Craggy Coast | Broken Harpoon | “The hunter becomes the seeker when he lowers his spear.” | From trophies to meaning. |
| 6 | Frozen Fjords | Frozen Pocket Watch | “Even time can sleep beneath the ice… but not forever.” | What waits beneath still wakes. |
| 7 | Desert Lagoon | Half-Buried Telescope | “Look to the stars — the same light that guides the waves guides you.” | The comet still leads. |
| 8 | Stormbreaker Bay | Torn Map Fragment | “The path forward isn’t drawn in ink — it’s carried in the current.” | The ocean is the map. |
| 9 | Forgotten Reefs | Coral Pendant | “Two lights were born as one — one of the sky, one of the sea.” | Halley and the Starfish. |
| 10 | Twilight Trench | Luminescent Shell | “The ocean remembers every spark. Follow its glow — it remembers you.” | The Starfish awaits. |

Each relic carried a tiny shard of comet crystal. Whenever Halley recovered another, the fragment inside his medallion glowed more strongly.

### The Starlight Lure

After gathering all ten relics, Halley discovered the tiny comet crystals hidden within them. Guided by an understanding he could not explain, he forged:

**The Starlight Lure.**

It shimmered with the same celestial light as the medallion — and led him to the **Celestial Depths**.

### Celestial Depths — Midpoint Reunion

At Celestial Depths, Halley cast the Starlight Lure. The Starfish of Eternity rose toward it — not for food, but because it recognized the comet’s energy.

The Starfish did not speak. Yet Halley understood: it wanted him to follow.

The reunion is the midpoint. The final journey still lies ahead.

> **Final Moment (Voiceover):** “I’ve spent my life chasing wonders… and all along, one of them was chasing me.”

---

## The Final Journey — Four Destinations

The Starfish does not lead Halley straight to the hidden lagoon. First it guides him through three places that reveal his father’s life and test the lessons Halley learned from him.

### Cortez Backwaters — Patience (Complete)

Where his father spent younger years learning to fish. Calm but demanding tides; success depends on careful observation.

**Truth:** His father’s skill was earned one quiet cast at a time.

### Louisiana Bayou — Courage (Complete)

Dangerous and unpredictable — alligators, fog, unfamiliar sounds. Halley could turn back; instead he trusts the Starfish and goes deeper.

**Truth:** His father’s adventures were possible because he respected danger without letting fear control him.

### Congo River — Determination (Coming)

Vast, powerful, untamed. At times the Starfish disappears from sight; Halley must continue without always seeing his guide.

Deep within the Congo, Halley discovers a weathered explorer’s journal dated **1703**, with sketches of creatures from his father’s stories and a final entry swearing a hidden lagoon is real.

**Truth:** The impossible fish had existed for centuries. The journey is no longer about whether the stories were true — it is about finding where they live.

### Starfall Lagoon — Truth / Homecoming (Coming)

After the Congo, the Starfish guides Halley through a narrow passage between towering cliffs into a lagoon forgotten by the world.

Turquoise water with a soft celestial glow. An ancient pirate shipwreck. Broken docks and the remains of a hideout. Beneath it all, the great comet fragment from 1607 still rests.

Every creature his father described is real: Pirate Bannerfish, Butterfly Grouper, Glass Puffer, Moonstripe Wrasse, Treasurekeeper Octopus — and tiny glowing starfish schools filling the water with moving light.

Halley understands: years before he was born, his father found this place and chose to protect its secret — sharing memories as stories beside the dock instead of a map.

The Starfish returns to the reef where it survived the impact centuries earlier. Halley releases it. The medallion pulses one final time.

> “You knew I’d find it someday, didn’t you, Dad?”

### Final Narration (Epilogue Intent)

When I was little, I thought Dad was telling me impossible stories.

Now I know he was sharing his memories.

The greatest treasure was never hidden in a pirate chest.

It was in every lesson, every story and every quiet day we spent together.

One cast at a time, Dad had been preparing me for the greatest adventure of my life.

And now, his stories are mine to carry forward.

---

## What the Three Lessons Mean

| Location | Lesson | Why the Starfish led him there |
| --- | --- | --- |
| Cortez Backwaters | Patience | Father’s skill was earned, not given |
| Louisiana Bayou | Courage | Respect danger; do not let fear decide |
| Congo River | Determination | Keep going even when the guide is unseen |
| Starfall Lagoon | Truth | The stories were memories — and home |

The Starfish can show Halley the direction. Only Halley can complete the journey.

---

## World History (Discovered in Play)

*Do not put this in the prologue. Halley learns it through Congo’s journal, Starfall Lagoon, and understanding his father’s stories.*

### 1607 — The Night the Sea Changed

Halley’s Comet crossed the sky. A massive fragment crashed into a secluded tropical lagoon. The shockwave killed nearly every living creature except one small sea star that absorbed the comet’s energy and became the **Starfish of Eternity**. The larger fragment remained buried; over centuries, extraordinary life returned to the lagoon.

### Pirates and the Hidden Lagoon

Decades later, pirates found the lagoon, guarded its location, and built a hideout. Time reclaimed it. Only legends remained — dismissed by the world.

### 1703 — The Explorer’s Journal

Found by Halley in the Congo: sketches of the lagoon’s creatures and a sworn account of a place beyond the charts.

### Father’s Prior Visit

Years before Halley was born, his father found Starfall Lagoon and kept its secret — passing wonder to his son as “impossible” fishing stories.

---

## Prologue Scroll (In-Game Entry)

**Locked:** The opening prologue stays the original birth/medallion mystery. Do not add 1607, pirates, or Starfall Lagoon here — players discover the past as they play.

Canonical scroll text (`PROLOGUE_STORY_PARAGRAPHS` in `src/config/prologue.js`):

> On the night a small kitten was born, Halley’s Comet crossed the sky.  
> As it passed overhead, glowing fragments broke away and scattered across the world. One of them landed in his family’s yard.  
> His father named him Halley after the comet and later placed the fragment inside a medallion he made for his son.  
> For years, the stone gave off only a faint blue glow, and Halley thought of it as little more than a treasured gift from his father.  
> Then one quiet morning at Crescent Pond, the medallion began to pulse.  
> The water grew still. A strange warmth spread across Halley’s chest, and he felt something distant stirring far beneath the surface.  
> Something mysterious was calling to him from the deep.  
> And for the first time, the medallion seemed to know the way.

**Epilogue (end of game):** Keep the original “One More Cast” pond closer after Chapter 14. Starfall’s truth lands in Ch.14; the epilogue returns home without restating the lore dump.

---

## Celestial Depths — Implementation Notes

- Starlight water & particles; Starlight Lure halo; exclusive Starfish catch; first-catch celebration; narrative rewards (no coins/XP); repeat visits keep the Starfish as a guide, not a trophy.

### Core Themes

- Wonder over conquest — fishing as curiosity and connection.
- Destiny intertwined with cosmic events — Halley and the Starfish share the comet’s light.
- Memory and belonging — father taught the path; the Starfish showed the direction.
- Discovery over exposition — ancient lore is earned in play.

### Future Expansion Hooks

- Starfall Lagoon scenery, signature species, and Starfish return-home beat.
- Congo explorer-camp discovery sequence.
- Additional logbook entries for each final-shore lesson.
