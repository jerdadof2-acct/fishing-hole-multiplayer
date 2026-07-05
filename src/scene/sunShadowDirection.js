import * as THREE from 'three';

/**
 * Exterior side where sun shadows fall (+1 = +X right).
 * Matches DirectionalLight at (-10, 20, 10) in scene.js — Halley and dock shadows.
 */
export const SUN_SHADOW_EXTERIOR_X = 1;

/** Default orthographic half-extent for the key-light shadow frustum. */
export const SUN_SHADOW_ORTHO_DEFAULT = 20;

/** Wider frustum for Louisiana Bayou — cypress and logs sit outside the dock footprint. */
export const SUN_SHADOW_ORTHO_BAYOU = 72;

export const SUN_DIRECTIONAL_POSITION = new THREE.Vector3(-10, 20, 10);

/** World point the key light looks at — keeps shadow direction stable over the dock. */
export const SUN_DIRECTIONAL_TARGET = new THREE.Vector3(0, 0, 4);

const _sunLightDir = new THREE.Vector3()
    .subVectors(SUN_DIRECTIONAL_TARGET, SUN_DIRECTIONAL_POSITION);
const _sunLightHeight = Math.abs(_sunLightDir.y);

/**
 * Horizontal direction shadows fall on the water / ground (same as the key light).
 * Unit vector on XZ — toward +X and -Z for the default dock sun.
 */
export const SUN_SHADOW_GROUND_DIR = new THREE.Vector3(
    _sunLightDir.x,
    0,
    _sunLightDir.z
).normalize();

/** Y rotation for flat shadow quads: local depth axis → {@link SUN_SHADOW_GROUND_DIR}. */
export const SUN_SHADOW_FALL_ANGLE_Y = Math.atan2(
    SUN_SHADOW_GROUND_DIR.x,
    SUN_SHADOW_GROUND_DIR.z
);

/**
 * Offset a ground/water shadow from its caster base, scaled by caster height.
 * @param {number} casterHeight
 * @param {THREE.Vector3} [target]
 */
export function offsetSunShadowOnGround(casterHeight, target = new THREE.Vector3()) {
    const scale = casterHeight / _sunLightHeight;
    return target.set(
        _sunLightDir.x * scale,
        0,
        _sunLightDir.z * scale
    );
}

/**
 * @param {THREE.DirectionalLight | null | undefined} light
 * @param {number} halfExtent
 */
export function applySunShadowCameraBounds(light, halfExtent = SUN_SHADOW_ORTHO_DEFAULT) {
    const camera = light?.shadow?.camera;
    if (!camera) {
        return;
    }

    camera.left = -halfExtent;
    camera.right = halfExtent;
    camera.top = halfExtent;
    camera.bottom = -halfExtent;
    camera.updateProjectionMatrix();
}
