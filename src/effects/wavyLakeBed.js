import * as THREE from 'three';

const WAVE_GLSL = `
uniform float uBedWaveStrength;
uniform float uBedTime;
uniform float uBedWaveSpeed;
uniform float uBedWaveScale;
uniform float uBedWaveAmplitude;
uniform float uBedChopMultiplier;

float wavyLakeBedHeight(vec2 p) {
    if (uBedWaveStrength < 0.001) {
        return 0.0;
    }

    float wave1 = sin(p.x * 3.0 + uBedTime * uBedWaveSpeed) * uBedWaveAmplitude;
    float wave2 = sin(p.y * 3.0 + uBedTime * uBedWaveSpeed * 0.8) * uBedWaveAmplitude;
    float wave3 = sin((p.x + p.y) * 2.2 + uBedTime * uBedWaveSpeed * 0.55) * uBedWaveAmplitude * 0.85;
    float wave4 = sin((p.x - p.y) * 2.0 + uBedTime * uBedWaveSpeed * 0.37) * uBedWaveAmplitude * 0.7;
    float chop1 = sin(p.x * 5.0 + uBedTime * uBedWaveSpeed * 1.5) * uBedWaveAmplitude * 0.4 * uBedChopMultiplier;
    float chop2 = sin(p.y * 4.5 + uBedTime * uBedWaveSpeed * 1.3) * uBedWaveAmplitude * 0.4 * uBedChopMultiplier;
    float chop3 = sin((p.x - p.y) * 6.8 + uBedTime * uBedWaveSpeed * 1.85)
        * uBedWaveAmplitude * 0.32 * max(uBedChopMultiplier - 1.0, 0.0);
    float chop4 = sin((p.x + p.y * 0.7) * 7.2 + uBedTime * uBedWaveSpeed * 2.1)
        * uBedWaveAmplitude * 0.26 * max(uBedChopMultiplier - 1.0, 0.0);

    return (wave1 + wave2 + wave3 + wave4 + chop1 + chop2 + chop3 + chop4) * uBedWaveScale;
}
`;

/**
 * Match lake-bed shadow receiving to the LAKE water swell (Cortez shallow flats).
 * @param {THREE.MeshStandardMaterial} material
 */
export function installWavyLakeBed(material) {
    if (!material || material.userData.wavyLakeBedInstalled) {
        return;
    }

    material.userData.wavyLakeBedInstalled = true;
    material.userData.wavyLakeBedUniforms = {
        uBedWaveStrength: { value: 0 },
        uBedTime: { value: 0 },
        uBedWaveSpeed: { value: 2.0 },
        uBedWaveScale: { value: 1.1 },
        uBedWaveAmplitude: { value: 0.07 },
        uBedChopMultiplier: { value: 1.0 }
    };

    const previousOnBeforeCompile = material.onBeforeCompile?.bind(material);

    material.onBeforeCompile = (shader) => {
        previousOnBeforeCompile?.(shader);

        Object.assign(shader.uniforms, material.userData.wavyLakeBedUniforms);

        shader.vertexShader = WAVE_GLSL + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            {
                vec2 bedP = vec2(transformed.x, transformed.y);
                float bedH = wavyLakeBedHeight(bedP);
                transformed.z += bedH;
                float bedEps = 0.4;
                float dhdx = wavyLakeBedHeight(bedP + vec2(bedEps, 0.0)) - bedH;
                float dhdy = wavyLakeBedHeight(bedP + vec2(0.0, bedEps)) - bedH;
                objectNormal = normalize(vec3(-dhdx / bedEps, -dhdy / bedEps, 1.0));
            }`
        );

        material.userData.wavyLakeBedShader = shader;
    };

    material.customProgramCacheKey = () => 'wavyLakeBed_v2';
}

/**
 * @param {THREE.MeshStandardMaterial} material
 * @param {import('three').ShaderMaterial | null} waterMaterial
 * @param {object | null} waterBodyConfig
 * @param {boolean} enabled
 */
export function syncWavyLakeBed(material, waterMaterial, waterBodyConfig, enabled) {
    const bedUniforms = material?.userData?.wavyLakeBedUniforms;
    if (!bedUniforms) {
        return;
    }

    const wu = waterMaterial?.uniforms;
    const cfg = waterBodyConfig || {};

    bedUniforms.uBedWaveStrength.value = enabled ? 0.78 : 0;
    bedUniforms.uBedTime.value = wu?.uTime?.value ?? 0;
    bedUniforms.uBedWaveSpeed.value = wu?.waveSpeed?.value ?? cfg.waveSpeed ?? 2.0;
    bedUniforms.uBedWaveScale.value = wu?.waveScale?.value ?? cfg.waveScale ?? 1.1;
    bedUniforms.uBedWaveAmplitude.value = wu?.waveAmplitude?.value ?? cfg.waveAmplitude ?? 0.07;
    bedUniforms.uBedChopMultiplier.value = wu?.chopMultiplier?.value ?? cfg.chopMultiplier ?? 1.0;
}

/**
 * Higher segment count so shadow edges can follow the swell.
 * @param {THREE.Mesh} bedMesh
 * @param {number} groundSize
 */
export function ensureWavyLakeBedGeometry(bedMesh, groundSize) {
    if (!bedMesh?.geometry || !groundSize) {
        return;
    }

    const params = bedMesh.geometry.parameters;
    const segments = 64;

    if (params?.widthSegments === segments && params?.heightSegments === segments) {
        return;
    }

    const replacement = new THREE.PlaneGeometry(groundSize, groundSize, segments, segments);
    bedMesh.geometry.dispose();
    bedMesh.geometry = replacement;
}
