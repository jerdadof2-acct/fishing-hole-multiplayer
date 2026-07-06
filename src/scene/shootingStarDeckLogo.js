import * as THREE from 'three';

const LOGO_PATH = '/assets/images/shooting-star-deck-logo.png?v=20260705-shooting-star';

let logoTexture = null;
let logoLoadPromise = null;

function loadShootingStarLogoTexture() {
    if (logoTexture) {
        return Promise.resolve(logoTexture);
    }
    if (logoLoadPromise) {
        return logoLoadPromise;
    }

    logoLoadPromise = new Promise((resolve) => {
        const loader = new THREE.TextureLoader();
        loader.load(
            LOGO_PATH,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = Math.min(8, 16);
                logoTexture = texture;
                resolve(texture);
            },
            undefined,
            (error) => {
                console.warn('[PLATFORM] Shooting Star deck logo failed to load:', error);
                resolve(null);
            }
        );
    });

    return logoLoadPromise;
}

/**
 * Painted deck emblem for The Shooting Star — between the teak slats and the stern
 * where Halley fishes.
 *
 * @param {THREE.Group} boatGroup
 * @param {{
 *   deckSurfaceY: number,
 *   deckWidth: number,
 *   boatLength: number,
 *   catStandZ: number
 * }} opts
 */
export function addShootingStarDeckLogo(boatGroup, opts) {
    const { deckSurfaceY, deckWidth, boatLength, catStandZ } = opts;
    const loadId = Symbol('shootingStarDeckLogo');
    boatGroup.userData.deckLogoLoadId = loadId;

    void loadShootingStarLogoTexture().then((texture) => {
        if (!texture || boatGroup.userData.deckLogoLoadId !== loadId) {
            return;
        }

        const logoWidth = Math.min(deckWidth * 0.62, 3.85);
        const logoDepth = logoWidth * 0.58;
        const logoZ = catStandZ - logoDepth * 0.08;

        const geometry = new THREE.PlaneGeometry(logoWidth, logoDepth);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2
        });

        const logo = new THREE.Mesh(geometry, material);
        logo.name = 'largeBoat-shootingStarLogo';
        logo.rotation.x = -Math.PI / 2;
        logo.rotation.z = Math.PI;
        logo.position.set(0, deckSurfaceY + 0.021, logoZ);
        logo.renderOrder = 3;
        logo.receiveShadow = true;
        logo.castShadow = false;

        boatGroup.add(logo);
    });
}
