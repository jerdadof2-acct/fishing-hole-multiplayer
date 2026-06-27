import * as THREE from 'three';
import { getRiverDownstreamDir } from './riverDockPostWake.js';

/**
 * Serpentine / lateral-undulation shadow for Amazon Depths.
 *
 * Motion model (serpenoid travelling wave, head → tail):
 *   lateral(s, t) = A(s) · sin(ωt − k·s)
 * where s is arc length from the head, k = 2π/λ, ω = 2π/T.
 * @see lateral undulation in aquatic snakes — wave propagates posteriorly.
 */

const SPINE_SAMPLES = 36;
const BODY_LENGTH = 22;
const HEAD_SPEED = 4.6;
const SPAWN_INTERVAL_MIN = 150;
const SPAWN_INTERVAL_MAX = 240;
const CROSS_DISTANCE = 118;

/** One full lateral wave every ~2.4 s; wavelength scales with body (~3 visible S-bends). */
const WAVE_PERIOD = 2.4;
const WAVE_LENGTH = 7.5;
const WAVE_AMP = 2.1;

const SHADOW_DEPTH = 0.036;
const SURFACE_RENDER_ORDER = 12;

/** World-space dock footprint (matches platform at z=-1.5, depth 14, width 3). */
const DOCK_CENTER_Z = -1.5;
const DOCK_HALF_DEPTH = 7;
const DOCK_HALF_WIDTH = 1.65;
const DOCK_FRONT_Z = DOCK_CENTER_Z + DOCK_HALF_DEPTH;
/** Comfortable swim center — far enough ahead that S-curves never hit a hard boundary. */
const SWIM_LANE_CENTER_Z = DOCK_FRONT_Z + 5.4;
/** Spawn only in the inner part of the lane (not near enforcement edges). */
const SWIM_LANE_SPAWN_JITTER = 1.05;
/** Lateral wave can reach ~±this in Z; keep dock push below this padding. */
const SERPENTINE_Z_PADDING = WAVE_AMP * 1.12 + 0.45;
/** Soft repulsion begins below this Z when crossing in front of the dock. */
const DOCK_LIP_Z = DOCK_FRONT_Z + 1.15;
const DOCK_PUSH_TARGET_Z = DOCK_FRONT_Z + 3.85;
const DOCK_X_GUARD = DOCK_HALF_WIDTH + 3.2;

