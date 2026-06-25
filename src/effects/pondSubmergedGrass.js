import * as THREE from 'three';
import { GROUND_SIZE, POND_MASK_PROFILE } from '../buildLakeMask.js';
import { getStylizedDockWorldBounds } from '../scene/stylizedDock.js';

const TARGET_BLADES = 130;
const MAX_INSTANCES = 160;
/** Minimum world-space gap between blade centers — avoids clumpy patches. */
const MIN_BLADE_SPACING = 2.85;
const MASK_ROTATE = POND_MASK_PROFILE.rotate;

/** Tight dock footprint — old exclusion blocked nearly the whole pond. */
const DOCK_BOUNDS = getStylizedDockWorldBounds({ margin: 1.1 });

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

function makeSubmergedGrassMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }
        },
        defines: {
            USE_INSTANCING: ''
        },
        vertexShader: `
            uniform float uTime;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                vec3 p = position;

                float sway = sin(uTime * 1.2 + position.x * 1.4 + position.z * 1.1) * 0.04;
                p.x += sway * uv.y;
                p.z += sway * 0.4 * uv.y;

                vec4 worldPosition = instanceMatrix * vec4(p, 1.0);
                vec4 mvPosition = modelViewMatrix * worldPosition;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec2 vUv;

            void main() {
                vec3 deep = vec3(0.1, 0.3, 0.08);
                vec3 tip = vec3(0.26, 0.48, 0.12);
                vec3 color = mix(deep, tip, pow(vUv.y, 1.1));
                float alpha = mix(0.82, 1.0, vUv.y);
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });
}

/**
 * Small submerged grass patches for Crescent Pond.
 */
export class PondSubmergedGrass {
    /**
     * @param {import('../scene.js').Scene} sceneRef
     * @param {{ lakeMask: THREE.Texture, groundSize?: number, waterY?: number }} options
     */
    constructor(sceneRef, { lakeMask, groundSize = GROUND_SIZE, waterY = 0 }) {
        this.sceneRef = sceneRef;
        this.lakeMask = lakeMask;
        this.groundSize = groundSize;
        this.waterY = waterY;
        this.mesh = null;
        this.time = 0;
        this._active = false;
    }

    create() {
        this.dispose();

        const geometry = new THREE.PlaneGeometry(0.35, 1, 1, 4);
        const material = makeSubmergedGrassMaterial();
        const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.renderOrder = 3;
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

        const rand = mulberry32(0x09a3f21c);
        const dummy = new THREE.Object3D();
        const placedPoints = [];
        let placed = 0;
        let attempts = 0;
        const maxAttempts = TARGET_BLADES * 40;
        const surfaceY = this.waterY;

        while (placed < TARGET_BLADES && attempts < maxAttempts) {
            attempts += 1;
            const { x, z } = samplePondPoint(rand, this.groundSize);

            if (!sampleMaskWater(x, z, this.lakeMask, this.groundSize)) continue;
            if (isOnDock(x, z)) continue;

            const tooClose = placedPoints.some(
                (p) => Math.hypot(p.x - x, p.z - z) < MIN_BLADE_SPACING
            );
            if (tooClose) continue;

            const baseY = THREE.MathUtils.lerp(surfaceY - 0.5, surfaceY - 0.1, rand());
            const peek = rand() < 0.2;
            const maxTip = peek ? surfaceY + 0.16 : surfaceY - 0.01;
            let bladeHeight = 1.0 + rand() * 1.45;
            bladeHeight = Math.min(bladeHeight, maxTip - baseY);
            if (bladeHeight < 0.5) continue;

            const bladeWidth = 0.22 + rand() * 0.18;

            dummy.position.set(x, baseY + bladeHeight * 0.5, z);
            dummy.rotation.set(0, rand() * Math.PI * 2, 0);
            dummy.scale.set(bladeWidth, bladeHeight, 1);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(placed, dummy.matrix);
            placedPoints.push({ x, z });
            placed += 1;
        }

        this.mesh.count = placed;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.setActive(this._active);

        if (placed === 0) {
            console.warn('[POND GRASS] No submerged grass placed — check pond mask / dock bounds');
        } else {
            console.log(`[POND GRASS] Placed ${placed} spaced submerged blades`);
        }
    }

    setActive(active) {
        this._active = active;
        if (this.mesh) {
            this.mesh.visible = active && this.mesh.count > 0;
        }
    }

    update(delta) {
        this.time = (this.time || 0) + delta;
        if (this.mesh?.material?.uniforms?.uTime) {
            this.mesh.material.uniforms.uTime.value = this.time;
        }
    }

    dispose() {
        if (!this.mesh) return;

        this.sceneRef.scene.remove(this.mesh);
        this.mesh.geometry?.dispose();
        this.mesh.material?.dispose();
        this.mesh = null;
    }
}
