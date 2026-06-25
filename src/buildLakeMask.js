import * as THREE from 'three';

/** World units — water mask UV mapping uses this span. */
export const GROUND_SIZE = 400;

/** Full-size lake / ocean / river water bodies. */
export const LAKE_MASK_PROFILE = {
    center: { x: 0.5, y: 0.5 },
    a: 0.42,
    b: 0.34,
    rotate: 0.2
};

/** Compact ellipse for Crescent Pond — cozy home pond, not a lake. */
export const POND_MASK_PROFILE = {
    center: { x: 0.5, y: 0.5 },
    a: 0.18,
    b: 0.12,
    rotate: 0.2
};

/**
 * Builds a lake mask texture
 * White = water area, Black = land area
 * Used to blend water edges, place grass, and define water boundaries
 */
export function buildLakeMask(size = 1024, center = { x: 0.5, y: 0.5 }, a = 0.42, b = 0.34, rotate = 0.2) {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    
    const ctx = cvs.getContext('2d');
    
    // Fill with black (land)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    
    // Draw white ellipse for water area
    ctx.fillStyle = '#fff'; // White = water
    ctx.save();
    ctx.translate(size * center.x, size * center.y);
    ctx.rotate(rotate);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * a, size * b, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    const texture = new THREE.CanvasTexture(cvs);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    return texture;
}

export function getLakeMaskProfile(waterBodyType) {
    return waterBodyType === 'POND' ? POND_MASK_PROFILE : LAKE_MASK_PROFILE;
}

export function buildLakeMaskForWaterBody(waterBodyType, size = 1024) {
    const profile = getLakeMaskProfile(waterBodyType);
    return buildLakeMask(size, profile.center, profile.a, profile.b, profile.rotate);
}













