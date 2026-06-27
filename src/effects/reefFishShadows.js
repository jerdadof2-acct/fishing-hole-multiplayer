import * as THREE from 'three';
import {
    REEF_BED_OFFSET,
    sampleReefZonePoint,
    isValidReefZone
} from './coralReefStructures.js';
import {
    sampleCortezAmbientZonePoint,
    isValidCortezAmbientZone
} from './pondSubmergedGrass.js';

const FISH_COUNT_REEF = 15;
const FISH_COUNT_CORTEZ = 5;

/** One fish per tier — small through large, spread across the size ladder. */
const CORTEZ_FISH_TIER_INDICES = [0, 1, 3, 4, 5];

function fishCountForZone(zone) {
    return zone === 'cortez' ? FISH_COUNT_CORTEZ : FISH_COUNT_REEF;
}

function tierForFish(zone, index) {
    if (zone === 'cortez') {
        return SIZE_TIERS[CORTEZ_FISH_TIER_INDICES[index % CORTEZ_FISH_TIER_INDICES.length]];
    }
    return SIZE_TIERS[index % SIZE_TIERS.length];
}

/** Shallow Cortez flats — same bed depth as Coral Kingdoms reef bay. */
const CORTEZ_BED_OFFSET = REEF_BED_OFFSET;

/** Gentle reef tide — small drift along swim direction, not sideways crab-walking. */
const TIDE_DRIFT = 0.05;

/** Global swim speed scale for reef shadows. */
const SPEED_MULTIPLIER = 0.72;

/** Size tiers — larger fish swim slower and sit slightly deeper. */
const SIZE_TIERS = [
    { scale: 0.26, speed: 1.65, opacity: 0.21 },
    { scale: 0.34, speed: 1.45, opacity: 0.24 },
    { scale: 0.44, speed: 1.28, opacity: 0.27 },
    { scale: 0.56, speed: 1.12, opacity: 0.3 },
    { scale: 0.7, speed: 0.98, opacity: 0.33 },
    { scale: 0.88, speed: 0.82, opacity: 0.36 }
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

function pickSwimTarget(zoneSampler, rand = Math.random) {
    for (let i = 0; i < 45; i++) {
        const { x, z } = zoneSampler.sample(rand);
        if (zoneSampler.isValid(x, z)) {
            return { x, z };
        }
    }
    return zoneSampler.sample(rand);
}

function createZoneSampler(zone, lakeMask, groundSize) {
    if (zone === 'cortez') {
        return {
            sample: (rand) => sampleCortezAmbientZonePoint(rand),
            isValid: (x, z) => isValidCortezAmbientZone(x, z, lakeMask, groundSize)
        };
    }

    return {
        sample: (rand) => sampleReefZonePoint(rand, lakeMask, groundSize),
        isValid: (x, z) => isValidReefZone(x, z, lakeMask, groundSize)
    };
}

function makeFishGroup(baseScale, material, cortezStyle = false) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(baseScale * 1.15, baseScale * 1.65, 1);
    // Cortez: draw above water/grass/bed so waves do not clip the shadow decal.
    mesh.renderOrder = cortezStyle ? 5 : 1;
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

function spawnFish(rand, tier, zoneSampler, waterY, bedOffset, zone = 'reef') {
    const { x, z } = pickSwimTarget(zoneSampler, rand);
    const target = pickSwimTarget(zoneSampler, rand);
    const isCortez = zone === 'cortez';
    const depthFactor = 0.12 + rand() * 0.72;
    // Cortez shadows read as surface decals — stay above the wavy sandy bed.
    const swimY = isCortez
        ? waterY - 0.018 - rand() * 0.055
        : waterY - bedOffset * depthFactor - rand() * 0.04;

    const shadowOpacity = tier.opacity;

    const material = new THREE.MeshBasicMaterial({
        map: createReefFishShadowTexture(),
        transparent: true,
        opacity: shadowOpacity,
        depthWrite: false,
        depthTest: !isCortez,
        side: THREE.DoubleSide
    });
    const group = makeFishGroup(tier.scale, material, isCortez);
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
        speed: (0.5 + rand() * 0.38) * tier.speed * SPEED_MULTIPLIER,
        pause: rand() * 2.5,
        wander: 1.8 + rand() * 3.5,
        turnTimer: 1.5 + rand() * 3.5
    };
}

/**
 * Ambient fish shadows gliding through reef or shallow flats.
 */
export class ReefFishShadows {
    /**
     * @param {import('../scene.js').Scene} sceneRef
     * @param {{ lakeMask: THREE.Texture, groundSize: number, waterY?: number, bedOffset?: number, zone?: 'reef' | 'cortez' }} options
     */
    constructor(sceneRef, { lakeMask, groundSize, waterY = 0, bedOffset = REEF_BED_OFFSET, zone = 'reef' }) {
        this.sceneRef = sceneRef;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.bedOffset = bedOffset;
        this._zone = zone === 'cortez' ? 'cortez' : 'reef';
        this._zoneSampler = createZoneSampler(this._zone, lakeMask, groundSize);
        this.root = null;
        this.fish = [];
        this._active = false;
    }

    setZone(zone) {
        const next = zone === 'cortez' ? 'cortez' : 'reef';
        const zoneChanged = next !== this._zone;
        this._zone = next;
        this.bedOffset = next === 'cortez' ? CORTEZ_BED_OFFSET : REEF_BED_OFFSET;
        this._zoneSampler = createZoneSampler(this._zone, this.lakeMask, this.groundSize);
        if (zoneChanged && this.root) {
            this.rebuild();
        }
    }

    rebuild(lakeMask) {
        if (!this.root) {
            return;
        }

        if (lakeMask) {
            this.lakeMask = lakeMask;
            this._zoneSampler = createZoneSampler(this._zone, this.lakeMask, this.groundSize);
        }

        this.fish.forEach((fish) => {
            this.root.remove(fish.group);
            const mesh = fish.group.children[0];
            mesh?.geometry?.dispose();
            mesh?.material?.dispose();
        });
        this.fish = [];

        const rand = mulberry32(this._zone === 'cortez' ? 0x4c07e2a9 : 0x7a1e09f3);
        const count = fishCountForZone(this._zone);
        for (let i = 0; i < count; i++) {
            const tier = tierForFish(this._zone, i);
            const fish = spawnFish(rand, tier, this._zoneSampler, this.waterY, this.bedOffset, this._zone);
            this.root.add(fish.group);
            this.fish.push(fish);
        }

        this.root.visible = this._active && this.fish.length > 0;
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
        this.rebuild();
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
            if (this._zoneSampler.isValid(nx, nz)) {
                fish.targetX = nx;
                fish.targetZ = nz;
                return;
            }
        }
        const next = pickSwimTarget(this._zoneSampler);
        fish.targetX = next.x;
        fish.targetZ = next.z;
    }

    _retargetCortezFish(fish) {
        const next = pickSwimTarget(this._zoneSampler);
        fish.targetX = next.x;
        fish.targetZ = next.z;
        fish.turnTimer = 1.0 + Math.random() * 2.0;
        fish.pause = 0.15 + Math.random() * 0.35;
    }

    update(delta) {
        if (!this._active || !this.fish.length) {
            return;
        }

        const cortez = this._zone === 'cortez';

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
            const nextX = fish.x + steerX * speed * delta;
            const nextZ = fish.z + steerZ * speed * delta;

            if (cortez && !this._zoneSampler.isValid(nextX, nextZ)) {
                this._retargetCortezFish(fish);
                continue;
            }

            fish.x = nextX;
            fish.z = nextZ;

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
