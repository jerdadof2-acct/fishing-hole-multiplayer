// src/camera/cameraSpring.js

import * as THREE from "three";

// Smooth follow with critically-damped spring
export class CameraSpring {
  constructor(camera, targetGetter, opts = {}) {
    this.camera = camera;
    this.getTarget = targetGetter; // () => THREE.Vector3
    this.offset = opts.offset || new THREE.Vector3(0, 2.2, 4.2);
    this.stiffness = opts.stiffness ?? 60;
    this.damping = opts.damping ?? 12;
    this.vel = new THREE.Vector3();
  }

  update(dt) {
    const target = this.getTarget();
    const tgt = target.clone().add(this.offset);
    const pos = this.camera.position;
    
    // Safety check: ensure camera is above water (y > 0)
    // If target would put camera underwater, clamp Y to minimum height
    if (tgt.y < 2) {
      console.warn('Camera spring target too low, clamping Y to 2');
      tgt.y = 2;
    }
    
    const x = pos.clone();
    const a = tgt.clone().sub(x).multiplyScalar(this.stiffness);

    // damping
    a.add(this.vel.clone().multiplyScalar(-this.damping));

    // integrate
    this.vel.addScaledVector(a, dt);
    pos.addScaledVector(this.vel, dt);
    
    // Safety check: ensure camera stays above water after update
    if (pos.y < 1) {
      console.warn('Camera moved underwater, clamping to y=1');
      pos.y = 1;
      this.vel.y = 0; // Stop downward velocity
    }

    // look at target point (can be customized via getLookAtTarget if provided)
    const lookAtTarget = this.getLookAtTarget ? this.getLookAtTarget() : target;
    this.camera.lookAt(lookAtTarget);
  }
}

