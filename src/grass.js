import * as THREE from 'three';

export class Grass {
    constructor(scene, lakeMask, groundSize = 400, waterY = 0) {
        this.sceneRef = scene;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.grass = null;
        this.GRASS_COUNT = 1200;
    }

    create() {
        // Build grass material with wind sway
        const grassMat = this.makeGrassMaterial();
        
        // Create grass geometry (2-tri billboard style)
        const grassGeom = new THREE.PlaneGeometry(0.9, 2.0, 1, 4);
        
        // Create instanced mesh for grass
        this.grass = new THREE.InstancedMesh(grassGeom, grassMat, this.GRASS_COUNT);
        this.grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.grass.frustumCulled = false;
        this.grass.visible = false; // TEMPORARILY DISABLED - grass clump at origin issue
        this.sceneRef.scene.add(this.grass);
        
        // Scatter grass avoiding water (using lakeMask)
        this.scatterGrass();
    }

    makeGrassMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uMask: { value: this.lakeMask }
            },
            vertexShader: `
                uniform float uTime;
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    vec3 p = position;
                    
                    // Wind sway - stronger at tip (uv.y near 1)
                    float sway = sin((uTime * 1.5) + position.x * 0.2 + position.z * 0.3) * 0.06;
                    p.x += sway * (uv.y);
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uMask;
                varying vec2 vUv;
                
                void main() {
                    // Simple vertical gradient green (darker at base, lighter at tip)
                    vec3 base = mix(vec3(0.28, 0.46, 0.12), vec3(0.1, 0.3, 0.07), vUv.y);
                    gl_FragColor = vec4(base, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });
    }

    scatterGrass() {
        const dummy = new THREE.Object3D();
        let placed = 0;
        let attempts = 0;
        const maxAttempts = this.GRASS_COUNT * 10;

        // Grass should only be placed on land near the dock (top 20% of screen)
        // Dock is at top of screen, around z = -4 to -8 (negative Z is toward camera/top)
        // Restrict grass to top area where dock is located
        const dockZ = -4.0; // Approximate dock Z position (top of screen)
        const grassAreaZMin = -this.groundSize * 0.5; // Top edge
        const grassAreaZMax = dockZ + 5.0; // Just behind dock area (top 20% of screen)
        const grassAreaXMin = -this.groundSize * 0.3; // Narrower X range near dock
        const grassAreaXMax = this.groundSize * 0.3;

        while (placed < this.GRASS_COUNT && attempts < maxAttempts) {
            attempts++;
            
            // Random position in top area where dock is (land only, not water)
            const x = THREE.MathUtils.lerp(grassAreaXMin, grassAreaXMax, Math.random());
            const z = THREE.MathUtils.lerp(grassAreaZMin, grassAreaZMax, Math.random());
            
            // No-spawn disk at origin to prevent grass at axis intersection
            const r = Math.hypot(x, z);
            if (r < 150.0) {
                continue; // no instances within 150 units of origin (covers entire lake area)
            }
            
            // Check if position is in water - skip if water
            if (this.isWaterPoint(x, z)) {
                continue; // Skip water area
            }
            
            // Place grass
            dummy.position.set(x, this.waterY - 0.05, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.updateMatrix();
            this.grass.setMatrixAt(placed, dummy.matrix);
            
            // Debug: warn if placing near origin
            if (Math.abs(x) < 10 && Math.abs(z) < 10) {
                console.error(`[GRASS ERROR] Placed grass near origin despite checks: instance=${placed}, x=${x.toFixed(2)}, z=${z.toFixed(2)}, r=${r.toFixed(2)}`);
            }
            placed++;
        }

        // Set instance count to only render the placed instances (fixes uninitialized instances at origin)
        this.grass.count = placed;
        this.grass.instanceMatrix.needsUpdate = true;
        console.log(`[GRASS FIX] Set count to ${placed}, total created ${this.GRASS_COUNT}. Timestamp: ${new Date().toISOString()}`);
        console.log(`Placed ${placed} grass clumps (attempts: ${attempts}) in top area (z: ${grassAreaZMin.toFixed(1)} to ${grassAreaZMax.toFixed(1)})`);
        
        // Debug: check instance matrices for any at origin
        const matrices = this.grass.instanceMatrix.array;
        for (let i = 0; i < placed; i++) {
            const idx = i * 16; // 4x4 matrix = 16 floats
            const x = matrices[idx + 12];
            const z = matrices[idx + 14];
            if (Math.abs(x) < 5 && Math.abs(z) < 5) {
                console.error(`[GRASS] Instance ${i} is at origin: x=${x.toFixed(3)}, z=${z.toFixed(3)}`);
            }
        }
    }

    isWaterPoint(x, z) {
        // Convert world coordinates to UV coordinates for mask (same as water2.js)
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
            
            // Treat "near water" as water too (expand shoreline by ~3%)
            const near = 0.03;
            return maskValue > (0.5 - near);
        }
        
        // Fallback: elliptical check
        const radiusX = this.groundSize * 0.42;
        const radiusZ = this.groundSize * 0.34;
        const distX = Math.abs(x) / radiusX;
        const distZ = Math.abs(z) / radiusZ;
        const dist = Math.sqrt(distX * distX + distZ * distZ);
        return dist < 1.03; // slightly expand for safety
    }

    update(delta) {
        this.time = (this.time || 0) + delta;
        if (this.grass && this.grass.material && this.grass.material.uniforms) {
            this.grass.material.uniforms.uTime.value = this.time;
        }
    }
}

