import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    particleCount: 3000,
    baseSize: 0.15,
    expansionFactor: 2.5,
    rotationSpeed: 0.001,
    colorTransitionSpeed: 0.02,
    spreadRadius: 15
};

// ============================================
// GLOBAL STATE
// ============================================
let scene, camera, renderer, controls;
let particleSystem, particleGeometry, particleMaterial;
let particles = [];
let currentTemplate = 'hearts';
let targetPositions = [];
let currentColorScheme = 0;
let gestureState = {
    isExpanded: false,
    colorCycling: false,
    speedMultiplier: 1,
    handPosition: { x: 0, y: 0, z: 0 }
};

// Color schemes for particles
const colorSchemes = [
    [0xff6b6b, 0xee5a5a, 0xff8e8e, 0xffa0a0], // Reds
    [0x74b9ff, 0x0984e3, 0x00cec9, 0x81ecec], // Blues
    [0xfdcb6e, 0xf39c12, 0xe17055, 0xd63031], // Warm
    [0xa29bfe, 0x6c5ce7, 0xfd79a8, 0xe84393], // Purple/Pink
    [0x55efc4, 0x00b894, 0x00cec9, 0x81ecec], // Greens
    [0xffeaa7, 0xfdcb6e, 0xf39c12, 0xe17055]  // Golden
];

