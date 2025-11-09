import * as THREE from 'three';

/**
 * Platform system - manages dock and boats where cat stands
 * DOCK: For ponds and rivers (completely still)
 * SMALL_BOAT: For lakes (center section, rocks with waves)
 * LARGE_BOAT: For oceans (stern section, gentle rocking)
 */
export class Platform {
    constructor(scene, water) {
        this.sceneRef = scene;
        this.water = water;
        this.currentPlatform = null;
        this.currentPlatformType = null;
        this.platformMesh = null;
        this.waveTime = 0; // Wave phase for rocking animation
        this.previousWaterType = null; // Track previous water type for dock recreation
        
        // Dock configuration (matches existing dock)
        this.dockWidth = 3;
        this.dockDepth = 14;
        this.dockHeight = 0.3;
        this.dockY = 0.2;
        this.dockOverWater = this.dockDepth * 0.3; // ~4.2 units over water (same for boats)
        
        // Boat dimensions
        this.smallBoatWidth = 4.0; // Width of boat (wider than before, dock is 3)
        this.smallBoatDepth = 14; // Depth of boat (same as dock depth)
        this.largeBoatWidth = 8.0; // Width of boat (twice as wide as small boat: 4.0 * 2 = 8.0)
        this.largeBoatDepth = 14; // Depth of boat (same as small boat and dock to hide back end)
    }
    
    /**
     * Create a platform based on type
     */
    createPlatform(type) {
        // Remove existing platform if any
        if (this.platformMesh) {
            this.sceneRef.scene.remove(this.platformMesh);
            this.platformMesh = null;
        }
        
        this.currentPlatformType = type;
        
        switch (type) {
            case 'DOCK':
                this.createDock();
                break;
            case 'SMALL_BOAT':
                this.createSmallBoat();
                break;
            case 'LARGE_BOAT':
                this.createLargeBoat();
                break;
            default:
                console.warn('[PLATFORM] Unknown platform type:', type);
                this.createDock(); // Fallback to dock
                break;
        }
        
        if (this.platformMesh) {
            this.sceneRef.scene.add(this.platformMesh);
        }
    }
    
    /**
     * Create dock platform (for ponds and rivers)
     * Different styles for pond vs river locations
     */
    createDock() {
        // Check water body type to differentiate pond vs river docks
        const waterType = this.water?.waterBodyType || 'LAKE'; // Fallback to LAKE if not set
        const isPond = waterType === 'POND';
        const isRiver = waterType === 'RIVER';
        console.log('[DOCK] Creating dock - waterBodyType:', waterType, 'isPond:', isPond, 'isRiver:', isRiver);
        
        const geometry = new THREE.BoxGeometry(this.dockWidth, this.dockHeight, this.dockDepth);
        
        // Create wood texture procedurally - different colors for pond vs river
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Pond: Lighter, more rustic wood (weathered but cleaner)
        // River: Darker, more weathered wood (sturdier, more used) but not too dark for shadows
        const baseColor = isPond ? '#b89570' : '#6b4f2a'; // Pond: lighter brown, River: medium-dark brown (lightened from 4a3428)
        const grainColor = isPond ? '#9d7a55' : '#4a3428'; // Pond: lighter grain, River: darker grain (lightened from 2a1f14)
        
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 256, 256);
        
        // Add wood grain lines - more visible on river dock
        ctx.strokeStyle = grainColor;
        ctx.lineWidth = isRiver ? 3 : 2; // Thicker lines for river
        const grainCount = isRiver ? 25 : 20; // More grain lines for river (more weathered)
        for (let i = 0; i < grainCount; i++) {
            ctx.beginPath();
            const y = Math.random() * 256;
            ctx.moveTo(0, y);
            ctx.quadraticCurveTo(128 + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 30, 256, y);
            ctx.stroke();
        }
        
        const woodTexture = new THREE.CanvasTexture(canvas);
        woodTexture.wrapS = THREE.RepeatWrapping;
        woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(1, 5);
        
        // Material colors - pond lighter, river medium-dark (lightened so shadows are visible)
        const deckColor = isPond ? 0xb89570 : 0x6b4f2a; // River lightened from 0x4a3428 to 0x6b4f2a
        const material = new THREE.MeshStandardMaterial({
            map: woodTexture,
            roughness: isRiver ? 0.9 : 0.8, // River more weathered/rough
            metalness: 0.1,
            color: deckColor
        });
        
        // Create dock as a group to hold platform and supports
        const dockGroup = new THREE.Group();
        
        // Support posts/pilings underneath the dock (wooden posts extending into water)
        // Pond: Thinner, lighter posts | River: Thicker, darker, sturdier posts
        const postColor = isPond ? 0x9d7a55 : 0x3a2818; // Pond: lighter, River: much darker/weathered
        const postRadius = isPond ? 0.06 : 0.12; // Pond: thinner posts (0.06), River: much thicker/sturdier posts (0.12)
        const postMaterial = new THREE.MeshStandardMaterial({
            color: postColor,
            roughness: 0.9,
            metalness: 0.0
        });
        
        const postHeight = 1.5; // Posts extend from water surface up to dock bottom
        const postGeometry = new THREE.CylinderGeometry(postRadius, postRadius * 1.1, postHeight, isRiver ? 16 : 12); // River: more segments for smoother look
        
        // Create multiple support posts along the dock length and width
        // Pond: Fewer, simpler posts | River: More posts for sturdier construction
        const postPositions = isPond ? [
            // Front edge (water side) - 2 posts for pond
            { x: -this.dockWidth * 0.3, z: this.dockDepth * 0.35 },
            { x: this.dockWidth * 0.3, z: this.dockDepth * 0.35 },
            // Back edge - 2 posts for pond
            { x: -this.dockWidth * 0.3, z: -this.dockDepth * 0.35 },
            { x: this.dockWidth * 0.3, z: -this.dockDepth * 0.35 }
        ] : [
            // Front edge (water side) - 3 posts for river (sturdier)
            { x: -this.dockWidth * 0.4, z: this.dockDepth * 0.35 },
            { x: 0, z: this.dockDepth * 0.35 },
            { x: this.dockWidth * 0.4, z: this.dockDepth * 0.35 },
            // Back edge - 3 posts for river
            { x: -this.dockWidth * 0.4, z: -this.dockDepth * 0.35 },
            { x: 0, z: -this.dockDepth * 0.35 },
            { x: this.dockWidth * 0.4, z: -this.dockDepth * 0.35 },
            // Middle supports - 2 posts for river
            { x: -this.dockWidth * 0.4, z: 0 },
            { x: this.dockWidth * 0.4, z: 0 }
        ];
        
        const raisedDockY = this.water.waterY + 1.0; // Dock top position
        const waterSurfaceY = this.water.waterY;
        const postTopY = raisedDockY - this.dockHeight * 0.5; // Top of posts (where dock bottom sits)
        const postCenterY = (waterSurfaceY + postTopY) / 2; // Center of posts
        const actualPostHeight = postTopY - waterSurfaceY; // Actual height from water to dock bottom
        
        postPositions.forEach(pos => {
            const post = new THREE.Mesh(postGeometry, postMaterial);
            // Scale post height to match actual needed height
            post.scale.y = actualPostHeight / postHeight;
            // Position post: extends from water surface to dock bottom (where dock sits on top)
            post.position.set(pos.x, postCenterY, pos.z);
            post.castShadow = true;
            post.receiveShadow = true;
            dockGroup.add(post);
        });
        
        // Dock platform sits ON TOP of the posts
        const dockPlatform = new THREE.Mesh(geometry, material);
        // Platform center Y = dock top Y - half height
        dockPlatform.position.y = raisedDockY - this.dockHeight * 0.5;
        dockPlatform.castShadow = true;
        dockPlatform.receiveShadow = true; // Enable shadow receiving on dock deck
        dockGroup.add(dockPlatform);
        
        // Cross-beams/joists underneath the dock (supporting structure)
        // These sit between the posts and the dock bottom
        // Pond: Simpler, lighter beams | River: More substantial beams
        const beamColor = isPond ? 0x8a6f4a : 0x6a4f3a; // Pond: lighter, River: darker
        const beamMaterial = new THREE.MeshStandardMaterial({
            color: beamColor,
            roughness: 0.9,
            metalness: 0.0
        });
        
        // Longitudinal beams (running along dock length)
        // Pond: Thinner beams | River: Thicker, sturdier beams
        const beamHeight = isPond ? 0.10 : 0.12;
        const beamWidth = isPond ? 0.06 : 0.08;
        const beamY = postTopY - beamHeight * 0.5; // Just below dock bottom, on top of posts
        
        // Left beam
        const leftBeam = new THREE.Mesh(
            new THREE.BoxGeometry(beamWidth, beamHeight, this.dockDepth * 0.95),
            beamMaterial
        );
        leftBeam.position.set(-this.dockWidth * 0.45, beamY, 0);
        leftBeam.castShadow = true;
        leftBeam.receiveShadow = true;
        dockGroup.add(leftBeam);
        
        // Right beam
        const rightBeam = new THREE.Mesh(
            new THREE.BoxGeometry(beamWidth, beamHeight, this.dockDepth * 0.95),
            beamMaterial
        );
        rightBeam.position.set(this.dockWidth * 0.45, beamY, 0);
        rightBeam.castShadow = true;
        rightBeam.receiveShadow = true;
        dockGroup.add(rightBeam);
        
