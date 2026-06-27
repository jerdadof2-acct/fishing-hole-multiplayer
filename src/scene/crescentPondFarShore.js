import * as THREE from 'three';
import { GROUND_SIZE, POND_MASK_PROFILE } from '../buildLakeMask.js';

export const CRESCENT_POND_NAME = 'Crescent Pond';

const MASK_A = POND_MASK_PROFILE.a;
const MASK_B = POND_MASK_PROFILE.b;
const MASK_ROTATE = POND_MASK_PROFILE.rotate;

/** Wide enough that PC landscape / ultrawide never shows side seams. */
const BANK_X_MIN = -130;
const BANK_X_MAX = 130;
/** Pond mask is narrower — clamp shore Z lookup so side wings extrapolate cleanly. */
const SHORE_X_CLAMP = 58;
const LAND_DEPTH = 68;
const BEACH_DEPTH = 5.5;
/** Rear zone that rises into soft rolling hills against the sky. */
const HILL_DEPTH = 26;
const HILL_WIDTH = 272;
/** Green slope begins this far past the beach strip. */
const SLOPE_INSET = 5;
/** Tuck mesh lip under the waterline so the center view has no sky seam. */
const SHORE_WATER_OVERLAP = 1.5;
/** Max rear approach length; also caps how far forward the mesh may extend. */
const TERRAIN_APPROACH_DEPTH = 26;
/** Ignore far wing shore points so sides do not pull terrain into the fishing view. */
const TERRAIN_CENTER_X_LIMIT = 72;
const WATER_SURFACE_Y = 0;

let grassTexture = null;

function getGrassTexture() {
    if (grassTexture) {
        return grassTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#7f9f5e';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1400; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const w = 2 + Math.random() * 6;
        const h = 1 + Math.random() * 5;

        const shade = Math.floor(90 + Math.random() * 45);
        const green = Math.floor(120 + Math.random() * 55);

        ctx.fillStyle = `rgba(${shade}, ${green}, ${65 + Math.random() * 30}, 0.32)`;
        ctx.fillRect(x, y, w, h);
    }

    for (let i = 0; i < 340; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 2 + Math.random() * 7;

        ctx.fillStyle = `rgba(${70 + Math.random() * 35}, ${100 + Math.random() * 35}, ${48 + Math.random() * 25}, 0.2)`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.55 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    grassTexture = new THREE.CanvasTexture(canvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.colorSpace = THREE.SRGBColorSpace;
    grassTexture.anisotropy = 4;

    return grassTexture;
}

function createGrassMaterial({
    tint = 0xffffff,
    repeatX = 8,
    repeatY = 8
} = {}) {
    const map = getGrassTexture().clone();
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeatX, repeatY);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;

    return new THREE.MeshStandardMaterial({
        color: tint,
        map,
        roughness: 0.98,
        metalness: 0
    });
}

function createBankEdgeMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xa89d76,
        roughness: 1,
        metalness: 0
    });
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

/** Furthest +Z on the pond edge for a given X. */
function farShoreZAtX(x) {
    const queryX = Math.max(-SHORE_X_CLAMP, Math.min(SHORE_X_CLAMP, x));

    let lo = 0;
    let hi = 80;

    for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) * 0.5;
        if (isInsideWater(queryX, mid)) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    return lo;
}

function shoreZAtX(x, shorePoints) {
    if (x <= shorePoints[0].x) {
        return shorePoints[0].z;
    }

    if (x >= shorePoints[shorePoints.length - 1].x) {
        return shorePoints[shorePoints.length - 1].z;
    }

    for (let i = 0; i < shorePoints.length - 1; i++) {
        const a = shorePoints[i];
        const b = shorePoints[i + 1];

        if (x >= a.x && x <= b.x) {
            const t = (x - a.x) / (b.x - a.x);
            return a.z + (b.z - a.z) * t;
        }
    }

    return shorePoints[0].z;
}

/** Forward edge of terrain: seals the pond in center view without wing overreach. */
function computeTerrainMeshFrontZ(shorePoints, hillRampStartZ) {
    const centerPoints = shorePoints.filter((point) => Math.abs(point.x) <= TERRAIN_CENTER_X_LIMIT);
    const slopeStarts = centerPoints.map(
        (point) => point.z + BEACH_DEPTH + SLOPE_INSET
    );
    const centerLead = Math.min(...slopeStarts) - SHORE_WATER_OVERLAP;
    const rampLead = hillRampStartZ - TERRAIN_APPROACH_DEPTH;

    return Math.min(centerLead, rampLead);
}

/**
 * One continuous green bank: rises from the water edge, then rolls into hills at the horizon.
 */
