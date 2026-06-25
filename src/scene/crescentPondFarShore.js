import * as THREE from 'three';
import { GROUND_SIZE, POND_MASK_PROFILE } from '../buildLakeMask.js';
import { applyShoreRockToMesh } from './shoreRockMaterial.js';
import { createPineTrunkMaterial, createPineFoliageMaterial } from './pineTreeMaterials.js';

export const CRESCENT_POND_NAME = 'Crescent Pond';

const MASK_A = POND_MASK_PROFILE.a;
const MASK_B = POND_MASK_PROFILE.b;
const MASK_ROTATE = POND_MASK_PROFILE.rotate;

const FOLIAGE_COLORS = [0x4f9a58, 0x5aad64, 0x64ba6e];

const PORTRAIT_FADE_START = 0.15;
const PORTRAIT_FADE_END = 0.75;

/** Far bank spans the pond arc (not lake-wide). */
const BANK_X_MIN = -48;
const BANK_X_MAX = 48;
const LAND_DEPTH = 50;
const BEACH_DEPTH = 6;

/** Dense treeline on the opposite bank. */
const TREE_X_STEP = 5.5;
const TREE_Z_STEP = 4.2;
const TREE_ALONG_MIN = 6;
const TREE_ALONG_MAX = 42;
const TREE_KEEP_CHANCE = 0.88;

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

function isInsideWater(x, z) {
    const u = x / GROUND_SIZE + 0.5;
    const v = 1.0 - (z / GROUND_SIZE + 0.5);
    const du = u - 0.5;
    const dv = v - 0.5;
    const cos = Math.cos(-MASK_ROTATE);
    const sin = Math.sin(-MASK_ROTATE);
    const eu = du * cos - dv * sin;
    const ev = du * sin + dv * cos;
    return (eu / MASK_A) ** 2 + (ev / MASK_B) ** 2 < 1;
}

/** Furthest +Z on the pond edge for a given X (matches pond lake mask). */
function farShoreZAtX(x) {
    let lo = 0;
    let hi = 80;
    for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) * 0.5;
        if (isInsideWater(x, mid)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return lo;
}

function scatterFarBankTrees() {
    const rand = mulberry32(0x0c2e5c01);
    const trees = [];
    let rowIndex = 0;

    for (let along = TREE_ALONG_MIN; along <= TREE_ALONG_MAX; along += TREE_Z_STEP) {
        const rowOffset = (rowIndex % 2) * (TREE_X_STEP * 0.5);
        rowIndex += 1;

        for (let x = BANK_X_MIN + rowOffset; x <= BANK_X_MAX; x += TREE_X_STEP) {
            if (rand() > TREE_KEEP_CHANCE) continue;

            const jx = x + (rand() - 0.5) * 2.6;
            const jAlong = along + (rand() - 0.5) * 2.2;
            const shoreZ = farShoreZAtX(jx);
            const depthFactor = jAlong / TREE_ALONG_MAX;
            const scale = 0.72 + rand() * 0.78 - depthFactor * 0.08;

            trees.push({
                x: jx,
                z: shoreZ + jAlong,
                scale,
                rot: (rand() - 0.5) * 0.65,
                foliageIndex: Math.floor(rand() * 12)
            });
        }
    }

    return trees;
}