        // Center beam
        const centerBeam = new THREE.Mesh(
            new THREE.BoxGeometry(beamWidth, beamHeight, this.dockDepth * 0.95),
            beamMaterial
        );
        centerBeam.position.set(0, beamY, 0);
        centerBeam.castShadow = true;
        centerBeam.receiveShadow = true;
        dockGroup.add(centerBeam);
        
        // Edge rails/rims around the dock (gives it a finished look)
        const railHeight = 0.12; // Increased from 0.06 to 0.12 (twice as tall)
        const railWidth = 0.10; // Increased from 0.05 to 0.10 (twice as thick)
        
        // Front rail (water side) - align inner edge with dock front edge
        const frontRail = new THREE.Mesh(
            new THREE.BoxGeometry(this.dockWidth, railHeight, railWidth),
            postMaterial
        );
        // Position so inner edge aligns with dock front edge, brought in slightly to close gap
        frontRail.position.set(0, raisedDockY + this.dockHeight * 0.5 + railHeight * 0.5, this.dockDepth * 0.5 - railWidth * 0.5 - 0.04);
        frontRail.castShadow = true;
        frontRail.receiveShadow = true;
        dockGroup.add(frontRail);
        
        // Left side rail - align inner edge with dock left edge, shorten to end before front rail
        const sideRailLength = this.dockDepth - railWidth; // Shorten by railWidth to leave room for front rail
        const leftRail = new THREE.Mesh(
            new THREE.BoxGeometry(railWidth, railHeight, sideRailLength),
            postMaterial
        );
        // Position so inner edge aligns with dock left edge, but ends before front rail
        // Offset Z position so rail ends just before front rail position
        leftRail.position.set(-this.dockWidth * 0.5 + railWidth * 0.5, raisedDockY + this.dockHeight * 0.5 + railHeight * 0.5, -railWidth * 0.5);
        leftRail.castShadow = true;
        leftRail.receiveShadow = true;
        dockGroup.add(leftRail);
        
        // Right side rail - align inner edge with dock right edge, shorten to end before front rail
        const rightRail = new THREE.Mesh(
            new THREE.BoxGeometry(railWidth, railHeight, sideRailLength),
            postMaterial
        );
        // Position so inner edge aligns with dock right edge, but ends before front rail
        rightRail.position.set(this.dockWidth * 0.5 - railWidth * 0.5, raisedDockY + this.dockHeight * 0.5 + railHeight * 0.5, -railWidth * 0.5);
        rightRail.castShadow = true;
        rightRail.receiveShadow = true;
        dockGroup.add(rightRail);
        
