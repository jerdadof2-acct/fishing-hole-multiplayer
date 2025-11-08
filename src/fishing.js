import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Physics } from './physics.js';
import { FishingRope } from './rope.js';
import { updateRodTip } from './fishing/rod.js';
import { attachRodToHand } from './fishing/attachRod.js';
import { aimRodForwardAt45 } from './fishing/aimRod.js';

// Apply tug visual to bobber when fish pulls
export function applyTug(bobber, intensity = 1.0, sfx = null, scene = null) {
  if (!bobber || !bobber.position) return;
  
  const waterHeight = bobber.userData.waterLevel || 0;
  // Pull bobber down much further when tugging - very dramatic pop action
  const amp = 0.12 * intensity; // Increased from 0.06 to 0.12 for very dramatic pull under
  
  // Store tug state so it persists through rope physics sync
  bobber.userData.tugActive = true;
  // Randomize tug duration slightly for sporadic feel (0.2-0.3s)
  const tugDuration = 0.2 + Math.random() * 0.1; // Tug lasts 0.2-0.3 seconds (randomized)
  bobber.userData.tugTime = tugDuration; // Current remaining time
  bobber.userData.tugDuration = tugDuration; // Store original duration for fade calculation
  bobber.userData.tugAmp = amp;
  bobber.userData.tugIntensity = intensity;
  
  // Apply tug position immediately
  bobber.position.y = waterHeight - amp; // Pull deep below surface during tug (dramatic pop action)
  
  // Much more dramatic rotation with randomization for sporadic visual pop
  bobber.rotation.z = (Math.random() - 0.5) * (0.25 + Math.random() * 0.1) * intensity; // Random rotation range 0.25-0.35
  bobber.rotation.x = (Math.random() - 0.5) * (0.2 + Math.random() * 0.1) * intensity; // Random rotation range 0.2-0.3
  
  // DISABLED: Tug sound removed - user dislikes glug sound
  // if (sfx && scene && bobber.position) {
  //   sfx.play3D("tug", bobber.position, scene, 0.5, 1.0 + Math.random() * 0.2);
  // }
}

export class Fishing {
    constructor(scene, cat, water, tempRodTip = null) {
        this.sceneRef = scene;
        this.cat = cat;
        this.water = water;
        this.tempRodTip = tempRodTip; // Use temp rod tip if provided
        this.rodModel = null;
        this.rodTipBone = null;
        this.fishingLine = null;
        this.bobber = null;
        this.isCasting = false;
        this.isReeling = false;
        this.castTarget = null;
        this.bobberVelocity = new THREE.Vector3();
        this.currentTarget = null;
        this.splash = null;
        this.sfx = null;
        this.castT = 0;
        this._activeReelSounds = []; // Track active reel sounds to stop them when needed
        this.castStart = new THREE.Vector3();
        this.castEnd = new THREE.Vector3();
        this.rope = null; // Will be initialized in init()
        this.fishOnLine = false; // True when fighting a fish
        this.bobberJiggleTime = 0; // Time for bobber jiggling animation
        this.fightSplashTimer = 0; // Timer for continuous splashes during fight
        this.fightSplashRing = null; // Splash ring around bobber during fight
        // Rod bending state for smooth interpolation
        this.rodBendState = {}; // Stores target rotation for each section for smooth lerping
        this.rodBendTime = 0; // Time accumulator for fluid sway animation
        // Wake effect tracking
        this.lastBobberPos = new THREE.Vector3();
        this.wakeTimer = 0;
        this.wakeInterval = 0.08; // Trigger wake every 80ms during reeling
        this.wakeDistanceThreshold = 0.25; // Minimum distance moved before triggering wake
        // Idle bobber wake for ambient lake motion
        this.idleWakeTimer = 0;
        this.idleWakeInterval = 3.0; // Trigger idle wake every 3 seconds
        // Define safe cast bounds - casts need to go further away with new view
        const LAKE_SIZE = 150; // Increased from 100 for further casts
        this.CAST_BOUNDS = {
            xMin: -LAKE_SIZE / 2 + 12,
            xMax: LAKE_SIZE / 2 - 12,
            zMin: -LAKE_SIZE / 2 + 12,
            zMax: LAKE_SIZE / 2 - 12
        };
    }
    
    clampToCastBounds(v) {
        v.x = THREE.MathUtils.clamp(v.x, this.CAST_BOUNDS.xMin, this.CAST_BOUNDS.xMax);
        v.z = THREE.MathUtils.clamp(v.z, this.CAST_BOUNDS.zMin, this.CAST_BOUNDS.zMax);
        return v;
    }
    
    // Pick cast targets that are guaranteed on-screen using camera raycasting
    // Only picks points in front of the cat (never to the side or behind)
    randomOnscreenWaterPoint(margin = 0.15) {
        const camera = this.sceneRef.camera;
        const waterY = this.water.waterY;
        
        // Get cat position to ensure casts are always in front
        let catPos = new THREE.Vector3(0, 0, -4.4); // Default cat position on dock
        if (this.cat && this.cat.getModel()) {
            this.cat.getModel().updateMatrixWorld(true);
            this.cat.getModel().getWorldPosition(catPos);
        }
        
        // Try to get a point in front of the cat
        let attempts = 0;
        let hit = null;
        
        while (attempts < 50) {
            // Pick random screen position in upper portion (away from camera, forward)
            // Cat faces away from camera (positive Z), so upper screen = forward/away
            // Use center X range (not far to sides) to ensure casts go straight forward
            const ndcX = THREE.MathUtils.lerp(-0.3 + margin, 0.3 - margin, Math.random()); // Narrow X range (center only)
            const ndcY = THREE.MathUtils.lerp(0.1 + margin, 0.8 - margin, Math.random()); // Upper screen (away from camera)
            const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);
            
            const rayStart = ndc.clone().unproject(camera);
            const dir = rayStart.clone().sub(camera.position).normalize();
            
            const t = (waterY - camera.position.y) / dir.y;
            hit = camera.position.clone().addScaledVector(dir, Math.max(t, 0));
            hit.y = waterY;
            
            // Ensure point is well in front of cat (Z should be significantly greater than cat's Z)
            // Cat is facing forward (positive Z direction), and we're facing away from camera
            // Also ensure X is near center (not far to sides)
            const minForwardDistance = 3.0; // At least 3 units forward
            const maxSideOffset = 8.0; // Max distance from center X
            
            if (hit.z > catPos.z + minForwardDistance && Math.abs(hit.x - catPos.x) < maxSideOffset) {
                return hit; // Point is forward and near center
            }
            
            attempts++;
        }
        
        // Fallback: if we can't find a point in front, ensure it's forward and near center
        // Place it at minimum distance forward from cat, near center X
        if (hit) {
            hit.z = Math.max(hit.z, catPos.z + 3.0); // At least 3 units forward
            hit.x = THREE.MathUtils.clamp(hit.x, catPos.x - 8.0, catPos.x + 8.0); // Near center X
        } else {
            // Final fallback: forward and near center
            hit = new THREE.Vector3(
                catPos.x + THREE.MathUtils.lerp(-5, 5, Math.random()), // Near center X
                waterY,
                catPos.z + 5 + Math.random() * 25 // Always forward (away from camera)
            );
        }
        
