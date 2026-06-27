import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Matches stylizedDock.js dock group placement. */
const DOCK_GROUP_Z = -1.5;
const DOCK_WIDTH = 3;
const DOCK_DEPTH = 14;

/**
 * Creates one stylized mangrove tree (procedural geometry only).
 */
export function createMangrove(options = {}) {
    const {
        scale = 1,
        trunkColor = 0x66513c,
        rootColor = 0x554431,
        leafColor = 0x39774b,
        darkLeafColor = 0x245b38,
        waterLevel = 0,
        seed = Math.random() * 10000
    } = options;

    const random = seededRandom(seed);
    const mangrove = new THREE.Group();

    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: trunkColor,
        roughness: 0.95,
        metalness: 0
    });

    const rootMaterial = new THREE.MeshStandardMaterial({
        color: rootColor,
        roughness: 1
    });

    const leafMaterial = new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: 0.9,
        side: THREE.DoubleSide
    });

    const darkLeafMaterial = new THREE.MeshStandardMaterial({
        color: darkLeafColor,
        roughness: 0.95,
        side: THREE.DoubleSide
    });

    const trunkHeight = THREE.MathUtils.lerp(3.8, 5.5, random());
    const trunkRadius = THREE.MathUtils.lerp(0.22, 0.38, random());

    const trunk = createCurvedBranch({
        start: new THREE.Vector3(0, waterLevel + 0.2, 0),
        end: new THREE.Vector3(
            THREE.MathUtils.lerp(-0.35, 0.35, random()),
            waterLevel + trunkHeight,
            THREE.MathUtils.lerp(-0.25, 0.25, random())
        ),
        radiusStart: trunkRadius,
        radiusEnd: trunkRadius * 0.55,
        bend: new THREE.Vector3(
            THREE.MathUtils.lerp(-0.5, 0.5, random()),
            waterLevel + trunkHeight * 0.55,
            THREE.MathUtils.lerp(-0.4, 0.4, random())
        ),
        material: trunkMaterial,
        segments: 10
    });

    mangrove.add(trunk);

    const canopyCollar = createLeafCluster(
        random,
        darkLeafMaterial
    );

    canopyCollar.position.set(
        0,
        waterLevel + trunkHeight - 0.35,
        0
    );

    canopyCollar.scale.set(0.85, 0.7, 0.85);

    mangrove.add(canopyCollar);

    const rootCount = 7 + Math.floor(random() * 5);

    for (let i = 0; i < rootCount; i++) {
        const angle =
            (i / rootCount) * Math.PI * 2 +
            THREE.MathUtils.lerp(-0.25, 0.25, random());

        const rootLength = THREE.MathUtils.lerp(1.5, 2.8, random());
        const rootStartHeight = THREE.MathUtils.lerp(0.5, 1.35, random());

        const start = new THREE.Vector3(
            Math.cos(angle) * trunkRadius * 0.35,
            waterLevel + rootStartHeight,
            Math.sin(angle) * trunkRadius * 0.35
        );

        const end = new THREE.Vector3(
            Math.cos(angle) * rootLength,
            waterLevel - THREE.MathUtils.lerp(0.02, 0.15, random()),
            Math.sin(angle) * rootLength
        );

        const bend = new THREE.Vector3(
            Math.cos(angle) * rootLength * 0.65,
            waterLevel + THREE.MathUtils.lerp(0.15, 0.65, random()),
            Math.sin(angle) * rootLength * 0.65
        );

        mangrove.add(createCurvedBranch({
            start,
            end,
            bend,
            radiusStart: trunkRadius * 0.32,
            radiusEnd: 0.035,
            material: rootMaterial,
            segments: 8
        }));

        if (random() > 0.45) {
            const splitAngle = angle + THREE.MathUtils.lerp(-0.55, 0.55, random());
            const splitStart = new THREE.Vector3(
                Math.cos(angle) * rootLength * 0.55,
                waterLevel + 0.22,
                Math.sin(angle) * rootLength * 0.55
            );
            const splitEnd = new THREE.Vector3(
                Math.cos(splitAngle) * rootLength * 1.05,
                waterLevel - 0.05,
                Math.sin(splitAngle) * rootLength * 1.05
            );

            mangrove.add(createCurvedBranch({
                start: splitStart,
                end: splitEnd,
                bend: splitStart.clone().lerp(splitEnd, 0.5).add(new THREE.Vector3(0, 0.2, 0)),
                radiusStart: trunkRadius * 0.14,
                radiusEnd: 0.02,
                material: rootMaterial,
                segments: 6
            }));
        }
    }

    const branchCount = 6 + Math.floor(random() * 4);

    for (let i = 0; i < branchCount; i++) {
        const angle =
            (i / branchCount) * Math.PI * 2 +
            THREE.MathUtils.lerp(-0.45, 0.45, random());

        const branchLength = THREE.MathUtils.lerp(1.2, 2.3, random());
        const branchStartY =
            waterLevel + trunkHeight * THREE.MathUtils.lerp(0.66, 0.9, random());

        const start = new THREE.Vector3(
            THREE.MathUtils.lerp(-0.12, 0.12, random()),
            branchStartY,
            THREE.MathUtils.lerp(-0.12, 0.12, random())
        );

        const end = new THREE.Vector3(
            Math.cos(angle) * branchLength,
            branchStartY + THREE.MathUtils.lerp(0.5, 1.3, random()),
            Math.sin(angle) * branchLength
        );

        const bend = start.clone().lerp(end, 0.5);
        bend.y += THREE.MathUtils.lerp(0.2, 0.65, random());

        mangrove.add(createCurvedBranch({
            start,
            end,
            bend,
            radiusStart: trunkRadius * 0.42,
            radiusEnd: 0.045,
            material: trunkMaterial,
            segments: 7
        }));

        const leafClusters = 2 + Math.floor(random() * 3);

        for (let j = 0; j < leafClusters; j++) {
            const leafPosition = end.clone().multiplyScalar(
                THREE.MathUtils.lerp(0.82, 1.0, random())
            );

            leafPosition.add(
                new THREE.Vector3(
                    THREE.MathUtils.lerp(-0.45, 0.45, random()),
                    THREE.MathUtils.lerp(-0.45, 0.25, random()),
                    THREE.MathUtils.lerp(-0.45, 0.45, random())
                )
            );

            const leaves = createLeafCluster(
                random,
                j % 2 === 0 ? leafMaterial : darkLeafMaterial
            );
            leaves.position.copy(leafPosition);
            leaves.rotation.y = random() * Math.PI * 2;
            mangrove.add(leaves);
        }
    }

    // Small transition branches that connect the trunk to the canopy
    const transitionBranchCount = 5 + Math.floor(random() * 4);

    for (let i = 0; i < transitionBranchCount; i++) {
        const angle =
            (i / transitionBranchCount) * Math.PI * 2 +
            THREE.MathUtils.lerp(-0.4, 0.4, random());

        const startY =
            waterLevel +
            trunkHeight * THREE.MathUtils.lerp(0.72, 0.92, random());

        const branchLength =
            THREE.MathUtils.lerp(0.65, 1.25, random());

        const start = new THREE.Vector3(
            THREE.MathUtils.lerp(-0.08, 0.08, random()),
            startY,
            THREE.MathUtils.lerp(-0.08, 0.08, random())
        );

        const end = new THREE.Vector3(
            Math.cos(angle) * branchLength,
            startY + THREE.MathUtils.lerp(0.25, 0.75, random()),
            Math.sin(angle) * branchLength
        );

        const bend = start.clone().lerp(end, 0.5);
        bend.y += THREE.MathUtils.lerp(0.15, 0.35, random());

        const branch = createCurvedBranch({
            start,
            end,
            bend,
            radiusStart: trunkRadius * 0.24,
            radiusEnd: 0.025,
            material: trunkMaterial,
            segments: 6
        });

        mangrove.add(branch);

        const leaves = createLeafCluster(
            random,
            random() > 0.35 ? leafMaterial : darkLeafMaterial
        );

        leaves.position.copy(end);

        leaves.scale.multiplyScalar(
            THREE.MathUtils.lerp(0.55, 0.8, random())
        );

        leaves.rotation.y = random() * Math.PI * 2;

        mangrove.add(leaves);
    }

    // Central canopy filler and trunk-to-canopy transition
    for (let i = 0; i < 11; i++) {
        const leaves = createLeafCluster(
            random,
            i % 3 === 0 ? darkLeafMaterial : leafMaterial
        );

        const angle = random() * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(0.25, 1.35, random());

        leaves.position.set(
            Math.cos(angle) * radius,
            waterLevel +
                trunkHeight +
                THREE.MathUtils.lerp(-0.9, 0.85, random()),
            Math.sin(angle) * radius
        );

        leaves.scale.multiplyScalar(
            THREE.MathUtils.lerp(0.65, 1.15, random())
        );

        leaves.rotation.set(
            THREE.MathUtils.lerp(-0.2, 0.2, random()),
            random() * Math.PI * 2,
            THREE.MathUtils.lerp(-0.2, 0.2, random())
        );

        mangrove.add(leaves);
    }

    mangrove.scale.setScalar(scale);

    // Shadows are assigned after the tree geometry is merged.
    // Leaves will not cast shadows because they are the most expensive part.
    return mangrove;
}

