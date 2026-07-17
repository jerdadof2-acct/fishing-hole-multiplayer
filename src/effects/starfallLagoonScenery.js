import * as THREE from 'three';
import {
    SUN_DIRECTIONAL_POSITION,
    SUN_DIRECTIONAL_TARGET
} from '../scene/sunShadowDirection.js';

const GLOW_FISH_COUNT = 64;
const WRECK_COUNT = 3;
const ROCK_COUNT = 68;
const GLOWING_STARFISH_COUNT = 7;

/*
 * Bright light blues and violets — comet-touched
 * starfish resting on the lagoon floor.
 */
const GLOWING_STARFISH_PALETTE = [
    0x9ee8ff, // ice blue
    0x7ad4ff, // light cyan
    0x8eb8ff, // soft sky blue
    0xa8a0ff, // periwinkle
    0xb894ff, // light violet
    0xc87cff, // orchid violet
    0xd0a8ff  // pale lavender
];

// Deep enough for the wrecks, fish, bottom, and comet glow
// to appear as separate underwater layers.
const STARFALL_BED_OFFSET = 5.25;

const LAGOON_CENTER_Z = 18;
const LAGOON_HALF_WIDTH = 28;
const LAGOON_MIN_Z = 1;
const LAGOON_MAX_Z = 38;

/*
 * Keep fish centers deep enough that bobbing, glints,
 * and soft auras never read as above the waterline —
 * especially noticeable in pan-around camera views.
 */
const FISH_SURFACE_CLEARANCE = 1.45;
const FISH_BED_CLEARANCE = 0.8;

/*
 * Warm tropical stone replaces the old blue-gray palette.
 * The water will still tint these colors slightly, but the
 * lagoon floor now reads as sand, limestone and algae-covered
 * rock instead of ice.
 */
const ROCK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x615d4b,
    emissive: 0x07100b,
    emissiveIntensity: 0.1,
    roughness: 0.98,
    metalness: 0.01
});

const TROPICAL_ROCK_COLORS = [
    0x625d4b, // weathered limestone
    0x71664d, // sandy brown
    0x526052, // algae-stained stone
    0x4f554b, // dark reef rock
    0x7a6e55, // warm shell stone
    0x5b6657  // muted tropical green-gray
];

const BED_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    emissive: 0x07110c,
    emissiveIntensity: 0.08,
    roughness: 1,
    metalness: 0
});

const WRECK_WOOD_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x49382a,
    emissive: 0x0d0906,
    emissiveIntensity: 0.12,
    roughness: 0.97,
    metalness: 0.01
});

const WRECK_DARK_WOOD_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x241c16,
    emissive: 0x080504,
    emissiveIntensity: 0.08,
    roughness: 1,
    metalness: 0
});

const WRECK_IRON_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x3d484a,
    emissive: 0x071012,
    emissiveIntensity: 0.1,
    roughness: 0.88,
    metalness: 0.48
});

const WRECK_RUST_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x6b3f28,
    emissive: 0x120905,
    emissiveIntensity: 0.1,
    roughness: 0.96,
    metalness: 0.2
});

const WRECK_BLACK_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x111719,
    emissive: 0x020506,
    emissiveIntensity: 0.05,
    roughness: 1,
    metalness: 0.06
});

const WRECK_ROPE_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x6d5c40,
    emissive: 0x0b0804,
    emissiveIntensity: 0.07,
    roughness: 1,
    metalness: 0
});

/*
 * The comet is mostly a scorched meteorite shell. Only the
 * exposed crystal and fractures glow, so it reads as a real
 * object rather than a bright blue sphere.
 */
const COMET_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x2d2b27,
    emissive: 0x071018,
    emissiveIntensity: 0.22,
    roughness: 0.93,
    metalness: 0.2,
    flatShading: true
});

const COMET_CRYSTAL_MATERIAL =
    new THREE.MeshStandardMaterial({
        color: 0x8cefff,
        emissive: 0x0a8cff,
        emissiveIntensity: 9.6,
        roughness: 0.12,
        metalness: 0.04,
        flatShading: true,
        toneMapped: false
    });

const COMET_CRACK_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0x7aecff,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
});

/*
 * The materials remain white so each InstancedMesh
 * can receive its own individual cosmic color.
 */
const FISH_BODY_MATERIAL =
    new THREE.MeshBasicMaterial({
        color: 0xffffff,
        /*
         * Do not enable vertexColors here.
         * InstancedMesh uses instanceColor from setColorAt;
         * vertexColors expects a geometry color attribute and
         * turns the fish black when that attribute is missing.
         */
        transparent: true,
        opacity: 0.34,

        /*
         * Normal blending preserves each fish's
         * actual blue, green, gold or violet color.
         */
        blending: THREE.NormalBlending,

        depthWrite: false,
        toneMapped: false
    });

const FISH_TAIL_MATERIAL =
    new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.24,
        blending: THREE.NormalBlending,
        depthWrite: false,
        toneMapped: false
    });

const FISH_GLINT_MATERIAL =
    new THREE.MeshBasicMaterial({
        color: 0xb8f0ff,
        transparent: true,

        /*
         * Bright cosmic glints show the comet's
         * influence on the lagoon fish.
         */
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
    });

/*
 * Cosmic rainbow colors, intentionally excluding red.
 */
const COSMIC_FISH_PALETTE = [
    0xffa62b, // amber
    0xffd12e, // gold
    0xe8e33c, // cosmic yellow
    0x8ee82f, // lime
    0x26dc68, // emerald
    0x20d9a8, // sea green
    0x20d8da, // turquoise
    0x24bceb, // cyan
    0x2787ef, // blue
    0x465de6, // indigo
    0x764fe0, // violet
    0xa34edb  // purple
];

const FISH_WHITE = new THREE.Color(0xffffff);
const FORWARD = new THREE.Vector3(1, 0, 0);

const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_POSITION = new THREE.Vector3();
const TEMP_TAIL_POSITION = new THREE.Vector3();
const TEMP_SCALE = new THREE.Vector3();
const TEMP_STEER = new THREE.Vector3();

function mulberry32(seed) {
    let state = seed | 0;

    return () => {
        state += 0x6d2b79f5;

        let t = state;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomRange(random, min, max) {
    return THREE.MathUtils.lerp(min, max, random());
}

function randomDirection(random, verticalAmount = 0.22) {
    const direction = new THREE.Vector3(
        randomRange(random, -1, 1),
        randomRange(random, -verticalAmount, verticalAmount),
        randomRange(random, -1, 1)
    );

    if (direction.lengthSq() < 0.001) {
        direction.set(1, 0, 0);
    }

    return direction.normalize();
}

function createGlowTexture() {
    const canvas = document.createElement('canvas');

    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(
        32,
        32,
        0,
        32,
        32,
        31
    );

    gradient.addColorStop(
        0,
        'rgba(255, 255, 255, 1)'
    );

    gradient.addColorStop(
        0.18,
        'rgba(255, 255, 255, 0.96)'
    );

    gradient.addColorStop(
        0.48,
        'rgba(255, 255, 255, 0.48)'
    );

    gradient.addColorStop(
        1,
        'rgba(255, 255, 255, 0)'
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);

    texture.needsUpdate = true;

    return texture;
}

let softAreaGlowTexture = null;

/**
 * Soft radial falloff used for comet area light —
 * bright center, fully transparent edges (no hard circle rim).
 */
function getSoftAreaGlowTexture() {
    if (softAreaGlowTexture) {
        return softAreaGlowTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 256, 256);

    const gradient = ctx.createRadialGradient(
        128,
        128,
        0,
        128,
        128,
        128
    );

    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.72)');
    gradient.addColorStop(0.42, 'rgba(255, 255, 255, 0.32)');
    gradient.addColorStop(0.68, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.015)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    softAreaGlowTexture = new THREE.CanvasTexture(canvas);
    softAreaGlowTexture.needsUpdate = true;

    return softAreaGlowTexture;
}

function createSoftGlowSprite(
    color,
    size,
    opacity = 0.2
) {
    const material = new THREE.SpriteMaterial({
        map: getSoftAreaGlowTexture(),
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(size);

    return sprite;
}

function createSoftGlowPlane(
    color,
    width,
    height,
    opacity = 0.28
) {
    const material = new THREE.MeshBasicMaterial({
        map: getSoftAreaGlowTexture(),
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false
    });

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        material
    );

    return plane;
}

function createCometSparkleTexture() {
    const canvas = document.createElement(
        'canvas'
    );

    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    /*
     * Soft blue center.
     */
    const centerGlow =
        ctx.createRadialGradient(
            64,
            64,
            0,
            64,
            64,
            34
        );

    centerGlow.addColorStop(
        0,
        'rgba(255, 255, 255, 1)'
    );

    centerGlow.addColorStop(
        0.12,
        'rgba(150, 235, 255, 0.98)'
    );

    centerGlow.addColorStop(
        0.38,
        'rgba(35, 160, 255, 0.55)'
    );

    centerGlow.addColorStop(
        1,
        'rgba(0, 80, 255, 0)'
    );

    ctx.fillStyle = centerGlow;

    ctx.fillRect(
        0,
        0,
        128,
        128
    );

    /*
     * Long vertical and horizontal glistening rays.
     */
    const verticalRay =
        ctx.createLinearGradient(
            0,
            0,
            0,
            128
        );

    verticalRay.addColorStop(
        0,
        'rgba(40, 155, 255, 0)'
    );

    verticalRay.addColorStop(
        0.42,
        'rgba(95, 210, 255, 0.18)'
    );

    verticalRay.addColorStop(
        0.5,
        'rgba(235, 250, 255, 0.95)'
    );

    verticalRay.addColorStop(
        0.58,
        'rgba(95, 210, 255, 0.18)'
    );

    verticalRay.addColorStop(
        1,
        'rgba(40, 155, 255, 0)'
    );

    ctx.fillStyle = verticalRay;

    ctx.fillRect(
        61,
        4,
        6,
        120
    );

    const horizontalRay =
        ctx.createLinearGradient(
            0,
            0,
            128,
            0
        );

    horizontalRay.addColorStop(
        0,
        'rgba(40, 155, 255, 0)'
    );

    horizontalRay.addColorStop(
        0.42,
        'rgba(95, 210, 255, 0.18)'
    );

    horizontalRay.addColorStop(
        0.5,
        'rgba(235, 250, 255, 0.95)'
    );

    horizontalRay.addColorStop(
        0.58,
        'rgba(95, 210, 255, 0.18)'
    );

    horizontalRay.addColorStop(
        1,
        'rgba(40, 155, 255, 0)'
    );

    ctx.fillStyle = horizontalRay;

    ctx.fillRect(
        4,
        61,
        120,
        6
    );

    /*
     * Smaller diagonal rays make the sparkle
     * look crystalline instead of like a plus sign.
     */
    ctx.save();

    ctx.translate(
        64,
        64
    );

    ctx.rotate(
        Math.PI / 4
    );

    const diagonalRay =
        ctx.createLinearGradient(
            -42,
            0,
            42,
            0
        );

    diagonalRay.addColorStop(
        0,
        'rgba(60, 175, 255, 0)'
    );

    diagonalRay.addColorStop(
        0.5,
        'rgba(180, 235, 255, 0.6)'
    );

    diagonalRay.addColorStop(
        1,
        'rgba(60, 175, 255, 0)'
    );

    ctx.fillStyle = diagonalRay;

    ctx.fillRect(
        -42,
        -1.5,
        84,
        3
    );

    ctx.rotate(
        Math.PI / 2
    );

    ctx.fillRect(
        -42,
        -1.5,
        84,
        3
    );

    ctx.restore();

    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.needsUpdate = true;

    return texture;
}

function buildRockyBed(random) {
    const geometry = new THREE.PlaneGeometry(
        58,
        42,
        30,
        22
    );

    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);

        const broadShape =
            Math.sin(x * 0.22) * 0.10 +
            Math.cos(z * 0.28) * 0.08 +
            Math.sin((x + z) * 0.13) * 0.07;

        const smallVariation = randomRange(
            random,
            -0.06,
            0.06
        );

        positions.setY(
            i,
            broadShape + smallVariation
        );
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    /*
     * Broad patches of warm sand, darker stone and muted algae
     * keep the large floor plane from becoming one icy-blue slab.
     */
    const colors = [];

    const warmSand = new THREE.Color(
        0x776e51
    );

    const paleSand = new THREE.Color(
        0x8a7b5a
    );

    const algaeStone = new THREE.Color(
        0x50604e
    );

    const darkReef = new THREE.Color(
        0x484e45
    );

    const vertexColor = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);

        const broadPatch =
            Math.sin(
                x * 0.19 +
                z * 0.08
            ) * 0.5 +
            Math.cos(
                z * 0.23 -
                x * 0.06
            ) * 0.5;

        const finePatch =
            Math.sin(
                (x + z) * 0.47
            ) * 0.5 +
            Math.cos(
                (x - z) * 0.31
            ) * 0.5;

        vertexColor.copy(warmSand);

        if (broadPatch > 0.35) {
            vertexColor.lerp(
                algaeStone,
                THREE.MathUtils.clamp(
                    0.28 +
                        broadPatch * 0.28,
                    0,
                    0.62
                )
            );
        } else if (broadPatch < -0.42) {
            vertexColor.lerp(
                paleSand,
                THREE.MathUtils.clamp(
                    0.28 -
                        broadPatch * 0.22,
                    0,
                    0.55
                )
            );
        } else if (finePatch < -0.42) {
            vertexColor.lerp(
                darkReef,
                0.24
            );
        }

        colors.push(
            vertexColor.r,
            vertexColor.g,
            vertexColor.b
        );
    }

    geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
            colors,
            3
        )
    );

    const bed = new THREE.Mesh(
        geometry,
        BED_MATERIAL
    );

    bed.name = 'starfallRockyBed';

    bed.position.set(
        0,
        0,
        LAGOON_CENTER_Z
    );

    bed.receiveShadow = true;

    return bed;
}


