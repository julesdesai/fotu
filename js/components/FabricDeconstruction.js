// Fabric Deconstruction Effect for Hero Image
class FabricDeconstruction {
    constructor() {
        this.canvas = document.getElementById('fabricCanvas');
        this.morphCanvas = document.getElementById('morphCanvas');
        this.heroContainer = document.querySelector('.hero-image');

        if (!this.canvas || !this.morphCanvas || !this.heroContainer) {
            console.log('Fabric deconstruction elements not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.isActive = false;
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Deconstruction parameters - optimized for performance
        this.threads = [];
        this.holes = [];
        this.imagePixels = [];
        this.distortionFields = [];
        this.deconstructionRadius = 80; // Reduced radius
        this.threadDensity = 8; // Fewer segments per thread
        this.animationSpeed = 0.05;
        this.fadeSpeed = 0.025; // Faster fade for cleanup
        this.maxThreads = 20; // Reduced max threads
        this.maxPixels = 30; // Limit flying pixels
        this.maxHoles = 8; // Fewer holes
        this.imageLoaded = false;
        this.lastCreationTime = 0; // For throttling
        this.creationCooldown = 100; // ms between creations
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadImageData();
        this.addEventListeners();
        this.animate();
    }
    
    setupCanvas() {
        // Set canvas size to match container
        const rect = this.heroContainer.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Handle resize
        window.addEventListener('resize', () => {
            const rect = this.heroContainer.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        });
    }
    
    loadImageData() {
        // Sample from morph canvas after a short delay to let it initialize
        setTimeout(() => {
            this.sampleImageData();
        }, 1000);

        // Re-sample periodically to keep colors in sync with morphing gallery
        setInterval(() => {
            this.sampleImageData();
        }, 2000);
    }

    sampleImageData() {
        // Sample directly from the morph canvas
        const rect = this.heroContainer.getBoundingClientRect();
        const sampleWidth = Math.min(this.morphCanvas.width || rect.width, 800);
        const sampleHeight = Math.min(this.morphCanvas.height || rect.height, 600);

        try {
            const morphCtx = this.morphCanvas.getContext('2d', { willReadFrequently: true });
            this.imageData = morphCtx.getImageData(0, 0, sampleWidth, sampleHeight);
            this.imageWidth = sampleWidth;
            this.imageHeight = sampleHeight;
            this.imageLoaded = true;
        } catch (e) {
            console.log('Could not sample morph canvas:', e.message);
            this.imageLoaded = false;
        }
    }
    
    addEventListeners() {
        // Mouse events on the hero container
        this.heroContainer.addEventListener('mouseenter', (e) => {
            this.isActive = true;
            this.heroContainer.classList.add('deconstructing');
        });
        
        this.heroContainer.addEventListener('mouseleave', (e) => {
            this.isActive = false;
            this.heroContainer.classList.remove('deconstructing');
        });
        
        this.heroContainer.addEventListener('mousemove', (e) => {
            const rect = this.heroContainer.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            
            if (this.isActive) {
                this.createDeconstructionThreads();
            }
        });
    }
    
    createDeconstructionThreads() {
        // Improved throttling for better performance
        const now = Date.now();
        if (now - this.lastCreationTime < this.creationCooldown) return;
        if (Math.random() > 0.4) return; // Reduced creation frequency
        
        this.lastCreationTime = now;
        
        // Create fewer effects for better performance
        if (Math.random() < 0.3) this.createDistortionField();
        if (Math.random() < 0.4) this.createImagePixels();
        if (Math.random() < 0.2) this.createFabricHole();
        
        // Create fewer threads radiating from mouse position
        const numThreads = Math.random() * 3 + 2; // Reduced from 6+3 to 3+2
        
        for (let i = 0; i < numThreads; i++) {
            const angle = (Math.PI * 2 / numThreads) * i + Math.random() * 0.5;
            const length = Math.random() * this.deconstructionRadius + 20;
            const speed = Math.random() * 2 + 1;
            
            // Create thread segments
            const segments = Math.floor(length / this.threadDensity);
            const threadSegments = [];
            
            for (let j = 0; j < segments; j++) {
                const distance = (j / segments) * length;
                const x = this.mouseX + Math.cos(angle) * distance;
                const y = this.mouseY + Math.sin(angle) * distance;
                
                threadSegments.push({
                    x: x,
                    y: y,
                    baseX: x,
                    baseY: y,
                    offsetX: 0,
                    offsetY: 0,
                    life: 1.0,
                    segmentIndex: j
                });
            }
            
            this.threads.push({
                segments: threadSegments,
                angle: angle,
                speed: speed,
                life: 1.0,
                color: this.getThreadColor(),
                width: Math.random() * 2 + 1
            });
        }
        
        // Limit total threads for performance
        if (this.threads.length > this.maxThreads) {
            this.threads = this.threads.slice(-this.maxThreads);
        }
    }
    
    createDistortionField() {
        // Create ripple-like distortion effects
        if (Math.random() > 0.2) return;
        
        const distortion = {
            x: this.mouseX,
            y: this.mouseY,
            radius: 0,
            maxRadius: this.deconstructionRadius * 1.5,
            intensity: Math.random() * 0.8 + 0.2,
            life: 1.0,
            speed: Math.random() * 2 + 1
        };
        
        this.distortionFields.push(distortion);
        
        // Limit distortion fields
        if (this.distortionFields.length > 8) {
            this.distortionFields = this.distortionFields.slice(-8);
        }
    }
    
    createImagePixels() {
        // Create fewer flying image pixels for better performance
        if (!this.imageLoaded) return;
        
        const numPixels = Math.random() * 8 + 4; // Reduced from 20+10 to 8+4
        
        for (let i = 0; i < numPixels; i++) {
            const offsetX = (Math.random() - 0.5) * 60;
            const offsetY = (Math.random() - 0.5) * 60;
            const startX = this.mouseX + offsetX;
            const startY = this.mouseY + offsetY;
            
            // Sample color from image at this position
            const color = this.getImageColorAt(startX, startY);
            if (!color) continue;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            
            this.imagePixels.push({
                x: startX,
                y: startY,
                velX: Math.cos(angle) * speed,
                velY: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                color: color,
                life: 1.0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
        
        // Limit image pixels for performance
        if (this.imagePixels.length > this.maxPixels) {
            this.imagePixels = this.imagePixels.slice(-this.maxPixels);
        }
    }
    
    createFabricHole() {
        // Create small holes where fabric is deconstructing
        if (Math.random() > 0.1) return; // Only occasionally create holes
        
        const hole = {
            x: this.mouseX + (Math.random() - 0.5) * 40,
            y: this.mouseY + (Math.random() - 0.5) * 40,
            radius: Math.random() * 8 + 2,
            life: 1.0,
            maxRadius: Math.random() * 15 + 5
        };
        
        this.holes.push(hole);
        
        // Limit holes for performance
        if (this.holes.length > this.maxHoles) {
            this.holes = this.holes.slice(-this.maxHoles);
        }
    }
    
    getImageColorAt(x, y) {
        if (!this.imageLoaded || !this.imageData) return null;
        
        // Scale coordinates to match sampled image dimensions
        const rect = this.heroContainer.getBoundingClientRect();
        const scaleX = this.imageWidth / rect.width;
        const scaleY = this.imageHeight / rect.height;
        
        const pixelX = Math.floor(x * scaleX);
        const pixelY = Math.floor(y * scaleY);
        
        if (pixelX < 0 || pixelX >= this.imageWidth || pixelY < 0 || pixelY >= this.imageHeight) {
            return null;
        }
        
        const index = (pixelY * this.imageWidth + pixelX) * 4;
        const data = this.imageData.data;
        
        // Ensure we don't read beyond array bounds
        if (index + 3 >= data.length) return null;
        
        return {
            r: data[index] || 0,
            g: data[index + 1] || 0,
            b: data[index + 2] || 0,
            a: (data[index + 3] || 255) / 255
        };
    }
    
    getThreadColor() {
        // Sample colors from typical fabric threads
        const colors = [
            'rgba(200, 180, 160, ',  // Beige thread
            'rgba(180, 160, 140, ',  // Brown thread
            'rgba(220, 200, 180, ',  // Light cotton
            'rgba(160, 140, 120, ',  // Dark thread
            'rgba(240, 220, 200, ',  // White thread
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    updateThreads() {
        this.threads.forEach((thread, threadIndex) => {
            thread.segments.forEach((segment, segmentIndex) => {
                // Add unraveling motion
                const time = Date.now() * 0.001;
                const waveX = Math.sin(time * thread.speed + segmentIndex * 0.3) * (segmentIndex * 0.5);
                const waveY = Math.cos(time * thread.speed + segmentIndex * 0.3) * (segmentIndex * 0.3);
                
                // Gradually increase displacement as thread unravels
                const displacement = segment.segmentIndex * 0.8;
                segment.offsetX = waveX * displacement;
                segment.offsetY = waveY * displacement;
                
                // Fade out over time
                segment.life -= this.fadeSpeed;
            });
            
            // Fade out entire thread
            thread.life -= this.fadeSpeed;
        });
        
        // Remove dead threads
        this.threads = this.threads.filter(thread => thread.life > 0);
        
        // Update holes
        this.holes.forEach(hole => {
            // Slowly expand holes
            hole.radius = Math.min(hole.maxRadius, hole.radius + 0.2);
            hole.life -= this.fadeSpeed * 0.5; // Holes fade slower
        });
        
        // Remove dead holes
        this.holes = this.holes.filter(hole => hole.life > 0);
        
        // Update distortion fields
        this.distortionFields.forEach(distortion => {
            distortion.radius += distortion.speed;
            distortion.life -= this.fadeSpeed * 0.8;
        });
        this.distortionFields = this.distortionFields.filter(d => d.life > 0 && d.radius < d.maxRadius);
        
        // Update image pixels
        this.imagePixels.forEach(pixel => {
            pixel.x += pixel.velX;
            pixel.y += pixel.velY;
            pixel.velY += 0.1; // Add slight gravity
            pixel.rotation += pixel.rotationSpeed;
            pixel.life -= this.fadeSpeed;
        });
        this.imagePixels = this.imagePixels.filter(pixel => pixel.life > 0);
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set blend mode for realistic thread overlay
        this.ctx.globalCompositeOperation = 'multiply';
        
        // Draw threads
        this.threads.forEach(thread => {
            if (thread.segments.length < 2) return;
            
            const alpha = Math.max(0, thread.life);
            this.ctx.strokeStyle = thread.color + alpha + ')';
            this.ctx.lineWidth = thread.width;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            
            // Draw thread as connected segments
            this.ctx.beginPath();
            
            for (let i = 0; i < thread.segments.length; i++) {
                const segment = thread.segments[i];
                const x = segment.baseX + segment.offsetX;
                const y = segment.baseY + segment.offsetY;
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    // Use quadratic curves for smoother thread appearance
                    const prevSegment = thread.segments[i - 1];
                    const prevX = prevSegment.baseX + prevSegment.offsetX;
                    const prevY = prevSegment.baseY + prevSegment.offsetY;
                    
                    const cpX = (prevX + x) / 2;
                    const cpY = (prevY + y) / 2;
                    this.ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
                }
            }
            
            this.ctx.stroke();
            
            // Add frayed ends
            if (thread.segments.length > 0) {
                const lastSegment = thread.segments[thread.segments.length - 1];
                this.drawFrayedEnd(
                    lastSegment.baseX + lastSegment.offsetX,
                    lastSegment.baseY + lastSegment.offsetY,
                    thread.angle,
                    alpha
                );
            }
        });
        
        // Reset blend mode
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Draw image disintegration effects
        this.drawImagePixels();
        this.drawDistortionFields();
        
        // Draw fabric holes
        this.drawFabricHoles();
        
        // Add subtle fabric texture distortion around mouse
        if (this.isActive) {
            this.drawMouseDistortionField();
        }
    }
    
    drawFabricHoles() {
        // Use destination-out blend mode to create actual holes
        this.ctx.globalCompositeOperation = 'destination-out';
        
        this.holes.forEach(hole => {
            const alpha = hole.life;
            
            // Create hole with soft edges
            const gradient = this.ctx.createRadialGradient(
                hole.x, hole.y, 0,
                hole.x, hole.y, hole.radius
            );
            
            gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
            gradient.addColorStop(0.7, `rgba(0, 0, 0, ${alpha * 0.5})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // Reset blend mode
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    drawFrayedEnd(x, y, angle, alpha) {
        // Draw small frayed fibers at thread end
        const frayCount = 3;
        const frayLength = 8;
        
        this.ctx.strokeStyle = `rgba(160, 140, 120, ${alpha * 0.6})`;
        this.ctx.lineWidth = 0.8;
        
        for (let i = 0; i < frayCount; i++) {
            const frayAngle = angle + (Math.random() - 0.5) * 0.8;
            const length = Math.random() * frayLength;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(
                x + Math.cos(frayAngle) * length,
                y + Math.sin(frayAngle) * length
            );
            this.ctx.stroke();
        }
    }
    
    drawImagePixels() {
        // Draw flying image pixels
        this.imagePixels.forEach(pixel => {
            const alpha = pixel.life;
            
            this.ctx.save();
            this.ctx.translate(pixel.x, pixel.y);
            this.ctx.rotate(pixel.rotation);
            this.ctx.globalAlpha = alpha;
            
            // Draw pixel as small rectangle with sampled color
            this.ctx.fillStyle = `rgba(${pixel.color.r}, ${pixel.color.g}, ${pixel.color.b}, ${alpha})`;
            this.ctx.fillRect(-pixel.size/2, -pixel.size/2, pixel.size, pixel.size);
            
            // Add slight blur effect
            this.ctx.shadowColor = `rgba(${pixel.color.r}, ${pixel.color.g}, ${pixel.color.b}, ${alpha * 0.5})`;
            this.ctx.shadowBlur = 2;
            this.ctx.fillRect(-pixel.size/2, -pixel.size/2, pixel.size, pixel.size);
            
            this.ctx.restore();
        });
    }
    
    drawDistortionFields() {
        // Draw ripple distortion effects
        this.distortionFields.forEach(distortion => {
            const alpha = distortion.life * distortion.intensity;
            
            // Create ripple effect with multiple circles
            for (let i = 0; i < 3; i++) {
                const rippleRadius = distortion.radius - (i * 15);
                if (rippleRadius <= 0) continue;
                
                this.ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * (0.3 - i * 0.1)})`;
                this.ctx.lineWidth = 2 - i * 0.5;
                this.ctx.globalCompositeOperation = 'multiply';
                
                this.ctx.beginPath();
                this.ctx.arc(distortion.x, distortion.y, rippleRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            
            this.ctx.globalCompositeOperation = 'source-over';
        });
    }
    
    drawMouseDistortionField() {
        // Create subtle visual distortion around mouse cursor
        const gradient = this.ctx.createRadialGradient(
            this.mouseX, this.mouseY, 0,
            this.mouseX, this.mouseY, this.deconstructionRadius
        );
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.02)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
            this.mouseX - this.deconstructionRadius,
            this.mouseY - this.deconstructionRadius,
            this.deconstructionRadius * 2,
            this.deconstructionRadius * 2
        );
    }
    
    animate() {
        this.updateThreads();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FabricDeconstruction();
});