import * as THREE from 'three';
import { getRiverDownstreamDir } from './riverDockPostWake.js';

const POOL_SIZE = 48;
const V_ARM_ANGLE = 0.22;
const TRAIL_LIFETIME = 3.8;
/** Above water (2), grass, dock splashes (1003), particles — render last. */
const WAKE_RENDER_ORDER = 5000;
const STEM_LENGTH = 4.5;
const ARM_LENGTH = 8.5;
/** Push wake origin past the transom into the river (world +Z / top of screen). */
const WATER_ENTRY_OFFSET = 0.35;

let foamStripTexture = null;

function createFoamStripTexture() {
    if (foamStripTexture) {
        return foamStripTexture;
    }

    const w = 128;
    const h = 512;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    for (let strand = 0; strand < 4; strand++) {
        ctx.beginPath();

        const centerOffset = (strand - 1.5) * 5;
        const phase = strand * 1.7;

        for (let y = 0; y <= h; y += 7) {
            const t = y / h;

            const x =
                w * 0.5 +
                centerOffset +
                Math.sin(t * 22 + phase) * 3.5 +
                Math.sin(t * 51 + phase * 0.7) * 1.5;

            if (y === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
        gradient.addColorStop(0.18, 'rgba(245,252,255,0.75)');
        gradient.addColorStop(0.68, 'rgba(225,242,250,0.32)');
        gradient.addColorStop(1, 'rgba(215,235,245,0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = strand === 1 || strand === 2 ? 7 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    for (let i = 0; i < 85; i++) {
        const y = Math.random() * h;
        const t = y / h;
        const alpha = (1 - t) * (0.18 + Math.random() * 0.34);

        const x = w * 0.5 + (Math.random() - 0.5) * 42;
        const radius = 0.8 + Math.random() * 2.3;

        ctx.fillStyle = `rgba(245,252,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    foamStripTexture = new THREE.CanvasTexture(canvas);
    foamStripTexture.colorSpace = THREE.SRGBColorSpace;
    foamStripTexture.wrapS = THREE.ClampToEdgeWrapping;
    foamStripTexture.wrapT = THREE.ClampToEdgeWrapping;
    foamStripTexture.needsUpdate = true;

    return foamStripTexture;
}

function makeWakeMaterial(map, opacity = 0.9) {
    const tex = map.clone();
    tex.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        fog: false,
        toneMapped: false
    });
}

function configureWakeMesh(mesh, phase = 0) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.frustumCulled = false;
    mesh.renderOrder = WAKE_RENDER_ORDER;
    mesh.userData.wakePhase = phase;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ waterY?: number }} [options]
 */
export function createBoatSternWake(scene, { waterY = 0 } = {}) {
    const group = new THREE.Group();
    group.name = 'boatSternWake';
    group.frustumCulled = false;
    group.renderOrder = WAKE_RENDER_ORDER;
    group.userData.waterY = waterY;
    group.userData.spawnTimer = 0;
    group.userData.rippleTimer = 0;

    const stripTex = createFoamStripTexture();

    const sternChurn = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.4),
        makeWakeMaterial(stripTex, 0.72)
    );
    sternChurn.name = 'boatWake-sternChurn';
    configureWakeMesh(sternChurn, 0.2);
    group.add(sternChurn);

    const centerStem = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, STEM_LENGTH),
        makeWakeMaterial(stripTex, 0.32)
    );
    centerStem.name = 'boatWake-centerStem';
    configureWakeMesh(centerStem, 1.1);
    group.add(centerStem);

    const wakeArms = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(
            new THREE.PlaneGeometry(0.72, ARM_LENGTH),
            makeWakeMaterial(stripTex, 0.46)
        );
        arm.name = side < 0 ? 'boatWake-leftArm' : 'boatWake-rightArm';
        arm.userData.side = side;
        configureWakeMesh(arm, side * 2.4);
        group.add(arm);
        wakeArms.push(arm);
    }

    const trailPool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            makeWakeMaterial(stripTex, 0.48)
        );
        configureWakeMesh(mesh);
        mesh.visible = false;
        mesh.userData.age = 0;
        mesh.userData.lifetime = TRAIL_LIFETIME;
        group.add(mesh);
        trailPool.push(mesh);
    }

    group.userData.sternChurn = sternChurn;
    group.userData.centerStem = centerStem;
    group.userData.wakeArms = wakeArms;
    group.userData.trailPool = trailPool;
    group.visible = false;
    scene.add(group);
    return group;
}

export function disposeBoatSternWake(group, scene) {
    if (!group) {
        return;
    }
    scene?.remove(group);
    group.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            child.material.dispose();
        }
    });
}

function acquireTrail(pool) {
    for (const mesh of pool) {
        if (!mesh.visible) {
            return mesh;
        }
    }
    let oldest = pool[0];
    for (const mesh of pool) {
        if (mesh.userData.age > oldest.userData.age) {
            oldest = mesh;
        }
    }
    return oldest;
}

function spawnTrailPiece(pool, x, z, surfaceY, scaleX, scaleZ, rotation, opacity, driftX, driftZ, lifetime, swayDirX, swayDirY, distFromStern) {
    const mesh = acquireTrail(pool);
    if (!mesh) {
        return;
    }

    mesh.position.set(x, surfaceY, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotation;
    mesh.scale.set(scaleX, scaleZ, 1);
    mesh.material.opacity = opacity;
    mesh.visible = true;
    mesh.userData.age = 0;
    mesh.userData.lifetime = lifetime;
    mesh.userData.baseScaleX = scaleX;
    mesh.userData.baseScaleZ = scaleZ;
    mesh.userData.driftX = driftX;
    mesh.userData.driftZ = driftZ;
    mesh.userData.startOpacity = opacity;
    mesh.userData.baseX = x;
    mesh.userData.baseZ = z;
    mesh.userData.baseY = surfaceY;
    mesh.userData.swayDirX = swayDirX;
    mesh.userData.swayDirY = swayDirY;
    mesh.userData.distFromStern = distFromStern;
    mesh.userData.baseRotation = rotation;
    mesh.userData.swayPhase = Math.random() * Math.PI * 2;
    mesh.userData.rotWobble = (Math.random() - 0.5) * 0.04;
}

/** scaleX = width (world X), scaleZ = length downstream when aligned to heading. */
function spawnDownstreamTrail(
    pool,
    x,
    z,
    surfaceY,
    length,
    width,
    opacity,
    driftX,
    driftZ,
    lifetime,
    swayDirX,
    swayDirY,
    distFromStern,
    rotation = 0
) {
    spawnTrailPiece(
        pool,
        x,
        z,
        surfaceY,
        width,
        length,
        rotation,
        opacity,
        driftX,
        driftZ,
        lifetime,
        swayDirX,
        swayDirY,
        distFromStern
    );
}

function spawnWakeBurst(
    group,
    originX,
    originZ,
    surfaceY,
    downstream,
    perp,
    halfWidth
) {
    const pool = group.userData.trailPool;

    const distanceAlongWake = 4.0 + Math.random() * 7.5;
    const heading = wakeHeadingXZ(downstream);

    if (Math.random() < 0.42) {
        spawnDownstreamTrail(
            pool,
            originX + downstream.x * distanceAlongWake,
            originZ + downstream.y * distanceAlongWake,
            surfaceY,
            0.8 + Math.random() * 0.7,
            0.18 + Math.random() * 0.08,
            0.16 + Math.random() * 0.07,
            downstream.x * 0.05,
            downstream.y * 0.05,
            TRAIL_LIFETIME * (0.65 + Math.random() * 0.2),
            perp.x,
            perp.y,
            distanceAlongWake,
            heading
        );
    }

    const sternEdgeOffset = halfWidth * 0.72;

    for (const side of [-1, 1]) {
        const armDirection = rotateDir2(
            downstream,
            side * V_ARM_ANGLE
        );

        const armHeading = wakeHeadingXZ(armDirection);

        const armOriginX =
            originX + perp.x * sternEdgeOffset * side;

        const armOriginZ =
            originZ + perp.y * sternEdgeOffset * side;

        const x =
            armOriginX +
            armDirection.x * distanceAlongWake +
            perp.x * side * ((Math.random() - 0.5) * 0.18);

        const z =
            armOriginZ +
            armDirection.y * distanceAlongWake +
            perp.y * side * ((Math.random() - 0.5) * 0.18);

        spawnDownstreamTrail(
            pool,
            x,
            z,
            surfaceY,
            0.7 + Math.random() * 0.9,
            0.12 + Math.random() * 0.09,
            0.18 + Math.random() * 0.09,
            downstream.x * 0.025 + perp.x * side * 0.035,
            downstream.y * 0.025 + perp.y * side * 0.035,
            TRAIL_LIFETIME * (0.8 + Math.random() * 0.3),
            perp.x,
            perp.y,
            distanceAlongWake,
            armHeading
        );
    }
}

/** Heading on the XZ plane (same convention as bobberWake: atan2(dx, dz)). */
function wakeHeadingXZ(downstream) {
    return Math.atan2(downstream.x, downstream.y);
}

function orientWakeMesh(mesh, heading, { wobble = 0 } = {}) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.y = 0;
    mesh.rotation.z = heading + wobble;
}

function rotateDir2(dir, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new THREE.Vector2(
        dir.x * cos - dir.y * sin,
        dir.x * sin + dir.y * cos
    );
}

/** 0 at the stern, 1 at the far tip — turbulence ramps up downstream. */
function wakeTurbulence(length, maxLen = STEM_LENGTH) {
    const t = THREE.MathUtils.clamp(length / maxLen, 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Lateral sway wave — used as a pivot angle multiplier, not a whole-mesh slide.
 */
function wakeLateralSway(time, alongWake, phase, amplitude = 1) {
    const primary = Math.sin(time * 1.28 + alongWake * 0.34 + phase);
    const secondary = Math.sin(time * 2.05 + alongWake * 0.19 + phase * 1.6) * 0.42;
    const tertiary = Math.sin(time * 0.72 + phase * 0.8) * 0.18;
    return (primary + secondary + tertiary) * amplitude;
}

function wakeSurfaceBob(time, alongWake, phase, turbulence = 1) {
    const bob = Math.sin(time * 2.15 + alongWake * 0.25 + phase) * 0.016
        + Math.sin(time * 3.4 + phase * 1.2) * 0.007;
    return bob * turbulence;
}

function animateWakeTexture(
    material,
    time,
    phase,
    turbulence = 1
) {
    if (!material?.map) {
        return;
    }

    material.map.offset.y = 0;

    material.map.offset.x =
        Math.sin(time * 0.7 + phase) *
        0.0025 *
        turbulence;
}

/**
 * Pivot wake plane from sternAnchor — narrow end stays at the boat, tip swings with turbulence.
 */
function placeLivingStemMesh(mesh, sternAnchor, dir, surfaceY, length, heading, time, {
    maxAngle = 0.075,
    widthPulse = 0.07,
    baseOpacity = 0.5,
    maxLen = STEM_LENGTH
} = {}) {
    const phase = mesh.userData.wakePhase ?? 0;
    const turb = wakeTurbulence(length, maxLen);
    const half = length * 0.5;

    const swayAngle = wakeLateralSway(time, length * 0.55, phase, maxAngle * turb);
    const swayedDir = rotateDir2(dir, swayAngle);

    mesh.position.set(
        sternAnchor.x + swayedDir.x * half,
        surfaceY + wakeSurfaceBob(time, length, phase, turb),
        sternAnchor.z + swayedDir.y * half
    );
    orientWakeMesh(mesh, heading + swayAngle);

    const widthBreath = 1 + Math.sin(time * 1.75 + phase) * widthPulse * turb;
    const lengthBreath = 1 + Math.sin(time * 1.35 + phase * 1.1) * 0.035 * turb;
    mesh.scale.set(widthBreath, lengthBreath, 1);

    const opacityPulse = 0.9 + Math.sin(time * 2.2 + phase) * 0.1 * turb;
    mesh.material.opacity = baseOpacity * opacityPulse;
    animateWakeTexture(mesh.material, time, phase, turb);
}

function wakeOriginFromAnchor(anchorPos, downstream) {
    return new THREE.Vector3(
        anchorPos.x + downstream.x * WATER_ENTRY_OFFSET,
        anchorPos.y,
        anchorPos.z + downstream.y * WATER_ENTRY_OFFSET
    );
}

export function updateBoatSternWake(group, delta, time, {
    platform,
    flowDirection,
    splashAt,
    scene,
    boatSpeed = 1
}) {
    if (!group || !platform?.platformMesh) {
        return;
    }

    const anchor = platform.platformMesh.userData.sternWakeAnchor;
    if (!anchor) {
        group.visible = false;
        return;
    }

    const speedAmount = THREE.MathUtils.clamp(boatSpeed, 0, 1);

    if (speedAmount < 0.03) {
        group.visible = false;

        for (const mesh of group.userData.trailPool ?? []) {
            mesh.visible = false;
        }

        return;
    }

    group.visible = true;
    group.userData.speedAmount = speedAmount;

    if (scene && group.parent !== scene) {
        group.parent?.remove(group);
        scene.add(group);
    }

    const downstream = getRiverDownstreamDir(flowDirection);
    const perp = new THREE.Vector2(-downstream.y, downstream.x);
    const heading = wakeHeadingXZ(downstream);
    const halfWidth = platform.platformMesh.userData.sternHalfWidth ?? 3.2;
    const waterY = group.userData.waterY ?? 0;
    const surfaceY = waterY + 0.018;

    const anchorPos = new THREE.Vector3();
    anchor.getWorldPosition(anchorPos);
    const origin = wakeOriginFromAnchor(anchorPos, downstream);

    const sternChurn = group.userData.sternChurn;
    if (sternChurn) {
        placeLivingStemMesh(
            sternChurn,
            origin,
            downstream,
            surfaceY,
            2.4,
            heading,
            time,
            {
                maxAngle: 0.008,
                widthPulse: 0.025,
                baseOpacity: 0.56,
                maxLen: 2.4
            }
        );
    }

    placeLivingStemMesh(
        group.userData.centerStem,
        origin,
        downstream,
        surfaceY,
        STEM_LENGTH,
        heading,
        time,
        {
            maxAngle: 0.004,
            widthPulse: 0.015,
            baseOpacity: 0.22,
            maxLen: STEM_LENGTH
        }
    );

    for (const arm of group.userData.wakeArms ?? []) {
        const side = arm.userData.side ?? -1;

        const relativeArmAngle = side * V_ARM_ANGLE;
        const armDir = rotateDir2(downstream, relativeArmAngle);
        const armHeading = wakeHeadingXZ(armDir);

        const sternEdgeOffset = halfWidth * 0.72;

        const armOrigin = new THREE.Vector3(
            origin.x + perp.x * sternEdgeOffset * side,
            origin.y,
            origin.z + perp.y * sternEdgeOffset * side
        );

        placeLivingStemMesh(
            arm,
            armOrigin,
            armDir,
            surfaceY,
            ARM_LENGTH,
            armHeading,
            time,
            {
                maxAngle: 0.006,
                widthPulse: 0.015,
                baseOpacity: 0.38,
                maxLen: ARM_LENGTH
            }
        );
    }

    group.userData.spawnTimer = (group.userData.spawnTimer ?? 0) + delta;
    if (group.userData.spawnTimer >= 0.22) {
        spawnWakeBurst(group, origin.x, origin.z, surfaceY, downstream, perp, halfWidth);
        group.userData.spawnTimer = 0;
    }

    group.userData.rippleTimer = (group.userData.rippleTimer ?? 0) + delta;
    if (splashAt && group.userData.rippleTimer >= 0.32) {
        splashAt(origin.x + downstream.x * 0.4, origin.z + downstream.y * 0.4);
        splashAt(
            origin.x + perp.x * halfWidth * 0.32 + downstream.x * 0.25,
            origin.z + perp.y * halfWidth * 0.32 + downstream.y * 0.25
        );
        splashAt(
            origin.x - perp.x * halfWidth * 0.32 + downstream.x * 0.25,
            origin.z - perp.y * halfWidth * 0.32 + downstream.y * 0.25
        );
        group.userData.rippleTimer = 0;
    }

    for (const mesh of group.userData.trailPool ?? []) {
        if (!mesh.visible) {
            continue;
        }

        mesh.userData.age += delta;
        const t = mesh.userData.age / mesh.userData.lifetime;
        if (t >= 1) {
            mesh.visible = false;
            continue;
        }

        const age = mesh.userData.age;
        const phase = mesh.userData.swayPhase ?? 0;
        const lifeFade = 1 - t * 0.45;
        const dist = mesh.userData.distFromStern ?? STEM_LENGTH * 0.5;
        const turb = wakeTurbulence(dist);
        const sdx = mesh.userData.swayDirX ?? 0;
        const sdy = mesh.userData.swayDirY ?? 0;

        const driftX = mesh.userData.baseX + (mesh.userData.driftX || 0) * age;
        const driftZ = mesh.userData.baseZ + (mesh.userData.driftZ || 0) * age;
        const lateral = wakeLateralSway(time, dist + age * 1.2, phase, 0.045 * turb) * lifeFade;

        mesh.position.x = driftX + sdx * lateral;
        mesh.position.z = driftZ + sdy * lateral;
        mesh.position.y = mesh.userData.baseY + wakeSurfaceBob(time, dist + age, phase, turb) * lifeFade;

        mesh.rotation.z =
            (mesh.userData.baseRotation ?? 0) +
            (mesh.userData.rotWobble ?? 0) +
            wakeLateralSway(
                time,
                dist,
                phase + 1.1,
                0.012 * turb
            ) * lifeFade;

        const grow = 1 + t * 0.22;
        const widthBreath = 1 + Math.sin(time * 2.0 + phase) * 0.06 * turb * lifeFade;
        mesh.scale.set(
            (mesh.userData.baseScaleX || 1) * grow * widthBreath,
            (mesh.userData.baseScaleZ || 1) * (1 + t * 0.12),
            1
        );

        const fade = 1 - THREE.MathUtils.smoothstep(t, 0.05, 1);
        const softFade = fade * fade * (3 - 2 * fade);
        mesh.material.opacity = (mesh.userData.startOpacity || 0.4) * softFade;
        animateWakeTexture(mesh.material, time, phase, turb);
    }
}

export function syncBoatSternWakeVisibility(group, visible, waterY) {
    if (!group) {
        return;
    }
    group.visible = visible === true;
    if (waterY != null) {
        group.userData.waterY = waterY;
    }
}
