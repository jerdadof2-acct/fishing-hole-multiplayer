## Halley’s Big Catch Story Bible

### Title Card

```
✨ Halley’s Big Catch ✨
```

### Prologue — Born Under the Comet

On the night a small kitten was born, Halley’s Comet crossed the sky.

As it passed overhead, glowing fragments broke away and scattered across the world. One of them landed in his family’s yard.

His father named him Halley after the comet and later placed the fragment inside a medallion he made for his son.

For years, the stone gave off only a faint blue glow, and Halley thought of it as little more than a treasured gift from his father.

Then one quiet morning at Crescent Pond, the medallion began to pulse.

The water grew still. A strange warmth spread across Halley’s chest, and he felt something distant stirring far beneath the surface.

Something mysterious was calling to him from the deep.

And for the first time, the medallion seemed to know the way.

> **Gameplay tie-in:** Halley’s chest medallion is a comet fragment in a faint always-on blue glow; the pulse at Crescent Pond is the story beat that begins the player’s journey (see `MEDALLION_GEM_OFFSET` / comet gem in `src/cat.js`).

### Chapter 1 — The Call of the Horizon

Halley never felt bound to land. While other cats napped by fires or chased mice, he watched light dance across the water’s surface, feeling the ocean calling to him. When he was old enough, he built his first boat, **The Shooting Star**, from scrap planks and determination. With rod and reel in paw, he set out to chase horizons — one tide, one cast, one story at a time.

### Chapter 2 — The Great Journey

Halley’s travels spanned tranquil ponds, roaring seas, jungle rivers, coral kingdoms, frozen fjords, desert lagoons, storm-lashed bays, and forgotten reefs. Every destination held a new wonder, a powerful fish, and a whispered secret about the night of the comet. In each region Halley uncovered a relic — artifacts etched with messages that felt familiar, like fragments of a forgotten puzzle.

### Chapter 3 — Hidden Relics of the Sea

| # | Location | Hidden Item | Message | Meaning |
| --- | --- | --- | --- | --- |
| 1 | Crescent Pond (Halley’s Home Pond) | Weathered Fishing Bobber | “The smallest ripples remember where they began.” | Halley’s nostalgic connection to his childhood; the spark that began his love for fishing. |
| 2 | Sandy Shoals | Driftwood Compass | “The sea never forgets its course — only those who stop listening.” | Unseen forces guide Halley toward his destiny. |
| 3 | Coral Kingdoms | Sunken Treasure Chest | “Not all that glitters is gold. Some treasures remember your name.” | Foreshadows that the true treasure, the Starfish, is alive and aware. |
| 4 | Amazon Depths | Message in a Bottle | “The stars once fell, and the sea still whispers their names.” | Direct reference to the comet that birthed both Halley and the Starfish. |
| 5 | Craggy Coast | Broken Harpoon | “The hunter becomes the seeker when he lowers his spear.” | Halley shifts from chasing trophies to seeking meaning. |
| 6 | Frozen Fjords | Frozen Pocket Watch | “Even time can sleep beneath the ice… but not forever.” | Time stands still for what lies waiting in the depths. |
| 7 | Desert Lagoon | Half-Buried Telescope | “Look to the stars — the same light that guides the waves guides you.” | The comet’s light still leads the way. |
| 8 | Stormbreaker Bay | Torn Map Fragment | “The path forward isn’t drawn in ink — it’s carried in the current.” | The ocean’s rhythm is Halley’s only map. |
| 9 | Forgotten Reefs | Coral Pendant (Comet-shaped) | “Two lights were born as one — one of the sky, one of the sea.” | Confirms the bond between Halley and the Starfish of Eternity. |
| 10 | Twilight Trench | Luminescent Shell | “The ocean remembers every spark. Follow its glow — it remembers you.” | The final message; the Starfish remembers Halley and awaits the reunion. |

### Chapter 4 — The Starlight Lure

When Halley assembled all ten relics aboard The Shooting Star, each shimmered with traces of comet light. Placed together, they fused into a luminous, swirling bait forged from starlight. Halley named it the **Starlight Lure**, a fragment of the sky calling to something deep below.

> **Halley’s Logbook:** “Ten pieces of a puzzle I didn’t even know I was solving… Looks like I’ve just built the light that started it all.”

### Chapter 5 — The Celestial Depths

With the Starlight Lure complete, Halley returned to sea beneath the same stars that marked his birth. The ocean stilled, glowing faintly as constellations mirrored across the water. He cast the lure, no bobber required, and the sea itself illuminated — a radiant halo spreading beneath the surface. The line drew tight with a deliberate, gentle weight as the stars overhead aligned into the image of a starfish. From the depths emerged the **Starfish of Eternity**, immense, radiant, and ancient, surrounded by golden light.

### Chapter 6 — The Reunion

