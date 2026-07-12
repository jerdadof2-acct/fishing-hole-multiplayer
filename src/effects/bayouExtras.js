import * as THREE from 'three';
import { GROUND_SIZE, LAKE_MASK_PROFILE } from '../buildLakeMask.js';
import {
    BAYOU_LOG_SHADOW_RENDER_ORDER,
    createBayouSunShadowMaterial
} from './bayouWaterShadows.js';
import {
    createWeatheredLogEndMaterial,
    createWeatheredLogSurfaceMaterial
} from './bayouLogTextures.js';

const MASK_ROTATE = LAKE_MASK_PROFILE.rotate;

const CAST_CLEAR_CENTER_X = 0;
const CAST_CLEAR_CENTER_Z = 2.5;
const CAST_CLEAR_RADIUS_X = 11;
const CAST_CLEAR_RADIUS_Z = 30;

const LOG_COUNT = 9;
const DRAGONFLY_COUNT = 2;
const TURTLE_COUNT = 2;
const GATOR_COUNT = 1;
const GATOR_BOBBER_STARTLE_RADIUS = 2.5;
const GATOR_BOBBER_STARTLE_COOLDOWN_MS = 10000;
const _gatorSnoutScratch = new THREE.Vector3();
const _gatorSnoutLocal = new THREE.Vector3();

/** Same sun-shadow decal as the bayou water surface — horizontal logs need this to read like trunks. */
const LOG_SUN_SHADOW_MATERIAL = createBayouSunShadowMaterial();

const MOSS_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x4a5648,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: true,
    envMapIntensity: 1.0
});

const DRAGONFLY_BODY_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x375a4f,
    roughness: 0.65,
    metalness: 0.05
});

const DRAGONFLY_EYE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x101820,
    roughness: 0.28,
    metalness: 0.18,
    emissive: 0x0c1a18,
    emissiveIntensity: 0.35
});

const DRAGONFLY_EYE_HIGHLIGHT_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xb8e8e0,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
});

const DRAGONFLY_WING_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xb8d3cf,
    roughness: 0.5,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false
});

const DRAGONFLY_WING_BLUR_LAYERS = [
    { spread: -0.26, opacity: 0.06, widthScale: 2.55 },
    { spread: -0.13, opacity: 0.1, widthScale: 2.15 },
    { spread: 0, opacity: 0.14, widthScale: 1.85 },
    { spread: 0.13, opacity: 0.1, widthScale: 2.15 },
    { spread: 0.26, opacity: 0.06, widthScale: 2.55 }
];

const _dragonflyWingBlurMaterials = new Map();

function getDragonflyWingBlurMaterial(opacity) {
    const key = opacity.toFixed(2);

    if (!_dragonflyWingBlurMaterials.has(key)) {
        _dragonflyWingBlurMaterials.set(
            key,
            new THREE.MeshStandardMaterial({
                color: 0xb8d3cf,
                roughness: 0.55,
                metalness: 0,
                transparent: true,
                opacity,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
    }

    return _dragonflyWingBlurMaterials.get(key);
}

const TURTLE_SHELL_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x2a3628,
    roughness: 0.88,
    metalness: 0
});

const TURTLE_SKIN_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x354636,
    roughness: 0.82,
    metalness: 0
});

const TURTLE_SHELL_EDGE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x1f2b20,
    roughness: 0.94,
    metalness: 0
});

const TURTLE_SCUTE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x46533a,
    roughness: 0.9,
    metalness: 0
});

const TURTLE_STRIPE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x8a9a45,
    roughness: 0.86,
    metalness: 0
});

const TURTLE_EYE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x090b08,
    roughness: 0.32,
    metalness: 0.05
});

const GATOR_SKIN_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x2f3a2d,
    roughness: 0.9,
    metalness: 0
});

const GATOR_DARK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x1e261d,
    roughness: 0.95,
    metalness: 0
});

const GATOR_EYE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xf2dc50,
    roughness: 0.22,
    metalness: 0.05,
    emissive: 0xc4a820,
    emissiveIntensity: 0.88
});

const GATOR_SCUTE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x232c22,
    roughness: 0.92,
    metalness: 0
});

const BOAT_ANCHOR_X = 0;
const BOAT_ANCHOR_Z = -1.5;

function isMobileViewport() {
    return typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Local pose on {@link Cat#getHatPerchAnchor} — head toward the water. */
const HAT_DRAGONFLY_PERCH_ROT = {
    x: 0.08,
    y: -Math.PI * 0.5,
    z: 0.02
};

const _hatPerchWorld = new THREE.Vector3();
const _worldScratch = new THREE.Vector3();

function pickRestHoverPoint(data, random) {
    data.currentTarget.set(
        data.center.x +
        THREE.MathUtils.lerp(-data.flightRadiusX * 0.55, data.flightRadiusX * 0.55, random()),
        data.center.y +
        THREE.MathUtils.lerp(-data.heightRange * 0.35, data.heightRange * 0.35, random()),
        data.center.z +
        THREE.MathUtils.lerp(-data.flightRadiusZ * 0.55, data.flightRadiusZ * 0.55, random())
    );
}

function pickPatrolDart(data, random, position) {
    const dartAngle = random() * Math.PI * 2;
    const dartDistance = THREE.MathUtils.lerp(1.0, 3.2, random());
    const center = data.center;

    data.flyHeadFirst = random() < 0.8;
    if (!data.flyHeadFirst) {
        data.headingSlip = THREE.MathUtils.lerp(-0.75, 0.75, random());
    }

    data.currentTarget.set(
        THREE.MathUtils.clamp(
            position.x + Math.cos(dartAngle) * dartDistance,
            center.x - data.flightRadiusX,
            center.x + data.flightRadiusX
        ),
        THREE.MathUtils.clamp(
            center.y +
            THREE.MathUtils.lerp(-data.heightRange, data.heightRange, random()),
            center.y - data.heightRange,
            center.y + data.heightRange
        ),
        THREE.MathUtils.clamp(
            position.z + Math.sin(dartAngle) * dartDistance,
            center.z - data.flightRadiusZ,
            center.z + data.flightRadiusZ
        )
    );
    data.nextDecisionTime = THREE.MathUtils.lerp(0.22, 0.48, random());
}

function getHatPerchWorld(cat, target = _hatPerchWorld) {
    const anchor = cat?.getHatPerchAnchor?.();
    if (!anchor) {
        return null;
    }

    anchor.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(anchor.matrixWorld);
}

function ensureDragonflyTapHelper(dragonfly) {
    if (dragonfly.userData.tapHelper) {
        return dragonfly.userData.tapHelper;
    }

    const helper = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 6),
        new THREE.MeshBasicMaterial({
            visible: false,
            depthWrite: false
        })
    );
    helper.name = 'dragonflyTapHelper';
    helper.userData.bayouDragonflyTap = true;
    dragonfly.add(helper);
    dragonfly.userData.tapHelper = helper;
    return helper;
}

function mountDragonflyOnHat(dragonfly, hatAnchor) {
    if (!hatAnchor || dragonfly.parent === hatAnchor) {
        return;
    }

    dragonfly.parent?.remove(dragonfly);
    hatAnchor.add(dragonfly);
    dragonfly.position.set(0, 0, 0);
    dragonfly.rotation.set(
        HAT_DRAGONFLY_PERCH_ROT.x,
        HAT_DRAGONFLY_PERCH_ROT.y,
        HAT_DRAGONFLY_PERCH_ROT.z
    );
    dragonfly.userData.velocity.set(0, 0, 0);
    ensureDragonflyTapHelper(dragonfly);
}

function unmountDragonflyFromPerch(dragonfly, bayouRoot) {
    if (!bayouRoot || dragonfly.parent === bayouRoot) {
        return;
    }

    dragonfly.getWorldPosition(_worldScratch);
    dragonfly.parent?.remove(dragonfly);
    bayouRoot.add(dragonfly);
    bayouRoot.worldToLocal(_worldScratch);
    dragonfly.position.copy(_worldScratch);
}

function beginRestMode(data, random) {
    data.mode = 'rest';
    data.modeTime = THREE.MathUtils.lerp(6.5, 14.5, random());
    data.velocity.set(0, 0, 0);
    pickRestHoverPoint(data, random);
}

function beginPatrolMode(data, random) {
    data.mode = 'patrol';
    data.patrolDartsRemaining = Math.floor(
        THREE.MathUtils.lerp(2, 4, random())
    );
    pickPatrolDart(data, random, data.currentTarget);
}

function angleDiff(from, to) {
    let delta = to - from;
    delta = (delta + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) {
        delta += Math.PI * 2;
    }
    return delta;
}

function lerpAngle(current, target, t) {
    let delta = target - current;
    delta = (delta + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) {
        delta += Math.PI * 2;
    }
    return current + delta * t;
}

function shortestAngleDiff(current, target) {
    let delta = target - current;
    delta = (delta + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) {
        delta += Math.PI * 2;
    }
    return delta;
}

/** Dragonfly body +X is the head — align it with velocity ~80% of darts. */
function applyDragonflyHeading(dragonfly, data, delta) {
    const vx = data.velocity.x;
    const vy = data.velocity.y;
    const vz = data.velocity.z;
    const horizontalSpeed = Math.hypot(vx, vz);

    if (horizontalSpeed < 0.12 && Math.abs(vy) < 0.12) {
        return;
    }

    let targetYaw = Math.atan2(-vz, vx);
    if (data.flyHeadFirst === false) {
        targetYaw += data.headingSlip || 0;
    }

    const turn = 1 - Math.exp(-14 * delta);
    dragonfly.rotation.y = lerpAngle(dragonfly.rotation.y, targetYaw, turn);

    if (horizontalSpeed > 0.08) {
        dragonfly.rotation.z = THREE.MathUtils.clamp(
            -Math.atan2(vy, horizontalSpeed) * 0.32,
            -0.24,
            0.24
        );
    }
}

function animateDragonflyWings(data, wingRoots, wings, wingVeins, wingBlurGroups, elapsedTime) {
    const perched = data.mode === 'perched';
    const wingSpeed = 88;
    const wingAmp = 0.06;
    const wingTwist = 0.018;

    for (let i = 0; i < wingRoots.length; i++) {
        const root = wingRoots[i];
        const wing = wings[i];
        const veins = wingVeins[i];
        const blurGroup = wingBlurGroups[i];
        const side = i < 2 ? 1 : -1;
        const frontBackOffset = i % 2 === 0 ? 0 : Math.PI * 0.35;

        if (perched) {
            wing.visible = true;
            veins.visible = true;
            blurGroup.visible = false;
            blurGroup.rotation.x = 0;
            blurGroup.rotation.z = 0;
            root.rotation.x = 0;
            root.rotation.z = 0;
            continue;
        }

        wing.visible = false;
        veins.visible = false;
        blurGroup.visible = true;

        blurGroup.rotation.x =
            Math.sin(elapsedTime * wingSpeed + data.phase + frontBackOffset) *
            wingAmp *
            side;
        blurGroup.rotation.z =
            Math.sin(
                elapsedTime * (wingSpeed * 0.65) + data.phase + frontBackOffset
            ) * wingTwist;
        root.rotation.x = 0;
        root.rotation.z = 0;
    }
}

function updateDragonflyFlight(
    dragonfly,
    data,
    delta,
    elapsedTime,
    { cat = null } = {}
) {
    const hatAnchor = cat?.getHatPerchAnchor?.() ?? null;

    if (data.mode === 'perched') {
        if (data.perchedOnHat && hatAnchor) {
            mountDragonflyOnHat(dragonfly, hatAnchor);
        }
        return;
    }

    if (dragonfly.parent !== data.bayouRoot && data.bayouRoot) {
        unmountDragonflyFromPerch(dragonfly, data.bayouRoot);
    }

    if (data.mode === 'rest') {
        const jitter = 0.004;
        dragonfly.position.x +=
            (data.currentTarget.x - dragonfly.position.x) * (1 - Math.exp(-2.5 * delta)) +
            Math.sin(elapsedTime * 8 + data.phase) * jitter;
        dragonfly.position.y +=
            (data.currentTarget.y - dragonfly.position.y) * (1 - Math.exp(-2.5 * delta)) +
            Math.sin(elapsedTime * 11 + data.phase * 1.4) * jitter * 0.35;
        dragonfly.position.z +=
            (data.currentTarget.z - dragonfly.position.z) * (1 - Math.exp(-2.5 * delta)) +
            Math.cos(elapsedTime * 9 + data.phase) * jitter;

        data.velocity.multiplyScalar(Math.pow(0.05, delta));

        data.modeTime = Math.max(0, data.modeTime - delta);

        if (data.modeTime <= 0) {
            if (
                data.landsOnHalley &&
                hatAnchor &&
                !data.justLeftHat &&
                (data.forceHatVisit || data.random() < 0.35)
            ) {
                data.forceHatVisit = false;
                data.mode = 'approach_hat';
                data.modeTime = 8;
                data.flyHeadFirst = true;
                getHatPerchWorld(cat, data.currentTarget);
            } else {
                data.justLeftHat = false;
                beginPatrolMode(data, data.random);
                pickPatrolDart(data, data.random, dragonfly.position);
            }
        }
        return;
    }

    if (data.mode === 'approach_hat') {
        if (!hatAnchor) {
            beginRestMode(data, data.random);
            return;
        }

        getHatPerchWorld(cat, data.currentTarget);
        data.nextDecisionTime -= delta;

        const toX = data.currentTarget.x - dragonfly.position.x;
        const toY = data.currentTarget.y - dragonfly.position.y;
        const toZ = data.currentTarget.z - dragonfly.position.z;
        const dist = Math.hypot(toX, toY, toZ);

        if (dist < 0.22) {
            data.mode = 'perched';
            data.perchedOnHat = true;
            mountDragonflyOnHat(dragonfly, hatAnchor);
            return;
        }

        const speed = data.dartSpeed * 0.72;
        const inv = 1 / Math.max(dist, 0.0001);
        const desiredVX = toX * inv * speed;
        const desiredVY = toY * inv * speed;
        const desiredVZ = toZ * inv * speed;
        const steering = 1 - Math.exp(-data.turnSharpness * 0.75 * delta);

        data.velocity.x += (desiredVX - data.velocity.x) * steering;
        data.velocity.y += (desiredVY - data.velocity.y) * steering;
        data.velocity.z += (desiredVZ - data.velocity.z) * steering;

        dragonfly.position.x += data.velocity.x * delta;
        dragonfly.position.y += data.velocity.y * delta;
        dragonfly.position.z += data.velocity.z * delta;

        applyDragonflyHeading(dragonfly, data, delta);
        return;
    }

    // patrol — short erratic bursts between long rests
    data.modeTime = Math.max(0, data.modeTime - delta);
    data.nextDecisionTime -= delta;

    const toX = data.currentTarget.x - dragonfly.position.x;
    const toY = data.currentTarget.y - dragonfly.position.y;
    const toZ = data.currentTarget.z - dragonfly.position.z;
    const dist = Math.hypot(toX, toY, toZ);

    if (dist < 0.42 || data.nextDecisionTime <= 0) {
        data.patrolDartsRemaining -= 1;

        if (data.patrolDartsRemaining <= 0) {
            beginRestMode(data, data.random);
            return;
        }

        pickPatrolDart(data, data.random, dragonfly.position);
    }

    const desiredLen = Math.hypot(
        data.currentTarget.x - dragonfly.position.x,
        data.currentTarget.y - dragonfly.position.y,
        data.currentTarget.z - dragonfly.position.z
    );

    if (desiredLen > 0.000001) {
        const dx = data.currentTarget.x - dragonfly.position.x;
        const dy = data.currentTarget.y - dragonfly.position.y;
        const dz = data.currentTarget.z - dragonfly.position.z;
        const speed = data.dartSpeed * THREE.MathUtils.lerp(0.88, 1.08, data.random());
        const invLen = 1 / desiredLen;
        const steering = 1 - Math.exp(-data.turnSharpness * delta);

        data.velocity.x += (dx * invLen * speed - data.velocity.x) * steering;
        data.velocity.y += (dy * invLen * speed - data.velocity.y) * steering;
        data.velocity.z += (dz * invLen * speed - data.velocity.z) * steering;
    }

    dragonfly.position.x += data.velocity.x * delta;
    dragonfly.position.y += data.velocity.y * delta;
    dragonfly.position.z += data.velocity.z * delta;

    applyDragonflyHeading(dragonfly, data, delta);
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

function isInCastClearZone(x, z, padding = 0) {
    const dx = x - CAST_CLEAR_CENTER_X;
    const dz = z - CAST_CLEAR_CENTER_Z;

    const nx = dx / (CAST_CLEAR_RADIUS_X + padding);
    const nz = dz / (CAST_CLEAR_RADIUS_Z + padding);

    return nx * nx + nz * nz < 1;
}

function sampleMaskWater(x, z, lakeMask, groundSize) {
    if (!lakeMask?.image?.getContext) {
        const u = x / groundSize + 0.5;
        const v = 1 - (z / groundSize + 0.5);
        const du = u - 0.5;
        const dv = v - 0.5;
        const cos = Math.cos(-MASK_ROTATE);
        const sin = Math.sin(-MASK_ROTATE);
        const eu = du * cos - dv * sin;
        const ev = du * sin + dv * cos;

        return (
            (eu / LAKE_MASK_PROFILE.a) ** 2 +
            (ev / LAKE_MASK_PROFILE.b) ** 2
        ) < 0.78 ** 2;
    }

    const uvx = x / groundSize + 0.5;
    const uvz = 1 - (z / groundSize + 0.5);

    const px = Math.floor(
        THREE.MathUtils.clamp(uvx, 0, 1) *
        (lakeMask.image.width - 1)
    );
    const py = Math.floor(
        THREE.MathUtils.clamp(uvz, 0, 1) *
        (lakeMask.image.height - 1)
    );

    const ctx = lakeMask.image.getContext('2d', {
        willReadFrequently: true
    });
    const data = ctx.getImageData(px, py, 1, 1).data;

    return data[0] / 255 > 0.5;
}

/**
 * ShadowMaterial shell on the log hull — flat tops do not pick up the key-light
 * shadow map reliably, so this mirrors the bayou water shadow receiver.
 */
function attachLogSunShadowReceivers(log, length, radius) {
    const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(
            radius * 1.014,
            radius * 1.014,
            length * 0.97,
            10,
            1,
            true
        ),
        LOG_SUN_SHADOW_MATERIAL
    );

    shell.name = 'logSunShadowShell';
    shell.receiveShadow = true;
    shell.castShadow = false;
    shell.renderOrder = BAYOU_LOG_SHADOW_RENDER_ORDER;
    shell.frustumCulled = false;
    log.add(shell);
}

