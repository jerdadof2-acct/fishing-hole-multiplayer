import * as THREE from 'three';
import { makeWaterMaterial } from './water/waterMaterial.js';
import { getWaterBodyConfig, DEFAULT_WATER_BODY_TYPE, WaterBodyTypes } from './water/waterBodyTypes.js';

// Create procedural water normal map if texture is missing
function createProceduralWaterNormal(offset = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Create a simple wave-like normal map pattern
    const imageData = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4;
            // Simple wave pattern for normal map
            const wave1 = Math.sin((x + offset * 512) * 0.05) * 0.5 + 0.5;
            const wave2 = Math.sin((y + offset * 512) * 0.03) * 0.5 + 0.5;
            const combined = (wave1 + wave2) / 2;
            
            // Normal map format: R=X, G=Y, B=Z (typical blue normal maps)
            // Simplified: make it mostly blue with some variation
            imageData.data[i] = Math.floor(combined * 255);     // R
            imageData.data[i + 1] = Math.floor(combined * 255); // G
            imageData.data[i + 2] = 255;                        // B (strong Z component)
            imageData.data[i + 3] = 255;                        // A
        }
    }
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export class Water2Lake {
    constructor(scene, lakeMask, waterBodyType = DEFAULT_WATER_BODY_TYPE) {
        this.sceneRef = scene;
        this.lakeMask = lakeMask;
        this.waterBodyType = waterBodyType;
        this.waterBodyConfig = getWaterBodyConfig(waterBodyType);
        this.water = null;
        this.mesh = null;
        this.groundSize = 400;
        this.waterY = 0;
        this.bounds = null;
        this.riverParticles = null; // River particle system (for rivers only)
        this.dockPostSplashes = null; // Splash effects around dock posts (for rivers only)
        this.dockPostParticles = null; // Particle stream from dock posts (for rivers only)
        this.time = 0; // Time accumulator for splash animations
    }
    
    /**
     * Create procedural cloud texture for reflections
     */
    createProceduralCloudTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create gradient sky with cloud-like patterns
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#87CEEB'); // Sky blue top
        gradient.addColorStop(0.5, '#B0E0E6'); // Light blue middle
        gradient.addColorStop(1, '#E0F6FF'); // Very light blue bottom
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add cloud-like white patches using noise/random patterns
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height * 0.6; // Clouds in upper portion
            const radius = 50 + Math.random() * 100;
            
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
    }
    
    /**
     * Create river particle system for flow visualization
     */
    createRiverParticles() {
        // Always create particle system, but only show for rivers
        // This allows switching between water types dynamically
        
        const particleCount = 600; // Increased from 400 to 600 for much more visible flow
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        
        // Initialize particles across the water surface
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // Random position across water surface
            positions[i3] = (Math.random() - 0.5) * this.groundSize * 0.8; // X
            positions[i3 + 1] = this.waterY + 0.15; // Y (higher above water for better visibility)
            positions[i3 + 2] = (Math.random() - 0.5) * this.groundSize * 0.8; // Z
            
            // Flow velocity (left to right for rivers)
            // Default to left-to-right flow, will be updated when river type is active
            const flowDir = this.waterBodyConfig?.flowDirection || new THREE.Vector2(1, 0);
            const speed = 0.8 + Math.random() * 0.6; // Much faster: 0.8-1.4 (was 0.5-0.9) for very visible flow
            velocities[i3] = flowDir.x * speed; // X velocity (left to right)
            velocities[i3 + 1] = 0; // Y velocity (floating on surface)
            velocities[i3 + 2] = flowDir.y * speed; // Z velocity
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0x88ddff, // Light blue-white for better visibility on water
            size: 1.0, // Much larger: 1.0 (was 0.5) for very visible flow
            transparent: true,
            opacity: 1.0, // Full opacity for maximum visibility
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: false, // Keep size consistent regardless of distance
            fog: false // Disable fog so particles stay bright
        });
        
        this.riverParticles = new THREE.Points(geometry, material);
        this.riverParticles.userData.velocities = velocities;
        this.riverParticles.userData.positions = positions;
        this.riverParticles.visible = this.waterBodyConfig.hasFlow === true; // Show if river type
        this.riverParticles.renderOrder = 1000; // Render on top of water
        this.sceneRef.scene.add(this.riverParticles);
        
        // Debug: Log particle visibility
        console.log('[RIVER] Particles created:', particleCount, 'Visible:', this.riverParticles.visible, 'HasFlow:', this.waterBodyConfig.hasFlow);
    }
    
    /**
     * Create splash/wake effects around dock posts for rivers
     * Creates animated ring meshes that simulate water flowing around posts
     */
    createDockPostSplashes() {
        // Create splash system for POND docks only (not rivers)
        // Rivers use particle streams instead
        // Only create for pond water body type
        
        // Dock parameters (matching platform.js)
        const dockWidth = 3; // From platform.js
        const dockDepth = 14; // From platform.js
        const dockCenterZ = -1.5; // Dock position offset
        
        // POND dock post positions (from platform.js createDock)
        // Pond has 4 posts: 2 on front edge (water side), 2 on back edge
        // Dock group is positioned at (0, raisedDockY, -1.5), and posts are positioned relative to dock group
        // Post positions from platform.js are relative to dock group origin (z=0 at group center)
        // Dock is at z=-1.5 in world space, so posts are at world z = -1.5 + (dockDepth * 0.35 or -dockDepth * 0.35)
        const dockWorldZ = -1.5; // Dock center Z position in world space (from platform.js)
        const postPositions = [
            // Front edge (water side) - 2 posts for pond
            { x: -dockWidth * 0.3, z: dockWorldZ + dockDepth * 0.35 },
            { x: dockWidth * 0.3, z: dockWorldZ + dockDepth * 0.35 },
            // Back edge - 2 posts for pond
            { x: -dockWidth * 0.3, z: dockWorldZ - dockDepth * 0.35 },
            { x: dockWidth * 0.3, z: dockWorldZ - dockDepth * 0.35 }
        ];
        
        // Create splash group
        const splashGroup = new THREE.Group();
        splashGroup.name = 'DockPostSplashes';
        
        // Material for splash rings (white/light blue, semi-transparent, additive)
        // Make more visible for pond (higher opacity, brighter color)
        const splashMaterial = new THREE.MeshBasicMaterial({
            color: 0xccddff, // Brighter light blue-white (increased from 0xaaccff)
            transparent: true,
            opacity: 0.8, // Increased from 0.6 for better visibility
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Create 2-3 rings per post (to create wake effect)
        // Make MUCH bigger so they're clearly visible above deck
        const ringsPerPost = 3;
        const baseRadius = 0.35; // Inner radius (much larger: was 0.20, original 0.15)
        const ringThickness = 0.20; // Ring thickness (much thicker: was 0.12, original 0.08)
        const ringSpacing = 0.25; // Space between rings (larger spacing: was 0.15, original 0.12)
        
        postPositions.forEach((post, postIndex) => {
            // Create multiple rings around each post
            for (let ringIndex = 0; ringIndex < ringsPerPost; ringIndex++) {
                const ringRadius = baseRadius + ringIndex * ringSpacing;
                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(ringRadius, ringRadius + ringThickness, 32),
                    splashMaterial.clone()
                );
                
                // Rotate to lay flat on water surface
                ring.rotation.x = -Math.PI / 2;
                
                // Position at water surface around post
                // CRITICAL: Position HIGHER above water to ensure visibility above dock
                ring.position.set(
                    post.x,
                    this.waterY + 0.05, // Higher above water surface (was 0.02) to ensure visibility
                    post.z
                );
                
                // For pond, splashes are symmetrical (no downstream offset needed)
                // Just position rings around posts
                
                // Store animation data
                // Make each ring completely independent with random timing
                // For outward expansion that dissipates: track life cycle
                ring.userData = {
                    postIndex,
                    ringIndex,
                    baseRadius: ringRadius, // Starting radius
                    maxRadius: ringRadius + 0.8, // Maximum expansion before reset (each ring expands to this)
                    speed: 0.3 + Math.random() * 0.5, // Expansion speed (0.3 to 0.8)
                    startTime: Math.random() * 5.0, // Random start time offset (0 to 5 seconds)
                    lifetime: 2.5 + Math.random() * 2.0, // Lifetime before reset (2.5 to 4.5 seconds)
                    fadeStart: 0.6 // Start fading at 60% of lifetime
                };
                
                splashGroup.add(ring);
            }
        });
        
        // Only show splashes for POND (not RIVER)
        splashGroup.visible = (this.waterBodyType === 'POND');
        this.dockPostSplashes = splashGroup;
        this.sceneRef.scene.add(splashGroup);
        
        console.log('[DOCK] Post splashes created for', this.waterBodyType, ':', postPositions.length, 'posts,', ringsPerPost, 'rings per post, visible:', splashGroup.visible);
    }
    
    /**
     * Create particle stream from dock posts for rivers
     * Particles emit from posts and flow downstream with the current
     */
    createDockPostParticles() {
        // Always create particle system, but only show for rivers
        // This allows switching between water types dynamically
        
        // Dock parameters (matching platform.js)
        const dockWidth = 3; // From platform.js
        const dockDepth = 14; // From platform.js
        const dockCenterZ = -1.5; // Dock position offset
        
        // River dock post positions (from platform.js createDock)
        const postPositions = [
            // Front edge (water side) - 3 posts
            { x: -dockWidth * 0.4, z: dockCenterZ + dockDepth * 0.35 },
            { x: 0, z: dockCenterZ + dockDepth * 0.35 },
            { x: dockWidth * 0.4, z: dockCenterZ + dockDepth * 0.35 },
            // Back edge - 3 posts
            { x: -dockWidth * 0.4, z: dockCenterZ - dockDepth * 0.35 },
            { x: 0, z: dockCenterZ - dockDepth * 0.35 },
            { x: dockWidth * 0.4, z: dockCenterZ - dockDepth * 0.35 },
            // Middle supports - 2 posts
            { x: -dockWidth * 0.4, z: dockCenterZ },
            { x: dockWidth * 0.4, z: dockCenterZ }
        ];
        
        // Create particles from posts
        // 5-8 particles per post, more from front posts (water hits them first)
        const totalParticles = 50; // Total particles across all posts
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(totalParticles * 3);
        const velocities = new Float32Array(totalParticles * 3);
        const colors = new Float32Array(totalParticles * 3); // RGB colors
        const spawnTimes = new Float32Array(totalParticles); // Track spawn time for each particle
        const lifetimes = new Float32Array(totalParticles); // Random lifetime (2-2.5 seconds) for each particle
        
        // Get flow direction for downstream movement
        const flowDir = this.waterBodyConfig?.flowDirection || new THREE.Vector2(-1, 0); // Left to right
        
        let particleIndex = 0;
        
        // Distribute particles across posts (more from front posts)
        postPositions.forEach((post, postIndex) => {
            const particlesPerPost = postIndex < 3 ? 8 : 6; // Front posts get more particles
            
            for (let i = 0; i < particlesPerPost && particleIndex < totalParticles; i++) {
                const i3 = particleIndex * 3;
                
                // Start particles at post position with slight random offset
                const offsetRadius = 0.08 + Math.random() * 0.04; // Small offset from post center
                const angle = Math.random() * Math.PI * 2;
                positions[i3] = post.x + Math.cos(angle) * offsetRadius; // X
                positions[i3 + 1] = this.waterY + 0.05 + Math.random() * 0.05; // Y (just below water surface)
                positions[i3 + 2] = post.z + Math.sin(angle) * offsetRadius; // Z
                
                // Flow velocity: downstream direction with random variation
                const baseSpeed = 0.4 + Math.random() * 0.3; // Slower than main river particles
                const speedVariation = 0.1;
                velocities[i3] = flowDir.x * baseSpeed + (Math.random() - 0.5) * speedVariation; // X (flow direction)
                velocities[i3 + 1] = -0.02 + Math.random() * 0.02; // Y (slight downward drift)
                velocities[i3 + 2] = flowDir.y * baseSpeed + (Math.random() - 0.5) * speedVariation; // Z
                
                // Random white/grey shades
                const brightness = 0.6 + Math.random() * 0.4; // 0.6 to 1.0 (white to light grey)
                colors[i3] = brightness;     // R
                colors[i3 + 1] = brightness; // G
                colors[i3 + 2] = brightness; // B
                
                // Set spawn time and lifetime for this particle
                spawnTimes[particleIndex] = 0; // Will be set to current time when first updated
                lifetimes[particleIndex] = 2.0 + Math.random() * 0.5; // Random lifetime: 2.0 to 2.5 seconds
                
                particleIndex++;
            }
        });
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Material: white/grey particles with reduced visibility
        const material = new THREE.PointsMaterial({
            size: 0.8, // Slightly smaller than main river particles
            transparent: true,
            opacity: 0.4, // Lower visibility (40% opacity)
            vertexColors: true, // Use vertex colors (white/grey shades)
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: false,
            fog: false
        });
        
        this.dockPostParticles = new THREE.Points(geometry, material);
        this.dockPostParticles.userData.positions = positions;
        this.dockPostParticles.userData.velocities = velocities;
        this.dockPostParticles.userData.postPositions = postPositions; // Store for respawning
        this.dockPostParticles.userData.spawnTimes = spawnTimes; // Track spawn time for each particle
        this.dockPostParticles.userData.lifetimes = lifetimes; // Track lifetime for each particle
        this.dockPostParticles.userData.initialized = false; // Flag to initialize spawn times on first update
        this.dockPostParticles.visible = this.waterBodyConfig.hasFlow === true;
        this.dockPostParticles.renderOrder = 1001; // Render above water and main particles
        this.sceneRef.scene.add(this.dockPostParticles);
        
        console.log('[RIVER] Dock post particles created:', totalParticles, 'particles, visible:', this.dockPostParticles.visible);
    }
    
    /**
     * Change water body type (e.g., 'POND', 'RIVER', 'LAKE', 'OCEAN')
     */
    setWaterBodyType(type) {
        this.waterBodyType = type;
        this.waterBodyConfig = getWaterBodyConfig(type);
        if (this.mesh && this.mesh.material) {
            // Update material with new water body properties
            const material = this.mesh.material;
            material.uniforms.uColorDeep.value.copy(this.waterBodyConfig.deepColor);
            material.uniforms.uColorShallow.value.copy(this.waterBodyConfig.shallowColor);
            material.uniforms.uFogColor.value.copy(this.waterBodyConfig.fogColor);
            material.uniforms.uFogDepth.value = this.waterBodyConfig.fogDepth;
            material.uniforms.uFogIntensity.value = this.waterBodyConfig.fogIntensity;
            material.uniforms.uTurbidity.value = this.waterBodyConfig.turbidity;
            material.uniforms.uAbsorption.value = this.waterBodyConfig.absorption;
            material.uniforms.uOpacity.value = this.waterBodyConfig.opacity;
            material.uniforms.uSparkleStrength.value = this.waterBodyConfig.sparkleStrength;
            
            // Update wave parameters if they exist
            if (this.waterBodyConfig.waveSpeed !== undefined) {
                material.uniforms.waveSpeed.value = this.waterBodyConfig.waveSpeed;
            }
            if (this.waterBodyConfig.waveScale !== undefined) {
                material.uniforms.waveScale.value = this.waterBodyConfig.waveScale;
            }
            if (this.waterBodyConfig.waveAmplitude !== undefined) {
                material.uniforms.waveAmplitude.value = this.waterBodyConfig.waveAmplitude;
            }
            
            // Update flow direction and speed for rivers
            if (this.waterBodyConfig.hasFlow && this.waterBodyConfig.flowDirection) {
                const flowDir = this.waterBodyConfig.flowDirection;
                material.uniforms.uFlowDirection.value.copy(flowDir);
                material.uniforms.uFlowSpeed.value = this.waterBodyConfig.flowSpeed || 1.5;
                
                // Align normal map scrolls with flow direction for stronger left-right visual
                // Make the normal maps scroll in the flow direction instead of diagonally
                material.uniforms.uScroll1.value.set(
                    0.15 * flowDir.x,
                    0.15 * flowDir.y
                );
                material.uniforms.uScroll2.value.set(
                    -0.07 * flowDir.x,
                    0.11 * flowDir.y
                );
                
                // Boost flow speed and wave amplitude for stronger river effect
                material.uniforms.uFlowSpeed.value = 2.2; // Increased from 1.5
                if (material.uniforms.waveAmplitude) {
                    material.uniforms.waveAmplitude.value *= 1.15; // Small boost to moving terms
                }
            } else {
                material.uniforms.uFlowDirection.value.set(0, 0);
                material.uniforms.uFlowSpeed.value = 0.0;
            }
            
            // Show/hide and update river particles based on water body type
            if (this.riverParticles) {
                const shouldBeVisible = (this.waterBodyConfig.hasFlow === true);
                if (this.riverParticles.visible !== shouldBeVisible) {
                    this.riverParticles.visible = shouldBeVisible;
                    console.log('[RIVER] Particles visibility changed to:', shouldBeVisible, 'type:', type, 'hasFlow:', this.waterBodyConfig.hasFlow);
                }
                
                // Update splash visibility for POND only (not rivers)
                if (this.dockPostSplashes) {
                    const splashShouldBeVisible = (type === 'POND');
                    if (this.dockPostSplashes.visible !== splashShouldBeVisible) {
                        this.dockPostSplashes.visible = splashShouldBeVisible;
                        console.log('[DOCK] Splash visibility changed to:', splashShouldBeVisible, 'type:', type);
                    }
                }
                
                // Update dock post particle visibility for rivers
                // CRITICAL: Particles must stay visible for river type - never turn them off once on
                if (this.dockPostParticles) {
                    const particlesShouldBeVisible = (this.waterBodyConfig.hasFlow === true);
                    // Always ensure particles are visible when they should be
                    if (!this.dockPostParticles.visible && particlesShouldBeVisible) {
                        this.dockPostParticles.visible = true;
                        console.log('[RIVER] Post particles FORCED visible - type:', type, 'hasFlow:', this.waterBodyConfig.hasFlow);
                    } else if (this.dockPostParticles.visible !== particlesShouldBeVisible) {
                        this.dockPostParticles.visible = particlesShouldBeVisible;
                        console.log('[RIVER] Post particles visibility changed to:', particlesShouldBeVisible, 'type:', type, 'hasFlow:', this.waterBodyConfig.hasFlow);
                    }
                }
                
                // Rebuild particle velocities when switching to river type
                if (this.waterBodyConfig.hasFlow) {
                    const flowDir = this.waterBodyConfig.flowDirection || new THREE.Vector2(1, 0);
                    const velocities = this.riverParticles.userData.velocities;
                    if (velocities) {
                        for (let i = 0; i < velocities.length; i += 3) {
                            const speed = 0.8 + Math.random() * 0.6; // Match the faster speed from creation
                            velocities[i] = flowDir.x * speed; // X velocity (flowDir.x = -1 for left-to-right screen movement)
                            velocities[i + 1] = 0; // Y velocity (floating on surface)
                            velocities[i + 2] = flowDir.y * speed; // Z velocity
                        }
                    }
                }
            }
        }
    }

    create() {
        // Create ground plane (grass base)
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(this.groundSize, this.groundSize, 1, 1),
            new THREE.MeshStandardMaterial({ 
                color: 0x86a766, 
                roughness: 1 
            })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = this.waterY - 0.05; // Slightly below water for clean edge
        ground.receiveShadow = true;
        this.sceneRef.scene.add(ground);

        // Create water geometry with enough detail for waves
        const waterGeometry = new THREE.PlaneGeometry(this.groundSize, this.groundSize, 128, 128);
        
        // Load normal maps for the new material system with fallback
        const textureLoader = new THREE.TextureLoader();
        let normalMap1, normalMap2;
        
        // Try to load normal maps, but create procedural fallbacks if they fail
        try {
            normalMap1 = textureLoader.load(
                "/assets/textures/waterNormals1.jpg",
                undefined,
                undefined,
                () => {
                    // onError - create procedural fallback
                    console.warn('waterNormals1.jpg not found, creating procedural normal map');
                    normalMap1 = createProceduralWaterNormal();
                }
            );
            
            normalMap2 = textureLoader.load(
                "/assets/textures/waterNormals2.jpg",
                undefined,
                undefined,
                () => {
                    // onError - create procedural fallback
                    console.warn('waterNormals2.jpg not found, creating procedural normal map');
                    normalMap2 = createProceduralWaterNormal(0.5); // Slightly different pattern
                }
            );
            
            // If textures aren't loaded yet, create procedural fallbacks as backup
            if (!normalMap1 || !normalMap1.image) {
                normalMap1 = createProceduralWaterNormal();
            }
            if (!normalMap2 || !normalMap2.image) {
                normalMap2 = createProceduralWaterNormal(0.5);
            }
        } catch (e) {
            console.warn('Error loading water normal maps, using procedural fallbacks');
            normalMap1 = createProceduralWaterNormal();
            normalMap2 = createProceduralWaterNormal(0.5);
        }
        
        // Get actual sun direction from scene's directional light
        // Directional light position: (-10, 20, 10) = upper left
        // Light direction points from position toward origin (from upper left toward center)
        // Direction vector from (-10, 20, 10) to (0, 0, 0) = (10, -20, -10) normalized
        let sunDir = new THREE.Vector3(10, -20, -10).normalize(); // Fallback: from upper left toward origin
        const sun = this.sceneRef.scene.children.find(o => o.isDirectionalLight);
        if (sun) {
            const d = new THREE.Vector3();
            sun.getWorldDirection(d); // Gets direction light is pointing (toward scene from upper left)
            if (d.lengthSq() > 0) {
                sunDir.copy(d.normalize());
            }
        }
        
        // Create water material using the new system with water body type configuration
        // Uses the configured water body type (POND, RIVER, LAKE, OCEAN) for distinct appearance
        const waterMaterial = makeWaterMaterial({
            normalMap1,
            normalMap2,
            sunDir: sunDir,
            waterColor: this.waterBodyConfig.deepColor,
            shallowColor: this.waterBodyConfig.shallowColor,
            fresnelPower: 5.0,
            fresnelScale: 1.0,
            fresnelBias: 0.02,
            sparkleStrength: this.waterBodyConfig.sparkleStrength,
            fogColor: this.waterBodyConfig.fogColor,
            fogDepth: this.waterBodyConfig.fogDepth,
            fogIntensity: this.waterBodyConfig.fogIntensity,
            turbidity: this.waterBodyConfig.turbidity,
            absorption: this.waterBodyConfig.absorption,
            opacity: this.waterBodyConfig.opacity
        });
        
        // Extend material to support lake mask and ripples (existing functionality)
        waterMaterial.uniforms.lakeMask = { value: this.lakeMask };
        waterMaterial.uniforms.ripplePos0 = { value: new THREE.Vector2(0, 0) };
        waterMaterial.uniforms.ripplePos1 = { value: new THREE.Vector2(0, 0) };
        waterMaterial.uniforms.ripplePos2 = { value: new THREE.Vector2(0, 0) };
        waterMaterial.uniforms.ripplePos3 = { value: new THREE.Vector2(0, 0) };
        waterMaterial.uniforms.rippleTime0 = { value: 0.0 };
        waterMaterial.uniforms.rippleTime1 = { value: 0.0 };
        waterMaterial.uniforms.rippleTime2 = { value: 0.0 };
        waterMaterial.uniforms.rippleTime3 = { value: 0.0 };
        waterMaterial.uniforms.rippleAmp = { value: 0.12 };
        // Wave parameters from water body config (defaults for LAKE)
        waterMaterial.uniforms.waveSpeed = { value: this.waterBodyConfig.waveSpeed || 2.0 };
        waterMaterial.uniforms.waveScale = { value: this.waterBodyConfig.waveScale || 1.1 };
        waterMaterial.uniforms.waveAmplitude = { value: this.waterBodyConfig.waveAmplitude || 0.07 };
        
        // Apply flow direction and speed ONLY for rivers (left to right)
        // For non-river types (LAKE, POND, OCEAN), keep default scrolls and no flow
        if (this.waterBodyConfig.hasFlow && this.waterBodyConfig.flowDirection) {
            const flowDir = this.waterBodyConfig.flowDirection;
            waterMaterial.uniforms.uFlowDirection.value.copy(flowDir);
            waterMaterial.uniforms.uFlowSpeed.value = this.waterBodyConfig.flowSpeed || 2.2; // Increased flow speed
            
            // Align normal map scrolls with flow direction for stronger left-right visual (RIVER ONLY)
            // Make the normal maps scroll in the flow direction instead of diagonally
            waterMaterial.uniforms.uScroll1.value.set(
                0.15 * flowDir.x,
                0.15 * flowDir.y
            );
            waterMaterial.uniforms.uScroll2.value.set(
                -0.07 * flowDir.x,
                0.11 * flowDir.y
            );
            
            // Boost wave amplitude for stronger river effect (RIVER ONLY)
            if (waterMaterial.uniforms.waveAmplitude) {
                waterMaterial.uniforms.waveAmplitude.value *= 1.15;
            }
        } else {
            // Non-river types: no flow, keep default diagonal scrolls
            waterMaterial.uniforms.uFlowDirection.value.set(0, 0);
            waterMaterial.uniforms.uFlowSpeed.value = 0.0;
            // Keep default scroll values from makeWaterMaterial (diagonal, works great for lakes/oceans)
        }
        
        // Create procedural cloud texture for reflections
        const cloudTexture = this.createProceduralCloudTexture();
        waterMaterial.uniforms.uCloudTexture.value = cloudTexture;
        
        // Create river particle system (if river)
        this.createRiverParticles();
        // Create dock post splash effects (if river)
        this.createDockPostSplashes();
        // Create dock post particle stream (if river)
        this.createDockPostParticles();
        
        // Replace fragment shader to include lake mask and ripples
        const originalFragmentShader = waterMaterial.fragmentShader;
        waterMaterial.fragmentShader = originalFragmentShader.replace(
            'gl_FragColor = vec4(color, finalOpacity);',
            `
            // Lake mask support
            vec2 maskUV = vec2((vWorldPos.x / 400.0) + 0.5, 1.0 - ((vWorldPos.z / 400.0) + 0.5));
            float maskValue = texture2D(lakeMask, maskUV).r;
            float edgeAlpha = smoothstep(0.45, 0.55, maskValue);
            float alpha = mix(0.0, finalOpacity, edgeAlpha);
            
            gl_FragColor = vec4(color, alpha);
            `
        );
        
        // Add lake mask uniform to fragment shader
        const fragUniforms = `
            uniform sampler2D lakeMask;
        `;
        waterMaterial.fragmentShader = waterMaterial.fragmentShader.replace(
            'precision highp float;',
            `precision highp float;\n${fragUniforms}`
        );
        
        // Extend vertex shader to support waves and ripples
        const originalVertexShader = waterMaterial.vertexShader;
        const waveVertexShader = `
            uniform float uTime;
            uniform float waveSpeed;
            uniform float waveScale;
            uniform float waveAmplitude;
            uniform vec2 ripplePos0;
            uniform vec2 ripplePos1;
            uniform vec2 ripplePos2;
            uniform vec2 ripplePos3;
            uniform float rippleTime0;
            uniform float rippleTime1;
            uniform float rippleTime2;
            uniform float rippleTime3;
            uniform float rippleAmp;
            uniform vec2 uFlowDirection;
            uniform float uFlowSpeed;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vElevation;
            
            void main() {
              vUv = uv;
              
              vec3 pos = position;
              vec2 p = pos.xz;
              
              // Apply flow offset for rivers (makes waves move in flow direction)
              float flowOffsetX = uFlowDirection.x * uFlowSpeed * uTime;
              float flowOffsetZ = uFlowDirection.y * uFlowSpeed * uTime;
              
              // Base waves - use waveAmplitude uniform for configurable wave size
              // For rivers, add flow offset to make waves move in flow direction
              float wave1 = sin((position.x + flowOffsetX * 0.5) * 3.0 + uTime * waveSpeed) * waveAmplitude;
              float wave2 = sin((position.z + flowOffsetZ * 0.5) * 3.0 + uTime * waveSpeed * 0.8) * waveAmplitude;
              float wave3 = sin((position.x + position.z + flowOffsetX * 0.3 + flowOffsetZ * 0.3) * 2.2 + uTime * waveSpeed * 0.55) * waveAmplitude * 0.85;
              float wave4 = sin((position.x - position.z + flowOffsetX * 0.3) * 2.0 + uTime * waveSpeed * 0.37) * waveAmplitude * 0.7;
              // Additional choppy waves for ocean (higher frequency, smaller amplitude)
              // For rivers, add flow-affected choppy waves that move with flow
              float chop1 = sin((position.x + flowOffsetX * 0.6) * 5.0 + uTime * waveSpeed * 1.5) * waveAmplitude * 0.4;
              float chop2 = sin((position.z + flowOffsetZ * 0.6) * 4.5 + uTime * waveSpeed * 1.3) * waveAmplitude * 0.4;
              
              // Flow-specific waves for rivers (make water look like it's moving left to right)
              float flowWave = 0.0;
              if (uFlowSpeed > 0.0) {
                  // Add directional waves that move with the flow (stronger effect)
                  flowWave = sin((position.x * uFlowDirection.x + position.z * uFlowDirection.y) * 4.5 + uTime * waveSpeed * 1.5) * waveAmplitude * 0.8;
                  // Add perpendicular ripples that flow downstream (more visible)
                  flowWave += sin(position.x * 7.0 + flowOffsetX * 3.0) * waveAmplitude * 0.5;
                  // Add additional flow ripples for stronger visual effect
                  flowWave += sin((position.x * uFlowDirection.x) * 8.0 + uTime * waveSpeed * 2.0) * waveAmplitude * 0.4;
              }
              
              float base = (wave1 + wave2 + wave3 + wave4 + chop1 + chop2 + flowWave) * waveScale;
              
              // Ripples
              float rip = 0.0;
              float active0 = step(0.0, rippleTime0);
              float dist0 = length(p - ripplePos0);
              rip += rippleAmp * sin(8.0 * (dist0 - 2.4 * rippleTime0)) * exp(-1.5 * dist0) * exp(-1.0 * rippleTime0) * active0;
              
              float active1 = step(0.0, rippleTime1);
              float dist1 = length(p - ripplePos1);
              rip += rippleAmp * sin(8.0 * (dist1 - 2.4 * rippleTime1)) * exp(-1.5 * dist1) * exp(-1.0 * rippleTime1) * active1;
              
              float active2 = step(0.0, rippleTime2);
              float dist2 = length(p - ripplePos2);
              rip += rippleAmp * sin(8.0 * (dist2 - 2.4 * rippleTime2)) * exp(-1.5 * dist2) * exp(-1.0 * rippleTime2) * active2;
              
              float active3 = step(0.0, rippleTime3);
              float dist3 = length(p - ripplePos3);
              rip += rippleAmp * sin(8.0 * (dist3 - 2.4 * rippleTime3)) * exp(-1.5 * dist3) * exp(-1.0 * rippleTime3) * active3;
              
              vElevation = base + rip;
              pos.y += vElevation;
              
              // Calculate normal for proper lighting (using waveAmplitude)
              float dx = 3.0 * waveAmplitude * cos(position.x * 3.0 + uTime * waveSpeed);
              float dz = 3.0 * waveAmplitude * cos(position.z * 3.0 + uTime * waveSpeed * 0.8);
              // Add choppy wave normals
              float dxChop = 5.0 * waveAmplitude * 0.4 * cos(position.x * 5.0 + uTime * waveSpeed * 1.5);
              float dzChop = 4.5 * waveAmplitude * 0.4 * cos(position.z * 4.5 + uTime * waveSpeed * 1.3);
              vNormal = normalize(normalMatrix * normalize(vec3(-(dx + dxChop), 1.0, -(dz + dzChop))));
              
              vec4 wp = modelMatrix * vec4(pos, 1.0);
              vWorldPos = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `;
        waterMaterial.vertexShader = waveVertexShader;
        
        // Update material's tick function to also update wave/ripple uniforms
        const originalTick = waterMaterial.userData.tick;
        waterMaterial.userData.tick = (dt, camera) => {
            if (originalTick) originalTick(dt, camera);
            // Update time uniform (using uTime for consistency)
            waterMaterial.uniforms.uTime.value = (waterMaterial.uniforms.uTime.value || 0) + dt;
            // Advance ripple timers
            for (let i = 0; i < 4; i++) {
                const timer = waterMaterial.uniforms[`rippleTime${i}`];
                if (timer && timer.value > 0) {
                    timer.value += dt;
                    if (timer.value > 2.0) {
                        timer.value = 0.0;
                    }
                }
            }
        };

        // Create water mesh with new material
        this.water = new THREE.Mesh(waterGeometry, waterMaterial);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = this.waterY;
        this.water.receiveShadow = true;
        this.water.renderOrder = 2; // render after grass to ensure proper depth
        this.sceneRef.scene.add(this.water);

        this.mesh = this.water;
        
        // Add helper methods for water animation and splashes
        // Material's tick function is already set up above
        this.mesh.tick = (dt, camera) => {
            if (this.water.material.userData.tick) {
                this.water.material.userData.tick(dt, camera);
            }
        };

        this.mesh.splashAt = (worldX, worldZ) => {
            const uniforms = this.water.material.uniforms;
            // Pick a free slot or overwrite the oldest
            let slot = -1, oldest = -1;
            for (let i = 0; i < 4; i++) {
                const timer = uniforms[`rippleTime${i}`].value;
                if (timer <= 0.0) { 
                    slot = i; 
                    break; 
                }
                if (timer > oldest) { 
                    oldest = timer; 
                    slot = i; 
                }
            }
            if (slot >= 0) {
                uniforms[`ripplePos${slot}`].value.set(worldX, worldZ);
                uniforms[`rippleTime${slot}`].value = 0.0001; // start ripple
            }
        };
        
        // Calculate visible bounds - keep within camera view
        // Camera shows area roughly -60 to +60 in X and Z, centered at dock
        // Keep water bounds smaller to ensure casts are visible
        const visibleRadius = 50; // Visible radius from center
        this.bounds = {
            minX: -visibleRadius,
            maxX: visibleRadius,
            minZ: -visibleRadius,
            maxZ: visibleRadius,
            width: visibleRadius * 2,
            depth: visibleRadius * 2
        };
    }

    update(delta) {
        this.time = (this.time || 0) + delta;
        
        if (this.water && this.water.material && this.water.material.uniforms) {
            // Update time uniform for wave animation
            if (this.water.material.uniforms.uTime) {
                this.water.material.uniforms.uTime.value = this.time;
            }
            if (this.water.material.uniforms.time) {
                this.water.material.uniforms.time.value = this.time;
            }
            
            // Call material tick function if it exists
            if (this.water.material.userData.tick) {
                this.water.material.userData.tick(delta, this.sceneRef?.camera);
            }
        }
        
        // Update river particles (flow left to right)
        if (this.riverParticles && this.riverParticles.visible && this.waterBodyConfig.hasFlow) {
            const positions = this.riverParticles.userData.positions;
            const velocities = this.riverParticles.userData.velocities;
            const flowDir = this.waterBodyConfig.flowDirection || new THREE.Vector2(1, 0);
            
            // Debug: Log updates occasionally (very rare)
            if (Math.random() < 0.0001) {
                console.log('[RIVER] Updating particles, visible:', this.riverParticles.visible, 'count:', positions.length / 3, 'first particle pos:', positions[0], positions[1], positions[2]);
            }
            
            for (let i = 0; i < positions.length / 3; i++) {
                const i3 = i * 3;
                let x = positions[i3];
                let z = positions[i3 + 2];
                
                // Update position based on flow
                positions[i3] += velocities[i3] * delta; // X (flow direction)
                positions[i3 + 2] += velocities[i3 + 2] * delta; // Z
                
                // Reset position if it flows off-screen (wrap around)
                // For left-to-right flow (flowDir.x = 1): particles come from left (negative X), exit right (positive X)
                const halfSize = this.groundSize * 0.4;
                if (flowDir.x > 0 && positions[i3] > halfSize) {
                    // Flowed off right side, reset to left side
                    positions[i3] = -halfSize; // Reset to left side
                    positions[i3 + 2] = (Math.random() - 0.5) * this.groundSize * 0.8; // Random Z
                    // Reset velocity to base flow speed (positive X = left to right)
                    const baseSpeed = 0.8 + Math.random() * 0.6;
                    velocities[i3] = flowDir.x * baseSpeed; // Positive X = left to right
                    velocities[i3 + 2] = flowDir.y * baseSpeed;
                } else if (flowDir.x < 0 && positions[i3] < -halfSize) {
                    // Flowed off left side, reset to right side
                    positions[i3] = halfSize; // Reset to right side
                    positions[i3 + 2] = (Math.random() - 0.5) * this.groundSize * 0.8; // Random Z
                    // Reset velocity to base flow speed (negative X = right to left)
                    const baseSpeed = 0.8 + Math.random() * 0.6;
                    velocities[i3] = flowDir.x * baseSpeed; // Negative X = right to left
                    velocities[i3 + 2] = flowDir.y * baseSpeed;
                }
                
                // Keep particles on water surface - higher above water for visibility
                positions[i3 + 1] = this.waterY + 0.15 + Math.sin(this.time * 2 + i) * 0.01; // Higher above water with gentle bob
            }
            
            // Update geometry
            this.riverParticles.geometry.attributes.position.needsUpdate = true;
        }
        
        // Update dock post splash effects (animated wakes) - only for POND
        // CRITICAL: Always check visibility based on current water type, not just creation time
        if (this.dockPostSplashes) {
            // Ensure visibility matches current water type
            const shouldBeVisible = (this.waterBodyType === 'POND');
            if (this.dockPostSplashes.visible !== shouldBeVisible) {
                this.dockPostSplashes.visible = shouldBeVisible;
            }
            
            // Animate splashes if visible
            if (this.dockPostSplashes.visible) {
                const time = this.time || 0;
                
                // Animate each splash ring
                this.dockPostSplashes.children.forEach(ring => {
                    if (!ring.userData) return;
                    
                    const { baseRadius, maxRadius, speed, startTime, lifetime, fadeStart } = ring.userData;
                    
                    // Calculate current age of this ring
                    let age = (time - startTime) % lifetime;
                    
                    // Normalized progress (0 to 1) through lifetime
                    const progress = age / lifetime;
                    
                    // Expand outward monotonically (only outward, not oscillating)
                    // Use smooth ease-out curve for natural expansion
                    const expansionProgress = 1.0 - Math.pow(1.0 - progress, 2); // Ease-out curve
                    const currentRadius = baseRadius + (maxRadius - baseRadius) * expansionProgress;
                    const ringThickness = 0.20; // Match creation value
                    
                    // Update ring geometry size
                    ring.geometry.dispose();
                    ring.geometry = new THREE.RingGeometry(
                        currentRadius,
                        currentRadius + ringThickness,
                        32
                    );
                    
                    // Fade opacity as ring expands and dissipates
                    // Start at full opacity, fade out starting at fadeStart point
                    let opacity = 1.0;
                    if (progress >= fadeStart) {
                        // Fade out in the remaining portion of lifetime
                        const fadeProgress = (progress - fadeStart) / (1.0 - fadeStart);
                        opacity = 1.0 - fadeProgress; // Fade from 1.0 to 0.0
                    }
                    opacity = Math.max(0.0, opacity); // Ensure opacity doesn't go negative
                    ring.material.opacity = opacity * 0.9; // Scale to max 0.9 for visibility
                    
                    // Slight rotation for dynamic look (slower, more subtle)
                    ring.rotation.z = Math.sin(time * 0.3 + baseRadius) * 0.05;
                });
            }
        }
        
        // Update dock post particle stream - always update when visible (river particles should never stop)
        // CRITICAL: This must always run when particles exist - ensures continuous flow
        if (this.dockPostParticles) {
            // Force visibility if this is a river type (particles must stay visible)
            if (this.waterBodyConfig && this.waterBodyConfig.hasFlow && !this.dockPostParticles.visible) {
                this.dockPostParticles.visible = true;
                console.warn('[RIVER] Post particles were hidden but should be visible - forcing visible');
            }
            
            if (this.dockPostParticles.visible) {
                const positions = this.dockPostParticles.userData.positions;
                const velocities = this.dockPostParticles.userData.velocities;
                const postPositions = this.dockPostParticles.userData.postPositions;
                const spawnTimes = this.dockPostParticles.userData.spawnTimes;
                const lifetimes = this.dockPostParticles.userData.lifetimes;
                
                // Ensure we have valid data arrays
                if (!positions || !velocities || !postPositions || !spawnTimes || !lifetimes) {
                    console.warn('[RIVER] Post particles missing data arrays, skipping update');
                    return;
                }
                
                // Get current time for lifetime checks
                const currentTime = this.time || 0;
                
                // Initialize spawn times on first update
                if (!this.dockPostParticles.userData.initialized) {
                    for (let i = 0; i < spawnTimes.length; i++) {
                        // Stagger initial spawn times to avoid all particles spawning at once
                        spawnTimes[i] = currentTime - Math.random() * 2.5; // Spread spawns over last 2.5 seconds
                    }
                    this.dockPostParticles.userData.initialized = true;
                }
                
                // Get flow direction - use fallback if config is undefined
                const flowDir = (this.waterBodyConfig && this.waterBodyConfig.flowDirection) 
                    ? this.waterBodyConfig.flowDirection 
                    : new THREE.Vector2(-1, 0); // Default: left to right on screen
                const halfSize = this.groundSize * 0.4;
                const maxDistanceFromPost = 30.0; // Max distance from ANY post before respawn (ensures continuous stream)
                
                const particleCount = positions.length / 3;
                
                // Helper function to respawn particle from a random post
                const respawnParticle = (i3, particleIndex) => {
                    const randomPost = postPositions[Math.floor(Math.random() * postPositions.length)];
                    const offsetRadius = 0.08 + Math.random() * 0.04;
                    const angle = Math.random() * Math.PI * 2;
                    
                    // Start directly at post (normal emission)
                    positions[i3] = randomPost.x + Math.cos(angle) * offsetRadius;
                    positions[i3 + 1] = this.waterY + 0.05 + Math.random() * 0.05;
                    positions[i3 + 2] = randomPost.z + Math.sin(angle) * offsetRadius;
                    
                    // Reset velocity
                    const baseSpeed = 0.4 + Math.random() * 0.3;
                    const speedVariation = 0.1;
                    velocities[i3] = flowDir.x * baseSpeed + (Math.random() - 0.5) * speedVariation;
                    velocities[i3 + 1] = -0.02 + Math.random() * 0.02;
                    velocities[i3 + 2] = flowDir.y * baseSpeed + (Math.random() - 0.5) * speedVariation;
                    
                    // Reset spawn time and lifetime for this particle
                    spawnTimes[particleIndex] = currentTime;
                    lifetimes[particleIndex] = 2.0 + Math.random() * 0.5; // Random lifetime: 2.0 to 2.5 seconds
                };
                
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    
                    // Check particle lifetime FIRST - respawn after 2-2.5 seconds
                    const particleAge = currentTime - spawnTimes[i];
                    const particleLifetime = lifetimes[i];
                    
                    if (particleAge >= particleLifetime) {
                        // Particle has reached its lifetime, respawn at post
                        respawnParticle(i3, i); // Start from post (normal emission)
                        continue; // Skip position update for this frame (already respawned)
                    }
                    
                    // Update position based on flow
                    positions[i3] += velocities[i3] * delta; // X (flow direction)
                    positions[i3 + 1] += velocities[i3 + 1] * delta; // Y
                    positions[i3 + 2] += velocities[i3 + 2] * delta; // Z
                    
                    // Gentle bobbing on water surface
                    positions[i3 + 1] = this.waterY + 0.05 + Math.sin(this.time * 1.5 + i) * 0.03;
                }
                
                // Always update geometry attributes (critical - ensures particles continue to animate)
                if (this.dockPostParticles.geometry && this.dockPostParticles.geometry.attributes.position) {
                    this.dockPostParticles.geometry.attributes.position.needsUpdate = true;
                }
            }
        }
    }

    getWaterHeight(x, z) {
        // For Water2, use simple wave calculation at position
        // You can enhance this later with more realistic wave sampling
        const time = this.time || 0;
        const wave1 = Math.sin(x * 0.05 + time * 0.5) * 0.2;
        const wave2 = Math.sin(z * 0.05 + time * 0.4) * 0.15;
        return this.waterY + (wave1 + wave2);
    }

    getRandomSpot() {
        // Get random point within VISIBLE water area using mask
        // Ensure casts land on-screen, not off-screen
        const maxAttempts = 200;
        const margin = 5; // Margin from edges to keep visible
        
        for (let i = 0; i < maxAttempts; i++) {
            // Random within visible bounds (not full ground size)
            const x = THREE.MathUtils.lerp(
                this.bounds.minX + margin,
                this.bounds.maxX - margin,
                Math.random()
            );
            const z = THREE.MathUtils.lerp(
                this.bounds.minZ + margin,
                this.bounds.maxZ - margin,
                Math.random()
            );
            
            // Check if point is in water using mask
            if (this.isWaterPoint(x, z)) {
                // Double-check it's within visible bounds
                if (x >= this.bounds.minX + margin && x <= this.bounds.maxX - margin &&
                    z >= this.bounds.minZ + margin && z <= this.bounds.maxZ - margin) {
                    return new THREE.Vector3(x, this.waterY, z);
                }
            }
        }
        
        // Fallback: return a safe spot near center that's definitely in water
        const fallbackX = THREE.MathUtils.lerp(-20, 20, Math.random());
        const fallbackZ = THREE.MathUtils.lerp(-10, 30, Math.random());
        return new THREE.Vector3(fallbackX, this.waterY, fallbackZ);
    }

    isWaterPoint(x, z) {
        // First check if within visible bounds before sampling mask
        // This avoids expensive mask lookups for out-of-bounds points
        if (x < this.bounds.minX || x > this.bounds.maxX ||
            z < this.bounds.minZ || z > this.bounds.maxZ) {
            return false;
        }
        
        // Convert world coordinates to UV coordinates for mask
        const uvx = (x / this.groundSize) + 0.5;
        const uvz = 1.0 - ((z / this.groundSize) + 0.5);
        
        // Clamp UVs to valid range [0, 1]
        const clampedUvx = Math.max(0, Math.min(1, uvx));
        const clampedUvz = Math.max(0, Math.min(1, uvz));
        
        // Sample mask texture
        const mask = this.lakeMask;
        if (!mask || !mask.image) return false;
        
        // Check if canvas context is available
        const cvs = mask.image;
        if (cvs && cvs.getContext) {
            // Use willReadFrequently for better performance with multiple readbacks
            const ctx = cvs.getContext('2d', { willReadFrequently: true });
            const px = Math.floor(clampedUvx * cvs.width);
            const py = Math.floor(clampedUvz * cvs.height);
            // Clamp coordinates to valid range
            const clampedPx = Math.max(0, Math.min(cvs.width - 1, px));
            const clampedPy = Math.max(0, Math.min(cvs.height - 1, py));
            const data = ctx.getImageData(clampedPx, clampedPy, 1, 1).data;
            const maskValue = data[0] / 255; // White = water
            return maskValue > 0.5; // Threshold for water
        }
        
        // Fallback: check if within approximate bounds
        const dist = Math.sqrt((x * x) / (this.groundSize * 0.4 * this.groundSize * 0.4) + 
                               (z * z) / (this.groundSize * 0.35 * this.groundSize * 0.35));
        return dist < 1.0;
    }

    isWithinBounds(position) {
        // Check if position is within approximate water bounds
        return position.x >= this.bounds.minX &&
               position.x <= this.bounds.maxX &&
               position.z >= this.bounds.minZ &&
               position.z <= this.bounds.maxZ;
    }

    getBounds() {
        return this.bounds;
    }
}

