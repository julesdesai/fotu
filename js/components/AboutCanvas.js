// About page canvas visualization

class AboutCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = this.canvas.offsetWidth;
        this.height = this.canvas.height = this.canvas.offsetHeight;
        
        this.time = 0;
        this.particles = [];
        this.connections = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.isHovered = false;
        
        this.initParticles();
        this.initEventListeners();
        this.animate();
    }
    
    initParticles() {
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3 + 1,
                color: Math.random() > 0.5 ? '#00ff00' : '#ff6600',
                alpha: Math.random() * 0.8 + 0.2,
                phase: Math.random() * Math.PI * 2
            });
        }
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
            this.width = this.canvas.width = this.canvas.offsetWidth;
            this.height = this.canvas.height = this.canvas.offsetHeight;
        });
    }
    
    updateParticles() {
        this.time += 0.016; // ~60fps
        
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Wrap around edges
            if (particle.x < 0) particle.x = this.width;
            if (particle.x > this.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.height;
            if (particle.y > this.height) particle.y = 0;
            
            // Mouse attraction
            if (this.isHovered) {
                const dx = this.mouseX - particle.x;
                const dy = this.mouseY - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    const force = (100 - distance) / 100 * 0.01;
                    particle.vx += dx / distance * force;
                    particle.vy += dy / distance * force;
                }
            }
            
            // Add some organic movement
            particle.vx += Math.sin(this.time + particle.phase) * 0.001;
            particle.vy += Math.cos(this.time + particle.phase) * 0.001;
            
            // Damping
            particle.vx *= 0.99;
            particle.vy *= 0.99;
            
            // Update alpha for breathing effect
            particle.alpha = 0.5 + Math.sin(this.time * 2 + particle.phase) * 0.3;
        });
        
        // Update connections
        this.connections = [];
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 80) {
                    this.connections.push({
                        from: this.particles[i],
                        to: this.particles[j],
                        distance: distance,
                        strength: (80 - distance) / 80
                    });
                }
            }
        }
    }
    
    render() {
        // Clear with gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#001100');
        gradient.addColorStop(1, '#000000');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw connections
        this.connections.forEach(connection => {
            const alpha = connection.strength * 0.3;
            this.ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
            this.ctx.lineWidth = connection.strength;
            this.ctx.beginPath();
            this.ctx.moveTo(connection.from.x, connection.from.y);
            this.ctx.lineTo(connection.to.x, connection.to.y);
            this.ctx.stroke();
        });
        
        // Draw particles
        this.particles.forEach(particle => {
            // Glow effect
            this.ctx.shadowColor = particle.color;
            this.ctx.shadowBlur = particle.size * 3;
            
            // Draw particle
            this.ctx.fillStyle = particle.color + Math.floor(particle.alpha * 255).toString(16).padStart(2, '0');
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Reset shadow
            this.ctx.shadowBlur = 0;
        });
        
        // Draw neural network pattern overlay
        this.drawNeuralOverlay();
        
        // Add scanlines
        this.addScanlines();
    }
    
    drawNeuralOverlay() {
        // Create a subtle neural network pattern
        this.ctx.strokeStyle = 'rgba(255, 102, 0, 0.1)';
        this.ctx.lineWidth = 0.5;
        
        const gridSize = 40;
        const offset = Math.sin(this.time * 0.5) * 10;
        
        for (let x = 0; x < this.width + gridSize; x += gridSize) {
            for (let y = 0; y < this.height + gridSize; y += gridSize) {
                const nodeX = x + Math.sin(this.time * 0.3 + x * 0.01) * offset;
                const nodeY = y + Math.cos(this.time * 0.3 + y * 0.01) * offset;
                
                // Draw connections to nearby nodes
                if (x < this.width - gridSize) {
                    const nextX = (x + gridSize) + Math.sin(this.time * 0.3 + (x + gridSize) * 0.01) * offset;
                    const nextY = y + Math.cos(this.time * 0.3 + y * 0.01) * offset;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(nodeX, nodeY);
                    this.ctx.lineTo(nextX, nextY);
                    this.ctx.stroke();
                }
                
                if (y < this.height - gridSize) {
                    const nextX = x + Math.sin(this.time * 0.3 + x * 0.01) * offset;
                    const nextY = (y + gridSize) + Math.cos(this.time * 0.3 + (y + gridSize) * 0.01) * offset;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(nodeX, nodeY);
                    this.ctx.lineTo(nextX, nextY);
                    this.ctx.stroke();
                }
            }
        }
    }
    
    addScanlines() {
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.02)';
        this.ctx.lineWidth = 0.5;
        
        for (let y = 0; y < this.height; y += 3) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }
    
    animate() {
        this.updateParticles();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize about canvas when page loads
window.addEventListener('load', () => {
    const aboutCanvas = document.getElementById('aboutCanvas');
    if (aboutCanvas) {
        new AboutCanvas('aboutCanvas');
    }
});