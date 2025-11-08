# Gameplay Systems Implementation Plan

## Status: ✅ COMPLETE (Core Systems)

**Last Updated**: 2024
**Note**: Core systems are complete. See IMPLEMENTATION_STATUS.md for current status and PROJECT_DOCUMENTATION.md for complete documentation.

## Overview
Add core gameplay systems from reference file: player progression (level, money, experience, stats), 33 fish types with values, tackle shop (rods, reels, lines, hooks, baits), inventory/catch tracking, leaderboards (location-specific + global top 10), and fish collection screen. All UI must be mobile-first with tabbed navigation.

## ✅ Completed Implementation Tasks

### 1. Player State Management System
**File**: `src/player.js` (new)
- Create Player class with:
  - Basic stats: level, money, experience, name
  - Player stats: accuracy, luck, patience, strength (all 0-100, default 50)
  - Inventory: totalCaught, totalWeight, biggestCatch
  - Unlocks: locationUnlocks array, tackleUnlocks object (rods, reels, lines, hooks, baits arrays)
  - Current gear: rod, reel, line, hook, bait
  - Catch tracking: recentCatches array, top10BiggestFish array, caughtFish object
  - Fish collection: caughtFishCollection object (fishId: {caught: true/false, firstCatchDate: timestamp})
- Methods: addExperience(), addMoney(), levelUp(), checkLevelUp(), calculateExpForLevel()
- Save/load: localStorage integration

### 2. Fish Type System
**File**: `src/fishTypes.js` (new)
- Define all 33 fish types from reference:
  - Common (0-4): Minnow, Sunfish, Bass, Perch, Crappie
  - Uncommon (5-9): Trout, Pike, Walleye, Muskie, Carp
  - Rare (10-14): Salmon, Catfish, Sturgeon, Marlin, Tuna
  - Epic (15-19): Crystal Bass, Golden Trout, Ice Pike, Shadow Catfish, Abyssal Eel
  - Legendary (20-24): Ancient Sturgeon, Leviathan, Phoenix Fish, Dragon Carp, Tournament King
  - Trophy (25-32): 8 trophy variants
- Each fish: name, rarity, minWeight, maxWeight, value, experience, season, imagePath
- Fish facts/writeups from reference (each fish has: fact, fun, real descriptions)
- Methods: getFishTypeById(), getRandomFishForLocation(), calculateFishValue(), getFishFacts()

### 3. Tackle Shop System
**File**: `src/tackleShop.js` (new)
- Define tackle data from reference:
  - Rods (7): Basic → Fiberglass → Carbon Fiber → Pro → Master → Legendary → Trophy (costs $0-$100k)
  - Reels (6): Basic → Spinning → Baitcasting → Fly → Big Game → Trophy ($0-$25k)
  - Lines (5): Monofilament → Braided → Fluorocarbon → Wire → Titanium ($0-$8k)
  - Hooks (6): Basic → Barbed → Circle → Treble → Jig → Trophy ($0-$10k) - each with timing window (600ms-1100ms)
  - Baits (6): Basic → Live → Artificial → Premium → Specialty → Trophy ($0-$15k)
- Methods: getTackleByCategory(), canAfford(), canUnlock(), purchase(), equip()
- Note: Equipment visuals stay the same initially (bonuses are stat-only)

### 4. Inventory & Catch Tracking
**File**: `src/inventory.js` (new)
- Track caught fish:
  - Recent catches (last 10)
  - Top 10 biggest fish ever (sorted by weight)
  - Caught fish dictionary (name: true)
- Methods: addCatch(), updateTop10(), getRecentCatches(), getTop10(), hasCaughtFish()

### 5. Leaderboard System
**File**: `src/leaderboard.js` (new)
- Location-specific leaderboards: track top catches per location
- Global leaderboard: top 10 catches across all locations
- Structure: { locationId: [{playerName, fishName, weight, timestamp}], global: [...] }
- Methods: addCatch(), getTop10ForLocation(), getGlobalTop10(), getPlayerRank()
- Display: Shows top 10 + current player rank if not in top 10

