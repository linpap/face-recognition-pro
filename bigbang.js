// ============================================
// BIG BANG - Interactive Particle Explosion
// ============================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Configuration
const CONFIG = {
    particleCount: 25000,
    maxSpeed: 8,
    friction: 0.98,
    returnSpeed: 0.02,
    explosionForce: 15,
    contractionForce: 0.08,
    trailAlpha: 0.1,
    colors: [
        // Cosmic colors
        '#FF6B6B', '#FF8E53', '#FFCD56', '#FFE66D',
        '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD',
        '#FF69B4', '#87CEEB', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#FF4757'
    ]
};

// State
let width, height, centerX, centerY;
let particles = [];
let state = {
    phase: 'idle', // 'idle', 'contracted', 'exploding', 'expanded'
    expansionLevel: 0.5, // 0 = singularity, 1 = fully expanded
    targetExpansion: 0.5,
    colorScheme: 0,
    shockwave: null,
    timeDirection: 1, // 1 = forward, -1 = reverse
    handPosition: { x: 0, y: 0 }
};

// Color schemes
const colorSchemes = [
    ['#FF6B6B', '#FF8E53', '#FFCD56', '#FFE66D', '#FFF'], // Fire
    ['#4ECDC4', '#45B7D1', '#96E6A1', '#87CEEB', '#FFF'], // Ocean
    ['#BB8FCE', '#85C1E9', '#F8B500', '#FF69B4', '#FFF'], // Cosmic
    ['#FF4757', '#FF6B81', '#FFA502', '#FFCD56', '#FFF'], // Sunset
    ['#00D2D3', '#54A0FF', '#5F27CD', '#9B59B6', '#FFF'], // Nebula
    ['#F368E0', '#FF9FF3', '#FFEAA7', '#DFE6E9', '#FFF']  // Cotton Candy
];

// ============================================
// PARTICLE CLASS
// ============================================
class Particle {
    constructor(index) {
        this.index = index;
        this.reset();
    }

    reset() {
        // Random angle and distance from center
        this.angle = Math.random() * Math.PI * 2;
        this.baseDistance = 50 + Math.random() * Math.min(width, height) * 0.4;
        this.distance = this.baseDistance * state.expansionLevel;

        // Position
        this.x = centerX + Math.cos(this.angle) * this.distance;
        this.y = centerY + Math.sin(this.angle) * this.distance;

        // Velocity
        this.vx = 0;
        this.vy = 0;

        // Properties
        this.size = 1 + Math.random() * 2.5;
        this.colorIndex = Math.floor(Math.random() * colorSchemes[state.colorScheme].length);
        this.alpha = 0.6 + Math.random() * 0.4;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;

        // For spiral effect
        this.spiralOffset = Math.random() * Math.PI * 2;
        this.spiralSpeed = 0.001 + Math.random() * 0.002;
    }

    update() {
        const time = Date.now() * 0.001;

        // Calculate target position based on expansion level
        const targetDistance = this.baseDistance * state.expansionLevel;

        // Add spiral motion
        const spiralAngle = this.angle + Math.sin(time * this.spiralSpeed + this.spiralOffset) * 0.3;
        const targetX = centerX + Math.cos(spiralAngle) * targetDistance;
        const targetY = centerY + Math.sin(spiralAngle) * targetDistance;

        // Move toward target
        const dx = targetX - this.x;
        const dy = targetY - this.y;

        // Apply forces based on state
        if (state.phase === 'exploding') {
            // Explosive outward force
            const distFromCenter = Math.sqrt(
                Math.pow(this.x - centerX, 2) + Math.pow(this.y - centerY, 2)
            );
            if (distFromCenter > 0) {
                const force = CONFIG.explosionForce / (distFromCenter * 0.1 + 1);
                this.vx += ((this.x - centerX) / distFromCenter) * force;
                this.vy += ((this.y - centerY) / distFromCenter) * force;
            }
        } else if (state.phase === 'contracted') {
            // Strong pull toward center
            this.vx += (centerX - this.x) * CONFIG.contractionForce;
            this.vy += (centerY - this.y) * CONFIG.contractionForce;
        } else {
            // Normal return to position
            this.vx += dx * CONFIG.returnSpeed;
            this.vy += dy * CONFIG.returnSpeed;
        }

        // Apply shockwave
        if (state.shockwave) {
            const swDist = Math.sqrt(
                Math.pow(this.x - state.shockwave.x, 2) +
                Math.pow(this.y - state.shockwave.y, 2)
            );
            const ringDist = Math.abs(swDist - state.shockwave.radius);

            if (ringDist < 50) {
                const force = (1 - ringDist / 50) * state.shockwave.force;
                if (swDist > 0) {
                    this.vx += ((this.x - state.shockwave.x) / swDist) * force;
                    this.vy += ((this.y - state.shockwave.y) / swDist) * force;
                }
            }
        }

        // Interaction with hand position
        const handDx = this.x - state.handPosition.x;
        const handDy = this.y - state.handPosition.y;
        const handDist = Math.sqrt(handDx * handDx + handDy * handDy);

        if (handDist < 150 && handDist > 0) {
            const repelForce = (150 - handDist) / 150 * 2;
            this.vx += (handDx / handDist) * repelForce;
            this.vy += (handDy / handDist) * repelForce;
        }

        // Apply velocity with friction
        this.vx *= CONFIG.friction;
        this.vy *= CONFIG.friction;

        this.x += this.vx * state.timeDirection;
        this.y += this.vy * state.timeDirection;

        // Rotate angle slowly
        this.angle += this.rotationSpeed * state.timeDirection;

        // Keep particles in bounds (wrap around)
        if (this.x < -50) this.x = width + 50;
        if (this.x > width + 50) this.x = -50;
        if (this.y < -50) this.y = height + 50;
        if (this.y > height + 50) this.y = -50;
    }

