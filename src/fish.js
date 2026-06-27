import * as THREE from 'three';
import { applyTug } from './fishing.js';
import { getRandomFishForLocation } from './fishTypes.js';
import {
    STARFISH_APPROACH_DURATION_SEC,
    STARFISH_DRIFT_SPEED,
    STARFISH_HOOK_FREEZE_SEC,
    STARFISH_LANDING_FISH_SPEED,
    STARFISH_PULSE_HZ,
    isStarfishReunionEncounter,
    resolveLocationFishIds
} from './config/starfishEncounter.js';
import { debugLog } from './config/debug.js';
import { getCatchSplashDuration } from './splash.js';

// Minimal fish FSM: IDLE -> HOOKED_FIGHT -> LANDING -> LANDED
export const FishState = {
    IDLE: 'IDLE',
    HOOKED_FIGHT: 'HOOKED_FIGHT',
    LANDING: 'LANDING',
    LANDED: 'LANDED'
};

export class Fish {
    constructor(scene, water, fishing) {
        this.sceneRef = scene;
        this.scene = scene;
        this.water = water;
        this.fishing = fishing;
        
        this.state = FishState.IDLE;
        this.fish = null;
        this.mesh = null;
        this.isHooked = false;
        this.currentFish = null;
        
        // Create test fish mesh
        this.createTestFish();
        this.mesh = this.fish;
        
        this.speedFight = 1.25;             // m/s, not too fast
        this.speedLanding = 3.5;            // controlled homeward pull (slowed for smoother landing)
        this._dir = new THREE.Vector3(1, 0, 0);
        this._dirT = 0;
        this._fightT = 0;
        this._fightDur = 0;
        this._hasTriggeredCaught = false;  // Prevent multiple catch callbacks
        this._gentleReunion = false;
        this._gentlePulseT = 0;
        
        // Play area: fish can move in water area where casts land
        // Match CAST_BOUNDS from fishing.js: zMin = -38, zMax = 38 (allows positive Z)
        // Dock's forward edge is around z=-0.8, fish must stay in front (z >= -0.8)
        this.bounds = { xMin: -38, xMax: 38, zMin: -38, zMax: 38 }; // Match cast bounds
        this.dockZ = -0.8;                 // Dock's forward edge - fish must stay at z >= dockZ (forward)
    }
    
    /**
     * Calculate fight duration based on fish weight
     * @param {number} weight - Fish weight in lbs
     * @returns {number} Fight duration in seconds
     */
    calculateFightDuration(weight) {
        // Slowed down fight durations:
        // Small fish (1-3 lbs): 4-7 seconds (slowed from 2-4)
        // Medium fish (3-4 lbs): 7-10 seconds (slowed from 4-6)
        // Big fish (4-6 lbs): 10-13 seconds (slowed from 6-8)
        // Really big fish (6-10 lbs): 13-16 seconds (slowed from 8-10)
        // Trophy fish (10+ lbs): 16-20 seconds
        
        let baseDuration;
        let randomVariation;
        
        if (weight < 3.0) {
            // Small fish: 4-7 seconds (slowed down)
            baseDuration = 4.0;
            randomVariation = 3.0;
        } else if (weight < 4.0) {
            // Medium fish: 7-10 seconds (slowed down)
            baseDuration = 7.0;
            randomVariation = 3.0;
        } else if (weight < 6.0) {
            // Big fish: 10-13 seconds (slowed down)
            baseDuration = 10.0;
            randomVariation = 3.0;
        } else if (weight < 10.0) {
            // Really big fish: 13-16 seconds (slowed down)
            baseDuration = 13.0;
            randomVariation = 3.0;
        } else {
            // Trophy fish: 16-20 seconds
            baseDuration = 16.0;
            randomVariation = 4.0;
        }
        
        // Add some randomization within the range
        const duration = baseDuration + Math.random() * randomVariation;
        
        // Log fight duration for debugging
        debugLog(`[FISH] Weight: ${weight.toFixed(2)} lbs, Fight duration: ${duration.toFixed(2)}s`);
        
        return duration;
    }
    
    createTestFish() {
        // Create simple test fish geometry
        const geometry = new THREE.ConeGeometry(0.2, 0.6, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff6b6b, // Red fish for testing
            roughness: 0.7,
            metalness: 0.2
        });
        
