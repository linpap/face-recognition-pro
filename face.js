// ============================================
// FACE RECOGNITION PRO - Complete Suite
// ============================================

const video = document.getElementById('webcam');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const photoCanvas = document.getElementById('photoCanvas');
const photoCtx = photoCanvas.getContext('2d');

// Status elements
const cameraStatus = document.getElementById('cameraStatus');
const modelStatus = document.getElementById('modelStatus');
const faceStatus = document.getElementById('faceStatus');
const multiStatus = document.getElementById('multiStatus');
const loadingEl = document.getElementById('loading');

// Info elements
const greetingBox = document.getElementById('greetingBox');
const greetingText = document.getElementById('greetingText');
const ageInfo = document.getElementById('ageInfo');
const moodInfo = document.getElementById('moodInfo');
const ageValue = document.getElementById('ageValue');
const expressionValue = document.getElementById('expressionValue');
const genderValue = document.getElementById('genderValue');
const faceCountValue = document.getElementById('faceCountValue');
const knownFacesCount = document.getElementById('knownFacesCount');
const accessoriesBadges = document.getElementById('accessoriesBadges');

// Head pose & blink elements
const headIndicator = document.getElementById('headIndicator');
const headPoseText = document.getElementById('headPoseText');
const leftEye = document.getElementById('leftEye');
const rightEye = document.getElementById('rightEye');
const blinkCountEl = document.getElementById('blinkCount');

// Liveness
const livenessBadge = document.getElementById('livenessBadge');
const livenessText = document.getElementById('livenessText');

// Stats elements
const totalVisitsEl = document.getElementById('totalVisits');
const todayVisitsEl = document.getElementById('todayVisits');
const uniqueVisitorsEl = document.getElementById('uniqueVisitors');
const attendanceLog = document.getElementById('attendanceLog');

// Modal elements
const registrationModal = document.getElementById('registrationModal');
const capturedPhoto = document.getElementById('capturedPhoto');
const nameInput = document.getElementById('nameInput');
const registerBtn = document.getElementById('registerBtn');
const saveNameBtn = document.getElementById('saveNameBtn');
const cancelBtn = document.getElementById('cancelBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const usersList = document.getElementById('usersList');

// Toggle elements
const voiceToggle = document.getElementById('voiceToggle');
const livenessToggle = document.getElementById('livenessToggle');
const attendanceToggle = document.getElementById('attendanceToggle');

// State
let modelsLoaded = false;
let currentFaceDescriptor = null;
let knownFaces = []; // { name, descriptor, photo, timestamp }
let attendanceRecords = []; // { name, timestamp }
let lastRecognizedName = null;
let lastGreetedName = null;
let lastGreetTime = 0;

// Settings
let settings = {
    voiceEnabled: true,
    livenessEnabled: true,
    attendanceEnabled: true
};

// Age smoothing
let ageSamples = [];
const AGE_SAMPLE_SIZE = 30;
let stableAgeRange = null;

// Blink detection
let blinkCount = 0;
let lastEyeState = { left: true, right: true }; // true = open
let blinkHistory = [];
const BLINK_THRESHOLD = 0.25;

// Liveness detection
let livenessScore = 0;
let movementHistory = [];
let lastFacePosition = null;

// Wellness indicators
let wellnessSamples = {
    skinTone: [],
    darkCircles: [],
    lipColor: [],
    fatigue: [],
    hydration: [],
    stress: [],
    sleep: [],
    sunExposure: []
};
const WELLNESS_SAMPLE_SIZE = 20;

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    loadKnownFaces();
    loadAttendance();
    loadSettings();
    updateKnownFacesCount();
    updateUsersList();
    updateStats();
    updateAttendanceLog();

    await loadModels();
    await startCamera();
    startDetection();
    setupEventListeners();
}

async function loadModels() {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;
        modelStatus.classList.add('active');
    } catch (error) {
        console.error('Model loading error:', error);
        alert('Failed to load AI models. Please refresh.');
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;
                cameraStatus.classList.add('active');
                loadingEl.classList.add('hidden');
                resolve();
            };
        });
    } catch (error) {
        loadingEl.innerHTML = `<p style="color:#ff6b6b;">Camera access denied. Please allow camera.</p>`;
    }
}

// ============================================
// FACE DETECTION
// ============================================
async function startDetection() {
    if (!modelsLoaded) return;

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

    setInterval(async () => {
        const detections = await faceapi
            .detectAllFaces(video, options)
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withFaceExpressions()
            .withAgeAndGender();

        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // Update face count
        faceCountValue.textContent = detections.length;
        multiStatus.classList.toggle('active', detections.length > 1);

        if (detections.length > 0) {
            faceStatus.classList.add('active');

            // Process each face
            detections.forEach((detection, index) => {
                processFace(detection, index === 0);
            });
        } else {
            faceStatus.classList.remove('active');
            resetDisplay();
        }
    }, 150);
}

