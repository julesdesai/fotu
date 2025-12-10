// Navbar Component - Integrated into left typewriter column
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

    getPaths() {
        const isSubPage = window.location.pathname.includes('/pages/');

        if (isSubPage) {
            return {
                home: '../index.html',
                digitalFabric: 'digital-fabric.html',
                game: 'game.html',
                about: 'about.html',
                shop: 'shop.html'
            };
        } else {
            return {
                home: 'index.html',
                digitalFabric: 'pages/digital-fabric.html',
                game: 'pages/game.html',
                about: 'pages/about.html',
                shop: 'pages/shop.html'
            };
        }
    }

    getNavHTML() {
        // Return empty - nav is now in the left typewriter column
        return '';
    }

    injectNavIntoTypewriter() {
        const paths = this.getPaths();
        const isHomePage = this.currentPage === 'home';

        // Check if we're on the home page with existing typewriter columns
        const leftTypewriter = document.querySelector('.hero-typewriter-left');

        if (leftTypewriter) {
            // Home page: inject nav into existing typewriter column
            const navContent = `
                <div class="typewriter-nav">
                    <div class="typewriter-brand">FABRIC OF</div>
                    <div class="typewriter-brand">THE UNIVERSE</div>
                    <div class="typewriter-divider"></div>
                    <nav class="typewriter-menu">
                        <a href="${paths.home}" class="typewriter-link ${this.currentPage === 'home' ? 'active' : ''}">HOME</a>
                        <a href="${paths.digitalFabric}" class="typewriter-link ${this.currentPage === 'digital-fabric' ? 'active' : ''}">DIGITAL FABRIC</a>
                        <a href="${paths.game}" class="typewriter-link ${this.currentPage === 'ouroboros-protocol' ? 'active' : ''}">OUROBOROS PROTOCOL</a>
                        <a href="${paths.about}" class="typewriter-link ${this.currentPage === 'about' ? 'active' : ''}">ABOUT</a>
                        <a href="${paths.shop}" class="typewriter-link ${this.currentPage === 'shop' ? 'active' : ''}">SHOP</a>
                    </nav>
                    <div class="typewriter-divider"></div>
                </div>
            `;
            leftTypewriter.insertAdjacentHTML('afterbegin', navContent);
        } else {
            // Other pages: create a fixed sidebar
            const sidebar = `
                <aside class="site-sidebar">
                    <div class="typewriter-nav">
                        <div class="typewriter-brand">FABRIC OF</div>
                        <div class="typewriter-brand">THE UNIVERSE</div>
                        <div class="typewriter-divider"></div>
                        <nav class="typewriter-menu">
                            <a href="${paths.home}" class="typewriter-link ${this.currentPage === 'home' ? 'active' : ''}">HOME</a>
                            <a href="${paths.digitalFabric}" class="typewriter-link ${this.currentPage === 'digital-fabric' ? 'active' : ''}">DIGITAL FABRIC</a>
                            <a href="${paths.game}" class="typewriter-link ${this.currentPage === 'ouroboros-protocol' ? 'active' : ''}">OUROBOROS PROTOCOL</a>
                            <a href="${paths.about}" class="typewriter-link ${this.currentPage === 'about' ? 'active' : ''}">ABOUT</a>
                            <a href="${paths.shop}" class="typewriter-link ${this.currentPage === 'shop' ? 'active' : ''}">SHOP</a>
                        </nav>
                    </div>
                </aside>
            `;
            document.body.insertAdjacentHTML('afterbegin', sidebar);
            document.body.classList.add('has-sidebar');
        }

        // Mobile nav toggle and overlay (all pages)
        const mobileNav = `
            <button class="mobile-nav-toggle">MENU</button>
            <div class="mobile-nav-overlay">
                <button class="mobile-nav-close">✕ CLOSE</button>
                <div class="typewriter-brand">FABRIC OF</div>
                <div class="typewriter-brand">THE UNIVERSE</div>
                <nav class="typewriter-menu">
                    <a href="${paths.home}" class="typewriter-link ${this.currentPage === 'home' ? 'active' : ''}">HOME</a>
                    <a href="${paths.digitalFabric}" class="typewriter-link ${this.currentPage === 'digital-fabric' ? 'active' : ''}">DIGITAL FABRIC</a>
                    <a href="${paths.game}" class="typewriter-link ${this.currentPage === 'ouroboros-protocol' ? 'active' : ''}">OUROBOROS PROTOCOL</a>
                    <a href="${paths.about}" class="typewriter-link ${this.currentPage === 'about' ? 'active' : ''}">ABOUT</a>
                    <a href="${paths.shop}" class="typewriter-link ${this.currentPage === 'shop' ? 'active' : ''}">SHOP</a>
                </nav>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', mobileNav);

        // Mobile menu toggle functionality
        this.initMobileMenu();
    }

    initMobileMenu() {
        const toggle = document.querySelector('.mobile-nav-toggle');
        const overlay = document.querySelector('.mobile-nav-overlay');
        const close = document.querySelector('.mobile-nav-close');

        if (toggle && overlay) {
            toggle.addEventListener('click', () => {
                overlay.classList.add('active');
            });

            if (close) {
                close.addEventListener('click', () => {
                    overlay.classList.remove('active');
                });
            }

            // Close on link click
            overlay.querySelectorAll('.typewriter-link').forEach(link => {
                link.addEventListener('click', () => {
                    overlay.classList.remove('active');
                });
            });
        }
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
        // Insert footer at the end of body
        document.body.insertAdjacentHTML('beforeend', this.getFooterHTML());

        // Inject nav into left typewriter column
        this.injectNavIntoTypewriter();
    }
}

// Initialize navbar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Navbar();
});