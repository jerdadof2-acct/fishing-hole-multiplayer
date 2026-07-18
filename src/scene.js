import * as THREE from 'three';
import {
    SUN_DIRECTIONAL_POSITION,
    SUN_DIRECTIONAL_TARGET,
    applySunShadowCameraBounds,
    SUN_SHADOW_ORTHO_DEFAULT
} from './scene/sunShadowDirection.js';
import { bindViewportSync, getGameViewportSize, syncViewportShell } from './viewport.js';

function applyCanvasLayout(canvasEl) {
    canvasEl.style.position = 'absolute';
    canvasEl.style.top = '0';
    canvasEl.style.left = '0';
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    canvasEl.style.margin = '0';
    canvasEl.style.padding = '0';
    canvasEl.style.border = '0';
}

/*
 * GPU crash recovery.
 * Some devices (e.g. Pixel/PowerVR on new Android drivers) kill the WebGL
 * context under memory pressure. Without handling, the canvas goes white
 * forever. We remember the crash in sessionStorage and reboot into a
 * reduced-memory "safe mode" (lower resolution, smaller shadows).
 */
const GPU_SAFE_MODE_KEY = 'halley-gpu-safe-mode';
const GPU_RELOAD_COUNT_KEY = 'halley-gpu-reload-count';
const GPU_MAX_AUTO_RELOADS = 2;
const GPU_RESTORE_WAIT_MS = 5000;

function isGpuSafeMode() {
    try {
        return sessionStorage.getItem(GPU_SAFE_MODE_KEY) === '1';
    } catch {
        return false;
    }
}

function markGpuSafeMode() {
    try {
        sessionStorage.setItem(GPU_SAFE_MODE_KEY, '1');
    } catch {
        // Storage unavailable — safe mode simply won't persist.
    }
}

function getGpuReloadCount() {
    try {
        return Number(sessionStorage.getItem(GPU_RELOAD_COUNT_KEY)) || 0;
    } catch {
        return 0;
    }
}

function bumpGpuReloadCount() {
    try {
        sessionStorage.setItem(GPU_RELOAD_COUNT_KEY, String(getGpuReloadCount() + 1));
    } catch {
        // Ignore — worst case we allow an extra reload.
    }
}

function showGpuOverlay(message, { tapToReload = false } = {}) {
    let overlay = document.getElementById('gpu-recovery-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gpu-recovery-overlay';
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:99999',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'text-align:center',
            'padding:24px',
            'background:rgba(8, 20, 34, 0.92)',
            'color:#eaf6ff',
            'font-family:inherit',
            'font-size:16px',
            'line-height:1.5'
        ].join(';');
        document.body.appendChild(overlay);
    }
    overlay.textContent = message;
    if (tapToReload) {
        overlay.style.cursor = 'pointer';
        overlay.addEventListener('click', () => window.location.reload(), { once: true });
    }
    return overlay;
}

function hideGpuOverlay() {
    document.getElementById('gpu-recovery-overlay')?.remove();
}

