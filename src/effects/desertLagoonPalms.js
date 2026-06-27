import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getStylizedDockLocalMetrics } from '../scene/stylizedDock.js';

/** Matches stylizedDock.js dock group placement. */
const DOCK_GROUP_Z = -1.5;

const PALM_TRUNK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x8a6746,
    roughness: 0.95,
    metalness: 0
});

const PALM_LEAF_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x3f8c4b,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide
});

const PALM_LEAF_DARK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x2f6d39,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide
});

const PALM_COCONUT_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x6a4a2a,
    roughness: 0.95,
    metalness: 0
});

function seededRandom(seed = 1) {
    let value = Math.floor(seed) || 1;

    return function random() {
        value = Math.imul(48271, value) % 2147483647;
        return (value & 2147483647) / 2147483647;
    };
}

function createPalmFrondGeometry(length = 2.4, width = 0.55, droopScale = 1) {
    const shape = new THREE.Shape();

    shape.moveTo(0, 0);
    shape.quadraticCurveTo(width * 0.2, length * 0.18, width * 0.08, length * 0.45);
    shape.quadraticCurveTo(0, length * 0.72, 0, length);
    shape.quadraticCurveTo(-width * 0.08, length * 0.72, -width * 0.2, length * 0.45);
    shape.quadraticCurveTo(-width * 0.2, length * 0.18, 0, 0);

    const geometry = new THREE.ShapeGeometry(shape, 10);

    // Stem at origin; frond extends along local -Z after this rotation.
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i);

        // 0 at crown attachment, 1 at the leaf tip.
        const along = THREE.MathUtils.clamp(-v.z / length, 0, 1);

        // Gravity sag — stiff near stem, tips hang lower.
        const mainSag = along * along * length * 0.34 * droopScale;
        const tipSag = along * along * along * length * 0.18 * droopScale;
        v.y -= mainSag + tipSag;

        // Subtle mid-frond lift from leaf stiffness, still net-down at the tip.
        v.y += Math.sin(along * Math.PI) * length * 0.04 * (1 - along * 0.55);

        v.x *= 1 - along * 0.16;

        // Weight pulls the frond arc slightly forward/down along its span.
        v.z -= along * along * length * 0.1;

        position.setXYZ(i, v.x, v.y, v.z);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();

    return geometry;
}

