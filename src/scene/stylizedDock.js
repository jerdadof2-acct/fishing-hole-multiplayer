import * as THREE from 'three';
import {
    createDockWoodMaterial,
    createLogEndCapMaterial,
    createRopeMaterial,
    getDockWoodTexture,
    createProceduralDockWoodTexture
} from './dockTextures.js';

/**
 * World-space XZ bounds for caustics exclusion (minX, maxX, minZ, maxZ).
 * @param {{ dockWidth?: number, dockDepth?: number, groupZ?: number, margin?: number }} [options]
 */
export function getStylizedDockWorldBounds(options = {}) {
    const {
        dockWidth = 3,
        dockDepth = 14,
        groupZ = -1.5,
        margin = 0.45
    } = options;
    const plankCount = 13;
    const plankGap = 0.01;
    const plankDepth = (dockDepth * 0.94) / plankCount - plankGap;
    const zStart = -dockDepth * 0.47;
    const deckFrontZ = zStart + plankCount * plankDepth + (plankCount - 1) * plankGap;

    return new THREE.Vector4(
        -dockWidth * 0.55 - margin,
        dockWidth * 0.55 + margin,
        groupZ + zStart - margin,
        groupZ + deckFrontZ + 0.25 + margin
    );
}

function computeDeckFrontZ(dockDepth, plankCount) {
    const plankGap = 0.01;
    const plankDepth = (dockDepth * 0.94) / plankCount - plankGap;
    const zStart = -dockDepth * 0.47;
    return zStart + plankCount * plankDepth + (plankCount - 1) * plankGap;
}

/**
 * Dock-local XZ span for waterline effects (LAKE/river dock uses 11 planks).
 * @param {number} [dockDepth=14]
 * @param {number} [plankCount=11]
 */
export function getStylizedDockLocalMetrics(dockDepth = 14, plankCount = 11) {
    const plankGap = 0.01;
    const plankDepth = (dockDepth * 0.94) / plankCount - plankGap;
    const zStart = -dockDepth * 0.47;
    const deckFrontZ = zStart + plankCount * plankDepth + (plankCount - 1) * plankGap;
    const dockLength = deckFrontZ - zStart;
    const dockCenterZ = (zStart + deckFrontZ) * 0.5;
    return { zStart, deckFrontZ, dockLength, dockCenterZ };
}

/**
 * World XZ positions for gentle ripple rings where dock posts meet the water.
 * @param {string} [waterBodyType='POND']
 * @returns {{ x: number, z: number, innerRadius: number }[]}
 */
export function getDockPostSplashPositions(waterBodyType = 'POND') {
    const dockWidth = 3;
    const dockDepth = 14;
    const groupZ = -1.5;
    const isPond = waterBodyType === 'POND';
    const isRiver = waterBodyType === 'RIVER';
    const plankCount = isRiver ? 13 : 11;
    const railWidth = 0.09;
    const deckFrontZ = computeDeckFrontZ(dockDepth, plankCount);
    const cornerZ = deckFrontZ - railWidth * 0.15;
    const cornerPostTopRadius = isPond ? 0.17 : 0.23;
    const postRadius = isPond ? 0.07 : 0.11;

    const positions = [];

    [-1, 1].forEach((side) => {
        positions.push({
            x: side * dockWidth * 0.48,
            z: groupZ + cornerZ,
            innerRadius: cornerPostTopRadius * 1.02,
            primary: true
        });
    });

    const supportLocal = isPond ? [
        { x: -dockWidth * 0.32, z: dockDepth * 0.35 },
        { x: dockWidth * 0.32, z: dockDepth * 0.35 },
        { x: -dockWidth * 0.32, z: -dockDepth * 0.35 },
        { x: dockWidth * 0.32, z: -dockDepth * 0.35 }
    ] : [
        { x: -dockWidth * 0.38, z: dockDepth * 0.35 },
        { x: 0, z: dockDepth * 0.35 },
        { x: dockWidth * 0.38, z: dockDepth * 0.35 },
        { x: -dockWidth * 0.38, z: -dockDepth * 0.35 },
        { x: 0, z: -dockDepth * 0.35 },
        { x: dockWidth * 0.38, z: -dockDepth * 0.35 },
        { x: -dockWidth * 0.38, z: 0 },
        { x: dockWidth * 0.38, z: 0 }
    ];

    supportLocal.forEach((pos) => {
        positions.push({
            x: pos.x,
            z: groupZ + pos.z,
            innerRadius: postRadius * 1.12
        });
    });

    return positions;
}

function finishDockMesh(mesh) {
    mesh.renderOrder = 20;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
        if (!mat) return;
        mat.depthWrite = true;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = 1;
        mat.polygonOffsetUnits = 1;
        if (mat.map) {
            mat.map.offset.set(0, 0);
        }
    });
}