function createWreckBeam(
    length,
    radius,
    material,
    axis = 'x'
) {
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(
            radius * 0.82,
            radius,
            length,
            8
        ),
        material
    );

    if (axis === 'x') {
        beam.rotation.z = Math.PI / 2;
    } else if (axis === 'z') {
        beam.rotation.x = Math.PI / 2;
    }

    return beam;
}

function finalizeWreck(
    wreck,
    random,
    minimumScale = 0.9,
    maximumScale = 1.2
) {
    wreck.traverse((child) => {
        if (!child.isMesh) {
            return;
        }

        child.castShadow = true;
        child.receiveShadow = true;
    });

    wreck.rotation.y = random() * Math.PI * 2;

    wreck.rotation.z = randomRange(
        random,
        -0.17,
        0.17
    );

    wreck.rotation.x = randomRange(
        random,
        -0.1,
        0.1
    );

    wreck.scale.setScalar(
        randomRange(
            random,
            minimumScale,
            maximumScale
        )
    );

    return wreck;
}

/*
 * Wreck one:
 * An old wooden sailing brig with exposed ribs,
 * broken deck boards, mast, yardarm and bowsprit.
 */
function buildSailingBrigWreck(random) {
    const wreck = new THREE.Group();

    wreck.name = 'starfallWreckSailingBrig';

    const keel = createWreckBeam(
        5.4,
        0.12,
        WRECK_DARK_WOOD_MATERIAL
    );

    keel.position.y = 0.24;
    wreck.add(keel);

    /*
     * Broken hull planking along both sides.
     */
    for (const side of [-1, 1]) {
        for (let row = 0; row < 4; row++) {
            if (
                row === 2 &&
                side === 1
            ) {
                continue;
            }

            const plankLength = randomRange(
                random,
                3.4,
                4.9
            );

            const plank = new THREE.Mesh(
                new THREE.BoxGeometry(
                    plankLength,
                    0.14,
                    0.15
                ),
                WRECK_WOOD_MATERIAL
            );

            plank.position.set(
                randomRange(
                    random,
                    -0.2,
                    0.2
                ),
                0.42 + row * 0.19,
                side * (
                    0.61 +
                    row * 0.055
                )
            );

            plank.rotation.x =
                side * 0.12;

            plank.rotation.z = randomRange(
                random,
                -0.045,
                0.045
            );

            wreck.add(plank);
        }
    }

    /*
     * Exposed curved hull ribs.
     */
    for (let i = 0; i < 8; i++) {
        const rib = new THREE.Mesh(
            new THREE.TorusGeometry(
                0.79,
                0.055,
                6,
                12,
                Math.PI
            ),
            WRECK_DARK_WOOD_MATERIAL
        );

        rib.position.set(
            -2.0 + i * 0.58,
            0.78,
            0
        );

        rib.rotation.set(
            0,
            Math.PI / 2,
            Math.PI / 2
        );

        rib.scale.set(
            randomRange(
                random,
                0.8,
                1.05
            ),
            randomRange(
                random,
                0.75,
                1
            ),
            1
        );

        wreck.add(rib);
    }

    /*
     * Broken deck boards with uneven lengths.
     */
    for (let i = 0; i < 8; i++) {
        if (i === 3 || i === 6) {
            continue;
        }

        const deckBoard = new THREE.Mesh(
            new THREE.BoxGeometry(
                randomRange(
                    random,
                    2.5,
                    4.5
                ),
                0.1,
                0.14
            ),
            WRECK_WOOD_MATERIAL
        );

        deckBoard.position.set(
            randomRange(
                random,
                -0.25,
                0.2
            ),
            1.02,
            -0.53 + i * 0.15
        );

        deckBoard.rotation.z = randomRange(
            random,
            -0.04,
            0.04
        );

        wreck.add(deckBoard);
    }

    /*
     * Main mast leaning across the wreck.
     */
    const mast = createWreckBeam(
        4.0,
        0.09,
        WRECK_DARK_WOOD_MATERIAL,
        'y'
    );

    mast.position.set(
        -0.4,
        2.55,
        0.06
    );

    mast.rotation.z = randomRange(
        random,
        -0.66,
        -0.42
    );

    mast.rotation.x = randomRange(
        random,
        -0.14,
        0.16
    );

    wreck.add(mast);

    const yardarm = createWreckBeam(
        2.45,
        0.055,
        WRECK_DARK_WOOD_MATERIAL
    );

    yardarm.position.set(
        -0.92,
        2.75,
        0.03
    );

    yardarm.rotation.y = randomRange(
        random,
        -0.2,
        0.2
    );

    yardarm.rotation.z = randomRange(
        random,
        -0.18,
        0.12
    );

    wreck.add(yardarm);

    /*
     * Long bowsprit at the front.
     */
    const bowsprit = createWreckBeam(
        2.2,
        0.065,
        WRECK_DARK_WOOD_MATERIAL
    );

    bowsprit.position.set(
        3.05,
        1.08,
        0
    );

    bowsprit.rotation.z = -0.13;

    wreck.add(bowsprit);

    /*
     * Small anchor lying beside the hull.
     */
    const anchor = new THREE.Group();

    const anchorShank = createWreckBeam(
        0.9,
        0.045,
        WRECK_IRON_MATERIAL,
        'y'
    );

    anchor.add(anchorShank);

    const anchorRing = new THREE.Mesh(
        new THREE.TorusGeometry(
            0.16,
            0.035,
            6,
            12
        ),
        WRECK_IRON_MATERIAL
    );

    anchorRing.position.y = 0.54;
    anchor.add(anchorRing);

    for (const side of [-1, 1]) {
        const fluke = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.42,
                0.07,
                0.16
            ),
            WRECK_IRON_MATERIAL
        );

        fluke.position.set(
            side * 0.2,
            -0.38,
            0
        );

        fluke.rotation.z =
            side * 0.45;

        anchor.add(fluke);
    }

    anchor.position.set(
        1.5,
        0.45,
        -1.15
    );

    anchor.rotation.set(
        0.4,
        0.2,
        1.1
    );

    wreck.add(anchor);

    return finalizeWreck(
        wreck,
        random,
        0.92,
        1.12
    );
}

/*
 * Wreck two:
 * A rusted steam tug with boiler, smokestack,
 * damaged wheelhouse and visible propeller.
 */
function createProperBoatHull({
    length,
    width,
    height,
    material,
    sternWidth = 0.72,
    bowSharpness = 0.06
}) {
    const halfLength = length / 2;
    const halfWidth = width / 2;

    /*
     * Each station contains:
     * x position and half-width at that point.
     *
     * The final bow station comes almost to a point.
     */
    const stations = [
        {
            x: -halfLength,
            width: halfWidth * sternWidth
        },
        {
            x: -halfLength * 0.62,
            width: halfWidth * 0.95
        },
        {
            x: 0,
            width: halfWidth
        },
        {
            x: halfLength * 0.55,
            width: halfWidth * 0.84
        },
        {
            x: halfLength,
            width: halfWidth * bowSharpness
        }
    ];

    const vertices = [];
    const indices = [];

    /*
     * Every station has:
     *
     * 0: port deck edge
     * 1: starboard deck edge
     * 2: center keel
     */
    for (const station of stations) {
        vertices.push(
            station.x,
            height,
            station.width
        );

        vertices.push(
            station.x,
            height,
            -station.width
        );

        vertices.push(
            station.x,
            0,
            0
        );
    }

    for (
        let i = 0;
        i < stations.length - 1;
        i++
    ) {
        const current = i * 3;
        const next = (i + 1) * 3;

        const currentPort = current;
        const currentStarboard = current + 1;
        const currentKeel = current + 2;

        const nextPort = next;
        const nextStarboard = next + 1;
        const nextKeel = next + 2;

        /*
         * Port side.
         */
        indices.push(
            currentPort,
            currentKeel,
            nextPort
        );

        indices.push(
            nextPort,
            currentKeel,
            nextKeel
        );

        /*
         * Starboard side.
         */
        indices.push(
            currentStarboard,
            nextStarboard,
            currentKeel
        );

        indices.push(
            nextStarboard,
            nextKeel,
            currentKeel
        );

        /*
         * Narrow top strip.
         * The deck will cover most of this.
         */
        indices.push(
            currentPort,
            nextPort,
            currentStarboard
        );

        indices.push(
            nextPort,
            nextStarboard,
            currentStarboard
        );
    }

    /*
     * Stern transom.
     */
    indices.push(
        0,
        1,
        2
    );

    /*
     * Bow cap.
     */
    const last = (
        stations.length - 1
    ) * 3;

    indices.push(
        last,
        last + 2,
        last + 1
    );

    const geometry =
        new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
            vertices,
            3
        )
    );

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const hull = new THREE.Mesh(
        geometry,
        material
    );

    hull.name = 'properVShapedHull';

    return hull;
}

function addHullKeel(
    wreck,
    length,
    material
) {
    const keel = createWreckBeam(
        length,
        0.095,
        material
    );

    keel.name = 'wreckKeel';

    keel.position.set(
        -0.08,
        0.12,
        0
    );

    wreck.add(keel);

    /*
     * Deeper fin beneath the center of the vessel.
     */
    const keelFin = new THREE.Mesh(
        new THREE.BoxGeometry(
            length * 0.56,
            0.34,
            0.09
        ),
        material
    );

    keelFin.name = 'wreckKeelFin';

    keelFin.position.set(
        -length * 0.07,
        0.12,
        0
    );

    wreck.add(keelFin);
}

function addHullRibs(
    wreck,
    {
        count,
        startX,
        spacing,
        width,
        height,
        material,
        brokenIndices = []
    }
) {
    for (let i = 0; i < count; i++) {
        if (brokenIndices.includes(i)) {
            continue;
        }

        const rib = new THREE.Mesh(
            new THREE.TorusGeometry(
                width,
                0.045,
                6,
                12,
                Math.PI
            ),
            material
        );

        rib.position.set(
            startX + i * spacing,
            height,
            0
        );

        rib.rotation.set(
            0,
            Math.PI / 2,
            Math.PI / 2
        );

        wreck.add(rib);
    }
}

function createBrokenHullSection({
    length,
    halfWidthStart,
    halfWidthEnd,
    heightStart,
    heightEnd,
    material,
    capStart = true,
    capEnd = true
}) {
    const halfLength = length / 2;

    /*
     * Each end has:
     *
     * 0: port gunwale
     * 1: starboard gunwale
     * 2: keel
     */
    const vertices = [
        -halfLength,
        heightStart,
        halfWidthStart,

        -halfLength,
        heightStart,
        -halfWidthStart,

        -halfLength,
        0,
        0,

        halfLength,
        heightEnd,
        halfWidthEnd,

        halfLength,
        heightEnd,
        -halfWidthEnd,

        halfLength,
        0,
        0
    ];

    const indices = [
        /*
         * Port hull side.
         */
        0, 2, 3,
        3, 2, 5,

        /*
         * Starboard hull side.
         */
        1, 4, 2,
        4, 5, 2
    ];

    if (capStart) {
        indices.push(
            0, 1, 2
        );
    }

    if (capEnd) {
        indices.push(
            3, 5, 4
        );
    }

    const geometry =
        new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
            vertices,
            3
        )
    );

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    /*
     * Double-sided material allows the hollow,
     * broken interior to remain visible.
     */
    const sectionMaterial =
        material.clone();

    sectionMaterial.side =
        THREE.DoubleSide;

    const section = new THREE.Mesh(
        geometry,
        sectionMaterial
    );

    section.name =
        'brokenHullSection';

    return section;
}

