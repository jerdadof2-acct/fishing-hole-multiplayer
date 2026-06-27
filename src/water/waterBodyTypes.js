// src/water/waterBodyTypes.js

import * as THREE from 'three';

/**
 * Design-locked Frozen Fjords water color (#314D76).
 * Approved June 2025 — do not change deep/shallow/fog without explicit user approval.
 * @see applyFrozenFjordWaterColors
 */
export const FROZEN_FJORD_WATER_HEX = 0x314d76;

function frozenFjordWaterColor() {
    return new THREE.Color(FROZEN_FJORD_WATER_HEX);
}

/** Re-apply locked fjord water colors to live shader uniforms. */
export function applyFrozenFjordWaterColors(material) {
    if (!material?.uniforms?.uColorDeep) {
        return;
    }
    const locked = frozenFjordWaterColor();
    material.uniforms.uColorDeep.value.copy(locked);
    material.uniforms.uColorShallow.value.copy(locked);
    material.uniforms.uFogColor.value.copy(locked);
}

/**
 * Design-locked Coral Kingdoms shallow tropical bay water.
 * Light blue-green — must persist when leaving and returning from other locations.
 */
export const CORAL_KINGDOMS_WATER_DEEP_HEX = 0x186890;
export const CORAL_KINGDOMS_WATER_SHALLOW_HEX = 0x42c4ff;
export const CORAL_KINGDOMS_WATER_FOG_HEX = 0x2a88b8;

export const CORAL_KINGDOMS_WATER_TUNING = {
    absorption: 0.28,
    turbidity: 0.04,
    opacity: 0.76,
    fogIntensity: 0.22,
    fogDepth: 8.0,
    sparkleStrength: 0.34
};

/**
 * Cortez Backwaters — same shallow bay shader as Coral Kingdoms, darker green-blue palette.
 */
export const CORTEZ_BACKWATERS_WATER_DEEP_HEX = 0x155f62;
export const CORTEZ_BACKWATERS_WATER_SHALLOW_HEX = 0x45aaa0;
export const CORTEZ_BACKWATERS_WATER_FOG_HEX = 0x287f79;

/** Shared with Coral Kingdoms — only water tint differs at Cortez. */
function applyShallowBayWaterColors(material, deepHex, shallowHex, fogHex, tuning = CORAL_KINGDOMS_WATER_TUNING) {
    if (!material?.uniforms) {
        return;
    }
    const u = material.uniforms;
    u.uColorDeep.value.setHex(deepHex);
    u.uColorShallow.value.setHex(shallowHex);
    u.uFogColor.value.setHex(fogHex);
    u.uAbsorption.value = tuning.absorption;
    u.uTurbidity.value = tuning.turbidity;
    u.uOpacity.value = tuning.opacity;
    u.uFogIntensity.value = tuning.fogIntensity;
    u.uFogDepth.value = tuning.fogDepth;
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = tuning.sparkleStrength;
    }
    if (u.uOpaqueDeep) {
        u.uOpaqueDeep.value = 0.0;
    }
    if (u.uFlatWater) {
        u.uFlatWater.value = 0.0;
    }
    if (u.uHasLakeBed) {
        u.uHasLakeBed.value = 1.0;
    }
    if (u.uEnvIntensity) {
        u.uEnvIntensity.value = 0.44;
    }
    if (u.uShallowBedMix) {
        u.uShallowBedMix.value = 0.0;
    }
}

/** LAKE chop + ripples — Coral Kingdoms uses these (not POND defaults). */
export function applyCoralKingdomsLakeWaves(material) {
    if (!material?.uniforms) {
        return;
    }
    const lake = getWaterBodyConfig('LAKE');
    const u = material.uniforms;
    if (u.waveScale) {
        u.waveScale.value = lake.waveScale;
    }
    if (u.waveSpeed) {
        u.waveSpeed.value = lake.waveSpeed;
    }
    if (u.waveAmplitude) {
        u.waveAmplitude.value = lake.waveAmplitude;
    }
    if (u.rippleAmp) {
        u.rippleAmp.value = 0.12;
    }
    if (u.uScroll1 && lake.windScroll1) {
        u.uScroll1.value.copy(lake.windScroll1);
    }
    if (u.uScroll2 && lake.windScroll2) {
        u.uScroll2.value.copy(lake.windScroll2);
    }
}