/**
 * Mangroves along both sides of the stylized dock (local X = width, Z = length).
 */
export function createMangroveDockBorder(options = {}) {
    const {
        dockWidth = DOCK_WIDTH,
        dockDepth = DOCK_DEPTH,
        dockGroupZ = DOCK_GROUP_Z,
        treeCountPerSide = 7,
        waterLevel = 0,
        sideOffset = 2.2,
        spacingVariation = 1.4,
        seedBase = 0,
        nearCastShrink = true
    } = options;

    const border = new THREE.Group();
    border.position.set(0, 0, dockGroupZ);

    const zStart = -dockDepth * 0.47;
    const plankCount = 13;
    const plankGap = 0.01;
    const plankDepth = (dockDepth * 0.94) / plankCount - plankGap;
    const zEnd = zStart + plankCount * plankDepth + (plankCount - 1) * plankGap;
    const dockSpan = Math.max(0.001, zEnd - zStart);

    for (const side of [-1, 1]) {
        for (let i = 0; i < treeCountPerSide; i++) {
            const progress = treeCountPerSide === 1 ? 0 : i / (treeCountPerSide - 1);
            const along = THREE.MathUtils.lerp(zStart, zEnd, progress);
            const z = along + THREE.MathUtils.randFloat(-spacingVariation, spacingVariation);

            const frontT = THREE.MathUtils.clamp((z - zStart) / dockSpan, 0, 1);
            if (nearCastShrink && frontT > 0.72 && Math.random() < 0.5) {
                continue;
            }

            const castPush = nearCastShrink ? THREE.MathUtils.smoothstep(frontT, 0.42, 1.0) : 0;
            const x =
                side *
                (
                    dockWidth * 0.5 +
                    sideOffset +
                    castPush * 2.4 +
                    THREE.MathUtils.randFloat(-0.35, 0.85)
                );

            let scale = THREE.MathUtils.randFloat(0.75, 1.2);
            if (nearCastShrink) {
                scale *= THREE.MathUtils.lerp(1, 0.5, castPush);
            }

            const tree = createMangrove({
                scale,
                waterLevel,
                seed: seedBase + i * 73.41 + side * 182.76 + Math.random() * 100
            });

            tree.position.set(x, 0, z);
            // Face the channel / dock so cast shadows read toward +X on both banks.
            tree.rotation.y = Math.atan2(-x, 4.5)
                + THREE.MathUtils.randFloat(-0.12, 0.12);
            // Lean slightly toward the sun-shadow side (+X), same on both banks.
            tree.rotation.z = THREE.MathUtils.randFloat(0.02, 0.065);

            if (nearCastShrink && castPush > 0.05) {
                const foliageReach = THREE.MathUtils.lerp(1, 0.68, castPush);

                tree.traverse((obj) => {
                    if (obj.name === 'mangroveFoliage') {
                        obj.scale.multiplyScalar(foliageReach);
                    }
                });
            }

            // Combine all the separate pieces in this tree.
            // This reduces hundreds of draw calls to approximately four per tree.
            optimizeMangroveTree(tree);

            border.add(tree);

            if (!border.userData.mangroveTrees) {
                border.userData.mangroveTrees = [];
            }

            border.userData.mangroveTrees.push(tree);
        }
    }

    return border;
}