function smoothstep(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Soft dock avoidance only — never a hard lane wall that flattens the serpentine wave.
 */
function softenDockApproach(x, z) {
    const nearDockX = 1 - smoothstep(DOCK_X_GUARD, DOCK_X_GUARD + 6.5, Math.abs(x));
    if (nearDockX < 1e-4) {
        return { x, z };
    }

    const safeZ = DOCK_LIP_Z + SERPENTINE_Z_PADDING;
    if (z >= safeZ) {
        return { x, z };
    }

    const danger = smoothstep(safeZ, DOCK_LIP_Z - 0.35, z);
    const easedZ = z + (DOCK_PUSH_TARGET_Z - z) * danger * nearDockX * 0.5;
    return { x, z: easedZ };
}

let sharedRibbonTexture = null;

function resetAnacondaTextures() {
    sharedRibbonTexture?.dispose?.();
    sharedRibbonTexture = null;
}

function createRibbonTexture() {
    if (sharedRibbonTexture) {
        return sharedRibbonTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(3, 7, 5, 0.78)');
    grad.addColorStop(0.12, 'rgba(4, 8, 6, 0.7)');
    grad.addColorStop(0.5, 'rgba(4, 8, 6, 0.56)');
    grad.addColorStop(0.88, 'rgba(3, 6, 5, 0.4)');
    grad.addColorStop(1, 'rgba(2, 5, 4, 0.14)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);

    ctx.strokeStyle = 'rgba(2, 5, 4, 0.11)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
        const y = 18 + i * 26;
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(56, y);
        ctx.stroke();
    }

    sharedRibbonTexture = new THREE.CanvasTexture(canvas);
    sharedRibbonTexture.needsUpdate = true;
    return sharedRibbonTexture;
}

/** Amplitude envelope along body: thin head, thick midsection, tapered tail. */
function amplitudeEnvelope(t) {
    if (t < 0.06) {
        return (t / 0.06) * 0.28;
    }
    if (t > 0.9) {
        return ((1 - t) / 0.1) * 0.35;
    }
    return 0.28 + 0.72 * Math.sin(((t - 0.06) / 0.84) * Math.PI);
}

/** Body half-width along arc length. */
function widthEnvelope(t) {
    if (t < 0.05) {
        return 0.11 + (t / 0.05) * 0.09;
    }
    if (t > 0.88) {
        return 0.19 * ((1 - t) / 0.12);
    }
    return 0.19 + 0.07 * Math.sin(((t - 0.05) / 0.83) * Math.PI);
}

function buildRibbonMesh() {
    const vertCount = SPINE_SAMPLES * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    for (let i = 0; i < SPINE_SAMPLES; i++) {
        const u = i / (SPINE_SAMPLES - 1);
        uvs[i * 4] = 0;
        uvs[i * 4 + 1] = u;
        uvs[i * 4 + 2] = 1;
        uvs[i * 4 + 3] = u;
    }

    for (let i = 0; i < SPINE_SAMPLES - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, b, c, b, d, c);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
        map: createRibbonTexture(),
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = SURFACE_RENDER_ORDER;
    return mesh;
}

/**
 * Rare, huge anaconda shadow — serpenoid lateral undulation under the river surface.
 */
export class AmazonAnacondaShadow {
    constructor(sceneRef, { waterY = 0, flowDirection = new THREE.Vector2(1, 0), groundSize = 400 } = {}) {
        this.sceneRef = sceneRef;
        this.waterY = waterY;
        this.flowDirection = flowDirection;
        this.groundSize = groundSize;
        this.root = null;
        this.ribbon = null;
        this._active = false;
        this._swimming = false;
        this._spawnTimer = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
        this.animTime = 0;
        this.pathProgress = 0;
        this.startX = 0;
        this.startZ = 0;
        this.downstream = new THREE.Vector2(-1, 0);
        this.perp = new THREE.Vector2(0, 1);
        this._waveOmega = (Math.PI * 2) / WAVE_PERIOD;
        this._waveK = (Math.PI * 2) / WAVE_LENGTH;
        this._spineScratch = [];
        for (let i = 0; i < SPINE_SAMPLES; i++) {
            this._spineScratch.push({ x: 0, z: 0 });
        }
    }

    isSwimming() {
        return this._swimming === true;
    }

    /** Head + mid-body samples for proximity checks (world XZ). */
    getProximitySamplePoints() {
        if (!this._swimming || !this._spineScratch.length) {
            return [];
        }
        const spine = this._spineScratch;
        const pick = (t) => spine[Math.min(spine.length - 1, Math.floor(t * (spine.length - 1)))];
        return [pick(0), pick(0.35), pick(0.62)];
    }

    create(parent = null) {
        this.dispose();
        resetAnacondaTextures();

        const root = new THREE.Group();
        root.name = 'amazonAnacondaShadow';
        root.visible = false;
        root.frustumCulled = false;
        root.renderOrder = SURFACE_RENDER_ORDER;
        this.root = root;
        this.ribbon = buildRibbonMesh();
        root.add(this.ribbon);
        (parent || this.sceneRef.scene).add(root);

        this._resetSpawnTimer();
    }

    setActive(active) {
        this._active = active === true;
        if (!this._active) {
            this._swimming = false;
            if (this.root) {
                this.root.visible = false;
            }
            this._resetSpawnTimer();
        } else if (!this._swimming) {
            this._spawnTimer = 70 + Math.random() * 50;
        }
    }

    setFlowDirection(flowDirection) {
        this.flowDirection = flowDirection?.clone?.() || new THREE.Vector2(1, 0);
        this.downstream = getRiverDownstreamDir(this.flowDirection);
        this.perp.set(-this.downstream.y, this.downstream.x);
    }

    _resetSpawnTimer() {
        this._spawnTimer = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }

    _beginSwim({ closer = false } = {}) {
        this._swimming = true;
        this.animTime = 0;
        this.pathProgress = 0;
        this.setFlowDirection(this.flowDirection);

        const upstreamX = -this.downstream.x;
        const margin = this.groundSize * (closer ? 0.06 : 0.1);
        this.startX = upstreamX * margin;
        this.startZ = SWIM_LANE_CENTER_Z + (Math.random() - 0.5) * 2 * SWIM_LANE_SPAWN_JITTER;

        if (this.root) {
            this.root.visible = true;
        }
        this._updateRibbonGeometry();
    }

    _endSwim() {
        this._swimming = false;
        if (this.root) {
            this.root.visible = false;
        }
        this._resetSpawnTimer();
    }

    forceSpawn({ closer = false } = {}) {
        if (!this.ribbon) {
            return false;
        }
        this._active = true;
        this._beginSwim({ closer });
        return true;
    }

    /** Serpenoid spine sample at arc length s from the head. */
    _spineAt(s, headX, headZ, time) {
        const t = THREE.MathUtils.clamp(s / BODY_LENGTH, 0, 1);
        const env = amplitudeEnvelope(t);
        const phase = this._waveOmega * time - this._waveK * s;
        const lateral = env * WAVE_AMP * Math.sin(phase);
        const secondary = env * WAVE_AMP * 0.12 * Math.sin(phase * 2 + 0.6);

        return {
            x: headX - this.downstream.x * s + this.perp.x * (lateral + secondary),
            z: headZ - this.downstream.y * s + this.perp.y * (lateral + secondary)
        };
    }

    _updateRibbonGeometry() {
        if (!this.ribbon) {
            return;
        }

        const headX = this.startX + this.downstream.x * this.pathProgress;
        const headZ = this.startZ + this.downstream.y * this.pathProgress;
        const time = this.animTime;
        const spine = this._spineScratch;
        const ds = BODY_LENGTH / (SPINE_SAMPLES - 1);

        for (let i = 0; i < SPINE_SAMPLES; i++) {
            const s = i * ds;
            const p = this._spineAt(s, headX, headZ, time);
            const routed = softenDockApproach(p.x, p.z);
            spine[i].x = routed.x;
            spine[i].z = routed.z;
        }

        const positions = this.ribbon.geometry.attributes.position.array;
        const shadowY = this.waterY - SHADOW_DEPTH;

        for (let i = 0; i < SPINE_SAMPLES; i++) {
            const s = i * ds;
            const t = s / BODY_LENGTH;
            const halfW = widthEnvelope(t);

            const iPrev = Math.max(0, i - 1);
            const iNext = Math.min(SPINE_SAMPLES - 1, i + 1);
            let tx = spine[iNext].x - spine[iPrev].x;
            let tz = spine[iNext].z - spine[iPrev].z;
            const tLen = Math.hypot(tx, tz);
            if (tLen < 1e-6) {
                tx = this.downstream.x;
                tz = this.downstream.y;
            } else {
                tx /= tLen;
                tz /= tLen;
            }

            const nx = -tz;
            const nz = tx;
            const cx = spine[i].x;
            const cz = spine[i].z;

            const li = i * 6;
            positions[li] = cx + nx * halfW;
            positions[li + 1] = shadowY;
            positions[li + 2] = cz + nz * halfW;
            positions[li + 3] = cx - nx * halfW;
            positions[li + 4] = shadowY;
            positions[li + 5] = cz - nz * halfW;
        }

        this.ribbon.geometry.attributes.position.needsUpdate = true;
        this.ribbon.geometry.computeVertexNormals();
    }

    update(delta) {
        if (!this._active || !this.ribbon) {
            return;
        }

        if (!this._swimming) {
            this._spawnTimer -= delta;
            if (this._spawnTimer <= 0) {
                this._beginSwim();
            }
            return;
        }

        this.animTime += delta;
        this.pathProgress += HEAD_SPEED * delta;
        this._updateRibbonGeometry();

        if (this.pathProgress >= CROSS_DISTANCE) {
            this._endSwim();
        }
    }

    dispose() {
        if (!this.root) {
            return;
        }

        this.sceneRef.scene.remove(this.root);
        this.ribbon?.geometry?.dispose();
        this.ribbon?.material?.dispose();
        this.root = null;
        this.ribbon = null;
        this._swimming = false;
    }
}
