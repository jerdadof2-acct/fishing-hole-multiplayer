import * as THREE from 'three';
import { CONGO_RIVER_WATER } from '../water/waterBodyTypes.js';

/** Large-boat channel — keep center clear for casting. */
const BANK_X_NEAR = 38;
const BANK_X_FAR = 54;
const BANK_CENTER_Z = 28;
const BANK_SPAN_Z = 200;
const BANK_HEIGHT = 36;
/** Thin muddy water edge — foliage covers almost everything above it. */
const WATERLINE_FRACTION = 0.04;

/** UV scroll along river (+Z) — tuned to match visible water current. */
const SCROLL_SPEED_SCALE = 0.11;

/** World-space bed scroll scale — matches {@link SCROLL_SPEED_SCALE} in the water shader. */
export const CONGO_RIVER_BED_SCROLL_SCALE = SCROLL_SPEED_SCALE;

let nearBankTexture = null;
let farBankTexture = null;

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

/**
 * Tileable jungle-bank strip (seamless on X = downstream scroll axis).
 * Replace with PNG later: same wrap/repeat/offset behavior.
 */
function createJungleBankTexture({ width = 1024, height = 512, farLayer = false, seed = 4207 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const rand = mulberry32(seed);

    const mudRgb = farLayer ? [14, 24, 12] : [18, 30, 14];
    const deepRgb = farLayer ? [10, 22, 11] : [12, 28, 13];
    const midRgb = farLayer ? [16, 34, 17] : [18, 40, 19];
    const shadowRgb = farLayer ? [7, 14, 7] : [8, 18, 8];
    const foliageDark = farLayer ? [11, 24, 11] : [13, 30, 13];

    const pickFoliageColor = () => {
        const roll = rand();
        if (roll < 0.38) return shadowRgb;
        if (roll < 0.72) return foliageDark;
        if (roll < 0.9) return deepRgb;
        return midRgb;
    };

    const paintFoliageBlob = (cx, cy, rx, ry, rotation, rgb, alpha) => {
        ctx.fillStyle = `rgba(${rgb.join(',')}, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
        ctx.fill();
    };

    const forestTop = height * (farLayer ? 0.08 : 0.05);
    const forestBottom = height;
    const forestSpan = forestBottom - forestTop;

    ctx.fillStyle = `rgb(${deepRgb.join(',')})`;
    ctx.fillRect(0, 0, width, height);

    const waterTop = height * (1 - WATERLINE_FRACTION);
    const mudGrad = ctx.createLinearGradient(0, height, 0, waterTop);
    mudGrad.addColorStop(0, `rgb(${mudRgb.join(',')})`);
    mudGrad.addColorStop(0.7, `rgb(${deepRgb.join(',')})`);
    mudGrad.addColorStop(1, `rgb(${midRgb.join(',')})`);
    ctx.fillStyle = mudGrad;
    ctx.fillRect(0, waterTop - 4, width, height - waterTop + 4);

    const skyline = new Array(width);
    for (let x = 0; x < width; x++) {
        const t = (x / width) * Math.PI * 2;
        const n =
            Math.sin(t * 1.0) * 0.22 +
            Math.sin(t * 2.3 + 1.1) * 0.14 +
            Math.sin(t * 4.7 + 2.4) * 0.09 +
            Math.sin(t * 9.1 + 0.6) * 0.05 +
            (rand() - 0.5) * 0.04;
        // Canopy hugs the water — only a narrow dark-green band left at the very top.
        const crownBase = farLayer ? 0.07 : 0.05;
        const crownVar = farLayer ? 0.055 : 0.07;
        let crownY = height * (crownBase + n * crownVar);
        // Occasional tree gaps — pull the canopy line down to open vertical slots.
        const sparseSlot = Math.sin(t * 6.7 + 2.1) * 0.5 + Math.sin(t * 13.3 + 0.4) * 0.28;
        if (sparseSlot > 0.52) {
            crownY += height * (0.035 + (sparseSlot - 0.52) * 0.14);
        }
        skyline[x] = crownY;
    }

    ctx.fillStyle = `rgb(${deepRgb.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x < width; x++) {
        ctx.lineTo(x, skyline[x] + height * 0.06);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = farLayer ? 0.68 : 0.74;
    ctx.fillStyle = `rgb(${midRgb.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x < width; x++) {
        ctx.lineTo(x, skyline[x]);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    for (let x = 0; x < width; x += 20) {
        if (rand() > 0.68) {
            continue;
        }
        const t = (x / width) * Math.PI * 2;
        const trunkX = x + Math.sin(t * 5.3) * 8;
        const idx = Math.floor(x) % width;
        const crownY = skyline[idx] ?? height * 0.06;
        const trunkW = 3 + rand() * 4;
        const trunkTop = crownY + height * 0.05;
        const trunkBottom = height - rand() * 3;
        const trunkH = Math.max(8, trunkBottom - trunkTop);
        ctx.fillStyle = `rgb(${Math.max(0, deepRgb[0] - 4)}, ${Math.max(0, deepRgb[1] - 8)}, ${Math.max(0, deepRgb[2] - 3)})`;
        ctx.fillRect(trunkX, trunkTop, trunkW, trunkH);
    }

    for (let i = 0; i < (farLayer ? 20 : 34); i++) {
        const x = rand() * width;
        const idx = Math.floor(x) % width;
        const crownY = skyline[idx] ?? height * 0.06;
        const rx = 18 + rand() * 42;
        const ry = 12 + rand() * 24;
        const cx = x;
        const cy = crownY + ry * 0.35;
        ctx.fillStyle = rand() > 0.55
            ? `rgba(${pickFoliageColor().join(',')}, ${farLayer ? 0.52 : 0.68})`
            : `rgba(${midRgb.join(',')}, ${farLayer ? 0.45 : 0.62})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rand() * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Dark foliage mixed through the full tree column.
    for (let i = 0; i < (farLayer ? 102 : 152); i++) {
        const x = rand() * width;
        const cy = forestTop + rand() * forestSpan;
        const rx = 8 + rand() * 26;
        const ry = 6 + rand() * 20;
        paintFoliageBlob(
            x,
            cy,
            rx,
            ry,
            rand() * Math.PI,
            pickFoliageColor(),
            (farLayer ? 0.42 : 0.55) + rand() * 0.32
        );
    }

    // Smaller leaf clusters — dappled shadow through mid and lower canopy.
    for (let i = 0; i < (farLayer ? 128 : 192); i++) {
        const x = rand() * width;
        const cy = forestTop + rand() * forestSpan;
        paintFoliageBlob(
            x,
            cy,
            3 + rand() * 11,
            2 + rand() * 9,
            rand() * Math.PI,
            rand() > 0.5 ? shadowRgb : foliageDark,
            (farLayer ? 0.35 : 0.48) + rand() * 0.38
        );
    }

    // Hanging vine curtains and mid-trunk foliage clumps.
    for (let i = 0; i < (farLayer ? 30 : 44); i++) {
        const x = rand() * width;
        const hangTop = forestTop + rand() * forestSpan * 0.55;
        const hangLen = forestSpan * (0.12 + rand() * 0.28);
        const rgb = rand() > 0.35 ? foliageDark : shadowRgb;
        ctx.fillStyle = `rgba(${rgb.join(',')}, ${farLayer ? 0.48 : 0.62})`;
        ctx.beginPath();
        ctx.ellipse(x, hangTop + hangLen * 0.5, 4 + rand() * 7, hangLen * 0.5, rand() * 0.25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Low understory foliage — fills the gap between water edge and main canopy.
    for (let i = 0; i < (farLayer ? 28 : 46); i++) {
        const x = rand() * width;
        const rx = 10 + rand() * 24;
        const ry = 8 + rand() * 16;
        const cx = x;
        const cy = waterTop - ry * 0.15 + rand() * (height - waterTop) * 0.35;
        paintFoliageBlob(
            cx,
            cy,
            rx,
            ry,
            rand() * 0.5,
            pickFoliageColor(),
            (farLayer ? 0.55 : 0.72) + rand() * 0.18
        );
    }

    // Final dark pass — subtle shadow pockets woven through existing canopy.
    for (let i = 0; i < (farLayer ? 58 : 86); i++) {
        const x = rand() * width;
        const cy = forestTop + rand() * forestSpan * 0.92;
        paintFoliageBlob(
            x,
            cy,
            12 + rand() * 20,
            8 + rand() * 16,
            rand() * Math.PI * 2,
            shadowRgb,
            (farLayer ? 0.28 : 0.38) + rand() * 0.22
        );
    }

    const haze = ctx.createLinearGradient(0, 0, 0, height * 0.22);
    haze.addColorStop(0, `rgba(${deepRgb.join(',')}, ${farLayer ? 0.65 : 0.45})`);
    haze.addColorStop(0.55, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height * 0.22);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

function getNearBankTexture() {
    if (!nearBankTexture) {
        nearBankTexture = createJungleBankTexture({ seed: 4210, farLayer: false });
    }
    return nearBankTexture;
}

function getFarBankTexture() {
    if (!farBankTexture) {
        farBankTexture = createJungleBankTexture({ seed: 9106, farLayer: true });
    }
    return farBankTexture;
}

function createBankPlane({
    side,
    layer,
    waterLevel,
    texture,
    scrollRepeatX,
    opacity = 1
}) {
    const isNear = layer === 'near';
    const x = side * (isNear ? BANK_X_NEAR : BANK_X_FAR);
    const geometry = new THREE.PlaneGeometry(BANK_SPAN_Z, BANK_HEIGHT, 1, 1);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: opacity < 1,
        opacity,
        depthWrite: true,
        fog: true,
        side: THREE.FrontSide
    });

    texture = material.map;
    texture.repeat.set(scrollRepeatX, 1);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `congoBank-${layer}-${side < 0 ? 'left' : 'right'}`;
    mesh.position.set(x, waterLevel + BANK_HEIGHT * 0.48, BANK_CENTER_Z);
    mesh.rotation.y = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    mesh.renderOrder = isNear ? 2 : 1;
    mesh.frustumCulled = false;
    mesh.userData.bankSide = side;
    mesh.userData.bankLayer = layer;
    mesh.userData.scrollFactor = isNear ? 1 : 0.58;
    mesh.userData.scrollSign = side < 0 ? -1 : 1;
    return mesh;
}

/**
 * Scrolling jungle bank walls for Congo River (tileable canvas texture, UV loop).
 * @param {THREE.Scene} scene
 * @param {{ waterLevel?: number }} [options]
 */
export function createCongoRiverBanks(scene, { waterLevel = 0 } = {}) {
    const root = new THREE.Group();
    root.name = 'congoRiverBanks';

    const nearTex = getNearBankTexture();
    const farTex = getFarBankTexture();
    const repeatNear = 2.4;
    const repeatFar = 1.8;

    for (const side of [-1, 1]) {
        root.add(createBankPlane({
            side,
            layer: 'far',
            waterLevel,
            texture: farTex.clone(),
            scrollRepeatX: repeatFar,
            opacity: 0.92
        }));
        root.add(createBankPlane({
            side,
            layer: 'near',
            waterLevel,
            texture: nearTex.clone(),
            scrollRepeatX: repeatNear,
            opacity: 1
        }));
    }

    root.userData.scrollOffset = 0;
    root.userData.waterLevel = waterLevel;
    root.visible = false;
    scene.add(root);
    return root;
}

export function syncCongoRiverBanksVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}

/** Default downstream scroll speed (world-ish units per second). */
export function getCongoBankScrollSpeed() {
    return (CONGO_RIVER_WATER.flowSpeed ?? 0.54) * SCROLL_SPEED_SCALE;
}

/**
 * Advance bank UVs downstream (+Z) to match river flow.
 * @param {THREE.Group | null} group
 * @param {number} delta
 * @param {number} [scrollSpeed]
 */
export function updateCongoRiverBanks(group, delta, scrollSpeed = getCongoBankScrollSpeed()) {
    if (!group?.visible || delta <= 0) {
        return;
    }

    group.userData.scrollOffset =
        (group.userData.scrollOffset - scrollSpeed * delta + 1) % 1;

    group.traverse((obj) => {
        if (!obj.isMesh || !obj.material?.map) {
            return;
        }
        const factor = obj.userData.scrollFactor ?? 1;
        const sign = obj.userData.scrollSign ?? 1;
        obj.material.map.offset.x = group.userData.scrollOffset * factor * sign;
    });
}

/**
 * Scroll the submerged lake-bed plane downstream with the river (+Z).
 * @param {THREE.Mesh | null} bedMesh
 * @param {number} delta
 * @param {number} [scrollSpeed]
 */
export function updateCongoRiverLakeBed(bedMesh, delta, scrollSpeed = getCongoBankScrollSpeed()) {
    if (!bedMesh?.visible || delta <= 0) {
        return;
    }

    bedMesh.userData.riverBedScrollOffset =
        (bedMesh.userData.riverBedScrollOffset ?? 0) + scrollSpeed * delta;

    const offset = bedMesh.userData.riverBedScrollOffset;
    const mat = bedMesh.material;
    if (!mat) {
        return;
    }

    for (const key of ['map', 'normalMap', 'roughnessMap']) {
        const tex = mat[key];
        if (tex) {
            tex.offset.y = offset;
        }
    }
}

export function resetCongoRiverLakeBedScroll(bedMesh) {
    if (!bedMesh) {
        return;
    }
    bedMesh.userData.riverBedScrollOffset = 0;
    const mat = bedMesh.material;
    if (!mat) {
        return;
    }
    for (const key of ['map', 'normalMap', 'roughnessMap']) {
        const tex = mat[key];
        if (tex) {
            tex.offset.set(0, 0);
        }
    }
}

/**
 * Hot-swap bank scroll speed multiplier (for dev tuning).
 * @param {THREE.Group | null} group
 * @param {number} layer near|far|both
 * @param {number} factor
 */
export function setCongoBankScrollFactors(group, { near = 1, far = 0.58 } = {}) {
    if (!group) {
        return;
    }
    group.traverse((obj) => {
        if (!obj.isMesh) {
            return;
        }
        if (obj.userData.bankLayer === 'near') {
            obj.userData.scrollFactor = near;
        } else if (obj.userData.bankLayer === 'far') {
            obj.userData.scrollFactor = far;
        }
    });
}