function logShapeHash(a, b) {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/** One continuous trunk — uneven taper, bark wobble, torn natural ends (no flat caps). */
function createIrregularLogGeometry(length, radius, random) {
    const radialSegments = 14;
    const heightSegments = 16;
    const geometry = new THREE.CylinderGeometry(
        radius,
        radius,
        length,
        radialSegments,
        heightSegments,
        true
    );

    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    const knotCenter = THREE.MathUtils.lerp(0.22, 0.62, random());
    const knotStrength = THREE.MathUtils.lerp(0.08, 0.16, random());
    const thickBias = random() > 0.5 ? 1 : -1;
    const bendX = THREE.MathUtils.lerp(-0.06, 0.06, random());
    const bendZ = THREE.MathUtils.lerp(-0.05, 0.05, random());
    const taperPhase = random() * 0.4;

    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);

        const t = vertex.y / length + 0.5;
        const angle = Math.atan2(vertex.z, vertex.x);
        const dist = Math.hypot(vertex.x, vertex.z) || 0.0001;

        const thickEnd = thickBias > 0 ? t : 1 - t;
        const taper =
            THREE.MathUtils.lerp(0.68, 1.0, Math.pow(thickEnd, 0.72)) *
            (0.94 + 0.06 * Math.sin(t * Math.PI * 1.35 + taperPhase));
        const knot =
            1 +
            knotStrength *
                Math.exp(-((t - knotCenter) * (t - knotCenter)) / 0.018);
        const bark =
            1 +
            0.055 * Math.sin(angle * 4.5 + t * 18.5) +
            0.035 * (logShapeHash(angle * 2.1, t * 9.3) - 0.5);

        let scale = taper * knot * bark;
        let axisOffset = 0;

        const endZone =
            t < 0.14 ? (0.14 - t) / 0.14 : t > 0.86 ? (t - 0.86) / 0.14 : 0;
        if (endZone > 0) {
            const tear =
                0.52 +
                0.48 * logShapeHash(Math.sin(angle * 3.2) * 4.1, t * 17.9);
            scale *= THREE.MathUtils.lerp(1, tear, endZone);
            axisOffset =
                (t < 0.5 ? -1 : 1) *
                radius *
                0.16 *
                endZone *
                (logShapeHash(angle * 5.7, t * 23.1) - 0.2);
        }

        const endPinch = t < 0.04 ? (0.04 - t) / 0.04 : t > 0.96 ? (t - 0.96) / 0.04 : 0;
        if (endPinch > 0) {
            const fill =
                1 -
                endPinch *
                    (0.62 + 0.38 * logShapeHash(angle * 4.8, t * 31.2));
            scale *= Math.max(0.12, fill);
        }

        const newDist = dist * scale;
        const bend = (t - 0.5) * (t - 0.5);
        position.setXYZ(
            i,
            (vertex.x / dist) * newDist + bendX * radius * bend * 4,
            vertex.y + axisOffset,
            (vertex.z / dist) * newDist + bendZ * radius * bend * 4
        );
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

function attachDriftwoodLimb(group, length, radius, floatY, random) {
    const sideZ = random() > 0.5 ? 1 : -1;
    const along = length * THREE.MathUtils.lerp(-0.18, 0.2, random());
    const limbBase = radius * THREE.MathUtils.lerp(0.1, 0.14, random());
    const seg1Len = THREE.MathUtils.lerp(0.14, 0.24, random());
    const seg2Len = THREE.MathUtils.lerp(0.12, 0.2, random());
    const limbMaterial = createWeatheredLogSurfaceMaterial(
        seg1Len + seg2Len,
        limbBase
    );

    const anchor = new THREE.Object3D();
    anchor.position.set(along, floatY, sideZ * radius * 0.92);
    group.add(anchor);

    const seg1 = new THREE.Mesh(
        new THREE.CylinderGeometry(
            limbBase,
            limbBase * 0.38,
            seg1Len,
            6
        ),
        limbMaterial
    );
    seg1.rotation.x = sideZ * (-Math.PI * 0.5);
    seg1.rotation.z = THREE.MathUtils.lerp(-0.08, 0.08, random());
    seg1.position.z = sideZ * seg1Len * 0.5;
    seg1.castShadow = true;
    seg1.receiveShadow = true;
    anchor.add(seg1);

    const joint = new THREE.Object3D();
    joint.position.z = sideZ * seg1Len;
    joint.rotation.y = sideZ * THREE.MathUtils.lerp(0.28, 0.55, random());
    joint.rotation.z = THREE.MathUtils.lerp(-0.1, 0.06, random());
    anchor.add(joint);

    const seg2 = new THREE.Mesh(
        new THREE.CylinderGeometry(
            limbBase * 0.34,
            limbBase * 0.22,
            seg2Len,
            5
        ),
        limbMaterial
    );
    seg2.rotation.x = sideZ * (-Math.PI * 0.5);
    seg2.position.z = sideZ * seg2Len * 0.5;
    seg2.castShadow = true;
    seg2.receiveShadow = true;
    joint.add(seg2);
}

/** Weathered floating log — irregular silhouette, not saw-cut. */
function createDriftwoodLog(random, waterLevel) {
    const group = new THREE.Group();
    group.name = 'bayouLog';

    const length = THREE.MathUtils.lerp(2.8, 4.4, random());
    const radius = THREE.MathUtils.lerp(0.26, 0.4, random());
    const floatY = waterLevel + radius * 0.2;
    const logMaterial = createWeatheredLogSurfaceMaterial(length, radius);

    const log = new THREE.Mesh(
        createIrregularLogGeometry(length, radius, random),
        logMaterial
    );

    log.rotation.z = Math.PI * 0.5;
    log.rotation.y = THREE.MathUtils.lerp(-0.1, 0.1, random());
    log.position.y = floatY;
    log.scale.z = THREE.MathUtils.lerp(0.88, 1.08, random());
    group.add(log);

    attachDriftwoodLimb(group, length, radius, floatY, random);

    const mossPatchCount = 1 + Math.floor(random() * 2);
    for (let i = 0; i < mossPatchCount; i++) {
        const patch = new THREE.Mesh(
            new THREE.SphereGeometry(
                THREE.MathUtils.lerp(0.14, 0.28, random()),
                7,
                4
            ),
            MOSS_MATERIAL
        );

        patch.scale.set(
            THREE.MathUtils.lerp(1.1, 1.8, random()),
            THREE.MathUtils.lerp(0.07, 0.14, random()),
            THREE.MathUtils.lerp(0.45, 0.85, random())
        );

        patch.position.set(
            THREE.MathUtils.lerp(-length * 0.3, length * 0.3, random()),
            floatY + radius * 0.38,
            THREE.MathUtils.lerp(-radius * 0.22, radius * 0.22, random())
        );

        patch.rotation.y = random() * Math.PI;
        group.add(patch);
    }

    group.traverse((object) => {
        if (!object.isMesh) {
            return;
        }
        object.castShadow = true;
        object.receiveShadow = object.material !== MOSS_MATERIAL;
    });

    group.userData.logLength = length;
    group.userData.logRadius = radius;
    group.userData.floatY = floatY;
    group.userData.basePositionY = group.position.y;
    group.userData.baseRotationX = group.rotation.x;
    group.userData.baseRotationZ = group.rotation.z;
    group.userData.rockPhase = random() * Math.PI * 2;
    group.userData.hasTurtles = false;
    return group;
}

function createBrokenLog(random, waterLevel) {
    const group = new THREE.Group();
    group.name = 'bayouLog';

    const length = THREE.MathUtils.lerp(2.8, 5.5, random());
    const radius = THREE.MathUtils.lerp(0.22, 0.42, random());
    const logMaterial = createWeatheredLogSurfaceMaterial(length, radius);
    const endMaterial = createWeatheredLogEndMaterial();

    const log = new THREE.Mesh(
        new THREE.CylinderGeometry(
            radius * THREE.MathUtils.lerp(0.72, 0.9, random()),
            radius,
            length,
            9,
            4,
            false
        ),
        logMaterial
    );

    const floatY = waterLevel + radius * 0.2;

    log.rotation.z = Math.PI * 0.5;
    log.rotation.y = THREE.MathUtils.lerp(-0.12, 0.12, random());
    log.position.y = floatY;
    log.scale.z = THREE.MathUtils.lerp(0.82, 1.15, random());
    attachLogSunShadowReceivers(log, length, radius);
    group.add(log);

    const leftEnd = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.82, 8),
        endMaterial
    );
    leftEnd.rotation.y = Math.PI * 0.5;
    leftEnd.position.set(-length * 0.5, floatY, 0);
    group.add(leftEnd);

    const rightEnd = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.66, 7),
        endMaterial
    );
    rightEnd.rotation.y = -Math.PI * 0.5;
    rightEnd.position.set(length * 0.5, floatY, 0);
    group.add(rightEnd);

    const branchCount = 1 + Math.floor(random() * 3);
    for (let i = 0; i < branchCount; i++) {
        const branchLength = THREE.MathUtils.lerp(0.4, 1.0, random());
        const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(
                radius * 0.08,
                radius * 0.15,
                branchLength,
                6
            ),
            createWeatheredLogSurfaceMaterial(branchLength, radius * 0.12)
        );

        branch.position.set(
            THREE.MathUtils.lerp(-length * 0.35, length * 0.35, random()),
            floatY + radius * THREE.MathUtils.lerp(0.08, 0.42, random()),
            THREE.MathUtils.lerp(-radius * 0.35, radius * 0.35, random())
        );

        branch.rotation.z = THREE.MathUtils.lerp(-1.15, 1.15, random());
        branch.rotation.x = THREE.MathUtils.lerp(-0.55, 0.55, random());
        group.add(branch);
    }

    const mossPatchCount = 2 + Math.floor(random() * 3);
    for (let i = 0; i < mossPatchCount; i++) {
        const patch = new THREE.Mesh(
            new THREE.SphereGeometry(
                THREE.MathUtils.lerp(0.18, 0.34, random()),
                7,
                4
            ),
            MOSS_MATERIAL
        );

        patch.scale.set(
            THREE.MathUtils.lerp(1.2, 2.0, random()),
            THREE.MathUtils.lerp(0.08, 0.16, random()),
            THREE.MathUtils.lerp(0.5, 0.9, random())
        );

        patch.position.set(
            THREE.MathUtils.lerp(-length * 0.35, length * 0.35, random()),
            floatY + radius * 0.42,
            THREE.MathUtils.lerp(-radius * 0.25, radius * 0.25, random())
        );

        patch.rotation.y = random() * Math.PI;
        group.add(patch);
    }

    group.traverse((object) => {
        if (!object.isMesh) {
            return;
        }
        object.castShadow = true;
        object.receiveShadow = object.material !== MOSS_MATERIAL;
    });

    group.userData.logLength = length;
    group.userData.logRadius = radius;
    group.userData.floatY = floatY;
    group.userData.basePositionY = group.position.y;
    group.userData.baseRotationX = group.rotation.x;
    group.userData.baseRotationZ = group.rotation.z;
    group.userData.rockPhase = random() * Math.PI * 2;
    group.userData.hasTurtles = false;
    return group;
}

