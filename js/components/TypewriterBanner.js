// Stochastic Typewriter Banner Effect
class TypewriterBanner {
    constructor() {
        this.bannerText = document.querySelector('.banner-text');
        this.container = document.querySelector('.banner-container');
        
        if (!this.bannerText || !this.container) {
            console.error('Typewriter banner elements not found');
            return;
        }
        
        // Text content to type
        this.textContent = `THEFABRICOFTHEUNIVERSEISSTITCHEDTOGETHERWITHTHTHREADSOFOUROWNMAKING.FOTUISAWEARABLEFINEAR TPROJECTINMOTION,TRACINGTHESAMEPATTERNSNATURE,BODIES,ANDBASELINES.FLUID,INSTINCTIVE,ANDIMPOSSIBLE TOPINDOWN.EACHPIECEISAFRAGMENTOFTHEBIGGERPATTERN:DESIGNEDTOMOVEANDBUILTOFEEL.`;
        
        this.currentIndex = 0;
        this.currentLine = '';
        this.lines = [];
        this.maxLines = 8;
        this.currentLineIndex = 0;
        this.currentCharInLine = 0;
        this.cursor = null;
        
        this.init();
    }
    
    init() {
        console.log('Stochastic TypewriterBanner started');
        
        // Initialize lines array
        this.lines = new Array(this.maxLines).fill('');
        this.bannerText.innerHTML = '';
        
        // Create sewing machine cursor
        this.createCursor();
        
        // Start typing immediately
        this.startStochasticTypewriter();
    }
    
    createCursor() {
        this.cursor = document.createElement('div');
        this.cursor.className = 'sewing-cursor';
        this.container.appendChild(this.cursor);
    }
    
    updateCursorPosition() {
        if (!this.cursor) return;
        
        // Create a temporary span to measure text position
        const temp = document.createElement('span');
        temp.style.font = window.getComputedStyle(this.bannerText).font;
        temp.style.visibility = 'hidden';
        temp.style.position = 'absolute';
        temp.style.whiteSpace = 'pre';
        
        // Get current line and position
        const currentLineText = this.lines[this.currentLineIndex] || '';
        temp.textContent = currentLineText;
        document.body.appendChild(temp);
        
        const textWidth = temp.offsetWidth;
        const lineHeight = 20; // Approximate line height
        
        document.body.removeChild(temp);
        
        // Position cursor
        const containerRect = this.container.getBoundingClientRect();
        const bannerRect = this.bannerText.getBoundingClientRect();
        
        this.cursor.style.left = (bannerRect.left - containerRect.left + textWidth) + 'px';
        this.cursor.style.top = (bannerRect.top - containerRect.top + (this.currentLineIndex * lineHeight)) + 'px';
    }
    
    startStochasticTypewriter() {
        const typeSpeed = 60; // milliseconds between characters
        
        const typeNext = () => {
            // Get next character
            const char = this.textContent[this.currentIndex % this.textContent.length];
            
            // Add character to current line
            this.lines[this.currentLineIndex] += char;
            this.currentCharInLine++;
            
            // Stochastic line break decision
            const shouldBreak = this.shouldBreakLine();
            
            if (shouldBreak) {
                // Move to next line
                this.currentLineIndex = (this.currentLineIndex + 1) % this.maxLines;
                this.currentCharInLine = 0;
                
                // If we've filled all lines, start overwriting from a random position
                if (this.lines.every(line => line.length > 0)) {
                    // Randomly clear a line to create staggered effect
                    const randomLine = Math.floor(Math.random() * this.maxLines);
                    this.lines[randomLine] = '';
                    this.currentLineIndex = randomLine;
                }
                
                // Add normally distributed indent centered around middle
                const indentSpaces = this.generateNormalIndent();
                const indent = ' '.repeat(indentSpaces);
                this.lines[this.currentLineIndex] = indent;
                this.currentCharInLine = indent.length;
            }
            
            // Render all lines with HTML formatting
            this.renderLines();
            
            // Update cursor position
            this.updateCursorPosition();
            
            // Move to next character
            this.currentIndex++;
            
            // Continue typing
            setTimeout(typeNext, typeSpeed);
        };
        
        typeNext();
    }
    
    shouldBreakLine() {
        // Stochastic line breaking with multiple factors
        const minLength = 40;
        const maxLength = 120;
        const currentLength = this.currentCharInLine;
        
        if (currentLength < minLength) return false;
        if (currentLength > maxLength) return true;
        
        // Probability increases with line length
        const lengthFactor = (currentLength - minLength) / (maxLength - minLength);
        const baseProbability = 0.02; // 2% base chance per character
        const probability = baseProbability + (lengthFactor * 0.08); // Up to 10% chance
        
        return Math.random() < probability;
    }
    
    generateNormalIndent() {
        // Box-Muller transformation to generate normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        
        // Center around 25 characters (rough middle of screen) with standard deviation of 12
        const center = 25;
        const stdDev = 12;
        const normalValue = z0 * stdDev + center;
        
        // Clamp to reasonable bounds (0 to 50 spaces)
        return Math.max(0, Math.min(50, Math.round(normalValue)));
    }

    renderLines() {
        // Process lines to add bold formatting for specific words
        const processedLines = this.lines.map(line => {
            return line
                .replace(/FABRIC/g, '<strong>FABRIC</strong>')
                .replace(/UNIVERSE/g, '<strong>UNIVERSE</strong>');
        });
        
        this.bannerText.innerHTML = processedLines.join('<br>');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing TypewriterBanner');
    try {
        new TypewriterBanner();
    } catch (error) {
        console.error('Error initializing TypewriterBanner:', error);
        // Fallback: just show some text
        const bannerText = document.querySelector('.banner-text');
        if (bannerText) {
            bannerText.textContent = 'THE FABRIC OF THE UNIVERSE IS STITCHED TOGETHER WITH THE THREADS OF OUR OWN MAKING';
        }
    }
});