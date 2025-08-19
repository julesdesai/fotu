class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ui = document.getElementById('ui');
        
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
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
        
        this.gameLoop();
    }
    
    initSnakes() {
        this.playerSnake = {
            segments: [],
            direction: { x: 1, y: 0 },
            speed: 2,
            size: 8,
            color: '#00ff00'
        };
        
        this.aiSnake = {
            segments: [],
            direction: { x: -1, y: 0 },
            speed: 1.5,
            size: 8,
            color: '#ff6600',
            targetDistance: 80
        };
        
        // Initialize player snake in center
        for (let i = 0; i < 10; i++) {
            this.playerSnake.segments.push({
                x: this.width / 2 - i * 10,
                y: this.height / 2
            });
        }
        
        // Initialize AI snake at opposite side
        for (let i = 0; i < 8; i++) {
            this.aiSnake.segments.push({
                x: 100 - i * 10,
                y: this.height / 2 + 50
            });
        }
        
        this.X = null;
        this.proximityTimer = 0;
        this.bloomIntensity = 0;
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
        const speed = 0.1;
        let newDir = { ...this.playerSnake.direction };
        
        // Arrow keys or WASD
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            newDir = { x: 0, y: -1 };
        } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            newDir = { x: 0, y: 1 };
        } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            newDir = { x: -1, y: 0 };
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            newDir = { x: 1, y: 0 };
        }
        
        // Smooth direction change
        this.playerSnake.direction.x = lerp(this.playerSnake.direction.x, newDir.x, speed);
        this.playerSnake.direction.y = lerp(this.playerSnake.direction.y, newDir.y, speed);
        
        // Normalize direction
        const mag = Math.sqrt(
            this.playerSnake.direction.x ** 2 + this.playerSnake.direction.y ** 2
        );
        if (mag > 0) {
            this.playerSnake.direction.x /= mag;
            this.playerSnake.direction.y /= mag;
        }
    }
    
    updateSnakes(deltaTime) {
        this.updatePlayerSnake(deltaTime);
        this.updateAiSnake(deltaTime);
        this.checkProximity();
    }
    
    updatePlayerSnake(deltaTime) {
        const snake = this.playerSnake;
        const head = snake.segments[0];
        
        // Move head
        const newHead = {
            x: head.x + snake.direction.x * snake.speed * deltaTime,
            y: head.y + snake.direction.y * snake.speed * deltaTime
        };
        
        // Wrap around screen edges
        newHead.x = (newHead.x + this.width) % this.width;
        newHead.y = (newHead.y + this.height) % this.height;
        
        snake.segments.unshift(newHead);
        
        // Follow the leader - each segment follows the one in front
        for (let i = 1; i < snake.segments.length; i++) {
            const current = snake.segments[i];
            const target = snake.segments[i - 1];
            const distance = Math.sqrt((target.x - current.x) ** 2 + (target.y - current.y) ** 2);
            
            if (distance > snake.size) {
                const angle = Math.atan2(target.y - current.y, target.x - current.x);
                current.x += Math.cos(angle) * (distance - snake.size) * 0.5;
                current.y += Math.sin(angle) * (distance - snake.size) * 0.5;
            }
        }
        
        // Remove excess segments
        if (snake.segments.length > 15) {
            snake.segments.pop();
        }
    }
    
    updateAiSnake(deltaTime) {
        const snake = this.aiSnake;
        const playerHead = this.playerSnake.segments[0];
        const aiHead = snake.segments[0];
        
        // Calculate direction to player, but maintain some distance
        const dx = playerHead.x - aiHead.x;
        const dy = playerHead.y - aiHead.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);
        
        let targetX, targetY;
        if (distance > snake.targetDistance) {
            // Move towards player
            targetX = dx / distance;
            targetY = dy / distance;
        } else {
            // Maintain distance by moving more slowly or circling
            const perpX = -dy / distance;
            const perpY = dx / distance;
            targetX = (dx / distance) * 0.3 + perpX * 0.7;
            targetY = (dy / distance) * 0.3 + perpY * 0.7;
        }
        
        // Smooth direction change
        const smoothing = 0.05;
        snake.direction.x = lerp(snake.direction.x, targetX, smoothing);
        snake.direction.y = lerp(snake.direction.y, targetY, smoothing);
        
        // Normalize
        const mag = Math.sqrt(snake.direction.x ** 2 + snake.direction.y ** 2);
        if (mag > 0) {
            snake.direction.x /= mag;
            snake.direction.y /= mag;
        }
        
        // Move head
        const newHead = {
            x: aiHead.x + snake.direction.x * snake.speed * deltaTime,
            y: aiHead.y + snake.direction.y * snake.speed * deltaTime
        };
        
        // Wrap around screen edges
        newHead.x = (newHead.x + this.width) % this.width;
        newHead.y = (newHead.y + this.height) % this.height;
        
        snake.segments.unshift(newHead);
        
        // Follow the leader
        for (let i = 1; i < snake.segments.length; i++) {
            const current = snake.segments[i];
            const target = snake.segments[i - 1];
            const distance = Math.sqrt((target.x - current.x) ** 2 + (target.y - current.y) ** 2);
            
            if (distance > snake.size) {
                const angle = Math.atan2(target.y - current.y, target.x - current.x);
                current.x += Math.cos(angle) * (distance - snake.size) * 0.5;
                current.y += Math.sin(angle) * (distance - snake.size) * 0.5;
            }
        }
        
        // Remove excess segments
        if (snake.segments.length > 12) {
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
                this.spawnX();
            }
        } else {
            this.proximityTimer = Math.max(0, this.proximityTimer - 8);
        }
        
        // Check if X is collected
        if (this.X && distance < 30) {
            this.playSound('bloom');
            this.gameState = 'bloom';
            this.bloomIntensity = 0;
            this.revealProgress = 0;
            this.bloomStartTime = this.time;
        }
    }
    
    spawnX() {
        const playerHead = this.playerSnake.segments[0];
        const aiHead = this.aiSnake.segments[0];
        
        this.X = {
            x: (playerHead.x + aiHead.x) / 2,
            y: (playerHead.y + aiHead.y) / 2,
            glow: 0
        };
        
        this.playSound('found');
        this.gameState = 'found';
    }
    
    render() {
        // Handle bloom state
        if (this.gameState === 'bloom') {
            this.updateBloomEffect();
        }
        
        // Clear main canvas with bloom-affected background
        const bgIntensity = this.bloomIntensity * 0.3;
        this.ctx.fillStyle = `rgb(${Math.floor(bgIntensity * 255)}, ${Math.floor((0.1 + bgIntensity) * 255)}, ${Math.floor(bgIntensity * 255)})`;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw grid overlay (fade during bloom)
        if (this.bloomIntensity < 0.8) {
            this.drawGrid();
        }
        
        // Draw bloom particles
        if (this.gameState === 'bloom') {
            this.drawBloomParticles();
        }
        
        // Draw snakes
        this.drawSnake(this.playerSnake);
        this.drawSnake(this.aiSnake);
        
        // Draw X if it exists
        if (this.X) {
            this.drawX();
        }
        
        // Draw bloom overlay
        if (this.bloomIntensity > 0) {
            this.drawBloomOverlay();
        }
        
        // Draw reset message overlay
        this.drawResetMessage();
        
        // Apply CRT effects (reduced during bloom)
        if (this.bloomIntensity < 0.9) {
            this.applyCRTEffects();
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
            '> FOUND: X (together)',
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
    
    drawGrid() {
        this.ctx.strokeStyle = '#002200';
        this.ctx.lineWidth = 0.5;
        
        for (let x = 0; x < this.width; x += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.height; y += 20) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }
    
    drawSnake(snake) {
        snake.segments.forEach((segment, index) => {
            const alpha = 1 - (index / snake.segments.length) * 0.3;
            
            // Draw segment body with inner border for code
            this.ctx.fillStyle = snake.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            this.ctx.fillRect(
                segment.x - snake.size / 2,
                segment.y - snake.size / 2,
                snake.size,
                snake.size
            );
            
            // Draw inner code area
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(
                segment.x - snake.size / 2 + 1,
                segment.y - snake.size / 2 + 1,
                snake.size - 2,
                snake.size - 2
            );
            
            // Draw scrolling code texture
            this.drawCodeTexture(segment, index, snake);
        });
        
        // Draw head
        const head = snake.segments[0];
        this.ctx.fillStyle = snake.color;
        this.ctx.fillRect(
            head.x - snake.size / 2 - 1,
            head.y - snake.size / 2 - 1,
            snake.size + 2,
            snake.size + 2
        );
        
        // Draw eyes on head
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(head.x - 2, head.y - 2, 1, 1);
        this.ctx.fillRect(head.x + 1, head.y - 2, 1, 1);
    }
    
    drawCodeTexture(segment, index, snake) {
        if (index >= snake.segments.length - 2) return;
        
        // Only update code texture every few frames for performance
        if (Math.floor(this.time) % 3 !== 0 && !this.gameState === 'bloom') return;
        
        this.ctx.font = '6px monospace';
        const scrollSpeed = this.gameState === 'bloom' ? 0.5 : 2;
        const codeOffset = (this.codeOffset * scrollSpeed + index * 50) % 1000;
        
        // Determine if we should show the hidden message
        const isRevealing = this.gameState === 'bloom' || this.revealProgress > 0;
        
        // Reduce density of code characters for performance
        for (let row = 0; row < 1; row++) {
            for (let col = 0; col < 2; col++) {
                const x = segment.x - snake.size / 2 + 2 + col * 3;
                const y = segment.y - snake.size / 2 + 4 + row * 4;
                
                let char;
                if (isRevealing && this.revealProgress > (index / snake.segments.length)) {
                    // Show parts of the hidden message during bloom
                    const messageIndex = (index + Math.floor(codeOffset / 100)) % this.hiddenMessage.length;
                    char = this.hiddenMessage[messageIndex];
                    this.ctx.fillStyle = '#ffffff';
                } else {
                    // Show random scrolling code
                    const charIndex = (Math.floor(codeOffset + col + row * 3) + index * 7) % this.codeChars.length;
                    char = this.codeChars[charIndex];
                    this.ctx.fillStyle = snake.color === '#00ff00' ? '#00ff0080' : '#ff660080';
                }
                
                this.ctx.fillText(char, x, y);
            }
        }
    }
    
    drawX() {
        this.X.glow += 0.1;
        const glowSize = 20 + Math.sin(this.X.glow) * 5;
        
        // Glow effect
        const gradient = this.ctx.createRadialGradient(
            this.X.x, this.X.y, 0,
            this.X.x, this.X.y, glowSize
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#ffff00');
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
            this.X.x - glowSize,
            this.X.y - glowSize,
            glowSize * 2,
            glowSize * 2
        );
        
        // Draw X
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.X.x - 8, this.X.y - 8);
        this.ctx.lineTo(this.X.x + 8, this.X.y + 8);
        this.ctx.moveTo(this.X.x + 8, this.X.y - 8);
        this.ctx.lineTo(this.X.x - 8, this.X.y + 8);
        this.ctx.stroke();
    }
    
    applyCRTEffects() {
        // Apply chromatic aberration only occasionally for performance
        if (this.time % 5 === 0) {
            this.applyChromaAberration();
        }
        
        // Optimized scanlines using a single draw operation
        this.ctx.fillStyle = '#00000015';
        for (let y = 0; y < this.height; y += 4) {
            this.ctx.fillRect(0, y, this.width, 2);
        }
        
        // CRT flicker (lighter effect)
        const flicker = 0.99 + Math.sin(this.time * 0.05) * 0.01;
        this.ctx.globalAlpha = flicker;
        this.ctx.globalAlpha = 1;
        
        // Cached vignette gradient
        if (!this.vignetteGradient) {
            this.vignetteGradient = this.ctx.createRadialGradient(
                this.width / 2, this.height / 2, 0,
                this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7
            );
            this.vignetteGradient.addColorStop(0, 'transparent');
            this.vignetteGradient.addColorStop(0.7, 'transparent');
            this.vignetteGradient.addColorStop(1, '#00000060');
        }
        
        this.ctx.fillStyle = this.vignetteGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Reduced static noise
        this.addStaticNoise();
    }
    
    applyChromaAberration() {
        // Simplified chromatic aberration using CSS filter approach
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = 0.1;
        
        // Red shift
        this.ctx.fillStyle = '#ff0000';
        this.ctx.fillRect(-1, 0, this.width, this.height);
        
        // Blue shift  
        this.ctx.fillStyle = '#0000ff';
        this.ctx.fillRect(1, 0, this.width, this.height);
        
        this.ctx.restore();
    }
    
    addStaticNoise() {
        if (Math.random() < 0.02) { // Reduced frequency
            for (let i = 0; i < 10; i++) { // Fewer particles
                this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
                this.ctx.fillRect(
                    Math.random() * this.width,
                    Math.random() * this.height,
                    1,
                    1
                );
            }
        }
    }
    
    updateUI() {
        const statusText = this.gameState === 'searching' ? 'Searching...' :
                          this.gameState === 'found' ? 'X Found - Collect it!' :
                          this.gameState === 'bloom' ? 'Connection Made' : 
                          this.gameState === 'reset' ? 'Connection Found' : 'Restarting...';
        
        this.ui.children[0].textContent = `Status: ${statusText}`;
        
        // Add proximity indicator
        if (this.gameState === 'searching' && this.proximityTimer > 0) {
            const progress = Math.min(100, (this.proximityTimer / 2000) * 100);
            this.ui.children[1].textContent = `Proximity: ${Math.floor(progress)}% | Controls: Arrow Keys or WASD`;
        } else {
            this.ui.children[1].textContent = 'Controls: Arrow Keys or WASD';
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
        this.X = null;
        
        // Reset snake positions
        this.initSnakes();
    }
}

// Utility functions
function lerp(a, b, t) {
    return a + (b - a) * t;
}

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

// Handle fullscreen changes
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function handleFullscreenChange() {
    const gameContainer = document.getElementById('gameContainer');
    const canvas = document.getElementById('gameCanvas');
    
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        // Entering fullscreen
        gameContainer.style.width = '100vw';
        gameContainer.style.height = '100vh';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
    } else {
        // Exiting fullscreen
        gameContainer.style.width = 'auto';
        gameContainer.style.height = 'auto';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.objectFit = 'initial';
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new SnakeGame();
});