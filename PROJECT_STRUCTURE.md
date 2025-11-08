# Kitty Creek Fishing Club - Project Structure

## Directory Structure

```
Kitty Creek/
├── index.html              # Main HTML entry point
├── manifest.json           # PWA manifest
├── WATER_EFFECTS_SPEC.md   # Water effects documentation
├── PROJECT_STRUCTURE.md    # This file
│
├── css/
│   └── styles.css          # All CSS styles (separated from HTML)
│
├── src/
│   ├── main.js             # Main game initialization and loop
│   ├── scene.js            # Three.js scene setup
│   ├── camera.js           # Camera positioning and controls
│   ├── water.js            # Water/lake implementation
│   ├── land.js             # Land/shore creation
│   ├── dock.js             # Dock creation (80% water, 20% land)
│   ├── cat.js              # Cat model loading and positioning
│   ├── fishing.js          # Fishing rod, line, bobber, casting
│   ├── physics.js           # Physics calculations
│   ├── fish.js             # Fish system
│   └── ui.js               # UI controls (cast/reel buttons)
│
└── assets/
    ├── cat/
    │   └── cat.glb         # (Not used - see glb folder)
    ├── glb/
    │   ├── PZSNQ3IH66OXPUSBTYNAMD6EC.glb         # Cat character model
    │   └── fishing_rod_rigged_and_animated.glb   # Fishing rod model
    └── icons/
        └── icon.svg         # App icon
```

## File Separation

### HTML (`index.html`)
- Contains only HTML structure
- Links to external CSS and JS files
- No inline styles or scripts
- PWA meta tags and configuration

### CSS (`css/styles.css`)
- All styling rules
- Responsive design for mobile
- Button styles and animations
- Utility classes (.hidden, .visible)

### JavaScript (`src/`)
All JavaScript is modularized into separate files:

- **main.js**: Game initialization and main loop
- **scene.js**: Three.js scene, renderer, lighting setup
- **water.js**: Water shader, wave animations, bounds
- **land.js**: Land/shore geometry
- **dock.js**: Dock geometry and wood texture
- **cat.js**: Cat GLB loading and positioning
- **fishing.js**: Rod attachment, casting, line, bobber
- **physics.js**: Trajectory calculations, gravity, tension
- **fish.js**: Fish spawning and catch mechanics
- **camera.js**: Camera positioning for mobile view
- **ui.js**: Button event handlers and UI logic

## Benefits of Separation

1. **Maintainability**: Easy to find and update specific functionality
2. **Organization**: Clear separation of concerns
3. **Performance**: CSS and JS can be cached separately
4. **Collaboration**: Multiple developers can work on different files
5. **Debugging**: Easier to locate issues in specific files
6. **Mobile Optimization**: Easy to optimize individual components

## Module Imports

All JavaScript modules use ES6 imports/exports:
- Three.js loaded from CDN
- Custom modules import from local `src/` directory
- No global namespace pollution