        // Realistic details for dock
        // Dock bumpers/fenders (protection along front edge, on outside of rail, facing outward toward water)
        const bumperMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a4a6a, // Navy blue rubber
            roughness: 0.9,
            metalness: 0.0
        });
        for (let i = 0; i < 3; i++) {
            const xPos = -this.dockWidth * 0.3 + i * (this.dockWidth * 0.3);
            const bumper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12), // Half as long: 0.2 (was 0.4)
                bumperMaterial
            );
            bumper.rotation.x = Math.PI / 2; // Horizontal, pointing forward (+Z toward water)
            // Position on outside of front rail (outside the end rail, toward water)
            // Front rail is at z = this.dockDepth * 0.5 - railWidth * 0.5 - 0.04
            // Bumper should be outside (forward) of the rail
            const frontRailZ = this.dockDepth * 0.5 - railWidth * 0.5 - 0.04;
            bumper.position.set(xPos, raisedDockY + this.dockHeight * 0.5 - 0.02, frontRailZ + railWidth * 0.5 + 0.1);
            bumper.castShadow = true;
            dockGroup.add(bumper);
        }
        
        // Position dock group
        dockGroup.position.set(0, 0, -1.5);
        dockGroup.castShadow = true;
        dockGroup.receiveShadow = true;
        
        this.platformMesh = dockGroup;
    }
    
    /**
     * Create small boat (center section only) for lakes
     */
    createSmallBoat() {
        // Create boat as a group so we can animate rotation
        const boatGroup = new THREE.Group();
        
        const boatWidth = this.smallBoatWidth;
        const boatLength = this.smallBoatDepth;
        const hullHeight = 0.2; // Height of hull sides
        const deckThickness = 0.04;
        
        // Wood material for hull
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: 0x6b4423, // Brown wood color
            roughness: 0.7,
            metalness: 0.1
        });
        
        // Deck material (lighter wood)
        const deckMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b6f47, // Lighter wood color
            roughness: 0.8,
            metalness: 0.05
        });
        
        // Boat hull (curved bottom using multiple segments for tapered effect)
        // Bottom hull plate
        const bottomGeometry = new THREE.BoxGeometry(boatWidth * 0.85, 0.03, boatLength * 0.9);
        const bottom = new THREE.Mesh(bottomGeometry, hullMaterial);
        bottom.position.y = -hullHeight * 0.5;
        boatGroup.add(bottom);
        
        // Left side hull with bevel/taper (not straight box)
        const sideShape = new THREE.Shape();
        sideShape.moveTo(0, 0);
        sideShape.lineTo(0, hullHeight);
        sideShape.lineTo(0.06, hullHeight * 0.8); // Taper inward at top
        sideShape.lineTo(0.06, 0.2);
        sideShape.lineTo(0, 0);
        sideShape.closePath();
        
        const extrudeSettings = { depth: boatLength * 0.95, bevelEnabled: false };
        const sideGeometry = new THREE.ExtrudeGeometry(sideShape, extrudeSettings);
        sideGeometry.rotateY(Math.PI / 2);
        sideGeometry.rotateX(-Math.PI / 2);
        sideGeometry.translate(0, -hullHeight * 0.5, 0);
        
        const leftSide = new THREE.Mesh(sideGeometry, hullMaterial);
        leftSide.position.set(-boatWidth * 0.42, 0, 0);
        boatGroup.add(leftSide);
        
        // Right side hull (mirror of left)
        const rightSideGeometry = sideGeometry.clone();
        rightSideGeometry.scale(-1, 1, 1); // Mirror
        const rightSide = new THREE.Mesh(rightSideGeometry, hullMaterial);
        rightSide.position.set(boatWidth * 0.42, 0, 0);
        boatGroup.add(rightSide);
        
        // Transom (back of boat - vertical, properly attached)
        // Align transom with shortened side rails - it should be inside the back rail
        const transomGeometry = new THREE.BoxGeometry(boatWidth * 0.85, hullHeight * 0.7, 0.12);
        const transom = new THREE.Mesh(transomGeometry, hullMaterial);
        // Position transom inside where back rail will be (backRailZ from gunwale calculation)
        // Since backRailZ is calculated later, use the same calculation: -(boatLength * 0.88 * 0.5) - railThick
        const backRailZCalc = -(boatLength * 0.88 * 0.5) - 0.03; // Slightly inside back rail position
        transom.position.set(0, -hullHeight * 0.15, backRailZCalc); // Inside back rail
        boatGroup.add(transom);
        
        // Bow (front of boat - pointed/tapered shape)
        // Align bow with shortened side rails - it should be inside the front rail
        const bowShape = new THREE.Shape();
        bowShape.moveTo(-boatWidth * 0.4, 0);
        bowShape.lineTo(boatWidth * 0.4, 0);
        bowShape.lineTo(boatWidth * 0.15, hullHeight * 0.7); // Tapers to point
        bowShape.lineTo(-boatWidth * 0.15, hullHeight * 0.7);
        bowShape.closePath();
        
        const bowExtrudeSettings = { depth: 0.2, bevelEnabled: false };
        const bowGeometry = new THREE.ExtrudeGeometry(bowShape, bowExtrudeSettings);
        bowGeometry.rotateX(-Math.PI / 2);
        bowGeometry.translate(0, -hullHeight * 0.15, 0);
        
        const bow = new THREE.Mesh(bowGeometry, hullMaterial);
        // Position bow inside where front rail will be (frontRailZ from gunwale calculation)
        // Since frontRailZ is calculated later, use the same calculation: (boatLength * 0.88 * 0.5) + railThick
        const frontRailZCalc = (boatLength * 0.88 * 0.5) + 0.03; // Slightly inside front rail position
        bow.position.set(0, 0, frontRailZCalc); // Inside front rail
        bow.rotation.x = -Math.PI / 12; // Tilt forward slightly
        boatGroup.add(bow);
        
        // Deck (sunken into hull to create boat interior)
        const deckGeometry = new THREE.BoxGeometry(boatWidth * 0.9, deckThickness, boatLength * 0.9);
        const deck = new THREE.Mesh(deckGeometry, deckMaterial);
        // Put the deck clearly below the gunwale to create "inside the boat" pocket
        deck.position.y = hullHeight * 0.35; // Lower than before
        deck.castShadow = true;
        deck.receiveShadow = true;
        boatGroup.add(deck);
        
        // Exact top surface (center + half height)
        const deckTopLocal = deck.position.y + deckThickness * 0.5;
        // Store for getSurfacePosition or other code
        boatGroup.userData.deckTopLocal = deckTopLocal;
        
        // Gunwale "cap" - L-cap that overlaps both hull and deck
        const gunwaleMaterial = new THREE.MeshStandardMaterial({
            color: 0x9aa2ad, // Lighter grey tone
            roughness: 0.55,
            metalness: 0.08
        });
        const gunwaleTopMaterial = new THREE.MeshStandardMaterial({
            color: 0x2f3238, // Dark cap along top edge
            roughness: 0.45,
            metalness: 0.1
        });
        
        const gunwaleHeight = 1.3;       // Taller - increased to 1.3
        const gunwaleOut = 0.0;           // No outward overhang - align exactly with hull
        const gunwaleIn = 0.06;           // Inward overhang above the deck
        const railThick = 0.24;           // Thickness of the gunwale rails
        
        // Hull side outer edge position (hull sides are at ±boatWidth * 0.42, with side thickness ~0.06)
        // So outer edge is at approximately ±(boatWidth * 0.42 + 0.03) = ±(4.0 * 0.42 + 0.03) = ±1.71
        // To align gunwale center with hull outer edge, position at ±1.71
        const hullOuterEdge = boatWidth * 0.42 + 0.03; // Hull center + half side thickness
        
        // Sides (left/right) - shorten them to leave room for front/back rails
        const sideLen = boatLength * 0.88; // Shortened from 0.95 to leave gap for front/back rails
        const sideRailGeom = new THREE.BoxGeometry(railThick, gunwaleHeight, sideLen);
        
        // y at which the rail sits so it clearly caps the hull and rises above the deck
        const railY = Math.max(deckTopLocal + 0.06, hullHeight * 0.5 + 0.02);
        
        // Left rail: move slightly outward to increase space between rails
        const leftRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        leftRail.position.set(-hullOuterEdge + railThick * 0.5 - 0.02, railY, 0); // Move out by 0.02
        leftRail.castShadow = true;
        leftRail.receiveShadow = true;
        boatGroup.add(leftRail);
        
        // Right rail: move slightly outward to increase space between rails
        const rightRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        rightRail.position.set(hullOuterEdge - railThick * 0.5 + 0.02, railY, 0); // Move out by 0.02
        rightRail.castShadow = true;
        rightRail.receiveShadow = true;
        boatGroup.add(rightRail);
        
        // Front & back rails (bow/transom) - align with shortened side rails' ends
        // Side rails now run from -sideLen/2 to +sideLen/2, where sideLen = boatLength * 0.88
        // Side rails end at ±(boatLength * 0.88 * 0.5) = ±(boatLength * 0.44)
        const foreAftLen = boatWidth - railThick * 1.2; // Shortened more to prevent protruding over edges
        const foreAftGeom = new THREE.BoxGeometry(foreAftLen, gunwaleHeight, railThick);
        
        // Side rails end at ±sideLen/2 = ±(boatLength * 0.88 * 0.5)
        // Position front/back rail centers to meet side rail ends exactly
        const sideRailEndZ = (boatLength * 0.88) * 0.5; // End of side rail = boatLength * 0.44
        const frontRailZ = sideRailEndZ + railThick * 0.5; // Position to meet side rail end
        const backRailZ = -sideRailEndZ - railThick * 0.5; // Position to meet side rail end
        
        const frontRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        frontRail.position.set(0, railY, frontRailZ);
        frontRail.castShadow = true;
        frontRail.receiveShadow = true;
        boatGroup.add(frontRail);
        
        const backRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        backRail.position.set(0, railY, backRailZ);
        backRail.castShadow = true;
        backRail.receiveShadow = true;
        boatGroup.add(backRail);

        // Add darker cap strips along the top edge of each rail
        const topCapHeight = Math.min(0.18, gunwaleHeight * 0.22);
        const sideTopGeom = new THREE.BoxGeometry(railThick * 1.04, topCapHeight, sideLen * 0.995);
        const frontTopGeom = new THREE.BoxGeometry(foreAftLen * 0.995, topCapHeight, railThick * 1.04);
        const topY = railY + gunwaleHeight * 0.5 - topCapHeight * 0.5;

        const leftTopCap = new THREE.Mesh(sideTopGeom, gunwaleTopMaterial);
        leftTopCap.position.set(leftRail.position.x, topY, 0);
        leftTopCap.castShadow = false;
        boatGroup.add(leftTopCap);

        const rightTopCap = new THREE.Mesh(sideTopGeom, gunwaleTopMaterial);
        rightTopCap.position.set(rightRail.position.x, topY, 0);
        rightTopCap.castShadow = false;
        boatGroup.add(rightTopCap);

        const frontTopCap = new THREE.Mesh(frontTopGeom, gunwaleTopMaterial);
        frontTopCap.position.set(0, topY, frontRail.position.z);
        frontTopCap.castShadow = false;
        boatGroup.add(frontTopCap);

        const backTopCap = new THREE.Mesh(frontTopGeom, gunwaleTopMaterial);
        backTopCap.position.set(0, topY, backRail.position.z);
        backTopCap.castShadow = false;
        boatGroup.add(backTopCap);
        
        // Inner coaming lip (vertical strip just inside rail so gunwale & deck look bonded)
        const coamH = gunwaleHeight * 0.65;
        const coamTh = 0.025;
        const coamY = deckTopLocal + coamH * 0.5; // Starts at deck, up toward the rail
        
        // Coaming uses same shortened length as side rails
        const coamSideGeom = new THREE.BoxGeometry(coamTh, coamH, sideLen * 0.98);
        const coamFrontGeom = new THREE.BoxGeometry(foreAftLen * 0.98, coamH, coamTh);
        const coamMat = new THREE.MeshStandardMaterial({ 
            color: 0x4b2f16, 
            roughness: 0.7, 
            metalness: 0.05 
        });
        
        // Left inner lip - positioned inside hull edge
        const leftCoam = new THREE.Mesh(coamSideGeom, coamMat);
        leftCoam.position.set(-hullOuterEdge + gunwaleIn, coamY, 0);
        leftCoam.castShadow = true;
        leftCoam.receiveShadow = true;
        boatGroup.add(leftCoam);
        
        // Right inner lip - positioned inside hull edge
        const rightCoam = new THREE.Mesh(coamSideGeom, coamMat);
        rightCoam.position.set(hullOuterEdge - gunwaleIn, coamY, 0);
        rightCoam.castShadow = true;
        rightCoam.receiveShadow = true;
        boatGroup.add(rightCoam);
        
        // Front inner lip - align with front rail position
        const frontCoam = new THREE.Mesh(coamFrontGeom, coamMat);
        frontCoam.position.set(0, coamY, frontRailZ - gunwaleIn);
        frontCoam.castShadow = true;
        frontCoam.receiveShadow = true;
        boatGroup.add(frontCoam);
        
        // Back inner lip - align with back rail position
        const backCoam = new THREE.Mesh(coamFrontGeom, coamMat);
        backCoam.position.set(0, coamY, backRailZ + gunwaleIn);
        backCoam.castShadow = true;
        backCoam.receiveShadow = true;
        boatGroup.add(backCoam);
        
        // Optional: Sheer clamp strip (thin shadow line under gunwale)
        const sheerGeom = new THREE.BoxGeometry(0.02, 0.02, sideLen * 0.98);
        const sheerMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a2410, 
            roughness: 0.6 
        });
        
        const leftSheer = new THREE.Mesh(sheerGeom, sheerMat);
        leftSheer.position.set(-hullOuterEdge + 0.01 - 0.02, railY - gunwaleHeight * 0.55, 0); // Match rail position
        leftSheer.castShadow = true;
        boatGroup.add(leftSheer);
        
        const rightSheer = new THREE.Mesh(sheerGeom, sheerMat);
        rightSheer.position.set(hullOuterEdge - 0.01 + 0.02, railY - gunwaleHeight * 0.55, 0); // Match rail position
        rightSheer.castShadow = true;
        boatGroup.add(rightSheer);
        
        // Bench seats (multiple seats along the boat length - positioned on sunken deck)
        // Front bench (near where cat stands) - wider, deeper, raised, and with shadows
        const frontBenchGeometry = new THREE.BoxGeometry(boatWidth * 0.85, 0.08, 0.5); // Deeper from 0.3 to 0.5
        const frontBench = new THREE.Mesh(frontBenchGeometry, deckMaterial);
        frontBench.position.set(0, deckTopLocal + 0.20, boatLength * 0.15); // Raised 0.20 above deck
        frontBench.castShadow = true; // Enable shadow casting
        frontBench.receiveShadow = true; // Enable shadow receiving
        boatGroup.add(frontBench);
        
        // Middle bench - wider, deeper, raised, and with shadows
        const middleBenchGeometry = new THREE.BoxGeometry(boatWidth * 0.85, 0.08, 0.5); // Deeper from 0.3 to 0.5
        const middleBench = new THREE.Mesh(middleBenchGeometry, deckMaterial);
        middleBench.position.set(0, deckTopLocal + 0.20, -boatLength * 0.15); // Raised 0.20 above deck
        middleBench.castShadow = true; // Enable shadow casting
        middleBench.receiveShadow = true; // Enable shadow receiving
        boatGroup.add(middleBench);
        
        // Back bench (near transom) - wider, deeper, raised, and with shadows
        const backBenchGeometry = new THREE.BoxGeometry(boatWidth * 0.85, 0.08, 0.5); // Deeper from 0.3 to 0.5
        const backBench = new THREE.Mesh(backBenchGeometry, deckMaterial);
        backBench.position.set(0, deckTopLocal + 0.20, -boatLength * 0.4); // Raised 0.20 above deck
        backBench.castShadow = true; // Enable shadow casting
        backBench.receiveShadow = true; // Enable shadow receiving
        boatGroup.add(backBench);
        
        // Oarlocks (small details on gunwales - multiple pairs along the boat)
        const oarlockMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2814, // Very dark wood/metal
            roughness: 0.4,
            metalness: 0.6
        });
        
        const oarlockGeometry = new THREE.BoxGeometry(0.06, 0.04, 0.06);
        
        // Left oarlocks (3 pairs spaced along boat) - positioned on gunwale
        const oarlockY = railY + gunwaleHeight * 0.5; // Top of gunwale
        for (let i = 0; i < 3; i++) {
            const zPos = -boatLength * 0.3 + i * boatLength * 0.3;
            const leftOarlock = new THREE.Mesh(oarlockGeometry, oarlockMaterial);
            leftOarlock.position.set(-hullOuterEdge + railThick * 0.5 - 0.02, oarlockY + 0.02, zPos); // Match rail position
            boatGroup.add(leftOarlock);
        }
        
        // Right oarlocks (3 pairs spaced along boat) - positioned on gunwale
        for (let i = 0; i < 3; i++) {
            const zPos = -boatLength * 0.3 + i * boatLength * 0.3;
            const rightOarlock = new THREE.Mesh(oarlockGeometry.clone(), oarlockMaterial);
            rightOarlock.position.set(hullOuterEdge - railThick * 0.5 + 0.02, oarlockY + 0.02, zPos); // Match rail position
            boatGroup.add(rightOarlock);
        }
        
        // Cleats for docking (mooring hardware) - small metal cleats
        const cleatMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888, // Silver/gray metal
            roughness: 0.3,
            metalness: 0.8
        });
        
        // Create cleat shape (T-shaped)
        const cleatGroup = new THREE.Group();
        const cleatBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.12), cleatMaterial);
        cleatBase.position.y = 0.015;
        cleatGroup.add(cleatBase);
        
        const cleatHorn1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), cleatMaterial);
        cleatHorn1.position.set(-0.025, 0.03, 0);
        cleatGroup.add(cleatHorn1);
        
        const cleatHorn2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), cleatMaterial);
        cleatHorn2.position.set(0.025, 0.03, 0);
        cleatGroup.add(cleatHorn2);
        
        // Bow cleat (front of boat)
        const bowCleat = cleatGroup.clone();
        bowCleat.position.set(0, railY + gunwaleHeight * 0.4, boatLength * 0.88 * 0.5 + 0.1);
        bowCleat.rotation.y = Math.PI / 2; // Rotate to face forward
        boatGroup.add(bowCleat);
        
        // Stern cleats (back of boat, both sides)
        const sternCleatLeft = cleatGroup.clone();
        sternCleatLeft.position.set(-hullOuterEdge * 0.7, railY + gunwaleHeight * 0.4, -boatLength * 0.88 * 0.5 - 0.1);
        sternCleatLeft.rotation.y = -Math.PI / 2; // Rotate to face backward
        boatGroup.add(sternCleatLeft);
        
        const sternCleatRight = cleatGroup.clone();
        sternCleatRight.position.set(hullOuterEdge * 0.7, railY + gunwaleHeight * 0.4, -boatLength * 0.88 * 0.5 - 0.1);
        sternCleatRight.rotation.y = -Math.PI / 2;
        boatGroup.add(sternCleatRight);
        
        // Rod holders (for storing extra rods) - mounted on gunwales
        const rodHolderMat = new THREE.MeshStandardMaterial({
            color: 0x555555, // Dark gray/black
            roughness: 0.4,
            metalness: 0.7
        });
        const rodHolderGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.15, 12);
        
        // Left side rod holders (2-3 along the side)
        for (let i = 0; i < 2; i++) {
            const zPos = -boatLength * 0.2 + i * boatLength * 0.4;
            const leftRodHolder = new THREE.Mesh(rodHolderGeo, rodHolderMat);
            leftRodHolder.rotation.z = Math.PI / 2; // Horizontal
            leftRodHolder.position.set(-hullOuterEdge * 0.9, railY + gunwaleHeight * 0.3, zPos);
            leftRodHolder.castShadow = true;
            boatGroup.add(leftRodHolder);
        }
        
        // Right side rod holders (2-3 along the side)
        for (let i = 0; i < 2; i++) {
            const zPos = -boatLength * 0.2 + i * boatLength * 0.4;
            const rightRodHolder = new THREE.Mesh(rodHolderGeo.clone(), rodHolderMat);
            rightRodHolder.rotation.z = Math.PI / 2; // Horizontal
            rightRodHolder.position.set(hullOuterEdge * 0.9, railY + gunwaleHeight * 0.3, zPos);
            rightRodHolder.castShadow = true;
            boatGroup.add(rightRodHolder);
        }
        
        // Drain scuppers (drain holes in deck) - small holes near edges
        const scupperGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8);
        const scupperMat = new THREE.MeshStandardMaterial({
            color: 0x222222, // Dark/black
            roughness: 0.9,
            metalness: 0.2
        });
        
        // Scuppers near transom (back)
        for (let i = 0; i < 2; i++) {
            const xPos = (i === 0 ? -0.3 : 0.3);
            const scupper = new THREE.Mesh(scupperGeo, scupperMat);
            scupper.rotation.x = Math.PI / 2;
            scupper.position.set(xPos, deckTopLocal - 0.025, -boatLength * 0.4);
            boatGroup.add(scupper);
        }
        
        // Small anchor mount/roller at bow (front)
        const anchorMountGeo = new THREE.BoxGeometry(0.12, 0.04, 0.08);
        const anchorMount = new THREE.Mesh(anchorMountGeo, oarlockMaterial);
        anchorMount.position.set(0, railY + gunwaleHeight * 0.3, boatLength * 0.88 * 0.5 + 0.05);
        anchorMount.castShadow = true;
        boatGroup.add(anchorMount);
        
        // Anchor chain visible hanging from mount - much larger
        const chainMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a, // Lighter gray chain for visibility
            roughness: 0.9,
            metalness: 0.8
        });
        // Chain links (simplified as connected torus segments) - made much bigger
        for (let i = 0; i < 4; i++) {
            const chainLink = new THREE.Mesh(
                new THREE.TorusGeometry(0.035, 0.018, 8, 12), // Much larger: 0.035 radius (was 0.015), 0.018 tube (was 0.008)
                chainMaterial
            );
            chainLink.rotation.z = Math.PI / 2;
            chainLink.position.set(0, railY + gunwaleHeight * 0.3 - 0.02 - i * 0.06, boatLength * 0.88 * 0.5 + 0.05);
            chainLink.castShadow = true;
            boatGroup.add(chainLink);
        }
        
        // Mooring ropes wrapped around cleats - larger and more visible
        const mooringRopeMat = new THREE.MeshStandardMaterial({
            color: 0x8b7355, // Brown/tan rope
            roughness: 0.9,
            metalness: 0.0
        });
        // Rope wrapped around stern cleats (loops) - made much bigger
        for (let side = 0; side < 2; side++) {
            const xSide = side === 0 ? -1 : 1;
            const cleatX = hullOuterEdge * 0.7 * xSide;
            const cleatZ = -boatLength * 0.88 * 0.5 - 0.1;
            for (let i = 0; i < 2; i++) {
                const sternRopeLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.08, 0.025, 12, 20), // Much larger: 0.08 radius (was 0.04), 0.025 tube (was 0.012)
                    mooringRopeMat
                );
                sternRopeLoop.rotation.x = Math.PI / 2;
                sternRopeLoop.position.set(cleatX + (i - 0.5) * 0.10, railY + gunwaleHeight * 0.4 + 0.04, cleatZ);
                sternRopeLoop.castShadow = true;
                boatGroup.add(sternRopeLoop);
            }
        }
        
        // Navigation lights (stern light - white) - much larger
        const navLightMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xcccccc,
            emissiveIntensity: 0.5, // Brighter
            roughness: 0.2,
            metalness: 0.8
        });
        const navLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 10, 10), // Much larger: 0.08 radius (was 0.04)
            navLightMat
        );
        navLight.position.set(0, railY + gunwaleHeight * 0.65, -boatLength * 0.88 * 0.5 - 0.15);
        navLight.castShadow = true;
        boatGroup.add(navLight);
        
        // Rope coil on deck (emergency/tool rope) - larger
        const ropeCoil = new THREE.Mesh(
            new THREE.TorusGeometry(0.12, 0.025, 12, 20), // Much larger: 0.12 radius (was 0.06), 0.025 tube (was 0.012)
            mooringRopeMat
        );
        ropeCoil.rotation.x = -Math.PI / 2; // Lay flat on deck
        ropeCoil.position.set(-boatWidth * 0.3, deckTopLocal + 0.02, -boatLength * 0.2);
        ropeCoil.castShadow = true;
        ropeCoil.receiveShadow = true;
        boatGroup.add(ropeCoil);
        
        this.platformMesh = boatGroup;
        
        // Position boat: same protrusion distance as dock
        // Dock: center z=-1.5, depth=14, front edge = -1.5 + 7 = 5.5
        // dockOverWater = 14 * 0.3 = 4.2 units protrude over water
        // Boat depth = 14 (same as dock), so boat center z = -1.5 (same as dock)
        // This ensures boat protrudes the same distance as dock's 4.2 units over water
        // Use higher base Y to prevent dipping below water during rocking
        this.platformMesh.position.set(0, this.water.waterY + 0.35, -1.5); // Same position as dock, much higher base
        this.platformMesh.castShadow = true;
        this.platformMesh.receiveShadow = true;
        
        // Store initial rotation for animation
        this.platformMesh.userData.initialRotation = new THREE.Euler(0, 0, 0);
    }
    
    /**
     * Create large boat (stern section only) for oceans
     */
    createLargeBoat() {
        // Create boat as a group so we can animate rotation
        const boatGroup = new THREE.Group();
        
        const boatWidth = this.largeBoatWidth;
        const boatLength = this.largeBoatDepth;
        const hullHeight = 0.25; // Taller hull for large boat
        
        // Stern hull with bevel/taper (chunkier than small boat)
        const sideShape = new THREE.Shape();
        sideShape.moveTo(0, 0);
        sideShape.lineTo(0, hullHeight);
        sideShape.lineTo(0.08, hullHeight * 0.75); // More pronounced taper
        sideShape.lineTo(0.08, 0.25);
        sideShape.lineTo(0, 0);
        sideShape.closePath();
        
        const extrudeSettings = { depth: boatLength * 0.95, bevelEnabled: false };
        const sideGeometry = new THREE.ExtrudeGeometry(sideShape, extrudeSettings);
        sideGeometry.rotateY(Math.PI / 2);
        sideGeometry.rotateX(-Math.PI / 2);
        sideGeometry.translate(0, -hullHeight * 0.5, 0);
        
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50, // Dark blue-gray hull
            roughness: 0.6,
            metalness: 0.2
        });
        
        // For now, skip shader modifications to avoid compilation errors
        // The geometry improvements (beveled hull, pointed bow) will provide visual improvement
        
        // Bottom hull plate
        const bottomGeometry = new THREE.BoxGeometry(boatWidth * 0.85, 0.05, boatLength * 0.9);
        const bottom = new THREE.Mesh(bottomGeometry, hullMaterial);
        bottom.position.y = -hullHeight * 0.5;
        boatGroup.add(bottom);
        
        // Left side hull
        const leftSide = new THREE.Mesh(sideGeometry, hullMaterial);
        leftSide.position.set(-boatWidth * 0.42, 0, 0);
        boatGroup.add(leftSide);
        
        // Right side hull (mirror)
        const rightSideGeometry = sideGeometry.clone();
        rightSideGeometry.scale(-1, 1, 1);
        const rightSide = new THREE.Mesh(rightSideGeometry, hullMaterial);
        rightSide.position.set(boatWidth * 0.42, 0, 0);
        boatGroup.add(rightSide);
        
        // Stern deck (white, sunken below gunwales)
        const deckMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5f5f5, // White deck
            roughness: 0.7,
            metalness: 0.1
        });
        
        const deckThickness = 0.06;
        const deckGeometry = new THREE.BoxGeometry(boatWidth * 0.9, deckThickness, boatLength * 0.9);
        const deck = new THREE.Mesh(deckGeometry, deckMaterial);
        // Lower deck to create boat interior
        deck.position.y = hullHeight * 0.35;
        deck.castShadow = true;
        deck.receiveShadow = true;
        boatGroup.add(deck);
        
        // Exact top surface (center + half height)
        const deckTopLocal = deck.position.y + deckThickness * 0.5;
        // Store for getSurfacePosition
        boatGroup.userData.deckTopLocal = deckTopLocal;
        
        // Transom (back wall of boat) - positioned at the front where cat stands
        // Since boat is 14 units deep, place transom at front (positive Z) so cat doesn't see back end
        const transomGeometry = new THREE.BoxGeometry(boatWidth * 0.85, hullHeight * 0.8, 0.12);
        const transom = new THREE.Mesh(transomGeometry, hullMaterial);
        transom.position.set(0, 0, boatLength * 0.45 - 0.06); // Position at front (positive Z)
        boatGroup.add(transom);
        
        // Bow (front of boat - pointed/tapered shape like small boat)
        const bowShape = new THREE.Shape();
        bowShape.moveTo(-boatWidth * 0.4, 0);
        bowShape.lineTo(boatWidth * 0.4, 0);
        bowShape.lineTo(boatWidth * 0.15, hullHeight * 0.7); // Tapers to point
        bowShape.lineTo(-boatWidth * 0.15, hullHeight * 0.7);
        bowShape.closePath();
        
        const bowExtrudeSettings = { depth: 0.2, bevelEnabled: false };
        const bowGeometry = new THREE.ExtrudeGeometry(bowShape, bowExtrudeSettings);
        bowGeometry.rotateX(-Math.PI / 2);
        bowGeometry.translate(0, -hullHeight * 0.15, 0);
        
        const bow = new THREE.Mesh(bowGeometry, hullMaterial);
        bow.position.set(0, 0, -boatLength * 0.5 + 0.1); // Position at back end (negative Z)
        bow.rotation.x = -Math.PI / 12; // Tilt forward slightly
        boatGroup.add(bow);
        
        // Gunwale "cap" - L-cap with chunkier proportions for large boat
        const gunwaleMaterial = new THREE.MeshStandardMaterial({
            color: 0x34495e, // Slightly lighter than hull
            roughness: 0.5,
            metalness: 0.1
        });
        
        const gunwaleHeight = 2.6;  // Increased to 2.6
        const gunwaleOut = 0.0;     // No outward overhang - align exactly with deck edge
        const gunwaleIn = 0.06;     // Inward overhang above the deck (same as small boat)
        const railThick = 0.30;     // Increased to 0.30
        
        // Sides (left/right) - shorten like small boat
        const sideLen = boatLength * 0.88; // Shortened to leave room for front/back rails
        const sideRailGeom = new THREE.BoxGeometry(railThick, gunwaleHeight, sideLen);
        
        // y at which the rail sits
        const railY = Math.max(deckTopLocal + 0.06, hullHeight * 0.5 + 0.02);
        
        // Deck edge position (deck width is boatWidth * 0.9, so edges are at ±boatWidth * 0.45)
        const deckEdge = boatWidth * 0.45; // Half of deck width (boatWidth * 0.9 / 2)
        
        // Left rail - align with deck edge
        const leftRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        leftRail.position.set(-deckEdge + railThick * 0.5, railY, 0); // Rail center aligns with deck edge
        leftRail.castShadow = true;
        leftRail.receiveShadow = true;
        boatGroup.add(leftRail);
        
        // Right rail - align with deck edge
        const rightRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        rightRail.position.set(deckEdge - railThick * 0.5, railY, 0); // Rail center aligns with deck edge
        rightRail.castShadow = true;
        rightRail.receiveShadow = true;
        boatGroup.add(rightRail);
        
        // Front & back rails - align with shortened side rails' ends
        // Make front rail match deck width exactly (deck is boatWidth * 0.9)
        const foreAftLen = boatWidth * 0.9; // Match deck width exactly
        const foreAftGeom = new THREE.BoxGeometry(foreAftLen, gunwaleHeight, railThick);
        
        // Side rails end at ±sideLen/2 = ±(boatLength * 0.88 * 0.5)
        const sideRailEndZ = (boatLength * 0.88) * 0.5; // End of side rail
        
        // Front rail (at transom, where cat stands - positive Z)
        const frontRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        const frontRailZ = sideRailEndZ + railThick * 0.5; // At front (positive Z)
        frontRail.position.set(0, railY, frontRailZ);
        frontRail.castShadow = true;
        frontRail.receiveShadow = true;
        boatGroup.add(frontRail);
        
        // Back rail (at bow end - negative Z)
        const backRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        const backRailZ = -sideRailEndZ - railThick * 0.5; // At back (negative Z)
        backRail.position.set(0, railY, backRailZ);
        backRail.castShadow = true;
        backRail.receiveShadow = true;
        boatGroup.add(backRail);
        
        // Inner coaming lip (chunkier for large boat)
        const coamH = gunwaleHeight * 0.65;
        const coamTh = 0.025;
        const coamY = deckTopLocal + coamH * 0.5;
        
        const coamSideGeom = new THREE.BoxGeometry(coamTh, coamH, sideLen * 0.98);
        const coamBackGeom = new THREE.BoxGeometry(foreAftLen * 0.98, coamH, coamTh);
        const coamMat = new THREE.MeshStandardMaterial({ 
            color: 0x4b2f16, 
            roughness: 0.7, 
            metalness: 0.05 
        });
        
        // Left inner lip - positioned inside deck edge
        const leftCoam = new THREE.Mesh(coamSideGeom, coamMat);
        leftCoam.position.set(-deckEdge + gunwaleIn, coamY, 0);
        leftCoam.castShadow = true;
        leftCoam.receiveShadow = true;
        boatGroup.add(leftCoam);
        
        // Right inner lip - positioned inside deck edge
        const rightCoam = new THREE.Mesh(coamSideGeom, coamMat);
        rightCoam.position.set(deckEdge - gunwaleIn, coamY, 0);
        rightCoam.castShadow = true;
        rightCoam.receiveShadow = true;
        boatGroup.add(rightCoam);
        
        // Front inner lip (at transom, where cat stands)
        const frontCoam = new THREE.Mesh(coamBackGeom, coamMat);
        frontCoam.position.set(0, coamY, frontRailZ - gunwaleIn);
        frontCoam.castShadow = true;
        frontCoam.receiveShadow = true;
        boatGroup.add(frontCoam);
        
        // Back inner lip (at bow end)
        const backCoam = new THREE.Mesh(coamBackGeom, coamMat);
        backCoam.position.set(0, coamY, backRailZ + gunwaleIn);
        backCoam.castShadow = true;
        backCoam.receiveShadow = true;
        boatGroup.add(backCoam);
        
        // Optional: Sheer clamp strip
        const sheerGeom = new THREE.BoxGeometry(0.02, 0.02, sideLen * 0.98);
        const sheerMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a2410, 
            roughness: 0.6 
        });
        
        const leftSheer = new THREE.Mesh(sheerGeom, sheerMat);
        leftSheer.position.set(-deckEdge + 0.01, railY - gunwaleHeight * 0.55, 0);
        leftSheer.castShadow = true;
        boatGroup.add(leftSheer);
        
        const rightSheer = new THREE.Mesh(sheerGeom, sheerMat);
        rightSheer.position.set(deckEdge - 0.01, railY - gunwaleHeight * 0.55, 0);
        rightSheer.castShadow = true;
        boatGroup.add(rightSheer);
        
        // Cleats for docking (larger for big boat)
        const cleatMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888, // Silver/gray metal
            roughness: 0.3,
            metalness: 0.8
        });
        
        // Large boat cleats (bigger and more substantial)
        const cleatGroup = new THREE.Group();
        const cleatBase = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.20), cleatMaterial);
        cleatBase.position.y = 0.025;
        cleatGroup.add(cleatBase);
        
        const cleatHorn1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.10), cleatMaterial);
        cleatHorn1.position.set(-0.05, 0.05, 0);
        cleatGroup.add(cleatHorn1);
        
        const cleatHorn2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.10), cleatMaterial);
        cleatHorn2.position.set(0.05, 0.05, 0);
        cleatGroup.add(cleatHorn2);
        
        // Front cleats (at transom where cat stands)
        const frontCleatLeft = cleatGroup.clone();
        frontCleatLeft.position.set(-deckEdge * 0.6, railY + gunwaleHeight * 0.4, frontRailZ - 0.1);
        frontCleatLeft.rotation.y = Math.PI / 2;
        boatGroup.add(frontCleatLeft);
        
        const frontCleatRight = cleatGroup.clone();
        frontCleatRight.position.set(deckEdge * 0.6, railY + gunwaleHeight * 0.4, frontRailZ - 0.1);
        frontCleatRight.rotation.y = Math.PI / 2;
        boatGroup.add(frontCleatRight);
        
        // Back cleats (at bow end)
        const backCleatLeft = cleatGroup.clone();
        backCleatLeft.position.set(-deckEdge * 0.6, railY + gunwaleHeight * 0.4, backRailZ + 0.1);
        backCleatLeft.rotation.y = -Math.PI / 2;
        boatGroup.add(backCleatLeft);
        
        const backCleatRight = cleatGroup.clone();
        backCleatRight.position.set(deckEdge * 0.6, railY + gunwaleHeight * 0.4, backRailZ + 0.1);
        backCleatRight.rotation.y = -Math.PI / 2;
        boatGroup.add(backCleatRight);
        
        // Multiple rod holders along gunwales (for storing rods)
        const rodHolderMat = new THREE.MeshStandardMaterial({
            color: 0x444444, // Dark gray
            roughness: 0.4,
            metalness: 0.7
        });
        const rodHolderGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.20, 12);
        
        // Left side rod holders (3-4 along the side)
        for (let i = 0; i < 3; i++) {
            const zPos = -boatLength * 0.25 + i * boatLength * 0.25;
            const leftRodHolder = new THREE.Mesh(rodHolderGeo, rodHolderMat);
            leftRodHolder.rotation.z = Math.PI / 2; // Horizontal
            leftRodHolder.position.set(-deckEdge * 0.85, railY + gunwaleHeight * 0.3, zPos);
            leftRodHolder.castShadow = true;
            boatGroup.add(leftRodHolder);
        }
        
        // Right side rod holders (3-4 along the side)
        for (let i = 0; i < 3; i++) {
            const zPos = -boatLength * 0.25 + i * boatLength * 0.25;
            const rightRodHolder = new THREE.Mesh(rodHolderGeo.clone(), rodHolderMat);
            rightRodHolder.rotation.z = Math.PI / 2; // Horizontal
            rightRodHolder.position.set(deckEdge * 0.85, railY + gunwaleHeight * 0.3, zPos);
            rightRodHolder.castShadow = true;
            boatGroup.add(rightRodHolder);
        }
        
        // Anchor winch system at bow (front where cat stands)
        const winchMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666, // Steel gray
            roughness: 0.4,
            metalness: 0.8
        });
        
        // Winch drum
        const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), winchMaterial);
        winchDrum.rotation.z = Math.PI / 2;
        winchDrum.position.set(0, railY + gunwaleHeight * 0.25, frontRailZ - 0.15);
        winchDrum.castShadow = true;
        boatGroup.add(winchDrum);
        
        // Winch support/mount
        const winchMount = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.12), winchMaterial);
        winchMount.position.set(0, railY + gunwaleHeight * 0.25 - 0.04, frontRailZ - 0.15);
        winchMount.castShadow = true;
        boatGroup.add(winchMount);
        
        // Fish box/well (storage area on deck)
        const fishBoxMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5f5f5, // White like deck
            roughness: 0.7,
            metalness: 0.1
        });
        
        const fishBoxWidth = boatWidth * 0.5;
        const fishBoxDepth = boatLength * 0.15;
        const fishBoxHeight = 0.25;
        
        // Fish box sides
        const fishBoxSide = new THREE.Mesh(new THREE.BoxGeometry(0.04, fishBoxHeight, fishBoxDepth), deckMaterial);
        // Left side
        const fishBoxLeft = fishBoxSide.clone();
        fishBoxLeft.position.set(-fishBoxWidth * 0.5, deckTopLocal + fishBoxHeight * 0.5, -boatLength * 0.25);
        fishBoxLeft.castShadow = true;
        boatGroup.add(fishBoxLeft);
        // Right side
        const fishBoxRight = fishBoxSide.clone();
        fishBoxRight.position.set(fishBoxWidth * 0.5, deckTopLocal + fishBoxHeight * 0.5, -boatLength * 0.25);
        fishBoxRight.castShadow = true;
        boatGroup.add(fishBoxRight);
        // Front
        const fishBoxFront = new THREE.Mesh(new THREE.BoxGeometry(fishBoxWidth, fishBoxHeight, 0.04), deckMaterial);
        fishBoxFront.position.set(0, deckTopLocal + fishBoxHeight * 0.5, -boatLength * 0.25 + fishBoxDepth * 0.5);
        fishBoxFront.castShadow = true;
        boatGroup.add(fishBoxFront);
        // Back
        const fishBoxBack = fishBoxFront.clone();
        fishBoxBack.position.set(0, deckTopLocal + fishBoxHeight * 0.5, -boatLength * 0.25 - fishBoxDepth * 0.5);
        boatGroup.add(fishBoxBack);
        
        // Drain scuppers (larger for big boat)
        const scupperGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8);
        const scupperMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.9,
            metalness: 0.2
        });
        
        // Multiple scuppers along deck edges
        for (let i = 0; i < 4; i++) {
            const zPos = -boatLength * 0.3 + i * boatLength * 0.2;
            // Left side
            const leftScupper = new THREE.Mesh(scupperGeo, scupperMat);
            leftScupper.rotation.x = Math.PI / 2;
            leftScupper.position.set(-deckEdge * 0.8, deckTopLocal - 0.04, zPos);
            boatGroup.add(leftScupper);
            // Right side
            const rightScupper = new THREE.Mesh(scupperGeo.clone(), scupperMat);
            rightScupper.rotation.x = Math.PI / 2;
            rightScupper.position.set(deckEdge * 0.8, deckTopLocal - 0.04, zPos);
            boatGroup.add(rightScupper);
        }
        
        // Realistic details for large boat
        // Anchor chain visible hanging from winch (thicker chain for large boat)
        const chainMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, // Darker gray for heavy-duty chain
            roughness: 0.9,
            metalness: 0.85
        });
        // Chain links hanging from winch drum
        for (let i = 0; i < 4; i++) {
            const chainLink = new THREE.Mesh(
                new THREE.TorusGeometry(0.025, 0.012, 8, 12),
                chainMaterial
            );
            chainLink.rotation.z = Math.PI / 2;
            chainLink.position.set(0, deckTopLocal + 0.15 - 0.03 - i * 0.05, boatLength * 0.15 - 0.2);
            boatGroup.add(chainLink);
        }
        
        // Mooring ropes wrapped around cleats (thicker ropes for large boat)
        const largeMooringRopeMat = new THREE.MeshStandardMaterial({
            color: 0x8b7355, // Brown/tan rope
            roughness: 0.9,
            metalness: 0.0
        });
        // Rope wrapped around front and back cleats
        for (let side = 0; side < 2; side++) {
            const xSide = side === 0 ? -1 : 1;
            const cleatX = deckEdge * 0.6 * xSide;
            
            // Front cleats (transom)
            const frontCleatZ = frontRailZ - 0.1;
            for (let i = 0; i < 2; i++) {
                const frontRopeLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.05, 0.015, 8, 16),
                    largeMooringRopeMat
                );
                frontRopeLoop.rotation.x = Math.PI / 2;
                frontRopeLoop.position.set(cleatX + (i - 0.5) * 0.08, railY + gunwaleHeight * 0.4 + 0.03, frontCleatZ);
                boatGroup.add(frontRopeLoop);
            }
            
            // Back cleats (bow)
            const backCleatZ = backRailZ + 0.1;
            for (let i = 0; i < 2; i++) {
                const backRopeLoop = new THREE.Mesh(
                    new THREE.TorusGeometry(0.05, 0.015, 8, 16),
                    largeMooringRopeMat
                );
                backRopeLoop.rotation.x = Math.PI / 2;
                backRopeLoop.position.set(cleatX + (i - 0.5) * 0.08, railY + gunwaleHeight * 0.4 + 0.03, backCleatZ);
                boatGroup.add(backRopeLoop);
            }
        }
        
        // Navigation lights (stern light - white, larger for big boat)
        const largeNavLightMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xbbbbbb,
            emissiveIntensity: 0.4,
            roughness: 0.2,
            metalness: 0.8
        });
        const largeNavLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 10, 10),
            largeNavLightMat
        );
        largeNavLight.position.set(0, railY + gunwaleHeight * 0.65, backRailZ - 0.2);
        boatGroup.add(largeNavLight);
        
        // Bow light at actual bow (back of boat, not transom)
        // On large boat: frontRailZ is transom (where cat stands), backRailZ is bow
        // Bow light should be at bow (backRailZ), not transom
        const bowLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.10, 10, 10), // Much larger: 0.10 radius (was 0.05)
            new THREE.MeshStandardMaterial({
                color: 0xff3333, // Brighter red
                emissive: 0xcc0000,
                emissiveIntensity: 0.5, // Brighter
                roughness: 0.2,
                metalness: 0.8
            })
        );
        // Position at bow (backRailZ is the bow end of the boat, opposite transom)
        bowLight.position.set(0, railY + gunwaleHeight * 0.7, backRailZ - 0.2);
        bowLight.castShadow = true;
        boatGroup.add(bowLight);
        
        // Additional visible detail: Anchor chain hanging from winch at front/transom
        // Make chain more visible and positioned near where cat can see it
        // Reuse chainMaterial that was already declared above at line 1116
        // Chain links hanging from winch (near front where cat stands) - larger and more visible
        for (let i = 0; i < 5; i++) {
            const chainLink = new THREE.Mesh(
                new THREE.TorusGeometry(0.040, 0.018, 10, 14), // Larger chain links
                chainMaterial // Reuse existing chainMaterial
            );
            chainLink.rotation.z = Math.PI / 2;
            // Position near winch at front/transom (positive Z, visible to cat)
            chainLink.position.set(0, deckTopLocal + 0.15 - 0.03 - i * 0.05, boatLength * 0.15 - 0.2);
            chainLink.castShadow = true;
            boatGroup.add(chainLink);
        }
        
        // Fighting chair (game chair) - positioned directly behind cat for aesthetics
        const chairGroup = new THREE.Group();
        
        // Chair materials - authentic fighting chair colors
        // Teak wood frame (warm golden-brown)
        const chairFrameMaterial = new THREE.MeshStandardMaterial({
            color: 0xb8864f, // Teak wood - warm golden brown
            roughness: 0.7, // Slightly glossy wood finish
            metalness: 0.0
        });
        
        // White/cream marine-grade upholstery for cushions
        const chairSeatMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5f5dc, // Cream/off-white marine upholstery
            roughness: 0.9, // Fabric-like matte finish
            metalness: 0.0
        });
        
        const chairBackMaterial = new THREE.MeshStandardMaterial({
            color: 0xf5f5dc, // Same cream upholstery for back
            roughness: 0.9,
            metalness: 0.0
        });
        
        // Polished stainless steel for rod holders and metal parts
        const rodHolderMaterial = new THREE.MeshStandardMaterial({
            color: 0xc0c0c0, // Bright silver stainless steel
            roughness: 0.2, // Polished, reflective finish
            metalness: 0.9 // Highly metallic
        });
        
        // Stainless steel for armrests and footrest
        const stainlessSteelMaterial = new THREE.MeshStandardMaterial({
            color: 0xd0d0d0, // Bright stainless steel
            roughness: 0.25, // Polished but slightly brushed
            metalness: 0.85 // Very metallic for depth
        });
        
        // Base pedestal (swivel mount) - 3x original size (2x then +50%)
        const pedestalHeight = 0.45; // Was 0.30, original 0.15
        const pedestalRadius = 0.36; // Was 0.24, original 0.12
        const pedestalGeometry = new THREE.CylinderGeometry(pedestalRadius, pedestalRadius * 1.2, pedestalHeight, 16);
        const pedestal = new THREE.Mesh(pedestalGeometry, chairFrameMaterial);
        pedestal.position.y = deckTopLocal + pedestalHeight * 0.5;
        pedestal.castShadow = true;
        pedestal.receiveShadow = true;
        chairGroup.add(pedestal);
        
        // Footrest platform (attached to pedestal) - 3x original size - stainless steel
        const footrestWidth = 1.2; // Was 0.8, original 0.4
        const footrestDepth = 1.05; // Was 0.7, original 0.35
        const footrestThickness = 0.12; // Was 0.08, original 0.04
        const footrestGeometry = new THREE.BoxGeometry(footrestWidth, footrestThickness, footrestDepth);
        const footrest = new THREE.Mesh(footrestGeometry, stainlessSteelMaterial); // Stainless steel footrest
        footrest.position.set(0, deckTopLocal + 0.24, 0); // Adjusted for larger pedestal
        footrest.castShadow = true;
        footrest.receiveShadow = true;
        chairGroup.add(footrest);
        
        // Seat (circular, slightly padded) - 3x original size
        const seatRadius = 0.66; // Was 0.44, original 0.22
        const seatThickness = 0.18; // Was 0.12, original 0.06
        const seatGeometry = new THREE.CylinderGeometry(seatRadius, seatRadius, seatThickness, 16);
        const seat = new THREE.Mesh(seatGeometry, chairSeatMaterial);
        seat.position.y = deckTopLocal + pedestalHeight + seatThickness * 0.5;
        seat.rotation.x = Math.PI / 2; // Rotate to horizontal
        seat.castShadow = true;
        seat.receiveShadow = true;
        chairGroup.add(seat);
        
        // Backrest (high, curved) - 3x original size
        const backrestHeight = 1.35; // Was 0.90, original 0.45
        const backrestWidth = 1.2; // Was 0.8, original 0.4
        const backrestThickness = 0.24; // Was 0.16, original 0.08
        const backrestGeometry = new THREE.BoxGeometry(backrestWidth, backrestHeight, backrestThickness);
        const backrest = new THREE.Mesh(backrestGeometry, chairBackMaterial);
        backrest.position.set(0, deckTopLocal + pedestalHeight + backrestHeight * 0.5 + 0.3, -backrestThickness * 0.5);
        backrest.castShadow = true;
        backrest.receiveShadow = true;
        chairGroup.add(backrest);
        
        // Backrest frame/supports (wooden posts on sides) - 3x original size
        const supportWidth = 0.09; // Was 0.06, original 0.03
        const supportHeight = backrestHeight * 1.1;
        const supportDepth = 0.18; // Was 0.12, original 0.06
        const supportGeometry = new THREE.BoxGeometry(supportWidth, supportHeight, supportDepth);
        
        // Left support
        const leftSupport = new THREE.Mesh(supportGeometry, chairFrameMaterial);
        leftSupport.position.set(-backrestWidth * 0.5 + supportWidth * 0.5, deckTopLocal + pedestalHeight + supportHeight * 0.5 + 0.3, -supportDepth * 0.5);
        leftSupport.castShadow = true;
        chairGroup.add(leftSupport);
        
        // Right support
        const rightSupport = new THREE.Mesh(supportGeometry, chairFrameMaterial);
        rightSupport.position.set(backrestWidth * 0.5 - supportWidth * 0.5, deckTopLocal + pedestalHeight + supportHeight * 0.5 + 0.3, -supportDepth * 0.5);
        rightSupport.castShadow = true;
        chairGroup.add(rightSupport);
        
        // Armrests (with rod holders) - 3x original size - stainless steel armrests
        const armrestWidth = 0.36; // Was 0.24, original 0.12
        const armrestDepth = 0.75; // Was 0.50, original 0.25
        const armrestThickness = 0.12; // Was 0.08, original 0.04
        const armrestHeight = 0.96; // Was 0.64, original 0.32
        const armrestGeometry = new THREE.BoxGeometry(armrestWidth, armrestThickness, armrestDepth);
        
        // Left armrest - stainless steel
        const leftArmrest = new THREE.Mesh(armrestGeometry, stainlessSteelMaterial);
        leftArmrest.position.set(-backrestWidth * 0.5 - armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight, armrestDepth * 0.25);
        leftArmrest.castShadow = true;
        leftArmrest.receiveShadow = true;
        chairGroup.add(leftArmrest);
        
        // Left armrest support post - teak wood
        const leftArmSupport = new THREE.Mesh(new THREE.BoxGeometry(0.075, armrestHeight, 0.075), chairFrameMaterial); // Was 0.05, original 0.025
        leftArmSupport.position.set(-backrestWidth * 0.5 - armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight * 0.5, armrestDepth * 0.25);
        leftArmSupport.castShadow = true;
        chairGroup.add(leftArmSupport);
        
        // Left rod holder (on armrest) - 3x original size - stainless steel
        const rodHolderGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12); // Was 0.06 radius, 0.12 depth
        const leftRodHolder = new THREE.Mesh(rodHolderGeometry, rodHolderMaterial);
        leftRodHolder.rotation.x = Math.PI / 2;
        leftRodHolder.position.set(-backrestWidth * 0.5 - armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight + armrestThickness * 0.5 + 0.09, armrestDepth * 0.25); // Was 0.06
        leftRodHolder.castShadow = true;
        chairGroup.add(leftRodHolder);
        
        // Right armrest - stainless steel
        const rightArmrest = new THREE.Mesh(armrestGeometry, stainlessSteelMaterial);
        rightArmrest.position.set(backrestWidth * 0.5 + armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight, armrestDepth * 0.25);
        rightArmrest.castShadow = true;
        rightArmrest.receiveShadow = true;
        chairGroup.add(rightArmrest);
        
        // Right armrest support post - teak wood
        const rightArmSupport = new THREE.Mesh(new THREE.BoxGeometry(0.075, armrestHeight, 0.075), chairFrameMaterial); // Was 0.05, original 0.025
        rightArmSupport.position.set(backrestWidth * 0.5 + armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight * 0.5, armrestDepth * 0.25);
        rightArmSupport.castShadow = true;
        chairGroup.add(rightArmSupport);
        
        // Right rod holder (on armrest) - 3x original size - stainless steel
        const rightRodHolder = new THREE.Mesh(rodHolderGeometry, rodHolderMaterial);
        rightRodHolder.rotation.x = Math.PI / 2;
        rightRodHolder.position.set(backrestWidth * 0.5 + armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight + armrestThickness * 0.5 + 0.09, armrestDepth * 0.25); // Was 0.06
        rightRodHolder.castShadow = true;
        chairGroup.add(rightRodHolder);
        
        // Harness attachment point (bar above backrest) - 3x original size
        const harnessBarLength = backrestWidth + 0.3; // Was + 0.2, original + 0.1
        const harnessBarGeometry = new THREE.CylinderGeometry(0.045, 0.045, harnessBarLength, 12); // Was 0.03, original 0.015
        const harnessBar = new THREE.Mesh(harnessBarGeometry, chairFrameMaterial);
        harnessBar.rotation.z = Math.PI / 2;
        harnessBar.position.set(0, deckTopLocal + pedestalHeight + backrestHeight + 0.45, -backrestThickness * 0.5); // Was + 0.30, original + 0.15
        harnessBar.castShadow = true;
        chairGroup.add(harnessBar);
        
        // Position chair directly behind cat
        // Cat stands at largeBoatDepth * 0.28 (near front edge, positive Z)
        // Place chair closer to cat but behind him (positive Z, but less than cat's position)
        const chairZ = boatLength * 0.15; // Position behind cat, closer to center (positive Z but less than 0.28)
        chairGroup.position.set(0, 0, chairZ);
        boatGroup.add(chairGroup);
        
        this.platformMesh = boatGroup;
        
        // Position boat: same position as small boat and dock
        // Center at z=-1.5 (same as small boat and dock)
        // Front edge will be at -1.5 + 7 = 5.5 (same as small boat and dock)
        // Use higher base Y to prevent dipping below water during rocking
        this.platformMesh.position.set(0, this.water.waterY + 0.35, -1.5); // Same position as small boat
        this.platformMesh.castShadow = true;
        this.platformMesh.receiveShadow = true;
        
        // Store initial rotation for animation
        this.platformMesh.userData.initialRotation = new THREE.Euler(0, 0, 0);
    }
    
    /**
     * Get surface position where cat should stand
     */
    getSurfacePosition() {
        if (!this.platformMesh) {
            // Fallback if no platform
            return new THREE.Vector3(0, 0.36, 3.4);
        }
        
        switch (this.currentPlatformType) {
            case 'DOCK':
                // Position cat near front edge of dock (water side)
                // Dock top is at raisedDockY (waterY + 1.0), cat should stand on top of dock surface
                // Since dockGroup position.y = 0 and dockGroup.position.z = -1.5,
                // dock top is at: waterY + 1.0 (1.0 units above water)
                const dockTopY = this.water.waterY + 1.0; // Dock top position (1.0 units above water)
                // Position cat so its feet sit on dock surface (no gap for shadow alignment)
                // Model origin is likely at feet/ground level, so position directly on dock top
                const catStandingHeight = dockTopY; // Cat's feet on dock surface (removed 0.01 offset to eliminate gap)
                return new THREE.Vector3(
                    this.platformMesh.position.x,
                    catStandingHeight,
                    this.platformMesh.position.z + this.dockDepth * 0.35 // Near front edge
                );
            
            case 'SMALL_BOAT': {
                // Cat stands "in" the boat on the deck surface
                const deckTopLocal = this.platformMesh.userData.deckTopLocal || (0.2 * 0.35 + 0.04 * 0.5); // Fallback calculation
                const local = new THREE.Vector3(
                    0, 
                    deckTopLocal + 0.03, // Tiny clearance to keep feet from z-fighting
                    this.smallBoatDepth * 0.28 // Near front edge
                );
                this.platformMesh.updateMatrixWorld(true);
                return local.applyMatrix4(this.platformMesh.matrixWorld);
            }
            
            case 'LARGE_BOAT': {
                // Cat stands "in" the boat on the deck surface, at the front edge (like small boat)
                const deckTopLocal = this.platformMesh.userData.deckTopLocal || (0.25 * 0.35 + 0.06 * 0.5); // Fallback: hullHeight 0.25, deckThickness 0.06
                const local = new THREE.Vector3(
                    0, 
                    deckTopLocal + 0.03, // Tiny clearance to keep feet from z-fighting
                    this.largeBoatDepth * 0.28 // Same position as small boat - near front edge
                );
                this.platformMesh.updateMatrixWorld(true);
                return local.applyMatrix4(this.platformMesh.matrixWorld);
            }
            
            default:
                return new THREE.Vector3(0, 0.36, 3.4);
        }
    }
    
    /**
     * Update platform animation (wave rocking for boats)
     */
    updatePlatform(delta) {
        if (!this.platformMesh || !this.currentPlatformType) return;
        
        // Dock doesn't animate
        if (this.currentPlatformType === 'DOCK') {
            return;
        }
        
        // Update wave time
        this.waveTime += delta;
        
        // Calculate wave phase (use same approach as water shader)
        // Use multiple frequencies for more natural motion
        const wave1Phase = this.waveTime * 2.0; // Primary wave
        const wave2Phase = this.waveTime * 1.5; // Secondary wave
        const wave3Phase = this.waveTime * 2.5; // Tertiary wave
        
        // Calculate pitch (front/back tilt) and roll (side tilt)
        let pitch = 0;
        let roll = 0;
        let yOffset = 0;
        
        if (this.currentPlatformType === 'SMALL_BOAT') {
            // Small boat: Gentle rocking (much slower and subtler)
            // Slow down wave phases significantly
            const slowWave1Phase = this.waveTime * 0.8; // Slower primary wave
            const slowWave2Phase = this.waveTime * 0.6; // Slower secondary wave
            const slowWave3Phase = this.waveTime * 0.9; // Slower tertiary wave
            
            pitch = Math.sin(slowWave1Phase) * 0.05 + Math.sin(slowWave2Phase) * 0.02; // ~4 degrees max (reduced from ~10)
            roll = Math.cos(slowWave1Phase * 0.8) * 0.03 + Math.sin(slowWave3Phase) * 0.02; // ~3 degrees max (reduced from ~8)
            yOffset = Math.sin(slowWave1Phase * 1.2) * 0.01; // Very small up/down motion (reduced from 0.03)
        } else if (this.currentPlatformType === 'LARGE_BOAT') {
            // Large boat: Gentler rocking (slower like small boat to prevent deck dipping)
            // Slow down wave phases significantly like small boat
            const slowWave1Phase = this.waveTime * 0.6; // Even slower than small boat
            const slowWave2Phase = this.waveTime * 0.5; // Slower secondary wave
            const slowWave3Phase = this.waveTime * 0.7; // Slower tertiary wave
            
            pitch = Math.sin(slowWave1Phase) * 0.04 + Math.sin(slowWave2Phase) * 0.015; // ~3 degrees max (reduced)
            roll = Math.cos(slowWave1Phase * 0.8) * 0.03 + Math.sin(slowWave3Phase) * 0.015; // ~2 degrees max (reduced)
            yOffset = Math.sin(slowWave1Phase * 1.2) * 0.008; // Very small up/down motion (reduced from 0.015)
        }
        
        // Apply rotations (convert to radians)
        this.platformMesh.rotation.x = pitch; // Pitch (front/back)
        this.platformMesh.rotation.z = roll; // Roll (side to side)
        
        // Apply vertical oscillation
        // Ensure boat never goes below water surface
        const baseY = this.currentPlatformType === 'SMALL_BOAT' 
            ? this.water.waterY + 0.35  // Much higher base to prevent dipping below water
            : this.water.waterY + 0.35; // Same high base for large boat to prevent deck dipping
        this.platformMesh.position.y = baseY + yOffset;
    }
    
    /**
     * Switch to a different platform type
     */
    switchPlatform(newType) {
        console.log('[PLATFORM] switchPlatform called with:', newType, 'Current type:', this.currentPlatformType);
        
        // For dock platforms, always recreate if switching between POND and RIVER (same platform type but different styles)
        const isDock = newType === 'DOCK';
        const wasDock = this.currentPlatformType === 'DOCK';
        const waterType = this.water?.waterBodyType;
        const previousWaterType = this.previousWaterType;
        
        if (newType === this.currentPlatformType) {
            // If both are docks but water type changed (POND vs RIVER), force recreation
            if (isDock && wasDock && waterType !== previousWaterType) {
                console.log('[PLATFORM] Dock platform type same but water type changed (', previousWaterType, '->', waterType, '), recreating dock');
                this.previousWaterType = waterType;
                this.createPlatform(newType);
                console.log('[PLATFORM] Platform created. Current type:', this.currentPlatformType);
                return;
            }
            console.log('[PLATFORM] Already on this platform type, skipping');
            return; // Already on this platform
        }
        
        console.log('[PLATFORM] Creating new platform:', newType);
        this.previousWaterType = waterType; // Store current water type
        this.createPlatform(newType);
        console.log('[PLATFORM] Platform created. Current type:', this.currentPlatformType);
    }
    
    /**
     * Get current platform mesh (for shadows, etc.)
     */
    getPlatformMesh() {
        return this.platformMesh;
    }
    
    /**
     * Get current platform type
     */
    getPlatformType() {
        return this.currentPlatformType;
    }
}
