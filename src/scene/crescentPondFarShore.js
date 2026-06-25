import * as THREE from 'three';
import { GROUND_SIZE, POND_MASK_PROFILE } from '../buildLakeMask.js';
import { applyRockyGroundToMesh } from './farShoreGroundTextures.js';

export const CRESCENT_POND_NAME = 'Crescent Pond';

const MASK_A = POND_MASK_PROFILE.a;
const MASK_B = POND_MASK_PROFILE.b;
const MASK_ROTATE = POND_MASK_PROFILE.rotate;

const FOLIAGE_COLORS = [0x2d5a34, 0x356b3f, 0x3a7544];
const TRUNK_COLOR = 0x4a3528;

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

function createFoliageMaterial(color) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0,
        flatShading: true
    });
}

function createTrunkMaterial() {
    return new THREE.MeshStandardMaterial({
        color: TRUNK_COLOR,
        roughness: 0.88,
        metalness: 0,
        flatShading: true
    });
}

function makePineTree(scale = 1, foliageIndex = 0) {
    const tree = new THREE.Group();
    const h = 4.2 * scale;
    const trunkH = h * 0.38;

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 * scale, 0.11 * scale, trunkH, 6),
        createTrunkMaterial()
    );
    trunk.position.y = trunkH * 0.5;
    tree.add(trunk);

    const layers = [
        { r: 0.95, h: 0.55, y: trunkH + 0.15 * scale },
        { r: 0.75, h: 0.5, y: trunkH + 0.65 * scale },
        { r: 0.52, h: 0.45, y: trunkH + 1.1 * scale }
    ];

    layers.forEach((layer, i) => {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(layer.r * scale, layer.h * h, 7),
            createFoliageMaterial(FOLIAGE_COLORS[(foliageIndex + i) % FOLIAGE_COLORS.length])
        );
        cone.position.y = layer.y;
        tree.add(cone);
    });

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
    applyRockyGroundToMesh(land, 0x8a9a7a, 3.0);
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
    applyRockyGroundToMesh(beach, 0xa89878, 2.4);
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
                if (mat.map) mat.map.dispose();
                if (mat.normalMap) mat.normalMap.dispose();
                if (mat.roughnessMap) mat.roughnessMap.dispose();
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
