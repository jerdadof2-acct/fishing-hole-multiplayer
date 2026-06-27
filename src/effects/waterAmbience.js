import * as THREE from 'three';

/**
 * Scrolling caustics on the lake bed (additive plane just under the surface).
 * World-space UVs + dual-layer soft blend hide tile seams and axis-aligned lines.
 * @param {object} scene
 * @param {number} groundSize
 * @param {number} waterY
 * @param {{ skipOnMobile?: boolean, excludeBounds?: import('three').Vector4, lakeMask?: THREE.Texture }} [options]
 */
export function createCausticsLayer(scene, groundSize, waterY, options = {}) {
    const isMobile = typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (options.skipOnMobile && isMobile) {
        return null;
    }

    const loader = new THREE.TextureLoader();
    const texPath = isMobile
        ? '/assets/textures/caustics_loop-sm.jpg'
        : '/assets/textures/caustics_loop.jpg';
    const texture = loader.load(
        texPath,
        (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = true;
        },
        undefined,
        () => loader.load('/assets/textures/caustics_loop-sm.jpg', (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        })
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

    const lakeMask = options.lakeMask || null;
    const excludeBounds = options.excludeBounds || null;
    const rot = 0.27;
    const defaultOpacity = isMobile ? 0.22 : 0.34;

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uMap: { value: texture },
            uOffset1: { value: new THREE.Vector2(0.19, 0.33) },
            uOffset2: { value: new THREE.Vector2(0.47, 0.11) },
            uOpacity: { value: defaultOpacity },
            uMask: { value: lakeMask },
            uHasMask: { value: lakeMask ? 1.0 : 0.0 },
            uExcludeBounds: { value: excludeBounds || new THREE.Vector4() },
            uHasExclude: { value: excludeBounds ? 1.0 : 0.0 },
            uGroundSize: { value: groundSize },
            uWorldScale1: { value: 0.044 },
            uWorldScale2: { value: 0.029 },
            uRotCos: { value: Math.cos(rot) },
            uRotSin: { value: Math.sin(rot) }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform sampler2D uMap;
            uniform sampler2D uMask;
            uniform float uHasMask;
            uniform vec4 uExcludeBounds;
            uniform float uHasExclude;
            uniform float uGroundSize;
            uniform vec2 uOffset1;
            uniform vec2 uOffset2;
            uniform float uOpacity;
            uniform float uWorldScale1;
            uniform float uWorldScale2;
            uniform float uRotCos;
            uniform float uRotSin;
            varying vec3 vWorldPos;

            void main() {
                if (uHasMask > 0.5) {
                    vec2 maskUv = vec2(
                        vWorldPos.x / uGroundSize + 0.5,
                        1.0 - (vWorldPos.z / uGroundSize + 0.5)
                    );
                    if (texture2D(uMask, maskUv).r < 0.42) {
                        discard;
                    }
                }

                if (uHasExclude > 0.5) {
                    if (
                        vWorldPos.x > uExcludeBounds.x &&
                        vWorldPos.x < uExcludeBounds.y &&
                        vWorldPos.z > uExcludeBounds.z &&
                        vWorldPos.z < uExcludeBounds.w
                    ) {
                        discard;
                    }
                }

                vec2 wp = vWorldPos.xz;
                vec2 rot = vec2(
                    wp.x * uRotCos - wp.y * uRotSin,
                    wp.x * uRotSin + wp.y * uRotCos
                );

                vec2 uv1 = rot * uWorldScale1 + uOffset1;
                vec2 uv2 = rot * uWorldScale2 + uOffset2;
                float c1 = texture2D(uMap, uv1).r;
                float c2 = texture2D(uMap, uv2).r;
                float c3 = texture2D(uMap, uv1 + vec2(0.012, -0.009)).r;
                float c4 = texture2D(uMap, uv2 + vec2(-0.008, 0.011)).r;
                float blended = c1 * 0.34 + c2 * 0.3 + c3 * 0.2 + c4 * 0.16;
                float soft = smoothstep(0.14, 0.76, blended);
                soft = pow(soft, 1.5);
                vec3 tint = vec3(0.76, 0.91, 1.0);
                gl_FragColor = vec4(tint, soft * uOpacity);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize * 0.92, groundSize * 0.92),
        material
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = waterY - 0.035;
    mesh.renderOrder = -1;
    mesh.name = 'WaterCaustics';
    mesh.userData.scrollSpeed1 = new THREE.Vector2(0.00038, 0.00024);
    mesh.userData.scrollSpeed2 = new THREE.Vector2(-0.00022, 0.00034);
    mesh.userData.causticsMode = 'default';
    scene.add(mesh);
    return mesh;
}

/** Tune caustics for Coral Kingdoms reef — fewer seams, no axis line through boat. */
export function setCausticsLayerMode(causticsMesh, mode = 'default') {
    const mat = causticsMesh?.material;
    if (!mat?.uniforms) return;

    const isMobile = typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    causticsMesh.userData.causticsMode = mode;

    if (mode === 'reef') {
        const rot = 0.41;
        mat.uniforms.uOpacity.value = isMobile ? 0.16 : 0.21;
        mat.uniforms.uWorldScale1.value = 0.028;
        mat.uniforms.uWorldScale2.value = 0.019;
        mat.uniforms.uRotCos.value = Math.cos(rot);
        mat.uniforms.uRotSin.value = Math.sin(rot);
        mat.uniforms.uOffset1.value.set(0.53, 0.21);
        mat.uniforms.uOffset2.value.set(0.17, 0.64);
    } else {
        const rot = 0.27;
        mat.uniforms.uOpacity.value = isMobile ? 0.22 : 0.34;
        mat.uniforms.uWorldScale1.value = 0.044;
        mat.uniforms.uWorldScale2.value = 0.029;
        mat.uniforms.uRotCos.value = Math.cos(rot);
        mat.uniforms.uRotSin.value = Math.sin(rot);
        mat.uniforms.uOffset1.value.set(0.19, 0.33);
        mat.uniforms.uOffset2.value.set(0.47, 0.11);
    }
}

export function tickCausticsLayer(causticsMesh, delta) {
    const uniforms = causticsMesh?.material?.uniforms;
    if (!uniforms?.uOffset1) return;

    const s1 = causticsMesh.userData.scrollSpeed1;
    const s2 = causticsMesh.userData.scrollSpeed2;
    const dt = delta * 60;
    uniforms.uOffset1.value.x += s1.x * dt;
    uniforms.uOffset1.value.y += s1.y * dt;
    uniforms.uOffset2.value.x += s2.x * dt;
    uniforms.uOffset2.value.y += s2.y * dt;
}

/**
 * Occasional distant splashes — ring expands at a random lake spot.
 */
export function createAmbientSplashRings(scene, waterY, count = 5) {
    const rings = [];
    const material = new THREE.MeshBasicMaterial({
        color: 0xddeeff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    for (let i = 0; i < count; i++) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.08, 0.14, 24),
            material.clone()
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = waterY + 0.015;
        ring.visible = false;
        ring.userData = { age: 999, lifetime: 1.8 };
        scene.add(ring);
        rings.push(ring);
    }

    return {
        rings,
        timer: 10 + Math.random() * 8,
        intervalMin: 14,
        intervalMax: 28
    };
}

export function tickAmbientSplashes(ambience, delta, water, splashAt) {
    if (!ambience?.rings?.length || !water) return;

    ambience.timer -= delta;
    if (ambience.timer <= 0) {
        const spot = water.getRandomSpot?.();
        if (spot) {
            const free = ambience.rings.find((r) => !r.visible || r.userData.age >= r.userData.lifetime);
            if (free) {
                free.position.x = spot.x;
                free.position.z = spot.z;
                free.scale.set(1, 1, 1);
                free.material.opacity = 0.55;
                free.visible = true;
                free.userData.age = 0;
                splashAt?.(spot.x, spot.z);
            }
        }
        ambience.timer = ambience.intervalMin
            + Math.random() * (ambience.intervalMax - ambience.intervalMin);
    }

    ambience.rings.forEach((ring) => {
        if (!ring.visible) return;
        ring.userData.age += delta;
        ring.scale.multiplyScalar(1 + delta * 1.8);
        ring.material.opacity = Math.max(0, 0.55 - ring.userData.age * 0.35);
        if (ring.userData.age >= ring.userData.lifetime) {
            ring.visible = false;
            ring.userData.age = ring.userData.lifetime;
        }
    });
}

let sharedSparkleTexture = null;

function createSparkleTexture() {
    if (sharedSparkleTexture) {
        return sharedSparkleTexture;
    }

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size * 0.5;
    const cy = size * 0.5;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.4, 'rgba(210, 240, 255, 0.45)');
    grad.addColorStop(1, 'rgba(180, 220, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx, cy + 26);
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.stroke();

    sharedSparkleTexture = new THREE.CanvasTexture(canvas);
    sharedSparkleTexture.needsUpdate = true;
    return sharedSparkleTexture;
}

/**
 * Small surface glints — fixed pool, slow fade in/out (never spawns more at runtime).
 * @param {THREE.Scene} scene
 * @param {number} waterY
 * @param {{ count?: number }} [options]
 */
export function createWaterSparkles(scene, waterY, options = {}) {
    const isMobile = typeof navigator !== 'undefined'
        && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const count = Math.min(20, Math.max(10, options.count ?? (isMobile ? 10 : 16)));
    const texture = createSparkleTexture();
    const sparkles = [];

    for (let i = 0; i < count; i++) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        const size = 0.14 + Math.random() * 0.2;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.random() * Math.PI * 2;
        mesh.position.y = waterY + 0.022;
        mesh.renderOrder = 11;
        mesh.frustumCulled = false;
        mesh.name = 'water-sparkle';
        mesh.userData = {
            phase: Math.random(),
            cycleSpeed: 0.035 + Math.random() * 0.045,
            maxOpacity: 0.28 + Math.random() * 0.38,
            driftAmpX: 0.04 + Math.random() * 0.12,
            driftAmpZ: 0.04 + Math.random() * 0.12,
            driftFreq: 0.18 + Math.random() * 0.22,
            driftPhase: Math.random() * Math.PI * 2,
            baseX: 0,
            baseZ: 0
        };
        scene.add(mesh);
        sparkles.push(mesh);
    }

    return {
        sparkles,
        waterY,
        placed: false,
        time: 0
    };
}