There was no struggle. The line pulsed softly, a heartbeat shared between Halley and the Starfish. Meeting its glowing eyes, Halley understood: this was recognition, not conquest. The Starfish spoke within his mind, reminding him that the light he sought was always within. Halley lowered his rod as the ocean brightened, wrapping them in golden radiance. The wanderer and the watcher, both born of the comet, were reunited.

### Epilogue — The Eternal Tide

Dawn revealed The Shooting Star drifting on tranquil water. The Starfish had vanished beneath the waves, yet the ocean still glowed as if it remembered. Halley gazed toward the horizon, knowing the greatest catch was never a fish at all, but the part of himself he had forgotten he was searching for.

> **Halley’s Logbook:** “The greatest catch was never a fish at all. It was the part of me I’d forgotten I was looking for.”

### The Celestial Depths (Hidden Region)

**Unlock Condition:** Collect all ten hidden relics and decipher the Luminescent Shell’s constellation. At night, align the stars with glowing points upon the sea to reveal a spiral descent into the Celestial Depths — the ocean inviting Halley home.

**Atmosphere:** A sea like no other, dark as the sky with twinkling water that mirrors constellations. Bioluminescent fish drift like living stardust. Coral formations resemble star maps. Ambient sound shifts from gentle waves to a calm, resonant heartbeat. As Halley descends, his lantern fades and only the Starfish’s golden aura remains.

**Discovery Sequence:** At the abyssal basin, a stone plateau etched with star-shaped markings awaits. The Starfish of Eternity rests at its center, its glow pulsing with the ocean. Currents spiral, starlight rains upward, and the world slows as Halley reaches out.

**Final Moment (Voiceover):** “I’ve spent my life chasing wonders… and all along, one of them was chasing me.”

### Implementation Notes — Celestial Depths Update (Nov 11, 2025)

- **Starlight Water & Particles:** The Celestial Depths now use a near-black water body with twinkling particle fields that drift like constellations. The surface glow intensifies whenever the Starlight Lure is cast, echoing the narrative description of fishing atop the night sky.
- **Starlight Lure Visuals:** Casting the Starlight Lure replaces the bobber with a comet-bright halo that ignites immediately on hook, expands during the fight, and erupts threefold as the Starfish approaches the stern of the boat.
- **Exclusive Catch:** Only the **Starfish of Eternity** can be hooked in the Celestial Depths. Other species are excluded so the encounter always aligns with the story’s climax.
- **First Catch Celebration:** The first reunion with the Starfish locks the water in full radiance for a four-and-a-half-second celebration. Halley’s animation, the glow, and the bespoke popup (“Let Go and Watch It Return to the Deep”) are all synchronized to give the moment the gravity of a finale.
- **Lore-Driven Rewards:** Catching the Starfish grants no coins, weight records, or experience. Instead, it serves as a narrative trigger (future updates will use it to unlock globe-spanning destinations). The experience is about recognition, not loot.
- **Repeat Visits:** After the first reunion, catching the Starfish again still triggers the starlit aura and a recycled advice popup, reminding players that the Starfish remains a guide rather than a trophy.

### First-Time Entrance Sequence

Before gameplay begins, new players see a cinematic scrolling prologue (movie-credit style) accompanied by an eventual voiceover.

**Canonical scroll text (2026-06):**

> On the night a small kitten was born, Halley’s Comet crossed the sky.  
> As it passed overhead, glowing fragments broke away and scattered across the world. One of them landed in his family’s yard.  
> His father named him Halley after the comet and later placed the fragment inside a medallion he made for his son.  
> For years, the stone gave off only a faint blue glow, and Halley thought of it as little more than a treasured gift from his father.  
> Then one quiet morning at Crescent Pond, the medallion began to pulse.  
> The water grew still. A strange warmth spread across Halley’s chest, and he felt something distant stirring far beneath the surface.  
> Something mysterious was calling to him from the deep.  
> And for the first time, the medallion seemed to know the way.

As the narration ends, the entrance screen transitions to the main title featuring Halleycat and the Halley’s Big Catch logo.

**Implementation note:** `PROLOGUE_STORY_PARAGRAPHS_NEXT` in `src/config/prologue.js` holds this text for the in-game scroll. Swap it into `PROLOGUE_STORY_PARAGRAPHS` and bump `PROLOGUE_GAME_VERSION` when the intro voiceover is re-recorded to match.

### Core Themes

- Wonder over conquest — fishing as an act of curiosity and connection.
- Destiny intertwined with cosmic events — Halley and the Starfish born from the same comet.
- Memory and belonging — the ocean remembers every spark, guiding Halley home.

### Future Expansion Hooks

- Region-specific fish and fantasy species tailored to each body of water.  
- Additional logbook entries detailing Halley’s personal reflections.  
- Seasonal events aligning with celestial phenomena.