function processFace(detection, isPrimary) {
    const { age, gender, genderProbability, expressions } = detection;
    const landmarks = detection.landmarks;
    const descriptor = detection.descriptor;

    // Draw face box
    drawFaceBox(detection, isPrimary);

    if (isPrimary) {
        currentFaceDescriptor = descriptor;

        // Age estimation with smoothing
        updateAge(age);

        // Gender
        genderValue.textContent = `${gender} (${Math.round(genderProbability * 100)}%)`;

        // Expression
        const dominantExp = getDominantExpression(expressions);
        expressionValue.textContent = getExpressionEmoji(dominantExp);
        updateExpressionBars(expressions);

        // Head pose estimation
        updateHeadPose(landmarks);

        // Blink detection
        updateBlinkDetection(landmarks);

        // Liveness check
        if (settings.livenessEnabled) {
            updateLiveness(detection);
        }

        // Accessories detection (glasses)
        detectAccessories(landmarks);

        // Wellness analysis
        analyzeWellness(detection, landmarks);

        // Face recognition
        const recognizedName = recognizeFace(descriptor);
        const displayAge = stableAgeRange || `~${Math.round(age)} years`;

        if (recognizedName) {
            showGreeting(recognizedName, displayAge, dominantExp);

            // Auto attendance
            if (settings.attendanceEnabled) {
                recordAttendance(recognizedName);
            }
        } else {
            showNewUserPrompt(displayAge, dominantExp);
        }
    }
}

function drawFaceBox(detection, isPrimary) {
    const box = detection.detection.box;
    const x = overlay.width - box.x - box.width;

    ctx.strokeStyle = isPrimary ? '#4ecdc4' : '#667eea';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, box.y, box.width, box.height);

    // Draw name label if recognized
    const name = recognizeFace(detection.descriptor);
    if (name) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x, box.y - 25, box.width, 25);

        // Save context, flip horizontally to counter the CSS transform, then draw text
        ctx.save();
        ctx.scale(-1, 1);
        ctx.fillStyle = '#4ecdc4';
        ctx.font = '14px sans-serif';
        // When flipped, x becomes negative and we draw from the right
        ctx.fillText(name, -(x + box.width - 5), box.y - 8);
        ctx.restore();
    }
}

// ============================================
// AGE ESTIMATION
// ============================================
function updateAge(age) {
    const roundedAge = Math.round(age);
    ageSamples.push(roundedAge);

    if (ageSamples.length > AGE_SAMPLE_SIZE) {
        ageSamples.shift();
    }

    if (ageSamples.length >= 10) {
        const sorted = [...ageSamples].sort((a, b) => a - b);
        const trimStart = Math.floor(sorted.length * 0.1);
        const trimEnd = Math.ceil(sorted.length * 0.9);
        const trimmed = sorted.slice(trimStart, trimEnd);

        const minAge = Math.min(...trimmed);
        const maxAge = Math.max(...trimmed);

        if (maxAge - minAge <= 2) {
            const avg = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
            stableAgeRange = `~${avg} yrs`;
        } else {
            stableAgeRange = `${minAge}-${maxAge} yrs`;
        }
        ageValue.textContent = stableAgeRange;
    } else {
        ageValue.textContent = `Scanning...`;
    }
}

// ============================================
// HEAD POSE ESTIMATION
// ============================================
function updateHeadPose(landmarks) {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Calculate head orientation based on nose and eye positions
    const noseTip = nose[3];
    const eyeCenter = {
        x: (leftEye[0].x + rightEye[3].x) / 2,
        y: (leftEye[0].y + rightEye[3].y) / 2
    };

    // Horizontal offset (yaw)
    const yaw = (noseTip.x - eyeCenter.x) / 30;
    // Vertical offset (pitch)
    const pitch = (noseTip.y - eyeCenter.y - 20) / 30;

    // Clamp values
    const clampedYaw = Math.max(-1, Math.min(1, yaw));
    const clampedPitch = Math.max(-1, Math.min(1, pitch));

    // Update indicator position
    const offsetX = clampedYaw * 25;
    const offsetY = clampedPitch * 25;
    headIndicator.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

    // Update text
    let direction = 'Center';
    if (Math.abs(clampedYaw) > 0.3 || Math.abs(clampedPitch) > 0.3) {
        const h = clampedYaw < -0.3 ? 'Right' : clampedYaw > 0.3 ? 'Left' : '';
        const v = clampedPitch < -0.3 ? 'Up' : clampedPitch > 0.3 ? 'Down' : '';
        direction = `${v} ${h}`.trim() || 'Center';
    }
    headPoseText.textContent = direction;
}

// ============================================
// BLINK DETECTION
// ============================================
function updateBlinkDetection(landmarks) {
    const leftEyePts = landmarks.getLeftEye();
    const rightEyePts = landmarks.getRightEye();

    // Calculate eye aspect ratio (EAR)
    const leftEAR = calculateEAR(leftEyePts);
    const rightEAR = calculateEAR(rightEyePts);

    const leftOpen = leftEAR > BLINK_THRESHOLD;
    const rightOpen = rightEAR > BLINK_THRESHOLD;

    // Update eye visualization
    leftEye.classList.toggle('closed', !leftOpen);
    rightEye.classList.toggle('closed', !rightOpen);

    // Detect blink (both eyes close and reopen)
    if (!leftOpen && !rightOpen && lastEyeState.left && lastEyeState.right) {
        // Eyes just closed
    } else if (leftOpen && rightOpen && !lastEyeState.left && !lastEyeState.right) {
        // Eyes just reopened - count as blink
        blinkCount++;
        blinkCountEl.textContent = blinkCount;
        blinkHistory.push(Date.now());

        // Keep only recent blinks for liveness
        blinkHistory = blinkHistory.filter(t => Date.now() - t < 10000);
    }

    lastEyeState = { left: leftOpen, right: rightOpen };
}