/**
 * Inner + outer mangrove rows for Cortez Backwaters.
 * @param {number} waterLevel
 * @returns {THREE.Group}
 */
export function buildCortezMangroveScenery(waterLevel = 0) {
    const root = new THREE.Group();
    root.name = 'cortezMangroves';

    const inner = createMangroveDockBorder({
        dockWidth: DOCK_WIDTH,
        dockDepth: DOCK_DEPTH,
        dockGroupZ: DOCK_GROUP_Z,
        treeCountPerSide: 7,
        waterLevel,
        sideOffset: 2.65,
        spacingVariation: 1.2,
        seedBase: 11,
        nearCastShrink: true
    });

    const outer = createMangroveDockBorder({
        dockWidth: DOCK_WIDTH,
        dockDepth: DOCK_DEPTH,
        dockGroupZ: DOCK_GROUP_Z,
        treeCountPerSide: 5,
        waterLevel,
        sideOffset: 5.8,
        spacingVariation: 2.2,
        seedBase: 907,
        nearCastShrink: false
    });
    outer.scale.setScalar(1.12);

    root.add(inner);
    root.add(outer);

    root.userData.mangroveTrees = [
        ...(inner.userData.mangroveTrees || []),
        ...(outer.userData.mangroveTrees || [])
    ];

    // Store the materials once instead of searching every tree every frame.
    cacheMangrovePortraitMaterials(root);
    updateCortezMangrovesForPortrait(root);

    return root;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} [waterLevel=0]
 * @returns {THREE.Group}
 */
