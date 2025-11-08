import * as THREE from 'three';

export class FishingRope {
    constructor(scene, rodTipGetter, bobber, water, castBounds) {
        this.sceneRef = scene;
        this.getRodTip = rodTipGetter; // Function that returns rod tip Object3D
        this.bobber = bobber;
        this.water = water;
        this.castBounds = castBounds;
        
        this.ROPE_SEGMENTS = 12;
        this.rope = [];
        this.ropeLen = 4;
        this.GRAVITY = new THREE.Vector3(0, -9.8, 0);
        
        // Tunables (feel controls) - stabilized pack
        this.SUBSTEPS = 5;              // 4-6 is good
        this.ITER_POS = 10;              // constraint iterations per substep
        this.AIR_DRAG = 0.993;           // during flight
        this.WATER_DRAG = 0.88;          // linear damping once floating (heavy)
        this.QUAD_WATER = 1.8;           // quadratic XZ drag coeff (adds a lot of calm)
        this.USE_GRAVITY_WHEN_FLOATING = false; // keep false; surface handles Y
        this.REEL_RATE = 10.0;           // m/s shortening (fast-paced reeling)
        this.FIGHT_REEL_RATE = 5.0;      // m/s shortening when fighting/tired fish (half of normal reel speed)
        this.REEL_LERP = 0.35;           // ease ropeLen toward target (faster response)
        this.MAX_HORIZ_VEL = 8.0;        // clamp m/s for last node (allow faster movement during reel)
        this.BEND_STIFFNESS = 0.22;      // 0..0.4 (higher = straighter line)
        this.LAND_FREEZE_TIME = 0.22;    // seconds of strong damping after touchdown
        this.LAND_DRAG_FACTOR = 0.80;
        this.ARC_SCALE = 0.10;          // cast arc height scalar
        
        this.floating = false;
        this.reeling = false;
        this.flying = false;
        this.fightingMode = false; // True when fighting a fish
        this.landingMode = false; // True when fish is landing
        this._landingSpring = 0; // 0..1
        
        this.lineMesh = null;
        
        this.create();
    }
    
    // Simple rope node
    makeNode(x = 0, y = 0, z = 0, invMass = 1) {
        return {
            pos: new THREE.Vector3(x, y, z),
            prev: new THREE.Vector3(x, y, z),
            invMass: invMass
        };
    }
    
    // Create rope using current tip->bobber distance
    create() {
        const rodTip = this.getRodTip();
        if (!rodTip || !this.bobber) return;
        
        const a = rodTip.getWorldPosition(new THREE.Vector3());
        const b = this.bobber.position.clone();
        
        // Use existing ropeLen if valid, otherwise calculate from positions
        if (this.ropeLen < 0.1) {
            this.ropeLen = Math.max(a.distanceTo(b), 1.0); // Minimum 1.0 length
        }
        
        const segLen = this.ropeLen / this.ROPE_SEGMENTS;
        const dir = b.clone().sub(a);
        const dist = dir.length();
        
        // Only normalize if distance is valid
        if (dist > 0.001) {
            dir.normalize();
        } else {
            dir.set(0, 0, -1); // Default direction if too close
        }
        
        this.rope = [];
        for (let i = 0; i <= this.ROPE_SEGMENTS; i++) {
            const p = a.clone().addScaledVector(dir, segLen * i);
            // First node is fixed (invMass=0)
            const n = this.makeNode(p.x, p.y, p.z, i === 0 ? 0 : 1);
            // Initialize with zero velocity (prev = pos)
            n.prev.copy(n.pos);
            this.rope.push(n);
        }
        
        // Create line mesh if not exists
        this.ensureLineMesh();
    }
    