    draw() {
        const colors = colorSchemes[state.colorScheme];
        const color = colors[this.colorIndex % colors.length];

        // Calculate alpha based on distance from center
        const dist = Math.sqrt(Math.pow(this.x - centerX, 2) + Math.pow(this.y - centerY, 2));
        const maxDist = Math.min(width, height) * 0.6;
        const distAlpha = Math.max(0.2, 1 - (dist / maxDist) * 0.5);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = this.alpha * distAlpha;
        ctx.fill();
    }
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    resize();
    createParticles();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);

    initHandTracking();
    animate();
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
}

function createParticles() {
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
        particles.push(new Particle(i));
    }
}

function onMouseMove(e) {
    state.handPosition.x = e.clientX;
    state.handPosition.y = e.clientY;
}

function onMouseDown(e) {
    triggerShockwave(e.clientX, e.clientY);
}

// ============================================
// EFFECTS
// ============================================
function triggerExplosion() {
    state.phase = 'exploding';
    state.targetExpansion = 1;

    // Trigger shockwave from center
    triggerShockwave(centerX, centerY, 20);

    setTimeout(() => {
        state.phase = 'expanded';
    }, 500);
}

function triggerContraction() {
    state.phase = 'contracted';
    state.targetExpansion = 0;

    setTimeout(() => {
        if (state.targetExpansion === 0) {
            state.phase = 'idle';
        }
    }, 1000);
}

function triggerShockwave(x, y, force = 15) {
    state.shockwave = {
        x: x,
        y: y,
        radius: 0,
        force: force,
        maxRadius: Math.max(width, height)
    };
}

function changeColors() {
    state.colorScheme = (state.colorScheme + 1) % colorSchemes.length;

    // Update particle colors
    particles.forEach(p => {
        p.colorIndex = Math.floor(Math.random() * colorSchemes[state.colorScheme].length);
    });
}

function toggleTimeDirection() {
    state.timeDirection *= -1;
}

// ============================================
// HAND TRACKING
// ============================================
let hands, handCamera;
const handCanvas = document.getElementById('handCanvas');
const handCtx = handCanvas.getContext('2d');
let gestureState = {
    lastGesture: 'none',
    colorChangeReady: true,
    shockwaveReady: true
};

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
    handCanvas.width = 200;
    handCanvas.height = 150;
    handCtx.clearRect(0, 0, 200, 150);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw hand
        drawHand(landmarks);

        // Update hand position (index finger tip)
        const indexTip = landmarks[8];
        state.handPosition.x = (1 - indexTip.x) * width;
        state.handPosition.y = indexTip.y * height;

        // Detect and apply gesture
        const gesture = detectGesture(landmarks);
        applyGesture(gesture);
    } else {
        document.getElementById('gestureStatus').textContent = 'Gesture: None';
        // Return to idle when no hand detected
        if (state.phase !== 'idle') {
            state.targetExpansion = 0.5;
            state.phase = 'idle';
        }
    }
}