function rollingHillHeight(x, z, shorePoints, hillRampStartZ, hillBackZ, landY) {
    const shoreZ = shoreZAtX(x, shorePoints);
    const slopeStartZ = shoreZ + BEACH_DEPTH + SLOPE_INSET;
    const bankTopY = landY + 0.02;

    if (z <= slopeStartZ) {
        return WATER_SURFACE_Y + 0.01;
    }

    if (z < hillRampStartZ) {
        const span = Math.max(hillRampStartZ - slopeStartZ, 0.001);
        const t = (z - slopeStartZ) / span;
        const ease = t * t * (3 - 2 * t);
        const lift = ease * (bankTopY - WATER_SURFACE_Y - 0.01);
        const roll = Math.sin(x * 0.05 + z * 0.018) * 0.032 * ease;
        return WATER_SURFACE_Y + 0.01 + lift + roll;
    }

    const depthSpan = Math.max(hillBackZ - hillRampStartZ, 0.001);
    const t = Math.max(0, Math.min(1, (z - hillRampStartZ) / depthSpan));
    const ramp = t * t * (3 - 2 * t);

    const wave =
        Math.sin(x * 0.034 + 0.55) * 0.62 +
        Math.sin(x * 0.068 + 2.1) * 0.34 +
        Math.sin(x * 0.017 + 1.2) * 0.88 +
        Math.sin(x * 0.095 - 0.35) * 0.22;

    const centerRise = Math.exp(-(x * x) / (48 * 48)) * 0.55;
    const edgeFalloff = 0.72 + 0.28 * Math.exp(-(x * x) / (118 * 118));

    const peak = (1.08 + wave * 1.0 + centerRise) * edgeFalloff;
    return bankTopY + ramp * peak;
}

function createRollingHillsGeometry(
    meshFrontZ,
    shorePoints,
    hillRampStartZ,
    hillBackZ,
    landY
) {
    const meshDepth = hillBackZ - meshFrontZ;
    const segmentsX = 80;
    const segmentsZ = Math.max(18, Math.round(meshDepth * 0.55));

    const geom = new THREE.PlaneGeometry(HILL_WIDTH, meshDepth, segmentsX, segmentsZ);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i) + meshFrontZ + meshDepth * 0.5;

        pos.setY(
            i,
            rollingHillHeight(x, z, shorePoints, hillRampStartZ, hillBackZ, landY)
        );
        pos.setZ(i, z);
    }

    pos.needsUpdate = true;
    geom.computeVertexNormals();

    return geom;
}

function buildFarBankMeshes(landY) {
    const steps = 42;

    const shorePoints = [];
    for (let i = 0; i <= steps; i++) {
        const x = BANK_X_MIN + ((BANK_X_MAX - BANK_X_MIN) * i) / steps;
        shorePoints.push({
            x,
            z: farShoreZAtX(x) + 0.6
        });
    }

    const frontZAverage =
        shorePoints.reduce((sum, point) => sum + point.z, 0) /
        shorePoints.length;

    const hillBackZ = frontZAverage + LAND_DEPTH;
    const hillRampStartZ = hillBackZ - HILL_DEPTH;
    const hillMeshFrontZ = computeTerrainMeshFrontZ(shorePoints, hillRampStartZ);

    const bankShape = new THREE.Shape();
    bankShape.moveTo(shorePoints[0].x, shorePoints[0].z);

    for (let i = 1; i < shorePoints.length; i++) {
        bankShape.lineTo(shorePoints[i].x, shorePoints[i].z);
    }

    for (let i = shorePoints.length - 1; i >= 0; i--) {
        bankShape.lineTo(shorePoints[i].x, shorePoints[i].z + BEACH_DEPTH);
    }

    bankShape.closePath();

    const bankGeom = new THREE.ShapeGeometry(bankShape);
    bankGeom.rotateX(-Math.PI / 2);

    const bank = new THREE.Mesh(bankGeom, createBankEdgeMaterial());
    bank.position.y = landY + 0.015;
    bank.receiveShadow = true;
    bank.renderOrder = 2;

    const hillsGeom = createRollingHillsGeometry(
        hillMeshFrontZ,
        shorePoints,
        hillRampStartZ,
        hillBackZ,
        landY
    );

    const hills = new THREE.Mesh(
        hillsGeom,
        createGrassMaterial({
            tint: 0xa6c27a,
            repeatX: 26,
            repeatY: 14
        })
    );
    hills.material.polygonOffset = true;
    hills.material.polygonOffsetFactor = -2;
    hills.material.polygonOffsetUnits = -2;
    hills.receiveShadow = true;
    hills.renderOrder = 1;

    return { bank, hills };
}

function disposeObject3D(object) {
    object.traverse((obj) => {
        if (obj.geometry) {
            obj.geometry.dispose();
        }

        if (obj.material) {
            const materials = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];

            materials.forEach((material) => {
                if (material.map && material.map !== grassTexture) {
                    material.map.dispose?.();
                }
                material.dispose?.();
            });
        }
    });
}

function populateFarShoreRoot(root) {
    const landY = 0.11;
    const { bank, hills } = buildFarBankMeshes(landY);

    root.add(hills);
    root.add(bank);
}

/**
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
 * Always visible while at Crescent Pond.
 * @param {THREE.Group | null} group
 * @param {number} _portraitBlend
 * @param {boolean} isCrescentPond
 */
export function updateCrescentPondFarShore(group, _portraitBlend, isCrescentPond) {
    if (!group) {
        return;
    }

    group.visible = isCrescentPond === true;
}
