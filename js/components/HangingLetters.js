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
        this.hangingContainer.style.position = 'absolute';
        this.hangingContainer.style.top = '0';
        this.hangingContainer.style.left = '0';
        this.hangingContainer.style.width = '100%';
        this.hangingContainer.style.height = '100%';
        this.hangingContainer.style.pointerEvents = 'none';
        this.hangingContainer.style.zIndex = '100';
        
        // Append to hero-image instead of body
        const heroImage = document.querySelector('.hero-image');
        heroImage.appendChild(this.hangingContainer);
        
        this.isHangingMode = false;
        this.letters = [];
        
        this.init();
    }
    
    init() {
        // Immediately activate hanging mode - make it permanent
        this.activateHangingMode();
        
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
        const heroImage = document.querySelector('.hero-image');
        
        // Calculate positions with extra spacing between O and T
        const imageWidth = heroImage.offsetWidth;
        const baseSpacing = imageWidth / 6; // Base spacing for 4 letters + extra space
        
        letters.forEach((letter, index) => {
            let xOffset;
            if (index === 0) { // F
                xOffset = baseSpacing;
            } else if (index === 1) { // O
                xOffset = baseSpacing * 2;
            } else if (index === 2) { // T - add extra space before T
                xOffset = baseSpacing * 4;
            } else if (index === 3) { // U
                xOffset = baseSpacing * 5;
            }
            
            this.createHangingLetter(letter, index, 0, baseSpacing, xOffset);
        });
    }
    
    createHangingLetter(letter, index, imageLeft, spacing, xOffset) {
        const letterContainer = document.createElement('div');
        letterContainer.className = 'hanging-letter-container';
        
        // Calculate position using custom spacing
        const letterX = xOffset;
        
        // Create thread element
        const thread = document.createElement('div');
        thread.className = 'hanging-thread';
        
        // Calculate thread height based on where the letter should hang
        const heroImage = document.querySelector('.hero-image');
        const heroOverlay = document.querySelector('.hero-overlay');
        
        // Thread extends from top to where letter should be (relative to hero image)
        const threadHeight = heroImage.offsetHeight * 0.4; // Move letters back up
        thread.style.height = threadHeight + 'px';
        
        // Create letter element with relative positioning
        const letterElement = document.createElement('div');
        letterElement.className = 'hanging-letter';
        letterElement.textContent = letter;
        letterElement.style.position = 'absolute';
        
        // No typewriter text inside letters anymore - remove this functionality
        
        // Position letter at the end of the thread, centered under the thread
        letterElement.style.left = letterX + 'px';
        letterElement.style.top = threadHeight + 'px';
        letterElement.style.transform = `translateX(-50%) rotate(${(Math.random() - 0.5) * 5}deg)`;
        
        // Add slight random variation to make it more natural
        const randomDelay = Math.random() * 0.5;
        letterElement.style.animationDelay = (index * 0.3 + randomDelay) + 's';
        
        // Position thread
        thread.style.left = letterX + 'px';
        thread.style.top = '0px';
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
            baseY: threadHeight
        });
    }
    
    updateHangingPositions() {
        if (!this.isHangingMode) return;
        
        // Recalculate positions on resize using same custom spacing
        const heroImage = document.querySelector('.hero-image');
        const imageWidth = heroImage.offsetWidth;
        const baseSpacing = imageWidth / 6;
        const threadHeight = heroImage.offsetHeight * 0.4;
        
        this.letters.forEach((letterObj, index) => {
            let xOffset;
            if (index === 0) { // F
                xOffset = baseSpacing;
            } else if (index === 1) { // O
                xOffset = baseSpacing * 2;
            } else if (index === 2) { // T - add extra space before T
                xOffset = baseSpacing * 4;
            } else if (index === 3) { // U
                xOffset = baseSpacing * 5;
            }
            
            letterObj.thread.style.left = xOffset + 'px';
            letterObj.thread.style.top = '0px';
            letterObj.thread.style.height = threadHeight + 'px';
            
            letterObj.letter.style.left = xOffset + 'px';
            letterObj.letter.style.top = threadHeight + 'px';
            
            // Update typewriter position too (no need to reposition since it's inside the letter)
            // this.positionTypewriterInLetter(letterObj.typewriter, letterObj.letter.textContent);
        });
    }

    positionTypewriterInLetter(container, letter) {
        // Position text inside each letter's contours (relative to the letter element)
        switch(letter.toUpperCase()) {
            case 'F':
                // F has vertical stroke and two horizontal bars
                container.style.top = '10px';
                container.style.left = '5px';
                container.style.width = '60px';
                container.style.height = '80px';
                container.style.textAlign = 'left';
                container.style.paddingLeft = '8px';
                container.style.paddingTop = '5px';
                break;
            case 'O':
                // O is circular - center the text
                container.style.top = '20px';
                container.style.left = '10px';
                container.style.width = '50px';
                container.style.height = '50px';
                container.style.textAlign = 'center';
                container.style.paddingTop = '15px';
                container.style.borderRadius = '50%';
                break;
            case 'T':
                // T has horizontal bar at top, vertical stroke below
                container.style.top = '35px';
                container.style.left = '15px';
                container.style.width = '40px';
                container.style.height = '60px';
                container.style.textAlign = 'center';
                container.style.paddingTop = '5px';
                break;
            case 'U':
                // U is curved at bottom - fill the curved area
                container.style.top = '25px';
                container.style.left = '5px';
                container.style.width = '70px';
                container.style.height = '60px';
                container.style.textAlign = 'center';
                container.style.paddingTop = '10px';
                break;
        }
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