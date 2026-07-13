import * as THREE from 'three';
import { getStylizedDockLocalMetrics } from '../scene/stylizedDock.js';

const DOLPHIN_VISIT_MIN_GAP = 180;
const DOLPHIN_VISIT_MAX_GAP = 340;
const DOLPHIN_FIRST_VISIT_MIN = 40;
const DOLPHIN_FIRST_VISIT_MAX = 100;

/** Cortez dock layout — matches stylizedDock / platform DOCK placement. */
const DOCK_GROUP_Z = -1.5;
const DOCK_DEPTH = 14;
const LAKE_DOCK_PLANK_COUNT = 11;

const _spawnScratch = new THREE.Vector3();
const _corridorScratch = new THREE.Vector3();
const _exitScratch = new THREE.Vector3();

const DOLPHIN_SKIN = new THREE.MeshStandardMaterial({
    color: 0x6b737a,
    roughness: 0.55,
    metalness: 0.05,
    transparent: false,
    opacity: 1,
    depthWrite: true
});

const DOLPHIN_BELLY = new THREE.MeshStandardMaterial({
    color: 0xc5c8c4,
    roughness: 0.62,
    metalness: 0,
    transparent: false,
    opacity: 1,
    depthWrite: true
});

const DOLPHIN_DARK = new THREE.MeshStandardMaterial({
    color: 0x2a3036,
    roughness: 0.7,
    metalness: 0,
    transparent: false,
    opacity: 1,
    depthWrite: true
});

const DOLPHIN_EYE = new THREE.MeshStandardMaterial({
    color: 0x5a6872,
    roughness: 0.32,
    metalness: 0.04,
    emissive: 0x0a1014,
    emissiveIntensity: 0.35,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
});

const DOLPHIN_EYE_SOCKET = new THREE.MeshStandardMaterial({
    color: 0x4a5258,
    roughness: 0.78,
    metalness: 0,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
});

const DOLPHIN_EYE_HIGHLIGHT = new THREE.MeshStandardMaterial({
    color: 0xf0f8ff,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
});

/**
 * Bottlenose dolphin eye — lateral, near the rostrum/melon junction.
 *
 * Real dolphins carry their eyes on the sides of the head at the corner
 * of the mouth, below the melon, facing outward for monocular vision.
 */
function createDolphinEye(parent, side) {
    const assembly = new THREE.Group();
    assembly.name = side < 0 ? 'dolphinEyeL' : 'dolphinEyeR';
    assembly.renderOrder = 4;

    /*
     * Sit on the lateral head profile just aft of the rostrum base.
     * Z is pushed slightly outside the body cross-section (~0.18 half-width)
     * so the eyes are not buried in the melon/body mesh.
     */
    assembly.position.set(
        0.108,
        0.024,
        side * 0.198
    );

    assembly.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, side)
    );

    parent.add(assembly);

    const socket = new THREE.Mesh(
        new THREE.SphereGeometry(0.019, 10, 8),
        DOLPHIN_EYE_SOCKET
    );
    socket.scale.set(0.78, 0.88, 0.42);
    socket.position.set(0, -0.001, side * 0.004);
    assembly.add(socket);

    const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 10, 8),
        DOLPHIN_EYE
    );
    eye.scale.set(0.68, 0.82, 1);
    eye.position.set(0, 0, side * 0.006);
    eye.renderOrder = 5;
    assembly.add(eye);

    const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 8, 6),
        DOLPHIN_DARK
    );
    pupil.scale.set(0.8, 1, 0.7);
    pupil.position.set(0, 0, side * 0.013);
    pupil.renderOrder = 6;
    assembly.add(pupil);

    const highlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.004, 6, 4),
        DOLPHIN_EYE_HIGHLIGHT
    );
    highlight.position.set(-0.002, 0.004, side * 0.016);
    highlight.renderOrder = 7;
    assembly.add(highlight);

    const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 8, 6),
        DOLPHIN_SKIN
    );
    lid.scale.set(0.88, 0.14, 0.55);
    lid.position.set(0, 0.009, side * 0.002);
    assembly.add(lid);

    return assembly;
}

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

function createBone(name, parent, x, y = 0, z = 0) {
    const bone = new THREE.Group();
    bone.name = name;
    bone.position.set(x, y, z);
    parent.add(bone);
    return bone;
}

/**
 * Anatomically shaped bottlenose dolphin body.
 *
 * +X = head
 * -X = tail
 * +Y = back
 * -Y = belly
 * Z = side-to-side width
 */