/**
 * Lightweight stylized fishing dock — planks, posts, beams, rope. No GLB required.
 * @param {{
 *   water: { waterY: number },
 *   dockWidth?: number,
 *   dockDepth?: number,
 *   dockHeight?: number,
 *   waterBodyType?: string
 * }} options
 * @returns {THREE.Group}
 */
export function buildStylizedDock(options) {
    const {
        water,
        dockWidth = 3,
        dockDepth = 14,
        dockHeight = 0.3,
        waterBodyType = 'LAKE'
    } = options;

    const isPond = waterBodyType === 'POND';
    const isRiver = waterBodyType === 'RIVER';

    const woodTexture = getDockWoodTexture() || createProceduralDockWoodTexture();
    const deckTint = isPond ? 0xd4b896 : isRiver ? 0x9a7448 : 0xb89570;
    const postTint = isPond ? 0xa08058 : 0x5a3f28;
    const beamTint = isPond ? 0x8a6f4a : 0x6a4f3a;

    const deckMaterial = createDockWoodMaterial(woodTexture, {
        tint: deckTint,
        roughness: isRiver ? 0.92 : 0.86,
        repeat: [1.2, 4.5]
    });
    const postMaterial = createDockWoodMaterial(woodTexture, {
        tint: postTint,
        roughness: 0.94,
        repeat: [0.35, 1.8]
    });
    const beamMaterial = createDockWoodMaterial(woodTexture, {
        tint: beamTint,
        roughness: 0.93,
        repeat: [0.5, 3.2]
    });
    const ropeMaterial = createRopeMaterial();

    const dockGroup = new THREE.Group();
    const raisedDockY = water.waterY + 1.0;
    const deckTopY = raisedDockY;
    const waterSurfaceY = water.waterY;
    const plankThickness = dockHeight * 0.88;
    const deckPlankCenterY = deckTopY - plankThickness * 0.5;
    const postTopY = deckTopY - plankThickness;
    const postRadius = isPond ? 0.07 : 0.11;
    const postHeightBase = 1.5;
    const actualPostHeight = postTopY - waterSurfaceY;
    const postCenterY = (waterSurfaceY + postTopY) / 2;

    const postPositions = isPond ? [
        { x: -dockWidth * 0.32, z: dockDepth * 0.35 },
        { x: dockWidth * 0.32, z: dockDepth * 0.35 },
        { x: -dockWidth * 0.32, z: -dockDepth * 0.35 },
        { x: dockWidth * 0.32, z: -dockDepth * 0.35 }
    ] : [
        { x: -dockWidth * 0.38, z: dockDepth * 0.35 },
        { x: 0, z: dockDepth * 0.35 },
        { x: dockWidth * 0.38, z: dockDepth * 0.35 },
        { x: -dockWidth * 0.38, z: -dockDepth * 0.35 },
        { x: 0, z: -dockDepth * 0.35 },
        { x: dockWidth * 0.38, z: -dockDepth * 0.35 },
        { x: -dockWidth * 0.38, z: 0 },
        { x: dockWidth * 0.38, z: 0 }
    ];

    const postGeometry = new THREE.CylinderGeometry(
        postRadius,
        postRadius * 1.12,
        postHeightBase,
        isRiver ? 10 : 8
    );

    postPositions.forEach((pos) => {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.scale.y = actualPostHeight / postHeightBase;
        post.position.set(pos.x, postCenterY, pos.z);
        finishDockMesh(post);
        dockGroup.add(post);
    });

    const plankCount = isRiver ? 13 : 11;
    const plankGap = 0.01;
    const plankDepth = (dockDepth * 0.94) / plankCount - plankGap;
    const zStart = -dockDepth * 0.47;
    const deckFrontZ = zStart + plankCount * plankDepth + (plankCount - 1) * plankGap;

    for (let i = 0; i < plankCount; i++) {
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(dockWidth * 0.97, plankThickness, plankDepth),
            deckMaterial
        );
        plank.position.set(
            0,
            deckPlankCenterY,
            zStart + plankDepth * 0.5 + i * (plankDepth + plankGap)
        );
        finishDockMesh(plank);
        dockGroup.add(plank);
    }

    const beamHeight = isPond ? 0.09 : 0.11;
    const beamWidth = isPond ? 0.055 : 0.075;
    const beamY = postTopY - beamHeight * 0.5;
    const beamDepth = dockDepth * 0.94;

    [-0.45, 0, 0.45].forEach((xFactor) => {
        const beam = new THREE.Mesh(
            new THREE.BoxGeometry(beamWidth, beamHeight, beamDepth),
            beamMaterial
        );
        beam.position.set(dockWidth * xFactor, beamY, 0);
        finishDockMesh(beam);
        dockGroup.add(beam);
    });

    const railHeight = 0.11;
    const railWidth = 0.09;
    const frontRailZ = deckFrontZ - railWidth * 0.5 + 0.015;
    const frontRail = new THREE.Mesh(
        new THREE.BoxGeometry(dockWidth, railHeight, railWidth),
        postMaterial
    );
    frontRail.position.set(
        0,
        deckTopY + railHeight * 0.5,
        frontRailZ
    );
    finishDockMesh(frontRail);
    dockGroup.add(frontRail);

    const pillarAboveDeck = isRiver ? 0.18 : 0.14;
    const pillarBuriedBelowWater = 0.2;
    const pillarTopY = deckTopY + pillarAboveDeck;
    const pillarBottomY = waterSurfaceY - pillarBuriedBelowWater;
    const cornerPillarHeight = pillarTopY - pillarBottomY;
    const cornerPillarCenterY = (pillarTopY + pillarBottomY) * 0.5;
    const cornerPostTopRadius = isPond ? 0.17 : 0.23;
    const cornerPostBaseRadius = cornerPostTopRadius * 1.22;
    const cornerPostGeo = new THREE.CylinderGeometry(
        cornerPostTopRadius,
        cornerPostBaseRadius,
        cornerPillarHeight,
        12
    );
    const logEndCapMaterial = createLogEndCapMaterial();
    const logEndCapGeo = new THREE.CircleGeometry(cornerPostTopRadius * 1.02, 24);
    const cornerZ = deckFrontZ - railWidth * 0.15;
    [-1, 1].forEach((side) => {
        const cornerPost = new THREE.Mesh(cornerPostGeo, postMaterial);
        cornerPost.position.set(
            side * dockWidth * 0.48,
            cornerPillarCenterY,
            cornerZ
        );
        finishDockMesh(cornerPost);
        dockGroup.add(cornerPost);

        const logEndCap = new THREE.Mesh(logEndCapGeo, logEndCapMaterial);
        logEndCap.rotation.x = -Math.PI / 2;
        logEndCap.position.set(
            side * dockWidth * 0.48,
            pillarTopY + 0.004,
            cornerZ
        );
        finishDockMesh(logEndCap);
        dockGroup.add(logEndCap);
    });

    const railY = deckTopY + railHeight * 0.82;
    addRopeBetween(
        dockGroup,
        new THREE.Vector3(-dockWidth * 0.38, railY, frontRailZ),
        new THREE.Vector3(dockWidth * 0.38, railY, frontRailZ),
        ropeMaterial,
        {
            via: new THREE.Vector3(0, railY + 0.04, frontRailZ + 0.12),
            segments: 6
        }
    );
    addRopeBetween(
        dockGroup,
        new THREE.Vector3(-dockWidth * 0.38, railY - 0.12, frontRailZ - 0.02),
        new THREE.Vector3(dockWidth * 0.38, railY - 0.12, frontRailZ - 0.02),
        ropeMaterial,
        { sag: 0.08, segments: 5 }
    );

    const leftCorner = postPositions[0];
    if (leftCorner) {
        wrapPostRope(
            dockGroup,
            leftCorner.x,
            postCenterY + actualPostHeight * 0.15,
            leftCorner.z,
            postRadius * 2.2,
            ropeMaterial
        );
    }

    const bumperMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a4a6a,
        roughness: 0.92,
        metalness: 0.0
    });
    for (let i = 0; i < 3; i++) {
        const xPos = -dockWidth * 0.3 + i * (dockWidth * 0.3);
        const bumper = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8),
            bumperMaterial
        );
        bumper.rotation.x = Math.PI / 2;
        bumper.position.set(
            xPos,
            deckTopY + railHeight * 0.42,
            frontRailZ + railWidth * 0.5 + 0.07
        );
        finishDockMesh(bumper);
        dockGroup.add(bumper);
    }

    dockGroup.position.set(0, 0, -1.5);
    dockGroup.userData.isDock = true;
    dockGroup.traverse((child) => {
        if (child.isMesh) {
            child.userData.isDock = true;
        }
    });

    return dockGroup;
}

function addRopeBetween(group, start, end, material, options = {}) {
    const { via = null, sag = 0.05, segments = 6, radius = 0.016 } = options;
    const points = via
        ? [start, via, end]
        : [
            start,
            new THREE.Vector3((start.x + end.x) * 0.5, start.y - sag, (start.z + end.z) * 0.5),
            end
        ];
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segments, radius, 5, false),
        material
    );
    tube.castShadow = true;
    finishDockMesh(tube);
    group.add(tube);
}

function wrapPostRope(group, x, y, z, radius, material) {
    const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 5 }, (_, i) => {
            const angle = (i / 4) * Math.PI * 1.1 - 0.2;
            return new THREE.Vector3(
                x + Math.cos(angle) * radius,
                y + i * 0.09,
                z + Math.sin(angle) * radius
            );
        })
    );
    const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 6, 0.014, 4, false),
        material
    );
    tube.castShadow = true;
    finishDockMesh(tube);
    group.add(tube);
}
