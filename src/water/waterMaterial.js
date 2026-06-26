// src/water/waterMaterial.js

import * as THREE from "three";

export function makeWaterMaterial({
  normalMap1,
  normalMap2,
  sunDir = new THREE.Vector3(0.3, 1, 0.2).normalize(),
  waterColor = new THREE.Color(0x2a6aa8),
  shallowColor = new THREE.Color(0x4fb4d9),
  fresnelPower = 5.0,
  fresnelScale = 1.0,
  fresnelBias = 0.02,
  sparkleStrength = 0.25,
  fogColor = new THREE.Color(0x88b5d6),
  fogDepth = 12.0,
  fogIntensity = 0.5,
  turbidity = 0.2,
  absorption = 0.7,
  opacity = 0.95,
  envMap = null,
  envIntensity = 0.42,
  lakeBedMap = null,
  flowMap = null,
  flowMapStrength = 0.0,
  riverMode = false,
  opaqueDeepWater = false,
  flatWaterColor = false
}) {
  normalMap1.wrapS = normalMap1.wrapT = THREE.RepeatWrapping;
  normalMap2.wrapS = normalMap2.wrapT = THREE.RepeatWrapping;

  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir },
    uCamPos: { value: new THREE.Vector3() },
    uNormal1: { value: normalMap1 },
    uNormal2: { value: normalMap2 },
    uColorDeep: { value: waterColor },
    uColorShallow: { value: shallowColor },
    uFresnelPower: { value: fresnelPower },
    uFresnelScale: { value: fresnelScale },
    uFresnelBias: { value: fresnelBias },
    uSparkleStrength: { value: sparkleStrength },
    uFogColor: { value: fogColor },
    uFogDepth: { value: fogDepth },
    uFogIntensity: { value: fogIntensity },
    uTurbidity: { value: turbidity },
    uAbsorption: { value: absorption },
    uOpacity: { value: opacity },
    uScroll1: { value: new THREE.Vector2(0.035, 0.02) },
    uScroll2: { value: new THREE.Vector2(-0.02, 0.03) },
    uUVScale1: { value: 4.0 },
    uUVScale2: { value: 8.0 },
    uFlowDirection: { value: new THREE.Vector2(0, 0) },
    uFlowSpeed: { value: 0.0 },
    uCloudTexture: { value: null },
    uEnvMap: { value: envMap },
    uHasEnvMap: { value: envMap ? 1.0 : 0.0 },
    uEnvIntensity: { value: envIntensity },
    uLakeBed: { value: lakeBedMap },
    uHasLakeBed: { value: lakeBedMap ? 1.0 : 0.0 },
    uFlowMap: { value: flowMap },
    uHasFlowMap: { value: flowMap ? 1.0 : 0.0 },
    uFlowMapStrength: { value: flowMapStrength },
    uRiverMode: { value: riverMode ? 1.0 : 0.0 },
    uOpaqueDeep: { value: opaqueDeepWater ? 1.0 : 0.0 },
    uFlatWater: { value: flatWaterColor ? 1.0 : 0.0 },
    uSandBed: { value: 0.0 }
  };

  const vert = /* glsl */`
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const frag = /* glsl */`
    precision highp float;
    uniform float uTime;
    uniform sampler2D uNormal1;
    uniform sampler2D uNormal2;
    uniform vec3 uSunDir;
    uniform vec3 uCamPos;
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform float uFresnelPower;
    uniform float uFresnelScale;
    uniform float uFresnelBias;
    uniform float uSparkleStrength;
    uniform vec3 uFogColor;
    uniform float uFogDepth;
    uniform float uFogIntensity;
    uniform float uTurbidity;
    uniform float uAbsorption;
    uniform float uOpacity;
    uniform vec2 uScroll1;
    uniform vec2 uScroll2;
    uniform float uUVScale1;
    uniform float uUVScale2;
    uniform vec2 uFlowDirection;
    uniform float uFlowSpeed;
    uniform sampler2D uCloudTexture;
    uniform samplerCube uEnvMap;
    uniform float uHasEnvMap;
    uniform float uEnvIntensity;
    uniform sampler2D uLakeBed;
    uniform float uHasLakeBed;
    uniform sampler2D uFlowMap;
    uniform float uHasFlowMap;
    uniform float uFlowMapStrength;
    uniform float uRiverMode;
    uniform float uOpaqueDeep;
    uniform float uFlatWater;
    uniform float uSandBed;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }

    float sampleFlow(vec2 uv) {
      float s = texture2D(uFlowMap, uv).r;
      s += texture2D(uFlowMap, uv + vec2(0.0, 0.014)).r;
      s += texture2D(uFlowMap, uv - vec2(0.0, 0.014)).r;
      s += texture2D(uFlowMap, uv + vec2(0.0, 0.028)).r * 0.55;
      s += texture2D(uFlowMap, uv - vec2(0.0, 0.028)).r * 0.55;
      return s / 4.1;
    }

    vec3 sampleSky(vec3 R) {
      vec3 cubeSky = textureCube(uEnvMap, R).rgb;
      float phi = atan(R.z, R.x);
      float theta = asin(clamp(R.y, -1.0, 1.0));
      vec2 skyUv = vec2(phi * 0.15915494 + 0.5, theta * 0.31830988 + 0.5);
      vec3 cloudSky = texture2D(uCloudTexture, skyUv).rgb;
      return mix(cloudSky, cubeSky, step(0.5, uHasEnvMap));
    }

    void main() {
      vec2 fDir = uFlowDirection;
      float fLen = length(fDir);
      if (fLen > 0.001) {
        fDir /= fLen;
      } else {
        fDir = vec2(-1.0, 0.0);
      }
      vec2 fPerp = vec2(-fDir.y, fDir.x);
      vec2 worldXZ = vWorldPos.xz;
      float along = dot(worldXZ, fDir);
      float across = dot(worldXZ, fPerp);
      float flowScrollT = uFlowSpeed * uTime;

      vec2 uv1;
      vec2 uv2;
      if (uRiverMode > 0.5) {
        float scroll = flowScrollT * 0.31;
        uv1 = vec2(along * 0.145 + scroll, across * 0.165) * 1.72;
        uv2 = vec2(along * 0.22 + scroll * 1.26 + 0.35, across * 0.245 + 0.12) * 2.4;
      } else {
        vec2 flowOffset = uFlowDirection * flowScrollT;
        vec2 flowScroll = flowOffset * 2.0;
        uv1 = vUv * uUVScale1 + uScroll1 * uTime + flowScroll;
        uv2 = vUv * uUVScale2 + uScroll2 * uTime + flowScroll * 0.85 + vec2(0.17, 0.09);
      }
      vec3 n1 = texture2D(uNormal1, uv1).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(uNormal2, uv2).xyz * 2.0 - 1.0;
      vec3 n = normalize(vec3(n1.x + n2.x, n1.y * 0.7 + n2.y * 0.7, n1.z + n2.z) + vNormal * (uRiverMode > 0.5 ? 0.24 : 0.35));

      vec3 V = normalize(uCamPos - vWorldPos);
      float fres = clamp(uFresnelBias + uFresnelScale * pow(1.0 - max(dot(V, n), 0.0), uFresnelPower), 0.0, 1.0);

      float ndl = max(dot(n, normalize(uSunDir)), 0.0);
      float sparkle = pow(ndl, 64.0) * uSparkleStrength;
      if (uRiverMode > 0.5) {
        float scroll = flowScrollT * 0.24;
        sparkle *= step(0.93, hash(vec2(along * 0.14 + scroll, across * 0.08)));
      } else if (uFlatWater > 0.5) {
        sparkle *= step(0.992, hash(vWorldPos.xz * 0.08 + uTime * 0.06)) * 0.35;
      } else {
        sparkle *= step(0.98, hash(vUv + uTime * 0.1));
      }

      vec3 L = normalize(uSunDir);
      vec3 H = normalize(L + V);
      float ndh = max(dot(n, H), 0.0);

      vec3 fjordGlint = vec3(0.0);
      if (uFlatWater > 0.5) {
        vec2 glintCell = vWorldPos.xz * 0.11;
        vec2 glintId = floor(glintCell);
        vec2 glintLocal = fract(glintCell) - 0.5;
        float clusterPhase = hash(glintId) * 6.28318;
        float clusterBurst = smoothstep(0.68, 0.96, sin(uTime * 0.38 + clusterPhase) * 0.5 + 0.5);
        float globalPulse = smoothstep(0.5, 0.9, sin(uTime * 0.19 + 2.1) * 0.5 + 0.5);
        float pointGate = step(0.84, hash(glintId + 1.73));
        float spot = 1.0 - smoothstep(0.0, 0.38, length(glintLocal));
        float glintMask = clusterBurst * globalPulse * pointGate * spot;

        float glintSpec = pow(ndh, 200.0) * ndl;
        vec3 glintTint = vec3(0.9, 0.95, 1.0);
        fjordGlint += glintTint * glintSpec * glintMask * uSparkleStrength * 5.5;

        float streakGate = step(0.975, hash(vWorldPos.xz * 0.15 + floor(uTime * 0.32)));
        float streakPulse = smoothstep(0.6, 0.95, sin(uTime * 0.27 + hash(vWorldPos.xz * 0.03) * 6.28318) * 0.5 + 0.5);
        float streakSpec = pow(ndh, 140.0) * ndl;
        fjordGlint += glintTint * streakSpec * streakGate * streakPulse * uSparkleStrength * 2.8;
      }

      float distFromCamera = length(uCamPos - vWorldPos);
      float depthY = clamp(-vWorldPos.y / uFogDepth, 0.0, 1.0);
      float depthDistance = clamp((distFromCamera - 10.0) / (uFogDepth * 3.0), 0.0, 1.0);
      float depth = max(depthY, depthDistance * 0.6);
      depth = pow(depth, 1.35);

      float depthBlend = uSandBed > 0.5 ? pow(depth, 2.5) : depth;
      vec3 base = mix(uColorShallow, uColorDeep, depthBlend);
      if (uFlatWater > 0.5) {
        base = uColorDeep;
      }
      float absorptionFactor = 1.0 - (depth * uAbsorption * 0.45);
      base *= max(absorptionFactor, uFlatWater > 0.5 ? 0.92 : 0.35);

      float spec = pow(ndh, 180.0);
      float sunSpecIntensity = (uFlowSpeed > 0.0) ? 1.5 : 1.0;
      float sunSpec = spec * ndl * fres * sunSpecIntensity;
      vec3 sunColor = vec3(1.0, 0.96, 0.88);
      vec3 sunReflectionColor = sunColor * sunSpec;

      vec3 R = reflect(-V, n);
      float skyFres = pow(1.0 - max(dot(V, n), 0.0), 2.4);
      vec3 skyReflection = sampleSky(R) * skyFres * uEnvIntensity;
      if (uFlatWater > 0.5) {
        skyReflection *= 0.18;
      }

      float fresBoost = uFlatWater > 0.5 ? 0.05 : 0.22;
      vec3 color = base + fres * fresBoost + sparkle + fjordGlint + sunReflectionColor + skyReflection;

      if (uRiverMode > 0.5 && uHasFlowMap > 0.5 && uFlowMapStrength > 0.0) {
        float scroll = flowScrollT * 0.25;
        vec2 flowUV1 = vec2(along * 0.048 + scroll, across * 0.105 + 0.31);
        vec2 flowUV2 = vec2(along * 0.078 + scroll * 1.18 + 0.27, across * 0.152 + 0.08);
        vec2 flowUV3 = vec2(along * 0.034 + scroll * 0.68 + 0.61, across * 0.076 + 0.52);
        float streak1 = sampleFlow(flowUV1);
        float streak2 = sampleFlow(flowUV2);
        float streak3 = sampleFlow(flowUV3);
        float streak = pow(clamp(streak1 * 0.66 + streak2 * 0.51 + streak3 * 0.31, 0.0, 1.0), 1.32);
        vec3 flowTint = vec3(0.78, 0.64, 0.46);
        color += flowTint * streak * uFlowMapStrength * (0.3 + fres * 0.58);
        color = mix(color, color + vec3(0.12, 0.08, 0.045) * streak, uFlowMapStrength * 0.36);
        float vein = smoothstep(0.38, 0.88, streak);
        color += vec3(0.1, 0.068, 0.035) * vein * uFlowMapStrength * 0.11;
      } else if (uFlowSpeed > 0.0 && uHasFlowMap > 0.5 && uFlowMapStrength > 0.0) {
        vec2 fPerp2 = vec2(-fDir.y, fDir.x);
        float along2 = dot(worldXZ, fDir);
        float across2 = dot(worldXZ, fPerp2);
        float scroll = flowScrollT * 0.48;
        vec2 flowUV1 = vec2(along2 * 0.07 + scroll, across2 * 0.19 + 0.37);
        vec2 flowUV2 = vec2(along2 * 0.12 + scroll * 1.28 + 0.43, across2 * 0.26 + 0.11);
        float streak1 = texture2D(uFlowMap, flowUV1).r;
        float streak2 = texture2D(uFlowMap, flowUV2).r;
        float streak = pow(clamp(streak1 * 0.65 + streak2 * 0.45, 0.0, 1.0), 1.25);
        vec3 flowTint = vec3(0.45, 0.68, 0.82);
        color += flowTint * streak * uFlowMapStrength * (0.28 + fres * 0.72);
        color = mix(color, color + vec3(0.05, 0.09, 0.11) * streak, uFlowMapStrength * 0.38);
      }

      if (uHasLakeBed > 0.5) {
        vec2 bedXZ = vWorldPos.xz;
        if (uSandBed > 0.5) {
          float cs = 0.9553;
          float sn = 0.2955;
          bedXZ = vec2(bedXZ.x * cs - bedXZ.y * sn, bedXZ.x * sn + bedXZ.y * cs);
        }
        vec2 bedUV = bedXZ * (uSandBed > 0.5 ? 0.02 : 0.042);
        vec3 bed = texture2D(uLakeBed, bedUV).rgb;
        if (uSandBed > 0.5) {
          vec3 bedB = texture2D(uLakeBed, bedUV + vec2(0.005, 0.003)).rgb;
          vec3 bedC = texture2D(uLakeBed, bedUV + vec2(-0.004, 0.005)).rgb;
          vec3 bedD = texture2D(uLakeBed, bedUV + vec2(0.003, -0.004)).rgb;
          bed = (bed + bedB + bedC + bedD) * 0.25;
        }
        float shallow = 1.0 - depth;
        shallow = pow(shallow, 2.2);
        vec3 bedTint = uSandBed > 0.5
          ? vec3(0.58, 0.84, 0.98)
          : (uRiverMode > 0.5 ? vec3(0.9, 0.74, 0.52) : vec3(0.72, 0.86, 0.98));
        float bedMix = uSandBed > 0.5
          ? shallow * 0.16
          : (uRiverMode > 0.5 ? shallow * 0.24 : shallow * 0.38);
        if (uOpaqueDeep > 0.5) {
          bedMix *= (1.0 - pow(clamp(depth, 0.0, 1.0), 1.6));
        }
        color = mix(color, bed * bedTint, bedMix);
      }

      float fogAmount = depth * uFogIntensity;
      float turbidityAmount = depth * uTurbidity;
      if (uFlatWater < 0.5) {
        color = mix(color, uFogColor, fogAmount * 0.28);
        color = mix(color, uFogColor * 0.7, turbidityAmount * 0.18);
      }

      float finalOpacity;
      if (uOpaqueDeep > 0.5) {
        float d = pow(clamp(depth, 0.0, 1.0), uFlatWater > 0.5 ? 0.35 : 0.65);
        finalOpacity = mix(uOpacity * (uFlatWater > 0.5 ? 0.95 : 0.78), 1.0, d);
      } else {
        finalOpacity = mix(uOpacity, uOpacity + (1.0 - uOpacity) * 0.45, depth);
        finalOpacity = mix(finalOpacity * 0.58, finalOpacity, depth);
      }

      gl_FragColor = vec4(color, finalOpacity);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true
  });

  mat.userData.tick = (dt, camera) => {
    mat.uniforms.uTime.value += dt;
    if (camera) mat.uniforms.uCamPos.value.copy(camera.position);
  };

  return mat;
}