function createDolphinBodyGeometry() {
    const sections = [
        // x       vertical   width    vertical offset

        // Tail stock — narrow, but not pinched to a needle
        { x: -1.62, ry: 0.045, rz: 0.055, y:  0.000 },
        { x: -1.52, ry: 0.055, rz: 0.065, y:  0.002 },
        { x: -1.40, ry: 0.072, rz: 0.085, y:  0.004 },

        // Long, gradual caudal peduncle
        { x: -1.24, ry: 0.095, rz: 0.115, y:  0.008 },
        { x: -1.05, ry: 0.130, rz: 0.155, y:  0.014 },
        { x: -0.82, ry: 0.185, rz: 0.215, y:  0.022 },

        // Rear torso
        { x: -0.56, ry: 0.245, rz: 0.270, y:  0.029 },
        { x: -0.28, ry: 0.285, rz: 0.295, y:  0.034 },

        // Main torso — deepest close to front third
        { x:  0.00, ry: 0.300, rz: 0.305, y:  0.038 },
        { x:  0.22, ry: 0.288, rz: 0.298, y:  0.043 },

        // Chest into head
        { x:  0.40, ry: 0.250, rz: 0.270, y:  0.048 },
        { x:  0.54, ry: 0.200, rz: 0.225, y:  0.054 },
        { x:  0.64, ry: 0.150, rz: 0.180, y:  0.058 }
    ];

    const radialSegments = 32;
    const positions = [];
    const indices = [];
    const uvs = [];

    for (let s = 0; s < sections.length; s++) {
        const section = sections[s];

        for (let r = 0; r < radialSegments; r++) {
            const angle =
                (r / radialSegments) *
                Math.PI *
                2;

            /*
             * Slightly reshape the lower half of the body.
             *
             * A real dolphin is not a perfectly round torpedo:
             * the back is smoothly domed while the belly is
             * slightly flatter.
             */
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            let yScale = 1;

            if (sin < 0) {
                yScale = 0.91;
            }

            const x = section.x;

            const y =
                section.y +
                sin *
                section.ry *
                yScale;

            const z =
                cos *
                section.rz;

            positions.push(x, y, z);

            uvs.push(
                s / (sections.length - 1),
                r / radialSegments
            );
        }
    }

    /*
     * Connect all body rings.
     */
    for (let s = 0; s < sections.length - 1; s++) {
        for (let r = 0; r < radialSegments; r++) {
            const nextR =
                (r + 1) % radialSegments;

            const a =
                s * radialSegments + r;

            const b =
                (s + 1) * radialSegments + r;

            const c =
                (s + 1) * radialSegments + nextR;

            const d =
                s * radialSegments + nextR;

            indices.push(
                a, b, d,
                b, c, d
            );
        }
    }

    const geometry =
        new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
            uvs,
            2
        )
    );

    geometry.setIndex(indices);

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    return geometry;
}

function createDorsalFinGeometry() {
    const shape = new THREE.Shape();

    /*
     * IMPORTANT:
     *
     * +X = toward the head
     * -X = toward the tail
     *
     * So the fin must rise and sweep toward -X.
     */

    // Front/root of dorsal fin.
    shape.moveTo(
        0.26,
        0
    );

    /*
     * Rounded leading edge rising backward.
     */
    shape.quadraticCurveTo(
        0.17,
        0.17,
        0.015,
        0.34
    );

    /*
     * Rounded, backward-swept tip.
     */
    shape.quadraticCurveTo(
        -0.045,
        0.405,
        -0.105,
        0.365
    );

    /*
     * Concave trailing edge creates the classic
     * bottlenose dolphin hooked/falcate profile.
     */
    shape.bezierCurveTo(
        -0.155,
        0.325,

        -0.195,
        0.175,

        -0.36,
        0
    );

    /*
     * Broad attachment to the back.
     */
    shape.quadraticCurveTo(
        -0.05,
        -0.018,
        0.26,
        0
    );

    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(
        shape,
        {
            depth: 0.032,
            bevelEnabled: true,
            bevelThickness: 0.006,
            bevelSize: 0.006,
            bevelSegments: 3,
            curveSegments: 14
        }
    );

    /*
     * Center thickness around Z = 0.
     */
    geometry.translate(
        0,
        0,
        -0.016
    );

    geometry.computeVertexNormals();

    return geometry;
}

function createPecFinGeometry() {
    const shape = new THREE.Shape();

    /*
     * Root at shoulder.
     */
    shape.moveTo(
        0.10,
        0
    );

    /*
     * Front edge.
     */
    shape.quadraticCurveTo(
        0.04,
        0.15,
        -0.13,
        0.34
    );

    /*
     * Pointed tip.
     */
    shape.quadraticCurveTo(
        -0.22,
        0.43,
        -0.27,
        0.40
    );

    /*
     * Swept rear edge back to body.
     */
    shape.quadraticCurveTo(
        -0.17,
        0.18,
        -0.08,
        0.02
    );

    shape.closePath();

    const geometry =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: 0.028,
                bevelEnabled: true,
                bevelThickness: 0.006,
                bevelSize: 0.006,
                bevelSegments: 2,
                curveSegments: 8
            }
        );

    /*
     * Put the flipper across the X/Z plane.
     */
    geometry.rotateX(
        Math.PI * 0.5
    );

    geometry.computeVertexNormals();

    return geometry;
}

