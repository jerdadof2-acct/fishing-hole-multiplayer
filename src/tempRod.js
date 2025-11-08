import * as THREE from 'three';

export class TempRod {
    constructor(scene, waterY = 0, dockPosition) {
        this.sceneRef = scene;
        this.waterY = waterY;
        this.dockPosition = dockPosition;
        
        this.rodRoot = null;
        this.rodTip = null;
        
        // Rod sections for animation (exposed for movement control)
        // 8 sections total: Handle + 7 blank sections for smooth bending
        this.handle = null;
        this.blank1 = null;
        this.blank2 = null;
        this.blank3 = null;
        this.blank4 = null;
        this.blank5 = null;
        this.blank6 = null;
        this.blank7 = null;
        this.sections = []; // Array of all rod sections for easy iteration
        this.blankSections = []; // Array of just blank sections for easy iteration
        this.reel = null; // Fishing reel attached to handle
    }

    create() {
        // Bright materials so it's visible
        const mHandle = new THREE.MeshStandardMaterial({ 
            color: 0x7b4a1a, 
            roughness: 0.9 
        });
        const mBlank = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            roughness: 0.4, 
            metalness: 0.2 
        });
        const mTrim = new THREE.MeshStandardMaterial({ 
            color: 0xffdd00, 
            roughness: 0.3, 
            metalness: 0.6 
        });
        const mReel = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, // Pure white/silver base for maximum visibility
            roughness: 0.05, // Extremely shiny
            metalness: 1.0, // Fully metallic
            emissive: 0x888888, // Stronger glow to ensure visibility
            emissiveIntensity: 0.3
        });
        const mReelSpool = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, // Pure white for spool center (fishing line)
            roughness: 0.3, // Matte like fishing line
            metalness: 0.0, // Not metallic - represents fishing line
            emissive: 0xFFFFFF, // White glow
            emissiveIntensity: 0.2
        });
        const mFishingLine = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, // Pure white for fishing line
            roughness: 0.3, // Matte like fishing line
            metalness: 0.0, // Not metallic - represents fishing line
            emissive: 0xFFFFFF, // White glow to make it stand out
            emissiveIntensity: 0.5 // Higher intensity to make it brighter/whiter
        });

        this.rodRoot = new THREE.Group();
        this.rodRoot.name = 'RodRoot';
        // Rod will be attached to pivot in main.js, but add to scene first as fallback
        // Position will be set relative to pivot when attached
        this.rodRoot.position.set(0, 0, 0);
        this.sceneRef.scene.add(this.rodRoot);

        // Total rod length: ~4.2 units (reduced by 40% from ~7.04 units for shorter rod)
        // Handle: 0.55 unit
        // 7 Blank sections: progressively shorter and thinner toward tip for smooth, realistic bending
        // Progressive lengths: 0.67, 0.62, 0.58, 0.53, 0.48, 0.43, 0.43 units
        
        // SECTION 1: Handle (grip section - held by cat, 13% of rod)
        this.handle = new THREE.Group();
        this.handle.name = 'RodHandle';
        const handleHeight = 0.55; // Reduced by 31% from 0.8 for shorter rod
        
        const handleMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.056, 0.066, handleHeight, 16), // Reduced radii by 30% for skinnier rod (0.080->0.056, 0.095->0.066)
            mHandle
        );
        // Position mesh so bottom is at Group origin (connection point)
        handleMesh.position.y = handleHeight / 2; // Shift up so bottom is at y=0
        handleMesh.castShadow = true;
        this.handle.add(handleMesh);
        
        // A couple of gold bands to catch your eye
        const band = new THREE.Mesh(
            new THREE.TorusGeometry(0.028, 0.005, 8, 24), // Reduced by 30% to match skinnier handle (0.040->0.028)
            mTrim
        );
        band.rotation.x = Math.PI / 2;
        // Handle mesh now starts at y=0, so band at 30% of height
        band.position.y = handleHeight * 0.3; // Position band 30% up handle
        this.handle.add(band);
        
        // Black line halfway between handle end and reel
        // Handle end is at y=0, reel is at y=0.7, so halfway is at y=0.35
        // Handle radius at this position: tapers from 0.056 to 0.066
        const blackLineMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000, // Pure black
            roughness: 0.9,
            metalness: 0.0
        });
        // Torus wraps around handle circumference - radius matches handle radius at this position
        const handleRadiusAtLine = 0.056 + (0.066 - 0.056) * (0.24 / handleHeight); // Interpolate handle radius at y=0.24 (scaled from 0.35)
        const blackLine = new THREE.Mesh(
            new THREE.TorusGeometry(handleRadiusAtLine, 0.004, 16, 32), // Radius matches handle, thin black line (reduced from 0.006)
            blackLineMaterial
        );
        blackLine.rotation.x = Math.PI / 2; // Rotate to wrap around handle circumference
        blackLine.position.y = 0.24; // Halfway between handle end (0) and reel (0.48, scaled from 0.7)
        this.handle.add(blackLine);
        
        // Create fishing reel at top of handle (where right hand grips)
        // Reel position: ~0.48 units up handle (near top, close to blank section, scaled from 0.7)
        const reelHeight = 0.48; // Position reel near top of handle (reduced by 31% from 0.7)
        const reelRadius = 0.123; // Reel outer radius (reduced by 30% from 0.175)
        const reelDepth = 0.35; // Reel depth (reduced by 30% from 0.50)
        const reelInnerRadius = 0.063; // Inner hole radius (reduced by 30% from 0.09)
        
        // Create reel group
        this.reel = new THREE.Group();
        this.reel.name = 'FishingReel';
        
        // Reel body (main cylinder)
        const reelBody = new THREE.Mesh(
            new THREE.CylinderGeometry(reelRadius, reelRadius, reelDepth, 16),
            mReel
        );
        reelBody.rotation.x = Math.PI / 2; // Rotate to be horizontal (perpendicular to rod)
        reelBody.rotation.z = Math.PI / 2; // Rotate 90° around Z axis (rotated back)
        reelBody.position.y = reelHeight;
        reelBody.position.z = 0.08; // Offset forward from handle center
        reelBody.castShadow = true;
        this.reel.add(reelBody);
        
        // Reel spool (inner spinning part - white cylinder for fishing line)
        const reelSpool = new THREE.Mesh(
            new THREE.CylinderGeometry(reelInnerRadius, reelInnerRadius, reelDepth * 0.8, 12),
            mReelSpool
        );
        reelSpool.rotation.x = Math.PI / 2; // Rotate to be horizontal (perpendicular to rod)
        reelSpool.rotation.z = Math.PI / 2; // Rotate 90° around Z axis (rotated back)
        reelSpool.position.y = reelHeight;
        reelSpool.position.z = 0.08; // Match reel body position
        this.reel.add(reelSpool);
        
        // Silver borders on each end of the spool
        const borderThickness = 0.03; // Thickness of silver border rings
        const borderRadius = reelInnerRadius + 0.005; // Slightly larger than spool
        
        // Left end border (silver)
        const leftBorder = new THREE.Mesh(
            new THREE.CylinderGeometry(borderRadius, borderRadius, borderThickness, 12),
            mReel
        );
        leftBorder.rotation.x = Math.PI / 2;
        leftBorder.rotation.z = Math.PI / 2;
        leftBorder.position.y = reelHeight;
        leftBorder.position.z = 0.08;
        leftBorder.position.x = -(reelDepth * 0.8) / 2 - borderThickness / 2; // Position at left end
        this.reel.add(leftBorder);
        
        // Right end border (silver)
        const rightBorder = new THREE.Mesh(
            new THREE.CylinderGeometry(borderRadius, borderRadius, borderThickness, 12),
            mReel
        );
        rightBorder.rotation.x = Math.PI / 2;
        rightBorder.rotation.z = Math.PI / 2;
        rightBorder.position.y = reelHeight;
        rightBorder.position.z = 0.08;
        rightBorder.position.x = (reelDepth * 0.8) / 2 + borderThickness / 2; // Position at right end
        this.reel.add(rightBorder);
        
        // Reel foot (mounting bracket that attaches to rod)
        const reelFoot = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.035, 0.042), // Reduced by 30% to match skinnier rod
            mReel
        );
        reelFoot.position.y = reelHeight;
        reelFoot.position.z = 0.04; // Position forward to attach to rod
        reelFoot.castShadow = true;
        this.reel.add(reelFoot);
        
        // Add reel to handle
        this.handle.add(this.reel);
        
        this.rodRoot.add(this.handle);
        this.sections.push(this.handle);

        // SECTION 2: Blank1 (first rod section - connects to handle)
        // Handle top radius is 0.066, so blank1 bottom should match (larger end at handle)
        // Smooth taper: each section gets progressively thinner toward tip (smaller end at tip)
        this.blank1 = this.createBlankSection('RodBlank1', 0.67, 0.066, 0.059, mBlank); // bottomRadius=0.066 (handle), topRadius=0.059 (tip) - reduced by 40% length, 30% radii
        this.blank1.position.set(0, handleHeight, 0);
        this.handle.add(this.blank1);
        this.sections.push(this.blank1);
        this.blankSections.push(this.blank1);

        // SECTION 3: Blank2 (smoothly connects to blank1)
        this.blank2 = this.createBlankSection('RodBlank2', 0.62, 0.059, 0.052, mBlank); // bottomRadius=0.059 (handle), topRadius=0.052 (tip) - reduced by 40% length, 30% radii
        this.blank2.position.set(0, 0.67, 0); // At top of blank1 (reduced from 1.12)
        this.blank1.add(this.blank2);
        this.sections.push(this.blank2);
        this.blankSections.push(this.blank2);

        // SECTION 4: Blank3
        this.blank3 = this.createBlankSection('RodBlank3', 0.58, 0.052, 0.045, mBlank); // bottomRadius=0.052 (handle), topRadius=0.045 (tip) - reduced by 40% length, 30% radii
        this.blank3.position.set(0, 0.62, 0); // At top of blank2 (reduced from 1.04)
        this.blank2.add(this.blank3);
        this.sections.push(this.blank3);
        this.blankSections.push(this.blank3);

        // SECTION 5: Blank4
        this.blank4 = this.createBlankSection('RodBlank4', 0.53, 0.045, 0.038, mBlank); // bottomRadius=0.045 (handle), topRadius=0.038 (tip) - reduced by 40% length, 30% radii
        this.blank4.position.set(0, 0.58, 0); // At top of blank3 (reduced from 0.96)
        this.blank3.add(this.blank4);
        this.sections.push(this.blank4);
        this.blankSections.push(this.blank4);

        // SECTION 6: Blank5
        this.blank5 = this.createBlankSection('RodBlank5', 0.48, 0.038, 0.031, mBlank); // bottomRadius=0.038 (handle), topRadius=0.031 (tip) - reduced by 40% length, 30% radii
        this.blank5.position.set(0, 0.53, 0); // At top of blank4 (reduced from 0.88)
        this.blank4.add(this.blank5);
        this.sections.push(this.blank5);
        this.blankSections.push(this.blank5);

        // SECTION 7: Blank6
        this.blank6 = this.createBlankSection('RodBlank6', 0.43, 0.031, 0.024, mBlank); // bottomRadius=0.031 (handle), topRadius=0.024 (tip) - reduced by 40% length, 30% radii
        this.blank6.position.set(0, 0.48, 0); // At top of blank5 (reduced from 0.8)
        this.blank5.add(this.blank6);
        this.sections.push(this.blank6);
        this.blankSections.push(this.blank6);

        // SECTION 8: Blank7 (tip section - thinnest)
        this.blank7 = this.createBlankSection('RodBlank7', 0.43, 0.024, 0.017, mBlank); // bottomRadius=0.024 (handle), topRadius=0.017 (tip - finest) - reduced by 40% length, 30% radii
        this.blank7.position.set(0, 0.43, 0); // At top of blank6 (reduced from 0.72)
        this.blank6.add(this.blank7);
        this.sections.push(this.blank7);
        this.blankSections.push(this.blank7);

        // The rod tip is at the very end of blank7
        // Create a tip marker at the end of blank7
        const tipMarker = new THREE.Group();
        tipMarker.name = 'RodTip';
        tipMarker.position.set(0, 0.43, 0); // At top of blank7 (end of rod, reduced from 0.72)
        this.blank7.add(tipMarker);
        this.rodTip = tipMarker;

        console.log('Temporary rod created with', this.sections.length, 'sections');
        return this.rodTip;
    }

    createBlankSection(name, height, bottomRadius, topRadius, material) {
        const section = new THREE.Group();
        section.name = name;
        
        // Use higher segment count for smoother taper (32 segments for smoother appearance)
        // CylinderGeometry(radiusTop, radiusBottom, height, ...)
        // radiusTop = radius at top (smaller, toward tip)
        // radiusBottom = radius at bottom (larger, toward handle)
        // bottomRadius parameter = larger end (toward handle)
        // topRadius parameter = smaller end (toward tip)
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(topRadius, bottomRadius, height, 32), // Tapered: topRadius (small) at top toward tip, bottomRadius (large) at bottom toward handle
            material
        );
        // Position mesh so bottom is at Group origin (connection point)
        mesh.position.y = height / 2; // Shift up so bottom is at y=0
        mesh.castShadow = true;
        section.add(mesh);
        
        return section;
    }

    update(delta) {
        // Update any rod animations here if needed
        // For now, rod sections are animated by fishing.js for bending
    }
}
