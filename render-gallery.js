// Offline renderer for FOTU particle gallery
// Pipes raw RGBA frames directly to ffmpeg for video encoding
//
// Usage:
//   node render-gallery.js              # Full retina render (3456x2234)
//   node render-gallery.js --test       # Low-res test (864x558)
//   node render-gallery.js --width 1920 # Custom width (height from aspect)

const { createCanvas, loadImage } = require("canvas");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- Configuration ---
const args = process.argv.slice(2);
const isTest = args.includes("--test");
const customWidth = args.find((a, i) => args[i - 1] === "--width");

const FULL_WIDTH = 3456;
const FULL_HEIGHT = 2234;
const ASPECT = FULL_WIDTH / FULL_HEIGHT;

let WIDTH, HEIGHT;
if (isTest) {
  WIDTH = 864;
  HEIGHT = Math.round(864 / ASPECT);
} else if (customWidth) {
  WIDTH = parseInt(customWidth);
  HEIGHT = Math.round(WIDTH / ASPECT);
} else {
  WIDTH = FULL_WIDTH;
  HEIGHT = FULL_HEIGHT;
}
// h265 yuv420p requires even dimensions
if (WIDTH % 2 !== 0) WIDTH++;
if (HEIGHT % 2 !== 0) HEIGHT++;

const PARTICLE_SIZE = 2;
const FPS = 30;
const HOLD_SECONDS = 5;
const TRANSITION_SECONDS = 7;
const HOLD_FRAMES = HOLD_SECONDS * FPS;
const TRANSITION_FRAMES = TRANSITION_SECONDS * FPS;

const GALLERY_PATH = path.join(__dirname, "assets", "gallery");
const IMAGE_FILES = ["home.png", "sample1.jpeg", "sample5.jpeg"];

// --- Particle system ---
let particles = [];
let loadedImages = [];

// Text mask
let maskCanvas, maskCtx;
const textConfig = {
  text: "FOTU",
  fontFamily: "Arial, sans-serif",
  fontWeight: "300",
  baseFontSize: Math.min(HEIGHT * 0.35, WIDTH * 0.18),
};

function createTextMask(centered) {
  if (!maskCanvas) {
    maskCanvas = createCanvas(WIDTH, HEIGHT);
    maskCtx = maskCanvas.getContext("2d");
  }

  maskCtx.clearRect(0, 0, WIDTH, HEIGHT);
  maskCtx.fillStyle = "white";

  const text = textConfig.text;

  if (centered) {
    const fontSize = textConfig.baseFontSize * 1.2;
    maskCtx.font = `${textConfig.fontWeight} ${fontSize}px ${textConfig.fontFamily}`;
    maskCtx.textAlign = "center";
    maskCtx.textBaseline = "middle";

    const letterSpacing = fontSize * 0.15;
    const letterWidths = [];
    let totalWidth = 0;

    for (let i = 0; i < text.length; i++) {
      const w = maskCtx.measureText(text[i]).width;
      letterWidths.push(w);
      totalWidth += w;
      if (i < text.length - 1) totalWidth += letterSpacing;
    }

    let currentX = (WIDTH - totalWidth) / 2;
    for (let i = 0; i < text.length; i++) {
      const charWidth = letterWidths[i];
      maskCtx.fillText(text[i], currentX + charWidth / 2, HEIGHT / 2);
      currentX += charWidth + letterSpacing;
    }
  } else {
    const padding = textConfig.baseFontSize * 0.5;
    const numSets = 3;

    for (let set = 0; set < numSets; set++) {
      const setScale = 0.6 + set * 0.3;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const x = padding + Math.random() * (WIDTH - padding * 2);
        const y = padding + Math.random() * (HEIGHT - padding * 2);
        const rotation = (Math.random() - 0.5) * 0.5;
        const scale = setScale * (0.8 + Math.random() * 0.4);
        const fontSize = textConfig.baseFontSize * scale;

        maskCtx.save();
        maskCtx.translate(x, y);
        maskCtx.rotate(rotation);
        maskCtx.font = `${textConfig.fontWeight} ${fontSize}px ${textConfig.fontFamily}`;
        maskCtx.textAlign = "center";
        maskCtx.textBaseline = "middle";
        maskCtx.fillText(char, 0, 0);
        maskCtx.restore();
      }
    }
  }
}

