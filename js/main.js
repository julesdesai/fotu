// Main JavaScript file for shared functionality across all pages

class FOTU {
    constructor() {
        this.initUtils();
    }

    initUtils() {
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Add loading states for buttons
        this.initButtonStates();

        // Initialize intersection observer for animations
        this.initScrollAnimations();
    }

    initButtonStates() {
        document.querySelectorAll('.btn').forEach(button => {
            button.addEventListener('click', function(e) {
                // Add visual feedback
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        });
    }

    initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        // Observe elements that should animate in
        document.querySelectorAll('.feature-card, .preview-item, .about-item').forEach(el => {
            observer.observe(el);
        });
    }

    // Utility functions
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    static easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    static easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}

// Enhanced Fullscreen API handling
function handleFullscreenChange() {
    const gameContainer = document.getElementById('gameContainer');
    const canvas = document.getElementById('gameCanvas');
    
    if (gameContainer && canvas) {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            // Entering fullscreen
            gameContainer.style.width = '100vw';
            gameContainer.style.height = '100vh';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';
        } else {
            // Exiting fullscreen
            gameContainer.style.width = '';
            gameContainer.style.height = '';
            canvas.style.width = '';
            canvas.style.height = '';
            canvas.style.objectFit = '';
        }
    }
}

// Add fullscreen event listeners
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
    }

    update() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;
            
            // Log performance warnings
            if (this.fps < 30) {
                console.warn('Low FPS detected:', this.fps);
            }
        }
    }

    getFPS() {
        return this.fps;
    }
}

// Initialize the main application
const app = new FOTU();

// Add CSS animation classes
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        animation: slideInUp 0.6s ease-out forwards;
    }

    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .btn:active {
        transform: scale(0.98) !important;
    }

    /* Loading spinner for buttons */
    .btn.loading::after {
        content: '';
        width: 16px;
        height: 16px;
        margin-left: 8px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        display: inline-block;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
`;
document.head.appendChild(style);

// Export for other modules
window.FOTU = FOTU;
window.PerformanceMonitor = PerformanceMonitor;