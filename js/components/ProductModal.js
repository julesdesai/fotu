// Product Modal Component - Placeholder for future modal functionality

class ProductModal {
    constructor() {
        // This class can be extended in the future for more complex modal interactions
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Handle modal close events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
        
        // Handle click outside modal
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }
    }
    
    close() {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    open(productData) {
        // Future implementation for opening modals with specific product data
        console.log('Opening modal for:', productData);
    }
}

// Initialize modal when page loads
window.addEventListener('load', () => {
    if (document.getElementById('productModal')) {
        new ProductModal();
    }
});