// ============================================
// PARTICLE SHAPE GENERATORS
// ============================================
const ShapeGenerators = {
    hearts: (index, total) => {
        const t = (index / total) * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.4;
        const layer = Math.floor(Math.random() * 5);

        // Heart parametric equation
        const x = 16 * Math.pow(Math.sin(t), 3) * scale * 0.15;
        const y = (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * scale * 0.15;
        const z = (layer - 2) * 0.5 + (Math.random() - 0.5) * 0.3;

        return { x, y, z };
    },

    flowers: (index, total) => {
        const petals = 6;
        const t = (index / total) * Math.PI * 2 * petals;
        const r = Math.cos(petals * t / 2) * 3 + Math.random() * 0.5;
        const layer = Math.floor(Math.random() * 4);

        const x = r * Math.cos(t);
        const y = r * Math.sin(t);
        const z = (layer - 1.5) * 0.4 + Math.sin(t * 3) * 0.3;

        return { x, y, z };
    },

    saturn: (index, total) => {
        const isRing = Math.random() > 0.3;

        if (isRing) {
            // Ring particles
            const angle = (index / total) * Math.PI * 2 * 3;
            const ringRadius = 4 + Math.random() * 1.5;
            const tilt = 0.3;

            const x = ringRadius * Math.cos(angle);
            const y = ringRadius * Math.sin(angle) * tilt + (Math.random() - 0.5) * 0.2;
            const z = ringRadius * Math.sin(angle) * Math.sqrt(1 - tilt * tilt);

            return { x, y, z };
        } else {
            // Planet sphere
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = Math.random() * Math.PI * 2;
            const r = 2 + Math.random() * 0.3;

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            return { x, y, z };
        }
    },

    fireworks: (index, total) => {
        const burst = Math.floor(index / (total / 5));
        const burstCenter = {
            x: (burst - 2) * 3,
            y: Math.sin(burst) * 2,
            z: Math.cos(burst) * 2
        };

        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        const r = 1.5 + Math.random() * 2;

        const x = burstCenter.x + r * Math.sin(phi) * Math.cos(theta);
        const y = burstCenter.y + r * Math.sin(phi) * Math.sin(theta);
        const z = burstCenter.z + r * Math.cos(phi);

        return { x, y, z };
    },

    stars: (index, total) => {
        const points = 5;
        const t = (index / total) * Math.PI * 2 * points;
        const r = (index % 2 === 0) ? 3 : 1.5;
        const layer = Math.floor(Math.random() * 3);

        const x = r * Math.cos(t) * (0.8 + Math.random() * 0.4);
        const y = r * Math.sin(t) * (0.8 + Math.random() * 0.4);
        const z = (layer - 1) * 0.5 + (Math.random() - 0.5) * 0.5;

        return { x, y, z };
    },

    snowflakes: (index, total) => {
        const arms = 6;
        const t = (index / total) * Math.PI * 2 * arms;
        const r = Math.random() * 4;
        const branch = Math.floor(Math.random() * 3);

        let x = r * Math.cos(t);
        let y = r * Math.sin(t);
        let z = (Math.random() - 0.5) * 2;

        // Add fractal branching
        if (branch === 1) {
            x += Math.cos(t + Math.PI / 6) * 0.5;
            y += Math.sin(t + Math.PI / 6) * 0.5;
        } else if (branch === 2) {
            x += Math.cos(t - Math.PI / 6) * 0.5;
            y += Math.sin(t - Math.PI / 6) * 0.5;
        }

        return { x, y, z };
    }
};

// ============================================
// PARTICLE TEXTURE GENERATORS (High Quality)
// ============================================
function createParticleTexture(type = 'glow', size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    switch (type) {
        case 'glow':
            // Soft glowing circle with smooth falloff
            const glowGradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
            glowGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            glowGradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
            glowGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
            glowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
            glowGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
            glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = glowGradient;
            ctx.fillRect(0, 0, size, size);
            break;

        case 'heart':
            // High-quality heart shape
            ctx.save();
            ctx.translate(center, center + 5);
            ctx.scale(radius / 20, radius / 20);
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.bezierCurveTo(-12, -20, -24, -5, 0, 15);
            ctx.bezierCurveTo(24, -5, 12, -20, 0, -8);
            ctx.closePath();

            // Gradient fill for 3D effect
            const heartGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, 25);
            heartGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            heartGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
            heartGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
            ctx.fillStyle = heartGrad;
            ctx.fill();

            // Soft glow around heart
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.restore();
            break;

        case 'star':
            // 5-pointed star
            ctx.save();
            ctx.translate(center, center);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const outerAngle = (i * 72 - 90) * Math.PI / 180;
                const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
                const outerX = Math.cos(outerAngle) * radius;
                const outerY = Math.sin(outerAngle) * radius;
                const innerX = Math.cos(innerAngle) * (radius * 0.4);
                const innerY = Math.sin(innerAngle) * (radius * 0.4);

                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();

            const starGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            starGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            starGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.7)');
            starGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
            ctx.fillStyle = starGrad;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
            break;

        case 'flower':
            // 6-petal flower
            ctx.save();
            ctx.translate(center, center);
            const petalCount = 6;
            const petalLength = radius * 0.8;
            const petalWidth = radius * 0.4;

            for (let i = 0; i < petalCount; i++) {
                ctx.save();
                ctx.rotate((i * 60) * Math.PI / 180);
                ctx.beginPath();
                ctx.ellipse(0, -petalLength / 2, petalWidth / 2, petalLength / 2, 0, 0, Math.PI * 2);
                const petalGrad = ctx.createRadialGradient(0, -petalLength / 2, 0, 0, -petalLength / 2, petalLength / 2);
                petalGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                petalGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
                ctx.fillStyle = petalGrad;
                ctx.fill();
                ctx.restore();
            }

            // Center of flower
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.fill();
            ctx.restore();
            break;

        case 'snowflake':
            // 6-armed snowflake
            ctx.save();
            ctx.translate(center, center);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 8;

            for (let i = 0; i < 6; i++) {
                ctx.save();
                ctx.rotate((i * 60) * Math.PI / 180);

                // Main arm
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -radius * 0.9);
                ctx.stroke();

                // Branches
                ctx.beginPath();
                ctx.moveTo(0, -radius * 0.4);
                ctx.lineTo(-radius * 0.2, -radius * 0.6);
                ctx.moveTo(0, -radius * 0.4);
                ctx.lineTo(radius * 0.2, -radius * 0.6);
                ctx.moveTo(0, -radius * 0.65);
                ctx.lineTo(-radius * 0.15, -radius * 0.8);
                ctx.moveTo(0, -radius * 0.65);
                ctx.lineTo(radius * 0.15, -radius * 0.8);
                ctx.stroke();

                ctx.restore();
            }

            // Center
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.fill();
            ctx.restore();
            break;

        case 'spark':
            // Bright spark/firework particle
            ctx.save();
            ctx.translate(center, center);

            // Outer glow
            const sparkGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            sparkGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            sparkGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.9)');
            sparkGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
            sparkGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
            sparkGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = sparkGrad;
            ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

            // Cross flare
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-radius * 0.7, 0);
            ctx.lineTo(radius * 0.7, 0);
            ctx.moveTo(0, -radius * 0.7);
            ctx.lineTo(0, radius * 0.7);
            ctx.stroke();
            ctx.restore();
            break;

        case 'ring':
            // Saturn ring particle
            const ringGrad = ctx.createRadialGradient(center, center, radius * 0.5, center, center, radius);
            ringGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            ringGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
            ringGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
            ringGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)');
            ringGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = ringGrad;
            ctx.fillRect(0, 0, size, size);
            break;

        default:
            // Default soft circle
            const defaultGrad = ctx.createRadialGradient(center, center, 0, center, center, radius);
            defaultGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            defaultGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            defaultGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = defaultGrad;
            ctx.fillRect(0, 0, size, size);
    }

    return canvas;
}