function addExposedHullFrame(
    wreck,
    {
        x,
        y,
        width,
        material,
        rotationZ = 0,
        rotationX = 0
    }
) {
    const frame = new THREE.Mesh(
        new THREE.TorusGeometry(
            width,
            0.052,
            6,
            12,
            Math.PI
        ),
        material
    );

    frame.position.set(
        x,
        y,
        0
    );

    frame.rotation.set(
        rotationX,
        Math.PI / 2,
        Math.PI / 2 + rotationZ
    );

    wreck.add(frame);

    return frame;
}

function addBrokenKeelSection(
    wreck,
    {
        length,
        x,
        y = 0.13,
        z = 0,
        rotationY = 0,
        rotationZ = 0,
        material
    }
) {
    const keel = createWreckBeam(
        length,
        0.09,
        material
    );

    keel.position.set(
        x,
        y,
        z
    );

    keel.rotation.y += rotationY;
    keel.rotation.z += rotationZ;

    wreck.add(keel);

    return keel;
}

function addScatteredWreckage(
    wreck,
    random,
    {
        count,
        material,
        centerX = 0,
        xSpread = 3.5,
        zSpread = 2.4,
        minimumLength = 0.45,
        maximumLength = 1.5,
        minimumWidth = 0.08,
        maximumWidth = 0.22,
        minimumThickness = 0.045,
        maximumThickness = 0.12,
        minimumY = 0.08,
        maximumY = 0.28
    }
) {
    const debris = new THREE.Group();

    debris.name =
        'scatteredWreckage';

    for (let i = 0; i < count; i++) {
        const piece = new THREE.Mesh(
            new THREE.BoxGeometry(
                randomRange(
                    random,
                    minimumLength,
                    maximumLength
                ),
                randomRange(
                    random,
                    minimumThickness,
                    maximumThickness
                ),
                randomRange(
                    random,
                    minimumWidth,
                    maximumWidth
                )
            ),
            material
        );

        piece.position.set(
            centerX +
                randomRange(
                    random,
                    -xSpread,
                    xSpread
                ),

            randomRange(
                random,
                minimumY,
                maximumY
            ),

            randomRange(
                random,
                -zSpread,
                zSpread
            )
        );

        piece.rotation.set(
            randomRange(
                random,
                -0.65,
                0.65
            ),
            randomRange(
                random,
                0,
                Math.PI * 2
            ),
            randomRange(
                random,
                -0.65,
                0.65
            )
        );

        debris.add(piece);
    }

    wreck.add(debris);

    return debris;
}

function buildSteamTugWreck(random) {
    const wreck = new THREE.Group();

    wreck.name =
        'starfallWreckSteamTug';

    /*
     * Stern hull section.
     */
    const sternHull =
        createBrokenHullSection({
            length: 1.55,
            halfWidthStart: 0.72,
            halfWidthEnd: 0.88,
            heightStart: 0.82,
            heightEnd: 1.0,
            material:
                WRECK_IRON_MATERIAL,
            capStart: true,
            capEnd: false
        });

    sternHull.position.set(
        -1.82,
        0.06,
        0
    );

    sternHull.rotation.set(
        -0.04,
        -0.07,
        0.08
    );

    wreck.add(sternHull);

    /*
     * Crushed center hull section.
     */
    const centerHull =
        createBrokenHullSection({
            length: 1.2,
            halfWidthStart: 0.86,
            halfWidthEnd: 0.76,
            heightStart: 0.93,
            heightEnd: 0.78,
            material:
                WRECK_RUST_MATERIAL,
            capStart: false,
            capEnd: false
        });

    centerHull.position.set(
        -0.28,
        0.05,
        0.16
    );

    centerHull.rotation.set(
        0.08,
        0.14,
        -0.14
    );

    wreck.add(centerHull);

    /*
     * Bow separated from the rest of the vessel.
     */
    const bowHull =
        createBrokenHullSection({
            length: 1.72,
            halfWidthStart: 0.79,
            halfWidthEnd: 0.045,
            heightStart: 0.84,
            heightEnd: 1.08,
            material:
                WRECK_IRON_MATERIAL,
            capStart: false,
            capEnd: true
        });

    bowHull.position.set(
        1.57,
        0.12,
        -0.12
    );

    bowHull.rotation.set(
        0.05,
        -0.12,
        -0.11
    );

    wreck.add(bowHull);

    /*
     * Broken keel sections instead of one
     * continuous intact keel.
     */
    addBrokenKeelSection(
        wreck,
        {
            length: 1.72,
            x: -1.78,
            y: 0.12,
            rotationZ: 0.08,
            material:
                WRECK_BLACK_MATERIAL
        }
    );

    addBrokenKeelSection(
        wreck,
        {
            length: 1.08,
            x: -0.18,
            y: 0.1,
            z: 0.12,
            rotationY: 0.14,
            rotationZ: -0.16,
            material:
                WRECK_BLACK_MATERIAL
        }
    );

    addBrokenKeelSection(
        wreck,
        {
            length: 1.62,
            x: 1.58,
            y: 0.1,
            z: -0.08,
            rotationY: -0.12,
            rotationZ: -0.1,
            material:
                WRECK_BLACK_MATERIAL
        }
    );

    /*
     * Exposed frames at the broken hull ends.
     */
    addExposedHullFrame(
        wreck,
        {
            x: -1.02,
            y: 0.77,
            width: 0.77,
            material:
                WRECK_RUST_MATERIAL,
            rotationZ: 0.08
        }
    );

    addExposedHullFrame(
        wreck,
        {
            x: -0.88,
            y: 0.72,
            width: 0.72,
            material:
                WRECK_RUST_MATERIAL,
            rotationZ: -0.08
        }
    );

    addExposedHullFrame(
        wreck,
        {
            x: 0.43,
            y: 0.69,
            width: 0.7,
            material:
                WRECK_RUST_MATERIAL,
            rotationZ: -0.12
        }
    );

    addExposedHullFrame(
        wreck,
        {
            x: 0.7,
            y: 0.76,
            width: 0.72,
            material:
                WRECK_RUST_MATERIAL,
            rotationZ: 0.08
        }
    );

    /*
     * Remaining stern deck.
     */
    const sternDeck = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.25,
            0.13,
            1.22
        ),
        WRECK_RUST_MATERIAL
    );

    sternDeck.position.set(
        -1.78,
        1.05,
        0
    );

    sternDeck.rotation.set(
        0.03,
        -0.06,
        0.09
    );

    wreck.add(sternDeck);

    /*
     * A torn center deck plate.
     */
    const centerDeckPlate =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.15,
                0.1,
                0.82
            ),
            WRECK_RUST_MATERIAL
        );

    centerDeckPlate.position.set(
        -0.2,
        0.97,
        0.13
    );

    centerDeckPlate.rotation.set(
        0.14,
        0.16,
        -0.18
    );

    wreck.add(centerDeckPlate);

    /*
     * Bow deck remaining at an angle.
     */
    const bowDeck = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.25,
            0.11,
            1.05
        ),
        WRECK_RUST_MATERIAL
    );

    bowDeck.position.set(
        1.45,
        1.04,
        -0.11
    );

    bowDeck.rotation.set(
        -0.04,
        -0.12,
        -0.1
    );

    wreck.add(bowDeck);

    /*
     * Boiler torn loose and exposed.
     */
    const boiler = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.43,
            0.43,
            1.75,
            14
        ),
        WRECK_BLACK_MATERIAL
    );

    boiler.position.set(
        0.05,
        1.03,
        0.2
    );

    boiler.rotation.set(
        0.18,
        0.12,
        Math.PI / 2 + 0.24
    );

    wreck.add(boiler);

    for (const offset of [-0.26, 0.26]) {
        const band = new THREE.Mesh(
            new THREE.TorusGeometry(
                0.44,
                0.025,
                6,
                14
            ),
            WRECK_RUST_MATERIAL
        );

        band.position.set(
            0.05 +
                Math.cos(0.24) *
                offset,

            1.03 +
                Math.sin(0.24) *
                offset,

            0.2
        );

        band.rotation.y =
            Math.PI / 2;

        band.rotation.x = 0.18;

        wreck.add(band);
    }

    /*
     * Collapsed wheelhouse walls.
     */
    const rearWall = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.12,
            0.92,
            1.06
        ),
        WRECK_RUST_MATERIAL
    );

    rearWall.position.set(
        -1.3,
        1.5,
        0.02
    );

    rearWall.rotation.set(
        0.06,
        -0.08,
        0.18
    );

    wreck.add(rearWall);

    const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.05,
            0.83,
            0.1
        ),
        WRECK_RUST_MATERIAL
    );

    sideWall.position.set(
        -0.87,
        1.42,
        -0.51
    );

    sideWall.rotation.set(
        0.12,
        0.06,
        -0.11
    );

    wreck.add(sideWall);

    /*
     * Front wall has fallen beside the boat.
     */
    const fallenFrontWall =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.11,
                0.84,
                0.94
            ),
            WRECK_RUST_MATERIAL
        );

    fallenFrontWall.position.set(
        -0.18,
        0.3,
        1.2
    );

    fallenFrontWall.rotation.set(
        1.16,
        0.3,
        0.35
    );

    wreck.add(fallenFrontWall);

    /*
     * Detached wheelhouse roof lying on the bottom.
     */
    const detachedRoof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.62,
                0.11,
                1.35
            ),
            WRECK_IRON_MATERIAL
        );

    detachedRoof.position.set(
        -1.6,
        0.19,
        1.45
    );

    detachedRoof.rotation.set(
        0.32,
        0.14,
        0.48
    );

    wreck.add(detachedRoof);

    /*
     * One broken window still attached.
     */
    const remainingWindow =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.58,
                0.32,
                0.025
            ),
            WRECK_BLACK_MATERIAL
        );

    remainingWindow.position.set(
        -0.92,
        1.55,
        -0.565
    );

    remainingWindow.rotation.z =
        -0.1;

    wreck.add(remainingWindow);

    /*
     * Smokestack broken off and lying beside wreck.
     */
    const fallenStack =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.17,
                0.25,
                1.48,
                12
            ),
            WRECK_RUST_MATERIAL
        );

    fallenStack.position.set(
        0.75,
        0.3,
        -1.25
    );

    fallenStack.rotation.set(
        0.2,
        0.36,
        1.28
    );

    wreck.add(fallenStack);

    const stackLip =
        new THREE.Mesh(
            new THREE.TorusGeometry(
                0.19,
                0.035,
                6,
                12
            ),
            WRECK_BLACK_MATERIAL
        );

    stackLip.position.set(
        1.45,
        0.15,
        -1.42
    );

    stackLip.rotation.set(
        0.3,
        0.2,
        1.24
    );

    wreck.add(stackLip);

    /*
     * Propeller remains attached to the stern.
     */
    const propeller = new THREE.Group();

    const propellerHub =
        new THREE.Mesh(
            new THREE.SphereGeometry(
                0.13,
                8,
                6
            ),
            WRECK_IRON_MATERIAL
        );

    propeller.add(propellerHub);

    for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.11,
                0.7,
                0.2
            ),
            WRECK_RUST_MATERIAL
        );

        blade.position.y = 0.28;

        blade.rotation.x =
            i * (
                Math.PI * 2 / 3
            );

        blade.rotation.z = 0.18;

        propeller.add(blade);
    }

    propeller.position.set(
        -2.72,
        0.34,
        0
    );

    propeller.rotation.y = -0.08;

    wreck.add(propeller);

    /*
     * Rudder is bent sideways.
     */
    const rudder = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.11,
            0.84,
            0.58
        ),
        WRECK_RUST_MATERIAL
    );

    rudder.position.set(
        -2.82,
        0.5,
        0.04
    );

    rudder.rotation.set(
        0.05,
        0.62,
        0.12
    );

    wreck.add(rudder);

    /*
     * Loose iron plating and structural pieces.
     */
    addScatteredWreckage(
        wreck,
        random,
        {
            count: 15,
            material:
                WRECK_RUST_MATERIAL,
            centerX: 0,
            xSpread: 3.2,
            zSpread: 2.1,
            minimumLength: 0.35,
            maximumLength: 1.15,
            minimumWidth: 0.14,
            maximumWidth: 0.48,
            minimumThickness: 0.045,
            maximumThickness: 0.1
        }
    );

    return finalizeWreck(
        wreck,
        random,
        0.9,
        1.06
    );
}