function drawHand(landmarks) {
    handCtx.strokeStyle = '#ffd93d';
    handCtx.lineWidth = 2;
    handCtx.fillStyle = '#ffd93d';

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
        handCtx.moveTo(landmarks[i].x * 200, landmarks[i].y * 150);
        handCtx.lineTo(landmarks[j].x * 200, landmarks[j].y * 150);
        handCtx.stroke();
    });

    landmarks.forEach(p => {
        handCtx.beginPath();
        handCtx.arc(p.x * 200, p.y * 150, 3, 0, Math.PI * 2);
        handCtx.fill();
    });
}

function detectGesture(landmarks) {
    const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const bases = [landmarks[3], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];

    // Check if fingers are extended
    const fingersExtended = [
        tips[0].x < landmarks[3].x, // Thumb (horizontal check)
        tips[1].y < bases[1].y,     // Index
        tips[2].y < bases[2].y,     // Middle
        tips[3].y < bases[3].y,     // Ring
        tips[4].y < bases[4].y      // Pinky
    ];

    const extendedCount = fingersExtended.filter(Boolean).length;

    // Pinch detection
    const pinchDist = Math.hypot(tips[0].x - tips[1].x, tips[0].y - tips[1].y);

    // Gesture detection
    if (extendedCount >= 4) {
        return 'open_hand';
    } else if (extendedCount <= 1 && !fingersExtended[0]) {
        return 'fist';
    } else if (fingersExtended[1] && fingersExtended[2] && !fingersExtended[3] && !fingersExtended[4]) {
        return 'peace';
    } else if (fingersExtended[0] && !fingersExtended[1] && !fingersExtended[2] && !fingersExtended[3] && !fingersExtended[4]) {
        return 'thumbs_up';
    } else if (pinchDist < 0.06) {
        return 'pinch';
    }

    return 'unknown';
}

function applyGesture(gesture) {
    const statusEl = document.getElementById('gestureStatus');

    switch (gesture) {
        case 'fist':
            statusEl.textContent = 'Gesture: ✊ Contracting...';
            if (gestureState.lastGesture !== 'fist') {
                triggerContraction();
            }
            state.targetExpansion = 0;
            break;

        case 'open_hand':
            statusEl.textContent = 'Gesture: 🖐️ Exploding!';
            if (gestureState.lastGesture === 'fist') {
                // Transition from fist to open = BIG BANG!
                triggerExplosion();
            }
            state.targetExpansion = 1;
            break;

        case 'thumbs_up':
            statusEl.textContent = 'Gesture: 👍 Color Change';
            if (gestureState.colorChangeReady) {
                gestureState.colorChangeReady = false;
                changeColors();
                setTimeout(() => { gestureState.colorChangeReady = true; }, 500);
            }
            break;

        case 'peace':
            statusEl.textContent = 'Gesture: ✌️ Shockwave!';
            if (gestureState.shockwaveReady) {
                gestureState.shockwaveReady = false;
                triggerShockwave(state.handPosition.x, state.handPosition.y, 25);
                setTimeout(() => { gestureState.shockwaveReady = true; }, 300);
            }
            break;

        case 'pinch':
            statusEl.textContent = 'Gesture: 🤏 Reverse Time';
            state.timeDirection = -1;
            break;

        default:
            state.timeDirection = 1;
    }

    gestureState.lastGesture = gesture;
}

// ============================================
// ANIMATION
// ============================================
function animate() {
    // Trail effect
    ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.trailAlpha})`;
    ctx.fillRect(0, 0, width, height);

    // Smoothly interpolate expansion level
    state.expansionLevel += (state.targetExpansion - state.expansionLevel) * 0.03;

    // Update shockwave
    if (state.shockwave) {
        state.shockwave.radius += 20;
        state.shockwave.force *= 0.95;

        // Draw shockwave ring
        if (state.shockwave.radius < state.shockwave.maxRadius) {
            ctx.beginPath();
            ctx.arc(state.shockwave.x, state.shockwave.y, state.shockwave.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${state.shockwave.force / 20})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        } else {
            state.shockwave = null;
        }
    }

    // Draw central glow when contracted
    if (state.expansionLevel < 0.3) {
        const glowSize = 50 + (1 - state.expansionLevel) * 100;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowSize);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.4)');
        gradient.addColorStop(0.6, 'rgba(255, 100, 50, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

        ctx.beginPath();
        ctx.arc(centerX, centerY, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 1;
        ctx.fill();
    }

    // Update and draw particles
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    requestAnimationFrame(animate);
}

// ============================================
// START
// ============================================
init();
