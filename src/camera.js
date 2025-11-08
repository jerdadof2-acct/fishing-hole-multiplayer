import * as THREE from 'three';
import { CameraSpring } from './camera/cameraSpring.js';

export class Camera {
    constructor(scene, cat, dock, water) {
        this.sceneRef = scene;
        this.cat = cat;
        this.dock = dock;
        this.water = water;
        this.camera = scene.camera;
        this.spring = null;
    }

    setup() {
        // Overhead camera view - looking down at cat from across the lake
        // Cat at top of screen, casting toward camera (us watching from other side of lake)
        
        // Wait longer to ensure models are loaded and positioned
        setTimeout(() => {
            const catModel = this.cat.getModel();
            
            if (!catModel) {
                console.warn('Camera setup: Cat model not found');
                // Fallback: Set camera to safe position above water
                this.camera.position.set(0, 12, -8);
                this.camera.lookAt(0, 1.5, 3);
                return;
            }
            
            // Get cat position from SAVED position (not affected by bone attachments)
            // The saved position is set when cat is first positioned and protected from modifications
            const catPos = this.cat.getSavedPosition();
            console.log('Camera setup: Cat saved position:', catPos);
            
            // Verify model position matches (should be same unless modified)
            const modelPos = catModel.position.clone();
            console.log('Camera setup: Cat model position (for comparison):', modelPos);
            
            // If positions don't match, use saved position (it's the correct one)
            if (modelPos.distanceTo(catPos) > 0.1) {
                console.warn('[CAMERA] Cat model position differs from saved position - using saved position');
                // Ensure model position matches saved position
                catModel.position.copy(catPos);
            }
            
            // Camera positioned to view dock from below/behind
            // Dock appears at bottom of screen, camera looks toward it
            // Camera should be ABOVE water level, looking down at dock
            // Water is at y=0, dock is at y≈0.2, cat is at y≈0.5
            // Camera should be at y≈16 (further above water for zoom out), z=-12 (further back for zoom out)
            const cameraHeight = 16; // Higher up for zoomed out view
            const cameraDistance = -12; // Further back behind the dock (negative Z) for zoom out
            
            // Position camera: behind dock, above water, looking forward toward dock
            let cameraX = catPos.x;
            let cameraY = catPos.y + cameraHeight; // Above water level
            let cameraZ = catPos.z + cameraDistance; // Behind dock
            
            // Ensure camera is above water (safety check)
            if (cameraY < 1) {
                console.warn('Camera Y too low, clamping to 1. Cat Y was:', catPos.y);
                cameraY = 1;
            }
            
            this.camera.position.set(cameraX, cameraY, cameraZ);
            
            // Double-check camera position is valid
            if (this.camera.position.y < 1) {
                console.error('Camera still underwater after setup! Forcing to y=2');
                this.camera.position.y = 2;
            }
            
            // Look at a point forward from dock toward water (less of dock visible)
            const lookAtX = catPos.x;
            const lookAtY = catPos.y + 1.5; // Look higher above dock level to see less dock
            const lookAtZ = catPos.z + 4; // Look further forward from dock (positive Z) toward water
            
            const lookAtPoint = new THREE.Vector3(lookAtX, lookAtY, lookAtZ);
            this.camera.lookAt(lookAtPoint);
            
            console.log('Camera positioned at:', this.camera.position);
            console.log('Camera looking at:', lookAtPoint);
            console.log('Camera is ABOVE water?', this.camera.position.y > 0);
            
            // Set up spring camera follow for smooth movement
            // Target is cat position, with offset
            // IMPORTANT: Use cat model's LOCAL position (not world position from bones)
            this.spring = new CameraSpring(
                this.camera,
                () => {
                    // Use saved position (not affected by bone attachments)
                    const pos = this.cat.getSavedPosition();
                    return pos;
                },
                {
                    offset: new THREE.Vector3(0, 16, -12), // Camera further back and higher for zoom out, dock at bottom
                    stiffness: 60,
                    damping: 12
                }
            );
            
            // Set custom look-at target (near dock, looking forward)
            // IMPORTANT: Use saved position (not affected by bone attachments)
            this.spring.getLookAtTarget = () => {
                // Use saved position (not affected by bone attachments)
                const catPos = this.cat.getSavedPosition();
                // Look forward from dock toward water (less of dock visible)
                return new THREE.Vector3(
                    catPos.x,
                    catPos.y + 1.5, // Look higher above dock level to see less dock
                    catPos.z + 4 // Look further forward toward water (positive Z)
                );
            };
            
            // Handle orientation changes
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.updateCamera(), 100);
            });
            
            window.addEventListener('resize', () => {
                this.updateCamera();
            });
        }, 200); // Increased delay to ensure everything is loaded
    }

    updateCamera() {
        if (!this.cat.getModel()) return;
        
        const container = document.getElementById('game-container');
        const aspect = container.clientWidth / container.clientHeight;
        
        // Update aspect ratio (spring will handle position)
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }
    
    update(dt) {
        // Update spring camera follow if initialized
        if (this.spring) {
            this.spring.update(dt);
        }
    }
}

