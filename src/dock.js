import * as THREE from 'three';

export class Dock {
    constructor(scene, water) {
        this.sceneRef = scene;
        this.water = water;
        this.dock = null;
    }

    create() {
        const bounds = this.water.getBounds();
        const dockWidth = 3;
        const dockDepth = 14; // Extended depth to block water view behind dock
        const dockHeight = 0.3;
        const dockY = 0.2; // Dock sits just above water (y=0)
        
        // Create dock geometry
        const geometry = new THREE.BoxGeometry(dockWidth, dockHeight, dockDepth);
        
        // Create wood texture procedurally
        const textureLoader = new THREE.TextureLoader();
        
        // Create a simple wood-like texture using a canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Wood grain pattern
        ctx.fillStyle = '#8b6f47'; // Base wood color
        ctx.fillRect(0, 0, 256, 256);
        
        // Add wood grain lines
        ctx.strokeStyle = '#6b4f2a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            const y = Math.random() * 256;
            ctx.moveTo(0, y);
            ctx.quadraticCurveTo(128 + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 30, 256, y);
            ctx.stroke();
        }
        
        const woodTexture = new THREE.CanvasTexture(canvas);
        woodTexture.wrapS = THREE.RepeatWrapping;
        woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(1, 5); // Repeat along length
        
        // Create wood material
        const material = new THREE.MeshStandardMaterial({
            map: woodTexture,
            roughness: 0.8,
            metalness: 0.1,
            color: 0x8b6f47
        });

        this.dock = new THREE.Mesh(geometry, material);
        
        // Position dock: extends far back to block water view behind it
        // Dock must protrude from top of screen - camera is at z≈6 looking at z≈0
        // In top-down view, higher Z = closer to camera = top of screen
        // Dock extends 14 units deep (7 units forward and backward from center)
        // Position dock so front edge (water side) is at top of screen
        // Front edge = center.z + dockDepth/2, back edge = center.z - dockDepth/2
        // If front edge should be at z≈5.5 (top of screen), center = 5.5 - 7 = -1.5
        // This places front edge at top, back edge extends backward to block water
        const dockOnLand = dockDepth * 0.7; // 70% on land (extends far back)
        const dockOverWater = dockDepth * 0.3; // 30% over water (minimal forward extension)
        // Position dock center so front edge is at top of screen
        // Front edge target: z ≈ 5.5, so center = 5.5 - 7 = -1.5
        this.dock.position.set(0, dockY, -1.5); // Dock center at z=-1.5, front edge at z=5.5 (top), back edge at z=-8.5 (blocks water)
        this.dock.castShadow = true;
        this.dock.receiveShadow = true;
        this.sceneRef.scene.add(this.dock);
    }

    getSurfacePosition() {
        // Return position on dock surface (where cat will stand)
        // Position cat on the water-side edge of dock (forward, toward water)
        const dockDepth = 14; // Match the actual dock depth
        
        // Position cat near the front edge of the dock (water side)
        // Dock center is at position.z, front edge is at position.z + dockDepth/2
        // Position cat at about 85% forward from center (near front edge, on water side)
        return new THREE.Vector3(
            this.dock.position.x,
            this.dock.position.y + 0.3 / 2 + 0.01, // Top of dock surface
            this.dock.position.z + dockDepth * 0.35 // Position near front edge (water side)
        );
    }

    getDockMesh() {
        return this.dock;
    }
}