function createFlukeGeometry() {
    const shape = new THREE.Shape();

    /*
     * Shape is first created in XY:
     *
     * X = side-to-side width
     * Y = forward/back direction
     *
     * After rotation:
     * final X = forward/back
     * final Z = side-to-side
     */

    /*
     * Start at right side of the central attachment root.
     *
     * This is where the peduncle flows directly
     * into the flukes.
     */
    shape.moveTo(
        0.048,
        0.028
    );

    /*
     * RIGHT FLUKE
     *
     * Leading edge gradually sweeps outward
     * and backward.
     */
    shape.bezierCurveTo(
        0.13,
        0.018,

        0.29,
        -0.025,

        0.39,
        -0.075
    );

    /*
     * Rounded outer tip.
     */
    shape.quadraticCurveTo(
        0.435,
        -0.10,
        0.405,
        -0.125
    );

    /*
     * Curved trailing edge toward center.
     */
    shape.bezierCurveTo(
        0.32,
        -0.17,

        0.16,
        -0.185,

        0.065,
        -0.17
    );

    /*
     * Right half of center notch.
     */
    shape.quadraticCurveTo(
        0.025,
        -0.158,
        0,
        -0.115
    );

    /*
     * LEFT FLUKE
     *
     * Mirror the right side.
     */
    shape.quadraticCurveTo(
        -0.025,
        -0.158,
        -0.065,
        -0.17
    );

    shape.bezierCurveTo(
        -0.16,
        -0.185,

        -0.32,
        -0.17,

        -0.405,
        -0.125
    );

    /*
     * Rounded outer tip.
     */
    shape.quadraticCurveTo(
        -0.435,
        -0.10,
        -0.39,
        -0.075
    );

    /*
     * Leading edge returns toward central root.
     */
    shape.bezierCurveTo(
        -0.29,
        -0.025,

        -0.13,
        0.018,

        -0.048,
        0.028
    );

    /*
     * Small curved central attachment area.
     * This lets the peduncle blend into the flukes
     * instead of touching them at a single point.
     */
    shape.quadraticCurveTo(
        0,
        0.045,
        0.048,
        0.028
    );

    shape.closePath();

    const depth = 0.018;

    const geometry = new THREE.ExtrudeGeometry(
        shape,
        {
            depth,
            bevelEnabled: true,
            bevelThickness: 0.004,
            bevelSize: 0.005,
            bevelSegments: 3,
            curveSegments: 16
        }
    );

    /*
     * Center the fluke thickness only.
     *
     * DO NOT use geometry.center() here.
     * We want the central attachment root to remain
     * positioned correctly relative to flukeBone.
     */
    geometry.translate(
        0,
        0,
        -depth * 0.5
    );

    /*
     * Lay the flukes horizontally:
     *
     * body axis = X
     * vertical  = Y
     * wingspan  = Z
     */
    geometry.rotateX(
        Math.PI * 0.5
    );

    geometry.rotateY(
        Math.PI * 0.5
    );

    geometry.computeVertexNormals();

    return geometry;
}

/** Chest-local distance from shoulders to fluke root (matches bone chain). */
const TAIL_SPAN = 1.62;
const TAIL_WAVE_LAG = 1.05;
const MID_BONE_X = -0.64;
const PEDUNCLE_BONE_X = -0.64;
const FLUKE_BONE_X = -0.34;
const TAIL_BONE_S = {
    mid: 0.64 / TAIL_SPAN,
    peduncle: 1.28 / TAIL_SPAN,
    fluke: 1
};

function normalizedTailS(baseX) {
    return THREE.MathUtils.clamp(
        (-baseX - 0.05) / TAIL_SPAN,
        0,
        1
    );
}

/** Shared traveling-wave angle along the tail (radians). */
function tailWaveAngle(swimPhase, s, drive) {
    const amp = THREE.MathUtils.lerp(
        0.04,
        0.40,
        s * s
    );

    return Math.sin(
        swimPhase - s * TAIL_WAVE_LAG
    ) *
    amp *
    drive;
}

/**
 * Exact chest-local position of a rest-space body point after the same
 * FK chain that drives mid → peduncle → fluke bones.
 *
 * Rest spine: chest(0) → mid(-0.64) → ped(-1.28) → fluke(-1.62)
 */
