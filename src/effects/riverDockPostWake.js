import * as THREE from 'three';

let swirlTexture = null;

function normalizeFlow(flowDirection) {
    const flow = flowDirection?.clone?.() || new THREE.Vector2(1, 0);
    if (flow.lengthSq() < 1e-6) {
        flow.set(1, 0);
    }
    return flow.normalize();
}

/** Turbulence sits on the downstream side of each post (opposite upstream pile-up). */
function wakeOffsetDir(flowDirection) {
    return getRiverDownstreamDir(flowDirection);
}

/** World XZ direction that matches visible downstream river flow (for wakes, bobber drift). */
export function getRiverDownstreamDir(flowDirection) {
    const flow = normalizeFlow(flowDirection);
    return new THREE.Vector2(-flow.x, -flow.y);
}

function createSwirlWakeTexture() {
    if (swirlTexture) {
        return swirlTexture;
    }

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size * 0.5;
    const cy = size * 0.5;

    ctx.clearRect(0, 0, size, size);
    for (let arm = 0; arm < 3; arm++) {
        const startAngle = (arm / 3) * Math.PI * 2;
        for (let step = 0; step < 28; step++) {
            const t = step / 28;
            const angle = startAngle + t * Math.PI * 1.35;
            const radius = 8 + t * 46;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const alpha = (1 - t) * 0.55;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, 7 + t * 10);
            grad.addColorStop(0, `rgba(230,245,255,${alpha})`);
            grad.addColorStop(1, 'rgba(230,245,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, 7 + t * 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    swirlTexture = new THREE.CanvasTexture(canvas);
    swirlTexture.wrapS = THREE.ClampToEdgeWrapping;
    swirlTexture.wrapT = THREE.ClampToEdgeWrapping;
    swirlTexture.colorSpace = THREE.SRGBColorSpace;
    return swirlTexture;
}

/**
 * Front/water-side dock posts where the current hits pilings.
 */
export function getRiverWakePosts() {
    const dockWidth = 3;
    const dockDepth = 14;
    const groupZ = -1.5;
    const plankCount = 13;
    const plankGap = 0.01;
    const plankDepth = (dockDepth * 0.94) / plankCount - plankGap;
    const zStart = -dockDepth * 0.47;
    const postRadius = 0.11;
    const frontZ = dockDepth * 0.35;
    const deckFrontZ = zStart + plankCount * plankDepth + (plankCount - 1) * plankGap;
    const railWidth = 0.09;
    const cornerZ = deckFrontZ - railWidth * 0.15;

    return [
        { x: -dockWidth * 0.48, z: groupZ + cornerZ, innerRadius: 0.23 },
        { x: dockWidth * 0.48, z: groupZ + cornerZ, innerRadius: 0.23 },
        { x: -dockWidth * 0.38, z: groupZ + frontZ, innerRadius: postRadius },
        { x: 0, z: groupZ + frontZ, innerRadius: postRadius },
        { x: dockWidth * 0.38, z: groupZ + frontZ, innerRadius: postRadius }
    ];
}

/**
 * Downstream swirl planes where fast current hits dock posts.
 * @param {{ waterY: number, flowDirection: THREE.Vector2, posts: { x: number, z: number }[] }} options
 */
export function createRiverDockPostWake({ waterY, flowDirection, posts }) {
    const offset = wakeOffsetDir(flowDirection);
    const flow = normalizeFlow(flowDirection);
    const offsetPerp = new THREE.Vector2(-offset.y, offset.x);
    const flowAngle = Math.atan2(flow.y, flow.x);
    const tex = createSwirlWakeTexture();

    const group = new THREE.Group();
    group.name = 'riverDockPostWake';
    group.userData.isRiverWake = true;
    group.renderOrder = 1003;

    posts.forEach((post, postIndex) => {
        const postR = post.innerRadius ?? 0.11;
        for (let s = 0; s < 3; s++) {
            const downstream = postR * 1.6 + 0.12 + s * 0.16;
            const across = (s - 1) * 0.14;
            const w = 0.5 + s * 0.14;
            const h = 0.38 + s * 0.1;

            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.32,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.rotation.z = flowAngle + (s - 1) * 0.42;
            mesh.position.set(
                post.x + offset.x * downstream + offsetPerp.x * across,
                waterY + 0.048 + s * 0.006,
                post.z + offset.y * downstream + offsetPerp.y * across
            );
            mesh.renderOrder = 1003;
            mesh.userData = {
                postIndex,
                swirlIndex: s,
                flowAngle,
                baseOpacity: 0.24 + s * 0.08,
                spinSign: s % 2 === 0 ? 1 : -1,
                downstream,
                across,
                postX: post.x,
                postZ: post.z
            };
            group.add(mesh);
        }

        const arcMat = new THREE.MeshBasicMaterial({
            color: 0xc8e8ff,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const inner = postR * 1.05;
        const outer = inner + 0.09;
        const arc = new THREE.Mesh(
            new THREE.RingGeometry(inner, outer, 24, 1, flowAngle - Math.PI * 0.55, Math.PI * 1.1),
            arcMat
        );
        arc.rotation.x = -Math.PI / 2;
        arc.position.set(
            post.x + offset.x * (postR * 0.85),
            waterY + 0.042,
            post.z + offset.y * (postR * 0.85)
        );
        arc.userData = { isArc: true, flowAngle, baseOpacity: 0.2, postIndex };
        group.add(arc);
    });

    return group;
}

/**
 * @param {THREE.Group} group
 * @param {number} time
 * @param {THREE.Vector2} flowDirection
 */
export function updateRiverDockPostWake(group, time, flowDirection) {
    if (!group) return;
    const flow = normalizeFlow(flowDirection);
    const flowAngle = Math.atan2(flow.y, flow.x);

    group.children.forEach((mesh, i) => {
        if (!mesh.userData) return;

        if (mesh.userData.isArc) {
            mesh.rotation.z = flowAngle;
            mesh.material.opacity = mesh.userData.baseOpacity * (0.55 + 0.45 * Math.sin(time * 3.4 + i * 0.8));
            return;
        }

        const { flowAngle: baseAngle, baseOpacity, spinSign, swirlIndex } = mesh.userData;
        mesh.rotation.z = baseAngle
            + spinSign * time * (0.9 + swirlIndex * 0.15)
            + Math.sin(time * 2.1 + i * 0.65) * 0.25;
        mesh.material.opacity = baseOpacity * (0.5 + 0.5 * Math.sin(time * 2.8 + i * 0.4));
    });
}

/** Downstream drift matches wake placement (same axis as the swirl pocket). */
function downstreamDir(flowDirection) {
    return getRiverDownstreamDir(flowDirection);
}

/**
 * Spawn a bubble downstream of a post (flow hits post, turbulence on downstream side).
 */
export function spawnRiverPostBubble(positions, velocities, i3, post, flowDirection, waterY) {
    const offset = wakeOffsetDir(flowDirection);
    const drift = downstreamDir(flowDirection);
    const offsetPerp = new THREE.Vector2(-offset.y, offset.x);
    const driftPerp = new THREE.Vector2(-drift.y, drift.x);
    const postR = post.innerRadius ?? 0.11;
    const downstream = postR * 1.3 + 0.08 + Math.random() * 0.14;
    const across = (Math.random() - 0.5) * 0.22;

    positions[i3] = post.x + offset.x * downstream + offsetPerp.x * across;
    positions[i3 + 1] = waterY + 0.04 + Math.random() * 0.05;
    positions[i3 + 2] = post.z + offset.y * downstream + offsetPerp.y * across;

    const speed = 0.28 + Math.random() * 0.22;
    const swirl = (Math.random() - 0.5) * 0.55;
    velocities[i3] = drift.x * speed + driftPerp.x * swirl;
    velocities[i3 + 1] = 0.03 + Math.random() * 0.05;
    velocities[i3 + 2] = drift.y * speed + driftPerp.y * swirl;
}

export function updateRiverPostBubbleMotion(
    positions,
    velocities,
    i3,
    delta,
    time,
    particleIndex,
    waterY,
    flowDirection
) {
    const drift = downstreamDir(flowDirection);
    const perp = new THREE.Vector2(-drift.y, drift.x);
    const swirl = Math.sin(time * 2.6 + particleIndex * 0.37) * 0.18;

    positions[i3] += velocities[i3] * delta;
    positions[i3 + 1] += velocities[i3 + 1] * delta;
    positions[i3 + 2] += velocities[i3 + 2] * delta;

    positions[i3] += perp.x * swirl * delta;
    positions[i3 + 2] += perp.y * swirl * delta;
    positions[i3 + 1] = waterY + 0.035 + Math.abs(Math.sin(time * 2.2 + particleIndex)) * 0.045;

    velocities[i3] += drift.x * 0.02 * delta;
    velocities[i3 + 2] += drift.y * 0.02 * delta;
}