### 6. Fish Collection System
**File**: `src/fishCollection.js` (new)
- Track fish collection state:
  - caughtFishCollection: { fishId: {caught: boolean, firstCatchDate: timestamp, count: number} }
- Methods: 
  - unlockFish(fishId) - Mark fish as caught for first time
  - isFishUnlocked(fishId) - Check if fish is in collection
  - getCollectionStats() - Get caught count, total count, percentages
- Fish images: Load from assets directory (path: assets/fish/[fishName].png or similar)
- Display: Greyed out until caught, full color when unlocked

### 7. First Catch Popup
**Files**: `src/ui.js`, `src/fishCollection.js`
- On first catch of a fish:
  - Show special popup with:
    - Fish image (from assets directory)
    - Fish name and rarity
    - Fish weight
    - "New Fish Unlocked!" message
    - Fish description/writeup (fact, fun, real)
    - Close button
  - Unlock fish in collection
  - Save to localStorage
- Popup design: Mobile-friendly, centered, with image at top

### 8. Fish Collection Screen UI
**Files**: `index.html`, `css/styles.css`, `src/ui.js`
- New tab: "Collection" (between Shop and Leaderboard)
- Collection screen displays:
  - Grid of all 33 fish (responsive grid)
  - Each fish card shows:
    - Fish image (greyed if not caught, full color if caught)
    - Fish name
    - Rarity badge (Common/Uncommon/Rare/Epic/Legendary/Trophy)
    - Lock/unlock indicator
  - Tap fish card to view details:
    - Fish image (if unlocked)
    - Fish name and rarity
    - Fish description/writeup (fact, fun, real)
    - Catch count (if caught)
    - First catch date (if caught)
- Mobile-optimized: Grid adjusts to screen size (2-3 columns on mobile, 4-5 on tablet)

### 9. Bite Detection & Catch Algorithm
**Files**: `src/fishing.js`, `src/fish.js`
- Implement cast → wait → bite flow:
  - Cast button triggers cast
  - Bobber lands → enter waiting state (waiting for bite)
  - Wait for random bite timing (based on location difficulty, tackle, player patience stat)
  - On bite: trigger bite detection algorithm
- Bite detection algorithm (from reference):
  - Calculate catch probability based on:
    - Player stats (accuracy, luck, patience, strength)
    - Current tackle bonuses (rod catchBonus, hook catchBonus, bait catchBonus)
    - Hook timing window (600ms-1100ms based on hook type)
    - Fish rarity modifier (common easier, legendary harder)
  - If successful: determine fish type and size from location fish array
  - If failed: show miss notification, return to waiting state
- Fish determination:
  - Use location fish array to determine available fish types
  - Weight calculation based on fish type (minWeight to maxWeight)
  - Apply rarity distribution (common more likely, legendary very rare)
- On first catch: Trigger first catch popup

### 10. Mobile-First UI System
**Files**: `index.html`, `css/styles.css`, `src/ui.js`

#### HTML Structure (`index.html`)
- Add mobile-optimized game UI:
  - Tab bar: Game | Shop | Collection | Inventory | Leaderboard
  - Player info panel: Level, Money, Exp, Stats
  - Game area: Fishing controls + canvas
  - Shop modal: Tabbed tackle shop (Rods | Reels | Lines | Hooks | Baits)
  - Collection screen: Fish grid with details modal
  - Inventory modal: Recent catches + Top 10 biggest
  - Leaderboard modal: Location leaderboard + Global top 10
  - First catch popup: Modal with fish image and description

#### CSS Mobile Design (`css/styles.css`)
- Mobile-first responsive design:
  - Tab navigation (bottom bar on mobile)
  - Collapsible panels
  - Touch-friendly buttons (min 44px touch targets)
  - Modal overlays (full-screen on mobile)
  - Scrollable lists (max-height, overflow-y)
  - Responsive breakpoints for tablet
  - Fish collection grid (responsive columns)
  - Greyed out filter for locked fish (filter: grayscale(100%) + opacity(0.5))