/** Craggy Coast — wind-lashed Great Lakes shoreline chop (LAKE body only). */
export const CRAGGY_COAST_WATER_WAVES = {
    waveScale: 2.05,
    waveSpeed: 3.05,
    waveAmplitude: 0.135,
    chopMultiplier: 1.75,
    sparkleStrength: 0.38,
    rippleAmp: 0.14,
    windScroll1: new THREE.Vector2(0.04, 0.022),
    windScroll2: new THREE.Vector2(-0.026, 0.03)
};

export function applyLakeDefaultWaves(material, config = getWaterBodyConfig('LAKE')) {
    if (!material?.uniforms || !config) {
        return;
    }
    const u = material.uniforms;
    if (u.waveScale) {
        u.waveScale.value = config.waveScale ?? 1.1;
    }
    if (u.waveSpeed) {
        u.waveSpeed.value = config.waveSpeed ?? 2.0;
    }
    if (u.waveAmplitude) {
        u.waveAmplitude.value = config.waveAmplitude ?? 0.07;
    }
    if (u.chopMultiplier) {
        u.chopMultiplier.value = config.chopMultiplier ?? 1.0;
    }
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = config.sparkleStrength ?? 0.3;
    }
    if (u.rippleAmp) {
        u.rippleAmp.value = 0.12;
    }
    if (u.uScroll1 && config.windScroll1) {
        u.uScroll1.value.copy(config.windScroll1);
    }
    if (u.uScroll2 && config.windScroll2) {
        u.uScroll2.value.copy(config.windScroll2);
    }
}

export function applyCraggyCoastWaterWaves(material) {
    if (!material?.uniforms) {
        return;
    }
    const w = CRAGGY_COAST_WATER_WAVES;
    const u = material.uniforms;
    if (u.waveScale) {
        u.waveScale.value = w.waveScale;
    }
    if (u.waveSpeed) {
        u.waveSpeed.value = w.waveSpeed;
    }
    if (u.waveAmplitude) {
        u.waveAmplitude.value = w.waveAmplitude;
    }
    if (u.chopMultiplier) {
        u.chopMultiplier.value = w.chopMultiplier;
    }
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = w.sparkleStrength;
    }
    if (u.rippleAmp) {
        u.rippleAmp.value = w.rippleAmp;
    }
    if (u.uScroll1) {
        u.uScroll1.value.copy(w.windScroll1);
    }
    if (u.uScroll2) {
        u.uScroll2.value.copy(w.windScroll2);
    }
}

/** Stormbreaker Bay — dark grey open ocean, heavy wind chop (OCEAN body only). */
export const STORMBREAKER_BAY_WATER = {
    deepColor: new THREE.Color(0x2a3540),
    shallowColor: new THREE.Color(0x5a6878),
    fogColor: new THREE.Color(0x38444f),
    fogDepth: 28.0,
    fogIntensity: 0.78,
    turbidity: 0.36,
    absorption: 0.88,
    opacity: 0.96,
    sparkleStrength: 0.52,
    waveScale: 3.75,
    waveSpeed: 4.2,
    waveAmplitude: 0.27,
    chopMultiplier: 2.1,
    rippleAmp: 0.17,
    windScroll1: new THREE.Vector2(0.058, 0.03),
    windScroll2: new THREE.Vector2(-0.036, 0.04),
    envIntensity: 0.58,
    fresnelScale: 1.22
};

export function applyStormbreakerBayWater(material) {
    if (!material?.uniforms) {
        return;
    }
    const w = STORMBREAKER_BAY_WATER;
    const u = material.uniforms;
    u.uColorDeep.value.copy(w.deepColor);
    u.uColorShallow.value.copy(w.shallowColor);
    u.uFogColor.value.copy(w.fogColor);
    u.uFogDepth.value = w.fogDepth;
    u.uFogIntensity.value = w.fogIntensity;
    u.uTurbidity.value = w.turbidity;
    u.uAbsorption.value = w.absorption;
    u.uOpacity.value = w.opacity;
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = w.sparkleStrength;
    }
    if (u.waveScale) {
        u.waveScale.value = w.waveScale;
    }
    if (u.waveSpeed) {
        u.waveSpeed.value = w.waveSpeed;
    }
    if (u.waveAmplitude) {
        u.waveAmplitude.value = w.waveAmplitude;
    }
    if (u.chopMultiplier) {
        u.chopMultiplier.value = w.chopMultiplier;
    }
    if (u.rippleAmp) {
        u.rippleAmp.value = w.rippleAmp;
    }
    if (u.uScroll1) {
        u.uScroll1.value.copy(w.windScroll1);
    }
    if (u.uScroll2) {
        u.uScroll2.value.copy(w.windScroll2);
    }
    if (u.uEnvIntensity) {
        u.uEnvIntensity.value = w.envIntensity;
    }
    if (u.uFresnelScale && w.fresnelScale != null) {
        u.uFresnelScale.value = w.fresnelScale;
    }
}

