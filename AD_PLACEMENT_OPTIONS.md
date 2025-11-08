# Banner Ad Placement Options

## Current UI Layout

```
┌─────────────────────────────────────┐
│  Player Info Panel (top: 10px)      │  ~60-80px height
│  [Level] [Money] [Exp] [Exp Bar]     │
├─────────────────────────────────────┤
│                                     │
│        3D Game Canvas               │  Full screen (flexible)
│        (Full viewport)              │
│                                     │
├─────────────────────────────────────┤
│  Game Controls (bottom: 80px)      │  ~60px height
│  [Water Select] [CAST Button]      │
├─────────────────────────────────────┤
│  Tab Bar (bottom: 0)                │  ~60px height
│  [Game] [Shop] [Inventory] [Leader] │
└─────────────────────────────────────┘
```

## Ad Placement Options

### Option 1: Top Banner (Recommended)
**Location**: Top of screen, above player info panel
- **Position**: `top: 0`, `left: 0`, `right: 0`
- **Height**: 50px (standard) or 100px (large)
- **Z-index**: 200 (below modals, above game)
- **Player Info**: Move down to `top: 60px` (or `top: 110px` for large banner)

**Pros:**
- Always visible
- Doesn't interfere with gameplay controls
- Standard placement for mobile games
- Less likely to block important UI

**Cons:**
- Pushes player info down
- May cover top of game view

---

### Option 2: Bottom Banner (Above Tab Bar)
**Location**: Above tab bar, below game controls
- **Position**: `bottom: 60px` (above tab bar)
- **Height**: 50px (standard) or 100px (large)
- **Z-index**: 200 (below modals, above game)
- **Game Controls**: Move up to `bottom: 140px` (or `bottom: 190px` for large banner)

**Pros:**
- Doesn't cover top of game view
- Player info stays at top
- Standard bottom placement

**Cons:**
- May interfere with game controls
- Closer to interactive elements (tab bar, buttons)

---

### Option 3: Bottom Banner (Between Controls & Tab Bar)
**Location**: Between game controls and tab bar
- **Position**: `bottom: 60px` (just above tab bar)
- **Height**: 50px
- **Z-index**: 200
- **Game Controls**: Move up to `bottom: 120px` (50px banner + 10px spacing)

**Pros:**
- Minimizes interference
- Clear separation from controls

**Cons:**
- Tight spacing between elements
- May feel cramped on small screens

---

### Option 4: Top Banner (Below Player Info)
**Location**: Below player info panel
- **Position**: `top: 80px` (below player info)
- **Height**: 50px
- **Z-index**: 200

**Pros:**
- Player info stays at very top
- Less intrusive than top banner

**Cons:**
- Pushes game content down more
- Less prominent (may get ignored)

---

## Recommended Solution: **Option 1 (Top Banner)**

### Implementation:
1. **Top Banner Container**
   - Position: `position: fixed; top: 0; left: 0; right: 0; height: 50px; z-index: 200;`
   - Background: Transparent or matching game theme
   - Placeholder div for ad network integration

2. **Player Info Adjustment**
   - Move `#player-info` from `top: 10px` to `top: 60px` (or `top: 110px` for large banner)
   - Maintains visibility and spacing

3. **Responsive Sizing**
   - Mobile: 320x50 (standard banner)
   - Tablet: 728x90 (leaderboard banner) - can use top or bottom
   - Large tablets: Can use both top and bottom if needed

### Code Structure:
```html
<div id="ad-banner-top" class="ad-container">
    <!-- Ad network integration here -->
    <div id="ad-placeholder-top">Ad Space (320x50)</div>
</div>
```

```css
.ad-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 50px;
    z-index: 200;
    background: rgba(26, 26, 46, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
}

#player-info {
    top: 60px; /* Adjusted for 50px banner */
}

/* For large banner (100px) */
.ad-container.large {
    height: 100px;
}

#player-info.with-large-banner {
    top: 110px;
}
```

## Alternative: Bottom Banner (Option 2)

If you prefer bottom placement:

```html
<div id="ad-banner-bottom" class="ad-container bottom">
    <!-- Ad network integration here -->
    <div id="ad-placeholder-bottom">Ad Space (320x50)</div>
</div>
```

```css
.ad-container.bottom {
    top: auto;
    bottom: 60px; /* Above tab bar */
    height: 50px;
}

#ui-controls {
    bottom: 120px; /* Above banner (50px) + tab bar (60px) */
}

#tab-bar {
    bottom: 0; /* Stays at bottom */
}
```

## Considerations

1. **Ad Network**: Which ad network? (Google AdSense, AdMob, Unity Ads, etc.)
2. **Ad Size**: Standard 320x50 or larger 320x100?
3. **Tablet Support**: Different placement/size for tablets?
4. **Hide During Gameplay**: Should ads hide during active fishing (cast → fight → catch)?
5. **Modal Interference**: Ensure ads are below modals (z-index 1000+)

## Next Steps

1. Choose placement option (Recommend: Option 1 - Top Banner)
2. Create ad container HTML structure
3. Add CSS for ad positioning
4. Adjust UI element positions accordingly
5. Add ad network integration code (when ready)
6. Test on mobile and tablet devices







