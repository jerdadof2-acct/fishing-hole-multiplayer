import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GROUND_SIZE, LAKE_MASK_PROFILE } from '../buildLakeMask.js';
const MASK_ROTATE = LAKE_MASK_PROFILE.rotate;
const BOAT_CENTER_X = 0;
const BOAT_CENTER_Z = -1.5;

/** Ellipse around the small boat + forward cast lane — keep clear for fishing. */
const CAST_CLEAR_CENTER_X = 0;
const CAST_CLEAR_CENTER_Z = 2.5;
const CAST_CLEAR_RADIUS_X = 11;
const CAST_CLEAR_RADIUS_Z = 30;

const TARGET_TREES_DESKTOP = 52;
const TARGET_TREES_MOBILE = 26;

function getBayouTreeTargetCount() {
    if (typeof navigator === 'undefined') {
        return TARGET_TREES_DESKTOP;
    }

    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
        ? TARGET_TREES_MOBILE
        : TARGET_TREES_DESKTOP;
}
const MIN_TREE_SPACING = 5.2;

const TRUNK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x78624c,
    roughness: 0.78,
    metalness: 0.03,
    envMapIntensity: 1.15
});

const KNEE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x6a5342,
    roughness: 0.84,
    metalness: 0.02,
    envMapIntensity: 1.1
});

const FOLIAGE_LIGHT = new THREE.MeshStandardMaterial({
    color: 0x588858,
    roughness: 0.74,
    metalness: 0.01,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide
});

const FOLIAGE_DARK = new THREE.MeshStandardMaterial({
    color: 0x456848,
    roughness: 0.82,
    metalness: 0.01,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide
});

function mulberry32(seed) {
    let state = seed | 0;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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
    const px = Math.floor(THREE.MathUtils.clamp(uvx, 0, 1) * (lakeMask.image.width - 1));
    const py = Math.floor(THREE.MathUtils.clamp(uvz, 0, 1) * (lakeMask.image.height - 1));
    const ctx = lakeMask.image.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(px, py, 1, 1).data;
    return data[0] / 255 > 0.5;
}

function isOnBoat(x, z) {
    const dz = z - BOAT_CENTER_Z;
    return Math.abs(x) < 4.2 && dz > -6 && dz < 7;
}

function isInCastClearZone(x, z) {
    if (isOnBoat(x, z)) {
        return true;
    }

    const dx = x - CAST_CLEAR_CENTER_X;
    const dz = z - CAST_CLEAR_CENTER_Z;
    const nx = dx / CAST_CLEAR_RADIUS_X;
    const nz = dz / CAST_CLEAR_RADIUS_Z;
    return nx * nx + nz * nz < 1;
}

function isFarEnough(x, z, placed, minDist) {
    for (const point of placed) {
        const dx = x - point.x;
        const dz = z - point.z;
        if (dx * dx + dz * dz < minDist * minDist) {
            return false;
        }
    }
    return true;
}

function distanceFromBoat(x, z) {
    return Math.hypot(x - BOAT_CENTER_X, z - BOAT_CENTER_Z);
}

/** Prefer the ring the fishing camera actually frames — not the far lake edges. */
function sampleCypressPoint(rand, lakeMask, groundSize, placed) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const angle = THREE.MathUtils.lerp(0.12, Math.PI - 0.12, rand());
        const edgeScale = THREE.MathUtils.lerp(1.04, 1.42, rand());
        const outward = THREE.MathUtils.lerp(1.5, 16, rand());

        const x =
            CAST_CLEAR_CENTER_X +
            Math.cos(angle) * CAST_CLEAR_RADIUS_X * edgeScale +
            Math.cos(angle) * outward;
        const z =
            CAST_CLEAR_CENTER_Z +
            Math.sin(angle) * CAST_CLEAR_RADIUS_Z * edgeScale +
            Math.sin(angle) * outward;

        if (!sampleMaskWater(x, z, lakeMask, groundSize)) {
            continue;
        }
        if (isInCastClearZone(x, z)) {
            continue;
        }
        if (!isFarEnough(x, z, placed, MIN_TREE_SPACING)) {
            continue;
        }

        const distFromBoat = distanceFromBoat(x, z);
        if (distFromBoat < 13 || distFromBoat > 58) {
            continue;
        }

        return { x, z };
    }

    const spanX = groundSize * 0.36;
    const spanZ = groundSize * 0.3;

    for (let attempt = 0; attempt < 40; attempt++) {
        const x = THREE.MathUtils.lerp(-spanX, spanX, rand());
        const z = THREE.MathUtils.lerp(-spanZ, spanZ, rand());

        if (!sampleMaskWater(x, z, lakeMask, groundSize)) {
            continue;
        }
        if (isInCastClearZone(x, z)) {
            continue;
        }
        if (!isFarEnough(x, z, placed, MIN_TREE_SPACING)) {
            continue;
        }

        return { x, z };
    }

    return null;
}

