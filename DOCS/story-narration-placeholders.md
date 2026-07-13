# Story Narration Placeholders

Runtime wiring lives in `src/config/storyChapters.js`, `src/storyProgress.js`, and `src/ui.js`.

Canon bible: `DOCS/halleys-big-catch-story.md` — player story starts at Halley’s birth; ancient lore is discovered in play.

Replace placeholder copy below when final narrations are ready. Each section lists **where it plays**, **config key**, and **what it should say** (intent).

---

## Already wired — replace copy in `storyChapters.js`

| Chapter | Trigger | Config |
|---------|---------|--------|
| **1–7** | After each relic discovery | `STORY_CHAPTERS[]` |
| **8 — Celestial Depths** | First arrival at Celestial Depths | `POST_STARFISH_CHAPTERS.chapter_8_celestial` |
| **9 — Starfish reunion** | After first Starfish popup closes | `POST_STARFISH_CHAPTERS.chapter_9_starfish` |
| **10 — Cortez (Patience)** | First arrival at Cortez Backwaters | `POST_STARFISH_CHAPTERS.chapter_10_cortez` |
| **11 — Path forward** | First Tarpon catch at Cortez | `POST_STARFISH_CHAPTERS.chapter_11_journal` |
| **12 — Louisiana Bayou (Courage)** | First arrival at Louisiana Bayou | `POST_STARFISH_CHAPTERS.chapter_12_bayou` |
| **13 — Congo River (Determination)** | First arrival at Congo River | `POST_STARFISH_CHAPTERS.chapter_13_congo` |
| **14 — Starfall Lagoon** | First arrival at Starfall Lagoon | `POST_STARFISH_CHAPTERS.chapter_14_crazycatch` *(internal id kept for saves)* |
| **Epilogue** | After Chapter 14 modal closes | `POST_STARFISH_CHAPTERS.epilogue` |

### Intent per chapter (for your rewrites)

- **Chapter 8:** Halley enters the Celestial Depths for the first time with the Starlight Lure. Fear, wonder, father's presence without him physically there.
- **Chapter 9:** Full Starfish reunion — medallion origin, release, comet vs father theme; Starfish wants Halley to follow. *(Starfish popup is a short tease only.)*
- **Chapter 10:** Cortez — patience. Father’s skill was earned one quiet cast at a time.
- **Chapter 11:** Starfish opens the path through three more shores ending at the hidden lagoon from father’s stories (not an invented cove).
- **Chapter 12:** Bayou — courage. Remarkable places lie past where most turn back.
- **Chapter 13:** Congo — determination. Foreshadow the 1703 explorer journal and proof the creatures were real.
- **Chapter 14:** Starfall Lagoon — truth. Father’s stories were memories; Starfish returns home; Halley’s greatest discovery is his father.
- **Epilogue:** Keep original “One More Cast” pond closer — home, father, greatest catch was never a fish. Do not restate 1607 / pirate lore here.

---

## Prologue — replace in `prologue.js` → `PROLOGUE_STORY_PARAGRAPHS`

**Do not change.** Opening scroll stays the original Born Under the Comet mystery (birth, medallion, Crescent Pond call). Past history is discovered in play.

Play on **first successful catch** at each post-Starfish location (unlocks the next destination).

| Key | When | Should say |
|-----|------|------------|
| `louisiana_bayou` | First catch at Louisiana Bayou | Courage found; unlocks Congo River |
| `congo_river` | First catch at Congo River | Determination proven; unlocks Starfall Lagoon |
| `crazycatch_cove` | First catch at Starfall Lagoon | Finale celebration — stories were true *(key kept for saves)* |

Each entry: `halleyLine` (cat bark) + `banner` (top notification).

---

## Celestial first cast — replace `CELESTIAL_FIRST_CAST_NARRATION` (`storyChapters.js`)

| Field | When | Should say |
|-------|------|------------|
| `lines[]` | First cast at Celestial Depths (after Chapter 8) | Starlight Lure cast; sea mirrors sky |
| `halleyLine` | Same moment | Short Halley line before the bite |
| `voiceover` | Same moment (banner) | Story bible line: *"I've spent my life chasing wonders…"* |

---

## Starfish popup tease — replace in `starfishEncounter.js`

| Constant | When | Should say |
|----------|------|------------|
| `STARFISH_FIRST_CATCH_NARRATION` | First Starfish catch popup body | Short reunion tease only — full story is Chapter 9 |
| `STARFISH_FIRST_CATCH_QUOTE` | Popup quote block | One emotional Halley line |
| `STARFISH_GUIDE_DESTINATIONS_*` | Popup destination list | Four currents: Cortez, Bayou, Congo, Starfall Lagoon |

---

## Medallion clues — replace in `relicProgression.js` → `MEDALLION_CLUES`

At successful catches **5 / 8 / 13 / 18** while hunting the active relic:

| Clue id | Should say |
|---------|------------|
| `clue_first_pulse` | Medallion reacts to this water |
| `clue_brightens` | Stronger near the relic |
| `clue_flash` | Something moved beneath the surface |
| `clue_close` | Relic is near |

Each: `halleyLine` + `banner`.

---

## Relic discovery messages — replace in `hiddenRelics.js` → `HIDDEN_RELICS[].message`

One father-themed line per relic when it surfaces (shown in relic popup before chapter modal).

---

## Prologue — replace in `prologue.js` → `PROLOGUE_STORY_PARAGRAPHS`

**Do not change.** Opening scroll stays the original Born Under the Comet mystery (birth, medallion, Crescent Pond call). Past history is discovered in play.

---

## Story flow (runtime)

```
Prologue (birth) → Ch.1–7 (relics) → [Travel] Celestial → Ch.8 → First cast beat → Starfish → Ch.9
  → [Travel] Cortez → Ch.10 → Tarpon → Ch.11
  → [Travel] Bayou → Ch.12 → catch → Congo → Ch.13 → catch → Starfall Lagoon → Ch.14 → Epilogue
```

**Travel buttons** on chapter modals now call `executeLocationTravel()` to the next location when offered.
