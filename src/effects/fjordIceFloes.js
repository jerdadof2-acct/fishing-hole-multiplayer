import * as THREE from 'three';
import { GROUND_SIZE, LAKE_MASK_PROFILE } from '../buildLakeMask.js';

const TARGET_FLOES = 30;
const MIN_FLOE_SPACING = 7;
const MASK_ROTATE = LAKE_MASK_PROFILE.rotate;

/** Visible fishing area in front of / around the small boat. */
function samplePlayAreaPoint(rand, lakeMask, groundSize) {
    for (let i = 0; i < 40; i++) {
        const x = (rand() - 0.5) * 150;
        const z = rand() * 52 - 14;
        if (!sampleMaskWater(x, z, lakeMask, groundSize)) continue;
        if (isOnBoat(x, z)) continue;
        return { x, z };
    }
    return sampleLakePoint(rand, groundSize);
}

/** Keep ice off the small-boat fishing platform. */
function isOnBoat(x, z) {
    return Math.abs(x) < 4.2 && z > -11 && z < 7;
}

function mulberry32(seed) {
    let state = seed;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function sampleLakePoint(rand, groundSize) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 0.86;
    const eu = Math.cos(angle) * radius * LAKE_MASK_PROFILE.a;
    const ev = Math.sin(angle) * radius * LAKE_MASK_PROFILE.b;
    const cos = Math.cos(MASK_ROTATE);
    const sin = Math.sin(MASK_ROTATE);
    const du = eu * cos + ev * sin;
    const dv = -eu * sin + ev * cos;
    return {
        x: du * groundSize,
        z: -dv * groundSize
    };
}

function sampleMaskWater(x, z, lakeMask, groundSize) {
    if (!lakeMask?.image?.getContext) {
        const u = x / groundSize + 0.5;
        const v = 1.0 - (z / groundSize + 0.5);
        const du = u - 0.5;
        const dv = v - 0.5;
        const cos = Math.cos(-MASK_ROTATE);
        const sin = Math.sin(-MASK_ROTATE);
        const eu = du * cos - dv * sin;
        const ev = du * sin + dv * cos;
        return (eu / LAKE_MASK_PROFILE.a) ** 2 + (ev / LAKE_MASK_PROFILE.b) ** 2 < 0.78 ** 2;
    }

    const uvx = (x / groundSize) + 0.5;
    const uvz = 1.0 - ((z / groundSize) + 0.5);
    const cvs = lakeMask.image;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    const px = Math.floor(Math.max(0, Math.min(1, uvx)) * (cvs.width - 1));
    const py = Math.floor(Math.max(0, Math.min(1, uvz)) * (cvs.height - 1));
    return ctx.getImageData(px, py, 1, 1).data[0] / 255 > 0.52;
}

const ICE_MAT = new THREE.MeshStandardMaterial({
    color: 0xf2f9ff,
    emissive: 0x5a8aaa,
    emissiveIntensity: 0.22,
    roughness: 0.18,
    metalness: 0.06,
    flatShading: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true
});

/**
 * Irregular closed 2D outline — varying radius at sorted angles (no self-crossing).
 */
function makeJaggedOutline(rand, radius) {
    const shape = new THREE.Shape();
    const corners = 7 + Math.floor(rand() * 6);
    const spin = rand() * Math.PI * 2;
    const biteIndex = Math.floor(rand() * corners);

    for (let i = 0; i < corners; i++) {
        const angle = spin + (i / corners) * Math.PI * 2;
        let r = radius * (0.42 + rand() * 0.58);
        if (i === biteIndex) {
            r *= 0.22 + rand() * 0.2;
        } else if (i === (biteIndex + 1) % corners || i === (biteIndex + corners - 1) % corners) {
            r *= 0.62 + rand() * 0.22;
        }
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) {
            shape.moveTo(px, py);
        } else {
            shape.lineTo(px, py);
        }
    }
    shape.closePath();
    return shape;
}

function seatGeometryOnWater(geometry) {
    geometry.computeBoundingBox();
    const minY = geometry.boundingBox.min.y;
    if (Number.isFinite(minY) && minY !== 0) {
        geometry.translate(0, -minY, 0);
    }
}

function roughenIceGeometry(geometry, rand, depth) {
    const pos = geometry.attributes.position;
    if (!pos) return;

    geometry.computeBoundingBox();
    const minY = geometry.boundingBox.min.y;
    const maxY = geometry.boundingBox.max.y;
    const ySpan = Math.max(0.001, maxY - minY);

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const topness = THREE.MathUtils.smoothstep(y, minY + ySpan * 0.35, maxY);
        const edge = Math.min(1, Math.hypot(x, z) / Math.max(0.4, depth * 1.8));
        const jag = topness * (0.5 + edge * 0.5);

        pos.setX(i, x + (rand() - 0.5) * 0.12 * jag);
        pos.setY(i, y + (rand() - 0.5) * 0.08 * jag);
        pos.setZ(i, z + (rand() - 0.5) * 0.12 * jag);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
}

function buildJaggedIceSlab(rand, radiusScale = 1) {
    const radius = (1.15 + rand() * 1.85) * radiusScale;
    const depth = 0.28 + rand() * 0.42;
    const shape = makeJaggedOutline(rand, radius);

    let geometry;
    try {
        geometry = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelThickness: 0.02 + rand() * 0.03,
            bevelSize: 0.025 + rand() * 0.04,
            bevelSegments: 1,
            curveSegments: 1
        });
    } catch (err) {
        console.warn('[FJORD ICE] Extrude failed, using fallback slab:', err);
        geometry = new THREE.CylinderGeometry(radius * 0.75, radius * 0.9, depth, 7, 1);
    }

    if (!geometry.attributes?.position?.count) {
        geometry.dispose();
        geometry = new THREE.CylinderGeometry(radius * 0.75, radius * 0.9, depth, 7, 1);
    }

    geometry.rotateX(-Math.PI / 2);
    roughenIceGeometry(geometry, rand, depth);
    seatGeometryOnWater(geometry);

    const mesh = new THREE.Mesh(geometry, ICE_MAT);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 6;
    return mesh;
}

