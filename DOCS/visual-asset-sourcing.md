# Visual Asset Sourcing Guide — Kitty Creek

Reference for textures, HDRIs, 3D props, and budget planning.  
**Goal:** Ship a polished mobile fishing game using Three.js, mostly **CC0 (no attribution)** assets.

**Production URL:** https://kitty-creek.onrender.com

---

## Best sources (use these first)

### 1. [Poly Haven](https://polyhaven.com) — primary

| | |
|---|---|
| **License** | CC0 — no attribution required |
| **Best for** | PBR textures (wood, rock, fabric, metal), **HDRIs**, quality 3D models |
| **Download** | 1K JPG for mobile, 2K for desktop; full map sets (Color, Normal GL, Roughness) |
| **Already in repo** | Kloppenheim 06 HDRI, clean pebbles lake bed |

**Good starting pages:**
- [Textures](https://polyhaven.com/textures)
- [HDRIs](https://polyhaven.com/hdri)
- [Models](https://polyhaven.com/models)

### 2. [ambientCG](https://ambientcg.com) — secondary

| | |
|---|---|
| **License** | CC0 |
| **Best for** | Wood floors, metal, fabric, ground, rocks — huge library |
| **Download** | **1K-JPG .zip** packs (mobile-friendly) |

**Browse by category:**
- [Wood floor](https://ambientcg.com/list?category=WoodFloor)
- [Metal](https://ambientcg.com/list?category=Metal)
- [Fabric](https://ambientcg.com/list?category=Fabric)
- [Ground & sand](https://ambientcg.com/list?category=Ground)
- [Rocks](https://ambientcg.com/list?category=Rocks)

### 3. Procedural / generated (in this repo)

| Command / file | Use |
|----------------|-----|
| `npm run generate:dock-wood` | Seamless dock plank texture |
| `src/water2.js` | Procedural water normals (fallback) |
| Canvas textures in effects | Wake, splashes, caustics helpers |

**When to use:** Small repeating surfaces, tiny file sizes, no external download.

---

## What “really nice” needs (by category)

World-class *look* is not only textures. Rough split for a game like Kitty Creek:

| Share | What it is |
|-------|------------|
| ~40% | **Textures & materials** (wood, metal, water, lake bed) |
| ~40% | **3D assets** (trees, shore props, character outfit, boats) |
| ~20% | **Lighting, shaders, composition** (HDRI, water shader, camera) |

### Already in good shape

| Area | Status | Key files |
|------|--------|-----------|
| Water surface | HDRI reflections, dual normals, caustics | `waterMaterial.js`, `water2.js` |
| Lake bottom | Pebble bed visible in shallows | `assets/textures/lakeBed/` |
| Sky | CC0 HDRI background + env map | `loadSkyEnvironment.js` |
| Dock wood | Procedural + stylized dock | `dockTextures.js`, `stylizedDock.js` |
| Bobber wake | V-shaped trail during fights | `bobberWake.js` |

### Highest-impact gaps (not solved by ground/grass textures)

| Area | Best approach | Notes |
|------|---------------|-------|
| **Far shore / trees** | Low-poly tree GLBs + billboards | Grass textures don’t help — grass is off in-game |
| **Character outfit** | Rigged GLB (hat, vest) | Textures alone won’t dress the cat |
| **Boat hull detail** | CC0 wood + metal PBR on `platform.js` | Flat colors today |
| **Shoreline props** | Poly Haven models (rocks, crates, lanterns) | Near camera = big visual win |
| **Per-location HDRIs** | Different Poly Haven skies per biome | Ocean vs pond mood |
| **UI** | CSS/HTML polish | Separate from texture sites |

### Skip for now

- **Lawn / grass PBR** on the big ground plane — water is opaque; instanced grass is disabled.
- **8K texture packs** — overkill for mobile PWA; use 1K–2K.

---

## 3D models (when textures aren’t enough)

| Source | License | Best for |
|--------|---------|----------|
| [Poly Haven Models](https://polyhaven.com/models) | CC0 | Rocks, crates, realistic props |
| [Kenney](https://kenney.nl/assets) | CC0 | Simple stylized props |
| [Quaternius](https://quaternius.com) | CC0 | Low-poly packs (mobile-friendly) |
| [Sketchfab](https://sketchfab.com) | **Per asset** | Filter downloadable + CC0 only |

---

## Sources to use carefully

| Source | Why |
|--------|-----|
| Textures.com free tier | Often requires attribution or limited license |
| FreepBR | Mixed licenses — check each asset |
| TurboSquid / CGTrader “free” | Often non-commercial or credit required |
| Random Google / Pinterest | Not safe to ship |

**Rule:** If it’s not **CC0** or **explicitly commercial-friendly**, keep a license file or don’t use it.

---

## Recommended CC0 downloads (next polish pass)

### Textures

| Asset | Link | Wire to |
|-------|------|---------|
| Wood Floor Deck | [polyhaven.com/a/wood_floor_deck](https://polyhaven.com/a/wood_floor_deck) | `dockTextures.js`, boats |
| Weathered Planks | [polyhaven.com/a/weathered_planks](https://polyhaven.com/a/weathered_planks) | Dock alternate |
| Wood Floor 070 | [ambientcg.com/view?id=WoodFloor070](https://ambientcg.com/view?id=WoodFloor070) | Boat teak |
| Metal 048 B | [ambientcg.com/view?id=Metal048B](https://ambientcg.com/view?id=Metal048B) | Railings, hardware |
| Hessian 230 | [polyhaven.com/a/hessian_230](https://polyhaven.com/a/hessian_230) | Rope |

### HDRIs (per biome)

| Asset | Link | Mood |
|-------|------|------|
| Kloppenheim 06 | [polyhaven.com/a/kloppenheim_06](https://polyhaven.com/a/kloppenheim_06) | Sunny outdoor (in repo) |
| Small Harbour Morning | [polyhaven.com/a/small_harbour_morning](https://polyhaven.com/a/small_harbour_morning) | Ocean / boat docks |
| Fish Hoek Beach | [polyhaven.com/a/fish_hoek_beach](https://polyhaven.com/a/fish_hoek_beach) | Coastal |

### 3D props (shore clutter)

Browse [Poly Haven → Models](https://polyhaven.com/models) — rocks, wooden crates, lanterns near the waterline.

---

## Repo workflow (when adding assets)

1. Download **1K JPG** (mobile) or **2K** (desktop HDRIs/textures).
2. Place under `assets/textures/<category>/` (e.g. `lakeBed/`, `hdri/`, `wood/`).
3. Add a note in `assets/textures/licenses/` (see `polyhaven-cc0.txt`).
4. Register paths in `asset-manifest.json` (PWA offline cache).
5. In code: `RepeatWrapping`, `colorSpace = SRGBColorSpace` on color maps, optional `-sm` copies for mobile.
6. Prefer **one material per surface type** to limit draw calls.

**Key code locations:**

| System | Files |
|--------|-------|
| Water | `src/water/waterMaterial.js`, `src/water2.js`, `src/water/waterBodyTypes.js` |
| Sky / reflections | `src/environment/loadSkyEnvironment.js`, `src/scene.js` |
| Lake bed / caustics | `assets/textures/lakeBed/`, `src/effects/waterAmbience.js` |
| Dock | `src/scene/dockTextures.js`, `src/scene/stylizedDock.js` |
| Boats | `src/platform.js` |

---

## Mobile quality bar

You do **not** need AAA asset budgets. Strong **mobile** visuals usually mean:

- **1K–2K** on repeating surfaces
- **1K HDR** on phone, **2K** on desktop
- A few **hero props** near the camera
- **Billboards or simple trees** in the distance
- **One HDRI + sun** per biome
- **Light** post-processing (heavy bloom/SSAO hurts phones)

---

## How much money do you need?

### Short answer

**$0 can get you most of the way** if you curate CC0 assets yourself (Poly Haven + ambientCG).  
**$100–300** is a sensible “save time, look premium” budget for a solo indie.  
**$500–2,000+** only if you commission custom art (outfit, hero environment, marketing shots).

You do **not** need to spend thousands on texture subscriptions to make Kitty Creek look really good.

---

### Tier 0 — $0 (recommended baseline)

| Item | Cost | Notes |
|------|------|-------|
| Poly Haven textures, HDRIs, models | $0 | CC0 |
| ambientCG PBR packs | $0 | CC0 |
| Kenney / Quaternius props | $0 | CC0 |
| Blender | $0 | Retopo, trim, export GLB |
| Freesound / OpenGameArt audio | $0 | Check per-file license |

**What you get:** Pond/lake water (done), dock wood, boat PBR, rocks, props, multiple skies — enough for a **polished indie** look if wired well (as with the recent water pass).

**Your time:** Browsing, downloading, integrating — budget **10–30 hours** of focused art pass, not dollars.

---

### Tier 1 — ~$0–50 / year (optional support)

| Item | Typical cost | Worth it? |
|------|--------------|-----------|
| Poly Haven Patreon | ~$5–10/mo | Optional; supports the site, ad-free browsing — **downloads stay free** |
| ambientCG Patreon | ~$3–10/mo | Same |
| One curated SFX pack | $15–40 once | UI clicks, reel sounds, ambience — if Freesound search gets tiring |

**Not required** for quality; this is convenience and giving back.

---

### Tier 2 — ~$50–300 one-time (smart spends)

Spend here only when CC0 search costs more time than money:

| Item | Typical cost | When it’s worth it |
|------|--------------|-------------------|
| Stylized **tree / nature pack** (Sketchfab, Unity Asset Store, itch.io) | $25–80 | Far shore silhouette — biggest gap vs “reference art” screenshots |
| **Character outfit** GLB (hat, vest, rigged to cat) | $30–120 | If you can’t model in Blender |
| Premium **SFX + music** bundle | $30–80 | Cohesive audio identity |
| Substance / material subscription | $0–25/mo | **Skip** unless you author custom materials — CC0 covers you |

**Sweet spot for Kitty Creek:** **$80–150 total** — one tree pack + one outfit or prop pack + optional SFX — if you buy **once**, not subscriptions.

---

### Tier 3 — ~$300–2,000+ (commissioned / custom)

| Item | Typical cost |
|------|--------------|
| Custom cat fisher model + animations | $300–1,500 |
| Custom dock / boat hero assets | $200–800 |
| Environment matte painting / skybox set | $100–400 |
| Freelance “polish pass” (1–2 weeks) | $500–2,000 |

Only needed if you want a **unique brand look** that CC0 libraries can’t provide, or store/marketing art.

---

### What NOT to spend on (for this project)

| Spend | Why skip |
|-------|----------|
| Textures.com / Quixel subscriptions | CC0 libraries are enough; subscriptions are $10–30+/mo |
| 8K texture bundles | Mobile won’t show it; wastes bandwidth on Render |
| Grass / terrain mega-packs | Grass isn’t visible; ground is under water |
| AAA water plugins | You already have a custom water shader tuned for the game |
| Stock photo skies for UI only | Use HDRIs in the 3D scene instead |

---

## Suggested budget plan for Kitty Creek

| Phase | Budget | Focus |
|-------|--------|-------|
| **Now** | **$0** | Finish wiring CC0: boat wood/metal, dock upgrade, 3–5 shore props, 2nd HDRI for ocean |
| **If stuck on art time** | **$50–150** | One tree pack + one rigged outfit or hero prop |
| **Pre-launch polish** | **+$50–100** | SFX/music bundle, app icon splash art |
| **Only if revenue justifies** | **$500+** | Commission custom cat + signature location |

**Realistic “really nice” target:** **$0–150 cash** + your integration time. The recent water + HDRI pass proved how much lift free CC0 gives when applied in the right systems.

---

## License hygiene

Keep a small folder: `assets/textures/licenses/`

For each external pack, note:
- Asset name
- Source URL
- License (CC0 / other)
- Date downloaded

Example in repo: `assets/textures/licenses/polyhaven-cc0.txt`

---

## Quick links

- Poly Haven: https://polyhaven.com  
- ambientCG: https://ambientcg.com  
- Kenney: https://kenney.nl/assets  
- Quaternius: https://quaternius.com  
- Freesound: https://freesound.org (check license per sound)  
- Render deploy: https://kitty-creek.onrender.com  

---

*Last updated: June 2025 — reflects HDRI water pass, pebble lake bed, and bobber wake in main.*