function jitterConeGeometry(geometry, rand, amount) {
    const pos = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    let maxY = -Infinity;

    for (let i = 0; i < pos.count; i++) {
        vertex.fromBufferAttribute(pos, i);
        if (vertex.y > maxY) maxY = vertex.y;
    }

    for (let i = 0; i < pos.count; i++) {
        vertex.fromBufferAttribute(pos, i);
        const heightT = maxY > 0 ? vertex.y / maxY : 0;
        const edgeBias = 1.0 - heightT * 0.55;
        const jitter = amount * edgeBias;

        vertex.x += (rand() - 0.5) * jitter * 2.2;
        vertex.z += (rand() - 0.5) * jitter * 2.2;
        if (heightT > 0.35) {
            vertex.y += (rand() - 0.5) * jitter * 0.65;
        }
        pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
}

function addFoliageClump(parent, options) {
    const {
        x,
        y,
        z,
        radius,
        height,
        material,
        rand,
        jitter = 0.1
    } = options;

    const segments = 7 + Math.floor(rand() * 5);
    const rings = 2 + Math.floor(rand() * 2);
    const geometry = new THREE.ConeGeometry(radius, height, segments, rings);
    jitterConeGeometry(geometry, rand, jitter);

    const clump = new THREE.Mesh(geometry, material);
    clump.position.set(x, y, z);
    clump.rotation.y = rand() * Math.PI * 2;
    clump.rotation.z = (rand() - 0.5) * 0.18;
    clump.rotation.x = (rand() - 0.5) * 0.12;
    clump.scale.set(
        0.82 + rand() * 0.38,
        0.88 + rand() * 0.28,
        0.82 + rand() * 0.38
    );
    parent.add(clump);
}

function makePineTree(scale = 1, foliageIndex = 0) {
    const tree = new THREE.Group();
    const h = 4.2 * scale;
    const trunkH = h * 0.36;
    const rand = mulberry32(0x5a1c0031 + foliageIndex * 97);

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, trunkH, 8),
        createPineTrunkMaterial({ repeatV: 1.6 + rand() * 0.8 })
    );
    trunk.position.y = trunkH * 0.5;
    trunk.rotation.z = (rand() - 0.5) * 0.05;
    tree.add(trunk);

    const tierCount = 5;
    for (let tier = 0; tier < tierCount; tier++) {
        const tierT = tier / Math.max(1, tierCount - 1);
        const baseY = trunkH + (0.08 + tier * 0.2) * h;
        const tierRadius = (0.88 - tierT * 0.52 + (rand() - 0.5) * 0.1) * scale;
        const tierHeight = (0.34 - tierT * 0.08 + (rand() - 0.5) * 0.04) * h;
        const tint = FOLIAGE_COLORS[(foliageIndex + tier) % FOLIAGE_COLORS.length];
        const material = createPineFoliageMaterial(tint, {
            repeat: 1.8 + rand() * 1.4,
            variation: rand() - 0.5
        });

        const clumpCount = tier < 2 ? 3 : 2;
        for (let c = 0; c < clumpCount; c++) {
            const angle = rand() * Math.PI * 2;
            const spread = (0.06 + tierT * 0.14) * scale;
            const dist = rand() * spread;
            addFoliageClump(tree, {
                x: Math.cos(angle) * dist,
                y: baseY + (rand() - 0.5) * 0.06 * h,
                z: Math.sin(angle) * dist,
                radius: tierRadius * (0.72 + rand() * 0.45),
                height: tierHeight * (0.8 + rand() * 0.35),
                material,
                rand,
                jitter: 0.08 * scale + tierT * 0.04
            });
        }
    }

    const tipTint = FOLIAGE_COLORS[(foliageIndex + tierCount) % FOLIAGE_COLORS.length];
    addFoliageClump(tree, {
        x: (rand() - 0.5) * 0.08 * scale,
        y: trunkH + 1.02 * h,
        z: (rand() - 0.5) * 0.08 * scale,
        radius: 0.28 * scale * (0.85 + rand() * 0.3),
        height: 0.22 * h * (0.9 + rand() * 0.25),
        material: createPineFoliageMaterial(tipTint, {
            repeat: 2.2 + rand(),
            variation: rand() - 0.5
        }),
        rand,
        jitter: 0.06 * scale
    });

    tree.rotation.z = (rand() - 0.5) * 0.07;
    return tree;
}

