// src/water/waterBodyTypes.js

import * as THREE from 'three';

/**
 * Water body type configurations
 * Each type has distinct visual properties to make them look different
 */
export const WaterBodyTypes = {
    POND: {
        name: 'Pond',
        deepColor: new THREE.Color(0x003d66),      // Dark but vibrant blue (was 0x006994, made darker)
        shallowColor: new THREE.Color(0x006699),   // Darker cyan-blue (was 0x00a8cc, made darker)
        fogColor: new THREE.Color(0x005577),       // Blue fog
        fogDepth: 8.0,                             // Shallow fog (ponds aren't deep)
        fogIntensity: 0.4,                         // Moderate fog
        turbidity: 0.3,                           // Some murkiness
        absorption: 0.6,                          // Moderate light absorption
        opacity: 0.92,                            // Slightly more opaque
        sparkleStrength: 0.2,                     // Less sparkle (smaller surface)
        waveScale: 0.8,                          // Smaller waves (pond-specific)
        waveSpeed: 1.5,                          // Slower waves (pond-specific)
        waveAmplitude: 0.04                      // Small wave amplitude (pond-specific)
    },
    
    RIVER: {
        name: 'River',
        deepColor: new THREE.Color(0x003d66),      // Dark but vibrant blue (was 0x006994, made darker)
        shallowColor: new THREE.Color(0x006699),   // Darker cyan-blue (was 0x00a8cc, made darker)
        fogColor: new THREE.Color(0x005577),        // Blue fog
        fogDepth: 10.0,                            // Medium depth
        fogIntensity: 0.5,                         // More fog (moving water = murkier)
        turbidity: 0.5,                           // More turbid (dirtier)
        absorption: 0.7,                          // More light absorption
        opacity: 0.94,                            // More opaque (dirtier water)
        sparkleStrength: 0.25,                   // Moderate sparkle
        waveScale: 1.2,                          // Moderate waves (river-specific)
        waveSpeed: 2.5,                          // Faster waves (moving water)
        waveAmplitude: 0.08,                      // Medium wave amplitude (river-specific)
        flowDirection: new THREE.Vector2(-1, 0),  // Flow left to right (negative X = screen left to screen right)
        flowSpeed: 1.5,                          // Flow speed for visual effect
        hasFlow: true                             // River has flow direction
    },
    
    LAKE: {
        name: 'Lake',
        deepColor: new THREE.Color(0x004466),      // Dark but vibrant blue (was 0x006994, made darker)
        shallowColor: new THREE.Color(0x0077aa),   // Darker cyan-blue (was 0x00a8cc, made darker)
        fogColor: new THREE.Color(0x006699),       // Blue fog
        fogDepth: 15.0,                           // Deep fog (lakes can be deep)
        fogIntensity: 0.45,                        // Moderate-heavy fog
        turbidity: 0.2,                           // Clearer than river
        absorption: 0.65,                         // Moderate absorption
        opacity: 0.93,                           // Slightly opaque
        sparkleStrength: 0.3,                    // Good sparkle
        waveScale: 1.1,                          // Normal waves (lake-specific, default)
        waveSpeed: 2.0,                          // Normal wave speed (lake-specific, default)
        waveAmplitude: 0.07                      // Normal wave amplitude (lake-specific, default)
    },
    
    OCEAN: {
        name: 'Ocean',
        deepColor: new THREE.Color(0x0293D1),      // Perfect ocean blue (RGB: 2, 147, 209)
        shallowColor: new THREE.Color(0x03a8e0),   // Slightly lighter ocean blue
        fogColor: new THREE.Color(0x027fb8),       // Darker ocean blue for fog
        fogDepth: 35.0,                           // Even deeper fog (was 25.0)
        fogIntensity: 0.7,                        // Heavier fog (was 0.6)
        turbidity: 0.2,                           // Slightly murkier (was 0.15)
        absorption: 0.9,                         // Very strong light absorption (was 0.8)
        opacity: 0.97,                           // More opaque (was 0.95)
        sparkleStrength: 0.35,                   // Strong sparkle (large surface)
        waveScale: 2.5,                          // Much bigger waves (ocean-specific)
        waveSpeed: 3.0,                          // Faster waves (ocean-specific)
        waveAmplitude: 0.15                      // Larger wave amplitude (ocean-specific)
    }
};

/**
 * Get water body configuration by name
 */
export function getWaterBodyConfig(type) {
    return WaterBodyTypes[type] || WaterBodyTypes.LAKE;
}

/**
 * Default water body type (can be changed per level/scene)
 */
export const DEFAULT_WATER_BODY_TYPE = 'LAKE';

