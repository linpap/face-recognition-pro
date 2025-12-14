import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ============================================
// CONFIGURATION
// ============================================
let CONFIG = {
    particleCount: 20000,
    particleSize: 1.0,
    mouseInfluence: 3.0,
    rotationSpeed: 0.0003,
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.1
};

// ============================================
// GLOBAL STATE
// ============================================
let scene, camera, renderer, composer, controls;
let particleSystem, particleGeometry, particleMaterial;
let positions, velocities, colors, sizes, originalPositions;
let currentTemplate = 'galaxy';
let mousePos = new THREE.Vector3(0, 0, 0);
let targetMousePos = new THREE.Vector3(0, 0, 0);
let time = 0;
let lastTime = performance.now();
let frameCount = 0;

// Gesture state
let gestureState = {
    gesture: 'none',
    isExpanding: false,
    isAttracting: false,
    speedMultiplier: 1,
    colorCycleReady: true
};

// Color palettes
const colorPalettes = [
    // Purple/Pink galaxy
    [[0.545, 0.361, 0.965], [0.925, 0.282, 0.6], [0.388, 0.4, 0.945], [0.647, 0.533, 0.992], [1, 1, 1]],
    // Blue/Cyan
    [[0.231, 0.51, 0.965], [0.376, 0.647, 0.984], [0, 0.808, 0.788], [0.506, 0.925, 0.925], [1, 1, 1]],
    // Warm orange/red
    [[0.992, 0.42, 0.42], [0.933, 0.353, 0.353], [0.992, 0.557, 0.557], [0.988, 0.796, 0.431], [1, 1, 1]],
    // Green/Teal
    [[0.333, 0.937, 0.769], [0, 0.722, 0.58], [0, 0.808, 0.788], [0.506, 0.925, 0.925], [1, 1, 1]],
    // Gold/Yellow
    [[0.992, 0.902, 0.655], [0.988, 0.796, 0.431], [0.953, 0.612, 0.071], [0.882, 0.333, 0.192], [1, 1, 1]]
];
let currentPalette = 0;

// ============================================
// SHAPE GENERATORS
// ============================================
const ShapeGenerators = {
    galaxy: (i, total) => {
        const arm = i % 4;
        const armAngle = (arm / 4) * Math.PI * 2;
        const progress = (i / total);
        const distance = progress * 12;
        const spiralAngle = progress * Math.PI * 4 + armAngle;
        const spread = 0.5 + progress * 2;

        return {
            x: Math.cos(spiralAngle) * distance + (Math.random() - 0.5) * spread,
            y: (Math.random() - 0.5) * spread * 0.5,
            z: Math.sin(spiralAngle) * distance + (Math.random() - 0.5) * spread
        };
    },

    hearts: (i, total) => {
        const t = (i / total) * Math.PI * 2;
        const scale = 0.3 + Math.random() * 0.2;
        const layer = Math.floor(Math.random() * 8) - 4;

        const x = 16 * Math.pow(Math.sin(t), 3) * scale;
        const y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * scale;
        const z = layer * 0.3 + (Math.random() - 0.5) * 0.5;

        return { x, y, z };
    },

    flowers: (i, total) => {
        const petals = 6;
        const t = (i / total) * Math.PI * 2 * petals;
        const r = (Math.cos(petals * t / 2) * 4 + 1) * (0.5 + Math.random() * 0.5);
        const layer = (Math.random() - 0.5) * 3;

        return {
            x: r * Math.cos(t),
            y: r * Math.sin(t),
            z: layer + Math.sin(t * 3) * 0.5
        };
    },

    saturn: (i, total) => {
        const isRing = Math.random() > 0.25;

        if (isRing) {
            const angle = (i / total) * Math.PI * 2 * 5;
            const ringRadius = 5 + Math.random() * 2;
            const tilt = 0.3;

            return {
                x: ringRadius * Math.cos(angle) + (Math.random() - 0.5) * 0.3,
                y: ringRadius * Math.sin(angle) * tilt + (Math.random() - 0.5) * 0.2,
                z: ringRadius * Math.sin(angle) * Math.sqrt(1 - tilt * tilt)
            };
        } else {
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = Math.random() * Math.PI * 2;
            const r = 2.5 * (0.9 + Math.random() * 0.2);

            return {
                x: r * Math.sin(phi) * Math.cos(theta),
                y: r * Math.sin(phi) * Math.sin(theta) * 0.8,
                z: r * Math.cos(phi)
            };
        }
    },

    fireworks: (i, total) => {
        const numBursts = 7;
        const burst = Math.floor((i / total) * numBursts);
        const burstAngle = (burst / numBursts) * Math.PI * 2;
        const burstDist = 4;

        const center = {
            x: Math.cos(burstAngle) * burstDist,
            y: Math.sin(burst * 1.5) * 2 + (burst % 2) * 2 - 1,
            z: Math.sin(burstAngle) * burstDist
        };

        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 2;

        return {
            x: center.x + r * Math.sin(phi) * Math.cos(theta),
            y: center.y + r * Math.sin(phi) * Math.sin(theta),
            z: center.z + r * Math.cos(phi)
        };
    },

    vortex: (i, total) => {
        const progress = i / total;
        const angle = progress * Math.PI * 8;
        const radius = progress * 8;
        const height = (progress - 0.5) * 10;

        return {
            x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.5,
            y: height + (Math.random() - 0.5) * 0.5,
            z: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.5
        };
    },

    dna: (i, total) => {
        const progress = i / total;
        const angle = progress * Math.PI * 6;
        const height = (progress - 0.5) * 15;
        const strand = i % 2;
        const radius = 2;

        const offset = strand * Math.PI;

        return {
            x: Math.cos(angle + offset) * radius + (Math.random() - 0.5) * 0.3,
            y: height,
            z: Math.sin(angle + offset) * radius + (Math.random() - 0.5) * 0.3
        };
    },

    wave: (i, total) => {
        const gridSize = Math.sqrt(total);
        const x = (i % gridSize) / gridSize * 20 - 10;
        const z = Math.floor(i / gridSize) / gridSize * 20 - 10;
        const dist = Math.sqrt(x * x + z * z);
        const y = Math.sin(dist * 0.5) * 2;

        return {
            x: x + (Math.random() - 0.5) * 0.2,
            y: y + (Math.random() - 0.5) * 0.2,
            z: z + (Math.random() - 0.5) * 0.2
        };
    }
};