#### UI Integration (`src/ui.js`)
- Update UI class to handle:
  - Tab switching (Game | Shop | Collection | Inventory | Leaderboard)
  - Shop modal open/close
  - Collection screen display
  - Fish collection grid rendering
  - Fish detail modal open/close
  - First catch popup display
  - Inventory modal open/close
  - Leaderboard modal open/close
  - Player stat updates
  - Catch notifications with money/exp gains
  - Bite waiting state UI
  - Miss/catch notifications

### 11. Game Integration
**File**: `src/main.js`
- Initialize player system
- Initialize fish types
- Initialize tackle shop
- Initialize inventory
- Initialize leaderboard
- Initialize fish collection
- Connect catch events to systems:
  - On fish caught: 
    - Check if first catch → show first catch popup
    - Unlock fish in collection
    - Add experience, add money, add to inventory, update leaderboard
  - Check level up on experience gain
  - Show catch notification with rewards
- Connect bite detection to catch algorithm

### 12. Save/Load System
**File**: `src/player.js`
- Save to localStorage: player data, inventory, leaderboard, fish collection
- Load from localStorage on init
- Auto-save after catches, purchases, level ups, collection unlocks
- Backup save system

### 13. Fish Integration
**File**: `src/fish.js`
- Update to use fishTypes.js for fish generation
- Use location fish array to determine available fish
- Apply fish values and experience from fishTypes
- Pass fish data to catch tracking
- Implement bite state: IDLE → WAITING → BITE_DETECTED → HOOKED_FIGHT → LANDING → LANDED
- Add waiting state UI feedback
- Trigger first catch popup on first catch

### 14. Location Integration
**File**: `src/locations.js`
- Update location fish arrays to reference fishTypes IDs
- Ensure fish availability matches location difficulty
- Locations already map to water body types (POND, RIVER, LAKE, OCEAN) - verify correct mapping

### 15. Fish Image System
**File**: `src/fishCollection.js`
- Load fish images from assets directory
- Image path structure: `assets/fish/[fishName].png` or `assets/fish/[fishId].png`
- Handle missing images gracefully (fallback to placeholder)
- Preload images for collection screen
- Cache images for performance

### 16. Username & Online Persistence System
**Files**: `server/index.js`, `src/api.js`, `src/player.js`, `src/ui.js`, `index.html`, `css/styles.css`, `package.json`
- Provide a first-launch username prompt:
  - Modal input asking the player to pick a unique username before entering the game
  - Validate locally (length, characters) and show inline errors
- Persist player identity across sessions via PostgreSQL hosted on Railway:
  - Create an Express backend (`server/index.js`) that serves the static build and exposes REST endpoints under `/api/users`
  - Configure PostgreSQL connection using `pg` with `process.env.DATABASE_URL` (Railway) and SSL
  - Ensure a `players` table exists (`id UUID PRIMARY KEY`, `username TEXT UNIQUE`, timestamps, optional profile JSON)
  - Endpoints:
    - `POST /api/users/register` → reserve a new username, returning `{ userId, username }`
    - `POST /api/users/login` → validate an existing `userId`, returning the stored profile or 404
- Frontend API wrapper (`src/api.js`):
  - Helper methods `registerUsername(name)` and `loginUser(userId)` with error handling and JSON parsing
- Extend `Player` model:
  - Store `userId` alongside name/stats, persist to localStorage, expose `setIdentity({ userId, name })`
  - When loading player data, attempt server login if a stored `userId` exists; fallback to prompting for username on failure
- UI integration:
  - Add username modal markup/styling (mobile friendly) to `index.html`/`css/styles.css`
  - In `ui.js`, block gameplay until a username is confirmed (show modal on init when `player.userId` missing)
  - On modal submit: call API to reserve name, update player identity, save, hide modal, refresh HUD
  - Display server error / “name taken” messages inline without leaving modal