function calculateEAR(eyePoints) {
    // Eye Aspect Ratio formula
    const v1 = distance(eyePoints[1], eyePoints[5]);
    const v2 = distance(eyePoints[2], eyePoints[4]);
    const h = distance(eyePoints[0], eyePoints[3]);
    return (v1 + v2) / (2 * h);
}

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// ============================================
// LIVENESS DETECTION
// ============================================
function updateLiveness(detection) {
    const box = detection.detection.box;
    const currentPos = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    // Check for movement
    if (lastFacePosition) {
        const movement = distance(currentPos, lastFacePosition);
        movementHistory.push(movement);
        if (movementHistory.length > 30) movementHistory.shift();
    }
    lastFacePosition = currentPos;

    // Calculate liveness score
    const avgMovement = movementHistory.length > 0
        ? movementHistory.reduce((a, b) => a + b, 0) / movementHistory.length
        : 0;
    const recentBlinks = blinkHistory.filter(t => Date.now() - t < 10000).length;

    // Score based on natural movement and blinking
    const movementScore = Math.min(avgMovement / 2, 1) * 50;
    const blinkScore = Math.min(recentBlinks / 3, 1) * 50;
    livenessScore = movementScore + blinkScore;

    // Update badge
    livenessBadge.style.display = 'block';
    if (livenessScore > 40) {
        livenessBadge.className = 'liveness-badge real';
        livenessText.textContent = '✓ Real Person';
    } else if (livenessScore > 20) {
        livenessBadge.className = 'liveness-badge';
        livenessBadge.style.background = 'rgba(255,193,7,0.3)';
        livenessBadge.style.color = '#ffc107';
        livenessBadge.style.border = '1px solid rgba(255,193,7,0.5)';
        livenessText.textContent = '? Checking...';
    } else {
        livenessBadge.className = 'liveness-badge fake';
        livenessText.textContent = '⚠ Move/Blink';
    }
}

// ============================================
// ACCESSORIES DETECTION
// ============================================
function detectAccessories(landmarks) {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();

    // Simple glasses detection based on eye region brightness variation
    // This is a simplified heuristic - real detection would use a trained model
    const eyeWidth = distance(leftEye[0], leftEye[3]);
    const noseWidth = distance(nose[0], nose[4]);

    const badges = [];

    // Estimate glasses based on proportions (simplified)
    // In real app, you'd use a separate model for this
    if (eyeWidth > noseWidth * 0.8) {
        badges.push('👓 Possible Glasses');
    }

    accessoriesBadges.innerHTML = badges.map(b =>
        `<span class="accessory-badge">${b}</span>`
    ).join('');
}

// ============================================
// WELLNESS ANALYSIS
// ============================================
function analyzeWellness(detection, landmarks) {
    const box = detection.detection.box;

    // Create a temporary canvas to analyze pixel data
    const analysisCanvas = document.createElement('canvas');
    const analysisCtx = analysisCanvas.getContext('2d');
    analysisCanvas.width = video.videoWidth;
    analysisCanvas.height = video.videoHeight;
    analysisCtx.drawImage(video, 0, 0);

    // Get facial regions for analysis
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const mouth = landmarks.getMouth();
    const jawOutline = landmarks.getJawOutline();

    // Analyze different areas
    const skinAnalysis = analyzeSkinTone(analysisCtx, jawOutline, nose);
    const circlesAnalysis = analyzeDarkCircles(analysisCtx, leftEye, rightEye);
    const lipAnalysis = analyzeLipColor(analysisCtx, mouth);
    const fatigueAnalysis = analyzeFatigue(leftEye, rightEye, detection.expressions);
    const hydrationAnalysis = analyzeHydration(skinAnalysis, lipAnalysis);
    const stressAnalysis = analyzeStress(detection.expressions, fatigueAnalysis);
    const sleepAnalysis = analyzeSleepQuality(circlesAnalysis, fatigueAnalysis);
    const sunAnalysis = analyzeSunExposure(skinAnalysis, circlesAnalysis, fatigueAnalysis);

    // Add to samples for smoothing
    addWellnessSample('skinTone', skinAnalysis);
    addWellnessSample('darkCircles', circlesAnalysis);
    addWellnessSample('lipColor', lipAnalysis);
    addWellnessSample('fatigue', fatigueAnalysis);
    addWellnessSample('hydration', hydrationAnalysis);
    addWellnessSample('stress', stressAnalysis);
    addWellnessSample('sleep', sleepAnalysis);
    addWellnessSample('sunExposure', sunAnalysis);

    // Update UI with smoothed values
    updateWellnessUI();
}

function addWellnessSample(key, value) {
    wellnessSamples[key].push(value);
    if (wellnessSamples[key].length > WELLNESS_SAMPLE_SIZE) {
        wellnessSamples[key].shift();
    }
}

function getSmoothedWellness(key) {
    const samples = wellnessSamples[key];
    if (samples.length < 5) return null;

    const sorted = [...samples].sort((a, b) => a.score - b.score);
    const trimStart = Math.floor(sorted.length * 0.2);
    const trimEnd = Math.ceil(sorted.length * 0.8);
    const trimmed = sorted.slice(trimStart, trimEnd);

    const avgScore = trimmed.reduce((a, b) => a + b.score, 0) / trimmed.length;
    // Use most recent label for better responsiveness
    const label = samples[samples.length - 1].label;
    const status = samples[samples.length - 1].status;

    return { score: avgScore, label, status };
}