function createMossCurtain(random, scale = 1) {
    const group = new THREE.Group();
    group.name = 'spanishMossCurtain';

    const strandCount = 5 + Math.floor(random() * 7);

    for (let i = 0; i < strandCount; i++) {
        const height = THREE.MathUtils.lerp(0.65, 1.8, random()) * scale;
        const width = THREE.MathUtils.lerp(0.08, 0.18, random()) * scale;

        const geometry = new THREE.PlaneGeometry(
            width,
            height,
            1,
            4
        );

        const positions = geometry.attributes.position;
        for (let v = 0; v < positions.count; v++) {
            const localY = positions.getY(v);
            const normalized = localY / height + 0.5;
            const sway = Math.sin(normalized * Math.PI * 2.2 + i) * width * 0.55;
            positions.setX(v, positions.getX(v) + sway);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const strand = new THREE.Mesh(geometry, MOSS_MATERIAL);
        strand.position.set(
            THREE.MathUtils.lerp(-0.8, 0.8, random()) * scale,
            -height * 0.5 + THREE.MathUtils.lerp(-0.08, 0.08, random()),
            THREE.MathUtils.lerp(-0.28, 0.28, random()) * scale
        );

        strand.rotation.y = random() * Math.PI;
        strand.rotation.z = THREE.MathUtils.lerp(-0.08, 0.08, random());

        strand.userData.baseRotationZ = strand.rotation.z;
        strand.userData.swayPhase = random() * Math.PI * 2;
        strand.userData.swaySpeed = THREE.MathUtils.lerp(0.18, 0.34, random());
        strand.castShadow = true;
        strand.receiveShadow = false;

        group.add(strand);
    }

    return group;
}

function attachSpanishMossToTrees(cypressGroup, random) {
    const attached = [];

    const trees = cypressGroup?.userData?.cypressTrees || [];
    for (const tree of trees) {
        if (random() > 0.48) {
            continue;
        }

        const curtainCount = 1 + Math.floor(random() * 3);

        for (let i = 0; i < curtainCount; i++) {
            const moss = createMossCurtain(
                random,
                THREE.MathUtils.lerp(0.85, 1.35, random())
            );

            const treeScale = tree.scale.x || 1;
            const approximateHeight = 8.5 * treeScale;

            moss.position.set(
                THREE.MathUtils.lerp(-1.2, 1.2, random()) / treeScale,
                THREE.MathUtils.lerp(
                    approximateHeight * 0.58,
                    approximateHeight * 0.88,
                    random()
                ) / treeScale,
                THREE.MathUtils.lerp(-1.0, 1.0, random()) / treeScale
            );

            moss.rotation.y = random() * Math.PI * 2;
            tree.add(moss);
            attached.push(moss);
        }
    }

    return attached;
}

function createDragonfly(random) {
    const dragonfly = new THREE.Group();
    dragonfly.name = 'bayouDragonfly';

    const abdomen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.034, 0.48, 7),
        DRAGONFLY_BODY_MATERIAL
    );
    abdomen.rotation.z = Math.PI * 0.5;
    abdomen.position.x = -0.05;
    dragonfly.add(abdomen);

    const thorax = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        DRAGONFLY_BODY_MATERIAL
    );
    thorax.scale.set(1.05, 0.8, 0.9);
    thorax.position.x = 0.12;
    dragonfly.add(thorax);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        DRAGONFLY_BODY_MATERIAL
    );
    head.position.x = 0.24;
    dragonfly.add(head);

    const eyeGeometry = new THREE.SphereGeometry(0.028, 8, 6);
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(eyeGeometry, DRAGONFLY_EYE_MATERIAL);
        eye.name = side < 0 ? 'dragonflyEyeL' : 'dragonflyEyeR';
        eye.position.set(0.255, 0.02, side * 0.036);
        eye.scale.set(1.05, 0.9, 1.1);
        eye.castShadow = false;
        eye.receiveShadow = false;
        dragonfly.add(eye);

        const highlight = new THREE.Mesh(
            new THREE.SphereGeometry(0.008, 6, 4),
            DRAGONFLY_EYE_HIGHLIGHT_MATERIAL
        );
        highlight.position.set(0.012, 0.008, side * -0.012);
        highlight.castShadow = false;
        highlight.receiveShadow = false;
        eye.add(highlight);
    }

    function createWingGeometry(length, width) {
        const geometry = new THREE.BufferGeometry();

        const positions = new Float32Array([
            0, 0, 0,
            length * 0.22, 0, width * 0.48,
            length * 0.72, 0, width * 0.36,
            length, 0, 0,
            length * 0.72, 0, -width * 0.36,
            length * 0.22, 0, -width * 0.48
        ]);

        const uvs = new Float32Array([
            0, 0.5,
            0.22, 1,
            0.72, 0.86,
            1, 0.5,
            0.72, 0.14,
            0.22, 0
        ]);

        geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        geometry.setAttribute(
            'uv',
            new THREE.BufferAttribute(uvs, 2)
        );
        geometry.setIndex([
            0, 1, 5,
            1, 2, 5,
            5, 2, 4,
            2, 3, 4
        ]);

        geometry.computeVertexNormals();
        return geometry;
    }

    function createWingVeins(length, width, side) {
        const veins = new THREE.Group();
        const veinMaterial = new THREE.LineBasicMaterial({
            color: 0xd6ebe6,
            transparent: true,
            opacity: 0.32,
            depthWrite: false
        });

        const mainVein = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0.02 * side, 0.003, 0),
            new THREE.Vector3(length * side, 0.003, 0)
        ]);
        veins.add(new THREE.Line(mainVein, veinMaterial));

        for (let i = 0; i < 3; i++) {
            const start = length * (0.25 + i * 0.18);
            const span = width * (0.28 - i * 0.045);

            const top = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(start * side, 0.004, 0),
                new THREE.Vector3((start + length * 0.16) * side, 0.004, span)
            ]);
            veins.add(new THREE.Line(top, veinMaterial));

            const bottom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(start * side, 0.004, 0),
                new THREE.Vector3((start + length * 0.16) * side, 0.004, -span)
            ]);
            veins.add(new THREE.Line(bottom, veinMaterial));
        }

        return veins;
    }

    const wings = [];
    const wingRoots = [];
    const wingVeins = [];
    const wingBlurGroups = [];

    const wingSpecs = [
        { side: 1, x: 0.11, z: 0.045, angle: -0.22, length: 0.48, width: 0.14 },
        { side: 1, x: 0.02, z: 0.04, angle: 0.22, length: 0.43, width: 0.13 },
        { side: -1, x: 0.11, z: -0.045, angle: 0.22, length: 0.48, width: 0.14 },
        { side: -1, x: 0.02, z: -0.04, angle: -0.22, length: 0.43, width: 0.13 }
    ];

    for (const spec of wingSpecs) {
        const root = new THREE.Group();
        root.position.set(spec.x, 0.025, spec.z);

        const wing = new THREE.Mesh(
            createWingGeometry(spec.length, spec.width),
            DRAGONFLY_WING_MATERIAL
        );

        wing.rotation.x = 0;
        wing.rotation.y = spec.side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
        wing.rotation.z = spec.angle;

        const veins = createWingVeins(spec.length, spec.width, spec.side);
        veins.rotation.copy(wing.rotation);

        const blurGroup = new THREE.Group();
        blurGroup.name = 'wingBlur';
        blurGroup.visible = false;

        for (const layer of DRAGONFLY_WING_BLUR_LAYERS) {
            const ghostRoot = new THREE.Group();
            ghostRoot.rotation.x = layer.spread * spec.side;

            const ghost = new THREE.Mesh(
                createWingGeometry(
                    spec.length * 1.04,
                    spec.width * layer.widthScale
                ),
                getDragonflyWingBlurMaterial(layer.opacity)
            );
            ghost.rotation.copy(wing.rotation);
            ghost.castShadow = false;
            ghost.receiveShadow = false;

            ghostRoot.add(ghost);
            blurGroup.add(ghostRoot);
        }

        root.add(wing);
        root.add(veins);
        root.add(blurGroup);

        dragonfly.add(root);
        wings.push(wing);
        wingRoots.push(root);
        wingVeins.push(veins);
        wingBlurGroups.push(blurGroup);
    }

    dragonfly.scale.setScalar(
        THREE.MathUtils.lerp(0.85, 1.18, random())
    );

    dragonfly.userData.wings = wings;
    dragonfly.userData.wingRoots = wingRoots;
    dragonfly.userData.wingVeins = wingVeins;
    dragonfly.userData.wingBlurGroups = wingBlurGroups;
    dragonfly.userData.phase = random() * Math.PI * 2;
    dragonfly.userData.center = new THREE.Vector3();
    dragonfly.userData.height = THREE.MathUtils.lerp(0.85, 1.7, random());

    // Rest in one spot, short patrol bursts, optional boat perch.
    dragonfly.userData.random = random;
    dragonfly.userData.currentTarget = new THREE.Vector3();
    dragonfly.userData.velocity = new THREE.Vector3();
    dragonfly.userData.dartSpeed = THREE.MathUtils.lerp(5.5, 8.0, random());
    dragonfly.userData.turnSharpness = THREE.MathUtils.lerp(8, 12, random());
    dragonfly.userData.flightRadiusX = THREE.MathUtils.lerp(3.2, 6.5, random());
    dragonfly.userData.flightRadiusZ = THREE.MathUtils.lerp(2.8, 5.8, random());
    dragonfly.userData.heightRange = THREE.MathUtils.lerp(0.45, 0.9, random());
    dragonfly.userData.mode = 'rest';
    dragonfly.userData.modeTime = THREE.MathUtils.lerp(5, 10, random());
    dragonfly.userData.patrolDartsRemaining = 0;
    dragonfly.userData.nextDecisionTime = 0;
    dragonfly.userData.landsOnHalley = false;
    dragonfly.userData.justLeftHat = false;
    dragonfly.userData.forceHatVisit = false;
    dragonfly.userData.perchedOnHat = false;
    dragonfly.userData.flyHeadFirst = true;
    dragonfly.userData.bayouRoot = null;

    return dragonfly;
}

function createBayouTurtle(random) {
    const turtle = new THREE.Group();
    turtle.name = 'bayouTurtle';

    const scale = THREE.MathUtils.lerp(0.92, 1.14, random());

    const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 10),
        TURTLE_SHELL_MATERIAL
    );
    shell.scale.set(1.34, 0.5, 1.05);
    shell.position.y = 0.105;
    shell.castShadow = true;
    shell.receiveShadow = true;
    turtle.add(shell);

    const shellRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.245, 0.025, 6, 18),
        TURTLE_SHELL_EDGE_MATERIAL
    );
    shellRim.rotation.x = Math.PI * 0.5;
    shellRim.scale.set(1.34, 1.05, 1);
    shellRim.position.y = 0.055;
    shellRim.castShadow = true;
    turtle.add(shellRim);

    for (let i = 0; i < 5; i++) {
        const scute = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 8, 5),
            TURTLE_SCUTE_MATERIAL
        );
        const x = THREE.MathUtils.lerp(-0.17, 0.17, i / 4);
        scute.scale.set(
            i === 0 || i === 4 ? 0.75 : 1,
            0.16,
            i === 2 ? 1.05 : 0.88
        );
        scute.position.set(x, 0.205, 0);
        scute.castShadow = true;
        shell.add(scute);
    }

    for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
            const scute = new THREE.Mesh(
                new THREE.SphereGeometry(0.048, 7, 5),
                TURTLE_SCUTE_MATERIAL
            );
            scute.scale.set(0.9, 0.12, 0.72);
            scute.position.set(
                THREE.MathUtils.lerp(-0.14, 0.14, i / 3),
                0.185,
                side * 0.11
            );
            scute.castShadow = true;
            shell.add(scute);
        }
    }

    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.06, 0.16, 8),
        TURTLE_SKIN_MATERIAL
    );
    neck.rotation.z = -Math.PI * 0.5;
    neck.position.set(0.255, 0.075, 0);
    neck.scale.set(1, 1, 0.9);
    neck.castShadow = true;
    turtle.add(neck);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 10, 7),
        TURTLE_SKIN_MATERIAL
    );
    head.scale.set(1.18, 0.72, 0.9);
    head.position.set(0.365, 0.085, 0);
    head.castShadow = true;
    turtle.add(head);

    const snout = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 8, 5),
        TURTLE_SKIN_MATERIAL
    );
    snout.scale.set(1.15, 0.62, 0.82);
    snout.position.set(0.065, -0.002, 0);
    head.add(snout);

    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 7, 5),
            TURTLE_EYE_MATERIAL
        );
        eye.position.set(0.038, 0.018, side * 0.064);
        head.add(eye);

        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(0.075, 0.01, 0.012),
            TURTLE_STRIPE_MATERIAL
        );
        stripe.position.set(0.008, -0.008, side * 0.072);
        stripe.rotation.z = side * 0.08;
        head.add(stripe);
    }

    const tailRoot = new THREE.Group();
    tailRoot.position.set(-0.282, 0.068, 0);
    tailRoot.rotation.z = THREE.MathUtils.lerp(0.08, 0.16, random());
    turtle.add(tailRoot);

    const tailBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.042, 0.06, 7),
        TURTLE_SKIN_MATERIAL
    );
    tailBase.rotation.z = Math.PI * 0.5;
    tailBase.position.x = -0.03;
    tailBase.castShadow = true;
    tailRoot.add(tailBase);

    const tailTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.036, 0.12, 7),
        TURTLE_SKIN_MATERIAL
    );
    tailTip.rotation.z = Math.PI * 0.5;
    tailTip.position.x = -0.102;
    tailTip.castShadow = true;
    tailRoot.add(tailTip);

    const feet = [];
    const legSpecs = [
        { x: 0.15, z: 0.17, angle: -0.35, front: true },
        { x: 0.15, z: -0.17, angle: 0.35, front: true },
        { x: -0.14, z: 0.16, angle: 0.42, front: false },
        { x: -0.14, z: -0.16, angle: -0.42, front: false }
    ];

    for (const spec of legSpecs) {
        const legRoot = new THREE.Group();
        legRoot.position.set(spec.x, 0.045, spec.z);
        legRoot.rotation.y = spec.angle;

        const upperLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.034, 0.042, spec.front ? 0.13 : 0.11, 7),
            TURTLE_SKIN_MATERIAL
        );
        upperLeg.rotation.z = Math.PI * 0.5;
        upperLeg.position.x = spec.front ? 0.045 : -0.035;
        upperLeg.castShadow = true;
        legRoot.add(upperLeg);

        const foot = new THREE.Mesh(
            new THREE.SphereGeometry(0.052, 8, 5),
            TURTLE_SKIN_MATERIAL
        );
        foot.scale.set(spec.front ? 1.35 : 1.15, 0.38, 0.78);
        foot.position.x = spec.front ? 0.11 : -0.09;
        foot.castShadow = true;
        legRoot.add(foot);

        for (let toe = -1; toe <= 1; toe++) {
            const toeMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.006, 0.009, 0.045, 5),
                TURTLE_STRIPE_MATERIAL
            );
            toeMesh.rotation.z = Math.PI * 0.5;
            toeMesh.position.set(
                foot.position.x + (spec.front ? 0.045 : -0.04),
                -0.003,
                toe * 0.026
            );
            toeMesh.castShadow = true;
            legRoot.add(toeMesh);
        }

        turtle.add(legRoot);
        legRoot.userData.isFront = spec.front;
        legRoot.userData.side = spec.z > 0 ? 1 : -1;
        legRoot.userData.baseRotationX = 0;
        legRoot.userData.baseRotationZ = 0;
        feet.push(legRoot);
    }

    turtle.scale.setScalar(scale);
    turtle.userData.head = head;
    turtle.userData.neck = neck;
    turtle.userData.tail = tailRoot;
    turtle.userData.tailBaseRotationZ = tailRoot.rotation.z;
    turtle.userData.feet = feet;
    turtle.userData.phase = random() * Math.PI * 2;
    turtle.userData.headBaseX = 0.365;
    turtle.userData.headBaseY = 0.085;
    turtle.userData.lookAmount = THREE.MathUtils.lerp(0.045, 0.085, random());
    turtle.userData.headYawSpeed = THREE.MathUtils.lerp(0.28, 0.52, random());
    turtle.userData.headTiltSpeed = THREE.MathUtils.lerp(0.22, 0.38, random());
    turtle.userData.headBobSpeed = THREE.MathUtils.lerp(0.4, 0.68, random());
    turtle.userData.neckYawFactor = THREE.MathUtils.lerp(0.45, 0.85, random());
    turtle.userData.headTiltPhase = random() * Math.PI * 2;
    turtle.userData.headBobPhase = random() * Math.PI * 2;
    turtle.userData.neckPhase = random() * Math.PI * 2;
    turtle.userData.bodySwaySpeed = THREE.MathUtils.lerp(0.12, 0.24, random());
    turtle.userData.bodySwayPhase = random() * Math.PI * 2;
    turtle.userData.gestureInterval = THREE.MathUtils.lerp(4.2, 7.5, random());
    turtle.userData.gestureDuration = THREE.MathUtils.lerp(1.6, 2.6, random());
    turtle.userData.gesturePhase = random() * 12;
    turtle.userData.gestureHeadStretch = THREE.MathUtils.lerp(0.028, 0.05, random());
    turtle.userData.gestureHeadTurn = THREE.MathUtils.lerp(0.09, 0.15, random());
    turtle.userData.gestureFootLift = THREE.MathUtils.lerp(0.07, 0.12, random());

    for (const foot of feet) {
        foot.userData.wiggleSpeed = THREE.MathUtils.lerp(0.2, 0.38, random());
        foot.userData.wigglePhase = random() * Math.PI * 2;
    }

    turtle.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    return turtle;
}

