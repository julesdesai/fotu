// Image Morphing Gallery - Particle-based transitions inspired by obamify
// Implements: Classic Morph, Dissolve Morph, Voronoi Mosaic

class ImageMorphGallery {
    constructor(options = {}) {
        this.canvas = document.getElementById('morphCanvas');
        this.container = document.querySelector('.hero-image');

        if (!this.canvas || !this.container) {
            console.log('Morph gallery elements not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Configuration
        this.config = {
            transitionDuration: options.transitionDuration || 2500,
            holdDuration: options.holdDuration || 4000,
            transitionMode: options.transitionMode || 'cycle', // 'classic', 'dissolve', 'voronoi', 'cycle'
            galleryPath: options.galleryPath || 'assets/gallery/',
            manifestPath: options.manifestPath || 'assets/gallery/gallery-manifest.json',
            proximityWeight: options.proximityWeight || 0.7,
            voronoiCellSize: options.voronoiCellSize || 12,
            easing: options.easing || 'easeInOutCubic',
            particleSize: options.particleSize || 3,
            // Chaotic transition settings - higher = more asynchronous
            maxSpatialDelay: options.maxSpatialDelay || 0.85  // 85% spread for very async transitions
        };

        // Wave origins for current transition
        this.transitionWaveOrigins = [];

        // State
        this.images = [];
        this.loadedImages = [];
        this.currentIndex = 0;
        this.nextIndex = 1;
        this.particles = [];
        this.voronoiSeeds = [];
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionStartTime = 0;
        this.currentTransitionMode = 'classic';
        this.transitionModes = ['classic', 'dissolve', 'voronoi'];
        this.transitionModeIndex = 0;
        this.animationId = null;
        this.cycleTimeout = null;
        this.isLoading = true;
        this.galleryOpacity = 0;  // Fade in gallery when ready
        this.fadeInStartTime = 0;

        // Text mask for negative space
        this.textMask = null;
        this.maskCanvas = null;
        this.maskCtx = null;
        this.textConfig = {
            text: 'FOTU',
            fontFamily: 'Arial, sans-serif',
            fontWeight: '300',  // Slightly bolder for more visibility
            baseFontSize: 0
        };

        this.init();
    }

    async init() {
        this.setupCanvas();

        // Start animation loop
        this.isLoading = true;
        this.isFirstImage = true;  // Track if we're on the first image (clean FOTU)
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
            console.log('Initializing particles...');
            await this.initializeParticlesAsync();
            console.log('Particles initialized, transitioning to gallery view');

            await this.yieldToFrame();

            this.fadeInStartTime = Date.now();
            this.isLoading = false;
            this.container.classList.add('gallery-ready');
            console.log('Gallery ready - showing image', this.currentIndex, 'waiting for first transition to image', this.nextIndex);

            this.startCycle();
        } else if (this.loadedImages.length === 1) {
            await this.initializeParticlesAsync();
            await this.yieldToFrame();
            this.fadeInStartTime = Date.now();
            this.isLoading = false;
            this.container.classList.add('gallery-ready');
        }
    }

    createTextMask() {
        // Create offscreen canvas for text mask
        if (!this.maskCanvas) {
            this.maskCanvas = document.createElement('canvas');
        }
        this.maskCanvas.width = this.width;
        this.maskCanvas.height = this.height;
        this.maskCtx = this.maskCanvas.getContext('2d');

        // Calculate base font size - larger for more visibility
        this.textConfig.baseFontSize = Math.min(this.height * 0.35, this.width * 0.18);

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
        ctx.fillStyle = 'white';

        if (centered) {
            // CENTERED MODE: Clean, equally-spaced FOTU in center
            const fontSize = this.textConfig.baseFontSize * 1.2;
            ctx.font = `${this.textConfig.fontWeight} ${fontSize}px ${this.textConfig.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

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
                const setScale = 0.6 + (set * 0.3);

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
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
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
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.width, this.height);
        };

        resize();
        window.addEventListener('resize', () => {
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
            console.warn('Could not fetch manifest, using fallback image list');
            // Fallback for local file:// access
            this.images = [
                'sample1.jpeg',
                'sample2.jpeg',
                'sample3.jpeg',
                'sample4.jpeg',
                'sample5.jpeg'
            ];
        }
    }

    async loadAllImages() {
        // Always load home.png first (the starting image)
        const homeImage = await this.loadImage('home.png');

        if (!homeImage) {
            console.warn('home.png not found!');
        }

        // Remove home.png from manifest list to avoid loading twice
        const otherImageNames = this.images.filter(f => f !== 'home.png');

        // Load all other images
        const loadPromises = otherImageNames.map(filename => this.loadImage(filename));
        const results = await Promise.all(loadPromises);
        const otherImages = results.filter(img => img !== null);

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
            [this.loadedImages[i], this.loadedImages[j]] = [this.loadedImages[j], this.loadedImages[i]];
        }
        console.log('Image sequence randomized (home.png stays first)');
    }

    async loadImage(filename) {
        try {
            const response = await fetch(this.config.galleryPath + filename);
            if (!response.ok) throw new Error('Failed to fetch');

            const blob = await response.blob();

            // Use createImageBitmap for offscreen processing - no visual flash
            // Don't pre-scale here to preserve original aspect ratio
            if (typeof createImageBitmap !== 'undefined') {
                const bitmap = await createImageBitmap(blob);
                console.log(`Loaded: ${filename}`);
                return bitmap;
            }

            // Fallback for older browsers
            const img = new Image();
            img.src = URL.createObjectURL(blob);
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            URL.revokeObjectURL(img.src);
            console.log(`Loaded: ${filename}`);
            return img;
        } catch (e) {
            console.warn(`Failed to load: ${filename}`, e);
            return null;
        }
    }

    sampleImageData(img, applyMask = false) {
        // Reuse canvas if possible to avoid allocation overhead
        if (!this._sampleCanvas) {
            this._sampleCanvas = document.createElement('canvas');
            this._sampleCtx = this._sampleCanvas.getContext('2d', { willReadFrequently: true });
        }

        const tempCanvas = this._sampleCanvas;
        const tempCtx = this._sampleCtx;

        // Sample size for color sampling - larger = more detail
        const sampleWidth = Math.min(this.width, 400);
        const sampleHeight = Math.min(this.height, 300);

        tempCanvas.width = sampleWidth;
        tempCanvas.height = sampleHeight;

        // Fill with background color first (for pillarboxing)
        tempCtx.fillStyle = '#f5f5f5';
        tempCtx.fillRect(0, 0, sampleWidth, sampleHeight);

        // Always fill vertical height, preserve aspect ratio, pillarbox sides if needed
        const imgAspect = img.width / img.height;

        const drawHeight = sampleHeight;
        const drawWidth = sampleHeight * imgAspect;
        const drawX = (sampleWidth - drawWidth) / 2;
        const drawY = 0;

        tempCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // BAKE THE MASK INTO THE IMAGE DATA using canvas compositing
        if (applyMask && this.maskCanvas) {
            tempCtx.globalCompositeOperation = 'destination-out';
            tempCtx.drawImage(this.maskCanvas, 0, 0, sampleWidth, sampleHeight);
            tempCtx.globalCompositeOperation = 'destination-over';
            tempCtx.fillStyle = '#f5f5f5';
            tempCtx.fillRect(0, 0, sampleWidth, sampleHeight);
            tempCtx.globalCompositeOperation = 'source-over';
        }

        return {
            data: tempCtx.getImageData(0, 0, sampleWidth, sampleHeight),
            width: sampleWidth,
            height: sampleHeight
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
        const px = Math.floor(x * imageData.width / this.width);
        const py = Math.floor(y * imageData.height / this.height);

        if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) {
            return { r: 60, g: 60, b: 60, a: 0 };
        }

        const idx = (py * imageData.width + px) * 4;

        // Lift blacks to muted gray - map [0-255] to [minBrightness-255]
        const minBrightness = 80;  // Darkest value (~30% gray, much more muted blacks)
        const range = 255 - minBrightness;

        const r = imageData.data.data[idx];
        const g = imageData.data.data[idx + 1];
        const b = imageData.data.data[idx + 2];

        return {
            r: Math.round(minBrightness + (r / 255) * range),
            g: Math.round(minBrightness + (g / 255) * range),
            b: Math.round(minBrightness + (b / 255) * range),
            a: imageData.data.data[idx + 3] / 255
        };
    }

    // Helper for yielding to browser with guaranteed frame paint
    // Double RAF ensures the browser actually paints before continuing
    yieldToFrame() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }

    async initializeParticlesAsync() {
        this.particles = [];
        this.isBuilding = true;  // Flag to show we're in build-up mode

        const sourceImg = this.loadedImages[this.currentIndex];

        // First image gets centered FOTU, subsequent get scattered
        this.randomizeTextMask(this.isFirstImage);
        await this.yieldToFrame();

        console.log('Building image progressively...');

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
        const chunkSize = 1500;  // Particles per frame - larger chunks for smoother build
        let builtCount = 0;

        // Switch from loading to particle rendering
        this.isLoading = false;
        this.isBuilding = true;
        this.galleryOpacity = 1;  // Full opacity for build-up

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
                voronoiSeed: null,
                // Scintillation parameters
                scintPhaseX: Math.random() * Math.PI * 2,
                scintPhaseY: Math.random() * Math.PI * 2,
                scintFreqX: 0.5 + Math.random() * 1.5,
                scintFreqY: 0.5 + Math.random() * 1.5,
                scintAmpX: 0.3 + Math.random() * 0.7,
                scintAmpY: 0.3 + Math.random() * 0.7,
                scintAlphaPhase: Math.random() * Math.PI * 2,
                scintAlphaFreq: 0.3 + Math.random() * 0.7,
                // Random walk parameters
                walkOffsetX: 0,
                walkOffsetY: 0,
                walkVelocityX: 0,
                walkVelocityY: 0,
                // Build-up animation - stagger delays for wave effect
                buildProgress: 0,
                buildDelay: 0.1 + Math.random() * 0.5
            });

            builtCount++;

            // Yield every chunk to render the progressive build-up
            if (builtCount % chunkSize === 0) {
                await this.yieldToFrame();
            }
        }

        console.log(`Built ${this.particles.length} particles (${cols}x${rows} grid)`);

        // Continue animation while particles finish their fade-in
        // isBuilding remains true until all particles are fully visible
        const waitForBuildComplete = () => {
            return new Promise(resolve => {
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
        console.log('Build-up complete');
        this.initializeVoronoiSeeds();

        // Now prepare the first transition target
        console.log('Preparing first transition target...');
        await this.yieldToFrame();
        this.prepareNextTransition();
        await this.yieldToFrame();
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
                    sourceX: x, sourceY: y, sourceColor: sourceColor,
                    targetX: x, targetY: y, targetColor: sourceColor,
                    x: x, y: y,
                    color: { ...sourceColor },
                    size: cellSize,
                    delay: Math.random() * 0.15,
                    randomOffsetX: (Math.random() - 0.5) * 2,
                    randomOffsetY: (Math.random() - 0.5) * 2,
                    voronoiSeed: null,
                    // Scintillation parameters
                    scintPhaseX: Math.random() * Math.PI * 2,
                    scintPhaseY: Math.random() * Math.PI * 2,
                    scintFreqX: 0.5 + Math.random() * 1.5,
                    scintFreqY: 0.5 + Math.random() * 1.5,
                    scintAmpX: 0.3 + Math.random() * 0.7,
                    scintAmpY: 0.3 + Math.random() * 0.7,
                    scintAlphaPhase: Math.random() * Math.PI * 2,
                    scintAlphaFreq: 0.3 + Math.random() * 0.7,
                    // Random walk parameters
                    walkOffsetX: 0,
                    walkOffsetY: 0,
                    walkVelocityX: 0,
                    walkVelocityY: 0
                });
            }
        }

        this.initializeVoronoiSeeds();
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

            if (testX < 0 || testX >= this.width || testY < 0 || testY >= this.height) continue;

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
            (c1.r - c2.r) ** 2 +
            (c1.g - c2.g) ** 2 +
            (c1.b - c2.b) ** 2
        );
    }

    initializeVoronoiSeeds() {
        this.voronoiSeeds = [];
        const cellSize = this.config.voronoiCellSize;
        const cols = Math.ceil(this.width / cellSize);
        const rows = Math.ceil(this.height / cellSize);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Jittered grid for more organic Voronoi
                const x = (col + 0.5 + (Math.random() - 0.5) * 0.8) * cellSize;
                const y = (row + 0.5 + (Math.random() - 0.5) * 0.8) * cellSize;

                this.voronoiSeeds.push({
                    x: x,
                    y: y,
                    sourceX: x,
                    sourceY: y,
                    targetX: x + (Math.random() - 0.5) * cellSize * 2,
                    targetY: y + (Math.random() - 0.5) * cellSize * 2,
                    color: { r: 128, g: 128, b: 128, a: 1 }
                });
            }
        }

        // Assign particles to seeds
        this.assignParticlesToSeeds();
    }

    assignParticlesToSeeds() {
        for (const particle of this.particles) {
            let nearestSeed = null;
            let nearestDist = Infinity;

            for (const seed of this.voronoiSeeds) {
                const dist = Math.sqrt(
                    (particle.x - seed.x) ** 2 +
                    (particle.y - seed.y) ** 2
                );
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestSeed = seed;
                }
            }

            particle.voronoiSeed = nearestSeed;
        }
    }

    reinitializeParticles() {
        if (this.loadedImages.length > 0) {
            this.initializeParticles();
        }
    }

    // Easing functions
    ease(t) {
        switch (this.config.easing) {
            case 'easeInOutCubic':
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            case 'easeInOutQuart':
                return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
            case 'easeOutElastic':
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 :
                    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            default:
                return t;
        }
    }

    // Transition: Classic Morph (particles fly from source to target)
    updateClassicMorph(progress) {
        const particles = this.particles;
        const len = particles.length;
        const maxDelay = this.config.maxSpatialDelay;

        for (let i = 0; i < len; i++) {
            const particle = particles[i];

            // Use spatial delay for organic wave-like transition
            const delay = particle.spatialDelay || particle.delay || 0;
            const adjustedProgress = Math.max(0, Math.min(1,
                (progress - delay) / (1 - maxDelay)
            ));
            const easedAdjusted = this.ease(adjustedProgress);

            // Linear position interpolation
            particle.x = particle.sourceX + (particle.targetX - particle.sourceX) * easedAdjusted;
            particle.y = particle.sourceY + (particle.targetY - particle.sourceY) * easedAdjusted;

            // Interpolate color (avoid Math.round in hot loop)
            particle.color.r = (particle.sourceColor.r + (particle.targetColor.r - particle.sourceColor.r) * easedAdjusted) | 0;
            particle.color.g = (particle.sourceColor.g + (particle.targetColor.g - particle.sourceColor.g) * easedAdjusted) | 0;
            particle.color.b = (particle.sourceColor.b + (particle.targetColor.b - particle.sourceColor.b) * easedAdjusted) | 0;
        }
    }

    // Transition: Dissolve Morph (fade and scatter)
    updateDissolveMorph(progress) {
        const maxDelay = this.config.maxSpatialDelay;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            // Use spatial delay for organic wave-like transition
            const delay = particle.spatialDelay || particle.delay || 0;
            const adjustedProgress = Math.max(0, Math.min(1,
                (progress - delay) / (1 - maxDelay)
            ));

            // First half: scatter and fade out from source
            // Second half: gather and fade in to target
            if (adjustedProgress < 0.5) {
                const t = adjustedProgress * 2;
                const scatter = Math.sin(t * Math.PI) * 50;

                // Use pre-calculated random offsets instead of Math.random()
                particle.x = particle.sourceX + particle.randomOffsetX * scatter;
                particle.y = particle.sourceY + particle.randomOffsetY * scatter;
                particle.color.a = 1 - t;

                particle.color.r = particle.sourceColor.r;
                particle.color.g = particle.sourceColor.g;
                particle.color.b = particle.sourceColor.b;
            } else {
                const t = (adjustedProgress - 0.5) * 2;
                const scatter = Math.sin((1 - t) * Math.PI) * 50;

                particle.x = particle.targetX + particle.randomOffsetX * scatter;
                particle.y = particle.targetY + particle.randomOffsetY * scatter;
                particle.color.a = t;

                particle.color.r = particle.targetColor.r;
                particle.color.g = particle.targetColor.g;
                particle.color.b = particle.targetColor.b;
            }
        }
    }

    // Transition: Voronoi Mosaic (visible cell boundaries)
    updateVoronoiMorph(progress) {
        const maxDelay = this.config.maxSpatialDelay;

        // Update seed positions (seeds move uniformly)
        const easedProgress = this.ease(progress);
        for (let i = 0; i < this.voronoiSeeds.length; i++) {
            const seed = this.voronoiSeeds[i];
            seed.x = seed.sourceX + (seed.targetX - seed.sourceX) * easedProgress;
            seed.y = seed.sourceY + (seed.targetY - seed.sourceY) * easedProgress;
        }

        // Pre-calculate jitter once
        const jitter = Math.sin(progress * Math.PI) * 3;

        // Update particles based on their seed with spatial delay
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            // Use spatial delay for organic wave-like transition
            const delay = particle.spatialDelay || particle.delay || 0;
            const adjustedProgress = Math.max(0, Math.min(1,
                (progress - delay) / (1 - maxDelay)
            ));
            const particleEased = this.ease(adjustedProgress);

            if (particle.voronoiSeed) {
                const seed = particle.voronoiSeed;

                // Particle moves relative to seed, but with its own timing
                const offsetX = particle.sourceX - seed.sourceX;
                const offsetY = particle.sourceY - seed.sourceY;

                // Blend between source position and seed-relative position based on particle's progress
                const targetX = seed.x + offsetX + particle.randomOffsetX * jitter;
                const targetY = seed.y + offsetY + particle.randomOffsetY * jitter;

                particle.x = particle.sourceX + (targetX - particle.sourceX) * particleEased;
                particle.y = particle.sourceY + (targetY - particle.sourceY) * particleEased;
            }

            // Interpolate color with spatial delay
            particle.color.r = (particle.sourceColor.r + (particle.targetColor.r - particle.sourceColor.r) * particleEased) | 0;
            particle.color.g = (particle.sourceColor.g + (particle.targetColor.g - particle.sourceColor.g) * particleEased) | 0;
            particle.color.b = (particle.sourceColor.b + (particle.targetColor.b - particle.sourceColor.b) * particleEased) | 0;
            particle.color.a = 1;
        }
    }

    update() {
        if (!this.isTransitioning) return;

        const elapsed = Date.now() - this.transitionStartTime;
        this.transitionProgress = Math.min(1, elapsed / this.config.transitionDuration);

        // Update based on current transition mode
        switch (this.currentTransitionMode) {
            case 'classic':
                this.updateClassicMorph(this.transitionProgress);
                break;
            case 'dissolve':
                this.updateDissolveMorph(this.transitionProgress);
                break;
            case 'voronoi':
                this.updateVoronoiMorph(this.transitionProgress);
                break;
        }

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
        if (!this.imageBuffer || this.imageBuffer.width !== this.width || this.imageBuffer.height !== this.height) {
            this.imageBuffer = this.ctx.createImageData(this.width, this.height);
        }

        const data = this.imageBuffer.data;
        const width = this.width;
        const height = this.height;

        // Fast buffer clear using typed array
        // Pre-create a single RGBA pixel pattern and fill
        if (!this.clearPattern) {
            this.clearPattern = new Uint32Array([0xFFF5F5F5]); // ABGR format (little-endian): A=255, B=245, G=245, R=245
        }
        const data32 = new Uint32Array(data.buffer);
        data32.fill(this.clearPattern[0]);

        // Draw particles as soft circles with chromatic aberration
        // Note: mask is now baked into particle colors, no need to check at render time
        const particleSize = this.config.particleSize;
        const baseRadius = particleSize / 2;
        const softEdge = 0.7; // Start fading at 70% - more solid particles for clearer image
        const fadeMultiplier = this.galleryOpacity;  // Apply fade-in
        const isBuilding = this.isBuilding;

        // Chromatic aberration settings - RGB channels offset from center
        const aberrationAmount = 0.8; // Pixels of offset
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
            const particleAlpha = particle.color.a !== undefined ? particle.color.a : 1;

            // During build-up, use buildProgress for fade-in
            const buildAlpha = particle.buildProgress !== undefined ? particle.buildProgress : 1;
            if (buildAlpha <= 0) continue;

            // Apply subtle alpha scintillation (breathing effect)
            const alphaScint = 1 + Math.sin(time * particle.scintAlphaFreq + particle.scintAlphaPhase) * 0.03 * scintillationIntensity;
            const baseAlpha = particleAlpha * fadeMultiplier * alphaScint * buildAlpha;
            if (baseAlpha <= 0) continue;

            // Apply subtle position scintillation (particles gently drift)
            const scintX = Math.sin(time * particle.scintFreqX + particle.scintPhaseX) * particle.scintAmpX * scintillationIntensity;
            const scintY = Math.sin(time * particle.scintFreqY + particle.scintPhaseY) * particle.scintAmpY * scintillationIntensity;

            // Apply global breathing (subtle expansion from center)
            const breatheOffsetX = (particle.x - breatheCenterX) * breatheAmount;
            const breatheOffsetY = (particle.y - breatheCenterY) * breatheAmount;

            // Apply random walk offset (only when not transitioning)
            const walkX = this.isTransitioning ? 0 : (particle.walkOffsetX || 0);
            const walkY = this.isTransitioning ? 0 : (particle.walkOffsetY || 0);

            const cx = particle.x + scintX + breatheOffsetX + walkX;
            const cy = particle.y + scintY + breatheOffsetY + walkY;

            // During build-up, scale radius from small to full
            // Use eased buildAlpha for smoother growth
            const buildScale = isBuilding ? (0.3 + 0.7 * buildAlpha * buildAlpha) : 1;
            const radius = baseRadius * buildScale;
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
                    let alphaR = 0, alphaG = 0, alphaB = 0;

                    if (distSqR <= radiusSq) {
                        const dist = Math.sqrt(distSqR);
                        alphaR = dist > radius * softEdge
                            ? 1 - (dist - radius * softEdge) / (radius * (1 - softEdge))
                            : 1;
                    }

                    if (distSqG <= radiusSq) {
                        const dist = Math.sqrt(distSqG);
                        alphaG = dist > radius * softEdge
                            ? 1 - (dist - radius * softEdge) / (radius * (1 - softEdge))
                            : 1;
                    }

                    if (distSqB <= radiusSq) {
                        const dist = Math.sqrt(distSqB);
                        alphaB = dist > radius * softEdge
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
                        data[idx] = (particle.color.r * alphaR + data[idx] * (1 - alphaR)) | 0;
                    }
                    if (alphaG > 0.01) {
                        data[idx + 1] = (particle.color.g * alphaG + data[idx + 1] * (1 - alphaG)) | 0;
                    }
                    if (alphaB > 0.01) {
                        data[idx + 2] = (particle.color.b * alphaB + data[idx + 2] * (1 - alphaB)) | 0;
                    }
                    data[idx + 3] = 255;
                }
            }
        }

        // Single putImageData call - much faster than thousands of fillRect
        this.ctx.putImageData(this.imageBuffer, 0, 0);
    }

    renderVoronoiCells() {
        const progress = this.transitionProgress;
        const cellOpacity = Math.sin(progress * Math.PI) * 0.3;

        this.ctx.strokeStyle = `rgba(255, 255, 255, ${cellOpacity})`;
        this.ctx.lineWidth = 1;

        // Simple cell boundary rendering using seed positions
        for (const seed of this.voronoiSeeds) {
            this.ctx.beginPath();
            this.ctx.arc(seed.x, seed.y, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${cellOpacity * 0.5})`;
            this.ctx.fill();
        }
    }

    generateSpatialDelays() {
        // Chaotic, organic spatial delays - like watching mold grow or fire spread
        // Highly disordered with unpredictable patterns

        const particles = this.particles;
        const numParticles = particles.length;
        if (numParticles === 0) return;

        const maxDelay = this.config.maxSpatialDelay;
        const time = Date.now() * 0.001;

        // Create chaos seeds - random points with random "infection" times
        const numSeeds = 15 + Math.floor(Math.random() * 20); // 15-35 seeds
        const seeds = [];
        for (let i = 0; i < numSeeds; i++) {
            seeds.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                startDelay: Math.random() * maxDelay * 0.8,
                influence: 30 + Math.random() * 150, // How far this seed reaches
                type: Math.random() // Different seed behaviors
            });
        }

