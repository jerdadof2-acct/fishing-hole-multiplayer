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
    this.portraitBlend = 0;
    this.gameplayOffset = this.offset.clone();
    this.portraitOffset = opts.portraitOffset?.clone() || new THREE.Vector3(0, 2.0, -4.5);
    this.gameplayLookAtOffset = opts.lookAtOffset?.clone() || new THREE.Vector3(0, 1.5, 4);
    this.getPortraitLookAt = opts.getPortraitLookAt || null;
    this._offsetScratch = new THREE.Vector3();
    this._lookAtScratch = new THREE.Vector3();
  }

  update(dt) {
    const target = this.getTarget();
    const blend = this.portraitBlend;
    this._offsetScratch.copy(this.gameplayOffset).lerp(this.portraitOffset, blend);
    const tgt = target.clone().add(this._offsetScratch);
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
    let lookAtTarget;
    if (this.getLookAtTarget) {
      lookAtTarget = this.getLookAtTarget().clone();
    } else {
      this._lookAtScratch.copy(target).add(this.gameplayLookAtOffset);
      lookAtTarget = this._lookAtScratch;
    }

    if (blend > 0.001 && this.getPortraitLookAt) {
      const portraitLook = this.getPortraitLookAt();
      if (portraitLook) {
        lookAtTarget = lookAtTarget.clone().lerp(portraitLook, blend);
      }
    }

    this.camera.lookAt(lookAtTarget);
  }
}