/** Forgotten Reefs — ~100 ft deep cobalt abyss (OCEAN only). */
export const FORGOTTEN_REEFS_WATER = {
    deepColor: new THREE.Color(0x001e45),
    shallowColor: new THREE.Color(0x035a8f),
    fogColor: new THREE.Color(0x002850),
    fogDepth: 52.0,
    fogIntensity: 0.82,
    turbidity: 0.06,
    absorption: 0.95,
    opacity: 0.99,
    sparkleStrength: 0.28,
    waveScale: 2.85,
    waveSpeed: 2.75,
    waveAmplitude: 0.16,
    chopMultiplier: 1.35,
    rippleAmp: 0.1,
    windScroll1: new THREE.Vector2(0.032, 0.016),
    windScroll2: new THREE.Vector2(-0.02, 0.024),
    envIntensity: 0.26
};

export function applyForgottenReefsWater(material) {
    if (!material?.uniforms) {
        return;
    }
    const w = FORGOTTEN_REEFS_WATER;
    const u = material.uniforms;
    u.uColorDeep.value.copy(w.deepColor);
    u.uColorShallow.value.copy(w.shallowColor);
    u.uFogColor.value.copy(w.fogColor);
    u.uFogDepth.value = w.fogDepth;
    u.uFogIntensity.value = w.fogIntensity;
    u.uTurbidity.value = w.turbidity;
    u.uAbsorption.value = w.absorption;
    u.uOpacity.value = w.opacity;
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = w.sparkleStrength;
    }
    if (u.waveScale) {
        u.waveScale.value = w.waveScale;
    }
    if (u.waveSpeed) {
        u.waveSpeed.value = w.waveSpeed;
    }
    if (u.waveAmplitude) {
        u.waveAmplitude.value = w.waveAmplitude;
    }
    if (u.chopMultiplier) {
        u.chopMultiplier.value = w.chopMultiplier;
    }
    if (u.rippleAmp) {
        u.rippleAmp.value = w.rippleAmp;
    }
    if (u.uScroll1) {
        u.uScroll1.value.copy(w.windScroll1);
    }
    if (u.uScroll2) {
        u.uScroll2.value.copy(w.windScroll2);
    }
    if (u.uEnvIntensity) {
        u.uEnvIntensity.value = w.envIntensity;
    }
    if (u.uFresnelScale) {
        u.uFresnelScale.value = 1.0;
    }
    if (u.uHasLakeBed) {
        u.uHasLakeBed.value = 0.0;
    }
    if (u.uOpaqueDeep) {
        u.uOpaqueDeep.value = 1.0;
    }
}

/** Twilight Trench — black abyss with moonlit surface glints (OCEAN only). */
export const TWILIGHT_TRENCH_WATER = {
    deepColor: new THREE.Color(0x000103),
    shallowColor: new THREE.Color(0x03060e),
    fogColor: new THREE.Color(0x010208),
    fogDepth: 58.0,
    fogIntensity: 0.94,
    turbidity: 0.04,
    absorption: 0.99,
    opacity: 0.99,
    sparkleStrength: 0.22,
    waveScale: 2.4,
    waveSpeed: 2.1,
    waveAmplitude: 0.12,
    chopMultiplier: 1.15,
    rippleAmp: 0.08,
    windScroll1: new THREE.Vector2(0.022, 0.011),
    windScroll2: new THREE.Vector2(-0.014, 0.016),
    envIntensity: 0.12
};

