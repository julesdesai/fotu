// Navbar Component - Integrated into left typewriter column
class Navbar {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.init();
  }

  getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split("/").pop().split(".")[0];

    // Handle different page names
    if (page === "index" || page === "" || path.endsWith("/")) {
      return "home";
    } else if (page === "digital-fabric") {
      return "digital-fabric";
    } else if (page === "game") {
      return "ouroboros-protocol";
    } else if (page === "roots") {
      return "roots";
    } else if (page === "shop") {
      return "shop";
    }
    return page;
  }

  getPaths() {
    const isSubPage = window.location.pathname.includes("/pages/");

    if (isSubPage) {
      return {
        home: "/",
        digitalFabric: "digital-fabric.html",
        game: "game.html",
        roots: "roots.html",
        shop: "shop.html",
      };
    } else {
      return {
        home: "/",
        digitalFabric: "pages/digital-fabric.html",
        game: "pages/game.html",
        roots: "pages/roots.html",
        shop: "pages/shop.html",
      };
    }
  }

  getNavHTML() {
    // Return empty - nav is now in the left typewriter column
    return "";
  }

  injectNavIntoTypewriter() {
    const paths = this.getPaths();
    const isHomePage = this.currentPage === "home";

    // Check if we're on the home page with existing typewriter columns
    const leftTypewriter = document.querySelector(".hero-typewriter-left");

    if (leftTypewriter) {
      // Home page: inject nav into existing typewriter column
      const navContent = `
                <div class="typewriter-nav">
                    <div class="typewriter-brand">FABRIC OF</div>
                    <div class="typewriter-brand">THE UNIVERSE</div>
                    <div class="typewriter-divider"></div>
                    <nav class="typewriter-menu">
                        <a href="${paths.home}" class="typewriter-link ${this.currentPage === "home" ? "active" : ""}">HOME</a>
                        <a href="${paths.shop}" class="typewriter-link ${this.currentPage === "shop" ? "active" : ""}">SHOP</a>
                        <a href="#" class="typewriter-link" data-basket-link aria-haspopup="dialog">BASKET</a>
                        <a href="${paths.roots}" class="typewriter-link ${this.currentPage === "roots" ? "active" : ""}">ROOTS</a>
                        <a href="${paths.game}" class="typewriter-link ${this.currentPage === "ouroboros-protocol" ? "active" : ""}">OUROBOROS PROTOCOL</a>
                    </nav>
                    <div class="typewriter-divider"></div>
                </div>
            `;
      leftTypewriter.insertAdjacentHTML("afterbegin", navContent);

      // Instagram handle under the credit block, bottom-right of the hero
      const heroCredit = document.querySelector(".hero-credit");
      if (heroCredit) {
        heroCredit.insertAdjacentHTML("afterbegin", this.getInstagramHTML());
      }
    } else {
      // Other pages: create a fixed sidebar that mirrors the home-page typewriter column structure
      const sidebar = `
                <aside class="site-sidebar">
                    <div class="typewriter-nav">
                        <div class="typewriter-brand">FABRIC OF</div>
                        <div class="typewriter-brand">THE UNIVERSE</div>
                        <div class="typewriter-divider"></div>
                        <nav class="typewriter-menu">
                            <a href="${paths.home}" class="typewriter-link ${this.currentPage === "home" ? "active" : ""}">HOME</a>
                            <a href="${paths.shop}" class="typewriter-link ${this.currentPage === "shop" ? "active" : ""}">SHOP</a>
                            <a href="#" class="typewriter-link" data-basket-link aria-haspopup="dialog">BASKET</a>
                            <a href="${paths.roots}" class="typewriter-link ${this.currentPage === "roots" ? "active" : ""}">ROOTS</a>
                            <a href="${paths.game}" class="typewriter-link ${this.currentPage === "ouroboros-protocol" ? "active" : ""}">OUROBOROS PROTOCOL</a>
                        </nav>
                        <div class="typewriter-divider"></div>
                    </div>
                </aside>
            `;
      document.body.insertAdjacentHTML("afterbegin", sidebar);
      document.body.classList.add("has-sidebar");
    }

    // Mobile nav toggle and overlay (all pages)
    const mobileNav = `
            <button class="mobile-nav-toggle" aria-label="Open menu">FOTU</button>
            <div class="mobile-nav-overlay">
                <button class="mobile-nav-close">✕ CLOSE</button>
                <div class="typewriter-brand">FABRIC OF</div>
                <div class="typewriter-brand">THE UNIVERSE</div>
                <nav class="typewriter-menu">
                    <a href="${paths.home}" class="typewriter-link ${this.currentPage === "home" ? "active" : ""}">HOME</a>
                    <a href="${paths.shop}" class="typewriter-link ${this.currentPage === "shop" ? "active" : ""}">SHOP</a>
                    <a href="#" class="typewriter-link" data-basket-link aria-haspopup="dialog">BASKET</a>
                    <a href="${paths.roots}" class="typewriter-link ${this.currentPage === "roots" ? "active" : ""}">ROOTS</a>
                    <a href="${paths.game}" class="typewriter-link ${this.currentPage === "ouroboros-protocol" ? "active" : ""}">OUROBOROS PROTOCOL</a>
                </nav>
            </div>
        `;
    document.body.insertAdjacentHTML("afterbegin", mobileNav);

    // Mobile menu toggle functionality
    this.initMobileMenu();
  }

  initMobileMenu() {
    const toggle = document.querySelector(".mobile-nav-toggle");
    const overlay = document.querySelector(".mobile-nav-overlay");
    const close = document.querySelector(".mobile-nav-close");

    if (toggle && overlay) {
      toggle.addEventListener("click", () => {
        overlay.classList.add("active");
      });

      if (close) {
        close.addEventListener("click", () => {
          overlay.classList.remove("active");
        });
      }

      // Close on link click
      overlay.querySelectorAll(".typewriter-link").forEach((link) => {
        link.addEventListener("click", () => {
          overlay.classList.remove("active");
        });
      });
    }
  }

  getInstagramHTML() {
    return `
            <a class="hero-instagram" href="https://www.instagram.com/fotu.ldn" target="_blank" rel="noopener noreferrer" aria-label="FOTU on Instagram">
                <svg class="hero-instagram-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
                <span>@fotu.ldn</span>
            </a>
        `;
  }

  getFooterHTML() {
    return `
            <footer class="footer">
                <div class="footer-minimal">
                    ${this.getInstagramHTML()}
                    <p>Website by Sea Elegans<br>in collaboration with FOTU</p>
                    <p>&copy; FOTU 2026</p>
                </div>
            </footer>
        `;
  }

  bindBasketLinks() {
    const links = document.querySelectorAll("[data-basket-link]");
    const refresh = (qty) => {
      const label = qty > 0 ? `BASKET (${qty})` : "BASKET";
      links.forEach((a) => {
        a.textContent = label;
      });
    };
    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("basket:open"));
      });
    });
    window.addEventListener("basket:updated", (e) =>
      refresh(e.detail.totalQuantity || 0),
    );
    if (window.Basket) refresh(window.Basket?.state?.totalQuantity ?? 0);
  }

  init() {
    const isHomepage =
      document.querySelector(".hero-fullscreen") &&
      !document.querySelector(".roots-main");
    if (!isHomepage) {
      document.body.insertAdjacentHTML("beforeend", this.getFooterHTML());
    }
    this.injectNavIntoTypewriter();
    this.bindBasketLinks();
  }
}

// Initialize navbar when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new Navbar();
});
