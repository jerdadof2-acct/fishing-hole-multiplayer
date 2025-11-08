import * as THREE from 'three';

export class Water {
    constructor(scene) {
        this.sceneRef = scene;
        this.water = null;
        this.mesh = null;
        // Water bounds - sized to fit within camera view
        // Keep water contained within visible area so casts are always visible
        this.bounds = {
            minX: -8,
            maxX: 8,
            minZ: -8,  // Water starts here (at dock edge)
            maxZ: 6,   // Water extends forward (toward camera), but not too far off-screen
            width: 16,
            depth: 14
        };
        this.time = 0;
    }

    create() {
        // Create water geometry (large plane for lake)
        const geometry = new THREE.PlaneGeometry(this.bounds.width, this.bounds.depth, 128, 128);
        
        // Create water material with realistic properties
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                waterColor: { value: new THREE.Color(0x006994) },
                shallowColor: { value: new THREE.Color(0x00a8cc) },
                fresnelPower: { value: 2.0 },
                waveSpeed: { value: 0.8 }, // Faster wave speed for more visible movement
                waveScale: { value: 1.0 }
            },
            vertexShader: `
                uniform float time;
                uniform float waveSpeed;
                uniform float waveScale;
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying float vElevation;
                
                void main() {
                    vPosition = position;
                    vNormal = normal;
                    
                    // Enhanced wave animation - more visible waves across water surface
                    // Multiple wave directions for realistic water movement
                    float wave1 = sin(position.x * 0.4 + time * waveSpeed) * 0.4;
                    float wave2 = sin(position.z * 0.3 + time * waveSpeed * 0.8) * 0.3;
                    float wave3 = sin((position.x + position.z) * 0.35 + time * waveSpeed * 1.1) * 0.25;
                    float wave4 = sin((position.x * 0.7 - position.z * 0.5) + time * waveSpeed * 0.9) * 0.2;
                    
                    // Combine waves for more complex surface
                    vElevation = (wave1 + wave2 + wave3 + wave4) * waveScale;
                    
                    // Calculate normal for proper lighting
                    float normalX = cos(position.x * 0.4 + time * waveSpeed) * 0.4 * 0.4;
                    float normalZ = cos(position.z * 0.3 + time * waveSpeed * 0.8) * 0.3 * 0.3;
                    vNormal = normalize(vec3(-normalX, 1.0, -normalZ));
                    
                    vec3 newPosition = position;
                    newPosition.y += vElevation;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 waterColor;
                uniform vec3 shallowColor;
                uniform float fresnelPower;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying float vElevation;
                
                void main() {
                    // Fresnel effect based on viewing angle
                    vec3 viewDirection = normalize(cameraPosition - vPosition);
                    float fresnel = pow(1.0 - dot(normalize(vNormal), viewDirection), fresnelPower);
                    
                    // Mix colors based on depth/fresnel
                    vec3 finalColor = mix(waterColor, shallowColor, fresnel * 0.5);
                    
                    // Add slight variation based on waves
                    finalColor += vec3(0.0, 0.02, 0.03) * vElevation * 0.5;
                    
                    // Transparency with fresnel
                    float alpha = 0.7 + fresnel * 0.3;
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 0; // Water surface at y=0
        this.mesh.receiveShadow = true;
        this.sceneRef.scene.add(this.mesh);

        this.water = this.mesh;
    }

    update(delta) {
        this.time += delta;
        if (this.mesh && this.mesh.material.uniforms) {
            this.mesh.material.uniforms.time.value = this.time;
        }
    }

    // Get random position within lake bounds (with margin to keep casts visible)
    getRandomSpot() {
        // Keep casts within visible area - margin from edges to ensure visibility
        const margin = 1.5; // Margin from edges
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
        return new THREE.Vector3(x, 0, z);
    }

    // Check if position is within lake bounds
    isWithinBounds(position) {
        return position.x >= this.bounds.minX && 
               position.x <= this.bounds.maxX &&
               position.z >= this.bounds.minZ && 
               position.z <= this.bounds.maxZ;
    }

    getBounds() {
        return this.bounds;
    }

    getWaterHeight(x, z) {
        // Calculate water height at given position using same wave formula as shader
        // Must match the vertex shader wave calculations exactly
        const waveSpeed = 0.8;
        const waveScale = 1.0;
        
        const wave1 = Math.sin(x * 0.4 + this.time * waveSpeed) * 0.4;
        const wave2 = Math.sin(z * 0.3 + this.time * waveSpeed * 0.8) * 0.3;
        const wave3 = Math.sin((x + z) * 0.35 + this.time * waveSpeed * 1.1) * 0.25;
        const wave4 = Math.sin((x * 0.7 - z * 0.5) + this.time * waveSpeed * 0.9) * 0.2;
        
        return (wave1 + wave2 + wave3 + wave4) * waveScale;
    }
}

