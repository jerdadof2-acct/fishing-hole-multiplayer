import * as THREE from 'three';

const PUFF_GEOMETRY = new THREE.SphereGeometry(1, 14, 10);

const FLUFFY_CLOUD_VERTEX = `
    varying vec3 vLocalPos;
    varying vec3 vWorldPos;

    void main() {
        vLocalPos = position;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const FLUFFY_CLOUD_FRAGMENT = `
    uniform vec3 cloudColor;
    uniform float puffOpacity;
    uniform float noiseSeed;

    varying vec3 vLocalPos;
    varying vec3 vWorldPos;

    float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.17, 0.31, 0.47));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }

    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);

        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);

        return mix(nxy0, nxy1, f.z);
    }

    float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p = p * 2.08 + vec3(1.9, 2.4, 1.1);
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        float radius = length(vLocalPos);
        // Fade only the outer shell — verts live at r≈1.0 on the unit sphere.
        float body = 1.0 - smoothstep(0.68, 1.14, radius);
        body = pow(max(body, 0.0), 1.05);

        float fluff = fbm(vWorldPos * 0.18 + vec3(noiseSeed, noiseSeed * 0.61, noiseSeed * 1.37));
        float edgeNoise = smoothstep(0.22, 0.92, fluff);
        float irregular = mix(0.48, 0.92, edgeNoise);

        float alpha = clamp(body * irregular * puffOpacity, 0.0, 0.24);

        gl_FragColor = vec4(cloudColor, alpha);
    }