function sampleImageData(img, applyMask) {
  const sampleScale = Math.min(400 / WIDTH, 300 / HEIGHT);
  const sampleWidth = Math.round(WIDTH * sampleScale);
  const sampleHeight = Math.round(HEIGHT * sampleScale);

  const tempCanvas = createCanvas(sampleWidth, sampleHeight);
  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.fillStyle = "#f5f5f5";
  tempCtx.fillRect(0, 0, sampleWidth, sampleHeight);

  const imgAspect = img.width / img.height;
  const drawHeight = sampleHeight;
  const drawWidth = sampleHeight * imgAspect;
  const drawX = (sampleWidth - drawWidth) / 2;

  tempCtx.drawImage(img, drawX, 0, drawWidth, drawHeight);

  // Tile gaps
  if (drawWidth < sampleWidth && loadedImages.length > 1) {
    const others = loadedImages.filter((i) => i !== img);

    let x = drawX;
    while (x > 0) {
      const tile = others[Math.floor(Math.random() * others.length)];
      const tileAspect = tile.width / tile.height;
      const tileW = sampleHeight * tileAspect;
      x -= tileW;
      tempCtx.drawImage(tile, x, 0, tileW, sampleHeight);
    }

    x = drawX + drawWidth;
    while (x < sampleWidth) {
      const tile = others[Math.floor(Math.random() * others.length)];
      const tileAspect = tile.width / tile.height;
      const tileW = sampleHeight * tileAspect;
      tempCtx.drawImage(tile, x, 0, tileW, sampleHeight);
      x += tileW;
    }
  }

  // Bake mask
  if (applyMask && maskCanvas) {
    tempCtx.globalCompositeOperation = "destination-out";
    tempCtx.drawImage(maskCanvas, 0, 0, sampleWidth, sampleHeight);
    tempCtx.globalCompositeOperation = "destination-over";
    tempCtx.fillStyle = "#f5f5f5";
    tempCtx.fillRect(0, 0, sampleWidth, sampleHeight);
    tempCtx.globalCompositeOperation = "source-over";
  }

  return {
    data: tempCtx.getImageData(0, 0, sampleWidth, sampleHeight),
    width: sampleWidth,
    height: sampleHeight,
  };
}

function getColorAt(imageData, x, y) {
  const px = Math.floor((x * imageData.width) / WIDTH);
  const py = Math.floor((y * imageData.height) / HEIGHT);

  if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) {
    return { r: 60, g: 60, b: 60, a: 0 };
  }

  const idx = (py * imageData.width + px) * 4;
  const minBrightness = 100;
  const range = 255 - minBrightness;

  const r = imageData.data.data[idx];
  const g = imageData.data.data[idx + 1];
  const b = imageData.data.data[idx + 2];

  return {
    r: Math.round(minBrightness + (r / 255) * range),
    g: Math.round(minBrightness + (g / 255) * range),
    b: Math.round(minBrightness + (b / 255) * range),
    a: imageData.data.data[idx + 3] / 255,
  };
}

function initializeParticles(img, centered) {
  createTextMask(centered);
  const sourceData = sampleImageData(img, true);

  particles = [];
  const cellSize = PARTICLE_SIZE;
  const cols = Math.ceil(WIDTH / cellSize);
  const rows = Math.ceil(HEIGHT / cellSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      if (x >= WIDTH || y >= HEIGHT) continue;

      const sourceColor = getColorAt(sourceData, x, y);

      particles.push({
        sourceX: x,
        sourceY: y,
        sourceColor: sourceColor,
        targetX: x,
        targetY: y,
        targetColor: { ...sourceColor },
        x: x,
        y: y,
        color: { ...sourceColor },
        size: cellSize,
        // Scintillation
        scintPhaseX: Math.random() * Math.PI * 2,
        scintPhaseY: Math.random() * Math.PI * 2,
        scintFreqX: 0.5 + Math.random() * 1.5,
        scintFreqY: 0.5 + Math.random() * 1.5,
        scintAmpX: 0.02 + Math.random() * 0.03,
        scintAmpY: 0.02 + Math.random() * 0.03,
        scintAlphaPhase: Math.random() * Math.PI * 2,
        scintAlphaFreq: 0.3 + Math.random() * 0.7,
        // Random walk
        walkOffsetX: 0,
        walkOffsetY: 0,
        walkVelocityX: 0,
        walkVelocityY: 0,
        // Transition
        transitionScale: 1,
        transitionDelay: 0,
        pathLength: 0,
        horizontalFirst: true,
        cornerX: 0,
        cornerY: 0,
        horizontalFrac: 0,
      });
    }
  }

  console.log(`  Initialized ${particles.length} particles (${cols}x${rows})`);
}

