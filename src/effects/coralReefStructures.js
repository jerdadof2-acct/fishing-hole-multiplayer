import * as THREE from 'three';
import { GROUND_SIZE, LAKE_MASK_PROFILE } from '../buildLakeMask.js';

/** Locked Coral Kingdoms reef — see `.cursor/rules/coral-kingdoms-reef.mdc` before editing. */

/** Sand floor depth below the water surface at Coral Kingdoms. */
export const REEF_BED_OFFSET = 0.28;

const isMobileReef = typeof navigator !== 'undefined'
    && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

const TARGET_COLONIES = isMobileReef ? 90 : 210;
const TARGET_FILLER_COLONIES = isMobileReef ? 35 : 95;
const TARGET_LARGE_COLONIES = isMobileReef ? 8 : 16;
const MIN_COLONY_SPACING = 1.35;
const MIN_FILLER_SPACING = 0.95;
const MIN_LARGE_SPACING = 4.6;
const MIN_DIST_FROM_BOAT = 3;
const MAX_DIST_FROM_BOAT = 20;
/** Uniform scale for all reef colonies (shapes/colors unchanged). */
const CORAL_SIZE_MULTIPLIER = 2.0;
/** Extra width so reefs read large through the water. */
const REEF_WIDTH_BOOST = 1.75;
const LARGE_REEF_WIDTH_BOOST = 2.65;
const LARGE_HEIGHT_FILL = 1.0;
/** World units below the water surface — coral tops stay at least this deep. */
const SURFACE_CLEARANCE = 0.02;
/** How much of the shallow water column colonies may fill. */
const HEIGHT_FILL = 0.96;
const MASK_ROTATE = LAKE_MASK_PROFILE.rotate;
const BOAT_CENTER_Z = -1.5;

const CORAL_PALETTE = [
    { color: 0xff6b7a, emissive: 0x3a1520 },
    { color: 0xff9f6b, emissive: 0x3a2010 },
    { color: 0xe056a0, emissive: 0x2a1028 },
    { color: 0x4ecdc4, emissive: 0x102a28 },
    { color: 0xf7c59f, emissive: 0x2a2018 },
    { color: 0x9b6bff, emissive: 0x18102a }
];

const coralMaterials = CORAL_PALETTE.map((entry) => new THREE.MeshStandardMaterial({
    color: entry.color,
    emissive: entry.emissive,
    emissiveIntensity: 0.38,
    roughness: 0.62,
    metalness: 0.03,
    flatShading: true
}));

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

function isOnBoat(x, z) {
    const dz = z - BOAT_CENTER_Z;
    return Math.abs(x) < 4.0 && dz > -5.5 && dz < 6.5;
}
function sampleMaskWater(x, z, lakeMask, groundSize) {
    if (!lakeMask?.image?.getContext) {
        const u = x / groundSize + 0.5;
        const v = 1.0 - (z / groundSize + 0.5);
        const du = u - 0.5;
        const dv = v - 0.5;
        const cos = Math.cos(-MASK_ROTATE);
        const sin = Math.sin(-MASK_ROTATE);
        const eu = du * cos - dv * sin;
        const ev = du * sin + dv * cos;
        return (eu / LAKE_MASK_PROFILE.a) ** 2 + (ev / LAKE_MASK_PROFILE.b) ** 2 < 0.82 ** 2;
    }

    const uvx = (x / groundSize) + 0.5;
    const uvz = 1.0 - ((z / groundSize) + 0.5);
    const cvs = lakeMask.image;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    const px = Math.floor(Math.max(0, Math.min(1, uvx)) * (cvs.width - 1));
    const py = Math.floor(Math.max(0, Math.min(1, uvz)) * (cvs.height - 1));
    return ctx.getImageData(px, py, 1, 1).data[0] / 255 > 0.52;
}