function skinTailPoint(baseX, baseY, baseZ, thetaMid, thetaPedInc, thetaFlukeInc) {
    const restDist = -baseX;

    /*
     * Forward of mid joint — slight shared bend so the rear torso
     * starts participating before the first bone.
     */
    if (restDist <= 0) {
        return { x: baseX, y: baseY, z: baseZ };
    }

    if (restDist < 0.64) {
        const t = restDist / 0.64;
        const angle = thetaMid * t * t;
        const c = Math.cos(angle);
        const s = Math.sin(angle);

        return {
            x: baseX * c - baseY * s,
            y: baseX * s + baseY * c,
            z: baseZ
        };
    }

    /*
     * midBone origin is fixed in chest space; its rotation swings
     * everything distal (peduncle, fluke, and body stock).
     */
    const midOriginX = MID_BONE_X;
    const midOriginY = 0;
    const c1 = Math.cos(thetaMid);
    const s1 = Math.sin(thetaMid);

    if (restDist < 1.28) {
        const localX = baseX - MID_BONE_X;
        const localY = baseY;
        const t = (restDist - 0.64) / 0.64;
        const angle = thetaPedInc * t;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const lx = localX * c - localY * s;
        const ly = localX * s + localY * c;

        return {
            x: midOriginX + lx * c1 - ly * s1,
            y: midOriginY + lx * s1 + ly * c1,
            z: baseZ
        };
    }

    /*
     * Peduncle joint in chest space after midBone rotation.
     */
    const pedLocalX = PEDUNCLE_BONE_X;
    const pedLocalY = 0;
    const pedX =
        midOriginX +
        pedLocalX * c1 -
        pedLocalY * s1;
    const pedY =
        midOriginY +
        pedLocalX * s1 +
        pedLocalY * c1;
    const angleToPed = thetaMid + thetaPedInc;
    const c2 = Math.cos(angleToPed);
    const s2 = Math.sin(angleToPed);

    const localX = baseX - (MID_BONE_X + PEDUNCLE_BONE_X);
    const localY = baseY;
    const t = THREE.MathUtils.clamp(
        (restDist - 1.28) / 0.34,
        0,
        1
    );
    const angle = thetaFlukeInc * t;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const lx = localX * c - localY * s;
    const ly = localX * s + localY * c;

    return {
        x: pedX + lx * c2 - ly * s2,
        y: pedY + lx * s2 + ly * c2,
        z: baseZ
    };
}

function applyDolphinTailKinematics(data, swimPhase, drive) {
    const angleMid = tailWaveAngle(
        swimPhase,
        TAIL_BONE_S.mid,
        drive
    );
    const anglePed = tailWaveAngle(
        swimPhase,
        TAIL_BONE_S.peduncle,
        drive
    );
    const angleFluke = tailWaveAngle(
        swimPhase,
        TAIL_BONE_S.fluke,
        drive
    );

    const thetaMid = angleMid;
    const thetaPedInc = anglePed - angleMid;
    const thetaFlukeInc = angleFluke - anglePed;

    /*
     * Each bone carries the incremental bend since its parent,
     * so the cumulative rotation at the fluke matches the body
     * flex at the tail stock.
     */
    data.midBone.rotation.z = thetaMid;
    data.peduncleBone.rotation.z = thetaPedInc;
    data.flukeBone.rotation.z = thetaFlukeInc;

    data.midBone.rotation.x = 0;
    data.peduncleBone.rotation.x = 0;
    data.flukeBone.rotation.x = 0;

    if (data.fluke) {
        data.fluke.rotation.z = 0;
    }

    data._tailThetaMid = thetaMid;
    data._tailThetaPedInc = thetaPedInc;
    data._tailThetaFlukeInc = thetaFlukeInc;
}

/**
 * Flex the continuous body mesh with the exact same FK as the tail bones
 * so the peduncle and flukes stay attached through the stroke.
 */
function deformDolphinBody(data, swimPhase, drive) {
    const body = data.body;

    if (!body?.geometry?.attributes?.position) {
        return;
    }

    const position = body.geometry.attributes.position;
    const base = body.userData.basePositions;

    if (!base) {
        return;
    }

    const thetaMid = data._tailThetaMid ?? 0;
    const thetaPedInc = data._tailThetaPedInc ?? 0;
    const thetaFlukeInc = data._tailThetaFlukeInc ?? 0;

    for (let i = 0; i < position.count; i++) {
        const index = i * 3;

        const baseX = base[index];
        const baseY = base[index + 1];
        const baseZ = base[index + 2];

        if (baseX > -0.05) {
            position.setXYZ(i, baseX, baseY, baseZ);
            continue;
        }

        const skinned = skinTailPoint(
            baseX,
            baseY,
            baseZ,
            thetaMid,
            thetaPedInc,
            thetaFlukeInc
        );

        position.setXYZ(
            i,
            skinned.x,
            skinned.y,
            skinned.z
        );
    }

    position.needsUpdate = true;

    // No need to recalculate normals every single frame.
    data.normalUpdateCounter =
        (data.normalUpdateCounter + 1) % 3;

    if (data.normalUpdateCounter === 0) {
        body.geometry.computeVertexNormals();
    }
}