// --- Manhattan grid flow transition system ---

const MAX_ASSIGN_RADIUS = 48; // max grid cells a particle can travel
const COLOR_WEIGHT = 1.5;
const SPATIAL_WEIGHT = 1.0;
const SWAP_ITERATIONS = 12; // multiplier for swap iteration count
const WAVE_SEED_COUNT = 3;
const MAX_DELAY_FRAC = 0.35; // max fraction of transition time used for stagger

function computeLocalAssignments(targetData) {
  const n = particles.length;
  const cellSize = PARTICLE_SIZE;
  const cols = Math.ceil(WIDTH / cellSize);
  const rows = Math.ceil(HEIGHT / cellSize);

  // Build spatial index: gridMap[row * cols + col] = particle index
  const gridMap = new Int32Array(cols * rows).fill(-1);
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const col = Math.round((p.sourceX - cellSize / 2) / cellSize);
    const row = Math.round((p.sourceY - cellSize / 2) / cellSize);
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      gridMap[row * cols + col] = i;
    }
  }

  // Sample target colors at every grid position
  const targetColors = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    targetColors[i] = getColorAt(targetData, p.sourceX, p.sourceY);
  }

  // Identity initial assignment
  const assignments = new Int32Array(n);
  for (let i = 0; i < n; i++) assignments[i] = i;

  // Cost function using Manhattan distance
  function cost(particleIdx, targetIdx) {
    const p = particles[particleIdx];
    const tc = targetColors[targetIdx];
    const tp = particles[targetIdx];

    const dr = p.sourceColor.r - tc.r;
    const dg = p.sourceColor.g - tc.g;
    const db = p.sourceColor.b - tc.b;
    const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

    const dx = (p.sourceX - tp.sourceX) / cellSize;
    const dy = (p.sourceY - tp.sourceY) / cellSize;
    const spatialDist = Math.abs(dx) + Math.abs(dy); // Manhattan

    return colorDist * COLOR_WEIGHT + spatialDist * SPATIAL_WEIGHT;
  }

  const maxRadiusCells = MAX_ASSIGN_RADIUS;
  const numIterations = Math.min(n * SWAP_ITERATIONS, 3000000);

  console.log(
    `  Computing local assignments (${numIterations} iterations, max radius ${maxRadiusCells} cells)...`,
  );

  for (let iter = 0; iter < numIterations; iter++) {
    const i = Math.floor(Math.random() * n);
    const pi = particles[i];

    const iCol = Math.round((pi.sourceX - cellSize / 2) / cellSize);
    const iRow = Math.round((pi.sourceY - cellSize / 2) / cellSize);

    // Anneal radius
    const progress = iter / numIterations;
    const radius = Math.max(
      2,
      Math.floor(maxRadiusCells * (1 - progress * 0.85)),
    );

    const dCol = Math.floor(Math.random() * radius * 2 + 1) - radius;
    const dRow = Math.floor(Math.random() * radius * 2 + 1) - radius;
    const jCol = iCol + dCol;
    const jRow = iRow + dRow;

    if (jCol < 0 || jCol >= cols || jRow < 0 || jRow >= rows) continue;

    const j = gridMap[jRow * cols + jCol];
    if (j < 0 || j === i) continue;

    // Reject swap if it would exceed max assignment radius
    const newTargetForI = assignments[j];
    const newTargetForJ = assignments[i];
    const tiP = particles[newTargetForI];
    const tjP = particles[newTargetForJ];

    const distI =
      (Math.abs(pi.sourceX - tiP.sourceX) +
        Math.abs(pi.sourceY - tiP.sourceY)) /
      cellSize;
    const distJ =
      (Math.abs(particles[j].sourceX - tjP.sourceX) +
        Math.abs(particles[j].sourceY - tjP.sourceY)) /
      cellSize;
    if (distI > maxRadiusCells || distJ > maxRadiusCells) continue;

    // Accept swap if it reduces total cost
    const currentCost = cost(i, assignments[i]) + cost(j, assignments[j]);
    const swappedCost = cost(i, assignments[j]) + cost(j, assignments[i]);

    if (swappedCost < currentCost) {
      const tmp = assignments[i];
      assignments[i] = assignments[j];
      assignments[j] = tmp;
    }
  }

  // Log displacement stats
  let totalDist = 0,
    maxDist = 0,
    movingCount = 0;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const tp = particles[assignments[i]];
    const d =
      Math.abs(p.sourceX - tp.sourceX) + Math.abs(p.sourceY - tp.sourceY);
    const dCells = d / cellSize;
    totalDist += dCells;
    if (dCells > maxDist) maxDist = dCells;
    if (dCells > 1) movingCount++;
  }
  console.log(
    `  Assignment stats: avg=${(totalDist / n).toFixed(1)} cells, ` +
      `max=${maxDist.toFixed(0)} cells, ` +
      `moving=${movingCount}/${n} (${((movingCount / n) * 100).toFixed(1)}%)`,
  );

  return { assignments, targetColors };
}

