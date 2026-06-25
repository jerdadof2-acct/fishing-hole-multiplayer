import * as THREE from 'three';
import { makeWaterMaterial } from './water/waterMaterial.js';
import { getWaterBodyConfig, DEFAULT_WATER_BODY_TYPE, WaterBodyTypes } from './water/waterBodyTypes.js';
import { createRiverFlowTexture } from './water/riverFlowTexture.js';
import {
    createRiverDockPostWake,
    updateRiverDockPostWake,
    getRiverWakePosts,
    spawnRiverPostBubble,
    updateRiverPostBubbleMotion
} from './effects/riverDockPostWake.js';
import {
    createAmbientSplashRings,
    createCausticsLayer,
    tickAmbientSplashes,
    tickCausticsLayer
} from './effects/waterAmbience.js';
import { getDockPostSplashPositions, getStylizedDockWorldBounds } from './scene/stylizedDock.js';

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
        this.celestialParticles = null; // Star particles for Celestial Depths
        this.dockPostSplashes = null; // Splash effects around dock posts (for rivers only)
        this.dockPostParticles = null; // Particle stream from dock posts (for rivers only)
        this.time = 0; // Time accumulator for splash animations
        this.celestialTime = 0; // Time accumulator for celestial twinkle
        this.causticsLayer = null;
        this.ambientSplashes = null;
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
            const speed = 0.22 + Math.random() * 0.28;
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
     * Create static starfield particles for Celestial Depths
     */
    createCelestialParticles() {
        const particleCount = 1500;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        const concentricLayers = [
            { radius: this.groundSize * 0.42, height: 0.14 },
            { radius: this.groundSize * 0.30, height: 0.17 },
            { radius: this.groundSize * 0.18, height: 0.20 }
        ];

        let index = 0;
        concentricLayers.forEach(layer => {
            const layerCount = Math.floor(particleCount * (layer.radius / concentricLayers[0].radius) * 0.6);
            for (let i = 0; i < layerCount && index < particleCount; i++) {
                const i3 = index * 3;
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.sqrt(Math.random()) * layer.radius;

                positions[i3] = Math.cos(angle) * distance;
                positions[i3 + 1] = this.waterY + layer.height + Math.random() * 0.08;
                positions[i3 + 2] = Math.sin(angle) * distance;
                index++;
            }
        });

        // Fill any remaining particles uniformly
        for (; index < particleCount; index++) {
            const i3 = index * 3;
            const radius = this.groundSize * 0.42;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            positions[i3] = Math.cos(angle) * distance;
            positions[i3 + 1] = this.waterY + 0.14 + Math.random() * 0.08;
            positions[i3 + 2] = Math.sin(angle) * distance;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const renderer = this.sceneRef?.renderer;
        const pixelRatio = renderer?.getPixelRatio ? renderer.getPixelRatio() : (window.devicePixelRatio || 1);
        const clampedRatio = THREE.MathUtils.clamp(pixelRatio, 1, 2.5);
        const baseSize = 0.36;
        const material = new THREE.PointsMaterial({
            color: 0xfffeff,
            size: baseSize * clampedRatio,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: false,
            fog: false
        });

        this.celestialParticles = new THREE.Points(geometry, material);
        this.celestialParticles.visible = false;
        this.celestialParticles.renderOrder = 1002;
        this.celestialParticles.userData = {
            baseOpacity: 1.0,
            twinkleRange: 0.45,
            baseSize,
            pixelRatio: clampedRatio
        };
        this.sceneRef.scene.add(this.celestialParticles);
    }
    
    /**
     * Remove dock post splash / wake meshes (pond rings or river swirls).
     */
    disposeDockPostSplashes() {
        if (!this.dockPostSplashes) return;
        this.sceneRef.scene.remove(this.dockPostSplashes);
        this.dockPostSplashes.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        this.dockPostSplashes = null;
    }

    /**
     * Splash rings (pond) or downstream swirls (river) at dock posts.
     */
    createDockPostSplashes() {
        this.disposeDockPostSplashes();

        if (this.waterBodyConfig?.riverMode) {
            const posts = getRiverWakePosts(this.waterBodyType);
            const flow = this.waterBodyConfig.flowDirection || new THREE.Vector2(1, 0);
            const wakeGroup = createRiverDockPostWake({
                waterY: this.waterY,
                flowDirection: flow,
                posts
            });
            wakeGroup.visible = this.waterBodyType === 'RIVER';
            this.dockPostSplashes = wakeGroup;
            this.sceneRef.scene.add(wakeGroup);
            return;
        }

        const postPositions = getDockPostSplashPositions(this.waterBodyType);
        const activePosts = postPositions.filter((post) => post.primary);

        const splashGroup = new THREE.Group();
        splashGroup.name = 'DockPostSplashes';
        splashGroup.userData.isRiverWake = false;
        splashGroup.renderOrder = 1003;

        const splashMaterial = new THREE.MeshBasicMaterial({
            color: 0xb8d4ec,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true
        });

        const surfaceY = this.waterY + 0.04;

        activePosts.forEach((post, postIndex) => {
            for (let ringIndex = 0; ringIndex < 2; ringIndex++) {
                const ringRadius = post.innerRadius + ringIndex * 0.05;
                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(ringRadius, ringRadius + 0.038, 28),
                    splashMaterial.clone()
                );

                ring.rotation.x = -Math.PI / 2;
                ring.position.set(post.x, surfaceY, post.z);
                ring.renderOrder = 1003;

                ring.userData = {
                    postIndex,
                    ringIndex,
                    baseRadius: ringRadius,
                    maxRadius: ringRadius + 0.28,
                    ringThickness: 0.038,
                    peakOpacity: 0.26,
                    startTime: postIndex * 1.4 + ringIndex * 3.2 + Math.random() * 4.5,
                    lifetime: 6.5 + ringIndex * 2.0 + Math.random() * 3.0,
                    fadeStart: 0.62
                };

                splashGroup.add(ring);
            }
        });

        splashGroup.visible = this.waterBodyType === 'POND';
        this.dockPostSplashes = splashGroup;
        this.sceneRef.scene.add(splashGroup);
    }
    
    /**
     * Create particle stream from dock posts for rivers
     * Particles emit from posts and flow downstream with the current
     */
    createDockPostParticles() {
        const postPositions = getRiverWakePosts('RIVER');
        const totalParticles = 88;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(totalParticles * 3);
        const velocities = new Float32Array(totalParticles * 3);
        const colors = new Float32Array(totalParticles * 3);
        const spawnTimes = new Float32Array(totalParticles);
        const lifetimes = new Float32Array(totalParticles);

        const flowDir = this.waterBodyConfig?.flowDirection || new THREE.Vector2(1, 0);
        const useRiverBubbles = this.waterBodyConfig?.riverMode === true;

        for (let particleIndex = 0; particleIndex < totalParticles; particleIndex++) {
            const i3 = particleIndex * 3;
            const post = postPositions[particleIndex % postPositions.length];

            if (useRiverBubbles) {
                spawnRiverPostBubble(positions, velocities, i3, post, flowDir, this.waterY);
            } else {
                const offsetRadius = 0.08 + Math.random() * 0.04;
                const angle = Math.random() * Math.PI * 2;
                positions[i3] = post.x + Math.cos(angle) * offsetRadius;
                positions[i3 + 1] = this.waterY + 0.05 + Math.random() * 0.05;
                positions[i3 + 2] = post.z + Math.sin(angle) * offsetRadius;
                const baseSpeed = 0.22 + Math.random() * 0.28;
                velocities[i3] = flowDir.x * baseSpeed;
                velocities[i3 + 1] = -0.02 + Math.random() * 0.02;
                velocities[i3 + 2] = flowDir.y * baseSpeed;
            }

            const brightness = 0.75 + Math.random() * 0.25;
            colors[i3] = brightness * 0.92;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;

            spawnTimes[particleIndex] = 0;
            lifetimes[particleIndex] = 1.4 + Math.random() * 0.9;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: useRiverBubbles ? 0.42 : 0.8,
            transparent: true,
            opacity: useRiverBubbles ? 0.62 : 0.4,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: false,
            fog: false
        });

        this.dockPostParticles = new THREE.Points(geometry, material);
        this.dockPostParticles.userData.positions = positions;
        this.dockPostParticles.userData.velocities = velocities;
        this.dockPostParticles.userData.postPositions = postPositions;
        this.dockPostParticles.userData.spawnTimes = spawnTimes;
        this.dockPostParticles.userData.lifetimes = lifetimes;
        this.dockPostParticles.userData.useRiverBubbles = useRiverBubbles;
        this.dockPostParticles.userData.initialized = false;
        this.dockPostParticles.visible = this.waterBodyConfig.hasFlow === true;
        this.dockPostParticles.renderOrder = 1001;
        this.sceneRef.scene.add(this.dockPostParticles);
    }

    resetDockPostParticlesForRiver() {
        if (!this.dockPostParticles) return;

        const useRiver = this.waterBodyConfig?.riverMode === true;
        this.dockPostParticles.userData.useRiverBubbles = useRiver;
        this.dockPostParticles.userData.postPositions = getRiverWakePosts('RIVER');
        this.dockPostParticles.userData.initialized = false;

        const mat = this.dockPostParticles.material;
        if (mat) {
            mat.size = useRiver ? 0.42 : 0.8;
            mat.opacity = useRiver ? 0.62 : 0.4;
        }

        const { positions, velocities, postPositions } = this.dockPostParticles.userData;
        const flowDir = this.waterBodyConfig?.flowDirection || new THREE.Vector2(1, 0);
        const count = positions.length / 3;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const post = postPositions[i % postPositions.length];
            if (useRiver) {
                spawnRiverPostBubble(positions, velocities, i3, post, flowDir, this.waterY);
            }
        }
    }
    
    applyWindScrollUniforms(material) {
        if (!material || !material.uniforms) {
            return;
        }
        const { windScroll1, windScroll2 } = this.waterBodyConfig || {};
        if (windScroll1 && material.uniforms.uScroll1) {
            material.uniforms.uScroll1.value.copy(windScroll1);
        }
        if (windScroll2 && material.uniforms.uScroll2) {
            material.uniforms.uScroll2.value.copy(windScroll2);
        }
    }

    applyRiverModeUniforms(material) {
        if (!material?.uniforms) {
            return;
        }
        const river = this.waterBodyConfig?.riverMode === true;
        if (material.uniforms.uRiverMode) {
            material.uniforms.uRiverMode.value = river ? 1.0 : 0.0;
        }
        if (material.uniforms.uFlowMapStrength) {
            material.uniforms.uFlowMapStrength.value = river
                ? (this.waterBodyConfig.flowMapStrength ?? 0.95)
                : 0.0;
        }
    }
    
    /**
     * Swap the shoreline mask (pond vs lake-sized water).
     */
    setLakeMask(lakeMask) {
        if (!lakeMask) return;
        if (this.lakeMask && this.lakeMask !== lakeMask) {
            this.lakeMask.dispose();
        }
        this.lakeMask = lakeMask;
        if (this.mesh?.material?.uniforms?.lakeMask) {
            this.mesh.material.uniforms.lakeMask.value = lakeMask;
            lakeMask.needsUpdate = true;
        }
    }

    /**
     * Change water body type (e.g., 'POND', 'RIVER', 'LAKE', 'OCEAN')
     */
    setWaterBodyType(type) {
        const prevType = this.waterBodyType;
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
            if (material.uniforms.uEnvIntensity) {
                material.uniforms.uEnvIntensity.value = type === 'CELESTIAL' ? 0.12 : 0.44;
            }
            if (material.uniforms.uHasLakeBed) {
                material.uniforms.uHasLakeBed.value = type === 'CELESTIAL' ? 0.0 : 1.0;
            }
            if (this.waterBodyConfig.waveSpeed !== undefined) {
                material.uniforms.waveSpeed.value = this.waterBodyConfig.waveSpeed;
            }
            if (this.waterBodyConfig.waveScale !== undefined) {
                material.uniforms.waveScale.value = this.waterBodyConfig.waveScale;
            }
            if (this.waterBodyConfig.waveAmplitude !== undefined) {
                material.uniforms.waveAmplitude.value = this.waterBodyConfig.waveAmplitude;
            }
            if (material.uniforms.chopMultiplier) {
                material.uniforms.chopMultiplier.value = this.waterBodyConfig.chopMultiplier || 1.0;
            }
            if (material.uniforms.rippleAmp) {
                material.uniforms.rippleAmp.value = type === 'POND' ? 0.06 : 0.12;
            }
            
            // Update flow direction and speed for rivers
            if (this.waterBodyConfig.hasFlow && this.waterBodyConfig.flowDirection) {
                const flowDir = this.waterBodyConfig.flowDirection;
                material.uniforms.uFlowDirection.value.copy(flowDir);
                material.uniforms.uFlowSpeed.value = this.waterBodyConfig.flowSpeed || 1.5;
            } else {
                material.uniforms.uFlowDirection.value.set(0, 0);
                material.uniforms.uFlowSpeed.value = 0.0;
            }
            this.applyRiverModeUniforms(material);
            this.applyWindScrollUniforms(material);

            const prevRiver = prevType === 'RIVER';
            const nextRiver = type === 'RIVER';
            const prevPond = prevType === 'POND';
            const nextPond = type === 'POND';
            if (prevRiver !== nextRiver || prevPond !== nextPond) {
                this.createDockPostSplashes();
            }
            if (prevRiver !== nextRiver) {
                this.resetDockPostParticlesForRiver();
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
                    const splashShouldBeVisible = type === 'POND' || type === 'RIVER';
                    if (this.dockPostSplashes.visible !== splashShouldBeVisible) {
                        this.dockPostSplashes.visible = splashShouldBeVisible;
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
                            const speed = 0.22 + Math.random() * 0.28;
                            velocities[i] = flowDir.x * speed; // X velocity (flowDir.x = -1 for left-to-right screen movement)
                            velocities[i + 1] = 0; // Y velocity (floating on surface)
                            velocities[i + 2] = flowDir.y * speed; // Z velocity
                        }
                    }
                }
            }
            
            if (this.celestialParticles) {
                const showCelestial = (type === 'CELESTIAL');
                if (this.celestialParticles.visible !== showCelestial) {
                    this.celestialParticles.visible = showCelestial;
                    console.log('[CELESTIAL] Starfield visibility:', showCelestial, 'type:', type);
                }
                if (showCelestial) {
                    const baseOpacity = this.celestialParticles.userData?.baseOpacity ?? 0.85;
                    this.celestialParticles.material.opacity = baseOpacity;
                }
            }
        }
    }

    create() {
        const textureLoader = new THREE.TextureLoader();
        const isMobile = typeof navigator !== 'undefined'
            && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        const bedRepeat = 72;

        const configureBedTex = (tex) => {
            if (!tex) return tex;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(bedRepeat, bedRepeat);
            return tex;
        };

        const lakeBedColor = configureBedTex(textureLoader.load('/assets/textures/lakeBed/clean_pebbles_diff_1k.jpg'));
        lakeBedColor.colorSpace = THREE.SRGBColorSpace;
        const lakeBedNormal = configureBedTex(textureLoader.load('/assets/textures/lakeBed/clean_pebbles_nor_gl_1k.jpg'));
        const lakeBedRough = configureBedTex(textureLoader.load('/assets/textures/lakeBed/clean_pebbles_rough_1k.jpg'));

        // Lake bed — visible through shallow water and under caustics
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(this.groundSize, this.groundSize, 1, 1),
            new THREE.MeshStandardMaterial({
                map: lakeBedColor,
                normalMap: lakeBedNormal,
                roughnessMap: lakeBedRough,
                roughness: 1,
                metalness: 0,
                envMapIntensity: 0.35
            })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = this.waterY - 0.08;
        ground.receiveShadow = true;
        this.sceneRef.scene.add(ground);
        this.lakeBedMap = lakeBedColor;

        this.causticsLayer = createCausticsLayer(
            this.sceneRef.scene,
            this.groundSize,
            this.waterY,
            {
                skipOnMobile: false,
                excludeBounds: getStylizedDockWorldBounds()
            }
        );

        // Create water geometry with enough detail for waves
        const waterGeometry = new THREE.PlaneGeometry(this.groundSize, this.groundSize, 128, 128);
        
        // Load normal map — dual scroll in shader (mobile uses -sm)
        const loadWaterNormal = (fullPath, smPath, fallbackOffset = 0) => {
            const primary = isMobile ? smPath : fullPath;
            return textureLoader.load(
                primary,
                undefined,
                undefined,
                () => {
                    if (primary !== fullPath) {
                        return textureLoader.load(fullPath, undefined, undefined, () => {
                            console.warn('water normal missing, procedural fallback');
                            return createProceduralWaterNormal(fallbackOffset);
                        });
                    }
                    console.warn('water normal missing, procedural fallback');
                    return createProceduralWaterNormal(fallbackOffset);
                }
            );
        };
        let normalMap1 = loadWaterNormal(
            '/assets/textures/waterNormals1.jpg',
            '/assets/textures/waterNormals1-sm.jpg',
            0
        );
        
        try {
            if (!normalMap1 || !normalMap1.image) {
                normalMap1 = createProceduralWaterNormal();
            }
        } catch (e) {
            console.warn('Error loading water normal map, using procedural fallback');
            normalMap1 = createProceduralWaterNormal();
        }
        let normalMap2 = loadWaterNormal(
            '/assets/textures/waterNormals2.jpg',
            '/assets/textures/waterNormals2-sm.jpg',
            0.35
        );
        try {
            if (!normalMap2 || !normalMap2.image) {
                normalMap2 = createProceduralWaterNormal(0.35);
            }
        } catch (e) {
            normalMap2 = createProceduralWaterNormal(0.35);
        }
        
        const envMap = this.sceneRef.scene?.environment || null;
        const envIntensity = this.waterBodyType === 'CELESTIAL' ? 0.12 : 0.44;
        
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
        const riverFlowMap = createRiverFlowTexture();
        this.riverFlowMap = riverFlowMap;
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
            opacity: this.waterBodyConfig.opacity,
            envMap,
            envIntensity,
            lakeBedMap: this.waterBodyType === 'CELESTIAL' ? null : this.lakeBedMap,
            flowMap: riverFlowMap,
            flowMapStrength: this.waterBodyConfig.riverMode ? (this.waterBodyConfig.flowMapStrength ?? 0.95) : 0.0,
            riverMode: this.waterBodyConfig.riverMode === true
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
        waterMaterial.uniforms.rippleAmp = {
            value: this.waterBodyType === 'POND' ? 0.06 : 0.12
        };
        // Wave parameters from water body config (defaults for LAKE)
        waterMaterial.uniforms.waveSpeed = { value: this.waterBodyConfig.waveSpeed || 2.0 };
        waterMaterial.uniforms.waveScale = { value: this.waterBodyConfig.waveScale || 1.1 };
        waterMaterial.uniforms.waveAmplitude = { value: this.waterBodyConfig.waveAmplitude || 0.07 };
        waterMaterial.uniforms.chopMultiplier = {
            value: this.waterBodyConfig.chopMultiplier || 1.0
        };
        
        // Apply flow direction and speed ONLY for rivers (left to right)
        // For non-river types (LAKE, POND, OCEAN), keep default scrolls and no flow
        if (this.waterBodyConfig.hasFlow && this.waterBodyConfig.flowDirection) {
            const flowDir = this.waterBodyConfig.flowDirection;
            waterMaterial.uniforms.uFlowDirection.value.copy(flowDir);
            waterMaterial.uniforms.uFlowSpeed.value = this.waterBodyConfig.flowSpeed || 1.5;
        } else {
            waterMaterial.uniforms.uFlowDirection.value.set(0, 0);
            waterMaterial.uniforms.uFlowSpeed.value = 0.0;
        }
        this.applyRiverModeUniforms(waterMaterial);
        this.applyWindScrollUniforms(waterMaterial);
        
        // Create procedural cloud texture for reflections
        const cloudTexture = this.createProceduralCloudTexture();
        waterMaterial.uniforms.uCloudTexture.value = cloudTexture;
        
        // Create river particle system (if river)
        this.createRiverParticles();
        // Create celestial starfield particles (for Celestial Depths)
        this.createCelestialParticles();
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
            uniform float chopMultiplier;
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
            uniform float uRiverMode;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            varying float vElevation;
            
            void main() {
              vUv = uv;
              
              vec3 pos = position;
              vec2 p = pos.xz;
              
              float flowOffsetX = uFlowDirection.x * uFlowSpeed * uTime;
              float flowOffsetZ = uFlowDirection.y * uFlowSpeed * uTime;
              
              float base = 0.0;
              float dx = 0.0;
              float dz = 0.0;
              
              if (uRiverMode > 0.5) {
                vec2 fDir = uFlowDirection;
                float fLen = length(fDir);
                if (fLen > 0.001) {
                  fDir /= fLen;
                } else {
                  fDir = vec2(-1.0, 0.0);
                }
                vec2 fPerp = vec2(-fDir.y, fDir.x);
                float along = dot(p, fDir);
                float across = dot(p, fPerp);
                float scroll = uFlowSpeed * uTime * 1.15;
                
                float r1 = sin(along * 7.5 - scroll * 3.2) * waveAmplitude;
                float r2 = sin(along * 13.0 - scroll * 5.5) * waveAmplitude * 0.45;
                float r3 = sin(along * 4.2 - scroll * 1.8) * waveAmplitude * 0.65;
                float cross = sin(across * 2.8 + scroll * 0.35) * waveAmplitude * 0.07;
                base = (r1 + r2 + r3 + cross) * waveScale;
                
                float dAlong1 = 7.5 * waveAmplitude * waveScale * cos(along * 7.5 - scroll * 3.2);
                float dAlong2 = 13.0 * waveAmplitude * waveScale * 0.45 * cos(along * 13.0 - scroll * 5.5);
                float dAlong3 = 4.2 * waveAmplitude * waveScale * 0.65 * cos(along * 4.2 - scroll * 1.8);
                float dAlong = dAlong1 + dAlong2 + dAlong3;
                dx = -dAlong * fDir.x;
                dz = -dAlong * fDir.y;
              } else {
                float wave1 = sin((position.x + flowOffsetX * 0.5) * 3.0 + uTime * waveSpeed) * waveAmplitude;
                float wave2 = sin((position.z + flowOffsetZ * 0.5) * 3.0 + uTime * waveSpeed * 0.8) * waveAmplitude;
                float wave3 = sin((position.x + position.z + flowOffsetX * 0.3 + flowOffsetZ * 0.3) * 2.2 + uTime * waveSpeed * 0.55) * waveAmplitude * 0.85;
                float wave4 = sin((position.x - position.z + flowOffsetX * 0.3) * 2.0 + uTime * waveSpeed * 0.37) * waveAmplitude * 0.7;
                float chop1 = sin((position.x + flowOffsetX * 0.6) * 5.0 + uTime * waveSpeed * 1.5) * waveAmplitude * 0.4 * chopMultiplier;
                float chop2 = sin((position.z + flowOffsetZ * 0.6) * 4.5 + uTime * waveSpeed * 1.3) * waveAmplitude * 0.4 * chopMultiplier;
                float chop3 = sin((position.x - position.z) * 6.8 + uTime * waveSpeed * 1.85) * waveAmplitude * 0.32 * max(chopMultiplier - 1.0, 0.0);
                float chop4 = sin((position.x + position.z * 0.7) * 7.2 + uTime * waveSpeed * 2.1) * waveAmplitude * 0.26 * max(chopMultiplier - 1.0, 0.0);
                base = (wave1 + wave2 + wave3 + wave4 + chop1 + chop2 + chop3 + chop4) * waveScale;
                
                dx = 3.0 * waveAmplitude * cos(position.x * 3.0 + uTime * waveSpeed);
                dz = 3.0 * waveAmplitude * cos(position.z * 3.0 + uTime * waveSpeed * 0.8);
                float dxChop = 5.0 * waveAmplitude * 0.4 * chopMultiplier * cos(position.x * 5.0 + uTime * waveSpeed * 1.5);
                float dzChop = 4.5 * waveAmplitude * 0.4 * chopMultiplier * cos(position.z * 4.5 + uTime * waveSpeed * 1.3);
                float dxChop3 = 6.8 * waveAmplitude * 0.32 * max(chopMultiplier - 1.0, 0.0) * cos((position.x - position.z) * 6.8 + uTime * waveSpeed * 1.85);
                float dzChop3 = -6.8 * waveAmplitude * 0.32 * max(chopMultiplier - 1.0, 0.0) * cos((position.x - position.z) * 6.8 + uTime * waveSpeed * 1.85);
                dx += dxChop + dxChop3;
                dz += dzChop + dzChop3;
              }
              
              // Ripples (cast / splash — all water types)
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
              
              vNormal = normalize(normalMatrix * normalize(vec3(-dx, 1.0, -dz)));
              
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
            let slot = -1;
            let oldest = -1;
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
                uniforms[`rippleTime${slot}`].value = 0.0001;
            }
        };

        this.ambientSplashes = createAmbientSplashRings(
            this.sceneRef.scene,
            this.waterY,
            5
        );
        
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

        tickCausticsLayer(this.causticsLayer, delta);
        tickAmbientSplashes(
            this.ambientSplashes,
            delta,
            this,
            (x, z) => this.mesh?.splashAt?.(x, z)
        );
        
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
                    const baseSpeed = 0.22 + Math.random() * 0.28;
                    velocities[i3] = flowDir.x * baseSpeed; // Positive X = left to right
                    velocities[i3 + 2] = flowDir.y * baseSpeed;
                } else if (flowDir.x < 0 && positions[i3] < -halfSize) {
                    // Flowed off left side, reset to right side
                    positions[i3] = halfSize; // Reset to right side
                    positions[i3 + 2] = (Math.random() - 0.5) * this.groundSize * 0.8; // Random Z
                    // Reset velocity to base flow speed (negative X = right to left)
                    const baseSpeed = 0.22 + Math.random() * 0.28;
                    velocities[i3] = flowDir.x * baseSpeed; // Negative X = right to left
                    velocities[i3 + 2] = flowDir.y * baseSpeed;
                }
                
                // Keep particles on water surface - higher above water for visibility
                positions[i3 + 1] = this.waterY + 0.15 + Math.sin(this.time * 2 + i) * 0.01; // Higher above water with gentle bob
            }
            
            // Update geometry
            this.riverParticles.geometry.attributes.position.needsUpdate = true;
        }

        // Update celestial starfield twinkle
        if (this.celestialParticles && this.celestialParticles.visible) {
            this.celestialTime = (this.celestialTime || 0) + delta;
            const mat = this.celestialParticles.material;
            const baseOpacity = this.celestialParticles.userData?.baseOpacity ?? 1.0;
            const range = this.celestialParticles.userData?.twinkleRange ?? 0.45;
            const twinkle = Math.sin(this.celestialTime * 1.6) * 0.5 + Math.sin(this.celestialTime * 2.3 + 1.2) * 0.5;
            const adjusted = baseOpacity + twinkle * range * 0.6;
            mat.opacity = THREE.MathUtils.clamp(adjusted, 0.55, 1.0);
            
            const renderer = this.sceneRef?.renderer;
            const pixelRatio = renderer?.getPixelRatio ? renderer.getPixelRatio() : (window.devicePixelRatio || 1);
            const clampedRatio = THREE.MathUtils.clamp(pixelRatio, 1, 2.5);
            const baseSize = this.celestialParticles.userData?.baseSize ?? 0.36;
            const targetSize = baseSize * clampedRatio;
            if (Math.abs(mat.size - targetSize) > 0.005) {
                mat.size = targetSize;
            }
            mat.needsUpdate = true;
        }
        
        // Update dock post splash effects (animated wakes) - only for POND
        // CRITICAL: Always check visibility based on current water type, not just creation time
        if (this.dockPostSplashes) {
            const shouldBeVisible = this.waterBodyType === 'POND' || this.waterBodyType === 'RIVER';
            if (this.dockPostSplashes.visible !== shouldBeVisible) {
                this.dockPostSplashes.visible = shouldBeVisible;
            }

            if (this.dockPostSplashes.visible) {
                if (this.dockPostSplashes.userData?.isRiverWake) {
                    const flow = this.waterBodyConfig?.flowDirection || new THREE.Vector2(1, 0);
                    updateRiverDockPostWake(this.dockPostSplashes, this.time || 0, flow);
                } else {
                    const time = this.time || 0;

                    this.dockPostSplashes.children.forEach(ring => {
                        if (!ring.userData) return;

                        const { baseRadius, maxRadius, ringThickness, startTime, lifetime, fadeStart, peakOpacity } = ring.userData;

                        const age = ((time - startTime) % lifetime + lifetime) % lifetime;
                        const progress = age / lifetime;
                        const expansionProgress = 1.0 - Math.pow(1.0 - progress, 3);
                        const currentRadius = baseRadius + (maxRadius - baseRadius) * expansionProgress;
                        const thickness = ringThickness ?? 0.038;

                        ring.geometry.dispose();
                        ring.geometry = new THREE.RingGeometry(
                            currentRadius,
                            currentRadius + thickness,
                            28
                        );

                        let opacity = 1.0;
                        if (progress >= fadeStart) {
                            const fadeProgress = (progress - fadeStart) / (1.0 - fadeStart);
                            opacity = 1.0 - fadeProgress;
                        }
                        ring.material.opacity = Math.max(0.0, opacity) * (peakOpacity ?? 0.26);

                        ring.rotation.z = Math.sin(time * 0.12 + baseRadius) * 0.015;
                    });
                }
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
                    : new THREE.Vector2(1, 0);
                const useRiverBubbles = this.dockPostParticles.userData.useRiverBubbles === true;
                const halfSize = this.groundSize * 0.4;
                
                const particleCount = positions.length / 3;
                
                // Helper function to respawn particle from a random post
                const respawnParticle = (i3, particleIndex) => {
                    const randomPost = postPositions[Math.floor(Math.random() * postPositions.length)];
                    if (useRiverBubbles) {
                        spawnRiverPostBubble(positions, velocities, i3, randomPost, flowDir, this.waterY);
                    } else {
                        const offsetRadius = 0.08 + Math.random() * 0.04;
                        const angle = Math.random() * Math.PI * 2;
                        positions[i3] = randomPost.x + Math.cos(angle) * offsetRadius;
                        positions[i3 + 1] = this.waterY + 0.05 + Math.random() * 0.05;
                        positions[i3 + 2] = randomPost.z + Math.sin(angle) * offsetRadius;
                        const baseSpeed = 0.22 + Math.random() * 0.28;
                        velocities[i3] = flowDir.x * baseSpeed + (Math.random() - 0.5) * 0.1;
                        velocities[i3 + 1] = -0.02 + Math.random() * 0.02;
                        velocities[i3 + 2] = flowDir.y * baseSpeed + (Math.random() - 0.5) * 0.1;
                    }
                    spawnTimes[particleIndex] = currentTime;
                    lifetimes[particleIndex] = useRiverBubbles
                        ? 1.2 + Math.random() * 0.8
                        : 2.0 + Math.random() * 0.5;
                };
                
                for (let i = 0; i < particleCount; i++) {
                    const i3 = i * 3;
                    
                    // Check particle lifetime FIRST - respawn after 2-2.5 seconds
                    const particleAge = currentTime - spawnTimes[i];
                    const particleLifetime = lifetimes[i];
                    
                    if (particleAge >= particleLifetime) {
                        respawnParticle(i3, i);
                        continue;
                    }

                    if (useRiverBubbles) {
                        updateRiverPostBubbleMotion(
                            positions,
                            velocities,
                            i3,
                            delta,
                            currentTime,
                            i,
                            this.waterY,
                            flowDir
                        );
                    } else {
                        positions[i3] += velocities[i3] * delta;
                        positions[i3 + 1] += velocities[i3 + 1] * delta;
                        positions[i3 + 2] += velocities[i3 + 2] * delta;
                        positions[i3 + 1] = this.waterY + 0.05 + Math.sin(this.time * 1.5 + i) * 0.03;
                    }

                    if (useRiverBubbles && Math.abs(positions[i3]) > halfSize) {
                        respawnParticle(i3, i);
                    }
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

