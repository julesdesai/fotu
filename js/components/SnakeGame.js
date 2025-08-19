class SnakeGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Game canvas not found:', canvasId);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.instructionEl = document.getElementById('gameInstructions');
        
        // Set canvas size to match container for fullscreen
        this.resizeCanvas();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Instruction system
        this.instructions = [
            { text: "Use arrow keys or WASD to move...", delay: 8000, condition: () => !this.hasPlayerMoved },
            { text: "Food may appear, but it vanishes when approached alone...", delay: 20000, condition: () => this.fakeFoodDisappearances >= this.fakeFoodHintThreshold },
            { text: "Let the light green snake approach you...", delay: 35000, condition: () => this.gameState === 'searching' && this.proximityTimer < 500 },
            { text: "Stay close to build connection...", delay: 50000, condition: () => this.gameState === 'searching' && this.proximityTimer < 1500 },
            { text: "When snakes unite, real food will appear...", delay: 65000, condition: () => this.gameState === 'searching' },
            { text: "Either snake can eat the food to complete the cycle...", delay: 80000, condition: () => this.gameState === 'feeding' }
        ];
        
        this.currentInstructionIndex = -1;
        this.instructionStartTime = 0;
        this.hasPlayerMoved = false;
        this.typewriterActive = false;
        this.typewriterText = '';
        this.typewriterTarget = '';
        this.typewriterSpeed = 50; // ms per character
        
        this.gameState = 'searching'; // searching, found, bloom, reset
        this.time = 0;
        this.codeOffset = 0;
        
        // Code messages that will be revealed
        this.hiddenMessage = "TOGETHER";
        this.codeChars = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ>|<{}[]()+-=*/@#$%^&";
        this.revealProgress = 0;
        
        this.keys = {};
        this.lastTime = 0;
        
        this.initSnakes();
        this.initEventListeners();
        this.initShaders();
        this.initAudio();
        
        // Start instruction timer
        this.instructionStartTime = Date.now();
        
        this.gameLoop();
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Reinitialize snakes if they exist (for resize during gameplay)
        if (this.playerSnake && this.aiSnake) {
            this.repositionSnakes();
        }
    }
    
    repositionSnakes() {
        // Keep snakes within new canvas bounds
        this.playerSnake.segments.forEach(segment => {
            segment.x = Math.min(segment.x, this.width - 20);
            segment.y = Math.min(segment.y, this.height - 20);
        });
        
        this.aiSnake.segments.forEach(segment => {
            segment.x = Math.min(segment.x, this.width - 20);
            segment.y = Math.min(segment.y, this.height - 20);
        });
    }
    
    initSnakes() {
        // Pixel grid size for retro look
        this.gridSize = 12;
        this.pixelSize = 8;
        
        this.playerSnake = {
            segments: [],
            direction: { x: 1, y: 0 },
            speed: 1.5,
            size: this.pixelSize,
            color: '#39ff14',  // Bright retro green
            darkColor: '#2d8f10'  // Darker green for shading
        };
        
        this.aiSnake = {
            segments: [],
            direction: { x: -1, y: 0 },
            speed: 1.2,
            size: this.pixelSize,
            color: '#90ff90',  // Lighter green
            darkColor: '#6fbf6f',
            targetDistance: 80
        };
        
        // Initialize player snake in center (grid-aligned)
        const centerX = Math.floor(this.width / 2 / this.gridSize) * this.gridSize;
        const centerY = Math.floor(this.height / 2 / this.gridSize) * this.gridSize;
        
        for (let i = 0; i < 10; i++) {
            this.playerSnake.segments.push({
                x: centerX - i * this.gridSize,
                y: centerY
            });
        }
        
        // Initialize AI snake at opposite side (grid-aligned)
        const startX = Math.floor(100 / this.gridSize) * this.gridSize;
        const startY = Math.floor((this.height / 2 + 50) / this.gridSize) * this.gridSize;
        
        for (let i = 0; i < 8; i++) {
            this.aiSnake.segments.push({
                x: startX - i * this.gridSize,
                y: startY
            });
        }
        
        this.X = null;
        this.food = null;
        this.fakeFood = null;
        this.fakeFoodTimer = 0;
        this.fakeFoodRespawnDelay = 300; // 5 seconds at 60fps
        this.fakeFoodDisappearances = 0;
        this.fakeFoodHintThreshold = 2 + Math.floor(Math.random() * 6); // Random 2-7
        this.proximityTimer = 0;
        this.bloomIntensity = 0;
        this.canSpawnFood = false;
        
        // Animation and psychedelic systems
        this.foodTrails = [];
        this.heartParticles = [];
        this.psychedelicMode = false;
        this.psychedelicIntensity = 0;
        this.decayElements = [];
    }
    
    initEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // Enable audio context on first interaction
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Also enable audio on click
        document.addEventListener('click', () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        });
    }
    
    initShaders() {
        // Create off-screen canvas for post-processing effects
        this.effectCanvas = document.createElement('canvas');
        this.effectCanvas.width = this.width;
        this.effectCanvas.height = this.height;
        this.effectCtx = this.effectCanvas.getContext('2d');
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sounds = {
                movement: this.createTone(220, 0.1, 'triangle'),
                proximity: this.createTone(440, 0.2, 'sine'),
                found: this.createTone(880, 0.5, 'square'),
                bloom: this.createTone(1320, 1.0, 'sine')
            };
        } catch (e) {
            console.warn('Web Audio not supported');
            this.audioContext = null;
        }
    }
    
    createTone(frequency, duration, waveType = 'sine') {
        if (!this.audioContext) return null;
        
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = waveType;
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    playSound(soundName) {
        if (this.audioContext && this.sounds[soundName]) {
            // Resume audio context if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.sounds[soundName]();
        }
    }
    
    handleInput() {
        let newDir = null;
        let inputDetected = false;
        
        // Classic 4-direction movement - only one direction at a time
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            newDir = { x: 0, y: -1 };
            inputDetected = true;
        } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            newDir = { x: 0, y: 1 };
            inputDetected = true;
        } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            newDir = { x: -1, y: 0 };
            inputDetected = true;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            newDir = { x: 1, y: 0 };
            inputDetected = true;
        }
        
        // Update direction immediately (classic snake behavior)
        if (newDir && inputDetected) {
            // Prevent reversing into self
            const currentDir = this.playerSnake.direction;
            if (!(newDir.x === -currentDir.x && newDir.y === -currentDir.y)) {
                this.playerSnake.direction = newDir;
                this.hasPlayerMoved = true;
            }
        }
    }
    
    updateSnakes(deltaTime) {
        this.updatePlayerSnake(deltaTime);
        this.updateAiSnake(deltaTime);
        this.checkProximity();
        this.updateFakeFood();
        this.updateFoodAnimation();
        this.updatePsychedelicEffects();
    }
    
    updatePlayerSnake(deltaTime) {
        const snake = this.playerSnake;
        
        // Grid-based movement - only move every few frames for retro feel
        if (this.time % 8 !== 0) return;
        
        const head = snake.segments[0];
        
        // Move head by one grid unit
        const newHead = {
            x: head.x + snake.direction.x * this.gridSize,
            y: head.y + snake.direction.y * this.gridSize
        };
        
        // Wrap around screen edges (grid-aligned)
        newHead.x = ((Math.floor(newHead.x / this.gridSize) + Math.floor(this.width / this.gridSize)) % Math.floor(this.width / this.gridSize)) * this.gridSize;
        newHead.y = ((Math.floor(newHead.y / this.gridSize) + Math.floor(this.height / this.gridSize)) % Math.floor(this.height / this.gridSize)) * this.gridSize;
        
        snake.segments.unshift(newHead);
        
        // Remove tail segment to maintain length
        if (snake.segments.length > 12) {
            snake.segments.pop();
        }
    }
    
    updateAiSnake(deltaTime) {
        const snake = this.aiSnake;
        
        // AI snake moves slightly slower for retro feel
        if (this.time % 10 !== 0) return;
        
        const playerHead = this.playerSnake.segments[0];
        const aiHead = snake.segments[0];
        
        // Calculate grid-based direction to player
        const dx = playerHead.x - aiHead.x;
        const dy = playerHead.y - aiHead.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        
        // Simple 4-direction movement for retro feel
        let newDirection = { x: 0, y: 0 };
        
        if (Math.abs(dx) > Math.abs(dy)) {
            newDirection.x = dx > 0 ? 1 : -1;
        } else {
            newDirection.y = dy > 0 ? 1 : -1;
        }
        
        // Occasionally change direction randomly for more interesting AI
        if (Math.random() < 0.1) {
            const directions = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
            newDirection = directions[Math.floor(Math.random() * directions.length)];
        }
        
        snake.direction = newDirection;
        
        // Move head by one grid unit
        const newHead = {
            x: aiHead.x + snake.direction.x * this.gridSize,
            y: aiHead.y + snake.direction.y * this.gridSize
        };
        
        // Wrap around screen edges (grid-aligned)
        newHead.x = ((Math.floor(newHead.x / this.gridSize) + Math.floor(this.width / this.gridSize)) % Math.floor(this.width / this.gridSize)) * this.gridSize;
        newHead.y = ((Math.floor(newHead.y / this.gridSize) + Math.floor(this.height / this.gridSize)) % Math.floor(this.height / this.gridSize)) * this.gridSize;
        
        snake.segments.unshift(newHead);
        
        // Remove tail segment to maintain length
        if (snake.segments.length > 10) {
            snake.segments.pop();
        }
    }
    
    checkProximity() {
        const playerHead = this.playerSnake.segments[0];
        const aiHead = this.aiSnake.segments[0];
        const distance = Math.sqrt(
            (playerHead.x - aiHead.x) ** 2 + (playerHead.y - aiHead.y) ** 2
        );
        
        if (distance < 60 && this.gameState === 'searching') {
            // Play proximity sound if getting closer
            if (this.proximityTimer % 60 === 0) { // Every second
                this.playSound('proximity');
            }
            
            this.proximityTimer += 16; // Assuming 60 FPS
            if (this.proximityTimer > 2000) { // 2 seconds
                this.enableFoodSpawning();
            }
        } else {
            this.proximityTimer = Math.max(0, this.proximityTimer - 8);
        }
        
        // Check if food is eaten by either snake
        if (this.food) {
            const playerDistance = Math.sqrt(
                (playerHead.x - this.food.x) ** 2 + (playerHead.y - this.food.y) ** 2
            );
            const aiDistance = Math.sqrt(
                (aiHead.x - this.food.x) ** 2 + (aiHead.y - this.food.y) ** 2
            );
            
            if (playerDistance < this.gridSize || aiDistance < this.gridSize) {
                this.eatFood();
            }
        }
    }
    
    updateFakeFood() {
        // Only manage fake food during searching phase
        if (this.gameState !== 'searching') {
            this.fakeFood = null;
            return;
        }
        
        this.fakeFoodTimer++;
        
        // Spawn fake food if none exists and enough time has passed
        if (!this.fakeFood && this.fakeFoodTimer > this.fakeFoodRespawnDelay) {
            this.spawnFakeFood();
            this.fakeFoodTimer = 0;
        }
        
        // Check if player is getting too close to fake food
        if (this.fakeFood) {
            const playerHead = this.playerSnake.segments[0];
            const distance = Math.sqrt(
                (playerHead.x - this.fakeFood.x) ** 2 + (playerHead.y - this.fakeFood.y) ** 2
            );
            
            // Fake food moves away when player gets within 3 grid squares
            if (distance < this.gridSize * 3) {
                this.animateFoodMovement();
                this.fakeFoodDisappearances++;
                this.playSound('proximity'); // Sad sound when food disappears
            }
        }
    }
    
    spawnFakeFood() {
        // Generate random grid-aligned position far from player
        const gridCols = Math.floor(this.width / this.gridSize);
        const gridRows = Math.floor(this.height / this.gridSize);
        const borderOffset = 3;
        const playerHead = this.playerSnake.segments[0];
        
        let attempts = 0;
        let validPosition = false;
        let foodX, foodY;
        
        while (!validPosition && attempts < 100) {
            const gridX = borderOffset + Math.floor(Math.random() * (gridCols - borderOffset * 2));
            const gridY = borderOffset + Math.floor(Math.random() * (gridRows - borderOffset * 2));
            
            foodX = gridX * this.gridSize;
            foodY = gridY * this.gridSize;
            
            // Ensure fake food spawns away from player (at least 5 grid squares)
            const distanceFromPlayer = Math.sqrt(
                (playerHead.x - foodX) ** 2 + (playerHead.y - foodY) ** 2
            );
            
            if (distanceFromPlayer > this.gridSize * 5) {
                validPosition = true;
                
                // Also check it's not too close to snake segments
                for (let segment of this.playerSnake.segments) {
                    if (Math.abs(segment.x - foodX) < this.gridSize * 2 && Math.abs(segment.y - foodY) < this.gridSize * 2) {
                        validPosition = false;
                        break;
                    }
                }
                
                // Check AI snake too
                if (validPosition) {
                    for (let segment of this.aiSnake.segments) {
                        if (Math.abs(segment.x - foodX) < this.gridSize * 2 && Math.abs(segment.y - foodY) < this.gridSize * 2) {
                            validPosition = false;
                            break;
                        }
                    }
                }
            }
            
            attempts++;
        }
        
        if (validPosition) {
            this.fakeFood = {
                x: foodX,
                y: foodY,
                glow: Math.random() * Math.PI * 2, // Random glow phase
                pulseSpeed: 0.08,
                opacity: 0.7 // Slightly more transparent than real food
            };
        }
    }
    
    animateFoodMovement() {
        if (!this.fakeFood) return;
        
        const currentX = this.fakeFood.x;
        const currentY = this.fakeFood.y;
        
        // Generate new position far from player
        const playerHead = this.playerSnake.segments[0];
        const gridCols = Math.floor(this.width / this.gridSize);
        const gridRows = Math.floor(this.height / this.gridSize);
        const borderOffset = 3;
        
        let newX, newY;
        let attempts = 0;
        
        do {
            const gridX = borderOffset + Math.floor(Math.random() * (gridCols - borderOffset * 2));
            const gridY = borderOffset + Math.floor(Math.random() * (gridRows - borderOffset * 2));
            
            newX = gridX * this.gridSize;
            newY = gridY * this.gridSize;
            
            const distanceFromPlayer = Math.sqrt(
                (playerHead.x - newX) ** 2 + (playerHead.y - newY) ** 2
            );
            
            attempts++;
        } while (attempts < 50 && Math.sqrt((playerHead.x - newX) ** 2 + (playerHead.y - newY) ** 2) < this.gridSize * 6);
        
        // Create animated food movement
        this.fakeFood.isAnimating = true;
        this.fakeFood.startX = currentX;
        this.fakeFood.startY = currentY;
        this.fakeFood.targetX = newX;
        this.fakeFood.targetY = newY;
        this.fakeFood.animationProgress = 0;
        this.fakeFood.animationSpeed = 0.08;
        
        // Create trail effect
        this.createFoodTrail(currentX, currentY, newX, newY);
    }
    
    createFoodTrail(startX, startY, endX, endY) {
        const steps = 20;
        const trailColor = 'rgba(255, 100, 100, 0.6)';
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;
            
            this.foodTrails.push({
                x: x,
                y: y,
                life: 1.0,
                maxLife: 1.0,
                color: trailColor,
                size: this.pixelSize,
                delay: i * 2 // Stagger the trail appearance
            });
        }
    }
    
    updateFoodAnimation() {
        if (!this.fakeFood || !this.fakeFood.isAnimating) return;
        
        this.fakeFood.animationProgress += this.fakeFood.animationSpeed;
        
        if (this.fakeFood.animationProgress >= 1) {
            // Animation complete
            this.fakeFood.x = this.fakeFood.targetX;
            this.fakeFood.y = this.fakeFood.targetY;
            this.fakeFood.isAnimating = false;
            this.fakeFoodTimer = 0; // Reset timer
        } else {
            // Interpolate position
            const progress = this.easeOutQuart(this.fakeFood.animationProgress);
            this.fakeFood.x = this.fakeFood.startX + (this.fakeFood.targetX - this.fakeFood.startX) * progress;
            this.fakeFood.y = this.fakeFood.startY + (this.fakeFood.targetY - this.fakeFood.startY) * progress;
        }
    }
    
    easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }
    
    enableFoodSpawning() {
        this.canSpawnFood = true;
        this.gameState = 'feeding';
        this.psychedelicMode = true;
        this.createHeartExplosion();
        this.spawnFood();
        this.playSound('found');
        this.hideInstruction(); // Hide instructions when food spawning begins
    }
    
    createHeartExplosion() {
        const playerHead = this.playerSnake.segments[0];
        const aiHead = this.aiSnake.segments[0];
        const centerX = (playerHead.x + aiHead.x) / 2;
        const centerY = (playerHead.y + aiHead.y) / 2;
        
        // Create heart-shaped particles
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const speed = 2 + Math.random() * 3;
            
            this.heartParticles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: i % 2 === 0 ? '#ff00ff' : '#ffbf00', // Magenta and amber
                life: 1.0,
                size: this.pixelSize + Math.random() * 4,
                decay: 0.015,
                trail: []
            });
        }
    }
    
    spawnFood() {
        if (!this.canSpawnFood) return;
        
        // Generate random grid-aligned position
        const gridCols = Math.floor(this.width / this.gridSize);
        const gridRows = Math.floor(this.height / this.gridSize);
        const borderOffset = 2; // Keep away from edges
        
        let attempts = 0;
        let validPosition = false;
        let foodX, foodY;
        
        while (!validPosition && attempts < 50) {
            const gridX = borderOffset + Math.floor(Math.random() * (gridCols - borderOffset * 2));
            const gridY = borderOffset + Math.floor(Math.random() * (gridRows - borderOffset * 2));
            
            foodX = gridX * this.gridSize;
            foodY = gridY * this.gridSize;
            
            // Check if position conflicts with snake segments
            validPosition = true;
            
            // Check player snake
            for (let segment of this.playerSnake.segments) {
                if (Math.abs(segment.x - foodX) < this.gridSize && Math.abs(segment.y - foodY) < this.gridSize) {
                    validPosition = false;
                    break;
                }
            }
            
            // Check AI snake
            if (validPosition) {
                for (let segment of this.aiSnake.segments) {
                    if (Math.abs(segment.x - foodX) < this.gridSize && Math.abs(segment.y - foodY) < this.gridSize) {
                        validPosition = false;
                        break;
                    }
                }
            }
            
            attempts++;
        }
        
        this.food = {
            x: foodX,
            y: foodY,
            glow: 0,
            pulseSpeed: 0.1
        };
    }
    
    eatFood() {
        this.playSound('bloom');
        this.gameState = 'bloom';
        this.bloomIntensity = 0;
        this.revealProgress = 0;
        this.bloomStartTime = this.time;
        this.food = null; // Remove food
    }
    
    updatePsychedelicEffects() {
        if (this.psychedelicMode && this.psychedelicIntensity < 1) {
            this.psychedelicIntensity += 0.02;
        }
        
        // Update heart particles
        this.heartParticles = this.heartParticles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            
            // Add trail points
            particle.trail.push({x: particle.x, y: particle.y, life: 0.5});
            if (particle.trail.length > 8) particle.trail.shift();
            
            // Update trail
            particle.trail = particle.trail.filter(point => {
                point.life -= 0.08;
                return point.life > 0;
            });
            
            return particle.life > 0;
        });
        
        // Update food trails
        this.foodTrails = this.foodTrails.filter(trail => {
            if (trail.delay > 0) {
                trail.delay--;
                return true;
            }
            trail.life -= 0.05;
            return trail.life > 0;
        });
        
        // Create decay elements randomly in psychedelic mode
        if (this.psychedelicMode && Math.random() < 0.3) {
            this.createDecayElement();
        }
        
        // Update decay elements (game of life style)
        this.decayElements = this.decayElements.filter(element => {
            element.life -= element.decay;
            element.hue += element.hueShift;
            return element.life > 0;
        });
    }
    
    createDecayElement() {
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        
        this.decayElements.push({
            x: x,
            y: y,
            life: 1.0,
            decay: 0.005 + Math.random() * 0.01,
            hue: Math.random() * 360,
            hueShift: (Math.random() - 0.5) * 5,
            size: this.pixelSize + Math.random() * 6,
            pattern: Math.floor(Math.random() * 3) // Different decay patterns
        });
    }
    
    render() {
        // Handle bloom state
        if (this.gameState === 'bloom') {
            this.updateBloomEffect();
        }
        
        // Clear main canvas with retro green background
        const bgIntensity = this.bloomIntensity * 0.2;
        this.ctx.fillStyle = `rgb(${Math.floor(20 + bgIntensity * 50)}, ${Math.floor(80 + bgIntensity * 100)}, ${Math.floor(20 + bgIntensity * 50)})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw retro border
        this.drawRetroBorder();
        
        // Draw grid overlay (fade during bloom)
        if (this.bloomIntensity < 0.8) {
            this.drawGrid();
        }
        
        // Draw bloom particles
        if (this.gameState === 'bloom') {
            this.drawBloomParticles();
        }
        
        // Draw psychedelic effects first (background layers)
        this.drawDecayElements();
        this.drawFoodTrails();
        
        // Draw snakes
        this.drawSnake(this.playerSnake);
        this.drawSnake(this.aiSnake);
        
        // Draw psychedelic effects (foreground layers)
        this.drawHeartParticles();
        
        // Draw food if it exists
        if (this.food) {
            this.drawFood();
        }
        
        // Draw fake food if it exists (during searching phase)
        if (this.fakeFood) {
            this.drawFakeFood();
        }
        
        // Draw bloom overlay
        if (this.bloomIntensity > 0) {
            this.drawBloomOverlay();
        }
        
        // Draw reset message overlay
        this.drawResetMessage();
        
        // Apply simple scanlines for retro feel
        if (this.bloomIntensity < 0.9) {
            this.drawScanlines();
        }
        
        // Update UI
        this.updateUI();
    }
    
    updateBloomEffect() {
        const bloomDuration = 300; // 5 seconds at 60fps
        const elapsed = this.time - this.bloomStartTime;
        
        if (elapsed < bloomDuration) {
            // Bloom phase - increase intensity
            this.bloomIntensity = Math.min(1, elapsed / 180);
            this.revealProgress = Math.min(1, elapsed / 120);
        } else if (elapsed < bloomDuration + 180) {
            // Hold phase
            this.bloomIntensity = 1;
            this.revealProgress = 1;
        } else {
            // Transition to reset
            this.gameState = 'reset';
            this.resetStartTime = this.time;
        }
    }
    
    drawBloomParticles() {
        const particleCount = Math.floor(this.bloomIntensity * 25); // Reduced count
        
        for (let i = 0; i < particleCount; i += 2) { // Skip every other particle
            const angle = (i / particleCount) * Math.PI * 2 + this.time * 0.01;
            const distance = 50 + Math.sin(this.time * 0.02 + i) * 30;
            const x = this.width / 2 + Math.cos(angle) * distance;
            const y = this.height / 2 + Math.sin(angle) * distance;
            
            const size = 3; // Fixed size for performance
            const alpha = this.bloomIntensity * 0.6;
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
    }
    
    drawBloomOverlay() {
        // Central bloom light
        const gradient = this.ctx.createRadialGradient(
            this.width / 2, this.height / 2, 0,
            this.width / 2, this.height / 2, 200
        );
        
        const intensity = this.bloomIntensity;
        gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
        gradient.addColorStop(0.3, `rgba(255, 255, 0, ${intensity * 0.4})`);
        gradient.addColorStop(0.6, `rgba(255, 100, 255, ${intensity * 0.2})`);
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Message reveal
        if (this.revealProgress > 0.5) {
            this.ctx.font = 'bold 32px monospace';
            this.ctx.fillStyle = `rgba(255, 255, 255, ${(this.revealProgress - 0.5) * 2})`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TOGETHER', this.width / 2, this.height / 2 - 50);
            this.ctx.textAlign = 'left';
        }
    }
    
    drawResetMessage() {
        if (this.gameState !== 'reset') return;
        
        const elapsed = this.time - this.resetStartTime;
        const fadeIn = Math.min(1, elapsed / 60);
        
        // Terminal-style background
        this.ctx.fillStyle = `rgba(0, 0, 0, ${fadeIn * 0.8})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Terminal text
        this.ctx.font = '20px monospace';
        this.ctx.fillStyle = `rgba(0, 255, 0, ${fadeIn})`;
        this.ctx.textAlign = 'center';
        
        const messages = [
            '> Friendship as eating together',
            '> Connection established',
            '> Restarting...'
        ];
        
        messages.forEach((msg, index) => {
            if (elapsed > (index + 1) * 80) {
                this.ctx.fillText(msg, this.width / 2, this.height / 2 - 40 + index * 30);
            }
        });
        
        // Blinking cursor
        if (Math.floor(elapsed / 30) % 2 === 0) {
            this.ctx.fillText('_', this.width / 2 + 50, this.height / 2 + 50);
        }
        
        this.ctx.textAlign = 'left';
    }
    
    drawRetroBorder() {
        const borderWidth = 16;
        const pixelSize = 4;
        
        this.ctx.fillStyle = '#1a4a1a';
        
        // Draw pixelated border pattern
        for (let x = 0; x < this.width; x += pixelSize) {
            for (let y = 0; y < borderWidth; y += pixelSize) {
                if ((x + y) % (pixelSize * 2) === 0) {
                    this.ctx.fillRect(x, y, pixelSize, pixelSize);
                    this.ctx.fillRect(x, this.height - borderWidth + y, pixelSize, pixelSize);
                }
            }
        }
        
        for (let y = 0; y < this.height; y += pixelSize) {
            for (let x = 0; x < borderWidth; x += pixelSize) {
                if ((x + y) % (pixelSize * 2) === 0) {
                    this.ctx.fillRect(x, y, pixelSize, pixelSize);
                    this.ctx.fillRect(this.width - borderWidth + x, y, pixelSize, pixelSize);
                }
            }
        }
    }
    
    drawGrid() {
        // Subtle pixel grid
        this.ctx.strokeStyle = '#0a3a0a';
        this.ctx.lineWidth = 0.5;
        
        for (let x = 0; x < this.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }
    
    drawSnake(snake) {
        // Disable image smoothing for pixelated look
        this.ctx.imageSmoothingEnabled = false;
        
        snake.segments.forEach((segment, index) => {
            const alpha = 1 - (index / snake.segments.length) * 0.2;
            const isHead = index === 0;
            const size = isHead ? this.pixelSize + 2 : this.pixelSize;
            
            // Snap to grid
            const gridX = Math.floor(segment.x / this.gridSize) * this.gridSize;
            const gridY = Math.floor(segment.y / this.gridSize) * this.gridSize;
            
            // Get color (psychedelic if mode is active)
            let mainColor = snake.color;
            let darkColor = snake.darkColor || '#000000';
            
            if (this.psychedelicMode) {
                const hue = (this.time * 2 + index * 30) % 360;
                const isPlayerSnake = snake === this.playerSnake;
                
                if (isPlayerSnake) {
                    // Player snake gets magenta-purple spectrum
                    mainColor = `hsl(${300 + Math.sin(this.time * 0.05 + index * 0.3) * 60}, 80%, 60%)`;
                    darkColor = `hsl(${300 + Math.sin(this.time * 0.05 + index * 0.3) * 60}, 80%, 30%)`;
                } else {
                    // AI snake gets amber-orange spectrum
                    mainColor = `hsl(${45 + Math.sin(this.time * 0.05 + index * 0.3) * 30}, 90%, 65%)`;
                    darkColor = `hsl(${45 + Math.sin(this.time * 0.05 + index * 0.3) * 30}, 90%, 35%)`;
                }
            }
            
            // Draw main block with 3D effect
            this.ctx.fillStyle = mainColor;
            this.ctx.fillRect(gridX, gridY, size, size);
            
            // Add highlight (top-left)
            this.ctx.fillStyle = this.psychedelicMode ? 
                `rgba(255, 255, 255, ${0.6 + Math.sin(this.time * 0.1) * 0.3})` : 
                '#ffffff40';
            this.ctx.fillRect(gridX, gridY, size - 2, 1);
            this.ctx.fillRect(gridX, gridY, 1, size - 2);
            
            // Add shadow (bottom-right)
            this.ctx.fillStyle = darkColor;
            this.ctx.fillRect(gridX + size - 1, gridY + 1, 1, size - 1);
            this.ctx.fillRect(gridX + 1, gridY + size - 1, size - 1, 1);
            
            // Draw pixel eyes on head
            if (isHead) {
                this.ctx.fillStyle = this.psychedelicMode ? '#ffffff' : '#000000';
                this.ctx.fillRect(gridX + 1, gridY + 1, 1, 1);
                this.ctx.fillRect(gridX + size - 3, gridY + 1, 1, 1);
            }
        });
    }
    
    
    drawFood() {
        this.food.glow += this.food.pulseSpeed;
        
        // Grid-aligned position
        const gridX = this.food.x;
        const gridY = this.food.y;
        
        // Pulsing glow effect
        const pulse = Math.sin(this.food.glow) * 0.5 + 0.5;
        const glowRadius = 2 + Math.floor(pulse * 2);
        
        // Draw glow
        for (let dx = -glowRadius; dx <= glowRadius; dx++) {
            for (let dy = -glowRadius; dy <= glowRadius; dy++) {
                const distance = Math.abs(dx) + Math.abs(dy);
                if (distance <= glowRadius) {
                    const alpha = (1 - (distance / glowRadius)) * pulse * 0.4;
                    this.ctx.fillStyle = `rgba(255, 255, 100, ${alpha})`;
                    this.ctx.fillRect(
                        gridX + dx * this.pixelSize,
                        gridY + dy * this.pixelSize,
                        this.pixelSize,
                        this.pixelSize
                    );
                }
            }
        }
        
        // Draw main food pixel (apple-like)
        const size = this.pixelSize;
        
        // Main red body
        this.ctx.fillStyle = '#ff3333';
        this.ctx.fillRect(gridX, gridY, size, size);
        
        // Highlight
        this.ctx.fillStyle = '#ff6666';
        this.ctx.fillRect(gridX, gridY, size - 2, 1);
        this.ctx.fillRect(gridX, gridY, 1, size - 2);
        
        // Shadow
        this.ctx.fillStyle = '#cc0000';
        this.ctx.fillRect(gridX + size - 1, gridY + 1, 1, size - 1);
        this.ctx.fillRect(gridX + 1, gridY + size - 1, size - 1, 1);
        
        // Small green leaf on top
        this.ctx.fillStyle = '#33ff33';
        this.ctx.fillRect(gridX + size/2, gridY - 1, 2, 2);
    }
    
    drawFakeFood() {
        this.fakeFood.glow += this.fakeFood.pulseSpeed;
        
        // Grid-aligned position
        const gridX = this.fakeFood.x;
        const gridY = this.fakeFood.y;
        
        // More subtle pulsing glow effect for fake food
        const pulse = Math.sin(this.fakeFood.glow) * 0.3 + 0.5;
        const glowRadius = 1 + Math.floor(pulse * 1.5);
        const baseOpacity = this.fakeFood.opacity;
        
        // Draw dimmer glow
        for (let dx = -glowRadius; dx <= glowRadius; dx++) {
            for (let dy = -glowRadius; dy <= glowRadius; dy++) {
                const distance = Math.abs(dx) + Math.abs(dy);
                if (distance <= glowRadius) {
                    const alpha = (1 - (distance / glowRadius)) * pulse * 0.3 * baseOpacity;
                    this.ctx.fillStyle = `rgba(255, 255, 150, ${alpha})`;
                    this.ctx.fillRect(
                        gridX + dx * this.pixelSize,
                        gridY + dy * this.pixelSize,
                        this.pixelSize,
                        this.pixelSize
                    );
                }
            }
        }
        
        // Draw main fake food pixel (more muted colors)
        const size = this.pixelSize;
        
        // Main body (dimmer red)
        this.ctx.fillStyle = `rgba(255, 100, 100, ${baseOpacity})`;
        this.ctx.fillRect(gridX, gridY, size, size);
        
        // Dimmer highlight
        this.ctx.fillStyle = `rgba(255, 150, 150, ${baseOpacity * 0.8})`;
        this.ctx.fillRect(gridX, gridY, size - 2, 1);
        this.ctx.fillRect(gridX, gridY, 1, size - 2);
        
        // Dimmer shadow
        this.ctx.fillStyle = `rgba(150, 50, 50, ${baseOpacity})`;
        this.ctx.fillRect(gridX + size - 1, gridY + 1, 1, size - 1);
        this.ctx.fillRect(gridX + 1, gridY + size - 1, size - 1, 1);
        
        // Dimmer green leaf
        this.ctx.fillStyle = `rgba(100, 200, 100, ${baseOpacity})`;
        this.ctx.fillRect(gridX + size/2, gridY - 1, 2, 2);
    }
    
    drawFoodTrails() {
        this.foodTrails.forEach(trail => {
            if (trail.delay > 0) return;
            
            const alpha = trail.life;
            this.ctx.fillStyle = trail.color.replace('0.6', alpha);
            this.ctx.fillRect(trail.x - trail.size/2, trail.y - trail.size/2, trail.size, trail.size);
        });
    }
    
    drawHeartParticles() {
        this.heartParticles.forEach(particle => {
            // Draw particle trails first
            particle.trail.forEach((point, index) => {
                const alpha = point.life * (index / particle.trail.length);
                this.ctx.fillStyle = particle.color + Math.floor(alpha * 128).toString(16).padStart(2, '0');
                this.ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
            });
            
            // Draw main particle
            this.ctx.fillStyle = particle.color + Math.floor(particle.life * 255).toString(16).padStart(2, '0');
            this.ctx.fillRect(
                particle.x - particle.size/2, 
                particle.y - particle.size/2, 
                particle.size, 
                particle.size
            );
        });
    }
    
    drawDecayElements() {
        this.decayElements.forEach(element => {
            const alpha = element.life;
            const saturation = this.psychedelicMode ? 80 : 40;
            const lightness = 50 + Math.sin(this.time * 0.05) * 20;
            
            this.ctx.fillStyle = `hsla(${element.hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            
            // Different decay patterns
            switch (element.pattern) {
                case 0: // Single pixel
                    this.ctx.fillRect(element.x, element.y, element.size, element.size);
                    break;
                case 1: // Cross pattern
                    this.ctx.fillRect(element.x, element.y, element.size, element.size);
                    this.ctx.fillRect(element.x - element.size, element.y, element.size, element.size);
                    this.ctx.fillRect(element.x + element.size, element.y, element.size, element.size);
                    this.ctx.fillRect(element.x, element.y - element.size, element.size, element.size);
                    this.ctx.fillRect(element.x, element.y + element.size, element.size, element.size);
                    break;
                case 2: // Diamond pattern
                    const halfSize = element.size / 2;
                    this.ctx.fillRect(element.x, element.y - halfSize, element.size, element.size);
                    this.ctx.fillRect(element.x - halfSize, element.y, element.size, element.size);
                    this.ctx.fillRect(element.x + halfSize, element.y, element.size, element.size);
                    this.ctx.fillRect(element.x, element.y + halfSize, element.size, element.size);
                    break;
            }
        });
    }
    
    drawScanlines() {
        // Simple retro scanlines
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let y = 0; y < this.height; y += 4) {
            this.ctx.fillRect(0, y, this.width, 1);
        }
    }
    
    updateUI() {
        // No UI elements in fullscreen mode - game is purely visual
    }
    
    updateInstructions() {
        if (!this.instructionEl) return;
        
        const currentTime = Date.now();
        
        // Check if we should show the next instruction
        for (let i = this.currentInstructionIndex + 1; i < this.instructions.length; i++) {
            const instruction = this.instructions[i];
            
            if (currentTime - this.instructionStartTime > instruction.delay && instruction.condition()) {
                this.showInstruction(instruction.text);
                this.currentInstructionIndex = i;
                break;
            }
        }
        
        // Update typewriter effect
        this.updateTypewriter();
    }
    
    showInstruction(text) {
        this.typewriterTarget = text;
        this.typewriterText = '';
        this.typewriterActive = true;
        this.typewriterStartTime = Date.now();
        this.instructionEl.classList.add('visible');
    }
    
    hideInstruction() {
        if (this.instructionEl) {
            this.instructionEl.classList.remove('visible');
            this.typewriterActive = false;
        }
    }
    
    updateTypewriter() {
        if (!this.typewriterActive || !this.instructionEl) return;
        
        const currentTime = Date.now();
        const elapsed = currentTime - this.typewriterStartTime;
        const targetLength = Math.floor(elapsed / this.typewriterSpeed);
        
        if (targetLength > this.typewriterText.length && this.typewriterText.length < this.typewriterTarget.length) {
            this.typewriterText = this.typewriterTarget.substring(0, targetLength);
        }
        
        // Display the text with cursor
        const showCursor = this.typewriterText.length < this.typewriterTarget.length;
        this.instructionEl.innerHTML = this.typewriterText + (showCursor ? '<span class="typewriter-cursor"></span>' : '');
        
        // Hide instruction after completion and delay
        if (this.typewriterText.length >= this.typewriterTarget.length) {
            setTimeout(() => this.hideInstruction(), 4000);
        }
    }
    
    gameLoop() {
        const currentTime = performance.now();
        const deltaTime = Math.min(currentTime - this.lastTime, 32); // Cap to 30ms max
        this.lastTime = currentTime;
        
        // Use fixed timestep for smooth animation
        this.time += 1;
        this.codeOffset += 0.5;
        
        // Handle different game states
        if (this.gameState === 'reset') {
            this.handleResetState();
        } else {
            this.handleInput();
            this.updateSnakes(1); // Fixed timestep
        }
        
        this.render();
        this.updateInstructions();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    handleResetState() {
        const resetDuration = 240; // 4 seconds at 60fps
        const elapsed = this.time - this.resetStartTime;
        
        if (elapsed > resetDuration) {
            // Reset the game
            this.resetGame();
        }
    }
    
    resetGame() {
        // Reset all game state
        this.gameState = 'searching';
        this.time = 0;
        this.codeOffset = 0;
        this.proximityTimer = 0;
        this.bloomIntensity = 0;
        this.revealProgress = 0;
        this.canSpawnFood = false;
        
        // Reset instruction system
        this.currentInstructionIndex = -1;
        this.instructionStartTime = Date.now();
        this.hasPlayerMoved = false;
        this.hideInstruction();
        this.food = null;
        this.fakeFood = null;
        this.fakeFoodTimer = 0;
        this.fakeFoodDisappearances = 0;
        this.fakeFoodHintThreshold = 2 + Math.floor(Math.random() * 6); // New random threshold each game
        
        // Reset psychedelic effects
        this.foodTrails = [];
        this.heartParticles = [];
        this.psychedelicMode = false;
        this.psychedelicIntensity = 0;
        this.decayElements = [];
        
        // Reset snake positions
        this.initSnakes();
    }
    
    // Utility function
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

// Global function for fullscreen toggle
function toggleFullscreen() {
    const gameContainer = document.getElementById('gameContainer');
    
    if (!document.fullscreenElement) {
        if (gameContainer.requestFullscreen) {
            gameContainer.requestFullscreen();
        } else if (gameContainer.webkitRequestFullscreen) {
            gameContainer.webkitRequestFullscreen();
        } else if (gameContainer.msRequestFullscreen) {
            gameContainer.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}