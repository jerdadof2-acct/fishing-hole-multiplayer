/**
 * LOCKED idle portrait camera + cat facing settings.
 *
 * Verified working: 2026-06-21
 * Restore git reference: commit 54a151a ("Keep cat lake-facing during fishing; portrait turn only while idle.")
 * Full behavior spec: DOCS/idle-portrait-camera-locked.md
 *
 * Do not change these values without re-testing:
 * - Cat faces lake during cast, reel, fight, and bobber tracking
 * - After ~28s idle on Game tab, camera pans to face; cat turns toward camera only then
 * - Any input cancels portrait and restores lake-facing immediately
 */
import * as THREE from 'three';

/** Git commit hash when this configuration was last verified. */
export const IDLE_PORTRAIT_LOCKED_COMMIT = '54a151a';

// --- Cat dock facing (lake) ---
/** Anchor Y rotation while fishing. GLB bind pose forward is -Z; 0 = faces lake. */
export const CAT_FACING_Y = 0;

// --- Idle portrait timing ---
/** Seconds of no input before portrait mode may activate. */
export const IDLE_PORTRAIT_DELAY_SEC = 28;

// --- Camera positions (offset from cat saved position) ---
export const GAMEPLAY_CAMERA_OFFSET = new THREE.Vector3(0, 16, -12);
export const PORTRAIT_CAMERA_OFFSET = new THREE.Vector3(0, 2.05, -4.2);
export const GAMEPLAY_LOOK_AT_OFFSET = new THREE.Vector3(0, 1.5, 4);

// --- Portrait blend ---
export const PORTRAIT_BLEND_SPEED = 1.4;
export const CAMERA_SPRING_STIFFNESS = 60;
export const CAMERA_SPRING_DAMPING = 12;
/** Spring stiffness scales down as portrait blend increases: stiffness * (1 - blend * factor). */
export const PORTRAIT_SPRING_STIFFNESS_BLEND_FACTOR = 0.35;

// --- Cat portrait turn (only when _portraitIdleActive) ---
export const PORTRAIT_CAT_TURN_RADIANS = Math.PI;
export const PORTRAIT_CAT_TURN_SPEED_MIN = 4;
export const PORTRAIT_CAT_TURN_SPEED_BLEND_SCALE = 4;
export const PORTRAIT_BLEND_ACTIVE_THRESHOLD = 0.001;
/** Below this blend, bobber tracking may override idle facing. */
export const PORTRAIT_BOBBER_TRACKING_CUTOFF = 0.05;
