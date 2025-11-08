# Water Effects Implementation - Pond Ripples & River Particle Flow

## Date: Current Session

## Overview
Implemented dynamic water effects for dock posts: ripples for pond locations and particle streams for river locations. Both effects create continuous, realistic water movement around dock posts.

---

## 1. Pond Dock Post Ripples

### Location
- **File**: `src/water2.js`
- **Method**: `createDockPostSplashes()`
- **Update Method**: `update()` (lines ~857-922)

### Purpose
Create animated ripple rings around dock posts for pond locations. Ripples expand outward from posts and dissipate, creating a natural water disturbance effect.

### Implementation Details

#### Creation (`createDockPostSplashes()`)
- **Post Positions**: Uses 4 post positions from pond dock (2 front, 2 back)
  - World positions: `dockWorldZ = -1.5` (dock center in world space)
  - Front posts: `z = dockWorldZ + dockDepth * 0.35`
  - Back posts: `z = dockWorldZ - dockDepth * 0.35`
  - X positions: `±dockWidth * 0.3` (±0.9)

- **Ring Configuration**:
  - 3 rings per post (12 total rings for 4 posts)
  - Base radius: `0.35` (increased from `0.15` for visibility)
  - Ring thickness: `0.20` (increased from `0.08`)
  - Ring spacing: `0.25` (increased from `0.12`)
  - Position height: `this.waterY + 0.05` (above water surface)

- **Material**:
  - Color: `0xccddff` (bright light blue-white)
  - Base opacity: `0.8`
  - Blending: `THREE.AdditiveBlending`
  - Side: `THREE.DoubleSide`
  - `depthWrite: false`

#### Animation (`update()` method)
- **Lifecycle System**:
  - Each ring has independent timing:
    - `baseRadius`: Starting radius (0.35, 0.60, 0.85)
    - `maxRadius`: Maximum expansion (`baseRadius + 0.8`)
    - `startTime`: Random offset (0-5 seconds) for sporadic appearance
    - `lifetime`: Random duration (2.5-4.5 seconds)
    - `fadeStart`: 0.6 (fade begins at 60% of lifetime)

- **Expansion**:
  - One-way outward expansion (no oscillation)
  - Ease-out curve: `1.0 - Math.pow(1.0 - progress, 2)`
  - Radius: `baseRadius + (maxRadius - baseRadius) * expansionProgress`

- **Dissipation**:
  - Full opacity until 60% of lifetime
  - Linear fade from 1.0 to 0.0 during remaining 40%
  - Final opacity scaled to max 0.9

- **Rotation**:
  - Slow, subtle rotation: `Math.sin(time * 0.3 + baseRadius) * 0.05`

- **Reset Behavior**:
  - Rings automatically reset after lifetime using modulo: `(time - startTime) % lifetime`
  - Creates continuous loop of expanding/dissipating ripples

### Visibility
- Only visible when `waterBodyType === 'POND'`
- Visibility checked and enforced every frame in `update()` method
- Created during `create()` method and added to scene

---

## 2. River Dock Post Particle Stream

### Location
- **File**: `src/water2.js`
- **Method**: `createDockPostParticles()`
- **Update Method**: `update()` (lines ~924-1020)

### Purpose
Create continuous stream of particles flowing from dock posts downstream with river current. Particles emit from posts and flow left-to-right on screen.

### Implementation Details

#### Creation (`createDockPostParticles()`)
- **Particle Count**: 50 total particles
- **Post Positions**: Uses 8 river dock post positions
  - More particles spawned from front posts (water side)
  - Distribution weighted toward posts closest to water

- **Initial Setup**:
  - Particles start at random post positions with small random offsets
  - Colors: Random white/grey shades (brightness 0.6-1.0)
  - Vertex colors enabled for color variation

- **Material**:
  - Size: `0.8`
  - Opacity: `0.4`
  - `vertexColors: true`
  - Blending: `THREE.AdditiveBlending`
  - `fog: false` (for visibility)

- **Lifecycle Tracking**:
  - `spawnTimes`: Float32Array tracking when each particle spawned
  - `lifetimes`: Float32Array with random lifetime (2.0-2.5 seconds per particle)

#### Animation (`update()` method)
- **Flow Direction**: Left-to-right on screen (`flowDirection = (-1, 0)`)
- **Particle Movement**:
  - Velocity-based position updates
  - Base speed: `0.4 + Math.random() * 0.3`
  - Gentle Y-axis bobbing: `Math.sin(this.time * 1.5 + i) * 0.03`

- **Lifetime-Based Respawn**:
  - Each particle has individual lifetime (2.0-2.5 seconds)
  - When `particleAge >= particleLifetime`, particle respawns at random post
  - `spawnTimes[i]` updated to current time on respawn
  - Ensures continuous stream (particles never "run out")

- **Respawn Logic** (`respawnParticle()`):
  - Position: Random post with small offset (`0.08 + Math.random() * 0.04`)
  - Random angle for offset distribution
  - Velocity reset with flow direction
  - Spawn time and lifetime reset

- **Initialization**:
  - On first update, stagger spawn times: `currentTime - Math.random() * 2.5`
  - Prevents all particles from spawning simultaneously

