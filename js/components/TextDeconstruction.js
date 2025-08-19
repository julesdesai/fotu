// Text Deconstruction Effect for Hero Text
class TextDeconstruction {
    constructor() {
        this.heroOverlay = document.querySelector('.hero-overlay');
        this.heroTitle = document.querySelector('.hero-overlay h1');
        this.heroSubtitle = document.querySelector('.hero-overlay p');
        
        if (!this.heroOverlay || !this.heroTitle || !this.heroSubtitle) {
            console.log('Text deconstruction elements not found');
            return;
        }
        
        this.letterContainer = document.createElement('div');
        this.letterContainer.className = 'letter-container';
        document.body.appendChild(this.letterContainer);
        
        this.floatingLetters = [];
        this.originalTexts = {
            title: this.heroTitle.textContent,
            subtitle: this.heroSubtitle.textContent
        };
        
        this.init();
    }
    
    init() {
        this.addEventListeners();
    }
    
    addEventListeners() {
        // Title hover events - only if not in hanging mode
        this.heroTitle.addEventListener('mouseenter', () => {
            if (!this.heroTitle.classList.contains('hanging-mode')) {
                this.deconstructText(this.heroTitle, 'title');
            }
        });
        
        this.heroTitle.addEventListener('mouseleave', () => {
            if (!this.heroTitle.classList.contains('hanging-mode')) {
                this.reconstructText(this.heroTitle, 'title');
            }
        });
        
        // Subtitle hover events
        this.heroSubtitle.addEventListener('mouseenter', () => {
            this.deconstructText(this.heroSubtitle, 'subtitle');
        });
        
        this.heroSubtitle.addEventListener('mouseleave', () => {
            this.reconstructText(this.heroSubtitle, 'subtitle');
        });
    }
    
    deconstructText(element, type) {
        if (element.classList.contains('deconstructing') || element.classList.contains('hanging-mode')) return;
        
        const text = this.originalTexts[type];
        const rect = element.getBoundingClientRect();
        
        // Mark element as deconstructing and hide immediately
        element.classList.add('deconstructing');
        element.style.opacity = '0';
        
        // Calculate letter positioning
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFloat(computedStyle.fontSize);
        const fontWeight = computedStyle.fontWeight;
        const fontFamily = computedStyle.fontFamily;
        const letterSpacing = parseFloat(computedStyle.letterSpacing) || 0;
        
        // Create temporary canvas to measure text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        
        let currentX = rect.left;
        const baseY = rect.top + rect.height / 2;
        
        // Create floating letters
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === ' ') {
                currentX += fontSize * 0.3; // Space width
                continue;
            }
            
            const charWidth = ctx.measureText(char).width;
            
            const letter = document.createElement('div');
            letter.className = 'floating-letter';
            letter.textContent = char;
            letter.style.fontSize = fontSize + 'px';
            letter.style.fontWeight = fontWeight;
            letter.style.fontFamily = fontFamily;
            letter.style.left = currentX + 'px';
            letter.style.top = baseY + 'px';
            letter.style.transform = 'translate(-50%, -50%)';
            
            // Store original position
            letter.dataset.originalX = currentX;
            letter.dataset.originalY = baseY;
            letter.dataset.type = type;
            letter.dataset.index = i;
            
            this.letterContainer.appendChild(letter);
            this.floatingLetters.push(letter);
            
            // Animate to random position
            this.animateLetterOut(letter, i);
            
            currentX += charWidth + letterSpacing;
        }
    }
    
    animateLetterOut(letter, index) {
        // Calculate random target position
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        const targetX = Math.random() * windowWidth;
        const targetY = Math.random() * windowHeight;
        
        // Add some physics-like motion
        const duration = 800 + Math.random() * 400; // 0.8-1.2s
        const delay = index * 50; // Stagger animation
        
        setTimeout(() => {
            letter.style.transition = `all ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            letter.style.left = targetX + 'px';
            letter.style.top = targetY + 'px';
            letter.style.transform = `translate(-50%, -50%) rotate(${(Math.random() - 0.5) * 360}deg) scale(${0.8 + Math.random() * 0.4})`;
            letter.style.opacity = '0.7';
        }, delay);
    }
    
    reconstructText(element, type) {
        if (!element.classList.contains('deconstructing') || element.classList.contains('hanging-mode')) return;
        
        // Filter letters for this specific text element
        const relevantLetters = this.floatingLetters.filter(letter => letter.dataset.type === type);
        
        // Animate letters back to original positions
        relevantLetters.forEach((letter, index) => {
            const originalX = parseFloat(letter.dataset.originalX);
            const originalY = parseFloat(letter.dataset.originalY);
            const delay = index * 30; // Faster return
            
            setTimeout(() => {
                letter.style.transition = 'all 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Bounce-back easing
                letter.style.left = originalX + 'px';
                letter.style.top = originalY + 'px';
                letter.style.transform = 'translate(-50%, -50%) rotate(0deg) scale(1)';
                letter.style.opacity = '1';
            }, delay);
        });
        
        // Remove letters and show original text after animation
        setTimeout(() => {
            relevantLetters.forEach(letter => {
                if (letter.parentNode) {
                    letter.parentNode.removeChild(letter);
                }
            });
            
            // Remove letters from tracking array
            this.floatingLetters = this.floatingLetters.filter(letter => letter.dataset.type !== type);
            
            // Show original text
            element.classList.remove('deconstructing');
            element.style.opacity = '1';
        }, relevantLetters.length * 30 + 600);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TextDeconstruction();
});