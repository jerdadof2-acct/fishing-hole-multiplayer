# Idle Portrait Camera & Cat Facing (LOCKED)

**Status:** Verified working  
**Locked commit:** `54a151a` — *Keep cat lake-facing during fishing; portrait turn only while idle.*  
**Config source of truth:** `src/config/idlePortrait.js`  
**Git tag (restore point):** `idle-portrait-locked-v1`

## Intended Behavior

1. **Normal gameplay:** Cat always faces the **lake** (`CAT_FACING_Y = 0`). Casting, reeling, fighting, and bobber tracking keep lake-facing.
2. **After 28 seconds** of no pointer/keyboard/touch/wheel input on the **Game** tab (and no active fishing sequence), idle portrait mode activates.
3. **Portrait active:** Camera eases from gameplay offset to a close face shot; cat **turns toward the camera** in sync with `portraitBlend`.
4. **Any user input** cancels portrait immediately; cat snaps back to lake-facing on the next frame.

## Critical Rules (do not break)

| Rule | Why |
|------|-----|
| `positionOnSurface()` resets `rotation.y` to `CAT_FACING_Y` every frame **unless** `preserveFacing === true` | Keeps lake-facing during fishing |
| `preserveFacing` is only `true` when `_portraitIdleActive` | Portrait turn must not leak into fishing |
| `portraitBlend` passed to `cat.update()` is **0** unless `_portraitIdleActive` | Prevents decaying blend from turning cat toward camera after cast |
| `updateIdlePortrait()` runs **before** `positionOnSurface()` | Fishing/cancel clears portrait before rotation reset |
| `camera.advancePortraitBlend()` runs **before** `cat.update()` | Cat turn syncs with same-frame blend |
| `camera.updateSpring()` runs **after** `cat.update()` | Look-at uses turned head position |

## Locked Settings

| Setting | Value | File |
|---------|-------|------|
| Lake-facing Y | `0` | `src/config/idlePortrait.js` → `CAT_FACING_Y` |
| Idle delay | `28` sec | `IDLE_PORTRAIT_DELAY_SEC` |
| Gameplay camera offset | `(0, 16, -12)` | `GAMEPLAY_CAMERA_OFFSET` |
| Portrait camera offset | `(0, 2.05, -4.2)` | `PORTRAIT_CAMERA_OFFSET` |
| Gameplay look-at offset | `(0, 1.5, 4)` | `GAMEPLAY_LOOK_AT_OFFSET` |
| Portrait blend speed | `1.4` | `PORTRAIT_BLEND_SPEED` |
| Cat portrait turn | `baseRotationY + π × portraitBlend` | `src/cat.js` |
| Cat turn lerp speed | `delta × (4 + portraitBlend × 4)` | `PORTRAIT_CAT_TURN_SPEED_*` |
| Spring stiffness | `60`, damping `12` | `CAMERA_SPRING_*` |

## Key Files

| File | Role |
|------|------|
| `src/config/idlePortrait.js` | All tunable constants (single source of truth) |
| `src/main.js` | `updateIdlePortrait`, `isPortraitEligible`, `markActivity`, frame order |
| `src/camera.js` | Portrait blend, offsets, spring setup |
| `src/camera/cameraSpring.js` | Offset/look-at lerp during portrait |
| `src/cat.js` | `positionOnSurface(preserveFacing)`, portrait Y rotation in `update()` |

## Portrait Eligibility (`isPortraitEligible`)

Portrait **does not** activate when:

- Username modal is open
- Active tab is not `game`
- Casting, reeling, fish on line, or waiting for bite
- Cast button state is `waiting`, `set-hook`, or `fighting`
- Bobber visible and catch sequence not complete

## How to Restore If Broken

```bash
# Option A: checkout the locked commit (read-only inspect)
git show 54a151a

# Option B: restore only portrait-related files from tag
git checkout idle-portrait-locked-v1 -- src/config/idlePortrait.js src/main.js src/camera.js src/cat.js src/camera/cameraSpring.js

# Option C: compare current code to locked baseline
git diff idle-portrait-locked-v1 -- src/config/idlePortrait.js src/main.js src/camera.js src/cat.js
```

## History of Fixes

| Commit | Change |
|--------|--------|
| `37117c5` | Added idle portrait camera pan |
| `78fdd24` | First attempt at cat turn during portrait |
| `b6cdfc4` | Fixed rotation reset blocking portrait turn (broke fishing facing) |
| `54a151a` | **Locked behavior:** lake-facing during fishing; portrait turn gated on `_portraitIdleActive` |