// Store textures for each template
const particleTextures = {};

function getTextureForTemplate(template) {
    const textureMap = {
        hearts: 'heart',
        flowers: 'flower',
        saturn: 'glow',
        fireworks: 'spark',
        stars: 'star',
        snowflakes: 'snowflake'
    };
    return textureMap[template] || 'glow';
}

function loadParticleTextures() {
    const types = ['glow', 'heart', 'star', 'flower', 'snowflake', 'spark', 'ring'];
    types.forEach(type => {
        const canvas = createParticleTexture(type, 256);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        particleTextures[type] = texture;
    });
}

// ============================================
// THREE.JS SETUP
// ============================================
function initThree() {
    // Load textures first
    loadParticleTextures();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.Fog(0x0a0a0f, 20, 50);

    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 15;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('particleCanvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Create particle system
    createParticleSystem();

    // Handle resize
    window.addEventListener('resize', onWindowResize);
}

function createParticleSystem() {
    // Geometry
    particleGeometry = new THREE.BufferGeometry();

    const positions = new Float32Array(CONFIG.particleCount * 3);
    const colors = new Float32Array(CONFIG.particleCount * 3);
    const sizes = new Float32Array(CONFIG.particleCount);
    const alphas = new Float32Array(CONFIG.particleCount);

    // Initialize particles
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const pos = ShapeGenerators[currentTemplate](i, CONFIG.particleCount);

        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        const color = new THREE.Color(colorSchemes[currentColorScheme][i % colorSchemes[currentColorScheme].length]);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = CONFIG.baseSize * (0.5 + Math.random() * 0.5);
        alphas[i] = 0.6 + Math.random() * 0.4;

        particles.push({
            originalPos: { ...pos },
            currentPos: { ...pos },
            velocity: { x: 0, y: 0, z: 0 },
            phase: Math.random() * Math.PI * 2
        });

        targetPositions.push({ ...pos });
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    // Use PointsMaterial with high-quality texture
    const textureType = getTextureForTemplate(currentTemplate);
    particleMaterial = new THREE.PointsMaterial({
        size: CONFIG.baseSize * 2.5,
        map: particleTextures[textureType],
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        alphaTest: 0.001
    });

    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
}

// Function to update particle texture when template changes
function updateParticleTexture(template) {
    const textureType = getTextureForTemplate(template);
    particleMaterial.map = particleTextures[textureType];
    particleMaterial.needsUpdate = true;
}

function updateParticlePositions(template) {
    currentTemplate = template;

    // Update texture for the new template
    updateParticleTexture(template);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const newPos = ShapeGenerators[template](i, CONFIG.particleCount);
        targetPositions[i] = newPos;
        particles[i].originalPos = { ...newPos };
    }
}

