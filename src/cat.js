import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer } from 'three';

export class Cat {
    constructor(scene, dock) {
        this.sceneRef = scene;
        this.dock = dock;
        this.model = null;
        this.rightHandBone = null;
        this.baseRotationY = 0; // Store base rotation for sway (test: 0° - if model faces +Z, this faces away from camera)
        this.savedRotationY = 0; // Store saved rotation (test: 0°)
        this.savedPosition = null; // Store original position (not affected by bones)
        
        // Arm bones for manual manipulation (without animation)
        this.allBones = []; // Store all bones for easy access
        this.rightShoulderBone = null;
        this.rightUpperArmBone = null;
        this.rightLowerArmBone = null;
        this.rightHandBone = null;
        this.leftShoulderBone = null;
        this.leftUpperArmBone = null;
        this.leftLowerArmBone = null;
        this.leftHandBone = null;
        
        // Animation mixer for playing animations from GLB
        this.mixer = null;
        this.armSwayAction = null;
        
        // Celebration state
        this._celebrate = {
            active: false,
            t: 0,                 // elapsed seconds
            dur: 1.6,             // total duration
            phase: 'start'        // start | peak | land
        };
        this.headBone = null;
        this._tailBones = null;
        this._spineBones = null;
        this._spineInit = null;
        this._leftHandLockHold = null;
        this._leftHandReleased = false;
        this._rightShoulderInitPos = null;
        this._rightForearmInitRot = null;
        this._rightUpperArmInitRot = null;
    }

