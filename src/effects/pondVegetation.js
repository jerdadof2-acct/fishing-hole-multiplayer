import * as THREE from 'three';
import { getStylizedDockLocalMetrics } from '../scene/stylizedDock.js';

/** Matches stylizedDock.js dock group placement. */
const DOCK_GROUP_Z = -1.5;
const DOCK_WIDTH = 3;
const DOCK_DEPTH = 14;
/** Pond dock uses 11 planks (see stylizedDock.js). */
const POND_DOCK_PLANK_COUNT = 11;

const TRUNK_GEOMETRY = new THREE.CylinderGeometry(
    0.11,
    0.16,
    1.8,
    7
);

const BRANCH_GEOMETRY = new THREE.CylinderGeometry(
    0.035,
    0.07,
    0.9,
    6
);

const BUSH_GEOMETRY = new THREE.IcosahedronGeometry(0.72, 1);

const SMALL_BUSH_GEOMETRY =
    new THREE.IcosahedronGeometry(0.46, 1);

const CATTAIL_STEM_GEOMETRY =
    new THREE.CylinderGeometry(0.018, 0.025, 1.05, 5);

const CATTAIL_HEAD_GEOMETRY =
    new THREE.CapsuleGeometry(0.055, 0.2, 3, 6);

const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x66513c,
    roughness: 0.95
});

const branchMaterial = trunkMaterial;

const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f8241,
    roughness: 0.9,
    flatShading: true
});

const darkLeafMaterial = new THREE.MeshStandardMaterial({
    color: 0x315f34,
    roughness: 0.95,
    flatShading: true
});

const lightLeafMaterial = new THREE.MeshStandardMaterial({
    color: 0x71964c,
    roughness: 0.9,
    flatShading: true
});

const cattailStemMaterial = new THREE.MeshStandardMaterial({
    color: 0x607a39,
    roughness: 0.9
});

const cattailHeadMaterial = new THREE.MeshStandardMaterial({
    color: 0x553725,
    roughness: 1
});

function seededRandom(seed = 1) {
    let value = Math.floor(seed) || 1;

    return function random() {
        value = Math.imul(value, 48271) % 2147483647;

        return (
            (value & 2147483647) /
            2147483647
        );
    };
}

export function createPondTree({
    scale = 1,
    seed = 1
} = {}) {
    const random = seededRandom(seed);
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(
        TRUNK_GEOMETRY,
        trunkMaterial
    );

    trunk.position.y = 0.9;
    trunk.rotation.z =
        THREE.MathUtils.lerp(-0.07, 0.07, random());

    trunk.castShadow = true;
    trunk.receiveShadow = true;

    tree.add(trunk);

    for (let i = 0; i < 3; i++) {
        const angle =
            (i / 3) * Math.PI * 2 +
            random() * 0.5;

        const branch = new THREE.Mesh(
            BRANCH_GEOMETRY,
            branchMaterial
        );

        branch.position.set(
            Math.cos(angle) * 0.18,
            THREE.MathUtils.lerp(1.25, 1.58, random()),
            Math.sin(angle) * 0.18
        );

        branch.rotation.order = 'YXZ';
        branch.rotation.y = -angle;
        branch.rotation.z =
            THREE.MathUtils.lerp(0.65, 1.0, random());

        branch.castShadow = true;
        branch.receiveShadow = true;

        tree.add(branch);
    }

    addCanopyMass(
        tree,
        new THREE.Vector3(0, 2.02, 0),
        new THREE.Vector3(0.95, 0.72, 0.88),
        leafMaterial
    );

    addCanopyMass(
        tree,
        new THREE.Vector3(-0.52, 1.82, 0.08),
        new THREE.Vector3(0.7, 0.55, 0.66),
        darkLeafMaterial
    );

    addCanopyMass(
        tree,
        new THREE.Vector3(0.48, 1.88, -0.1),
        new THREE.Vector3(0.72, 0.58, 0.67),
        lightLeafMaterial
    );

    addCanopyMass(
        tree,
        new THREE.Vector3(0.04, 1.52, 0.15),
        new THREE.Vector3(0.62, 0.4, 0.55),
        darkLeafMaterial
    );

    tree.scale.setScalar(scale);
    tree.rotation.y = random() * Math.PI * 2;

    tree.userData.pondVegetation = true;

    return tree;
}