/** Tight ring hugging the small boat. */
function sampleCoralPoint(rand, lakeMask, groundSize) {
    for (let i = 0; i < 50; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = MIN_DIST_FROM_BOAT + Math.sqrt(rand()) * (MAX_DIST_FROM_BOAT - MIN_DIST_FROM_BOAT);
        const x = Math.cos(angle) * dist;
        const z = BOAT_CENTER_Z + Math.sin(angle) * dist;
        if (!sampleMaskWater(x, z, lakeMask, groundSize)) continue;
        if (isOnBoat(x, z)) continue;
        return { x, z };
    }

    const angle = rand() * Math.PI * 2;
    const dist = MIN_DIST_FROM_BOAT + rand() * (MAX_DIST_FROM_BOAT - MIN_DIST_FROM_BOAT);
    return {
        x: Math.cos(angle) * dist,
        z: BOAT_CENTER_Z + Math.sin(angle) * dist
    };
}

/** Shared reef ring sampling for coral colonies and fish shadows. */
export function sampleReefZonePoint(rand, lakeMask, groundSize) {
    return sampleCoralPoint(rand, lakeMask, groundSize);
}

export function isValidReefZone(x, z, lakeMask, groundSize) {
    return sampleMaskWater(x, z, lakeMask, groundSize) && !isOnBoat(x, z);
}

function spacingOk(x, z, placedPoints, colonyType) {
    for (const p of placedPoints) {
        const d = Math.hypot(p.x - x, p.z - z);
        let need = MIN_COLONY_SPACING;

        if (colonyType === 'filler') {
            need = MIN_FILLER_SPACING;
        }
        if (p.type === 'filler' && colonyType !== 'large') {
            need = Math.min(need, MIN_FILLER_SPACING);
        }
        if (colonyType === 'large' || p.type === 'large') {
            need = Math.max(need, MIN_LARGE_SPACING);
        }
        if (colonyType !== 'large' && p.type === 'large') {
            need = Math.max(need, MIN_LARGE_SPACING * 0.55);
        }
        if (d < need) {
            return false;
        }
    }
    return true;
}

function distortGeometry(geometry, rand, strength) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(
            i,
            pos.getX(i) + (rand() - 0.5) * strength,
            pos.getY(i) + (rand() - 0.5) * strength * 0.75,
            pos.getZ(i) + (rand() - 0.5) * strength
        );
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

