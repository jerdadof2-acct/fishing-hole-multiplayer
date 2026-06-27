import * as THREE from 'three';
import { GROUND_SIZE, POND_MASK_PROFILE } from '../buildLakeMask.js';
import { getStylizedDockWorldBounds } from '../scene/stylizedDock.js';

const MAX_INSTANCES = 175;
const MASK_ROTATE = POND_MASK_PROFILE.rotate;

/** Tight dock footprint — old exclusion blocked nearly the whole pond. */
const DOCK_BOUNDS = getStylizedDockWorldBounds({ margin: 1.1 });

export const SUBMERGED_GRASS_PROFILES = {
    crescent: {
        targetBlades: 130,
        minSpacing: 2.85,
        rebuildSeed: 0x09a3f21c,
        bladeHeightMin: 1.0,
        bladeHeightRange: 1.45,
        bladeWidthMin: 0.22,
        bladeWidthRange: 0.18,
        peekChance: 0.2,
        peekLift: 0.16,
        minBladeHeight: 0.5,
        swaySpeed: 1.2,
        swayAmp: 0.04,
        breezeSpeed: 0.38,
        breezeAmp: 0.028,
        waveCoupling: 0.32,
        waveScale: 0.11,
        colorDeep: new THREE.Vector3(0.1, 0.3, 0.08),
        colorTip: new THREE.Vector3(0.26, 0.48, 0.12)
    },
    cortez: {
        targetBlades: 148,
        minSpacing: 2.05,
        rebuildSeed: 0xc07e7a21,
        placement: 'nearDock',
        dockAnchorX: 0,
        dockAnchorZ: 5.8,
        placementRadiusX: 10,
        placementRadiusZ: 13,
        placementBias: 1.85,
        bladeHeightMin: 1.35,
        bladeHeightRange: 2.05,
        bladeWidthMin: 0.2,
        bladeWidthRange: 0.18,
        baseDepthMin: 0.5,
        baseDepthMax: 0.16,
        peekChance: 0.38,
        peekLift: 0.28,
        minBladeHeight: 0.52,
        submergedTipY: 0.16,
        renderOrder: 3,
        swaySpeed: 0.48,
        swayAmp: 0.24,
        breezeSpeed: 0.17,
        breezeAmp: 0.28,
        waveCoupling: 1.15,
        waveScale: 0.16,
        motionScale: 1.35,
        colorDeep: new THREE.Vector3(0.07, 0.34, 0.13),
        colorTip: new THREE.Vector3(0.34, 0.56, 0.2)
    }
};

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

function isInsidePondWater(x, z, groundSize, inset = 0.78) {
    const u = x / groundSize + 0.5;
    const v = 1.0 - (z / groundSize + 0.5);
    const du = u - 0.5;
    const dv = v - 0.5;
    const cos = Math.cos(-MASK_ROTATE);
    const sin = Math.sin(-MASK_ROTATE);
    const eu = du * cos - dv * sin;
    const ev = du * sin + dv * cos;
    return (eu / POND_MASK_PROFILE.a) ** 2 + (ev / POND_MASK_PROFILE.b) ** 2 < inset * inset;
}

function isOnDock(x, z) {
    return x > DOCK_BOUNDS.x
        && x < DOCK_BOUNDS.y
        && z > DOCK_BOUNDS.z
        && z < DOCK_BOUNDS.w;
}

function sampleMaskWater(x, z, lakeMask, groundSize) {
    if (!lakeMask?.image?.getContext) {
        return isInsidePondWater(x, z, groundSize);
    }

    const uvx = (x / groundSize) + 0.5;
    const uvz = 1.0 - ((z / groundSize) + 0.5);
    const cvs = lakeMask.image;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    const px = Math.floor(Math.max(0, Math.min(1, uvx)) * (cvs.width - 1));
    const py = Math.floor(Math.max(0, Math.min(1, uvz)) * (cvs.height - 1));
    const maskValue = ctx.getImageData(px, py, 1, 1).data[0] / 255;
    return maskValue > 0.52;
}

/** Sample within the pond ellipse (uniform area distribution). */
function samplePondPoint(rand, groundSize) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 0.82;
    const eu = Math.cos(angle) * radius * POND_MASK_PROFILE.a;
    const ev = Math.sin(angle) * radius * POND_MASK_PROFILE.b;
    const cos = Math.cos(MASK_ROTATE);
    const sin = Math.sin(MASK_ROTATE);
    const du = eu * cos + ev * sin;
    const dv = -eu * sin + ev * cos;
    const x = du * groundSize;
    const z = -dv * groundSize;
    return { x, z };
}

/** Tighter patch in front of the dock — biased toward the anchor for mobile framing. */
function sampleNearDockPoint(rand, profile) {
    const anchorX = profile.dockAnchorX ?? 0;
    const anchorZ = profile.dockAnchorZ ?? 5.8;
    const radiusX = profile.placementRadiusX ?? 10;
    const radiusZ = profile.placementRadiusZ ?? 13;
    const bias = profile.placementBias ?? 1.85;

    const t = Math.pow(rand(), bias);
    const angle = rand() * Math.PI * 2;
    const forward = 0.55 + rand() * 0.45;

    const x = anchorX + Math.cos(angle) * radiusX * t;
    const z = anchorZ + (Math.sin(angle) * 0.55 + forward) * radiusZ * t;

    return { x, z };
}

