import * as THREE from 'three';

const RIPPLE_START_SCALE = 0.15;
const RIPPLE_POOL_SIZE = 12;

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function getCatchSplashDuration(rarity = 'Common') {
    switch (rarity) {
        case 'Trophy': return 2.5;
        case 'Legendary': return 2.15;
        case 'Epic': return 1.85;
        case 'Rare': return 1.55;
        case 'Uncommon': return 1.35;
        default: return 1.2;
    }
}

export class Splash {
    constructor(scene, waterY = 0, soundManager = null) {
        this.sceneRef = scene;
        this.waterY = waterY;
        this.splashPS = null;
        this.ripples = [];
        this.SPLASH_N = 150;
        this.time = 0;
        this.soundManager = soundManager;

        this.create();
    }

    create() {
        const splashGeom = new THREE.BufferGeometry();
        const spPos = new Float32Array(this.SPLASH_N * 3);
        const spVel = new Float32Array(this.SPLASH_N * 3);

        for (let i = 0; i < this.SPLASH_N; i++) {
            spPos[i * 3 + 0] = 0;
            spPos[i * 3 + 1] = 0;
            spPos[i * 3 + 2] = 0;

            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 2.5;
            spVel[i * 3 + 0] = Math.cos(angle) * speed;
            spVel[i * 3 + 2] = Math.sin(angle) * speed;
            spVel[i * 3 + 1] = 3.5 + Math.random() * 3.5;
        }

        splashGeom.setAttribute('position', new THREE.BufferAttribute(spPos, 3));

        const splashMat = new THREE.PointsMaterial({
            size: 0.08,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            color: 0xffffff,
            blending: THREE.AdditiveBlending
        });

        this.splashPS = new THREE.Points(splashGeom, splashMat);
        this.splashPS.visible = false;
        this.splashPS.userData = {
            t: 0,
            velocities: spVel,
            positions: spPos
        };
        this.sceneRef.scene.add(this.splashPS);

        for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
            const mesh = new THREE.Mesh(
                new THREE.RingGeometry(0.2, 0.22, 64),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.0,
                    depthWrite: false
                })
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            mesh.renderOrder = 10;
            this.sceneRef.scene.add(mesh);
            this.ripples.push({
                mesh,
                age: 0,
                delay: 0,
                duration: 1.8,
                startScale: RIPPLE_START_SCALE,
                maxScale: 3.5,
                peakOpacity: 0.75,
                active: false
            });
        }
    }

    _acquireRipple() {
        const free = this.ripples.find((r) => !r.active);
        if (free) return free;
        return this.ripples.reduce((oldest, r) => (r.age > oldest.age ? r : oldest), this.ripples[0]);
    }

    _spawnRipple(pos, options = {}) {
        const ripple = this._acquireRipple();
        const {
            delay = 0,
            duration = 1.8,
            maxScale = 3.5,
            peakOpacity = 0.75,
            startScale = RIPPLE_START_SCALE
        } = options;

        ripple.age = -delay;
        ripple.delay = delay;
        ripple.duration = duration;
        ripple.startScale = startScale;
        ripple.maxScale = maxScale;
        ripple.peakOpacity = peakOpacity;
        ripple.active = true;

        ripple.mesh.position.set(pos.x, this.waterY + 0.01, pos.z);
        ripple.mesh.scale.set(startScale, startScale, startScale);
        ripple.mesh.material.opacity = 0;
        ripple.mesh.visible = true;
    }

    _spawnRippleSet(pos, rings) {
        for (const ring of rings) {
            this._spawnRipple(pos, ring);
        }
    }

    _updateRipple(ripple, delta) {
        ripple.age += delta;
        if (ripple.age < 0) return;

        const t = Math.min(ripple.age / ripple.duration, 1);
        const eased = easeOutCubic(t);
        const scale = THREE.MathUtils.lerp(ripple.startScale, ripple.maxScale, eased);

        ripple.mesh.scale.set(scale, scale, scale);
        ripple.mesh.material.opacity = ripple.peakOpacity * Math.pow(1 - t, 1.5);

        if (t >= 1) {
            ripple.mesh.visible = false;
            ripple.active = false;
            ripple.age = 0;
        }
    }

    trigger(pos) {
        const spPos = this.splashPS.userData.positions;
        const spVel = this.splashPS.userData.velocities;

        for (let i = 0; i < this.SPLASH_N; i++) {
            spPos[i * 3 + 0] = 0;
            spPos[i * 3 + 1] = 0;
            spPos[i * 3 + 2] = 0;

            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 2.5;
            spVel[i * 3 + 0] = Math.cos(angle) * speed;
            spVel[i * 3 + 2] = Math.sin(angle) * speed;
            spVel[i * 3 + 1] = 3.5 + Math.random() * 3.5;
        }

        this.splashPS.geometry.attributes.position.needsUpdate = true;
        this.splashPS.position.set(pos.x, this.waterY + 0.02, pos.z);
        this.splashPS.visible = true;
        this.splashPS.userData.t = 0;
        this.splashPS.material.opacity = 0.95;

        this._spawnRippleSet(pos, [
            { delay: 0, duration: 1.8, maxScale: 3.5, peakOpacity: 0.75 },
            { delay: 0.12, duration: 1.6, maxScale: 2.7, peakOpacity: 0.5 },
            { delay: 0.25, duration: 1.4, maxScale: 1.9, peakOpacity: 0.3 }
        ]);

        if (this.soundManager && this.soundManager.playSplash) {
            this.soundManager.playSplash();
        }
    }

    triggerRipple(pos, options = {}) {
        this._spawnRipple(pos, {
            delay: 0,
            duration: 1.2,
            maxScale: 2.0,
            peakOpacity: 0.45,
            ...options
        });
    }

    /** Light bite / hook — ripple only, no particle burst. */
    triggerSmallSplash(pos) {
        this._spawnRippleSet(pos, [
            { delay: 0, duration: 0.95, maxScale: 1.85, peakOpacity: 0.52 },
            { delay: 0.1, duration: 0.85, maxScale: 1.35, peakOpacity: 0.3 }
        ]);
    }

    /** Run a visual splash without synthetic pop / big-splash audio. */
    visualOnly(fn) {
        const original = this.soundManager;
        this.soundManager = null;
        try {
            fn();
        } finally {
            this.soundManager = original;
        }
    }

    triggerBigSplash(pos, duration = 1.2) {
        const spPos = this.splashPS.userData.positions;
        const spVel = this.splashPS.userData.velocities;

        for (let i = 0; i < this.SPLASH_N; i++) {
            spPos[i * 3 + 0] = 0;
            spPos[i * 3 + 1] = 0;
            spPos[i * 3 + 2] = 0;

            const angle = Math.random() * Math.PI * 2;
            const speed = 4.0 + Math.random() * 4.0;
            spVel[i * 3 + 0] = Math.cos(angle) * speed;
            spVel[i * 3 + 2] = Math.sin(angle) * speed;
            spVel[i * 3 + 1] = 5.0 + Math.random() * 5.0;
        }

        this.splashPS.geometry.attributes.position.needsUpdate = true;
        this.splashPS.position.set(pos.x, this.waterY + 0.02, pos.z);
        this.splashPS.visible = true;
        this.splashPS.userData.t = 0;
        this.splashPS.userData.duration = duration;
        this.splashPS.material.opacity = 1.0;

        const rippleDuration = Math.max(duration, 1.8);
        this._spawnRippleSet(pos, [
            { delay: 0, duration: rippleDuration, maxScale: 4.5, peakOpacity: 0.85 },
            { delay: 0.15, duration: rippleDuration * 0.9, maxScale: 3.5, peakOpacity: 0.55 },
            { delay: 0.28, duration: rippleDuration * 0.8, maxScale: 2.5, peakOpacity: 0.35 }
        ]);

        if (this.soundManager) {
            this.soundManager.playBigSplash();
        }
    }

    update(delta) {
        if (this.splashPS.visible) {
            this.splashPS.userData.t += delta;
            const spPos = this.splashPS.userData.positions;
            const spVel = this.splashPS.userData.velocities;

            for (let i = 0; i < this.SPLASH_N; i++) {
                spPos[i * 3 + 0] += spVel[i * 3 + 0] * delta;
                spPos[i * 3 + 1] += spVel[i * 3 + 1] * delta;
                spPos[i * 3 + 2] += spVel[i * 3 + 2] * delta;
                spVel[i * 3 + 1] -= 9.8 * 0.6 * delta;
            }

            this.splashPS.geometry.attributes.position.needsUpdate = true;

            if (this.splashPS.userData.duration !== undefined) {
                const fadeStart = this.splashPS.userData.duration * 0.6;
                const fadeDuration = this.splashPS.userData.duration * 0.4;
                if (this.splashPS.userData.t > fadeStart) {
                    const fadeT = (this.splashPS.userData.t - fadeStart) / fadeDuration;
                    this.splashPS.material.opacity = Math.max(0, 1.0 - fadeT);
                }

                if (this.splashPS.userData.t >= this.splashPS.userData.duration) {
                    this.splashPS.visible = false;
                    delete this.splashPS.userData.duration;
                }
            } else {
                this.splashPS.material.opacity = Math.max(0, 0.95 - this.splashPS.userData.t * 1.5);

                if (this.splashPS.material.opacity <= 0.02) {
                    this.splashPS.visible = false;
                }
            }
        }

        for (const ripple of this.ripples) {
            if (ripple.active) {
                this._updateRipple(ripple, delta);
            }
        }
    }
}