/** Smooth 0→1→0 pulse for periodic turtle gestures. */
function turtleGestureEnvelope(elapsedTime, data) {
    const interval = data.gestureInterval ?? 6;
    const duration = data.gestureDuration ?? 2;
    const cycle = (elapsedTime + (data.gesturePhase ?? 0)) % interval;

    if (cycle > duration) {
        return 0;
    }

    return Math.sin((cycle / duration) * Math.PI);
}

function attachTurtleToLog(log, random, slotAlong) {
    const length = log.userData.logLength || 4;
    const radius = log.userData.logRadius || 0.3;
    const floatY = log.userData.floatY || radius * 0.2;

    const turtle = createBayouTurtle(random);
    const along = length * slotAlong;
    const topY = floatY + radius * 0.94;

    turtle.position.set(
        along,
        topY,
        THREE.MathUtils.lerp(-radius * 0.28, radius * 0.28, random())
    );

    const facePositiveX = random() > 0.5;
    turtle.rotation.y = facePositiveX ? 0 : Math.PI;
    turtle.rotation.z = THREE.MathUtils.lerp(-0.04, 0.04, random());
    turtle.userData.baseRotationZ = turtle.rotation.z;

    log.add(turtle);
    return turtle;
}

function distanceFromBoat(x, z) {
    return Math.hypot(x - BOAT_ANCHOR_X, z - BOAT_ANCHOR_Z);
}

const GATOR_BODY_RADIUS = 1.4;
const GATOR_VIEW_EDGE_PADDING = 0.06;
const GATOR_MIN_BOAT_DISTANCE = 1.35;
const GATOR_DOCK_MIN_BOAT_DISTANCE = 1.05;

function isUnderDockSwimZone(x, z) {
    return (
        z < 4.4 &&
        Math.abs(x) < 10
    );
}

function isInGatorFishingView(x, z) {
    if (
        !isInCastClearZone(
            x,
            z,
            GATOR_VIEW_EDGE_PADDING
        )
    ) {
        return false;
    }

    const minBoatDistance = isUnderDockSwimZone(x, z)
        ? GATOR_DOCK_MIN_BOAT_DISTANCE
        : GATOR_MIN_BOAT_DISTANCE;

    return distanceFromBoat(x, z) >= minBoatDistance;
}

function getCypressCollisionRadius(tree) {
    const scale =
        tree?.scale?.x ??
        tree?.scale?.y ??
        1;

    return THREE.MathUtils.lerp(2.1, 3.1, scale);
}

function buildGatorSwimObstacles({
    cypressGroup,
    root
}) {
    const obstacles = [];

    for (const tree of cypressGroup?.userData?.cypressTrees || []) {
        obstacles.push({
            x: tree.position.x,
            z: tree.position.z,
            radius: getCypressCollisionRadius(tree)
        });
    }

    for (const child of root?.children || []) {
        if (child.name !== 'bayouLog') {
            continue;
        }

        // Logs are thin floaters — keep a modest exclusion so the gator can
        // cruise past the turtle log without getting shoved into invalid water.
        obstacles.push({
            x: child.position.x,
            z: child.position.z,
            radius: 1.05
        });
    }

    return obstacles;
}

function isValidGatorSwimPoint(x, z, data) {
    if (
        !sampleMaskWater(
            x,
            z,
            data.lakeMask,
            data.groundSize
        )
    ) {
        return false;
    }

    if (!isInGatorFishingView(x, z)) {
        return false;
    }

    for (const obstacle of data.obstacles || []) {
        const dist = Math.hypot(
            x - obstacle.x,
            z - obstacle.z
        );

        if (
            dist <
            obstacle.radius + GATOR_BODY_RADIUS
        ) {
            return false;
        }
    }

    return true;
}

/** Prefer a nearby open spot so recovery never teleports across the bayou. */
function sampleNearbyGatorSwimPoint(
    data,
    originX,
    originZ,
    random,
    {
        minRadius = 0.6,
        maxRadius = 4.5,
        attempts = 48
    } = {}
) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const angle = random() * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(
            minRadius,
            maxRadius,
            Math.sqrt(random())
        );
        const x = originX + Math.cos(angle) * radius;
        const z = originZ + Math.sin(angle) * radius;

        if (isValidGatorSwimPoint(x, z, data)) {
            return { x, z };
        }
    }

    return null;
}

function sampleGatorFishingViewPoint(data, random) {
    for (let attempt = 0; attempt < 100; attempt++) {
        let x;
        let z;
        const roll = random();

        if (roll < 0.3) {
            x = THREE.MathUtils.lerp(-9.5, 9.5, random());
            z = THREE.MathUtils.lerp(0.7, 4.3, random());
        } else {
            const angle = random() * Math.PI * 2;
            const depthScale = Math.sqrt(random());

            x =
                CAST_CLEAR_CENTER_X +
                Math.cos(angle) *
                    CAST_CLEAR_RADIUS_X *
                    depthScale;
            z =
                CAST_CLEAR_CENTER_Z +
                Math.sin(angle) *
                    CAST_CLEAR_RADIUS_Z *
                    depthScale;
        }

        if (isValidGatorSwimPoint(x, z, data)) {
            return { x, z };
        }
    }

    return null;
}

function applyGatorObstacleSteering(gator, data, delta) {
    let repelX = 0;
    let repelZ = 0;

    for (const obstacle of data.obstacles || []) {
        const dx = gator.position.x - obstacle.x;
        const dz = gator.position.z - obstacle.z;
        const dist = Math.hypot(dx, dz);
        const influence =
            obstacle.radius +
            GATOR_BODY_RADIUS +
            1.8;

        if (dist >= influence || dist < 0.001) {
            continue;
        }

        const strength =
            (influence - dist) / influence;

        repelX += (dx / dist) * strength;
        repelZ += (dz / dist) * strength;
    }

    if (repelX !== 0 || repelZ !== 0) {
        const repelScale =
            data.speed * 0.9 * delta;

        data.velocity.x += repelX * repelScale;
        data.velocity.z += repelZ * repelScale;
    }
}

function applyGatorViewBoundarySteering(gator, data, delta) {
    if (
        isInGatorFishingView(
            gator.position.x,
            gator.position.z
        )
    ) {
        return;
    }

    const dx = data.center.x - gator.position.x;
    const dz = data.center.z - gator.position.z;
    const len = Math.hypot(dx, dz) || 0.001;
    const push = data.speed * 2.2 * delta;

    data.velocity.x += (dx / len) * push;
    data.velocity.z += (dz / len) * push;

    // Retarget only occasionally — every-frame retargets cause path thrashing.
    data._boundaryRetargetCooldown =
        (data._boundaryRetargetCooldown ?? 0) - delta;

    if (data._boundaryRetargetCooldown <= 0) {
        pickGatorTarget(data);
        data._boundaryRetargetCooldown = 1.4;
    }
}

function resolveGatorCollisions(gator, data) {
    let x = gator.position.x;
    let z = gator.position.z;

    for (const obstacle of data.obstacles || []) {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        const dist = Math.hypot(dx, dz);
        const minDist =
            obstacle.radius + GATOR_BODY_RADIUS;

        if (dist >= minDist || dist < 0.0001) {
            continue;
        }

        const push = (minDist - dist) / dist;
        x += dx * push;
        z += dz * push;

        const dot =
            data.velocity.x * dx +
            data.velocity.z * dz;

        if (dot < 0) {
            const nx = dx / dist;
            const nz = dz / dist;

            data.velocity.x -= nx * dot;
            data.velocity.z -= nz * dot;
        }
    }

    gator.position.x = x;
    gator.position.z = z;

    if (!isValidGatorSwimPoint(x, z, data)) {
        data.velocity.x *= 0.35;
        data.velocity.z *= 0.35;

        const recovered = sampleNearbyGatorSwimPoint(
            data,
            x,
            z,
            data.random
        );

        if (recovered) {
            gator.position.x = recovered.x;
            gator.position.z = recovered.z;

            if (data.mode === 'lurk') {
                data.lurkTargetX = recovered.x;
                data.lurkTargetZ = recovered.z;
            } else if (data.mode === 'peek') {
                data.peekTargetX = recovered.x;
                data.peekTargetZ = recovered.z;
            } else if (data.mode === 'headup') {
                data.headUpTargetX = recovered.x;
                data.headUpTargetZ = recovered.z;
            } else {
                data.target.set(
                    recovered.x,
                    data.baseWaterY,
                    recovered.z
                );
            }
        } else if (data.mode === 'lurk') {
            data.lurkTargetX = gator.position.x;
            data.lurkTargetZ = gator.position.z;
        } else {
            pickGatorTarget(data);
        }
    }
}

function beginGatorLurk(data, gator) {
    data.mode = 'lurk';
    data.modeTime = THREE.MathUtils.lerp(
        4,
        9,
        data.random()
    );
    data.targetRise = THREE.MathUtils.lerp(
        0.034,
        0.058,
        data.random()
    );

    // Lurk in place — never teleport to a random bayou sample (that caused
    // visible blips from the turtle log / open water back to the cypress line).
    let lurkX = gator.position.x;
    let lurkZ = gator.position.z;

    if (!isValidGatorSwimPoint(lurkX, lurkZ, data)) {
        const nearby = sampleNearbyGatorSwimPoint(
            data,
            lurkX,
            lurkZ,
            data.random
        );

        if (nearby) {
            lurkX = nearby.x;
            lurkZ = nearby.z;
            gator.position.x = lurkX;
            gator.position.z = lurkZ;
        }
    }

    data.lurkTargetX = lurkX;
    data.lurkTargetZ = lurkZ;
    data.velocity.set(0, 0, 0);
}

function beginGatorSubmerged(data, {
    minSeconds = 14,
    maxSeconds = 28,
    maybeMove = true
} = {}) {
    data.mode = 'submerged';
    data.modeTime = THREE.MathUtils.lerp(
        minSeconds,
        maxSeconds,
        data.random()
    );
    data.targetRise = THREE.MathUtils.lerp(
        -0.28,
        -0.22,
        data.random()
    );

    if (maybeMove) {
        pickGatorTarget(data);
        data.swimLegTime = THREE.MathUtils.lerp(
            6,
            13,
            data.random()
        );
    }
}

function beginGatorPeek(data, gator) {
    data.mode = 'peek';
    data.modeTime = THREE.MathUtils.lerp(
        2.8,
        5.5,
        data.random()
    );
    data.targetRise = THREE.MathUtils.lerp(
        0.022,
        0.042,
        data.random()
    );
    data.peekTargetX = gator.position.x;
    data.peekTargetZ = gator.position.z;
    data.velocity.x *= 0.12;
    data.velocity.z *= 0.12;
}

function isGatorHoldingPosition(data) {
    return (
        data.mode === 'lurk' ||
        data.mode === 'peek' ||
        data.mode === 'headup'
    );
}

function getGatorSnoutWorldPosition(gator, target = _gatorSnoutScratch) {
    _gatorSnoutLocal.set(GATOR_SNOUT_TIP_X, 0.04, 0);
    target.copy(_gatorSnoutLocal);
    gator.localToWorld(target);
    return target;
}

function pickGatorFleeTargetFromBobber(data, gator, bobberX, bobberZ) {
    const gx = gator.position.x;
    const gz = gator.position.z;
    let dx = gx - bobberX;
    let dz = gz - bobberZ;
    const len = Math.hypot(dx, dz);

    if (len < 0.001) {
        const angle = data.random() * Math.PI * 2;
        dx = Math.cos(angle);
        dz = Math.sin(angle);
    } else {
        dx /= len;
        dz /= len;
    }

    const fleeDist = THREE.MathUtils.lerp(9, 15, data.random());

    for (let scale = 1; scale >= 0.35; scale -= 0.15) {
        const tx = gx + dx * fleeDist * scale;
        const tz = gz + dz * fleeDist * scale;

        if (isValidGatorSwimPoint(tx, tz, data)) {
            data.target.set(tx, data.baseWaterY, tz);
            return;
        }
    }

    pickGatorTarget(data);
}

function beginGatorStartle(data, gator, bobberX, bobberZ, hooks = {}) {
    data.mode = 'startled';
    data.modeTime = THREE.MathUtils.lerp(2.2, 3.8, data.random());
    data.targetRise = THREE.MathUtils.lerp(-0.3, -0.24, data.random());
    data.startleFlinchTime = 0.42;
    data.swimLegTime = null;

    pickGatorFleeTargetFromBobber(data, gator, bobberX, bobberZ);

    const gx = gator.position.x;
    const gz = gator.position.z;
    let dx = gx - bobberX;
    let dz = gz - bobberZ;
    const len = Math.hypot(dx, dz) || 1;
    const fleeSpeed = data.speed * 1.2;

    data.velocity.set(
        (dx / len) * fleeSpeed,
        0,
        (dz / len) * fleeSpeed
    );

    const snoutPos = getGatorSnoutWorldPosition(gator, _gatorSnoutScratch);

    if (hooks.splash?.triggerRipple) {
        hooks.splash.triggerRipple(snoutPos);
    }

    if (hooks.water?.mesh?.splashAt) {
        hooks.water.mesh.splashAt(snoutPos.x, snoutPos.z);
    }
}