function addCanopyMass(
    parent,
    position,
    scale,
    material
) {
    const foliage = new THREE.Mesh(
        BUSH_GEOMETRY,
        material
    );

    foliage.position.copy(position);
    foliage.scale.copy(scale);

    foliage.castShadow = false;
    foliage.receiveShadow = true;

    parent.add(foliage);
}

export function createPondBush({
    scale = 1,
    seed = 1
} = {}) {
    const random = seededRandom(seed);
    const bush = new THREE.Group();

    const clusterCount = 3 + Math.floor(random() * 2);

    for (let i = 0; i < clusterCount; i++) {
        const foliage = new THREE.Mesh(
            i === 0
                ? BUSH_GEOMETRY
                : SMALL_BUSH_GEOMETRY,
            i % 3 === 0
                ? darkLeafMaterial
                : i % 3 === 1
                    ? leafMaterial
                    : lightLeafMaterial
        );

        foliage.position.set(
            THREE.MathUtils.lerp(-0.48, 0.48, random()),
            THREE.MathUtils.lerp(0.35, 0.66, random()),
            THREE.MathUtils.lerp(-0.4, 0.4, random())
        );

        foliage.scale.set(
            THREE.MathUtils.lerp(0.75, 1.15, random()),
            THREE.MathUtils.lerp(0.6, 0.9, random()),
            THREE.MathUtils.lerp(0.75, 1.1, random())
        );

        foliage.rotation.set(
            random() * 0.15,
            random() * Math.PI * 2,
            random() * 0.15
        );

        foliage.castShadow = false;
        foliage.receiveShadow = true;

        bush.add(foliage);
    }

    bush.scale.setScalar(scale);
    bush.rotation.y = random() * Math.PI * 2;
    bush.userData.pondVegetation = true;

    return bush;
}

export function createCattailCluster({
    count = 7,
    seed = 1,
    scale = 1
} = {}) {
    const random = seededRandom(seed);
    const cluster = new THREE.Group();

    for (let i = 0; i < count; i++) {
        const cattail = new THREE.Group();

        const height =
            THREE.MathUtils.lerp(0.7, 1.15, random());

        const stem = new THREE.Mesh(
            CATTAIL_STEM_GEOMETRY,
            cattailStemMaterial
        );

        stem.scale.y = height;
        stem.position.y = 0.52 * height;

        const head = new THREE.Mesh(
            CATTAIL_HEAD_GEOMETRY,
            cattailHeadMaterial
        );

        head.position.y = 1.1 * height;

        cattail.position.set(
            THREE.MathUtils.lerp(-0.42, 0.42, random()),
            0,
            THREE.MathUtils.lerp(-0.35, 0.35, random())
        );

        cattail.rotation.z =
            THREE.MathUtils.lerp(-0.08, 0.08, random());

        cattail.add(stem, head);
        cluster.add(cattail);
    }

    cluster.scale.setScalar(scale);
    cluster.userData.pondVegetation = true;

    return cluster;
}

/**
 * Shoreline saplings, bushes, and cattails beside the Crescent Pond dock.
 * Placement follows dock-local Z (zStart → deckFrontZ), same space as the stylized dock mesh.
 */
