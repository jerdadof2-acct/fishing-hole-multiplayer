import * as THREE from 'three';
import { Scene } from './scene.js';
import { Cat } from './cat.js';
import { Water2Lake } from './water2.js';
import { Grass } from './grass.js';
import { Dock } from './dock.js';
import { Platform } from './platform.js';
import { Locations } from './locations.js';
import { Fishing } from './fishing.js';
import { Fish } from './fish.js';
import { UI } from './ui.js';
import { Camera } from './camera.js';
import { Splash } from './splash.js';
import { TempRod } from './tempRod.js';
import { buildLakeMask } from './buildLakeMask.js';
import { SoundManager } from './sound.js';
import { addWaterParticles } from './effects/waterParticles.js';
import { Sfx } from './audio/sfx.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { Leaderboard } from './leaderboard.js';
import { FishCollection } from './fishCollection.js';

export class Game {
    constructor(options = {}) {
        this.api = options.api || null;
        this.playerContext = options.playerContext || null;
        this.initialPlayerData = options.playerData || null;
        this.initialFishCollection = options.fishCollection || null;

        this.scene = null;
        this.cat = null;
        this.water = null;
        this.grass = null;
        this.dock = null; // Keep for backward compatibility with Camera
        this.platform = null; // New platform system
        this.locations = null; // Location management
        this.fishing = null;
        this.fish = null;
        this.ui = null;
        this.camera = null;
        this.splash = null;
        this.tempRod = null;
        this.lakeMask = null;
        this.soundManager = null;
        this.sfx = null;
        
        // Gameplay systems
        this.player = null;
        this.inventory = null;
        this.leaderboard = null;
        this.fishCollection = null;
        
        // Debug: Enable rod dragging to adjust position
        this.rodDragging = false;
        this.rodDragStartX = 0;
        this.rodDragStartOffset = null;
        
        this.init();
    }

