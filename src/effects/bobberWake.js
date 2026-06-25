import * as THREE from 'three';

const POOL_SIZE = 10;
const V_ARM_ANGLE = 0.38; // radians — spread of the V behind movement
const BASE_LIFETIME = 0.85;

function createWakeTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);

    const g = ctx.createLinearGradient(0, size / 2, size, size / 2);
    g.addColorStop(0, 'rgba(210,240,255,0)');
    g.addColorStop(0.25, 'rgba(210,240,255,0.18)');
    g.addColorStop(0.55, 'rgba(210,240,255,0.34)');
    g.addColorStop(1, 'rgba(210,240,255,0)');

    ctx.strokeStyle = g;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(8, size / 2);
    ctx.quadraticCurveTo(size * 0.45, size / 2 - 8, size - 8, size / 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

/**
 * Trailing V-shaped wake ripples that follow a bobber during fish fights.
 * Purely visual — no splash sounds or heavy shader ripples.
 */
export class BobberWake {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.lastPos = new THREE.Vector3();
        this.hasLastPos = false;
        this.spawnTimer = 0;
        this.spawnInterval = 0.16;
        this.idleRippleTimer = 0;
        this.shaderRippleCooldown = 0;

        const texture = createWakeTexture();
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending
        });

        this.pool = [];
        for (let i = 0; i < POOL_SIZE; i++) {
            const geo = new THREE.PlaneGeometry(0.5, 0.5);
            const mesh = new THREE.Mesh(geo, material.clone());
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            mesh.renderOrder = 997;
            mesh.userData.age = 0;
            mesh.userData.lifetime = BASE_LIFETIME;
            mesh.userData.baseScaleX = 0.35;
            mesh.userData.baseScaleZ = 0.35;
            scene.add(mesh);
            this.pool.push(mesh);
        }
    }

    reset() {
        this.active = false;
        this.hasLastPos = false;
        this.spawnTimer = 0;
        this.idleRippleTimer = 0;
        for (const mesh of this.pool) {
            mesh.visible = false;
            mesh.userData.age = 0;
        }
    }

    _acquire() {
        let oldest = null;
        let oldestAge = -1;
        for (const mesh of this.pool) {
            if (!mesh.visible) return mesh;
            if (mesh.userData.age > oldestAge) {
                oldestAge = mesh.userData.age;
                oldest = mesh;
            }
        }
        return oldest;
    }

    _spawn(x, z, waterY, scaleX, scaleZ, rotationY, lifetime = BASE_LIFETIME, opacity = 0.42) {
        const mesh = this._acquire();
        if (!mesh) return;

        mesh.position.set(x, waterY + 0.014, z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rotationY;
        mesh.scale.set(scaleX, scaleZ, 1);

        mesh.material.opacity = opacity;
        mesh.visible = true;

        mesh.userData.age = 0;
        mesh.userData.lifetime = lifetime;
        mesh.userData.baseScaleX = scaleX;
        mesh.userData.baseScaleZ = scaleZ;
    }

    /**
     * @param {number} delta
     * @param {THREE.Vector3} bobberPos
     * @param {boolean} fighting — HOOKED_FIGHT and bobber visible
     * @param {(x: number, z: number) => number} getWaterHeight
     * @param {(x: number, z: number) => void} [shaderRipple] — optional, throttled
     */
    update(delta, bobberPos, fighting, getWaterHeight, shaderRipple = null) {
        if (!fighting) {
            if (this.active) this.reset();
            return;
        }
        this.active = true;

        const waterY = getWaterHeight(bobberPos.x, bobberPos.z);
        let dx = 0;
        let dz = 0;
        let moved = 0;

        if (this.hasLastPos) {
            dx = bobberPos.x - this.lastPos.x;
            dz = bobberPos.z - this.lastPos.z;
            moved = Math.sqrt(dx * dx + dz * dz);
        }

        this.spawnTimer += delta;
        this.shaderRippleCooldown = Math.max(0, this.shaderRippleCooldown - delta);

        if (this.hasLastPos && moved > 0.025 && this.spawnTimer >= this.spawnInterval) {
            const speed = moved / Math.max(delta, 0.001);
            const heading = Math.atan2(dx, dz);

            const behind = 0.18 + Math.min(0.35, speed * 0.05);
            const armBack = 0.35 + Math.min(0.55, speed * 0.08);
            const armSide = 0.16 + Math.min(0.28, speed * 0.04);

            // tiny center disturbance
            const cx = bobberPos.x - Math.sin(heading) * behind;
            const cz = bobberPos.z - Math.cos(heading) * behind;
            const cy = getWaterHeight(cx, cz);
            this._spawn(cx, cz, cy, 0.18, 0.18, 0, BASE_LIFETIME * 0.55, 0.22);

            // two V arms
            for (const side of [-1, 1]) {
                const armHeading = heading + side * V_ARM_ANGLE;

                const ax =
                    bobberPos.x
                    - Math.sin(heading) * armBack
                    + Math.cos(heading) * armSide * side;

                const az =
                    bobberPos.z
                    - Math.cos(heading) * armBack
                    - Math.sin(heading) * armSide * side;

                const ay = getWaterHeight(ax, az);

                this._spawn(
                    ax,
                    az,
                    ay,
                    0.75 + Math.min(0.45, speed * 0.08), // length
                    0.09,                                // width
                    -armHeading,
                    BASE_LIFETIME * 0.9,
                    0.36
                );
            }

            if (shaderRipple && this.shaderRippleCooldown <= 0 && speed > 0.35) {
                shaderRipple(bobberPos.x, bobberPos.z);
                this.shaderRippleCooldown = 0.55;
            }

            this.spawnTimer = 0;
            this.idleRippleTimer = 0;
            this.spawnInterval = Math.max(0.08, Math.min(0.18, 0.22 / (speed + 0.25)));
        } else if (this.hasLastPos && moved < 0.02) {
            this.idleRippleTimer += delta;
            if (this.idleRippleTimer >= 0.55) {
                this._spawn(bobberPos.x, bobberPos.z, waterY, 0.18, 0.18, 0, BASE_LIFETIME * 0.65, 0.22);
                this.idleRippleTimer = 0;
            }
        }

        this.lastPos.copy(bobberPos);
        this.hasLastPos = true;

        for (const mesh of this.pool) {
            if (!mesh.visible) continue;

            mesh.userData.age += delta;
            const t = mesh.userData.age / mesh.userData.lifetime;

            if (t >= 1) {
                mesh.visible = false;
                continue;
            }

            const grow = 1 + t * 0.8;

            const sx = (mesh.userData.baseScaleX || 0.3) * grow;
            const sz = (mesh.userData.baseScaleZ || 0.3) * (1 + t * 0.35);

            mesh.scale.set(sx, sz, 1);
            mesh.material.opacity = 0.42 * (1 - t) * (1 - t);
        }
    }
}