export function createCortezMangroves(scene, waterLevel = 0) {
    const root = buildCortezMangroveScenery(waterLevel);
    root.visible = false;
    scene.add(root);
    return root;
}

/**
 * @param {THREE.Group | null} group
 * @param {boolean} visible
 */
export function syncCortezMangrovesVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}

/**
 * Keep mangrove materials fully opaque (no portrait transparency fade).
 * @param {THREE.Group | null} group
 */
export function updateCortezMangrovesForPortrait(group) {
    if (!group) return;

    if (!group.userData.mangrovePortraitMaterials) {
        cacheMangrovePortraitMaterials(group);
    }

    const materials =
        group.userData.mangrovePortraitMaterials;

    for (const material of materials) {
        const base =
            material.userData.mangrovePortraitBase;

        if (!base) continue;

        // Keep all mangrove materials sharp and opaque.
        material.opacity = base.opacity;
        material.transparent = base.transparent;
        material.depthWrite = base.depthWrite;
    }

    group.userData.mangrovePortraitFade = 0;
}

const _cameraToTarget = new THREE.Vector3();
const _cameraToTree = new THREE.Vector3();
const _treeWorldPosition = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();

export function updateMangroveCameraObstruction(
    group,
    camera,
    targetPosition,
    isCortez
) {
    if (!group) {
        return;
    }

    if (!isCortez) {
        for (const tree of group.userData.mangroveTrees || []) {
            tree.visible = true;
        }

        return;
    }

    if (!camera || !targetPosition) {
        return;
    }

    const trees = group.userData.mangroveTrees || [];

    _cameraToTarget
        .copy(targetPosition)
        .sub(camera.position);

    const targetDistance = _cameraToTarget.length();

    if (targetDistance <= 0.001) {
        return;
    }

    _cameraToTarget.normalize();

    for (const tree of trees) {
        tree.getWorldPosition(_treeWorldPosition);

        _cameraToTree
            .copy(_treeWorldPosition)
            .sub(camera.position);

        const distanceAlongView =
            _cameraToTree.dot(_cameraToTarget);

        // Tree is not between camera and Halley.
        if (
            distanceAlongView <= 0 ||
            distanceAlongView >= targetDistance
        ) {
            tree.visible = true;
            continue;
        }

        _closestPoint
            .copy(camera.position)
            .addScaledVector(
                _cameraToTarget,
                distanceAlongView
            );

        const distanceFromViewLine =
            _closestPoint.distanceTo(_treeWorldPosition);

        // Hide only a tree that directly blocks the camera.
        tree.visible = distanceFromViewLine > 1.75;
    }
}

function cacheMangrovePortraitMaterials(group) {
    const uniqueMaterials = new Set();

    group.traverse((object) => {
        if (!object.isMesh) return;

        const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

        for (const material of materials) {
            if (!material || uniqueMaterials.has(material)) {
                continue;
            }

            uniqueMaterials.add(material);

            material.userData.mangrovePortraitBase = {
                opacity: material.opacity ?? 1,
                transparent: material.transparent === true,
                depthWrite: material.depthWrite !== false
            };
        }
    });

    group.userData.mangrovePortraitMaterials =
        [...uniqueMaterials];

    group.userData.mangrovePortraitFade = undefined;
}

/**
 * Combines all tree pieces that share the same material.
 *
 * Each finished tree will normally contain:
 * 1 trunk/branch mesh
 * 1 root mesh
 * 1 light-green foliage mesh
 * 1 dark-green foliage mesh
 */