export class Scene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.hemisphereLight = null;
        this.directionalLight = null;
        this.rimLight = null;
        this.ambientLight = null;
        this.sceneryFillLight = null;
        this.defaultEnvironment = {
            background: 0x87ceeb,
            fogColor: 0x87ceeb,
            fogNear: 50,
            fogFar: 200,
            hemisphereSkyColor: 0xffffff,
            hemisphereGroundColor: 0x446688,
            hemisphereIntensity: 0.7,
            directionalColor: 0xffffff,
            directionalIntensity: 0.8,
            rimColor: 0x9fdcff,
            rimIntensity: 0.32,
            ambientColor: 0xffffff,
            ambientIntensity: 0.35,
            sceneryFillColor: 0xffe8c0,
            sceneryFillIntensity: 0
        };
        this.currentEnvironment = null;
    }

    async init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
        
        // Add grid helper for debugging
        // const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        // gridHelper.position.y = -0.01;
        // this.scene.add(gridHelper);
        
        // Add axes helper for debugging
        // const axesHelper = new THREE.AxesHelper(5);
        // this.scene.add(axesHelper);

        // Set up lights for cartoon style
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x446688, 0.7);
        this.scene.add(hemisphereLight);
        this.hemisphereLight = hemisphereLight;

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.copy(SUN_DIRECTIONAL_POSITION);
        directionalLight.target.position.copy(SUN_DIRECTIONAL_TARGET);
        this.scene.add(directionalLight.target);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        applySunShadowCameraBounds(directionalLight, SUN_SHADOW_ORTHO_DEFAULT);
        // Darker shadows for better visibility on water
        // Minimal bias to reduce gap between object and shadow (shadow acne vs shadow gap trade-off)
        directionalLight.shadow.bias = 0.0; // Zero bias for tight shadows (may see slight acne but shadows are closer)
        directionalLight.shadow.normalBias = 0.0; // No normal bias to keep shadows tight
        directionalLight.shadow.radius = 4; // Softer shadow edges
        if (directionalLight.shadow.intensity !== undefined) {
            directionalLight.shadow.intensity = 1.0; // Maximum shadow darkness
        }
        this.scene.add(directionalLight);
        this.directionalLight = directionalLight;

        const rimLight = new THREE.DirectionalLight(0x9fdcff, 0.32);
        rimLight.position.set(6, 8, -8);
        rimLight.castShadow = false;
        this.scene.add(rimLight);
        this.rimLight = rimLight;

        // Ambient light for overall illumination
        // Increased slightly to brighten cat on dock
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); // Increased from 0.25 to 0.35 to brighten cat
        this.scene.add(ambientLight);
        this.ambientLight = ambientLight;

        const sceneryFillLight = new THREE.DirectionalLight(0xffe8c0, 0);
        sceneryFillLight.position.set(4, 22, -6);
        sceneryFillLight.target.position.set(0, 0, 2);
        this.scene.add(sceneryFillLight.target);
        sceneryFillLight.castShadow = false;
        this.scene.add(sceneryFillLight);
        this.sceneryFillLight = sceneryFillLight;

        // Apply default environment to ensure lights/fog sync with overrides
        this.setEnvironment();

        syncViewportShell();

        // Create camera (will be configured by Camera class)
        const { width, height } = getGameViewportSize();
        const aspect = width / height;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);

        const isMobile = typeof navigator !== 'undefined'
            && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const safeMode = isGpuSafeMode();
        if (safeMode) {
            console.warn('[SCENE] GPU safe mode active: reduced resolution and shadows.');
        }

        const shadowMapSize = safeMode ? 512 : (isMobile ? 1024 : 2048);
        if (this.directionalLight?.shadow?.mapSize) {
            this.directionalLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
        }

        // Create renderer
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: !isMobile,
                alpha: false,
                powerPreference: isMobile ? 'default' : 'high-performance',
                failIfMajorPerformanceCaveat: false
            });
        } catch (error) {
            console.error('[SCENE] WebGL renderer failed:', error);
            // Context creation usually fails because the browser blocked WebGL
            // after GPU crashes — not because the hardware lacks support.
            throw new Error(
                'Graphics failed to start. Close other apps and browser tabs, then reload the page. '
                + 'If it keeps happening, restart your browser or device.'
            );
        }
        this.renderer = renderer;
        this.renderer.setClearColor(0x87ceeb, 1);
        this.renderer.setSize(width, height, false);
        const pixelRatioCap = safeMode ? 1 : (isMobile ? 1.5 : 2);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        
        const container = document.getElementById('game-container');
        if (!container) {
            throw new Error('Game container not found');
        }
        container.prepend(this.renderer.domElement);
        applyCanvasLayout(this.renderer.domElement);

        this._bindContextLossRecovery();

        bindViewportSync(() => this.onWindowResize());
    }

    /**
     * Recover from GPU driver resets (white screen). If the browser restores
     * the context we resume in place; otherwise we reload once into safe mode.
     */
    _bindContextLossRecovery() {
        const canvas = this.renderer.domElement;

        // If we survive a minute of play, allow future crashes fresh reloads.
        setTimeout(() => {
            try {
                sessionStorage.removeItem(GPU_RELOAD_COUNT_KEY);
            } catch {
                // Ignore storage failures.
            }
        }, 60000);

        canvas.addEventListener('webglcontextlost', (event) => {
            // preventDefault tells the browser we want a restore attempt.
            event.preventDefault();
            console.error('[SCENE] WebGL context lost.');
            this.contextLost = true;

            showGpuOverlay('Graphics hiccup — recovering…');

            this._restoreTimer = setTimeout(() => {
                if (!this.contextLost) {
                    return;
                }
                // No restore came. Reload into safe mode (lower GPU memory),
                // but stop auto-reloading if that isn't fixing it.
                markGpuSafeMode();
                if (getGpuReloadCount() < GPU_MAX_AUTO_RELOADS) {
                    bumpGpuReloadCount();
                    window.location.reload();
                } else {
                    showGpuOverlay(
                        'Graphics keep crashing on this device. Close other apps and tabs, '
                        + 'then tap here to try again.',
                        { tapToReload: true }
                    );
                }
            }, GPU_RESTORE_WAIT_MS);
        });

        canvas.addEventListener('webglcontextrestored', () => {
            console.warn('[SCENE] WebGL context restored.');
            this.contextLost = false;
            clearTimeout(this._restoreTimer);
            hideGpuOverlay();
        });
    }

    onWindowResize() {
        const { width, height } = getGameViewportSize();
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    render() {
        if (this.contextLost) {
            return;
        }
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Apply environment lighting/fog overrides, merging with defaults.
     * @param {Object} overrides
     */
    setEnvironment(overrides = {}) {
        if (!this.scene) {
            return;
        }

        const env = {
            ...this.defaultEnvironment,
            ...overrides
        };

        // Only change background when caller passes background explicitly (e.g. Celestial).
        // After HDRI load, scene.background is a Texture — never call .set() on it.
        if (Object.prototype.hasOwnProperty.call(overrides, 'background')) {
            const bg = overrides.background;
            if (this.scene.background?.isColor) {
                this.scene.background.set(bg);
            } else {
                this.scene.background = new THREE.Color(bg);
            }
        }

        if (!this.scene.fog) {
            this.scene.fog = new THREE.Fog(env.fogColor, env.fogNear, env.fogFar);
        } else {
            this.scene.fog.color.set(env.fogColor);
            this.scene.fog.near = env.fogNear;
            this.scene.fog.far = env.fogFar;
        }

        if (this.hemisphereLight) {
            this.hemisphereLight.color.set(env.hemisphereSkyColor);
            this.hemisphereLight.groundColor.set(env.hemisphereGroundColor);
            this.hemisphereLight.intensity = env.hemisphereIntensity;
        }

        if (this.directionalLight) {
            this.directionalLight.color.set(env.directionalColor);
            this.directionalLight.intensity = env.directionalIntensity;
        }

        if (this.rimLight) {
            this.rimLight.color.set(env.rimColor);
            this.rimLight.intensity = env.rimIntensity;
        }

        if (this.ambientLight) {
            this.ambientLight.color.set(env.ambientColor);
            this.ambientLight.intensity = env.ambientIntensity;
        }

        if (this.sceneryFillLight) {
            this.sceneryFillLight.color.set(env.sceneryFillColor);
            this.sceneryFillLight.intensity = env.sceneryFillIntensity ?? 0;
        }

        this.currentEnvironment = env;
    }

    /** Widen or restore the key-light shadow frustum (e.g. bayou cypress span). */
    setSunShadowOrthoExtent(halfExtent = SUN_SHADOW_ORTHO_DEFAULT) {
        applySunShadowCameraBounds(this.directionalLight, halfExtent);
    }
}