function makeJaggedRock(rand, radius, mat) {
    const geo = distortGeometry(
        new THREE.OctahedronGeometry(radius, 0),
        rand,
        radius * 0.42
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(
        0.65 + rand() * 0.75,
        0.45 + rand() * 0.85,
        0.6 + rand() * 0.8
    );
    mesh.rotation.set(rand() * 0.6, rand() * Math.PI, rand() * 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function makeKnobbySegment(rand, length, radius, mat) {
    const geo = distortGeometry(
        new THREE.CylinderGeometry(radius * 0.55, radius * 1.25, length, 4),
        rand,
        radius * 0.55
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function makeFlatPlate(rand, width, height, mat) {
    const geo = distortGeometry(
        new THREE.BoxGeometry(width, height, width * 0.12),
        rand,
        width * 0.28
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * Scale colony to sit on the sand bed and grow up into the clear shallow water.
 */
function fitColonyOnReefBed(colony, waterY, bedOffset = REEF_BED_OFFSET, options = {}) {
    const sizeMult = options.sizeMultiplier ?? CORAL_SIZE_MULTIPLIER;
    const widthBoost = options.widthBoost ?? REEF_WIDTH_BOOST;
    const heightFill = options.heightFill ?? HEIGHT_FILL;
    const bedY = waterY - bedOffset;
    const maxTopY = waterY - SURFACE_CLEARANCE;
    const maxHeight = Math.max(0.12, maxTopY - bedY);
    const targetHeight = maxHeight * heightFill;

    colony.position.set(colony.position.x, bedY, colony.position.z);
    colony.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(colony);
    const height = Math.max(0.001, box.max.y - box.min.y);
    colony.scale.multiplyScalar(targetHeight / height);
    colony.scale.x *= widthBoost;
    colony.scale.z *= widthBoost;
    colony.scale.multiplyScalar(sizeMult);

    colony.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(colony);
    if (box.max.y > maxTopY) {
        const shrink = (maxTopY - box.min.y) / Math.max(0.001, box.max.y - box.min.y);
        colony.scale.multiplyScalar(shrink);
        colony.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(colony);
    }

    colony.position.y += bedY - box.min.y;
    colony.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(colony);
    if (box.max.y > maxTopY) {
        colony.position.y -= box.max.y - maxTopY;
    }
}

function attachColonyMeshes(colony) {
    colony.traverse((node) => {
        if (node.isMesh) {
            node.renderOrder = 4;
            node.material.depthWrite = true;
        }
    });
}
function pickMaterial(rand) {
    return coralMaterials[Math.floor(rand() * coralMaterials.length)];
}

function addBranchCoral(group, mat, rand, scale) {
    const trunkH = (0.35 + rand() * 0.55) * scale;
    const trunkR = (0.05 + rand() * 0.04) * scale;
    const trunk = makeKnobbySegment(rand, trunkH, trunkR, mat);
    trunk.position.y = trunkH * 0.5;
    trunk.rotation.z = (rand() - 0.5) * 0.35;
    group.add(trunk);

    const branchCount = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < branchCount; i++) {
        const len = (0.22 + rand() * 0.7) * scale;
        const r = trunkR * (0.5 + rand() * 0.4);
        const branch = makeKnobbySegment(rand, len, r, mat);
        branch.position.set(
            (rand() - 0.5) * trunkR * 3.5,
            trunkH * (0.4 + rand() * 0.5),
            (rand() - 0.5) * trunkR * 3.5
        );
        branch.rotation.set(
            (rand() - 0.5) * 1.35,
            rand() * Math.PI * 2,
            (rand() - 0.5) * 1.35
        );
        group.add(branch);

        if (rand() > 0.45) {
            const twig = makeKnobbySegment(rand, len * (0.35 + rand() * 0.35), r * 0.55, mat);
            twig.position.copy(branch.position);
            twig.position.y += len * 0.35;
            twig.rotation.set(
                branch.rotation.x + (rand() - 0.5) * 0.9,
                branch.rotation.y + rand() * 0.8,
                branch.rotation.z + (rand() - 0.5) * 0.9
            );
            group.add(twig);
        }
    }
}

function addStaghornCoral(group, mat, rand, scale) {
    const arms = 4 + Math.floor(rand() * 4);
    for (let i = 0; i < arms; i++) {
        const armLen = (0.3 + rand() * 0.55) * scale;
        const arm = makeFlatPlate(rand, (0.04 + rand() * 0.03) * scale, armLen, mat);
        const angle = (i / arms) * Math.PI * 2 + rand() * 0.4;
        arm.position.set(
            Math.cos(angle) * (0.06 + rand() * 0.1) * scale,
            armLen * 0.45,
            Math.sin(angle) * (0.06 + rand() * 0.1) * scale
        );
        arm.rotation.set(
            (rand() - 0.5) * 0.7,
            angle + (rand() - 0.5) * 0.5,
            (rand() - 0.5) * 1.1
        );
        group.add(arm);

        const fork = makeFlatPlate(rand, (0.03 + rand() * 0.025) * scale, armLen * 0.55, mat);
        fork.position.copy(arm.position);
        fork.position.y += armLen * 0.35;
        fork.rotation.copy(arm.rotation);
        fork.rotation.y += (rand() - 0.5) * 1.2;
        fork.rotation.z += (rand() - 0.5) * 0.8;
        group.add(fork);
    }

    const base = makeJaggedRock(rand, 0.1 * scale, mat);
    base.position.y = 0.04 * scale;
    group.add(base);
}

function addFanCoral(group, mat, rand, scale) {
    const plates = 5 + Math.floor(rand() * 4);
    const stemH = (0.2 + rand() * 0.18) * scale;
    const stem = makeKnobbySegment(rand, stemH, 0.035 * scale, mat);
    stem.position.y = stemH * 0.5;
    stem.rotation.x = (rand() - 0.5) * 0.3;
    group.add(stem);

    for (let i = 0; i < plates; i++) {
        const w = (0.12 + rand() * 0.22) * scale;
        const h = (0.32 + rand() * 0.5) * scale;
        const plate = makeFlatPlate(rand, w, h, mat);
        const angle = (i / plates) * Math.PI * 2 + rand() * 0.45;
        plate.position.set(
            Math.cos(angle) * (0.04 + rand() * 0.08) * scale,
            stemH + h * 0.35,
            Math.sin(angle) * (0.04 + rand() * 0.08) * scale
        );
        plate.rotation.set(
            (rand() - 0.5) * 0.55,
            angle,
            Math.PI * 0.5 + (rand() - 0.5) * 0.75
        );
        group.add(plate);
    }
}

function addMoundCoral(group, mat, rand, scale) {
    const lumps = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < lumps; i++) {
        const mesh = makeJaggedRock(rand, (0.14 + rand() * 0.26) * scale, mat);
        mesh.position.set(
            (rand() - 0.5) * 0.55 * scale,
            (0.08 + rand() * 0.38) * scale,
            (rand() - 0.5) * 0.55 * scale
        );
        group.add(mesh);
    }
}

function addTubeCoral(group, mat, rand, scale) {
    const tubes = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < tubes; i++) {
        const h = (0.18 + rand() * 0.58) * scale;
        const r = (0.022 + rand() * 0.032) * scale;
        const tube = makeKnobbySegment(rand, h, r, mat);
        const angle = (i / tubes) * Math.PI * 2 + rand() * 0.5;
        const radius = (0.06 + rand() * 0.16) * scale;
        tube.position.set(Math.cos(angle) * radius, h * 0.5, Math.sin(angle) * radius);
        tube.rotation.set((rand() - 0.5) * 0.45, rand() * 0.5, (rand() - 0.5) * 0.45);
        group.add(tube);
    }
}

function addMegaFanCluster(group, mat, mat2, rand, scale) {
    const fans = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < fans; i++) {
        const fanGroup = new THREE.Group();
        addFanCoral(fanGroup, i % 2 === 0 ? mat : mat2, rand, 0.9 + rand() * 0.45);
        const angle = (i / fans) * Math.PI * 2 + rand() * 0.35;
        const radius = (0.22 + rand() * 0.18) * scale;
        fanGroup.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        fanGroup.rotation.y = angle + rand() * 0.5;
        group.add(fanGroup);
    }
}

function addTableCoral(group, mat, rand, scale) {
    const stemH = (0.32 + rand() * 0.28) * scale;
    const stem = makeKnobbySegment(rand, stemH, 0.07 * scale, mat);
    stem.position.y = stemH * 0.5;
    stem.rotation.z = (rand() - 0.5) * 0.25;
    group.add(stem);

    const slabs = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < slabs; i++) {
        const slab = makeJaggedRock(rand, (0.14 + rand() * 0.12) * scale, mat);
        slab.scale.set(1.8 + rand(), 0.25 + rand() * 0.2, 1.4 + rand());
        slab.position.set(
            (rand() - 0.5) * 0.22 * scale,
            stemH + (0.02 + rand() * 0.04) * scale,
            (rand() - 0.5) * 0.22 * scale
        );
        slab.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35);
        group.add(slab);
    }
}

function buildFillerColony(rand) {
    const group = new THREE.Group();
    const mat = pickMaterial(rand);
    const scale = 0.75 + rand() * 0.55;
    const roll = rand();

    if (roll < 0.45) {
        addMoundCoral(group, mat, rand, scale);
        if (rand() > 0.4) {
            addTubeCoral(group, mat, rand, scale * 0.75);
        }
    } else if (roll < 0.75) {
        addStaghornCoral(group, mat, rand, scale);
    } else {
        addTubeCoral(group, mat, rand, scale);
        addMoundCoral(group, mat, rand, scale * 0.65);
    }

    group.rotation.y = rand() * Math.PI * 2;
    return group;
}

function buildLargeCoralColony(rand) {
    const group = new THREE.Group();
    const mat = pickMaterial(rand);
    const mat2 = pickMaterial(rand);
    const scale = 2.35 + rand() * 1.15;
    const roll = rand();

    if (roll < 0.34) {
        addBranchCoral(group, mat, rand, scale);
        const offset = new THREE.Group();
        addBranchCoral(offset, mat2, rand, scale * (0.72 + rand() * 0.2));
        offset.position.set((rand() - 0.5) * 0.35 * scale, 0, (rand() - 0.5) * 0.35 * scale);
        offset.rotation.y = rand() * Math.PI * 2;
        group.add(offset);
        addTubeCoral(group, mat, rand, scale * 0.65);
    } else if (roll < 0.58) {
        addMegaFanCluster(group, mat, mat2, rand, scale);
        addMoundCoral(group, mat2, rand, scale * 0.55);
    } else if (roll < 0.78) {
        addTableCoral(group, mat, rand, scale);
        addStaghornCoral(group, mat2, rand, scale * 0.55);
    } else {
        addMoundCoral(group, mat, rand, scale * 1.15);
        const mound2 = new THREE.Group();
        addMoundCoral(mound2, mat2, rand, scale * 0.85);
        mound2.position.set(0.28 * scale, 0, 0.2 * scale);
        group.add(mound2);
        addBranchCoral(group, mat, rand, scale * 0.6);
    }

    group.rotation.y = rand() * Math.PI * 2;
    return group;
}

function buildCoralColony(rand) {
    const group = new THREE.Group();
    const mat = pickMaterial(rand);
    const scale = 1.55 + rand() * 1.35;
    const roll = rand();

    if (roll < 0.3) {
        addBranchCoral(group, mat, rand, scale);
    } else if (roll < 0.48) {
        addStaghornCoral(group, mat, rand, scale);
    } else if (roll < 0.66) {
        addFanCoral(group, mat, rand, scale);
    } else if (roll < 0.84) {
        addMoundCoral(group, mat, rand, scale);
    } else {
        addTubeCoral(group, mat, rand, scale);
    }

    group.rotation.y = rand() * Math.PI * 2;
    return group;
}

/**
 * Submerged coral colonies for Coral Kingdoms.
 */
export class CoralReefStructures {
    /**
     * @param {import('../scene.js').Scene} sceneRef
     * @param {{ lakeMask: THREE.Texture, groundSize?: number, waterY?: number }} options
     */
    constructor(sceneRef, { lakeMask, groundSize = GROUND_SIZE, waterY = 0, bedOffset = REEF_BED_OFFSET }) {
        this.sceneRef = sceneRef;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.bedOffset = bedOffset;
        this.root = null;
        this.colonies = [];
        this.time = 0;
        this._active = false;
    }

    create() {
        this.dispose();

        const root = new THREE.Group();
        root.name = 'coralReefStructures';
        root.visible = false;
        root.frustumCulled = false;
        this.root = root;
        this.colonies = [];
        this.sceneRef.scene.add(root);
    }

    rebuild(lakeMask) {
        if (!this.root) return;

        if (lakeMask) {
            this.lakeMask = lakeMask;
        }

        while (this.root.children.length) {
            const child = this.root.children[0];
            this.root.remove(child);
            child.traverse((node) => {
                if (node.isMesh) {
                    node.geometry?.dispose();
                }
            });
        }
        this.colonies = [];

        const rand = mulberry32(0x4c0a1e91);
        const placedPoints = [];
        let placedLarge = 0;
        let placed = 0;
        let attempts = 0;
        const maxAttempts = (TARGET_COLONIES + TARGET_FILLER_COLONIES + TARGET_LARGE_COLONIES) * 70;

        const placeColony = (colony, x, z, colonyType) => {
            const isLarge = colonyType === 'large';
            colony.position.set(x, this.waterY - this.bedOffset, z);
            fitColonyOnReefBed(colony, this.waterY, this.bedOffset, isLarge
                ? { widthBoost: LARGE_REEF_WIDTH_BOOST, heightFill: LARGE_HEIGHT_FILL }
                : colonyType === 'filler'
                    ? { widthBoost: REEF_WIDTH_BOOST * 0.92, heightFill: HEIGHT_FILL * 0.88 }
                    : undefined);
            attachColonyMeshes(colony);
            this.root.add(colony);
            this.colonies.push({
                group: colony,
                phase: rand() * Math.PI * 2,
                swaySpeed: (isLarge ? 0.28 : colonyType === 'filler' ? 0.42 : 0.35) + rand() * 0.4,
                swayAmp: (isLarge ? 0.01 : colonyType === 'filler' ? 0.012 : 0.015) + rand() * 0.02
            });
            placedPoints.push({ x, z, type: colonyType });
        };

        while (placedLarge < TARGET_LARGE_COLONIES && attempts < maxAttempts) {
            attempts += 1;
            const { x, z } = sampleCoralPoint(rand, this.lakeMask, this.groundSize);
            if (!sampleMaskWater(x, z, this.lakeMask, this.groundSize)) continue;
            if (isOnBoat(x, z)) continue;
            if (!spacingOk(x, z, placedPoints, 'large')) continue;

            placeColony(buildLargeCoralColony(rand), x, z, 'large');
            placedLarge += 1;
        }

        attempts = 0;
        while (placed < TARGET_COLONIES && attempts < maxAttempts) {
            attempts += 1;
            const { x, z } = sampleCoralPoint(rand, this.lakeMask, this.groundSize);

            if (!sampleMaskWater(x, z, this.lakeMask, this.groundSize)) continue;
            if (isOnBoat(x, z)) continue;
            if (!spacingOk(x, z, placedPoints, 'standard')) continue;

            placeColony(buildCoralColony(rand), x, z, 'standard');
            placed += 1;
        }

        let placedFiller = 0;
        attempts = 0;
        while (placedFiller < TARGET_FILLER_COLONIES && attempts < maxAttempts) {
            attempts += 1;
            const { x, z } = sampleCoralPoint(rand, this.lakeMask, this.groundSize);
            if (!sampleMaskWater(x, z, this.lakeMask, this.groundSize)) continue;
            if (isOnBoat(x, z)) continue;
            if (!spacingOk(x, z, placedPoints, 'filler')) continue;

            placeColony(buildFillerColony(rand), x, z, 'filler');
            placedFiller += 1;
        }

        this.setActive(this._active);

        const total = placedLarge + placed + placedFiller;
        if (total === 0) {
            console.warn('[CORAL REEF] No colonies placed — check lake mask / boat bounds');
        } else {
            console.log(`[CORAL REEF] Placed ${total} colonies (${placedLarge} large, ${placed} standard, ${placedFiller} filler)`);
        }
    }

    setActive(active) {
        this._active = active;
        if (this.root) {
            this.root.visible = active && this.colonies.length > 0;
        }
    }

    update(delta) {
        this.time = (this.time || 0) + delta;
        if (!this._active || !this.colonies.length) {
            return;
        }

        for (const colony of this.colonies) {
            const sway = Math.sin(this.time * colony.swaySpeed + colony.phase) * colony.swayAmp;
            colony.group.rotation.z = sway;
            colony.group.rotation.x = sway * 0.45;
        }
    }

    dispose() {
        if (!this.root) return;

        this.sceneRef.scene.remove(this.root);
        this.root.traverse((node) => {
            if (node.isMesh) {
                node.geometry?.dispose();
            }
        });
        this.root = null;
        this.colonies = [];
    }
}