function prepareManhattanTransition(targetImg) {
  const targetData = sampleImageData(targetImg, true);
  createTextMask(false);

  const cellSize = PARTICLE_SIZE;
  const cols = Math.ceil(WIDTH / cellSize);
  const rows = Math.ceil(HEIGHT / cellSize);
  const numParticles = particles.length;

  // Pass 1: Snap particles to grid, freeze source state
  for (let i = 0; i < numParticles; i++) {
    const p = particles[i];
    const col = Math.round((p.sourceX - cellSize / 2) / cellSize);
    const row = Math.round((p.sourceY - cellSize / 2) / cellSize);
    p.sourceX = col * cellSize + cellSize / 2;
    p.sourceY = row * cellSize + cellSize / 2;
    p.x = p.sourceX;
    p.y = p.sourceY;
    p.sourceColor = { ...p.color };
  }

  // Pass 2: Compute assignments
  const { assignments, targetColors } = computeLocalAssignments(targetData);

  // Pass 3: Set targets and compute Manhattan path geometry
  for (let i = 0; i < numParticles; i++) {
    const p = particles[i];
    const targetIdx = assignments[i];
    const tp = particles[targetIdx];

    p.targetX = tp.sourceX;
    p.targetY = tp.sourceY;
    p.targetColor = targetColors[targetIdx];

    const dx = p.targetX - p.sourceX;
    const dy = p.targetY - p.sourceY;
    const manhattanDist = Math.abs(dx) + Math.abs(dy);

    if (manhattanDist < cellSize * 0.5) {
      // Particle barely moves — crossfade in place
      p.horizontalFirst = true;
      p.cornerX = p.targetX;
      p.cornerY = p.targetY;
      p.pathLength = 0;
      p.horizontalFrac = 0;
    } else {
      // Direction bias based on displacement ratio
      const ratio = Math.abs(dx) / manhattanDist;
      const hFirstProb = 0.3 + ratio * 0.4; // [0.3, 0.7]
      p.horizontalFirst = Math.random() < hFirstProb;

      if (p.horizontalFirst) {
        p.cornerX = p.targetX;
        p.cornerY = p.sourceY;
      } else {
        p.cornerX = p.sourceX;
        p.cornerY = p.targetY;
      }

      p.pathLength = manhattanDist;
      p.horizontalFrac = p.horizontalFirst
        ? Math.abs(dx) / manhattanDist
        : Math.abs(dy) / manhattanDist;
    }
  }

  // Pass 4: Compute wave-staggered delay field
  const rawDelays = new Float32Array(numParticles);

  // 4a. Structural component: color distance between source and target
  for (let i = 0; i < numParticles; i++) {
    const p = particles[i];
    const dr = p.sourceColor.r - p.targetColor.r;
    const dg = p.sourceColor.g - p.targetColor.g;
    const db = p.sourceColor.b - p.targetColor.b;
    rawDelays[i] = Math.sqrt(dr * dr + dg * dg + db * db) / 441;
  }

  // 4b. Spatial wave from random seed points
  const seeds = [];
  for (let s = 0; s < WAVE_SEED_COUNT; s++) {
    seeds.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT });
  }
  const maxDist = Math.sqrt(WIDTH * WIDTH + HEIGHT * HEIGHT);

  for (let i = 0; i < numParticles; i++) {
    const p = particles[i];
    let minSeedDist = maxDist;
    for (let s = 0; s < seeds.length; s++) {
      const dx = p.sourceX - seeds[s].x;
      const dy = p.sourceY - seeds[s].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minSeedDist) minSeedDist = d;
    }
    rawDelays[i] =
      rawDelays[i] * 0.35 +
      (minSeedDist / maxDist) * 0.45 +
      Math.random() * 0.2;
  }

  // 4c. Smooth delay field (3 passes of neighbor averaging)
  const smoothed = new Float32Array(rawDelays);
  const temp = new Float32Array(numParticles);

  for (let pass = 0; pass < 3; pass++) {
    const src = pass % 2 === 0 ? smoothed : temp;
    const dst = pass % 2 === 0 ? temp : smoothed;

    for (let i = 0; i < numParticles; i++) {
      const p = particles[i];
      const col = Math.round((p.sourceX - cellSize / 2) / cellSize);
      const row = Math.round((p.sourceY - cellSize / 2) / cellSize);

      let sum = src[i];
      let count = 1;

      if (col > 0 && i > 0) {
        sum += src[i - 1];
        count++;
      }
      if (col < cols - 1 && i + 1 < numParticles) {
        sum += src[i + 1];
        count++;
      }
      if (row > 0 && i - cols >= 0) {
        sum += src[i - cols];
        count++;
      }
      if (row < rows - 1 && i + cols < numParticles) {
        sum += src[i + cols];
        count++;
      }

      dst[i] = sum / count;
    }
  }

  // Result is in temp after 3 passes
  const finalDelays = temp;

  // 4d. Normalize to [0, MAX_DELAY_FRAC]
  let minVal = Infinity,
    maxVal = -Infinity;
  for (let i = 0; i < numParticles; i++) {
    if (finalDelays[i] < minVal) minVal = finalDelays[i];
    if (finalDelays[i] > maxVal) maxVal = finalDelays[i];
  }
  const range = maxVal - minVal || 1;

  for (let i = 0; i < numParticles; i++) {
    particles[i].transitionDelay =
      ((finalDelays[i] - minVal) / range) * MAX_DELAY_FRAC;
  }

  console.log("  Manhattan transition prepared");
}

