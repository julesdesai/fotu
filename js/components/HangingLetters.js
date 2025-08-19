// Hanging Letters Effect for FOTU Headline
class HangingLetters {
    constructor() {
        this.heroTitle = document.querySelector('.hero-overlay h1');
        
        if (!this.heroTitle) {
            console.log('Hero title not found');
            return;
        }
        
        this.originalText = this.heroTitle.textContent.trim();
        this.hangingContainer = document.createElement('div');
        this.hangingContainer.className = 'hanging-letters-container';
        document.body.appendChild(this.hangingContainer);
        
        this.isHangingMode = false;
        this.letters = [];
        
        this.init();
    }
    
    init() {
        // Auto-activate hanging mode after page loads
        setTimeout(() => {
            this.activateHangingMode();
        }, 2000);
        
        // Reposition on window resize
        window.addEventListener('resize', () => {
            if (this.isHangingMode) {
                this.updateHangingPositions();
            }
        });
    }
    
    activateHangingMode() {
        if (this.isHangingMode) return;
        
        this.isHangingMode = true;
        
        // Hide the original title and create hanging letters
        this.heroTitle.style.opacity = '0';
        this.heroTitle.classList.add('hanging-mode');
        
        // Small delay to let the original fade out
        setTimeout(() => {
            this.createHangingLetters();
        }, 300);
    }
    
    createHangingLetters() {
        // Clear any existing hanging letters
        this.clearHangingLetters();
        
        const letters = this.originalText.split('');
        const heroImageRect = document.querySelector('.hero-image').getBoundingClientRect();
        
        // Calculate positions - evenly spaced across the hero image width
        const imageWidth = heroImageRect.width;
        const imageLeft = heroImageRect.left;
        const spacing = imageWidth / (letters.length + 1);
        
        letters.forEach((letter, index) => {
            this.createHangingLetter(letter, index, imageLeft, spacing);
        });
    }
    
    createHangingLetter(letter, index, imageLeft, spacing) {
        const letterContainer = document.createElement('div');
        letterContainer.className = 'hanging-letter-container';
        
        // Calculate position - evenly spaced
        const letterX = imageLeft + spacing * (index + 1);
        
        // Create thread element
        const thread = document.createElement('div');
        thread.className = 'hanging-thread';
        
        // Calculate thread height based on where the letter should hang
        const heroImageRect = document.querySelector('.hero-image').getBoundingClientRect();
        const heroOverlay = document.querySelector('.hero-overlay');
        const overlayRect = heroOverlay.getBoundingClientRect();
        
        // Thread extends from top of image to where letter should be
        const threadHeight = overlayRect.top - heroImageRect.top + overlayRect.height * 0.3;
        thread.style.height = threadHeight + 'px';
        
        // Create letter element
        const letterElement = document.createElement('div');
        letterElement.className = 'hanging-letter';
        letterElement.textContent = letter;
        
        // Position letter at the end of the thread
        letterElement.style.left = letterX + 'px';
        letterElement.style.top = (heroImageRect.top + threadHeight) + 'px';
        
        // Add slight random variation to make it more natural
        const randomDelay = Math.random() * 0.5;
        const randomRotation = (Math.random() - 0.5) * 5;
        letterElement.style.animationDelay = (index * 0.3 + randomDelay) + 's';
        letterElement.style.transform = `rotate(${randomRotation}deg)`;
        
        // Position thread
        thread.style.left = letterX + 'px';
        thread.style.top = heroImageRect.top + 'px';
        thread.style.animationDelay = letterElement.style.animationDelay;
        
        // Set font size to match original
        const computedStyle = window.getComputedStyle(this.heroTitle);
        letterElement.style.fontSize = computedStyle.fontSize;
        letterElement.style.fontWeight = computedStyle.fontWeight;
        letterElement.style.fontFamily = computedStyle.fontFamily;
        
        // Add elements to container
        this.hangingContainer.appendChild(thread);
        this.hangingContainer.appendChild(letterElement);
        
        this.letters.push({
            container: letterContainer,
            thread: thread,
            letter: letterElement,
            baseX: letterX,
            baseY: heroImageRect.top + threadHeight
        });
    }
    
    updateHangingPositions() {
        if (!this.isHangingMode) return;
        
        // Recalculate positions on resize
        const heroImageRect = document.querySelector('.hero-image').getBoundingClientRect();
        const imageWidth = heroImageRect.width;
        const imageLeft = heroImageRect.left;
        const spacing = imageWidth / (this.letters.length + 1);
        
        this.letters.forEach((letterObj, index) => {
            const newX = imageLeft + spacing * (index + 1);
            
            letterObj.thread.style.left = newX + 'px';
            letterObj.thread.style.top = heroImageRect.top + 'px';
            
            letterObj.letter.style.left = newX + 'px';
            
            // Recalculate letter Y position
            const heroOverlay = document.querySelector('.hero-overlay');
            const overlayRect = heroOverlay.getBoundingClientRect();
            const threadHeight = overlayRect.top - heroImageRect.top + overlayRect.height * 0.3;
            
            letterObj.thread.style.height = threadHeight + 'px';
            letterObj.letter.style.top = (heroImageRect.top + threadHeight) + 'px';
        });
    }
    
    clearHangingLetters() {
        this.hangingContainer.innerHTML = '';
        this.letters = [];
    }
    
    deactivateHangingMode() {
        if (!this.isHangingMode) return;
        
        this.isHangingMode = false;
        this.heroTitle.classList.remove('hanging-mode');
        this.heroTitle.style.opacity = '1';
        this.clearHangingLetters();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HangingLetters();
});