function buildFishingTrawlerWreck(random) {
    const wreck = new THREE.Group();

    wreck.name =
        'starfallWreckFishingTrawler';

    /*
     * Stern section of wooden hull.
     */
    const sternHull =
        createBrokenHullSection({
            length: 1.6,
            halfWidthStart: 0.72,
            halfWidthEnd: 0.83,
            heightStart: 0.72,
            heightEnd: 0.94,
            material:
                WRECK_WOOD_MATERIAL,
            capStart: true,
            capEnd: false
        });

    sternHull.position.set(
        -1.78,
        0.05,
        0
    );

    sternHull.rotation.set(
        0.04,
        0.07,
        0.1
    );

    wreck.add(sternHull);

    /*
     * Bow section is separated and leaning.
     */
    const bowHull =
        createBrokenHullSection({
            length: 1.78,
            halfWidthStart: 0.78,
            halfWidthEnd: 0.04,
            heightStart: 0.86,
            heightEnd: 1.02,
            material:
                WRECK_WOOD_MATERIAL,
            capStart: false,
            capEnd: true
        });

    bowHull.position.set(
        1.58,
        0.11,
        -0.16
    );

    bowHull.rotation.set(
        -0.03,
        -0.13,
        -0.12
    );

    wreck.add(bowHull);

    /*
     * Broken keel remains visible through the
     * completely missing center hull.
     */
    addBrokenKeelSection(
        wreck,
        {
            length: 1.7,
            x: -1.76,
            y: 0.11,
            rotationZ: 0.1,
            material:
                WRECK_DARK_WOOD_MATERIAL
        }
    );

    addBrokenKeelSection(
        wreck,
        {
            length: 1.18,
            x: -0.12,
            y: 0.08,
            z: 0.08,
            rotationY: 0.16,
            rotationZ: -0.12,
            material:
                WRECK_DARK_WOOD_MATERIAL
        }
    );

    addBrokenKeelSection(
        wreck,
        {
            length: 1.65,
            x: 1.58,
            y: 0.09,
            z: -0.12,
            rotationY: -0.13,
            rotationZ: -0.12,
            material:
                WRECK_DARK_WOOD_MATERIAL
        }
    );

    /*
     * Exposed ribs through the destroyed center.
     */
    const frameLocations = [
        {
            x: -0.92,
            y: 0.67,
            width: 0.68,
            rotationZ: 0.12
        },
        {
            x: -0.55,
            y: 0.62,
            width: 0.63,
            rotationZ: -0.09
        },
        {
            x: -0.14,
            y: 0.58,
            width: 0.6,
            rotationZ: 0.17
        },
        {
            x: 0.26,
            y: 0.61,
            width: 0.62,
            rotationZ: -0.14
        },
        {
            x: 0.66,
            y: 0.67,
            width: 0.68,
            rotationZ: 0.08
        }
    ];

    for (const frameData of frameLocations) {
        addExposedHullFrame(
            wreck,
            {
                ...frameData,
                material:
                    WRECK_DARK_WOOD_MATERIAL
            }
        );
    }

    /*
     * Remaining stern deck.
     */
    const sternDeck = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.18,
            0.11,
            1.16
        ),
        WRECK_DARK_WOOD_MATERIAL
    );

    sternDeck.position.set(
        -1.78,
        0.99,
        0
    );

    sternDeck.rotation.set(
        0.04,
        0.07,
        0.11
    );

    wreck.add(sternDeck);

    /*
     * Small surviving bow deck section.
     */
    const bowDeck = new THREE.Mesh(
        new THREE.BoxGeometry(
            1.05,
            0.1,
            0.96
        ),
        WRECK_DARK_WOOD_MATERIAL
    );

    bowDeck.position.set(
        1.45,
        1.01,
        -0.13
    );

    bowDeck.rotation.set(
        -0.04,
        -0.12,
        -0.11
    );

    wreck.add(bowDeck);

    /*
     * A few deck planks remain stretched across
     * the exposed center, but most are missing.
     */
    for (let i = 0; i < 4; i++) {
        const board = new THREE.Mesh(
            new THREE.BoxGeometry(
                randomRange(
                    random,
                    0.72,
                    1.3
                ),
                0.065,
                0.13
            ),
            WRECK_WOOD_MATERIAL
        );

        board.position.set(
            randomRange(
                random,
                -0.4,
                0.45
            ),
            randomRange(
                random,
                0.82,
                1.02
            ),
            -0.38 + i * 0.25
        );

        board.rotation.set(
            randomRange(
                random,
                -0.12,
                0.12
            ),
            randomRange(
                random,
                -0.24,
                0.24
            ),
            randomRange(
                random,
                -0.18,
                0.18
            )
        );

        wreck.add(board);
    }

    /*
     * Rear cabin has collapsed.
     * Only two walls remain standing.
     */
    const cabinRearWall =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.11,
                0.88,
                1.02
            ),
            WRECK_WOOD_MATERIAL
        );

    cabinRearWall.position.set(
        -2.07,
        1.46,
        0
    );

    cabinRearWall.rotation.set(
        0.04,
        0.08,
        0.19
    );

    wreck.add(cabinRearWall);

    const cabinSideWall =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.88,
                0.8,
                0.1
            ),
            WRECK_WOOD_MATERIAL
        );

    cabinSideWall.position.set(
        -1.65,
        1.4,
        -0.5
    );

    cabinSideWall.rotation.set(
        0.14,
        0.04,
        -0.12
    );

    wreck.add(cabinSideWall);

    /*
     * Detached cabin front has fallen into the
     * missing center hull.
     */
    const cabinFrontWall =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.11,
                0.78,
                0.88
            ),
            WRECK_WOOD_MATERIAL
        );

    cabinFrontWall.position.set(
        -0.95,
        0.54,
        0.28
    );

    cabinFrontWall.rotation.set(
        0.9,
        0.22,
        0.45
    );

    wreck.add(cabinFrontWall);

    /*
     * Cabin roof lies upside down beside the stern.
     */
    const detachedCabinRoof =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                1.48,
                0.11,
                1.25
            ),
            WRECK_IRON_MATERIAL
        );

    detachedCabinRoof.position.set(
        -2.0,
        0.18,
        1.35
    );

    detachedCabinRoof.rotation.set(
        0.42,
        -0.18,
        0.65
    );

    wreck.add(detachedCabinRoof);

    /*
     * One remaining dark cabin window.
     */
    const cabinWindow =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.52,
                0.31,
                0.025
            ),
            WRECK_BLACK_MATERIAL
        );

    cabinWindow.position.set(
        -1.66,
        1.5,
        -0.555
    );

    cabinWindow.rotation.z =
        -0.11;

    wreck.add(cabinWindow);

    /*
     * Fishing A-frame has collapsed over the side.
     */
    const fallenAFrame =
        new THREE.Group();

    for (const side of [-1, 1]) {
        const leg = createWreckBeam(
            2.1,
            0.06,
            WRECK_IRON_MATERIAL,
            'y'
        );

        leg.position.set(
            0,
            1.02,
            side * 0.5
        );

        leg.rotation.x =
            side * 0.3;

        fallenAFrame.add(leg);
    }

    const frameTop = createWreckBeam(
        1.42,
        0.06,
        WRECK_IRON_MATERIAL,
        'z'
    );

    frameTop.position.y = 2.04;

    fallenAFrame.add(frameTop);

    fallenAFrame.position.set(
        0.48,
        0.17,
        1.08
    );

    fallenAFrame.rotation.set(
        1.16,
        0.2,
        -0.2
    );

    wreck.add(fallenAFrame);

    /*
     * Broken boom lies across the seabed.
     */
    const fallenBoom =
        createWreckBeam(
            2.65,
            0.07,
            WRECK_IRON_MATERIAL
        );

    fallenBoom.position.set(
        0.65,
        0.21,
        -1.35
    );

    fallenBoom.rotation.set(
        0.15,
        0.48,
        0.2
    );

    wreck.add(fallenBoom);

    /*
     * Net drum has come completely loose.
     */
    const detachedNetDrum =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.34,
                0.34,
                0.7,
                12
            ),
            WRECK_IRON_MATERIAL
        );

    detachedNetDrum.position.set(
        1.22,
        0.32,
        1.14
    );

    detachedNetDrum.rotation.set(
        0.7,
        0.32,
        Math.PI / 2
    );

    wreck.add(detachedNetDrum);

    /*
     * Rope spilling from detached drum.
     */
    for (let i = 0; i < 5; i++) {
        const rope = createWreckBeam(
            randomRange(
                random,
                0.55,
                1.15
            ),
            0.016,
            WRECK_ROPE_MATERIAL,
            'y'
        );

        rope.position.set(
            0.8 + i * 0.2,
            0.22,
            0.88 +
                randomRange(
                    random,
                    -0.25,
                    0.25
                )
        );

        rope.rotation.set(
            randomRange(
                random,
                -0.4,
                0.4
            ),
            randomRange(
                random,
                -0.4,
                0.4
            ),
            randomRange(
                random,
                0.85,
                1.4
            )
        );

        wreck.add(rope);
    }

    /*
     * One crate remains on the stern.
     */
    const remainingCrate =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.46,
                0.4,
                0.42
            ),
            WRECK_DARK_WOOD_MATERIAL
        );

    remainingCrate.position.set(
        -1.55,
        1.25,
        0.28
    );

    remainingCrate.rotation.set(
        0.08,
        0.35,
        -0.16
    );

    wreck.add(remainingCrate);

    /*
     * Two broken crate sections on the bottom.
     */
    for (let i = 0; i < 2; i++) {
        const brokenCrate =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.48,
                    0.12,
                    0.42
                ),
                WRECK_DARK_WOOD_MATERIAL
            );

        brokenCrate.position.set(
            randomRange(
                random,
                -0.4,
                1.15
            ),
            0.14,
            randomRange(
                random,
                -1.45,
                1.45
            )
        );

        brokenCrate.rotation.set(
            randomRange(
                random,
                -0.5,
                0.5
            ),
            randomRange(
                random,
                0,
                Math.PI * 2
            ),
            randomRange(
                random,
                -0.5,
                0.5
            )
        );

        wreck.add(brokenCrate);
    }

    /*
     * Stern rudder is partly detached.
     */
    const rudder = new THREE.Mesh(
        new THREE.BoxGeometry(
            0.11,
            0.72,
            0.5
        ),
        WRECK_DARK_WOOD_MATERIAL
    );

    rudder.position.set(
        -2.63,
        0.42,
        0.08
    );

    rudder.rotation.set(
        0.16,
        -0.58,
        0.18
    );

    wreck.add(rudder);

    /*
     * Broken wooden planks spread around the vessel.
     */
    addScatteredWreckage(
        wreck,
        random,
        {
            count: 18,
            material:
                WRECK_WOOD_MATERIAL,
            centerX: 0,
            xSpread: 3.25,
            zSpread: 2.35,
            minimumLength: 0.45,
            maximumLength: 1.55,
            minimumWidth: 0.08,
            maximumWidth: 0.18,
            minimumThickness: 0.045,
            maximumThickness: 0.1
        }
    );

    /*
     * A few detached metal rigging fragments.
     */
    addScatteredWreckage(
        wreck,
        random,
        {
            count: 6,
            material:
                WRECK_IRON_MATERIAL,
            centerX: 0.45,
            xSpread: 2.5,
            zSpread: 2,
            minimumLength: 0.35,
            maximumLength: 1.05,
            minimumWidth: 0.04,
            maximumWidth: 0.1,
            minimumThickness: 0.035,
            maximumThickness: 0.075
        }
    );

    return finalizeWreck(
        wreck,
        random,
        0.92,
        1.08
    );
}

function buildShipwreck(
    random,
    wreckIndex
) {
    switch (wreckIndex % 3) {
        case 0:
            return buildSailingBrigWreck(
                random
            );

        case 1:
            return buildSteamTugWreck(
                random
            );

        default:
            return buildFishingTrawlerWreck(
                random
            );
    }
}


function buildRock(random) {
    const material =
        ROCK_MATERIAL.clone();

    material.color.setHex(
        TROPICAL_ROCK_COLORS[
            Math.floor(
                random() *
                TROPICAL_ROCK_COLORS.length
            )
        ]
    );

    material.emissiveIntensity =
        randomRange(
            random,
            0.06,
            0.13
        );

    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(
            randomRange(
                random,
                0.22,
                0.92
            ),
            0
        ),
        material
    );

    rock.scale.set(
        randomRange(
            random,
            0.72,
            1.55
        ),
        randomRange(
            random,
            0.45,
            0.92
        ),
        randomRange(
            random,
            0.72,
            1.55
        )
    );

    rock.rotation.set(
        random() * Math.PI,
        random() * Math.PI,
        random() * Math.PI
    );

    rock.castShadow = true;
    rock.receiveShadow = true;

    return rock;
}

