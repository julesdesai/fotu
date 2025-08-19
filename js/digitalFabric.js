// Digital Fabric simulation for the homepage

class DigitalFabric {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match its container
        const rect = this.canvas.getBoundingClientRect();
        this.width = this.canvas.width = rect.width || window.innerWidth;
        this.height = this.canvas.height = rect.height || window.innerHeight;
        
        console.log('Canvas initialized:', this.width, 'x', this.height);
        
        this.time = 0;
        this.threads = [];
        this.mouseX = this.width / 2;
        this.mouseY = this.height / 2;
        this.isHovered = false;
        
        // Unified color palette system
        this.colorTime = 0;
        this.currentPalette = null;
        this.paletteTransitionTime = 0;
        this.palettes = [];
        this.paletteIndex = 0;
        
        // Gallery integration system
        this.gallery = {
            images: [],
            currentImageIndex: 0,
            lastImageTime: 0,
            imageInterval: 30000, // 30 seconds between images
            currentImage: null,
            isProcessingImage: false,
            imageCanvas: null,
            imageCtx: null,
            edges: [],
            transformationPhase: 'idle', // idle, loading, showing, decaying, edges, merging, relaxing
            imageOpacity: 0,
            imageScale: 1,
            imageShowStartTime: 0,
            imageOffsetX: 0,
            imageOffsetY: 0,
            currentThreshold: 25,
            edgeEmergence: 0
        };
        
        // Edge detection and transformation
        this.edgeThreads = [];
        this.originalThreads = [];
        this.transformationProgress = 0;
        
