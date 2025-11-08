import * as THREE from 'three';

export class Splash {
    constructor(scene, waterY = 0, soundManager = null) {
        this.sceneRef = scene;
        this.waterY = waterY;
        this.splashPS = null;
        this.ripple = null;
        this.SPLASH_N = 150; // Increased for bigger splash
        this.time = 0;
        this.soundManager = soundManager;
        
        this.create();
    }

    create() {
        // Splash particles
        const splashGeom = new THREE.BufferGeometry();
        const spPos = new Float32Array(this.SPLASH_N * 3);
        const spVel = new Float32Array(this.SPLASH_N * 3);
        
        // Initialize velocities for splash
        for (let i = 0; i < this.SPLASH_N; i++) {
            spPos[i * 3 + 0] = 0;
            spPos[i * 3 + 1] = 0;
            spPos[i * 3 + 2] = 0;
            
            // Random direction and speed (increased for bigger splash)
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 2.5; // Increased speed
            spVel[i * 3 + 0] = Math.cos(angle) * speed;
            spVel[i * 3 + 2] = Math.sin(angle) * speed;
            spVel[i * 3 + 1] = 3.5 + Math.random() * 3.5; // Higher upward velocity
        }
        
        splashGeom.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
        
        const splashMat = new THREE.PointsMaterial({
            size: 0.08, // Bigger particles for more visible splash
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            color: 0xffffff,
            blending: THREE.AdditiveBlending // Bright, visible splash
        });
        
        this.splashPS = new THREE.Points(splashGeom, splashMat);
        this.splashPS.visible = false;
        this.splashPS.userData = {
            t: 0,
            velocities: spVel,
            positions: spPos
        };
        this.sceneRef.scene.add(this.splashPS);

        // Ripple ring (always on top of water visually) - bigger for landing splash
        this.ripple = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.22, 64), // Inner/outer radius for ripple
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.0,
                depthWrite: false
            })
        );
        this.ripple.rotation.x = -Math.PI / 2;
        this.ripple.visible = false;
        this.ripple.renderOrder = 10; // Draw after water
        this.ripple.userData = { t: 0 };
        this.sceneRef.scene.add(this.ripple);
    }

    trigger(pos) {
        // Reset splash particles
        const spPos = this.splashPS.userData.positions;
        const spVel = this.splashPS.userData.velocities;
        
        for (let i = 0; i < this.SPLASH_N; i++) {
            spPos[i * 3 + 0] = 0;
            spPos[i * 3 + 1] = 0;
            spPos[i * 3 + 2] = 0;
            
            // Reset velocities (increased for bigger splash)
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 2.5; // Increased speed
            spVel[i * 3 + 0] = Math.cos(angle) * speed;
            spVel[i * 3 + 2] = Math.sin(angle) * speed;
            spVel[i * 3 + 1] = 3.5 + Math.random() * 3.5; // Higher upward velocity
        }
        
        this.splashPS.geometry.attributes.position.needsUpdate = true;
        this.splashPS.position.set(pos.x, this.waterY + 0.02, pos.z);
        this.splashPS.visible = true;
        this.splashPS.userData.t = 0;
        this.splashPS.material.opacity = 0.95;

        // Trigger ripple (guaranteed visible) - bigger and more visible
        this.ripple.position.set(pos.x, this.waterY + 0.01, pos.z);
        this.ripple.scale.set(1, 1, 1);
        this.ripple.material.opacity = 1.0; // More visible
        this.ripple.visible = true;
        this.ripple.userData.t = 0;
        
        // Play splash sound (only if soundManager is provided)
        // This is disabled when fish is caught to prevent pop noise
        if (this.soundManager && this.soundManager.playSplash) {
            this.soundManager.playSplash();
        }
    }

    triggerRipple(pos) {
        // Public method to trigger just ripple (for wake effects)
        this.ripple.position.set(pos.x, this.waterY + 0.01, pos.z);
        this.ripple.scale.set(1, 1, 1);
        this.ripple.material.opacity = 0.85;
        this.ripple.visible = true;
        this.ripple.userData.t = 0;
    }
    
    triggerBigSplash(pos, duration = 1.2) {
        // Big splash for catching fish - lasts longer with more particles
        const spPos = this.splashPS.userData.positions;
        const spVel = this.splashPS.userData.velocities;
        
        // Create a MUCH bigger splash - more particles with higher velocities
        for (let i = 0; i < this.SPLASH_N; i++) {
            spPos[i * 3 + 0] = 0;
            spPos[i * 3 + 1] = 0;
            spPos[i * 3 + 2] = 0;
            
            // Bigger, more dramatic velocities for catch splash
            const angle = Math.random() * Math.PI * 2;
            const speed = 4.0 + Math.random() * 4.0; // Much faster horizontal spread
            spVel[i * 3 + 0] = Math.cos(angle) * speed;
            spVel[i * 3 + 2] = Math.sin(angle) * speed;
            spVel[i * 3 + 1] = 5.0 + Math.random() * 5.0; // Much higher upward velocity
        }
        
        this.splashPS.geometry.attributes.position.needsUpdate = true;
        this.splashPS.position.set(pos.x, this.waterY + 0.02, pos.z);
        this.splashPS.visible = true;
        this.splashPS.userData.t = 0;
        this.splashPS.userData.duration = duration; // Store duration for extended animation
        this.splashPS.material.opacity = 1.0; // Start fully visible
        
        // Bigger, more visible ripple for catch splash
        this.ripple.position.set(pos.x, this.waterY + 0.01, pos.z);
        this.ripple.scale.set(1, 1, 1);
        this.ripple.material.opacity = 1.0;
        this.ripple.visible = true;
        this.ripple.userData.t = 0;
        this.ripple.userData.duration = duration;
        
        // Play big splash sound for fish landing
        if (this.soundManager) {
            this.soundManager.playBigSplash();
        }
    }
    
    update(delta) {
        // Update splash particles
        if (this.splashPS.visible) {
            this.splashPS.userData.t += delta;
            const spPos = this.splashPS.userData.positions;
            const spVel = this.splashPS.userData.velocities;
            
            for (let i = 0; i < this.SPLASH_N; i++) {
                spPos[i * 3 + 0] += spVel[i * 3 + 0] * delta;
                spPos[i * 3 + 1] += spVel[i * 3 + 1] * delta;
                spPos[i * 3 + 2] += spVel[i * 3 + 2] * delta;
                
                // Apply gravity
                spVel[i * 3 + 1] -= 9.8 * 0.6 * delta;
            }
            
            this.splashPS.geometry.attributes.position.needsUpdate = true;
            
            // Check if this is a big splash (has duration)
            if (this.splashPS.userData.duration !== undefined) {
                // Big splash: fade out over the duration (1-1.5 seconds)
                const fadeStart = this.splashPS.userData.duration * 0.6; // Start fading at 60% of duration
                const fadeDuration = this.splashPS.userData.duration * 0.4; // Fade over last 40%
                if (this.splashPS.userData.t > fadeStart) {
                    const fadeT = (this.splashPS.userData.t - fadeStart) / fadeDuration;
                    this.splashPS.material.opacity = Math.max(0, 1.0 - fadeT);
                }
                
                // Hide after duration
                if (this.splashPS.userData.t >= this.splashPS.userData.duration) {
                    this.splashPS.visible = false;
                    delete this.splashPS.userData.duration;
                }
            } else {
                // Normal splash: quick fade
                this.splashPS.material.opacity = Math.max(0, 0.95 - this.splashPS.userData.t * 1.5);
                
                if (this.splashPS.material.opacity <= 0.02) {
                    this.splashPS.visible = false;
                }
            }
        }

        // Update ripple
        if (this.ripple.visible) {
            this.ripple.userData.t += delta;
            
            // Check if this is a big splash ripple (has duration)
            if (this.ripple.userData.duration !== undefined) {
                // Big splash ripple: expand and fade over duration
                this.ripple.scale.multiplyScalar(1 + delta * 2.5); // Faster expansion
                const fadeStart = this.ripple.userData.duration * 0.5; // Start fading at 50%
                const fadeDuration = this.ripple.userData.duration * 0.5; // Fade over last 50%
                if (this.ripple.userData.t > fadeStart) {
                    const fadeT = (this.ripple.userData.t - fadeStart) / fadeDuration;
                    this.ripple.material.opacity = Math.max(0, 1.0 - fadeT);
                }
                
                // Hide after duration
                if (this.ripple.userData.t >= this.ripple.userData.duration) {
                    this.ripple.visible = false;
                    delete this.ripple.userData.duration;
                }
            } else {
                // Normal ripple: quick fade
                this.ripple.scale.multiplyScalar(1 + delta * 2.2);
                this.ripple.material.opacity *= (1 - delta * 1.4);
                
                if (this.ripple.material.opacity < 0.03) {
                    this.ripple.visible = false;
                }
            }
        }
    }
}