function stepManhattanFlow(frameIndex, totalFrames) {
  const numParticles = particles.length;
  const globalT = (frameIndex + 1) / totalFrames;

  for (let i = 0; i < numParticles; i++) {
    const p = particles[i];

    // Local progress with per-particle delay
    const delay = p.transitionDelay || 0;
    const activeDuration = 1.0 - MAX_DELAY_FRAC;
    let localT = (globalT - delay) / activeDuration;
    localT = Math.max(0, Math.min(1, localT));

    // Smoothstep easing
    const easedT = localT * localT * (3 - 2 * localT);

    // Manhattan path interpolation
    if (p.pathLength < 1) {
      p.x = p.sourceX;
      p.y = p.sourceY;
    } else {
      const hFrac = p.horizontalFrac || 0;

      if (easedT <= hFrac) {
        // First leg of L-shape
        const legT = hFrac > 0 ? easedT / hFrac : 1;
        if (p.horizontalFirst) {
          p.x = p.sourceX + (p.cornerX - p.sourceX) * legT;
          p.y = p.sourceY;
        } else {
          p.x = p.sourceX;
          p.y = p.sourceY + (p.cornerY - p.sourceY) * legT;
        }
      } else {
        // Second leg of L-shape
        const legT = 1 - hFrac > 0 ? (easedT - hFrac) / (1 - hFrac) : 1;
        if (p.horizontalFirst) {
          p.x = p.cornerX;
          p.y = p.cornerY + (p.targetY - p.cornerY) * legT;
        } else {
          p.x = p.cornerX + (p.targetX - p.cornerX) * legT;
          p.y = p.cornerY;
        }
      }
    }

    // Color interpolation tied to path progress
    p.color.r =
      (p.sourceColor.r + (p.targetColor.r - p.sourceColor.r) * easedT) | 0;
    p.color.g =
      (p.sourceColor.g + (p.targetColor.g - p.sourceColor.g) * easedT) | 0;
    p.color.b =
      (p.sourceColor.b + (p.targetColor.b - p.sourceColor.b) * easedT) | 0;
    p.color.a = 1;
    p.transitionScale = 1;
  }
}

