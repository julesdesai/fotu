// Navbar Component
class Navbar {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().split('.')[0];
        
        // Handle different page names
        if (page === 'index' || page === '' || path.endsWith('/')) {
            return 'home';
        } else if (page === 'digital-fabric') {
            return 'digital-fabric';
        } else if (page === 'game') {
            return 'ouroboros-protocol';
        } else if (page === 'about') {
            return 'about';
        } else if (page === 'shop') {
            return 'shop';
        }
        return page;
    }

    getNavHTML() {
        const isSubPage = window.location.pathname.includes('/pages/');
        
        // Define all paths based on current location
        let homePath, digitalFabricPath, gamePath, aboutPath, shopPath;
        
        if (isSubPage) {
            // We're in a subpage, so go up one level for home, stay in same directory for others
            homePath = '../index.html';
            digitalFabricPath = 'digital-fabric.html';
            gamePath = 'game.html';
            aboutPath = 'about.html';
            shopPath = 'shop.html';
        } else {
            // We're on homepage, so all subpages are in pages/ directory
            homePath = 'index.html';
            digitalFabricPath = 'pages/digital-fabric.html';
            gamePath = 'pages/game.html';
            aboutPath = 'pages/about.html';
            shopPath = 'pages/shop.html';
        }

        return `
            <nav class="navbar">
                <div class="nav-container">
                    <a href="${homePath}" class="nav-brand">FOTU</a>
                    <ul class="nav-menu">
                        <li><a href="${homePath}" class="nav-link ${this.currentPage === 'home' ? 'active' : ''}">Home</a></li>
                        <li><a href="${digitalFabricPath}" class="nav-link ${this.currentPage === 'digital-fabric' ? 'active' : ''}">Digital Fabric</a></li>
                        <li><a href="${gamePath}" class="nav-link ${this.currentPage === 'ouroboros-protocol' ? 'active' : ''}">Ouroboros Protocol</a></li>
                        <li><a href="${aboutPath}" class="nav-link ${this.currentPage === 'about' ? 'active' : ''}">About</a></li>
                        <li><a href="${shopPath}" class="nav-link ${this.currentPage === 'shop' ? 'active' : ''}">Shop</a></li>
                    </ul>
                    <div class="hamburger">
                        <span class="bar"></span>
                        <span class="bar"></span>
                        <span class="bar"></span>
                    </div>
                </div>
            </nav>
        `;
    }

    getFooterHTML() {
        const isSubPage = window.location.pathname.includes('/pages/');
        
        // Use same path logic as navbar
        let homePath, digitalFabricPath, gamePath, aboutPath, shopPath;
        
        if (isSubPage) {
            homePath = '../index.html';
            digitalFabricPath = 'digital-fabric.html';
            gamePath = 'game.html';
            aboutPath = 'about.html';
            shopPath = 'shop.html';
        } else {
            homePath = 'index.html';
            digitalFabricPath = 'pages/digital-fabric.html';
            gamePath = 'pages/game.html';
            aboutPath = 'pages/about.html';
            shopPath = 'pages/shop.html';
        }

        return `
            <footer class="footer">
                <div class="container">
                    <div class="footer-content">
                        <div class="footer-section">
                            <h3>FOTU</h3>
                            <p>Pioneering the intersection of code and textile design.</p>
                        </div>
                        <div class="footer-section">
                            <h4>Navigation</h4>
                            <ul>
                                <li><a href="${homePath}">Home</a></li>
                                <li><a href="${digitalFabricPath}">Digital Fabric</a></li>
                                <li><a href="${gamePath}">Ouroboros Protocol</a></li>
                                <li><a href="${aboutPath}">About</a></li>
                                <li><a href="${shopPath}">Shop</a></li>
                            </ul>
                        </div>
                        <div class="footer-section">
                            <h4>Connect</h4>
                            <ul>
                                <li><a href="#" onclick="alert('Coming soon!')">Newsletter</a></li>
                                <li><a href="#" onclick="alert('Coming soon!')">Instagram</a></li>
                                <li><a href="#" onclick="alert('Coming soon!')">Twitter</a></li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer-bottom">
                        <p>&copy; 2025 FOTU. All rights reserved.</p>
                        <p>Website by @sea_elegans in collaboration with FOTU</p>
                    </div>
                </div>
            </footer>
        `;
    }

    init() {
        // Insert navbar at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', this.getNavHTML());
        
        // Insert footer at the end of body
        document.body.insertAdjacentHTML('beforeend', this.getFooterHTML());

        // Initialize mobile menu functionality
        this.initMobileMenu();
    }

    initMobileMenu() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');

        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });

            // Close mobile menu when clicking on nav links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                });
            });
        }
    }
}

// Initialize navbar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Navbar();
});