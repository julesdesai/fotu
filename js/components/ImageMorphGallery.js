// Image Morphing Gallery - Particle-based transitions inspired by obamify
// Implements: Classic Morph, Dissolve Morph, Voronoi Mosaic

class ImageMorphGallery {
  constructor(options = {}) {
    this.canvas = document.getElementById("morphCanvas");
    this.container = document.querySelector(".hero-image");

    if (!this.canvas || !this.container) {
      console.log("Morph gallery elements not found");
      return;
    }

    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    // Configuration
    this.config = {
      transitionDuration: options.transitionDuration || 2500,
      holdDuration: options.holdDuration || 4000,
      galleryPath: options.galleryPath || "assets/gallery/",
      manifestPath:
        options.manifestPath || "assets/gallery/gallery-manifest.json",
      proximityWeight: options.proximityWeight || 0.7,
      easing: options.easing || "easeInOutCubic",
      particleSize: options.particleSize || 3,
    };

    // Wave origins for current transition
    this.transitionWaveOrigins = [];

    // State
    this.images = [];
    this.loadedImages = [];
    this.currentIndex = 0;
    this.nextIndex = 1;
    this.particles = [];
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.transitionStartTime = 0;
    this.animationId = null;
    this.cycleTimeout = null;
    this.isLoading = true;
    this.galleryOpacity = 0; // Fade in gallery when ready
    this.fadeInStartTime = 0;

    // Text mask for negative space
    this.textMask = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.textConfig = {
      text: "FOTU",
      fontFamily: '"Courier New", monospace',
      fontWeight: "700",
      baseFontSize: 0,
    };

    this.init();
  }

  async init() {
    this.setupCanvas();

    // Start animation loop
    this.isLoading = true;
    this.isFirstImage = true; // Track if we're on the first image (clean FOTU)
    this.animate();

    await this.yieldToFrame();

    this.createTextMask();

    await this.yieldToFrame();

    await this.loadManifest();

    // Load all images first, then shuffle
    await this.loadAllImages();

    // Shuffle the image sequence
    this.shuffleImages();

    if (this.loadedImages.length >= 2) {
      console.log("Initializing particles...");
      await this.initializeParticlesAsync();
      console.log("Particles initialized, transitioning to gallery view");

      await this.yieldToFrame();

      this.fadeInStartTime = Date.now();
      this.isLoading = false;
      this.container.classList.add("gallery-ready");
      console.log(
        "Gallery ready - showing image",
        this.currentIndex,
        "waiting for first transition to image",
        this.nextIndex,
      );

      this.startCycle();
    } else if (this.loadedImages.length === 1) {
      await this.initializeParticlesAsync();
      await this.yieldToFrame();
      this.fadeInStartTime = Date.now();
      this.isLoading = false;
      this.container.classList.add("gallery-ready");
    }
  }

  createTextMask() {
    // Create offscreen canvas for text mask
    if (!this.maskCanvas) {
      this.maskCanvas = document.createElement("canvas");
    }
    this.maskCanvas.width = this.width;
    this.maskCanvas.height = this.height;
    this.maskCtx = this.maskCanvas.getContext("2d");

    // Calculate base font size - larger for more visibility
    this.textConfig.baseFontSize = Math.min(
      this.height * 0.35,
      this.width * 0.18,
    );

    // Render initial random mask
    this.randomizeTextMask();
  }