export function applyTwilightTrenchWater(material) {
    if (!material?.uniforms) {
        return;
    }
    const w = TWILIGHT_TRENCH_WATER;
    const u = material.uniforms;
    u.uColorDeep.value.copy(w.deepColor);
    u.uColorShallow.value.copy(w.shallowColor);
    u.uFogColor.value.copy(w.fogColor);
    u.uFogDepth.value = w.fogDepth;
    u.uFogIntensity.value = w.fogIntensity;
    u.uTurbidity.value = w.turbidity;
    u.uAbsorption.value = w.absorption;
    u.uOpacity.value = w.opacity;
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = w.sparkleStrength;
    }
    if (u.waveScale) {
        u.waveScale.value = w.waveScale;
    }
    if (u.waveSpeed) {
        u.waveSpeed.value = w.waveSpeed;
    }
    if (u.waveAmplitude) {
        u.waveAmplitude.value = w.waveAmplitude;
    }
    if (u.chopMultiplier) {
        u.chopMultiplier.value = w.chopMultiplier;
    }
    if (u.rippleAmp) {
        u.rippleAmp.value = w.rippleAmp;
    }
    if (u.uScroll1) {
        u.uScroll1.value.copy(w.windScroll1);
    }
    if (u.uScroll2) {
        u.uScroll2.value.copy(w.windScroll2);
    }
    if (u.uEnvIntensity) {
        u.uEnvIntensity.value = w.envIntensity;
    }
    if (u.uFresnelScale) {
        u.uFresnelScale.value = 0.92;
    }
    if (u.uHasLakeBed) {
        u.uHasLakeBed.value = 0.0;
    }
    if (u.uOpaqueDeep) {
        u.uOpaqueDeep.value = 1.0;
    }
}

/** Re-apply Cortez Backwaters shallow bay water to live shader uniforms. */
export function applyCortezBackwatersWaterColors(material) {
    applyShallowBayWaterColors(
        material,
        CORTEZ_BACKWATERS_WATER_DEEP_HEX,
        CORTEZ_BACKWATERS_WATER_SHALLOW_HEX,
        CORTEZ_BACKWATERS_WATER_FOG_HEX
    );
}

/** Re-apply locked Coral Kingdoms bay water to live shader uniforms. */
export function applyCoralKingdomsWaterColors(material) {
    applyShallowBayWaterColors(
        material,
        CORAL_KINGDOMS_WATER_DEEP_HEX,
        CORAL_KINGDOMS_WATER_SHALLOW_HEX,
        CORAL_KINGDOMS_WATER_FOG_HEX
    );
}

/** Restore default LAKE water uniforms (when leaving Coral Kingdoms). */
export function applyLakeWaterColors(material, config = getWaterBodyConfig('LAKE')) {
    if (!material?.uniforms || !config) {
        return;
    }
    const u = material.uniforms;
    u.uColorDeep.value.copy(config.deepColor);
    u.uColorShallow.value.copy(config.shallowColor);
    u.uFogColor.value.copy(config.fogColor);
    u.uAbsorption.value = config.absorption;
    u.uTurbidity.value = config.turbidity;
    u.uOpacity.value = config.opacity;
    u.uFogIntensity.value = config.fogIntensity;
    u.uFogDepth.value = config.fogDepth;
    if (u.uSparkleStrength) {
        u.uSparkleStrength.value = config.sparkleStrength;
    }
    if (u.uOpaqueDeep) {
        u.uOpaqueDeep.value = 0.0;
    }
    if (u.uFlatWater) {
        u.uFlatWater.value = 0.0;
    }
}

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
        /** Milky Amazon coffee-brown water */
        deepColor: new THREE.Color(0x3c2a18),
        shallowColor: new THREE.Color(0x9a7d5c),
        fogColor: new THREE.Color(0x6b5340),
        fogDepth: 9.0,
        fogIntensity: 0.55,
        turbidity: 0.82,
        absorption: 0.82,
        opacity: 0.97,
        sparkleStrength: 0.058,
        /** No lake swell — only directional flow ripples in the vertex shader. */
        riverMode: true,
        waveScale: 0.91,
        waveSpeed: 1.48,
        waveAmplitude: 0.018,
        flowDirection: new THREE.Vector2(1, 0),
        /** Wide, slow current — Amazon-scale river, not a rapid. */
        flowSpeed: 0.56,
        flowMapStrength: 0.77,
        hasFlow: true,
        windScroll1: new THREE.Vector2(0.03, 0.0),
        windScroll2: new THREE.Vector2(0.02, 0.0)
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

    FJORD: {
        name: 'Frozen Fjord',
        deepColor: frozenFjordWaterColor(),
        shallowColor: frozenFjordWaterColor(),
        fogColor: frozenFjordWaterColor(),
        fogDepth: 24.0,
        fogIntensity: 0.35,
        turbidity: 0.04,
        absorption: 0.95,
        opacity: 1.0,
        opaqueDeepWater: true,
        flatWaterColor: true,
        sparkleStrength: 0.14,
        waveScale: 0.82,
        waveSpeed: 1.35,
        waveAmplitude: 0.042,
        windScroll1: new THREE.Vector2(0.014, 0.007),
        windScroll2: new THREE.Vector2(-0.008, 0.011)
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