/** One-time scatter across open water (fixed count — no runtime spawn). */
export function placeWaterSparkles(system, water) {
    if (!system?.sparkles?.length || system.placed || !water?.getRandomSpot) {
        return;
    }

    system.sparkles.forEach((sparkle) => {
        const spot = water.getRandomSpot();
        if (!spot) {
            return;
        }
        sparkle.userData.baseX = spot.x;
        sparkle.userData.baseZ = spot.z;
        sparkle.position.x = spot.x;
        sparkle.position.z = spot.z;
    });
    system.placed = true;
}

export function tickWaterSparkles(system, delta, water) {
    if (!system?.sparkles?.length) {
        return;
    }

    if (!system.placed) {
        placeWaterSparkles(system, water);
    }

    system.time = (system.time || 0) + delta;
    const baseY = system.waterY ?? water?.waterY ?? 0;

    system.sparkles.forEach((sparkle) => {
        const ud = sparkle.userData;
        ud.phase = (ud.phase + delta * ud.cycleSpeed) % 1;

        const envelope = Math.sin(ud.phase * Math.PI);
        const pulse = envelope * envelope;
        sparkle.material.opacity = ud.maxOpacity * pulse;

        const driftT = system.time * ud.driftFreq + ud.driftPhase;
        sparkle.position.x = ud.baseX + Math.sin(driftT) * ud.driftAmpX;
        sparkle.position.z = ud.baseZ + Math.cos(driftT * 0.87) * ud.driftAmpZ;
        sparkle.position.y = (water?.getWaterHeight?.(sparkle.position.x, sparkle.position.z) ?? baseY) + 0.022;

        sparkle.visible = sparkle.material.opacity > 0.015;
    });
}
