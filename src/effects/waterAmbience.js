import * as THREE from 'three';

function createFishShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(28, 32, 38, 0.55)');
    gradient.addColorStop(0.55, 'rgba(28, 32, 38, 0.22)');
    gradient.addColorStop(1, 'rgba(28, 32, 38, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

/** Dark ellipse under the fish — visible while the mesh stays hidden during fights. */
export function createFishShadowSprite(scene) {
    const material = new THREE.SpriteMaterial({
        map: createFishShadowTexture(),
        transparent: true,
        opacity: 0.4,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.renderOrder = 3;
    sprite.scale.set(1.4, 1.0, 1);
    scene.add(sprite);
    return sprite;
}

export function updateFishShadowSprite(shadow, fishPosition, waterY = 0, visible = false) {
    if (!shadow) return;
    shadow.visible = visible;
    if (!visible) return;
    shadow.position.set(fishPosition.x, waterY + 0.02, fishPosition.z);
}

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
