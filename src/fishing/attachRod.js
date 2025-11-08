import * as THREE from "three";

// Attach rod to hand with pivot for consistent rotation
export function attachRodToHand(cat, rodMesh, handBone) {
    // 1) Make a pivot so we can rotate/aim without touching the raw mesh
    const rodPivot = new THREE.Object3D();
    rodPivot.name = "RodPivot";
    handBone.add(rodPivot);

    // 2) Move pivot to where the character grips the rod (adjust once)
    // If your rod holds at its origin already, leave at (0,0,0).
    rodPivot.position.set(0.03, 0.02, 0.0); // tweak as needed

    // 3) Put the rod under the pivot
    rodPivot.add(rodMesh);

    // 4) Initial scale and a one-time "model correction" so +Y (or +Z) becomes the rod's length axis.
    // Try these options if the rod doesn't aim correctly:
    const modelCorrection = new THREE.Quaternion();
    
    // OPTION 1: Rod length along +Z originally (default - most common)
    // +Z -> +Y
    modelCorrection.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    
    // OPTION 2: Rod length along -Z originally
    // Uncomment this and comment Option 1 if rod points backward:
    // modelCorrection.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    
    // OPTION 3: Rod length along +X originally
    // Uncomment this and comment Option 1 if rod points sideways:
    // modelCorrection.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    
    // OPTION 4: Rod length along -X originally
    // Uncomment this and comment Option 1 if rod points opposite sideways:
    // modelCorrection.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    
    // OPTION 5: Rod length already along +Y (no correction needed)
    // Uncomment this and comment Option 1 if rod is already correct:
    // modelCorrection.identity(); // No correction needed
    
    rodMesh.quaternion.premultiply(modelCorrection);

    // Optional: tiny visual offsets to sit nicer in the paw
    rodMesh.position.set(0, 0, 0);
    // rodMesh.rotateZ(0.05); // micro twist if needed

    // Expose pivot for the aiming function
    rodMesh.userData.pivot = rodPivot;
    
    // QoL: Small shoulder offset so rod leans slightly to screen-right (feels more natural)
    rodPivot.rotateY(THREE.MathUtils.degToRad(5));
    
    return rodPivot;
}

