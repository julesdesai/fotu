// Shop Gallery Component

class ShopGallery {
    constructor() {
        this.products = this.generateProducts();
        this.currentFilter = 'all';
        
        this.initGallery();
        this.initFilters();
        this.initFeaturedCanvas();
    }
    
    generateProducts() {
        return [
            {
                id: 'neural-network-001',
                title: 'Neural Network #001',
                price: 850,
                category: 'neural',
                description: 'A deep learning algorithm visualizes its own training process, creating patterns that evolve with each epoch.',
                tags: ['AI', 'Machine Learning', 'Dynamic'],
                details: {
                    dimensions: '120cm × 160cm',
                    material: 'Smart textile with LED integration',
                    edition: 'Limited to 25 pieces'
                }
            },
            {
                id: 'mandelbrot-dreams',
                title: 'Mandelbrot Dreams',
                price: 1200,
                category: 'fractal',
                description: 'Infinite zoom into the Mandelbrot set, where each thread represents a different iteration depth.',
                tags: ['Fractal', 'Mathematical', 'Infinite'],
                details: {
                    dimensions: '150cm × 200cm',
                    material: 'High-resolution digital weave',
                    edition: 'Unique piece'
                }
            },
            {
                id: 'cellular-growth',
                title: 'Cellular Growth',
                price: 650,
                category: 'cellular',
                description: 'Conway\'s Game of Life evolved into a textile pattern that simulates organic growth.',
                tags: ['Cellular Automata', 'Organic', 'Evolution'],
                details: {
                    dimensions: '100cm × 140cm',
                    material: 'Organic cotton with reactive dyes',
                    edition: 'Limited to 50 pieces'
                }
            },
            {
                id: 'quantum-entanglement',
                title: 'Quantum Entanglement',
                price: 2200,
                category: 'quantum',
                description: 'Paired particles dance across fabric, their states mysteriously connected regardless of distance.',
                tags: ['Quantum', 'Physics', 'Interactive'],
                details: {
                    dimensions: '180cm × 250cm',
                    material: 'Quantum dot embedded fibers',
                    edition: 'Limited to 5 pairs'
                }
            },
            {
                id: 'synaptic-fire',
                title: 'Synaptic Fire',
                price: 950,
                category: 'neural',
                description: 'Neural pathways light up in response to touch, mimicking brain activity patterns.',
                tags: ['Neuroscience', 'Interactive', 'Touch-sensitive'],
                details: {
                    dimensions: '130cm × 170cm',
                    material: 'Conductive thread weave',
                    edition: 'Limited to 15 pieces'
                }
            },
            {
                id: 'julia-set-variations',
                title: 'Julia Set Variations',
                price: 750,
                category: 'fractal',
                description: 'Multiple Julia sets blend and morph, creating an ever-changing mathematical landscape.',
                tags: ['Fractal', 'Parametric', 'Color-shifting'],
                details: {
                    dimensions: '110cm × 150cm',
                    material: 'Thermochromic fibers',
                    edition: 'Limited to 30 pieces'
                }
            },
            {
                id: 'forest-fire-sim',
                title: 'Forest Fire Simulation',
                price: 580,
                category: 'cellular',
                description: 'A cellular automaton simulates forest fire spread patterns in mesmerizing detail.',
                tags: ['Simulation', 'Nature', 'Dynamic'],
                details: {
                    dimensions: '90cm × 120cm',
                    material: 'Natural hemp with color-changing dyes',
                    edition: 'Limited to 40 pieces'
                }
            },
            {
                id: 'schrodinger-textile',
                title: 'Schrödinger\'s Textile',
                price: 1800,
                category: 'quantum',
                description: 'A fabric that exists in superposition, displaying multiple patterns until observed.',
                tags: ['Quantum Mechanics', 'Superposition', 'Observer Effect'],
                details: {
                    dimensions: '160cm × 200cm',
                    material: 'Photonic crystal fibers',
                    edition: 'Limited to 8 pieces'
                }
            },
            {
                id: 'perceptron-layers',
                title: 'Perceptron Layers',
                price: 680,
                category: 'neural',
                description: 'Visualizing the hidden layers of a neural network as they process information.',
                tags: ['Deep Learning', 'Layered', 'Information Flow'],
                details: {
                    dimensions: '105cm × 135cm',
                    material: 'Transparent conductive mesh',
                    edition: 'Limited to 35 pieces'
                }
            }
        ];
    }
    
    initGallery() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        grid.innerHTML = this.products.map(product => this.createProductCard(product)).join('');
        