// ============================================
// THREE.JS SETUP
// ============================================
function initThree() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000008);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 20;

    // Renderer with high quality settings
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        stencil: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    document.getElementById('container').appendChild(renderer.domElement);

    // Post-processing
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        CONFIG.bloomStrength,
        CONFIG.bloomRadius,
        CONFIG.bloomThreshold
    );
    composer.addPass(bloomPass);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.minDistance = 5;
    controls.maxDistance = 50;

    // Create particles
    createParticles();

    // Events
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);

    // UI
    initUI();
}

function createParticles() {
    const count = CONFIG.particleCount;

    // Geometry
    particleGeometry = new THREE.BufferGeometry();
    positions = new Float32Array(count * 3);
    velocities = new Float32Array(count * 3);
    colors = new Float32Array(count * 3);
    sizes = new Float32Array(count);
    originalPositions = new Float32Array(count * 3);

    // Initialize particles
    for (let i = 0; i < count; i++) {
        const pos = ShapeGenerators[currentTemplate](i, count);

        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        originalPositions[i * 3] = pos.x;
        originalPositions[i * 3 + 1] = pos.y;
        originalPositions[i * 3 + 2] = pos.z;

        velocities[i * 3] = 0;
        velocities[i * 3 + 1] = 0;
        velocities[i * 3 + 2] = 0;

        // Color from palette
        const palette = colorPalettes[currentPalette];
        const color = palette[Math.floor(Math.random() * palette.length)];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];

        sizes[i] = 0.5 + Math.random() * 1.5;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Shader material for smooth, glowing particles
    particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
            uSize: { value: CONFIG.particleSize }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            varying float vSize;
            uniform float uTime;
            uniform float uPixelRatio;
            uniform float uSize;

            void main() {
                vColor = color;
                vSize = size;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * uSize * uPixelRatio * (200.0 / -mvPosition.z);
                gl_PointSize = max(gl_PointSize, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vSize;

            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                // Smooth circle with glow
                float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                float glow = exp(-dist * 3.0) * 0.5;
                alpha = alpha + glow;

                if (alpha < 0.01) discard;

                vec3 finalColor = vColor * (1.0 + glow);
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
}

function updateParticleTemplate(template) {
    currentTemplate = template;
    const count = CONFIG.particleCount;

    for (let i = 0; i < count; i++) {
        const pos = ShapeGenerators[template](i, count);
        originalPositions[i * 3] = pos.x;
        originalPositions[i * 3 + 1] = pos.y;
        originalPositions[i * 3 + 2] = pos.z;
    }
}

function updateParticleColors() {
    const count = CONFIG.particleCount;
    const palette = colorPalettes[currentPalette];

    for (let i = 0; i < count; i++) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
    }

    particleGeometry.attributes.color.needsUpdate = true;
}

function rebuildParticles() {
    scene.remove(particleSystem);
    particleGeometry.dispose();
    particleMaterial.dispose();
    createParticles();
    updateParticleTemplate(currentTemplate);
}

// ============================================
// ANIMATION
// ============================================
function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    time += delta * gestureState.speedMultiplier;

    // FPS counter
    frameCount++;
    if (frameCount % 30 === 0) {
        document.getElementById('fpsCounter').textContent = `FPS: ${Math.round(1 / delta)}`;
    }

    // Smooth mouse following
    targetMousePos.lerp(mousePos, 0.1);

    // Update particle uniform
    particleMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uSize.value = CONFIG.particleSize;

    // Update particles
    updateParticles(delta);

    // Rotate
    particleSystem.rotation.y += CONFIG.rotationSpeed * gestureState.speedMultiplier;

    controls.update();
    composer.render();
}

