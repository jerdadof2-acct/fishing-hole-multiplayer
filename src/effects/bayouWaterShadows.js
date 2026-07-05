import * as THREE from 'three';
import { GROUND_SIZE } from '../buildLakeMask.js';

/** Slightly above the water mesh so the receiver draws on top (renderOrder 4). */
const RECEIVER_Y_OFFSET = 0.028;
const RECEIVER_RENDER_ORDER = 4;
/** Above log wood so sun-shadow decals draw on the hull. */
export const BAYOU_LOG_SHADOW_RENDER_ORDER = 5;

/** Shared bayou key-light shadow look — water plane and log hull receivers. */
export function createBayouSunShadowMaterial() {
    return new THREE.ShadowMaterial({
        transparent: true,
        opacity: 0.42,
        color: 0x050807,
        depthWrite: false
    });
}

/**
 * A single shadow-catching plane on the bayou water surface.
 * Uses the same directional-light shadow map as Halley and the boat, so every
 * shadow is parallel and sun-aligned — fake per-object decals were inconsistent.
 */
export function createBayouWaterShadows(scene, {
    waterLevel = 0,
    groundSize = GROUND_SIZE
} = {}) {
    const root = new THREE.Group();
    root.name = 'bayouWaterShadows';
    root.frustumCulled = false;

    const material = createBayouSunShadowMaterial();

    const receiver = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize, groundSize),
        material
    );
    receiver.name = 'bayouShadowReceiver';
    receiver.rotation.x = -Math.PI / 2;
    receiver.position.y = waterLevel + RECEIVER_Y_OFFSET;
    receiver.receiveShadow = true;
    receiver.renderOrder = RECEIVER_RENDER_ORDER;
    receiver.frustumCulled = false;

    root.add(receiver);
    root.visible = false;
    scene.add(root);
    return root;
}

export function syncBayouWaterShadowsVisibility(group, visible) {
    if (group) {
        group.visible = visible === true;
    }
}

export function updateBayouWaterShadows(group, isBayou) {
    syncBayouWaterShadowsVisibility(group, isBayou);
}