function completeTransition() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.color.r = p.targetColor.r;
    p.color.g = p.targetColor.g;
    p.color.b = p.targetColor.b;
    p.color.a = 1;
    p.transitionScale = 1;
    p.x = p.targetX;
    p.y = p.targetY;
    p.sourceX = p.targetX;
    p.sourceY = p.targetY;
    p.sourceColor = { ...p.targetColor };
    p.pathLength = 0;
    p.transitionDelay = 0;
    p.walkOffsetX = 0;
    p.walkOffsetY = 0;
    p.walkVelocityX = 0;
    p.walkVelocityY = 0;
  }
}

// --- Random walk ---

function updateRandomWalks() {
  const maxOffset = 1.0;
  const walkSpeed = 0.15;
  const springStrength = 0.03;
  const randomForce = 0.08;
  const friction = 0.92;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    p.walkVelocityX += (Math.random() - 0.5) * randomForce;
    p.walkVelocityY += (Math.random() - 0.5) * randomForce;

    p.walkVelocityX -= p.walkOffsetX * springStrength;
    p.walkVelocityY -= p.walkOffsetY * springStrength;

    const speed = Math.sqrt(p.walkVelocityX ** 2 + p.walkVelocityY ** 2);
    if (speed > walkSpeed) {
      p.walkVelocityX = (p.walkVelocityX / speed) * walkSpeed;
      p.walkVelocityY = (p.walkVelocityY / speed) * walkSpeed;
    }

    p.walkVelocityX *= friction;
    p.walkVelocityY *= friction;

    p.walkOffsetX += p.walkVelocityX;
    p.walkOffsetY += p.walkVelocityY;

    const dist = Math.sqrt(p.walkOffsetX ** 2 + p.walkOffsetY ** 2);
    if (dist > maxOffset) {
      p.walkOffsetX = (p.walkOffsetX / dist) * maxOffset;
      p.walkOffsetY = (p.walkOffsetY / dist) * maxOffset;
    }
  }
}

// --- Frame rendering ---

// Reusable buffer — allocated once
let frameBuffer = null;

