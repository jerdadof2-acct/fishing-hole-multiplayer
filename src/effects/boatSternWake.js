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
/** World units covered by one foam texture tile along the wake. */
const TILE_LEN = 2.2;
/** How fast foam streams away from the transom (world units / sec at full speed). */
const FLOW_SCROLL_SPEED = 1.7;
/** Length of the boiling prop-wash patch trailing off the transom. */
const PROP_WASH_LENGTH = 6.0;

/** Churned-up bubbles under the stern, drifting downstream between the arms. */
const BUBBLE_COUNT = 140;
const BUBBLE_SPAWN_PER_SEC = 42;
const BUBBLE_MAX_DIST = 9.5;

let bubbleTexture = null;

function createBubbleTexture() {
    if (bubbleTexture) {
        return bubbleTexture;
    }

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    // Fuzzy foam puff — bright soft center bleeding out to nothing, no hard rim.
    const body = ctx.createRadialGradient(c, c, 0, c, c, c);
    body.addColorStop(0, 'rgba(255,255,255,0.9)');
    body.addColorStop(0.3, 'rgba(240,250,255,0.55)');
    body.addColorStop(0.6, 'rgba(225,242,255,0.22)');
    body.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, size, size);

    // A few offset soft blobs break up the perfect circle so it reads as foam.
    for (const [ox, oy, r, a] of [
        [-0.18, 0.12, 0.34, 0.3],
        [0.2, -0.1, 0.3, 0.26],
        [0.05, 0.22, 0.26, 0.22]
    ]) {
        const blob = ctx.createRadialGradient(
            c + size * ox,
            c + size * oy,
            0,
            c + size * ox,
            c + size * oy,
            size * r
        );
        blob.addColorStop(0, `rgba(255,255,255,${a})`);
        blob.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, size, size);
    }

    bubbleTexture = new THREE.CanvasTexture(canvas);
    bubbleTexture.colorSpace = THREE.SRGBColorSpace;
    return bubbleTexture;
}

function createSternBubbles() {
    const positions = new Float32Array(BUBBLE_COUNT * 3);
    const colors = new Float32Array(BUBBLE_COUNT * 3);
    const data = [];

    for (let i = 0; i < BUBBLE_COUNT; i++) {
        positions[i * 3 + 1] = -999;
        data.push({
            alive: false,
            age: 0,
            lifetime: 1,
            vx: 0,
            vz: 0,
            seed: Math.random() * Math.PI * 2,
            size: 0.5 + Math.random()
        });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        map: createBubbleTexture(),
        size: 0.17,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        // Additive + RGB fade-to-black = per-bubble opacity without a shader.
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });

    const points = new THREE.Points(geometry, material);
    points.name = 'boatWake-sternBubbles';
    points.frustumCulled = false;
    points.renderOrder = WAKE_RENDER_ORDER + 1;
    points.userData.bubbleData = data;
    points.userData.spawnAccumulator = 0;

    return points;
}