function createPalmTreeRaw({
    seed = 1,
    scale = 1
} = {}) {
    const random = seededRandom(seed);
    const tree = new THREE.Group();

    const trunkPieces = [];
    const leafPiecesLight = [];
    const leafPiecesDark = [];
    const coconutPieces = [];

    const trunkHeight = THREE.MathUtils.lerp(3.8, 6.2, random());
    const trunkSegments = 10 + Math.floor(random() * 4);
    const baseRadius = THREE.MathUtils.lerp(0.18, 0.26, random());

    const leanX = THREE.MathUtils.lerp(-0.45, 0.45, random());
    const leanZ = THREE.MathUtils.lerp(-0.45, 0.45, random());

    for (let i = 0; i < trunkSegments; i++) {
        const t0 = i / trunkSegments;
        const t1 = (i + 1) / trunkSegments;

        const y0 = t0 * trunkHeight;
        const y1 = t1 * trunkHeight;
        const yMid = (y0 + y1) * 0.5;

        const x0 = leanX * t0 * t0;
        const z0 = leanZ * t0 * t0;
        const x1 = leanX * t1 * t1;
        const z1 = leanZ * t1 * t1;

        const xMid = (x0 + x1) * 0.5;
        const zMid = (z0 + z1) * 0.5;

        const rTop = THREE.MathUtils.lerp(baseRadius, baseRadius * 0.45, t1);
        const rBottom = THREE.MathUtils.lerp(baseRadius, baseRadius * 0.45, t0);

        const segHeight = y1 - y0;

        const g = new THREE.CylinderGeometry(
            rTop,
            rBottom,
            segHeight,
            7,
            1,
            false
        );

        const p0 = new THREE.Vector3(x0, y0, z0);
        const p1 = new THREE.Vector3(x1, y1, z1);
        const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, dir);

        g.applyQuaternion(q);
        g.translate(xMid, yMid, zMid);

        trunkPieces.push(g);

        if (i < trunkSegments - 1) {
            const ring = new THREE.TorusGeometry(
                THREE.MathUtils.lerp(baseRadius * 0.92, baseRadius * 0.4, t0),
                0.01,
                5,
                10
            );

            ring.rotateX(Math.PI / 2);
            ring.translate(xMid, yMid, zMid);
            trunkPieces.push(ring);
        }
    }

    const crownX = leanX;
    const crownY = trunkHeight;
    const crownZ = leanZ;

    const frondCount = 8 + Math.floor(random() * 3);

    for (let i = 0; i < frondCount; i++) {
        const frondLength = THREE.MathUtils.lerp(1.9, 2.9, random());
        const frondWidth = THREE.MathUtils.lerp(0.45, 0.68, random());
        const droopScale = THREE.MathUtils.lerp(0.92, 1.12, random());

        const leafGeom = createPalmFrondGeometry(frondLength, frondWidth, droopScale);

        const angle = (i / frondCount) * Math.PI * 2 + THREE.MathUtils.lerp(-0.22, 0.22, random());
        const tilt = THREE.MathUtils.lerp(0.42, 0.78, random());

        leafGeom.rotateY(angle);
        leafGeom.rotateX(tilt);
        leafGeom.translate(
            crownX,
            crownY - 0.05 + THREE.MathUtils.lerp(-0.05, 0.12, random()),
            crownZ
        );

        if (i % 3 === 0) {
            leafPiecesDark.push(leafGeom);
        } else {
            leafPiecesLight.push(leafGeom);
        }
    }

    const innerCount = 4 + Math.floor(random() * 3);

    for (let i = 0; i < innerCount; i++) {
        const leafGeom = createPalmFrondGeometry(
            THREE.MathUtils.lerp(1.2, 1.8, random()),
            THREE.MathUtils.lerp(0.28, 0.44, random()),
            THREE.MathUtils.lerp(0.72, 0.9, random())
        );

        const angle = (i / innerCount) * Math.PI * 2 + THREE.MathUtils.lerp(-0.3, 0.3, random());
        const tilt = THREE.MathUtils.lerp(0.55, 0.92, random());

        leafGeom.rotateY(angle);
        leafGeom.rotateX(tilt);
        leafGeom.translate(
            crownX,
            crownY + THREE.MathUtils.lerp(-0.04, 0.1, random()),
            crownZ
        );

        leafPiecesDark.push(leafGeom);
    }

    const coconutCount = random() > 0.42 ? 3 + Math.floor(random() * 3) : 0;

    for (let i = 0; i < coconutCount; i++) {
        const g = new THREE.SphereGeometry(0.08 + random() * 0.02, 8, 8);

        g.translate(
            crownX + THREE.MathUtils.lerp(-0.15, 0.15, random()),
            crownY - 0.15 + THREE.MathUtils.lerp(-0.05, 0.08, random()),
            crownZ + THREE.MathUtils.lerp(-0.15, 0.15, random())
        );

        coconutPieces.push(g);
    }

    const trunkGeometry = mergeGeometries(trunkPieces, false);
    const leafLightGeometry = leafPiecesLight.length
        ? mergeGeometries(leafPiecesLight, false)
        : null;
    const leafDarkGeometry = leafPiecesDark.length
        ? mergeGeometries(leafPiecesDark, false)
        : null;
    const coconutGeometry = coconutPieces.length
        ? mergeGeometries(coconutPieces, false)
        : null;

    trunkPieces.forEach((g) => g.dispose());
    leafPiecesLight.forEach((g) => g.dispose());
    leafPiecesDark.forEach((g) => g.dispose());
    coconutPieces.forEach((g) => g.dispose());

    const trunkMesh = new THREE.Mesh(trunkGeometry, PALM_TRUNK_MATERIAL);
    trunkMesh.name = 'desertPalmTrunk';
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    tree.add(trunkMesh);

    if (leafLightGeometry) {
        const leafLightMesh = new THREE.Mesh(leafLightGeometry, PALM_LEAF_MATERIAL);
        leafLightMesh.name = 'desertPalmLeaves';
        leafLightMesh.castShadow = false;
        leafLightMesh.receiveShadow = true;
        tree.add(leafLightMesh);
    }

    if (leafDarkGeometry) {
        const leafDarkMesh = new THREE.Mesh(leafDarkGeometry, PALM_LEAF_DARK_MATERIAL);
        leafDarkMesh.name = 'desertPalmLeavesDark';
        leafDarkMesh.castShadow = false;
        leafDarkMesh.receiveShadow = true;
        tree.add(leafDarkMesh);
    }

    if (coconutGeometry) {
        const coconutMesh = new THREE.Mesh(coconutGeometry, PALM_COCONUT_MATERIAL);
        coconutMesh.name = 'desertPalmCoconuts';
        coconutMesh.castShadow = true;
        coconutMesh.receiveShadow = true;
        tree.add(coconutMesh);
    }

    tree.scale.setScalar(scale);
    tree.userData.desertPalm = true;
    tree.userData.trunkBaseRadius = baseRadius;
    tree.userData.trunkLeanX = leanX;
    tree.userData.trunkLeanZ = leanZ;
    tree.userData.trunkHeight = trunkHeight;

    return tree;
}

