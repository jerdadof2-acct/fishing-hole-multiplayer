import * as THREE from 'three';

/**
 * Simple sound manager using Web Audio API
 * Generates procedural sounds without external audio files
 */
export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterVolume = 0.3; // Overall volume control
        
        // Initialize Web Audio API
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported, sounds disabled');
        }
    }
    
    /**
     * Generate a simple splash sound using oscillators
     */
    playSplash() {
        if (!this.audioContext) return;
        
        const duration = 0.3;
        const sampleRate = this.audioContext.sampleRate;
        const frameCount = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate noise-like splash sound with low-pass filtered noise
        for (let i = 0; i < frameCount; i++) {
            const t = i / sampleRate;
            // White noise
            const noise = Math.random() * 2 - 1;
            // Exponential decay envelope
            const envelope = Math.exp(-t * 8);
            // Low-pass filter effect (smoothing)
            const filteredNoise = noise * envelope * 0.3;
            // Apply frequency sweep for more realistic splash
            const frequency = 200 + t * 800; // Start low, go high
            const wave = Math.sin(t * frequency * 2 * Math.PI) * 0.1;
            
            data[i] = (filteredNoise + wave) * envelope * this.masterVolume;
        }
        
        // Play the sound
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }
    
    /**
     * Generate a bigger, deeper splash for fish landing
     */
    playBigSplash() {
        if (!this.audioContext) return;
        
        const duration = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const frameCount = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate deeper, bigger splash sound
        for (let i = 0; i < frameCount; i++) {
            const t = i / sampleRate;
            // Multiple layers for richness
            const noise1 = Math.random() * 2 - 1;
            const noise2 = Math.random() * 2 - 1;
            // Slower decay for longer sound
            const envelope = Math.exp(-t * 4);
            // Lower frequency sweep
            const frequency = 100 + t * 500;
            const wave = Math.sin(t * frequency * 2 * Math.PI) * 0.15;
            
            data[i] = ((noise1 + noise2 * 0.5) * 0.4 + wave) * envelope * this.masterVolume;
        }
        
        // Play the sound
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }
    
    /**
     * Adjust master volume
     */
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
}