function createStarfishBodyGeometry(random) {
    const outline = [];
    const arms = [];
    const armStep = Math.PI * 2 / 5;

    /*
     * Build five broad, naturally tapered arms.
     */
    for (let i = 0; i < 5; i++) {
        const angle =
            i * armStep +
            randomRange(random, -0.035, 0.035);

        const length =
            randomRange(random, 0.48, 0.62);

        const shoulderRadius =
            randomRange(random, 0.25, 0.31);

        const valleyRadius =
            randomRange(random, 0.14, 0.18);

        arms.push({
            angle,
            length
        });

        const polarPoint = (
            pointAngle,
            radius
        ) => new THREE.Vector3(
            Math.cos(pointAngle) * radius,
            Math.sin(pointAngle) * radius,
            0
        );

        outline.push(
            polarPoint(
                angle - armStep * 0.5,
                valleyRadius
            ),

            polarPoint(
                angle - armStep * 0.23,
                shoulderRadius
            ),

            polarPoint(
                angle - armStep * 0.065,
                length * 0.93
            ),

            polarPoint(
                angle,
                length
            ),

            polarPoint(
                angle + armStep * 0.065,
                length * 0.93
            ),

            polarPoint(
                angle + armStep * 0.23,
                shoulderRadius
            )
        );
    }

    /*
     * Smooth the outline so the arms have broad,
     * organic bases and gently rounded tips.
     */
    const outlineCurve =
        new THREE.CatmullRomCurve3(
            outline,
            true,
            'catmullrom',
            0.16
        );

    const sampledOutline =
        outlineCurve.getPoints(110);

    const shape = new THREE.Shape();

    shape.moveTo(
        sampledOutline[0].x,
        sampledOutline[0].y
    );

    for (
        let i = 1;
        i < sampledOutline.length;
        i++
    ) {
        shape.lineTo(
            sampledOutline[i].x,
            sampledOutline[i].y
        );
    }

    shape.closePath();

    /*
     * Give the starfish genuine thickness rather
     * than using flat boxes or a star-shaped image.
     */
    const geometry =
        new THREE.ExtrudeGeometry(
            shape,
            {
                depth: 0.075,
                steps: 1,
                curveSegments: 10,

                bevelEnabled: true,
                bevelThickness: 0.025,
                bevelSize: 0.025,
                bevelOffset: 0,
                bevelSegments: 3
            }
        );

    /*
     * ExtrudeGeometry starts in the XY plane.
     * Rotate it so it rests on the lagoon bottom.
     */
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();

    return {
        geometry,
        arms
    };
}

let starfishSparkleTexture = null;

function buildGlowingStarfish(random) {
    const bodyColor =
        new THREE.Color(
            GLOWING_STARFISH_PALETTE[
                Math.floor(
                    random() *
                    GLOWING_STARFISH_PALETTE.length
                )
            ]
        );

    /*
     * Keep some darker surface color so the starfish
     * retains its form instead of becoming a solid
     * overexposed light.
     */
    const surfaceColor =
        bodyColor
            .clone()
            .lerp(
                new THREE.Color(0x4f5579),
                0.28
            );

    const bodyMaterial =
        new THREE.MeshStandardMaterial({
            color: surfaceColor,
            emissive: bodyColor,
            emissiveIntensity: 1.65,

            roughness: 0.34,
            metalness: 0.02,

            side: THREE.DoubleSide,
            toneMapped: false
        });

    const starfish = new THREE.Group();

    starfish.name =
        'starfallGlowingStarfish';

    const {
        geometry,
        arms
    } = createStarfishBodyGeometry(
        random
    );

    const body = new THREE.Mesh(
        geometry,
        bodyMaterial
    );

    body.castShadow = true;
    body.receiveShadow = true;

    starfish.add(body);

    /*
     * A small raised center adds natural thickness.
     * This sits on the body rather than creating
     * a circular glow around it.
     */
    const centerDome = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.17,
            16,
            10
        ),
        bodyMaterial
    );

    centerDome.scale.set(
        1,
        0.36,
        1
    );

    centerDome.position.y = 0.082;

    starfish.add(centerDome);

    /*
     * Reuse the crystalline sparkle texture already
     * used by the comet fragment.
     */
    if (!starfishSparkleTexture) {
        starfishSparkleTexture =
            createCometSparkleTexture();
    }

    const gemColors = [
        0xe6fbff, // luminous pearl blue
        0xa9e8ff, // light celestial blue
        0xb8c8ff, // pale blue-violet
        0xc8adff, // soft violet
        0xe0c2ff  // pale lavender
    ];

    const sparkles = [];

    function addGem({
        x,
        z,
        size,
        colorHex,
        sparkling = false
    }) {
        /*
         * OctahedronGeometry creates an actual
         * faceted jewel rather than a glowing dot.
         */
        const gemMaterial =
            new THREE.MeshStandardMaterial({
                color: colorHex,
                emissive: colorHex,

                emissiveIntensity:
                    sparkling
                        ? 5.8
                        : 4.5,

                roughness: 0.08,
                metalness: 0.08,

                flatShading: true,
                toneMapped: false
            });

        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(
                size,
                0
            ),
            gemMaterial
        );

        gem.position.set(
            x,

            0.105 +
                randomRange(
                    random,
                    0,
                    0.018
                ),

            z
        );

        gem.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        starfish.add(gem);

        /*
         * Only selected gems receive a sparkle.
         * The gems themselves remain visible constantly.
         */
        if (!sparkling) {
            return;
        }

        const sparkleMaterial =
            new THREE.SpriteMaterial({
                map: starfishSparkleTexture,
                color: colorHex,

                transparent: true,
                opacity: 0,

                depthWrite: false,
                depthTest: true,

                blending:
                    THREE.AdditiveBlending,

                toneMapped: false
            });

        const sparkle =
            new THREE.Sprite(
                sparkleMaterial
            );

        sparkle.position.copy(
            gem.position
        );

        sparkle.position.y +=
            size * 0.45;

        const baseSize =
            size *
            randomRange(
                random,
                5.2,
                6.6
            );

        sparkle.scale.setScalar(
            baseSize
        );

        sparkle.renderOrder = 8;

        sparkle.userData.baseSize =
            baseSize;

        sparkle.userData.phase =
            random() * Math.PI * 2;

        sparkle.userData.speed =
            randomRange(
                random,
                2.3,
                5.2
            );

        sparkle.userData.strength =
            randomRange(
                random,
                0.72,
                1
            );

        sparkle.userData.baseRotation =
            random() * Math.PI;

        sparkle.userData.rotationDirection =
            random() < 0.5
                ? -1
                : 1;

        starfish.add(sparkle);
        sparkles.push(sparkle);
    }

    /*
     * Larger central gemstone.
     */
    addGem({
        x: 0,
        z: 0,
        size: 0.064,

        colorHex:
            gemColors[
                Math.floor(
                    random() *
                    gemColors.length
                )
            ],

        sparkling: true
    });

    /*
     * Three gemstones run along every arm.
     * The outer jewel creates the sharp sparkle.
     */
    for (
        let i = 0;
        i < arms.length;
        i++
    ) {
        const arm = arms[i];

        const perpendicularX =
            -Math.sin(arm.angle);

        const perpendicularZ =
            Math.cos(arm.angle);

        const gemDistances = [
            arm.length * 0.34,
            arm.length * 0.62,
            arm.length * 0.82
        ];

        for (
            let gemIndex = 0;
            gemIndex < gemDistances.length;
            gemIndex++
        ) {
            const distance =
                gemDistances[gemIndex];

            const sideOffset =
                gemIndex === 1
                    ? randomRange(
                        random,
                        -0.026,
                        0.026
                    )
                    : 0;

            addGem({
                x:
                    Math.cos(
                        arm.angle
                    ) *
                        distance +
                    perpendicularX *
                        sideOffset,

                z:
                    Math.sin(
                        arm.angle
                    ) *
                        distance +
                    perpendicularZ *
                        sideOffset,

                size:
                    gemIndex === 2
                        ? 0.038
                        : randomRange(
                            random,
                            0.027,
                            0.035
                        ),

                colorHex:
                    gemColors[
                        (
                            i +
                            gemIndex +
                            Math.floor(
                                random() * 2
                            )
                        ) %
                            gemColors.length
                    ],

                sparkling:
                    gemIndex === 2
            });
        }
    }

    starfish.userData.bodyMaterial =
        bodyMaterial;

    starfish.userData.baseEmissive =
        1.65;

    starfish.userData.sparkles =
        sparkles;

    starfish.userData.phase =
        random() * Math.PI * 2;

    starfish.userData.pulseSpeed =
        randomRange(
            random,
            0.8,
            1.45
        );

    return starfish;
}

function createCometCrack(
    points,
    radius = 0.018
) {
    const curve =
        new THREE.CatmullRomCurve3(
            points.map(
                ([x, y, z]) =>
                    new THREE.Vector3(
                        x,
                        y,
                        z
                    )
            )
        );

    return new THREE.Mesh(
        new THREE.TubeGeometry(
            curve,
            18,
            radius,
            5,
            false
        ),
        COMET_CRACK_MATERIAL.clone()
    );
}

function createCometSparkles() {
    const sparkleGroup =
        new THREE.Group();

    sparkleGroup.name =
        'starfallCometSparkles';

    const sparkleTexture =
        createCometSparkleTexture();

    /*
     * These positions follow the exposed crystal,
     * fractures and smaller glowing mineral points.
     */
    const sparkleData = [
        {
            position: [0.48, 0.30, 0.48],
            size: 0.72,
            phase: 0.0,
            speed: 2.6,
            strength: 1.0
        },
        {
            position: [0.21, 0.42, 0.57],
            size: 0.48,
            phase: 1.2,
            speed: 3.4,
            strength: 0.95
        },
        {
            position: [-0.08, 0.37, 0.59],
            size: 0.38,
            phase: 2.7,
            speed: 3.9,
            strength: 0.88
        },
        {
            position: [0.27, -0.12, 0.57],
            size: 0.42,
            phase: 4.0,
            speed: 3.2,
            strength: 0.92
        },
        {
            position: [-0.31, 0.35, 0.49],
            size: 0.36,
            phase: 5.1,
            speed: 4.2,
            strength: 0.84
        },
        {
            position: [0.20, 0.47, -0.25],
            size: 0.34,
            phase: 0.8,
            speed: 4.6,
            strength: 0.8
        },
        {
            position: [0.55, -0.11, -0.05],
            size: 0.36,
            phase: 3.3,
            speed: 4.0,
            strength: 0.86
        },
        {
            position: [0.38, 0.18, 0.52],
            size: 0.44,
            phase: 1.7,
            speed: 3.1,
            strength: 0.9
        },
        {
            position: [0.12, 0.28, 0.62],
            size: 0.3,
            phase: 4.6,
            speed: 5.2,
            strength: 0.78
        },
        {
            position: [0.58, 0.22, 0.22],
            size: 0.4,
            phase: 2.1,
            speed: 3.6,
            strength: 0.88
        },
        {
            position: [-0.18, 0.12, 0.54],
            size: 0.32,
            phase: 5.8,
            speed: 4.8,
            strength: 0.76
        },
        {
            position: [0.42, -0.05, 0.38],
            size: 0.35,
            phase: 0.4,
            speed: 4.4,
            strength: 0.82
        },
        {
            position: [0.08, 0.52, 0.28],
            size: 0.28,
            phase: 3.9,
            speed: 5.5,
            strength: 0.72
        },
        {
            position: [0.33, 0.35, 0.18],
            size: 0.3,
            phase: 6.2,
            speed: 4.9,
            strength: 0.74
        },
        {
            position: [0.62, 0.08, 0.12],
            size: 0.26,
            phase: 2.4,
            speed: 5.8,
            strength: 0.7
        },
        {
            position: [0.15, -0.18, 0.48],
            size: 0.33,
            phase: 1.0,
            speed: 3.8,
            strength: 0.8
        }
    ];

    const sparkles = [];

    for (
        let i = 0;
        i < sparkleData.length;
        i++
    ) {
        const data = sparkleData[i];

        const material =
            new THREE.SpriteMaterial({
                map: sparkleTexture,
                color:
                    i % 3 === 0
                        ? 0xc8f6ff
                        : i % 3 === 1
                            ? 0x7ae8ff
                            : 0x4ec8ff,

                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: true,

                blending:
                    THREE.AdditiveBlending,

                toneMapped: false
            });

        const sparkle =
            new THREE.Sprite(
                material
            );

        sparkle.position.set(
            data.position[0],
            data.position[1],
            data.position[2]
        );

        sparkle.scale.setScalar(
            data.size
        );

        sparkle.renderOrder = 8;

        sparkle.userData.baseSize =
            data.size;

        sparkle.userData.phase =
            data.phase;

        sparkle.userData.speed =
            data.speed;

        sparkle.userData.strength =
            data.strength;

        /*
         * Slightly different rotation makes the
         * individual flashes less repetitive.
         */
        sparkle.material.rotation =
            i * 0.63;

        sparkleGroup.add(
            sparkle
        );

        sparkles.push(
            sparkle
        );
    }

    return {
        sparkleGroup,
        sparkles
    };
}