export function createDesertPalmTree(options = {}) {
    return createPalmTreeRaw(options);
}

const PALM_RIPPLE_SURFACE_OFFSET = 0.04;

function attachPalmBaseRipples(palm, shoreY, postIndex) {
    const {
        trunkBaseRadius = 0.2,
        trunkLeanX = 0,
        trunkLeanZ = 0,
        trunkHeight = 5
    } = palm.userData;

    const group = new THREE.Group();
    group.name = 'desertPalmBaseRipples';
    group.renderOrder = 1003;

    const splashMaterial = new THREE.MeshBasicMaterial({
        color: 0xb8d4ec,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true
    });

    const yWater = -shoreY;
    const leanT = yWater / trunkHeight;
    const rippleX = trunkLeanX * leanT * leanT;
    const rippleZ = trunkLeanZ * leanT * leanT;
    const innerRadius = trunkBaseRadius * 1.08;

    for (let ringIndex = 0; ringIndex < 2; ringIndex++) {
        const ringRadius = innerRadius + ringIndex * 0.05;
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(ringRadius, ringRadius + 0.038, 28),
            splashMaterial.clone()
        );

        ring.rotation.x = -Math.PI / 2;
        ring.position.set(
            rippleX,
            yWater + PALM_RIPPLE_SURFACE_OFFSET,
            rippleZ
        );
        ring.renderOrder = 1003;

        ring.userData = {
            baseRadius: ringRadius,
            maxRadius: ringRadius + 0.28,
            ringThickness: 0.038,
            peakOpacity: 0.26,
            startTime: postIndex * 1.4 + ringIndex * 3.2 + Math.random() * 4.5,
            lifetime: 6.5 + ringIndex * 2.0 + Math.random() * 3.0,
            fadeStart: 0.62
        };

        group.add(ring);
    }

    palm.add(group);
    return group;
}

export function updatePalmBaseRipples(root, time = 0) {
    if (!root) return;

    root.traverse((ring) => {
        if (!ring.isMesh || !ring.userData?.baseRadius) return;

        const {
            baseRadius,
            maxRadius,
            ringThickness,
            startTime,
            lifetime,
            fadeStart,
            peakOpacity
        } = ring.userData;

        const age = ((time - startTime) % lifetime + lifetime) % lifetime;
        const progress = age / lifetime;
        const expansionProgress = 1.0 - Math.pow(1.0 - progress, 3);
        const currentRadius = baseRadius + (maxRadius - baseRadius) * expansionProgress;
        const thickness = ringThickness ?? 0.038;

        ring.geometry.dispose();
        ring.geometry = new THREE.RingGeometry(
            currentRadius,
            currentRadius + thickness,
            28
        );

        let opacity = 1.0;
        if (progress >= fadeStart) {
            const fadeProgress = (progress - fadeStart) / (1.0 - fadeStart);
            opacity = 1.0 - fadeProgress;
        }
        ring.material.opacity = Math.max(0.0, opacity) * (peakOpacity ?? 0.26);
        ring.rotation.z = Math.sin(time * 0.12 + baseRadius) * 0.015;
    });
}

