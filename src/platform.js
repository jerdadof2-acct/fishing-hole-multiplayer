import * as THREE from 'three';
import {
    PORTRAIT_CAMERA_OFFSET,
    PORTRAIT_CAMERA_OFFSET_LARGE_BOAT
} from './config/idlePortrait.js';
import { buildStylizedDock } from './scene/stylizedDock.js';

function makeBox(w, h, d, mat, x, y, z, name = '') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (name) mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function makeCyl(radius, length, mat, x, y, z, rot = {}, name = '', segments = 10) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, segments),
        mat
    );
    mesh.position.set(x, y, z);
    mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    if (name) mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

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
        const waterType = this.water?.waterBodyType || 'LAKE';
        console.log('[DOCK] Creating stylized dock - waterBodyType:', waterType);

        this.platformMesh = buildStylizedDock({
            water: this.water,
            dockWidth: this.dockWidth,
            dockDepth: this.dockDepth,
            dockHeight: this.dockHeight,
            waterBodyType: waterType
        });
    }
    
    /**
     * Create small boat (center section only) for lakes
     */
    createSmallBoat() {
        // Create boat as a group so we can animate rotation
        const boatGroup = new THREE.Group();
        boatGroup.name = 'smallBoat-root';
        
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
        const smallBottomWidth = Math.max(0.1, boatWidth * 0.78);
        const smallBottomLength = boatLength * 0.82;
        const bottomGeometry = new THREE.BoxGeometry(smallBottomWidth, 0.03, smallBottomLength);
        const bottom = new THREE.Mesh(bottomGeometry, hullMaterial);
        bottom.name = 'smallBoat-bottom';
        bottom.position.y = -hullHeight * 0.5 + 0.008;
        boatGroup.add(bottom);
        
        const sideWallThickness = 0.05;
        const sideWallHeight = hullHeight;
        const sideWallLength = smallBottomLength - 0.1;
        const sideWallGeometry = new THREE.BoxGeometry(sideWallThickness, sideWallHeight, sideWallLength);

        const leftWall = new THREE.Mesh(sideWallGeometry, hullMaterial);
        leftWall.name = 'smallBoat-leftHull';
        leftWall.position.set(-(smallBottomWidth * 0.5 - sideWallThickness * 0.5), -hullHeight * 0.5 + sideWallHeight * 0.5, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        boatGroup.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry.clone(), hullMaterial);
        rightWall.name = 'smallBoat-rightHull';
        rightWall.position.set(smallBottomWidth * 0.5 - sideWallThickness * 0.5, -hullHeight * 0.5 + sideWallHeight * 0.5, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        boatGroup.add(rightWall);

        const smallEndThickness = 0.05;
        const smallEndWidth = smallBottomWidth - 0.06;
        const smallEndGeometry = new THREE.BoxGeometry(smallEndWidth, sideWallHeight, smallEndThickness);

        const smallFrontWall = new THREE.Mesh(smallEndGeometry, hullMaterial);
        smallFrontWall.name = 'smallBoat-frontHull';
        smallFrontWall.position.set(0, -hullHeight * 0.5 + sideWallHeight * 0.5, smallBottomLength * 0.5 - smallEndThickness * 0.5);
        // Disable shadow casting to prevent visible shadow seams on deck
        smallFrontWall.castShadow = false;
        smallFrontWall.receiveShadow = true;
        boatGroup.add(smallFrontWall);

        const smallBackWall = new THREE.Mesh(smallEndGeometry.clone(), hullMaterial);
        smallBackWall.name = 'smallBoat-backHull';
        smallBackWall.position.set(0, -hullHeight * 0.5 + sideWallHeight * 0.5, -smallBottomLength * 0.5 + smallEndThickness * 0.5);
        smallBackWall.castShadow = true;
        smallBackWall.receiveShadow = true;
        boatGroup.add(smallBackWall);

        // Gunwale rail span (computed early — transom/bow must match rail width)
        const hullOuterEdge = boatWidth * 0.42 + 0.03;
        const railThick = 0.08;
        const railCenterX = hullOuterEdge - 0.04 - railThick * 0.5;
        const sideLen = boatLength * 0.88;
        const sideRailEndZ = sideLen * 0.5;
        const frontRailZ = sideRailEndZ + railThick * 0.5;
        const backRailZ = -sideRailEndZ - railThick * 0.5;
        
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
        bow.position.set(0, 0, frontRailZ);
        bow.rotation.x = -Math.PI / 12;
        boatGroup.add(bow);
        
        // Deck — solid box spanning gunwale rails (was shorter than rails, leaving stern gaps when pitching)
        const deckWidth = Math.max(0.1, hullOuterEdge * 2 - 0.3);
        const deckSpanZ = sideLen * 0.96;
        const deckTopLocal = hullHeight * 0.35 + deckThickness * 0.5;
        const deckTop = new THREE.Mesh(
            new THREE.BoxGeometry(deckWidth - 0.04, deckThickness, deckSpanZ),
            deckMaterial
        );
        deckTop.name = 'smallBoat-deck';
        deckTop.position.set(0, deckTopLocal, 0);
        deckTop.castShadow = true;
        deckTop.receiveShadow = true;
        boatGroup.add(deckTop);

        const deck = deckTop;
        boatGroup.userData.deckTopLocal = deckTopLocal;
        boatGroup.userData.deckThickness = deckThickness;

        const smallDeckSurfaceY = deckTopLocal + deckThickness * 0.5;
        const smallCatStand = new THREE.Object3D();
        smallCatStand.name = 'smallBoat-catStand';
        smallCatStand.position.set(0, smallDeckSurfaceY + 0.02, boatLength * 0.28);
        boatGroup.add(smallCatStand);
        boatGroup.userData.catStandMarker = smallCatStand;

        // Transom — full height from hull floor to deck underside, flush with back rail
        const transomWidth = Math.min(boatWidth * 0.85, railCenterX * 2 - 0.05);
        const hullFloorY = -hullHeight * 0.5;
        const deckBottomY = deckTopLocal - deckThickness * 0.5;
        const transomHeight = deckBottomY - hullFloorY + 0.03;
        const transom = new THREE.Mesh(
            new THREE.BoxGeometry(transomWidth, transomHeight, railThick + 0.06),
            hullMaterial
        );
        transom.name = 'smallBoat-transom';
        transom.position.set(0, hullFloorY + transomHeight * 0.5, backRailZ);
        transom.castShadow = true;
        transom.receiveShadow = true;
        boatGroup.add(transom);

        // Stern cap — seals the deck edge to the transom top (blocks water when boat pitches)
        const sternCap = new THREE.Mesh(
            new THREE.BoxGeometry(deckWidth - 0.02, deckThickness + 0.02, railThick + 0.08),
            deckMaterial
        );
        sternCap.name = 'smallBoat-sternCap';
        sternCap.position.set(0, deckTopLocal, backRailZ);
        sternCap.castShadow = true;
        sternCap.receiveShadow = true;
        boatGroup.add(sternCap);

        // Bow cap — same seal at the front rail
        const bowCap = new THREE.Mesh(
            new THREE.BoxGeometry(deckWidth - 0.02, deckThickness + 0.02, railThick + 0.08),
            deckMaterial
        );
        bowCap.name = 'smallBoat-bowCap';
        bowCap.position.set(0, deckTopLocal, frontRailZ);
        bowCap.castShadow = true;
        bowCap.receiveShadow = true;
        boatGroup.add(bowCap);
        
        // Gunwale "cap" - L-cap that overlaps both hull and deck
        const gunwaleMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a3a1a, // Darker wood
            roughness: 0.6,
            metalness: 0.05
        });
        
        const gunwaleHeight = 1.1;       // Slightly taller for defined edge
        const gunwaleOut = 0.0;           // No outward overhang - align exactly with hull
        const gunwaleIn = 0.06;           // Inward overhang above the deck
        // railThick, railCenterX, sideLen, frontRailZ, backRailZ defined above
        
        // Sides (left/right) - shorten them to leave room for front/back rails
        const sideRailGeom = new THREE.BoxGeometry(railThick, gunwaleHeight, sideLen);
        
        // y at which the rail sits so it clearly caps the hull and rises above the deck
        const railY = Math.max(deckTopLocal + 0.06, hullHeight * 0.5 + 0.02);
        
        // Left rail: move slightly outward to increase space between rails
        const leftRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        leftRail.name = 'smallBoat-leftRail';
        leftRail.position.set(-railCenterX, railY, 0);
        leftRail.castShadow = true;
        leftRail.receiveShadow = true;
        boatGroup.add(leftRail);
        
        // Right rail: move slightly outward to increase space between rails
        const rightRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        rightRail.name = 'smallBoat-rightRail';
        rightRail.position.set(railCenterX, railY, 0);
        rightRail.castShadow = true;
        rightRail.receiveShadow = true;
        boatGroup.add(rightRail);
        
        // Front & back rails (bow/transom) - align with shortened side rails' ends
        // Side rails now run from -sideLen/2 to +sideLen/2, where sideLen = boatLength * 0.88
        // Side rails end at ±(boatLength * 0.88 * 0.5) = ±(boatLength * 0.44)
        const foreAftLen = railCenterX * 2;
        const foreAftGeom = new THREE.BoxGeometry(foreAftLen, gunwaleHeight, railThick);
        
        const frontRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        frontRail.name = 'smallBoat-frontRail';
        frontRail.position.set(0, railY, frontRailZ);
        frontRail.castShadow = true;
        frontRail.receiveShadow = true;
        boatGroup.add(frontRail);
        
        const backRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        backRail.name = 'smallBoat-backRail';
        backRail.position.set(0, railY, backRailZ);
        backRail.castShadow = true;
        backRail.receiveShadow = true;
        boatGroup.add(backRail);

        // --- Small boat stern visual upgrade (visible rear / rowboat fishing detail) ---
        const sternWood = new THREE.MeshStandardMaterial({
            color: 0x7a4f28,
            roughness: 0.75,
            metalness: 0.03
        });
        const darkTrim = new THREE.MeshStandardMaterial({
            color: 0x3a2412,
            roughness: 0.7,
            metalness: 0.02
        });
        const ropeMat = new THREE.MeshStandardMaterial({
            color: 0x9a815f,
            roughness: 0.9,
            metalness: 0.0
        });
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x8d8d8d,
            roughness: 0.35,
            metalness: 0.65
        });
        const tackleBoxMat = new THREE.MeshStandardMaterial({
            color: 0x2f6f5e,
            roughness: 0.65,
            metalness: 0.05
        });

        const addSmallBoatBox = (w, h, d, mat, x, y, z, name = '') => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            mesh.position.set(x, y, z);
            if (name) mesh.name = name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            boatGroup.add(mesh);
            return mesh;
        };

        const addSmallBoatCyl = (r, len, mat, x, y, z, rot = {}, name = '') => {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
            mesh.position.set(x, y, z);
            mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
            if (name) mesh.name = name;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            boatGroup.add(mesh);
            return mesh;
        };

        const sternZ = backRailZ;
        const deckSurfaceY = smallDeckSurfaceY;

        addSmallBoatBox(
            deckWidth * 0.95,
            0.42,
            0.12,
            sternWood,
            0,
            deckSurfaceY + 0.20,
            sternZ + 0.02,
            'smallBoat-visible-stern-transom'
        );

        addSmallBoatBox(
            deckWidth,
            0.08,
            0.16,
            darkTrim,
            0,
            deckSurfaceY + 0.45,
            sternZ + 0.02,
            'smallBoat-stern-dark-cap'
        );

        addSmallBoatBox(
            0.16,
            0.55,
            0.16,
            darkTrim,
            -deckWidth * 0.46,
            deckSurfaceY + 0.30,
            sternZ + 0.05,
            'smallBoat-left-stern-post'
        );

        addSmallBoatBox(
            0.16,
            0.55,
            0.16,
            darkTrim,
            deckWidth * 0.46,
            deckSurfaceY + 0.30,
            sternZ + 0.05,
            'smallBoat-right-stern-post'
        );

        for (let i = -2; i <= 2; i++) {
            addSmallBoatBox(
                0.025,
                0.012,
                1.4,
                darkTrim,
                i * 0.32,
                deckSurfaceY + 0.018,
                sternZ + 0.75,
                'smallBoat-rear-plank-line'
            );
        }

        const sternRopeCoil = new THREE.Mesh(
            new THREE.TorusGeometry(0.18, 0.035, 10, 18),
            ropeMat
        );
        sternRopeCoil.name = 'smallBoat-stern-rope-coil';
        sternRopeCoil.rotation.x = -Math.PI / 2;
        sternRopeCoil.position.set(-deckWidth * 0.32, deckSurfaceY + 0.06, sternZ + 0.55);
        sternRopeCoil.castShadow = true;
        sternRopeCoil.receiveShadow = true;
        boatGroup.add(sternRopeCoil);

        addSmallBoatBox(
            0.55,
            0.26,
            0.34,
            tackleBoxMat,
            deckWidth * 0.30,
            deckSurfaceY + 0.14,
            sternZ + 0.60,
            'smallBoat-tackle-box'
        );

        addSmallBoatBox(
            0.58,
            0.05,
            0.36,
            metalMat,
            deckWidth * 0.30,
            deckSurfaceY + 0.30,
            sternZ + 0.60,
            'smallBoat-tackle-box-lid'
        );

        for (const side of [-1, 1]) {
            addSmallBoatCyl(
                0.035,
                2.4,
                sternWood,
                side * deckWidth * 0.42,
                deckSurfaceY + 0.18,
                sternZ + 1.05,
                { x: Math.PI / 2, z: side * 0.18 },
                'smallBoat-oar-handle'
            );

            addSmallBoatBox(
                0.16,
                0.035,
                0.42,
                sternWood,
                side * deckWidth * 0.42,
                deckSurfaceY + 0.16,
                sternZ + 2.15,
                'smallBoat-oar-paddle'
            );
        }
        
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
        leftCoam.position.set(-railCenterX + gunwaleIn, coamY, 0);
        leftCoam.castShadow = true;
        leftCoam.receiveShadow = true;
        boatGroup.add(leftCoam);
        
        // Right inner lip - positioned inside hull edge
        const rightCoam = new THREE.Mesh(coamSideGeom, coamMat);
        rightCoam.position.set(railCenterX - gunwaleIn, coamY, 0);
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
        leftSheer.position.set(-railCenterX + 0.01, railY - gunwaleHeight * 0.55, 0);
        leftSheer.castShadow = true;
        boatGroup.add(leftSheer);
        
        const rightSheer = new THREE.Mesh(sheerGeom, sheerMat);
        rightSheer.position.set(railCenterX - 0.01, railY - gunwaleHeight * 0.55, 0);
        rightSheer.castShadow = true;
        boatGroup.add(rightSheer);
        
        // Bench seats (multiple seats along the boat length - positioned on sunken deck)
        // Front bench (near where cat stands) - wider, deeper, raised, and with shadows
        const benchHalfSpan = Math.max(0.12, railCenterX - 0.12);
        const benchWidth = benchHalfSpan * 2;
        const frontBenchGeometry = new THREE.BoxGeometry(benchWidth, 0.08, 0.5); // Deeper from 0.3 to 0.5
        const frontBench = new THREE.Mesh(frontBenchGeometry, deckMaterial);
        frontBench.position.set(0, deckTopLocal + 0.20, boatLength * 0.15); // Raised 0.20 above deck
        frontBench.castShadow = true; // Enable shadow casting
        frontBench.receiveShadow = true; // Enable shadow receiving
        boatGroup.add(frontBench);
        
        // Middle bench - wider, deeper, raised, and with shadows
        const middleBenchGeometry = new THREE.BoxGeometry(benchWidth, 0.08, 0.5); // Deeper from 0.3 to 0.5
        const middleBench = new THREE.Mesh(middleBenchGeometry, deckMaterial);
        middleBench.position.set(0, deckTopLocal + 0.20, -boatLength * 0.15); // Raised 0.20 above deck
        middleBench.castShadow = true; // Enable shadow casting
        middleBench.receiveShadow = true; // Enable shadow receiving
        boatGroup.add(middleBench);
        
        // Back bench (near transom) - wider, deeper, raised, and with shadows
        const backBenchGeometry = new THREE.BoxGeometry(benchWidth, 0.08, 0.5); // Deeper from 0.3 to 0.5
        const backBench = new THREE.Mesh(backBenchGeometry, deckMaterial);
        backBench.position.set(0, deckTopLocal + 0.20, -boatLength * 0.4); // Raised 0.20 above deck
        backBench.castShadow = true; // Enable shadow casting
        backBench.receiveShadow = true; // Enable shadow receiving
        boatGroup.add(backBench);
        
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
        sternCleatLeft.position.set(-railCenterX * 0.7, railY + gunwaleHeight * 0.4, -boatLength * 0.88 * 0.5 - 0.1);
        sternCleatLeft.rotation.y = -Math.PI / 2; // Rotate to face backward
        boatGroup.add(sternCleatLeft);
        
        const sternCleatRight = cleatGroup.clone();
        sternCleatRight.position.set(railCenterX * 0.7, railY + gunwaleHeight * 0.4, -boatLength * 0.88 * 0.5 - 0.1);
        sternCleatRight.rotation.y = -Math.PI / 2;
        boatGroup.add(sternCleatRight);
        
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
        const anchorMount = new THREE.Mesh(anchorMountGeo, cleatMaterial);
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
            const cleatX = railCenterX * 0.7 * xSide;
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
        
        boatGroup.traverse((child) => {
            if (child.isMesh) {
                child.renderOrder = 5;
            }
        });
        
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
        
        const smallBoatBBox = new THREE.Box3().setFromObject(this.platformMesh);
        console.log(
            '[PLATFORM][SMALL_BOAT] BBox',
            {
                min: { x: smallBoatBBox.min.x.toFixed(3), z: smallBoatBBox.min.z.toFixed(3) },
                max: { x: smallBoatBBox.max.x.toFixed(3), z: smallBoatBBox.max.z.toFixed(3) }
            }
        );
        
        // Debug helper: report max extents to track down protruding geometry
        this.reportPlatformExtents(this.platformMesh, hullOuterEdge, 'SMALL_BOAT', boatLength);
        
        // Store initial rotation for animation
        this.platformMesh.userData.initialRotation = new THREE.Euler(0, 0, 0);
    }
    
    reportPlatformExtents(group, maxAbsXAllowed, label, boatLength = null) {
        if (!group || typeof maxAbsXAllowed !== 'number') {
            return;
        }

        const isMobile = typeof navigator !== 'undefined'
            && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            return;
        }

        const maxAbsZLimit = typeof boatLength === 'number' && boatLength > 0
            ? boatLength * 0.5
            : null;
        
        try {
            const limitText = maxAbsZLimit != null
                ? `limits x=${maxAbsXAllowed.toFixed(3)} z=${maxAbsZLimit.toFixed(3)}`
                : `limit x=${maxAbsXAllowed.toFixed(3)}`;
            console.log(`[PLATFORM][${label}] Checking mesh extents (${limitText})`);
            group.updateMatrixWorld(true);
            const groupInverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
            const childInGroup = new THREE.Matrix4();
            let maxAbsX = 0;
            let maxAbsZ = 0;
            const offenders = [];
            
            group.traverse(child => {
                if (child && child.isMesh && child.geometry) {
                    if (child.visible === false) {
                        return;
                    }
                    if (!child.geometry.boundingBox) {
                        child.geometry.computeBoundingBox();
                    }
                    const localBox = child.geometry.boundingBox;
                    if (!localBox) {
                        return;
                    }
                    childInGroup.multiplyMatrices(groupInverse, child.matrixWorld);
                    const groupBox = localBox.clone().applyMatrix4(childInGroup);
                    const childMaxAbs = Math.max(Math.abs(groupBox.min.x), Math.abs(groupBox.max.x));
                    if (childMaxAbs > maxAbsX) {
                        maxAbsX = childMaxAbs;
                    }
                    let outOfBounds = false;
                    if (childMaxAbs > maxAbsXAllowed + 0.005) {
                        outOfBounds = true;
                    }
                    
                    if (maxAbsZLimit != null) {
                        const childMaxZAbs = Math.max(Math.abs(groupBox.min.z), Math.abs(groupBox.max.z));
                        if (childMaxZAbs > maxAbsZLimit + 0.005) {
                            outOfBounds = true;
                        }
                        if (childMaxZAbs > maxAbsZ) {
                            maxAbsZ = childMaxZAbs;
                        }
                    }
                    
                    if (outOfBounds) {
                        offenders.push({
                            name: child.name || child.userData?.label || child.type || 'Mesh',
                            uuid: child.uuid,
                            parentName: child.parent?.name || child.parent?.userData?.label || child.parent?.type || null,
                            parentUUID: child.parent?.uuid || null,
                            position: {
                                x: child.position.x.toFixed(3),
                                y: child.position.y.toFixed(3),
                                z: child.position.z.toFixed(3)
                            },
                            scale: {
                                x: child.scale.x.toFixed(3),
                                y: child.scale.y.toFixed(3),
                                z: child.scale.z.toFixed(3)
                            },
                            maxAbs: childMaxAbs,
                            maxZ: maxAbsZLimit != null
                                ? Math.max(Math.abs(groupBox.min.z), Math.abs(groupBox.max.z))
                                : null
                        });
                    }
                }
            });
            
            const extentText = maxAbsZLimit != null
                ? `max |x| ${maxAbsX.toFixed(3)}, max |z| ${maxAbsZ.toFixed(3)}`
                : `max |x| ${maxAbsX.toFixed(3)}`;
            console.log(`[PLATFORM][${label}] Extents: ${extentText}`);
            if (offenders.length) {
                offenders.forEach(entry => {
                    console.warn(
                        `[PLATFORM][${label}] Out-of-bounds mesh ` +
                        `${entry.name} uuid=${entry.uuid} parent=${entry.parentName || 'null'} ` +
                        `pos=(${entry.position.x}, ${entry.position.y}, ${entry.position.z}) ` +
                        `scale=(${entry.scale.x}, ${entry.scale.y}, ${entry.scale.z}) ` +
                        `maxX=${entry.maxAbs.toFixed(3)}` +
                        (entry.maxZ != null ? ` maxZ=${entry.maxZ.toFixed(3)}` : '')
                    );
                });
            }
        } catch (err) {
            console.warn('[PLATFORM] Failed to report extents:', err);
        }
    }
    
    /**
     * Create large boat (stern section only) for oceans
     */
    createLargeBoat() {
        // Create boat as a group so we can animate rotation
        const boatGroup = new THREE.Group();
        boatGroup.name = 'largeBoat-root';
        
        const boatWidth = this.largeBoatWidth;
        const boatLength = this.largeBoatDepth;
        const hullHeight = 0.25; // Taller hull for large boat
        const hullOuterEdge = boatWidth * 0.42 + 0.03; // Outer edge of hull sides (including thickness)

        const sportWhite = new THREE.MeshStandardMaterial({
            color: 0xf7f7f2,
            roughness: 0.58,
            metalness: 0.05
        });
        const navyStripe = new THREE.MeshStandardMaterial({
            color: 0x12304a,
            roughness: 0.5,
            metalness: 0.08
        });
        const blackRubRail = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.45,
            metalness: 0.12
        });
        const chrome = new THREE.MeshStandardMaterial({
            color: 0xd8dde2,
            roughness: 0.22,
            metalness: 0.85
        });
        const teak = new THREE.MeshStandardMaterial({
            color: 0xc79a5b,
            roughness: 0.72,
            metalness: 0.03
        });

        const hullMaterial = navyStripe;
        
        // For now, skip shader modifications to avoid compilation errors
        // The geometry improvements (beveled hull, pointed bow) will provide visual improvement
        
        // Bottom hull plate (trimmed to stay within hull outline)
        const bottomWidth = Math.max(0.1, hullOuterEdge * 2 - 0.3);
        const bottomLength = Math.min(boatLength - 0.2, 8.0);
        const bottomGeometry = new THREE.BoxGeometry(bottomWidth - 0.04, 0.05, bottomLength - 0.1);
        bottomGeometry.name = 'largeBoat-bottomGeometry';
        const bottom = new THREE.Mesh(bottomGeometry, hullMaterial);
        bottom.name = 'largeBoat-bottom';
        bottom.position.y = -hullHeight * 0.5 + 0.01;
        boatGroup.add(bottom);
        
        // Simple hull walls - extend to match full deck length to prevent shadow seams
        const sideThickness = 0.06;
        const sideHeight = hullHeight;
        // Use full deck length instead of bottomLength to match deck extension
        const extendedDeckLength = boatLength - 0.2;
        const sideLength = extendedDeckLength - 0.12;
        const sideWallGeometry = new THREE.BoxGeometry(sideThickness, sideHeight, sideLength);

        const leftWall = new THREE.Mesh(sideWallGeometry, hullMaterial);
        leftWall.name = 'largeBoat-leftHull';
        leftWall.position.set(-(bottomWidth * 0.5 - sideThickness * 0.5), -hullHeight * 0.5 + sideHeight * 0.5, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        boatGroup.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry.clone(), hullMaterial);
        rightWall.name = 'largeBoat-rightHull';
        rightWall.position.set(bottomWidth * 0.5 - sideThickness * 0.5, -hullHeight * 0.5 + sideHeight * 0.5, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        boatGroup.add(rightWall);

        const endThickness = 0.06;
        const endWidth = bottomWidth - 0.08;
        const endGeometry = new THREE.BoxGeometry(endWidth, sideHeight, endThickness);

        // Front wall - position at extended deck edge to prevent shadow seam
        const frontWall = new THREE.Mesh(endGeometry, hullMaterial);
        frontWall.name = 'largeBoat-frontHull';
        frontWall.position.set(0, -hullHeight * 0.5 + sideHeight * 0.5, extendedDeckLength * 0.5 - endThickness * 0.5);
        // Disable shadow casting to prevent visible seam on deck
        frontWall.castShadow = false;
        frontWall.receiveShadow = true;
        boatGroup.add(frontWall);

        const backWall = new THREE.Mesh(endGeometry.clone(), hullMaterial);
        backWall.name = 'largeBoat-backHull';
        backWall.position.set(0, -hullHeight * 0.5 + sideHeight * 0.5, -extendedDeckLength * 0.5 + endThickness * 0.5);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        boatGroup.add(backWall);
        
        // Stern deck (white, sunken below gunwales)
        const deckMaterial = sportWhite;
        
        const deckThickness = 0.06;
        const deckWidth = Math.max(0.1, hullOuterEdge * 2 - 0.3); // Keep deck within hull
        // Extend deck to cover full boat length where cat stands (cat is at boatLength * 0.28)
        // Use boatLength instead of bottomLength to ensure coverage
        const deckLength = boatLength - 0.2; // Slight margin but covers full area
        
        const deckTopLocal = hullHeight * 0.35 + deckThickness * 0.5;
        const deckTop = new THREE.Mesh(
            new THREE.BoxGeometry(deckWidth - 0.04, deckThickness, deckLength),
            deckMaterial
        );
        deckTop.name = 'largeBoat-deck';
        deckTop.position.set(0, deckTopLocal, 0);
        deckTop.castShadow = true;
        deckTop.receiveShadow = true;
        boatGroup.add(deckTop);
        
        boatGroup.userData.deckTopLocal = deckTopLocal;
        boatGroup.userData.deckThickness = deckThickness;

        const catStandMarker = new THREE.Object3D();
        catStandMarker.name = 'largeBoat-catStand';
        catStandMarker.position.set(0, deckTopLocal + deckThickness * 0.5 + 0.02, boatLength * 0.36);
        boatGroup.add(catStandMarker);
        boatGroup.userData.catStandMarker = catStandMarker;

        // Bow (front of boat - pointed/tapered shape)
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
        
        const bow = new THREE.Mesh(bowGeometry, sportWhite);
        bow.name = 'largeBoat-bow';
        bow.position.set(0, 0, -bottomLength * 0.5 + 0.05); // Position at back end (negative Z)
        bow.rotation.x = -Math.PI / 12; // Tilt forward slightly
        const bowScaleX = Math.max(0.1, (bottomWidth - 0.12) / (boatWidth * 0.9));
        bow.scale.x = bowScaleX;
        boatGroup.add(bow);
        
        // Gunwale "cap" - chrome rails with white coaming
        const gunwaleMaterial = chrome;
        const gunwaleTopMaterial = blackRubRail;
        
        const gunwaleHeight = 2.2;
        const gunwaleIn = 0.06;
        const railThick = 0.10;
        
        // Sides (left/right) - shorten like small boat
        const sideLen = boatLength * 0.88; // Shortened to leave room for front/back rails
        const railCenterX = Math.max(0.1, bottomWidth * 0.5 + gunwaleIn);
        const sideRailGeom = new THREE.BoxGeometry(railThick, gunwaleHeight, sideLen);
        
        // y at which the rail sits
        const railY = Math.max(deckTopLocal + 0.06, hullHeight * 0.5 + 0.02);
        
        // Deck edge position (within hull margins)
        
        // Left rail - align with deck edge
        const leftRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        leftRail.name = 'largeBoat-leftRail';
        leftRail.position.set(-railCenterX, railY, 0);
        leftRail.castShadow = true;
        leftRail.receiveShadow = true;
        boatGroup.add(leftRail);
        
        // Right rail - align with deck edge
        const rightRail = new THREE.Mesh(sideRailGeom, gunwaleMaterial);
        rightRail.name = 'largeBoat-rightRail';
        rightRail.position.set(railCenterX, railY, 0);
        rightRail.castShadow = true;
        rightRail.receiveShadow = true;
        boatGroup.add(rightRail);
        
        // Front & back rails - align with shortened side rails' ends
        // Make front rail match deck width exactly (deck is boatWidth * 0.9)
        const foreAftLen = railCenterX * 2;
        const foreAftGeom = new THREE.BoxGeometry(foreAftLen, gunwaleHeight, railThick);
        
        // Side rails end at ±sideLen/2 = ±(boatLength * 0.88 * 0.5)
        const sideRailEndZ = (boatLength * 0.88) * 0.5; // End of side rail
        
        // Front rail (at transom, where cat stands - positive Z)
        const frontRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        frontRail.name = 'largeBoat-frontRail';
        const frontRailZ = sideRailEndZ + railThick * 0.5; // At front (positive Z)
        frontRail.position.set(0, railY, frontRailZ);
        // Disable shadow casting to prevent shadow seam on deck under cat
        frontRail.castShadow = false;
        frontRail.receiveShadow = true;
        frontRail.visible = true;
        boatGroup.add(frontRail);

        // Transom wall + stern cap (sealed top — matches small-boat sportfisher look)
        const hullFloorY = -hullHeight * 0.5;
        const deckSurfaceY = deckTopLocal + deckThickness * 0.5;
        const transomHeight = deckSurfaceY - hullFloorY + 0.04;
        const transomWall = new THREE.Mesh(
            new THREE.BoxGeometry(foreAftLen * 0.98, transomHeight, railThick + 0.08),
            sportWhite
        );
        transomWall.name = 'largeBoat-transom';
        transomWall.position.set(0, hullFloorY + transomHeight * 0.5, frontRailZ);
        transomWall.castShadow = true;
        transomWall.receiveShadow = true;
        boatGroup.add(transomWall);

        const sternCap = new THREE.Mesh(
            new THREE.BoxGeometry(deckWidth - 0.02, deckThickness + 0.05, railThick + 0.12),
            deckMaterial
        );
        sternCap.name = 'largeBoat-sternCap';
        sternCap.position.set(0, deckSurfaceY + 0.02, frontRailZ);
        sternCap.castShadow = true;
        sternCap.receiveShadow = true;
        boatGroup.add(sternCap);
        
        // Back rail (at bow end - negative Z)
        const backRail = new THREE.Mesh(foreAftGeom, gunwaleMaterial);
        backRail.name = 'largeBoat-backRail';
        const backRailZ = -sideRailEndZ - railThick * 0.5; // At back (negative Z)
        backRail.position.set(0, railY, backRailZ);
        backRail.castShadow = true;
        backRail.receiveShadow = true;
        backRail.visible = true;
        boatGroup.add(backRail);

        // Add darker top caps to emphasize rail edge
        const topCapHeight = Math.min(0.16, gunwaleHeight * 0.14);
        const sideTopGeom = new THREE.BoxGeometry(railThick * 0.94, topCapHeight, sideLen * 0.97);
        const foreAftTopGeom = new THREE.BoxGeometry(foreAftLen * 0.97, topCapHeight, railThick * 0.94);
        const topY = railY + gunwaleHeight * 0.5 - topCapHeight * 0.5 + 0.008;

        const leftTopCap = new THREE.Mesh(sideTopGeom, gunwaleTopMaterial);
        leftTopCap.position.set(leftRail.position.x, topY, 0);
        leftTopCap.castShadow = false;
        boatGroup.add(leftTopCap);

        const rightTopCap = new THREE.Mesh(sideTopGeom, gunwaleTopMaterial);
        rightTopCap.position.set(rightRail.position.x, topY, 0);
        rightTopCap.castShadow = false;
        boatGroup.add(rightTopCap);

        const frontTopCap = new THREE.Mesh(foreAftTopGeom, gunwaleTopMaterial);
        frontTopCap.position.set(0, topY, frontRailZ);
        frontTopCap.castShadow = false;
        frontTopCap.visible = true;
        boatGroup.add(frontTopCap);

        const backTopCap = new THREE.Mesh(foreAftTopGeom, gunwaleTopMaterial);
        backTopCap.position.set(0, topY, backRailZ);
        backTopCap.castShadow = false;
        backTopCap.visible = true;
        boatGroup.add(backTopCap);

        // Transom top rail — bridges gunwale caps across the stern (no open slot on top)
        const transomTopRail = new THREE.Mesh(
            new THREE.BoxGeometry(foreAftLen * 0.98, topCapHeight + 0.03, railThick + 0.08),
            gunwaleTopMaterial
        );
        transomTopRail.name = 'largeBoat-transomTopRail';
        transomTopRail.position.set(0, topY + 0.01, frontRailZ);
        transomTopRail.castShadow = true;
        boatGroup.add(transomTopRail);

        // --- Lightweight sportfisher upgrade details ---
        boatGroup.add(makeBox(0.08, 0.85, boatLength * 0.86, sportWhite, -railCenterX - 0.03, deckTopLocal + 0.28, 0, 'sportfish-left-white-hull'));
        boatGroup.add(makeBox(0.08, 0.85, boatLength * 0.86, sportWhite, railCenterX + 0.03, deckTopLocal + 0.28, 0, 'sportfish-right-white-hull'));

        boatGroup.add(makeBox(0.09, 0.16, boatLength * 0.82, navyStripe, -railCenterX - 0.08, deckTopLocal - 0.05, 0, 'sportfish-left-navy-stripe'));
        boatGroup.add(makeBox(0.09, 0.16, boatLength * 0.82, navyStripe, railCenterX + 0.08, deckTopLocal - 0.05, 0, 'sportfish-right-navy-stripe'));

        boatGroup.add(makeBox(0.08, 0.08, boatLength * 0.88, blackRubRail, -railCenterX - 0.10, railY + gunwaleHeight * 0.52, 0, 'sportfish-left-rubrail'));
        boatGroup.add(makeBox(0.08, 0.08, boatLength * 0.88, blackRubRail, railCenterX + 0.10, railY + gunwaleHeight * 0.52, 0, 'sportfish-right-rubrail'));

        for (let i = 0; i < 10; i++) {
            const z = boatLength * 0.10 + i * 0.28;
            boatGroup.add(makeBox(deckWidth * 0.70, 0.018, 0.12, teak, 0, deckSurfaceY + 0.018, z, 'sportfish-teak-cockpit-slat'));
        }

        boatGroup.add(makeBox(deckWidth * 0.72, 0.32, 0.10, sportWhite, 0, deckSurfaceY + 0.18, frontRailZ - 0.18, 'sportfish-transom-pad'));

        boatGroup.add(makeBox(1.3, 0.38, 0.55, sportWhite, -deckWidth * 0.25, deckSurfaceY + 0.21, boatLength * 0.08, 'sportfish-cooler'));
        boatGroup.add(makeBox(1.32, 0.04, 0.57, chrome, -deckWidth * 0.25, deckSurfaceY + 0.43, boatLength * 0.08, 'sportfish-cooler-lid'));

        const consoleZ = -boatLength * 0.28;
        boatGroup.add(makeBox(1.8, 0.85, 1.1, sportWhite, 0, deckSurfaceY + 0.45, consoleZ, 'sportfish-console'));
        boatGroup.add(makeBox(1.25, 0.35, 0.08, blackRubRail, 0, deckSurfaceY + 0.70, consoleZ - 0.55, 'sportfish-windshield'));

        const towerZ = -boatLength * 0.18;
        const towerHeight = 2.7;
        const towerHalfW = 1.15;
        boatGroup.add(makeCyl(0.035, towerHeight, chrome, -towerHalfW, deckSurfaceY + towerHeight / 2, towerZ, {}, 'tower-left-post'));
        boatGroup.add(makeCyl(0.035, towerHeight, chrome, towerHalfW, deckSurfaceY + towerHeight / 2, towerZ, {}, 'tower-right-post'));
        boatGroup.add(makeCyl(0.035, towerHalfW * 2, chrome, 0, deckSurfaceY + towerHeight, towerZ, { z: Math.PI / 2 }, 'tower-top-crossbar'));
        boatGroup.add(makeBox(1.4, 0.08, 0.8, sportWhite, 0, deckSurfaceY + towerHeight + 0.05, towerZ, 'tower-small-top'));

        const outriggerLen = 3.0;
        const outriggerY = deckSurfaceY + 2.1;
        const outriggerZ = -boatLength * 0.08;
        boatGroup.add(makeCyl(0.025, outriggerLen, chrome, -1.55, outriggerY, outriggerZ, { z: 0.85, y: 0.25 }, 'left-outrigger'));
        boatGroup.add(makeCyl(0.025, outriggerLen, chrome, 1.55, outriggerY, outriggerZ, { z: -0.85, y: -0.25 }, 'right-outrigger'));

        for (let i = 0; i < 4; i++) {
            const x = (i - 1.5) * 0.45;
            boatGroup.add(makeCyl(0.045, 0.45, chrome, x, deckSurfaceY + 0.65, frontRailZ - 0.28, { x: Math.PI / 2 }, 'stern-rocket-launcher'));
        }

        // Beveled edge strips (simple rounded look)
        boatGroup.add(makeBox(0.04, 0.12, boatLength * 0.84, sportWhite, -railCenterX - 0.06, deckTopLocal + 0.12, 0, 'sportfish-left-bevel'));
        boatGroup.add(makeBox(0.04, 0.12, boatLength * 0.84, sportWhite, railCenterX + 0.06, deckTopLocal + 0.12, 0, 'sportfish-right-bevel'));
        
        // Inner coaming lip (chunkier for large boat)
        const coamH = gunwaleHeight * 0.65;
        const coamTh = 0.025;
        const coamY = deckTopLocal + coamH * 0.5;
        
        const coamSideGeom = new THREE.BoxGeometry(coamTh, coamH, sideLen * 0.98);
        const coamBackGeom = new THREE.BoxGeometry(foreAftLen * 0.98, coamH, coamTh);
        const coamMat = teak;
        
        // Left inner lip - positioned inside deck edge
        const leftCoam = new THREE.Mesh(coamSideGeom, coamMat);
        leftCoam.position.set(-railCenterX + gunwaleIn, coamY, 0);
        leftCoam.castShadow = true;
        leftCoam.receiveShadow = true;
        boatGroup.add(leftCoam);
        
        // Right inner lip - positioned inside deck edge
        const rightCoam = new THREE.Mesh(coamSideGeom, coamMat);
        rightCoam.position.set(railCenterX - gunwaleIn, coamY, 0);
        rightCoam.castShadow = true;
        rightCoam.receiveShadow = true;
        boatGroup.add(rightCoam);
        
        // Front inner lip (at transom, where cat stands)
        const frontCoam = new THREE.Mesh(coamBackGeom, coamMat);
        frontCoam.position.set(0, coamY, frontRailZ - gunwaleIn);
        frontCoam.castShadow = true;
        frontCoam.receiveShadow = true;
        frontCoam.visible = true;
        boatGroup.add(frontCoam);
        
        // Back inner lip (at bow end)
        const backCoam = new THREE.Mesh(coamBackGeom, coamMat);
        backCoam.position.set(0, coamY, backRailZ + gunwaleIn);
        backCoam.castShadow = true;
        backCoam.receiveShadow = true;
        backCoam.visible = true;
        boatGroup.add(backCoam);
        
        // Optional: Sheer clamp strip
        const sheerGeom = new THREE.BoxGeometry(0.02, 0.02, sideLen * 0.98);
        const sheerMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a2410, 
            roughness: 0.6 
        });
        
        const leftSheer = new THREE.Mesh(sheerGeom, sheerMat);
        leftSheer.position.set(-railCenterX + 0.01, railY - gunwaleHeight * 0.55, 0);
        leftSheer.castShadow = true;
        boatGroup.add(leftSheer);
        
        const rightSheer = new THREE.Mesh(sheerGeom, sheerMat);
        rightSheer.position.set(railCenterX - 0.01, railY - gunwaleHeight * 0.55, 0);
        rightSheer.castShadow = true;
        boatGroup.add(rightSheer);

        // Flush-mount rod holders along gunwales (sportfisher)
        const gunwaleRodGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.14, 10);
        for (let i = 0; i < 5; i++) {
            const t = 0.12 + i * 0.19;
            const zPos = backRailZ + (frontRailZ - backRailZ) * t;
            for (const side of [-1, 1]) {
                const holder = new THREE.Mesh(gunwaleRodGeo, chrome);
                holder.rotation.z = Math.PI / 2;
                holder.position.set(side * (railCenterX + 0.04), railY + gunwaleHeight * 0.58, zPos);
                holder.castShadow = true;
                boatGroup.add(holder);
            }
        }
        
        // Cleats for docking (larger for big boat)
        const cleatMaterial = chrome;
        
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
        frontCleatLeft.position.set(-railCenterX * 0.6, railY + gunwaleHeight * 0.4, frontRailZ - 0.1);
        frontCleatLeft.rotation.y = Math.PI / 2;
        boatGroup.add(frontCleatLeft);
        
        const frontCleatRight = cleatGroup.clone();
        frontCleatRight.position.set(railCenterX * 0.6, railY + gunwaleHeight * 0.4, frontRailZ - 0.1);
        frontCleatRight.rotation.y = Math.PI / 2;
        boatGroup.add(frontCleatRight);
        
        // Back cleats (at bow end)
        const backCleatLeft = cleatGroup.clone();
        backCleatLeft.position.set(-railCenterX * 0.6, railY + gunwaleHeight * 0.4, backRailZ + 0.1);
        backCleatLeft.rotation.y = -Math.PI / 2;
        boatGroup.add(backCleatLeft);
        
        const backCleatRight = cleatGroup.clone();
        backCleatRight.position.set(railCenterX * 0.6, railY + gunwaleHeight * 0.4, backRailZ + 0.1);
        backCleatRight.rotation.y = -Math.PI / 2;
        boatGroup.add(backCleatRight);
        
        // Anchor winch system at transom
        const winchMaterial = chrome;
        
        // Winch drum
        const winchDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), winchMaterial);
        winchDrum.rotation.z = Math.PI / 2;
        winchDrum.position.set(0, railY + gunwaleHeight * 0.25, frontRailZ - 0.15);
        winchDrum.castShadow = true;
        boatGroup.add(winchDrum);
        
        // Winch support/mount
        const winchMount = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.12), winchMaterial);
        winchMount.position.set(0, railY + gunwaleHeight * 0.25 - 0.04, frontRailZ - 0.15);
        winchMount.castShadow = true;
        boatGroup.add(winchMount);
        
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
            leftScupper.position.set(-railCenterX + 0.2, deckTopLocal - 0.04, zPos);
            boatGroup.add(leftScupper);
            // Right side
            const rightScupper = new THREE.Mesh(scupperGeo.clone(), scupperMat);
            rightScupper.rotation.x = Math.PI / 2;
            rightScupper.position.set(railCenterX - 0.2, deckTopLocal - 0.04, zPos);
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
            const cleatX = railCenterX * 0.6 * xSide;
            
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
        chairGroup.name = 'largeBoat-chairGroup';
        
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
        footrest.name = 'largeBoat-footrest';
        footrest.position.set(0, deckTopLocal + 0.24, 0); // Adjusted for larger pedestal
        footrest.castShadow = true;
        footrest.receiveShadow = true;
        chairGroup.add(footrest);
        
        // Seat (circular, slightly padded) - 3x original size
        const seatRadius = 0.66; // Was 0.44, original 0.22
        const seatThickness = 0.18; // Was 0.12, original 0.06
        const seatGeometry = new THREE.CylinderGeometry(seatRadius, seatRadius, seatThickness, 16);
        const seat = new THREE.Mesh(seatGeometry, chairSeatMaterial);
        seat.name = 'largeBoat-chairSeat';
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
        armrestGeometry.name = 'largeBoat-armrestGeometry';
        
        // Left armrest - stainless steel
        const leftArmrest = new THREE.Mesh(armrestGeometry, stainlessSteelMaterial);
        leftArmrest.name = 'largeBoat-leftArmrest';
        leftArmrest.position.set(-backrestWidth * 0.5 - armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight, armrestDepth * 0.25);
        leftArmrest.castShadow = true;
        leftArmrest.receiveShadow = true;
        chairGroup.add(leftArmrest);
        
        // Left armrest support post - teak wood
        const leftArmSupport = new THREE.Mesh(new THREE.BoxGeometry(0.075, armrestHeight, 0.075), chairFrameMaterial); // Was 0.05, original 0.025
        leftArmSupport.name = 'largeBoat-leftArmSupport';
        leftArmSupport.position.set(-backrestWidth * 0.5 - armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight * 0.5, armrestDepth * 0.25);
        leftArmSupport.castShadow = true;
        chairGroup.add(leftArmSupport);
        
        // Left rod holder (on armrest) - 3x original size - stainless steel
        const rodHolderGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12); // Was 0.06 radius, 0.12 depth
        rodHolderGeometry.name = 'largeBoat-rodHolderGeometry';
        const leftRodHolder = new THREE.Mesh(rodHolderGeometry, rodHolderMaterial);
        leftRodHolder.name = 'largeBoat-leftRodHolder';
        leftRodHolder.rotation.x = Math.PI / 2;
        leftRodHolder.position.set(-backrestWidth * 0.5 - armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight + armrestThickness * 0.5 + 0.09, armrestDepth * 0.25); // Was 0.06
        leftRodHolder.castShadow = true;
        chairGroup.add(leftRodHolder);
        
        // Right armrest - stainless steel
        const rightArmrest = new THREE.Mesh(armrestGeometry, stainlessSteelMaterial);
        rightArmrest.name = 'largeBoat-rightArmrest';
        rightArmrest.position.set(backrestWidth * 0.5 + armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight, armrestDepth * 0.25);
        rightArmrest.castShadow = true;
        rightArmrest.receiveShadow = true;
        chairGroup.add(rightArmrest);
        
        // Right armrest support post - teak wood
        const rightArmSupport = new THREE.Mesh(new THREE.BoxGeometry(0.075, armrestHeight, 0.075), chairFrameMaterial); // Was 0.05, original 0.025
        rightArmSupport.name = 'largeBoat-rightArmSupport';
        rightArmSupport.position.set(backrestWidth * 0.5 + armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight * 0.5, armrestDepth * 0.25);
        rightArmSupport.castShadow = true;
        chairGroup.add(rightArmSupport);
        
        // Right rod holder (on armrest) - 3x original size - stainless steel
        const rightRodHolder = new THREE.Mesh(rodHolderGeometry, rodHolderMaterial);
        rightRodHolder.name = 'largeBoat-rightRodHolder';
        rightRodHolder.rotation.x = Math.PI / 2;
        rightRodHolder.position.set(backrestWidth * 0.5 + armrestWidth * 0.5, deckTopLocal + pedestalHeight + armrestHeight + armrestThickness * 0.5 + 0.09, armrestDepth * 0.25); // Was 0.06
        rightRodHolder.castShadow = true;
        chairGroup.add(rightRodHolder);
        
        // Harness attachment point (bar above backrest) - 3x original size
        const harnessBarLength = backrestWidth + 0.3; // Was + 0.2, original + 0.1
        const harnessBarGeometry = new THREE.CylinderGeometry(0.045, 0.045, harnessBarLength, 12); // Was 0.03, original 0.015
        const harnessBar = new THREE.Mesh(harnessBarGeometry, chairFrameMaterial);
        harnessBar.name = 'largeBoat-harnessBar';
        harnessBar.rotation.z = Math.PI / 2;
        harnessBar.position.set(0, deckTopLocal + pedestalHeight + backrestHeight + 0.45, -backrestThickness * 0.5); // Was + 0.30, original + 0.15
        harnessBar.castShadow = true;
        chairGroup.add(harnessBar);

        // Rocket launcher rod rack (classic sportfisher chair back)
        const rocketLauncherMaterial = new THREE.MeshStandardMaterial({
            color: 0xf2f2f2,
            roughness: 0.45,
            metalness: 0.2
        });
        const rocketTable = new THREE.Mesh(
            new THREE.BoxGeometry(backrestWidth * 1.15, 0.07, 0.6),
            rocketLauncherMaterial
        );
        rocketTable.position.set(
            0,
            deckTopLocal + pedestalHeight + backrestHeight + 0.58,
            -backrestThickness * 0.5 - 0.22
        );
        rocketTable.castShadow = true;
        chairGroup.add(rocketTable);

        const rocketTubeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12);
        for (let i = 0; i < 4; i++) {
            const tube = new THREE.Mesh(rocketTubeGeo, rodHolderMaterial);
            tube.rotation.x = Math.PI / 2;
            tube.position.set(
                (i - 1.5) * 0.24,
                deckTopLocal + pedestalHeight + backrestHeight + 0.72,
                -backrestThickness * 0.5 - 0.22
            );
            tube.castShadow = true;
            chairGroup.add(tube);
        }
        
        // Position fighting chair behind cat (clear gap for portrait camera)
        // Cat stands at largeBoatDepth * 0.36 (transom / fishing position)
        const chairZ = boatLength * 0.04;
        chairGroup.position.set(0, 0, chairZ);
        boatGroup.add(chairGroup);
        this.fightingChairGroup = chairGroup;
        
        this.platformMesh = boatGroup;
        
        // Position boat: same position as small boat and dock
        // Center at z=-1.5 (same as small boat and dock)
        // Front edge will be at -1.5 + 7 = 5.5 (same as small boat and dock)
        // Use higher base Y to prevent dipping below water during rocking
        this.platformMesh.position.set(0, this.water.waterY + 0.35, -1.5); // Same position as small boat
        this.platformMesh.castShadow = true;
        this.platformMesh.receiveShadow = true;
        
        const largeBoatBBox = new THREE.Box3().setFromObject(this.platformMesh);
        console.log('[PLATFORM][LARGE_BOAT] BBox', {
            min: { x: largeBoatBBox.min.x.toFixed(3), z: largeBoatBBox.min.z.toFixed(3) },
            max: { x: largeBoatBBox.max.x.toFixed(3), z: largeBoatBBox.max.z.toFixed(3) }
        });
        
        // Debug helper: report max extents to track down protruding geometry
        this.reportPlatformExtents(this.platformMesh, hullOuterEdge, 'LARGE_BOAT', boatLength);
        
        // Store initial rotation for animation
        this.platformMesh.userData.initialRotation = new THREE.Euler(0, 0, 0);
    }
    
    /**
     * World position of the cat-stand marker when present.
     */
    getCatStandWorldPosition() {
        const marker = this.platformMesh?.userData?.catStandMarker;
        if (!marker) return null;
        marker.updateMatrixWorld(true);
        return marker.getWorldPosition(new THREE.Vector3());
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
                const stand = this.getCatStandWorldPosition();
                if (stand) return stand;

                const deckTopLocal = this.platformMesh.userData.deckTopLocal || (0.2 * 0.35 + 0.04 * 0.5);
                const deckThickness = this.platformMesh.userData.deckThickness || 0.04;
                const deckSurfaceY = deckTopLocal + deckThickness * 0.5;
                const local = new THREE.Vector3(
                    0,
                    deckSurfaceY + 0.02,
                    this.smallBoatDepth * 0.28
                );
                this.platformMesh.updateMatrixWorld(true);
                return local.applyMatrix4(this.platformMesh.matrixWorld);
            }
            
            case 'LARGE_BOAT': {
                const stand = this.getCatStandWorldPosition();
                if (stand) return stand;

                const deckTopLocal = this.platformMesh.userData.deckTopLocal || (0.25 * 0.35 + 0.06 * 0.5);
                const deckThickness = this.platformMesh.userData.deckThickness || 0.06;
                const deckSurfaceY = deckTopLocal + deckThickness * 0.5;
                const local = new THREE.Vector3(
                    0,
                    deckSurfaceY + 0.025,
                    this.largeBoatDepth * 0.36
                );
                this.platformMesh.updateMatrixWorld(true);
                return local.applyMatrix4(this.platformMesh.matrixWorld);
            }
            
            default:
                return new THREE.Vector3(0, 0.36, 3.4);
        }
    }

    /**
     * Portrait camera offset — sportfisher uses side-elevated framing so chair does not block Halley.
     */
    getPortraitCameraOffset() {
        if (this.currentPlatformType === 'LARGE_BOAT') {
            return PORTRAIT_CAMERA_OFFSET_LARGE_BOAT.clone();
        }
        return PORTRAIT_CAMERA_OFFSET.clone();
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
            
            pitch = Math.sin(slowWave1Phase) * 0.035 + Math.sin(slowWave2Phase) * 0.012;
            roll = Math.cos(slowWave1Phase * 0.8) * 0.022 + Math.sin(slowWave3Phase) * 0.012;
            yOffset = Math.sin(slowWave1Phase * 1.2) * 0.008;
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