function buildCometFragment() {
    const fragment = new THREE.Group();

    fragment.name =
        'starfallMeteoritePiece';

    const shellGeometry =
        new THREE.IcosahedronGeometry(
            0.72,
            2
        );

    const shellPositions =
        shellGeometry.attributes.position;

    const vertex = new THREE.Vector3();

    /*
     * Distort the shape so it looks like a natural,
     * asymmetrical piece of meteorite.
     */
    for (
        let i = 0;
        i < shellPositions.count;
        i++
    ) {
        vertex.fromBufferAttribute(
            shellPositions,
            i
        );

        const noise =
            Math.sin(
                vertex.x * 11.0 +
                vertex.y * 7.0
            ) * 0.08 +
            Math.cos(
                vertex.z * 13.0 -
                vertex.x * 5.0
            ) * 0.055;

        const pointedEnd =
            Math.max(
                0,
                vertex.x
            ) * 0.16;

        vertex
            .normalize()
            .multiplyScalar(
                0.72 +
                noise +
                pointedEnd
            );

        vertex.x *= 1.18;
        vertex.y *= 0.82;
        vertex.z *= 0.92;

        shellPositions.setXYZ(
            i,
            vertex.x,
            vertex.y,
            vertex.z
        );
    }

    shellPositions.needsUpdate = true;

    shellGeometry.computeVertexNormals();

    const shell = new THREE.Mesh(
        shellGeometry,
        COMET_MATERIAL
    );

    shell.castShadow = true;
    shell.receiveShadow = true;

    fragment.add(shell);

    /*
     * Exposed crystalline interior.
     */
    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(
            0.29,
            1
        ),
        COMET_CRYSTAL_MATERIAL
    );

    crystal.position.set(
        0.43,
        0.22,
        0.32
    );

    crystal.scale.set(
        1.0,
        0.72,
        0.78
    );

    crystal.rotation.set(
        0.24,
        -0.35,
        0.18
    );

    fragment.add(crystal);

    /*
     * Glowing fractures spreading outward from
     * the exposed crystalline section.
     */
    const crackPaths = [
        [
            [0.39, 0.23, 0.40],
            [0.20, 0.37, 0.53],
            [-0.04, 0.36, 0.57],
            [-0.30, 0.22, 0.53]
        ],
        [
            [0.43, 0.18, 0.36],
            [0.33, -0.02, 0.55],
            [0.10, -0.22, 0.58],
            [-0.08, -0.37, 0.43]
        ],
        [
            [0.38, 0.25, 0.28],
            [0.33, 0.42, 0.08],
            [0.19, 0.48, -0.18],
            [-0.03, 0.42, -0.38]
        ],
        [
            [0.35, 0.10, 0.40],
            [0.50, -0.06, 0.23],
            [0.57, -0.16, -0.02]
        ]
    ];

    const cracks = crackPaths.map(
        (path, index) => {
            const crack =
                createCometCrack(
                    path,
                    index === 0
                        ? 0.021
                        : 0.015
                );

            fragment.add(crack);

            return crack;
        }
    );

    /*
     * Small mineral points visible through
     * other openings in the crust.
     */
    const mineralPoints = [
        [-0.33, 0.34, 0.46, 0.055],
        [0.03, -0.39, 0.39, 0.045],
        [0.19, 0.44, -0.27, 0.04],
        [0.52, -0.12, -0.08, 0.05]
    ];

    for (
        const [x, y, z, size]
        of mineralPoints
    ) {
        const mineral = new THREE.Mesh(
            new THREE.TetrahedronGeometry(
                size,
                0
            ),
            COMET_CRYSTAL_MATERIAL
        );

        mineral.position.set(
            x,
            y,
            z
        );

        fragment.add(mineral);
    }

    /*
     * Soft blue glow pooled around the exposed
     * crystal — radial falloff, no hard sphere rim.
     */
    const crystalGlow = createSoftGlowSprite(
        0x48d4ff,
        3.6,
        0.48
    );

    crystalGlow.name =
        'starfallCrystalGlow';

    crystalGlow.position.set(
        0.28,
        0.18,
        0.36
    );

    crystalGlow.renderOrder = 6;

    fragment.add(crystalGlow);

    /*
     * Tighter inner bloom on the brightest face.
     */
    const crystalBloom = createSoftGlowSprite(
        0xa8f2ff,
        1.85,
        0.58
    );

    crystalBloom.name =
        'starfallCrystalBloom';

    crystalBloom.position.set(
        0.42,
        0.22,
        0.34
    );

    crystalBloom.renderOrder = 7;

    fragment.add(crystalBloom);

    /*
     * Sharp blue glistening points on the exposed
     * cosmic material and illuminated fractures.
     */
    const {
        sparkleGroup,
        sparkles
    } = createCometSparkles();

    fragment.add(
        sparkleGroup
    );

    fragment.rotation.set(
        -0.18,
        0.52,
        0.12
    );

    fragment.userData.crystal =
        crystal;

    fragment.userData.cracks =
        cracks;

    fragment.userData.crystalGlow =
        crystalGlow;

    fragment.userData.crystalBloom =
        crystalBloom;

    fragment.userData.sparkleGroup =
        sparkleGroup;

    fragment.userData.sparkles =
        sparkles;

    return fragment;
}


function createFishMeshes(fishData) {
    const count = fishData.length;

    const bodyGeometry = new THREE.SphereGeometry(
        0.5,
        10,
        7
    );

    const tailGeometry = new THREE.ConeGeometry(
        0.5,
        1,
        3,
        1,
        false
    );

    tailGeometry.rotateZ(Math.PI / 2);

    const glintGeometry = new THREE.SphereGeometry(
        0.5,
        6,
        4
    );

    const bodies = new THREE.InstancedMesh(
        bodyGeometry,
        FISH_BODY_MATERIAL,
        count
    );

    bodies.name = 'starfallGlowFishBodies';

    bodies.instanceMatrix.setUsage(
        THREE.DynamicDrawUsage
    );

    bodies.frustumCulled = false;
    bodies.renderOrder = 4;

    const tails = new THREE.InstancedMesh(
        tailGeometry,
        FISH_TAIL_MATERIAL,
        count
    );

    tails.name = 'starfallGlowFishTails';

    tails.instanceMatrix.setUsage(
        THREE.DynamicDrawUsage
    );

    tails.frustumCulled = false;
    tails.renderOrder = 4;

    /*
     * Small white light that flickers independently
     * across each fish's upper body.
     */
    const glints = new THREE.InstancedMesh(
        glintGeometry,
        FISH_GLINT_MATERIAL,
        count
    );

    glints.name = 'starfallFishCosmicGlints';

    glints.instanceMatrix.setUsage(
        THREE.DynamicDrawUsage
    );

    glints.frustumCulled = false;
    glints.renderOrder = 5;

    for (let i = 0; i < count; i++) {
        const fish = fishData[i];

        /*
         * Use cloned colors so Three.js does not
         * accidentally reuse a mutable Color object.
         */
        bodies.setColorAt(
            i,
            fish.color.clone()
        );

        tails.setColorAt(
            i,
            fish.tailColor.clone()
        );
    }

    /*
     * setColorAt creates the instanceColor attributes.
     * Mark them dynamic and force their first upload.
     */
    if (bodies.instanceColor) {
        bodies.instanceColor.setUsage(
            THREE.DynamicDrawUsage
        );

        bodies.instanceColor.needsUpdate = true;
    }

    if (tails.instanceColor) {
        tails.instanceColor.setUsage(
            THREE.DynamicDrawUsage
        );

        tails.instanceColor.needsUpdate = true;
    }

    bodies.material.needsUpdate = true;
    tails.material.needsUpdate = true;

    return {
        bodies,
        tails,
        glints
    };
}


function spawnGlowFish(
    random,
    waterLevel,
    bedY
) {
    const angle = random() * Math.PI * 2;

    const radius = randomRange(
        random,
        3.5,
        23.5
    );

    const position = new THREE.Vector3(
        Math.cos(angle) * radius +
            randomRange(
                random,
                -2.5,
                2.5
            ),

        randomRange(
            random,
            bedY + FISH_BED_CLEARANCE,
            waterLevel - FISH_SURFACE_CLEARANCE
        ),

        LAGOON_CENTER_Z +
            Math.sin(angle) *
                radius *
                0.78
    );

    const direction = randomDirection(random);

    const paletteIndex = Math.floor(
        random() *
        COSMIC_FISH_PALETTE.length
    );

    const color = new THREE.Color(
        COSMIC_FISH_PALETTE[
            paletteIndex
        ]
    );

    /*
     * Tail remains related to the body color,
     * but is slightly paler and more transparent.
     */
    const tailColor = color
        .clone()
        .lerp(
            FISH_WHITE,
            0.18
        );

    const auraColor = color
        .clone()
        .lerp(
            FISH_WHITE,
            0.1
        );

    return {
        position,
        direction,
        targetDirection: direction.clone(),

        color,
        tailColor,
        auraColor,

        speed: randomRange(
            random,
            0.68,
            1.35
        ),

        turnRate: randomRange(
            random,
            0.75,
            1.7
        ),

        directionTimer: randomRange(
            random,
            0.45,
            2
        ),

        size: randomRange(
            random,
            0.13,
            0.22
        ),

        phase: random() * Math.PI * 2,

        bobSpeed: randomRange(
            random,
            1.2,
            2.4
        ),

        bobAmount: randomRange(
            random,
            0.018,
            0.055
        ),

        /*
         * Every fish glistens at a slightly
         * different speed and moment.
         * Faster rates make the comet's charge
         * read clearly across the school.
         */
        twinklePhase:
            random() * Math.PI * 2,

        twinkleSpeed: randomRange(
            random,
            3.6,
            7.4
        ),

        glintSide: random() < 0.5
            ? -1
            : 1
    };
}


function chooseNewFishDirection(
    fish,
    random
) {
    fish.targetDirection.copy(
        randomDirection(random, 0.28)
    );

    fish.directionTimer = randomRange(
        random,
        0.55,
        2.25
    );
}

function applySoftFishBounds(
    fish,
    waterLevel,
    bedY
) {
    TEMP_STEER.set(0, 0, 0);

    const margin = 2.3;

    if (
        fish.position.x <
        -LAGOON_HALF_WIDTH + margin
    ) {
        TEMP_STEER.x += 1;
    } else if (
        fish.position.x >
        LAGOON_HALF_WIDTH - margin
    ) {
        TEMP_STEER.x -= 1;
    }

    if (
        fish.position.z <
        LAGOON_MIN_Z + margin
    ) {
        TEMP_STEER.z += 1;
    } else if (
        fish.position.z >
        LAGOON_MAX_Z - margin
    ) {
        TEMP_STEER.z -= 1;
    }

    if (
        fish.position.y <
        bedY + FISH_BED_CLEARANCE
    ) {
        TEMP_STEER.y += 0.85;
    } else if (
        fish.position.y >
        waterLevel - FISH_SURFACE_CLEARANCE
    ) {
        TEMP_STEER.y -= 0.95;
    }

    if (TEMP_STEER.lengthSq() > 0) {
        TEMP_STEER.normalize();

        fish.targetDirection
            .lerp(TEMP_STEER, 0.78)
            .normalize();
    }
}

function clampFishDepth(
    fish,
    waterLevel,
    bedY
) {
    const minY =
        bedY + FISH_BED_CLEARANCE;

    const maxY =
        waterLevel - FISH_SURFACE_CLEARANCE;

    fish.position.y = THREE.MathUtils.clamp(
        fish.position.y,
        minY,
        maxY
    );

    /*
     * Flatten upward motion near the surface so
     * soft steering cannot keep pushing fish out.
     */
    if (
        fish.position.y >
            maxY - 0.2 &&
        fish.direction.y > 0
    ) {
        fish.direction.y *= 0.15;
        fish.direction.normalize();
    }

    if (
        fish.targetDirection.y > 0 &&
        fish.position.y > maxY - 0.35
    ) {
        fish.targetDirection.y = Math.min(
            fish.targetDirection.y,
            0
        );

        if (
            fish.targetDirection.lengthSq() >
            0.0001
        ) {
            fish.targetDirection.normalize();
        }
    }
}