        this.initFabric();
        this.initEventListeners();
        this.loadGallery();
        this.animate();
    }
    
    initFabric() {
        // Create unified color palettes
        this.initColorPalettes();
        this.currentPalette = this.palettes[0];
        
        // Create a grid of fabric threads
        const spacing = 20;
        
        // Horizontal threads
        for (let y = 0; y < this.height + spacing; y += spacing) {
            this.threads.push({
                type: 'horizontal',
                baseY: y,
                points: this.createThreadPoints(y, true),
                phase: Math.random() * Math.PI * 2,
                colorPhase: Math.random() * Math.PI * 2,
                colorSpeed: 0.8 + Math.random() * 0.4, // More controlled speed variation
                hueVariation: (Math.random() - 0.5) * 40, // ±20° hue variation
                saturationVariation: (Math.random() - 0.5) * 20, // ±10% saturation variation
                lightnessVariation: (Math.random() - 0.5) * 15 // ±7.5% lightness variation
            });
        }
        
        // Vertical threads
        for (let x = 0; x < this.width + spacing; x += spacing) {
            this.threads.push({
                type: 'vertical',
                baseX: x,
                points: this.createThreadPoints(x, false),
                phase: Math.random() * Math.PI * 2,
                colorPhase: Math.random() * Math.PI * 2,
                colorSpeed: 0.8 + Math.random() * 0.4,
                hueVariation: (Math.random() - 0.5) * 40,
                saturationVariation: (Math.random() - 0.5) * 20,
                lightnessVariation: (Math.random() - 0.5) * 15
            });
        }
    }
    
    initColorPalettes() {
        // Unified color palettes with thematic coherence
        this.palettes = [
            // Dawn Palette - Warm morning colors
            {
                name: 'dawn',
                baseHue: 15, // Orange-pink base
                hueRange: 45, // From deep red to yellow
                baseSaturation: 75,
                baseLightness: 65,
                trajectory: 'sunrise', // Gradually moves from cool to warm
                period: 120, // 2 minute cycle
                description: 'Soft morning light with gentle warmth'
            },
            
            // Ocean Palette - Cool blue-green spectrum
            {
                name: 'ocean',
                baseHue: 195, // Cyan-blue base
                hueRange: 60, // From blue to green
                baseSaturation: 70,
                baseLightness: 50,
                trajectory: 'wave', // Oscillating like ocean waves
                period: 100,
                description: 'Deep ocean currents and tides'
            },
            
            // Forest Palette - Natural greens
            {
                name: 'forest',
                baseHue: 120, // Green base
                hueRange: 40, // Yellow-green to blue-green
                baseSaturation: 65,
                baseLightness: 45,
                trajectory: 'growth', // Seasonal growth cycle
                period: 150,
                description: 'Living forest with seasonal changes'
            },
            
            // Sunset Palette - Warm evening colors
            {
                name: 'sunset',
                baseHue: 300, // Purple-pink base
                hueRange: 90, // Purple through red to orange
                baseSaturation: 85,
                baseLightness: 60,
                trajectory: 'descent', // Sun setting motion
                period: 90,
                description: 'Golden hour transitioning to twilight'
            },
            
            // Monochrome Palette - Single hue variations
            {
                name: 'monochrome',
                baseHue: 220, // Blue base
                hueRange: 20, // Minimal hue variation
                baseSaturation: 50,
                baseLightness: 50,
                trajectory: 'pulse', // Intensity variations
                period: 80,
                description: 'Subtle tonal variations in blue'
            }
        ];
    }
    
    async loadGallery() {
        console.log('=== GALLERY LOADING START ===');
        
        // Embedded gallery configuration  
        const manifest = {
            images: ['sample1.jpeg', 'sample2.jpeg', 'sample3.jpeg', 'sample4.jpeg', 'sample5.jpeg']
        };
        
        // Create list of available images using simple relative paths like homepage
        this.gallery.images = [
            '../assets/images/home1.png', // Use existing image as fallback
            ...manifest.images.map(img => `../assets/gallery/${img}`)
        ];
        
        console.log(`Loaded gallery with ${this.gallery.images.length} images`);
        console.log('Image paths:', this.gallery.images);
        console.log('Protocol:', window.location.protocol);
        
        // Setup image processing canvas
        this.gallery.imageCanvas = document.createElement('canvas');
        this.gallery.imageCtx = this.gallery.imageCanvas.getContext('2d');
        
        // Start the gallery cycle
        console.log('Starting gallery cycle in 5 seconds...');
        setTimeout(() => {
            console.log('Gallery cycle timeout triggered - loading first image');
            this.loadNextImage();
        }, 5000); // Wait 5 seconds before first image
    }
    
    loadNextImage() {
        console.log('=== LOAD NEXT IMAGE ===');
        console.log('isProcessingImage:', this.gallery.isProcessingImage);
        console.log('images.length:', this.gallery.images.length);
        console.log('All images:', this.gallery.images);
        
        if (this.gallery.isProcessingImage || this.gallery.images.length === 0) {
            console.log('Skipping image load - already processing or no images');
            return;
        }
        
        const imagePath = this.gallery.images[this.gallery.currentImageIndex];
        console.log(`Loading image: ${imagePath}`);
        console.log(`Image index: ${this.gallery.currentImageIndex} of ${this.gallery.images.length}`);
        
        this.gallery.transformationPhase = 'loading';
        this.gallery.isProcessingImage = true;
        
        const img = new Image();
        // Set crossOrigin only for HTTP protocols to enable image processing
        if (window.location.protocol !== 'file:') {
            img.crossOrigin = 'anonymous';
            console.log('Set crossOrigin to anonymous for HTTP protocol');
        }
        
        img.onload = () => {
            console.log('IMAGE LOADED SUCCESSFULLY:', imagePath);
            console.log('Image dimensions:', img.width, 'x', img.height);
            this.gallery.currentImage = img;
            this.startImageShowSequence();
        };
        
        img.onerror = (error) => {
            console.error(`Failed to load image: ${imagePath}`, error);
            this.skipToNextImage();
        };
        
        img.src = imagePath;
        console.log('Image src set, waiting for load...');
    }
    
    skipToNextImage() {
        this.gallery.currentImageIndex = (this.gallery.currentImageIndex + 1) % this.gallery.images.length;
        this.gallery.isProcessingImage = false;
        this.gallery.transformationPhase = 'idle';
        
        // Try next image after delay
        setTimeout(() => {
            this.loadNextImage();
        }, 5000);
    }
    
    startImageShowSequence() {
        console.log('=== STARTING IMAGE SHOW SEQUENCE ===');
        this.gallery.transformationPhase = 'showing';
        this.gallery.imageOpacity = 1.0;
        this.gallery.imageScale = 1.0;
        this.gallery.imageShowStartTime = Date.now();
        
        // Randomize image position and threshold
        this.randomizeImageParameters();
        
        // Show image for 3 seconds, then start decay
        setTimeout(() => {
            console.log('Starting image decay...');
            this.startImageDecay();
        }, 3000);
    }
    
    randomizeImageParameters() {
        // Randomize image position on screen
        const img = this.gallery.currentImage;
        if (img) {
            // Calculate image display size
            const maxSize = Math.min(this.width, this.height) * 0.8;
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            const displayWidth = img.width * scale;
            const displayHeight = img.height * scale;
            
            // Random position within screen bounds
            this.gallery.imageOffsetX = Math.random() * (this.width - displayWidth);
            this.gallery.imageOffsetY = Math.random() * (this.height - displayHeight);
        }
        
        // Simple randomized threshold (good range for varied results)
        this.gallery.currentThreshold = 15 + Math.random() * 20; // 15-35 range
        
        console.log('Randomized parameters:', {
            offsetX: this.gallery.imageOffsetX,
            offsetY: this.gallery.imageOffsetY,
            threshold: this.gallery.currentThreshold
        });
    }
    
    startImageDecay() {
        console.log('=== STARTING IMAGE DECAY ===');
        this.gallery.transformationPhase = 'decaying';
        
        // Start processing edges immediately (in background) while image decays
        this.processImageToEdges();
        
        // Longer seamless transition - decay image while edges emerge and start interweaving
        const totalDuration = 8000; // 8 seconds total for smooth transition
        const startTime = Date.now();
        
        const animateSeamlessTransition = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            
            // Phase 1 (0-0.3): Image decay with edge emergence
            if (progress <= 0.3) {
                const decayProgress = progress / 0.3;
                this.gallery.imageOpacity = Math.pow(1 - decayProgress, 1.5);
                this.gallery.edgeEmergence = Math.pow(decayProgress, 0.8);
                console.log(`Phase 1: decay=${decayProgress.toFixed(2)}, imageOpacity=${this.gallery.imageOpacity.toFixed(2)}, edgeEmergence=${this.gallery.edgeEmergence.toFixed(2)}`);
            }
            // Phase 2 (0.3-0.7): Edges fully visible, start fabric interweaving
            else if (progress <= 0.7) {
                this.gallery.imageOpacity = 0;
                this.gallery.edgeEmergence = 1.0;
                
                // Start fabric integration during this phase
                const integrationProgress = (progress - 0.3) / 0.4;
                this.transformationProgress = integrationProgress * 0.5; // Start morphing fabric gently
                console.log(`Phase 2: integrationProgress=${integrationProgress.toFixed(2)}, transformationProgress=${this.transformationProgress.toFixed(2)}`);
            }
            // Phase 3 (0.7-1.0): Complete fabric integration and edge fade
            else {
                this.gallery.imageOpacity = 0;
                const fadeProgress = (progress - 0.7) / 0.3;
                this.gallery.edgeEmergence = Math.pow(1 - fadeProgress, 0.5); // Gradual edge fade
                this.transformationProgress = 0.5 + (fadeProgress * 0.5); // Complete fabric transformation
                console.log(`Phase 3: fadeProgress=${fadeProgress.toFixed(2)}, edgeEmergence=${this.gallery.edgeEmergence.toFixed(2)}, transformationProgress=${this.transformationProgress.toFixed(2)}`);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animateSeamlessTransition);
            } else {
                // Seamless transition complete - move to relaxation
                this.startFabricRelaxation();
            }
        };
        
        animateSeamlessTransition();
    }
    
    processImageToEdges() {
        console.log('=== PROCESSING IMAGE TO EDGES ===');
        // Keep the transformation phase as 'decaying' for seamless transitions
        console.log('Processing edges while maintaining transformation phase:', this.gallery.transformationPhase);
        
        const img = this.gallery.currentImage;
        
        // Create a new untainted canvas
        const processCanvas = document.createElement('canvas');
        const processCtx = processCanvas.getContext('2d');
        
        // Use moderate resolution for edge detection to balance detail and performance
        const maxSize = 800; // Larger size to preserve more detail
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        
        processCanvas.width = Math.floor(img.width * scale);
        processCanvas.height = Math.floor(img.height * scale);
        console.log('Process canvas size:', processCanvas.width, 'x', processCanvas.height);
        
        try {
            // Draw the full image to processing canvas (no cropping needed)
            processCtx.drawImage(img, 0, 0, processCanvas.width, processCanvas.height);
            console.log('Image drawn to process canvas');
            
            // Try to get image data - this might fail with tainted canvas
            const imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
            console.log('Got image data successfully');
            
            // Apply edge detection (Sobel filter)
            const edges = this.sobelEdgeDetection(imageData);
            console.log('Edge detection completed, found', edges.length, 'edges');
            
            if (edges.length === 0) {
                console.warn('No edges detected! Image may be too uniform or threshold too high');
                console.log('Current threshold:', this.gallery.currentThreshold);
            }
            
            // Convert edges to thread-like structures
            this.convertEdgesToThreads(edges, processCanvas.width, processCanvas.height);
            console.log('Converted edges to', this.gallery.edges.length, 'thread structures');
            
        } catch (error) {
            console.warn('Canvas tainted, using fallback edge generation:', error);
            // Create procedural edges as fallback
            this.createFallbackEdges();
        }
        
        // Edges will be integrated seamlessly through the decay animation
        console.log('Edge processing complete - seamless integration handled by decay animation');
    }
    
    createFallbackEdges() {
        // Create procedural edge patterns when image processing fails
        console.log('Creating fallback edge patterns...');
        this.gallery.edges = [];
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.3;
        
        // Create geometric edge patterns
        const patterns = [
            // Circular pattern
            () => {
                const points = [];
                const numPoints = 60;
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    points.push({
                        x: x,
                        y: y,
                        baseX: x,
                        baseY: y,
                        magnitude: 50 + Math.random() * 50
                    });
                }
                return points;
            },
            
            // Diamond pattern
            () => {
                const points = [];
                const size = radius * 0.8;
                const numSegments = 20;
                
                // Create diamond edges
                const corners = [
                    {x: centerX, y: centerY - size},
                    {x: centerX + size, y: centerY},
                    {x: centerX, y: centerY + size},
                    {x: centerX - size, y: centerY}
                ];
                
                for (let c = 0; c < corners.length; c++) {
                    const start = corners[c];
                    const end = corners[(c + 1) % corners.length];
                    
                    for (let i = 0; i <= numSegments; i++) {
                        const t = i / numSegments;
                        const x = start.x + (end.x - start.x) * t;
                        const y = start.y + (end.y - start.y) * t;
                        points.push({
                            x: x,
                            y: y,
                            baseX: x,
                            baseY: y,
                            magnitude: 40 + Math.random() * 40
                        });
                    }
                }
                return points;
            },
            
            // Spiral pattern
            () => {
                const points = [];
                const turns = 3;
                const numPoints = 80;
                
                for (let i = 0; i < numPoints; i++) {
                    const t = i / numPoints;
                    const angle = t * Math.PI * 2 * turns;
                    const r = radius * (1 - t * 0.8);
                    const x = centerX + Math.cos(angle) * r;
                    const y = centerY + Math.sin(angle) * r;
                    points.push({
                        x: x,
                        y: y,
                        baseX: x,
                        baseY: y,
                        magnitude: 30 + Math.random() * 60
                    });
                }
                return points;
            }
        ];
        
        // Create threads from random patterns
        const numPatterns = 2 + Math.floor(Math.random() * 2);
        for (let p = 0; p < numPatterns; p++) {
            const patternIndex = Math.floor(Math.random() * patterns.length);
            const points = patterns[patternIndex]();
            
            if (points.length > 10) {
                const fabricThread = {
                    points: points,
                    type: 'edge',
                    phase: Math.random() * Math.PI * 2,
                    colorPhase: Math.random() * Math.PI * 2,
                    colorSpeed: 1.0,
                    hueVariation: 0,
                    saturationVariation: 0,
                    lightnessVariation: 0
                };
                this.gallery.edges.push(fabricThread);
            }
        }
        
        console.log(`Created ${this.gallery.edges.length} fallback edge patterns`);
    }
    
    sobelEdgeDetection(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const targetEdges = 100;
        
        return this.adaptiveThresholdDetection(data, width, height, targetEdges);
    }
    
    adaptiveThresholdDetection(data, width, height, targetEdges) {
        let threshold = this.gallery.currentThreshold;
        let bestEdges = [];
        let bestCount = 0;
        
        // Try up to 3 attempts to get close to target
        for (let attempt = 0; attempt < 3; attempt++) {
            const edges = this.detectEdgesWithThreshold(data, width, height, threshold);
            console.log(`Attempt ${attempt + 1}: ${edges.length} edges with threshold ${threshold.toFixed(1)}`);
            
            // If this is closer to target than previous best, keep it
            const countDiff = Math.abs(edges.length - targetEdges);
            const bestDiff = Math.abs(bestCount - targetEdges);
            
            if (attempt === 0 || countDiff < bestDiff) {
                bestEdges = edges;
                bestCount = edges.length;
            }
            
            // If we're close enough, stop
            if (edges.length >= targetEdges * 0.8 && edges.length <= targetEdges * 1.2) {
                console.log(`Good enough: ${edges.length} edges (target: ${targetEdges})`);
                break;
            }
            
            // Adjust threshold for next attempt
            if (edges.length < targetEdges) {
                threshold *= 0.7; // Lower threshold to get more edges
            } else {
                threshold *= 1.4; // Higher threshold to get fewer edges
            }
        }
        
        console.log(`Final: ${bestCount} edge points (target: ${targetEdges})`);
        return bestEdges;
    }
    
    detectEdgesWithThreshold(data, width, height, threshold) {
        const edges = [];
        
        // Multi-pass edge detection for better structure preservation
        const edgeMap = this.multiPassEdgeDetection(data, width, height, threshold);
        
        // Convert edge map to edge list
        const sampleRate = 6;
        for (let y = 1; y < height - 1; y += sampleRate) {
            for (let x = 1; x < width - 1; x += sampleRate) {
                const mapIndex = y * width + x;
                if (edgeMap[mapIndex] && edgeMap[mapIndex].magnitude > threshold) {
                    edges.push({
                        x: x,
                        y: y,
                        magnitude: edgeMap[mapIndex].magnitude,
                        direction: edgeMap[mapIndex].direction
                    });
                }
            }
        }
        
        return edges;
    }
    
    multiPassEdgeDetection(data, width, height, threshold) {
        // Create edge magnitude map
        const edgeMap = new Array(width * height);
        
        // Multiple kernel passes for better structure detection
        const kernels = [
            // Standard Sobel
            {
                x: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
                y: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
            },
            // Refined Sobel (stronger center)
            {
                x: [[-1, 0, 1], [-3, 0, 3], [-1, 0, 1]], 
                y: [[-1, -3, -1], [0, 0, 0], [1, 3, 1]]
            },
            // Diagonal emphasis
            {
                x: [[-2, -1, 0], [-1, 0, 1], [0, 1, 2]],
                y: [[0, 1, 2], [-1, 0, 1], [-2, -1, 0]]
            }
        ];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let maxMagnitude = 0;
                let bestDirection = 0;
                
                // Try each kernel and keep the strongest response
                kernels.forEach(kernel => {
                    let gx = 0, gy = 0;
                    
                    // Apply kernel
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4;
                            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                            
                            gx += gray * kernel.x[ky + 1][kx + 1];
                            gy += gray * kernel.y[ky + 1][kx + 1];
                        }
                    }
                    
                    const magnitude = Math.sqrt(gx * gx + gy * gy);
                    
                    if (magnitude > maxMagnitude) {
                        maxMagnitude = magnitude;
                        bestDirection = Math.atan2(gy, gx);
                    }
                });
                
                // Store the best response
                if (maxMagnitude > threshold * 0.3) { // Lower threshold for building map
                    const mapIndex = y * width + x;
                    edgeMap[mapIndex] = {
                        magnitude: maxMagnitude,
                        direction: bestDirection
                    };
                }
            }
        }
        
        return edgeMap;
    }
    
    convertEdgesToThreads(edges, imageWidth, imageHeight) {
        this.gallery.edges = [];
        
        // Group edges into thread-like paths
        const visited = new Set();
        const threads = [];
        
        edges.forEach((edge, index) => {
            if (visited.has(index)) return;
            
            const thread = this.traceEdgeThread(edges, index, visited);
            if (thread.length > 3) { // Keep threads with more than 3 points
                threads.push(thread);
            }
        });
        
        console.log(`Created ${threads.length} edge threads`);
        
        // Calculate proper scaling to match the displayed image
        const img = this.gallery.currentImage;
        if (!img) return;
        
        const maxSize = Math.min(this.width, this.height) * 0.8;
        const imageDisplayScale = Math.min(maxSize / img.width, maxSize / img.height);
        const displayWidth = img.width * imageDisplayScale;
        const displayHeight = img.height * imageDisplayScale;
        
        // Scale from process canvas coordinates to display coordinates
        const scaleX = displayWidth / imageWidth;
        const scaleY = displayHeight / imageHeight;
        
        console.log('Edge coordinate scaling:', {
            processSize: `${imageWidth}x${imageHeight}`,
            displaySize: `${displayWidth.toFixed(1)}x${displayHeight.toFixed(1)}`,
            scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`,
            offset: `${this.gallery.imageOffsetX.toFixed(1)},${this.gallery.imageOffsetY.toFixed(1)}`
        });
        
        threads.forEach(thread => {
            const fabricThread = {
                points: thread.map(point => ({
                    x: (point.x * scaleX) + this.gallery.imageOffsetX,
                    y: (point.y * scaleY) + this.gallery.imageOffsetY,
                    baseX: (point.x * scaleX) + this.gallery.imageOffsetX,
                    baseY: (point.y * scaleY) + this.gallery.imageOffsetY,
                    magnitude: point.magnitude
                })),
                type: 'edge',
                phase: Math.random() * Math.PI * 2,
                colorPhase: Math.random() * Math.PI * 2,
                colorSpeed: 1.0,
                hueVariation: 0,
                saturationVariation: 0,
                lightnessVariation: 0
            };
            this.gallery.edges.push(fabricThread);
        });
    }
    
    traceEdgeThread(edges, startIndex, visited) {
        const thread = [];
        const start = edges[startIndex];
        let current = start;
        let currentIndex = startIndex;
        
        visited.add(startIndex);
        thread.push(current);
        
        // Trace connected edges
        while (thread.length < 50) { // Shorter thread length limit
            let bestNext = null;
            let bestIndex = -1;
            let bestDistance = Infinity;
            
            // Find closest unvisited edge point
            edges.forEach((edge, index) => {
                if (visited.has(index)) return;
                
                const dx = edge.x - current.x;
                const dy = edge.y - current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Must be close and roughly aligned
                if (distance < 15 && distance < bestDistance) {
                    const angleDiff = Math.abs(edge.direction - current.direction);
                    if (angleDiff < 0.5 || angleDiff > Math.PI * 2 - 0.5) {
                        bestNext = edge;
                        bestIndex = index;
                        bestDistance = distance;
                    }
                }
            });
            
            if (!bestNext) break;
            
            visited.add(bestIndex);
            thread.push(bestNext);
            current = bestNext;
            currentIndex = bestIndex;
        }
        
        return thread;
    }
    
    // Old edge integration method removed - now handled seamlessly in decay animation
    
    // Old edge integration animation removed - now handled seamlessly in decay animation
    
    startFabricRelaxation() {
        console.log('Starting fabric relaxation...');
        this.gallery.transformationPhase = 'relaxing';
        
        // Immediately hide edges when relaxation starts
        this.gallery.edgeEmergence = 0;
        
        const duration = 4000; // 4 second relaxation
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const relaxProgress = Math.min(elapsed / duration, 1);
            
            // Ease out transformation
            this.transformationProgress = 1 - this.easeOutCubic(relaxProgress);
            
            if (relaxProgress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Reset to normal state
                this.resetToNormalState();
            }
        };
        
        animate();
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    resetToNormalState() {
        console.log('Resetting to normal fabric state');
        this.gallery.transformationPhase = 'idle';
        this.transformationProgress = 0;
        this.gallery.edges = [];
        this.gallery.isProcessingImage = false;
        this.gallery.edgeEmergence = 0;
        this.gallery.imageOpacity = 0;
        
        // Schedule next image (much shorter wait)
        this.gallery.currentImageIndex = (this.gallery.currentImageIndex + 1) % this.gallery.images.length;
        console.log(`Next cycle will use image index: ${this.gallery.currentImageIndex}`);
        setTimeout(() => {
            console.log('Starting next cycle...');
            this.loadNextImage();
        }, 3000); // Only wait 3 seconds before next cycle
    }
    
    createThreadPoints(position, isHorizontal) {
        const points = [];
        const count = isHorizontal ? Math.ceil(this.width / 10) : Math.ceil(this.height / 10);
        
        for (let i = 0; i <= count; i++) {
            points.push({
                x: isHorizontal ? i * 10 : position,
                y: isHorizontal ? position : i * 10,
                baseX: isHorizontal ? i * 10 : position,
                baseY: isHorizontal ? position : i * 10,
                offset: Math.random() * 5
            });
        }
        
        return points;
    }
    
    initEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mouseenter', () => {
            this.isHovered = true;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isHovered = false;
        });
        
        // Handle resize
        window.addEventListener('resize', () => {
            const rect = this.canvas.getBoundingClientRect();
            this.width = this.canvas.width = rect.width || window.innerWidth;
            this.height = this.canvas.height = rect.height || window.innerHeight;
            this.threads = [];
            this.initFabric();
        });
    }
    
    updateFabric() {
        this.time += 0.016; // ~60fps
        this.colorTime += 0.005; // Very slow color evolution for unity
        this.paletteTransitionTime += 0.001; // Even slower palette transitions
        
        // Check for palette transitions every 3-4 minutes
        if (this.paletteTransitionTime > 200) {
            this.transitionToNextPalette();
        }
        
        this.threads.forEach(thread => {
            // Update thread color based on unified palette with variations
            thread.currentColor = this.calculateUnifiedThreadColor(thread);
            
            thread.points.forEach((point, index) => {
                // Base wave motion
                const waveOffset = Math.sin(this.time * 2 + thread.phase + index * 0.1) * 2;
                
                // Mouse interaction
                let mouseInfluence = 0;
                if (this.isHovered) {
                    const dx = point.baseX - this.mouseX;
                    const dy = point.baseY - this.mouseY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const maxDistance = 100;
                    
                    if (distance < maxDistance) {
                        mouseInfluence = (1 - distance / maxDistance) * 15;
                    }
                }
                
                // Apply motion
                if (thread.type === 'horizontal') {
                    point.y = point.baseY + waveOffset + mouseInfluence;
                } else {
                    point.x = point.baseX + waveOffset + mouseInfluence;
                }
            });
        });
    }
    
    transitionToNextPalette() {
        this.paletteIndex = (this.paletteIndex + 1) % this.palettes.length;
        this.currentPalette = this.palettes[this.paletteIndex];
        this.paletteTransitionTime = 0;
        console.log(`Transitioning to palette: ${this.currentPalette.name}`);
    }
    
    calculateUnifiedThreadColor(thread) {
        const palette = this.currentPalette;
        const timeInCycle = (this.colorTime * thread.colorSpeed + thread.colorPhase) % palette.period;
        const progress = timeInCycle / palette.period;
        
        // Calculate base color from palette trajectory
        let baseHue = this.calculateTrajectoryHue(palette, progress);
        let baseSaturation = palette.baseSaturation;
        let baseLightness = palette.baseLightness;
        
        // Apply individual thread variations
        const finalHue = (baseHue + thread.hueVariation + 360) % 360;
        const finalSaturation = Math.max(10, Math.min(100, baseSaturation + thread.saturationVariation));
        const finalLightness = Math.max(10, Math.min(90, baseLightness + thread.lightnessVariation));
        
        return `hsl(${Math.round(finalHue)}, ${Math.round(finalSaturation)}%, ${Math.round(finalLightness)}%)`;
    }
    
    calculateTrajectoryHue(palette, progress) {
        const baseHue = palette.baseHue;
        const range = palette.hueRange;
        
        switch (palette.trajectory) {
            case 'sunrise':
                // Gradual movement from cool to warm
                return (baseHue + range * progress) % 360;
                
            case 'wave':
                // Oscillating like ocean waves
                const wave = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
                return (baseHue + range * wave) % 360;
                
            case 'growth':
                // Seasonal cycle - smooth back and forth
                const seasonal = Math.sin(progress * Math.PI) * 0.8 + 0.1;
                return (baseHue + range * seasonal) % 360;
                
            case 'descent':
                // Sun setting - reverse progression
                return (baseHue + range * (1 - progress)) % 360;
                
            case 'pulse':
                // Subtle oscillation around base hue
                const pulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.5;
                return (baseHue + range * pulse) % 360;
                
            default:
                return baseHue;
        }
    }
    
    
    render() {
        // Clear with unified background that reflects current palette
        const paletteProgress = (this.colorTime) % this.currentPalette.period / this.currentPalette.period;
        const paletteHue = this.calculateTrajectoryHue(this.currentPalette, paletteProgress);
        
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, `hsl(${paletteHue}, 12%, 4%)`);
        gradient.addColorStop(0.5, `hsl(${(paletteHue + this.currentPalette.hueRange * 0.3) % 360}, 8%, 2%)`);
        gradient.addColorStop(1, `hsl(${(paletteHue + this.currentPalette.hueRange * 0.6) % 360}, 10%, 3%)`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Handle different transformation phases with seamless blending
        if (this.gallery.transformationPhase === 'showing') {
            this.renderImagePhase();
        } else if (this.gallery.transformationPhase === 'decaying') {
            this.renderSeamlessTransitionPhase();
        } else if (this.gallery.transformationPhase === 'relaxing') {
            this.renderRelaxingPhase();
        } else {
            this.renderNormalFabric();
        }
        
        // Mouse effects are now applied per-thread during drawing
        
        // Add color-responsive scanlines
        this.addColorScanlines();
    }
    
    renderNormalFabric() {
        // Draw threads with weaving effect and enhanced glow
        this.ctx.lineWidth = 1.5;
        
        // Draw horizontal threads first
        this.threads.filter(t => t.type === 'horizontal').forEach((thread, threadIndex) => {
            this.drawThread(thread, threadIndex);
        });
        
        // Draw vertical threads with weaving logic
        this.threads.filter(t => t.type === 'vertical').forEach((thread, threadIndex) => {
            this.drawThread(thread, threadIndex, true);
        });
    }
    
    renderImagePhase() {
        // Fade out fabric during image display
        this.ctx.globalAlpha = 0.2;
        this.renderNormalFabric();
        this.ctx.globalAlpha = 1.0;
        
        // Draw the image at random position with normal size
        if (this.gallery.currentImage && this.gallery.imageOpacity > 0) {
            const img = this.gallery.currentImage;
            
            // Calculate normal display size (not screen-filling)
            const maxSize = Math.min(this.width, this.height) * 0.8;
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            
            const displayWidth = img.width * scale;
            const displayHeight = img.height * scale;
            
            // Use random position from randomizeImageParameters
            const x = this.gallery.imageOffsetX;
            const y = this.gallery.imageOffsetY;
            
            // Draw with current opacity at random position
            this.ctx.globalAlpha = this.gallery.imageOpacity;
            this.ctx.drawImage(img, x, y, displayWidth, displayHeight);
            this.ctx.globalAlpha = 1.0;
        }
        
        // During decay phase, gradually show emerging edges
        if (this.gallery.transformationPhase === 'decaying' && this.gallery.edgeEmergence > 0) {
            this.ctx.lineWidth = 1.5;
            this.ctx.globalAlpha = this.gallery.edgeEmergence;
            this.gallery.edges.forEach((edgeThread, index) => {
                this.drawEdgeThread(edgeThread, index);
            });
            this.ctx.globalAlpha = 1.0;
        }
    }

    renderSeamlessTransitionPhase() {
        // Render fabric with progressive morphing based on transformation progress
        const fabricAlpha = 0.2 + (this.transformationProgress * 0.6); // Fabric becomes more prominent as transformation progresses
        
        if (this.transformationProgress > 0) {
            // Draw morphing fabric threads
            this.ctx.lineWidth = 1.5;
            
            // Store original thread positions if not already stored
            if (this.originalThreads.length === 0) {
                this.originalThreads = this.threads.map(thread => ({
                    ...thread,
                    points: thread.points.map(point => ({...point}))
                }));
            }
            
            // Draw horizontal threads with morphing
            this.threads.filter(t => t.type === 'horizontal').forEach((thread, threadIndex) => {
                this.drawMorphedThread(thread, threadIndex);
            });
            
            // Draw vertical threads with morphing
            this.threads.filter(t => t.type === 'vertical').forEach((thread, threadIndex) => {
                this.drawMorphedThread(thread, threadIndex, true);
            });
        } else {
            // Normal fabric with reduced opacity during early phases
            this.ctx.globalAlpha = fabricAlpha;
            this.renderNormalFabric();
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw the decaying image
        if (this.gallery.currentImage && this.gallery.imageOpacity > 0) {
            const img = this.gallery.currentImage;
            
            const maxSize = Math.min(this.width, this.height) * 0.8;
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            
            const displayWidth = img.width * scale;
            const displayHeight = img.height * scale;
            
            const x = this.gallery.imageOffsetX;
            const y = this.gallery.imageOffsetY;
            
            this.ctx.globalAlpha = this.gallery.imageOpacity;
            this.ctx.drawImage(img, x, y, displayWidth, displayHeight);
            this.ctx.globalAlpha = 1.0;
        }
        
        // Draw emerging and fading edges with smooth transitions
        if (this.gallery.edgeEmergence > 0) {
            console.log(`Rendering ${this.gallery.edges.length} edge threads with emergence ${this.gallery.edgeEmergence.toFixed(2)}`);
            const edgeThickness = 1.5 + (this.gallery.edgeEmergence * 0.5); // Edges get slightly thicker as they emerge
            this.ctx.lineWidth = edgeThickness;
            this.ctx.globalAlpha = this.gallery.edgeEmergence;
            this.gallery.edges.forEach((edgeThread, index) => {
                this.drawEdgeThread(edgeThread, index);
            });
            this.ctx.globalAlpha = 1.0;
        } else if (this.gallery.edges.length > 0) {
            console.log(`${this.gallery.edges.length} edges available but emergence is ${this.gallery.edgeEmergence}`);
        }
    }
    
    // Old separate phase rendering methods removed - now handled by renderSeamlessTransitionPhase
    
    renderRelaxingPhase() {
        // Draw morphed fabric threads (no edge overlay during relaxation)
        this.ctx.lineWidth = 1.5;
        
        // Draw horizontal threads with morphing
        this.threads.filter(t => t.type === 'horizontal').forEach((thread, threadIndex) => {
            this.drawMorphedThread(thread, threadIndex);
        });
        
        // Draw vertical threads with morphing
        this.threads.filter(t => t.type === 'vertical').forEach((thread, threadIndex) => {
            this.drawMorphedThread(thread, threadIndex, true);
        });
        
        // No edge threads drawn during relaxation - they should be gone
    }
    
    drawEdgeThread(edgeThread, index) {
        if (!edgeThread.points || edgeThread.points.length < 2) return;
        
        // Use edge-specific coloring
        const paletteProgress = (this.colorTime + index * 0.1) % this.currentPalette.period / this.currentPalette.period;
        const baseHue = this.calculateTrajectoryHue(this.currentPalette, paletteProgress);
        const edgeColor = `hsl(${(baseHue + 60) % 360}, 80%, 70%)`;
        
        this.ctx.strokeStyle = edgeColor;
        this.ctx.shadowColor = edgeColor;
        this.ctx.shadowBlur = 5;
        
        this.ctx.beginPath();
        
        for (let i = 0; i < edgeThread.points.length - 1; i++) {
            const point1 = edgeThread.points[i];
            const point2 = edgeThread.points[i + 1];
            
            if (i === 0) {
                this.ctx.moveTo(point1.x, point1.y);
            }
            
            // Use smooth curves for edge threads
            const cpX = (point1.x + point2.x) / 2;
            const cpY = (point1.y + point2.y) / 2;
            this.ctx.quadraticCurveTo(point1.x, point1.y, cpX, cpY);
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    
    drawMorphedThread(thread, threadIndex, isVertical = false) {
        const alpha = 0.8 + Math.sin(this.time + thread.phase) * 0.2;
        
        // Use the calculated color from the trajectory
        this.ctx.strokeStyle = thread.currentColor || '#666666';
        this.ctx.shadowColor = thread.currentColor || '#666666';
        this.ctx.shadowBlur = 3;
        this.ctx.globalAlpha = alpha;
        
        this.ctx.beginPath();
        
        for (let i = 0; i < thread.points.length - 1; i++) {
            const point1 = thread.points[i];
            const point2 = thread.points[i + 1];
            
            // Calculate morphed positions influenced by nearby edges
            const morphedPoint1 = this.calculateMorphedPosition(point1, threadIndex, i);
            const morphedPoint2 = this.calculateMorphedPosition(point2, threadIndex, i + 1);
            
            // Weaving effect: alternate which thread goes over/under
            if (isVertical) {
                const shouldBreak = this.shouldBreakForWeaving(morphedPoint1, threadIndex, i);
                if (shouldBreak) {
                    // End current path and start a new one after the gap
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    continue;
                }
            }
            
            if (i === 0) {
                this.ctx.moveTo(morphedPoint1.x, morphedPoint1.y);
            }
            
            // Use quadratic curves for smoother threads
            const cpX = (morphedPoint1.x + morphedPoint2.x) / 2;
            const cpY = (morphedPoint1.y + morphedPoint2.y) / 2;
            this.ctx.quadraticCurveTo(morphedPoint1.x, morphedPoint1.y, cpX, cpY);
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
    }
    
    calculateMorphedPosition(originalPoint, threadIndex, pointIndex) {
        if (this.gallery.edges.length === 0) {
            return { x: originalPoint.x, y: originalPoint.y };
        }
        
        let totalInfluence = { x: 0, y: 0 };
        let influenceWeight = 0;
        
        // Check influence from nearby edge points
        this.gallery.edges.forEach(edgeThread => {
            edgeThread.points.forEach(edgePoint => {
                const dx = edgePoint.x - originalPoint.baseX;
                const dy = edgePoint.y - originalPoint.baseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Only influence nearby points
                if (distance < 50) {
                    const influence = Math.max(0, 1 - distance / 50);
                    const morphInfluence = influence * this.transformationProgress;
                    
                    totalInfluence.x += (edgePoint.x - originalPoint.baseX) * morphInfluence;
                    totalInfluence.y += (edgePoint.y - originalPoint.baseY) * morphInfluence;
                    influenceWeight += morphInfluence;
                }
            });
        });
        
        // Apply the morphing influence
        const morphX = originalPoint.x + totalInfluence.x * 0.3;
        const morphY = originalPoint.y + totalInfluence.y * 0.3;
        
        return { x: morphX, y: morphY };
    }
    
    drawThread(thread, threadIndex, isVertical = false) {
        const alpha = 0.8 + Math.sin(this.time + thread.phase) * 0.2;
        
        // Use the calculated color from the trajectory
        this.ctx.strokeStyle = thread.currentColor || '#666666';
        this.ctx.shadowColor = thread.currentColor || '#666666';
        this.ctx.shadowBlur = 3;
        this.ctx.globalAlpha = alpha;
        
        this.ctx.beginPath();
        
        for (let i = 0; i < thread.points.length - 1; i++) {
            const point1 = thread.points[i];
            const point2 = thread.points[i + 1];
            
            // Weaving effect: alternate which thread goes over/under
            if (isVertical) {
                const shouldBreak = this.shouldBreakForWeaving(point1, threadIndex, i);
                if (shouldBreak) {
                    // End current path and start a new one after the gap
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    continue;
                }
            }
            
            if (i === 0) {
                this.ctx.moveTo(point1.x, point1.y);
            }
            
            // Use quadratic curves for smoother threads
            const cpX = (point1.x + point2.x) / 2;
            const cpY = (point1.y + point2.y) / 2;
            this.ctx.quadraticCurveTo(point1.x, point1.y, cpX, cpY);
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
    }
    
    shouldBreakForWeaving(point, threadIndex, pointIndex) {
        // Simple weaving pattern: break thread at intersection points
        const spacing = 20;
        return (threadIndex + Math.floor(pointIndex / 2)) % 2 === 0 && 
               pointIndex % 4 === 2;
    }
    
    drawMouseGlow() {
        const radius = 100;
        const paletteProgress = (this.colorTime) % this.currentPalette.period / this.currentPalette.period;
        const baseHue = this.calculateTrajectoryHue(this.currentPalette, paletteProgress);
        
        const gradient = this.ctx.createRadialGradient(
            this.mouseX, this.mouseY, 0,
            this.mouseX, this.mouseY, radius
        );
        
        gradient.addColorStop(0, `hsla(${baseHue}, 70%, 65%, 0.2)`);
        gradient.addColorStop(0.3, `hsla(${(baseHue + this.currentPalette.hueRange * 0.3) % 360}, 60%, 55%, 0.1)`);
        gradient.addColorStop(0.7, `hsla(${(baseHue + this.currentPalette.hueRange * 0.6) % 360}, 50%, 45%, 0.05)`);
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
            this.mouseX - radius,
            this.mouseY - radius,
            radius * 2,
            radius * 2
        );
    }
    
    addColorScanlines() {
        const paletteProgress = (this.colorTime) % this.currentPalette.period / this.currentPalette.period;
        const baseHue = this.calculateTrajectoryHue(this.currentPalette, paletteProgress);
        
        this.ctx.strokeStyle = `hsla(${baseHue}, 40%, 45%, 0.025)`;
        this.ctx.lineWidth = 0.5;
        
        for (let y = 0; y < this.height; y += 6) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
        
        // Add vertical scanlines with complementary hue
        this.ctx.strokeStyle = `hsla(${(baseHue + this.currentPalette.hueRange * 0.5) % 360}, 25%, 35%, 0.02)`;
        for (let x = 0; x < this.width; x += 8) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
    }
    
    animate() {
        this.updateFabric();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// DigitalFabric class is ready for initialization from other pages