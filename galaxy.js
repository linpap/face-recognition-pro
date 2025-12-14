// ============================================
// GALAXY PARTICLE SYSTEM
// Interactive particles that follow hand/mouse
// ============================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cursor = document.getElementById('cursor');

// Configuration
const CONFIG = {
    particleCount: 15000,
    baseSpeed: 0.5,
    mouseInfluence: 200,
    particleMinSize: 0.5,
    particleMaxSize: 3,
    trailLength: 0.15,
    colors: [
        '#8B5CF6', '#A78BFA', '#C4B5FD', // Purples
        '#6366F1', '#818CF8', '#A5B4FC', // Indigos
        '#3B82F6', '#60A5FA', '#93C5FD', // Blues
        '#EC4899', '#F472B6', '#F9A8D4', // Pinks
        '#FFFFFF', '#E0E7FF'              // Whites
    ]
};

// State
let width, height;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let particles = [];
let handTracking = false;

// ============================================
// PARTICLE CLASS
// ============================================
class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        // Start from center
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * Math.min(width, height) * 0.5;

        this.x = width / 2 + Math.cos(angle) * distance;
        this.y = height / 2 + Math.sin(angle) * distance;

        // Velocity pointing outward from center
        const speed = CONFIG.baseSpeed + Math.random() * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Properties
        this.size = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);
        this.color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        this.alpha = 0.3 + Math.random() * 0.7;
        this.life = 1;
        this.decay = 0.001 + Math.random() * 0.003;

        // For spiral effect
        this.angle = angle;
        this.orbitSpeed = (Math.random() - 0.5) * 0.02;
        this.orbitRadius = distance;
    }

    update() {
        // Calculate distance to mouse/hand
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Mouse/hand influence - particles are pushed away
        if (dist < CONFIG.mouseInfluence && dist > 0) {
            const force = (CONFIG.mouseInfluence - dist) / CONFIG.mouseInfluence;
            const angle = Math.atan2(dy, dx);

            // Push away from cursor
            this.vx -= Math.cos(angle) * force * 2;
            this.vy -= Math.sin(angle) * force * 2;

            // Add some swirl
            this.vx += Math.cos(angle + Math.PI / 2) * force * 0.5;
            this.vy += Math.sin(angle + Math.PI / 2) * force * 0.5;
        }

        // Gravity toward center (subtle)
        const centerDx = width / 2 - this.x;
        const centerDy = height / 2 - this.y;
        const centerDist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);

        if (centerDist > 50) {
            this.vx += (centerDx / centerDist) * 0.01;
            this.vy += (centerDy / centerDist) * 0.01;
        }

        // Apply velocity with damping
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Life decay
        this.life -= this.decay;

        // Reset if out of bounds or dead
        if (this.life <= 0 ||
            this.x < -50 || this.x > width + 50 ||
            this.y < -50 || this.y > height + 50) {
            this.reset();
        }
    }

    draw() {
        const alpha = this.alpha * this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
    }
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    resize();

    // Create particles
    for (let i = 0; i < CONFIG.particleCount; i++) {
        particles.push(new Particle());
    }

    // Event listeners
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);

    // Initialize hand tracking
    initHandTracking();

    // Start animation
    animate();
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    // Reset mouse to center
    mouseX = targetX = width / 2;
    mouseY = targetY = height / 2;
}

function onMouseMove(e) {
    if (!handTracking) {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
    }
}

function onTouchMove(e) {
    if (!handTracking && e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
    }
}

// ============================================
// HAND TRACKING
// ============================================
let hands;
let handCamera;
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
        document.getElementById('info').textContent = 'Hand tracking active - move your hand!';
    } catch (err) {
        console.log('Camera not available, using mouse');
        document.getElementById('info').textContent = 'Move your mouse to control particles';
    }
}

function onHandResults(results) {
    // Draw hand skeleton
    handCanvas.width = 200;
    handCanvas.height = 150;
    handCtx.clearRect(0, 0, 200, 150);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handTracking = true;
        const landmarks = results.multiHandLandmarks[0];

        // Draw connections
        handCtx.strokeStyle = '#00ff88';
        handCtx.lineWidth = 2;

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

        // Draw points
        handCtx.fillStyle = '#00ff88';
        landmarks.forEach(p => {
            handCtx.beginPath();
            handCtx.arc(p.x * 200, p.y * 150, 3, 0, Math.PI * 2);
            handCtx.fill();
        });

        // Use index finger tip for control (landmark 8)
        const indexTip = landmarks[8];

        // Convert to screen coordinates (mirror because webcam is mirrored)
        mouseX = (1 - indexTip.x) * width;
        mouseY = indexTip.y * height;

        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
    } else {
        handTracking = false;
    }
}

// ============================================
// ANIMATION
// ============================================
function animate() {
    // Semi-transparent black for trails
    ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.trailLength})`;
    ctx.fillRect(0, 0, width, height);

    // Smooth mouse following
    targetX += (mouseX - targetX) * 0.1;
    targetY += (mouseY - targetY) * 0.1;

    // Update and draw particles
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Draw glow at cursor position
    drawCursorGlow();

    requestAnimationFrame(animate);
}

function drawCursorGlow() {
    const gradient = ctx.createRadialGradient(
        targetX, targetY, 0,
        targetX, targetY, 100
    );
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.1)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 100, 0, Math.PI * 2);
    ctx.fill();
}

// ============================================
// START
// ============================================
init();
