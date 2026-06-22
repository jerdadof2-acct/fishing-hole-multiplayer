// src/effects/waterParticles.js

import * as THREE from "three";

export function addWaterParticles(scene) {
  const count = 600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    pos[i*3+0] = (Math.random() - 0.5) * 180;
    pos[i*3+1] = Math.random() * 0.5 + 0.1; // just above surface
    pos[i*3+2] = (Math.random() - 0.5) * 180;
  }
  
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  // Try to load particle texture, but create a fallback if it fails
  let particleTexture = null;
  const loader = new THREE.TextureLoader();
  
  try {
    particleTexture = loader.load(
      "/assets/textures/particle.png",
      () => {}, // onLoad callback
      undefined, // onProgress
      (err) => {
        // onError - create a procedural sprite instead
        console.warn('Particle texture not found, creating procedural sprite');
        particleTexture = createProceduralParticleSprite();
      }
    );
  } catch (e) {
    console.warn('Error loading particle texture, using procedural sprite');
    particleTexture = createProceduralParticleSprite();
  }
  
  // If texture still null after a moment, use procedural sprite
  if (!particleTexture || !particleTexture.image) {
    particleTexture = createProceduralParticleSprite();
  }

  const mat = new THREE.PointsMaterial({
    size: 0.15,
    map: particleTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.6
  });

  const points = new THREE.Points(geo, mat);
  points.name = "WaterParticles";
  points.userData = points.userData || {};
  points.userData.rotationSpeed = 0.00025;
  points.userData.lastRotationTime = performance.now();
  scene.add(points);

  points.onBeforeRender = function() {
    const speed = points.userData.rotationSpeed ?? 0.00025;
    const now = performance.now();
    const lastTime = points.userData.lastRotationTime ?? now;

    if (speed === 0) {
      points.userData.lastRotationTime = now;
      return;
    }

    const delta = now - lastTime;
    points.rotation.y += delta * speed;
    points.userData.lastRotationTime = now;
  };
  
  return points;
}

// Create a simple procedural particle sprite (circular white dot)
function createProceduralParticleSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Create circular gradient for soft particle
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}











