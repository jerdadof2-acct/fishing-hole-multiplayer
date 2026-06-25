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
        shallowColor: new THREE.Color(0x1a9fd4),   // Brighter cyan shallows
        fogColor: new THREE.Color(0x005577),       // Blue fog
        fogDepth: 8.0,                             // Shallow fog (ponds aren't deep)
        fogIntensity: 0.4,                         // Moderate fog
        turbidity: 0.3,                           // Some murkiness
        absorption: 0.6,                          // Moderate light absorption
        opacity: 0.88,                            // Slightly clearer for lake-bed read-through
        sparkleStrength: 0.12,
        waveScale: 0.65,
        waveSpeed: 1.1,
        waveAmplitude: 0.025,
        windScroll1: new THREE.Vector2(0.02, 0.01),
        windScroll2: new THREE.Vector2(-0.01, 0.015)
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
        hasFlow: true,                            // River has flow direction
        windScroll1: new THREE.Vector2(-0.06, 0.0),
        windScroll2: new THREE.Vector2(0.035, 0.012)
    },
    
    LAKE: {
        name: 'Lake',
        deepColor: new THREE.Color(0x004466),      // Dark but vibrant blue (was 0x006994, made darker)
        shallowColor: new THREE.Color(0x2ab8e8),
        fogColor: new THREE.Color(0x006699),       // Blue fog
        fogDepth: 15.0,                           // Deep fog (lakes can be deep)
        fogIntensity: 0.45,                        // Moderate-heavy fog
        turbidity: 0.2,                           // Clearer than river
        absorption: 0.65,                         // Moderate absorption
        opacity: 0.86,
        sparkleStrength: 0.3,                    // Good sparkle
        waveScale: 1.1,                          // Normal waves (lake-specific, default)
        waveSpeed: 2.0,                          // Normal wave speed (lake-specific, default)
        waveAmplitude: 0.07,                     // Normal wave amplitude (lake-specific, default)
        windScroll1: new THREE.Vector2(0.025, 0.012),
        windScroll2: new THREE.Vector2(-0.012, 0.018)
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
        sparkleStrength: 0.4,                    // Extra glints on chop
        waveScale: 3.2,                          // Larger swell
        waveSpeed: 3.6,                          // Faster chop
        waveAmplitude: 0.22,                     // Taller waves (was 0.15)
        chopMultiplier: 1.65,                    // High-frequency chop on top of swell
        windScroll1: new THREE.Vector2(0.045, 0.022),
        windScroll2: new THREE.Vector2(-0.028, 0.032)
    },

    CELESTIAL: {
        name: 'Celestial Depths',
        deepColor: new THREE.Color(0x05060f),      // Near-black base tone
        shallowColor: new THREE.Color(0x0b1632),   // Subtle indigo highlight
        fogColor: new THREE.Color(0x04040a),       // Midnight fog tint
        fogDepth: 42.0,                           // Deep fog to keep horizon soft
        fogIntensity: 0.8,                        // Strong fog for dreamy blend
        turbidity: 0.1,                           // Keep water clear for glow
        absorption: 0.95,                         // Heavy absorption for depth darkness
        opacity: 0.98,                            // Almost opaque to hide ground plane
        sparkleStrength: 0.6,                     // Enhanced sparkle for star shimmer
        waveScale: 1.4,                           // Gentle undulation
        waveSpeed: 1.1,                           // Slow drift
        waveAmplitude: 0.05,                      // Calm surface
        windScroll1: new THREE.Vector2(0.01, 0.005),
        windScroll2: new THREE.Vector2(-0.006, 0.008)
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