function buildDolphinMesh(random) {
    const dolphin = new THREE.Group();
    dolphin.name = 'cortezDolphin';

    const pitchBone = createBone('dolphinPitch', dolphin, 0, 0, 0);
    const chestBone = createBone('dolphinChest', pitchBone, 0, 0, 0);
    const headBone = createBone('dolphinHead', chestBone, 0.55, 0.02, 0);
    const midBone = createBone('dolphinMid', chestBone, -0.64, 0, 0);
    const peduncleBone = createBone('dolphinPeduncle', midBone, -0.64, 0, 0);
    const flukeBone = createBone('dolphinFluke', peduncleBone, -0.34, 0, 0);

    const bodyGeometry = createDolphinBodyGeometry();
    const body = new THREE.Mesh(
        bodyGeometry,
        DOLPHIN_SKIN
    );
    body.userData.basePositions =
        new Float32Array(
            bodyGeometry.attributes.position.array
        );
    body.castShadow = true;
    body.receiveShadow = true;
    chestBone.add(body);

    // Melon — rounded forehead blending into the skull, not a separate ball.
    const melon = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.16,
            20,
            14
        ),
        DOLPHIN_SKIN
    );

    melon.scale.set(
        1.15,  // length
        1.05,  // height
        1.12   // width
    );

    /*
     * Push it back into the head so it blends
     * instead of looking like a separate ball.
     */
    melon.position.set(
        0.015,
        0.065,
        0
    );

    melon.castShadow = true;

    headBone.add(melon);

    /*
     * Thick, blunt bottlenose rostrum.
     *
     * CylinderGeometry:
     * topRadius    = front tip
     * bottomRadius = rear/base
     */
    const beak = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.046,  // rounded front
            0.066,  // thicker base
            0.32,
            16,
            4,
            false
        ),
        DOLPHIN_SKIN
    );

    beak.rotation.z =
        -Math.PI * 0.5;

    beak.position.set(
        0.29,
        -0.025,
        0
    );

    beak.scale.set(
        1,
        1,
        1.08
    );

    beak.castShadow = true;

    headBone.add(beak);

    const noseTip = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.047,
            14,
            10
        ),
        DOLPHIN_SKIN
    );

    noseTip.scale.set(
        0.58,
        0.88,
        1.05
    );

    noseTip.position.set(
        0.455,
        -0.025,
        0
    );

    noseTip.castShadow = true;

    headBone.add(noseTip);

    const lowerJaw = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.036,
            0.052,
            0.29,
            14,
            3
        ),
        DOLPHIN_BELLY
    );

    lowerJaw.rotation.z =
        -Math.PI * 0.5;

    lowerJaw.position.set(
        0.275,
        -0.070,
        0
    );

    lowerJaw.scale.set(
        1,
        0.72,
        1.02
    );

    lowerJaw.castShadow = true;

    headBone.add(lowerJaw);

    for (const side of [-1, 1]) {
        createDolphinEye(headBone, side);
    }

    const dorsal = new THREE.Mesh(createDorsalFinGeometry(), DOLPHIN_SKIN);
    dorsal.position.set(
        -0.18,
        0.285,
        0
    );
    dorsal.castShadow = true;
    chestBone.add(dorsal);

    const pecGeo =
        createPecFinGeometry();

    for (const side of [-1, 1]) {
        const pec = new THREE.Mesh(
            pecGeo,
            DOLPHIN_SKIN
        );

        pec.position.set(
            0.18,
            -0.11,
            side * 0.245
        );

        /*
         * Mirror across the body.
         */
        pec.scale.z = side;

        /*
         * Slight natural downward angle.
         */
        pec.rotation.x =
            side * -0.20;

        pec.rotation.y =
            side * 0.06;

        pec.castShadow = true;

        chestBone.add(pec);
    }

    const fluke = new THREE.Mesh(createFlukeGeometry(), DOLPHIN_SKIN);
    fluke.scale.set(1, 1, 1);
    fluke.castShadow = true;
    flukeBone.add(fluke);

    dolphin.scale.setScalar(THREE.MathUtils.lerp(1.05, 1.2, random()));

    Object.assign(dolphin.userData, {
        body,
        fluke,
        pitchBone,
        chestBone,
        headBone,
        midBone,
        peduncleBone,
        flukeBone,
        random,
        phase: random() * Math.PI * 2,
        velocity: new THREE.Vector3(),
        target: new THREE.Vector3(),
        entry: new THREE.Vector3(),
        pass: new THREE.Vector3(),
        exit: new THREE.Vector3(),
        headingToPass: false,
        mode: 'dormant',
        modeTime: 0,
        visitCooldown: THREE.MathUtils.lerp(
            DOLPHIN_FIRST_VISIT_MIN,
            DOLPHIN_FIRST_VISIT_MAX,
            random()
        ),
        cruiseDepth: 0,
        waterLevel: 0,
        swimDepth: -0.34,
        tailBeatSpeed: THREE.MathUtils.lerp(4.2, 5.0, random()),
        surfaceInterval: THREE.MathUtils.lerp(8, 13, random()),
        surfaceDuration: THREE.MathUtils.lerp(2.7, 3.6, random()),
        surfaceRise: THREE.MathUtils.lerp(0.42, 0.52, random()),
        surfacePhase: random() * 12,
        normalUpdateCounter: 0,
        smoothedPitch: 0,
        wasAboveWater: false,
        splashAt: null,
        speed: THREE.MathUtils.lerp(1.1, 1.55, random()),
        turnSharpness: THREE.MathUtils.lerp(1.6, 2.4, random()),
        lastElapsedTime: 0
    });

    dolphin.visible = false;
    return dolphin;
}

