import * as THREE from "three";

// Aim the rod forward with a 45° tilt above the water
const _tmpV = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function aimRodForwardAt45(catRoot, rodMesh, opts = {}) {
    const tiltDeg = opts.tiltDeg ?? 45; // desired angle above water plane
    const tilt = THREE.MathUtils.degToRad(tiltDeg);

    // 1) Get the cat's forward (on XZ only)
    // Cat forward is usually +Z in model space, but we want world forward.
    // We'll take the cat's world matrix and transform a forward basis vector.
    const catForwardWorld = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(catRoot.getWorldQuaternion(new THREE.Quaternion()));
    catForwardWorld.y = 0;
    if (catForwardWorld.lengthSq() < 1e-6) catForwardWorld.set(0, 0, 1);
    catForwardWorld.normalize();

    // 2) Build a 45° elevated direction: d = normalize( forward*cos + up*sin )
    const d = _tmpV.copy(catForwardWorld).multiplyScalar(Math.cos(tilt)).addScaledVector(_up, Math.sin(tilt)).normalize();

    // 3) Align the rod's length axis (+Y) to d
    // We do this by rotating the pivot (not the mesh), so hand animation stays intact.
    const pivot = rodMesh.userData.pivot || rodMesh.parent;
    if (!pivot) return; // Safety check

    let q = new THREE.Quaternion();

    // Compute quaternion to rotate +Y to d
    const from = new THREE.Vector3(0, 1, 0); // rod length axis after modelCorrection
    const axis = new THREE.Vector3().crossVectors(from, d);
    const dot = THREE.MathUtils.clamp(from.dot(d), -1, 1);
    const eps = 1e-6;
    if (axis.lengthSq() < eps && dot < 0) {
        // Opposite direction: 180 around any perpendicular axis, use X
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    } else {
        q.setFromUnitVectors(from, d);
    }

    // 4) Optional azimuth bias: if the rod points slightly off center, add a tiny yaw
    // q.multiply(new THREE.Quaternion().setFromAxisAngle(_up, THREE.MathUtils.degToRad(5)));

    // 4.5) Force a 180° flip around up to correct backward aim (rod tip now faces forward, not backward)
    // This fixes the rod consistently ending up 180° backward due to model's forward axis vs aiming math
    q = q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));

    pivot.quaternion.copy(q);
    
    // 6) Apply micro sway while idle (if provided in opts)
    // Increased sway amplitude for more visible movement
    if (opts.addMicroSway && !opts.isActive) {
        const t = performance.now() * 0.001;
        // More visible sway - increased amplitude from 0.002 to 0.008 (4x more visible)
        // Multiple frequencies for natural, organic movement
        const sway1 = Math.sin(t * 1.2) * 0.008; // Primary slow sway
        const sway2 = Math.sin(t * 2.1) * 0.004; // Secondary faster component
        const sway3 = Math.sin(t * 0.8) * 0.003; // Slow drift component
        const microSway = sway1 + sway2 + sway3; // Combined sway for natural movement
        
        // Apply Z-axis rotation (side-to-side sway)
        const swayQuatZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), microSway);
        pivot.quaternion.multiply(swayQuatZ);
        
        // Add slight X-axis rotation (front-back gentle nod) for more organic feel
        const nod = Math.sin(t * 0.9) * 0.003;
        const nodQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), nod);
        pivot.quaternion.multiply(nodQuat);
    }

    // 5) Flip 180° if it still looks backwards (depends on your mesh handedness)
    // pivot.rotateY(Math.PI); // uncomment if it still leans back
}

