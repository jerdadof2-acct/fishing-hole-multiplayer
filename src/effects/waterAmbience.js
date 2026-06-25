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
 * @param {object} scene
 * @param {number} groundSize
 * @param {number} waterY
 * @param {{ skipOnMobile?: boolean, excludeBounds?: import('three').Vector4 }} [options]
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
        undefined,
        undefined,
        () => loader.load('/assets/textures/caustics_loop.jpg')
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);

    const excludeBounds = options.excludeBounds || null;
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: isMobile ? 0.18 : 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true
    });

    if (excludeBounds) {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uExcludeBounds = { value: excludeBounds };
            shader.vertexShader = `varying vec3 vCausticsWorldPos;\n${shader.vertexShader}`;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vCausticsWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );
            shader.fragmentShader = `varying vec3 vCausticsWorldPos;\nuniform vec4 uExcludeBounds;\n${shader.fragmentShader}`;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#include <map_fragment>
                if (
                    vCausticsWorldPos.x > uExcludeBounds.x &&
                    vCausticsWorldPos.x < uExcludeBounds.y &&
                    vCausticsWorldPos.z > uExcludeBounds.z &&
                    vCausticsWorldPos.z < uExcludeBounds.w
                ) {
                    discard;
                }`
            );
        };
        material.customProgramCacheKey = () => 'caustics-dock-exclude';
    }

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize * 0.92, groundSize * 0.92),
        material
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = waterY - 0.035;
    mesh.renderOrder = -1;
    mesh.name = 'WaterCaustics';
    mesh.userData.scrollSpeed = new THREE.Vector2(0.0005, 0.0003);
    scene.add(mesh);
    return mesh;
}

export function tickCausticsLayer(causticsMesh, delta) {
    if (!causticsMesh?.material?.map) return;
    const speed = causticsMesh.userData.scrollSpeed;
    const map = causticsMesh.material.map;
    map.offset.x += speed.x * delta * 60;
    map.offset.y += speed.y * delta * 60;
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