function buildIceFloe(rand) {
    const group = new THREE.Group();

    const main = buildJaggedIceSlab(rand, 1);
    group.add(main);

    const chipCount = rand() > 0.35 ? 1 + Math.floor(rand() * 2) : 0;
    for (let i = 0; i < chipCount; i++) {
        const chip = buildJaggedIceSlab(rand, 0.35 + rand() * 0.45);
        const spread = 0.55 + rand() * 0.75;
        chip.position.set(
            (rand() - 0.5) * spread,
            0.02 + rand() * 0.05,
            (rand() - 0.5) * spread
        );
        chip.rotation.y = (rand() - 0.5) * 1.2;
        chip.rotation.x = (rand() - 0.5) * 0.18;
        chip.rotation.z = (rand() - 0.5) * 0.18;
        group.add(chip);
    }

    const scale = 1.25 + rand() * 0.65;
    group.scale.setScalar(scale);
    return group;
}

/**
 * Floating ice chunks for Frozen Fjords — bob on the water surface.
 */
export class FjordIceFloes {
    /**
     * @param {import('../scene.js').Scene} sceneRef
     * @param {{ lakeMask: THREE.Texture, groundSize?: number, waterY?: number }} options
     */
    constructor(sceneRef, { lakeMask, groundSize = GROUND_SIZE, waterY = 0 }) {
        this.sceneRef = sceneRef;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.root = null;
        this.floes = [];
        this.time = 0;
        this._active = false;
    }

    create() {
        this.dispose();

        const root = new THREE.Group();
        root.name = 'fjordIceFloes';
        root.visible = false;
        root.frustumCulled = false;
        this.root = root;
        this.floes = [];
        this.sceneRef.scene.add(root);
    }

    rebuild(lakeMask) {
        if (!this.root) return;

        if (lakeMask) {
            this.lakeMask = lakeMask;
        }

        while (this.root.children.length) {
            const child = this.root.children[0];
            this.root.remove(child);
            child.traverse((node) => {
                if (node.isMesh) {
                    node.geometry?.dispose();
                }
            });
        }
        this.floes = [];

        const rand = mulberry32(0x7c1e9a4d);
        const placedPoints = [];
        let placed = 0;
        let attempts = 0;
        const maxAttempts = TARGET_FLOES * 50;

        while (placed < TARGET_FLOES && attempts < maxAttempts) {
            attempts += 1;
            const { x, z } = samplePlayAreaPoint(rand, this.lakeMask, this.groundSize);

            if (!sampleMaskWater(x, z, this.lakeMask, this.groundSize)) continue;
            if (isOnBoat(x, z)) continue;

            const tooClose = placedPoints.some(
                (p) => Math.hypot(p.x - x, p.z - z) < MIN_FLOE_SPACING
            );
            if (tooClose) continue;

            let group;
            try {
                group = buildIceFloe(rand);
            } catch (err) {
                console.warn('[FJORD ICE] Skipped floe — build failed:', err);
                continue;
            }

            group.position.set(x, this.waterY, z);
            group.rotation.y = rand() * Math.PI * 2;
            this.root.add(group);

            this.floes.push({
                group,
                x,
                z,
                phase: rand() * Math.PI * 2,
                rollPhase: rand() * Math.PI * 2,
                bobSpeed: 0.55 + rand() * 0.45,
                bobAmp: 0.03 + rand() * 0.05,
                drift: (rand() - 0.5) * 0.012,
                baseRotY: group.rotation.y
            });
            placedPoints.push({ x, z });
            placed += 1;
        }

        this.setActive(this._active);

        if (placed === 0) {
            console.warn('[FJORD ICE] No ice floes placed — check lake mask / boat bounds');
        } else {
            console.log(`[FJORD ICE] Placed ${placed} floating ice chunks`);
        }
    }

    setActive(active) {
        this._active = active;
        if (this.root) {
            this.root.visible = active && this.floes.length > 0;
        }
    }

    /**
     * @param {number} delta
     * @param {(x: number, z: number) => number} [getWaterHeight]
     */
    update(delta, getWaterHeight) {
        this.time = (this.time || 0) + delta;
        if (!this._active || !this.floes.length) {
            return;
        }

        const sampleHeight = typeof getWaterHeight === 'function'
            ? getWaterHeight
            : (x, z) => this.waterY;

        for (const floe of this.floes) {
            const surfaceY = sampleHeight(floe.x, floe.z);
            const bob = Math.sin(this.time * floe.bobSpeed + floe.phase) * floe.bobAmp;
            const pitch = Math.sin(this.time * 0.32 + floe.rollPhase) * 0.035;
            const roll = Math.sin(this.time * 0.27 + floe.phase * 1.2) * 0.028;

            floe.group.position.y = surfaceY + bob + 0.14;
            floe.group.rotation.x = pitch;
            floe.group.rotation.z = roll;
            floe.group.rotation.y = floe.baseRotY + this.time * floe.drift;
        }
    }

    dispose() {
        if (!this.root) return;

        this.sceneRef.scene.remove(this.root);
        this.root.traverse((node) => {
            if (node.isMesh) {
                node.geometry?.dispose();
            }
        });
        this.root = null;
        this.floes = [];
    }
}