/** Shared near-dock placement for Cortez seagrass and ambient fish shadows. */
export function sampleCortezAmbientZonePoint(rand) {
    return sampleNearDockPoint(rand, SUBMERGED_GRASS_PROFILES.cortez);
}

export function isValidCortezAmbientZone(x, z, lakeMask, groundSize) {
    return sampleMaskWater(x, z, lakeMask, groundSize) && !isOnDock(x, z);
}

/**
 * Tapered seagrass blade — wide base, blunt narrow tip (not a flat rectangle).
 */
function createGrassBladeGeometry() {
    const segmentsY = 7;
    const geo = new THREE.PlaneGeometry(1, 1, 1, segmentsY);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const heightT = THREE.MathUtils.clamp(y + 0.5, 0, 1);
        const widthT = 1.0 - Math.pow(heightT, 1.65) * 0.9;
        let x = pos.getX(i) * widthT;

        if (heightT > 0.78) {
            const tipT = (heightT - 0.78) / 0.22;
            x *= 1.0 - tipT * 0.62;
        }

        pos.setX(i, x);
        pos.setY(i, y);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
}

function makeSubmergedGrassMaterial(profile) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSwaySpeed: { value: profile.swaySpeed },
            uSwayAmp: { value: profile.swayAmp },
            uBreezeSpeed: { value: profile.breezeSpeed },
            uBreezeAmp: { value: profile.breezeAmp },
            uWaveSpeed: { value: 0.95 },
            uWaveScale: { value: profile.waveScale },
            uWaveCoupling: { value: profile.waveCoupling },
            uMotionScale: { value: profile.motionScale ?? 1.0 },
            uColorDeep: { value: profile.colorDeep.clone() },
            uColorTip: { value: profile.colorTip.clone() }
        },
        defines: {
            USE_INSTANCING: ''
        },
        vertexShader: `
            uniform float uTime;
            uniform float uSwaySpeed;
            uniform float uSwayAmp;
            uniform float uBreezeSpeed;
            uniform float uBreezeAmp;
            uniform float uWaveSpeed;
            uniform float uWaveScale;
            uniform float uWaveCoupling;
            uniform float uMotionScale;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                vec3 p = position;

                vec4 anchorWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                float wx = anchorWorld.x;
                float wz = anchorWorld.z;
                float tip = uv.y;

                float breeze = sin(uTime * uBreezeSpeed + wx * 0.31 + wz * 0.24)
                    + sin(uTime * uBreezeSpeed * 0.67 + wx * 0.18 - wz * 0.22) * 0.45;
                breeze *= uBreezeAmp;

                float sway = sin(uTime * uSwaySpeed + wx * 1.35 + wz * 1.05) * uSwayAmp;

                float wave = sin(uTime * uWaveSpeed + wx * uWaveScale + wz * uWaveScale * 0.86)
                    + sin(uTime * uWaveSpeed * 1.35 + wx * uWaveScale * 1.4 - wz * uWaveScale * 0.7) * 0.35;
                wave *= uWaveCoupling * 0.055;

                float lean = (breeze + sway + wave) * tip * uMotionScale;
                p.x += lean;
                p.z += lean * 0.55;
                p.y += sin(uTime * uBreezeSpeed * 1.1 + wx * 0.42) * tip * uBreezeAmp * 0.18;

                vec4 worldPosition = instanceMatrix * vec4(p, 1.0);
                vec4 mvPosition = modelViewMatrix * worldPosition;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 uColorDeep;
            uniform vec3 uColorTip;
            varying vec2 vUv;

            void main() {
                vec3 color = mix(uColorDeep, uColorTip, pow(vUv.y, 1.12));

                float centerX = 1.0 - abs(vUv.x - 0.5) * 2.0;
                float edgeMask = smoothstep(0.04, 0.42, centerX);
                float tipMask = smoothstep(0.02, 0.2, vUv.y);

                float alpha = mix(0.68, 0.95, vUv.y) * edgeMask * tipMask;
                if (alpha < 0.05) discard;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });
}

function applyProfileUniforms(material, profile) {
    if (!material?.uniforms) return;
    const u = material.uniforms;
    u.uSwaySpeed.value = profile.swaySpeed;
    u.uSwayAmp.value = profile.swayAmp;
    u.uBreezeSpeed.value = profile.breezeSpeed;
    u.uBreezeAmp.value = profile.breezeAmp;
    u.uWaveScale.value = profile.waveScale;
    u.uWaveCoupling.value = profile.waveCoupling;
    if (u.uMotionScale) {
        u.uMotionScale.value = profile.motionScale ?? 1.0;
    }
    u.uColorDeep.value.copy(profile.colorDeep);
    u.uColorTip.value.copy(profile.colorTip);
}

/**
 * Submerged seagrass / pond grass under the water surface.
 */
export class PondSubmergedGrass {
    /**
     * @param {import('../scene.js').Scene} sceneRef
     * @param {{ lakeMask: THREE.Texture, groundSize?: number, waterY?: number, profile?: string }} options
     */
    constructor(sceneRef, { lakeMask, groundSize = GROUND_SIZE, waterY = 0, profile = 'crescent' }) {
        this.sceneRef = sceneRef;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.mesh = null;
        this.time = 0;
        this._active = false;
        this._profileKey = SUBMERGED_GRASS_PROFILES[profile] ? profile : 'crescent';
        this._waveSpeed = 0.95;
    }

    getProfile() {
        return SUBMERGED_GRASS_PROFILES[this._profileKey] || SUBMERGED_GRASS_PROFILES.crescent;
    }

    setProfile(profileKey) {
        const next = SUBMERGED_GRASS_PROFILES[profileKey] ? profileKey : 'crescent';
        const profileChanged = next !== this._profileKey;
        this._profileKey = next;
        if (this.mesh) {
            applyProfileUniforms(this.mesh.material, this.getProfile());
            if (profileChanged) {
                this.rebuild(this.lakeMask);
            }
        }
    }

    create() {
        this.dispose();

        const profile = this.getProfile();
        const geometry = createGrassBladeGeometry();
        const material = makeSubmergedGrassMaterial(profile);
        const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.renderOrder = profile.renderOrder ?? 3;
        mesh.name = 'pondSubmergedGrass';
        mesh.count = 0;
        mesh.visible = false;

        this.mesh = mesh;
        this.sceneRef.scene.add(mesh);
        this.rebuild(this.lakeMask);
    }

    rebuild(lakeMask) {
        if (!this.mesh) return;

        if (lakeMask) {
            this.lakeMask = lakeMask;
        }

        const profile = this.getProfile();
        const rand = mulberry32(profile.rebuildSeed);
        const dummy = new THREE.Object3D();
        const placedPoints = [];
        let placed = 0;
        let attempts = 0;
        const maxAttempts = profile.targetBlades * 40;
        const surfaceY = this.waterY;

        while (placed < profile.targetBlades && attempts < maxAttempts) {
            attempts += 1;
            const { x, z } = profile.placement === 'nearDock'
                ? sampleNearDockPoint(rand, profile)
                : samplePondPoint(rand, this.groundSize);

            if (!sampleMaskWater(x, z, this.lakeMask, this.groundSize)) continue;
            if (isOnDock(x, z)) continue;

            const tooClose = placedPoints.some(
                (p) => Math.hypot(p.x - x, p.z - z) < profile.minSpacing
            );
            if (tooClose) continue;

            const baseY = THREE.MathUtils.lerp(
                surfaceY - (profile.baseDepthMin ?? 0.5),
                surfaceY - (profile.baseDepthMax ?? 0.1),
                rand()
            );
            const peek = rand() < profile.peekChance;
            const submergedTip = profile.submergedTipY ?? -0.01;
            const maxTip = peek ? surfaceY + profile.peekLift : surfaceY + submergedTip;
            let bladeHeight = profile.bladeHeightMin + rand() * profile.bladeHeightRange;
            const availableHeight = maxTip - baseY;
            bladeHeight = Math.min(bladeHeight, availableHeight);
            if (bladeHeight < profile.minBladeHeight) continue;

            const bladeWidth = profile.bladeWidthMin + rand() * profile.bladeWidthRange;

            dummy.position.set(x, baseY + bladeHeight * 0.5, z);
            dummy.rotation.set(0, rand() * Math.PI * 2, 0);
            dummy.scale.set(bladeWidth, bladeHeight, 1);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(placed, dummy.matrix);
            placedPoints.push({ x, z });
            placed += 1;
        }

        this.mesh.count = placed;
        this.mesh.renderOrder = profile.renderOrder ?? 3;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.setActive(this._active);

        if (placed === 0) {
            console.warn('[POND GRASS] No submerged grass placed — check pond mask / dock bounds');
        } else {
            console.log(`[POND GRASS] Placed ${placed} ${this._profileKey} submerged blades`);
        }
    }

    setActive(active) {
        this._active = active;
        if (this.mesh) {
            if (active && this.mesh.count === 0) {
                this.rebuild(this.lakeMask);
            }
            this.mesh.visible = active && this.mesh.count > 0;
        }
    }

    update(delta, waveContext = {}) {
        this.time = (this.time || 0) + delta;
        const uniforms = this.mesh?.material?.uniforms;
        if (!uniforms) return;

        uniforms.uTime.value = this.time;

        if (typeof waveContext.waveSpeed === 'number') {
            this._waveSpeed = waveContext.waveSpeed;
        }
        uniforms.uWaveSpeed.value = this._waveSpeed;
    }

    dispose() {
        if (!this.mesh) return;

        this.sceneRef.scene.remove(this.mesh);
        this.mesh.geometry?.dispose();
        this.mesh.material?.dispose();
        this.mesh = null;
    }
}