function writeFishInstances(
    data,
    elapsedTime
) {
    const auraPositions =
        data.fishAuraGeometry
            .attributes
            .position;

    const auraArray =
        auraPositions.array;

    for (
        let i = 0;
        i < data.fishData.length;
        i++
    ) {
        const fish = data.fishData[i];

        TEMP_POSITION.copy(
            fish.position
        );

        /*
         * Cap bob so display positions stay under
         * the waterline even when fish sit near max depth.
         */
        const maxBobY =
            data.waterLevel -
            FISH_SURFACE_CLEARANCE +
            0.12;

        TEMP_POSITION.y +=
            Math.sin(
                elapsedTime *
                    fish.bobSpeed +
                fish.phase
            ) *
            fish.bobAmount;

        if (TEMP_POSITION.y > maxBobY) {
            TEMP_POSITION.y = maxBobY;
        }

        TEMP_QUATERNION.setFromUnitVectors(
            FORWARD,
            fish.direction
        );

        /*
         * The bright glint briefly makes the body
         * swell with light rather than simply blink.
         * Softer power = more frequent visible flashes.
         */
        const twinkle =
            0.5 +
            0.5 *
            Math.sin(
                elapsedTime *
                    fish.twinkleSpeed +
                fish.twinklePhase
            );

        const flash = Math.pow(
            twinkle,
            5
        );

        const bodyShimmer =
            1 + flash * 0.28;

        TEMP_SCALE.set(
            fish.size *
                2.1 *
                bodyShimmer,

            fish.size *
                0.78 *
                bodyShimmer,

            fish.size *
                0.56 *
                bodyShimmer
        );

        TEMP_MATRIX.compose(
            TEMP_POSITION,
            TEMP_QUATERNION,
            TEMP_SCALE
        );

        data.fishBodies.setMatrixAt(
            i,
            TEMP_MATRIX
        );

        /*
         * Tail.
         */
        TEMP_TAIL_POSITION
            .copy(TEMP_POSITION)
            .addScaledVector(
                fish.direction,
                -fish.size * 1.48
            );

        TEMP_SCALE.set(
            fish.size * 0.72,
            fish.size * 0.82,
            fish.size * 0.58
        );

        TEMP_MATRIX.compose(
            TEMP_TAIL_POSITION,
            TEMP_QUATERNION,
            TEMP_SCALE
        );

        data.fishTails.setMatrixAt(
            i,
            TEMP_MATRIX
        );

        /*
         * White glint positioned over the forward,
         * upper portion of the fish's body.
         */
        TEMP_TAIL_POSITION
            .copy(TEMP_POSITION)
            .addScaledVector(
                fish.direction,
                fish.size * 0.48
            );

        TEMP_TAIL_POSITION.y +=
            fish.size * 0.22;

        TEMP_TAIL_POSITION.z +=
            fish.glintSide *
            fish.size *
            0.12;

        const glintScale =
            fish.size *
            (
                0.05 +
                flash * 0.42
            );

        TEMP_SCALE.setScalar(
            glintScale
        );

        TEMP_MATRIX.compose(
            TEMP_TAIL_POSITION,
            TEMP_QUATERNION,
            TEMP_SCALE
        );

        data.fishGlints.setMatrixAt(
            i,
            TEMP_MATRIX
        );

        auraArray[i * 3] =
            TEMP_POSITION.x;

        auraArray[i * 3 + 1] =
            TEMP_POSITION.y;

        auraArray[i * 3 + 2] =
            TEMP_POSITION.z;
    }

    data.fishBodies
        .instanceMatrix
        .needsUpdate = true;

    data.fishTails
        .instanceMatrix
        .needsUpdate = true;

    data.fishGlints
        .instanceMatrix
        .needsUpdate = true;

    auraPositions.needsUpdate = true;
}


/**
 * Gives the Starfall Lagoon water a crystal-blue
 * look with a light deep-blue sky sheen.
 *
 * Call this on the lagoon water material after it is created.
 */
export function applyStarfallWaterLook(
    material
) {
    if (!material) {
        return material;
    }

    if (material.color?.setHex) {
        /*
         * Greener turquoise water allows the warm
         * stone colors to remain visible.
         */
        material.color.setHex(
            0x1aa6ad
        );
    }

    if ('transparent' in material) {
        material.transparent = true;
    }

    if ('opacity' in material) {
        material.opacity = 0.40;
    }

    if ('roughness' in material) {
        material.roughness = 0.68;
    }

    if ('metalness' in material) {
        material.metalness = 0;
    }

    if ('envMapIntensity' in material) {
        material.envMapIntensity = 0.42;
    }

    if ('depthWrite' in material) {
        material.depthWrite = false;
    }

    /*
     * Support THREE.Water and other
     * shader-based water materials.
     */
    const uniforms = material.uniforms;

    if (uniforms) {
        if (
            uniforms.waterColor
                ?.value
                ?.setHex
        ) {
            uniforms.waterColor.value.setHex(
                0x168f9c
            );
        }

        if (uniforms.alpha) {
            uniforms.alpha.value = 0.44;
        }

        if (uniforms.distortionScale) {
            uniforms.distortionScale.value =
                0.32;
        }

        if (uniforms.reflectivity) {
            uniforms.reflectivity.value =
                0.3;
        }

        if (uniforms.uEnvIntensity) {
            uniforms.uEnvIntensity.value = 0.52;
        }

        if (uniforms.uFresnelScale) {
            uniforms.uFresnelScale.value = 0.88;
        }
    }

    material.needsUpdate = true;

    return material;
}

function createStarfallSunSpriteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 128, 128);

    const glow = ctx.createRadialGradient(
        64,
        64,
        0,
        64,
        64,
        62
    );
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.16, 'rgba(255, 244, 190, 1)');
    glow.addColorStop(0.4, 'rgba(255, 210, 90, 0.75)');
    glow.addColorStop(0.7, 'rgba(255, 170, 60, 0.22)');
    glow.addColorStop(1, 'rgba(255, 160, 40, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

/**
 * Visible sun disc placed on the same ray as the
 * key light that casts Halley's shadow.
 */
function createStarfallSkySun() {
    const sun = new THREE.Group();
    sun.name = 'starfallSkySun';

    const sunDir = new THREE.Vector3()
        .subVectors(
            SUN_DIRECTIONAL_POSITION,
            SUN_DIRECTIONAL_TARGET
        )
        .normalize();

    sun.position.copy(
        sunDir.multiplyScalar(220)
    );

    const sunMap = createStarfallSunSpriteTexture();

    const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: sunMap,
            color: 0xffe08a,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false
        })
    );
    halo.scale.set(28, 28, 1);
    halo.renderOrder = 20;
    sun.add(halo);

    const core = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: sunMap,
            color: 0xfff6d0,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false
        })
    );
    core.scale.set(12, 12, 1);
    core.renderOrder = 21;
    sun.add(core);

    return sun;
}


/**
 * Creates the Starfall Lagoon underwater scenery:
 *
 * - Deep rocky bottom
 * - Three shipwrecks
 * - Glowing blue / violet starfish
 * - Glowing comet fragment
 * - Blue illumination across the bottom
 * - Fish-shaped glowing lights
 */
export function createStarfallLagoonScenery(
    scene,
    {
        waterLevel = 0,
        seed = 0x57a1fa11
    } = {}
) {
    const root = new THREE.Group();

    root.name = 'starfallLagoonScenery';
    root.visible = false;

    const random = mulberry32(seed);

    const bedY =
        waterLevel - STARFALL_BED_OFFSET;

    /*
     * Sky sun aligned with Halley's shadow light.
     */
    root.add(createStarfallSkySun());

    /*
     * Rocky lagoon floor.
     */
    const bed = buildRockyBed(random);

    bed.position.y = bedY;

    root.add(bed);

    /*
     * Individual rocks scattered across the bottom.
     */
    const rocks = new THREE.Group();
    rocks.name = 'starfallRocks';

    for (
        let i = 0;
        i < ROCK_COUNT;
        i++
    ) {
        const rock = buildRock(random);

        const angle =
            random() * Math.PI * 2;

        const radius = randomRange(
            random,
            2.5,
            26
        );

        rock.position.set(
            Math.cos(angle) * radius,

            bedY +
                randomRange(
                    random,
                    0.02,
                    0.18
                ),

            LAGOON_CENTER_Z +
                Math.sin(angle) *
                    radius *
                    0.78
        );

        rocks.add(rock);
    }

    root.add(rocks);

    /*
     * Bright blue / violet starfish glowing on the bed.
     */
    const glowingStarfish = [];
    const starfishGroup = new THREE.Group();
    starfishGroup.name = 'starfallGlowingStarfishGroup';

    const starfishSpots = [
        { x: -4.5, z: 15.5 },
        { x: 3.2, z: 14.0 },
        { x: 0.4, z: 19.5 },
        { x: -11.0, z: 22.0 },
        { x: 8.5, z: 24.5 },
        { x: -1.8, z: 27.8 },
        { x: 6.0, z: 11.5 },
        { x: -7.2, z: 31.0 },
        { x: 12.0, z: 18.0 },
        { x: -13.5, z: 16.5 },
        { x: 2.8, z: 33.0 }
    ];

    for (
        let i = 0;
        i < GLOWING_STARFISH_COUNT;
        i++
    ) {
        const starfish =
            buildGlowingStarfish(random);

        const spot =
            starfishSpots[
                i % starfishSpots.length
            ];

        starfish.position.set(
            spot.x +
                randomRange(
                    random,
                    -1.2,
                    1.2
                ),

            bedY +
                randomRange(
                    random,
                    0.04,
                    0.1
                ),

            spot.z +
                randomRange(
                    random,
                    -1.0,
                    1.0
                )
        );

        starfish.rotation.y =
            random() * Math.PI * 2;

        starfish.rotation.x =
            randomRange(
                random,
                -0.08,
                0.08
            );

        starfish.rotation.z =
            randomRange(
                random,
                -0.08,
                0.08
            );

        starfish.scale.setScalar(
            randomRange(
                random,
                0.28,
                0.42
            )
        );

        starfishGroup.add(starfish);
        glowingStarfish.push(starfish);
    }

    root.add(starfishGroup);

    /*
     * Sunken shipwrecks.
     */
    const wrecks = new THREE.Group();
    wrecks.name = 'starfallWrecks';

    const wreckSpots = [
        {
            x: -8.2,
            z: 12.5,
            y: 0.16
        },
        {
            x: 5.5,
            z: 20.0,
            y: 0.12
        },
        {
            x: -2.5,
            z: 29.0,
            y: 0.18
        }
    ];

    for (
        let i = 0;
        i < WRECK_COUNT;
        i++
    ) {
        const wreck = buildShipwreck(
            random,
            i
        );
        const spot = wreckSpots[i];

        wreck.position.set(
            spot.x +
                randomRange(
                    random,
                    -1.0,
                    1.0
                ),

            bedY + spot.y,

            spot.z +
                randomRange(
                    random,
                    -0.8,
                    0.8
                )
        );

        wrecks.add(wreck);
    }

    root.add(wrecks);

    /*
     * Scorched comet fragment with an exposed
     * cosmic crystal.
     */
    const comet = new THREE.Group();

    comet.name =
        'starfallCometFragment';

    const cometPosition =
        new THREE.Vector3(
            1.8,
            bedY + 0.48,
            17.0
        );

    comet.position.copy(
        cometPosition
    );

    const cometCore =
        buildCometFragment();

    cometCore.position.y = 0.06;

    comet.add(cometCore);

    /*
     * Dark impact stain beneath the meteorite.
     */
    const impactStain = new THREE.Mesh(
        new THREE.CircleGeometry(
            1.72,
            36
        ),
        new THREE.MeshBasicMaterial({
            color: 0x252c25,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );

    impactStain.rotation.x =
        -Math.PI / 2;

    impactStain.position.y = -0.39;

    impactStain.scale.set(
        1.25,
        0.78,
        1
    );

    comet.add(impactStain);

    /*
     * Small meteorite chips scattered around
     * the impact location.
     */
    const impactFragments =
        new THREE.Group();

    impactFragments.name =
        'starfallMeteoriteChips';

    for (let i = 0; i < 11; i++) {
        const angle =
            (i / 11) *
            Math.PI *
            2 +
            randomRange(
                random,
                -0.22,
                0.22
            );

        const radius = randomRange(
            random,
            0.8,
            1.65
        );

        const chipMaterial =
            COMET_MATERIAL.clone();

        chipMaterial.color.offsetHSL(
            randomRange(
                random,
                -0.015,
                0.015
            ),
            0,
            randomRange(
                random,
                -0.05,
                0.05
            )
        );

        const chip = new THREE.Mesh(
            new THREE.TetrahedronGeometry(
                randomRange(
                    random,
                    0.07,
                    0.16
                ),
                0
            ),
            chipMaterial
        );

        chip.position.set(
            Math.cos(angle) * radius,
            -0.31 +
                randomRange(
                    random,
                    0,
                    0.08
                ),
            Math.sin(angle) *
                radius *
                0.74
        );

        chip.rotation.set(
            random() * Math.PI,
            random() * Math.PI,
            random() * Math.PI
        );

        impactFragments.add(chip);
    }

    comet.add(impactFragments);

    /*
     * Strong light from the exposed interior.
     */
    const cometGlow =
        new THREE.PointLight(
            0x5ad8ff,
            6.8,
            20,
            1.55
        );

    cometGlow.position.set(
        0.42,
        0.78,
        0.34
    );

    comet.add(cometGlow);

    /*
     * Wider, softer turquoise fill light.
     */
    const cometFill =
        new THREE.PointLight(
            0x1aa0e0,
            2.4,
            30,
            1.9
        );

    cometFill.position.set(
        0.2,
        1.7,
        0.15
    );

    comet.add(cometFill);

    /*
     * Soft blue aura around the sparkling face
     * of the meteorite — fades out at the edges.
     */
    const cometAura = createSoftGlowSprite(
        0x48d8ff,
        6.4,
        0.4
    );

    cometAura.position.set(
        0.28,
        0.22,
        0.24
    );

    cometAura.renderOrder = 5;

    comet.add(cometAura);

    /*
     * Outer soft wash so the comet's power
     * reads farther into the lagoon.
     */
    const cometOuterAura =
        createSoftGlowSprite(
            0x2ab8e8,
            9.2,
            0.22
        );

    cometOuterAura.name =
        'starfallCometOuterAura';

    cometOuterAura.position.set(
        0.2,
        0.35,
        0.18
    );

    cometOuterAura.renderOrder = 4;

    comet.add(cometOuterAura);

    /*
     * Subtle turquoise illumination across
     * the warm tropical floor — soft radial falloff.
     */
    const floorHalo = createSoftGlowPlane(
        0x2ad4e0,
        16.5,
        16.5,
        0.48
    );

    floorHalo.rotation.x =
        -Math.PI / 2;

    floorHalo.position.y = -0.38;

    floorHalo.renderOrder = 2;

    comet.add(floorHalo);

    /*
     * Energy glow rising through the water.
     */
    const glowColumn = createSoftGlowSprite(
        0x36d4ea,
        1,
        0.2
    );

    glowColumn.scale.set(7.2, 13.5, 1);

    glowColumn.position.y = 3.4;

    glowColumn.renderOrder = 4;

    comet.add(glowColumn);
    root.add(comet);

    /*
     * Glowing fish.
     */
    const fishData = [];

    for (
        let i = 0;
        i < GLOW_FISH_COUNT;
        i++
    ) {
        fishData.push(
            spawnGlowFish(
                random,
                waterLevel,
                bedY
            )
        );
    }

    const {
        bodies: fishBodies,
        tails: fishTails,
        glints: fishGlints
    } = createFishMeshes(
        fishData
    );

    root.add(fishBodies);
    root.add(fishTails);
    root.add(fishGlints);

    /*
     * Soft aura around every glowing fish.
     */
    const fishAuraPositions =
        new Float32Array(
            GLOW_FISH_COUNT * 3
        );

    const fishAuraColors =
        new Float32Array(
            GLOW_FISH_COUNT * 3
        );

    for (
        let i = 0;
        i < fishData.length;
        i++
    ) {
        const auraColor =
            fishData[i].auraColor;

        fishAuraColors[i * 3] =
            auraColor.r;

        fishAuraColors[i * 3 + 1] =
            auraColor.g;

        fishAuraColors[i * 3 + 2] =
            auraColor.b;
    }

    const fishAuraGeometry =
        new THREE.BufferGeometry();

    fishAuraGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            fishAuraPositions,
            3
        )
    );

    fishAuraGeometry.setAttribute(
        'color',
        new THREE.BufferAttribute(
            fishAuraColors,
            3
        )
    );

    const fishAura = new THREE.Points(
        fishAuraGeometry,
        new THREE.PointsMaterial({
            map: createGlowTexture(),
            color: 0xffffff,
            vertexColors: true,

            /*
             * Soft comet-charged aura around each
             * translucent cosmic fish.
             */
            size: 0.58,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false
        })
    );

    fishAura.name =
        'starfallGlowFishAuras';

    fishAura.frustumCulled = false;
    fishAura.renderOrder = 3;

    root.add(fishAura);

    root.userData = {
        waterLevel,
        bedY,
        random,

        fishData,
        fishBodies,
        fishTails,
        fishGlints,
        fishAura,
        fishAuraGeometry,

        glowingStarfish,

        cometCore,

        cometCrystal:
            cometCore.userData.crystal,

        cometCracks:
            cometCore.userData.cracks,

        cometSparkleGroup:
            cometCore.userData.sparkleGroup,

        cometSparkles:
            cometCore.userData.sparkles,

        crystalGlow:
            cometCore.userData.crystalGlow,

        crystalBloom:
            cometCore.userData.crystalBloom,

        cometGlow,
        cometFill,
        cometAura,
        cometOuterAura,
        floorHalo,
        glowColumn
    };

    writeFishInstances(
        root.userData,
        0
    );

    scene.add(root);

    return root;
}

