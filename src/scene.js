import * as THREE from 'three';

export class Scene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.hemisphereLight = null;
        this.directionalLight = null;
        this.ambientLight = null;
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
            ambientColor: 0xffffff,
            ambientIntensity: 0.35
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
        // Position light coming from upper left (to match shadow orientation)
        // Camera is at (0, 12, -8) looking at (0, 1.5, 3)
        // Upper left on screen = negative X (left), positive Y (up), positive Z (toward dock from behind)
        // Light position: upper left = (-X, +Y, +Z) = (-10, 20, 10)
        directionalLight.position.set(-10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
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

        // Ambient light for overall illumination
        // Increased slightly to brighten cat on dock
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); // Increased from 0.25 to 0.35 to brighten cat
        this.scene.add(ambientLight);
        this.ambientLight = ambientLight;

        // Apply default environment to ensure lights/fog sync with overrides
        this.setEnvironment();

        // Create camera (will be configured by Camera class)
        const container = document.getElementById('game-container');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            powerPreference: 'high-performance' 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        
        container.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        const container = document.getElementById('game-container');
        const aspect = container.clientWidth / container.clientHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    render() {
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

        if (typeof env.background !== 'undefined') {
            this.scene.background.set(env.background);
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

        if (this.ambientLight) {
            this.ambientLight.color.set(env.ambientColor);
            this.ambientLight.intensity = env.ambientIntensity;
        }

        this.currentEnvironment = env;
    }
}