function updateParticleColors(schemeIndex) {
    const colors = particleGeometry.attributes.color.array;
    const scheme = colorSchemes[schemeIndex];

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const color = new THREE.Color(scheme[i % scheme.length]);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    particleGeometry.attributes.color.needsUpdate = true;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// HAND TRACKING SETUP
// ============================================
let hands;
let handCamera;
const handCanvas = document.getElementById('handCanvas');
const handCtx = handCanvas.getContext('2d');

async function initHandTracking() {
    const videoElement = document.getElementById('webcam');

    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);

    handCamera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    try {
        await handCamera.start();
        document.getElementById('handStatus').textContent = 'Hand tracking active';
        document.getElementById('handStatus').classList.add('connected');
    } catch (error) {
        console.error('Camera error:', error);
        document.getElementById('handStatus').textContent = 'Camera not available';
    }
}

function onHandResults(results) {
    // Clear hand canvas
    handCanvas.width = 240;
    handCanvas.height = 180;
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw hand landmarks
        drawHandLandmarks(landmarks);

        // Detect gesture
        const gesture = detectGesture(landmarks);
        applyGestureEffect(gesture, landmarks);

        // Update hand position for particle attraction
        const palmCenter = landmarks[9]; // Middle finger base
        gestureState.handPosition = {
            x: (palmCenter.x - 0.5) * 20,
            y: -(palmCenter.y - 0.5) * 15,
            z: palmCenter.z * 10
        };
    } else {
        document.getElementById('gestureStatus').textContent = 'Gesture: None';
    }
}

function drawHandLandmarks(landmarks) {
    handCtx.fillStyle = '#00ff88';
    handCtx.strokeStyle = '#00ff88';
    handCtx.lineWidth = 2;

    // Draw connections
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],  // Index
        [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],  // Ring
        [0, 17], [17, 18], [18, 19], [19, 20],  // Pinky
        [5, 9], [9, 13], [13, 17]  // Palm
    ];

    connections.forEach(([i, j]) => {
        const start = landmarks[i];
        const end = landmarks[j];
        handCtx.beginPath();
        handCtx.moveTo(start.x * 240, start.y * 180);
        handCtx.lineTo(end.x * 240, end.y * 180);
        handCtx.stroke();
    });

    // Draw points
    landmarks.forEach((point, index) => {
        handCtx.beginPath();
        handCtx.arc(point.x * 240, point.y * 180, 4, 0, Math.PI * 2);
        handCtx.fill();
    });
}

function detectGesture(landmarks) {
    // Get finger tip and base positions
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const thumbMCP = landmarks[2];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    const ringBase = landmarks[13];
    const pinkyBase = landmarks[17];
    const wrist = landmarks[0];

    // Calculate if fingers are extended (tip above base in screen coords)
    const indexExtended = indexTip.y < indexBase.y - 0.05;
    const middleExtended = middleTip.y < middleBase.y - 0.05;
    const ringExtended = ringTip.y < ringBase.y - 0.05;
    const pinkyExtended = pinkyTip.y < pinkyBase.y - 0.05;

    // Thumb up check - thumb tip is above thumb base (pointing up)
    const thumbUp = thumbTip.y < thumbMCP.y - 0.05;

    // Thumb extended sideways check (works for both hands)
    const thumbExtendedSideways = Math.abs(thumbTip.x - thumbMCP.x) > 0.08;

    // Calculate pinch distance
    const pinchDistance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Check if fingers are curled (closed fist position)
    const fingersCurled = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

    // Gesture detection - order matters! More specific gestures first

    // Thumbs up: thumb pointing up, all other fingers curled
    if (thumbUp && fingersCurled) {
        return 'thumbs_up';
    }

    // Pinch: thumb and index close together
    if (pinchDistance < 0.08) {
        return 'pinch';
    }

    // Open hand: all fingers extended
    if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        return 'open_hand';
    }

    // Fist: all fingers curled, thumb not up
    if (fingersCurled && !thumbUp) {
        return 'fist';
    }

    // Peace sign: index and middle extended, others curled
    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
        return 'peace';
    }

    return 'unknown';
}