export function createCrescentPondDockVegetation({
    dockWidth = DOCK_WIDTH,
    dockDepth = DOCK_DEPTH,
    dockGroupZ = DOCK_GROUP_Z,
    waterLevel = 0,
    shorelineY = 0.04,
    seed = 8214
} = {}) {
    const random = seededRandom(seed);
    const vegetation = new THREE.Group();

    vegetation.name = 'crescentPondDockVegetation';
    vegetation.position.set(0, 0, dockGroupZ);

    const { zStart, deckFrontZ } = getStylizedDockLocalMetrics(
        dockDepth,
        POND_DOCK_PLANK_COUNT
    );

    const alongZ = (progress) =>
        THREE.MathUtils.lerp(zStart, deckFrontZ, progress);

    const treeSlots = [
        { side: -1, progress: 0.14, distance: 3.4, scale: 0.94 },
        { side: 1, progress: 0.3, distance: 3.8, scale: 0.82 },
        { side: -1, progress: 0.48, distance: 4.2, scale: 1.05 },
        { side: 1, progress: 0.66, distance: 4.6, scale: 0.9 }
    ];

    for (let i = 0; i < treeSlots.length; i++) {
        const slot = treeSlots[i];

        const tree = createPondTree({
            scale:
                slot.scale *
                THREE.MathUtils.lerp(0.9, 1.1, random()),
            seed: seed + i * 71
        });

        tree.position.set(
            slot.side * (
                dockWidth * 0.5 +
                slot.distance +
                THREE.MathUtils.lerp(-0.35, 0.35, random())
            ),
            shorelineY,
            alongZ(slot.progress) +
                THREE.MathUtils.lerp(-0.55, 0.55, random())
        );

        vegetation.add(tree);
    }

    const bushSlots = [
        [-1, 0.1, 2.6, 0.84],
        [1, 0.2, 2.8, 0.74],
        [-1, 0.34, 2.5, 0.92],
        [1, 0.44, 2.9, 0.8],
        [-1, 0.56, 2.7, 0.88],
        [1, 0.64, 3.1, 0.76],
        [-1, 0.72, 2.9, 0.82],
        [1, 0.78, 3.0, 0.72]
    ];

    for (let i = 0; i < bushSlots.length; i++) {
        const [side, progress, distance, bushScale] = bushSlots[i];

        if (progress > 0.8) {
            continue;
        }

        const bush = createPondBush({
            scale:
                bushScale *
                THREE.MathUtils.lerp(0.92, 1.12, random()),
            seed: seed + 500 + i * 43
        });

        bush.position.set(
            side * (
                dockWidth * 0.5 +
                distance +
                THREE.MathUtils.lerp(-0.3, 0.3, random())
            ),
            shorelineY,
            alongZ(progress) +
                THREE.MathUtils.lerp(-0.45, 0.45, random())
        );

        vegetation.add(bush);
    }

    const cattailSlots = [
        [-1, 0.22, 2.35],
        [1, 0.38, 2.45],
        [-1, 0.54, 2.4],
        [1, 0.7, 2.5]
    ];

    for (let i = 0; i < cattailSlots.length; i++) {
        const [side, progress, distance] = cattailSlots[i];

        if (progress > 0.82) {
            continue;
        }

        const cattails = createCattailCluster({
            count: 5 + Math.floor(random() * 3),
            seed: seed + 900 + i * 31,
            scale: THREE.MathUtils.lerp(0.85, 1.05, random())
        });

        cattails.position.set(
            side * (dockWidth * 0.5 + distance),
            waterLevel + 0.01,
            alongZ(progress) +
                THREE.MathUtils.lerp(-0.25, 0.25, random())
        );

        vegetation.add(cattails);
    }

    return vegetation;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} [waterLevel=0]
 * @returns {THREE.Group}
 */
export function createCrescentPondVegetation(scene, waterLevel = 0) {
    const root = createCrescentPondDockVegetation({
        waterLevel,
        shorelineY: 0.04,
        seed: 8214
    });
    root.visible = false;
    scene.add(root);
    return root;
}

/**
 * Rebuild dock vegetation (e.g. after placement tuning).
 * @param {THREE.Scene} scene
 * @param {THREE.Group | null} existing
 * @param {number} [waterLevel=0]
 * @returns {THREE.Group}
 */
export function rebuildCrescentPondVegetation(scene, existing, waterLevel = 0) {
    const wasVisible = existing?.visible === true;

    if (existing) {
        scene.remove(existing);
    }

    const root = createCrescentPondDockVegetation({
        waterLevel,
        shorelineY: 0.04,
        seed: 8214
    });
    root.visible = wasVisible;
    scene.add(root);
    return root;
}

/**
 * @param {THREE.Group | null} vegetation
 * @param {boolean} visible
 */
export function syncCrescentPondVegetationVisibility(vegetation, visible) {
    if (vegetation) {
        vegetation.visible = visible === true;
    }
}