function createFeatherCluster(random, material, scale = 1) {
    const group = new THREE.Group();
    group.name = 'cypressFoliage';

    // Bald-cypress foliage grows in soft, flattened sprays rather than round clumps.
    const sprayGeometry = new THREE.SphereGeometry(0.5, 7, 5);
    sprayGeometry.scale(2.15 * scale, 0.22 * scale, 0.72 * scale);

    const count = 6 + Math.floor(random() * 5);
    for (let i = 0; i < count; i++) {
        const spray = new THREE.Mesh(sprayGeometry, material);
        spray.position.set(
            THREE.MathUtils.lerp(-0.75, 0.75, random()) * scale,
            THREE.MathUtils.lerp(-0.22, 0.22, random()) * scale,
            THREE.MathUtils.lerp(-0.5, 0.5, random()) * scale
        );
        spray.rotation.set(
            THREE.MathUtils.lerp(-0.18, 0.18, random()),
            random() * Math.PI * 2,
            THREE.MathUtils.lerp(-0.12, 0.12, random())
        );
        spray.scale.set(
            THREE.MathUtils.lerp(0.8, 1.25, random()),
            THREE.MathUtils.lerp(0.78, 1.12, random()),
            THREE.MathUtils.lerp(0.8, 1.15, random())
        );
        group.add(spray);
    }

    return group;
}

function addCylinderBetween(group, start, end, radiusStart, radiusEnd, material, radialSegments = 7) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.001) {
        return null;
    }

    const geometry = new THREE.CylinderGeometry(
        radiusEnd,
        radiusStart,
        length,
        radialSegments,
        1,
        false
    );

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
    );
    group.add(mesh);
    return mesh;
}