        // Pre-generate random "islands" - regions that transition at completely different times
        const numIslands = 5 + Math.floor(Math.random() * 8);
        const islands = [];
        for (let i = 0; i < numIslands; i++) {
            islands.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: 20 + Math.random() * 80,
                delay: Math.random() * maxDelay,
                strength: 0.5 + Math.random() * 0.5
            });
        }

        for (let i = 0; i < numParticles; i++) {
            const p = particles[i];
            const px = p.x;
            const py = p.y;

            // Start with pure chaos - random base delay
            let delay = Math.random() * maxDelay * 0.3;

            // Find influence from nearest seeds (take top 3 nearest)
            const seedDistances = seeds.map(s => ({
                seed: s,
                dist: Math.sqrt((px - s.x) ** 2 + (py - s.y) ** 2)
            })).sort((a, b) => a.dist - b.dist).slice(0, 3);

            for (const { seed, dist } of seedDistances) {
                if (dist < seed.influence) {
                    // Within influence radius - blend toward seed's timing
                    const influence = 1 - (dist / seed.influence);
                    const seedContribution = seed.startDelay * influence * 0.4;

                    if (seed.type < 0.3) {
                        // Fast spreader
                        delay = Math.min(delay, seedContribution);
                    } else if (seed.type < 0.6) {
                        // Slow spreader
                        delay = Math.max(delay, seedContribution + dist * 0.002);
                    } else {
                        // Chaotic mixer
                        delay += (seedContribution - delay) * influence * 0.5;
                    }
                }
            }

            // Check if in an island - islands override local behavior
            for (const island of islands) {
                const dist = Math.sqrt((px - island.x) ** 2 + (py - island.y) ** 2);
                if (dist < island.radius) {
                    const blend = (1 - dist / island.radius) * island.strength;
                    delay = delay * (1 - blend) + island.delay * blend;
                }
            }

            // Multi-scale fractal noise for organic variation
            const n1 = Math.sin(px * 0.02 + py * 0.015 + time) * Math.cos(py * 0.025 - px * 0.01);
            const n2 = Math.sin(px * 0.05 - py * 0.04 + time * 1.3) * 0.5;
            const n3 = Math.sin(px * 0.1 + py * 0.08) * Math.sin(py * 0.12 - px * 0.07) * 0.3;
            const n4 = (Math.random() - 0.5) * 0.15; // Pure randomness

            const fractalNoise = (n1 + n2 + n3 + n4) * maxDelay * 0.3;
            delay += fractalNoise;

            // Sporadic "late bloomers" - random particles that resist much longer
            if (Math.random() > 0.95) {
                delay = maxDelay * (0.7 + Math.random() * 0.3);
            }

            // Sporadic "early birds" - random particles that transition immediately
            if (Math.random() > 0.97) {
                delay = Math.random() * maxDelay * 0.1;
            }

            // Sharp discontinuities - quantize some particles to create cellular boundaries
            if (Math.random() > 0.7) {
                delay = Math.round(delay * 6) / 6 * maxDelay;
            }

            // Final clamp
            p.spatialDelay = Math.max(0, Math.min(maxDelay, delay));
        }

        // Second pass: create local clustering - neighbors influence each other slightly
        // This creates organic "blobs" without being too uniform
        const clusterInfluence = 0.15;
        const tempDelays = particles.map(p => p.spatialDelay);

        for (let i = 0; i < numParticles; i++) {
            const p = particles[i];
            let neighborSum = 0;
            let neighborCount = 0;

            // Sample a few random neighbors (not all - too slow)
            for (let j = 0; j < 5; j++) {
                const ni = Math.floor(Math.random() * numParticles);
                const neighbor = particles[ni];
                const dist = Math.sqrt((p.x - neighbor.x) ** 2 + (p.y - neighbor.y) ** 2);
                if (dist < 30) {
                    neighborSum += tempDelays[ni];
                    neighborCount++;
                }
            }

            if (neighborCount > 0) {
                const neighborAvg = neighborSum / neighborCount;
                p.spatialDelay = p.spatialDelay * (1 - clusterInfluence) + neighborAvg * clusterInfluence;
            }
        }
    }

    startTransition() {
        if (this.loadedImages.length < 2) return;

        // Generate new spatial delays for this transition (organic wave pattern)
        this.generateSpatialDelays();

        // Note: mask is already baked into target image data by prepareNextTransition()
        // The letter positions will morph along with the image transition

        this.isTransitioning = true;
        this.transitionStartTime = Date.now();
        this.transitionProgress = 0;

        // Cycle through transition modes
        if (this.config.transitionMode === 'cycle') {
            this.currentTransitionMode = this.transitionModes[this.transitionModeIndex];
            this.transitionModeIndex = (this.transitionModeIndex + 1) % this.transitionModes.length;
        } else {
            this.currentTransitionMode = this.config.transitionMode;
        }

        console.log(`Starting ${this.currentTransitionMode} transition: ${this.currentIndex} -> ${this.nextIndex}`);
    }

    completeTransition() {
        this.isTransitioning = false;

        // After first transition, switch to scattered letter mode
        this.isFirstImage = false;

        // Move to next image pair
        this.currentIndex = this.nextIndex;
        this.nextIndex = (this.nextIndex + 1) % this.loadedImages.length;

        // Reinitialize particles for next transition
        this.prepareNextTransition();

        // Schedule next transition
        this.scheduleNextTransition();
    }

    prepareNextTransition() {
        const sourceImg = this.loadedImages[this.currentIndex];
        const targetImg = this.loadedImages[this.nextIndex];

        // Source uses current mask (already baked into current particle colors)
        // We don't need to re-sample source - particles already have those colors

        // Generate NEW random mask for the target image
        this.randomizeTextMask();

        // Sample target with the new mask baked in
        const targetData = this.sampleImageData(targetImg, true);

        // Update particle source/target states
        for (const particle of this.particles) {
            // Current position becomes new source
            particle.sourceX = particle.x;
            particle.sourceY = particle.y;
            particle.sourceColor = { ...particle.color };

            // Calculate new target
            const targetColor = this.getColorAt(targetData, particle.sourceX, particle.sourceY);
            const targetPos = this.calculateTargetPosition(
                particle.sourceX, particle.sourceY,
                particle.sourceColor, targetData
            );

            particle.targetX = targetPos.x;
            particle.targetY = targetPos.y;
            particle.targetColor = targetColor;
            particle.color.a = 1;
        }

        // Update Voronoi seeds
        for (const seed of this.voronoiSeeds) {
            seed.sourceX = seed.x;
            seed.sourceY = seed.y;
            seed.targetX = seed.sourceX + (Math.random() - 0.5) * this.config.voronoiCellSize * 2;
            seed.targetY = seed.sourceY + (Math.random() - 0.5) * this.config.voronoiCellSize * 2;
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
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // Log state transition (only once)
        if (!this._loggedReady && !this.isLoading && this.particles.length > 0 && !this.isBuilding) {
            console.log(`Gallery ready: ${this.particles.length} particles, opacity: ${this.galleryOpacity.toFixed(2)}`);
            this._loggedReady = true;
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateBuildProgress() {
        // Animate particles fading/growing in during build-up phase
        const buildSpeed = 0.06; // How fast each particle reaches full visibility
        const delayDecay = 0.016; // How fast delays count down (60fps = ~1 second total)

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
        const maxOffset = 2.5;        // Maximum distance from home position
        const walkSpeed = 0.15;       // How fast particles can move
        const springStrength = 0.03;  // How strongly particles are pulled back home
        const randomForce = 0.08;     // Strength of random nudges
        const friction = 0.92;        // Velocity damping

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
    setTransitionMode(mode) {
        if (['classic', 'dissolve', 'voronoi', 'cycle'].includes(mode)) {
            this.config.transitionMode = mode;
        }
    }

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
document.addEventListener('DOMContentLoaded', () => {
    window.morphGallery = new ImageMorphGallery({
        transitionDuration: 5000,  // Longer for more dramatic async effect
        holdDuration: 5000,        // Time to appreciate scintillation at rest
        transitionMode: 'cycle',
        proximityWeight: 0.8,
        particleSize: 3,           // Balance between detail and performance
        // Chaotic transition settings
        maxSpatialDelay: 0.85     // 85% spread - very asynchronous, some particles much later
    });
});
