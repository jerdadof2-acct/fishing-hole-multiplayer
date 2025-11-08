// src/audio/sfx.js

import * as THREE from "three";

export class Sfx {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.loader = new THREE.AudioLoader();

    this.cache = new Map();
  }

  async load(name, url, forceReload = false) {
    // If forceReload is true, clear any existing cache entry first
    if (forceReload && this.cache.has(name)) {
      this.cache.delete(name);
    }
    
    if (this.cache.has(name) && !forceReload) {
      return this.cache.get(name);
    }
    
    try {
      const buffer = await new Promise((resolve, reject) => {
        // Create a NEW loader instance each time to avoid any internal caching
        const loader = new THREE.AudioLoader();
        // Add cache-busting with both timestamp and random to force fresh fetch
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const cacheBustedUrl = url.includes('?') 
          ? url + '&_cb=' + timestamp + '&_r=' + random
          : url + '?_cb=' + timestamp + '&_r=' + random;
        
        // Use fetch API directly to bypass any Three.js caching, then decode manually
        fetch(cacheBustedUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.arrayBuffer();
          })
          .then(arrayBuffer => {
            // CRITICAL: Create a completely new AudioContext to avoid any caching
            // Use the listener's context if available, otherwise create new one
            const audioContext = this.listener ? this.listener.context : new (window.AudioContext || window.webkitAudioContext)();
            // Make a complete copy of the array buffer to ensure no caching
            const bufferCopy = arrayBuffer.slice(0);
            return audioContext.decodeAudioData(bufferCopy);
          })
          .then(audioBuffer => {
            resolve(audioBuffer);
          })
          .catch(error => {
            // Fallback to AudioLoader if fetch fails
            loader.load(
              cacheBustedUrl,
              (audioBuffer) => {
                resolve(audioBuffer);
              },
              undefined,
              reject
            );
          });
      });
      this.cache.set(name, buffer);
      return buffer;
    } catch (error) {
      // Don't cache failed loads - allows retry later
      console.warn(`Failed to load sound: ${name} from ${url}`, error);
      throw error;
    }
  }

  play2D(name, vol=0.8, rate=1.0) {
    const buffer = this.cache.get(name);
    if (!buffer) return;
    const src = new THREE.Audio(this.listener);
    src.setBuffer(buffer);
    src.setVolume(vol);
    src.setPlaybackRate(rate);
    src.play();
  }

  play3D(name, pos, scene, vol=0.9, rate=1.0) {
    const buffer = this.cache.get(name);
    if (!buffer) return;
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(buffer);
    sound.setRefDistance(8);
    sound.setVolume(vol);
    sound.setPlaybackRate(rate);
    const obj = new THREE.Object3D();
    obj.position.copy(pos);
    obj.add(sound);
    scene.add(obj);
    sound.play();
    // auto cleanup
    sound.source.onended = () => scene.remove(obj);
  }
}