function updateParticles(delta) {
    const count = CONFIG.particleCount;
    const influence = CONFIG.mouseInfluence;

    for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const iy = ix + 1;
        const iz = ix + 2;

        // Current position
        let px = positions[ix];
        let py = positions[iy];
        let pz = positions[iz];

        // Target position (original shape)
        const tx = originalPositions[ix];
        const ty = originalPositions[iy];
        const tz = originalPositions[iz];

        // Distance to mouse
        const dx = targetMousePos.x - px;
        const dy = targetMousePos.y - py;
        const dz = targetMousePos.z - pz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Mouse interaction
        if (dist < influence && dist > 0.01) {
            const force = (influence - dist) / influence;
            const strength = force * force * 0.5;

            if (gestureState.isAttracting) {
                // Attract toward cursor
                velocities[ix] += dx * strength * 0.1;
                velocities[iy] += dy * strength * 0.1;
                velocities[iz] += dz * strength * 0.1;
            } else {
                // Push away from cursor
                velocities[ix] -= dx / dist * strength * 2;
                velocities[iy] -= dy / dist * strength * 2;
                velocities[iz] -= dz / dist * strength * 2;

                // Add swirl
                velocities[ix] += dz / dist * strength * 0.3;
                velocities[iz] -= dx / dist * strength * 0.3;
            }
        }

        // Return to original position
        const returnStrength = gestureState.isExpanding ? 0.01 : 0.03;
        velocities[ix] += (tx - px) * returnStrength;
        velocities[iy] += (ty - py) * returnStrength;
        velocities[iz] += (tz - pz) * returnStrength;

        // Apply velocity with damping
        velocities[ix] *= 0.95;
        velocities[iy] *= 0.95;
        velocities[iz] *= 0.95;

        positions[ix] += velocities[ix];
        positions[iy] += velocities[iy];
        positions[iz] += velocities[iz];
    }

    particleGeometry.attributes.position.needsUpdate = true;
}

// ============================================
// EVENTS
// ============================================
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    particleMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
}

function onMouseMove(e) {
    // Convert to normalized coordinates
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Project to 3D space
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    mousePos = camera.position.clone().add(dir.multiplyScalar(distance));
}

// ============================================
// HAND TRACKING
// ============================================
let hands, handCamera;
const handCanvas = document.getElementById('handCanvas');
const handCtx = handCanvas.getContext('2d');

async function initHandTracking() {
    const video = document.getElementById('webcam');

    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);

    handCamera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
        width: 640,
        height: 480
    });

    try {
        await handCamera.start();
        document.getElementById('handStatus').textContent = 'Hand tracking active';
        document.getElementById('handStatus').classList.add('connected');
    } catch (err) {
        document.getElementById('handStatus').textContent = 'Using mouse control';
    }
}