/** Stop, lift snout/head above the surface, hold, then dive again. */
function beginGatorHeadUp(data, gator) {
    data.mode = 'headup';
    data.modeTime = THREE.MathUtils.lerp(
        4.5,
        8,
        data.random()
    );
    data.targetRise = THREE.MathUtils.lerp(
        0.15,
        0.28,
        data.random()
    );
    data.headUpTargetX = gator.position.x;
    data.headUpTargetZ = gator.position.z;
    data.velocity.set(0, 0, 0);
    data.swimLegTime = null;
}

function placeTurtlesOnLogs(root, random) {
    const logs = root.children.filter((child) => child.name === 'bayouLog');
    if (logs.length === 0) {
        return [];
    }

    const nearestLog =
        logs.find((log) => log.userData.isTurtleLog) ||
        logs
            .slice()
            .sort(
                (a, b) =>
                    distanceFromBoat(a.position.x, a.position.z) -
                    distanceFromBoat(b.position.x, b.position.z)
            )[0];

    const turtles = [];
    const slots = [-0.16, 0.13];

    nearestLog.userData.hasTurtles = true;
    nearestLog.userData.rockPhase = random() * Math.PI * 2;
    nearestLog.userData.turtleWeightBias =
        slots.reduce((sum, slot) => sum + slot, 0) / slots.length;

    for (let i = 0; i < TURTLE_COUNT; i++) {
        turtles.push(attachTurtleToLog(nearestLog, random, slots[i]));
    }

    return turtles;
}

// Skeleton chain along +X from gator root (see buildGatorSkeleton).
const GATOR_CHEST_X = 0.16;
const GATOR_NECK_LEN = 0.86;
const GATOR_HEAD_LEN = 0.4;
const GATOR_SNOUT_MESH_X = 0.06;
const GATOR_SNOUT_LEN = 1.02;
const GATOR_ABDOMEN_LEN = 0.82;
const GATOR_PELVIS_LEN = 0.72;
const GATOR_TAIL_ROOT_LEN = 0.54;
const GATOR_TAIL_FIRST_SEGMENT_EMBED = 0.08;
const GATOR_TAIL_JOINT_OVERLAP = 0.065;
const GATOR_TAIL_BONE_SPAN = 1;

const GATOR_SNOUT_TIP_X =
    GATOR_CHEST_X +
    GATOR_NECK_LEN +
    GATOR_HEAD_LEN +
    GATOR_SNOUT_MESH_X +
    GATOR_SNOUT_LEN;

const GATOR_TAIL_ATTACH_X =
    GATOR_CHEST_X -
    GATOR_ABDOMEN_LEN -
    GATOR_PELVIS_LEN -
    GATOR_TAIL_ROOT_LEN;

// Real alligators: tail length = 50% of total (snout tip -> tail tip).
// So the span from tail attachment -> tip matches snout tip -> attachment.
const GATOR_TARGET_TAIL_SPAN =
    GATOR_SNOUT_TIP_X -
    GATOR_TAIL_ATTACH_X +
    GATOR_TAIL_FIRST_SEGMENT_EMBED;

const GATOR_TAIL_SEGMENT_WEIGHTS = [
    0.78,
    0.72,
    0.64,
    0.56,
    0.47,
    0.38,
    0.29,
    0.22,
    0.16,
    0.11
];

function buildGatorTailSegmentLengths() {
    const weightSum = GATOR_TAIL_SEGMENT_WEIGHTS.reduce(
        (sum, weight) => sum + weight,
        0
    );

    return GATOR_TAIL_SEGMENT_WEIGHTS.map(
        (weight) =>
            (weight / weightSum) * GATOR_TARGET_TAIL_SPAN
    );
}

const GATOR_TAIL_SEGMENT_LENGTHS =
    buildGatorTailSegmentLengths();

function createGatorBone(name, parent, x, y = 0, z = 0) {
    const bone = new THREE.Group();
    bone.name = name;
    bone.position.set(x, y, z);
    parent.add(bone);
    return bone;
}