### Visibility
- Only visible when `waterBodyConfig.hasFlow === true` (RIVER type)
- Visibility forced to `true` if hidden but should be visible
- Particles continuously respawn for endless stream

---

## 3. Integration Points

### Water Type Switching
- **Method**: `setWaterBodyType(type)` in `water2.js`
- **Pond Splashes**: `this.dockPostSplashes.visible = (type === 'POND')`
- **River Particles**: `this.dockPostParticles.visible = (this.waterBodyConfig.hasFlow === true)`

### Platform System
- **File**: `src/platform.js`
- Pond dock has 4 posts (positions used by splash system)
- River dock has 8 posts (positions used by particle system)
- Post positions stored in `postPositions` array in `createDock()`

### Update Loop
- **File**: `src/main.js`
- `this.water.update(delta)` called in `animate()` method
- Ensures continuous animation of both effects

---

## 4. Key Design Decisions

### Pond Ripples
1. **One-way expansion**: Chose outward-only expansion over oscillation for realism
2. **Lifecycle system**: Independent timing per ring prevents synchronized patterns
3. **Size adjustments**: Increased dimensions multiple times for visibility above dock
4. **Height positioning**: Set to `waterY + 0.05` to ensure visibility above dock surface

### River Particles
1. **Lifetime-based respawn**: More reliable than distance-based for continuous flow
2. **Vertex colors**: Allows white/grey variation for natural appearance
3. **Weighted distribution**: More particles from front posts (visible water side)
4. **Lifetime range**: 2.0-2.5 seconds provides good visual density without overcrowding

---

## 5. Iterations & Refinements

### Pond Ripples
1. **Initial**: Oscillating rings with synchronized timing (too rhythmic)
2. **Independent timing**: Added separate phases for expansion/opacity (still too synchronized)
3. **Lifecycle system**: Switched to outward expansion with dissipation
4. **Size increases**: Multiple iterations (0.15 → 0.20 → 0.35)
5. **Visibility fixes**: Height adjustment, opacity increases, brightness improvements

### River Particles
1. **Initial**: Distance-based respawn (particles would stop)
2. **Screen-edge respawn**: Added fallback for off-screen particles
3. **Lifetime system**: Switched to time-based respawn (more reliable)
4. **Continuous flow**: Removed `hasFlow` from update condition to ensure always runs
5. **Particle visibility**: Increased count, size, opacity for better visibility

---

## 6. Configuration Values

### Pond Ripples (Current)
```javascript
baseRadius: 0.35
ringThickness: 0.20
ringSpacing: 0.25
maxRadius: baseRadius + 0.8
startTime: Math.random() * 5.0
lifetime: 2.5 + Math.random() * 2.0
fadeStart: 0.6
positionY: this.waterY + 0.05
materialOpacity: 0.8 (base)
materialColor: 0xccddff
```

### River Particles (Current)
```javascript
particleCount: 50
particleSize: 0.8
particleOpacity: 0.4
baseSpeed: 0.4 + Math.random() * 0.3
lifetime: 2.0 + Math.random() * 0.5
spawnOffset: 0.08 + Math.random() * 0.04
```

---

## 7. Future Considerations

### Potential Enhancements
1. **Pond Ripples**:
   - Add occasional "bigger" ripples (larger maxRadius)
   - Wind-based direction variation
   - Interaction with bobber/cat if nearby

2. **River Particles**:
   - Speed variation based on distance from post (faster near post, slower downstream)
   - Foam/turbulence particles for more complex flow
   - Particles that briefly "pop" above surface for splashes

3. **Performance**:
   - Consider instanced rendering for particles if count increases
   - LOD system for distant particles
   - Particle pooling for better memory management

---

## 8. Testing Notes

### Verified Behavior
- ✅ Pond ripples expand outward and dissipate
- ✅ Ripples appear sporadically (independent timing)
- ✅ River particles flow continuously left-to-right
- ✅ Particles respawn after 2-2.5 seconds
- ✅ Visibility correctly switches with water type changes
- ✅ No performance issues with current particle/ring counts

### Known Issues
- None currently

---

## 9. Related Files

### Modified Files
- `src/water2.js` - Main implementation
  - `createDockPostSplashes()` (lines ~156-242)
  - `createDockPostParticles()` (lines ~244-342)
  - `update()` method (lines ~857-922 for splashes, ~924-1020 for particles)
  - `setWaterBodyType()` (lines ~414-419 for visibility control)

### Referenced Files
- `src/platform.js` - Dock post positions
- `src/main.js` - Update loop integration
- `src/water/waterBodyTypes.js` - Water type configurations

---

## 10. Code References

### Key Sections in `src/water2.js`
- **Constructor**: Line 51 - `this.dockPostSplashes = null;`
- **Constructor**: Line 52 - `this.dockPostParticles = null;`
- **Constructor**: Line 53 - `this.time = 0;` (time accumulator)
- **Create Method**: Line 598 - `this.createDockPostSplashes();`
- **Create Method**: Line 599 - `this.createDockPostParticles();`
- **Update Method**: Line 791 - `this.time = (this.time || 0) + delta;`

---

*Documentation created: Current Session*
*Last updated: Current Session*