function analyzeSkinTone(ctx, jawOutline, nose) {
    // Sample skin from cheek area (between jaw and nose)
    const cheekLeft = {
        x: Math.round((jawOutline[2].x + nose[0].x) / 2),
        y: Math.round((jawOutline[2].y + nose[0].y) / 2)
    };

    // Get pixel data from cheek region
    const sampleSize = 15;
    let r = 0, g = 0, b = 0, count = 0;

    try {
        const imageData = ctx.getImageData(
            cheekLeft.x - sampleSize/2,
            cheekLeft.y - sampleSize/2,
            sampleSize,
            sampleSize
        );

        for (let i = 0; i < imageData.data.length; i += 4) {
            r += imageData.data[i];
            g += imageData.data[i + 1];
            b += imageData.data[i + 2];
            count++;
        }

        r = r / count;
        g = g / count;
        b = b / count;
    } catch (e) {
        // Fallback values
        r = 180; g = 140; b = 120;
    }

    // Calculate skin health indicators
    const brightness = (r + g + b) / 3;
    const redness = r - ((g + b) / 2);
    const yellowness = (r + g) / 2 - b;

    // Score based on balanced skin tone (less extreme values = healthier)
    let score = 70;
    let label = "Normal";
    let status = "good";

    if (brightness < 80) {
        score = 40;
        label = "Dull";
        status = "concern";
    } else if (brightness > 200) {
        score = 60;
        label = "Pale";
        status = "moderate";
    } else if (redness > 40) {
        score = 55;
        label = "Reddish";
        status = "moderate";
    } else if (yellowness > 50) {
        score = 50;
        label = "Yellowish";
        status = "moderate";
    } else if (brightness > 120 && brightness < 180 && redness < 30) {
        score = 85;
        label = "Healthy";
        status = "good";
    }

    return { score, label, status, r, g, b, brightness };
}

function analyzeDarkCircles(ctx, leftEye, rightEye) {
    // Sample under-eye area
    const sampleSize = 10;
    let darkScore = 0;

    try {
        // Left under-eye
        const leftUnder = {
            x: Math.round((leftEye[0].x + leftEye[3].x) / 2),
            y: Math.round(leftEye[4].y + 10)
        };

        const leftData = ctx.getImageData(
            leftUnder.x - sampleSize/2,
            leftUnder.y - sampleSize/2,
            sampleSize,
            sampleSize
        );

        // Calculate average darkness
        let leftBrightness = 0;
        for (let i = 0; i < leftData.data.length; i += 4) {
            leftBrightness += (leftData.data[i] + leftData.data[i+1] + leftData.data[i+2]) / 3;
        }
        leftBrightness /= (leftData.data.length / 4);

        // Right under-eye
        const rightUnder = {
            x: Math.round((rightEye[0].x + rightEye[3].x) / 2),
            y: Math.round(rightEye[4].y + 10)
        };

        const rightData = ctx.getImageData(
            rightUnder.x - sampleSize/2,
            rightUnder.y - sampleSize/2,
            sampleSize,
            sampleSize
        );

        let rightBrightness = 0;
        for (let i = 0; i < rightData.data.length; i += 4) {
            rightBrightness += (rightData.data[i] + rightData.data[i+1] + rightData.data[i+2]) / 3;
        }
        rightBrightness /= (rightData.data.length / 4);

        // Lower brightness = darker circles
        const avgBrightness = (leftBrightness + rightBrightness) / 2;
        darkScore = Math.max(0, 100 - avgBrightness);
    } catch (e) {
        darkScore = 30;
    }

    let score, label, status;

    if (darkScore < 30) {
        score = 85;
        label = "Minimal";
        status = "good";
    } else if (darkScore < 50) {
        score = 65;
        label = "Light";
        status = "good";
    } else if (darkScore < 70) {
        score = 45;
        label = "Moderate";
        status = "moderate";
    } else {
        score = 25;
        label = "Visible";
        status = "concern";
    }

    return { score, label, status };
}

function analyzeLipColor(ctx, mouth) {
    const sampleSize = 8;
    let r = 0, g = 0, b = 0, count = 0;

    try {
        // Sample center of lips
        const lipCenter = {
            x: Math.round((mouth[0].x + mouth[6].x) / 2),
            y: Math.round((mouth[2].y + mouth[10].y) / 2)
        };

        const imageData = ctx.getImageData(
            lipCenter.x - sampleSize/2,
            lipCenter.y - sampleSize/2,
            sampleSize,
            sampleSize
        );

        for (let i = 0; i < imageData.data.length; i += 4) {
            r += imageData.data[i];
            g += imageData.data[i + 1];
            b += imageData.data[i + 2];
            count++;
        }

        r = r / count;
        g = g / count;
        b = b / count;
    } catch (e) {
        r = 180; g = 100; b = 100;
    }

    // Healthy lips should have a pinkish-red tint
    const redness = r - g;
    const brightness = (r + g + b) / 3;

    let score, label, status;

    if (redness > 40 && brightness > 100 && brightness < 200) {
        score = 85;
        label = "Healthy Pink";
        status = "good";
    } else if (redness > 20 && brightness > 80) {
        score = 70;
        label = "Normal";
        status = "good";
    } else if (brightness < 80 || redness < 10) {
        score = 40;
        label = "Pale";
        status = "concern";
    } else if (r > 200) {
        score = 55;
        label = "Very Red";
        status = "moderate";
    } else {
        score = 60;
        label = "Fair";
        status = "moderate";
    }

    return { score, label, status };
}