function createGatorEllipsoid(
    radius,
    scaleX,
    scaleY,
    scaleZ,
    material,
    widthSegments = 18,
    heightSegments = 12
) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(
            radius,
            widthSegments,
            heightSegments
        ),
        material
    );

    mesh.scale.set(scaleX, scaleY, scaleZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function createGatorSnoutGeometry(
    length,
    height,
    rearWidth,
    frontWidth,
    flareWidth = frontWidth * 1.08
) {
    const radialSegments = 20;
    const bodyRings = 13;
    const capRings = 7;
    const positions = [];
    const indices = [];

    const tipY = -height * 0.46;
    const capRadius = flareWidth * 0.48;
    const capHeight = height * 0.3;
    const bodyEndX = length - capRadius * 0.08;

    for (let ring = 0; ring <= bodyRings; ring++) {
        const t = ring / bodyRings;
        const u = 1 - Math.pow(1 - t, 0.78);
        const x = u * bodyEndX;

        let halfWidth;

        if (u < 0.8) {
            halfWidth = THREE.MathUtils.lerp(
                rearWidth * 0.5,
                frontWidth * 0.5,
                Math.pow(u / 0.8, 0.72)
            );
        } else {
            const flareU = (u - 0.8) / 0.2;

            halfWidth = THREE.MathUtils.lerp(
                frontWidth * 0.5,
                flareWidth * 0.5,
                THREE.MathUtils.smoothstep(flareU, 0, 1) * 0.65
            );
        }

        const halfHeight =
            height *
            THREE.MathUtils.lerp(
                0.46,
                0.2,
                Math.pow(u, 0.88)
            );

        const centerY =
            THREE.MathUtils.lerp(
                0,
                tipY,
                Math.pow(u, 0.92)
            );

        const roundness = THREE.MathUtils.lerp(
            0.62,
            0.98,
            Math.pow(u, 0.65)
        );

        for (let segment = 0; segment < radialSegments; segment++) {
            const angle =
                (segment / radialSegments) * Math.PI * 2;

            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            const y =
                Math.sign(sinA) *
                Math.pow(Math.abs(sinA), roundness) *
                halfHeight;

            const z =
                Math.sign(cosA) *
                Math.pow(Math.abs(cosA), roundness) *
                halfWidth;

            positions.push(x, centerY + y, z);
        }
    }

    for (let cap = 0; cap <= capRings; cap++) {
        const theta = (cap / capRings) * Math.PI * 0.5;
        const ringScale = Math.sin(theta);

        const x =
            length -
            capRadius * (1 - Math.cos(theta));

        const halfWidth = capRadius * ringScale;
        const halfHeight = capHeight * ringScale;

        const centerY =
            tipY +
            (1 - ringScale) * height * 0.04;

        for (let segment = 0; segment < radialSegments; segment++) {
            const angle =
                (segment / radialSegments) * Math.PI * 2;

            const y =
                Math.sin(angle) * halfHeight;
            const z =
                Math.cos(angle) * halfWidth;

            positions.push(x, centerY + y, z);
        }
    }

    const totalRings = bodyRings + capRings;

    for (let ring = 0; ring < totalRings; ring++) {
        for (let segment = 0; segment < radialSegments; segment++) {
            const nextSegment = (segment + 1) % radialSegments;
            const a = ring * radialSegments + segment;
            const b = ring * radialSegments + nextSegment;
            const c = (ring + 1) * radialSegments + nextSegment;
            const d = (ring + 1) * radialSegments + segment;
            indices.push(a, b, d, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

function createGatorTailSegmentMesh(
    length,
    startRadius,
    endRadius,
    jointOverlap = GATOR_TAIL_JOINT_OVERLAP
) {
    const overlap = length * jointOverlap;
    const totalLength = length + overlap;
    const geometry = new THREE.CylinderGeometry(
        endRadius,
        startRadius * 1.025,
        totalLength,
        16,
        3,
        false
    );

    geometry.rotateZ(Math.PI * 0.5);
    geometry.translate(-totalLength * 0.5 + overlap, 0, 0);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        positions.setY(i, positions.getY(i) * 0.56);
        positions.setZ(i, positions.getZ(i) * 1.03);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, GATOR_SKIN_MATERIAL);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function getGatorTailRadiusAt(normalized) {
    return THREE.MathUtils.lerp(
        0.38,
        0.022,
        Math.pow(
            THREE.MathUtils.clamp(normalized, 0, 1),
            0.9
        )
    );
}

function addGatorDorsalScutes(
    parent,
    startX,
    endX,
    rowCount,
    columnCount,
    size,
    height,
    rowSpread
) {
    const span = endX - startX;

    for (let row = 0; row < rowCount; row++) {
        const rowT = rowCount <= 1 ? 0.5 : row / (rowCount - 1);
        const zOffset = THREE.MathUtils.lerp(-rowSpread, rowSpread, rowT);

        for (let col = 0; col < columnCount; col++) {
            const x = columnCount <= 1
                ? (startX + endX) * 0.5
                : startX + span * (col / (columnCount - 1));

            const scute = new THREE.Mesh(
                new THREE.ConeGeometry(
                    0.038 * size,
                    0.108 * size,
                    3
                ),
                GATOR_SCUTE_MATERIAL
            );

            scute.rotation.x = -Math.PI * 0.5;
            scute.castShadow = true;
            scute.receiveShadow = true;
            scute.position.set(
                x,
                height - size * 0.006,
                zOffset
            );
            parent.add(scute);
        }
    }
}

function addGatorTailScutes(
    parent,
    startX,
    endX,
    startRadius,
    normalized
) {
    const rowCount =
        normalized < 0.34 ? 4 :
        normalized < 0.68 ? 2 : 1;

    const rowSpread = THREE.MathUtils.lerp(
        0.24,
        0.035,
        normalized
    );

    const size = THREE.MathUtils.lerp(
        0.68,
        0.14,
        normalized
    );

    const columnCount =
        normalized < 0.45 ? 2 : 1;

    addGatorDorsalScutes(
        parent,
        startX,
        endX,
        rowCount,
        columnCount,
        size,
        startRadius * 0.56 - size * 0.012,
        rowSpread
    );
}

function createGatorEye(parent, x, y, z, side) {
    const mound = createGatorEllipsoid(
        0.095,
        1.2,
        0.44,
        0.62,
        GATOR_SKIN_MATERIAL,
        14,
        9
    );

    mound.position.set(x, y + 0.026, z);
    mound.rotation.y = side * 0.14;
    mound.rotation.z = side * -0.2;
    parent.add(mound);

    const innerKeel = createGatorEllipsoid(
        0.058,
        0.72,
        0.42,
        0.28,
        GATOR_SKIN_MATERIAL,
        10,
        6
    );

    innerKeel.position.set(
        x + 0.015,
        y + 0.034,
        -side * 0.038
    );
    parent.add(innerKeel);

    const socket = createGatorEllipsoid(
        0.028,
        0.82,
        0.2,
        0.38,
        GATOR_DARK_MATERIAL,
        10,
        7
    );

    socket.position.set(
        x + 0.01,
        y + 0.014,
        z + side * 0.032
    );
    parent.add(socket);

    const eye = createGatorEllipsoid(
        0.039,
        1.08,
        0.5,
        0.58,
        GATOR_EYE_MATERIAL,
        12,
        8
    );

    eye.position.set(
        x + 0.016,
        y + 0.022,
        z + side * 0.05
    );
    parent.add(eye);

    const pupil = createGatorEllipsoid(
        0.008,
        0.14,
        0.95,
        0.1,
        GATOR_DARK_MATERIAL,
        7,
        5
    );

    pupil.position.set(
        x + 0.034,
        y + 0.023,
        z + side * 0.062
    );
    parent.add(pupil);
}

function buildGatorSkeleton(gator) {
    const chestBone = createGatorBone('gatorChestBone', gator, 0.16, 0, 0);

    const neckBone = createGatorBone(
        'gatorNeckBone',
        chestBone,
        0.86,
        0.008,
        0
    );

    const headBone = createGatorBone(
        'gatorHeadBone',
        neckBone,
        0.4,
        0.004,
        0
    );

    const jawBone = createGatorBone(
        'gatorJawBone',
        headBone,
        0.1,
        -0.085,
        0
    );

    const abdomenBone = createGatorBone(
        'gatorAbdomenBone',
        chestBone,
        -0.82,
        0,
        0
    );

    const pelvisBone = createGatorBone(
        'gatorPelvisBone',
        abdomenBone,
        -0.72,
        0,
        0
    );

    const tailRootBone = createGatorBone(
        'gatorTailRootBone',
        pelvisBone,
        -GATOR_TAIL_ROOT_LEN,
        0,
        0
    );

    const tailBones = [];
    let tailParent = tailRootBone;

    for (let i = 0; i < GATOR_TAIL_SEGMENT_LENGTHS.length; i++) {
        const length = GATOR_TAIL_SEGMENT_LENGTHS[i];
        const bone = createGatorBone(
            `gatorTailBone${i}`,
            tailParent,
            i === 0
                ? 0
                : -GATOR_TAIL_SEGMENT_LENGTHS[i - 1] *
                    GATOR_TAIL_BONE_SPAN,
            0,
            0
        );

        tailBones.push(bone);
        tailParent = bone;
    }

    return {
        chestBone,
        neckBone,
        headBone,
        jawBone,
        abdomenBone,
        pelvisBone,
        tailRootBone,
        tailBones
    };
}

function skinGatorTorso(bones) {
    const chestMesh = createGatorEllipsoid(
        0.47,
        1.58,
        0.38,
        0.72,
        GATOR_SKIN_MATERIAL,
        20,
        12
    );

    chestMesh.position.set(-0.18, 0, 0);
    bones.chestBone.add(chestMesh);

    const neckMesh = createGatorEllipsoid(
        0.4,
        1.48,
        0.36,
        0.94,
        GATOR_SKIN_MATERIAL,
        20,
        12
    );

    neckMesh.position.set(0.2, 0.002, 0);
    bones.neckBone.add(neckMesh);

    const abdomenMesh = createGatorEllipsoid(
        0.54,
        1.56,
        0.38,
        0.8,
        GATOR_SKIN_MATERIAL,
        20,
        12
    );

    abdomenMesh.position.set(-0.3, 0, 0);
    bones.abdomenBone.add(abdomenMesh);

    const pelvisMesh = createGatorEllipsoid(
        0.5,
        1.52,
        0.37,
        0.72,
        GATOR_SKIN_MATERIAL,
        20,
        12
    );

    pelvisMesh.position.set(-0.12, 0, 0);
    bones.pelvisBone.add(pelvisMesh);

    const pelvisTailBlend = createGatorEllipsoid(
        0.44,
        1.0,
        0.37,
        0.76,
        GATOR_SKIN_MATERIAL,
        20,
        12
    );

    pelvisTailBlend.position.set(-0.43, 0.002, 0);
    bones.pelvisBone.add(pelvisTailBlend);

    const hipBridge = createGatorEllipsoid(
        0.37,
        1.08,
        0.36,
        0.88,
        GATOR_SKIN_MATERIAL,
        20,
        12
    );

    hipBridge.position.set(0.08, 0.002, 0);
    bones.tailRootBone.add(hipBridge);

    addGatorTorsoWeldMeshes(bones);
}

function addGatorTorsoWeldMeshes(bones) {
    const neckHeadBridge = createGatorEllipsoid(
        0.38,
        0.58,
        0.36,
        0.9,
        GATOR_SKIN_MATERIAL,
        18,
        11
    );

    neckHeadBridge.position.set(0.2, 0, 0);
    bones.neckBone.add(neckHeadBridge);

    const neckChestBridge = createGatorEllipsoid(
        0.42,
        0.66,
        0.38,
        0.84,
        GATOR_SKIN_MATERIAL,
        18,
        11
    );

    neckChestBridge.position.set(0.46, 0, 0);
    bones.chestBone.add(neckChestBridge);

    const chestAbdomenBridge = createGatorEllipsoid(
        0.52,
        0.72,
        0.39,
        0.78,
        GATOR_SKIN_MATERIAL,
        18,
        11
    );

    chestAbdomenBridge.position.set(-0.58, 0, 0);
    bones.chestBone.add(chestAbdomenBridge);

    const abdomenPelvisBridge = createGatorEllipsoid(
        0.5,
        0.68,
        0.38,
        0.76,
        GATOR_SKIN_MATERIAL,
        18,
        11
    );

    abdomenPelvisBridge.position.set(-0.56, 0, 0);
    bones.abdomenBone.add(abdomenPelvisBridge);

    const pelvisTailBridge = createGatorEllipsoid(
        0.42,
        0.92,
        0.37,
        0.8,
        GATOR_SKIN_MATERIAL,
        18,
        11
    );

    pelvisTailBridge.position.set(-0.36, 0, 0);
    bones.pelvisBone.add(pelvisTailBridge);

    const tailRootBridge = createGatorEllipsoid(
        0.38,
        1.08,
        0.37,
        0.86,
        GATOR_SKIN_MATERIAL,
        18,
        11
    );

    tailRootBridge.position.set(-0.14, 0, 0);
    bones.tailRootBone.add(tailRootBridge);

    const tailRootCollar = createGatorEllipsoid(
        0.34,
        0.78,
        0.36,
        0.82,
        GATOR_SKIN_MATERIAL,
        16,
        10
    );

    tailRootCollar.position.set(-0.28, 0, 0);
    bones.tailRootBone.add(tailRootCollar);
}

function skinGatorHead(bones) {
    const { headBone, jawBone } = bones;

    const craniumPlate = createGatorEllipsoid(
        0.39,
        1.08,
        0.14,
        1.12,
        GATOR_SKIN_MATERIAL,
        22,
        10
    );

    craniumPlate.position.set(-0.14, 0.034, 0);
    headBone.add(craniumPlate);

    const interocularKeel = createGatorEllipsoid(
        0.072,
        2.1,
        0.36,
        0.16,
        GATOR_SKIN_MATERIAL,
        12,
        7
    );

    interocularKeel.position.set(-0.02, 0.168, 0);
    headBone.add(interocularKeel);

    for (const side of [-1, 1]) {
        const cheek = createGatorEllipsoid(
            0.22,
            1.15,
            0.16,
            0.72,
            GATOR_SKIN_MATERIAL,
            16,
            8
        );

        cheek.position.set(0.1, 0.012, side * 0.225);
        cheek.rotation.y = side * 0.08;
        headBone.add(cheek);
    }

    const upperSnout = new THREE.Mesh(
        createGatorSnoutGeometry(
            1.02,
            0.105,
            0.58,
            0.43,
            0.45
        ),
        GATOR_SKIN_MATERIAL
    );

    upperSnout.position.set(0.06, 0.012, 0);
    upperSnout.castShadow = true;
    upperSnout.receiveShadow = true;
    headBone.add(upperSnout);

    const lowerSnout = new THREE.Mesh(
        createGatorSnoutGeometry(
            0.96,
            0.082,
            0.54,
            0.4,
            0.42
        ),
        GATOR_DARK_MATERIAL
    );

    lowerSnout.position.set(0.04, -0.018, 0);
    lowerSnout.castShadow = true;
    lowerSnout.receiveShadow = true;
    jawBone.add(lowerSnout);

    for (const side of [-1, 1]) {
        createGatorEye(
            headBone,
            -0.01,
            0.125,
            side * 0.204,
            side
        );

        const nostril = createGatorEllipsoid(
            0.029,
            1.05,
            0.26,
            0.72,
            GATOR_DARK_MATERIAL,
            8,
            5
        );

        nostril.position.set(1.0, 0.028, side * 0.118);
        headBone.add(nostril);
    }

    const toothMaterial = new THREE.MeshStandardMaterial({
        color: 0xd8d1b7,
        roughness: 0.8,
        metalness: 0
    });

    const toothPositions = [
        { x: 0.48, size: 1.0 },
        { x: 0.76, size: 0.72 }
    ];

    for (const side of [-1, 1]) {
        for (const spec of toothPositions) {
            const tooth = new THREE.Mesh(
                new THREE.ConeGeometry(
                    0.011 * spec.size,
                    0.028 * spec.size,
                    6
                ),
                toothMaterial
            );

            tooth.rotation.z = Math.PI;
            tooth.position.set(
                spec.x,
                -0.075,
                side * 0.205
            );
            headBone.add(tooth);
        }
    }
}

function skinGatorTail(bones) {
    const { tailBones } = bones;
    const count = tailBones.length;

    for (let i = 0; i < count; i++) {
        const length = GATOR_TAIL_SEGMENT_LENGTHS[i];
        const normalized = i / Math.max(1, count - 1);
        const nextNormalized = (i + 1) / count;

        const startRadius = getGatorTailRadiusAt(normalized);
        const endRadius = getGatorTailRadiusAt(nextNormalized);

        const segment = createGatorTailSegmentMesh(
            length,
            startRadius,
            endRadius
        );

        if (i === 0) {
            segment.position.set(
                GATOR_TAIL_FIRST_SEGMENT_EMBED,
                0,
                0
            );
        }

        tailBones[i].add(segment);

        if (i < count - 1) {
            const seamPatch = createGatorEllipsoid(
                (startRadius + endRadius) * 0.5,
                0.42,
                0.56,
                1.02,
                GATOR_SKIN_MATERIAL,
                12,
                8
            );

            seamPatch.position.set(
                -length * 0.92,
                0,
                0
            );
            tailBones[i].add(seamPatch);
        }

        addGatorTailScutes(
            tailBones[i],
            -length * 0.12,
            -length * 0.38,
            startRadius,
            normalized
        );
    }
}

function skinGatorScutes(bones) {
    addGatorDorsalScutes(
        bones.headBone,
        -0.02,
        -0.16,
        4,
        2,
        0.44,
        0.084,
        0.17
    );

    addGatorDorsalScutes(
        bones.neckBone,
        0.28,
        -0.04,
        4,
        3,
        0.52,
        0.138,
        0.19
    );

    addGatorDorsalScutes(
        bones.chestBone,
        0.38,
        -0.66,
        4,
        7,
        0.64,
        0.17,
        0.23
    );

    addGatorDorsalScutes(
        bones.abdomenBone,
        0.1,
        -0.8,
        4,
        6,
        0.58,
        0.196,
        0.24
    );

    addGatorDorsalScutes(
        bones.pelvisBone,
        -0.02,
        -0.62,
        4,
        5,
        0.48,
        0.176,
        0.21
    );
}

function createGatorLeg(parent, x, z, side, front) {
    const shoulderBone = new THREE.Group();
    shoulderBone.position.set(x, -0.065, z);
    parent.add(shoulderBone);

    const upperLeg = createGatorEllipsoid(
        front ? 0.16 : 0.18,
        1.28,
        0.52,
        0.78,
        GATOR_SKIN_MATERIAL,
        10,
        8
    );

    upperLeg.position.set(-0.07, -0.012, side * 0.025);
    shoulderBone.add(upperLeg);

    const lowerBone = new THREE.Group();
    lowerBone.position.set(-0.2, -0.03, side * 0.065);
    shoulderBone.add(lowerBone);

    const lowerLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(
            front ? 0.052 : 0.062,
            front ? 0.072 : 0.082,
            front ? 0.3 : 0.34,
            8
        ),
        GATOR_SKIN_MATERIAL
    );

    lowerLeg.rotation.z = Math.PI * 0.5;
    lowerLeg.position.x = front ? -0.14 : -0.16;
    lowerLeg.castShadow = true;
    lowerLeg.receiveShadow = true;
    lowerBone.add(lowerLeg);

    const foot = createGatorEllipsoid(
        front ? 0.095 : 0.11,
        1.6,
        0.26,
        0.88,
        GATOR_DARK_MATERIAL,
        9,
        7
    );

    foot.position.set(front ? -0.31 : -0.36, -0.012, 0);
    lowerBone.add(foot);

    shoulderBone.userData.side = side;
    shoulderBone.userData.front = front;
    shoulderBone.userData.baseY = shoulderBone.rotation.y;
    shoulderBone.userData.baseZ = shoulderBone.rotation.z;

    return shoulderBone;
}

function createBayouGator(random) {
    const gator = new THREE.Group();
    gator.name = 'bayouGator';

    const bones = buildGatorSkeleton(gator);

    skinGatorTorso(bones);
    skinGatorHead(bones);
    skinGatorTail(bones);
    skinGatorScutes(bones);

    const legs = [
        createGatorLeg(bones.chestBone, 0.16, 0.35, 1, true),
        createGatorLeg(bones.chestBone, 0.16, -0.35, -1, true),
        createGatorLeg(bones.pelvisBone, -0.18, 0.36, 1, false),
        createGatorLeg(bones.pelvisBone, -0.18, -0.36, -1, false)
    ];

    gator.scale.setScalar(
        THREE.MathUtils.lerp(0.94, 1.06, random())
    );

    Object.assign(gator.userData, {
        chestBone: bones.chestBone,
        abdomenBone: bones.abdomenBone,
        pelvisBone: bones.pelvisBone,
        neckBone: bones.neckBone,
        headBone: bones.headBone,
        jawBone: bones.jawBone,
        tailRootBone: bones.tailRootBone,
        tailBones: bones.tailBones,
        legs,

        random,
        center: new THREE.Vector3(),
        target: new THREE.Vector3(),
        velocity: new THREE.Vector3(),

        phase: random() * Math.PI * 2,

        mode: 'submerged',
        modeTime: THREE.MathUtils.lerp(28, 48, random()),

        speed: THREE.MathUtils.lerp(0.72, 0.96, random()),
        turnSharpness: THREE.MathUtils.lerp(0.18, 0.28, random()),
        yawTurnRate: THREE.MathUtils.lerp(0.24, 0.34, random()),
        swimFrequency: THREE.MathUtils.lerp(1.05, 1.22, random()),

        smoothedTurnBias: 0,
        swimLegTime: THREE.MathUtils.lerp(6, 12, random()),

        patrolRadiusX: THREE.MathUtils.lerp(12, 20, random()),
        patrolRadiusZ: THREE.MathUtils.lerp(8, 16, random()),

        baseWaterY: 0,
        targetRise: -0.24,
        currentRise: -0.24
    });

    ensureGatorHeadTapHelper(gator);

    return gator;
}

function ensureGatorHeadTapHelper(gator) {
    if (gator.userData.headTapHelper) {
        return gator.userData.headTapHelper;
    }

    const headBone = gator.userData.headBone;

    if (!headBone) {
        return null;
    }

    const helper = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshBasicMaterial({
            visible: false,
            depthWrite: false
        })
    );

    helper.name = 'gatorHeadTapHelper';
    helper.userData.bayouGatorTap = true;
    helper.userData.gator = gator;
    helper.position.set(
        GATOR_HEAD_LEN * 0.35 +
            GATOR_SNOUT_MESH_X +
            GATOR_SNOUT_LEN * 0.42,
        0.1,
        0
    );
    helper.scale.set(1.35, 0.95, 1.15);
    headBone.add(helper);
    gator.userData.headTapHelper = helper;

    return helper;
}

function gatorTurnAlignedSway(
    sinValue,
    amplitude,
    turnSign,
    turnBlend
) {
    const sway = sinValue * amplitude;

    if (turnBlend < 0.05 || turnSign === 0) {
        return sway;
    }

    const sameSide =
        Math.max(0, sinValue * turnSign) *
        turnSign *
        amplitude;

    return THREE.MathUtils.lerp(
        sway,
        sameSide,
        turnBlend
    );
}

function updateGator(
    gator,
    elapsedTime,
    delta
) {
    const data = gator.userData;

    data.modeTime -= delta;

    if (data.modeTime <= 0) {
        switch (data.mode) {
            case 'submerged': {
                const roll = data.random();

                if (roll < 0.03) {
                    beginGatorLurk(data, gator);
                } else if (roll < 0.17) {
                    beginGatorHeadUp(data, gator);
                } else {
                    beginGatorSubmerged(data, {
                        minSeconds: 12,
                        maxSeconds: 24
                    });
                }
                break;
            }

            case 'cruise':
                beginGatorSubmerged(data, {
                    minSeconds: 10,
                    maxSeconds: 20,
                    maybeMove: true
                });
                break;

            case 'lurk':
                beginGatorSubmerged(data, {
                    minSeconds: 12,
                    maxSeconds: 22,
                    maybeMove: true
                });
                data.velocity.set(0, 0, 0);
                break;

            case 'peek':
            case 'headup':
            case 'rise':
                beginGatorSubmerged(data, {
                    minSeconds: 12,
                    maxSeconds: 22,
                    maybeMove: true
                });
                break;

            case 'startled':
                beginGatorSubmerged(data, {
                    minSeconds: 14,
                    maxSeconds: 26,
                    maybeMove: true
                });
                break;

            case 'leave':
                beginGatorSubmerged(data, {
                    minSeconds: 12,
                    maxSeconds: 22,
                    maybeMove: true
                });
                break;

            default:
                beginGatorSubmerged(data);
                break;
        }
    }

    if (data.mode === 'lurk') {
        data.target.x = data.lurkTargetX ?? gator.position.x;
        data.target.z = data.lurkTargetZ ?? gator.position.z;
    } else if (data.mode === 'peek') {
        data.target.x = data.peekTargetX ?? gator.position.x;
        data.target.z = data.peekTargetZ ?? gator.position.z;
    } else if (data.mode === 'headup') {
        data.target.x = data.headUpTargetX ?? gator.position.x;
        data.target.z = data.headUpTargetZ ?? gator.position.z;
    }

    const dx =
        data.target.x - gator.position.x;

    const dz =
        data.target.z - gator.position.z;

    const distance =
        Math.hypot(dx, dz);

    if (
        distance < 3.4 &&
        !isGatorHoldingPosition(data) &&
        data.mode !== 'startled'
    ) {
        pickGatorTarget(data);
        data.swimLegTime = THREE.MathUtils.lerp(
            6,
            13,
            data.random()
        );
    }

    if (
        data.mode === 'submerged' &&
        data.swimLegTime != null
    ) {
        data.swimLegTime -= delta;

        if (data.swimLegTime <= 0) {
            if (data.random() < 0.1) {
                beginGatorHeadUp(data, gator);
            } else {
                pickGatorTarget(data);
                data.swimLegTime = THREE.MathUtils.lerp(
                    6,
                    14,
                    data.random()
                );
            }
        }
    }

    const inverseDistance =
        1 / Math.max(distance, 0.0001);

    const modeSpeed =
        isGatorHoldingPosition(data)
            ? 0
            : data.mode === 'startled'
                ? 0.95
                : data.mode === 'submerged'
                    ? 0.58
                    : data.mode === 'leave'
                        ? 0.62
                        : 0.52;

    const desiredVX =
        dx *
        inverseDistance *
        data.speed *
        modeSpeed;

    const desiredVZ =
        dz *
        inverseDistance *
        data.speed *
        modeSpeed;

    const steering =
        1 -
        Math.exp(
            -data.turnSharpness * delta
        );

    data.velocity.x +=
        (
            desiredVX -
            data.velocity.x
        ) *
        steering;

    data.velocity.z +=
        (
            desiredVZ -
            data.velocity.z
        ) *
        steering;

    if (isGatorHoldingPosition(data)) {
        const braking =
            1 -
            Math.exp(-4.5 * delta);

        data.velocity.x *=
            1 - braking;

        data.velocity.z *=
            1 - braking;
    } else {
        applyGatorObstacleSteering(gator, data, delta);
        applyGatorViewBoundarySteering(gator, data, delta);
    }

    const swimSpeed =
        Math.hypot(
            data.velocity.x,
            data.velocity.z
        );

    const drive =
        THREE.MathUtils.clamp(
            swimSpeed /
                Math.max(data.speed, 0.001),
            0,
            1
        );

    const frequency =
        data.swimFrequency *
        THREE.MathUtils.lerp(
            0.78,
            1.08,
            drive
        );

    const phase =
        elapsedTime * frequency +
        data.phase;

    const activeDrive =
        isGatorHoldingPosition(data)
            ? data.mode === 'headup'
                ? 0.14
                : 0.1
            : data.mode === 'startled'
                ? THREE.MathUtils.lerp(
                    0.72,
                    0.96,
                    drive
                )
                : data.mode === 'submerged'
                    ? THREE.MathUtils.lerp(
                        0.34,
                        0.78,
                        drive
                    )
                    : THREE.MathUtils.lerp(
                        0.42,
                        0.92,
                        drive
                    );

    const tailPhase =
        elapsedTime * frequency * 0.76 +
        data.phase;

    let smoothedTurnBias = data.smoothedTurnBias ?? 0;

    if (
        swimSpeed > 0.02 &&
        !isGatorHoldingPosition(data)
    ) {
        const desiredYaw = Math.atan2(
            -data.velocity.z,
            data.velocity.x
        );
        const yawError = shortestAngleDiff(
            gator.rotation.y,
            desiredYaw
        );
        const turnTarget = THREE.MathUtils.clamp(
            yawError * 0.82,
            -0.52,
            0.52
        );
        const turnSmooth =
            1 - Math.exp(-5.2 * delta);

        smoothedTurnBias +=
            (turnTarget - smoothedTurnBias) * turnSmooth;
    } else {
        const turnDecay =
            1 - Math.exp(-4 * delta);

        smoothedTurnBias *= 1 - turnDecay;
    }

    data.smoothedTurnBias = smoothedTurnBias;

    const tailTurnSign =
        smoothedTurnBias < -0.001
            ? 1
            : smoothedTurnBias > 0.001
                ? -1
                : 0;

    const turnBlend = THREE.MathUtils.clamp(
        Math.abs(smoothedTurnBias) / 0.22,
        0,
        1
    );

    const headTurnLead =
        smoothedTurnBias *
        THREE.MathUtils.lerp(0.46, 0.82, drive);

    const tailTurnLead =
        -smoothedTurnBias *
        THREE.MathUtils.lerp(0.42, 0.78, drive);

    const chestYaw =
        gatorTurnAlignedSway(
            Math.sin(tailPhase),
            0.03 * activeDrive,
            tailTurnSign,
            turnBlend * 0.35
        );

    const abdomenYaw =
        gatorTurnAlignedSway(
            Math.sin(tailPhase - 0.2),
            0.082 * activeDrive,
            tailTurnSign,
            turnBlend
        );

    const pelvisYaw =
        gatorTurnAlignedSway(
            Math.sin(tailPhase - 0.4),
            0.118 * activeDrive,
            tailTurnSign,
            turnBlend
        );

    const tailRootYaw =
        gatorTurnAlignedSway(
            Math.sin(tailPhase - 0.62),
            0.148 * activeDrive,
            tailTurnSign,
            turnBlend
        );

    const bodyFollow =
        1 -
        Math.exp(-5.5 * delta);

    data.chestBone.rotation.y +=
        (
            chestYaw -
            data.chestBone.rotation.y
        ) *
        bodyFollow;

    data.abdomenBone.rotation.y +=
        (
            abdomenYaw +
            tailTurnLead * 0.22 -
            data.abdomenBone.rotation.y
        ) *
        bodyFollow;

    data.pelvisBone.rotation.y +=
        (
            pelvisYaw +
            tailTurnLead * 0.38 -
            data.pelvisBone.rotation.y
        ) *
        bodyFollow;

    data.tailRootBone.rotation.y +=
        (
            tailRootYaw +
            tailTurnLead * 0.52 -
            data.tailRootBone.rotation.y
        ) *
        bodyFollow;

    const tailBones =
        data.tailBones || [];

    for (
        let i = 0;
        i < tailBones.length;
        i++
    ) {
        const normalized =
            (i + 1) / tailBones.length;

        const phaseDelay =
            0.52 +
            normalized * 1.35;

        const amplitude =
            THREE.MathUtils.lerp(
                0.1,
                0.46,
                Math.pow(normalized, 1.08)
            ) *
            activeDrive;

        const turnContribution =
            tailTurnLead *
            Math.pow(normalized, 1.18);

        const rawSin = Math.sin(
            tailPhase - phaseDelay
        );

        const swimSway = gatorTurnAlignedSway(
            rawSin,
            amplitude,
            tailTurnSign,
            turnBlend
        );

        const targetYaw =
            swimSway + turnContribution;

        const followSpeed =
            THREE.MathUtils.lerp(
                8,
                5,
                normalized
            );

        const follow =
            1 -
            Math.exp(
                -followSpeed * delta
            );

        tailBones[i].rotation.y +=
            (
                targetYaw -
                tailBones[i].rotation.y
            ) *
            follow;

        tailBones[i].rotation.z +=
            (
                0 -
                tailBones[i].rotation.z
            ) *
            (
                1 -
                Math.exp(-3 * delta)
            );
    }

    const headCounterYaw =
        -chestYaw * 0.42 -
        abdomenYaw * 0.16;

    const headFollow =
        1 -
        Math.exp(-4.5 * delta);

    data.neckBone.rotation.y +=
        (
            -chestYaw * 0.32 +
            headTurnLead * 0.58 -
            data.neckBone.rotation.y
        ) *
        headFollow;

    data.headBone.rotation.y +=
        (
            headCounterYaw +
            headTurnLead -
            data.headBone.rotation.y
        ) *
        headFollow;

    const headIdleRoll =
        Math.sin(
            elapsedTime * 0.32 +
            data.phase
        ) *
        0.004;

    const headPoseFollow =
        1 -
        Math.exp(-4.5 * delta);

    data.headBone.rotation.z +=
        (
            headIdleRoll -
            data.headBone.rotation.z
        ) *
        headPoseFollow;

    const neckNeutralFollow =
        1 -
        Math.exp(-5 * delta);

    if (data.mode === 'headup') {
        const liftFollow =
            1 - Math.exp(-3.4 * delta);

        data.neckBone.rotation.x +=
            (
                0.26 -
                data.neckBone.rotation.x
            ) *
            liftFollow;

        data.neckBone.rotation.z +=
            (
                0 -
                data.neckBone.rotation.z
            ) *
            liftFollow;
    } else if (data.startleFlinchTime <= 0) {
        data.neckBone.rotation.x *= 1 - neckNeutralFollow;
        data.neckBone.rotation.z *= 1 - neckNeutralFollow;
    } else {
        data.neckBone.rotation.z *= 1 - neckNeutralFollow;
    }

    if (data.startleFlinchTime > 0) {
        data.startleFlinchTime -= delta;

        const flinchBlend =
            THREE.MathUtils.clamp(
                data.startleFlinchTime / 0.42,
                0,
                1
            );
        const duckPitch = -0.35 * (1 - flinchBlend);
        const flinchFollow =
            1 - Math.exp(-12 * delta);

        data.neckBone.rotation.x +=
            (
                duckPitch -
                data.neckBone.rotation.x
            ) *
            flinchFollow;

        data.jawBone.rotation.x +=
            (
                0.08 -
                data.jawBone.rotation.x
            ) *
            (1 - Math.exp(-10 * delta));
    } else {
        data.jawBone.rotation.x *= 1 - neckNeutralFollow;
    }

    for (
        let i = 0;
        i < data.legs.length;
        i++
    ) {
        const leg =
            data.legs[i];

        const side =
            leg.userData.side || 1;

        const front =
            leg.userData.front === true;

        const tuckedY =
            side *
            (front ? 0.13 : 0.09);

        const passive =
            Math.sin(
                phase * 0.5 +
                i * 1.4
            ) *
            0.012 *
            drive;

        leg.rotation.y +=
            (
                tuckedY +
                passive -
                leg.rotation.y
            ) *
            (
                1 -
                Math.exp(-5 * delta)
            );

        leg.rotation.z +=
            (
                side * 0.025 -
                leg.rotation.z
            ) *
            (
                1 -
                Math.exp(-5 * delta)
            );
    }

    const propulsionPulse =
        1 +
        Math.pow(
            Math.abs(Math.cos(phase)),
            2
        ) *
        0.1 *
        drive;

    gator.position.x +=
        data.velocity.x *
        propulsionPulse *
        delta;

    gator.position.z +=
        data.velocity.z *
        propulsionPulse *
        delta;

    resolveGatorCollisions(gator, data);

    const riseRate =
        data.mode === 'startled' ? 4.8 : 1.8;

    data.currentRise +=
        (
            data.targetRise -
            data.currentRise
        ) *
        (
            1 -
            Math.exp(-riseRate * delta)
        );

    gator.position.y =
        data.baseWaterY +
        data.currentRise +
        Math.sin(
            elapsedTime * 0.6 +
            data.phase
        ) *
        (data.mode === 'lurk' || data.mode === 'headup'
            ? 0.003
            : 0.006);

    if (
        data.velocity.lengthSq() >
        0.00005 &&
        !isGatorHoldingPosition(data)
    ) {
        const targetYaw =
            Math.atan2(
                -data.velocity.z,
                data.velocity.x
            );

        const turnFollow =
            1 -
            Math.exp(
                -data.yawTurnRate *
                delta
            );

        gator.rotation.y =
            lerpAngle(
                gator.rotation.y,
                targetYaw,
                turnFollow
            );
    }

    const jawTarget =
        data.mode === 'peek' ||
        data.mode === 'rise' ||
        data.mode === 'headup'
            ? 0.014
            : 0;

    data.jawBone.rotation.z +=
        (
            jawTarget -
            data.jawBone.rotation.z
        ) *
        (
            1 -
            Math.exp(-2.5 * delta)
        );
}

function pickGatorTarget(data) {
    const point = sampleGatorFishingViewPoint(
        data,
        data.random
    );

    if (point) {
        data.target.set(
            point.x,
            data.baseWaterY,
            point.z
        );
        return;
    }

    data.target.set(
        data.center.x,
        data.baseWaterY,
        data.center.z
    );
}

function configureGatorHomeRange(data, waterLevel, isMobile) {
    data.mobileHome = isMobile;

    data.center.set(
        CAST_CLEAR_CENTER_X,
        waterLevel,
        CAST_CLEAR_CENTER_Z
    );
    data.patrolRadiusX = CAST_CLEAR_RADIUS_X;
    data.patrolRadiusZ = CAST_CLEAR_RADIUS_Z;
}

function placeGator({
    root,
    random,
    waterLevel,
    lakeMask,
    groundSize,
    obstacles
}) {
    const gators = [];
    const isMobile = isMobileViewport();

    for (let i = 0; i < GATOR_COUNT; i++) {
        const gator = createBayouGator(random);
        const data = gator.userData;

        data.baseWaterY = waterLevel;
        data.lakeMask = lakeMask;
        data.groundSize = groundSize;
        data.obstacles = obstacles;
        configureGatorHomeRange(
            data,
            waterLevel,
            isMobile
        );

        if (isMobile) {
            const spawn = sampleGatorFishingViewPoint(
                data,
                random
            );

            if (spawn) {
                gator.position.set(
                    spawn.x,
                    waterLevel - 0.22,
                    spawn.z
                );
            } else {
                gator.position.set(
                    data.center.x,
                    waterLevel - 0.22,
                    data.center.z
                );
            }

            gator.rotation.y = Math.atan2(
                BOAT_ANCHOR_X - gator.position.x,
                BOAT_ANCHOR_Z - gator.position.z
            );
            beginGatorSubmerged(data, {
                minSeconds: 10,
                maxSeconds: 18,
                maybeMove: true
            });
        } else {
            const spawn = sampleGatorFishingViewPoint(
                data,
                random
            );

            if (spawn) {
                gator.position.set(
                    spawn.x,
                    waterLevel - 0.22,
                    spawn.z
                );
            } else {
                gator.position.set(
                    0,
                    waterLevel - 0.22,
                    10
                );
                data.center.set(0, waterLevel, 10);
            }

            gator.rotation.y = Math.atan2(
                BOAT_ANCHOR_X - gator.position.x,
                BOAT_ANCHOR_Z - gator.position.z
            );
        }

        pickGatorTarget(data);
        root.add(gator);
        gators.push(gator);
    }

    root.userData.gators = gators;
}

function sampleTurtleLogPoint(rand, lakeMask, groundSize) {
    // Right beside the boat — always in mobile gameplay view.
    for (let attempt = 0; attempt < 60; attempt++) {
        const side = rand() < 0.5 ? 1 : -1;
        const x = side * THREE.MathUtils.lerp(3.2, 4.8, rand());
        const z = THREE.MathUtils.lerp(0.2, 2.8, rand());

        if (!sampleMaskWater(x, z, lakeMask, groundSize)) {
            continue;
        }

        const distFromBoat = distanceFromBoat(x, z);
        if (distFromBoat < 2.8 || distFromBoat > 6.5) {
            continue;
        }

        return { x, z };
    }

    return { x: 4.0, z: 1.2 };
}

function placeTurtleLog({
    root,
    random,
    waterLevel,
    lakeMask,
    groundSize
}) {
    const point = sampleTurtleLogPoint(random, lakeMask, groundSize);
    const log = createDriftwoodLog(random, waterLevel);
    log.position.set(point.x, 0, point.z);
    log.rotation.y = random() * Math.PI * 2;
    log.rotation.z = THREE.MathUtils.lerp(-0.05, 0.05, random());
    log.userData.basePositionY = log.position.y;
    log.userData.baseRotationX = log.rotation.x;
    log.userData.baseRotationZ = log.rotation.z;
    log.userData.isTurtleLog = true;
    root.add(log);
    return point;
}

function sampleLogPoint(rand, lakeMask, groundSize, placed) {
    // Keep logs in the ring the fishing camera actually sees — not the far lake edges.
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

        if (isInCastClearZone(x, z, 0)) {
            continue;
        }

        const distFromBoat = Math.hypot(x, z + 1.5);
        if (distFromBoat < 13 || distFromBoat > 58) {
            continue;
        }

        const tooClose = placed.some((other) => {
            const dx = x - other.x;
            const dz = z - other.z;
            return dx * dx + dz * dz < 4.5 * 4.5;
        });

        if (tooClose) {
            continue;
        }

        return { x, z };
    }

    return null;
}

function placeLogs({
    root,
    random,
    waterLevel,
    lakeMask,
    groundSize,
    initialPlaced = []
}) {
    const placed = [...initialPlaced];

    for (let i = 0; i < LOG_COUNT; i++) {
        const point = sampleLogPoint(random, lakeMask, groundSize, placed);
        if (!point) {
            continue;
        }

        placed.push(point);

        const log = createBrokenLog(random, waterLevel);
        log.position.set(point.x, 0, point.z);
        log.rotation.y = random() * Math.PI * 2;
        log.rotation.z = THREE.MathUtils.lerp(-0.05, 0.05, random());

        log.userData.basePositionY = log.position.y;
        log.userData.baseRotationX = log.rotation.x;
        log.userData.baseRotationZ = log.rotation.z;

        root.add(log);
    }
}

function placeDragonflies({
    root,
    random,
    waterLevel
}) {
    const dragonflies = [];

    for (let i = 0; i < DRAGONFLY_COUNT; i++) {
        const dragonfly = createDragonfly(random);

        const side = i % 2 === 0 ? -1 : 1;
        const center = dragonfly.userData.center;

        center.set(
            side * THREE.MathUtils.lerp(5, 12, random()),
            waterLevel + dragonfly.userData.height,
            THREE.MathUtils.lerp(4, 22, random())
        );

        const data = dragonfly.userData;
        data.bayouRoot = root;
        data.landsOnHalley = i === 0;
        pickRestHoverPoint(data, random);
        dragonfly.position.copy(data.currentTarget);

        if (data.landsOnHalley) {
            data.modeTime = THREE.MathUtils.lerp(3.5, 7, random());
            data.forceHatVisit = true;
        }

        root.add(dragonfly);
        dragonflies.push(dragonfly);
    }

    root.userData.dragonflies = dragonflies;
}

/**
 * Creates swamp logs, Spanish moss and two dragonflies.
 *
 * Pass the cypress group returned by createBayouCypress() so moss can be
 * attached directly to the generated trees.
 */
export function createBayouExtras(scene, {
    waterLevel = 0,
    lakeMask = null,
    cypressGroup = null,
    groundSize = GROUND_SIZE,
    seed = 65129
} = {}) {
    const root = new THREE.Group();
    root.name = 'bayouExtras';

    const randomTurtleLog = mulberry32(seed + 101);
    const randomLogs = mulberry32(seed + 202);
    const randomDragonflies = mulberry32(seed + 303);
    const randomGator = mulberry32(seed + 404);
    const randomTurtles = mulberry32(seed + 505);
    const randomMoss = mulberry32(seed + 606);

    const turtleLogPoint = placeTurtleLog({
        root,
        random: randomTurtleLog,
        waterLevel,
        lakeMask,
        groundSize
    });

    placeLogs({
        root,
        random: randomLogs,
        waterLevel,
        lakeMask,
        groundSize,
        initialPlaced: turtleLogPoint ? [turtleLogPoint] : []
    });

    const gatorObstacles = buildGatorSwimObstacles({
        cypressGroup,
        root
    });

    placeDragonflies({
        root,
        random: randomDragonflies,
        waterLevel
    });

    placeGator({
        root,
        random: randomGator,
        waterLevel,
        lakeMask,
        groundSize,
        obstacles: gatorObstacles
    });

    root.userData.gatorObstacles = gatorObstacles;

    root.userData.turtles = placeTurtlesOnLogs(root, randomTurtles);

    root.userData.mossCurtains = attachSpanishMossToTrees(
        cypressGroup,
        randomMoss
    );

    root.visible = false;
    scene.add(root);

    return root;
}

export function getBayouDragonflyTapTargets(group) {
    const targets = [];
    const dragonflies = group?.userData?.dragonflies || [];

    for (const dragonfly of dragonflies) {
        const data = dragonfly.userData;
        if (
            data.landsOnHalley &&
            data.mode === 'perched' &&
            data.perchedOnHat &&
            dragonfly.userData.tapHelper
        ) {
            targets.push(dragonfly.userData.tapHelper);
        }
    }

    return targets;
}

export function dismissPerchedBayouDragonfly(group, hitObject) {
    const dragonflies = group?.userData?.dragonflies || [];

    for (const dragonfly of dragonflies) {
        const data = dragonfly.userData;
        if (!data.landsOnHalley || data.mode !== 'perched' || !data.perchedOnHat) {
            continue;
        }

        let node = hitObject;
        while (node) {
            if (node === dragonfly || node.userData?.bayouDragonflyTap) {
                unmountDragonflyFromPerch(dragonfly, data.bayouRoot);
                data.perchedOnHat = false;
                data.justLeftHat = true;
                data.mode = 'patrol';
                data.flyHeadFirst = true;
                data.patrolDartsRemaining = Math.floor(
                    THREE.MathUtils.lerp(3, 5, data.random())
                );
                pickPatrolDart(data, data.random, dragonfly.position);
                return true;
            }
            node = node.parent;
        }
    }

    return false;
}

/**
 * Call every frame with elapsed time in seconds.
 */
export function updateBayouExtras(group, elapsedTime, isBayou, context = {}) {
    if (!group) {
        return;
    }

    group.visible = isBayou === true;

    const dragonflies = group.userData.dragonflies || [];
    const cat = context.cat ?? null;

    if (!isBayou) {
        for (const dragonfly of dragonflies) {
            if (dragonfly.parent !== group && dragonfly.userData.bayouRoot === group) {
                unmountDragonflyFromPerch(dragonfly, group);
                dragonfly.userData.perchedOnHat = false;
                dragonfly.userData.mode = 'rest';
            }
        }
    }

    for (const dragonfly of dragonflies) {
        const data = dragonfly.userData;
        const delta = Math.min(
            0.05,
            Math.max(0.001, elapsedTime - (data.lastElapsedTime ?? elapsedTime))
        );
        data.lastElapsedTime = elapsedTime;

        if (isBayou) {
            updateDragonflyFlight(dragonfly, data, delta, elapsedTime, {
                cat
            });
        }

        animateDragonflyWings(
            data,
            data.wingRoots || [],
            data.wings || [],
            data.wingVeins || [],
            data.wingBlurGroups || [],
            elapsedTime
        );
    }

    const gators = group.userData.gators || [];

    for (const gator of gators) {
        const data = gator.userData;
        const delta = Math.min(
            0.05,
            Math.max(
                0.001,
                elapsedTime - (data.lastElapsedTime ?? elapsedTime)
            )
        );
        data.lastElapsedTime = elapsedTime;

        if (isBayou) {
            updateGator(gator, elapsedTime, delta);
        }
    }

    const mossCurtains = group.userData.mossCurtains || [];

    for (const curtain of mossCurtains) {
        curtain.traverse((object) => {
            if (!object.isMesh) {
                return;
            }

            const base = object.userData.baseRotationZ || 0;
            const phase = object.userData.swayPhase || 0;
            const speed = object.userData.swaySpeed || 0.25;

            object.rotation.z =
                base +
                Math.sin(elapsedTime * speed + phase) * 0.025;
        });
    }

    const logs = group.children.filter(
        (child) => child.name === 'bayouLog' && child.userData.hasTurtles
    );

    for (const log of logs) {
        const data = log.userData;
        const phase = data.rockPhase || 0;
        const weightBias = data.turtleWeightBias || 0;

        const slowWave = elapsedTime * 0.72 + phase;
        const secondaryWave = elapsedTime * 1.08 + phase * 1.37;

        log.position.y =
            (data.basePositionY || 0) +
            Math.sin(slowWave) * 0.018 +
            Math.sin(secondaryWave) * 0.006;

        log.rotation.x =
            (data.baseRotationX || 0) +
            weightBias * 0.055 +
            Math.sin(slowWave) * 0.025 +
            Math.sin(secondaryWave) * 0.008;

        log.rotation.z =
            (data.baseRotationZ || 0) +
            Math.sin(elapsedTime * 0.51 + phase * 0.8) * 0.009;
    }

    const turtles = group.userData.turtles || [];

    for (const turtle of turtles) {
        const data = turtle.userData;
        const head = data.head;
        if (!head) {
            continue;
        }

        const lookAmount = data.lookAmount || 0.05;
        const headYawSpeed = data.headYawSpeed ?? 0.42;
        const gesture = turtleGestureEnvelope(elapsedTime, data);
        const gestureWave = Math.sin(
            elapsedTime * 3.2 + (data.gesturePhase ?? data.phase)
        );

        head.rotation.y =
            Math.sin(elapsedTime * headYawSpeed + data.phase) * lookAmount +
            gesture * (data.gestureHeadTurn ?? 0.12) * gestureWave;
        head.rotation.z =
            Math.sin(
                elapsedTime * (data.headTiltSpeed ?? 0.31) +
                (data.headTiltPhase ?? data.phase)
            ) *
            THREE.MathUtils.lerp(0.022, 0.04, lookAmount / 0.05) +
            gesture * 0.035 * Math.sin(elapsedTime * 2.8 + data.headTiltPhase);
        head.position.x =
            (data.headBaseX ?? 0.365) +
            Math.sin(
                elapsedTime * (data.headBobSpeed ?? 0.55) +
                (data.headBobPhase ?? data.phase)
            ) *
            0.01 +
            gesture * (data.gestureHeadStretch ?? 0.04) *
                (0.65 + 0.35 * Math.sin(elapsedTime * 2.4 + data.phase));
        head.position.y =
            (data.headBaseY ?? 0.085) +
            gesture * 0.012 * Math.sin(elapsedTime * 3.6 + data.headBobPhase);

        const neck = data.neck;
        if (neck) {
            neck.rotation.y =
                Math.sin(
                    elapsedTime * headYawSpeed * (data.neckYawFactor ?? 0.7) +
                    (data.neckPhase ?? data.phase)
                ) *
                lookAmount *
                0.7 +
                gesture * (data.gestureHeadTurn ?? 0.12) * 0.55 * gestureWave;
            neck.scale.z =
                0.9 + gesture * 0.14 * (0.5 + 0.5 * Math.sin(elapsedTime * 2.6 + data.neckPhase));
        }

        const tail = data.tail;
        if (tail) {
            tail.rotation.y =
                Math.sin(elapsedTime * 0.62 + (data.phase ?? 0)) * 0.07 +
                gesture * 0.11 * gestureWave;
            tail.rotation.z =
                (data.tailBaseRotationZ ?? 0.12) +
                Math.sin(elapsedTime * 1.05 + (data.phase ?? 0)) * 0.035;
        }

        turtle.rotation.z =
            (data.baseRotationZ ?? turtle.rotation.z) +
            Math.sin(
                elapsedTime * (data.bodySwaySpeed ?? 0.18) +
                (data.bodySwayPhase ?? data.phase)
            ) *
            0.014 +
            gesture * 0.008 * gestureWave;

        const feet = data.feet || [];
        for (const foot of feet) {
            const wigglePhase = foot.userData.wigglePhase ?? data.phase;
            const wiggleSpeed = foot.userData.wiggleSpeed ?? 0.28;
            const idleWiggle =
                Math.sin(elapsedTime * wiggleSpeed + wigglePhase) * 0.028;
            const footPulse = Math.sin(
                elapsedTime * 4.1 +
                wigglePhase +
                (foot.userData.isFront ? 0 : Math.PI * 0.5) +
                (foot.userData.side ?? 1) * 0.4
            );
            const lift = gesture * (data.gestureFootLift ?? 0.09) * footPulse;

            foot.rotation.x =
                (foot.userData.baseRotationX ?? 0) + idleWiggle + lift;
            foot.rotation.z =
                (foot.userData.baseRotationZ ?? 0) +
                gesture * 0.045 * footPulse * (foot.userData.side ?? 1);
        }
    }
}

export function syncBayouExtrasVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}

export function getBayouGatorHeadTapTargets(group) {
    const targets = [];

    for (const gator of group?.userData?.gators || []) {
        const helper =
            gator.userData.headTapHelper ||
            ensureGatorHeadTapHelper(gator);

        if (helper) {
            targets.push(helper);
        }
    }

    return targets;
}

function tryStartleBayouGatorAtThreat(
    group,
    gator,
    threatX,
    threatZ,
    hooks = {}
) {
    if (!group || !gator) {
        return false;
    }

    const now = performance.now();
    const lastStartle = group.userData._lastGatorBobberStartleAt ?? 0;

    if (now - lastStartle < GATOR_BOBBER_STARTLE_COOLDOWN_MS) {
        return false;
    }

    beginGatorStartle(
        gator.userData,
        gator,
        threatX,
        threatZ,
        hooks
    );
    group.userData._lastGatorBobberStartleAt = now;

    return true;
}

/**
 * Visual-only reaction when the player taps the gator's head (Louisiana Bayou).
 */
export function tryStartleBayouGatorFromTap(
    group,
    hitObject,
    hitPoint,
    hooks = {}
) {
    let node = hitObject;

    while (node) {
        if (node.userData?.bayouGatorTap && node.userData.gator) {
            const gator = node.userData.gator;
            const threatX = hitPoint?.x ?? gator.position.x;
            const threatZ = hitPoint?.z ?? gator.position.z;

            return tryStartleBayouGatorAtThreat(
                group,
                gator,
                threatX,
                threatZ,
                hooks
            );
        }

        node = node.parent;
    }

    return false;
}

/**
 * Visual-only reaction when a bobber lands near the gator's snout (Louisiana Bayou).
 * Returns true if a gator was startled.
 */
export function tryStartleBayouGatorFromBobber(
    group,
    bobberPosition,
    hooks = {}
) {
    if (!group?.userData?.gators?.length || !bobberPosition) {
        return false;
    }

    for (const gator of group.userData.gators) {
        const snoutPos = getGatorSnoutWorldPosition(
            gator,
            _gatorSnoutScratch
        );
        const dist = Math.hypot(
            snoutPos.x - bobberPosition.x,
            snoutPos.z - bobberPosition.z
        );

        if (dist <= GATOR_BOBBER_STARTLE_RADIUS) {
            return tryStartleBayouGatorAtThreat(
                group,
                gator,
                bobberPosition.x,
                bobberPosition.z,
                hooks
            );
        }
    }

    return false;
}
