// Fetch products from /api/products proxy and render the shop grid.
class ShopifyStore {
    constructor() {
        this.grid = document.querySelector('.shop-grid');
        if (!this.grid) return;
        this.search = document.getElementById('shopSearch');
        this.empty = document.getElementById('shopEmpty');
        this.products = [];
        this.query = '';
        this.init();
    }

    escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    async fetchProducts() {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
    }

    formatPrice(amount, currencyCode) {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode || 'GBP',
        }).format(isNaN(num) ? 0 : num);
    }

    matchesQuery(product, q) {
        if (!q) return true;
        const haystack = `${product.title || ''} ${product.description || ''} ${product.handle || ''}`.toLowerCase();
        return haystack.includes(q);
    }

    render() {
        const q = this.query.trim().toLowerCase();
        const list = this.products.filter((p) => this.matchesQuery(p, q));

        if (list.length === 0) {
            this.grid.innerHTML = '';
            if (this.empty) this.empty.hidden = false;
            return;
        }
        if (this.empty) this.empty.hidden = true;

        this.grid.innerHTML = list.map((product) => {
            const image = product.images?.edges?.[0]?.node;
            const variant = product.variants?.edges?.[0]?.node;
            const price = variant
                ? { amount: variant.price, currencyCode: product.priceRange.minVariantPrice.currencyCode }
                : product.priceRange.minVariantPrice;
            const href = `product.html?handle=${encodeURIComponent(product.handle)}`;
            return `
                <a class="shop-item" href="${this.escapeHtml(href)}">
                    <div class="shop-item-image">
                        ${image
                            ? `<img src="${this.escapeHtml(image.url)}" alt="${this.escapeHtml(image.altText || product.title)}" />`
                            : ''
                        }
                    </div>
                    <div class="shop-item-info">
                        <h3 class="shop-item-name">${this.escapeHtml(product.title)}</h3>
                        <p class="shop-item-description">${this.escapeHtml(product.description)}</p>
                        <p class="shop-item-price">${this.escapeHtml(this.formatPrice(price.amount, price.currencyCode))}</p>
                    </div>
                </a>
            `;
        }).join('');
    }

    bindSearch() {
        if (!this.search) return;
        this.search.addEventListener('input', () => {
            this.query = this.search.value;
            this.render();
        });
    }

    async init() {
        try {
            this.products = await this.fetchProducts();
            this.render();
            this.bindSearch();
        } catch (err) {
            console.error('Shopify fetch failed:', err);
            // Leave static placeholder items in place as fallback
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ShopifyStore();
});