function parkDolphinOffscreen(dolphin) {
    const data = dolphin.userData;
    dolphin.position.set(-45, data.swimDepth, 45);
    dolphin.rotation.set(0, 0, 0);
    data.velocity.set(0, 0, 0);
    data.flukeBone.rotation.z = 0;
    data.peduncleBone.rotation.z = 0;
    data.midBone.rotation.z = 0;
    data.flukeBone.rotation.x = 0;
    data.peduncleBone.rotation.x = 0;
    data.midBone.rotation.x = 0;
    if (data.fluke) {
        data.fluke.position.y = 0;
        data.fluke.rotation.z = 0;
    }
    data.chestBone.rotation.z = 0;
    data.pitchBone.rotation.z = 0;
    data.headBone.rotation.z = 0;
    data.smoothedPitch = 0;
    data.wasAboveWater = false;
    dolphin.visible = false;
}

function getCortezFishingCorridor() {
    const { deckFrontZ } = getStylizedDockLocalMetrics(
        DOCK_DEPTH,
        LAKE_DOCK_PLANK_COUNT
    );
    const catStandZ = DOCK_GROUP_Z + DOCK_DEPTH * 0.35;
    const dockFrontWorldZ = DOCK_GROUP_Z + deckFrontZ;

    /*
     * Keep a clear standoff from the dock. A dolphin may cruise the
     * fishing flats, but it should not hug the pilings.
     */
    const dockKeepOutZ = dockFrontWorldZ + 6.5;

    return {
        xMin: -7.5,
        xMax: 7.5,
        zMin: Math.max(catStandZ + 7.5, dockKeepOutZ),
        zMax: catStandZ + 16.5,
        dockKeepOutZ
    };
}

/**
 * Build a curious crossing: enter from open water, cut through the
 * fishing flats, leave the other way — never close to the dock.
 */
function pickDolphinCrossing(data, random) {
    const corridor = getCortezFishingCorridor();

    const passZ = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(corridor.zMin, corridor.zMax, 0.4),
        corridor.zMax,
        random()
    );
    const passX = THREE.MathUtils.lerp(
        corridor.xMin,
        corridor.xMax,
        random()
    );

    const leftX = -THREE.MathUtils.lerp(18, 26, random());
    const rightX = THREE.MathUtils.lerp(18, 26, random());
    const flankZ = THREE.MathUtils.lerp(
        passZ - 1.5,
        passZ + 4,
        random()
    );
    const deepZ = THREE.MathUtils.lerp(
        corridor.zMax + 5,
        corridor.zMax + 14,
        random()
    );

    const pathRoll = random();
    let entry;
    let exit;

    if (pathRoll < 0.4) {
        // Classic left ↔ right across the fishing lane
        entry = _spawnScratch.set(leftX, 0, flankZ);
        exit = _exitScratch.set(rightX, 0, flankZ + THREE.MathUtils.lerp(-2, 3, random()));
    } else if (pathRoll < 0.7) {
        // Right ↔ left
        entry = _spawnScratch.set(rightX, 0, flankZ);
        exit = _exitScratch.set(leftX, 0, flankZ + THREE.MathUtils.lerp(-2, 3, random()));
    } else if (pathRoll < 0.85) {
        // Deep water → across fishing flat → opposite flank
        const fromLeft = random() < 0.5;
        entry = _spawnScratch.set(
            fromLeft ? leftX * 0.7 : rightX * 0.7,
            0,
            deepZ
        );
        exit = _exitScratch.set(
            fromLeft ? rightX : leftX,
            0,
            passZ + THREE.MathUtils.lerp(1, 5, random())
        );
    } else {
        // Flank → fishing flat → deep water exit
        const fromLeft = random() < 0.5;
        entry = _spawnScratch.set(
            fromLeft ? leftX : rightX,
            0,
            passZ + THREE.MathUtils.lerp(-1, 2, random())
        );
        exit = _exitScratch.set(
            fromLeft ? rightX * 0.55 : leftX * 0.55,
            0,
            deepZ
        );
    }

    /*
     * Leave from the fishing waypoint into open water.
     * Prefer the opposite lateral flank so the path crosses the
     * cast zone without running toward the dock.
     */
    const approachTowardDock = passZ < entry.z - 1.5;
    const side = Math.sign(passX - entry.x) || (random() < 0.5 ? 1 : -1);

    if (approachTowardDock) {
        exit.set(
            side * THREE.MathUtils.lerp(18, 26, random()),
            0,
            Math.max(passZ, corridor.zMin) + THREE.MathUtils.lerp(1, 6, random())
        );
    } else {
        const toPassX = passX - entry.x;
        const toPassZ = passZ - entry.z;
        const toPassLen = Math.max(Math.hypot(toPassX, toPassZ), 0.001);
        const beyond = THREE.MathUtils.lerp(14, 22, random());

        exit.set(
            passX + (toPassX / toPassLen) * beyond,
            0,
            passZ + (toPassZ / toPassLen) * beyond
        );

        if (exit.z < corridor.dockKeepOutZ + 1 || Math.abs(exit.x) < 12) {
            exit.set(
                side * THREE.MathUtils.lerp(18, 26, random()),
                0,
                Math.max(passZ, corridor.zMin) + THREE.MathUtils.lerp(2, 8, random())
            );
        }
    }

    entry.z = Math.max(entry.z, corridor.dockKeepOutZ);
    exit.z = Math.max(exit.z, corridor.dockKeepOutZ);

    _corridorScratch.set(passX, 0, passZ);

    if (random() < 0.5) {
        data.entry.copy(exit);
        data.exit.copy(entry);
    } else {
        data.entry.copy(entry);
        data.exit.copy(exit);
    }

    data.pass.copy(_corridorScratch);
}