function analyzeFatigue(leftEye, rightEye, expressions) {
    // Calculate eye openness
    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;

    // Lower EAR indicates more closed/tired eyes
    const eyeOpenness = avgEAR / 0.35; // 0.35 is typical fully open EAR

    // Check expressions for fatigue indicators
    const neutralLevel = expressions.neutral || 0;
    const sadLevel = expressions.sad || 0;

    // Combine factors
    let fatigueLevel = 0;
    fatigueLevel += (1 - Math.min(eyeOpenness, 1)) * 50; // Eyes more closed = more fatigue
    fatigueLevel += neutralLevel * 20; // High neutral can indicate tiredness
    fatigueLevel += sadLevel * 30; // Sadness correlates with fatigue

    let score, label, status;

    if (fatigueLevel < 25) {
        score = 90;
        label = "Alert";
        status = "good";
    } else if (fatigueLevel < 45) {
        score = 70;
        label = "Mild";
        status = "good";
    } else if (fatigueLevel < 65) {
        score = 50;
        label = "Moderate";
        status = "moderate";
    } else {
        score = 30;
        label = "High";
        status = "concern";
    }

    return { score, label, status, fatigueLevel };
}

function analyzeHydration(skinAnalysis, lipAnalysis) {
    // Hydration estimated from skin brightness and lip color
    const skinBrightness = skinAnalysis.brightness || 130;
    const lipScore = lipAnalysis.score || 60;

    // Dehydration can cause dull skin and pale lips
    let hydrationScore = 0;
    hydrationScore += (skinBrightness / 180) * 50;
    hydrationScore += (lipScore / 100) * 50;

    let score, label, status;

    if (hydrationScore > 75) {
        score = 85;
        label = "Well Hydrated";
        status = "good";
    } else if (hydrationScore > 55) {
        score = 65;
        label = "Adequate";
        status = "good";
    } else if (hydrationScore > 40) {
        score = 45;
        label = "Low";
        status = "moderate";
    } else {
        score = 30;
        label = "Dehydrated";
        status = "concern";
    }

    return { score, label, status };
}

function analyzeStress(expressions, fatigueAnalysis) {
    // Stress indicators from expressions
    const angry = expressions.angry || 0;
    const fearful = expressions.fearful || 0;
    const surprised = expressions.surprised || 0;
    const neutral = expressions.neutral || 0;
    const happy = expressions.happy || 0;

    let stressLevel = 0;
    stressLevel += angry * 40;
    stressLevel += fearful * 35;
    stressLevel += surprised * 15;
    stressLevel += (fatigueAnalysis.fatigueLevel || 0) * 0.3;
    stressLevel -= happy * 30;
    stressLevel = Math.max(0, Math.min(100, stressLevel));

    let score, label, status;

    if (stressLevel < 20) {
        score = 90;
        label = "Relaxed";
        status = "good";
    } else if (stressLevel < 40) {
        score = 70;
        label = "Calm";
        status = "good";
    } else if (stressLevel < 60) {
        score = 50;
        label = "Moderate";
        status = "moderate";
    } else {
        score = 30;
        label = "Elevated";
        status = "concern";
    }

    return { score, label, status };
}

function analyzeSleepQuality(circlesAnalysis, fatigueAnalysis) {
    // Sleep quality estimated from dark circles and fatigue
    const circleScore = circlesAnalysis.score || 50;
    const fatigueScore = fatigueAnalysis.score || 50;

    const sleepScore = (circleScore * 0.5) + (fatigueScore * 0.5);

    let score, label, status;

    if (sleepScore > 75) {
        score = 85;
        label = "Well Rested";
        status = "good";
    } else if (sleepScore > 55) {
        score = 65;
        label = "Adequate";
        status = "good";
    } else if (sleepScore > 40) {
        score = 45;
        label = "Fair";
        status = "moderate";
    } else {
        score = 25;
        label = "Poor";
        status = "concern";
    }

    return { score, label, status };
}

function analyzeSunExposure(skinAnalysis, circlesAnalysis, fatigueAnalysis) {
    // Sun exposure / Vitamin D estimate
    // This is a VERY rough estimate based on indirect indicators:
    // - Dark circles can indicate Vit D deficiency
    // - Fatigue is a common symptom of low Vit D
    // - Pale skin (relative to baseline) might suggest less outdoor time
    // NOTE: Cannot determine actual sun exposure or Vit D from camera alone

    const circleScore = circlesAnalysis?.score || 50;
    const fatigueScore = fatigueAnalysis?.score || 50;

    // Lower scores in these areas might correlate with less sun/outdoor activity
    // This is an indirect lifestyle estimate, NOT a skin color judgment
    let indoorIndicator = 0;

    // Visible dark circles often correlate with indoor lifestyle
    if (circleScore < 50) indoorIndicator += 30;
    else if (circleScore < 70) indoorIndicator += 15;

    // High fatigue can correlate with Vit D deficiency / less outdoor activity
    if (fatigueScore < 50) indoorIndicator += 30;
    else if (fatigueScore < 70) indoorIndicator += 15;

    // Estimate outdoor/sun exposure level (inverse of indoor indicators)
    const exposureEstimate = Math.max(20, 80 - indoorIndicator);

    let score, label, status;

    if (exposureEstimate < 40) {
        score = 35;
        label = "Low (Get Sun!)";
        status = "concern";
    } else if (exposureEstimate < 60) {
        score = 55;
        label = "Moderate";
        status = "moderate";
    } else {
        score = 80;
        label = "Adequate";
        status = "good";
    }

    return { score, label, status };
}