        this.fish = new THREE.Mesh(geometry, material);
        this.fish.rotation.z = Math.PI / 2; // Point forward
        this.fish.visible = false;
        this.fish.castShadow = true;
        this.sceneRef.scene.add(this.fish);
    }
    
    hook() {
        // Start the simple fight - fish MUST start exactly where bobber currently is
        // This is where the bite happens - fish spawns right at bobber location
        if (!this.mesh || !this.fishing.bobber || !this.fishing.bobber.visible) {
            console.warn('[FISH] Cannot hook - bobber not visible');
            return;
        }
        
        // Get bobber's EXACT world position - use world coords to avoid coordinate space issues
        const bobberWorld = new THREE.Vector3();
        this.fishing.bobber.getWorldPosition(bobberWorld);
        debugLog('[FISH] Hooking at bobber world position:', bobberWorld);
        
        // Position fish EXACTLY at bobber world location (fish bites right where bobber is)
        // Ensure world matrix is updated
        this.fishing.bobber.updateMatrixWorld(true);
        this.mesh.position.copy(bobberWorld);
        this.mesh.updateMatrixWorld(true);
        
        const waterHeight = this.water?.getWaterHeight?.(bobberWorld.x, bobberWorld.z) || 0;
        this.mesh.position.y = waterHeight - 0.25; // Just under water surface
        
        // Trigger water ripple at hook location
        if (this.fishing?.water && this.fishing.water.mesh && this.fishing.water.mesh.splashAt) {
            this.fishing.water.mesh.splashAt(bobberWorld.x, bobberWorld.z);
        }
        
        // Create fish data if not exists (need weight before calculating fight duration)
        // Fallback to test fish if spawnFish hasn't been called
        if (!this.currentFish) {
            // Get available fish from current location
            // Try multiple ways to access game/locations
            let availableFishIds = [0, 1, 2];
            let locations = null;
            let currentLocation = null;
            const player =
                this.fishing?.game?.player ??
                window.game?.player ??
                null;
            
            if (this.fishing?.game?.locations) {
                locations = this.fishing.game.locations;
            } else if (window.game?.locations) {
                locations = window.game.locations;
            }
            
            if (locations) {
                currentLocation = locations.getCurrentLocation();
                availableFishIds = resolveLocationFishIds(currentLocation, player);
            }
            
            if (availableFishIds.length === 0) {
                console.warn('[FISH] No fish available at', currentLocation?.name);
                return;
            }
            
            const playerLevel = player?.level ?? 1;
            
            const fishData = getRandomFishForLocation(availableFishIds, {
                playerLevel,
                location: currentLocation
            });
            if (!fishData) {
                console.warn('[FISH] No fish roll at', currentLocation?.name);
                return;
            }
            
            this.currentFish = {
                id: fishData.id,
                species: fishData.name,
                name: fishData.name,
                fishId: fishData.id,
                rarity: fishData.rarity,
                weight: fishData.weight,
                value: fishData.value,
                experience: fishData.experience,
                season: fishData.season
            };
        }
        
        // Calculate fight duration based on fish weight (or story pacing for Starfish)
        const weight = this.currentFish.weight;
        this._gentleReunion = isStarfishReunionEncounter(this, this.fishing);
        const fightDur = this._gentleReunion
            ? STARFISH_APPROACH_DURATION_SEC
            : this.calculateFightDuration(weight);
        
        // Reset state for fight
        this.state = FishState.HOOKED_FIGHT;
        this._fightT = 0;
        this._fightDur = fightDur;
        this._gentlePulseT = 0;
        this._dirT = 0;
        this.isHooked = true;
        this._hasTriggeredCaught = false;
        this._justHooked = true;
        this._hookFreezeTime = this._gentleReunion ? STARFISH_HOOK_FREEZE_SEC : 0.12;
        
        // Keep fish hidden visually for now (will add proper fish images later)
        this.mesh.visible = false;
        
        // Set hook — second pop + ripple (visualOnly avoids a third synthetic layer on catch)
        if (this.fishing.splash && this.fishing.bobber) {
            if (this._gentleReunion) {
                this.fishing.splash.triggerRipple(this.fishing.bobber.position);
            } else {
                this.fishing.splash.soundManager?.playSplash?.();
                this.fishing.splash.triggerRipple(this.fishing.bobber.position);
                for (let i = 0; i < 2; i++) {
                    setTimeout(() => {
                        if (this.fishing?.splash && this.fishing?.bobber) {
                            this.fishing.splash.triggerRipple(this.fishing.bobber.position);
                        }
                    }, (i + 1) * 100);
                }
            }
        }

        if (this._gentleReunion) {
            const catXZ = this._getCatWorldXZ();
            this._reunionHookPos = new THREE.Vector3(this.mesh.position.x, 0, this.mesh.position.z);
            this._reunionMaxDist = this._reunionHookPos.distanceTo(catXZ);
            debugLog(`[FISH] Starfish reunion — gentle approach for ${this._fightDur}s`, {
                hook: `(${this._reunionHookPos.x.toFixed(1)}, ${this._reunionHookPos.z.toFixed(1)})`,
                home: `(${catXZ.x.toFixed(1)}, ${catXZ.z.toFixed(1)})`,
                maxDist: this._reunionMaxDist.toFixed(1)
            });
        }
    }
    
    startLanding() {
        if (this.state === FishState.LANDED) return;
        // Only transition to LANDING if we were in HOOKED_FIGHT (prevent premature transitions)
        if (this.state === FishState.HOOKED_FIGHT) {
            this.state = FishState.LANDING;
            this._landingStartLogged = false;
            this._lastLandingLogTime = 0;
            debugLog('[FISH] startLanding() called, state set to LANDING');
            if (this._gentleReunion) {
                const castButton = document.getElementById('cast-button');
                if (castButton) {
                    castButton.textContent = 'GUIDING IN...';
                }
            }
        } else {
            console.warn(`[FISH] startLanding() called but state is ${this.state}, not HOOKED_FIGHT`);
        }
    }
    
    markLanded() {
        // Prevent infinite recursion - only execute once
        if (this.state === FishState.LANDED) return;
        
        this.state = FishState.LANDED;
        this.isHooked = true;

        if (this.fishing) {
            this.fishing.isReeling = false;
            this.fishing.setFishOnLine(false);
            if (this.fishing.rope) {
                this.fishing.rope.setReeling(false);
                this.fishing.rope.setFightingMode(false);
                this.fishing.rope.setLandingMode(false);
                this.fishing.rope.setFloating(false);
            }
        }
        
        // Log catch
        if (this.currentFish) {
            let reactionLog = '';
            if (typeof this.fishing?.lastReactionTimeMs === 'number') {
                reactionLog = ` (reaction ${this.fishing.lastReactionTimeMs} ms)`;
            }
            debugLog(`Caught: ${this.currentFish.species} - ${this.currentFish.weight.toFixed(2)} lbs${reactionLog}`);
        }
        
        // Catch celebration splash — bigger for rare fish
        if (this.fishing?.bobber && this.fishing?.splash) {
            const bobberPos = this.fishing.bobber.position.clone();
            const rarity = this.currentFish?.rarity || 'Common';
            const duration = getCatchSplashDuration(rarity);
            this.fishing._didFinalSplash = true;

            if (this.fishing.sfx) {
                const soundBuffer = this.fishing.sfx.cache?.get('fish_caught_splash');
                if (soundBuffer) {
                    this.fishing.sfx.play3D(
                        'fish_caught_splash',
                        bobberPos,
                        this.fishing.sceneRef.scene,
                        0.9,
                        1.0
                    );
                }
            }

            this.fishing.splash.visualOnly(() => {
                this.fishing.splash.triggerBigSplash(bobberPos, duration);
            });

            if (this.fishing?.water?.mesh?.splashAt) {
                this.fishing.water.mesh.splashAt(bobberPos.x, bobberPos.z);
            }

            const bonusRipples = rarity === 'Trophy' || rarity === 'Legendary'
                ? 3
                : (rarity === 'Epic' || rarity === 'Rare' ? 2 : 1);
            for (let i = 0; i < bonusRipples; i++) {
                setTimeout(() => {
                    if (this.fishing?.splash && this.fishing?.bobber) {
                        this.fishing.splash.triggerRipple(this.fishing.bobber.position);
                    }
                    if (this.fishing?.water?.mesh?.splashAt && this.fishing?.bobber) {
                        this.fishing.water.mesh.splashAt(
                            this.fishing.bobber.position.x,
                            this.fishing.bobber.position.z
                        );
                    }
                }, 180 + i * 140);
            }

            debugLog(`[FISH] Catch splash (${rarity}, ${duration.toFixed(2)}s) at (${bobberPos.x.toFixed(2)}, ${bobberPos.z.toFixed(2)})`);
        }
        
        // Trigger catch callback only once
        if (this.fishing?.onFishCaught && !this._hasTriggeredCaught) {
            this._hasTriggeredCaught = true;
            this.fishing.onFishCaught(this.currentFish);
            
            // Trigger cat celebration
            if (this.fishing?.cat && this.fishing.cat.startCelebrate) {
                const celebrationDuration = this.fishing?.getCelebrateDurationForCatch
                    ? this.fishing.getCelebrateDurationForCatch(this.currentFish)
                    : 1.6;
                this.fishing.cat.startCelebrate(celebrationDuration);
                debugLog('[FISH] Cat celebration triggered!', 'duration:', celebrationDuration);
            }
        }
    }
    
    _getCatAnchorXZ() {
        const saved = this.fishing?.cat?.getSavedPosition?.();
        if (saved) {
            return new THREE.Vector3(saved.x, 0, saved.z);
        }
        const anchor = this.fishing?.cat?.getModel?.() || this.fishing?.sceneRef?.cat?.getModel?.();
        const pos = new THREE.Vector3();
        if (anchor) {
            anchor.updateMatrixWorld(true);
            anchor.getWorldPosition(pos);
        } else {
            pos.set(0, 0, -4.4);
        }
        return new THREE.Vector3(pos.x, 0, pos.z);
    }

    _getCatWorldXZ() {
        const anchor = this._getCatAnchorXZ();
        // Same landing offset used when reeling fish to the boat
        return new THREE.Vector3(anchor.x, 0, anchor.z + 0.65);
    }

    _checkGentleReunionCatch() {
        if (!this._gentleReunion || this.state === FishState.LANDED) return;
        if (this.state !== FishState.HOOKED_FIGHT && this.state !== FishState.LANDING) return;

        const bobberPos = this.fishing?.bobber?.position;
        if (!bobberPos) return;

        const fishToBobber = new THREE.Vector3(
            this.mesh.position.x - bobberPos.x,
            0,
            this.mesh.position.z - bobberPos.z
        ).length();

        const catAnchor = this._getCatAnchorXZ();
        const fishToCat = new THREE.Vector3(
            this.mesh.position.x - catAnchor.x,
            0,
            this.mesh.position.z - catAnchor.z
        ).length();
        const bobberToCat = new THREE.Vector3(
            bobberPos.x - catAnchor.x,
            0,
            bobberPos.z - catAnchor.z
        ).length();

        const synced = fishToBobber < 0.4;
        const atBoat = fishToCat < 3.2 && bobberToCat < 3.2;

        if (!synced || !atBoat) return;

        if (this.state === FishState.HOOKED_FIGHT) {
            const home = this._getReunionHomeTarget();
            const fishDistHome = new THREE.Vector3(
                this.mesh.position.x - home.x,
                0,
                this.mesh.position.z - home.z
            ).length();
            const progress = this._fightT / Math.max(this._fightDur, 0.01);
            if (progress < 0.92 && fishDistHome > 0.6) return;
        }

        debugLog(
            `[FISH] Starfish reunion complete at boat `
            + `(fish→cat ${fishToCat.toFixed(2)}, bobber→cat ${bobberToCat.toFixed(2)})`
        );
        this.markLanded();
    }

    _getReunionHomeTarget() {
        return this._getCatWorldXZ();
    }

    _enforceReunionDistanceCap(catXZ) {
        if (!this._reunionMaxDist || !catXZ) return;
        const toFish = new THREE.Vector3(
            this.mesh.position.x - catXZ.x,
            0,
            this.mesh.position.z - catXZ.z
        );
        const dist = toFish.length();
        if (dist > this._reunionMaxDist + 0.05) {
            toFish.normalize().multiplyScalar(this._reunionMaxDist);
            this.mesh.position.x = catXZ.x + toFish.x;
            this.mesh.position.z = catXZ.z + toFish.z;
        }
    }

    _updateGentleReunionFight(delta) {
        this._fightT += delta;
        this._gentlePulseT += delta;

        const hook = this._reunionHookPos;
        const home = this._getReunionHomeTarget();
        const catXZ = home;

        if (hook) {
            const progress = Math.min(1, this._fightT / Math.max(this._fightDur, 0.01));
            const eased = progress * progress * (3 - 2 * progress);
            this.mesh.position.x = THREE.MathUtils.lerp(hook.x, home.x, eased);
            this.mesh.position.z = THREE.MathUtils.lerp(hook.z, home.z, eased);
        } else {
            const toHome = new THREE.Vector3().subVectors(home, this.mesh.position);
            toHome.y = 0;
            const dist = toHome.length();
            if (dist > 0.08) {
                toHome.normalize();
                const heartbeat = 0.78 + Math.sin(this._gentlePulseT * STARFISH_PULSE_HZ * Math.PI * 2) * 0.18;
                const step = STARFISH_DRIFT_SPEED * heartbeat * delta;
                this.mesh.position.addScaledVector(toHome, Math.min(step, dist));
            }
        }

        // Soft lateral heartbeat — never shove the presence farther from Halley
        const lateral = Math.sin(this._gentlePulseT * 0.45) * 0.012;
        this.mesh.position.x += lateral;

        this._enforceReunionDistanceCap(catXZ);
        this.clampPlayArea(this.mesh.position);
        this._enforceReunionDistanceCap(catXZ);

        this._dir.set(home.x - this.mesh.position.x, 0, home.z - this.mesh.position.z);
        if (this._dir.lengthSq() > 1e-6) {
            this._dir.normalize();
        }

        if (this.water?.getWaterHeight) {
            const surfaceY = this.water.getWaterHeight(this.mesh.position.x, this.mesh.position.z);
            this.mesh.position.y = surfaceY - 0.22;
        }

        this.mesh.visible = false;

        if (Math.floor(this._fightT * 2) !== Math.floor((this._fightT - delta) * 2)) {
            const distToCat = new THREE.Vector3(
                this.mesh.position.x - catXZ.x,
                0,
                this.mesh.position.z - catXZ.z
            ).length();
            debugLog(`[FISH] Starfish reunion approach: ${this._fightT.toFixed(1)}s / ${this._fightDur.toFixed(1)}s, dist to boat ${distToCat.toFixed(1)}`);
        }
    }

    update(delta, ctx) {
        if (!this.mesh) return;
        // Don't require visible for update - we track position even if mesh is hidden
        
        // ctx.rodTipWorld should come from rope
        const rodTip = ctx?.rodTipWorld;
        
        if (this.state === FishState.HOOKED_FIGHT) {
            // DON'T clear just-hooked flag here - fishing.update() needs to check it
            // It will be cleared in fishing.update() after it uses it
            
            // Skip movement during freeze period (first 120ms after hook)
            const isFreezePeriod = this._hookFreezeTime !== undefined && this._hookFreezeTime > 0;
            if (isFreezePeriod) {
                // Decrement freeze timer
                this._hookFreezeTime -= delta;
                if (this._hookFreezeTime < 0) {
                    this._hookFreezeTime = 0;
                }
                // Sync rope freeze timer with fish timer
                if (this.fishing?.rope) {
                    this.fishing.rope._hookFreezeTime = this._hookFreezeTime;
                }
                // Don't move fish during freeze - position is locked to bobber
                this._fightT += delta; // Still count fight time
                return; // Skip movement logic during freeze
            }
            
            // After freeze, log that fish is now moving
            if (this._hookFreezeTime === 0 && this._fightT < 0.2) {
                debugLog('[FISH] Freeze ended, fish starting to move');
            }

            if (this._gentleReunion) {
                this._updateGentleReunionFight(delta);
                this._checkGentleReunionCatch();
                if (this.state === FishState.LANDED) return;
                if (this._fightT >= this._fightDur) {
                    debugLog('[FISH] Starfish reunion approach complete — gliding in');
                    this.startLanding();
                }
                return;
            }
            
            this._fightT += delta;
            this._dirT -= delta;
            
            // pick a new gentle random direction every 0.8–1.2 s
            if (this._dirT <= 0) {
                this._dirT = 0.8 + Math.random() * 0.4;
                const ang = Math.random() * Math.PI * 2;
                this._dir.set(Math.cos(ang), 0, Math.sin(ang));
                // bias away from dock (never go behind or beside)
                // If too close to dock boundary (z < dockZ + 0.5), force away from dock (positive Z)
                if (this.mesh.position.z < (this.dockZ + 0.5)) {
                    // Force direction away from dock (positive Z = forward into water)
                    this._dir.z = Math.abs(this._dir.z);
                }
                // Keep within X bounds
                if (this.mesh.position.x < this.bounds.xMin + 0.8) this._dir.x = Math.abs(this._dir.x);
                if (this.mesh.position.x > this.bounds.xMax - 0.8) this._dir.x = -Math.abs(this._dir.x);
                // Prefer forward movement (away from dock = positive Z) but allow some variation
                // Fish can move in any direction, but bias toward positive Z (forward)
                // Don't force z to -0.2 if fish is far from dock - allow more random movement
                if (this.mesh.position.z > (this.dockZ + 2.0)) {
                    // Fish is far from dock - allow more random movement (can move backward slightly)
                    this._dir.z = Math.max(this._dir.z, -0.3); // Can move slightly backward if needed
                } else {
                    // Fish is close to dock - bias forward (positive Z)
                    this._dir.z = Math.max(this._dir.z, 0.2); // Force forward movement away from dock
                }
                this._dir.normalize();
            }
            
            // move - fish fights by moving randomly
            const moveX = this._dir.x * this.speedFight * delta;
            const moveZ = this._dir.z * this.speedFight * delta;
            this.mesh.position.x += moveX;
            this.mesh.position.z += moveZ;
            
            // clamp to play area and forbid behind dock
            this.clampPlayArea(this.mesh.position);
            
            // Debug: log movement every 0.1 seconds during fight
            if (Math.floor(this._fightT * 10) !== Math.floor((this._fightT - delta) * 10)) {
                debugLog(`[FISH] Moving: delta=(${moveX.toFixed(3)}, ${moveZ.toFixed(3)}), pos=(${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
            }
            
            // Keep fish just under water surface
            if (this.water?.getWaterHeight) {
                const surfaceY = this.water.getWaterHeight(this.mesh.position.x, this.mesh.position.z);
                this.mesh.position.y = surfaceY - 0.25;
            }
            
            // Keep fish hidden during fight
            this.mesh.visible = false;
            
            // Apply tug visuals to bobber during fight - sporadic, unpredictable pulls
            // Randomize timing heavily for chaotic, sporadic action
            if (!this._tugTimer) this._tugTimer = 0;
            this._tugTimer += delta;
            
            // Very randomized intervals - sometimes quick bursts, sometimes pauses
            // Use exponential distribution for more sporadic timing
            const baseInterval = 0.15;
            const randomVariation = Math.random() * Math.random() * 0.4; // Exponential-like distribution (more frequent short intervals, rare long ones)
            const tugInterval = baseInterval + randomVariation; // 0.15-0.55s with bias toward shorter
            
            // Add chance to skip tug entirely for more sporadic feel (10% skip chance)
            const shouldTug = Math.random() > 0.1;
            
            if (this._tugTimer >= tugInterval && shouldTug && this.fishing && this.fishing.bobber) {
                // Intensity based on how much fish is moving, with heavy randomization
                const moveSpeed = Math.sqrt(moveX * moveX + moveZ * moveZ) / delta;
                const baseIntensity = Math.min(1.5, moveSpeed / 2.0) + 0.6;
                
                // Much more random variation - sometimes weak, sometimes very strong
                const randomBoost = Math.random() * Math.random() * 0.8; // Exponential-like boost (bias toward smaller, but occasional big)
                const intensity = baseIntensity + (Math.random() - 0.5) * 0.6 + randomBoost; // Increased variation with occasional spikes
                
                // Pass sfx and scene for sound playback
                const sfx = this.fishing.sfx || null;
                const scene = this.fishing.sceneRef?.scene || null;
                applyTug(this.fishing.bobber, Math.max(0.7, intensity), sfx, scene);
                this._tugTimer = 0; // Reset timer
            } else if (this._tugTimer >= tugInterval && !shouldTug) {
                // Skip this tug for sporadic feel
                this._tugTimer = 0;
            }
            
            // Debug: log fight progress every 0.5 seconds
            if (Math.floor(this._fightT * 2) !== Math.floor((this._fightT - delta) * 2)) {
                debugLog(`[FISH] Fighting: ${this._fightT.toFixed(2)}s / ${this._fightDur.toFixed(2)}s, pos: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
            }
            
            // after a few seconds, go land
            if (this._fightT >= this._fightDur) {
                debugLog('[FISH] Fight duration complete, transitioning to LANDING');
                this.startLanding();
            }
        }
        
        if (this.state === FishState.LANDING) {
            // During landing, fish moves toward rod tip while reel pulls bobber/fish in
            // Check bobber distance to dock instead of fish distance to rod tip
            // When bobber is close to dock, fish is caught
            
            // Get bobber position (fish and bobber are synced during LANDING)
            const bobberPos = this.fishing?.bobber?.position;
            if (!bobberPos) {
                console.warn('[FISH] LANDING state but bobber position is null!');
                return;
            }
            
            // Get dock position (cat is on the dock, use cat position as dock reference)
            const catPos = this.fishing?.sceneRef?.cat?.getModel()?.position;
            const dockRefPos = catPos || new THREE.Vector3(0, 0, -4.4); // Fallback to known cat position
            
            // Check distance from bobber to dock (use XZ distance, ignore Y)
            const toDock = new THREE.Vector3(bobberPos.x - dockRefPos.x, 0, bobberPos.z - dockRefPos.z);
            const bobberDistToDock = toDock.length();
            
            // Always log first frame of LANDING state
            if (this._landingStartLogged === undefined) {
                this._landingStartLogged = true;
                debugLog(`[FISH] LANDING state started! bobber pos=(${bobberPos.x.toFixed(2)}, ${bobberPos.z.toFixed(2)}), dock pos=(${dockRefPos.x.toFixed(2)}, ${dockRefPos.z.toFixed(2)}), dist=${bobberDistToDock.toFixed(2)}`);
            }
            
            // Debug: log distance to dock every 0.5 seconds
            if (!this._lastLandingLogTime) this._lastLandingLogTime = 0;
            this._lastLandingLogTime += delta;
            if (this._lastLandingLogTime >= 0.5) {
                this._lastLandingLogTime = 0;
                debugLog(`[FISH] Landing: bobber dist to dock=${bobberDistToDock.toFixed(2)}, bobber pos=(${bobberPos.x.toFixed(2)}, ${bobberPos.z.toFixed(2)})`);
            }
            
            // Fish still moves homeward during landing (reel pulls bobber in)
            const landingTarget = this._gentleReunion
                ? this._getReunionHomeTarget()
                : rodTip;
            if (landingTarget) {
                const toTarget = new THREE.Vector3().subVectors(landingTarget, this.mesh.position);
                toTarget.y = 0;
                const distToTarget = toTarget.length();
                if (this._gentleReunion && distToTarget < 0.15) {
                    this.mesh.position.x = landingTarget.x;
                    this.mesh.position.z = landingTarget.z;
                } else if (distToTarget > 0.01) {
                    toTarget.normalize();
                    const landingSpeed = this._gentleReunion ? STARFISH_LANDING_FISH_SPEED : this.speedLanding;
                    const step = Math.min(landingSpeed * delta, distToTarget);
                    this.mesh.position.addScaledVector(toTarget, step);
                    if (this._gentleReunion) {
                        this._enforceReunionDistanceCap(this._getCatWorldXZ());
                    }
                }
            }
            
            // Keep fish just under water surface
            if (this.water?.getWaterHeight) {
                const surfaceY = this.water.getWaterHeight(this.mesh.position.x, this.mesh.position.z);
                this.mesh.position.y = Math.max(this.mesh.position.y, surfaceY - 0.25);
            }
            
            // Keep fish hidden during landing too
            this.mesh.visible = false;
            
            // Check if bobber is close enough to rod tip OR dock for catch
            let catchTriggered = false;

            if (this._gentleReunion) {
                this._checkGentleReunionCatch();
                if (this.state === FishState.LANDED) return;
            } else if (rodTip) {
                const toTip = new THREE.Vector3().subVectors(bobberPos, rodTip);
                const bobberDistToTip = toTip.length();
                
                // Bobber must be at perfect landing position
                // Perfect landing: bobber oscillates around ~8.3 units from dock (position ~0, 3.9)
                // Only catch when bobber reaches perfect landing position (8.0-8.5 from dock)
                const CATCH_DISTANCE_TIP = 15.0; // Large enough to allow reaching perfect spot
                // Only catch if bobber is at perfect landing range (8.0-8.5 from dock) AND close to tip
                if (bobberDistToTip < CATCH_DISTANCE_TIP && bobberDistToDock >= 8.0 && bobberDistToDock < 8.5 && this.state !== FishState.LANDED) {
                    debugLog(`[FISH] Bobber is at perfect landing position (${bobberDistToDock.toFixed(2)}), marking fish as caught`);
                    catchTriggered = true;
                }
            }
            
            // Also check dock distance - catch at perfect landing position (~8.3 units)
            if (!this._gentleReunion) {
            // Perfect landing position: bobber oscillates around 8.3 units from dock (position ~0, 3.9)
            // Only catch when bobber reaches this perfect landing position (8.2-8.5 range)
            const CATCH_DISTANCE_DOCK = 8.5; // Catch at perfect landing position (~8.3 units)
            const MIN_DOCK_DISTANCE = 8.0; // Don't catch before reaching perfect landing
            if (!catchTriggered && bobberDistToDock < CATCH_DISTANCE_DOCK && bobberDistToDock >= MIN_DOCK_DISTANCE && this.state !== FishState.LANDED) {
                debugLog(`[FISH] Bobber is at perfect landing position (${bobberDistToDock.toFixed(2)}), marking fish as caught`);
                catchTriggered = true;
            }
            }
            
            if (catchTriggered) {
                this.markLanded();
            } else if (!this._gentleReunion && (bobberDistToDock < 3.5 || (rodTip && bobberPos.distanceTo(rodTip) < 4.0))) {
                // Log when getting close (updated threshold)
                const tipDist = rodTip ? bobberPos.distanceTo(rodTip).toFixed(2) : 'N/A';
                debugLog(`[FISH] Bobber getting close - dock: ${bobberDistToDock.toFixed(2)}, tip: ${tipDist}`);
            }
        }
        
        if (this.state === FishState.LANDED) {
            // Fish is caught - keep it hidden and just track position
            // Don't animate or move the mesh - it's caught
            this.mesh.visible = false;
            // Don't try to stick to bobber - fish is caught, animation is done
        }
        
        // Face movement direction
        if (this._dir.lengthSq() > 1e-4) {
            this.mesh.rotation.y = Math.atan2(-this._dir.z, this._dir.x);
        }
    }
    
    clampPlayArea(p) {
        if (p.x < this.bounds.xMin) p.x = this.bounds.xMin;
        if (p.x > this.bounds.xMax) p.x = this.bounds.xMax;
        if (p.z < this.bounds.zMin) p.z = this.bounds.zMin;
        if (p.z > this.bounds.zMax) p.z = this.bounds.zMax;
        
        // never beside/behind dock:
        // Dock's forward edge is at dockZ = -0.8
        // Fish must stay in front of dock (z >= dockZ)
        // Only clamp if fish tries to go behind dock (z < dockZ)
        if (p.z < this.dockZ) {
            p.z = this.dockZ; // Keep fish in front of dock (at or forward of dock edge)
        }
    }
    
    // Legacy methods for compatibility
    startHookFight(hitPos) {
        this.hook();
        if (this.mesh && hitPos) {
            this.mesh.position.copy(hitPos).add(new THREE.Vector3(0, -0.5, 0));
        }
    }
    
    getState() {
        // Convert string states to numbers for compatibility
        const stateMap = {
            'IDLE': 0,
            'HOOKED_FIGHT': 1,
            'LANDING': 2,
            'LANDED': 4
        };
        return stateMap[this.state] ?? 0;
    }
    
    spawnFish() {
        // Don't reset if fish is already fighting/hooked
        if (this.state === FishState.HOOKED_FIGHT || this.state === FishState.LANDING) {
            return;
        }

        this.currentFish = null;
        
        // spawnFish just prepares the fish data - actual positioning happens in hook()
        // Fish spawns at bobber location when hooked, not randomly
        if (this.fishing.bobber && this.fishing.bobber.visible) {
            const fishPos = this.fishing.bobber.position.clone();
            
            // Get available fish from current location
            // Try multiple ways to access game/locations
            let availableFishIds = [0, 1, 2];
            let locations = null;
            let currentLocation = null;
            const player =
                this.fishing?.game?.player ??
                window.game?.player ??
                null;
            
            if (this.fishing?.game?.locations) {
                locations = this.fishing.game.locations;
            } else if (window.game?.locations) {
                locations = window.game.locations;
            }
            
            if (locations) {
                currentLocation = locations.getCurrentLocation();
                availableFishIds = resolveLocationFishIds(currentLocation, player);
            }
            debugLog('[FISH] spawnFish selecting fish - location:', currentLocation?.name, 'ids:', availableFishIds);
            
            if (availableFishIds.length === 0) {
                console.warn('[FISH] No fish available at', currentLocation?.name);
                return;
            }
            
            const playerLevel = player?.level ?? 1;
            
            const fishData = getRandomFishForLocation(availableFishIds, {
                playerLevel,
                location: currentLocation
            });
            if (!fishData) {
                console.warn('[FISH] No fish roll at', currentLocation?.name);
                return;
            }
            
            this.currentFish = {
                id: fishData.id,
                species: fishData.name,
                name: fishData.name,
                fishId: fishData.id,
                rarity: fishData.rarity,
                weight: fishData.weight,
                value: fishData.value,
                experience: fishData.experience,
                season: fishData.season,
                position: fishPos.clone() // Store bobber position for reference
            };
            
            // Keep fish hidden and in IDLE state until hooked
            if (this.mesh) {
                this.mesh.visible = false;
                // Position fish at bobber location (will be repositioned at hook, but good to have it close)
                this.mesh.position.copy(fishPos);
                const waterHeight = this.water?.getWaterHeight?.(fishPos.x, fishPos.z) || 0;
                this.mesh.position.y = waterHeight - 0.25;
            }
            
            this.state = FishState.IDLE;
            this._gentleReunion = false;
            this._reunionHookPos = null;
            this._reunionMaxDist = 0;
        }
    }
    
    catchFish() {
        // Legacy method - just mark as landed if not already
        if (this.state !== FishState.LANDED) {
            this.markLanded();
        }
    }
    
    getCurrentFish() {
        return this.currentFish;
    }
}
