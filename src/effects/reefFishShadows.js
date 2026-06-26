import * as THREE from 'three';
import {
    REEF_BED_OFFSET,
    sampleReefZonePoint,
    isValidReefZone
} from './coralReefStructures.js';

const FISH_COUNT = 15;

/** Gentle reef tide — small drift along swim direction, not sideways crab-walking. */
const TIDE_DRIFT = 0.1;

/** Swim speed boost for all reef shadows. */
const SPEED_MULTIPLIER = 1.55;

/** Size tiers — larger fish swim slower and sit slightly deeper. */
const SIZE_TIERS = [
    { scale: 0.26, speed: 1.65, opacity: 0.3 },
    { scale: 0.34, speed: 1.45, opacity: 0.34 },
    { scale: 0.44, speed: 1.28, opacity: 0.38 },
    { scale: 0.56, speed: 1.12, opacity: 0.42 },
    { scale: 0.7, speed: 0.98, opacity: 0.46 },
    { scale: 0.88, speed: 0.82, opacity: 0.5 }
];

let sharedFishShadowTexture = null;

function resetFishShadowTexture() {
    sharedFishShadowTexture?.dispose?.();
    sharedFishShadowTexture = null;
}

function mulberry32(seed) {
    let state = seed;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Head at top of texture (+Y) so yaw on the reef bed matches swim heading. */
function createReefFishShadowTexture() {
    if (sharedFishShadowTexture) {
        return sharedFishShadowTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const bodyGrad = ctx.createRadialGradient(32, 52, 0, 32, 52, 36);
    bodyGrad.addColorStop(0, 'rgba(10, 16, 22, 0.72)');
    bodyGrad.addColorStop(0.55, 'rgba(10, 16, 22, 0.38)');
    bodyGrad.addColorStop(1, 'rgba(10, 16, 22, 0)');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(32, 58, 20, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(8, 12, 18, 0.55)';
    ctx.beginPath();
    ctx.moveTo(32, 96);
    ctx.lineTo(10, 118);
    ctx.lineTo(32, 110);
    ctx.lineTo(54, 118);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(8, 12, 18, 0.35)';
    ctx.beginPath();
    ctx.ellipse(32, 28, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    sharedFishShadowTexture = new THREE.CanvasTexture(canvas);
    sharedFishShadowTexture.needsUpdate = true;
    return sharedFishShadowTexture;
}

function pickSwimTarget(lakeMask, groundSize, rand = Math.random) {
    for (let i = 0; i < 45; i++) {
        const { x, z } = sampleReefZonePoint(rand, lakeMask, groundSize);
        if (isValidReefZone(x, z, lakeMask, groundSize)) {
            return { x, z };
        }
    }
    return sampleReefZonePoint(rand, lakeMask, groundSize);
}

function makeFishGroup(baseScale, material) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(baseScale * 1.15, baseScale * 1.65, 1);
    mesh.renderOrder = 2;
    group.add(mesh);
    return group;
}

/** Face swim heading on XZ; texture head points along group +Z after the mesh is laid flat. */
function faceSwimHeading(group, steerX, steerZ) {
    const len = Math.hypot(steerX, steerZ);
    if (len < 1e-6) {
        return 0;
    }
    group.rotation.y = Math.atan2(steerX / len, steerZ / len) + Math.PI;
    return group.rotation.y;
}

function spawnFish(rand, tier, lakeMask, groundSize, waterY, bedOffset) {
    const { x, z } = pickSwimTarget(lakeMask, groundSize, rand);
    const target = pickSwimTarget(lakeMask, groundSize, rand);
    const depthFactor = 0.12 + rand() * 0.72;
    const swimY = waterY - bedOffset * depthFactor - rand() * 0.04;

    const material = new THREE.MeshBasicMaterial({
        map: createReefFishShadowTexture(),
        transparent: true,
        opacity: tier.opacity,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });
    const group = makeFishGroup(tier.scale, material);
    group.position.set(x, swimY, z);

    const dx = target.x - x;
    const dz = target.z - z;
    const heading = faceSwimHeading(group, dx, dz);

    return {
        group,
        x,
        z,
        targetX: target.x,
        targetZ: target.z,
        heading,
        swimY,
        speed: (0.65 + rand() * 0.5) * tier.speed * SPEED_MULTIPLIER,
        pause: rand() * 2.5,
        wander: 1.8 + rand() * 3.5,
        turnTimer: 1.5 + rand() * 3.5
    };
}

/**
 * Ambient fish shadows gliding through the Coral Kingdoms reef ring.
 */
export class ReefFishShadows {
    /**
     * @param {import('../scene.js').Scene} sceneRef
     * @param {{ lakeMask: THREE.Texture, groundSize: number, waterY?: number, bedOffset?: number }} options
     */
    constructor(sceneRef, { lakeMask, groundSize, waterY = 0, bedOffset = REEF_BED_OFFSET }) {
        this.sceneRef = sceneRef;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.bedOffset = bedOffset;
        this.root = null;
        this.fish = [];
        this._active = false;
    }

    create() {
        this.dispose();
        resetFishShadowTexture();

        const root = new THREE.Group();
        root.name = 'reefFishShadows';
        root.visible = false;
        this.root = root;
        this.fish = [];
        this.sceneRef.scene.add(root);

        const rand = mulberry32(0x7a1e09f3);
        for (let i = 0; i < FISH_COUNT; i++) {
            const tier = SIZE_TIERS[i % SIZE_TIERS.length];
            const fish = spawnFish(rand, tier, this.lakeMask, this.groundSize, this.waterY, this.bedOffset);
            this.root.add(fish.group);
            this.fish.push(fish);
        }
    }

    setActive(active) {
        this._active = active === true;
        if (this.root) {
            this.root.visible = this._active && this.fish.length > 0;
        }
    }

    _pickNewTarget(fish) {
        if (Math.random() < 0.4) {
            const arc = (Math.random() - 0.5) * Math.PI * 0.75;
            const dist = 2.5 + Math.random() * 5.5;
            const h = fish.heading + arc;
            const nx = fish.x + Math.sin(h) * dist;
            const nz = fish.z + Math.cos(h) * dist;
            if (isValidReefZone(nx, nz, this.lakeMask, this.groundSize)) {
                fish.targetX = nx;
                fish.targetZ = nz;
                return;
            }
        }
        const next = pickSwimTarget(this.lakeMask, this.groundSize);
        fish.targetX = next.x;
        fish.targetZ = next.z;
    }

    update(delta) {
        if (!this._active || !this.fish.length) {
            return;
        }

        for (const fish of this.fish) {
            if (fish.pause > 0) {
                fish.pause -= delta;
                continue;
            }

            fish.turnTimer -= delta;
            if (fish.turnTimer <= 0) {
                this._pickNewTarget(fish);
                fish.turnTimer = 2.2 + Math.random() * 4.5;
            }

            const dx = fish.targetX - fish.x;
            const dz = fish.targetZ - fish.z;
            const dist = Math.hypot(dx, dz);

            if (dist < 0.35) {
                this._pickNewTarget(fish);
                fish.pause = fish.wander * (0.25 + Math.random() * 0.55);
                fish.turnTimer = 1.2 + Math.random() * 2.8;
                continue;
            }

            const steerX = dx / dist;
            const steerZ = dz / dist;
            fish.heading = faceSwimHeading(fish.group, steerX, steerZ);

            const speed = fish.speed * (1 + TIDE_DRIFT);
            fish.x += steerX * speed * delta;
            fish.z += steerZ * speed * delta;

            fish.group.position.set(fish.x, fish.swimY, fish.z);
        }
    }

    dispose() {
        if (!this.root) {
            return;
        }

        this.sceneRef.scene.remove(this.root);
        this.fish.forEach((fish) => {
            const mesh = fish.group.children[0];
            mesh?.geometry?.dispose();
            mesh?.material?.dispose();
        });
        this.root = null;
        this.fish = [];
    }
}
