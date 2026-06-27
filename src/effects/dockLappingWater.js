import * as THREE from 'three';
import { getStylizedDockLocalMetrics } from '../scene/stylizedDock.js';
import { SUN_SHADOW_EXTERIOR_X } from '../scene/sunShadowDirection.js';

const DOCK_GROUP_Z = -1.5;
const DOCK_WIDTH = 3;
const DOCK_DEPTH = 14;
const LAKE_DOCK_PLANK_COUNT = 11;

/** Exterior dock side that catches sun shadow on the water (+1 = +X right, -1 = -X left). */
const DOCK_SHADOW_EXTERIOR_X = SUN_SHADOW_EXTERIOR_X;

/**
 * Animated irregular water strip along the sun-shadow side of the dock.
 */
export function createDockLappingWater({
    dockWidth = DOCK_WIDTH,
    dockLength = 12,
    waterLevel = 0,
    dockCenterX = 0,
    dockCenterZ = 0,
    sideGap = 0.03,
    stripWidth = 0.7,
    color = 0x87beb2,
    opacity = 0.35,
    exteriorSideX = DOCK_SHADOW_EXTERIOR_X
} = {}) {
    const group = new THREE.Group();
    group.name = 'dockLappingStrips';

    const uniforms = {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity }
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,

        vertexShader: `
            uniform float uTime;

            varying vec2 vUv;
            varying float vWave;

            void main() {
                vUv = uv;

                vec3 transformed = position;

                float lengthWave =
                    sin((uv.y * 22.0) + uTime * 1.7) * 0.045;

                float secondWave =
                    sin((uv.y * 39.0) - uTime * 1.15) * 0.022;

                float shorePulse =
                    sin(uTime * 1.3 + uv.y * 5.0) * 0.035;

                transformed.x += lengthWave + secondWave + shorePulse;

                transformed.y +=
                    sin(uv.y * 18.0 + uTime * 1.8) * 0.012;

                vWave = lengthWave + secondWave;

                gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(transformed, 1.0);
            }
        `,

        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColor;
            uniform float uOpacity;

            varying vec2 vUv;
            varying float vWave;

            float random(vec2 p) {
                return fract(
                    sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453
                );
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);

                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));

                vec2 u = f * f * (3.0 - 2.0 * f);

                return mix(
                    a,
                    b,
                    u.x
                ) +
                (c - a) * u.y * (1.0 - u.x) +
                (d - b) * u.x * u.y;
            }

            void main() {
                float edgeFade = 1.0 - smoothstep(0.0, 1.0, vUv.x);

                float breakup = noise(
                    vec2(vUv.y * 18.0, uTime * 0.25)
                );

                float smallBreakup = noise(
                    vec2(vUv.y * 46.0, -uTime * 0.18)
                );

                float pulse =
                    0.55 +
                    sin(uTime * 1.5 + vUv.y * 8.0) * 0.25;

                float foamLine =
                    smoothstep(
                        0.48,
                        0.88,
                        breakup + smallBreakup * 0.45 + pulse * 0.25
                    );

                float alpha =
                    edgeFade *
                    foamLine *
                    uOpacity;

                float endFade =
                    smoothstep(0.0, 0.08, vUv.y) *
                    smoothstep(0.0, 0.08, 1.0 - vUv.y);

                alpha *= endFade;

                float dockTouch =
                    edgeFade *
                    foamLine *
                    (0.5 + sin(uTime * 2.2 + vUv.y * 12.0) * 0.5);

                vec3 finalColor =
                    uColor +
                    vec3(0.08, 0.11, 0.09) * foamLine +
                    vec3(0.1, 0.13, 0.1) * dockTouch * 0.55;

                gl_FragColor = vec4(finalColor, alpha);
            }
        `
    });

    const geometry = new THREE.PlaneGeometry(
        stripWidth,
        dockLength,
        8,
        80
    );

    geometry.rotateX(-Math.PI / 2);

    const side = exteriorSideX >= 0 ? 1 : -1;
    const strip = new THREE.Mesh(geometry, material);

    strip.position.set(
        dockCenterX + side * (dockWidth / 2 + sideGap + stripWidth / 2),
        waterLevel + 0.018,
        dockCenterZ
    );

    // Mirror on the +X exterior so waves lap toward the dock planks.
    if (side > 0) {
        strip.scale.x = -1;
    }

    strip.renderOrder = 4;

    group.add(strip);

    group.userData.update = (deltaTime) => {
        uniforms.uTime.value += deltaTime;
    };

    return group;
}

/**
 * Gentle semicircular pulse where water meets the dock front.
 */
export function createDockEndLap({
    dockWidth = DOCK_WIDTH,
    waterLevel = 0,
    dockEndZ = 0,
    color = 0x87beb2
} = {}) {
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    const geometry = new THREE.RingGeometry(
        dockWidth * 0.42,
        dockWidth * 0.72,
        48,
        1,
        0,
        Math.PI
    );

    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'dockEndLap';

    mesh.position.set(
        0,
        waterLevel + 0.022,
        dockEndZ
    );

    mesh.rotation.y = Math.PI;
    mesh.renderOrder = 4;

    mesh.userData.baseScale = 1;
    mesh.userData.time = Math.random() * 10;

    mesh.userData.update = (deltaTime) => {
        mesh.userData.time += deltaTime;

        const pulse =
            1 +
            Math.sin(mesh.userData.time * 1.45) * 0.08;

        mesh.scale.setScalar(pulse);

        material.opacity =
            0.17 +
            Math.sin(mesh.userData.time * 1.45 + 0.8) * 0.07;
    };

    return mesh;
}

/**
 * Dark wet wood strip immediately above the waterline on dock sides.
 */
export function createWetDockEdges({
    dockWidth = DOCK_WIDTH,
    dockLength = 12,
    waterLevel = 0,
    dockCenterZ = 0,
    exteriorSideX = DOCK_SHADOW_EXTERIOR_X
} = {}) {
    const group = new THREE.Group();
    group.name = 'wetDockEdges';

    const wetMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3026,
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
    });

    const wetHeight = 0.12;
    const wetThickness = 0.025;

    const sideGeometry = new THREE.BoxGeometry(
        wetThickness,
        wetHeight,
        dockLength
    );

    const side = exteriorSideX >= 0 ? 1 : -1;
    const wetEdge = new THREE.Mesh(sideGeometry, wetMaterial);
    wetEdge.position.set(
        side * (dockWidth / 2 + wetThickness / 2),
        waterLevel + wetHeight / 2,
        dockCenterZ
    );

    group.add(wetEdge);
    return group;
}

/**
 * Side strips, front pulse, and wet dock edges for Cortez Backwaters.
 * @param {number} [waterLevel=0]
 * @returns {THREE.Group}
 */
export function buildCortezDockWaterEffects(waterLevel = 0) {
    const { dockLength, dockCenterZ, deckFrontZ } = getStylizedDockLocalMetrics(
        DOCK_DEPTH,
        LAKE_DOCK_PLANK_COUNT
    );

    const root = new THREE.Group();
    root.name = 'cortezDockWater';
    root.position.set(0, 0, DOCK_GROUP_Z);

    const lapping = createDockLappingWater({
        dockWidth: DOCK_WIDTH,
        dockLength,
        waterLevel,
        dockCenterZ,
        sideGap: 0.03,
        stripWidth: 0.7,
        color: 0x87beb2,
        opacity: 0.35
    });

    const endLap = createDockEndLap({
        dockWidth: DOCK_WIDTH,
        waterLevel,
        dockEndZ: deckFrontZ,
        color: 0x87beb2
    });

    const wetEdges = createWetDockEdges({
        dockWidth: DOCK_WIDTH,
        dockLength,
        waterLevel,
        dockCenterZ
    });

    root.add(lapping, endLap, wetEdges);

    root.userData.update = (deltaTime) => {
        lapping.userData.update?.(deltaTime);
        endLap.userData.update?.(deltaTime);
    };

    return root;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} [waterLevel=0]
 * @returns {THREE.Group}
 */
export function createCortezDockWaterEffects(scene, waterLevel = 0) {
    const root = buildCortezDockWaterEffects(waterLevel);
    root.visible = false;
    scene.add(root);
    return root;
}

/**
 * @param {THREE.Group | null} group
 * @param {boolean} visible
 */
export function syncCortezDockWaterVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}