        return hit;
    }
    
    // Alias for backwards compatibility
    getOnscreenWaterPoint(margin = 0.15) {
        return this.randomOnscreenWaterPoint(margin);
    }

    async init() {
        // Use temporary rod only (GLB rod disabled for multi-section design)
        if (this.tempRodTip) {
            this.rodTipBone = this.tempRodTip;
            console.log('Using temporary rod with multi-section design');
        } else {
            // Fallback: create temp rod if not provided
            console.warn('No temp rod provided, creating fallback rod');
            // Could create fallback here if needed
        }
        this.createBobber();
        
        // Create rope system instead of simple line
        this.rope = new FishingRope(
            this.sceneRef,
            () => this.getRodTip(),
            this.bobber,
            this.water,
            this.CAST_BOUNDS
        );
        console.log('Rope system created');
        
        // Keep old line creation for fallback (hidden)
        this.createFishingLine();
        if (this.fishingLine) {
            this.fishingLine.visible = false; // Use rope instead
        }
        
        // Create fight splash ring (visible only during HOOKED_FIGHT)
        this.createFightSplashRing();
    }
    
    createFightSplashRing() {
        // Create a group to hold both rings
        this.fightSplashRing = new THREE.Group();
        this.fightSplashRing.name = 'FightSplashRing';
        this.fightSplashRing.visible = false; // Hidden by default
        this.fightSplashRing.renderOrder = 998; // Render above water but below other effects
        
        // Outer ring: bigger, light blue/white
        const outerRingGeometry = new THREE.RingGeometry(0.20, 0.35, 64);
        const outerRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending // Makes it stand out against water
        });
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        outerRing.rotation.x = -Math.PI / 2; // Lay flat on water (horizontal)
        outerRing.name = 'OuterSplashRing';
        this.fightSplashRing.add(outerRing);
        
        // Inner ring: darker, more visible contrast
        const innerRingGeometry = new THREE.RingGeometry(0.12, 0.20, 64);
        const innerRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x113355, // Much darker blue, almost black-blue
            transparent: true,
            opacity: 0.9, // More opaque for better visibility
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        innerRing.rotation.x = -Math.PI / 2; // Lay flat on water (horizontal)
        innerRing.name = 'InnerSplashRing';
        this.fightSplashRing.add(innerRing);
        
        this.sceneRef.scene.add(this.fightSplashRing);
    }
    
    setSplash(splash) {
        this.splash = splash;
    }
    
    setSfx(sfx) {
        this.sfx = sfx;
    }

    // DISABLED: GLB rod loading removed for multi-section temp rod design
    // Keeping function structure but commented out to preserve references
    async loadRod_DISABLED() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                'assets/glb/fishing_rod_rigged_and_animated.glb',
                (gltf) => {
                    this.rodModel = gltf.scene;
                    
                    // Check rod size and scale appropriately
                    // Note: Rod needs to be scaled relative to cat's scale (~0.01)
                    const box = new THREE.Box3().setFromObject(this.rodModel);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    
                    // Since cat is scaled to ~0.01, scale rod proportionally
                    // Target rod length: about 1.5 units in world space
                    const targetLength = 1.5;
                    const scale = targetLength / maxDim;
                    this.rodModel.scale.setScalar(scale);
                    console.log('Rod model size:', size, 'Scale applied:', scale);
                    
                    // Find rod tip bone first
                    this.findRodTip();
                    
                    // Attach rod to cat's right hand
                    const rightHandBone = this.cat.getRightHandBone();
                    if (rightHandBone) {
                        // Update world matrix to get correct position
                        this.cat.getModel().updateMatrixWorld(true);
                        rightHandBone.updateMatrixWorld(true);
                        
                        console.log('Attaching rod to hand bone:', rightHandBone.name);
                        
                        // Get hand bone world direction to understand its orientation
                        rightHandBone.updateMatrixWorld(true);
                        const handWorldDir = new THREE.Vector3(0, 0, 1);
                        handWorldDir.applyQuaternion(rightHandBone.quaternion);
                        console.log('Hand bone world direction:', handWorldDir);
                        
                        // Use pivot system for consistent rod rotation
                        // After cat + rod are loaded and hand bone is found
                        const rodPivot = attachRodToHand(this.cat, this.rodModel, rightHandBone);
                        
                        // Store pivot reference for future adjustments
                        this.rodPivot = rodPivot;
                        
                        console.log('✅ Rod attached to hand via pivot');
                        console.log('Rod pivot position:', rodPivot.position);
                        console.log('Rod mesh local position:', this.rodModel.position);
                        console.log('Rod pivot available:', !!this.rodModel.userData.pivot);
                    } else {
                        // Fallback: attach directly to cat model with offset
                        console.warn('⚠️ Hand bone not found, attaching rod to cat model (pivot system won\'t work)');
                        this.cat.getModel().add(this.rodModel);
                        // Position rod relative to cat (since cat is small scale, use small offsets)
                        // Position to right side (cat's right hand position) and angle 45° down toward water
                        this.rodModel.position.set(0.2, 0.15, 0.3); // Right side, front and up from cat center
                        // Flip to face forward - 180° around Y to point forward instead of backward
                        this.rodModel.rotation.set(-Math.PI / 4, Math.PI, 0); // 45° down, 180° flip forward
                    }
                    
                    // Debug: Verify rod model exists and has pivot
                    console.log('🔍 Rod debug check:');
                    console.log('  - rodModel exists:', !!this.rodModel);
                    console.log('  - rodModel has pivot:', !!this.rodModel.userData?.pivot);
                    console.log('  - rodPivot stored:', !!this.rodPivot);
                    
                    // Ensure rod tip is found or created
                    if (!this.rodTipBone) {
                        this.createRodTipFallback();
                    }
                    
                    // Ensure rod is visible and make it MUCH brighter for visibility
                    this.rodModel.visible = true;
                    this.rodModel.traverse((child) => {
                        if (child.isMesh) {
                            child.visible = true;
                            child.castShadow = true;
                            child.receiveShadow = true;
                            // Make rod material very visible with bright colors
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => {
                                        mat.emissive = new THREE.Color(0x664422); // Brown glow
                                        mat.emissiveIntensity = 0.5;
                                        mat.color = mat.color || new THREE.Color(0x8b6f47);
                                        if (mat.color.getHex() === 0xffffff) {
                                            mat.color = new THREE.Color(0x8b6f47); // Brown rod color
                                        }
                                    });
                                } else {
                                    child.material.emissive = new THREE.Color(0x664422);
                                    child.material.emissiveIntensity = 0.5;
                                    child.material.color = child.material.color || new THREE.Color(0x8b6f47);
                                    if (child.material.color.getHex() === 0xffffff) {
                                        child.material.color = new THREE.Color(0x8b6f47);
                                    }
                                }
                            }
                        }
                    });
                    
                    // Make rod bigger - scale it up more
                    this.rodModel.scale.multiplyScalar(1.5); // Make it 1.5x bigger
                    
                    console.log('Fishing rod loaded and attached. Position:', this.rodModel.position);
                    console.log('Rod world position after attachment:');
                    this.rodModel.updateMatrixWorld(true);
                    const rodWorldPos = new THREE.Vector3();
                    this.rodModel.getWorldPosition(rodWorldPos);
                    console.log('Rod world position:', rodWorldPos);
                    
                    // Create a MUCH larger visible rod helper for debugging (so we can definitely see it)
                    const rodLength = 1.5; // Visible rod length
                    const rodHelper = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.08, 0.1, rodLength, 8), // Much thicker cylinder
                        new THREE.MeshStandardMaterial({
                            color: 0xff6600, // Bright orange for maximum visibility
                            emissive: 0xff3300,
                            emissiveIntensity: 1.0,
                            side: THREE.DoubleSide
                        })
                    );
                    rodHelper.rotation.x = Math.PI / 2; // Horizontal (pointing forward)
                    rodHelper.position.set(0, 0, 0); // Position at rod base (will extend forward)
                    rodHelper.name = 'RodHelper';
                    rodHelper.renderOrder = 1000;
                    rodHelper.visible = true;
                    
                    // Attach rod helper to rod model, positioned from hand to tip
                    // Position it at the base (hand position) and point forward
                    this.rodModel.add(rodHelper);
                    rodHelper.position.set(0, 0, 0); // At rod base (hand position)
                    // The cylinder extends along +Z in local space (forward from hand)
                    // Rotation is already set to horizontal (Math.PI/2 on X axis)
                    
                    console.log('Added LARGE visible rod helper (orange cylinder) for debugging');
                    console.log('Rod helper position:', rodHelper.position);
                    console.log('Rod helper rotation:', rodHelper.rotation);
                    
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading fishing rod:', error);
                    reject(error);
                }
            );
        });
    }

    findRodTip() {
        // Search for rod tip bone
        const tryNames = ['RodTip', 'rodTip', 'tip', 'Tip', 'Rod_Tip', 'RodEnd', 'rod_tip', 'rod_end'];
        
        this.rodModel.traverse((child) => {
            if (child.isBone) {
                const name = child.name.toLowerCase();
                if (tryNames.some(tryName => name === tryName.toLowerCase())) {
                    this.rodTipBone = child;
                    console.log('Found rod tip bone:', child.name);
                    return;
                }
                
                // Try partial matches
                if (name.includes('tip') || name.includes('end') || name.includes('rod_tip')) {
                    this.rodTipBone = child;
                    console.log('Found rod tip bone by partial match:', child.name);
                }
            }
        });
        
        // If not found, calculate from geometry
        if (!this.rodTipBone) {
            this.createRodTipFallback();
        }
    }

    createRodTipFallback() {
        // Calculate rod tip from bounding box
        const box = new THREE.Box3().setFromObject(this.rodModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Find the furthest point along the rod (typically the tip)
        // Assume rod extends along +Z or +Y locally
        this.rodTipBone = new THREE.Object3D();
        this.rodTipBone.name = 'RodTipFallback';
        
        // Position at the tip of the rod (furthest point)
        const rodMaxZ = box.max.z;
        this.rodTipBone.position.set(0, 0, rodMaxZ - center.z);
        
        this.rodModel.add(this.rodTipBone);
        console.log('Created fallback rod tip bone');
    }

    createBobber() {
        // Create simple bobber geometry (smaller, more realistic size)
        const geometry = new THREE.SphereGeometry(0.08, 16, 16); // Smaller bobber
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000, // Bright red bobber
            roughness: 0.2,
            metalness: 0.3,
            emissive: 0xff0000, // Red glow for visibility
            emissiveIntensity: 0.3
        });
        
        this.bobber = new THREE.Mesh(geometry, material);
        this.bobber.visible = false;
        this.bobber.castShadow = true;
        this.bobber.receiveShadow = true;
        this.bobber.name = 'Bobber';
        this.sceneRef.scene.add(this.bobber);
        console.log('Bobber created - size:', 0.08);
    }

    createFishingLine() {
        // Create line using TubeGeometry that will be updated dynamically
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -5, 0)
        ], false);
        
        // Make line thinner (more realistic fishing line thickness)
        const geometry = new THREE.TubeGeometry(curve, 20, 0.008, 8, false); // Thinner line
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // White fishing line
            roughness: 0.8,
            metalness: 0.1,
            emissive: 0x444444, // Subtle glow for visibility
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide // Visible from both sides
        });
        
        this.fishingLine = new THREE.Mesh(geometry, material);
        this.fishingLine.visible = false;
        this.fishingLine.name = 'FishingLine';
        this.fishingLine.renderOrder = 999; // Render on top
        this.sceneRef.scene.add(this.fishingLine);
        console.log('Fishing line created - thickness:', 0.008);
    }

    cast() {
        console.log('Cast called! isCasting:', this.isCasting, 'isReeling:', this.isReeling);
        
        if (this.isCasting || this.isReeling) {
            console.log('Cannot cast - already casting or reeling');
            return;
        }
        
        const rodTip = this.getRodTip();
        if (!rodTip) return;
        
        this.isCasting = true;
        this.castT = 0;
        
        // Set rope states
        if (this.rope) {
            this.rope.setFloating(false);
            this.rope.setFlying(true);
        }
        
        // Get rod tip position
        const rodTipWorld = this.getRodTipPosition();
        this.castStart.copy(rodTipWorld);
        this.castStart.y += 0.02;
        
        // Get random spot on-screen using camera raycasting
        this.currentTarget = this.randomOnscreenWaterPoint();
        this.castEnd.copy(this.currentTarget);
        this.castEnd.y = this.water.waterY + 0.1;
        
        // Generous rope length so constraints don't yank back mid-flight
        // Pin last node during flight to prevent spring-back
        if (this.rope) {
            this.rope.ropeLen = this.castStart.distanceTo(this.castEnd) * 1.06;
            this.rope.create(); // Recreate rope for new length
            // Pin last node while flying
            if (this.rope.rope.length > 0) {
                const lastNode = this.rope.rope[this.rope.rope.length - 1];
                lastNode.invMass = 0; // Pin it during flight
            }
        }
        
        // Position bobber at start
        this.bobber.position.copy(this.castStart);
        this.bobber.visible = false;
        if (this.fishingLine) this.fishingLine.visible = false;
        
        // Animate rod casting
        this.animateCast();
    }

    animateCast() {
        // Simple rod animation - rotate back then forward
        if (this.rodModel && !this.castAnimation) {
            this.castAnimation = { phase: 0, duration: 0.5 };
        }
    }

    update(delta) {
        // Update rod tip world position first
        if (this.rodModel && this.rodTipBone) {
            this.cat.getModel().updateMatrixWorld(true);
            this.rodModel.updateMatrixWorld(true);
            this.rodTipBone.updateMatrixWorld(true);
        }
        
        // Update temp rod position and position left hand at handle (if using temp rod)
        if (this.tempRodTip && !this.rodModel) {
            const catModel = this.cat?.getModel();
            if (catModel) {
                catModel.updateMatrixWorld(true);
                
                // Find temp rod root by traversing up parent chain
                let tempRodRoot = this.tempRodTip;
                while (tempRodRoot.parent && tempRodRoot.parent !== this.sceneRef.scene && tempRodRoot.parent.type !== 'Scene') {
                    tempRodRoot = tempRodRoot.parent;
                }
                if (tempRodRoot.parent && tempRodRoot.parent.type === 'Group') {
                    tempRodRoot = tempRodRoot.parent;
                }
                
                // Position rod relative to cat's body (not hand) to avoid circular dependency
                // Get cat's chest/shoulder position as reference
                const leftHandBone = this.cat.leftHandBone || this.cat.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'handl' || (b.name.toLowerCase().includes('hand') && b.name.toLowerCase().includes('l'))));
                const leftShoulderBone = this.cat.leftShoulderBone || this.cat.getAllBones().find(b => b.name && b.name.toLowerCase() === 'shoulderl');
                
                if (leftHandBone && leftShoulderBone) {
                    // Get shoulder position as reference (more stable than hand)
                    leftShoulderBone.updateMatrixWorld(true);
                    const shoulderWorldPos = new THREE.Vector3();
                    leftShoulderBone.getWorldPosition(shoulderWorldPos);
                    const shoulderWorldQuat = new THREE.Quaternion();
                    leftShoulderBone.getWorldQuaternion(shoulderWorldQuat);
                    
                    // Position rod relative to shoulder (in front of cat)
                    // Offset: forward from shoulder, slightly right, slightly down
                    const forwardOffset = new THREE.Vector3(0, 0, 0.15); // Forward from shoulder
                    const rightOffset = new THREE.Vector3(0.04, 0, 0); // Slightly right
                    const downOffset = new THREE.Vector3(0, -0.08, 0); // Slightly down
                    const offsetWorld = forwardOffset.clone()
                        .add(rightOffset)
                        .add(downOffset)
                        .applyQuaternion(shoulderWorldQuat);
                    
                    tempRodRoot.position.copy(shoulderWorldPos).add(offsetWorld);
                    
                    // Apply rod aiming (45° tilt, 180° flip)
                    const catForward = new THREE.Vector3(0, 0, 1)
                        .applyQuaternion(catModel.getWorldQuaternion(new THREE.Quaternion()));
                    catForward.y = 0;
                    if (catForward.lengthSq() < 1e-6) catForward.set(0, 0, 1);
                    catForward.normalize();
                    const tilt = THREE.MathUtils.degToRad(45);
                    const up = new THREE.Vector3(0, 1, 0);
                    const dir = catForward.clone().multiplyScalar(Math.cos(tilt))
                        .addScaledVector(up, Math.sin(tilt)).normalize();
                    const currentRodDir = new THREE.Vector3(0, 1, 0);
                    let q = new THREE.Quaternion().setFromUnitVectors(currentRodDir, dir);
                    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
                    tempRodRoot.quaternion.copy(q);
                    
                    // Update rod matrices to get accurate handle position
                    tempRodRoot.updateMatrixWorld(true);
                    
                    // Find handle group in rod hierarchy
                    // Handle is a Group named 'RodHandle' that's a direct child of rodRoot
                    let rodHandle = null;
                    tempRodRoot.children.forEach((child) => {
                        if (child.name === 'RodHandle' || (child.type === 'Group' && child.name && child.name.toLowerCase().includes('handle'))) {
                            rodHandle = child;
                        }
                    });
                    // If not found by name, get first Group child (handle should be first)
                    if (!rodHandle) {
                        rodHandle = tempRodRoot.children.find(child => child.type === 'Group');
                    }
                    
                    // If handle found, calculate position at (0, 0.25, 0) in handle's local space
                    if (rodHandle) {
                        rodHandle.updateMatrixWorld(true);
                        const handleLocalPos = new THREE.Vector3(0, 0.25, 0); // Handle position where hand should grip (0.25 units up from handle bottom)
                        // Transform local position to world space
                        const handleWorldPos = handleLocalPos.clone().applyMatrix4(rodHandle.matrixWorld);
                        
                        // Debug logging (only once)
                        if (!this._handlePosLogged) {
                            console.log('[FISHING] Handle position for left hand:');
                            console.log('  Handle local pos:', handleLocalPos);
                            console.log('  Handle world pos:', handleWorldPos);
                            this._handlePosLogged = true;
                        }
                        
                        // Get rod's world rotation for hand orientation
                        const rodWorldQuat = new THREE.Quaternion();
                        tempRodRoot.getWorldQuaternion(rodWorldQuat);
                        
                        // Position left hand at handle position with tight static grip
                        // Call every frame to keep hand positioned correctly
                        if (this.cat.positionLeftHandAtHandle) {
                            this.cat.positionLeftHandAtHandle(handleWorldPos, rodWorldQuat);
                        }
                    } else {
                        if (!this._handleNotFoundWarned) {
                            console.warn('[FISHING] Rod handle not found - cannot position left hand');
                            this._handleNotFoundWarned = true;
                        }
                    }
                } else {
                    // Fallback: use cat model position with hand offset
                    const catPos = new THREE.Vector3();
                    catModel.getWorldPosition(catPos);
                    tempRodRoot.position.set(catPos.x, catPos.y + 0.8, catPos.z);
                }
            }
        }
        
        // Update casting animation - parabolic arc to target
        if (this.isCasting) {
            this.castT += delta * 0.9; // Casting speed
            const t = Math.min(1, this.castT);
            
            // Rod animation (if GLB rod exists) - use pivot for rotation, not mesh directly
            if (this.castAnimation && this.rodModel && this.cat.getModel()) {
                this.castAnimation.phase += delta;
                const rodT = Math.min(this.castAnimation.phase / 1.0, 1);
                
                // Use pivot for animation if available, otherwise fall back to mesh
                const rodPivot = this.rodModel.userData.pivot || this.rodPivot;
                const targetObj = rodPivot || this.rodModel;
                
                if (rodT < 0.3) {
                    // Back swing
                    const backT = rodT / 0.3;
                    targetObj.rotation.x = Math.sin(backT * Math.PI) * 0.5;
                } else if (rodT < 0.7) {
                    // Forward cast
                    const forwardT = (rodT - 0.3) / 0.4;
                    targetObj.rotation.x = -Math.sin(forwardT * Math.PI) * 0.8;
                    
                    // Show bobber when rod swings forward
                    if (rodT >= 0.4 && !this.bobber.visible) {
                        this.bobber.visible = true;
                        // Only show rope line, not old fishing line
                        if (this.rope && this.rope.lineMesh) {
                            this.rope.lineMesh.visible = true;
                        }
                    }
                } else {
                    // Return to rest
                    const restT = (rodT - 0.7) / 0.3;
                    targetObj.rotation.x = -Math.sin(restT * Math.PI) * 0.8 * (1 - restT);
                }
                
                // Skip aiming during casting animation
                // Continue to cast trajectory but skip aiming
            }
            
            // Parabolic arc trajectory
            const ARC_SCALE = this.rope ? this.rope.ARC_SCALE : 0.10;
            const p = new THREE.Vector3().lerpVectors(this.castStart, this.castEnd, t);
            const arc = Math.sin(Math.PI * t) * (6 + this.castStart.distanceTo(this.castEnd) * ARC_SCALE);
            p.y = THREE.MathUtils.lerp(this.castStart.y, this.water.waterY + 0.1, t) + arc;
            
            // Clamp position during flight
            this.clampToCastBounds(p);
            
            // Drive last node/bobber during flight
            if (this.rope && this.rope.rope.length > 0) {
                const lastNode = this.rope.rope[this.rope.rope.length - 1];
                lastNode.pos.copy(p);
                lastNode.prev.copy(p); // Zero velocity for pinned node
                
                // Keep rope long enough during flight
                const tip = this.rope.rope[0].pos;
                this.rope.ropeLen = Math.max(this.rope.ropeLen, tip.distanceTo(lastNode.pos) * 1.02);
            }
            
            this.bobber.position.copy(p);
            
            // Show bobber and rope line after initial delay
            if (t > 0.1) {
                this.bobber.visible = true;
                if (this.rope && this.rope.lineMesh) {
                    this.rope.lineMesh.visible = true;
                }
                // Ensure old fishing line stays hidden during cast
                if (this.fishingLine) {
                    this.fishingLine.visible = false;
                }
            }
            
            // Check if cast completed
            if (t >= 1) {
                this.isCasting = false;
                
                if (this.rope && this.rope.rope.length > 0) {
                    // Get tip and bobber positions
                    const rodTip = this.getRodTip();
                    if (rodTip) {
                        rodTip.updateMatrixWorld(true);
                    }
                    const tipWorld = this.getRodTipPosition();
                    const bobberPos = this.bobber.position.clone();
                    
                    // Compute straight distance and set rope length with 2% slack
                    const straightDist = tipWorld.distanceTo(bobberPos);
                    this.rope.ropeLen = straightDist * 1.02;
                    
                    // Bake all rope nodes along straight path from tip to bobber
                    // This prevents elastic snap by starting with rope already taut
                    for (let i = 0; i <= this.rope.ROPE_SEGMENTS; i++) {
                        const t = i / this.rope.ROPE_SEGMENTS;
                        const node = this.rope.rope[i];
                        node.pos.lerpVectors(tipWorld, bobberPos, t);
                        node.prev.copy(node.pos); // Zero velocity - starts taut with no snap
                    }
                    
                    // Unpin last node now that it's positioned
                    const lastNode = this.rope.rope[this.rope.rope.length - 1];
                    lastNode.invMass = 1;
                    
                    // Switch states
                    this.rope.setFlying(false);
                    this.rope.setFloating(true);
                    
                    // Post-splash strong damping
                    this.bobber.userData.freeze = this.rope.LAND_FREEZE_TIME;
                    
                    // Ensure reeling doesn't auto-start after landing
                    this.isReeling = false;
                    this.rope.setReeling(false);
                }
                
                // Clamp to cast bounds
                this.clampToCastBounds(this.bobber.position);
                
                // Set floating state
                this.bobber.userData.floating = true;
                
                // Trigger splash effects (visual only - temporarily disable sound from splash system)
                if (this.splash) {
                    // Temporarily disable splash system sound so only bobber_splash plays
                    const originalSoundManager = this.splash.soundManager;
                    this.splash.soundManager = null;
                    this.splash.trigger(this.bobber.position);
                    // Restore sound manager after trigger (for other splashes)
                    this.splash.soundManager = originalSoundManager;
                }
                
                // Play ONLY bobber splash sound when bobber lands during cast
                // This is the ONLY sound that should play on cast
                if (this.sfx && this.bobber) {
                    this.sfx.play3D("bobber_splash", this.bobber.position, this.sceneRef.scene, 0.9, 1.0);
                }
                
                // Trigger water ripple at bobber position
                if (this.water && this.water.mesh && this.water.mesh.splashAt) {
                    this.water.mesh.splashAt(this.bobber.position.x, this.bobber.position.z);
                }
                
                // Initialize wake tracking when bobber lands
                if (this.bobber) {
                    this.lastBobberPos.copy(this.bobber.position);
                    this.wakeTimer = 0;
                }
                
                // Make rope line visible
                if (this.rope && this.rope.lineMesh) {
                    this.rope.lineMesh.visible = true;
                }
                
                // ALWAYS ensure old fishing line is hidden when rope is active
                // This prevents double line rendering
                if (this.fishingLine) {
                    this.fishingLine.visible = false;
                }
                
                // Button state is handled by UI system (no reel buttons)
            }
        }
        // Rope handles line updates - old line system is fallback only
        
        // ALWAYS ensure old fishing line is hidden when rope is active
        // This prevents double line rendering
        // Check multiple times to ensure it stays hidden
        if (this.rope && this.fishingLine) {
            this.fishingLine.visible = false;
        }
        if (this.rope && this.rope.lineMesh && this.rope.lineMesh.visible && this.fishingLine) {
            this.fishingLine.visible = false; // Double-check: if rope line is visible, old line must be hidden
        }
        
        // Aim rod forward with 45° tilt above water (ONLY when not casting)
        // Do this AFTER all casting logic to avoid overriding cast animation
        // This runs every frame when not casting, so the rod stays aimed correctly
        if (!this.isCasting) {
            // If using GLB rod with pivot system
            if (this.rodModel && this.cat?.getModel) {
                const catModel = this.cat.getModel();
                catModel.updateMatrixWorld(true); // Ensure world matrices are up to date
                
                // Debug: Check if pivot exists (first time only)
                if (!this._rodPivotWarningShown) {
                    if (!this.rodModel.userData?.pivot && !this.rodPivot) {
                        console.warn('⚠️ Rod has no pivot - aiming may not work. Using fallback rotation.');
                        this._rodPivotWarningShown = true;
                    }
                }
                
                // Aim rod with 45° tilt (45° angle to water surface), add micro sway if idle
                const isIdle = !this.isCasting && !this.isReeling;
                aimRodForwardAt45(catModel, this.rodModel, { 
                    tiltDeg: 45, // 45° angle above horizontal
                    addMicroSway: isIdle,
                    isActive: !isIdle
                });
            }
            // If using temporary rod, aim it directly
            else if (this.tempRodTip && !this.rodModel) {
                // Find the temp rod root by traversing up the parent chain
                let tempRodRoot = this.tempRodTip;
                while (tempRodRoot.parent && tempRodRoot.parent !== this.sceneRef.scene && tempRodRoot.parent.type !== 'Scene') {
                    tempRodRoot = tempRodRoot.parent;
                }
                // If we hit a Group (rodRoot), use it; otherwise use the tip's direct parent
                if (tempRodRoot.parent && tempRodRoot.parent.type === 'Group') {
                    tempRodRoot = tempRodRoot.parent;
                }
                
                // REVERTED: Manual positioning relative to hand bone (not attached to bone)
                // This prevents visibility issues and cat position drift
                const handBone = tempRodRoot.userData?.handBone;
                const catModel = this.cat?.getModel();
                
                if (handBone && catModel && tempRodRoot) {
                    // Update matrices
                    catModel.updateMatrixWorld(true);
                    handBone.updateMatrixWorld(true);
                    
                    // Get hand bone world position and rotation
                    const handWorldPos = new THREE.Vector3();
                    handBone.getWorldPosition(handWorldPos);
                    
                    const handWorldQuat = new THREE.Quaternion();
                    handBone.getWorldQuaternion(handWorldQuat);
                    
                    // Position rod relative to hand using pivot offsets
                    // These offsets position rod in front of cat, slightly right of center
                    const rightOffset = new THREE.Vector3(0.035, 0, 0);   // slide toward cat's RIGHT
                    const upOffset = new THREE.Vector3(0, 0.015, 0);     // tiny lift above palm
                    const forwardOffset = new THREE.Vector3(0, 0, 0.090); // push in front of chest
                    
                    // Apply offsets in hand's local space
                    const offsetWorld = rightOffset.clone()
                        .add(upOffset)
                        .add(forwardOffset)
                        .applyQuaternion(handWorldQuat);
                    
                    // Position rod root at hand position + offset
                    tempRodRoot.position.copy(handWorldPos).add(offsetWorld);
                    
                    // Apply 8° cross-body yaw (for two-hand pose)
                    const crossBodyYaw = THREE.MathUtils.degToRad(8);
                    const handQuatWithYaw = handWorldQuat.clone().multiply(
                        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), crossBodyYaw)
                    );
                    
                    // Get cat's forward direction (on XZ plane)
                    const catForward = new THREE.Vector3(0, 0, 1)
                        .applyQuaternion(catModel.getWorldQuaternion(new THREE.Quaternion()));
                    catForward.y = 0;
                    if (catForward.lengthSq() < 1e-6) catForward.set(0, 0, 1);
                    catForward.normalize();
                    
                    // Build elevated direction (forward and up) - 45° angle to water surface
                    const tilt = THREE.MathUtils.degToRad(45);
                    const up = new THREE.Vector3(0, 1, 0);
                    const dir = catForward.clone().multiplyScalar(Math.cos(tilt))
                        .addScaledVector(up, Math.sin(tilt)).normalize();
                    
                    // Aim the rod root to point in this direction
                    const currentRodDir = new THREE.Vector3(0, 1, 0); // Rod extends along +Y axis
                    let q = new THREE.Quaternion().setFromUnitVectors(currentRodDir, dir);
                    
                    // Apply 180° flip around Y to correct backward orientation
                    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
                    
                    tempRodRoot.quaternion.copy(q);
                } else if (catModel && tempRodRoot) {
                    // Fallback: no hand bone, just aim from cat position
                    catModel.updateMatrixWorld(true);
                    const catPos = new THREE.Vector3();
                    catModel.getWorldPosition(catPos);
                    tempRodRoot.position.set(catPos.x, catPos.y + 0.8, catPos.z);
                }
                
                // Continue with rod bend logic if needed
                if (catModel && tempRodRoot) {
                    
                    // Check if fighting - apply rod bend toward bobber during fight
                    const fishInstance = this.sceneRef?.fish;
                    const isFighting = this.fishOnLine && fishInstance?.state === 'HOOKED_FIGHT' && this.bobber?.visible;
                    
                    if (isFighting && this.bobber && this.tempRodTip) {
                        // Get bobber position in world space
                        const bobberWorldPos = new THREE.Vector3();
                        this.bobber.getWorldPosition(bobberWorldPos);
                        
                        // Get rod tip position in world space
                        const rodTipWorldPos = new THREE.Vector3();
                        this.tempRodTip.getWorldPosition(rodTipWorldPos);
                        
                        // Calculate direction from rod tip to bobber
                        const toBobber = bobberWorldPos.clone().sub(rodTipWorldPos);
                        const distance = toBobber.length();
                        
                        if (distance > 0.1) { // Only bend if bobber is far enough away
                            toBobber.normalize();
                            
                            // Max bend distance for scaling bend amount
                            const maxBendDistance = 10.0;
                            
                            // Get bobber direction in rod root's local space
                            const localBobberPos = bobberWorldPos.clone();
                            tempRodRoot.worldToLocal(localBobberPos);
                            const localRodTipPos = rodTipWorldPos.clone();
                            tempRodRoot.worldToLocal(localRodTipPos);
                            
                            // Calculate offset from rod tip to bobber in local space
                            const localOffset = localBobberPos.clone().sub(localRodTipPos);
                            
                            // Rod extends along +Y in local space
                            // Calculate how far left/right the bobber is relative to rod forward (+Y)
                            // X axis: left (-X) or right (+X)
                            // Z axis: forward/backward (not used for side bend)
                            
                            // Get the projection onto the XZ plane (perpendicular to rod +Y)
                            // We want to know how far left/right the bobber is
                            const xzOffset = new THREE.Vector3(localOffset.x, 0, localOffset.z);
                            const lateralDistance = xzOffset.length();
                            
                            // Calculate lateral direction (left or right)
                            // X component tells us: negative = left, positive = right
                            // Normalize to get direction, then use X component to determine bend direction
                            const lateralDir = lateralDistance > 0.01 ? xzOffset.normalize() : new THREE.Vector3(0, 0, 1);
                            
                            // Calculate bend amount based on how far off-center the bobber is
                            // More distance from center = more bend
                            // Use X component to determine left (-) or right (+)
                            const maxLateralDistance = 8.0; // Maximum expected lateral distance for full bend
                            const lateralFactor = Math.min(1.0, lateralDistance / maxLateralDistance);
                            
                            // Bend direction: 
                            // - Bobber at +X (right of rod): need negative Z rotation to bend right (toward +X)
                            // - Bobber at -X (left of rod): need positive Z rotation to bend left (toward -X)
                            // Invert the X component because positive Z rotation bends away from +X (toward -X)
                            // So negative X (left) = positive rotation (bends toward left), positive X (right) = negative rotation (bends toward right)
                            const bendDirection = -lateralDir.x; // Invert: negative X (left) = positive rotation, positive X (right) = negative rotation
                            
                            // Calculate bend amount based on lateral distance, fish distance, and fish weight
                            // Closer fish = more visible bend, further fish = less visible
                            // Bigger fish = more dramatic bend
                            // Maximum bend when fish is at max lateral distance
                            const baseMaxBendAngle = THREE.MathUtils.degToRad(18); // Increased from 15 to 18 degrees for slightly more bend
                            const distanceFactor = Math.min(1.0, 1.0 - (distance / maxBendDistance) * 0.3); // Slight reduction for far fish
                            
                            // Scale bend amount based on fish weight - bigger fish = more dramatic bend
                            // Small fish (1-3 lbs): base bend (1.0x)
                            // Medium fish (3-6 lbs): 1.2x bend
                            // Big fish (6-10 lbs): 1.5x bend
                            // Large fish (10-20 lbs): 1.8x bend
                            // Trophy fish (20+ lbs): 2.2x bend
                            let weightMultiplier = 1.0; // Default for small fish
                            if (fishInstance?.currentFish?.weight) {
                                const fishWeight = fishInstance.currentFish.weight;
                                if (fishWeight < 3.0) {
                                    weightMultiplier = 1.0; // Small fish: base bend
                                } else if (fishWeight < 6.0) {
                                    weightMultiplier = 1.2; // Medium fish: 20% more bend
                                } else if (fishWeight < 10.0) {
                                    weightMultiplier = 1.5; // Big fish: 50% more bend
                                } else if (fishWeight < 20.0) {
                                    weightMultiplier = 1.8; // Large fish: 80% more bend
                                } else {
                                    weightMultiplier = 2.2; // Trophy fish: 120% more bend (very dramatic)
                                }
                            }
                            
                            // Calculate final bend amount with weight scaling
                            const maxBendAngle = baseMaxBendAngle * weightMultiplier;
                            const bendAmount = maxBendAngle * lateralFactor * distanceFactor;
                            
                            // Calculate final bend angle with direction
                            const baseBendAngle = bendAmount * bendDirection;
                            
                            // Traverse up from tip to find all blank sections (now 7 sections)
                            // Collect all blank sections in order from tip to base
                            const blankSections = [];
                            let current = this.tempRodTip.parent; // Should be blank7 (tip)
                            
                            while (current && current !== tempRodRoot) {
                                const name = current.name || '';
                                if (name.includes('Blank') || name.includes('RodBlank')) {
                                    blankSections.push(current);
                                }
                                current = current.parent;
                            }
                            
                            // blankSections is now ordered from tip (index 0) to base (index 6)
                            // blankSections[0] = blank7 (tip), blankSections[6] = blank1 (base)
                            
                            // Apply progressive bend to all 7 blank sections with fluid sway
                            // Reduced bend percentages for more natural look
                            // Progressive percentages: 90%, 75%, 60%, 45%, 30%, 15%, 5%
                            const bendPercentages = [0.9, 0.75, 0.60, 0.45, 0.30, 0.15, 0.05];
                            
                            // Add fluid sway - oscillate the bend slightly for natural movement
                            // Use time-based animation for smooth, fluid sway
                            this.rodBendTime += delta;
                            const swayFrequency = 2.5; // How fast the sway oscillates
                            const swayAmplitude = 0.15; // How much extra movement (15% variation)
                            const sway1 = Math.sin(this.rodBendTime * swayFrequency) * swayAmplitude;
                            const sway2 = Math.sin(this.rodBendTime * swayFrequency * 1.7) * swayAmplitude * 0.5;
                            const totalSway = (sway1 + sway2) * 1.5; // Combined sway for fluidity
                            
                            // Apply bend with smooth interpolation and fluid sway
                            for (let i = 0; i < blankSections.length && i < bendPercentages.length; i++) {
                                const section = blankSections[i];
                                const sectionId = section.uuid || section.name;
                                
                                // Calculate target bend with sway
                                const bendPercent = bendPercentages[i];
                                const targetBend = baseBendAngle * bendPercent;
                                
                                // Add sway - more sway at tip (full), less at base (reduced)
                                const swayFactor = 1.0 - (i / blankSections.length) * 0.7; // Tip gets full sway, base gets 30%
                                const swayedBend = targetBend + (totalSway * targetBend * swayFactor);
                                
                                // Store target in state for interpolation
                                if (!this.rodBendState[sectionId]) {
                                    this.rodBendState[sectionId] = { current: 0, target: 0 };
                                }
                                this.rodBendState[sectionId].target = swayedBend;
                                
                                // Smooth interpolation for fluid movement (lerp toward target)
                                const lerpSpeed = 12.0; // How fast sections respond (higher = snappier)
                                const current = this.rodBendState[sectionId].current;
                                const target = this.rodBendState[sectionId].target;
                                const lerped = THREE.MathUtils.lerp(current, target, lerpSpeed * delta);
                                this.rodBendState[sectionId].current = lerped;
                                
                                // Apply smooth, interpolated bend
                                section.rotation.z = lerped;
                            }
                            
                            // Handle stays straight (rotation.z = 0, inherits parent rotation only)
                        }
                    } else {
                        // Not fighting - smoothly reset rod bend rotations and add micro sway if idle
                        // Reset bend state
                        this.rodBendTime = 0; // Reset sway timer
                        
                        // Smoothly lerp all sections back to zero rotation
                        let current = this.tempRodTip?.parent;
                        while (current && current !== tempRodRoot) {
                            const name = current.name || '';
                            if (name.includes('Blank') || name.includes('RodBlank')) {
                                const sectionId = current.uuid || current.name;
                                
                                // Initialize state if needed
                                if (!this.rodBendState[sectionId]) {
                                    this.rodBendState[sectionId] = { current: current.rotation.z || 0, target: 0 };
                                }
                                
                                // Smoothly lerp toward zero
                                this.rodBendState[sectionId].target = 0;
                                const lerpSpeed = 8.0; // Slower reset for smooth transition
                                const currentRot = this.rodBendState[sectionId].current;
                                const lerped = THREE.MathUtils.lerp(currentRot, 0, lerpSpeed * delta);
                                this.rodBendState[sectionId].current = lerped;
                                current.rotation.z = lerped;
                            }
                            current = current.parent;
                        }
                        
                        // Add micro sway if idle
                        const isIdle = !this.isCasting && !this.isReeling;
                        if (isIdle) {
                            const t = performance.now() * 0.001;
                            // More visible sway - increased amplitude from 0.002 to 0.008 (4x more visible)
                            // Multiple frequencies for natural, organic movement
                            const sway1 = Math.sin(t * 1.2) * 0.008; // Primary slow sway
                            const sway2 = Math.sin(t * 2.1) * 0.004; // Secondary faster component
                            const sway3 = Math.sin(t * 0.8) * 0.003; // Slow drift component
                            const microSway = sway1 + sway2 + sway3; // Combined sway for natural movement
                            
                            // Apply Z-axis rotation (side-to-side sway)
                            const swayQuatZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), microSway);
                            tempRodRoot.quaternion.multiply(swayQuatZ);
                            
                            // Add slight X-axis rotation (front-back gentle nod) for more organic feel
                            const nod = Math.sin(t * 0.9) * 0.003;
                            const nodQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), nod);
                            tempRodRoot.quaternion.multiply(nodQuat);
                        }
                    }
                }
            }
        }
        
        // Update rope simulation (handles everything)
        // Order matters: cast drives last node first (done above), then sync fish position, then reel, then substeps
        // Only update rope if not currently casting (cast drives last node directly)
        if (this.rope && !this.isCasting) {
            // FIRST: Sync fish position to bobber/rope BEFORE rope update (only during HOOKED_FIGHT)
            // During fight, fish drives bobber position
            // DON'T move bobber on first frame after hook - it's already in the right place
            const fishInstance = this.sceneRef?.fish; // Get fish instance once for all rope-related updates
            if (this.isReeling && this.fishOnLine && this.rope && this.rope.rope.length > 0 && fishInstance) {
                const fishState = fishInstance.state; // Using string states now
                if (fishState === 'HOOKED_FIGHT' && fishInstance.mesh) {
                    // Check if we're still in freeze period (use fish's freeze timer as source of truth)
                    const isFreezePeriod = fishInstance._hookFreezeTime !== undefined && fishInstance._hookFreezeTime > 0;
                    
                    // Only lock fish during freeze period - after that, let it move freely
                    if (isFreezePeriod) {
                        // Get bobber world position to ensure coordinate space match
                        const bobberWorld = new THREE.Vector3();
                        this.bobber.getWorldPosition(bobberWorld);
                        
                        // Sync rope node to current bobber position - don't move bobber
                        const lastNode = this.rope.rope[this.rope.rope.length - 1];
                        
                        // Ensure rope node is exactly at bobber world position (no movement)
                        lastNode.pos.x = bobberWorld.x;
                        lastNode.pos.z = bobberWorld.z;
                        lastNode.pos.y = bobberWorld.y;
                        // CRITICAL: Sync prev to pos to prevent physics "correction"
                        lastNode.prev.x = lastNode.pos.x;
                        lastNode.prev.z = lastNode.pos.z;
                        lastNode.prev.y = lastNode.pos.y;
                        
                        // Lock fish to bobber during freeze ONLY
                        fishInstance.mesh.position.x = bobberWorld.x;
                        fishInstance.mesh.position.z = bobberWorld.z;
                        const waterHeight = this.water.getWaterHeight(
                            fishInstance.mesh.position.x,
                            fishInstance.mesh.position.z
                        );
                        fishInstance.mesh.position.y = waterHeight - 0.25;
                        
                        return; // Skip normal sync during freeze
                    }
                    
                    // After freeze period, clear the flag once
                    if (fishInstance._justHooked) {
                        fishInstance._justHooked = false;
                        console.log('[FISHING] Freeze period ended, fish can now move');
                        console.log('[FISHING] Fish position after freeze:', fishInstance.mesh.position);
                    }
                    
                    // After freeze period ends, bobber should follow fish position as fish moves
                    // Fish drives bobber - don't lock fish position anymore
                    const lastNode = this.rope.rope[this.rope.rope.length - 1];
                    
                    // Fish position is just under bobber, so bobber should be above fish
                    const waterHeight = this.water.getWaterHeight(
                        fishInstance.mesh.position.x,
                        fishInstance.mesh.position.z
                    );
                    
                    // Smoothly lerp bobber to fish position (prevents snapping)
                    const targetX = fishInstance.mesh.position.x;
                    const targetZ = fishInstance.mesh.position.z;
                    // During fight, bobber should be below surface (submerged), not above
                    // Let the rope system handle Y position during fight (it will submerge it)
                    // Just sync X and Z to fish
                    
                    // Use lerp for smooth transition (90% per frame)
                    this.bobber.position.x = THREE.MathUtils.lerp(this.bobber.position.x, targetX, 0.9);
                    this.bobber.position.z = THREE.MathUtils.lerp(this.bobber.position.z, targetZ, 0.9);
                    // Don't lerp Y - let rope system handle submersion during fight
                    
                    // Update rope's last node to match (BEFORE substeps)
                    lastNode.pos.x = this.bobber.position.x;
                    lastNode.pos.z = this.bobber.position.z;
                    lastNode.pos.y = this.bobber.position.y;
                    // Also update prev to prevent velocity from fighting against fish position
                    lastNode.prev.x = lastNode.pos.x;
                    lastNode.prev.z = lastNode.pos.z;
                    lastNode.prev.y = lastNode.pos.y;
                }
            }
            
            if (this.isReeling) {
                this.rope.setReeling(true);
                
                // Update fighting/landing mode based on fish state (using string states)
                const fishState = fishInstance?.state || 'IDLE';
                if (fishState === 'HOOKED_FIGHT') {
                    this.rope.setFightingMode(true);
                    this.rope.setLandingMode(false);
                } else if (fishState === 'LANDING') {
                    this.rope.setFightingMode(false);
                    this.rope.setLandingMode(true);
                    
                    // During LANDING, let reel pull bobber directly - don't sync to fish
                    // The reel logic in updateReel() will pull bobber toward rod tip
                    // Fish position will follow naturally as bobber moves closer
                    // This allows bobber to get closer to dock without being clamped
                } else {
                    this.rope.setFightingMode(false);
                    this.rope.setLandingMode(false);
                }
            } else {
                this.rope.setReeling(false);
                this.rope.setFightingMode(false);
                this.rope.setLandingMode(false);
            }
            
            // Call updateReel to handle reel logic (shortens rope and nudges bobber)
            if (this.isReeling) {
                this.updateReel(delta);
            }
            
            // Update fight splash ring position every frame during HOOKED_FIGHT (independent of reeling)
            // fishInstance is already declared above (line 1140), so reuse it here
            if (fishInstance && fishInstance.state === 'HOOKED_FIGHT' && this.fightSplashRing && this.bobber && this.bobber.visible) {
                // Continuously update ring position to follow bobber
                const waterHeight = this.water.getWaterHeight(this.bobber.position.x, this.bobber.position.z);
                this.fightSplashRing.position.set(
                    this.bobber.position.x,
                    waterHeight + 0.01, // Slightly above water surface to prevent z-fighting
                    this.bobber.position.z
                );
                this.fightSplashRing.visible = true;
            } else if (this.fightSplashRing) {
                // Hide ring when fish is not fighting
                if (fishInstance && fishInstance.state !== 'HOOKED_FIGHT') {
                    this.fightSplashRing.visible = false;
                }
            }
            
            // Pass camera and time for screen clamping and surface height
            const t = this.sceneRef.clock.elapsedTime;
            this.rope.update(delta, this.sceneRef.camera, t);
            
            // Calculate line tension for rod tip wiggle (fishInstance already declared above)
            let lineTension = 0;
            
            if (this.rope && this.bobber && this.bobber.visible) {
                const rodTip = this.getRodTipPosition();
                const bobberPos = this.bobber.position;
                
                if (fishInstance && this.fishOnLine && fishInstance.state === 'HOOKED_FIGHT') {
                    // During fight: tension based on fish movement/intensity
                    const moveX = fishInstance.mesh.position.x - (fishInstance._lastPosX || fishInstance.mesh.position.x);
                    const moveZ = fishInstance.mesh.position.z - (fishInstance._lastPosZ || fishInstance.mesh.position.z);
                    const moveSpeed = Math.sqrt(moveX * moveX + moveZ * moveZ) / delta;
                    fishInstance._lastPosX = fishInstance.mesh.position.x;
                    fishInstance._lastPosZ = fishInstance.mesh.position.z;
                    
                    // Tension proportional to fish struggle (0.5 to 2.0)
                    lineTension = Math.min(2.0, moveSpeed * 0.5 + 0.5);
                } else if (this.isReeling) {
                    // While reeling: tension based on rope tautness
                    const straightDist = rodTip.distanceTo(bobberPos);
                    const ropeRatio = this.rope.ropeLen / Math.max(straightDist, 0.1);
                    // Tighter rope = more tension (0.3 to 1.5)
                    lineTension = Math.min(1.5, ropeRatio * 0.8 + 0.3);
                } else if (this.bobber.userData.floating) {
                    // Idle: minimal tension from gentle line sag
                    lineTension = 0.1;
                }
            }
            
            // Update rod tip wiggle based on tension
            if (this.rodModel || this.rodTipBone || this.tempRodTip) {
                const rod = {
                    tipBone: this.rodTipBone,
                    rodModel: this.rodModel,
                    tempRodTip: this.tempRodTip
                };
                updateRodTip(rod, lineTension, delta);
            }
            
            // Handle LANDED state - finalize catch
            if (fishInstance && fishInstance.state === 'LANDED') {
                // Fish is caught, complete the reel
                    if (!this._didFinalSplash && this.splash && this.bobber.visible) {
                        this._didFinalSplash = true;
                        
                        // Play ONLY fish caught splash sound FIRST (before visual splash)
                        // This ensures it plays and isn't affected by splash system
                        if (this.sfx && this.bobber) {
                            // Verify sound is loaded before playing
                            const soundBuffer = this.sfx.cache ? this.sfx.cache.get("fish_caught_splash") : null;
                            if (soundBuffer) {
                                this.sfx.play3D("fish_caught_splash", this.bobber.position, this.sceneRef.scene, 0.9, 1.0);
                            } else {
                                console.warn('[FISHING] fish_caught_splash sound not loaded');
                            }
                        }
                        
                        // Final splash when fish breaks water (visual only - NO sound from splash system)
                        // Completely disable splash system sound by temporarily removing soundManager
                        // Do this AFTER playing the sound file to ensure no timing issues
                        const originalSoundManager = this.splash.soundManager;
                        // Force disable soundManager to prevent pop sound
                        this.splash.soundManager = null;
                        // Trigger visual splash (no sound will play since soundManager is null)
                        this.splash.trigger(this.bobber.position);
                        // Restore sound manager immediately after trigger (for other splashes)
                        this.splash.soundManager = originalSoundManager;
                        
                        // Trigger water ripple at bobber position
                        if (this.water && this.water.mesh && this.water.mesh.splashAt) {
                            this.water.mesh.splashAt(this.bobber.position.x, this.bobber.position.z);
                        }
                    
                    for (let i = 0; i < 2; i++) {
                        setTimeout(() => {
                            if (this.splash) {
                                this.splash.triggerRipple(this.bobber.position);
                            }
                            // Additional water ripples during fight
                            if (this.water && this.water.mesh && this.water.mesh.splashAt) {
                                this.water.mesh.splashAt(this.bobber.position.x, this.bobber.position.z);
                            }
                        }, i * 100);
                    }
                }
            }
        } else if (this.rope && this.isCasting) {
            // During cast: skip rope physics entirely, just render kinematic line
            // Cast drives last node directly, render simple 3-point curve
            this.rope.updateLineGeometry(delta);
        } else {
            // Fallback to old system if rope not available
            if (this.isReeling) {
                this.updateReel(delta);
            }
            
            // Update bobber floating (gentle drift + surface pinning)
            // Also handle bite strike animation
            if (!this.isCasting && this.bobber.visible && !this.isReeling && this.bobber.userData.floating) {
                const time = this.sceneRef.clock.elapsedTime;
                
                // Check for bite strike animation
                if (this.bobber.userData.biteStrike) {
                    // Bite strike animation - dramatic bobber movement
                    const strikeTime = this.bobber.userData.biteStrikeTime || 0;
                    const strikeElapsed = time - strikeTime;
                    const strikeDuration = 0.8; // 0.8 seconds
                    
                    if (strikeElapsed < strikeDuration) {
                        // Dramatic strike animation
                        const strikeT = strikeElapsed / strikeDuration;
                        const strikeAmplitude = Math.sin(strikeT * Math.PI * 4) * 0.15 * (1 - strikeT);
                        this.bobber.position.y += strikeAmplitude * delta * 10;
                        
                        // Rotation animation
                        this.bobber.rotation.z = Math.sin(strikeT * Math.PI * 6) * 0.3 * (1 - strikeT);
                    } else {
                        // Clear strike animation after duration
                        this.bobber.userData.biteStrike = false;
                        this.bobber.userData.biteStrikeTime = null;
                        this.bobber.rotation.z = 0;
                    }
                }
                
                // Gentle drift (only if not in bite strike)
                if (!this.bobber.userData.biteStrike) {
                    const driftX = Math.sin(time * 0.35) * 0.12 * delta;
                    const driftZ = Math.cos(time * 0.27) * 0.12 * delta;
                    this.bobber.position.x += driftX;
                    this.bobber.position.z += driftZ;
                    this.clampToCastBounds(this.bobber.position);
                }
                
                // Pin to surface height
                const waterHeight = this.water.getWaterHeight(
                    this.bobber.position.x,
                    this.bobber.position.z
                );
                this.bobber.position.y = waterHeight + 0.12;
                
                // Idle bobber wake - periodic gentle ripples
                this.idleWakeTimer += delta;
                if (this.idleWakeTimer >= this.idleWakeInterval) {
                    if (this.water && this.water.mesh && this.water.mesh.splashAt) {
                        this.water.mesh.splashAt(this.bobber.position.x, this.bobber.position.z);
                    }
                    this.idleWakeTimer = 0;
                }
            }
            
            // Update old fishing line if rope not available (fallback only, keep hidden)
            if (!this.isCasting && !this.isReeling) {
                // ALWAYS keep old line hidden when rope is active - prevents double line
                if (this.rope && this.fishingLine) {
                    this.fishingLine.visible = false;
                }
                // Only update/show old line if rope is not available (fallback only)
                if (!this.rope && this.fishingLine && this.fishingLine.visible && this.getRodTip() && this.bobber && this.bobber.visible) {
                    this.updateFishingLine();
                }
            }
            
            // Additional safety check: ALWAYS hide fishingLine when rope is active
            // This prevents double line rendering at any point
            if (this.rope && this.fishingLine && this.fishingLine.visible) {
                this.fishingLine.visible = false;
            }
        }
    }

    updateFishingLine() {
        const rodTip = this.getRodTip();
        if (!rodTip || !this.bobber || !this.fishingLine) return;
        if (!this.bobber.visible) return;
        
        // Never show old line when rope is active
        if (this.rope) {
            this.fishingLine.visible = false;
            return;
        }
        
        // Get world positions
        const tip = this.getRodTipPosition();
        let end = this.bobber.position.clone();
        
        // Clamp end horizontally to bounds to avoid wild curves
        this.clampToCastBounds(end);
        
        // Calculate mid-point with sag
        const mid = tip.clone().lerp(end, 0.5);
        mid.y -= Math.min(1.8, tip.distanceTo(end) * 0.22); // Sag
        
        // Create curve from tip to bobber with sag
        const curve = new THREE.CatmullRomCurve3([tip, mid, end], false, 'catmullrom', 0.5);
        
        // Update geometry
        try {
            if (this.fishingLine.geometry) {
                this.fishingLine.geometry.dispose();
            }
            this.fishingLine.geometry = new THREE.TubeGeometry(curve, 32, 0.008, 6, false);
            // Always hide old fishing line when using rope system
            this.fishingLine.visible = false; // Use rope instead, never show old line
            this.fishingLine.frustumCulled = false;
        } catch (error) {
            console.warn('Error updating fishing line geometry:', error);
        }
    }

    reel() {
        console.log('[FISHING] reel() called, isReeling:', this.isReeling, 'bobber.visible:', this.bobber?.visible, 'fishOnLine:', this.fishOnLine);
        if (this.isReeling || !this.bobber.visible) {
            console.log('[FISHING] reel() early return - isReeling:', this.isReeling, 'bobber.visible:', this.bobber?.visible);
            return;
        }
        
        // CRITICAL: Stop any active cast tween immediately - this causes the snap!
        if (this.isCasting) {
            this.isCasting = false;
            this.castT = 1.0; // Complete the cast tween
            console.log('[FISHING] Stopped cast tween on hook');
        }
        
        this.isReeling = true;
        console.log('[FISHING] isReeling set to:', this.isReeling);
        if (this.rope) {
            this.rope.setReeling(true);
            // Set slower reel rate if fighting fish
            if (this.fishOnLine) {
                this.rope.setFightingMode(true);
                console.log('[FISHING] Rope fighting mode set to true');
                // Freeze rope physics for 120ms to prevent snap
                this.rope._hookFreezeTime = 0.12;
            } else {
                this.rope.setFightingMode(false);
                console.log('[FISHING] Rope fighting mode set to false');
            }
        }
        // Button state is handled by UI system (no reel buttons)
    }
    
    setFishOnLine(value) {
        console.log('[FISHING] setFishOnLine:', value);
        this.fishOnLine = value;
        if (this.rope) {
            this.rope.setFightingMode(value);
        }
        // Set bobber hooked flag for idle bounce/tug logic
        if (this.bobber) {
            this.bobber.userData.isHooked = value;
        }
        // Start jiggle animation
        if (value) {
            this.bobberJiggleTime = 0;
            this.fightSplashTimer = 0;
        }
    }

    // Reel speed constants
    REEL_RATE_BASE = 3.2;               // no-fish reel-in (m/s along rope)
    REEL_RATE_FIGHT = 2.08;             // REEL_RATE_BASE * 0.65 - slower while fighting
    REEL_RATE_LANDING = 1.25;             // Slow speed during landing (half speed for smoother final reel-in)
    
    updateReel(delta) {
        const fish = this.sceneRef?.fish;
        
        // Skip reel updates during hook freeze period to prevent snap
        if (this.rope?._hookFreezeTime !== undefined && this.rope._hookFreezeTime > 0) {
            return; // Don't reel during freeze
        }
        
        // Play reel sound during reeling
        // Use fishing reel sound when fighting fish, regular reel sound otherwise
        // Stop immediately when fish is caught (LANDED state)
        const isFishCaught = fish && fish.state === 'LANDED';
        
        // Stop all active reel sounds immediately when fish is caught
        if (isFishCaught && this._activeReelSounds.length > 0) {
            this._activeReelSounds.forEach(soundObj => {
                if (soundObj.sound && soundObj.sound.isPlaying) {
                    soundObj.sound.stop();
                    soundObj.sound.disconnect();
                }
                if (soundObj.container && this.sceneRef && this.sceneRef.scene) {
                    this.sceneRef.scene.remove(soundObj.container);
                }
            });
            this._activeReelSounds = [];
            this._reelSoundTimer = 0;
        }
        
        if (this.isReeling && this.sfx && !isFishCaught) {
            if (!this._reelSoundTimer) this._reelSoundTimer = 0;
            this._reelSoundTimer += delta;
            
            // Check if fighting a fish
            const isFighting = this.fishOnLine && fish && fish.state === 'HOOKED_FIGHT';
            
            // Use shorter interval for fighting (more intense) or longer for normal reeling
            const reelSoundInterval = isFighting ? 0.25 : 0.35; // Faster when fighting
            
            if (this._reelSoundTimer >= reelSoundInterval) {
                // Get rod tip position for 3D sound
                const rodTip = this.getRodTip();
                let rodTipPos = null;
                if (rodTip) {
                    rodTipPos = new THREE.Vector3();
                    rodTip.getWorldPosition(rodTipPos);
                } else {
                    // Fallback to temp rod position
                    rodTipPos = this.getRodTipPosition();
                }
                
                if (rodTipPos && this.sceneRef && this.sfx && isFighting) {
                    // Only play reel sound when fighting fish
                    const volume = 0.5; // Increased volume for better audibility
                    
                    // Play sound and track it so we can stop it
                    // Use new cache key to bypass browser cache
                    const soundName = "reel_fight_new";
                    // NO FALLBACK - only use the new sound
                    const buffer = this.sfx.cache ? this.sfx.cache.get(soundName) : null;
                    
                    // Verify buffer exists and has correct duration
                    if (!buffer) {
                        this._reelSoundTimer = 0; // Reset timer
                        return; // Don't play anything if we don't have the correct sound
                    }
                    
                    // Verify it's the correct file (18.36s) - silently skip if wrong
                    if (buffer.duration < 18 || buffer.duration > 19) {
                        this._reelSoundTimer = 0; // Reset timer
                        return; // Don't play wrong file
                    }
                    
                    // Clean up any sounds that have finished playing
                    if (this._activeReelSounds && this._activeReelSounds.length > 0) {
                        this._activeReelSounds = this._activeReelSounds.filter(soundObj => {
                            if (soundObj.sound && soundObj.sound.isPlaying) {
                                return true; // Keep playing sounds
                            } else {
                                // Clean up finished sounds
                                if (soundObj.container && this.sceneRef && this.sceneRef.scene) {
                                    this.sceneRef.scene.remove(soundObj.container);
                                }
                                return false; // Remove finished sounds
                            }
                        });
                    }
                    
                    // Only play a new sound if no sounds are currently playing
                    const hasPlayingSound = this._activeReelSounds && this._activeReelSounds.length > 0 && 
                                          this._activeReelSounds.some(s => s.sound && s.sound.isPlaying);
                    
                    if (!hasPlayingSound) {
                        // Create sound instance with the correct buffer
                        const sound = new THREE.PositionalAudio(this.sfx.listener);
                        sound.setBuffer(buffer);
                        sound.setRefDistance(8);
                        sound.setVolume(volume);
                        sound.setPlaybackRate(1.0);
                        
                        const container = new THREE.Object3D();
                        container.position.copy(rodTipPos);
                        container.add(sound);
                        this.sceneRef.scene.add(container);
                        
                        sound.play();
                        
                        // Track sound for stopping later
                        this._activeReelSounds.push({
                            sound: sound,
                            container: container
                        });
                        
                        // Auto cleanup when sound ends
                        sound.source.onended = () => {
                            if (this.sceneRef && this.sceneRef.scene) {
                                this.sceneRef.scene.remove(container);
                            }
                            // Remove from active sounds
                            const index = this._activeReelSounds.findIndex(s => s.sound === sound);
                            if (index !== -1) {
                                this._activeReelSounds.splice(index, 1);
                            }
                        };
                    }
                }
                this._reelSoundTimer = 0; // Reset timer
            }
        } else if (!this.isReeling) {
            // Stop all sounds when not reeling
            if (this._activeReelSounds.length > 0) {
                this._activeReelSounds.forEach(soundObj => {
                    if (soundObj.sound && soundObj.sound.isPlaying) {
                        soundObj.sound.stop();
                        soundObj.sound.disconnect();
                    }
                    if (soundObj.container && this.sceneRef && this.sceneRef.scene) {
                        this.sceneRef.scene.remove(soundObj.container);
                    }
                });
                this._activeReelSounds = [];
            }
            this._reelSoundTimer = 0;
        }
        
        // Get rod tip and bobber positions early (needed for wake effect check)
        const tip = this.getRodTipPosition();
        const bob = this.bobber.position;
        
        // During HOOKED_FIGHT, don't reel at all - just let fish move and bobber follow
        if (this.fishOnLine && fish) {
            const fishState = fish.state; // Now using string states
            if (fishState === 'HOOKED_FIGHT') {
                // No reeling during fight - fish drives bobber position
                // But still create wake as fish moves bobber around
                if (this.bobber && this.bobber.visible && this.water && this.water.mesh && this.water.mesh.splashAt) {
                    const currentPos = this.bobber.position;
                    const distanceMoved = currentPos.distanceTo(this.lastBobberPos);
                    
                    // DISABLED: Wake ripples during fight - user dislikes glug sound
                    // Visual ripples were causing water sounds
                    // this.wakeTimer += delta;
                    // if ((this.wakeTimer >= this.wakeInterval || distanceMoved > this.wakeDistanceThreshold) && distanceMoved > 0.1) {
                    //     this.water.mesh.splashAt(currentPos.x, currentPos.z);
                    //     if (this.splash && distanceMoved > 0.2) {
                    //         this.splash.triggerRipple(currentPos);
                    //     }
                    //     this.wakeTimer = 0;
                    //     this.lastBobberPos.copy(currentPos);
                    // }
                }
                return;
            }
        }
        
        // Create wake effect as bobber/fish moves during reeling
        // Only create wake when reeling without fish is not near completion
        // Check if we're close to dock when reeling without fish
        const isNearCompletion = !this.fishOnLine && this.isReeling && tip.distanceTo(bob) < 5.5;
        
        if (!isNearCompletion && this.bobber && this.bobber.visible && this.water && this.water.mesh && this.water.mesh.splashAt) {
            const currentPos = this.bobber.position;
            const distanceMoved = currentPos.distanceTo(this.lastBobberPos);
            
            // Update wake timer
            this.wakeTimer += delta;
            
            // Trigger wake ripples periodically along the path
            // More frequent ripples when moving faster (creating a continuous wake trail)
            if (this.wakeTimer >= this.wakeInterval || distanceMoved > this.wakeDistanceThreshold) {
                // Only trigger if bobber has moved significantly
                if (distanceMoved > 0.1) {
                    // DISABLED: Wake ripples during reeling - user dislikes glug sound
                    // Visual ripples were causing water sounds
                    // this.water.mesh.splashAt(currentPos.x, currentPos.z);
                    
                    // DISABLED: Splash ripples during reeling - user dislikes glug sound
                    // if (this.splash && distanceMoved > 0.15) {
                    //     this.splash.triggerRipple(currentPos);
                    // }
                    
                    // Reset timer and adjust interval based on movement speed
                    this.wakeTimer = 0;
                    const speed = distanceMoved / delta;
                    // Faster movement = more frequent wake ripples (shorter interval)
                    this.wakeInterval = Math.max(0.05, Math.min(0.12, 0.25 / (speed + 0.1)));
                }
                
                // Update last position for next frame
                this.lastBobberPos.copy(currentPos);
            }
        } else if (isNearCompletion) {
            // Stop wake effect when close to completion
            this.wakeTimer = 0;
            if (this.bobber) {
                this.lastBobberPos.copy(this.bobber.position);
            }
        }
        
        let reelRate = this.REEL_RATE_BASE;
        
        if (this.fishOnLine && fish) {
            const fishState = fish.state; // Now using string states
            if (fishState === 'LANDING') reelRate = this.REEL_RATE_LANDING;
        }
        
        if (!this.rope) return;
        
        // 1) shorten rope length toward the tip based on reelRate
        // (tip and bob already calculated above)
        const straight = tip.distanceTo(bob);
        // Reduce minimum rope length to allow bobber to get closer
        // During landing, allow it to get very close to ensure catch - right up to dock
        let minRopeLen = 0.3; // Same minimum for both cases
        if (this.fishOnLine && fish) {
            const fishState = fish.state;
            if (fishState === 'LANDING') {
                // During landing, allow bobber to reach perfect landing position (~8.3 units from dock)
                // Keep minRopeLen small so bobber can get close, but stop at perfect spot
                minRopeLen = 0.1; // Allows bobber to reach ~8.3 units from dock (perfect landing)
            } else if (fishState === 'HOOKED_FIGHT') {
                // During fight, maintain some distance
                minRopeLen = 0.6;
            } else {
                // Default when fish is on line
                minRopeLen = 0.4;
            }
        }
        // During landing, shorten rope faster to pull bobber to dock
        // Use dock distance for rope length calculation when landing
        let effectiveStraight = straight;
        if (this.fishOnLine && fish?.state === 'LANDING') {
            // During landing, calculate rope length based on distance to dock (where bobber should end)
            const catPos = this.cat?.getModel()?.position;
            if (catPos) {
                const dockTarget = new THREE.Vector3(catPos.x, 0, catPos.z + 0.5);
                effectiveStraight = new THREE.Vector3(dockTarget.x - bob.x, 0, dockTarget.z - bob.z).length();
            }
        }
        const targetLen = Math.max(minRopeLen, effectiveStraight - reelRate * delta);
        // Faster lerp during landing for quicker response
        const lerpRate = (fish?.state === 'LANDING') ? 0.95 : 0.85;
        this.rope.ropeLen = THREE.MathUtils.lerp(this.rope.ropeLen, targetLen, lerpRate);
        
        // 2) guarantee horizontal progress toward the tip/dock so it never "stalls"
        // During LANDING or reeling without fish, pull bobber toward dock (cat position) instead of rod tip
        // Rod tip is far from dock, so pull directly toward dock to reach same landing position
        let pullTarget = tip;
        let pullDir = new THREE.Vector3(tip.x - bob.x, 0, tip.z - bob.z);
        
        if (this.fishOnLine && fish?.state === 'LANDING') {
            // During landing with fish, pull toward dock/cat position (right in front of dock)
            const catPos = this.cat?.getModel()?.position;
            if (catPos) {
                // Pull toward a point right in front of dock (where bobber should end - ~8.3 units from dock)
                pullTarget = new THREE.Vector3(catPos.x, 0, catPos.z + 0.5); // 0.5 units in front of dock
                pullDir = new THREE.Vector3(pullTarget.x - bob.x, 0, pullTarget.z - bob.z);
            }
        } else if (!this.fishOnLine && this.isReeling) {
            // Reeling without fish - pull toward EXACT same landing position as fish
            // From logs: fish catches at bobber position (0.07, 4.05)
            // Use exact same coordinates: x=catPos.x, z=catPos.z+0.65 (matches landing z=4.05 when cat z=3.4)
            const catPos = this.cat?.getSavedPosition();
            pullTarget = new THREE.Vector3(catPos.x, bob.y, catPos.z + 0.65); // Exact same Z as fish landing
            pullDir = new THREE.Vector3(pullTarget.x - bob.x, 0, pullTarget.z - bob.z);
        }
        
        const distXZ = pullDir.length();
        if (distXZ > 1e-4) {
            pullDir.normalize();
            // During LANDING, pull much harder to get bobber closer to dock
            // When reeling without fish, also pull harder to prevent stalling
            // Note: nudgeMultiplier is increased to compensate for slower reelRate during landing
            // to keep pull strength the same (5.0 * 2.5 = 12.5, so 10.0 * 1.25 = 12.5)
            const nudgeMultiplier = (this.fishOnLine && fish?.state === 'LANDING') ? 10.0 : 
                                     (!this.fishOnLine) ? 5.0 : 0.8; // Increased to 5.0 for reeling without fish to overcome rope constraints and complete faster
            const step = Math.min(reelRate * nudgeMultiplier * delta, distXZ);
            if (this.rope.nudgeBobberXZ) {
                this.rope.nudgeBobberXZ(pullDir.x * step, pullDir.z * step);
            } else {
                // Fallback if method doesn't exist yet
                const lastNode = this.rope.rope[this.rope.rope.length - 1];
                if (lastNode) {
                    lastNode.pos.x += pullDir.x * step;
                    lastNode.pos.z += pullDir.z * step;
                }
            }
        }
        
        // Check if reel is complete
        const fishInstance = this.sceneRef?.fish;
        
        // First check: Fish caught (LANDED state)
        if (fishInstance && this.fishOnLine) {
            const fishState = fishInstance.state; // Using string states now
            if (fishState === 'LANDED') {
                // Reeling complete - fish caught
                // Stop reel sound immediately
                this.isReeling = false;
                this._reelSoundTimer = 0; // Reset reel sound timer immediately
                
                // Stop all active reel sounds immediately
                if (this._activeReelSounds && this._activeReelSounds.length > 0) {
                    this._activeReelSounds.forEach(soundObj => {
                        if (soundObj.sound && soundObj.sound.isPlaying) {
                            soundObj.sound.stop();
                            soundObj.sound.disconnect();
                        }
                        if (soundObj.container && this.sceneRef && this.sceneRef.scene) {
                            this.sceneRef.scene.remove(soundObj.container);
                        }
                    });
                    this._activeReelSounds = [];
                }
                if (this.rope) {
                    this.rope.setReeling(false);
                    this.rope.setFloating(false);
                    this.rope.setLandingMode(false);
                }
                // Keep bobber visible right in front of dock after catch
                // Position bobber right in front of dock (not lifting out of water)
                if (this.bobber && this.cat) {
                    // Get cat/dock position - bobber should be right in front
                    const catPos = this.cat.getModel()?.position;
                    if (catPos) {
                        const waterHeight = this.water.getWaterHeight(catPos.x, catPos.z + 0.5);
                        this.bobber.position.set(
                            catPos.x,
                            waterHeight + 0.06, // Normal floating position
                            catPos.z + 0.5 // Right in front of dock
                        );
                    }
                    this.bobber.visible = true; // Keep visible in front of dock
                }
                // Hide old fishing line, but keep rope line visible
                if (this.fishingLine) this.fishingLine.visible = false;
                // Keep rope line visible to show bobber in front of dock
                if (this.rope && this.rope.lineMesh) {
                    this.rope.lineMesh.visible = true;
                }
                // ALWAYS ensure old fishing line is hidden after catch (prevent double line)
                if (this.fishingLine) {
                    this.fishingLine.visible = false;
                }
                this.bobber.userData.floating = false;
                
                // Reset fish on line flag
                this.fishOnLine = false;
                this.setFishOnLine(false);
                
                // Reset final splash flag
                this._didFinalSplash = false;
                
                // Button state is handled by UI system
                const castButton = document.getElementById('cast-button');
                if (castButton) {
                    castButton.disabled = false;
                }
                
                // Note: onFishCaught is already called from fish.js when state becomes LANDED
                // to prevent duplicate calls, we don't call it here
                // The fish.js callback has a guard (_hasTriggeredCaught) to ensure it's only called once
                return;
            }
        }
        
        // Second check: Reel without fish is complete
        if (!this.fishOnLine && this.isReeling) {
            // Reeling without fish - use EXACT same landing coordinates as fish
            // From logs: fish catches at bobber position (0.07, 4.05) - use these exact coordinates
            // The actual landing position is around x=0, z=4.05 (right in front of dock)
            const catPos = this.cat.getSavedPosition();
            // Fish lands at approximately catPos.x + 0, catPos.z + 0.65 (since cat z=3.4, landing z=4.05)
            // Use exact coordinates where fish catches: (0, 4.05) relative to cat
            const landingPos = new THREE.Vector3(catPos.x, bob.y, catPos.z + 0.65); // Exact same Z as fish landing (4.05 when cat at 3.4)
            
            // Check distance to exact landing position
            const distToLandingPos = new THREE.Vector3(bob.x - landingPos.x, 0, bob.z - landingPos.z).length();
            
            // Stop wake effect when very close to landing position
            if (distToLandingPos < 0.5) {
                // Don't create wake ripples when very close to completion
                this.wakeTimer = 0;
                this.lastBobberPos.copy(this.bobber.position); // Reset position tracking
            }
            
            // Log distance every 0.5 seconds for debugging
            if (!this._lastNoFishReelLog) this._lastNoFishReelLog = 0;
            this._lastNoFishReelLog += delta;
            if (this._lastNoFishReelLog >= 0.5) {
                this._lastNoFishReelLog = 0;
                console.log('[FISHING] Reeling without fish - distance to landing pos:', distToLandingPos.toFixed(2), 'bobber pos:', `(${bob.x.toFixed(2)}, ${bob.z.toFixed(2)})`, 'landing pos:', `(${landingPos.x.toFixed(2)}, ${landingPos.z.toFixed(2)})`);
            }
            
            // Complete reel when bobber reaches landing position (within 0.5 units for easier completion)
            // Also check if bobber is very close to rod tip as fallback
            const distToRodTip = bob.distanceTo(tip);
            if (distToLandingPos < 0.5 || distToRodTip < 0.5) {
                console.log('[FISHING] Reel complete (no fish), bobber at landing position:', `(${bob.x.toFixed(2)}, ${bob.z.toFixed(2)})`);
                
                // Reeling complete - no fish
                // No splash/ripple when reeling without fish completes - just quietly finish
                this.isReeling = false;
                if (this.rope) {
                    this.rope.setReeling(false);
                    this.rope.setFloating(false);
                }
                this.bobber.visible = false;
                if (this.fishingLine) this.fishingLine.visible = false;
                if (this.rope && this.rope.lineMesh) this.rope.lineMesh.visible = false;
                this.bobber.userData.floating = false;
                
                // Reset wake tracking
                this.wakeTimer = 0;
                
                // Enable cast button for next cast
                const castButton = document.getElementById('cast-button');
                
                if (castButton) castButton.disabled = false;
                
                console.log('[FISHING] Reel without fish complete - cast button enabled');
                
                return;
            }
        }
        this.clampToCastBounds(this.bobber.position);
        
        // Keep at surface height - always snap Y to surface
        const waterHeight = this.water.getWaterHeight(
            this.bobber.position.x,
            this.bobber.position.z
        );
        this.bobber.position.y = waterHeight + 0.12;
        
        // Update line every frame (but skip if rope is active to prevent double line)
        if (!this.rope) {
            this.updateFishingLine();
        } else {
            // Always ensure fishing line is hidden when rope is active
            if (this.fishingLine) {
                this.fishingLine.visible = false;
            }
        }
    }

    getRodTip() {
        // Return temp rod tip or GLB rod tip
        if (this.tempRodTip) {
            return this.tempRodTip;
        }
        return this.rodTipBone;
    }
    
    // Expose getRodTip method for fish
    get getRodTipFunc() {
        return () => this.getRodTip();
    }

    getRodTipPosition() {
        const rodTipWorld = new THREE.Vector3();
        if (this.tempRodTip) {
            // Use temp rod
            return this.tempRodTip.getWorldPosition(new THREE.Vector3());
        } else if (this.rodTipBone) {
            // Use GLB rod
            this.rodTipBone.getWorldPosition(rodTipWorld);
        }
        return rodTipWorld;
    }
}