- Project scaffolding:
  - Add root `package.json` with scripts (`start`, `dev`) and dependencies (`express`, `pg`, `cors`, `dotenv`)
  - Document Railway environment variables (e.g., `.env` containing `DATABASE_URL`) and local dev instructions
  - Optional: provide mock fallback that stores names locally when backend unavailable (for offline use)

### 17. Achievement System
**Files**: `src/achievements.js`, `src/player.js`, `src/ui.js`, `index.html`, `css/styles.css`
- Define achievement catalog (`src/achievements.js`):
  - IDs, titles, descriptions, unlock conditions (first catch, big fish, level milestones, rare catches, collection progress, wealth, gear collection, etc.)
  - Optional progress metadata (current/target) for UI progress bars
- Player integration:
  - Add `achievements` array to player state; persist via save/load; include in resets
  - Evaluate achievements after relevant events (catch, level-up, gear purchase, init)
  - Save newly unlocked achievements immediately
- UI updates:
  - Inventory modal gains an “Achievements” tab showing unlocked/locked states, descriptions, progress bars and completion counts
  - Toast/notification when an achievement unlocks
  - Styling in `styles.css` for achievement cards and progress bars
- Future enhancements: surface achievement badges on leaderboards, tie rewards (coins/gear) to milestone unlocks, expose counts via API for social features

## UI Flow
1. **Game Tab**: Main fishing interface (Cast button → Wait → Bite → Catch/Miss)
2. **Shop Tab**: Open tackle shop modal, browse by category, purchase items
3. **Collection Tab**: View fish collection grid, tap fish to see details, greyed out until caught
4. **Inventory Tab**: View recent catches, top 10 biggest fish
5. **Leaderboard Tab**: View location leaderboard + global top 10 (shows current player rank if not in top 10)

## Gameplay Flow
1. **Cast**: Player clicks Cast → Bobber lands in water → Enter waiting state
2. **Wait**: Bobber floats, random wait time (affected by patience stat, tackle bonuses, location difficulty)
3. **Bite**: Fish bites → Bite detection algorithm runs:
   - Calculate catch probability (stats + tackle + timing)
   - If successful → Determine fish type from location fish array
   - If failed → Show miss notification, return to waiting state
4. **First Catch Check**: If first time catching this fish → Show first catch popup with image and description
5. **Catch**: Fish type and size determined → Value/exp calculated
6. **Rewards**: Experience added → Check level up → Money added
7. **Tracking**: Catch recorded → Collection unlocked → Inventory updated → Leaderboard updated
8. **Save**: Auto-save triggered → localStorage updated

## Mobile Considerations
- Bottom tab bar for navigation (5 tabs: Game | Shop | Collection | Inventory | Leaderboard)
- Modal overlays for shop/inventory/leaderboard/collection
- Touch-optimized controls (large buttons, spacing)
- Responsive layout for tablets
- Scrollable content areas
- Player info always visible (collapsible on mobile)
- Waiting state indicator (bobber animation, timer)
- Fish collection grid: 2 columns mobile, 3-4 tablet

## Equipment Visuals
- Equipment visuals stay the same initially (tackle shop bonuses are stat-only)
- Future: Equipment visuals may change with upgrades (not in this phase)

## Fish Collection Visual States
- **Locked** (not caught): Greyed out image (filter: grayscale(100%) + opacity(0.5)), lock icon overlay
- **Unlocked** (caught): Full color image, checkmark icon overlay
- **First catch**: Special highlight animation on unlock

## Data Flow
1. Cast → Wait for bite (timing based on stats/tackle/location)
2. Bite detected → Algorithm determines catch/miss + fish type/size
3. If catch: 
   - Check if first catch → Show first catch popup → Unlock in collection
   - Fish type determined → Value/exp calculated
4. Experience added → Check level up → Unlock new tackle/locations
5. Money added → Can purchase tackle
6. Catch recorded → Collection updated → Inventory updated → Leaderboard updated
7. Auto-save triggered → localStorage updated

