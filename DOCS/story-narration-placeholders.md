# Story Narration Placeholders

Runtime wiring lives in `src/config/storyChapters.js`, `src/storyProgress.js`, and `src/ui.js`.

Replace placeholder copy below when final narrations are ready. Each section lists **where it plays**, **config key**, and **what it should say** (intent).

---

## Already wired — replace copy in `storyChapters.js`

| Chapter | Trigger | Config |
|---------|---------|--------|
| **1–7** | After each relic discovery | `STORY_CHAPTERS[]` |
| **8 — Celestial Depths** | First arrival at Celestial Depths | `POST_STARFISH_CHAPTERS.chapter_8_celestial` |
| **9 — Starfish reunion** | After first Starfish popup closes | `POST_STARFISH_CHAPTERS.chapter_9_starfish` |
| **10 — Cortez homecoming** | First arrival at Cortez Backwaters | `POST_STARFISH_CHAPTERS.chapter_10_cortez` |
| **11 — Father's journal** | First Tarpon catch at Cortez | `POST_STARFISH_CHAPTERS.chapter_11_journal` |
| **12 — Louisiana Bayou** | First arrival at Louisiana Bayou | `POST_STARFISH_CHAPTERS.chapter_12_bayou` |
| **13 — Congo River** | First arrival at Congo River | `POST_STARFISH_CHAPTERS.chapter_13_congo` |
| **14 — CrazyCatch Cove** | First arrival at CrazyCatch Cove | `POST_STARFISH_CHAPTERS.chapter_14_crazycatch` |
| **Epilogue** | After Chapter 14 modal closes | `POST_STARFISH_CHAPTERS.epilogue` |

### Intent per chapter (for your rewrites)

- **Chapter 8:** Halley enters the Celestial Depths for the first time with the Starlight Lure. Fear, wonder, father's presence without him physically there.
- **Chapter 9:** Full Starfish reunion — medallion origin, release, comet vs father theme. *(Starfish popup is now a short tease only.)*
- **Chapter 10:** Return to Cortez dock — emotional homecoming before the journal beat.
- **Chapter 11:** Father's unfinished journal reveals three destinations.
- **Chapters 12–14:** Arrival narrations — "someday finally arrived" at each journal location.
- **Epilogue:** Father and Halley together at the pond; greatest catch was never a fish.

---

## Short beats — replace in `JOURNEY_COMPLETE_BEATS` (`storyChapters.js`)

Play on **first successful catch** at each post-Starfish location (unlocks the next destination).

| Key | When | Should say |
|-----|------|------------|
| `louisiana_bayou` | First catch at Louisiana Bayou | Halley fulfilled the bayou promise; unlocks Congo River |
| `congo_river` | First catch at Congo River | Halley carried his father's dream; unlocks CrazyCatch Cove |
| `crazycatch_cove` | First catch at CrazyCatch Cove | Halley found the invented cove; optional celebration beat |

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
| `STARFISH_GUIDE_DESTINATIONS_*` | Popup destination list | Four currents: Cortez + three journal trips |

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

Scroll text on new game entry (Born Under the Comet).

---

## Story flow (runtime)

```
Prologue → Ch.1–7 (relics) → [Travel] Celestial → Ch.8 → First cast beat → Starfish → Ch.9
  → [Travel] Cortez → Ch.10 → Tarpon → Ch.11 → [Travel] Bayou → Ch.12 → catch → Congo → Ch.13 → catch → Cove → Ch.14 → Epilogue
```

**Travel buttons** on chapter modals now call `executeLocationTravel()` to the next location when offered.