/**
 * Palm clusters flanking the dock — open center channel for Halley.
 * Dock local +Z is toward the lake (camera looks from -Z toward +Z).
 */
export function createDesertLagoonDockPalms({
    dockWidth = 3,
    dockLength = 14,
    waterLevel = 0,
    shoreY = 0.06,
    dockGroupZ = DOCK_GROUP_Z,
    plankCount = 11,
    seed = 4402
} = {}) {
    const random = seededRandom(seed);
    const root = new THREE.Group();
    root.name = 'desertLagoonPalms';
    root.position.set(0, waterLevel, dockGroupZ);
    let rippleIndex = 0;

    const { zStart, deckFrontZ } = getStylizedDockLocalMetrics(dockLength, plankCount);
    const catLocalZ = dockLength * 0.35;
    const zNearShore = zStart + 0.9;
    const zNearCat = catLocalZ - 1.35;

    const palmsPerSide = 4;

    function placePalmRow(side, seedStart) {
        for (let i = 0; i < palmsPerSide; i++) {
            const progress = palmsPerSide === 1 ? 0.5 : i / (palmsPerSide - 1);
            const z = THREE.MathUtils.lerp(zNearShore, zNearCat, progress)
                + THREE.MathUtils.lerp(-0.55, 0.55, random());

            const alongT = THREE.MathUtils.clamp((z - zStart) / Math.max(0.001, deckFrontZ - zStart), 0, 1);
            const sideOffset = THREE.MathUtils.lerp(2.4, 4.6, alongT)
                + THREE.MathUtils.lerp(-0.35, 0.45, random());
            const scale = THREE.MathUtils.lerp(0.88, 1.14, random())
                * THREE.MathUtils.lerp(0.92, 1.06, alongT);

            const palm = createDesertPalmTree({
                seed: seedStart + i * 37,
                scale
            });

            palm.position.set(
                side * (dockWidth * 0.5 + sideOffset),
                shoreY,
                z
            );

            palm.rotation.y = Math.atan2(-side, 2.5)
                + THREE.MathUtils.lerp(-0.28, 0.28, random());

            attachPalmBaseRipples(palm, shoreY, rippleIndex++);
            root.add(palm);
        }
    }

    placePalmRow(-1, seed + 100);
    placePalmRow(1, seed + 300);

    const backClusters = [
        { x: -8.8, z: deckFrontZ - 0.8, scale: 1.18 },
        { x: 9.4, z: catLocalZ + 0.35, scale: 1.24 },
        { x: -10.5, z: catLocalZ - 0.2, scale: 1.05 }
    ];

    backClusters.forEach((entry, index) => {
        const count = 2 + Math.floor(random() * 2);

        for (let i = 0; i < count; i++) {
            const palm = createDesertPalmTree({
                seed: seed + 700 + index * 47 + i * 11,
                scale: entry.scale * THREE.MathUtils.lerp(0.82, 1.06, random())
            });

            palm.position.set(
                entry.x + THREE.MathUtils.lerp(-1.1, 1.1, random()),
                shoreY,
                entry.z + THREE.MathUtils.lerp(-1.0, 1.0, random())
            );

            palm.rotation.y = random() * Math.PI * 2;

            attachPalmBaseRipples(palm, shoreY, rippleIndex++);
            root.add(palm);
        }
    });

    return root;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} [waterLevel=0]
 * @returns {THREE.Group}
 */
export function createDesertLagoonPalms(scene, waterLevel = 0) {
    const root = createDesertLagoonDockPalms({
        dockWidth: 3,
        dockLength: 14,
        waterLevel,
        shoreY: 0.06,
        seed: 4402
    });
    root.visible = false;
    scene.add(root);
    return root;
}

/**
 * @param {THREE.Group | null} group
 * @param {boolean} visible
 */
export function syncDesertLagoonPalmsVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}