function beginDolphinVisit(dolphin, data, random) {
    pickDolphinCrossing(data, random);

    dolphin.position.set(data.entry.x, data.swimDepth, data.entry.z);
    data.target.copy(data.pass);
    data.headingToPass = true;
    data.mode = 'cruising';
    data.modeTime = THREE.MathUtils.lerp(18, 28, random());
    dolphin.visible = true;

    const dx = data.target.x - dolphin.position.x;
    const dz = data.target.z - dolphin.position.z;
    dolphin.rotation.y = Math.atan2(-dz, dx);
}

function finishDolphinVisit(data, random) {
    data.mode = 'exiting';
    data.modeTime = THREE.MathUtils.lerp(5, 9, random());
    data.target.copy(data.exit);
}

function updateDolphinSwim(
    dolphin,
    data,
    delta,
    elapsedTime
) {
    const dx =
        data.target.x - dolphin.position.x;

    const dz =
        data.target.z - dolphin.position.z;

    const distance = Math.hypot(dx, dz);

    /*
     * Horizontal swimming movement.
     */
    if (distance > 0.3) {
        const inv =
            1 / Math.max(distance, 0.0001);

        const desiredVX =
            dx * inv * data.speed;

        const desiredVZ =
            dz * inv * data.speed;

        const steering =
            1 -
            Math.exp(
                -data.turnSharpness * delta
            );

        data.velocity.x +=
            (desiredVX - data.velocity.x) *
            steering;

        data.velocity.z +=
            (desiredVZ - data.velocity.z) *
            steering;

        dolphin.position.x +=
            data.velocity.x * delta;

        dolphin.position.z +=
            data.velocity.z * delta;

        const heading = Math.atan2(
            -data.velocity.z,
            data.velocity.x
        );

        let yawDelta =
            heading - dolphin.rotation.y;

        yawDelta =
            ((yawDelta + Math.PI) %
                (Math.PI * 2)) -
            Math.PI;

        if (yawDelta < -Math.PI) {
            yawDelta += Math.PI * 2;
        }

        dolphin.rotation.y +=
            yawDelta *
            (
                1 -
                Math.exp(-3.2 * delta)
            );
    } else {
        data.velocity.multiplyScalar(
            Math.pow(0.12, delta)
        );
    }

    /*
     * Most of the time the dolphin cruises underwater.
     *
     * Only occasionally does it rise naturally toward
     * the surface and then descend again.
     */
    const surfaceCycle =
        (
            elapsedTime +
            data.surfacePhase
        ) %
        data.surfaceInterval;

    let surfaceArc = 0;
    let pitchTarget = 0;

    if (
        surfaceCycle <
        data.surfaceDuration
    ) {
        const progress =
            surfaceCycle /
            data.surfaceDuration;

        /*
         * Smooth 0 -> 1 -> 0 arc.
         * Starts and ends with zero vertical velocity.
         */
        surfaceArc =
            0.5 -
            0.5 *
            Math.cos(
                progress *
                Math.PI *
                2
            );

        /*
         * Positive while rising.
         * Zero at top.
         * Negative while descending.
         */
        const slope =
            Math.sin(
                progress *
                Math.PI *
                2
            );

        pitchTarget =
            slope * 0.22;
    }

    /*
     * Tiny natural underwater depth drift.
     * This is subtle and does not look like bouncing.
     */
    const depthDrift =
        Math.sin(
            elapsedTime * 0.35 +
            data.phase
        ) *
        0.025;

    const targetY =
        data.swimDepth +
        depthDrift +
        surfaceArc *
        data.surfaceRise;

    const verticalResponse =
        1 -
        Math.exp(-2.5 * delta);

    dolphin.position.y +=
        (
            targetY -
            dolphin.position.y
        ) *
        verticalResponse;

    /*
     * Whole-body pitch follows the swimming path.
     * The head should not nod with every tail stroke.
     */
    data.smoothedPitch +=
        (
            pitchTarget -
            data.smoothedPitch
        ) *
        (
            1 -
            Math.exp(-3.8 * delta)
        );

    dolphin.rotation.z = 0;

    /*
     * Tail propulsion.
     */
    const swimPhase =
        elapsedTime *
        data.tailBeatSpeed +
        data.phase;

    const speedRatio =
        THREE.MathUtils.clamp(
            Math.hypot(
                data.velocity.x,
                data.velocity.z
            ) /
            Math.max(data.speed, 0.1),
            0,
            1
        );

    /*
     * Dolphins do not necessarily beat the tail
     * at exactly the same strength forever.
     * This gives gentle periods of effort and glide.
     */
    const effortCycle =
        0.5 +
        0.5 *
        Math.sin(
            elapsedTime * 0.52 +
            data.phase
        );

    const effort =
        0.38 +
        Math.pow(
            effortCycle,
            1.5
        ) *
        0.62;

    const drive =
        THREE.MathUtils.clamp(
            speedRatio *
            effort +
            surfaceArc * 0.18,
            0.22,
            1
        );

    /*
     * Vertical tail beat — flukes move up and down through the peduncle.
     * Apply surfacing pitch on a dedicated bone so it does not compete
     * with the tail stroke on the same local axis.
     */
    data.chestBone.rotation.z = 0;
    data.pitchBone.rotation.z = data.smoothedPitch;

    applyDolphinTailKinematics(
        data,
        swimPhase,
        drive
    );

    /*
     * Keep the head stable.
     *
     * This is extremely important for making the
     * dolphin look powerful instead of wiggly.
     */
    data.headBone.rotation.z = 0;

    /*
     * Flex the continuous body mesh.
     */
    deformDolphinBody(
        data,
        swimPhase,
        drive
    );

    /*
     * Surface splash detection.
     */
    const aboveWater =
        dolphin.position.y >
        data.waterLevel + 0.02;

    if (
        aboveWater &&
        !data.wasAboveWater &&
        data.splashAt
    ) {
        data.splashAt(
            dolphin.position.x,
            dolphin.position.z
        );
    }

    data.wasAboveWater = aboveWater;
}