function updateSternBubbles(points, delta, time, origin, downstream, perp, halfWidth, surfaceY) {
    const data = points.userData.bubbleData;
    const positions = points.geometry.attributes.position;
    const colors = points.geometry.attributes.color;

    points.userData.spawnAccumulator += delta * BUBBLE_SPAWN_PER_SEC;

    for (let i = 0; i < data.length; i++) {
        const b = data[i];

        if (!b.alive) {
            if (points.userData.spawnAccumulator < 1) {
                continue;
            }
            points.userData.spawnAccumulator -= 1;

            // Rise from beneath the hull: across most of the stern width,
            // starting slightly under the transom.
            const across = (Math.random() - 0.5) * halfWidth * 1.15;
            const back = -0.5 + Math.random() * 0.9;

            b.alive = true;
            b.age = 0;
            b.lifetime = 2.6 + Math.random() * 3.2;
            b.seed = Math.random() * Math.PI * 2;
            b.size = 0.5 + Math.random();

            const speed = 0.85 + Math.random() * 0.55;
            const spread = (Math.random() - 0.5) * 0.3;
            b.vx = downstream.x * speed + perp.x * spread;
            b.vz = downstream.y * speed + perp.y * spread;

            positions.setXYZ(
                i,
                origin.x + perp.x * across + downstream.x * back,
                surfaceY - 0.05,
                origin.z + perp.y * across + downstream.y * back
            );
        }

        b.age += delta;
        const t = b.age / b.lifetime;

        if (t >= 1) {
            b.alive = false;
            positions.setY(i, -999);
            colors.setXYZ(i, 0, 0, 0);
            continue;
        }

        const x = positions.getX(i) + b.vx * delta;
        const z = positions.getZ(i) + b.vz * delta;

        // Bubbles pop up to the surface quickly, then ride it with a tiny bob.
        const rise = Math.min(b.age * 3, 1);
        const y =
            surfaceY - 0.05 + rise * 0.11 +
            Math.sin(time * 3.1 + b.seed) * 0.012;

        positions.setXYZ(i, x, y, z);

        // Fade in fast, fade out with age and with distance from the stern.
        const distDownstream =
            (x - origin.x) * downstream.x + (z - origin.z) * downstream.y;
        const distFade =
            1 - THREE.MathUtils.smoothstep(distDownstream, BUBBLE_MAX_DIST * 0.45, BUBBLE_MAX_DIST);
        const fadeIn = THREE.MathUtils.smoothstep(t, 0, 0.1);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(t, 0.45, 1);
        const flicker = 0.85 + Math.sin(time * 5.2 + b.seed * 3) * 0.15;

        const bright = fadeIn * fadeOut * distFade * flicker * b.size * 0.25;
        colors.setXYZ(i, bright * 0.82, bright * 0.94, bright);
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
}

let churnFoamTexture = null;

/**
 * Dense boiling froth for the prop wash — a near-solid mass of overlapping
 * soft clumps and flow streaks, tileable vertically so it can scroll.
 * Two copies scrolling at different speeds read as churning white water.
 */
function createChurnFoamTexture() {
    if (churnFoamTexture) {
        return churnFoamTexture;
    }

    const w = 160;
    const h = 512;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const drawWrapped = (draw, y) => {
        for (const yy of [y, y - h, y + h]) {
            draw(yy);
        }
    };

    // Base layer: big soft clumps merging into a frothy mass.
    for (let i = 0; i < 150; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 6 + Math.random() * 14;
        const a = 0.16 + Math.random() * 0.22;

        drawWrapped((yy) => {
            const g = ctx.createRadialGradient(x, yy, 0, x, yy, r);
            g.addColorStop(0, `rgba(250,253,255,${a})`);
            g.addColorStop(0.7, `rgba(240,248,255,${a * 0.5})`);
            g.addColorStop(1, 'rgba(240,248,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, yy, r, 0, Math.PI * 2);
            ctx.fill();
        }, y);
    }

    // Bright froth kernels: smaller, hotter spots that give the boil texture.
    for (let i = 0; i < 220; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 1.5 + Math.random() * 5;
        const a = 0.3 + Math.random() * 0.45;

        drawWrapped((yy) => {
            const g = ctx.createRadialGradient(x, yy, 0, x, yy, r);
            g.addColorStop(0, `rgba(255,255,255,${a})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, yy, r, 0, Math.PI * 2);
            ctx.fill();
        }, y);
    }

    // Flow streaks: soft elongated smears along the scroll direction.
    for (let i = 0; i < 70; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = 2 + Math.random() * 4;
        const stretch = 3 + Math.random() * 5;
        const a = 0.14 + Math.random() * 0.2;

        drawWrapped((yy) => {
            ctx.save();
            ctx.translate(x, yy);
            ctx.scale(1, stretch);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, `rgba(248,252,255,${a})`);
            g.addColorStop(1, 'rgba(248,252,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }, y);
    }

    // Soften the strip's side edges so the patch has no hard border.
    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.16, 'rgba(0,0,0,1)');
    edge.addColorStop(0.84, 'rgba(0,0,0,1)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    churnFoamTexture = new THREE.CanvasTexture(canvas);
    churnFoamTexture.colorSpace = THREE.SRGBColorSpace;
    churnFoamTexture.wrapS = THREE.ClampToEdgeWrapping;
    churnFoamTexture.wrapT = THREE.RepeatWrapping;
    churnFoamTexture.needsUpdate = true;

    return churnFoamTexture;
}

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

let tileableFoamTexture = null;

/**
 * Seamlessly tiling foam strands (integer sine periods) — safe to scroll with
 * RepeatWrapping so the foam visibly streams away from the transom.
 * Lengthwise fade lives in the strip geometry's vertex alpha, not the texture.
 */
function createTileableFoamTexture() {
    if (tileableFoamTexture) {
        return tileableFoamTexture;
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

            // Integer periods keep value and slope continuous across the seam.
            const x =
                w * 0.5 +
                centerOffset +
                Math.sin(t * Math.PI * 2 * 4 + phase) * 3.5 +
                Math.sin(t * Math.PI * 2 * 9 + phase * 0.7) * 1.5;

            if (y === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.strokeStyle = 'rgba(245,252,255,0.8)';
        ctx.lineWidth = strand === 1 || strand === 2 ? 7 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    for (let i = 0; i < 85; i++) {
        const y = Math.random() * h;
        const x = w * 0.5 + (Math.random() - 0.5) * 42;
        const radius = 0.8 + Math.random() * 2.3;
        const alpha = 0.15 + Math.random() * 0.3;

        ctx.fillStyle = `rgba(245,252,255,${alpha})`;
        // Draw the dot and wrap copies so the tile seam stays invisible.
        for (const yy of [y, y - h, y + h]) {
            ctx.beginPath();
            ctx.arc(x, yy, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    tileableFoamTexture = new THREE.CanvasTexture(canvas);
    tileableFoamTexture.colorSpace = THREE.SRGBColorSpace;
    tileableFoamTexture.wrapS = THREE.ClampToEdgeWrapping;
    tileableFoamTexture.wrapT = THREE.RepeatWrapping;
    tileableFoamTexture.needsUpdate = true;

    return tileableFoamTexture;
}

/**
 * Strip geometry with vertex alpha: solid at the transom (v=1), fading to
 * nothing at the far tip — lets the scrolling texture fade out naturally.
 * taperStart < 1 narrows the stern end so the wake widens as it spreads.
 */
function makeFadedStripGeometry(width, length, segments = 10, taperStart = 1) {
    const geometry = new THREE.PlaneGeometry(width, length, 1, segments);
    const uv = geometry.attributes.uv;
    const position = geometry.attributes.position;
    const colors = new Float32Array(uv.count * 4);

    for (let i = 0; i < uv.count; i++) {
        const v = uv.getY(i);
        const fade = Math.pow(v, 1.35);
        colors[i * 4 + 0] = 1;
        colors[i * 4 + 1] = 1;
        colors[i * 4 + 2] = 1;
        colors[i * 4 + 3] = fade;

        // v=1 sits at the stern — narrow there, spreading toward the tip.
        const widthScale = THREE.MathUtils.lerp(1, taperStart, v);
        position.setX(i, position.getX(i) * widthScale);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    return geometry;
}

function makeWakeMaterial(map, opacity = 0.9, { vertexColors = false } = {}) {
    const tex = map.clone();
    tex.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        vertexColors,
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
    const flowTex = createTileableFoamTexture();

    const makeFlowMaterial = (opacity, length) => {
        const material = makeWakeMaterial(flowTex, opacity, { vertexColors: true });
        material.map.wrapT = THREE.RepeatWrapping;
        material.map.repeat.y = length / TILE_LEN;
        return material;
    };

    const sternChurn = new THREE.Mesh(
        makeFadedStripGeometry(1.6, 2.4, 8, 0.8),
        makeFlowMaterial(0.85, 2.4)
    );
    sternChurn.name = 'boatWake-sternChurn';
    configureWakeMesh(sternChurn, 0.2);
    group.add(sternChurn);

    // Prop wash: two stacked froth layers scrolling at different speeds — the
    // boiling white patch that trails straight off the back of a moving boat.
    const churnTex = createChurnFoamTexture();
    const makeChurnMaterial = (opacity, length) => {
        const material = makeWakeMaterial(churnTex, opacity, { vertexColors: true });
        material.map.wrapT = THREE.RepeatWrapping;
        material.map.repeat.y = length / TILE_LEN;
        return material;
    };

    const propWashBase = new THREE.Mesh(
        makeFadedStripGeometry(2.4, PROP_WASH_LENGTH, 10, 0.82),
        makeChurnMaterial(0.9, PROP_WASH_LENGTH)
    );
    propWashBase.name = 'boatWake-propWashBase';
    configureWakeMesh(propWashBase, 0.55);
    group.add(propWashBase);

    const propWashOverlay = new THREE.Mesh(
        makeFadedStripGeometry(2.0, PROP_WASH_LENGTH * 0.72, 10, 0.85),
        makeChurnMaterial(0.6, PROP_WASH_LENGTH * 0.72)
    );
    propWashOverlay.name = 'boatWake-propWashOverlay';
    // Offset the overlay's tile so the two layers never line up.
    propWashOverlay.material.map.offset.y = 0.37;
    configureWakeMesh(propWashOverlay, 1.7);
    group.add(propWashOverlay);

    const centerStem = new THREE.Mesh(
        makeFadedStripGeometry(2.8, STEM_LENGTH, 10, 0.7),
        makeFlowMaterial(0.4, STEM_LENGTH)
    );
    centerStem.name = 'boatWake-centerStem';
    configureWakeMesh(centerStem, 1.1);
    group.add(centerStem);

    const wakeArms = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(
            makeFadedStripGeometry(1.05, ARM_LENGTH, 12, 0.3),
            makeFlowMaterial(0.55, ARM_LENGTH)
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

    const bubbles = createSternBubbles();
    group.add(bubbles);

    group.userData.sternChurn = sternChurn;
    group.userData.propWashBase = propWashBase;
    group.userData.propWashOverlay = propWashOverlay;
    group.userData.centerStem = centerStem;
    group.userData.wakeArms = wakeArms;
    group.userData.trailPool = trailPool;
    group.userData.bubbles = bubbles;
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
        const driftSpeed = 0.5 + Math.random() * 0.3;
        spawnDownstreamTrail(
            pool,
            originX + downstream.x * distanceAlongWake,
            originZ + downstream.y * distanceAlongWake,
            surfaceY,
            0.8 + Math.random() * 0.7,
            0.18 + Math.random() * 0.08,
            0.16 + Math.random() * 0.07,
            downstream.x * driftSpeed,
            downstream.y * driftSpeed,
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

        const armDrift = 0.42 + Math.random() * 0.22;
        spawnDownstreamTrail(
            pool,
            x,
            z,
            surfaceY,
            0.7 + Math.random() * 0.9,
            0.12 + Math.random() * 0.09,
            0.18 + Math.random() * 0.09,
            downstream.x * armDrift + perp.x * side * 0.06,
            downstream.y * armDrift + perp.y * side * 0.06,
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
    // Small bob only — dipping lower lets wave crests swallow the planes.
    const bob = Math.sin(time * 2.15 + alongWake * 0.25 + phase) * 0.008
        + Math.sin(time * 3.4 + phase * 1.2) * 0.004;
    return bob * turbulence;
}

function animateWakeTexture(
    material,
    time,
    phase,
    turbulence = 1,
    scroll = 0
) {
    if (!material?.map) {
        return;
    }

    // Only repeat-wrapped flow strips scroll; clamped trail sprites stay put.
    material.map.offset.y =
        material.map.wrapT === THREE.RepeatWrapping
            ? scroll % 1
            : 0;

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
    maxLen = STEM_LENGTH,
    scroll = 0
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

    // Constant opacity — the streaming foam supplies the life, no blinking.
    mesh.material.opacity = baseOpacity;
    animateWakeTexture(mesh.material, time, phase, turb, scroll);
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
    // Above river wave crests — lower and the animated surface swallows the
    // planes each swell, making the wake blink on and off (depthTest is on).
    const surfaceY = waterY + 0.06;

    const anchorPos = new THREE.Vector3();
    anchor.getWorldPosition(anchorPos);
    const origin = wakeOriginFromAnchor(anchorPos, downstream);

    // Foam streams away from the transom — the core of the "moving wake" read.
    const flowScroll = time * (FLOW_SCROLL_SPEED * (0.6 + speedAmount * 0.4)) / TILE_LEN;

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
                maxAngle: 0.03,
                widthPulse: 0.06,
                baseOpacity: 0.62,
                maxLen: 2.4,
                scroll: flowScroll * 1.25
            }
        );
    }

    // Boiling prop wash — two froth layers slipping past each other. The base
    // scrolls with the wake; the overlay runs faster so the foam appears to
    // tumble and churn instead of sliding as one rigid sheet.
    if (group.userData.propWashBase) {
        placeLivingStemMesh(
            group.userData.propWashBase,
            origin,
            downstream,
            surfaceY + 0.005,
            PROP_WASH_LENGTH,
            heading,
            time,
            {
                maxAngle: 0.02,
                widthPulse: 0.08,
                baseOpacity: 0.85,
                maxLen: PROP_WASH_LENGTH,
                scroll: flowScroll * 1.15
            }
        );
    }

    if (group.userData.propWashOverlay) {
        placeLivingStemMesh(
            group.userData.propWashOverlay,
            origin,
            downstream,
            surfaceY + 0.01,
            PROP_WASH_LENGTH * 0.72,
            heading,
            time,
            {
                maxAngle: 0.035,
                widthPulse: 0.12,
                baseOpacity: 0.55,
                maxLen: PROP_WASH_LENGTH * 0.72,
                scroll: flowScroll * 1.7 + 0.37
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
            maxAngle: 0.028,
            widthPulse: 0.05,
            baseOpacity: 0.26,
            maxLen: STEM_LENGTH,
            scroll: flowScroll
        }
    );

    for (const arm of group.userData.wakeArms ?? []) {
        const side = arm.userData.side ?? -1;

        // Arms hold a steady outward V — the life comes from the streaming foam.
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
                maxAngle: 0.003,
                widthPulse: 0.04,
                baseOpacity: 0.52,
                maxLen: ARM_LENGTH,
                scroll: flowScroll * 1.2 + side * 0.13
            }
        );
    }

    if (group.userData.bubbles) {
        updateSternBubbles(
            group.userData.bubbles,
            delta,
            time,
            origin,
            downstream,
            perp,
            halfWidth,
            surfaceY
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
        const lateral = wakeLateralSway(time, dist + age * 1.2, phase, 0.1 * turb) * lifeFade;

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
                0.03 * turb
            ) * lifeFade;

        const grow = 1 + t * 0.22;
        const widthBreath = 1 + Math.sin(time * 2.0 + phase) * 0.06 * turb * lifeFade;
        mesh.scale.set(
            (mesh.userData.baseScaleX || 1) * grow * widthBreath,
            (mesh.userData.baseScaleZ || 1) * (1 + t * 0.12),
            1
        );

        // Ease in over the first ~18% of life, ease out over the rest — no popping.
        const fadeIn = THREE.MathUtils.smoothstep(t, 0, 0.18);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(t, 0.3, 1);
        mesh.material.opacity =
            (mesh.userData.startOpacity || 0.4) * fadeIn * fadeOut;
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