function updateWellnessUI() {
    const indicators = [
        { key: 'skinTone', elemId: 'wellnessSkin', valueId: 'skinValue', barId: 'skinBar' },
        { key: 'darkCircles', elemId: 'wellnessCircles', valueId: 'circlesValue', barId: 'circlesBar' },
        { key: 'lipColor', elemId: 'wellnessLips', valueId: 'lipsValue', barId: 'lipsBar' },
        { key: 'fatigue', elemId: 'wellnessFatigue', valueId: 'fatigueValue', barId: 'fatigueBar' },
        { key: 'hydration', elemId: 'wellnessHydration', valueId: 'hydrationValue', barId: 'hydrationBar' },
        { key: 'stress', elemId: 'wellnessStress', valueId: 'stressValue', barId: 'stressBar' },
        { key: 'sleep', elemId: 'wellnessSleep', valueId: 'sleepValue', barId: 'sleepBar' },
        { key: 'sunExposure', elemId: 'wellnessSun', valueId: 'sunValue', barId: 'sunBar' }
    ];

    let totalScore = 0;
    let validIndicators = 0;

    indicators.forEach(({ key, elemId, valueId, barId }) => {
        const data = getSmoothedWellness(key);
        if (data) {
            const elem = document.getElementById(elemId);
            const valueElem = document.getElementById(valueId);
            const barElem = document.getElementById(barId);

            if (elem && valueElem && barElem) {
                elem.className = `wellness-item ${data.status}`;
                valueElem.textContent = data.label;
                barElem.style.width = `${data.score}%`;

                totalScore += data.score;
                validIndicators++;
            }
        }
    });

    // Update overall score
    if (validIndicators > 0) {
        const avgScore = Math.round(totalScore / validIndicators);
        const scoreElem = document.getElementById('wellnessScore');
        const statusElem = document.getElementById('wellnessStatus');

        if (scoreElem && statusElem) {
            scoreElem.textContent = `${avgScore}/100`;

            if (avgScore >= 75) {
                statusElem.textContent = "Looking great! Keep it up! ✨";
                statusElem.style.color = '#4ecdc4';
            } else if (avgScore >= 55) {
                statusElem.textContent = "Looking good overall 👍";
                statusElem.style.color = '#ffd93d';
            } else {
                statusElem.textContent = "Consider rest & hydration 💙";
                statusElem.style.color = '#ff6b6b';
            }
        }
    }
}

function resetWellnessIndicators() {
    wellnessSamples = {
        skinTone: [],
        darkCircles: [],
        lipColor: [],
        fatigue: [],
        hydration: [],
        stress: [],
        sleep: [],
        sunExposure: []
    };

    const valueIds = ['skinValue', 'circlesValue', 'lipsValue', 'fatigueValue',
                      'hydrationValue', 'stressValue', 'sleepValue', 'sunValue'];
    const barIds = ['skinBar', 'circlesBar', 'lipsBar', 'fatigueBar',
                    'hydrationBar', 'stressBar', 'sleepBar', 'sunBar'];
    const elemIds = ['wellnessSkin', 'wellnessCircles', 'wellnessLips', 'wellnessFatigue',
                     'wellnessHydration', 'wellnessStress', 'wellnessSleep', 'wellnessSun'];

    valueIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Analyzing...';
    });

    barIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.width = '0%';
    });

    elemIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = 'wellness-item';
    });

    const scoreEl = document.getElementById('wellnessScore');
    const statusEl = document.getElementById('wellnessStatus');
    if (scoreEl) scoreEl.textContent = '--';
    if (statusEl) {
        statusEl.textContent = 'Analyzing facial features...';
        statusEl.style.color = '';
    }
}

// ============================================
// EXPRESSION ANALYSIS
// ============================================
function getDominantExpression(expressions) {
    let max = 0, dominant = 'neutral';
    for (const [exp, val] of Object.entries(expressions)) {
        if (val > max) { max = val; dominant = exp; }
    }
    return dominant;
}

function getExpressionEmoji(exp) {
    const map = {
        neutral: '😐', happy: '😊', sad: '😢', angry: '😠',
        fearful: '😨', disgusted: '🤢', surprised: '😲'
    };
    return map[exp] || '😐';
}

function updateExpressionBars(expressions) {
    const bars = {
        happy: ['barHappy', 'pctHappy'],
        sad: ['barSad', 'pctSad'],
        angry: ['barAngry', 'pctAngry'],
        surprised: ['barSurprised', 'pctSurprised'],
        neutral: ['barNeutral', 'pctNeutral']
    };

    for (const [exp, [barId, pctId]] of Object.entries(bars)) {
        const val = Math.round((expressions[exp] || 0) * 100);
        document.getElementById(barId).style.width = val + '%';
        document.getElementById(pctId).textContent = val + '%';
    }
}

function getExpressionMessage(exp) {
    const msgs = {
        neutral: "Looking calm!", happy: "Love that smile! 😄",
        sad: "Hope you feel better! 💙", angry: "Take a breath! 🧘",
        fearful: "It's okay!", disgusted: "Something wrong?", surprised: "Wow! 😮"
    };
    return msgs[exp] || "";
}