function createContinuousTrunkGeometry({
    trunkHeight,
    trunkRadius,
    waterLevel,
    leanX,
    leanZ,
    radialSegments = 12,
    heightSegments = 18
}) {
    const positions = [];
    const uvs = [];
    const indices = [];

    function trunkProfile(t) {
        // Broad submerged base that eases into the normal trunk over a long span.
        const buttressTransition = 1.5 * Math.exp(-t * 7.0);
        const mainTaper = THREE.MathUtils.lerp(1.1, 0.34, Math.pow(t, 0.8));
        return trunkRadius * (mainTaper + buttressTransition);
    }

    for (let yIndex = 0; yIndex <= heightSegments; yIndex++) {
        const t = yIndex / heightSegments;
        const y = waterLevel - 0.12 + t * (trunkHeight + 0.12);
        const radius = trunkProfile(t);

        const centerX =
            leanX * t * t +
            Math.sin(t * Math.PI * 2.2) * 0.018;
        const centerZ =
            leanZ * t * t +
            Math.cos(t * Math.PI * 1.8) * 0.016;

        for (let side = 0; side < radialSegments; side++) {
            const angle = (side / radialSegments) * Math.PI * 2;

            // Build the vertical bark flutes directly into the trunk surface.
            // They are strongest at the swollen base and fade naturally upward,
            // so they can never separate from the wood.
            const lowerFluteFade = Math.exp(-t * 2.8);
            const broadFlutes =
                Math.sin(angle * 7 + t * 0.55) * 0.11 * lowerFluteFade;
            const secondaryFlutes =
                Math.sin(angle * 14 - t * 0.35) * 0.035 * lowerFluteFade;
            const subtleUpperBark =
                Math.sin(angle * 5 + t * 4.4) * 0.018;

            const surfaceScale =
                1 +
                broadFlutes +
                secondaryFlutes +
                subtleUpperBark;

            positions.push(
                centerX + Math.cos(angle) * radius * surfaceScale,
                y,
                centerZ + Math.sin(angle) * radius * surfaceScale
            );

            // Match the UV attribute used by THREE.CylinderGeometry so this
            // custom trunk can be merged with the buttresses and branches.
            uvs.push(
                side / radialSegments,
                t
            );
        }
    }

    for (let yIndex = 0; yIndex < heightSegments; yIndex++) {
        const row = yIndex * radialSegments;
        const nextRow = (yIndex + 1) * radialSegments;

        for (let side = 0; side < radialSegments; side++) {
            const nextSide = (side + 1) % radialSegments;

            const a = row + side;
            const b = row + nextSide;
            const c = nextRow + side;
            const d = nextRow + nextSide;

            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }

    // Cap only the top. The bottom remains open below the waterline.
    const topCenterIndex = positions.length / 3;
    const topT = 1;
    positions.push(
        leanX * topT * topT + Math.sin(topT * Math.PI * 2.2) * 0.018,
        waterLevel + trunkHeight,
        leanZ * topT * topT + Math.cos(topT * Math.PI * 1.8) * 0.016
    );
    uvs.push(0.5, 1);

    const topRow = heightSegments * radialSegments;
    for (let side = 0; side < radialSegments; side++) {
        const nextSide = (side + 1) % radialSegments;
        indices.push(topRow + side, topCenterIndex, topRow + nextSide);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(uvs, 2)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

function addButtressFlare(tree, random, waterLevel, trunkRadius) {
    // Keep the buttress forms low and broad so they read as extensions of the
    // same trunk instead of separate tapered pieces attached to it.
    const buttressCount = 7 + Math.floor(random() * 3);
    const flareHeight = THREE.MathUtils.lerp(1.0, 1.45, random());
    const baseRadius = trunkRadius * THREE.MathUtils.lerp(3.1, 3.9, random());

    for (let i = 0; i < buttressCount; i++) {
        const angle =
            (i / buttressCount) * Math.PI * 2 +
            THREE.MathUtils.lerp(-0.1, 0.1, random());

        const lobeWidth = THREE.MathUtils.lerp(0.5, 0.72, random());
        const outward = baseRadius * THREE.MathUtils.lerp(0.75, 1.05, random());

        // The upper radius now meets the enlarged lower-trunk profile.
        const topRadius = trunkRadius * THREE.MathUtils.lerp(1.12, 1.34, random());
        const bottomRadius = trunkRadius * THREE.MathUtils.lerp(1.65, 2.1, random());

        const buttress = new THREE.Mesh(
            new THREE.CylinderGeometry(
                topRadius,
                bottomRadius,
                flareHeight,
                7,
                3,
                false
            ),
            TRUNK_MATERIAL
        );

        buttress.position.set(
            Math.cos(angle) * outward * 0.24,
            waterLevel + flareHeight * 0.5 - 0.1,
            Math.sin(angle) * outward * 0.24
        );
        buttress.scale.set(lobeWidth, 1, 1);
        buttress.rotation.y = -angle;
        buttress.rotation.z = Math.cos(angle) * THREE.MathUtils.lerp(-0.045, 0.045, random());
        buttress.rotation.x = Math.sin(angle) * THREE.MathUtils.lerp(-0.045, 0.045, random());
        tree.add(buttress);

        const rootStart = new THREE.Vector3(
            Math.cos(angle) * trunkRadius * 0.85,
            waterLevel + 0.15,
            Math.sin(angle) * trunkRadius * 0.85
        );
        const rootEnd = new THREE.Vector3(
            Math.cos(angle) * outward,
            waterLevel + THREE.MathUtils.lerp(0.02, 0.08, random()),
            Math.sin(angle) * outward
        );

        addCylinderBetween(
            tree,
            rootStart,
            rootEnd,
            trunkRadius * THREE.MathUtils.lerp(0.42, 0.58, random()),
            trunkRadius * THREE.MathUtils.lerp(0.12, 0.2, random()),
            KNEE_MATERIAL,
            6
        );
    }
}

function addCypressKnees(tree, random, waterLevel, trunkRadius) {
    const kneeCount = 7 + Math.floor(random() * 7);

    for (let i = 0; i < kneeCount; i++) {
        const angle =
            (i / kneeCount) * Math.PI * 2 +
            THREE.MathUtils.lerp(-0.35, 0.35, random());

        const distance = trunkRadius * THREE.MathUtils.lerp(3.0, 7.2, random());
        const kneeHeight = THREE.MathUtils.lerp(0.28, 0.9, random());
        const kneeRadius = THREE.MathUtils.lerp(0.09, 0.18, random());

        // Two stacked tapered sections make the knees rounded and irregular,
        // rather than looking like identical sharp cones.
        const lower = new THREE.Mesh(
            new THREE.CylinderGeometry(
                kneeRadius * 0.72,
                kneeRadius * 1.3,
                kneeHeight * 0.62,
                7
            ),
            KNEE_MATERIAL
        );
        lower.position.set(
            Math.cos(angle) * distance,
            waterLevel + kneeHeight * 0.27,
            Math.sin(angle) * distance
        );
        lower.rotation.z = THREE.MathUtils.lerp(-0.12, 0.12, random());
        lower.rotation.x = THREE.MathUtils.lerp(-0.12, 0.12, random());
        tree.add(lower);

        const upper = new THREE.Mesh(
            new THREE.CylinderGeometry(
                kneeRadius * 0.18,
                kneeRadius * 0.72,
                kneeHeight * 0.48,
                7
            ),
            KNEE_MATERIAL
        );
        upper.position.set(
            lower.position.x + THREE.MathUtils.lerp(-0.03, 0.03, random()),
            waterLevel + kneeHeight * 0.7,
            lower.position.z + THREE.MathUtils.lerp(-0.03, 0.03, random())
        );
        upper.rotation.copy(lower.rotation);
        tree.add(upper);
    }
}

function addCypressBranch(tree, random, start, angle, length, radius, rise = 0.2) {
    const bend = THREE.MathUtils.lerp(-0.18, 0.18, random());
    const middle = new THREE.Vector3(
        start.x + Math.cos(angle) * length * 0.54,
        start.y + rise * length * 0.45 + bend,
        start.z + Math.sin(angle) * length * 0.54
    );
    const end = new THREE.Vector3(
        start.x + Math.cos(angle + bend * 0.25) * length,
        start.y + rise * length,
        start.z + Math.sin(angle + bend * 0.25) * length
    );

    addCylinderBetween(tree, start, middle, radius, radius * 0.62, TRUNK_MATERIAL, 7);
    addCylinderBetween(tree, middle, end, radius * 0.62, radius * 0.18, TRUNK_MATERIAL, 6);

    return end;
}

/**
 * One swamp-grown bald cypress with a buttressed trunk, integrated bark
 * flutes, cypress knees, sparse limbs and flattened foliage sprays.
 */
export function createCypressTree({
    scale = 1,
    waterLevel = 0,
    seed = 1
} = {}) {
    const random = mulberry32(seed);
    const tree = new THREE.Group();
    tree.name = 'cypressTree';

    const trunkHeight = THREE.MathUtils.lerp(7.0, 11.5, random());
    const trunkRadius = THREE.MathUtils.lerp(0.28, 0.46, random());
    const leanX = THREE.MathUtils.lerp(-0.22, 0.22, random());
    const leanZ = THREE.MathUtils.lerp(-0.18, 0.18, random());

    addButtressFlare(tree, random, waterLevel, trunkRadius);
    addCypressKnees(tree, random, waterLevel, trunkRadius);

    // Build the entire trunk as one connected mesh. This removes the
    // horizontal caps and rings created by stacking separate cylinders.
    const trunk = new THREE.Mesh(
        createContinuousTrunkGeometry({
            trunkHeight,
            trunkRadius,
            waterLevel,
            leanX,
            leanZ,
            radialSegments: 18,
            heightSegments: 22
        }),
        TRUNK_MATERIAL
    );
    trunk.name = 'cypressContinuousTrunk';
    tree.add(trunk);

    // The vertical bark flutes are part of the trunk mesh itself, so no
    // separate ridge geometry is needed.

    // Bald cypress crowns are irregular, with horizontal and slightly drooping limbs.
    const branchCount = 7 + Math.floor(random() * 5);
    const crownStart = trunkHeight * THREE.MathUtils.lerp(0.5, 0.61, random());

    for (let i = 0; i < branchCount; i++) {
        const level = i / Math.max(1, branchCount - 1);
        const branchY = waterLevel + crownStart + level * (trunkHeight - crownStart) * 0.78;
        const angle = i * 2.399963 + THREE.MathUtils.lerp(-0.38, 0.38, random());
        const length = THREE.MathUtils.lerp(1.15, 2.45, random()) * THREE.MathUtils.lerp(1.05, 0.55, level);
        const radius = trunkRadius * THREE.MathUtils.lerp(0.34, 0.17, level);

        const trunkT = (branchY - waterLevel) / trunkHeight;
        const start = new THREE.Vector3(
            leanX * trunkT * trunkT,
            branchY,
            leanZ * trunkT * trunkT
        );

        const end = addCypressBranch(
            tree,
            random,
            start,
            angle,
            length,
            radius,
            THREE.MathUtils.lerp(-0.08, 0.24, random())
        );

        const isUpperBranch = branchY > waterLevel + trunkHeight * 0.45;
        const foliageMat = isUpperBranch
            ? (random() > 0.18 ? FOLIAGE_LIGHT : FOLIAGE_DARK)
            : (random() > 0.42 ? FOLIAGE_LIGHT : FOLIAGE_DARK);

        const foliage = createFeatherCluster(
            random,
            foliageMat,
            THREE.MathUtils.lerp(0.72, 1.12, random())
        );
        foliage.position.copy(end);
        foliage.rotation.y = angle;
        tree.add(foliage);

        if (random() > 0.38) {
            const innerFoliage = createFeatherCluster(
                random,
                random() > 0.35 ? FOLIAGE_LIGHT : FOLIAGE_DARK,
                THREE.MathUtils.lerp(0.42, 0.68, random())
            );
            innerFoliage.position.lerpVectors(start, end, THREE.MathUtils.lerp(0.48, 0.7, random()));
            innerFoliage.rotation.y = angle + random() * 0.5;
            tree.add(innerFoliage);
        }
    }

    // Broken, uneven leader at the top instead of a perfectly rounded crown.
    const top = new THREE.Vector3(
        leanX,
        waterLevel + trunkHeight,
        leanZ
    );
    const topCluster = createFeatherCluster(random, FOLIAGE_LIGHT, 0.7);
    topCluster.position.copy(top);
    topCluster.rotation.y = random() * Math.PI * 2;
    tree.add(topCluster);

    tree.scale.setScalar(scale);
    tree.userData.trunkHeight = trunkHeight;
    optimizeCypressTree(tree);
    return tree;
}

function optimizeCypressTree(tree) {
    tree.updateMatrixWorld(true);

    const inverseTreeWorld = tree.matrixWorld.clone().invert();
    const materialBuckets = new Map();
    const sourceMeshes = [];

    tree.traverse((object) => {
        if (!object.isMesh || !object.geometry || !object.material) {
            return;
        }

        sourceMeshes.push(object);
        const materialKey = object.material.uuid;

        if (!materialBuckets.has(materialKey)) {
            materialBuckets.set(materialKey, {
                material: object.material,
                geometries: [],
                isLeaf: object.parent?.name === 'cypressFoliage'
            });
        }

        const localMatrix = inverseTreeWorld.clone().multiply(object.matrixWorld);
        const geometry = object.geometry.clone();
        geometry.applyMatrix4(localMatrix);
        materialBuckets.get(materialKey).geometries.push(geometry);
    });

    if (sourceMeshes.length < 2) {
        return;
    }

    for (const mesh of sourceMeshes) {
        mesh.parent?.remove(mesh);
    }

    for (let index = tree.children.length - 1; index >= 0; index--) {
        const child = tree.children[index];
        if (!child.isMesh) {
            tree.remove(child);
        }
    }

    for (const bucket of materialBuckets.values()) {
        const mergedGeometry = mergeGeometries(bucket.geometries, false);
        for (const geometry of bucket.geometries) {
            geometry.dispose();
        }
        if (!mergedGeometry) {
            continue;
        }

        mergedGeometry.computeVertexNormals();
        const mergedMesh = new THREE.Mesh(mergedGeometry, bucket.material);
        mergedMesh.name = bucket.isLeaf ? 'cypressLeavesMerged' : 'cypressWoodMerged';
        mergedMesh.castShadow = true;
        mergedMesh.receiveShadow = !bucket.isLeaf;
        tree.add(mergedMesh);
    }
}

/**
 * Scatter cypress trees across the bayou water, leaving the cast lane clear.
 */
export function buildBayouCypressScenery({
    waterLevel = 0,
    lakeMask = null,
    groundSize = GROUND_SIZE,
    seed = 12042
} = {}) {
    const root = new THREE.Group();
    root.name = 'bayouCypress';

    const rand = mulberry32(seed);
    const placed = [];
    const trees = [];

    for (let i = 0; i < getBayouTreeTargetCount(); i++) {
        const point = sampleCypressPoint(rand, lakeMask, groundSize, placed);
        if (!point) {
            continue;
        }

        placed.push(point);

        const dist = Math.hypot(point.x, point.z);
        const edgeBias = THREE.MathUtils.smoothstep(dist, 8, 42);
        const scale = THREE.MathUtils.lerp(0.72, 1.18, rand()) * THREE.MathUtils.lerp(0.88, 1.05, edgeBias);

        const tree = createCypressTree({
            scale,
            waterLevel,
            seed: Math.floor(seed + i * 97.13 + rand() * 1000)
        });

        tree.position.set(point.x, 0, point.z);
        tree.rotation.y = rand() * Math.PI * 2;
        root.add(tree);
        trees.push(tree);
    }

    root.userData.cypressTrees = trees;
    return root;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} waterLevel
 * @param {THREE.Texture} lakeMask
 */
export function createBayouCypress(scene, waterLevel = 0, lakeMask = null) {
    const root = buildBayouCypressScenery({ waterLevel, lakeMask });
    root.visible = false;
    scene.add(root);
    return root;
}

/**
 * @param {THREE.Group | null} group
 * @param {boolean} visible
 */
export function syncBayouCypressVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}

const _cameraToTarget = new THREE.Vector3();
const _cameraToTree = new THREE.Vector3();
const _treeWorldPosition = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();

export function updateBayouCypressCameraObstruction(group, camera, targetPosition, isBayou) {
    if (!group) {
        return;
    }

    const trees = group.userData.cypressTrees || [];

    if (!isBayou) {
        for (const tree of trees) {
            tree.visible = true;
        }
        return;
    }

    if (!camera || !targetPosition) {
        return;
    }

    _cameraToTarget.copy(targetPosition).sub(camera.position);
    const targetDistance = _cameraToTarget.length();
    if (targetDistance <= 0.001) {
        return;
    }

    _cameraToTarget.normalize();

    for (const tree of trees) {
        tree.getWorldPosition(_treeWorldPosition);
        _cameraToTree.copy(_treeWorldPosition).sub(camera.position);
        const distanceAlongView = _cameraToTree.dot(_cameraToTarget);

        if (distanceAlongView <= 0 || distanceAlongView >= targetDistance) {
            tree.visible = true;
            continue;
        }

        _closestPoint.copy(camera.position).addScaledVector(_cameraToTarget, distanceAlongView);
        tree.visible = _closestPoint.distanceTo(_treeWorldPosition) > 1.55;
    }
}