    async init() {
        try {
            // Initialize scene
            this.scene = new Scene();
            await this.scene.init();
            
            // Create lake mask first (needed for water and grass)
            this.lakeMask = buildLakeMask(1024, {x: 0.5, y: 0.5}, 0.42, 0.34, 0.2);
            
            // Create water with mask-based blending
            this.water = new Water2Lake(this.scene, this.lakeMask);
            this.water.create();
            
            // Add floating water particles near surface
            this.waterParticles = addWaterParticles(this.scene.scene);
            console.log('Water particles created');
            
            // Create grass around lake (instanced with wind sway)
            this.grass = new Grass(this.scene, this.lakeMask, 400, 0);
            this.grass.create();
            
            // Initialize gameplay systems
            this.player = new Player(this.initialPlayerData);
            if (this.playerContext) {
                this.player.setUserContext(this.playerContext);
            }
            if (this.api) {
                this.player.setAPI(this.api);
            }

            this.inventory = new Inventory();
            this.leaderboard = new Leaderboard();
            this.fishCollection = new FishCollection(this.initialFishCollection);
            if (this.api) {
                this.fishCollection.setAPI(this.api);
            }
            if (this.playerContext?.userId) {
                this.fishCollection.setUserContext({ userId: this.playerContext.userId });
            }

            console.log('[GAME] Gameplay systems initialized');
            
            // Initialize location system
            this.locations = new Locations();
            if (this.player) {
                const savedIndex = typeof this.player.currentLocationIndex === 'number'
                    ? this.player.currentLocationIndex
                    : 0;
                const unlocked = Array.isArray(this.player.locationUnlocks)
                    ? this.player.locationUnlocks
                    : [];
                if (unlocked.includes(savedIndex)) {
                    this.locations.setCurrentLocation(savedIndex);
                } else if (unlocked.length > 0) {
                    this.locations.setCurrentLocation(unlocked[0]);
                    this.player.currentLocationIndex = unlocked[0];
                    this.player.save({ skipSync: true });
                }
            }
            const currentLocation = this.locations.getCurrentLocation();
            console.log('[LOCATIONS] Current location:', currentLocation.name, 'Water type:', currentLocation.waterBodyType, 'Platform:', currentLocation.platformType);
            
            // Set water type based on current location
            this.water.setWaterBodyType(currentLocation.waterBodyType);
            
            // Create platform system (dock or boat based on location)
            this.platform = new Platform(this.scene, this.water);
            this.platform.createPlatform(currentLocation.platformType);
            console.log('[PLATFORM] Created platform:', currentLocation.platformType);
            
            // Keep dock reference for backward compatibility with Camera class
            // Create a Dock instance but don't create its mesh (platform handles it)
            this.dock = new Dock(this.scene, this.water);
            // Expose platform methods to dock for compatibility
            this.dock.getSurfacePosition = () => this.platform.getSurfacePosition();
            this.dock.getDockMesh = () => this.platform.getPlatformMesh();
            
            // Load cat
            this.cat = new Cat(this.scene, this.dock);
            await this.cat.load();
            console.log('Cat loaded, position:', this.cat.getModel()?.position);
            
            // Position cat on platform
            const platformPos = this.platform.getSurfacePosition();
            this.cat.getModel().position.copy(platformPos);
            this.cat.savedPosition = platformPos.clone();
            console.log('[PLATFORM] Cat positioned at:', platformPos);
            
            // Create temporary rod (GLB rod not working, using temp rod with aiming)
            const platformPosForRod = this.platform.getSurfacePosition();
            this.tempRod = new TempRod(this.scene, 0, platformPosForRod);
            const rodTip = this.tempRod.create();
            console.log('Temporary rod created');
            
            // Set up fishing system with temp rod FIRST (before rod attachment)
            this.fishing = new Fishing(this.scene, this.cat, this.water, rodTip);
            // Expose game reference to fishing for location access
            this.fishing.game = this;
            await this.fishing.init();
            console.log('Fishing system initialized');
            
            // Attach rod to cat's hand bone AFTER fishing is initialized
            // Ensure cat model matrices are updated before attachment
            const catModel = this.cat.getModel();
            if (catModel) {
                catModel.updateMatrixWorld(true);
            }
            
            // REVERTED: Manual positioning instead of bone attachment
            // Attaching to bones causes visibility issues and can affect cat position
            // Store hand bone reference for manual positioning each frame
            const leftHandBone = this.cat.leftHandBone || this.cat.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'handl' || (b.name.toLowerCase().includes('hand') && b.name.toLowerCase().includes('l'))));
            if (leftHandBone && this.tempRod.rodRoot) {
                // Get hand bone world position to verify it exists and is valid
                catModel.updateMatrixWorld(true);
                leftHandBone.updateMatrixWorld(true);
                
                const handWorldPos = new THREE.Vector3();
                leftHandBone.getWorldPosition(handWorldPos);
                console.log('[ROD] Left hand bone world position:', handWorldPos);
                
                // Store hand bone reference for manual positioning (NOT attaching to bone)
                this.tempRod.rodRoot.userData.handBone = leftHandBone;
                
                // Ensure rod stays in scene (don't attach to bone - causes visibility issues)
                // Keep rod in scene, position it manually each frame
                // Safety check: ensure scene exists before accessing
                if (this.scene && this.scene.scene) {
                    if (this.tempRod.rodRoot.parent !== this.scene.scene) {
                        if (this.tempRod.rodRoot.parent) {
                            this.tempRod.rodRoot.parent.remove(this.tempRod.rodRoot);
                        }
                        this.scene.scene.add(this.tempRod.rodRoot);
                    }
                } else {
                    console.error('[ROD] Scene not initialized - cannot add rod to scene');
                }
                
                // Ensure rod and all its children are visible
                this.tempRod.rodRoot.visible = true;
                this.tempRod.rodRoot.scale.set(1, 1, 1);
                
                // Traverse rod hierarchy and ensure everything is visible
                this.tempRod.rodRoot.traverse((child) => {
                    if (child.isMesh || child.isGroup) {
                        child.visible = true;
                        child.scale.set(1, 1, 1);
                    }
                    // Make sure materials are not transparent
                    if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                if (mat) mat.opacity = 1.0;
                                if (mat) mat.transparent = false;
                            });
                        } else {
                            child.material.opacity = 1.0;
                            child.material.transparent = false;
                        }
                    }
                });
                
                console.log('[ROD] Rod will be positioned manually relative to hand bone (not attached)');
                console.log('[ROD] Rod visible:', this.tempRod.rodRoot.visible);
            } else {
                console.warn('[ROD] Could not find hand bone - rod will stay at original position');
            }
            
            // Initialize sound manager
            this.soundManager = new SoundManager();
            console.log('Sound manager initialized');
            
            // Create splash effects with sound support
            this.splash = new Splash(this.scene, 0, this.soundManager);
            this.fishing.setSplash(this.splash);
            console.log('Splash effects created');
            
            // Initialize rope system after everything is ready
            if (this.fishing.rope) {
                this.fishing.rope.create();
                console.log('Rope system initialized');
            }
            
            // Set up fish system
            this.fish = new Fish(this.scene, this.water, this.fishing);
            
            // Expose fish to scene for rope & fishing access (AFTER fish is created)
            this.scene.fish = this.fish;
            
            // DEBUG: Set up mouse/pointer events for rod dragging (after rod is created)
            // DISABLED: Rod position finalized at X=0.113, Y=0.000, Z=0.120
            // Uncomment below to re-enable dragging for future adjustments
            /*
            setTimeout(() => {
                if (this.tempRod?.rodRoot) {
                    console.log('[ROD DRAG] Setting up rod dragging...');
                    this.setupRodDragging();
                } else {
                    console.warn('[ROD DRAG] Rod not found, dragging not set up');
                }
            }, 500);
            */
            
            // Set up camera (after everything is loaded) - delayed to ensure models are ready
            this.camera = new Camera(this.scene, this.cat, this.dock, this.water);
            this.camera.setup();
            
            // Initialize Sfx system with camera
            this.sfx = new Sfx(this.scene.camera);
            
            // Clear any cached old reel sounds first (in case of hot reload)
            if (this.sfx.cache) {
                const keysToClear = ["fishing_reel", "reel", "reel_fight_new"];
                keysToClear.forEach(key => {
                    if (this.sfx.cache.has(key)) {
                        this.sfx.cache.delete(key);
                    }
                });
            }
            
            // Load sound files asynchronously (non-blocking - won't prevent game from starting)
            // Load in background, game will work even if files are missing
            Promise.all([
                this.sfx.load("bobber_splash", "/assets/audio/splash-6213.mp3").catch(() => {
                    console.warn('splash-6213.mp3 not found for bobber splash, sounds will be disabled');
                    return null;
                }),
                this.sfx.load("fish_caught_splash", "/assets/audio/water-splashing-202979.mp3").catch(() => {
                    console.warn('water-splashing-202979.mp3 not found for fish caught, sounds will be disabled');
                    return null;
                }),
                // Use a new cache key to completely bypass browser cache
                // Add random timestamp to force fresh load
                (() => {
                    const reelUrl = "/src/audio/reel-78063.mp3?nocache=" + Date.now() + "&r=" + Math.random();
                    return this.sfx.load("reel_fight_new", reelUrl, true);
                })().catch((error) => {
                    console.warn('Failed to load reel sound:', error);
                    return null;
                }),
                this.sfx.load("tug", "/assets/audio/tug.wav").catch(() => {
                    console.warn('tug.wav not found, sounds will be disabled');
                    return null;
                }),
                this.sfx.load("mouse_click", "/src/audio/mouse-click-7-411633.mp3").catch(() => {
                    console.warn('mouse-click-7-411633.mp3 not found, sounds will be disabled');
                    return null;
                })
            ]).then(() => {
                console.log('SFX sounds loaded (if available)');
            }).catch((error) => {
                console.warn('Some sound files could not be loaded (non-blocking):', error);
            });
            
            // Pass Sfx to fishing system for sound playback (even if sounds aren't loaded yet)
            if (this.fishing) {
                this.fishing.setSfx(this.sfx);
            }
            
            // Update camera again after a short delay to ensure models are positioned
            setTimeout(() => {
                this.camera.updateCamera();
                console.log('Final camera position:', this.scene.camera.position);
            }, 200);
            
            // Set up UI controls (pass gameplay systems and sfx)
            this.ui = new UI(this.fishing, this.fish, this.water, this, {
                player: this.player,
                inventory: this.inventory,
                leaderboard: this.leaderboard,
                fishCollection: this.fishCollection
            }, this.sfx);
            this.ui.init();

            if (this.player) {
                this.player.enableSync();
            }
            if (this.fishCollection) {
                this.fishCollection.enableSync();
            }
            
            // Hide loading, show UI
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('ad-banner').classList.remove('hidden');
            document.getElementById('player-info').classList.remove('hidden');
            document.getElementById('game-area').classList.remove('hidden');
            document.getElementById('tab-bar').classList.remove('hidden');
            
            // Start render loop
            this.animate();
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            document.getElementById('loading').textContent = 'Loading failed. Please refresh.';
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.scene.clock.getDelta();
        
        // Update water with new tick method (includes ripple animation)
        // Use scene.camera (THREE.Camera) instead of this.camera (Camera class)
        if (this.water && this.water.mesh && this.scene && this.scene.camera && this.scene.camera.position) {
            this.water.mesh.tick(delta, this.scene.camera);
        }
        
        // Update water system (includes river particle flow)
        if (this.water && this.water.update) {
            this.water.update(delta);
        }
        
        // Update grass (wind sway)
        if (this.grass) {
            this.grass.update(delta);
        }
        
        // Update platform (wave rocking for boats)
        if (this.platform) {
            this.platform.updatePlatform(delta);
        }
        
        // Update cat position to follow platform (especially important for boats)
        if (this.cat && this.platform) {
            const platformPos = this.platform.getSurfacePosition();
            this.cat.getModel().position.copy(platformPos);
            this.cat.savedPosition = platformPos.clone();
        }
        
        // Update temporary rod
        if (this.tempRod) {
            this.tempRod.update(delta);
        }
            
            // Update cat with sway and bobber tracking (only when idle - not casting or reeling)
            if (this.cat) {
                // Get bobber position if bobber is active and visible
                let bobberPos = null;
                if (this.fishing?.bobber && this.fishing.bobber.visible) {
                    bobberPos = this.fishing.bobber.position.clone();
                }
                
                // IDLE = before any fishing sequence starts (no bobber in water, no buttons active)
                // This is the starting state, right hand OFF rod
                const bobberInWater = this.fishing?.bobber && this.fishing.bobber.visible;
                
                // Check if fishing sequence is complete (fish caught, sequence done)
                const fishState = this.fish?.state;
                const fishCaught = fishState === 'LANDED';
                const sequenceComplete = fishCaught && !this.fishing.isReeling && !this.fishing.fishOnLine;
                
                // Sequence starts immediately when cast button is clicked (isCasting = true)
                // OR when bobber is in water (after cast completes, BEFORE sequence completes)
                // OR when actively reeling or fighting
                // NOTE: After sequence completes, bobber may still be visible, but sequence is done
                const fishingSequenceStarted = this.fishing?.isCasting || 
                    (bobberInWater && !sequenceComplete) || // Bobber counts only if sequence not complete
                    this.fishing?.isReeling || 
                    this.fishing?.fishOnLine;
                
                // IDLE mode: Right hand OFF rod (before any sequence OR after sequence completes)
                const isIdle = !fishingSequenceStarted;
                
                // FISHING mode: Right hand ON rod during entire sequence:
                // - Casting (isCasting = true)
                // - Waiting for fish (bobber in water after cast, before bite)
                // - Fighting (fishOnLine = true)
                // - Reeling (isReeling = true)
                // Hand stays on until sequence complete, then back to idle
                const isFishing = fishingSequenceStarted && !sequenceComplete;
                
                        // Debug logging for hand timing (log only when state changes)
                        // Store a more complete state signature to detect any changes
                        const stateSignature = `${isFishing}-${isIdle}-${this.fishing?.isCasting}-${this.fishing?.isReeling}-${this.fishing?.fishOnLine}-${bobberInWater}-${fishState}-${sequenceComplete}`;
                        if (!this._lastStateSignature || this._lastStateSignature !== stateSignature) {
                            console.log(`[HAND] State change: isFishing=${isFishing}, isIdle=${isIdle}, ` +
                                `isCasting=${this.fishing?.isCasting}, isReeling=${this.fishing?.isReeling}, ` +
                                `fishOnLine=${this.fishing?.fishOnLine}, bobberInWater=${bobberInWater}, ` +
                                `fishState=${fishState}, sequenceComplete=${sequenceComplete}`);
                            this._lastStateSignature = stateSignature;
                            this._lastIsFishingState = isFishing;
                        }
                
                this.cat.update(delta, isIdle, bobberPos, isFishing);
            }
        
        // Update rod dragging if active
        if (this.rodDragging) {
            this.updateRodDragging();
        }
        
        // Update fish FIRST so it can move, then fishing syncs bobber to new position
        // This prevents bobber from snapping before fish has had a chance to update
        if (this.fish && this.fishing && this.fishing.rope) {
            const ctx = { 
                rodTipWorld: this.fishing.rope.getRodTipWorld?.() || null 
            };
            this.fish.update(delta, ctx);
        }

        // Update fishing system (syncs bobber to fish position after fish has moved)
        if (this.fishing) {
            this.fishing.update(delta);
            // Update reel if reeling
            if (this.fishing.isReeling) {
                this.fishing.updateReel(delta);
            }
        }

        // Update splash effects
        if (this.splash) {
            this.splash.update(delta);
        }

        // Update camera spring follow
        if (this.camera) {
            this.camera.update(delta);
        }

        // Render
        if (this.scene && this.scene.renderer && this.scene.scene && this.scene.camera) {
            this.scene.renderer.render(this.scene.scene, this.scene.camera);
        }
    }

    // DEBUG: Setup mouse/pointer dragging for rod position adjustment
    setupRodDragging() {
        const canvas = this.scene.renderer.domElement;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Collect all meshes in the rod hierarchy that can be raycasted
        const collectRodMeshes = (object, meshes = []) => {
            if (object.isMesh) {
                meshes.push(object);
            }
            if (object.children) {
                for (const child of object.children) {
                    collectRodMeshes(child, meshes);
                }
            }
            return meshes;
        };
        
        const onPointerDown = (event) => {
            if (!this.tempRod?.rodRoot) {
                console.log('[ROD DRAG] Rod root not found');
                return;
            }
            
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Update matrices before raycasting
            this.tempRod.rodRoot.updateMatrixWorld(true);
            
            // Collect all meshes from rod hierarchy
            const rodMeshes = collectRodMeshes(this.tempRod.rodRoot);
            console.log(`[ROD DRAG] Found ${rodMeshes.length} meshes in rod hierarchy`);
            
            // Raycast to check if clicking on rod or X-axis indicator
            raycaster.setFromCamera(mouse, this.scene.camera);
            const intersects = raycaster.intersectObjects(rodMeshes, true);
            
            console.log(`[ROD DRAG] Raycast intersects: ${intersects.length} objects`);
            if (intersects.length > 0) {
                intersects.forEach((intersect, i) => {
                    console.log(`[ROD DRAG] Intersect ${i}:`, intersect.object.name, intersect.object.type);
                });
            }
            
            // Check if clicking on rod or debug axis - also allow clicking anywhere near rod
            let clickedOnRod = intersects.length > 0 && intersects.some(obj => {
                const name = obj.object?.name || '';
                const isRodRelated = name.includes('Rod') || name.includes('XAxis') || name.includes('Handle') || 
                                    name.includes('Blank') || name.includes('Reel');
                console.log(`[ROD DRAG] Checking object: ${name}, isRodRelated: ${isRodRelated}`);
                return isRodRelated;
            });
            
            // Also allow dragging if clicking anywhere on canvas (for easier grabbing)
            // But only if we're close to the rod in screen space
            if (!clickedOnRod) {
                // Get rod position in screen space
                const rodWorldPos = new THREE.Vector3();
                this.tempRod.rodRoot.getWorldPosition(rodWorldPos);
                rodWorldPos.project(this.scene.camera);
                const rodScreenX = (rodWorldPos.x * 0.5 + 0.5) * rect.width;
                const rodScreenY = (-rodWorldPos.y * 0.5 + 0.5) * rect.height;
                
                const distanceToRod = Math.sqrt(
                    Math.pow(event.clientX - rodScreenX, 2) + 
                    Math.pow(event.clientY - rodScreenY, 2)
                );
                
                // Allow dragging if within 100 pixels of rod center in screen space
                if (distanceToRod < 100) {
                    console.log(`[ROD DRAG] Click near rod (${distanceToRod.toFixed(1)}px away), enabling drag`);
                    clickedOnRod = true;
                }
            }
            
            if (clickedOnRod) {
                this.rodDragging = true;
                this.rodDragStartX = event.clientX;
                this.rodDragStartOffset = this.tempRod.rodRoot.userData?.rodPositionOffset?.clone() || new THREE.Vector3(0, 0, 0);
                canvas.style.cursor = 'grabbing';
                console.log('[ROD DRAG] Drag started, initial offset:', this.rodDragStartOffset);
                event.preventDefault();
            } else {
                console.log('[ROD DRAG] Click not on rod');
            }
        };
            
        const onPointerMove = (event) => {
            if (!this.rodDragging) {
                // Show grab cursor when hovering near rod
                if (this.tempRod?.rodRoot) {
                    const rect = canvas.getBoundingClientRect();
                    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    
                    // Quick check if mouse is near rod
                    const rodWorldPos = new THREE.Vector3();
                    this.tempRod.rodRoot.getWorldPosition(rodWorldPos);
                    rodWorldPos.project(this.scene.camera);
                    const rodScreenX = (rodWorldPos.x * 0.5 + 0.5) * rect.width;
                    const rodScreenY = (-rodWorldPos.y * 0.5 + 0.5) * rect.height;
                    
                    const distanceToRod = Math.sqrt(
                        Math.pow(event.clientX - rodScreenX, 2) + 
                        Math.pow(event.clientY - rodScreenY, 2)
                    );
                    
                    if (distanceToRod < 100) {
                        canvas.style.cursor = 'grab';
                    } else {
                        canvas.style.cursor = 'default';
                    }
                }
                return;
            }
            
            const rect = canvas.getBoundingClientRect();
            const deltaX = event.clientX - this.rodDragStartX;
            // Convert pixel delta to world space (adjust scale as needed)
            const worldDeltaX = (deltaX / rect.width) * 2.0; // Adjust multiplier to control sensitivity
            
            // Update rod position offset (only X-axis)
            const newOffset = this.rodDragStartOffset.clone();
            newOffset.x += worldDeltaX;
            this.tempRod.rodRoot.userData.rodPositionOffset = newOffset;
            
            // Immediately update rod position visually (don't wait for next frame)
            this.updateRodPositionImmediately();
            
            // Log current position (throttled)
            if (!this._dragLogTime || performance.now() - this._dragLogTime > 100) {
                console.log(`[ROD DRAG] X offset: ${newOffset.x.toFixed(3)}, Z: ${newOffset.z.toFixed(3)}`);
                this._dragLogTime = performance.now();
            }
            
            event.preventDefault();
        };
            
        const onPointerUp = (event) => {
            if (this.rodDragging) {
                this.rodDragging = false;
                canvas.style.cursor = 'default';
                
                // Log final position
                const finalOffset = this.tempRod.rodRoot.userData?.rodPositionOffset || new THREE.Vector3(0, 0, 0);
                console.log(`[ROD DRAG] Final position - X: ${finalOffset.x.toFixed(3)}, Y: ${finalOffset.y.toFixed(3)}, Z: ${finalOffset.z.toFixed(3)}`);
                console.log(`[ROD DRAG] Update rodPositionOffset to: new THREE.Vector3(${finalOffset.x.toFixed(3)}, ${finalOffset.y.toFixed(3)}, ${finalOffset.z.toFixed(3)})`);
                
                event.preventDefault();
            }
        };
        
        // Also handle mouseup outside of canvas
        const onPointerUpGlobal = (event) => {
            if (this.rodDragging) {
                this.rodDragging = false;
                canvas.style.cursor = 'default';
            }
        };
        
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        // Also listen globally for mouseup in case user drags outside canvas
        window.addEventListener('pointerup', onPointerUpGlobal);
        
        console.log('[ROD DRAG] Event listeners added');
        
        // Store cleanup function
        this.rodDragCleanup = () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointerup', onPointerUpGlobal);
        };
    }
        
    updateRodDragging() {
        // Dragging is handled in event listeners
        // This method exists for potential per-frame updates if needed
    }
    
    // Immediately update rod position during dragging (for visual feedback)
    // DISABLED: Rod now uses pivot system, no manual positioning needed
    updateRodPositionImmediately() {
        // Rod position is now handled by pivot system in main.js
        // Pivot automatically follows hand bone, no manual positioning needed
    }
    
    /**
     * Switch to a different location (for testing)
     */
    changeLocation(locationIndex) {
        if (!this.locations || !this.platform || !this.water) {
            console.warn('[LOCATION SWITCH] Location system not initialized');
            return;
        }
        
        const location = this.locations.getLocation(locationIndex);
        if (!location) {
            console.warn('[LOCATION SWITCH] Invalid location index:', locationIndex);
            return;
        }
        
        console.log('[LOCATION SWITCH] Switching to:', location.name, 'Water type:', location.waterBodyType, 'Platform:', location.platformType);
        
        // Update current location
        this.locations.setCurrentLocation(locationIndex);
        
        // Switch water type
        this.water.setWaterBodyType(location.waterBodyType);
        
        // Switch platform
        this.platform.switchPlatform(location.platformType);
        
        // Reposition cat on new platform
        const newPlatformPos = this.platform.getSurfacePosition();
        if (this.cat && this.cat.getModel()) {
            this.cat.getModel().position.copy(newPlatformPos);
            this.cat.savedPosition = newPlatformPos.clone();
            console.log('[LOCATION SWITCH] Cat repositioned to:', newPlatformPos);
        }
    }
}

export default Game;