// ============================================
// FACE RECOGNITION
// ============================================
function recognizeFace(descriptor) {
    if (!knownFaces.length) return null;

    let bestMatch = null, bestDist = 0.55;
    for (const face of knownFaces) {
        const dist = faceapi.euclideanDistance(descriptor, face.descriptor);
        if (dist < bestDist) { bestDist = dist; bestMatch = face.name; }
    }
    return bestMatch;
}

// ============================================
// GREETING & VOICE
// ============================================
function showGreeting(name, ageDisplay, expression) {
    greetingBox.style.display = 'block';

    const greetings = [
        `Hello ${name}! 👋`, `Welcome back, ${name}! 🎉`,
        `Hey ${name}! 😊`, `Hi ${name}! 👋`
    ];

    if (lastRecognizedName !== name) {
        greetingText.textContent = greetings[Math.floor(Math.random() * greetings.length)];
        lastRecognizedName = name;

        // Voice greeting (with cooldown)
        if (settings.voiceEnabled && (Date.now() - lastGreetTime > 10000 || lastGreetedName !== name)) {
            speak(`Hello ${name}! Welcome back!`);
            lastGreetedName = name;
            lastGreetTime = Date.now();
        }
    }

    ageInfo.textContent = `You look around ${ageDisplay}`;
    moodInfo.textContent = getExpressionMessage(expression);
}

function showNewUserPrompt(ageDisplay, expression) {
    greetingBox.style.display = 'block';
    greetingText.textContent = "🤔 I don't recognize you...";
    ageInfo.textContent = `You look around ${ageDisplay}`;
    moodInfo.textContent = "Click 'Register Face' to save!";
    lastRecognizedName = null;
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }
}

// ============================================
// ATTENDANCE SYSTEM
// ============================================
function recordAttendance(name) {
    const now = Date.now();
    const lastRecord = attendanceRecords.find(r => r.name === name);

    // Only record if more than 5 minutes since last record for same person
    if (!lastRecord || now - lastRecord.timestamp > 5 * 60 * 1000) {
        attendanceRecords.unshift({ name, timestamp: now });
        if (attendanceRecords.length > 100) attendanceRecords.pop();
        saveAttendance();
        updateAttendanceLog();
        updateStats();
    }
}

function updateAttendanceLog() {
    if (!attendanceRecords.length) {
        attendanceLog.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">No records</p>';
        return;
    }

    attendanceLog.innerHTML = attendanceRecords.slice(0, 10).map(r => {
        const time = new Date(r.timestamp);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = time.toLocaleDateString();
        return `<div class="attendance-item">
            <span class="name">${r.name}</span>
            <span class="time">${timeStr} - ${dateStr}</span>
        </div>`;
    }).join('');
}

function updateStats() {
    const total = attendanceRecords.length;
    const today = new Date().toDateString();
    const todayCount = attendanceRecords.filter(r =>
        new Date(r.timestamp).toDateString() === today
    ).length;
    const unique = new Set(attendanceRecords.map(r => r.name)).size;

    totalVisitsEl.textContent = total;
    todayVisitsEl.textContent = todayCount;
    uniqueVisitorsEl.textContent = unique;
}

// ============================================
// PHOTO CAPTURE
// ============================================
function capturePhoto() {
    photoCanvas.width = 200;
    photoCanvas.height = 200;

    // Calculate crop area (center square)
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    // Draw mirrored
    photoCtx.save();
    photoCtx.scale(-1, 1);
    photoCtx.drawImage(video, sx, sy, size, size, -200, 0, 200, 200);
    photoCtx.restore();

    return photoCanvas.toDataURL('image/jpeg', 0.8);
}

// ============================================
// FACE REGISTRATION
// ============================================
function registerFace(name, photo) {
    if (!currentFaceDescriptor) {
        alert('No face detected!');
        return false;
    }

    const existingIdx = knownFaces.findIndex(f => f.name.toLowerCase() === name.toLowerCase());

    if (existingIdx >= 0) {
        knownFaces[existingIdx].descriptor = Array.from(currentFaceDescriptor);
        knownFaces[existingIdx].photo = photo;
        knownFaces[existingIdx].timestamp = Date.now();
    } else {
        knownFaces.push({
            name,
            descriptor: Array.from(currentFaceDescriptor),
            photo,
            timestamp: Date.now()
        });
    }

    saveKnownFaces();
    updateKnownFacesCount();
    updateUsersList();
    return true;
}

// ============================================
// STORAGE
// ============================================
function saveKnownFaces() {
    localStorage.setItem('knownFaces', JSON.stringify(knownFaces));
}

function loadKnownFaces() {
    const saved = localStorage.getItem('knownFaces');
    if (saved) {
        knownFaces = JSON.parse(saved);
        knownFaces.forEach(f => f.descriptor = new Float32Array(f.descriptor));
    }
}

function saveAttendance() {
    localStorage.setItem('attendance', JSON.stringify(attendanceRecords));
}

function loadAttendance() {
    const saved = localStorage.getItem('attendance');
    if (saved) attendanceRecords = JSON.parse(saved);
}

