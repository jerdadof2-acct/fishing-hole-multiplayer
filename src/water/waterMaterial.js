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
  fogIntensity = 0.5,        // How much fog affects color (0-1)
  turbidity = 0.2,           // Water murkiness (0-1)
  absorption = 0.7,          // Light absorption with depth (0-1)
  opacity = 0.95             // Base water opacity
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
    uScroll1: { value: new THREE.Vector2(0.07, 0.03) },
    uScroll2: { value: new THREE.Vector2(-0.03, 0.05) },
    uUVScale1: { value: 4.0 },
    uUVScale2: { value: 8.0 },
    uFlowDirection: { value: new THREE.Vector2(0, 0) },  // River flow direction (0,0 = no flow)
    uFlowSpeed: { value: 0.0 },  // River flow speed
    uCloudTexture: { value: null }  // Cloud/sky reflection texture
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

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;

    // Hash/Noise for cheap sparkles
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    
    // Simple noise for procedural clouds
    float noise(vec2 p) {
        return hash(p * 0.5) * 0.5 + hash(p * 0.25) * 0.25 + hash(p * 0.125) * 0.125;
    }

    void main() {
      // Apply flow direction for rivers (left to right)
      vec2 flowOffset = uFlowDirection * uFlowSpeed * uTime;
      
      // Two scrolling normal maps (with flow direction applied for rivers)
      // Flow direction makes waves scroll in the flow direction (left to right for rivers)
      vec2 flowScroll = flowOffset * 2.0; // Amplify flow effect on normal maps (2x for visibility)
      vec2 uv1 = vUv * uUVScale1 + uScroll1 * uTime + flowScroll;
      vec2 uv2 = vUv * uUVScale2 + uScroll2 * uTime + flowScroll;
      vec3 n1 = texture2D(uNormal1, uv1).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(uNormal2, uv2).xyz * 2.0 - 1.0;
      vec3 n = normalize(mix(n1, n2, 0.5) + vNormal * 0.5);

      // Fresnel
      vec3 V = normalize(uCamPos - vWorldPos);
      float fres = clamp(uFresnelBias + uFresnelScale * pow(1.0 - max(dot(V, n), 0.0), uFresnelPower), 0.0, 1.0);

      // Specular sparkle where sun hits
      float ndl = max(dot(n, normalize(uSunDir)), 0.0);
      float sparkle = pow(ndl, 64.0) * uSparkleStrength;
      sparkle *= step(0.98, hash(vUv + uTime * 0.1)); // sparse glitter

      // Enhanced depth calculation
      // Use distance from camera for more realistic depth perception
      float distFromCamera = length(uCamPos - vWorldPos);
      
      // Depth fog: combine Y-based depth and distance-based depth
      // Y-based depth (vertical depth in water)
      float depthY = clamp(-vWorldPos.y / uFogDepth, 0.0, 1.0);
      
      // Distance-based depth (horizontal/forward depth perception)
      // Makes water look deeper as it extends away from camera
      float depthDistance = clamp((distFromCamera - 10.0) / (uFogDepth * 3.0), 0.0, 1.0);
      
      // Combined depth (both vertical and distance contribute)
      float depth = max(depthY, depthDistance * 0.6);
      
      // Apply exponential curve for more dramatic depth transition
      depth = pow(depth, 1.5);

      // Mix shallow vs deep with enhanced absorption
      vec3 base = mix(uColorShallow, uColorDeep, depth);
      
      // Apply light absorption (deeper = darker, more absorbed)
      // Reduce absorption effect to keep blue vibrant
      float absorptionFactor = 1.0 - (depth * uAbsorption * 0.5); // Reduce by 50% to maintain color
      base *= max(absorptionFactor, 0.3); // Clamp to minimum brightness to keep blue visible

      // Real specular highlight from sun using Blinn-Phong
      // Reuse existing V and ndl (already declared above)
      vec3 L = normalize(uSunDir); // Light direction
      // V is already declared above for fresnel calculation
      vec3 H = normalize(L + V); // Halfway vector for Blinn-Phong
      
      // ndl is already calculated above for sparkle, reuse it
      float ndh = max(dot(n, H), 0.0); // Dot product of normal and halfway vector
      
      // Shininess controls highlight size (120-240 for crisp sun streaks)
      float shininess = 160.0;
      float spec = pow(ndh, shininess);
      
      // Modulate with fresnel so it pops at glancing angles, and only where sun hits
      // For rivers (uFlowSpeed > 0), increase sun reflection intensity for brighter river
      float sunSpecIntensity = (uFlowSpeed > 0.0) ? 1.5 : 1.0; // Increase for rivers (brighter, more visible)
      float sunSpec = spec * ndl * fres * sunSpecIntensity;
      
      // Warm sun tint
      vec3 sunColor = vec3(1.0, 0.96, 0.88);
      vec3 sunReflectionColor = sunColor * sunSpec;

      // Add fresnel brights, specular, and sun reflection
      // Reduce fresnel addition to avoid washing out blue
      vec3 color = base + fres * 0.15 + sparkle + sunReflectionColor; // Real specular instead of fake blob

      // Enhanced fog blending with turbidity (murky water effect)
      // Deeper water gets more foggy and murky
      float fogAmount = depth * uFogIntensity;
      float turbidityAmount = depth * uTurbidity;
      
      // Blend toward fog color with depth - use minimal blending to preserve blue
      color = mix(color, uFogColor, fogAmount * 0.3); // Reduced from 0.6 to 0.3 to maintain blue
      
      // Add turbidity (make it murkier/darker) but preserve blue saturation - minimal mixing
      color = mix(color, uFogColor * 0.7, turbidityAmount * 0.2); // Reduced from 0.5 to 0.2 to keep blue vibrant

      // Opacity increases with depth (deeper = more opaque)
      float finalOpacity = mix(uOpacity, uOpacity + (1.0 - uOpacity) * 0.5, depth);

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