function onHandResults(results) {
    handCanvas.width = 220;
    handCanvas.height = 165;
    handCtx.clearRect(0, 0, 220, 165);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw hand
        drawHand(landmarks);

        // Detect gesture
        const gesture = detectGesture(landmarks);
        applyGesture(gesture);

        // Use index finger for position
        const indexTip = landmarks[8];
        const x = (1 - indexTip.x) * 2 - 1;
        const y = -(indexTip.y) * 2 + 1;

        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        mousePos = camera.position.clone().add(dir.multiplyScalar(distance));
    } else {
        document.getElementById('gestureStatus').textContent = 'Gesture: None';
        gestureState.isExpanding = false;
        gestureState.isAttracting = false;
        gestureState.speedMultiplier = 1;
    }
}

function drawHand(landmarks) {
    handCtx.strokeStyle = '#8B5CF6';
    handCtx.lineWidth = 2;
    handCtx.fillStyle = '#8B5CF6';

    const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17]
    ];

    connections.forEach(([i, j]) => {
        handCtx.beginPath();
        handCtx.moveTo(landmarks[i].x * 220, landmarks[i].y * 165);
        handCtx.lineTo(landmarks[j].x * 220, landmarks[j].y * 165);
        handCtx.stroke();
    });

    landmarks.forEach(p => {
        handCtx.beginPath();
        handCtx.arc(p.x * 220, p.y * 165, 3, 0, Math.PI * 2);
        handCtx.fill();
    });
}

function detectGesture(landmarks) {
    const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const bases = [landmarks[3], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];

    const extended = tips.map((tip, i) => {
        if (i === 0) return tip.x < landmarks[3].x; // Thumb
        return tip.y < bases[i].y;
    });

    const pinchDist = Math.hypot(tips[0].x - tips[1].x, tips[0].y - tips[1].y);

    if (extended[1] && extended[2] && extended[3] && extended[4]) return 'open_hand';
    if (!extended[1] && !extended[2] && !extended[3] && !extended[4]) return 'fist';
    if (extended[1] && extended[2] && !extended[3] && !extended[4]) return 'peace';
    if (extended[0] && !extended[1] && !extended[2] && !extended[3] && !extended[4]) return 'thumbs_up';
    if (pinchDist < 0.08) return 'pinch';

    return 'unknown';
}

function applyGesture(gesture) {
    const statusEl = document.getElementById('gestureStatus');

    switch (gesture) {
        case 'open_hand':
            statusEl.textContent = 'Gesture: Open Hand (Push)';
            gestureState.isExpanding = true;
            gestureState.isAttracting = false;
            break;
        case 'fist':
            statusEl.textContent = 'Gesture: Fist (Attract)';
            gestureState.isAttracting = true;
            gestureState.isExpanding = false;
            break;
        case 'peace':
            statusEl.textContent = 'Gesture: Peace (Colors)';
            gestureState.isExpanding = false;
            gestureState.isAttracting = false;
            if (gestureState.colorCycleReady) {
                gestureState.colorCycleReady = false;
                currentPalette = (currentPalette + 1) % colorPalettes.length;
                updateParticleColors();
                setTimeout(() => { gestureState.colorCycleReady = true; }, 500);
            }
            break;
        case 'thumbs_up':
            statusEl.textContent = 'Gesture: Thumbs Up (Fast)';
            gestureState.speedMultiplier = 3;
            gestureState.isExpanding = false;
            gestureState.isAttracting = false;
            break;
        case 'pinch':
            statusEl.textContent = 'Gesture: Pinch (Slow)';
            gestureState.speedMultiplier = 0.2;
            gestureState.isExpanding = false;
            gestureState.isAttracting = false;
            break;
        default:
            gestureState.speedMultiplier = 1;
            gestureState.isExpanding = false;
            gestureState.isAttracting = false;
    }
}

// ============================================
// UI
// ============================================
function initUI() {
    // Template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateParticleTemplate(btn.dataset.template);
        });
    });

    // Particle count slider
    const countSlider = document.getElementById('particleCount');
    const countValue = document.getElementById('countValue');
    countSlider.addEventListener('input', (e) => {
        CONFIG.particleCount = parseInt(e.target.value);
        countValue.textContent = CONFIG.particleCount;
    });
    countSlider.addEventListener('change', () => {
        rebuildParticles();
    });

    // Particle size slider
    const sizeSlider = document.getElementById('particleSize');
    const sizeValue = document.getElementById('sizeValue');
    sizeSlider.addEventListener('input', (e) => {
        CONFIG.particleSize = parseFloat(e.target.value);
        sizeValue.textContent = CONFIG.particleSize.toFixed(1);
    });
}

// ============================================
// INIT
// ============================================
async function init() {
    initThree();
    await initHandTracking();
    animate();
}

init();