function saveSettings() {
    localStorage.setItem('faceSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('faceSettings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
    // Update toggles
    voiceToggle.classList.toggle('active', settings.voiceEnabled);
    livenessToggle.classList.toggle('active', settings.livenessEnabled);
    attendanceToggle.classList.toggle('active', settings.attendanceEnabled);
}

function clearAllData() {
    knownFaces = [];
    attendanceRecords = [];
    localStorage.removeItem('knownFaces');
    localStorage.removeItem('attendance');
    updateKnownFacesCount();
    updateUsersList();
    updateStats();
    updateAttendanceLog();
}

function updateKnownFacesCount() {
    knownFacesCount.textContent = knownFaces.length;
}

function updateUsersList() {
    if (!knownFaces.length) {
        usersList.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">No users registered</p>';
        return;
    }

    usersList.innerHTML = knownFaces.map((face, i) => {
        const lastSeen = face.timestamp ? new Date(face.timestamp).toLocaleDateString() : 'Unknown';
        const initial = face.name[0].toUpperCase();
        const defaultPhoto = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#667eea"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="30">${initial}</text></svg>`)}`;
        const photoSrc = face.photo || defaultPhoto;
        return `<div class="user-item">
            <img src="${photoSrc}" alt="">
            <div class="user-info">
                <div class="user-name">${face.name}</div>
                <div class="user-meta">Added: ${lastSeen}</div>
            </div>
            <button class="delete-btn" onclick="deleteFace(${i})">×</button>
        </div>`;
    }).join('');
}

function deleteFace(index) {
    if (confirm(`Delete "${knownFaces[index].name}"?`)) {
        knownFaces.splice(index, 1);
        saveKnownFaces();
        updateKnownFacesCount();
        updateUsersList();
    }
}
window.deleteFace = deleteFace;

// ============================================
// EXPORT / IMPORT
// ============================================
function exportData() {
    const data = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        faces: knownFaces.map(f => ({
            name: f.name,
            descriptor: Array.from(f.descriptor),
            photo: f.photo,
            timestamp: f.timestamp
        })),
        attendance: attendanceRecords
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `face-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.faces) {
                data.faces.forEach(face => {
                    const existing = knownFaces.findIndex(f => f.name.toLowerCase() === face.name.toLowerCase());
                    const faceData = {
                        name: face.name,
                        descriptor: new Float32Array(face.descriptor),
                        photo: face.photo,
                        timestamp: face.timestamp || Date.now()
                    };
                    if (existing >= 0) {
                        knownFaces[existing] = faceData;
                    } else {
                        knownFaces.push(faceData);
                    }
                });
                saveKnownFaces();
            }

            if (data.attendance) {
                attendanceRecords = [...data.attendance, ...attendanceRecords];
                saveAttendance();
            }

            updateKnownFacesCount();
            updateUsersList();
            updateStats();
            updateAttendanceLog();
            alert('Import successful!');
        } catch (err) {
            alert('Invalid file format.');
        }
    };
    reader.readAsText(file);
}

// ============================================
// RESET DISPLAY
// ============================================
function resetDisplay() {
    greetingBox.style.display = 'none';
    livenessBadge.style.display = 'none';
    currentFaceDescriptor = null;
    ageValue.textContent = '--';
    expressionValue.textContent = '--';
    genderValue.textContent = '--';
    accessoriesBadges.innerHTML = '';
    ageSamples = [];
    stableAgeRange = null;
    movementHistory = [];
    lastFacePosition = null;

    // Reset expression bars
    ['Happy', 'Sad', 'Angry', 'Surprised', 'Neutral'].forEach(exp => {
        document.getElementById('bar' + exp).style.width = '0%';
        document.getElementById('pct' + exp).textContent = '0%';
    });

    // Reset wellness indicators
    resetWellnessIndicators();
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    registerBtn.addEventListener('click', () => {
        if (!currentFaceDescriptor) {
            alert('No face detected! Please position your face in the camera.');
            return;
        }
        const photo = capturePhoto();
        capturedPhoto.src = photo;
        capturedPhoto.style.display = 'block';
        registrationModal.classList.add('active');
        nameInput.focus();
    });

    saveNameBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { alert('Please enter your name!'); return; }

        if (registerFace(name, capturedPhoto.src)) {
            registrationModal.classList.remove('active');
            nameInput.value = '';
            capturedPhoto.style.display = 'none';
            speak(`Nice to meet you, ${name}!`);
        }
    });

    cancelBtn.addEventListener('click', () => {
        registrationModal.classList.remove('active');
        nameInput.value = '';
        capturedPhoto.style.display = 'none';
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Clear ALL data (faces & attendance)?')) {
            clearAllData();
            alert('All data cleared!');
        }
    });

    exportBtn.addEventListener('click', exportData);

    importBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', (e) => {
        if (e.target.files.length) {
            importData(e.target.files[0]);
            e.target.value = '';
        }
    });

    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNameBtn.click();
    });

    registrationModal.addEventListener('click', (e) => {
        if (e.target === registrationModal) {
            registrationModal.classList.remove('active');
            nameInput.value = '';
            capturedPhoto.style.display = 'none';
        }
    });

    // Toggle switches
    voiceToggle.addEventListener('click', () => {
        settings.voiceEnabled = !settings.voiceEnabled;
        voiceToggle.classList.toggle('active', settings.voiceEnabled);
        saveSettings();
    });

    livenessToggle.addEventListener('click', () => {
        settings.livenessEnabled = !settings.livenessEnabled;
        livenessToggle.classList.toggle('active', settings.livenessEnabled);
        if (!settings.livenessEnabled) livenessBadge.style.display = 'none';
        saveSettings();
    });

    attendanceToggle.addEventListener('click', () => {
        settings.attendanceEnabled = !settings.attendanceEnabled;
        attendanceToggle.classList.toggle('active', settings.attendanceEnabled);
        saveSettings();
    });

}

// ============================================
// START
// ============================================
init();