function renderFrame(frameTime, isTransitioning, scintIntensity) {
  if (!frameBuffer) {
    frameBuffer = Buffer.alloc(WIDTH * HEIGHT * 4);
  }
  const data = frameBuffer;

  // Clear to #f5f5f5 (RGBA)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 245;
    data[i + 1] = 245;
    data[i + 2] = 245;
    data[i + 3] = 255;
  }

  const baseRadius = PARTICLE_SIZE / 2;
  const softEdge = 0.85;
  const aberrationAmount = 0.3;
  const aberrationAngle = frameTime * 0.0001;
  const time = frameTime * 0.001;

  const breatheAmount = Math.sin(time * 0.3) * 0.002;
  const breatheCenterX = WIDTH / 2;
  const breatheCenterY = HEIGHT / 2;

  const scintillationIntensity = scintIntensity;

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    const particleAlpha = particle.color.a !== undefined ? particle.color.a : 1;

    const alphaScint =
      1 +
      Math.sin(time * particle.scintAlphaFreq + particle.scintAlphaPhase) *
        0.01 *
        scintillationIntensity;
    const baseAlpha = particleAlpha * alphaScint;
    if (baseAlpha <= 0) continue;

    const scintX =
      Math.sin(time * particle.scintFreqX + particle.scintPhaseX) *
      particle.scintAmpX *
      scintillationIntensity;
    const scintY =
      Math.sin(time * particle.scintFreqY + particle.scintPhaseY) *
      particle.scintAmpY *
      scintillationIntensity;

    const breatheOffsetX = (particle.x - breatheCenterX) * breatheAmount;
    const breatheOffsetY = (particle.y - breatheCenterY) * breatheAmount;

    const walkX = (particle.walkOffsetX || 0) * scintillationIntensity;
    const walkY = (particle.walkOffsetY || 0) * scintillationIntensity;

    const cx = particle.x + scintX + breatheOffsetX + walkX;
    const cy = particle.y + scintY + breatheOffsetY + walkY;

    const transScale =
      particle.transitionScale !== undefined ? particle.transitionScale : 1;
    const radius = baseRadius * transScale;
    const radiusSq = radius * radius;

    const aberrX = Math.cos(aberrationAngle) * aberrationAmount;
    const aberrY = Math.sin(aberrationAngle) * aberrationAmount;

    const extRadius = radius + aberrationAmount;
    const minX = Math.max(0, (cx - extRadius) | 0);
    const maxX = Math.min(WIDTH - 1, (cx + extRadius) | 0);
    const minY = Math.max(0, (cy - extRadius) | 0);
    const maxY = Math.min(HEIGHT - 1, (cy + extRadius) | 0);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * WIDTH + x) * 4;

        const dxR = x - (cx + aberrX);
        const dyR = y - (cy + aberrY);
        const distSqR = dxR * dxR + dyR * dyR;

        const dxG = x - cx;
        const dyG = y - cy;
        const distSqG = dxG * dxG + dyG * dyG;

        const dxB = x - (cx - aberrX);
        const dyB = y - (cy - aberrY);
        const distSqB = dxB * dxB + dyB * dyB;

        let alphaR = 0,
          alphaG = 0,
          alphaB = 0;

        if (distSqR <= radiusSq) {
          const dist = Math.sqrt(distSqR);
          alphaR =
            dist > radius * softEdge
              ? 1 - (dist - radius * softEdge) / (radius * (1 - softEdge))
              : 1;
        }

        if (distSqG <= radiusSq) {
          const dist = Math.sqrt(distSqG);
          alphaG =
            dist > radius * softEdge
              ? 1 - (dist - radius * softEdge) / (radius * (1 - softEdge))
              : 1;
        }

        if (distSqB <= radiusSq) {
          const dist = Math.sqrt(distSqB);
          alphaB =
            dist > radius * softEdge
              ? 1 - (dist - radius * softEdge) / (radius * (1 - softEdge))
              : 1;
        }

        if (alphaR <= 0 && alphaG <= 0 && alphaB <= 0) continue;

        alphaR *= baseAlpha;
        alphaG *= baseAlpha;
        alphaB *= baseAlpha;

        if (alphaR > 0.01) {
          data[idx] =
            (particle.color.r * alphaR + data[idx] * (1 - alphaR)) | 0;
        }
        if (alphaG > 0.01) {
          data[idx + 1] =
            (particle.color.g * alphaG + data[idx + 1] * (1 - alphaG)) | 0;
        }
        if (alphaB > 0.01) {
          data[idx + 2] =
            (particle.color.b * alphaB + data[idx + 2] * (1 - alphaB)) | 0;
        }
        data[idx + 3] = 255;
      }
    }
  }

  return data;
}

// --- Main render loop ---

function writeFrame(stdin, data) {
  return new Promise((resolve, reject) => {
    const ok = stdin.write(data, (err) => {
      if (err) reject(err);
    });
    if (ok) {
      resolve();
    } else {
      stdin.once("drain", resolve);
    }
  });
}