        // Add click handlers
        grid.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openProductModal(card.dataset.productId);
            });
        });
    }
    
    createProductCard(product) {
        return `
            <div class="product-card" data-product-id="${product.id}" data-category="${product.category}">
                <div class="product-image">
                    <div class="product-preview ${product.category}"></div>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <p class="product-price">$${product.price.toLocaleString()}</p>
                    <p class="product-description">${product.description}</p>
                    <div class="product-tags">
                        ${product.tags.map(tag => `<span class="product-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    initFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Filter products
                const filter = button.dataset.filter;
                this.filterProducts(filter);
            });
        });
    }
    
    filterProducts(category) {
        this.currentFilter = category;
        const cards = document.querySelectorAll('.product-card');
        
        cards.forEach(card => {
            const cardCategory = card.dataset.category;
            
            if (category === 'all' || cardCategory === category) {
                card.classList.remove('filtered-out');
            } else {
                card.classList.add('filtered-out');
            }
        });
    }
    
    openProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // Set modal data
        const modal = document.getElementById('productModal');
        modal.dataset.productId = productId;
        
        document.getElementById('modalTitle').textContent = product.title;
        document.getElementById('modalPrice').textContent = `$${product.price.toLocaleString()}`;
        document.getElementById('modalDescription').textContent = product.description;
        
        // Set modal details
        const detailsContainer = document.getElementById('modalDetails');
        detailsContainer.innerHTML = Object.entries(product.details)
            .map(([key, value]) => `
                <div class="detail-item">
                    <span class="detail-label">${key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                    <span>${value}</span>
                </div>
            `).join('');
        
        // Initialize modal canvas
        this.initModalCanvas(product);
        
        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    initFeaturedCanvas() {
        const canvas = document.getElementById('featuredCanvas');
        if (!canvas) return;
        
        this.featuredAnimation = new FeaturedCanvasAnimation(canvas);
        window.featuredAnimation = this.featuredAnimation;
    }
    
    initModalCanvas(product) {
        const canvas = document.getElementById('modalCanvas');
        if (!canvas) return;
        
        // Create a simple pattern based on product category
        this.modalAnimation = new ProductCanvasAnimation(canvas, product);
    }
}

// Featured Canvas Animation
class FeaturedCanvasAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width = canvas.offsetWidth;
        this.height = canvas.height = canvas.offsetHeight;
        
        this.time = 0;
        this.paused = false;
        this.nodes = [];
        
        this.initNodes();
        this.animate();
    }
    
    initNodes() {
        const nodeCount = 15;
        
        for (let i = 0; i < nodeCount; i++) {
            this.nodes.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 8 + 4,
                connections: [],
                activation: Math.random()
            });
        }
    }
    
    update() {
        if (this.paused) return;
        
        this.time += 0.016;
        
        this.nodes.forEach((node, i) => {
            // Update position
            node.x += node.vx;
            node.y += node.vy;
            
            // Bounce off edges
            if (node.x < 0 || node.x > this.width) node.vx *= -1;
            if (node.y < 0 || node.y > this.height) node.vy *= -1;
            
            // Keep in bounds
            node.x = Math.max(0, Math.min(this.width, node.x));
            node.y = Math.max(0, Math.min(this.height, node.y));
            
            // Update activation
            node.activation = 0.5 + Math.sin(this.time + i) * 0.5;
        });
    }
    
    render() {
        // Clear with gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#001100');
        gradient.addColorStop(1, '#000000');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw connections
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const dx = this.nodes[i].x - this.nodes[j].x;
                const dy = this.nodes[i].y - this.nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
                    this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        // Draw nodes
        this.nodes.forEach(node => {
            const alpha = node.activation;
            this.ctx.fillStyle = `rgba(255, 102, 0, ${alpha})`;
            this.ctx.shadowColor = '#ff6600';
            this.ctx.shadowBlur = node.size;
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.size * alpha, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.shadowBlur = 0;
        });
    }
    
    animate() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Product Canvas Animation
class ProductCanvasAnimation {
    constructor(canvas, product) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width = canvas.offsetWidth;
        this.height = canvas.height = canvas.offsetHeight;
        this.product = product;
        
        this.time = 0;
        this.animate();
    }
    
    render() {
        this.time += 0.016;
        
        // Clear canvas
        this.ctx.fillStyle = '#001100';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw pattern based on category
        switch (this.product.category) {
            case 'neural':
                this.drawNeuralPattern();
                break;
            case 'fractal':
                this.drawFractalPattern();
                break;
            case 'cellular':
                this.drawCellularPattern();
                break;
            case 'quantum':
                this.drawQuantumPattern();
                break;
        }
    }
    
    drawNeuralPattern() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.time;
            const x = centerX + Math.cos(angle) * 50;
            const y = centerY + Math.sin(angle) * 50;
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Connection to center
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }
    }
    
    drawFractalPattern() {
        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 1;
        
        const iterations = 5;
        this.drawMandelbrotApproximation(iterations);
    }
    
    drawMandelbrotApproximation(iterations) {
        const scale = 100;
        const offsetX = this.width / 2;
        const offsetY = this.height / 2;
        
        for (let i = 0; i < iterations; i++) {
            const t = (i / iterations) * Math.PI * 2 + this.time * 0.5;
            const x = offsetX + Math.cos(t) * scale * (1 - i / iterations);
            const y = offsetY + Math.sin(t * 2) * scale * (1 - i / iterations);
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2 + i, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    
    drawCellularPattern() {
        const cellSize = 20;
        const cols = Math.floor(this.width / cellSize);
        const rows = Math.floor(this.height / cellSize);
        
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const alive = Math.sin(this.time + x * 0.5 + y * 0.3) > 0;
                
                if (alive) {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
                }
            }
        }
    }
    
    drawQuantumPattern() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Quantum superposition visualization
        const states = 3;
        for (let i = 0; i < states; i++) {
            const angle = (i / states) * Math.PI * 2 + this.time;
            const probability = Math.abs(Math.sin(this.time + i));
            
            this.ctx.fillStyle = `rgba(255, 0, 255, ${probability})`;
            this.ctx.beginPath();
            this.ctx.arc(
                centerX + Math.cos(angle) * 30,
                centerY + Math.sin(angle) * 30,
                10 * probability,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }
    }
    
    animate() {
        this.render();
        requestAnimationFrame(() => this.animate());
    }
}

// Close modal function
function closeModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Initialize shop gallery when page loads
window.addEventListener('load', () => {
    if (document.getElementById('productsGrid')) {
        new ShopGallery();
    }
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('productModal');
    if (e.target === modal) {
        closeModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});