`;

function createSkyGradientMaterial() {
    return new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: true,
        fog: false,
        side: THREE.DoubleSide,
        uniforms: {
            topColor: { value: new THREE.Color(0xcfeeff) },
            bottomColor: { value: new THREE.Color(0x95cfff) }
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec2 vUv;

            void main() {
                float t = smoothstep(0.0, 1.0, vUv.y);
                vec3 color = mix(bottomColor, topColor, t);
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
}

const PUFF_OPACITY_GAIN = 0.52;

function createFluffyPuffMaterial(opacity, noiseSeed) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
            cloudColor: { value: new THREE.Color(0xf6fbff) },
            puffOpacity: { value: Math.min(0.32, opacity * PUFF_OPACITY_GAIN) },
            noiseSeed: { value: noiseSeed }
        },
        vertexShader: FLUFFY_CLOUD_VERTEX,
        fragmentShader: FLUFFY_CLOUD_FRAGMENT
    });
}

/** Each cloud is a cluster of overlapping soft puffs with irregular silhouettes. */
const CLOUD_SLOTS = [
    {
        x: -18, y: 17, z: 114,
        portraitX: -12, portraitY: 10.2, portraitZ: 82,
        puffs: [
            { px: 0, py: 0.2, pz: 0, sx: 4.8, sy: 2.2, sz: 3.2, op: 0.38, seed: 1.2 },
            { px: -3.2, py: -0.1, pz: 0.8, sx: 3.5, sy: 1.8, sz: 2.6, op: 0.32, seed: 2.8 },
            { px: 2.8, py: 0.35, pz: -0.4, sx: 3.8, sy: 1.9, sz: 2.8, op: 0.34, seed: 4.1 },
            { px: -1.1, py: 0.55, pz: -1.0, sx: 2.9, sy: 1.6, sz: 2.2, op: 0.28, seed: 5.6 },
            { px: 1.4, py: -0.25, pz: 1.2, sx: 3.0, sy: 1.5, sz: 2.3, op: 0.3, seed: 6.9 }
        ]
    },
    {
        x: 10, y: 19, z: 118,
        portraitX: 7, portraitY: 10.8, portraitZ: 85,
        puffs: [
            { px: 0, py: 0, pz: 0, sx: 5.6, sy: 2.4, sz: 4.0, op: 0.4, seed: 2.1 },
            { px: 3.6, py: 0.4, pz: 0.6, sx: 4.1, sy: 2.0, sz: 3.0, op: 0.34, seed: 3.4 },
            { px: -3.0, py: 0.15, pz: -0.5, sx: 3.7, sy: 1.8, sz: 2.7, op: 0.32, seed: 7.2 },
            { px: 0.8, py: 0.7, pz: 1.1, sx: 3.2, sy: 1.6, sz: 2.4, op: 0.28, seed: 8.5 },
            { px: -1.6, py: -0.35, pz: 1.0, sx: 3.2, sy: 1.7, sz: 2.5, op: 0.3, seed: 9.8 },
            { px: 2.2, py: -0.2, pz: -1.2, sx: 2.8, sy: 1.4, sz: 2.1, op: 0.26, seed: 11.1 }
        ]
    },
    {
        x: -4, y: 18, z: 116,
        portraitX: -2, portraitY: 9.8, portraitZ: 84,
        puffs: [
            { px: 0, py: 0.1, pz: 0, sx: 4.4, sy: 2.0, sz: 3.1, op: 0.36, seed: 3.3 },
            { px: -2.4, py: 0.45, pz: 0.5, sx: 3.3, sy: 1.7, sz: 2.4, op: 0.3, seed: 4.7 },
            { px: 2.1, py: -0.15, pz: -0.7, sx: 3.5, sy: 1.6, sz: 2.6, op: 0.32, seed: 6.2 },
            { px: 0.5, py: 0.55, pz: 1.0, sx: 2.7, sy: 1.4, sz: 2.0, op: 0.26, seed: 8.0 }
        ]
    },
    {
        x: 22, y: 17.5, z: 115,
        portraitX: 11, portraitY: 10.4, portraitZ: 83,
        puffs: [
            { px: 0, py: 0, pz: 0, sx: 4.6, sy: 2.1, sz: 3.3, op: 0.37, seed: 5.1 },
            { px: 2.9, py: 0.25, pz: 0.4, sx: 3.6, sy: 1.8, sz: 2.7, op: 0.32, seed: 6.4 },
            { px: -2.5, py: -0.2, pz: -0.6, sx: 3.4, sy: 1.7, sz: 2.5, op: 0.3, seed: 7.8 },
            { px: -0.8, py: 0.5, pz: 0.9, sx: 3.0, sy: 1.5, sz: 2.2, op: 0.28, seed: 10.2 },
            { px: 1.2, py: -0.35, pz: -1.0, sx: 2.8, sy: 1.4, sz: 2.0, op: 0.25, seed: 12.0 }
        ]
    }
];

const PORTRAIT_CLOUD_SCALE = 1.65;
const GAMEPLAY_CLOUD_SCALE = 1;

function createCloudCluster(slot) {
    const cluster = new THREE.Group();
    cluster.userData.slot = slot;

    for (const puff of slot.puffs) {
        const mesh = new THREE.Mesh(
            PUFF_GEOMETRY,
            createFluffyPuffMaterial(puff.op, puff.seed)
        );

        mesh.position.set(puff.px, puff.py, puff.pz);
        mesh.scale.set(puff.sx, puff.sy, puff.sz);
        mesh.rotation.y = puff.seed * 0.55;
        mesh.rotation.z = puff.seed * 0.18;
        mesh.renderOrder = 50;

        cluster.add(mesh);
    }

    cluster.position.set(slot.x, slot.y, slot.z);
    cluster.scale.setScalar(GAMEPLAY_CLOUD_SCALE);
    return cluster;
}

/**
 * @param {THREE.Scene} scene
 * @returns {THREE.Group}
 */
export function createCrescentPondSky(scene) {
    const root = new THREE.Group();
    root.name = 'crescentPondSky';
    root.visible = false;

    const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(380, 100, 1, 24),
        createSkyGradientMaterial()
    );
    backdrop.position.set(0, 32, 124);
    backdrop.userData.gameplayY = 32;
    backdrop.userData.gameplayZ = 124;
    backdrop.userData.portraitY = 14;
    backdrop.userData.portraitZ = 90;
    backdrop.renderOrder = -20;
    root.add(backdrop);

    for (const slot of CLOUD_SLOTS) {
        root.add(createCloudCluster(slot));
    }

    root.userData.time = 0;

    scene.add(root);
    return root;
}

/**
 * @param {THREE.Group | null} group
 * @param {number} delta
 * @param {number} [portraitBlend]
 */
export function updateCrescentPondSky(group, delta, portraitBlend = 0) {
    if (!group) {
        return;
    }

    group.userData.time = (group.userData.time || 0) + delta;
    const blend = Math.max(0, Math.min(1, portraitBlend));
    const t = group.userData.time;

    group.children.forEach((child, index) => {
        if (index === 0) {
            const gameplayY = child.userData.gameplayY ?? 32;
            const gameplayZ = child.userData.gameplayZ ?? 124;
            const portraitY = child.userData.portraitY ?? 14;
            const portraitZ = child.userData.portraitZ ?? 90;
            child.position.y = THREE.MathUtils.lerp(gameplayY, portraitY, blend);
            child.position.z = THREE.MathUtils.lerp(gameplayZ, portraitZ, blend);
            return;
        }

        const slot = child.userData.slot;
        if (!slot) {
            return;
        }

        const phase = index * 1.6;
        const driftX = Math.sin(t * 0.05 + phase) * 0.35;
        const driftY = Math.sin(t * 0.035 + phase * 1.3) * 0.12;

        const x = THREE.MathUtils.lerp(slot.x, slot.portraitX, blend);
        const y = THREE.MathUtils.lerp(slot.y, slot.portraitY, blend);
        const z = THREE.MathUtils.lerp(slot.z, slot.portraitZ, blend);
        const scale = THREE.MathUtils.lerp(GAMEPLAY_CLOUD_SCALE, PORTRAIT_CLOUD_SCALE, blend);

        child.position.set(x + driftX, y + driftY, z);
        child.scale.setScalar(scale);
    });
}

/**
 * @param {THREE.Group | null} group
 * @param {boolean} visible
 */
export function syncCrescentPondSkyVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}

/**
 * Crescent Pond should use a simple bright sky, not a detailed HDRI-looking background.
 * @param {THREE.Scene} scene
 */
export function applyCrescentPondSkyLook(scene) {
    if (!scene) {
        return;
    }

    scene.background = new THREE.Color(0xb8e2ff);

    if ('backgroundBlurriness' in scene) {
        scene.backgroundBlurriness = 0;
    }

    if ('backgroundIntensity' in scene) {
        scene.backgroundIntensity = 1;
    }

    if (scene.fog) {
        scene.fog.color.setHex(0xc8e8fb);
        scene.fog.near = 70;
        scene.fog.far = 255;
    }
}

/**
 * Restore default look after leaving Crescent Pond.
 * @param {THREE.Scene} scene
 */
export function restoreDefaultSkyLook(scene) {
    if (!scene) {
        return;
    }

    if ('backgroundBlurriness' in scene) {
        scene.backgroundBlurriness = 0.35;
    }

    if ('backgroundIntensity' in scene) {
        scene.backgroundIntensity = 0.9;
    }

    if (scene.fog) {
        scene.fog.color.setHex(0xa8cce8);
        scene.fog.near = 55;
        scene.fog.far = 210;
    }
}