async function main() {
  console.log(`\nFOTU Gallery Offline Renderer`);
  console.log(`Resolution: ${WIDTH}x${HEIGHT} (${isTest ? "TEST" : "FULL"})`);
  console.log(`Particle size: ${PARTICLE_SIZE}, FPS: ${FPS}`);
  console.log(
    `Hold: ${HOLD_SECONDS}s (${HOLD_FRAMES}f), Transition: ${TRANSITION_SECONDS}s (${TRANSITION_FRAMES}f)\n`,
  );

  // Load images
  console.log("Loading images...");
  for (const file of IMAGE_FILES) {
    const imgPath = path.join(GALLERY_PATH, file);
    if (!fs.existsSync(imgPath)) {
      console.error(`  Missing: ${file}`);
      continue;
    }
    const img = await loadImage(imgPath);
    loadedImages.push(img);
    console.log(`  Loaded ${file} (${img.width}x${img.height})`);
  }

  if (loadedImages.length < 2) {
    console.error("Need at least 2 images!");
    process.exit(1);
  }

  // Build sequence: ping-pong for seamless loop
  const segments = [];
  const imageCount = loadedImages.length;

  // Forward: 0, 0→1, 1, 1→2, 2
  for (let i = 0; i < imageCount; i++) {
    segments.push({ type: "hold", imageIndex: i });
    if (i < imageCount - 1) {
      segments.push({ type: "transition", fromIndex: i, toIndex: i + 1 });
    }
  }
  // Reverse: 2→1, 1, 1→0
  for (let i = imageCount - 1; i > 0; i--) {
    segments.push({ type: "transition", fromIndex: i, toIndex: i - 1 });
    if (i - 1 > 0) {
      segments.push({ type: "hold", imageIndex: i - 1 });
    }
  }

  let totalFrames = 0;
  for (const seg of segments) {
    totalFrames += seg.type === "hold" ? HOLD_FRAMES : TRANSITION_FRAMES;
  }
  console.log(
    `\nSequence: ${segments.length} segments, ${totalFrames} frames (${(totalFrames / FPS).toFixed(1)}s)`,
  );
  for (const seg of segments) {
    if (seg.type === "hold") {
      console.log(`  Hold image ${seg.imageIndex} (${HOLD_FRAMES}f)`);
    } else {
      console.log(
        `  Transition ${seg.fromIndex}→${seg.toIndex} (${TRANSITION_FRAMES}f)`,
      );
    }
  }

  // Initialize particles
  console.log("\nInitializing particles...");
  initializeParticles(loadedImages[0], true);

  // Start ffmpeg — pipe raw RGBA in, get h265 mp4 out
  const outputPath = path.join(GALLERY_PATH, "hero-gallery.mp4");
  const ffmpegArgs = [
    "-y",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgba",
    "-video_size",
    `${WIDTH}x${HEIGHT}`,
    "-framerate",
    String(FPS),
    "-i",
    "-",
    "-c:v",
    "libx265",
    "-preset",
    isTest ? "fast" : "slow",
    "-crf",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-tag:v",
    "hvc1",
    outputPath,
  ];

  console.log(`\nPiping to ffmpeg → ${outputPath}`);
  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  ffmpeg.stderr.on("data", () => {});
  ffmpeg.on("error", (err) => {
    console.error("ffmpeg error:", err);
    process.exit(1);
  });

  let globalFrame = 0;
  let simulatedTime = 0;
  const frameDt = 1000 / FPS;
  const startTime = Date.now();

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];

    if (seg.type === "hold") {
      console.log(`\n--- Hold image ${seg.imageIndex} ---`);

      for (let f = 0; f < HOLD_FRAMES; f++) {
        updateRandomWalks();
        const data = renderFrame(simulatedTime, false, 1.0);
        await writeFrame(ffmpeg.stdin, data);

        globalFrame++;
        simulatedTime += frameDt;

        if (f % 30 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const pct = ((globalFrame / totalFrames) * 100).toFixed(1);
          const renderFps = (
            globalFrame /
            ((Date.now() - startTime) / 1000)
          ).toFixed(1);
          process.stdout.write(
            `\r  ${globalFrame}/${totalFrames} (${pct}%) [${elapsed}s, ${renderFps} render-fps]`,
          );
        }
      }
      console.log();
    } else {
      console.log(`\n--- Transition ${seg.fromIndex}→${seg.toIndex} ---`);

      prepareManhattanTransition(loadedImages[seg.toIndex]);

      for (let f = 0; f < TRANSITION_FRAMES; f++) {
        stepManhattanFlow(f, TRANSITION_FRAMES);
        updateRandomWalks();
        // Ramp scintillation: 1.0 → 0.3 → 1.0 (smooth at boundaries)
        const tNorm = f / (TRANSITION_FRAMES - 1);
        const scintRamp = 0.3 + 0.7 * (1 - Math.sin(tNorm * Math.PI));
        const data = renderFrame(simulatedTime, true, scintRamp);
        await writeFrame(ffmpeg.stdin, data);

        globalFrame++;
        simulatedTime += frameDt;

        if (f % 30 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const pct = ((globalFrame / totalFrames) * 100).toFixed(1);
          const renderFps = (
            globalFrame /
            ((Date.now() - startTime) / 1000)
          ).toFixed(1);
          process.stdout.write(
            `\r  ${globalFrame}/${totalFrames} (${pct}%) [${elapsed}s, ${renderFps} render-fps]`,
          );
        }
      }
      console.log();

      completeTransition();
    }
  }

  // Close ffmpeg and wait
  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const fileSize = fs.statSync(outputPath).size;
  const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);
  console.log(`\nDone! ${globalFrame} frames in ${totalTime}s`);
  console.log(`Output: ${outputPath} (${fileSizeMB} MB)`);
}

main().catch(console.error);
