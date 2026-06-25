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
  lakeBedMap = null
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
    uHasLakeBed: { value: lakeBedMap ? 1.0 : 0.0 }
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

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }

    vec3 sampleSky(vec3 R) {
      if (uHasEnvMap > 0.5) {
        return textureCube(uEnvMap, R).rgb;
      }
      float phi = atan(R.z, R.x);
      float theta = asin(clamp(R.y, -1.0, 1.0));
      vec2 skyUv = vec2(phi * 0.15915494 + 0.5, theta * 0.31830988 + 0.5);
      return texture2D(uCloudTexture, skyUv).rgb;
    }

    void main() {
      vec2 flowOffset = uFlowDirection * uFlowSpeed * uTime;
      vec2 flowScroll = flowOffset * 2.0;
      vec2 uv1 = vUv * uUVScale1 + uScroll1 * uTime + flowScroll;
      vec2 uv2 = vUv * uUVScale2 + uScroll2 * uTime + flowScroll * 0.85 + vec2(0.17, 0.09);
      vec3 n1 = texture2D(uNormal1, uv1).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(uNormal2, uv2).xyz * 2.0 - 1.0;
      vec3 n = normalize(vec3(n1.x + n2.x, n1.y * 0.7 + n2.y * 0.7, n1.z + n2.z) + vNormal * 0.35);

      vec3 V = normalize(uCamPos - vWorldPos);
      float fres = clamp(uFresnelBias + uFresnelScale * pow(1.0 - max(dot(V, n), 0.0), uFresnelPower), 0.0, 1.0);

      float ndl = max(dot(n, normalize(uSunDir)), 0.0);
      float sparkle = pow(ndl, 64.0) * uSparkleStrength;
      sparkle *= step(0.98, hash(vUv + uTime * 0.1));

      float distFromCamera = length(uCamPos - vWorldPos);
      float depthY = clamp(-vWorldPos.y / uFogDepth, 0.0, 1.0);
      float depthDistance = clamp((distFromCamera - 10.0) / (uFogDepth * 3.0), 0.0, 1.0);
      float depth = max(depthY, depthDistance * 0.6);
      depth = pow(depth, 1.35);

      vec3 base = mix(uColorShallow, uColorDeep, depth);
      float absorptionFactor = 1.0 - (depth * uAbsorption * 0.45);
      base *= max(absorptionFactor, 0.35);

      vec3 L = normalize(uSunDir);
      vec3 H = normalize(L + V);
      float ndh = max(dot(n, H), 0.0);
      float spec = pow(ndh, 180.0);
      float sunSpecIntensity = (uFlowSpeed > 0.0) ? 1.5 : 1.0;
      float sunSpec = spec * ndl * fres * sunSpecIntensity;
      vec3 sunColor = vec3(1.0, 0.96, 0.88);
      vec3 sunReflectionColor = sunColor * sunSpec;

      vec3 R = reflect(-V, n);
      float skyFres = pow(1.0 - max(dot(V, n), 0.0), 2.4);
      vec3 skyReflection = sampleSky(R) * skyFres * uEnvIntensity;

      vec3 color = base + fres * 0.22 + sparkle + sunReflectionColor + skyReflection;

      if (uHasLakeBed > 0.5) {
        vec2 bedUV = vWorldPos.xz * 0.042;
        vec3 bed = texture2D(uLakeBed, bedUV).rgb;
        float shallow = 1.0 - depth;
        shallow = pow(shallow, 2.2);
        color = mix(color, bed * vec3(0.72, 0.86, 0.98), shallow * 0.38);
      }

      float fogAmount = depth * uFogIntensity;
      float turbidityAmount = depth * uTurbidity;
      color = mix(color, uFogColor, fogAmount * 0.28);
      color = mix(color, uFogColor * 0.7, turbidityAmount * 0.18);

      float finalOpacity = mix(uOpacity, uOpacity + (1.0 - uOpacity) * 0.45, depth);
      finalOpacity = mix(finalOpacity * 0.58, finalOpacity, depth);

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