    async load() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                'assets/glb/PZSNQ3IH66OXPUSBTYNAMD6EC.glb',
                (gltf) => {
                    this.model = gltf.scene;
                    // Check model bounding box to determine appropriate scale
                    const box = new THREE.Box3().setFromObject(this.model);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    
                    // Scale cat to reasonable size (about 1.5 units tall)
                    const targetHeight = 1.5;
                    const scale = targetHeight / maxDim;
                    this.model.scale.setScalar(scale);
                    console.log('Cat model size:', size, 'Scale applied:', scale);
                    
                    // Set up animation mixer if animations exist
                    if (gltf.animations && gltf.animations.length > 0) {
                        this.mixer = new AnimationMixer(this.model);
                        console.log('[CAT] Found', gltf.animations.length, 'animations in GLB');
                        
                        // Look for arm sway animation (common names: 'arm_sway', 'left_arm_sway', 'idle', etc.)
                        const armSwayClip = gltf.animations.find(clip => 
                            clip.name.toLowerCase().includes('arm') && 
                            (clip.name.toLowerCase().includes('sway') || clip.name.toLowerCase().includes('idle'))
                        ) || gltf.animations[0]; // Fallback to first animation if no match
                        
                        if (armSwayClip) {
                            this.armSwayAction = this.mixer.clipAction(armSwayClip);
                            
                            // Keep body/head idle motion but exclude both arms from animation completely.
                            // This prevents any noodling from the mixer.
                            const originalTracks = armSwayClip.tracks;
                            const isArmTrack = (boneName) => {
                                const n = boneName.toLowerCase();
                                return (
                                    // left arm chain
                                    n.includes('shoulderl') || n.includes('arm_stretchl') || n.includes('arm_twistl') ||
                                    n.includes('forearm_stretchl') || n.includes('forearm_twistl') || n === 'handl' ||
                                    // right arm chain
                                    n.includes('shoulderr') || n.includes('arm_stretchr') || n.includes('arm_twistr') ||
                                    n.includes('forearm_stretchr') || n.includes('forearm_twistr') || n === 'handr' ||
                                    n === 'mixamorigrighthand' || n === 'mixamorig:righthand'
                                );
                            };
                            
                            const bodyOnlyTracks = originalTracks.filter(track => {
                                const boneName = track.name.split('.')[0];
                                return !isArmTrack(boneName);
                            });
                            
                            const filteredClip = new THREE.AnimationClip(
                                armSwayClip.name + '_no_arms',
                                armSwayClip.duration,
                                bodyOnlyTracks
                            );
                            this.armSwayAction = this.mixer.clipAction(filteredClip);
                            this.armSwayAction.setLoop(THREE.LoopRepeat).setEffectiveWeight(0.6).play();
                            console.log('[CAT] Filtered animation to body only (both arms excluded). Original tracks:', originalTracks.length, 'Filtered tracks:', bodyOnlyTracks.length);
                        }
                    } else {
                        console.log('[CAT] No animations found in GLB. Add arm sway animation in Blender and re-export.');
                        console.log('[CAT] Animation should target bones: shoulderl, arm_stretchl, forearm_stretchl, or handl');
                    }
                    
                    // Find all bones for manual manipulation (still needed for rod attachment)
                    this.findAllBones();
                    this.findArmBones();
                    
                    // Create gripping pose for LEFT hand (holding rod)
                    this.createHandGrip('left');
                    this._leftHandLockQuat = null; // will lock on first call
                    // Create right-hand grip once after bones are found
                    this.createHandGrip('right');
                    this._rightHandLockQuat = null; // will be set on first fish pose
                    
                    // Position cat on dock
                    const dockSurfacePos = this.dock.getSurfacePosition();
                    this.model.position.copy(dockSurfacePos);
                    // Save position so it can't be modified by bone attachments
                    this.savedPosition = dockSurfacePos.clone();
                    
                    // Rotate cat to face the water (away from camera)
                    // IMPORTANT: Keep this rotation locked - don't let position correction change it
                    // Camera is at z=-8 (behind cat), cat is at z≈3.4, looking toward water (positive Z)
                    // Cat model likely faces -Z by default, so rotation.y = Math.PI (180°) makes it face +Z (away from camera)
                    // rotation.y = 0 makes it face -Z (toward camera - WRONG)
                    
                    // Check if model has any baked-in rotation that needs to be accounted for
                    const modelRotationY = this.model.rotation.y;
                    console.log('[CAT] Model original rotation.y:', modelRotationY);
                    
                    // Cat model likely faces -Z by default, so we need Math.PI (180°) to face +Z (away from camera toward water)
                    this.baseRotationY = Math.PI; // 180 degrees - faces +Z (away from camera toward water)
                    this.model.rotation.y = this.baseRotationY;
                    // Save rotation too
                    this.savedRotationY = this.baseRotationY;
                    
                    // Force update matrices to ensure rotation is applied
                    this.model.updateMatrixWorld(true);
                    
                    // Double-check rotation was applied
                    console.log('[CAT] Initial rotation set - baseRotationY:', this.baseRotationY, 'model.rotation.y:', this.model.rotation.y);
                    
                    // Add a flag to force rotation on first update
                    this._forceInitialRotation = true;
                    
                    // Enable shadows and lighten materials
                    this.model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Lighten cat materials to make it more visible on dock
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach((mat) => {
                                if (mat && mat.isMeshStandardMaterial) {
                                    // Add subtle emissive lighting to brighten the cat
                                    mat.emissive = new THREE.Color(0x333333); // Subtle warm glow (was 0x000000)
                                    mat.emissiveIntensity = 0.2; // 20% emissive brightness
                                    
                                    // Increase material brightness slightly
                                    if (mat.color) {
                                        // Brighten the color slightly
                                        const brightness = 1.3; // 30% brighter
                                        mat.color = mat.color.clone().multiplyScalar(brightness);
                                    }
                                    
                                    mat.needsUpdate = true;
                                }
                            });
                        }
                    });
                    
                    this.sceneRef.scene.add(this.model);
                    console.log('Cat model added to scene. Position:', this.model.position);
                    console.log('Cat model scale:', this.model.scale);
                    console.log('Cat model visible:', this.model.visible);
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading cat model:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Find all bones in the model for inspection/manipulation
     */
    findAllBones() {
        this.allBones = [];
        this.model.traverse((child) => {
            if (child.isBone) {
                this.allBones.push(child);
                
                // Find head bone by name
                const name = (child.name || '').toLowerCase();
                if (name === 'headx' || name === 'head' || name.includes('head')) {
                    if (!this.headBone) {
                        this.headBone = child;
                        console.log('[CAT] Found head bone:', child.name);
                    }
                }
            }
        });
        console.log(`[CAT] Found ${this.allBones.length} bones in model`);
        // Log all bone names for debugging
        const boneNames = this.allBones.map(b => b.name).filter(n => n);
        if (boneNames.length > 0) {
            console.log('[CAT] Bone names:', boneNames.join(', '));
        }
    }
    
    /**
     * Find arm bones for manual manipulation
     * Common bone naming conventions: Mixamo, Blender, Custom
     */
    findArmBones() {
        this.model.traverse((child) => {
            if (child.isBone) {
                const name = (child.name || '').toLowerCase();
                
                // RIGHT ARM BONES
                // Check for shoulder/clavicle bones - handle both patterns: 'shoulderr' (exact) and 'shoulder' with 'right'/'r'
                if (name === 'shoulderr' || 
                    ((name.includes('right') || name.includes('r_') || name.includes('_r')) && 
                     (name.includes('shoulder') || name.includes('clavicle')))) {
                    this.rightShoulderBone = child;
                    console.log('[CAT] Found right shoulder bone:', child.name);
                }
                // Right upper arm - check for arm_stretchr pattern first (common in GLTF models)
                if (name === 'arm_stretchr' || 
                    ((name.includes('right') || name.includes('r_') || name.includes('_r')) && 
                     (name.includes('upperarm') || name.includes('upper_arm') || name.includes('arm_stretch') || name === 'mixamorigrightarm' || name === 'mixamorig:rightarm'))) {
                    this.rightUpperArmBone = child;
                    console.log('[CAT] Found right upper arm bone:', child.name);
                }
                // Right forearm - check for forearm_stretchr pattern first (common in GLTF models)
                if (name === 'forearm_stretchr' || 
                    ((name.includes('right') || name.includes('r_') || name.includes('_r')) && 
                     (name.includes('lowerarm') || name.includes('forearm') || name.includes('lower_arm') || name.includes('forearm_stretch') || name === 'mixamorigrightforearm' || name === 'mixamorig:rightforearm'))) {
                    this.rightLowerArmBone = child;
                    console.log('[CAT] Found right lower arm bone:', child.name);
                }
                // Right hand - check for handr pattern first (common in GLTF models)
                if (name === 'handr' || 
                    ((name.includes('right') || name.includes('r_') || name.includes('_r')) && 
                     (name.includes('hand') || name === 'mixamorigrighthand' || name === 'mixamorig:righthand'))) {
                    this.rightHandBone = child;
                    console.log('[CAT] Found right hand bone:', child.name);
                }
                
                // LEFT ARM BONES
                if ((name.includes('left') || name.includes('l_') || name.includes('_l')) && 
                    (name.includes('shoulder') || name.includes('clavicle'))) {
                    this.leftShoulderBone = child;
                    console.log('[CAT] Found left shoulder bone:', child.name);
                }
                if ((name.includes('left') || name.includes('l_') || name.includes('_l')) && 
                    (name.includes('upperarm') || name.includes('upper_arm') || name === 'mixamorigleftarm' || name === 'mixamorig:leftarm')) {
                    this.leftUpperArmBone = child;
                    console.log('[CAT] Found left upper arm bone:', child.name);
                }
                if ((name.includes('left') || name.includes('l_') || name.includes('_l')) && 
                    (name.includes('lowerarm') || name.includes('forearm') || name.includes('lower_arm') || name === 'mixamorigleftforearm' || name === 'mixamorig:leftforearm')) {
                    this.leftLowerArmBone = child;
                    console.log('[CAT] Found left lower arm bone:', child.name);
                }
                if ((name.includes('left') || name.includes('l_') || name.includes('_l')) && 
                    (name.includes('hand') || name === 'mixamoriglefthand' || name === 'mixamorig:lefthand' || name === 'handl')) {
                    this.leftHandBone = child;
                    console.log('[CAT] Found left hand bone:', child.name);
                }
            }
        });
        
        // Initialize right arm segment cache after bones are found
        if (this.rightShoulderBone && this.rightUpperArmBone && this.rightLowerArmBone && this.rightHandBone) {
            this.cacheRightArmSegments();
            // Safety: never allow animation tracks to scale arm bones
            [this.rightShoulderBone, this.rightUpperArmBone, this.rightLowerArmBone, this.rightHandBone].forEach(b => { 
                if (b) b.scale.set(1,1,1); 
            });
            
            // Create right-hand grip once (will be locked during fishing)
            if (!this._rightHandPositioned) {
                this.createHandGrip('right');
                // Add a tiny extra curl on the index/middle fingers of the right hand to imply pressure on the reel handle knob
                const rightIndex1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index1r');
                const rightIndex2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index2r');
                const rightMiddle1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle1r');
                const rightMiddle2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle2r');
                if (rightIndex1 && this._rightHandInitRotations && this._rightHandInitRotations.index1) {
                    rightIndex1.rotation.copy(this._rightHandInitRotations.index1);
                    rightIndex1.rotation.x += 0.1; // Extra curl for reel grip pressure
                }
                if (rightIndex2 && this._rightHandInitRotations && this._rightHandInitRotations.index2) {
                    rightIndex2.rotation.copy(this._rightHandInitRotations.index2);
                    rightIndex2.rotation.x += 0.1; // Extra curl
                }
                if (rightMiddle1 && this._rightHandInitRotations && this._rightHandInitRotations.middle1) {
                    rightMiddle1.rotation.copy(this._rightHandInitRotations.middle1);
                    rightMiddle1.rotation.x += 0.1; // Extra curl
                }
                if (rightMiddle2 && this._rightHandInitRotations && this._rightHandInitRotations.middle2) {
                    rightMiddle2.rotation.copy(this._rightHandInitRotations.middle2);
                    rightMiddle2.rotation.x += 0.1; // Extra curl
                }
                this._rightHandPositioned = true;
            }
            
            // Nudge pole bias once on load to prevent wrong-side elbow bends
            if (this._rightArmSeg) {
                this._rightArmSeg.pole.set(0.25, 0.15, 1).normalize();
            }
            
            // Optional: debug helpers for IK visualization
            this._ikDbg = {
                elbow: new THREE.AxesHelper(0.08),
                target: new THREE.AxesHelper(0.08)
            };
            this.sceneRef.scene.add(this._ikDbg.elbow, this._ikDbg.target);
        }
        
        // Fallback: try direct name lookup for right hand
        if (!this.rightHandBone) {
            this.rightHandBone = this.model.getObjectByName('mixamorigRightHand') ||
                                 this.model.getObjectByName('RightHand') ||
                                 this.model.getObjectByName('handr');
        }
        
        // If still not found, create a placeholder at approximate hand position
        if (!this.rightHandBone) {
            console.warn('[CAT] Right hand bone not found, using approximate position');
            this.rightHandBone = new THREE.Object3D();
            this.rightHandBone.position.set(0.3, 0.5, 0.2);
            this.rightHandBone.name = 'RightHandPlaceholder';
            this.model.add(this.rightHandBone);
        }
    }

    getRightHandBone() {
        return this.rightHandBone;
    }
    
    /**
     * Get tail bones for wagging animation
     * @returns {Array<THREE.Bone>} Array of tail bones
     */
    getTailBones() {
        if (this._tailBones) return this._tailBones;
        const tails = [];
        this.getAllBones().forEach(b => {
            const n = (b.name || '').toLowerCase();
            if (n.includes('tail')) tails.push(b);
        });
        this._tailBones = tails;
        return tails;
    }
    
    /**
     * Get spine bones for lean animation
     * @returns {Array<THREE.Bone>} Array of spine bones
     */
    getSpineBones() {
        if (this._spineBones) return this._spineBones;
        const sp = [];
        this.getAllBones().forEach(b => {
            const n = (b.name || '').toLowerCase();
            if (n.includes('spine') || n.includes('chest')) sp.push(b);
        });
        // order roughly from hips up
        this._spineBones = sp.sort((a, b) => (a.parent === b ? -1 : 0));
        return this._spineBones;
    }
    
    /**
     * Start celebration animation
     * @param {number} duration - Duration in seconds (default 1.6)
     */
    startCelebrate(duration = 1.6) {
        if (!this.model) return;
        this._celebrate.active = true;
        this._celebrate.t = 0;
        this._celebrate.dur = duration;
        this._celebrate.phase = 'start';
        
        // So nothing fights us during the pose
        // Completely disable arm sway during celebration
        if (this.armSwayAction) {
            this.armSwayAction.setEffectiveWeight(0.0); // Set to 0 instead of 0.2 to completely disable
            console.log('[CAT] Arm sway disabled for celebration');
        }
        
        // Optionally release left-hand static lock for a second (so we can raise the rod higher)
        this._leftHandLockHold = this._leftHandLockQuat || null;  // remember lock
        this._leftHandLockQuat = null;                             // release lock during celebrate
        this._leftHandReleased = true;
        
        // Release right-hand lock so IK can fully move hand off the reel during celebration
        this._rightHandLockHold = this._rightHandLockQuat || null;  // remember right-hand lock
        this._rightHandLockQuat = null;                             // release lock during celebrate
        this._rightHandReleased = true;
        
        // Cache initial pelvis/spine rot so we can restore
        const sp = this.getSpineBones();
        this._spineInit = sp.map(b => b.rotation.clone());
        
        // Cache initial right shoulder position for reaching upward
        if (this.rightShoulderBone) {
            this._rightShoulderInitPos = this.rightShoulderBone.position.clone();
        }
        
        // Cache initial forearm rotation for elbow bending
        if (this.rightLowerArmBone) {
            this._rightForearmInitRot = this.rightLowerArmBone.rotation.clone();
        }
        
        // Cache initial upper arm rotation
        if (this.rightUpperArmBone) {
            this._rightUpperArmInitRot = this.rightUpperArmBone.rotation.clone();
        }
        
        // Initialize _rHandTargetW if it doesn't exist yet
        if (!this._rHandTargetW) {
            this._rHandTargetW = new THREE.Vector3();
        }
        
        // CRITICAL: Cache right arm segments for IK before celebration starts
        // This must be done before we try to solve IK in updateCelebrate
        if (!this._rightArmSeg) {
            this.cacheRightArmSegments();
            if (!this._rightArmSeg) {
                console.warn('[CAT] Warning: Could not cache right arm segments - some bones may be missing');
            }
        }
        
        // Cache initial hand position at reel (so we can move it away during celebration)
        // CRITICAL: Cache the hand position BEFORE celebration starts
        if (this.rightHandBone) {
            // Get current hand world position directly from bone if _rHandTargetW isn't set
            if (this._rHandTargetW && this._rHandTargetW.lengthSq() > 0) {
                this._rightHandReelPos = this._rHandTargetW.clone();
                console.log('[CAT] Cached hand position at reel from target:', this._rightHandReelPos);
            } else {
                // Fallback: get hand position from bone
                const handPos = new THREE.Vector3();
                this.rightHandBone.getWorldPosition(handPos);
                this._rightHandReelPos = handPos.clone();
                this._rHandTargetW.copy(handPos); // Initialize target from hand position
                console.log('[CAT] Cached hand position at reel from bone:', this._rightHandReelPos);
            }
        } else {
            console.warn('[CAT] Cannot cache reel position - rightHandBone not found!');
            // Initialize with a default position if hand bone not found
            if (!this._rightHandReelPos) {
                this._rightHandReelPos = new THREE.Vector3(0, 1.5, 0);
                this._rHandTargetW.copy(this._rightHandReelPos);
            }
        }
        
        // Cache initial right hand finger rotations for fist pose
        if (!this._rightHandInitRotations) {
            this._rightHandInitRotations = {};
        }
        const rightThumb1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb1r');
        const rightThumb2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb2r');
        const rightThumb3 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb3r');
        const rightIndex1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index1r');
        const rightIndex2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index2r');
        const rightMiddle1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle1r');
        const rightMiddle2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle2r');
        const rightRing1 = this.getAllBones().find(b => {
            const name = b.name && b.name.toLowerCase();
            return name === 'ring1r' || name === 'xl3r' || name === 'xl3';
        });
        const rightRing2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'ring2r');
        const rightPinky1 = this.getAllBones().find(b => {
            const name = b.name && b.name.toLowerCase();
            return name === 'pinky1r' || name === 'xl2r' || name === 'xl2';
        });
        const rightPinky2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'pinky2r');
        
        if (rightThumb1 && !this._rightHandInitRotations.thumb1) {
            this._rightHandInitRotations.thumb1 = rightThumb1.rotation.clone();
        }
        if (rightThumb2 && !this._rightHandInitRotations.thumb2) {
            this._rightHandInitRotations.thumb2 = rightThumb2.rotation.clone();
        }
        if (rightThumb3 && !this._rightHandInitRotations.thumb3) {
            this._rightHandInitRotations.thumb3 = rightThumb3.rotation.clone();
        }
        if (rightIndex1 && !this._rightHandInitRotations.index1) {
            this._rightHandInitRotations.index1 = rightIndex1.rotation.clone();
        }
        if (rightIndex2 && !this._rightHandInitRotations.index2) {
            this._rightHandInitRotations.index2 = rightIndex2.rotation.clone();
        }
        if (rightMiddle1 && !this._rightHandInitRotations.middle1) {
            this._rightHandInitRotations.middle1 = rightMiddle1.rotation.clone();
        }
        if (rightMiddle2 && !this._rightHandInitRotations.middle2) {
            this._rightHandInitRotations.middle2 = rightMiddle2.rotation.clone();
        }
        if (rightRing1 && !this._rightHandInitRotations.ring1) {
            this._rightHandInitRotations.ring1 = rightRing1.rotation.clone();
        }
        if (rightRing2 && !this._rightHandInitRotations.ring2) {
            this._rightHandInitRotations.ring2 = rightRing2.rotation.clone();
        }
        if (rightPinky1 && !this._rightHandInitRotations.pinky1) {
            this._rightHandInitRotations.pinky1 = rightPinky1.rotation.clone();
        }
        if (rightPinky2 && !this._rightHandInitRotations.pinky2) {
            this._rightHandInitRotations.pinky2 = rightPinky2.rotation.clone();
        }
        
        // Debug: verify spine bones found
        console.log(`[CAT] Celebration started! Duration: ${duration}s, Spine bones: ${sp.length}, Head bone: ${this.headBone ? this.headBone.name : 'not found'}, Tail bones: ${this.getTailBones().length}`);
    }
    
    /**
     * Stop celebration animation
     */
    stopCelebrate() {
        if (!this._celebrate.active) return;
        this._celebrate.active = false;
        
        // Restore arm sway
        if (this.armSwayAction) this.armSwayAction.setEffectiveWeight(0.6);
        
        // Re-lock left hand if it was locked before
        if (this._leftHandLockHold) {
            this._leftHandLockQuat = this._leftHandLockHold;
            this._leftHandLockHold = null;
        }
        this._leftHandReleased = false;
        
        // Re-lock right hand if it was locked before
        if (this._rightHandLockHold) {
            this._rightHandLockQuat = this._rightHandLockHold;
            this._rightHandLockHold = null;
        }
        
        // Reset right hand bone rotation to allow normal positioning logic to work
        // This ensures the hand rotation from celebration (180-degree flip) is cleared
        if (this.rightHandBone) {
            // Reset to identity rotation - the normal hand positioning will set it correctly
            this.rightHandBone.quaternion.set(0, 0, 0, 1);
            this.rightHandBone.updateMatrixWorld(true);
        }
        this._rightHandReleased = false;
        
        // Restore spine
        if (this._spineInit) {
            const sp = this.getSpineBones();
            sp.forEach((b, i) => {
                if (this._spineInit[i]) {
                    b.rotation.copy(this._spineInit[i]);
                }
            });
            this._spineInit = null;
        }
        
        // Restore right shoulder position
        if (this.rightShoulderBone && this._rightShoulderInitPos) {
            this.rightShoulderBone.position.copy(this._rightShoulderInitPos);
            this.rightShoulderBone.updateMatrix();
            this._rightShoulderInitPos = null;
        }
        
        // Restore right arm rotations (upper arm and forearm)
        if (this.rightUpperArmBone && this._rightUpperArmInitRot) {
            this.rightUpperArmBone.rotation.copy(this._rightUpperArmInitRot);
            this.rightUpperArmBone.updateMatrix();
            this._rightUpperArmInitRot = null;
        }
        if (this.rightLowerArmBone && this._rightForearmInitRot) {
            this.rightLowerArmBone.rotation.copy(this._rightForearmInitRot);
            this.rightLowerArmBone.updateMatrix();
            this._rightForearmInitRot = null;
        }
        
        // Reset head
        if (this.headBone) {
            this.headBone.rotation.x = 0;
        }
        
        // Reset tail
        const tails = this.getTailBones();
        tails.forEach(b => {
            b.rotation.y = 0;
        });
        
        // Reset right fist flag for next celebration
        this._rightFistApplied = false;
        
        // Reset right hand from fist pose back to normal
        if (this._rightHandInitRotations) {
            const rightThumb1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb1r');
            const rightThumb2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb2r');
            const rightThumb3 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb3r');
            const rightIndex1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index1r');
            const rightIndex2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index2r');
            const rightMiddle1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle1r');
            const rightMiddle2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle2r');
            const rightRing1 = this.getAllBones().find(b => {
                const name = b.name && b.name.toLowerCase();
                return name === 'ring1r' || name === 'xl3r' || name === 'xl3';
            });
            const rightRing2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'ring2r');
            const rightPinky1 = this.getAllBones().find(b => {
                const name = b.name && b.name.toLowerCase();
                return name === 'pinky1r' || name === 'xl2r' || name === 'xl2';
            });
            const rightPinky2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'pinky2r');
            
            if (rightThumb1 && this._rightHandInitRotations.thumb1) {
                rightThumb1.rotation.copy(this._rightHandInitRotations.thumb1);
                rightThumb1.updateMatrixWorld(true);
            }
            if (rightThumb2 && this._rightHandInitRotations.thumb2) {
                rightThumb2.rotation.copy(this._rightHandInitRotations.thumb2);
                rightThumb2.updateMatrixWorld(true);
            }
            if (rightThumb3 && this._rightHandInitRotations.thumb3) {
                rightThumb3.rotation.copy(this._rightHandInitRotations.thumb3);
                rightThumb3.updateMatrixWorld(true);
            }
            if (rightIndex1 && this._rightHandInitRotations.index1) {
                rightIndex1.rotation.copy(this._rightHandInitRotations.index1);
                rightIndex1.updateMatrixWorld(true);
            }
            if (rightIndex2 && this._rightHandInitRotations.index2) {
                rightIndex2.rotation.copy(this._rightHandInitRotations.index2);
                rightIndex2.updateMatrixWorld(true);
            }
            if (rightMiddle1 && this._rightHandInitRotations.middle1) {
                rightMiddle1.rotation.copy(this._rightHandInitRotations.middle1);
                rightMiddle1.updateMatrixWorld(true);
            }
            if (rightMiddle2 && this._rightHandInitRotations.middle2) {
                rightMiddle2.rotation.copy(this._rightHandInitRotations.middle2);
                rightMiddle2.updateMatrixWorld(true);
            }
            if (rightRing1 && this._rightHandInitRotations.ring1) {
                rightRing1.rotation.copy(this._rightHandInitRotations.ring1);
                rightRing1.updateMatrixWorld(true);
            }
            if (rightRing2 && this._rightHandInitRotations.ring2) {
                rightRing2.rotation.copy(this._rightHandInitRotations.ring2);
                rightRing2.updateMatrixWorld(true);
            }
            if (rightPinky1 && this._rightHandInitRotations.pinky1) {
                rightPinky1.rotation.copy(this._rightHandInitRotations.pinky1);
                rightPinky1.updateMatrixWorld(true);
            }
            if (rightPinky2 && this._rightHandInitRotations.pinky2) {
                rightPinky2.rotation.copy(this._rightHandInitRotations.pinky2);
                rightPinky2.updateMatrixWorld(true);
            }
            
            // Update skeleton
            if (this.model) {
                this.model.traverse((child) => {
                    if (child.isSkinnedMesh && child.skeleton) {
                        child.skeleton.update();
                    }
                });
            }
        }
        
        console.log('[CAT] Celebration ended');
    }
    
    /**
     * Update celebration animation each frame
     * @param {number} dt - Delta time
     */
    updateCelebrate(dt) {
        const C = this._celebrate;
        if (!C.active) return;
        
        C.t += dt;
        const t = C.t;
        const dur = C.dur;
        const u = Math.min(t / dur, 1);            // 0..1
        const ease = (x) => x * x * (3 - 2 * x);  // smoothstep
        const up = Math.sin(Math.PI * Math.min(u, 1)); // up/down hop curve
        
        // Debug logging (every 0.2 seconds)
        if (Math.floor(C.t * 5) !== Math.floor((C.t - dt) * 5)) {
            console.log(`[CAT] Celebration update: t=${C.t.toFixed(3)}/${dur.toFixed(3)}, u=${u.toFixed(3)}, active=${C.active}`);
        }
        
        // 1) Raise rod AND right hand straight up for cheering - move hand AWAY from reel
        // CRITICAL: We MUST move the hand away from the reel for celebration to be visible
        // Ensure _rHandTargetW is initialized
        if (!this._rHandTargetW) {
            this._rHandTargetW = new THREE.Vector3();
        }
        
        if (this.rightShoulderBone) {
            // Get shoulder position as base reference
            const s = new THREE.Vector3(); 
            this.rightShoulderBone.getWorldPosition(s);
            
            // Get initial hand position at reel (must be cached at start)
            let startPos;
            if (this._rightHandReelPos) {
                // Use cached reel position as starting point
                startPos = this._rightHandReelPos.clone();
                if (Math.floor(C.t * 5) !== Math.floor((C.t - dt) * 5)) {
                    console.log(`[CAT] Celebration: Starting from reel pos: ${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)}`);
                }
            } else if (this._rHandTargetW) {
                // Fallback: use current target if reel pos not cached
                startPos = this._rHandTargetW.clone();
                console.warn('[CAT] Celebration: Reel position not cached, using current target:', startPos);
            } else if (this.rightHandBone) {
                // Get hand position directly from bone
                startPos = new THREE.Vector3();
                this.rightHandBone.getWorldPosition(startPos);
                console.warn('[CAT] Celebration: Using hand bone position as start:', startPos);
            } else {
                // Last resort: estimate from shoulder
                startPos = s.clone().add(new THREE.Vector3(0.15, -0.1, 0.25));
                console.warn('[CAT] Celebration: Using estimated reel position from shoulder');
            }
            
            // Cheering pose: hand goes straight up from shoulder, WELL AWAY from reel
            const cheerUp = new THREE.Vector3(0, 0.8, 0); // Straight up from shoulder (increased to 0.8m for dramatic effect)
            const cheerForward = new THREE.Vector3(0, 0, 0.35); // Slightly forward for natural pose (increased)
            const cheerTarget = s.clone()
                .add(cheerUp)
                .add(cheerForward);
            
            // Interpolate directly from reel position to cheer target - this moves hand AWAY from reel
            // Use smoothstep for smooth animation but ensure we reach the target
            const progress = ease(u);
            const finalTarget = startPos.clone().lerp(cheerTarget, progress);
            
            // FORCE hand target to celebration position (don't let anything override this)
            // CRITICAL: Always overwrite the target during celebration - never lerp back to reel
            if (!this._rHandTargetW) {
                this._rHandTargetW = new THREE.Vector3();
            }
            // Direct copy - no lerping - ensures hand moves away from reel immediately
            this._rHandTargetW.copy(finalTarget);
            
            // Debug log to verify target is moving
            if (Math.floor(C.t * 10) !== Math.floor((C.t - dt) * 10)) {
                console.log(`[CAT] Celebration hand target (u=${u.toFixed(2)}): final=${finalTarget.x.toFixed(2)},${finalTarget.y.toFixed(2)},${finalTarget.z.toFixed(2)}, start=${startPos.x.toFixed(2)},${startPos.y.toFixed(2)},${startPos.z.toFixed(2)}, shoulder=${s.y.toFixed(2)}`);
            }
        } else {
            // Fallback: try to find shoulder bone or use hand bone position
            console.warn('[CAT] rightShoulderBone is null - attempting fallback');
            if (this.rightHandBone) {
                const handPos = new THREE.Vector3();
                this.rightHandBone.getWorldPosition(handPos);
                // Use hand bone position as base, move it up
                const cheerTarget = handPos.clone().add(new THREE.Vector3(0, 0.8, 0.35));
                if (this._rightHandReelPos) {
                    const progress = ease(u);
                    const finalTarget = this._rightHandReelPos.clone().lerp(cheerTarget, progress);
                    this._rHandTargetW.copy(finalTarget);
                } else {
                    this._rHandTargetW.copy(cheerTarget);
                }
            } else {
                console.error('[CAT] Cannot set celebration hand target - both rightShoulderBone and rightHandBone are null!');
            }
        }
        
        // 2) Raise entire shoulder upward for reaching-to-sky gesture
        if (this.rightShoulderBone && this._rightShoulderInitPos) {
            // Raise shoulder up to make the whole arm reach for the sky
            const shoulderLift = 0.15; // Raise shoulder 15cm upward
            const shoulderReach = new THREE.Vector3(
                this._rightShoulderInitPos.x,
                this._rightShoulderInitPos.y + (shoulderLift * ease(u)),
                this._rightShoulderInitPos.z
            );
            // Also lean shoulder slightly forward for natural reaching pose
            shoulderReach.z += 0.08 * ease(u); // Slight forward lean
            this.rightShoulderBone.position.lerp(shoulderReach, 0.5);
            this.rightShoulderBone.updateMatrix();
        }
        
        // 3) Set pole vector to guide IK for proper elbow bend during celebration
        // Instead of manually rotating arm bones, let IK solve naturally with a good pole vector
        // Bias pole upward and forward to create natural cheering pose
        if (this._rightArmSeg) {
            // Create a pole vector that points upward and slightly forward
            // This guides IK to bend the elbow in a natural cheering pose
            const cheerPole = new THREE.Vector3(0, 1, 0.3).normalize();
            this._rightArmSeg.pole.copy(cheerPole);
        }
        
        // 5) Spine lean back a touch and chest proud at the peak
        const sp = this.getSpineBones();
        if (sp.length && this._spineInit && this._spineInit.length === sp.length) {
            const lean = THREE.MathUtils.degToRad(25) * up;   // back lean (increased from 15 to 25 for more visibility)
            const proud = THREE.MathUtils.degToRad(18) * up;   // chest open (increased from 12 to 18 for more visibility)
            // distribute: lower spine leans most, upper less
            sp.forEach((b, i) => {
                const k = (sp.length - i) / sp.length;
                if (this._spineInit[i]) {
                    // Apply rotations directly - celebration overrides all other animations
                    b.rotation.z = this._spineInit[i].z - lean * k;
                    b.rotation.x = this._spineInit[i].x + proud * (1 - 0.6 * i / sp.length);
                    // Update matrix immediately so changes are visible
                    b.updateMatrix();
                }
            });
        }
        
        // 5) Head nod (more pronounced)
        if (this.headBone) {
            const nod = THREE.MathUtils.degToRad(30) * Math.sin(u * Math.PI * 1.5) * (u < 0.8 ? 1 : (1 - u) * 5); // Increased from 20 to 30 degrees
            this.headBone.rotation.x = nod;
            // Update matrix immediately
            this.headBone.updateMatrix();
        }
        
        // 6) Right hand fist pose for celebration
        // Apply fist continuously during celebration (apply immediately, not waiting for u >= 0.25)
        // Make a tight fist by curling all fingers
        if (this._rightHandInitRotations) {
            const get = (n) => this.getAllBones().find(b => b.name && b.name.toLowerCase() === n);
            
            const thumb1 = get('thumb1r');
            const thumb2 = get('thumb2r');
            const thumb3 = get('thumb3r');
            const index1 = get('index1r');
            const index2 = get('index2r');
            const middle1 = get('middle1r');
            const middle2 = get('middle2r');
            const ring1 = get('ring1r') || get('xl3r') || get('xl3');
            const ring2 = get('ring2r');
            const pinky1 = get('pinky1r') || get('xl2r') || get('xl2');
            const pinky2 = get('pinky2r');
            
            // Apply fist rotations - tighten all fingers into a closed fist
            // Thumb: wrap across the fist
            if (thumb1 && this._rightHandInitRotations.thumb1) {
                thumb1.rotation.copy(this._rightHandInitRotations.thumb1);
                thumb1.rotation.x += 0.8;  // Increased curl
                thumb1.rotation.y += 0.4;  // Increased wrap
                thumb1.updateMatrixWorld(true);
            }
            if (thumb2 && this._rightHandInitRotations.thumb2) {
                thumb2.rotation.copy(this._rightHandInitRotations.thumb2);
                thumb2.rotation.x += 0.8;  // Increased curl
                thumb2.updateMatrixWorld(true);
            }
            if (thumb3 && this._rightHandInitRotations.thumb3) {
                thumb3.rotation.copy(this._rightHandInitRotations.thumb3);
                thumb3.rotation.x += 0.7;  // Increased curl
                thumb3.updateMatrixWorld(true);
            }
            
            // Fingers: curl into palm tightly
            if (index1 && this._rightHandInitRotations.index1) {
                index1.rotation.copy(this._rightHandInitRotations.index1);
                index1.rotation.x += 1.2;  // Strong curl into palm
                index1.updateMatrixWorld(true);
            }
            if (index2 && this._rightHandInitRotations.index2) {
                index2.rotation.copy(this._rightHandInitRotations.index2);
                index2.rotation.x += 1.4;  // Very tight curl
                index2.updateMatrixWorld(true);
            }
            if (middle1 && this._rightHandInitRotations.middle1) {
                middle1.rotation.copy(this._rightHandInitRotations.middle1);
                middle1.rotation.x += 1.2;  // Strong curl
                middle1.updateMatrixWorld(true);
            }
            if (middle2 && this._rightHandInitRotations.middle2) {
                middle2.rotation.copy(this._rightHandInitRotations.middle2);
                middle2.rotation.x += 1.4;  // Very tight curl
                middle2.updateMatrixWorld(true);
            }
            
            // Ring and pinky fingers if they exist
            if (ring1) {
                const initRot = this._rightHandInitRotations.ring1 || ring1.rotation.clone();
                ring1.rotation.copy(initRot);
                ring1.rotation.x += 1.1;
                ring1.updateMatrixWorld(true);
            }
            if (ring2) {
                const initRot = this._rightHandInitRotations.ring2 || ring2.rotation.clone();
                ring2.rotation.copy(initRot);
                ring2.rotation.x += 1.3;
                ring2.updateMatrixWorld(true);
            }
            if (pinky1) {
                const initRot = this._rightHandInitRotations.pinky1 || pinky1.rotation.clone();
                pinky1.rotation.copy(initRot);
                pinky1.rotation.x += 1.0;
                pinky1.updateMatrixWorld(true);
            }
            if (pinky2) {
                const initRot = this._rightHandInitRotations.pinky2 || pinky2.rotation.clone();
                pinky2.rotation.copy(initRot);
                pinky2.rotation.x += 1.2;
                pinky2.updateMatrixWorld(true);
            }
            
            this._rightFistApplied = true;
            
            // Update skeleton after posing
            if (this.model) {
                this.model.traverse((child) => {
                    if (child.isSkinnedMesh && child.skeleton) {
                        child.skeleton.update();
                    }
                });
            }
        }
        
        // 7) Tail wag (lots of wagging for excitement!)
        const tails = this.getTailBones();
        if (tails.length) {
            const amp = THREE.MathUtils.degToRad(35); // Increased from 12 to 35 for lots of wagging
            const freq = 15; // Increased wag speed from 12 to 15 for more energetic wag
            tails.forEach((b, i) => {
                const fall = Math.pow(0.8, i); // Increased from 0.7 to 0.8 for more consistent wag down the tail
                b.rotation.y = amp * fall * Math.sin((C.t * freq) - i * 0.3) * ease(u); // Adjusted phase offset
                b.updateMatrix(); // Update matrix immediately for visibility
            });
        }
        
        // CRITICAL: Update bone matrices and skeleton so animations are visible
        // Update all modified bones
        if (sp.length) {
            sp.forEach(b => {
                b.updateMatrixWorld(true);
            });
        }
        if (this.headBone) {
            this.headBone.updateMatrixWorld(true);
        }
        if (tails.length) {
            tails.forEach(b => b.updateMatrixWorld(true));
        }
        
        // Update right arm bones too (for rod raise)
        if (this.rightShoulderBone) this.rightShoulderBone.updateMatrixWorld(true);
        if (this.rightUpperArmBone) this.rightUpperArmBone.updateMatrixWorld(true);
        if (this.rightLowerArmBone) this.rightLowerArmBone.updateMatrixWorld(true);
        if (this.rightHandBone) this.rightHandBone.updateMatrixWorld(true);
        
        // Update left arm bones
        if (this.leftShoulderBone) this.leftShoulderBone.updateMatrixWorld(true);
        if (this.leftUpperArmBone) this.leftUpperArmBone.updateMatrixWorld(true);
        if (this.leftLowerArmBone) this.leftLowerArmBone.updateMatrixWorld(true);
        if (this.leftHandBone) this.leftHandBone.updateMatrixWorld(true);
        
        // Update skeleton - THIS IS CRITICAL for skinned meshes
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                    // Force skeleton update with bones that changed
                    child.skeleton.update();
                }
            });
        }
        
        // CRITICAL: Solve IK to celebration target at end of celebration update
        // This ensures the hand moves to the celebration target every frame
        if (this._rHandTargetW) {
            // Ensure arm segments are cached
            if (!this._rightArmSeg) {
                this.cacheRightArmSegments();
            }
            
            if (this._rightArmSeg) {
                const pole = this._rightArmSeg.pole || new THREE.Vector3(0, 1, 0.3).normalize();
                this.solveRightArmIK(this._rHandTargetW, pole);
                
                // Lock hand rotation to align with forearm (keep hand and forearm straight)
                // This prevents the hand from bending at the wrist during celebration
                if (this.rightHandBone && this.rightLowerArmBone) {
                    // Get forearm's world rotation
                    const forearmWorldQuat = new THREE.Quaternion();
                    this.rightLowerArmBone.getWorldQuaternion(forearmWorldQuat);
                    
                    // Calculate desired hand rotation: align hand's +Y axis with forearm direction
                    // Hand should rotate to match forearm's rotation (stay straight)
                    const handParentInv = this.rightHandBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
                    let desiredHandWorldQuat = forearmWorldQuat.clone(); // Match forearm rotation exactly
                    
                    // Rotate hand 180 degrees around Y axis to flip palm forward (palm was facing backwards)
                    const flipRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); // 180 degrees around Y
                    desiredHandWorldQuat.multiply(flipRotation);
                    
                    // Convert to local space and apply
                    const handLocalQuat = handParentInv.multiply(desiredHandWorldQuat);
                    this.rightHandBone.quaternion.copy(handLocalQuat);
                    this.rightHandBone.updateMatrixWorld(true);
                }
                
                // Debug: log IK solve
                if (Math.floor(C.t * 10) !== Math.floor((C.t - dt) * 10)) {
                    const currentHandPos = new THREE.Vector3();
                    if (this.rightHandBone) {
                        this.rightHandBone.getWorldPosition(currentHandPos);
                        const distance = currentHandPos.distanceTo(this._rHandTargetW);
                        console.log(`[CAT] Celebration IK solve: target=${this._rHandTargetW.y.toFixed(2)}, actual=${currentHandPos.y.toFixed(2)}, dist=${distance.toFixed(3)}`);
                    }
                }
            } else {
                console.error('[CAT] Cannot solve IK - _rightArmSeg not initialized!');
            }
        } else {
            console.error('[CAT] Cannot solve IK - _rHandTargetW is null!');
        }
        
        // 7) Left hand: if we released it, float up slightly toward the foregrip then we'll relock on exit
        if (this._leftHandReleased) {
            // no rotation writes; you already keep left arm static otherwise
            // optionally: nudge its position toward rod foregrip target if you have one
        } else {
            // keep left hand locked if you didn't release it
            this.lockLeftHandRotation(null);
        }
        
        // End - only stop when we've actually reached the duration
        // Add small buffer to prevent premature ending due to floating point issues
        if (t >= dur - 0.001) {
            console.log(`[CAT] Celebration duration reached: t=${t.toFixed(3)} >= dur=${dur.toFixed(3)}`);
            this.stopCelebrate();
        }
    }
    
    /**
     * Measure upper-arm and forearm lengths once (from your GLB)
     */
    cacheRightArmSegments() {
        const shoulder = this.rightShoulderBone;
        const upperArm = this.rightUpperArmBone;
        const forearm = this.rightLowerArmBone;
        const hand = this.rightHandBone;
        if (!shoulder || !upperArm || !forearm || !hand) {
            const missing = [];
            if (!shoulder) missing.push('shoulder');
            if (!upperArm) missing.push('upperArm');
            if (!forearm) missing.push('forearm');
            if (!hand) missing.push('hand');
            console.warn(`[CAT] Cannot cache right arm segments - missing bones: ${missing.join(', ')}`);
            return;
        }
        
        const wpos = o => { 
            const v = new THREE.Vector3(); 
            o.updateMatrixWorld(true); 
            o.getWorldPosition(v); 
            return v; 
        };
        const pS = wpos(shoulder), pE = wpos(forearm), pW = wpos(hand);
        
        this._rightArmSeg = {
            L1: pS.distanceTo(pE),            // shoulder → elbow
            L2: pE.distanceTo(pW),            // elbow → wrist
            pole: new THREE.Vector3(0.35, 0.2, 0.9).normalize() // preferred bend direction
        };
        console.log('[CAT] Right arm segments cached - L1:', this._rightArmSeg.L1, 'L2:', this._rightArmSeg.L2);
    }
    
    /**
     * Lock left hand rotation to a desired orientation
     * @param {THREE.Quaternion} desiredWorldQuat - Desired world-space rotation for the hand
     */
    lockLeftHandRotation(desiredWorldQuat) {
        if (!this.leftHandBone) return;
        if (!this._leftHandLockQuat && desiredWorldQuat) {
            const parentInv = this.leftHandBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
            this._leftHandLockQuat = parentInv.multiply(desiredWorldQuat.clone());
        }
        if (this._leftHandLockQuat) {
            const q = this.leftHandBone.quaternion.clone();
            q.slerp(this._leftHandLockQuat, 0.35);       // damp toward the lock each frame
            this.leftHandBone.quaternion.copy(q);
        }
    }
    
    /**
     * Lock right hand rotation to a desired orientation
     * @param {THREE.Quaternion} desiredWorldQuat - Desired world-space rotation for the hand
     */
    lockRightHandRotation(desiredWorldQuat) {
        if (!this.rightHandBone) return;
        if (!this._rightHandLockQuat && desiredWorldQuat) {
            const parentInv = this.rightHandBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
            this._rightHandLockQuat = parentInv.multiply(desiredWorldQuat.clone());
        }
        if (this._rightHandLockQuat) {
            const q = this.rightHandBone.quaternion.clone();
            q.slerp(this._rightHandLockQuat, 0.35);       // damp toward the lock each frame
            this.rightHandBone.quaternion.copy(q);
        }
    }
    
    /**
     * Right-elbow pole stabilizer
     * Keeps the elbow's bend plane stable by steering the pole toward the rod (or camera) and smoothing it.
     * @param {number} dt - Delta time (default 1/60)
     */
    updateRightArmPole(dt = 1/60) {
        if (!this.rightShoulderBone || !this._rightArmSeg) return;
        
        const s = new THREE.Vector3(); 
        this.rightShoulderBone.getWorldPosition(s);
        const t = (this._rHandTargetW?.clone()) || s.clone().add(new THREE.Vector3(0.2, 0.1, 0.2));
        const dir = t.clone().sub(s).normalize();
        
        // Choose a target pole in world space: rod forward if available, else camera look, else world +Z
        let poleTarget = new THREE.Vector3(0,0,1);
        const rodRoot = this.sceneRef?.scene?.children.find(child => 
            child.name === 'RodRoot' || (child.userData && child.userData.handBone)
        );
        if (rodRoot) {
            rodRoot.updateMatrixWorld(true);
            const rq = new THREE.Quaternion(); 
            rodRoot.getWorldQuaternion(rq);
            poleTarget.set(0,0,1).applyQuaternion(rq).normalize();
        } else if (this.sceneRef?.camera) {
            this.sceneRef.camera.getWorldDirection(poleTarget);
            poleTarget.normalize();
        }
        
        // Make pole orthogonal to the reach direction to avoid degeneracy
        poleTarget.addScaledVector(dir, -poleTarget.dot(dir)).normalize();
        
        // Smooth to avoid flips
        if (!this._poleW) this._poleW = poleTarget.clone();
        this._poleW.lerp(poleTarget, 0.25);
        
        // Apply
        this._rightArmSeg.pole.copy(this._poleW);
    }
    
    /**
     * Analytic 2-bone IK that preserves bone lengths
     * @param {THREE.Vector3} targetWorldPos - World position for hand to reach
     * @param {THREE.Vector3} poleWorldDir - Optional pole vector for bend direction
     */
    solveRightArmIK(targetWorldPos, poleWorldDir = null) {
        const shoulder = this.rightShoulderBone;
        const upperArm = this.rightUpperArmBone;
        const forearm = this.rightLowerArmBone;
        const hand = this.rightHandBone;
        const seg = this._rightArmSeg;
        if (!shoulder || !upperArm || !forearm || !hand || !seg) return;
        
        const wpos = o => { 
            const v = new THREE.Vector3(); 
            o.updateMatrixWorld(true); 
            o.getWorldPosition(v); 
            return v; 
        };
        const pS = wpos(shoulder);
        
        // 1) Clamp distance so we never over-extend
        const dir = new THREE.Vector3().subVectors(targetWorldPos, pS);
        const reach = THREE.MathUtils.clamp(dir.length(), 0.0001, seg.L1 + seg.L2 - 1e-4);
        dir.normalize();
        
        // 2) Bend plane from a pole vector
        const pole = (poleWorldDir || seg.pole || new THREE.Vector3(0,0,1)).clone().normalize();
        let planeN = new THREE.Vector3().crossVectors(dir, pole);
        if (planeN.lengthSq() < 1e-6) planeN.set(0,1,0).cross(dir);
        planeN.normalize();
        const planeT = new THREE.Vector3().crossVectors(planeN, dir).normalize();
        
        // 3) Elbow position via law of cosines
        const a = (seg.L1*seg.L1 - seg.L2*seg.L2 + reach*reach) / (2*reach);
        const h = Math.max(0, Math.sqrt(Math.max(seg.L1*seg.L1 - a*a, 0)));
        const pOnLine = new THREE.Vector3().copy(pS).addScaledVector(dir, a);
        const pE = new THREE.Vector3().copy(pOnLine).addScaledVector(planeT, h); // elbow
        
        // Calculate clamped target position (actual reachable position)
        const clampedTarget = new THREE.Vector3().copy(pS).addScaledVector(dir, reach);
        const pW = clampedTarget; // wrist at clamped target position
        
        // Update debug helpers if they exist
        if (this._ikDbg) {
            this._ikDbg.elbow.position.copy(pE);
            this._ikDbg.target.position.copy(targetWorldPos);
        }
        
        // 4) Aim upper arm (+Y axis) from shoulder → elbow
        const parentQuatInv = upperArm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        const desiredUpperDirW = new THREE.Vector3().subVectors(pE, pS).normalize();
        const upperWorldQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), desiredUpperDirW);
        upperArm.quaternion.copy(parentQuatInv.multiply(upperWorldQuat));
        
        // 5) Aim forearm (+Y) from elbow → clamped target (wrist position)
        forearm.updateMatrixWorld(true);
        const foreParentInv = forearm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        // Use clamped target directly to ensure forearm points toward it
        const desiredForeDirW = new THREE.Vector3().subVectors(clampedTarget, pE).normalize();
        const foreWorldQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), desiredForeDirW);
        forearm.quaternion.copy(foreParentInv.multiply(foreWorldQuat));
        
        // 6) Position hand bone at target location (convert world position to local space)
        // Update forearm matrix first so we get correct world transform
        forearm.updateMatrixWorld(true);
        
        // Get forearm's world position (elbow) and quaternion
        const forearmWorldPos = new THREE.Vector3();
        const forearmWorldQuat = new THREE.Quaternion();
        forearm.getWorldPosition(forearmWorldPos); // This is the elbow position
        forearm.getWorldQuaternion(forearmWorldQuat);
        
        // Calculate offset from elbow to clamped target in world space
        const worldOffset = new THREE.Vector3().subVectors(clampedTarget, forearmWorldPos);
        
        // Convert world offset to local space (inverse rotation of forearm)
        const localOffset = new THREE.Vector3();
        const forearmWorldQuatInv = forearmWorldQuat.clone().invert();
        localOffset.copy(worldOffset).applyQuaternion(forearmWorldQuatInv);
        
        // Set hand bone position in forearm local space
        // In bone hierarchy, hand.position is relative to forearm origin (elbow)
        // The target should be at distance L2 from elbow along the forearm's Y axis
        // So we position the hand at the local offset to reach the target
        hand.position.copy(localOffset);
        
        // Update bone matrices
        upperArm.updateMatrixWorld(true);
        forearm.updateMatrixWorld(true);
        hand.updateMatrixWorld(true);
    }
    
    /**
     * Create a gripping pose for a hand to hold the rod
     * Rotates finger bones to curl around the handle
     * @param {string} side - 'left' or 'right' (default: 'left' since rod is now in left hand)
     */
    createHandGrip(side = 'left') {
        if (!this.model) return;
        
        const isLeft = side === 'left';
        const handSuffix = isLeft ? 'l' : 'r';
        const initRotationsKey = isLeft ? '_leftHandInitRotations' : '_rightHandInitRotations';
        
        // Store initial rotations for finger bones
        if (!this[initRotationsKey]) {
            this[initRotationsKey] = {};
        }
        
        // Find hand and finger bones based on side
        const handBone = isLeft ? (this.leftHandBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'handl'))
                                 : (this.rightHandBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'handr'));
        const thumb1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `thumb1${handSuffix}`);
        const thumb2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `thumb2${handSuffix}`);
        const thumb3 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `thumb3${handSuffix}`);
        const index1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `index1${handSuffix}`);
        const index2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `index2${handSuffix}`);
        const middle1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `middle1${handSuffix}`);
        const middle2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === `middle2${handSuffix}`);
        
        const initRotations = this[initRotationsKey];
        
        // Store initial rotations if not already stored
        if (handBone && !initRotations.hand) {
            initRotations.hand = handBone.rotation.clone();
        }
        if (thumb1 && !initRotations.thumb1) {
            initRotations.thumb1 = thumb1.rotation.clone();
        }
        if (thumb2 && !initRotations.thumb2) {
            initRotations.thumb2 = thumb2.rotation.clone();
        }
        if (thumb3 && !initRotations.thumb3) {
            initRotations.thumb3 = thumb3.rotation.clone();
        }
        if (index1 && !initRotations.index1) {
            initRotations.index1 = index1.rotation.clone();
        }
        if (index2 && !initRotations.index2) {
            initRotations.index2 = index2.rotation.clone();
        }
        if (middle1 && !initRotations.middle1) {
            initRotations.middle1 = middle1.rotation.clone();
        }
        if (middle2 && !initRotations.middle2) {
            initRotations.middle2 = middle2.rotation.clone();
        }
        
        // Apply gripping rotations
        // Hand: slight rotation to cup around handle
        if (handBone && initRotations.hand) {
            handBone.rotation.copy(initRotations.hand);
            handBone.rotation.x += 0.15; // Slight forward curl (rotate forward)
            // For left hand, reverse Z rotation direction
            handBone.rotation.z += isLeft ? -0.1 : 0.1; // Slight inward rotation (toward grip)
        }
        
        // Thumb: curl inward toward the rod
        if (thumb1 && initRotations.thumb1) {
            thumb1.rotation.copy(initRotations.thumb1);
            thumb1.rotation.x += 0.3; // Curl thumb forward
            thumb1.rotation.y += isLeft ? 0.2 : -0.2; // Rotate thumb inward (toward palm)
        }
        if (thumb2 && initRotations.thumb2) {
            thumb2.rotation.copy(initRotations.thumb2);
            thumb2.rotation.x += 0.4; // Second joint curl
        }
        if (thumb3 && initRotations.thumb3) {
            thumb3.rotation.copy(initRotations.thumb3);
            thumb3.rotation.x += 0.3; // Third joint curl
        }
        
        // Index finger: curl around handle
        if (index1 && initRotations.index1) {
            index1.rotation.copy(initRotations.index1);
            index1.rotation.x += 0.25; // First joint curl
        }
        if (index2 && initRotations.index2) {
            index2.rotation.copy(initRotations.index2);
            index2.rotation.x += 0.35; // Second joint curl
        }
        
        // Middle finger: curl around handle
        if (middle1 && initRotations.middle1) {
            middle1.rotation.copy(initRotations.middle1);
            middle1.rotation.x += 0.2; // First joint curl
        }
        if (middle2 && initRotations.middle2) {
            middle2.rotation.copy(initRotations.middle2);
            middle2.rotation.x += 0.3; // Second joint curl
        }
        
        // Update bone matrices after rotations
        if (handBone) handBone.updateMatrixWorld(true);
        if (thumb1) thumb1.updateMatrixWorld(true);
        if (thumb2) thumb2.updateMatrixWorld(true);
        if (thumb3) thumb3.updateMatrixWorld(true);
        if (index1) index1.updateMatrixWorld(true);
        if (index2) index2.updateMatrixWorld(true);
        if (middle1) middle1.updateMatrixWorld(true);
        if (middle2) middle2.updateMatrixWorld(true);
        
        // Update skeleton for skinned mesh
        this.model.traverse((child) => {
            if (child.isSkinnedMesh && child.skeleton) {
                child.skeleton.update();
            }
        });
        
        // Reduced logging - only log once per hand
        if (!this[`_${side}HandGripLogged`]) {
            console.log(`[CAT] Hand grip pose applied to ${side} hand`);
            this[`_${side}HandGripLogged`] = true;
        }
    }
    
        /**
         * Position left hand at specific handle position with tight static grip
         * @param {THREE.Vector3} targetWorldPos - World position where hand should grip the handle
         * @param {THREE.Quaternion} rodRotation - Rod's world rotation (for proper hand orientation)
         */
        positionLeftHandAtHandle(targetWorldPos, rodRotation = null) {
            if (!this.model || !targetWorldPos) return;
            
            const leftHandBone = this.leftHandBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'handl');
            if (!leftHandBone) {
                console.warn('[CAT] Left hand bone not found for handle positioning');
                return;
            }
            
            // Get left arm bones to position them statically
            const leftShoulderBone = this.leftShoulderBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'shoulderl');
            const leftUpperArmBone = this.leftUpperArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'arm_stretchl' || b.name.toLowerCase().includes('upperarm')));
            const leftLowerArmBone = this.leftLowerArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'forearm_stretchl' || b.name.toLowerCase().includes('forearm')));
            
            if (!leftLowerArmBone) {
                console.warn('[CAT] Left forearm bone not found for handle positioning');
                return;
            }
            
            // Store initial left arm rotations if not already stored (for static locking)
            if (!this._leftArmInitRotations) {
                this._leftArmInitRotations = {};
            }
            if (leftShoulderBone && !this._leftArmInitRotations.shoulder) {
                this._leftArmInitRotations.shoulder = leftShoulderBone.rotation.clone();
            }
            if (leftUpperArmBone && !this._leftArmInitRotations.upperArm) {
                this._leftArmInitRotations.upperArm = leftUpperArmBone.rotation.clone();
            }
            if (leftLowerArmBone && !this._leftArmInitRotations.forearm) {
                this._leftArmInitRotations.forearm = leftLowerArmBone.rotation.clone();
            }
            
            // Store initial hand position to prevent accumulation
            if (!this._leftHandInitPosition) {
                this._leftHandInitPosition = leftHandBone.position.clone();
                console.log('[CAT] Stored initial left hand position:', this._leftHandInitPosition);
            }
            
            // Update model matrices first
            this.model.updateMatrixWorld(true);
            
            // Lock shoulder and upper arm, but allow forearm to rotate to reach target
            // This allows arm to bend at elbow naturally
            if (leftShoulderBone && this._leftArmInitRotations.shoulder) {
                leftShoulderBone.rotation.copy(this._leftArmInitRotations.shoulder);
            }
            if (leftUpperArmBone && this._leftArmInitRotations.upperArm) {
                leftUpperArmBone.rotation.copy(this._leftArmInitRotations.upperArm);
            }
            // DON'T lock forearm - allow it to rotate to reach target
            
            // Update bone matrices for shoulder and upper arm
            if (leftShoulderBone) leftShoulderBone.updateMatrixWorld(true);
            if (leftUpperArmBone) leftUpperArmBone.updateMatrixWorld(true);
            
            // Get forearm base position (where it connects to upper arm) - this is the elbow
            const upperArmWorldPos = new THREE.Vector3();
            if (leftUpperArmBone) {
                leftUpperArmBone.updateMatrixWorld(true);
                leftUpperArmBone.getWorldPosition(upperArmWorldPos);
            } else {
                // Fallback: use shoulder if upper arm not available
                if (leftShoulderBone) {
                    leftShoulderBone.updateMatrixWorld(true);
                    leftShoulderBone.getWorldPosition(upperArmWorldPos);
                } else {
                    // If no upper arm, use forearm position as fallback
                    leftLowerArmBone.updateMatrixWorld(true);
                    leftLowerArmBone.getWorldPosition(upperArmWorldPos);
                }
            }
            
            // Calculate direction from elbow (upper arm position) to target
            const fromElbowToTarget = new THREE.Vector3().subVectors(targetWorldPos, upperArmWorldPos);
            const distanceFromElbowToTarget = fromElbowToTarget.length();
            
            // Get forearm's initial rotation (baseline) - keep it locked to prevent drift
            const initialForearmRot = this._leftArmInitRotations.forearm ? this._leftArmInitRotations.forearm.clone() : leftLowerArmBone.rotation.clone();
            const initialQuat = new THREE.Quaternion().setFromEuler(initialForearmRot);
            
            // Calculate desired forearm direction (from elbow toward target)
            const desiredForearmWorldDir = fromElbowToTarget.normalize();
            
            // Get forearm's current forward direction in world space (typically +Y in local space)
            const forearmLocalForward = new THREE.Vector3(0, 1, 0);
            leftLowerArmBone.updateMatrixWorld(true);
            const forearmWorldQuat = new THREE.Quaternion();
            leftLowerArmBone.getWorldQuaternion(forearmWorldQuat);
            const forearmWorldForward = forearmLocalForward.applyQuaternion(forearmWorldQuat);
            
            // DON'T rotate forearm - keep it locked at initial rotation
            // This prevents the hand from rotating backward into the body
            // Just position the hand bone to reach the target relative to the locked forearm
            leftLowerArmBone.rotation.copy(initialForearmRot);
            
            // Update forearm matrix with locked rotation
            leftLowerArmBone.updateMatrixWorld(true);
            
            // Calculate where hand should be relative to forearm
            // Convert target world position to forearm's local space
            const forearmWorldMatrix = new THREE.Matrix4();
            forearmWorldMatrix.copy(leftLowerArmBone.matrixWorld);
            const forearmWorldMatrixInv = new THREE.Matrix4().copy(forearmWorldMatrix).invert();
            const targetInForearmLocal = new THREE.Vector3().copy(targetWorldPos).applyMatrix4(forearmWorldMatrixInv);
            
            // Set hand position directly to target in forearm's local space
            // This ensures hand reaches the target exactly
            leftHandBone.position.copy(targetInForearmLocal);
            
            // Update hand bone matrix
            leftHandBone.updateMatrixWorld(true);
            
            // Verify final hand position
            if (!this._targetInForearmLocal) {
                this._targetInForearmLocal = new THREE.Vector3();
            }
            const finalHandWorldPos = new THREE.Vector3();
            leftHandBone.getWorldPosition(finalHandWorldPos);
            this._targetInForearmLocal.copy(finalHandWorldPos);
            
            // Apply tight grip pose (only once, not every frame)
            if (!this._leftHandPositioned) {
                this.createHandGrip('left');
                
                // Make sure grip is tighter (increase curl amounts)
                const handBone = leftHandBone;
                if (handBone && this._leftHandInitRotations && this._leftHandInitRotations.hand) {
                    handBone.rotation.copy(this._leftHandInitRotations.hand);
                    handBone.rotation.x += 0.25; // Increased curl for tighter grip (was 0.15)
                    handBone.rotation.z -= 0.15; // Increased inward rotation for tighter grip (was 0.1)
                }
                
                // Tighten finger curls for tighter grip
                const thumb1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb1l');
                const thumb2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb2l');
                const thumb3 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'thumb3l');
                const index1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index1l');
                const index2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'index2l');
                const middle1 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle1l');
                const middle2 = this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'middle2l');
                
                if (thumb1 && this._leftHandInitRotations && this._leftHandInitRotations.thumb1) {
                    thumb1.rotation.copy(this._leftHandInitRotations.thumb1);
                    thumb1.rotation.x += 0.4; // Increased curl (was 0.3)
                    thumb1.rotation.y += 0.3; // Increased inward rotation (was 0.2)
                }
                if (thumb2 && this._leftHandInitRotations && this._leftHandInitRotations.thumb2) {
                    thumb2.rotation.copy(this._leftHandInitRotations.thumb2);
                    thumb2.rotation.x += 0.5; // Increased curl (was 0.4)
                }
                if (thumb3 && this._leftHandInitRotations && this._leftHandInitRotations.thumb3) {
                    thumb3.rotation.copy(this._leftHandInitRotations.thumb3);
                    thumb3.rotation.x += 0.4; // Increased curl (was 0.3)
                }
                if (index1 && this._leftHandInitRotations && this._leftHandInitRotations.index1) {
                    index1.rotation.copy(this._leftHandInitRotations.index1);
                    index1.rotation.x += 0.35; // Increased curl (was 0.25)
                }
                if (index2 && this._leftHandInitRotations && this._leftHandInitRotations.index2) {
                    index2.rotation.copy(this._leftHandInitRotations.index2);
                    index2.rotation.x += 0.45; // Increased curl (was 0.35)
                }
                if (middle1 && this._leftHandInitRotations && this._leftHandInitRotations.middle1) {
                    middle1.rotation.copy(this._leftHandInitRotations.middle1);
                    middle1.rotation.x += 0.3; // Increased curl (was 0.2)
                }
                if (middle2 && this._leftHandInitRotations && this._leftHandInitRotations.middle2) {
                    middle2.rotation.copy(this._leftHandInitRotations.middle2);
                    middle2.rotation.x += 0.4; // Increased curl (was 0.3)
                }
                
                this._leftHandPositioned = true;
            }
            
            // Update hand bone matrix AFTER setting position
            leftHandBone.updateMatrixWorld(true);
            
            // Stable left-hand grip orientation based on rod
            if (this.leftHandBone) {
                let desiredLeftW = null;
                const rodRoot = this.sceneRef?.scene?.children.find(child => 
                    child.name === 'RodRoot' || (child.userData && child.userData.handBone)
                );
                if (rodRoot) {
                    rodRoot.updateMatrixWorld(true);
                    const rodQuat = new THREE.Quaternion(); 
                    rodRoot.getWorldQuaternion(rodQuat);
                    // Rotate ~90° around rod X so palm wraps the grip nicely
                    const offset = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(1,0,0), 
                        THREE.MathUtils.degToRad(90)
                    );
                    desiredLeftW = rodQuat.clone().multiply(offset);
                } else {
                    // Fallback: align with world up; small inward twist
                    desiredLeftW = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0,1,0), 
                        THREE.MathUtils.degToRad(-10)
                    );
                }
                this.lockLeftHandRotation(desiredLeftW);
            }
            
            // Verify hand reached target position (debug logging)
            if (!this._handPositionVerified) {
                const actualHandWorldPos = new THREE.Vector3();
                leftHandBone.getWorldPosition(actualHandWorldPos);
                const distanceToTarget = actualHandWorldPos.distanceTo(targetWorldPos);
                
                const forearmWorldPosAfter = new THREE.Vector3();
                leftLowerArmBone.getWorldPosition(forearmWorldPosAfter);
                
                console.log('[CAT] Hand positioning verification:');
                console.log('  Target world pos:', targetWorldPos);
                console.log('  Actual hand world pos:', actualHandWorldPos);
                console.log('  Distance to target:', distanceToTarget.toFixed(4));
                console.log('  Hand bone local pos:', leftHandBone.position);
                console.log('  Forearm world pos (after lock):', forearmWorldPosAfter);
                console.log('  Target in forearm local:', this._targetInForearmLocal);
                
                if (distanceToTarget > 0.1) {
                    console.warn('[CAT] WARNING: Hand did not reach target! Distance:', distanceToTarget.toFixed(4));
                } else {
                    console.log('[CAT] Hand successfully positioned at target');
                }
                
                this._handPositionVerified = true;
            }
            
            // Update skeleton AFTER all bone changes
            this.model.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                    child.skeleton.update();
                }
            });
        }
        
        /**
         * Maintain left hand grip without repositioning (called every frame to keep grip tight)
         */
        maintainLeftHandGrip() {
            if (!this.model || !this._leftHandPositioned) return;
            
            const leftHandBone = this.leftHandBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'handl');
            if (!leftHandBone) return;
            
            // Lock left arm bones to initial rotations to keep them static (no movement)
            const leftShoulderBone = this.leftShoulderBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'shoulderl');
            const leftUpperArmBone = this.leftUpperArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'arm_stretchl' || b.name.toLowerCase().includes('upperarm')));
            const leftLowerArmBone = this.leftLowerArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'forearm_stretchl' || b.name.toLowerCase().includes('forearm')));
            
            if (leftShoulderBone && this._leftArmInitRotations && this._leftArmInitRotations.shoulder) {
                leftShoulderBone.rotation.copy(this._leftArmInitRotations.shoulder);
            }
            if (leftUpperArmBone && this._leftArmInitRotations && this._leftArmInitRotations.upperArm) {
                leftUpperArmBone.rotation.copy(this._leftArmInitRotations.upperArm);
            }
            if (leftLowerArmBone && this._leftArmInitRotations && this._leftArmInitRotations.forearm) {
                leftLowerArmBone.rotation.copy(this._leftArmInitRotations.forearm);
            }
            
            // Keep hand grip tight (don't reapply - just maintain rotations)
            const handBone = leftHandBone;
            if (handBone && this._leftHandInitRotations && this._leftHandInitRotations.hand) {
                // Maintain tight grip rotations (already applied, just keep them)
                // Don't reapply to avoid log spam
            }
            
            // Update bone matrices
            if (leftShoulderBone) leftShoulderBone.updateMatrixWorld(true);
            if (leftUpperArmBone) leftUpperArmBone.updateMatrixWorld(true);
            if (leftLowerArmBone) leftLowerArmBone.updateMatrixWorld(true);
            leftHandBone.updateMatrixWorld(true);
            
            // Update skeleton
            this.model.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                    child.skeleton.update();
                }
            });
        }
        
        /**
         * Position right hand on rod during fishing, or return to idle position
         * @param {boolean} isFishing - True when casting, reeling, or fighting
         */
                positionRightHandForFishing(isFishing) {
                    if (!this.model) return;
                    
                    // CRITICAL: Don't retarget during celebration - celebration owns the hand target
                    if (this._celebrate?.active) return;
                    
                    // Debug logging removed - too spammy
                    // Uncomment below if debugging hand positioning issues
                    // if (!this._lastHandFishingState || this._lastHandFishingState !== isFishing) {
                    //     console.log(`[HAND] positionRightHandForFishing called: isFishing=${isFishing}`);
                    //     this._lastHandFishingState = isFishing;
                    // }
        
        // Find both hand bones
        const leftHandBone = this.leftHandBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'handl');
        const rightHandBone = this.rightHandBone || this.getAllBones().find(b => b.name && b.name.toLowerCase() === 'handr');
        
        if (!leftHandBone || !rightHandBone) return;
        
        // Store initial right arm bone rotations on first call (for returning to idle)
        if (!this._rightArmInitRotations) {
            this._rightArmInitRotations = {
                shoulder: this.rightShoulderBone ? this.rightShoulderBone.rotation.clone() : null,
                upperArm: this.rightUpperArmBone ? this.rightUpperArmBone.rotation.clone() : null,
                forearm: this.rightLowerArmBone ? this.rightLowerArmBone.rotation.clone() : null,
                hand: rightHandBone.position.clone()
            };
            console.log('[CAT] Right arm initial rotations stored:', this._rightArmInitRotations);
        }
        
        if (!isFishing) {
            // Idle: return right arm to its initial position and rotations
            if (this.rightShoulderBone && this._rightArmInitRotations.shoulder) {
                this.rightShoulderBone.rotation.copy(this._rightArmInitRotations.shoulder);
            }
            if (this.rightUpperArmBone && this._rightArmInitRotations.upperArm) {
                this.rightUpperArmBone.rotation.copy(this._rightArmInitRotations.upperArm);
            }
            if (this.rightLowerArmBone && this._rightArmInitRotations.forearm) {
                this.rightLowerArmBone.rotation.copy(this._rightArmInitRotations.forearm);
            }
            rightHandBone.position.copy(this._rightArmInitRotations.hand);
            
            // Update bone matrices
            if (this.rightShoulderBone) this.rightShoulderBone.updateMatrixWorld(true);
            if (this.rightUpperArmBone) this.rightUpperArmBone.updateMatrixWorld(true);
            if (this.rightLowerArmBone) this.rightLowerArmBone.updateMatrixWorld(true);
            rightHandBone.updateMatrixWorld(true);
            
            // Update skeleton for skinned mesh
            this.model.traverse((child) => {
                if (child.isSkinnedMesh && child.skeleton) {
                    child.skeleton.update();
                }
            });
            return;
        }
        
        // Fishing: position right hand at top of handle
        // Get rod handle section from the fishing system to calculate positions relative to handle
        // We need to find the rod handle to define two grip positions:
        // - Left hand: ~0.32 units up from handle bottom (current grip)
        // - Right hand: ~0.7 units up from handle bottom (near top, close to blank section)
        
        // Update matrices to get world positions
        this.model.updateMatrixWorld(true);
        leftHandBone.updateMatrixWorld(true);
        
        // Get left hand world position (current grip position - this is the reference point)
        const leftHandWorldPos = new THREE.Vector3();
        leftHandBone.getWorldPosition(leftHandWorldPos);
        
        // Get rod handle world position by finding the rod in the scene
        // The rod root is positioned at handOffset (0.32 units up handle) relative to left hand
        // So we need to find where the handle bottom is, then calculate positions from there
        const rodHandleBottomWorldPos = leftHandWorldPos.clone();
        
        // The left hand is gripping at 0.32 units up from the handle bottom (from handOffset.y = 0.32)
        // So to get handle bottom, we need to go DOWN from left hand position
        // Get left hand's world rotation to know rod direction
        const leftHandWorldQuat = new THREE.Quaternion();
        leftHandBone.getWorldQuaternion(leftHandWorldQuat);
        
        // Rod extends along +Y axis from handle (in rod's local space)
        // Convert rod's up direction to world space
        const rodUpDir = new THREE.Vector3(0, 1, 0).applyQuaternion(leftHandWorldQuat);
        
        // The rod extends along +Y axis in its local space
        // But we need to verify the direction in world space
        // Let's calculate the rod direction by looking at how the rod is oriented
        
        // Get the rod root to find its actual world direction
        // The rod root is stored in the scene, let's find it
        const rodRoot = this.sceneRef?.scene?.children.find(child => 
            child.name === 'RodRoot' || (child.userData && child.userData.handBone)
        );
        
        let actualRodUpDir = rodUpDir; // Default to left hand direction
        
        if (rodRoot) {
            // Get rod root's world rotation to determine actual rod direction
            rodRoot.updateMatrixWorld(true);
            const rodRootWorldQuat = new THREE.Quaternion();
            rodRoot.getWorldQuaternion(rodRootWorldQuat);
            
            // Rod extends along +Y in local space
            actualRodUpDir = new THREE.Vector3(0, 1, 0).applyQuaternion(rodRootWorldQuat);
        }
        
        // Position right hand just above left hand on the rod centerline
        // The rod root is positioned at rod centerline (0.32 units up handle)
        // Left hand grips the rod from the side (offset -0.03 in X)
        // Right hand should grip directly on the rod centerline
        
        // Find rod root position directly - it's at the rod centerline
        let rodCenterlineWorldPos = null;
        if (rodRoot) {
            rodRoot.updateMatrixWorld(true);
            rodCenterlineWorldPos = new THREE.Vector3();
            rodRoot.getWorldPosition(rodCenterlineWorldPos);
        } else {
            // Fallback: calculate rod centerline from left hand position
            // The rod root is at leftHandPosition + handOffset (which is already at rod center)
            const handOffset = new THREE.Vector3(-0.03, 0.32, 0.0); // Left hand offset
            const rodCenterOffset = handOffset.clone().applyQuaternion(leftHandWorldQuat);
            rodCenterlineWorldPos = leftHandWorldPos.clone().add(rodCenterOffset);
        }
        
        // Position right hand at the side of the reel
        // Reel is positioned at reelHeight (0.7 units up handle) and z offset (0.08)
        // Calculate reel position relative to rod centerline
        const reelHeight = 0.7; // Reel is 0.7 units up from handle bottom
        const reelZOffset = 0.08; // Reel forward offset from handle center
        
        // Get rod centerline position at reel height (0.7 units up from handle)
        // Left hand is at 0.32 units up handle, so reel is 0.38 units above left hand
        const offsetToReel = reelHeight - 0.32; // Distance from left hand to reel
        const reelCenterWorldPos = rodCenterlineWorldPos.clone().add(
            actualRodUpDir.clone().multiplyScalar(offsetToReel)
        );
        
        // Position right hand to the SIDE of the reel (on cat's right side, closest to his right hand)
        // Get rod's right direction (perpendicular to rod up and forward)
        const rodForward = new THREE.Vector3(0, 0, 1).applyQuaternion(leftHandWorldQuat);
        const rodRight = new THREE.Vector3().crossVectors(actualRodUpDir, rodForward).normalize();
        
        // Position hand at side of reel (on cat's RIGHT side, closest to his body/hand)
        // Use positive offset to position on cat's right side (same side as his right hand)
        const sideOffset = 0.12; // Positive to position on cat's right side (closest to his body)
        const forwardOffset = new THREE.Vector3(0, 0, reelZOffset).applyQuaternion(leftHandWorldQuat);
        const targetRightHandWorldPos = reelCenterWorldPos.clone()
            .add(rodRight.clone().multiplyScalar(sideOffset))
            .add(forwardOffset);
        
        // Find right arm bones if not already found
        const rightShoulder = this.rightShoulderBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('shoulderr')));
        const rightUpperArm = this.rightUpperArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('arm_stretchr')));
        const rightForearm = this.rightLowerArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('forearm_stretchr')));
        
        // Find finger tip bone for accurate positioning (index finger tip or middle finger tip)
        // Use the last bone in the finger chain (index2r or middle2r)
        const rightIndexTip = this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'index2r' || b.name.toLowerCase() === 'index2_r'));
        const rightMiddleTip = this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'middle2r' || b.name.toLowerCase() === 'middle2_r'));
        const rightFingerTip = rightIndexTip || rightMiddleTip; // Prefer index finger, fallback to middle
        
        // If we have the arm bones, use IK to position naturally
        if (rightShoulder && rightUpperArm && rightForearm && this._rightArmSeg) {
            // Keep shoulder locked at initial rotation (IK handles upper arm and forearm)
            if (this._rightArmInitRotations && this._rightArmInitRotations.shoulder) {
                rightShoulder.rotation.copy(this._rightArmInitRotations.shoulder);
            }
            
            // Get reel world position (reuse the target calculation we already did)
            let target = targetRightHandWorldPos.clone();
            
            // Slightly inside max reach to guarantee a visible elbow bend
            const s = new THREE.Vector3(); 
            rightShoulder.getWorldPosition(s);
            const v = new THREE.Vector3().subVectors(target, s);
            const maxLen = this._rightArmSeg.L1 + this._rightArmSeg.L2 - 0.02;
            if (v.length() > maxLen) {
                target = s.clone().addScaledVector(v.normalize(), maxLen);
            }
            
            // 1) Smooth target to kill micro-jitter
            // CRITICAL: Only do this when NOT celebrating - celebration handles its own target
            if (!this._celebrate?.active) {
                if (!this._rHandTargetW) this._rHandTargetW = target.clone();
                this._rHandTargetW.lerp(target, 0.25);
            }
            
            // 2) Stabilize elbow bend plane toward the rod/camera
            if (!this._celebrate?.active) {
                this.updateRightArmPole();
            }
            
            // 3) Solve IK with the smoothed target + stabilized pole
            // CRITICAL: Only solve IK here when NOT celebrating - celebration solves IK elsewhere
            if (!this._celebrate?.active) {
                this.solveRightArmIK(this._rHandTargetW, this._rightArmSeg?.pole);
            }
            
            // Lock hand rotation to stable grip orientation
            // CRITICAL: Only compute and apply lock when NOT celebrating
            if (rightHandBone && !this._celebrate?.active) {
                // Choose a stable desired world orientation for the grip.
                // Option A: match the rod's up axis so the palm hugs the reel handle.
                let desiredWorldQuat = null;
                if (rodRoot) {
                    const rodQuat = new THREE.Quaternion(); 
                    rodRoot.getWorldQuaternion(rodQuat);
                    // Offset so palm closes around: rotate ~90° about rod local X to put palm toward reel
                    const offset = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(1,0,0), 
                        THREE.MathUtils.degToRad(90)
                    );
                    desiredWorldQuat = rodQuat.clone().multiply(offset);
                } else {
                    // Fallback: use forearm direction with a fixed twist
                    const foreW = this.rightLowerArmBone.getWorldQuaternion(new THREE.Quaternion());
                    const twist = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0,1,0), 
                        THREE.MathUtils.degToRad(12)
                    );
                    desiredWorldQuat = foreW.clone().multiply(twist);
                }
                
                // Keep right hand locked (pass desiredWorldQuat for initialization, null after)
                this.lockRightHandRotation(this._rightHandLockQuat ? null : desiredWorldQuat);
                rightHandBone.updateMatrixWorld(true);
            }
        } else {
            // Fallback: position hand relative to forearm if bones not found
            const parentBone = rightHandBone.parent;
            if (parentBone && parentBone.isBone) {
                parentBone.updateMatrixWorld(true);
                const parentWorldMatrix = parentBone.matrixWorld.clone();
                const parentWorldMatrixInverse = new THREE.Matrix4();
                parentWorldMatrixInverse.copy(parentWorldMatrix).invert();
                
                // Convert target world position to parent's local space
                targetRightHandWorldPos.applyMatrix4(parentWorldMatrixInverse);
                rightHandBone.position.copy(targetRightHandWorldPos);
            } else {
                // Final fallback: use local offset
                rightHandBone.position.copy(this._rightArmInitRotations.hand);
            }
        }
        
        // Update bone matrix
        rightHandBone.updateMatrixWorld(true);
        
        // Update skeleton for skinned mesh
        this.model.traverse((child) => {
            if (child.isSkinnedMesh && child.skeleton) {
                child.skeleton.update();
            }
        });
    }
    
    /**
     * Get all bones in the model
     * @returns {Array<THREE.Bone>} Array of all bones
     */
    getAllBones() {
        return this.allBones;
    }
    
    /**
     * Get specific arm bone
     * @param {string} side - 'right' or 'left'
     * @param {string} part - 'shoulder', 'upperArm', 'lowerArm', or 'hand'
     * @returns {THREE.Bone|null} The requested bone or null if not found
     */
    getArmBone(side, part) {
        const boneName = `${side}${part.charAt(0).toUpperCase() + part.slice(1)}Bone`;
        return this[boneName] || null;
    }
    
    /**
     * Example: Rotate right arm to point toward target
     * This shows how to manually manipulate arm bones
     * @param {THREE.Vector3} targetPosition - World position to point arm toward
     */
    pointRightArmAt(targetPosition) {
        if (!this.rightShoulderBone || !this.rightUpperArmBone || !this.rightLowerArmBone) {
            console.warn('[CAT] Arm bones not found - cannot point arm');
            return;
        }
        
        // Get shoulder position in world space
        const shoulderPos = new THREE.Vector3();
        this.rightShoulderBone.getWorldPosition(shoulderPos);
        
        // Calculate direction from shoulder to target
        const direction = targetPosition.clone().sub(shoulderPos).normalize();
        
        // TODO: Calculate IK angles for shoulder, upper arm, lower arm
        // This would require inverse kinematics or angle calculations
        // For now, this is a placeholder showing how to access bones
        
        console.log('[CAT] Arm bones available for manual manipulation');
    }

    getModel() {
        return this.model;
    }
    
    /**
     * Get the cat's saved position (not affected by bone attachments)
     * Use this for camera calculations instead of model.position
     * @returns {THREE.Vector3} The saved position
     */
                getSavedPosition() {
                    // CRITICAL: Always force cat position to saved position
                    // Bone attachments (especially pivot system) can cause position drift
                    if (this.savedPosition && this.model) {
                        // Force position correction on every call to prevent drift
                        if (this.model.position.distanceTo(this.savedPosition) > 0.01) {
                            // Only log if drift is significant (to avoid spam)
                            if (!this._driftWarned || this.model.position.distanceTo(this.savedPosition) > 0.5) {
                                if (!this._driftWarned) {
                                    console.warn('[CAT] Model position drifted, correcting to saved position');
                                    this._driftWarned = true;
                                    setTimeout(() => { this._driftWarned = false; }, 5000);
                                }
                            }
                            // Save current rotation before correcting position
                            const currentRotationY = this.model.rotation.y;
                            const currentRotationX = this.model.rotation.x;
                            const currentRotationZ = this.model.rotation.z;
                            // Force position back to saved position
                            this.model.position.copy(this.savedPosition);
                            // Restore ALL rotations (don't let position correction affect rotation)
                            this.model.rotation.x = currentRotationX;
                            this.model.rotation.y = currentRotationY;
                            this.model.rotation.z = currentRotationZ;
                        }
                        return this.savedPosition.clone();
                    }
                    // Fallback to model position if saved position not set
                    return this.model ? this.model.position.clone() : new THREE.Vector3(0, 0.36, 3.4);
                }
    
                /**
                 * Update cat with sway animation and bobber tracking (called each frame)
                 * @param {number} delta - Time since last frame
                 * @param {boolean} isIdle - Whether the cat is idle (not casting or reeling)
                 * @param {THREE.Vector3|null} bobberPosition - Position of bobber to face toward (null if no bobber)
                 * @param {boolean} isFishing - True when casting, reeling, or fighting
                 */
                update(delta, isIdle = true, bobberPosition = null, isFishing = false) {
                    if (!this.model) return;
                    
                    // CRITICAL: Force cat position to saved position every frame
                    // This prevents bone attachments (like pivot system) from moving the cat
                    if (this.savedPosition) {
                        if (this.model.position.distanceTo(this.savedPosition) > 0.01) {
                            // Save current rotation before correcting position
                            const currentRotationY = this.model.rotation.y;
                            const currentRotationX = this.model.rotation.x;
                            const currentRotationZ = this.model.rotation.z;
                            // Force position back to saved position
                            this.model.position.copy(this.savedPosition);
                            // Restore rotations
                            this.model.rotation.x = currentRotationX;
                            this.model.rotation.y = currentRotationY;
                            this.model.rotation.z = currentRotationZ;
                        }
                    }
                    
                    // Update animation mixer if it exists (handles GLB animations)
                    // But only if not celebrating (celebration overrides animations)
                    if (this.mixer && !this._celebrate.active) {
                        this.mixer.update(delta);
                    }
        
        // Force initial rotation on first update if flag is set
        if (this._forceInitialRotation && !bobberPosition) {
            // Cat should face away from camera (toward water)
            // Test: rotation.y = 0 - if model faces +Z by default, this faces away from camera
            this.baseRotationY = 0;
            this.model.rotation.y = this.baseRotationY;
            this._forceInitialRotation = false;
            console.log('[CAT] Forced initial rotation - model.rotation.y:', this.model.rotation.y);
        }
        
        // Ensure baseRotationY is correct (cat should face away from camera)
        // Test: if rotation got set to Math.PI and cat faces wrong way, reset to 0
        if (Math.abs(this.baseRotationY - Math.PI) < 0.1) {
            // If it got set to Math.PI and cat faces wrong way, try 0 instead
            this.baseRotationY = 0;
            if (!bobberPosition) {
                // Only force rotation if no bobber is being tracked
                this.model.rotation.y = this.baseRotationY;
                console.log('[CAT] Corrected rotation from Math.PI to 0');
            }
        }
        
        // Update celebration animation FIRST to set hand target away from reel
        // Then use IK to move the hand to that target
        this.updateCelebrate(delta);
        
        // Position right hand using IK
        // CRITICAL: Celebration drives the hand target; only solve IK to that target
        // Normal fishing: position hand at reel using positionRightHandForFishing
        if (this._celebrate?.active) {
            // Celebration: IK solve already happened in updateCelebrate() at the end
            // Just ensure skeleton is updated
            if (this.model) {
                this.model.traverse((child) => {
                    if (child.isSkinnedMesh && child.skeleton) {
                        child.skeleton.update();
                    }
                });
            }
        } else {
            // Normal fishing/idle targeting
            this.positionRightHandForFishing(isFishing);
        }
        
        // If bobber is active and visible, rotate cat to face it
        if (bobberPosition && this.model) {
            const catPos = this.model.position.clone();
            const toBobber = bobberPosition.clone().sub(catPos);
            
            // Only rotate if bobber is far enough away (avoid jitter when too close)
            const distance = toBobber.length();
            if (distance > 0.5) {
                // Calculate direction to bobber (only XZ plane, ignore Y)
                toBobber.y = 0; // Only rotate horizontally (Y rotation)
                toBobber.normalize();
                
                // Calculate target rotation angle (in radians)
                // Cat's forward is typically +Z, so atan2 gives angle from +Z axis
                const targetAngle = Math.atan2(toBobber.x, toBobber.z);
                
                // Smooth interpolation toward target angle for natural rotation
                // Reduced lerp speed for smoother, less abrupt turning
                const lerpSpeed = 4.0; // How fast cat rotates to face bobber (reduced from 8.0 for smoother motion)
                const currentAngle = this.model.rotation.y;
                
                // Handle angle wrapping (shortest rotation path)
                let angleDiff = targetAngle - currentAngle;
                // Normalize to [-PI, PI] range
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                // Smoothly lerp toward target angle with reduced speed for natural turning
                const lerpedAngle = currentAngle + angleDiff * lerpSpeed * delta;
                this.model.rotation.y = lerpedAngle;
                
                // Update base rotation for reference
                this.baseRotationY = lerpedAngle;
                
                // Keep lean and weight shift minimal when tracking bobber
                this.model.rotation.x = 0;
                this.model.rotation.z = 0;
                
                // Keep left arm locked at handle position (static grip - no movement)
                // Left arm stays locked to maintain tight grip on handle
                if (this._leftArmInitRotations) {
                    let leftShoulder = this.leftShoulderBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'shoulderl' || b.name.toLowerCase().includes('shoulderl')));
                    let leftUpperArm = this.leftUpperArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('arm_stretchl')));
                    let leftForearm = this.leftLowerArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('forearm_stretchl')));
                    
                    // Lock left arm bones to initial rotations to keep them static (no movement)
                    if (leftShoulder && this._leftArmInitRotations.shoulder) {
                        leftShoulder.rotation.copy(this._leftArmInitRotations.shoulder);
                    }
                    if (leftUpperArm && this._leftArmInitRotations.upperArm) {
                        leftUpperArm.rotation.copy(this._leftArmInitRotations.upperArm);
                    }
                    if (leftForearm && this._leftArmInitRotations.forearm) {
                        leftForearm.rotation.copy(this._leftArmInitRotations.forearm);
                    }
                    
                    // Update matrices
                    if (this.model) {
                        this.model.traverse((child) => {
                            if (child.isBone) {
                                child.updateMatrixWorld(true);
                            }
                        });
                    }
                }
            }
        } else {
            // No bobber to track - apply sway when idle or reset when active
            if (isIdle) {
                const t = performance.now() * 0.001;
                
                // Gentle body sway - side to side (rotation around Y axis)
                // Multiple frequencies for natural, organic movement
                const sway1 = Math.sin(t * 0.9) * 0.012; // Primary slow body sway (gentler than rod)
                const sway2 = Math.sin(t * 1.7) * 0.006; // Secondary component
                const sway3 = Math.sin(t * 0.6) * 0.004; // Slow drift component
                const bodySway = sway1 + sway2 + sway3;
                
                // Apply sway to Y rotation (side to side)
                // Ensure baseRotationY is 0 (facing away from camera toward water if model faces +Z)
                // If baseRotationY got set to Math.PI, reset to 0
                if (Math.abs(this.baseRotationY - Math.PI) < 0.1) {
                    // If it got reset to Math.PI and cat faces wrong way, fix it to 0
                    this.baseRotationY = 0;
                }
                this.model.rotation.y = this.baseRotationY + bodySway;
                
                // Add subtle forward/back lean (rotation around X axis) for more organic feel
                // Much subtler than rod since cat is standing
                const lean = Math.sin(t * 0.8) * 0.003;
                this.model.rotation.x = lean;
                
                // Add slight Z-axis rotation (lean left/right) for natural weight shift
                const weightShift = Math.sin(t * 1.1) * 0.002;
                this.model.rotation.z = weightShift;
                
                // Left arm holds rod (stays still) - animation is filtered to exclude left arm
                // Right arm animates for reeling motion - handled by GLB animation clips
                // Animation mixer handles bone matrix updates automatically
                
                // Right hand positioning is already handled at the top of update() with isFishing parameter
                // No need to call again here - isFishing will be false when isIdle is true
            } else {
                // Reset to base rotation when active (casting/reeling) without bobber
                // Ensure baseRotationY is 0 (facing away from camera if model faces +Z)
                if (Math.abs(this.baseRotationY - Math.PI) < 0.1) {
                    // If it got reset to Math.PI and cat faces wrong way, fix it to 0
                    this.baseRotationY = 0;
                }
                this.model.rotation.y = this.baseRotationY;
                this.model.rotation.x = 0;
                this.model.rotation.z = 0;
                
                // Reset left arm to initial pose when active (casting/reeling)
                if (this._leftArmInitRotations) {
                    let leftShoulder = this.leftShoulderBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase() === 'shoulderl' || b.name.toLowerCase().includes('shoulderl')));
                    let leftUpperArm = this.leftUpperArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('arm_stretchl')));
                    let leftForearm = this.leftLowerArmBone || this.getAllBones().find(b => b.name && (b.name.toLowerCase().includes('forearm_stretchl')));
                    
                    if (leftShoulder && this._leftArmInitRotations.shoulder) {
                        leftShoulder.rotation.copy(this._leftArmInitRotations.shoulder);
                    }
                    if (leftUpperArm && this._leftArmInitRotations.upperArm) {
                        leftUpperArm.rotation.copy(this._leftArmInitRotations.upperArm);
                    }
                    if (leftForearm && this._leftArmInitRotations.forearm) {
                        leftForearm.rotation.copy(this._leftArmInitRotations.forearm);
                    }
                    
                    // Update matrices
                    if (this.model) {
                        this.model.traverse((child) => {
                            if (child.isBone) {
                                child.updateMatrixWorld(true);
                            }
                        });
                    }
                }
            }
        }
    }
}

