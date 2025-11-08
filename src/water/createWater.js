// src/water/createWater.js

import * as THREE from "three";
import { makeWaterMaterial } from "./waterMaterial.js";

export function createWater(scene, camera) {
  const geo = new THREE.PlaneGeometry(200, 200, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const loader = new THREE.TextureLoader();
  const nm1 = loader.load("/assets/textures/waterNormals1.jpg");
  const nm2 = loader.load("/assets/textures/waterNormals2.jpg");

  const mat = makeWaterMaterial({ normalMap1: nm1, normalMap2: nm2 });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "LakeWater";
  mesh.renderOrder = 1;
  scene.add(mesh);

  // Per-frame tick
  mesh.onBeforeRender = function(_renderer, _scene, _camera, _geometry, _material, _group) {
    const dt = (performance.now() - (mesh._lastT || performance.now())) / 1000;
    mesh._lastT = performance.now();
    _material.userData.tick?.(dt, _camera);
  };

  return mesh;
}