function updateDolphin(dolphin, elapsedTime, delta) {
    const data = dolphin.userData;

    if (data.mode === 'dormant') {
        data.visitCooldown -= delta;
        if (data.visitCooldown <= 0) {
            beginDolphinVisit(dolphin, data, data.random);
        }
        return;
    }

    data.modeTime -= delta;

    if (data.mode === 'cruising') {
        if (
            data.headingToPass &&
            Math.hypot(
                data.pass.x - dolphin.position.x,
                data.pass.z - dolphin.position.z
            ) < 2.8
        ) {
            data.headingToPass = false;
            data.target.copy(data.exit);
        }

        if (
            data.modeTime <= 0 ||
            (
                !data.headingToPass &&
                Math.hypot(
                    data.exit.x - dolphin.position.x,
                    data.exit.z - dolphin.position.z
                ) < 2.5
            )
        ) {
            finishDolphinVisit(data, data.random);
        }
    } else if (data.mode === 'exiting') {
        if (
            data.modeTime <= 0 ||
            Math.hypot(
                data.exit.x - dolphin.position.x,
                data.exit.z - dolphin.position.z
            ) < 1.5
        ) {
            data.mode = 'dormant';
            data.visitCooldown = THREE.MathUtils.lerp(
                DOLPHIN_VISIT_MIN_GAP,
                DOLPHIN_VISIT_MAX_GAP,
                data.random()
            );
            parkDolphinOffscreen(dolphin);
            return;
        }
    }

    updateDolphinSwim(dolphin, data, delta, elapsedTime);
}

/**
 * Occasional 3D dolphin visitor for Cortez Backwaters.
 */
export function createCortezDolphin(scene, {
    waterLevel = 0,
    seed = 91247
} = {}) {
    const root = new THREE.Group();
    root.name = 'cortezDolphinRoot';

    const random = mulberry32(seed);
    const dolphin = buildDolphinMesh(random);
    dolphin.userData.waterLevel = waterLevel;
    dolphin.userData.swimDepth = waterLevel - 0.34;
    dolphin.userData.cruiseDepth = dolphin.userData.swimDepth;
    parkDolphinOffscreen(dolphin);

    root.add(dolphin);
    root.userData.dolphin = dolphin;
    root.userData.waterLevel = waterLevel;
    root.visible = false;
    scene.add(root);

    return root;
}

export function syncCortezDolphinVisibility(group, visible) {
    if (!group) {
        return;
    }

    group.visible = visible === true;

    const dolphin = group.userData.dolphin;
    if (!visible && dolphin && dolphin.userData.mode !== 'dormant') {
        dolphin.userData.mode = 'dormant';
        dolphin.userData.visitCooldown = THREE.MathUtils.lerp(
            DOLPHIN_VISIT_MIN_GAP,
            DOLPHIN_VISIT_MAX_GAP,
            dolphin.userData.random()
        );
        parkDolphinOffscreen(dolphin);
    }
}

export function forceSpawnCortezDolphin(group) {
    const dolphin = group?.userData?.dolphin;
    if (!dolphin) {
        return false;
    }

    const data = dolphin.userData;
    data.mode = 'dormant';
    data.visitCooldown = 0;
    beginDolphinVisit(dolphin, data, data.random);
    return true;
}

export function updateCortezDolphin(group, elapsedTime, delta, isCortez, context = {}) {
    if (!group || !isCortez) {
        return;
    }

    const dolphin = group.userData.dolphin;
    if (!dolphin) {
        return;
    }

    const splashAt = context.water?.mesh?.splashAt?.bind(context.water.mesh);
    if (splashAt) {
        dolphin.userData.splashAt = splashAt;
    }

    updateDolphin(dolphin, elapsedTime, delta);
}
