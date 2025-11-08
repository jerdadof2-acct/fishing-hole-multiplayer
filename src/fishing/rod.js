// src/fishing/rod.js

import * as THREE from "three";

// Module-level state for rod tip animation
let tipVel = 0;
let tipAngle = 0;

export function updateRodTip(rod, tension, dt) {
    // Small spring toward a target angle driven by tension
    const target = THREE.MathUtils.clamp(tension * 0.15, 0, 0.28);
    const k = 30;
    const c = 6;
    const acc = (target - tipAngle) * k - tipVel * c;
    tipVel += acc * dt;
    tipAngle += tipVel * dt;

    // Apply to the tip bone or fallback to rod mesh rotation
    if (rod.tipBone) {
        // GLB rod with bone
        rod.tipBone.rotation.x = -tipAngle;
    } else if (rod.tempRodTip) {
        // Temp rod - apply to tip object or parent
        // Temp rod tip is the actual tip object, rotate it slightly
        if (rod.tempRodTip.parent) {
            // Rotate the parent (blank2 section that holds the tip)
            rod.tempRodTip.parent.rotation.x = -tipAngle * 0.4;
        }
    } else if (rod.rodModel) {
        // Fallback: apply reduced rotation to entire rod model
        rod.rodModel.rotation.x = -tipAngle * 0.6;
    }
}