  randomizeTextMask(centered = false) {
    // Generate text mask - either centered (first image) or scattered (subsequent)
    // The mask uses TRANSPARENCY: transparent background, opaque white letters
    // This allows destination-out compositing to work correctly
    const ctx = this.maskCtx;
    const width = this.width;
    const height = this.height;
    const text = this.textConfig.text;

    // Clear to fully transparent (crucial for destination-out to work)
    ctx.clearRect(0, 0, width, height);

    // Draw letters in white (opaque) - these areas will be "punched out"
    ctx.fillStyle = "white";

    if (centered) {
      // CENTERED MODE: Clean, equally-spaced FOTU in center
      const fontSize = this.textConfig.baseFontSize * 1.2;
      ctx.font = `${this.textConfig.fontWeight} ${fontSize}px ${this.textConfig.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Calculate total width for letter spacing
      const letterSpacing = fontSize * 0.15; // Space between letters
      const letterWidths = [];
      let totalWidth = 0;

      for (let i = 0; i < text.length; i++) {
        const w = ctx.measureText(text[i]).width;
        letterWidths.push(w);
        totalWidth += w;
        if (i < text.length - 1) totalWidth += letterSpacing;
      }

      // Draw each letter with equal spacing
      let currentX = (width - totalWidth) / 2;
      for (let i = 0; i < text.length; i++) {
        const charWidth = letterWidths[i];
        ctx.fillText(text[i], currentX + charWidth / 2, height / 2);
        currentX += charWidth + letterSpacing;
      }
    } else {
      // SCATTERED MODE: Random positions for organic feel
      const padding = this.textConfig.baseFontSize * 0.5;
      const numSets = 3;

      for (let set = 0; set < numSets; set++) {
        const setScale = 0.6 + set * 0.3;

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const x = padding + Math.random() * (width - padding * 2);
          const y = padding + Math.random() * (height - padding * 2);
          const rotation = (Math.random() - 0.5) * 0.5;
          const scale = setScale * (0.8 + Math.random() * 0.4);
          const fontSize = this.textConfig.baseFontSize * scale;

          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.font = `${this.textConfig.fontWeight} ${fontSize}px ${this.textConfig.fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(char, 0, 0);
          ctx.restore();
        }
      }
    }
  }

  isInTextMask(x, y) {
    if (!this.textMask) return false;

    const px = Math.floor(x);
    const py = Math.floor(y);

    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return false;
    }

    const idx = (py * this.width + px) * 4;
    return this.textMask.data[idx] > 128;
  }

  setupCanvas() {
    const resize = () => {
      const rect = this.container.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.width = rect.width;
      this.height = rect.height;

      // Fill with background color immediately
      this.ctx.fillStyle = "#f5f5f5";
      this.ctx.fillRect(0, 0, this.width, this.height);
    };

    resize();
    window.addEventListener("resize", () => {
      resize();
      this.createTextMask();
      if (this.loadedImages.length > 0 && !this.isLoading) {
        this.reinitializeParticles();
      }
    });
  }

  async loadManifest() {
    try {
      const response = await fetch(this.config.manifestPath);
      const manifest = await response.json();
      this.images = manifest.images || [];
    } catch (e) {
      console.warn("Could not fetch manifest, using fallback image list");
      // Fallback for local file:// access
      this.images = [
        "sample1.jpeg",
        "sample2.jpeg",
        "sample3.jpeg",
        "sample4.jpeg",
        "sample5.jpeg",
      ];
    }
  }

  async loadAllImages() {
    // Always load home.png first (the starting image) - more retries for critical asset
    const homeImage = await this.loadImage("home.png", 5);

    if (!homeImage) {
      console.error("home.png failed to load after all retries!");
    }

    // Remove home.png from manifest list to avoid loading twice
    const otherImageNames = this.images.filter((f) => f !== "home.png");

    // Load all other images
    const loadPromises = otherImageNames.map((filename) =>
      this.loadImage(filename),
    );
    const results = await Promise.all(loadPromises);
    const otherImages = results.filter((img) => img !== null);

    // Put home.png first, then the rest
    if (homeImage) {
      this.loadedImages = [homeImage, ...otherImages];
    } else {
      this.loadedImages = otherImages;
    }

    console.log(`Loaded ${this.loadedImages.length} images (home.png first)`);
  }

  shuffleImages() {
    // Keep first image (home.png) in place, shuffle the rest
    if (this.loadedImages.length <= 2) return;

    // Fisher-Yates shuffle starting from index 1
    for (let i = this.loadedImages.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i); // Random from 1 to i
      [this.loadedImages[i], this.loadedImages[j]] = [
        this.loadedImages[j],
        this.loadedImages[i],
      ];
    }
    console.log("Image sequence randomized (home.png stays first)");
  }

  async loadImage(filename, retries = 3) {
    const src = this.config.galleryPath + filename;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Use <img> element directly — works on both file:// and http(s)://
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error(`Failed to load ${src}`));
          img.src = src;
        });

        // Use createImageBitmap for offscreen processing if available
        if (typeof createImageBitmap !== "undefined") {
          const bitmap = await createImageBitmap(img);
          console.log(`Loaded: ${filename}`);
          return bitmap;
        }

        console.log(`Loaded: ${filename}`);
        return img;
      } catch (e) {
        const isLastAttempt = attempt === retries;
        console.warn(
          `Failed to load ${filename} (attempt ${attempt}/${retries}):`,
          e.message,
        );

        if (!isLastAttempt) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
    console.error(`Failed to load ${filename} after ${retries} attempts`);
    return null;
  }

  sampleImageData(img, applyMask = false) {
    // Reuse canvas if possible to avoid allocation overhead
    if (!this._sampleCanvas) {
      this._sampleCanvas = document.createElement("canvas");
      this._sampleCtx = this._sampleCanvas.getContext("2d", {
        willReadFrequently: true,
      });
    }

    const tempCanvas = this._sampleCanvas;
    const tempCtx = this._sampleCtx;

    // Sample size for color sampling - must match display aspect ratio
    const scale = Math.min(400 / this.width, 300 / this.height);
    const sampleWidth = Math.round(this.width * scale);
    const sampleHeight = Math.round(this.height * scale);

    tempCanvas.width = sampleWidth;
    tempCanvas.height = sampleHeight;

    // Fill with background color first (for pillarboxing)
    tempCtx.fillStyle = "#f5f5f5";
    tempCtx.fillRect(0, 0, sampleWidth, sampleHeight);

    // Always fill vertical height, preserve aspect ratio, pillarbox sides if needed
    const imgAspect = img.width / img.height;

    const drawHeight = sampleHeight;
    const drawWidth = sampleHeight * imgAspect;
    const drawX = (sampleWidth - drawWidth) / 2;
    const drawY = 0;

    tempCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Tile random images into gaps if main image doesn't fill the width
    if (
      drawWidth < sampleWidth &&
      this.loadedImages &&
      this.loadedImages.length > 1
    ) {
      const others = this.loadedImages.filter((i) => i !== img);

      // Fill left gap (right-to-left from drawX)
      let x = drawX;
      while (x > 0) {
        const tile = others[Math.floor(Math.random() * others.length)];
        const tileAspect = tile.width / tile.height;
        const tileW = sampleHeight * tileAspect;
        x -= tileW;
        tempCtx.drawImage(tile, x, 0, tileW, sampleHeight);
      }

      // Fill right gap (left-to-right from drawX + drawWidth)
      x = drawX + drawWidth;
      while (x < sampleWidth) {
        const tile = others[Math.floor(Math.random() * others.length)];
        const tileAspect = tile.width / tile.height;
        const tileW = sampleHeight * tileAspect;
        tempCtx.drawImage(tile, x, 0, tileW, sampleHeight);
        x += tileW;
      }
    }

    // BAKE THE MASK INTO THE IMAGE DATA using canvas compositing
    if (applyMask && this.maskCanvas) {
      tempCtx.globalCompositeOperation = "destination-out";
      tempCtx.drawImage(this.maskCanvas, 0, 0, sampleWidth, sampleHeight);
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

  // Async version that yields to keep animation running
  async sampleImageDataAsync(img, applyMask = false) {
    // First yield to let any pending animation frames render
    await this.yieldToFrame();

    // Do the sampling (still synchronous but smaller)
    const result = this.sampleImageData(img, applyMask);

    // Yield again after heavy operation
    await this.yieldToFrame();

    return result;
  }

  getColorAt(imageData, x, y) {
    const px = Math.floor((x * imageData.width) / this.width);
    const py = Math.floor((y * imageData.height) / this.height);

    if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) {
      return { r: 60, g: 60, b: 60, a: 0 };
    }

    const idx = (py * imageData.width + px) * 4;

    // Lift blacks to muted gray - map [0-255] to [minBrightness-255]
    const minBrightness = 100; // Darkest value (~39% gray, balanced contrast)
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

  // Helper for yielding to browser with guaranteed frame paint
  // Double RAF ensures the browser actually paints before continuing
  yieldToFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  async initializeParticlesAsync() {
    this.particles = [];
    this.isBuilding = true; // Flag to show we're in build-up mode

    const sourceImg = this.loadedImages[this.currentIndex];

    // First image gets centered FOTU, subsequent get scattered
    this.randomizeTextMask(this.isFirstImage);
    await this.yieldToFrame();

    console.log("Building image progressively...");

    // Pre-sample the full image data (one blocking call, but smaller canvas)
    const sourceData = this.sampleImageData(sourceImg, true);

    const cellSize = this.config.particleSize;
    const cols = Math.ceil(this.width / cellSize);
    const rows = Math.ceil(this.height / cellSize);

    // Create all particle slots first (empty/invisible)
    const totalParticles = cols * rows;
    const allPositions = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellSize + cellSize / 2;
        const y = row * cellSize + cellSize / 2;
        if (x < this.width && y < this.height) {
          allPositions.push({ x, y, row, col });
        }
      }
    }

    // Shuffle positions for random build-up pattern
    for (let i = allPositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }

    // Build up particles in chunks, rendering between each
    const chunkSize = 1500; // Particles per frame - larger chunks for smoother build
    let builtCount = 0;

    // Switch from loading to particle rendering
    this.isLoading = false;
    this.isBuilding = true;
    this.galleryOpacity = 1; // Full opacity for build-up

    await this.yieldToFrame();

    for (let i = 0; i < allPositions.length; i++) {
      const pos = allPositions[i];
      const sourceColor = this.getColorAt(sourceData, pos.x, pos.y);

      this.particles.push({
        sourceX: pos.x,
        sourceY: pos.y,
        sourceColor: sourceColor,
        targetX: pos.x,
        targetY: pos.y,
        targetColor: { ...sourceColor },
        x: pos.x,
        y: pos.y,
        color: { ...sourceColor },
        size: cellSize,
        delay: Math.random() * 0.15,
        randomOffsetX: (Math.random() - 0.5) * 2,
        randomOffsetY: (Math.random() - 0.5) * 2,
        // Scintillation parameters
        scintPhaseX: Math.random() * Math.PI * 2,
        scintPhaseY: Math.random() * Math.PI * 2,
        scintFreqX: 0.5 + Math.random() * 1.5,
        scintFreqY: 0.5 + Math.random() * 1.5,
        scintAmpX: 0.1 + Math.random() * 0.3,
        scintAmpY: 0.1 + Math.random() * 0.3,
        scintAlphaPhase: Math.random() * Math.PI * 2,
        scintAlphaFreq: 0.3 + Math.random() * 0.7,
        // Random dropout parameters — each particle independently fades in/out
        // during the at-rest phase so the image never sits fully complete.
        dropoutPhase: Math.random() * Math.PI * 2,
        dropoutFreq: 0.18 + Math.random() * 0.42,
        // Random walk parameters
        walkOffsetX: 0,
        walkOffsetY: 0,
        walkVelocityX: 0,
        walkVelocityY: 0,
        // Build-up animation - stagger delays for wave effect
        buildProgress: 0,
        buildDelay: 0.1 + Math.random() * 0.5,
      });

      builtCount++;

      // Yield every chunk to render the progressive build-up
      if (builtCount % chunkSize === 0) {
        await this.yieldToFrame();
      }
    }

    console.log(
      `Built ${this.particles.length} particles (${cols}x${rows} grid)`,
    );

    // Continue animation while particles finish their fade-in
    // isBuilding remains true until all particles are fully visible
    const waitForBuildComplete = () => {
      return new Promise((resolve) => {
        const checkComplete = () => {
          let allComplete = true;
          for (let i = 0; i < this.particles.length; i++) {
            if (this.particles[i].buildProgress < 1) {
              allComplete = false;
              break;
            }
          }
          if (allComplete) {
            resolve();
          } else {
            requestAnimationFrame(checkComplete);
          }
        };
        checkComplete();
      });
    };

    await waitForBuildComplete();
    this.isBuilding = false;
    console.log("Build-up complete");
  }

  initializeParticles() {
    // Sync version for resize - simpler, no target calculation
    this.particles = [];

    const sourceImg = this.loadedImages[this.currentIndex];
    if (!sourceImg) return;

    // Sample with current mask baked in
    const sourceData = this.sampleImageData(sourceImg, true);
    const cellSize = this.config.particleSize;
    const cols = Math.ceil(this.width / cellSize);
    const rows = Math.ceil(this.height / cellSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellSize + cellSize / 2;
        const y = row * cellSize + cellSize / 2;

        if (x >= this.width || y >= this.height) continue;

        const sourceColor = this.getColorAt(sourceData, x, y);

        this.particles.push({
          sourceX: x,
          sourceY: y,
          sourceColor: sourceColor,
          targetX: x,
          targetY: y,
          targetColor: sourceColor,
          x: x,
          y: y,
          color: { ...sourceColor },
          size: cellSize,
          delay: Math.random() * 0.15,
          randomOffsetX: (Math.random() - 0.5) * 2,
          randomOffsetY: (Math.random() - 0.5) * 2,
          // Scintillation parameters
          scintPhaseX: Math.random() * Math.PI * 2,
          scintPhaseY: Math.random() * Math.PI * 2,
          scintFreqX: 0.5 + Math.random() * 1.5,
          scintFreqY: 0.5 + Math.random() * 1.5,
          scintAmpX: 0.1 + Math.random() * 0.3,
          scintAmpY: 0.1 + Math.random() * 0.3,
          scintAlphaPhase: Math.random() * Math.PI * 2,
          scintAlphaFreq: 0.3 + Math.random() * 0.7,
          // Random dropout parameters — see notes in the other particle factory
          dropoutPhase: Math.random() * Math.PI * 2,
          dropoutFreq: 0.18 + Math.random() * 0.42,
          // Random walk parameters
          walkOffsetX: 0,
          walkOffsetY: 0,
          walkVelocityX: 0,
          walkVelocityY: 0,
        });
      }
    }
  }

  calculateTargetPosition(x, y, sourceColor, targetData) {
    // Blend between keeping position and finding color match
    const proximity = this.config.proximityWeight;

    if (proximity >= 1) {
      return { x, y };
    }

    // Find best matching position in target based on color similarity
    const searchRadius = Math.min(this.width, this.height) * 0.3;
    let bestX = x;
    let bestY = y;
    let bestScore = Infinity;

    const samples = 20;
    for (let i = 0; i < samples; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * searchRadius;
      const testX = x + Math.cos(angle) * dist;
      const testY = y + Math.sin(angle) * dist;

      if (testX < 0 || testX >= this.width || testY < 0 || testY >= this.height)
        continue;

      const targetColor = this.getColorAt(targetData, testX, testY);
      const colorDist = this.colorDistance(sourceColor, targetColor);
      const spatialDist = Math.sqrt((testX - x) ** 2 + (testY - y) ** 2);

      const score = colorDist * (1 - proximity) + spatialDist * proximity;

      if (score < bestScore) {
        bestScore = score;
        bestX = testX;
        bestY = testY;
      }
    }

    return { x: bestX, y: bestY };
  }

  colorDistance(c1, c2) {
    return Math.sqrt(
      (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2,
    );
  }

  reinitializeParticles() {
    if (this.loadedImages.length > 0) {
      this.initializeParticles();
    }
  }

  // Easing functions
  ease(t) {
    switch (this.config.easing) {
      case "easeInOutCubic":
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case "easeInOutQuart":
        return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
      case "easeOutElastic":
        const c4 = (2 * Math.PI) / 3;
        return t === 0
          ? 0
          : t === 1
            ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      default:
        return t;
    }
  }

  // Structurally-driven spatially-varying crossfade
  // Each particle transitions at its own time based on structural similarity + spatial wave
  updateDispersiveCrossfade(progress) {
    const particles = this.particles;
    const len = particles.length;
    const maxSpread = 0.4;

    for (let i = 0; i < len; i++) {
      const particle = particles[i];

      // Per-particle local progress based on its structural delay
      const delay = particle.transitionDelay || 0;
      const localProgress = Math.max(
        0,
        Math.min(1, (progress - delay) / (1 - maxSpread)),
      );

      // Smooth ease-in-out
      const t = localProgress * localProgress * (3 - 2 * localProgress);

      // Particle stays at grid position
      particle.x = particle.sourceX;
      particle.y = particle.sourceY;

      // Smooth color interpolation
      particle.color.r =
        (particle.sourceColor.r +
          (particle.targetColor.r - particle.sourceColor.r) * t) |
        0;
      particle.color.g =
        (particle.sourceColor.g +
          (particle.targetColor.g - particle.sourceColor.g) * t) |
        0;
      particle.color.b =
        (particle.sourceColor.b +
          (particle.targetColor.b - particle.sourceColor.b) * t) |
        0;
      particle.color.a = 1;
      particle.transitionScale = 1;
    }
  }

  update() {
    if (!this.isTransitioning) return;

    const elapsed = Date.now() - this.transitionStartTime;
    this.transitionProgress = Math.min(
      1,
      elapsed / this.config.transitionDuration,
    );

    this.updateDispersiveCrossfade(this.transitionProgress);

    // Transition complete
    if (this.transitionProgress >= 1) {
      this.completeTransition();
    }
  }

  render() {
    // Update fade-in opacity
    if (this.fadeInStartTime > 0 && this.galleryOpacity < 1) {
      const fadeElapsed = Date.now() - this.fadeInStartTime;
      const fadeDuration = 800; // 800ms fade in
      this.galleryOpacity = Math.min(1, fadeElapsed / fadeDuration);
    }

    // Use ImageData for fast bulk pixel manipulation
    if (
      !this.imageBuffer ||
      this.imageBuffer.width !== this.width ||
      this.imageBuffer.height !== this.height
    ) {
      this.imageBuffer = this.ctx.createImageData(this.width, this.height);
    }

    const data = this.imageBuffer.data;
    const width = this.width;
    const height = this.height;

    // Fast buffer clear using typed array
    // Pre-create a single RGBA pixel pattern and fill
    if (!this.clearPattern) {
      this.clearPattern = new Uint32Array([0xfff5f5f5]); // ABGR format (little-endian): A=255, B=245, G=245, R=245
    }
    const data32 = new Uint32Array(data.buffer);
    data32.fill(this.clearPattern[0]);

    // Draw particles as soft circles with chromatic aberration
    // Note: mask is now baked into particle colors, no need to check at render time
    const particleSize = this.config.particleSize;
    const baseRadius = particleSize / 2;
    const softEdge = 0.85; // Start fading at 85% - mostly solid particles
    const fadeMultiplier = this.galleryOpacity; // Apply fade-in
    const isBuilding = this.isBuilding;

    // Chromatic aberration settings - RGB channels offset from center
    const aberrationAmount = 0.3; // Subtle offset for clearer image
    const aberrationAngle = Date.now() * 0.0001; // Slowly rotating aberration

    // Time for scintillation animation
    const time = Date.now() * 0.001;

    // Global breathing effect - very subtle expansion/contraction from center
    const breatheAmount = Math.sin(time * 0.3) * 0.002; // 0.2% scale oscillation
    const breatheCenterX = width / 2;
    const breatheCenterY = height / 2;

    // Determine scintillation intensity based on transition state
    // Full scintillation when at rest, reduced during transitions
    const scintillationIntensity = this.isTransitioning ? 0.3 : 1.0;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const particleAlpha =
        particle.color.a !== undefined ? particle.color.a : 1;

      // During build-up, use buildProgress for fade-in
      const buildAlpha =
        particle.buildProgress !== undefined ? particle.buildProgress : 1;
      if (buildAlpha <= 0) continue;

      // Apply subtle alpha scintillation (breathing effect)
      const alphaScint =
        1 +
        Math.sin(time * particle.scintAlphaFreq + particle.scintAlphaPhase) *
          0.03 *
          scintillationIntensity;
      // Random dropouts — each particle independently fades in and out across
      // ALL phases (build / hold / transition) so the image never reaches a
      // fully-complete state. Smooth sine envelope hides ~a third of particles
      // at any moment, with the missing set rotating continuously.
      const dropoutWave =
        Math.sin(time * particle.dropoutFreq + particle.dropoutPhase);
      const dropoutMultiplier =
        Math.max(0, Math.min(1, (dropoutWave + 0.3) * 2.5));

      const baseAlpha =
        particleAlpha * fadeMultiplier * alphaScint * buildAlpha * dropoutMultiplier;
      if (baseAlpha <= 0) continue;

      // Apply subtle position scintillation (particles gently drift)
      const scintX =
        Math.sin(time * particle.scintFreqX + particle.scintPhaseX) *
        particle.scintAmpX *
        scintillationIntensity;
      const scintY =
        Math.sin(time * particle.scintFreqY + particle.scintPhaseY) *
        particle.scintAmpY *
        scintillationIntensity;

      // Apply global breathing (subtle expansion from center)
      const breatheOffsetX = (particle.x - breatheCenterX) * breatheAmount;
      const breatheOffsetY = (particle.y - breatheCenterY) * breatheAmount;

      // Apply random walk offset (only when not transitioning)
      const walkX = this.isTransitioning ? 0 : particle.walkOffsetX || 0;
      const walkY = this.isTransitioning ? 0 : particle.walkOffsetY || 0;

      const cx = particle.x + scintX + breatheOffsetX + walkX;
      const cy = particle.y + scintY + breatheOffsetY + walkY;

      // Scale radius during build-up or transition
      const buildScale = isBuilding ? 0.3 + 0.7 * buildAlpha * buildAlpha : 1;
      const transScale =
        particle.transitionScale !== undefined ? particle.transitionScale : 1;
      const radius = baseRadius * buildScale * transScale;
      const radiusSq = radius * radius;

      // Chromatic aberration - offset each RGB channel differently
      // Red shifts one way, blue the opposite, green stays centered
      const aberrX = Math.cos(aberrationAngle) * aberrationAmount;
      const aberrY = Math.sin(aberrationAngle) * aberrationAmount;

      // Calculate bounds including aberration offset
      const extRadius = radius + aberrationAmount;
      const minX = Math.max(0, (cx - extRadius) | 0);
      const maxX = Math.min(width - 1, (cx + extRadius) | 0);
      const minY = Math.max(0, (cy - extRadius) | 0);
      const maxY = Math.min(height - 1, (cy + extRadius) | 0);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * width + x) * 4;

          // Red channel - offset in one direction
          const dxR = x - (cx + aberrX);
          const dyR = y - (cy + aberrY);
          const distSqR = dxR * dxR + dyR * dyR;

          // Green channel - centered (no offset)
          const dxG = x - cx;
          const dyG = y - cy;
          const distSqG = dxG * dxG + dyG * dyG;

          // Blue channel - offset opposite direction
          const dxB = x - (cx - aberrX);
          const dyB = y - (cy - aberrY);
          const distSqB = dxB * dxB + dyB * dyB;

          // Calculate alpha for each channel based on distance
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

          // Skip if no channel contributes
          if (alphaR <= 0 && alphaG <= 0 && alphaB <= 0) continue;

          // Apply base alpha to each channel
          alphaR *= baseAlpha;
          alphaG *= baseAlpha;
          alphaB *= baseAlpha;

          // Blend each channel separately
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

    // Single putImageData call - much faster than thousands of fillRect
    this.ctx.putImageData(this.imageBuffer, 0, 0);
  }

  startTransition() {
    if (this.loadedImages.length < 2) return;

    // Prepare target data just-in-time (deferred from init for faster startup)
    this.prepareNextTransition();

    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.transitionProgress = 0;

    console.log(
      `Starting ripple transition: ${this.currentIndex} -> ${this.nextIndex}`,
    );
  }

  completeTransition() {
    this.isTransitioning = false;

    // Reset all particles to full size/opacity with target colors
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.color.a = 1;
      p.transitionScale = 1;
      p.color.r = p.targetColor.r;
      p.color.g = p.targetColor.g;
      p.color.b = p.targetColor.b;
    }

    // After first transition, switch to scattered letter mode
    this.isFirstImage = false;

    // Move to next image pair
    this.currentIndex = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % this.loadedImages.length;

    // Schedule next transition (prepareNextTransition runs just-in-time in startTransition)
    this.scheduleNextTransition();
  }

  prepareNextTransition() {
    const sourceImg = this.loadedImages[this.currentIndex];
    const targetImg = this.loadedImages[this.nextIndex];

    // Sample target with the CURRENT mask (same one the source was rendered with)
    // so FOTU letters are in identical positions for source and target
    const targetData = this.sampleImageData(targetImg, true);

    // NOW randomize mask for the next cycle (won't affect this transition)
    this.randomizeTextMask();

    // Update particle source/target states
    const cellSize = this.config.particleSize;
    const cols = Math.ceil(this.width / cellSize);
    const rows = Math.ceil(this.height / cellSize);
    const numParticles = this.particles.length;

    // --- Pass 1: set source/target colors, compute raw color distance ---
    const rawDelays = new Float32Array(numParticles);

    for (let i = 0; i < numParticles; i++) {
      const particle = this.particles[i];

      // Snap to nearest grid position
      const col = Math.round((particle.sourceX - cellSize / 2) / cellSize);
      const row = Math.round((particle.sourceY - cellSize / 2) / cellSize);
      const gridX = col * cellSize + cellSize / 2;
      const gridY = row * cellSize + cellSize / 2;

      // Source = current on-screen state (no re-sample)
      particle.sourceX = gridX;
      particle.sourceY = gridY;
      particle.x = gridX;
      particle.y = gridY;
      particle.sourceColor = { ...particle.color };

      // Target color
      particle.targetColor = this.getColorAt(targetData, gridX, gridY);
      particle.targetX = gridX;
      particle.targetY = gridY;
      particle.color.a = 1;

      // Reset walk offset
      particle.walkOffsetX = 0;
      particle.walkOffsetY = 0;
      particle.walkVelocityX = 0;
      particle.walkVelocityY = 0;

      // Color distance between source and target (0–1)
      const dr = particle.sourceColor.r - particle.targetColor.r;
      const dg = particle.sourceColor.g - particle.targetColor.g;
      const db = particle.sourceColor.b - particle.targetColor.b;
      rawDelays[i] = Math.sqrt(dr * dr + dg * dg + db * db) / 441; // 441 ≈ sqrt(3)*255
    }

    // --- Pass 2: add directional wave from random seed points ---
    const numSeeds = 2 + Math.floor(Math.random() * 2); // 2–3 seeds
    const seeds = [];
    for (let s = 0; s < numSeeds; s++) {
      seeds.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
      });
    }
    const maxDist = Math.sqrt(
      this.width * this.width + this.height * this.height,
    );

    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      // Find distance to nearest seed
      let minSeedDist = maxDist;
      for (let s = 0; s < numSeeds; s++) {
        const dx = p.sourceX - seeds[s].x;
        const dy = p.sourceY - seeds[s].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minSeedDist) minSeedDist = d;
      }
      // Blend: 60% structural (color distance), 40% spatial wave
      rawDelays[i] = rawDelays[i] * 0.6 + (minSeedDist / maxDist) * 0.4;
    }

    // --- Pass 3: smooth delay field (3 passes of neighbor averaging) ---
    const smoothed = new Float32Array(rawDelays);
    const temp = new Float32Array(numParticles);

    for (let pass = 0; pass < 3; pass++) {
      const src = pass === 0 ? smoothed : pass % 2 === 1 ? temp : smoothed;
      const dst = pass % 2 === 1 ? smoothed : temp;

      for (let i = 0; i < numParticles; i++) {
        let sum = src[i];
        let count = 1;

        // Cardinal neighbors by grid offset
        const col = i % cols;
        if (col > 0) {
          sum += src[i - 1];
          count++;
        }
        if (col < cols - 1 && i + 1 < numParticles) {
          sum += src[i + 1];
          count++;
        }
        if (i - cols >= 0) {
          sum += src[i - cols];
          count++;
        }
        if (i + cols < numParticles) {
          sum += src[i + cols];
          count++;
        }

        dst[i] = sum / count;
      }
    }

    // Use the correct output buffer (after 3 passes: pass0→smoothed, pass1→temp, pass2→smoothed... wait)
    // pass 0: src=smoothed, dst=temp
    // pass 1: src=temp, dst=smoothed
    // pass 2: src=smoothed, dst=temp
    const finalDelays = temp; // after 3 passes (odd count), result is in temp

    // --- Normalize and map to [0, maxSpread] ---
    const maxSpread = 0.4;
    let minVal = Infinity,
      maxVal = -Infinity;
    for (let i = 0; i < numParticles; i++) {
      if (finalDelays[i] < minVal) minVal = finalDelays[i];
      if (finalDelays[i] > maxVal) maxVal = finalDelays[i];
    }
    const range = maxVal - minVal || 1;

    for (let i = 0; i < numParticles; i++) {
      this.particles[i].transitionDelay =
        ((finalDelays[i] - minVal) / range) * maxSpread;
    }
  }

  scheduleNextTransition() {
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
    }

    this.cycleTimeout = setTimeout(() => {
      this.startTransition();
    }, this.config.holdDuration);
  }

  startCycle() {
    // Animation loop handles rendering - just schedule the first transition
    // Start first transition after hold duration
    this.scheduleNextTransition();
  }

  animate() {
    // Render particles (or blank canvas during initial load)
    if (this.particles.length > 0) {
      // Update build-up animation for particles during building phase
      if (this.isBuilding) {
        this.updateBuildProgress();
      }
      // Update random walks when not transitioning for living effect
      if (!this.isTransitioning && !this.isBuilding) {
        this.updateRandomWalks();
      }
      this.update();
      this.render();
    } else if (this.isLoading) {
      // Show blank canvas with background color during initial load
      this.ctx.fillStyle = "#f5f5f5";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Log state transition (only once)
    if (
      !this._loggedReady &&
      !this.isLoading &&
      this.particles.length > 0 &&
      !this.isBuilding
    ) {
      console.log(
        `Gallery ready: ${this.particles.length} particles, opacity: ${this.galleryOpacity.toFixed(2)}`,
      );
      this._loggedReady = true;
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  updateBuildProgress() {
    // Animate particles fading/growing in during build-up phase
    const buildSpeed = 0.12; // How fast each particle reaches full visibility
    const delayDecay = 0.04; // How fast delays count down

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.buildProgress < 1) {
        // Apply delay before starting to appear
        if (p.buildDelay > 0) {
          p.buildDelay -= delayDecay;
        } else {
          // Ease-out for smooth deceleration at the end
          const remaining = 1 - p.buildProgress;
          const easedSpeed = buildSpeed * (0.5 + remaining * 0.5);
          p.buildProgress = Math.min(1, p.buildProgress + easedSpeed);
        }
      }
    }
  }

  updateRandomWalks() {
    // Random walk parameters
    const maxOffset = 1.0; // Maximum distance from home position
    const walkSpeed = 0.15; // How fast particles can move
    const springStrength = 0.03; // How strongly particles are pulled back home
    const randomForce = 0.08; // Strength of random nudges
    const friction = 0.92; // Velocity damping

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Apply random force (random walk step)
      p.walkVelocityX += (Math.random() - 0.5) * randomForce;
      p.walkVelocityY += (Math.random() - 0.5) * randomForce;

      // Apply spring force toward home (0,0 offset)
      p.walkVelocityX -= p.walkOffsetX * springStrength;
      p.walkVelocityY -= p.walkOffsetY * springStrength;

      // Clamp velocity
      const speed = Math.sqrt(p.walkVelocityX ** 2 + p.walkVelocityY ** 2);
      if (speed > walkSpeed) {
        p.walkVelocityX = (p.walkVelocityX / speed) * walkSpeed;
        p.walkVelocityY = (p.walkVelocityY / speed) * walkSpeed;
      }

      // Apply friction
      p.walkVelocityX *= friction;
      p.walkVelocityY *= friction;

      // Update position offset
      p.walkOffsetX += p.walkVelocityX;
      p.walkOffsetY += p.walkVelocityY;

      // Hard clamp to maximum offset (soft boundary)
      const dist = Math.sqrt(p.walkOffsetX ** 2 + p.walkOffsetY ** 2);
      if (dist > maxOffset) {
        p.walkOffsetX = (p.walkOffsetX / dist) * maxOffset;
        p.walkOffsetY = (p.walkOffsetY / dist) * maxOffset;
      }
    }
  }

  // Public API
  setTransitionDuration(ms) {
    this.config.transitionDuration = ms;
  }

  setHoldDuration(ms) {
    this.config.holdDuration = ms;
  }

  triggerTransition() {
    if (!this.isTransitioning) {
      if (this.cycleTimeout) {
        clearTimeout(this.cycleTimeout);
      }
      this.startTransition();
    }
  }

  pause() {
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
      this.cycleTimeout = null;
    }
  }

  resume() {
    if (!this.isTransitioning && !this.cycleTimeout) {
      this.scheduleNextTransition();
    }
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.cycleTimeout) {
      clearTimeout(this.cycleTimeout);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.morphGallery = new ImageMorphGallery({
    transitionDuration: 7000, // Slower fade for gentler transitions
    holdDuration: 5000, // Time to appreciate scintillation at rest
    proximityWeight: 0.8,
    particleSize: 4, // ~4x fewer particles than size 2; lighter on CPU, still readable
  });
});