function applyGestureEffect(gesture, landmarks) {
    const statusEl = document.getElementById('gestureStatus');

    switch (gesture) {
        case 'open_hand':
            statusEl.textContent = 'Gesture: Open Hand (Expand)';
            gestureState.isExpanded = true;
            break;
        case 'fist':
            statusEl.textContent = 'Gesture: Fist (Contract)';
            gestureState.isExpanded = false;
            break;
        case 'peace':
            statusEl.textContent = 'Gesture: Peace (Color Change)';
            if (!gestureState.colorCycling) {
                gestureState.colorCycling = true;
                currentColorScheme = (currentColorScheme + 1) % colorSchemes.length;
                updateParticleColors(currentColorScheme);
                setTimeout(() => { gestureState.colorCycling = false; }, 500);
            }
            break;
        case 'thumbs_up':
            statusEl.textContent = 'Gesture: Thumbs Up (Speed Up)';
            gestureState.speedMultiplier = 2.5;
            break;
        case 'pinch':
            statusEl.textContent = 'Gesture: Pinch (Slow Down)';
            gestureState.speedMultiplier = 0.3;
            break;
        default:
            statusEl.textContent = 'Gesture: Detecting...';
            gestureState.speedMultiplier = 1;
    }
}

// ============================================
// ANIMATION LOOP
// ============================================
let time = 0;
let currentExpansion = 1.0;

function animate() {
    requestAnimationFrame(animate);

    time += 0.016 * gestureState.speedMultiplier;

    // Calculate target expansion
    const targetExpansion = gestureState.isExpanded ? CONFIG.expansionFactor : 1.0;
    currentExpansion += (targetExpansion - currentExpansion) * 0.05;

    // Update particle size based on expansion
    particleMaterial.size = CONFIG.baseSize * 2.5 * currentExpansion;

    // Update particle positions with interpolation
    const positions = particleGeometry.attributes.position.array;

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const particle = particles[i];
        const target = targetPositions[i];

        // Smooth interpolation to target
        particle.currentPos.x += (target.x - particle.currentPos.x) * 0.02;
        particle.currentPos.y += (target.y - particle.currentPos.y) * 0.02;
        particle.currentPos.z += (target.z - particle.currentPos.z) * 0.02;

        // Apply expansion when gesture detected
        let expansionMult = gestureState.isExpanded ? 1.5 : 1.0;

        // Add subtle floating animation
        const floatX = Math.sin(time + particle.phase) * 0.1;
        const floatY = Math.cos(time * 0.7 + particle.phase) * 0.1;
        const floatZ = Math.sin(time * 0.5 + particle.phase) * 0.05;

        positions[i * 3] = particle.currentPos.x * expansionMult + floatX;
        positions[i * 3 + 1] = particle.currentPos.y * expansionMult + floatY;
        positions[i * 3 + 2] = particle.currentPos.z * expansionMult + floatZ;

        // Attract particles toward hand position
        const dx = gestureState.handPosition.x - positions[i * 3];
        const dy = gestureState.handPosition.y - positions[i * 3 + 1];
        const dz = gestureState.handPosition.z - positions[i * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 8 && dist > 0.1) {
            const attraction = 0.02 / dist;
            positions[i * 3] += dx * attraction;
            positions[i * 3 + 1] += dy * attraction;
            positions[i * 3 + 2] += dz * attraction;
        }
    }

    particleGeometry.attributes.position.needsUpdate = true;

    // Rotate entire system
    particleSystem.rotation.y += CONFIG.rotationSpeed * gestureState.speedMultiplier;

    controls.update();
    renderer.render(scene, camera);
}

// ============================================
// UI SETUP
// ============================================
function initUI() {
    const templateButtons = document.querySelectorAll('.template-btn');

    templateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            templateButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Change particle template
            const template = btn.dataset.template;
            updateParticlePositions(template);
        });
    });
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    initThree();
    initUI();
    await initHandTracking();
    animate();
}

init();
