import * as THREE from 'three';

export class Land {
    constructor(scene) {
        this.sceneRef = scene;
        this.land = null;
    }

    create() {
        // Create land/shore geometry
        // Land should extend as far as the water does (match water bounds)
        // Water bounds: minX: -8, maxX: 8, minZ: -8, maxZ: 6
        // Land extends from water's back edge (z = -8) backward and matches width
        
        const landWidth = 16; // Match water width (8 - (-8) = 16)
        const landDepth = 8;  // Extend backward from water edge
        
        const geometry = new THREE.PlaneGeometry(landWidth, landDepth);
        
        // Create ground material
        const material = new THREE.MeshStandardMaterial({
            color: 0x4a6741, // Green/brown ground color
            roughness: 0.8,
            metalness: 0.1
        });

        this.land = new THREE.Mesh(geometry, material);
        this.land.rotation.x = -Math.PI / 2;
        // Position land at water's back edge (z = -8), centered on X, extending backward
        this.land.position.set(0, -0.1, -8 - landDepth/2); // Position so it extends from z=-8 backward
        this.land.receiveShadow = true;
        this.sceneRef.scene.add(this.land);
    }

    getLandPosition() {
        return this.land.position;
    }
}