function optimizeMangroveTree(tree) {
    tree.updateMatrixWorld(true);

    const inverseTreeWorld =
        tree.matrixWorld.clone().invert();

    const materialBuckets = new Map();
    const sourceMeshes = [];

    tree.traverse((object) => {
        if (
            !object.isMesh ||
            !object.geometry ||
            !object.material
        ) {
            return;
        }

        sourceMeshes.push(object);

        const materialKey = object.material.uuid;

        if (!materialBuckets.has(materialKey)) {
            materialBuckets.set(materialKey, {
                material: object.material,
                geometries: [],
                isLeaf:
                    object.parent?.name ===
                        'mangroveFoliage' ||
                    object.name ===
                        'mangroveFoliage'
            });
        }

        // Convert this mesh's geometry into tree-local space.
        const localMatrix =
            inverseTreeWorld
                .clone()
                .multiply(object.matrixWorld);

        const geometry = object.geometry.clone();

        geometry.applyMatrix4(localMatrix);

        materialBuckets
            .get(materialKey)
            .geometries
            .push(geometry);
    });

    if (sourceMeshes.length < 2) {
        return;
    }

    // Remove the original separate meshes.
    for (const mesh of sourceMeshes) {
        mesh.parent?.remove(mesh);
    }

    // Remove empty groups that used to hold the leaf pieces.
    for (
        let index = tree.children.length - 1;
        index >= 0;
        index--
    ) {
        const child = tree.children[index];

        if (!child.isMesh) {
            tree.remove(child);
        }
    }

    for (const bucket of materialBuckets.values()) {
        const mergedGeometry = mergeGeometries(
            bucket.geometries,
            false
        );

        // Dispose the temporary cloned geometries.
        for (const geometry of bucket.geometries) {
            geometry.dispose();
        }

        if (!mergedGeometry) {
            continue;
        }

        mergedGeometry.computeVertexNormals();

        mergedGeometry.computeBoundingBox();
        mergedGeometry.computeBoundingSphere();

        const mergedMesh = new THREE.Mesh(
            mergedGeometry,
            bucket.material
        );

        mergedMesh.name = bucket.isLeaf
            ? 'mangroveLeavesMerged'
            : 'mangroveWoodMerged';

        // Trunks and roots retain shadows.
        // Foliage does not cast or receive shadows.
        mergedMesh.castShadow = !bucket.isLeaf;
        mergedMesh.receiveShadow = !bucket.isLeaf;

        tree.add(mergedMesh);
    }
}

function createCurvedBranch({
    start,
    end,
    bend,
    radiusStart,
    radiusEnd,
    material,
    segments = 8
}) {
    const curve = new THREE.QuadraticBezierCurve3(start, bend, end);

    const geometry = new THREE.TubeGeometry(
        curve,
        segments,
        radiusStart,
        7,
        false
    );

    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        minY = Math.min(minY, vertex.y);
        maxY = Math.max(maxY, vertex.y);
    }

    const heightRange = Math.max(0.001, maxY - minY);

    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);

        const t = THREE.MathUtils.clamp(
            (vertex.y - minY) / heightRange,
            0,
            1
        );

        const taper = THREE.MathUtils.lerp(
            1,
            Math.max(0.18, radiusEnd / radiusStart),
            t
        );

        const curvePoint = curve.getPoint(t);

        vertex.x = curvePoint.x + (vertex.x - curvePoint.x) * taper;
        vertex.z = curvePoint.z + (vertex.z - curvePoint.z) * taper;

        position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, material);
}

function createLeafCluster(random, material) {
    const cluster = new THREE.Group();
    cluster.name = 'mangroveFoliage';

    const leafGeometry = new THREE.SphereGeometry(0.65, 7, 5);
    leafGeometry.scale(1.5, 0.55, 1);

    const leafCount = 6 + Math.floor(random() * 4);

    for (let i = 0; i < leafCount; i++) {
        const leafMass = new THREE.Mesh(leafGeometry, material);

        leafMass.position.set(
            THREE.MathUtils.lerp(-0.48, 0.48, random()),
            THREE.MathUtils.lerp(-0.32, 0.25, random()),
            THREE.MathUtils.lerp(-0.48, 0.48, random())
        );

        leafMass.rotation.set(
            THREE.MathUtils.lerp(-0.25, 0.25, random()),
            random() * Math.PI,
            THREE.MathUtils.lerp(-0.25, 0.25, random())
        );

        leafMass.scale.setScalar(
            THREE.MathUtils.lerp(0.65, 1.15, random())
        );

        cluster.add(leafMass);
    }

    return cluster;
}

function seededRandom(seed) {
    let value = Math.floor(seed) || 1;

    return function random() {
        value = Math.imul(48271, value) | 0;
        value %= 2147483647;
        return (value & 2147483647) / 2147483647;
    };
}
