import * as THREE from 'three';
import { Scene } from './scene.js';
import { Cat } from './cat.js';
import { Water2Lake } from './water2.js';
import { Grass } from './grass.js';
import { Dock } from './dock.js';
import { Platform } from './platform.js';
import { Locations } from './locations.js';
import { Fishing } from './fishing.js';
import { TempRod } from './tempRod.js';
import { Fish } from './fish.js';
import { UI } from './ui.js';
import { Camera } from './camera.js';
import { Splash } from './splash.js';
import { buildLakeMask } from './buildLakeMask.js';
import { SoundManager } from './sound.js';
import { addWaterParticles } from './effects/waterParticles.js';
import { Sfx } from './audio/sfx.js';
import { Voiceover } from './audio/voiceover.js';
import { VOICEOVER_TAP_COOLDOWN_MS } from './config/voiceover.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { Leaderboard } from './leaderboard.js';
import { FishCollection } from './fishCollection.js';
import { loadingProgress } from './loadingProgress.js';
import { showAdBanner } from './ads.js';
import {
    IDLE_PORTRAIT_DELAY_SEC,
    PORTRAIT_BOBBER_TRACKING_CUTOFF
} from './config/idlePortrait.js';

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
        this.tempRod = null;
        this.fish = null;
        this.ui = null;
        this.camera = null;
        this.splash = null;
        this.lakeMask = null;
        this.soundManager = null;
        this.sfx = null;
        
        // Gameplay systems
        this.player = null;
        this.inventory = null;
        this.leaderboard = null;
        this.fishCollection = null;
        this.waterParticles = null;
        this.waterParticleDefaults = null;
        this.STARLIGHT_LURE_ID = 6;
        this.STARLIGHT_LURE_NAME = 'Starlight Lure';
        this.idlePortraitDelaySec = IDLE_PORTRAIT_DELAY_SEC;
        this.lastActivityTime = performance.now();
        this._portraitIdleActive = false;
        this.deferReveal = options.deferReveal === true;
        this._revealed = false;
        if (this.deferReveal) {
            document.getElementById('game-container')?.classList.add('pre-entry');
        }
        this.ready = this.init();
    }

    reveal() {
        if (this._revealed) return;
        this._revealed = true;

        loadingProgress.suppress(false);
        loadingProgress.hide();
        document.getElementById('game-container')?.classList.remove('pre-entry');
        document.getElementById('player-info')?.classList.remove('hidden');
        document.getElementById('game-area')?.classList.remove('hidden');
        document.getElementById('tab-bar')?.classList.remove('hidden');
        showAdBanner();

        this.setupActivityTracking();
        this.setupCatTap();
        this.animate();
    }

    showCatBark(text) {
        const bubble = document.getElementById('cat-bark-bubble');
        const canvas = this.scene?.renderer?.domElement;
        const camera = this.scene?.camera;
        if (!bubble || !canvas || !camera || !this.cat) {
            return;
        }

        const anchor = this.cat.getModel?.();
        const headPos = this.cat.getHeadWorldPosition?.()
            || (anchor ? anchor.getWorldPosition(new THREE.Vector3()) : null);
        if (!headPos) {
            return;
        }

        const projected = headPos.clone().project(camera);
        const rect = canvas.getBoundingClientRect();
        const x = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
        const y = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;

        bubble.textContent = text;
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        bubble.classList.remove('hidden');
        bubble.classList.add('visible');

        if (this._catBarkTimer) {
            clearTimeout(this._catBarkTimer);
        }
        this._catBarkTimer = window.setTimeout(() => {
            bubble.classList.remove('visible');
            bubble.classList.add('hidden');
        }, 1600);
    }

    isCatTapAllowed() {
        if (!this._revealed || !this.cat || !this.fishing || !this.ui) {
            return false;
        }

        const prologue = document.getElementById('story-prologue');
        if (prologue && !prologue.classList.contains('hidden')) {
            return false;
        }

        const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
        if (activeTab && activeTab !== 'game') {
            return false;
        }

        if (document.querySelector('.modal:not(.hidden)')) {
            return false;
        }

        if (this.fishing.isCasting || this.fishing.isReeling || this.fishing.fishOnLine) {
            return false;
        }

        const castButton = document.getElementById('cast-button');
        const castState = castButton?.getAttribute('data-state');
        if (castState === 'waiting' || castState === 'set-hook' || castState === 'fighting') {
            return false;
        }

        return true;
    }

    setupCatTap() {
        const canvas = this.scene?.renderer?.domElement;
        if (!canvas || this._catTapBound) {
            return;
        }
        this._catTapBound = true;

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let lastTapMs = 0;

        const onPointerDown = (event) => {
            if (!this.isCatTapAllowed()) {
                return;
            }
            if (event.target !== canvas) {
                return;
            }

            const now = performance.now();
            if (now - lastTapMs < VOICEOVER_TAP_COOLDOWN_MS) {
                return;
            }

            const rect = canvas.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            const targets = this.cat.getTapTargets?.() || [];
            if (!targets.length) {
                return;
            }

            raycaster.setFromCamera(pointer, this.scene.camera);
            const hits = raycaster.intersectObjects(targets, false);
            if (!hits.length) {
                return;
            }

            lastTapMs = now;
            this.markActivity();

            this.voiceover?.playRandom('tap', {
                onSpeak: (text) => this.showCatBark(text)
            });
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        this._catTapCleanup = () => canvas.removeEventListener('pointerdown', onPointerDown);
    }

    async init() {
        try {
            loadingProgress.update(22, 'Starting 3D engine...');
            this.scene = new Scene();
            await this.scene.init();
            
            loadingProgress.update(30, 'Shaping the lake...');
            this.lakeMask = buildLakeMask(1024, {x: 0.5, y: 0.5}, 0.42, 0.34, 0.2);
            
            loadingProgress.update(38, 'Building water and shoreline...');
            this.water = new Water2Lake(this.scene, this.lakeMask);
            this.water.create();
            
            // Add floating water particles near surface
            this.waterParticles = addWaterParticles(this.scene.scene);
            if (this.waterParticles?.material) {
                const mat = this.waterParticles.material;
                this.waterParticleDefaults = {
                    size: mat.size,
                    opacity: mat.opacity,
                    blending: mat.blending,
                    depthWrite: mat.depthWrite,
                    color: mat.color ? mat.color.clone() : new THREE.Color(0xffffff),
                    rotationSpeed: this.waterParticles.userData?.rotationSpeed ?? 0.00025
                };
            }
            console.log('Water particles created');
            
            loadingProgress.update(44, 'Growing grass around the lake...');
            this.grass = new Grass(this.scene, this.lakeMask, 400, 0);
            this.grass.create();
            
            loadingProgress.update(50, 'Loading player progress...');
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
            this.ensureStarlightLureUnlocked();
            
            // Initialize location system
            this.locations = new Locations();
            if (this.player && Array.isArray(this.locations.locations)) {
                let unlocksAdded = false;
                this.locations.locations.forEach((location, index) => {
                    if (location?.temporaryUnlock && !this.player.locationUnlocks.includes(index)) {
                        this.player.locationUnlocks.push(index);
                        unlocksAdded = true;
                    }
                });
                if (unlocksAdded) {
                    this.player.save({ skipSync: true });
                    console.log('[LOCATIONS] Temporary unlocks granted for testing:', this.player.locationUnlocks);
                }
            }
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
            this.applyLocationEnvironment(currentLocation);
            this.applyCelestialBaitPreference(currentLocation);
            
            loadingProgress.update(58, `Building ${currentLocation.name}...`);
            this.platform = new Platform(this.scene, this.water);
            this.platform.createPlatform(currentLocation.platformType);
            console.log('[PLATFORM] Created platform:', currentLocation.platformType);
            
            // Keep dock reference for backward compatibility with Camera class
            // Create a Dock instance but don't create its mesh (platform handles it)
            this.dock = new Dock(this.scene, this.water);
            // Expose platform methods to dock for compatibility
            this.dock.getSurfacePosition = () => this.platform.getSurfacePosition();
            this.dock.getDockMesh = () => this.platform.getPlatformMesh();
            
            loadingProgress.update(62, 'Loading fisher cat model...');
            this.cat = new Cat(this.scene, this.dock);
            await this.cat.load((fraction) => {
                const pct = 62 + fraction * 28;
                const label = Math.round(fraction * 100);
                loadingProgress.update(pct, `Loading fisher cat model... ${label}%`);
            });
            console.log('Cat loaded, position:', this.cat.getModel()?.position);
            
            // Position cat on platform (feet aligned to dock surface)
            const platformPos = this.platform.getSurfacePosition();
            this.cat.positionOnSurface(platformPos);
            console.log('[PLATFORM] Cat positioned at:', this.cat.savedPosition);
            
            loadingProgress.update(90, 'Building bendable fishing rod...');
            this.tempRod = new TempRod(this.scene, this.water.waterY ?? 0, platformPos);
            const rodTip = this.tempRod.create();
            this.cat.setEmbeddedRodVisible(false);

            const leftHand = this.cat.leftHandBone;
            if (leftHand && this.tempRod.rodRoot) {
                this.tempRod.rodRoot.userData.handBone = leftHand;
                this.tempRod.rodRoot.userData.rodPositionOffset = new THREE.Vector3(0.113, 0, 0.12);
            }

            loadingProgress.update(92, 'Rigging fishing line and bobber...');
            this.fishing = new Fishing(this.scene, this.cat, this.water, rodTip);
            this.fishing.game = this;
            await this.fishing.init();
            console.log('Fishing system initialized');
            
            const catModel = this.cat.getModel();
            if (catModel) {
                catModel.updateMatrixWorld(true);
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
            this.voiceover = new Voiceover(this.sfx);
            
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
            
            loadingProgress.update(96, 'Loading sounds and UI...');
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

            if (this.deferReveal) {
                return;
            }

            this.reveal();
            
        } catch (error) {
            console.error('Failed to initialize game:', error);
            loadingProgress.suppress(false);
            loadingProgress.fail('Loading failed. Please refresh and try again.');
            throw error;
        }
    }

    setupActivityTracking() {
        const bump = () => this.markActivity();
        const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
        this._activityListeners = events.map((evt) => {
            window.addEventListener(evt, bump, { passive: true });
            return { evt, bump };
        });
    }

    markActivity() {
        this.lastActivityTime = performance.now();
        if (this._portraitIdleActive && this.camera) {
            this._portraitIdleActive = false;
            this.camera.setPortraitMode(false);
        }
    }

    isPortraitEligible() {
        if (!this.fishing || !this.ui) return false;

        const usernameModal = document.getElementById('username-modal');
        if (usernameModal && !usernameModal.classList.contains('hidden')) return false;

        const prologue = document.getElementById('story-prologue');
        if (prologue && !prologue.classList.contains('hidden')) return false;

        const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
        if (activeTab && activeTab !== 'game') return false;

        if (this.fishing.isCasting || this.fishing.isReeling || this.fishing.fishOnLine) return false;
        if (this.ui.waitingForBite) return false;

        const castButton = document.getElementById('cast-button');
        const castState = castButton?.getAttribute('data-state');
        if (castState === 'waiting' || castState === 'set-hook' || castState === 'fighting') {
            return false;
        }

        const bobberVisible = this.fishing.bobber?.visible;
        const fishState = this.fish?.state;
        const sequenceComplete =
            fishState === 'LANDED' && !this.fishing.isReeling && !this.fishing.fishOnLine;
        if (bobberVisible && !sequenceComplete) return false;

        return true;
    }

    updateIdlePortrait() {
        if (!this.camera) return;

        const idleSec = (performance.now() - this.lastActivityTime) / 1000;
        const wantPortrait = this.isPortraitEligible() && idleSec >= this.idlePortraitDelaySec;

        if (wantPortrait && !this._portraitIdleActive) {
            this._portraitIdleActive = true;
            this.cat?.enterPortraitIdle?.();
            this.camera.setPortraitMode(true);
        } else if (!wantPortrait && this._portraitIdleActive) {
            this._portraitIdleActive = false;
            this.camera.setPortraitMode(false);
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

        this.updateIdlePortrait();

        // Update cat position to follow platform (especially important for boats)
        if (this.cat && this.platform) {
            const preserveFacing = this._portraitIdleActive === true;
            this.cat.positionOnSurface(this.platform.getSurfacePosition(), preserveFacing);
        }

        if (this.camera) {
            this.camera.advancePortraitBlend(delta);
        }
        const portraitBlend = this._portraitIdleActive
            ? (this.camera?.portraitBlend ?? 0)
            : 0;
        
        // Update cat with sway and bobber tracking (only when idle - not casting or reeling)
            if (this.cat) {
                // Get bobber position if bobber is active and visible
                let bobberPos = null;
                if (portraitBlend < PORTRAIT_BOBBER_TRACKING_CUTOFF && this.fishing?.bobber && this.fishing.bobber.visible) {
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
                
                this.cat.update(delta, isIdle, bobberPos, isFishing, portraitBlend);
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
            if (this.fishing.isReeling) {
                this.fishing.updateReel(delta);
            }
            this.fishing.syncCatAnimation?.();
        }

        // Update splash effects
        if (this.splash) {
            this.splash.update(delta);
        }

        // Update camera spring follow (after cat has turned for portrait look-at)
        if (this.camera) {
            this.camera.updateSpring(delta);
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

    applyWaterParticleSettings(settings) {
        if (!this.waterParticles?.material || !settings) {
            return;
        }

        const mat = this.waterParticles.material;

        if (typeof settings.size === 'number') {
            mat.size = settings.size;
        }
        if (typeof settings.opacity === 'number') {
            mat.opacity = settings.opacity;
        }
        if (typeof settings.blending !== 'undefined') {
            mat.blending = settings.blending;
        }
        if (typeof settings.depthWrite !== 'undefined') {
            mat.depthWrite = settings.depthWrite;
        }
        if (typeof settings.color !== 'undefined') {
            const color = settings.color instanceof THREE.Color
                ? settings.color
                : new THREE.Color(settings.color);
            if (!mat.color) {
                mat.color = color.clone();
            } else {
                mat.color.copy(color);
            }
        }

        mat.needsUpdate = true;

        if (typeof settings.rotationSpeed !== 'undefined' && this.waterParticles?.userData) {
            this.waterParticles.userData.rotationSpeed = settings.rotationSpeed;
            this.waterParticles.userData.lastRotationTime = performance.now();
            if (settings.rotationSpeed === 0) {
                this.waterParticles.rotation.y = 0;
            }
        }
    }

    applyLocationEnvironment(location) {
        if (!location) {
            return;
        }

        const defaultParticleSettings = this.waterParticleDefaults
            ? {
                  ...this.waterParticleDefaults,
                  color: this.waterParticleDefaults.color?.clone?.() || this.waterParticleDefaults.color
              }
            : null;

        const profiles = {
            DEFAULT: {
                scene: {},
                waterParticles: defaultParticleSettings
            },
            CELESTIAL: {
                scene: {
                    background: 0x04050a,
                    fogColor: 0x04050a,
                    fogNear: 12,
                    fogFar: 160,
                    hemisphereSkyColor: 0x222845,
                    hemisphereGroundColor: 0x050509,
                    hemisphereIntensity: 0.28,
                    directionalColor: 0xb7c4ff,
                    directionalIntensity: 0.55,
                    ambientColor: 0x1c2a4a,
                    ambientIntensity: 0.24
                },
                waterParticles: {
                    size: 0.22,
                    opacity: 0.9,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    color: 0xf4f8ff,
                    rotationSpeed: 0
                }
            }
        };

        const waterType = location.waterBodyType || 'DEFAULT';
        const profile = profiles[waterType] || profiles.DEFAULT;

        if (this.scene?.setEnvironment) {
            this.scene.setEnvironment(profile.scene || {});
        }

        if (profile.waterParticles) {
            this.applyWaterParticleSettings(profile.waterParticles);
        } else if (this.waterParticleDefaults) {
            this.applyWaterParticleSettings(this.waterParticleDefaults);
        }
    }

    ensureStarlightLureUnlocked() {
        if (!this.player || !this.player.tackleUnlocks || !Array.isArray(this.player.tackleUnlocks.baits)) {
            return;
        }

        const baits = this.player.tackleUnlocks.baits;
        if (!baits.includes(this.STARLIGHT_LURE_ID)) {
            baits.push(this.STARLIGHT_LURE_ID);
            if (this.player.tackleNotified?.baits) {
                this.player.tackleNotified.baits = this.player.tackleNotified.baits.filter(id => id !== this.STARLIGHT_LURE_ID);
            }
            this.player.save({ skipSync: true });
        }
    }

    applyCelestialBaitPreference(location) {
        if (!this.player || !this.player.gear) {
            return;
        }

        const isCelestial = location?.waterBodyType === 'CELESTIAL';
        let saveNeeded = false;

        if (isCelestial) {
            this.ensureStarlightLureUnlocked();
            if (this.player.gear.bait !== this.STARLIGHT_LURE_NAME) {
                if (!this.player.__previousBait || this.player.gear.bait !== this.STARLIGHT_LURE_NAME) {
                    this.player.__previousBait = this.player.gear.bait;
                }
                this.player.gear.bait = this.STARLIGHT_LURE_NAME;
                saveNeeded = true;
            }
        } else if (this.player.gear.bait === this.STARLIGHT_LURE_NAME) {
            const fallback = this.player.__previousBait || 'Basic Bait';
            this.player.gear.bait = fallback;
            delete this.player.__previousBait;
            saveNeeded = true;
        }

        if (saveNeeded) {
            this.player.save({ skipSync: true });
        }
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
        this.applyLocationEnvironment(location);
        this.applyCelestialBaitPreference(location);
        
        // Switch platform
        this.platform.switchPlatform(location.platformType);
        
        // Reposition cat on new platform
        const newPlatformPos = this.platform.getSurfacePosition();
        if (this.cat) {
            this.cat.positionOnSurface(newPlatformPos);
            console.log('[LOCATION SWITCH] Cat repositioned to:', this.cat.savedPosition);
        }
    }
}

export default Game;

