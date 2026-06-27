import * as THREE from 'three';

/**
 * Exterior side where sun shadows fall (+1 = +X right).
 * Matches DirectionalLight at (-10, 20, 10) in scene.js — Halley and dock shadows.
 */
export const SUN_SHADOW_EXTERIOR_X = 1;

export const SUN_DIRECTIONAL_POSITION = new THREE.Vector3(-10, 20, 10);

/** World point the key light looks at — keeps shadow direction stable over the dock. */
export const SUN_DIRECTIONAL_TARGET = new THREE.Vector3(0, 0, 4);