export function syncStarfallLagoonSceneryVisibility(
    group,
    visible
) {
    if (!group) {
        return;
    }

    group.visible = visible === true;
}

export function updateStarfallLagoonScenery(
    group,
    elapsedTime,
    delta,
    isStarfall
) {
    if (
        !group ||
        !isStarfall ||
        !group.visible
    ) {
        return;
    }

    const data = group.userData;

    if (!data.fishData?.length) {
        return;
    }

    /*
     * Prevent large frame gaps from making fish jump.
     */
    const safeDelta = Math.min(
        delta,
        0.05
    );

    /*
     * Fish gradually choose new directions and
     * steer smoothly rather than bouncing abruptly.
     */
    for (const fish of data.fishData) {
        fish.directionTimer -= safeDelta;

        if (fish.directionTimer <= 0) {
            chooseNewFishDirection(
                fish,
                data.random
            );
        }

        applySoftFishBounds(
            fish,
            data.waterLevel,
            data.bedY
        );

        const turnBlend =
            1 -
            Math.exp(
                -fish.turnRate * safeDelta
            );

        fish.direction
            .lerp(
                fish.targetDirection,
                turnBlend
            )
            .normalize();

        fish.position.addScaledVector(
            fish.direction,
            fish.speed * safeDelta
        );

        clampFishDepth(
            fish,
            data.waterLevel,
            data.bedY
        );
    }

    writeFishInstances(
        data,
        elapsedTime
    );

    /*
     * The starfish keep a soft living glow while
     * individual gems create quick crystalline flashes.
     */
    if (data.glowingStarfish?.length) {
        for (
            let i = 0;
            i < data.glowingStarfish.length;
            i++
        ) {
            const starfish =
                data.glowingStarfish[i];

            const pulse =
                0.5 +
                0.5 *
                Math.sin(
                    elapsedTime *
                        starfish.userData.pulseSpeed +
                    starfish.userData.phase
                );

            /*
             * Gentle body glow. This preserves the
             * shape instead of blowing it out.
             */
            if (
                starfish.userData
                    .bodyMaterial
            ) {
                starfish.userData
                    .bodyMaterial
                    .emissiveIntensity =
                    starfish.userData
                        .baseEmissive +
                    pulse * 0.55;
            }

            const sparkles =
                starfish.userData.sparkles;

            if (!sparkles?.length) {
                continue;
            }

            for (
                let sparkleIndex = 0;
                sparkleIndex <
                    sparkles.length;
                sparkleIndex++
            ) {
                const sparkle =
                    sparkles[
                        sparkleIndex
                    ];

                const wave =
                    0.5 +
                    0.5 *
                    Math.sin(
                        elapsedTime *
                            sparkle.userData
                                .speed +
                        sparkle.userData
                            .phase
                    );

                /*
                 * The high exponent keeps each glint
                 * invisible most of the time, followed
                 * by a fast jewel-like flash.
                 */
                const flare =
                    Math.pow(
                        wave,
                        18
                    ) *
                    sparkle.userData
                        .strength;

                sparkle.material.opacity =
                    flare * 0.98;

                sparkle.scale.setScalar(
                    sparkle.userData
                        .baseSize *
                    (
                        0.42 +
                        flare * 1.9
                    )
                );

                sparkle.material.rotation =
                    sparkle.userData
                        .baseRotation +
                    elapsedTime *
                        0.24 *
                        sparkle.userData
                            .rotationDirection;
            }
        }
    }

    /*
     * The meteorite is embedded in the floor.
     * Only its internal energy pulses.
     */
    const slowPulse = Math.sin(
        elapsedTime * 1.15
    );

    const quickPulse = Math.sin(
        elapsedTime * 1.75
    );

    if (data.cometCracks?.length) {
        for (
            let i = 0;
            i < data.cometCracks.length;
            i++
        ) {
            data.cometCracks[i]
                .material.opacity =
                0.88 +
                Math.sin(
                    elapsedTime * 1.55 +
                    i * 0.8
                ) * 0.12;
        }
    }

    /*
     * Blue crystalline glints briefly flare at
     * different places across the meteorite.
     */
    let sparkleFlarePeak = 0;

    if (data.cometSparkles?.length) {
        for (
            let i = 0;
            i < data.cometSparkles.length;
            i++
        ) {
            const sparkle =
                data.cometSparkles[i];

            const sparkleWave =
                0.5 +
                0.5 *
                Math.sin(
                    elapsedTime *
                        sparkle.userData.speed +
                    sparkle.userData.phase
                );

            /*
             * Softer power keeps sparkles flashing
             * more often while still peaking hard.
             */
            const flare = Math.pow(
                sparkleWave,
                6
            );

            sparkleFlarePeak = Math.max(
                sparkleFlarePeak,
                flare *
                    sparkle.userData.strength
            );

            const strength =
                sparkle.userData.strength;

            sparkle.material.opacity =
                0.18 +
                flare *
                    1.15 *
                    strength;

            const sparkleScale =
                sparkle.userData.baseSize *
                (
                    0.72 +
                    flare * 1.85
                );

            sparkle.scale.setScalar(
                sparkleScale
            );

            /*
             * Slowly turning rays prevent every glint
             * from flashing in exactly the same shape.
             */
            sparkle.material.rotation =
                i * 0.63 +
                elapsedTime *
                    (
                        i % 2 === 0
                            ? 0.22
                            : -0.18
                    );
        }
    }

    if (data.cometGlow) {
        data.cometGlow.intensity =
            6.4 +
            slowPulse * 0.9 +
            sparkleFlarePeak * 1.4;
    }

    if (data.cometFill) {
        data.cometFill.intensity =
            2.2 +
            quickPulse * 0.35 +
            sparkleFlarePeak * 0.5;
    }

    if (data.cometCrystal) {
        data.cometCrystal.material
            .emissiveIntensity =
            9.2 +
            slowPulse * 1.8 +
            sparkleFlarePeak * 2.2;
    }

    if (data.crystalGlow) {
        const glowPulse =
            1 +
            slowPulse * 0.08 +
            sparkleFlarePeak * 0.14;

        data.crystalGlow.scale.setScalar(
            3.6 * glowPulse
        );

        data.crystalGlow.material.opacity =
            0.4 +
            slowPulse * 0.06 +
            sparkleFlarePeak * 0.14;
    }

    if (data.crystalBloom) {
        const bloomPulse =
            1 +
            quickPulse * 0.08 +
            sparkleFlarePeak * 0.2;

        data.crystalBloom.scale.setScalar(
            1.85 * bloomPulse
        );

        data.crystalBloom.material.opacity =
            0.48 +
            quickPulse * 0.06 +
            sparkleFlarePeak * 0.18;
    }

    if (data.cometAura) {
        const pulse =
            1 +
            slowPulse * 0.08 +
            sparkleFlarePeak * 0.1;

        data.cometAura.scale.setScalar(
            6.4 * pulse
        );

        data.cometAura.material.opacity =
            0.34 +
            quickPulse * 0.05 +
            sparkleFlarePeak * 0.12;
    }

    if (data.cometOuterAura) {
        const outerPulse =
            1 +
            slowPulse * 0.05 +
            sparkleFlarePeak * 0.06;

        data.cometOuterAura.scale.setScalar(
            9.2 * outerPulse
        );

        data.cometOuterAura.material.opacity =
            0.18 +
            slowPulse * 0.04 +
            sparkleFlarePeak * 0.08;
    }

    if (data.floorHalo) {
        const floorPulse =
            1 +
            slowPulse * 0.05 +
            sparkleFlarePeak * 0.04;

        data.floorHalo.scale.setScalar(
            floorPulse
        );

        data.floorHalo.material.opacity =
            0.42 +
            quickPulse * 0.04 +
            sparkleFlarePeak * 0.08;
    }

    if (data.glowColumn) {
        const columnPulse =
            1 +
            slowPulse * 0.06 +
            sparkleFlarePeak * 0.05;

        data.glowColumn.scale.set(
            7.2 * columnPulse,
            13.5 * columnPulse,
            1
        );

        data.glowColumn.material.opacity =
            0.16 +
            slowPulse * 0.04 +
            sparkleFlarePeak * 0.06;
    }

}

export {
    STARFALL_BED_OFFSET
};