function buildFarBankMeshes(landY) {
    const steps = 32;
    const landDepth = LAND_DEPTH;
    const beachDepth = BEACH_DEPTH;

    const shorePoints = [];
    for (let i = 0; i <= steps; i++) {
        const x = BANK_X_MIN + ((BANK_X_MAX - BANK_X_MIN) * i) / steps;
        shorePoints.push({ x, z: farShoreZAtX(x) + 0.6 });
    }

    const landShape = new THREE.Shape();
    landShape.moveTo(shorePoints[0].x, shorePoints[0].z);
    for (let i = 1; i < shorePoints.length; i++) {
        landShape.lineTo(shorePoints[i].x, shorePoints[i].z);
    }
    const backZ = shorePoints[shorePoints.length - 1].z + landDepth;
    const backZStart = shorePoints[0].z + landDepth;
    landShape.lineTo(shorePoints[shorePoints.length - 1].x, backZ);
    landShape.lineTo(shorePoints[0].x, backZStart);
    landShape.closePath();

    const landGeom = new THREE.ShapeGeometry(landShape);
    landGeom.rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(landGeom);
    applyShoreRockToMesh(land, 0x7a6a58, 2.6);
    land.position.y = landY;
    land.renderOrder = 2;

    const beachShape = new THREE.Shape();
    beachShape.moveTo(shorePoints[0].x, shorePoints[0].z);
    for (let i = 1; i < shorePoints.length; i++) {
        beachShape.lineTo(shorePoints[i].x, shorePoints[i].z);
    }
    for (let i = shorePoints.length - 1; i >= 0; i--) {
        beachShape.lineTo(shorePoints[i].x, shorePoints[i].z + beachDepth);
    }
    beachShape.closePath();

    const beachGeom = new THREE.ShapeGeometry(beachShape);
    beachGeom.rotateX(-Math.PI / 2);
    const beach = new THREE.Mesh(beachGeom);
    applyShoreRockToMesh(beach, 0x8f7d68, 2.2);
    beach.position.y = landY - 0.02;
    beach.renderOrder = 2;

    return { land, beach };
}

function disposeObject3D(object) {
    object.traverse((obj) => {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((mat) => {
                if (mat.map && !mat.userData?.sharedMaps) mat.map.dispose();
                if (mat.normalMap && !mat.userData?.sharedMaps) mat.normalMap.dispose();
                if (mat.roughnessMap && !mat.userData?.sharedMaps) mat.roughnessMap.dispose();
                mat.dispose();
            });
        }
    });
}

function collectOpacityMeshes(root) {
    const opacityMeshes = [];
    root.traverse((obj) => {
        if (obj.isMesh && obj.material) {
            opacityMeshes.push(obj);
        }
    });
    root.userData.opacityMeshes = opacityMeshes;
}

function populateFarShoreRoot(root) {
    const landY = 0.11;
    const { land, beach } = buildFarBankMeshes(landY);
    root.add(land);
    root.add(beach);

    const treePlacements = scatterFarBankTrees();
    treePlacements.forEach((slot, index) => {
        const tree = makePineTree(slot.scale ?? 1, slot.foliageIndex ?? index);
        tree.position.set(slot.x, landY, slot.z);
        if (slot.rot) {
            tree.rotation.y = slot.rot;
        }
        root.add(tree);
    });

    collectOpacityMeshes(root);
}

/**
 * Far bank of Crescent Pond — land + trees across the water from the dock.
 * Only meant to read during idle portrait (fades with portrait blend).
 * @param {THREE.Scene} scene
 * @returns {THREE.Group}
 */
export function createCrescentPondFarShore(scene) {
    const root = new THREE.Group();
    root.name = 'crescentPondFarShore';
    root.visible = false;
    populateFarShoreRoot(root);
    scene.add(root);
    return root;
}

/**
 * Rebuild far-bank geometry after the pond shoreline mask changes.
 * @param {THREE.Scene} scene
 * @param {THREE.Group | null} group
 * @returns {THREE.Group}
 */
export function rebuildCrescentPondFarShore(scene, group) {
    if (!group) {
        return createCrescentPondFarShore(scene);
    }

    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject3D(child);
    }

    populateFarShoreRoot(group);
    return group;
}

export function isCrescentPondLocation(locations) {
    return locations?.getCurrentLocation?.()?.name === CRESCENT_POND_NAME;
}

/**
 * Fade far bank in with portrait camera blend (Crescent Pond only).
 * @param {THREE.Group | null} group
 * @param {number} portraitBlend
 * @param {boolean} isCrescentPond
 */
export function updateCrescentPondFarShore(group, portraitBlend, isCrescentPond) {
    if (!group) return;

    const active = isCrescentPond && portraitBlend > PORTRAIT_FADE_START;
    if (!active) {
        group.visible = false;
        return;
    }

    group.visible = true;
    const t = Math.min(
        1,
        (portraitBlend - PORTRAIT_FADE_START) / (PORTRAIT_FADE_END - PORTRAIT_FADE_START)
    );

    const meshes = group.userData.opacityMeshes;
    if (!meshes) return;

    for (let i = 0; i < meshes.length; i++) {
        const mat = meshes[i].material;
        if (!mat) continue;
        mat.transparent = t < 0.98;
        mat.opacity = t;
        mat.depthWrite = t > 0.5;
    }
}