    ensureLineMesh() {
        if (this.lineMesh) return;
        
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5
        });
        const geom = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(),
                new THREE.Vector3(),
                new THREE.Vector3()
            ]),
            48,
            0.008, // Thin fishing line (reduced from 0.025 to look like actual fishing line)
            6,
            false
        );
        
        this.lineMesh = new THREE.Mesh(geom, mat);
        this.lineMesh.frustumCulled = false;
        this.lineMesh.renderOrder = 9; // After water
        this.sceneRef.scene.add(this.lineMesh);
    }
    
    // Substepped solver: integrate, constraints, bending, surface pin, clamps
    substep(dtSub, t) {
        // During hook freeze period, sync prev positions to prevent physics "correction"
        // Decrement freeze time (will be decremented once per substep, but that's fine)
        if (this._hookFreezeTime !== undefined && this._hookFreezeTime > 0) {
            // Note: freeze time is decremented in reelUpdate() per frame, not per substep
            const last = this.rope[this.rope.length - 1];
            const prev = this.rope.length > 1 ? this.rope[this.rope.length - 2] : null;
            
            // Sync prev positions to current - tells physics "nothing moved"
            last.prev.x = last.pos.x;
            last.prev.y = last.pos.y;
            last.prev.z = last.pos.z;
            
            if (prev) {
                prev.prev.x = prev.pos.x;
                prev.prev.y = prev.pos.y;
                prev.prev.z = prev.pos.z;
            }
            
            // Still need to anchor first node to rod tip
            const rodTip = this.getRodTip();
            if (rodTip) {
                const tipWorld = rodTip.getWorldPosition(new THREE.Vector3());
                this.rope[0].pos.copy(tipWorld);
            }
            
            return; // Skip all other physics during freeze
        }
        
        // Integrate
        for (let i = 0; i < this.rope.length; i++) {
            const n = this.rope[i];
            if (n.invMass === 0) continue; // Fixed node
            
            // Velocity from Verlet
            let vel = n.pos.clone().sub(n.prev);
            
            if (this.flying) {
                vel.multiplyScalar(this.AIR_DRAG);
                n.prev.copy(n.pos);
                n.pos.add(vel).addScaledVector(this.GRAVITY, dtSub * dtSub * 0.5);
            } else {
                // In water: heavy linear damping
                vel.multiplyScalar(this.WATER_DRAG);
                
                // Quadratic XZ drag to stop whipping (F ~ v|v|)
                // Reduce drag while reeling to allow faster movement
                const quadDrag = this.reeling ? this.QUAD_WATER * 0.6 : this.QUAD_WATER; // 40% reduction while reeling
                const vXZ = new THREE.Vector3(vel.x, 0, vel.z);
                const speed = vXZ.length() / dtSub;
                if (speed > 1e-6) {
                    const dragMag = quadDrag * speed * speed * dtSub; // units match integration
                    const drag = vXZ.clone().normalize().multiplyScalar(Math.min(dragMag, speed * 0.9) * dtSub);
                    vel.x -= drag.x;
                    vel.z -= drag.z;
                }
                
                // Extra landing damping window
                if (this.bobber.userData && this.bobber.userData.freeze > 0) {
                    vel.multiplyScalar(this.LAND_DRAG_FACTOR);
                }
                
                n.prev.copy(n.pos);
                
                // Gravity off while floating to avoid pumping; surface handles Y
                if (this.USE_GRAVITY_WHEN_FLOATING) {
                    n.pos.add(vel).addScaledVector(this.GRAVITY, dtSub * dtSub * 0.5);
                } else {
                    n.pos.add(vel);
                }
            }
        }
        
        // Constraints: keep 1st at tip, then distance constraints
        const segLen = this.ropeLen / this.ROPE_SEGMENTS;
        const rodTip = this.getRodTip();
        if (rodTip) {
            const tipWorld = rodTip.getWorldPosition(new THREE.Vector3());
            this.rope[0].pos.copy(tipWorld);
            this.rope[0].prev.copy(tipWorld);
        }
        
        for (let it = 0; it < this.ITER_POS; it++) {
            // Segment lengths
            for (let i = 0; i < this.rope.length - 1; i++) {
                const a = this.rope[i];
                const b = this.rope[i + 1];
                
                const delta = b.pos.clone().sub(a.pos);
                const dist = Math.max(1e-6, delta.length());
                const diff = (dist - segLen) / dist;
                const inv = a.invMass + b.invMass;
                
                if (!inv) continue;
                
                const corr = delta.multiplyScalar(diff);
                if (a.invMass) {
                    a.pos.addScaledVector(corr, a.invMass / inv * 0.5);
                }
                if (b.invMass) {
                    b.pos.addScaledVector(corr, -b.invMass / inv * 0.5);
                }
            }
            
            // Light bending to suppress whip
            for (let i = 1; i < this.rope.length - 1; i++) {
                const A = this.rope[i - 1].pos;
                const B = this.rope[i].pos;
                const C = this.rope[i + 1].pos;
                
                const ab = B.clone().sub(A).normalize();
                const cb = B.clone().sub(C).normalize();
                const bend = ab.add(cb).multiplyScalar(0.5 * this.BEND_STIFFNESS);
                if (this.rope[i].invMass) {
                    B.sub(bend);
                }
            }
            
            // Keep last on surface + clamp horizontal speed
            if (this.floating && this.rope.length > 0) {
                const last = this.rope[this.rope.length - 1];
                
                // During HOOKED_FIGHT, let fish drive the position - don't apply velocity clamping
                // The fish position is synced in fishing.update() before this runs
                const fishInstance = this.sceneRef?.fish;
                const fishState = fishInstance?.getState?.() ?? -1;
                
                // During freeze period, don't apply any physics - bobber stays exactly where it is
                const isFreezePeriod = this._hookFreezeTime !== undefined && this._hookFreezeTime > 0;
                if (isFreezePeriod && this.reeling && this.fightingMode) {
                    // During freeze, don't move anything - keep bobber in place
                    // Just ensure position matches bobber exactly
                    last.pos.x = this.bobber.position.x;
                    last.pos.z = this.bobber.position.z;
                    last.pos.y = this.bobber.position.y;
                    last.prev.x = last.pos.x;
                    last.prev.z = last.pos.z;
                    last.prev.y = last.pos.y;
                    return; // Skip all other physics during freeze
                }
                
                if (fishState === 1 && this.reeling && this.fightingMode) {
                    // During active fight, fish drives position - just project to surface
                    const waterHeight = this.water.getWaterHeight(last.pos.x, last.pos.z);
                    last.pos.y = waterHeight + 0.12;
                    // Keep prev matching pos to prevent velocity from fighting fish
                    last.prev.x = last.pos.x;
                    last.prev.z = last.pos.z;
                    last.prev.y = last.pos.y;
                } else {
                    // Normal behavior: clamp XZ speed (allow faster movement during reeling)
                    const velXZ = last.pos.clone().sub(last.prev);
                    velXZ.y = 0; // XZ only
                    const spd = velXZ.length() / dtSub;
                    // Increase velocity cap by 50% while reeling (allow faster movement)
                    const maxVel = this.reeling ? this.MAX_HORIZ_VEL * 1.5 : this.MAX_HORIZ_VEL;
                    if (spd > maxVel) {
                        velXZ.setLength(maxVel * dtSub);
                        last.pos.x = last.prev.x + velXZ.x;
                        last.pos.z = last.prev.z + velXZ.z;
                    }
                    
                    // Project Y to surface
                    const waterHeight = this.water.getWaterHeight(last.pos.x, last.pos.z);
                    last.pos.y = waterHeight + 0.12;
                }
            }
        }
        
        // Decay freeze timer
        if (this.bobber.userData && this.bobber.userData.freeze > 0) {
            this.bobber.userData.freeze -= dtSub;
            if (this.bobber.userData.freeze < 0) {
                this.bobber.userData.freeze = 0;
            }
        }
    }
    
    // Main rope step with substeps
    stepRope(dt, t) {
        const h = dt / this.SUBSTEPS;
        for (let i = 0; i < this.SUBSTEPS; i++) {
            this.substep(h, t);
        }
    }
    
    // Gentle, non-elastic rope length changes while reeling
    reelUpdate(dt) {
        if (!this.reeling) return;
        
        // Skip rope length changes during hook freeze period to prevent snap
        // Use fish's freeze timer as source of truth (sync with rope timer)
        const fishInstance = this.sceneRef?.fish;
        const fishFreezeTime = fishInstance?._hookFreezeTime ?? 0;
        
        if (this._hookFreezeTime !== undefined && this._hookFreezeTime > 0) {
            // Sync with fish timer to keep them in sync
            if (fishFreezeTime > 0) {
                this._hookFreezeTime = fishFreezeTime;
            } else {
                this._hookFreezeTime = 0;
            }
            return; // Don't shorten rope during freeze
        }
        
        const tip = this.rope[0].pos;
        const last = this.rope[this.rope.length - 1].pos;
        
        const straight = tip.distanceTo(last);
        // Use slower rate when fighting fish
        const reelRate = this.fightingMode ? this.FIGHT_REEL_RATE : this.REEL_RATE;
        // Allow rope to get very close during landing
        // The fishing.js updateReel() handles the actual minimum, but we should allow it here too
        const minLen = (this.landingMode && !this.fightingMode) ? 0.1 : 0.6;
        // Don't shorten rope faster - keep normal speed, let horizontal pull do the work
        const targetLen = Math.max(minLen, straight - reelRate * dt);
        
        // Simple rope length shortening - actual reel logic is in fishing.updateReel()
        this.ropeLen = THREE.MathUtils.lerp(this.ropeLen, targetLen, this.REEL_LERP);
    }
    
    // Clamp the last node to safe water bounds
    ropeClampLast() {
        const last = this.rope[this.rope.length - 1].pos;
        last.x = THREE.MathUtils.clamp(
            last.x,
            this.castBounds.xMin,
            this.castBounds.xMax
        );
        last.z = THREE.MathUtils.clamp(
            last.z,
            this.castBounds.zMin,
            this.castBounds.zMax
        );
    }
    
    // Clamp last node to visible screen area (belt & suspenders safety)
    ropeClampLastToScreen(camera, margin = 0.08) {
        const last = this.rope[this.rope.length - 1].pos;
        const waterY = this.water.waterY;
        
        // Project to NDC
        const ndc = last.clone().project(camera);
        ndc.x = THREE.MathUtils.clamp(ndc.x, -1 + margin, 1 - margin);
        ndc.y = THREE.MathUtils.clamp(ndc.y, -1 + margin, 1 - margin);
        
        // Unproject back to world at y = waterY
        const rayStart = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera);
        const dir = rayStart.clone().sub(camera.position).normalize();
        const t = (waterY - camera.position.y) / dir.y;
        const hit = camera.position.clone().addScaledVector(dir, Math.max(t, 0));
        
        last.x = hit.x;
        last.z = hit.z;
        
        if (this.floating) {
            last.y = this.water.getWaterHeight(last.x, last.z) + 0.12;
        }
    }
    
    // Drive bobber from rope (cheap and stable)
    syncBobberFromRope(t) {
        const end = this.rope[this.rope.length - 1].pos;
        // Copy X and Z from rope, but Y will be set based on state (tug can override)
        this.bobber.position.x = end.x;
        this.bobber.position.z = end.z;
        
        if (this.floating) {
            const waterHeight = this.water.getWaterHeight(end.x, end.z);
            
            // Check if fish is hooked (no tug during idle)
            const isHooked = this.bobber.userData.isHooked || false;
            
            // Store water level for tug function
            this.bobber.userData.waterLevel = waterHeight;
            
            if (!isHooked) {
                // Idle bounce - more pronounced floating animation with partial submersion
                // t is elapsedTime from clock, so we can use it directly
                const bounceTime1 = t * 2.7; // Primary bounce
                const bounceTime2 = t * 1.5; // Secondary slower bounce for variation
                const bounceTime3 = t * 0.8; // Gentle downward pull cycle
                
                // Combined bounce with multiple frequencies for natural motion
                const bounce1 = Math.sin(bounceTime1) * 0.03; // Main bounce (larger)
                const bounce2 = Math.sin(bounceTime2) * 0.015; // Secondary bounce
                const pullDown = Math.sin(bounceTime3) * 0.02; // Gentle downward pull (slow cycle)
                
                // Partially submerged - bobber sits in water with bounce
                // Base position: partially submerged (waterHeight + 0.06), then add bounce
                const baseY = waterHeight + 0.06; // Partially submerged (half in water)
                const combinedBounce = bounce1 + bounce2;
                const totalY = baseY + combinedBounce + pullDown * 0.3; // Add gentle pull-down effect
                
                this.bobber.position.y = totalY;
            } else {
                // When hooked: check for active tug first, then apply base submerged position
                // If tug is active, blend tug position with base position for smooth pop effect
                let tugOffset = 0;
                if (this.bobber.userData.tugActive && this.bobber.userData.tugTime > 0) {
                    // Active tug - pull down much more dramatically with randomized fade
                    // Get original tug duration (stored when tug was created, or default to 0.25)
                    const tugDuration = this.bobber.userData.tugDuration || 0.25;
                    const tugProgress = this.bobber.userData.tugTime / tugDuration; // Fade from 1 to 0 (matches actual tug duration)
                    // Add slight randomization to fade curve for sporadic feel
                    const randomFade = 0.8 + Math.random() * 0.4; // Random fade between 0.8-1.2
                    tugOffset = -this.bobber.userData.tugAmp * tugProgress * randomFade; // Pull down dramatically, fading over time
                }
                
                // Get fish weight to scale bobber visibility dynamically
                // Bigger fish = bobber stays submerged more, only surfaces occasionally
                let fishWeight = 2.0; // Default to small fish weight if not available
                const fishInstance = this.sceneRef?.fish;
                if (fishInstance?.currentFish?.weight) {
                    fishWeight = fishInstance.currentFish.weight;
                }
                
                // Scale bobber behavior based on fish size
                // Small fish (1-3 lbs): bobber visible often (current behavior is perfect)
                // Medium fish (3-6 lbs): bobber visible less often
                // Big fish (6-10 lbs): bobber rarely visible (mostly submerged)
                // Trophy fish (10+ lbs): bobber almost always submerged, only surface every 2-3 seconds
                
                // Calculate resurface parameters based on fish weight
                // Scale smoothly from small fish (visible often) to huge fish (never visible)
                // Use exponential scaling so bigger fish are MUCH less visible
                
                // For fish under 3 lbs: visible often (current behavior is perfect)
                // For fish 3-10 lbs: visible much less
                // For fish 10-50 lbs: rarely visible
                // For fish 50-100 lbs: very rarely visible
                // For fish 100+ lbs: essentially never visible
                
                let resurfaceChance = 0.15; // Base chance (for small fish)
                let resurfaceInterval = 1.0; // Base interval between surfacing attempts (seconds)
                
                if (fishWeight < 3.0) {
                    // Small fish (1-3 lbs): bobber visible often (current behavior is perfect)
                    resurfaceChance = 0.15; // 15% chance when conditions are met
                    resurfaceInterval = 0.8; // Can try to surface every ~0.8 seconds
                } else if (fishWeight < 6.0) {
                    // Medium fish (3-6 lbs): bobber visible much less often
                    resurfaceChance = 0.05; // 5% chance (reduced from 8%)
                    resurfaceInterval = 2.5; // Try to surface every ~2.5 seconds (increased from 1.5)
                } else if (fishWeight < 10.0) {
                    // Big fish (6-10 lbs): bobber rarely visible
                    resurfaceChance = 0.02; // 2% chance (reduced from 4%)
                    resurfaceInterval = 4.0; // Try to surface every ~4 seconds (increased from 2.5)
                } else if (fishWeight < 50.0) {
                    // Large fish (10-50 lbs): bobber very rarely visible
                    resurfaceChance = 0.01; // 1% chance
                    resurfaceInterval = 6.0; // Try to surface every ~6 seconds
                } else if (fishWeight < 100.0) {
                    // Huge fish (50-100 lbs): bobber almost never visible
                    resurfaceChance = 0.005; // 0.5% chance (extremely rare)
                    resurfaceInterval = 10.0; // Try to surface every ~10 seconds
                } else {
                    // Massive fish (100+ lbs): bobber essentially never visible
                    resurfaceChance = 0.001; // 0.1% chance (practically never)
                    resurfaceInterval = 20.0; // Try to surface every ~20 seconds (essentially never)
                }
                
                // Track time since last resurface attempt (stored in bobber userData)
                // Initialize timer if needed
                if (this.bobber.userData.lastResurfaceAttempt === undefined) {
                    this.bobber.userData.lastResurfaceAttempt = 0;
                    this.bobber.userData.lastFrameTime = t;
                }
                
                // Calculate delta time since last frame
                const deltaTime = t - (this.bobber.userData.lastFrameTime || t);
                this.bobber.userData.lastFrameTime = t;
                
                // Accumulate time since last resurface attempt
                this.bobber.userData.lastResurfaceAttempt += deltaTime;
                
                // Only attempt to resurface if enough time has passed
                const canAttemptResurface = this.bobber.userData.lastResurfaceAttempt >= resurfaceInterval;
                
                // Base submerged position - bobber stays under water most of the time
                // Use multiple randomized cycles for sporadic, chaotic movement
                const fightTime = t * (2.0 + Math.random() * 2.0); // Randomized cycle speed (2.0-4.0) for sporadic timing
                const submergeCycle = Math.sin(fightTime * (0.5 + Math.random() * 0.5)); // Random cycle frequency (0.5-1.0)
                
                // Base position: deeply below surface most of the time
                // Submersion depth increases exponentially with fish size
                // Scale smoothly from small to huge fish
                let submergeDepth = 0.12; // Base depth
                let baseSubmergePercent = 0.85; // Base percentage (85% submerged)
                
                if (fishWeight < 3.0) {
                    // Small fish: current behavior (85-100% submerged)
                    submergeDepth = 0.12;
                    baseSubmergePercent = 0.85;
                } else if (fishWeight < 6.0) {
                    // Medium fish: deeper submersion (92-100% submerged)
                    submergeDepth = 0.15;
                    baseSubmergePercent = 0.92;
                } else if (fishWeight < 10.0) {
                    // Big fish: very deep submersion (96-100% submerged)
                    submergeDepth = 0.18;
                    baseSubmergePercent = 0.96;
                } else if (fishWeight < 50.0) {
                    // Large fish: extremely deep submersion (98-100% submerged)
                    submergeDepth = 0.20;
                    baseSubmergePercent = 0.98;
                } else if (fishWeight < 100.0) {
                    // Huge fish: maximum submersion (99-100% submerged)
                    submergeDepth = 0.22;
                    baseSubmergePercent = 0.99;
                } else {
                    // Massive fish (100+ lbs): deepest possible submersion (99.5-100% submerged)
                    submergeDepth = 0.24;
                    baseSubmergePercent = 0.995; // Essentially always submerged
                }
                
                // Rare resurfacing - only occasionally pop up
                // Bigger fish: less frequent resurfacing attempts
                let resurfaceAmount = 0;
                if (canAttemptResurface && submergeCycle > 0.4 && Math.random() < resurfaceChance) {
                    // Rare pop to surface - when it happens, make it dramatic
                    resurfaceAmount = (submergeCycle - 0.4) * 0.15; // Larger pops when they do happen
                    // Add randomization to pop height for sporadic feel
                    resurfaceAmount *= (0.7 + Math.random() * 0.6); // Random variation 0.7-1.3x
                    // Reset timer after successful resurface attempt
                    this.bobber.userData.lastResurfaceAttempt = 0;
                }
                
                // Keep it submerged most of the time, rarely surface (percentage increases with fish size)
                // Base submersion is deeper and more consistent for bigger fish
                const baseSubmerge = submergeDepth * (baseSubmergePercent + (1.0 - baseSubmergePercent) * Math.max(0, -submergeCycle));
                
                // Add slight random depth variation for sporadic underwater movement
                const randomDepthJitter = (Math.random() - 0.5) * 0.03; // Small random jitter ±0.03 units
                
                // Combine base submerged position with tug offset and jitter for sporadic movement
                this.bobber.position.y = waterHeight - baseSubmerge + resurfaceAmount + tugOffset + randomDepthJitter;
            }
        }
        
        // Make bobber visible if rope is active
        if (this.rope.length > 0) {
            this.bobber.visible = true;
        }
    }
    
    // Nudge bobber horizontally - helper for reel progress
    nudgeBobberXZ(dx, dz) {
        const last = this.rope[this.rope.length - 1];
        last.pos.x += dx;
        last.pos.z += dz;
        // also bias previous point a touch so the solver doesn't yank it back
        if (this.rope.length > 1) {
            const prev = this.rope[this.rope.length - 2];
            prev.pos.x += dx * 0.35;
            prev.pos.z += dz * 0.35;
        }
    }
    
    // Get rod tip world position for fish update
    getRodTipWorld() {
        const rodTip = this.getRodTip();
        if (rodTip) {
            return rodTip.getWorldPosition(new THREE.Vector3());
        }
        return null;
    }
    
    // Get bobber position from rope
    getBobberPos() {
        if (this.rope.length > 0) {
            return this.rope[this.rope.length - 1].pos.clone();
        }
        return null;
    }
    
    // Update line geometry from rope points (with safe mode for floating)
    updateLineGeometry(dt = 0) {
        if (!this.lineMesh || this.rope.length < 2) return;
        
        const rodTip = this.getRodTip();
        if (!rodTip) return;
        
        // Always ensure first rope node is pinned to current rod tip position
        const tipWorld = rodTip.getWorldPosition(new THREE.Vector3());
        if (!this.rope[0] || !this.rope[0].pos) return;
        
        this.rope[0].pos.copy(tipWorld);
        if (this.rope[0].prev) {
            this.rope[0].prev.copy(tipWorld);
        }
        
        const tip = rodTip.getWorldPosition(new THREE.Vector3());
        const lastNode = this.rope[this.rope.length - 1];
        if (!lastNode || !lastNode.pos) return;
        
        const end = lastNode.pos.clone();
        
        // Validate that tip and end are valid Vector3 objects
        if (!tip || !end || !isFinite(tip.x) || !isFinite(end.x)) return;
        
        try {
            if (this.lineMesh.geometry) {
                this.lineMesh.geometry.dispose();
            }
            
            if (this.flying) {
                // During flight: simple 3-point curve with dynamic sag based on speed
                if (!lastNode.prev) return;
                const speed = dt > 1e-6 ? lastNode.pos.distanceTo(lastNode.prev) / dt : 12.0;
                // Sag is minimal at high speed, increases as speed drops
                const sagFactor = THREE.MathUtils.clamp(0.02 + (1.0 - Math.min(speed / 12, 1)) * 0.25, 0.02, 0.27);
                
                const mid = tip.clone().lerp(end, 0.5);
                mid.y -= sagFactor * tip.distanceTo(end);
                
                const curve = new THREE.CatmullRomCurve3([tip, mid, end], false, 'catmullrom', 0.5);
                this.lineMesh.geometry = new THREE.TubeGeometry(curve, 48, 0.008, 6, false); // Thin fishing line
            } else if (this.floating && !this.fightingMode && !this.landingMode) {
                // Floating/idle: use smooth curve with fixed sag (slack line)
                const mid = tip.clone().lerp(end, 0.5);
                mid.y -= Math.min(1.2, tip.distanceTo(end) * 0.18); // Fixed sag - line is slack
                const curve = new THREE.CatmullRomCurve3([tip, mid, end], false, 'catmullrom', 0.5);
                this.lineMesh.geometry = new THREE.TubeGeometry(curve, 48, 0.008, 6, false); // Thin fishing line
            } else if (this.fightingMode || this.landingMode || (this.reeling && this.fightingMode)) {
                // Fish hooked/fighting/landing: taut line (straight from tip to bobber with minimal sag)
                // Once fish bites, line stays tight all the way until caught
                const mid = tip.clone().lerp(end, 0.5);
                mid.y -= Math.min(0.15, tip.distanceTo(end) * 0.02); // Minimal sag - line is tight
                const curve = new THREE.CatmullRomCurve3([tip, mid, end], false, 'catmullrom', 0.5);
                this.lineMesh.geometry = new THREE.TubeGeometry(curve, 48, 0.008, 6, false); // Thin fishing line
            } else if (this.reeling) {
                // Reeling without fish: use rope points for physics accuracy
                // Filter out any invalid nodes before mapping
                const validRope = this.rope.filter(n => n && n.pos && isFinite(n.pos.x));
                if (validRope.length < 2) return;
                
                const pts = validRope.map(n => n.pos.clone());
                pts[0].copy(tip); // Ensure first point is exactly at rod tip
                const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
                this.lineMesh.geometry = new THREE.TubeGeometry(curve, 64, 0.008, 6, false); // Thin fishing line
            } else {
                // Fallback: use rope points
                const validRope = this.rope.filter(n => n && n.pos && isFinite(n.pos.x));
                if (validRope.length < 2) return;
                
                const pts = validRope.map(n => n.pos.clone());
                pts[0].copy(tip);
                const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
                this.lineMesh.geometry = new THREE.TubeGeometry(curve, 64, 0.008, 6, false); // Thin fishing line
            }
            
            this.lineMesh.visible = true;
        } catch (error) {
            console.warn('Error updating rope line geometry:', error);
        }
    }
    
    setFloating(value) {
        this.floating = value;
    }
    
    setReeling(value) {
        this.reeling = value;
    }
    
    setFlying(value) {
        this.flying = value;
    }
    
    setFightingMode(value) {
        // Reset bobber resurface timer when entering/exiting fight mode
        if (value !== this.fightingMode && this.bobber?.userData) {
            this.bobber.userData.lastResurfaceAttempt = 0;
            this.bobber.userData.lastFrameTime = undefined;
        }
        this.fightingMode = value;
    }
    
    setLandingMode(on) {
        if (on && !this.landingMode) {
            this._landingSpring = 0; // Reset spring when entering landing mode
        }
        this.landingMode = on;
        if (!on) {
            this._landingSpring = 0;
        }
    }
    
    update(dt, camera = null, t = 0) {
        // Skip physics entirely during flight - kinematic line only
        if (this.flying) {
            // Just update line geometry (simple 3-point curve)
            this.updateLineGeometry(dt);
            return;
        }
        
        // Decay tug timer if active (so tug effect persists and fades smoothly)
        if (this.bobber.userData.tugActive && this.bobber.userData.tugTime > 0) {
            this.bobber.userData.tugTime -= dt;
            if (this.bobber.userData.tugTime <= 0) {
                this.bobber.userData.tugActive = false;
                this.bobber.userData.tugTime = 0;
            }
        }
        
        // Normal physics for floating/reeling
        // Order matters: cast drives last node first, then reel, then substeps, then sync, then draw
        this.reelUpdate(dt);
        this.stepRope(dt, t);
        this.ropeClampLast();               // keep world/lake bounds clamp
        
        this.syncBobberFromRope(t);
        this.updateLineGeometry(dt);
    }
}

