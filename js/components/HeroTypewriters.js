// Hero Side Typewriters
class HeroTypewriters {
    constructor() {
        this.leftElement = document.querySelector('.hero-typewriter-left');
        this.rightElement = document.querySelector('.hero-typewriter-right');

        if (!this.leftElement || !this.rightElement) {
            console.log('Hero typewriter elements not found');
            return;
        }

        // Create content containers to avoid overwriting nav
        this.leftContent = document.createElement('div');
        this.leftContent.className = 'typewriter-content';
        this.leftElement.appendChild(this.leftContent);

        this.rightContent = document.createElement('div');
        this.rightContent.className = 'typewriter-content';
        this.rightElement.appendChild(this.rightContent);

        // Word pools for each side with weighted distribution
        this.leftWords = ['FABRIC', 'FABRIC', 'FABRIC', 'FABRIC', 'FABRIC', 'OF', 'THE'];
        this.rightWords = ['UNIVERSE', 'UNIVERSE', 'UNIVERSE', 'UNIVERSE', 'UNIVERSE', 'OF', 'THE'];

        this.leftIndex = 0;
        this.rightIndex = 0;
        this.leftLines = [];
        this.rightLines = [];
        this.maxLines = 40; // Reduced since nav takes some space

        this.init();
    }

    init() {
        // Initialize with empty lines
        this.leftLines = new Array(this.maxLines).fill('');
        this.rightLines = new Array(this.maxLines).fill('');

        // Start both typewriters with different speeds
        this.startTypewriter('left', 80);
        setTimeout(() => {
            this.startTypewriter('right', 90);
        }, 500); // Stagger start
    }
    
    startTypewriter(side, speed) {
        const isLeft = side === 'left';
        let currentLine = 0;
        let currentWordOnLine = 0;
        
        const typeNextWord = () => {
            const words = isLeft ? this.leftWords : this.rightWords;
            const lines = isLeft ? this.leftLines : this.rightLines;
            const element = isLeft ? this.leftElement : this.rightElement;
            
            // Get random word from weighted pool
            const randomWord = words[Math.floor(Math.random() * words.length)];
            
            // Add word to current line
            if (!lines[currentLine]) lines[currentLine] = '';
            
            // Add space before word if not first word on line
            if (currentWordOnLine > 0) {
                lines[currentLine] += ' ';
            }
            
            lines[currentLine] += randomWord;
            currentWordOnLine++;
            
            // Check if we should break to next line
            const shouldBreakLine = this.shouldBreakLine(lines[currentLine], currentWordOnLine);
            
            if (shouldBreakLine) {
                currentLine = (currentLine + 1) % this.maxLines;
                currentWordOnLine = 0;
                
                // Clear old lines randomly when all are filled
                if (lines.every(line => line && line.length > 0)) {
                    const randomLine = Math.floor(Math.random() * this.maxLines);
                    lines[randomLine] = '';
                    currentLine = randomLine;
                }
                
                // Add random indent to new line
                const indent = ' '.repeat(Math.floor(Math.random() * 4));
                lines[currentLine] = indent;
            }
            
            // Render
            this.renderSide(side);
            
            // Continue with next word
            setTimeout(typeNextWord, speed);
        };
        
        typeNextWord();
    }
    
    shouldBreakLine(currentLine, wordCount) {
        if (!currentLine) return false;
        
        const lineLength = currentLine.length;
        const minWords = 2;
        const maxWords = 8;
        const maxLineLength = 18;
        
        // Force break if line too long
        if (lineLength > maxLineLength) return true;
        
        // Don't break if too few words
        if (wordCount < minWords) return false;
        
        // Probability increases with word count and line length
        const wordFactor = (wordCount - minWords) / (maxWords - minWords);
        const lengthFactor = lineLength / maxLineLength;
        const probability = 0.15 + (wordFactor * 0.25) + (lengthFactor * 0.2);
        
        return Math.random() < probability;
    }
    
    renderSide(side) {
        const isLeft = side === 'left';
        const lines = isLeft ? this.leftLines : this.rightLines;
        const contentElement = isLeft ? this.leftContent : this.rightContent;

        // Process lines to add bold formatting
        const processedLines = lines.map(line => {
            return line
                .replace(/FABRIC/g, '<strong>FABRIC</strong>')
                .replace(/UNIVERSE/g, '<strong>UNIVERSE</strong>');
        });

        // Render to content container, preserving nav
        contentElement.innerHTML = processedLines.join('<br>');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HeroTypewriters();
});