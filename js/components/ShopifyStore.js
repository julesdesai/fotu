// Fetch products from /api/products proxy and render the shop grid.
class ShopifyStore {
    constructor() {
        this.gridActive = document.getElementById('shopGridActive');
        this.gridArchived = document.getElementById('shopGridArchived');
        if (!this.gridActive || !this.gridArchived) return;
        this.soldOutHeader = document.getElementById('shopSoldOutHeader');
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

    renderTile(product, isArchived) {
        const image = product.images?.edges?.[0]?.node;
        const variant = product.variants?.edges?.[0]?.node;
        const price = variant
            ? { amount: variant.price, currencyCode: product.priceRange.minVariantPrice.currencyCode }
            : product.priceRange.minVariantPrice;
        const href = `product.html?handle=${encodeURIComponent(product.handle)}`;
        const priceText = isArchived
            ? 'Sold out'
            : this.formatPrice(price.amount, price.currencyCode);
        const cls = isArchived ? 'shop-item shop-item--sold-out' : 'shop-item';
        return `
            <a class="${cls}" href="${this.escapeHtml(href)}">
                <div class="shop-item-image">
                    ${image
                        ? `<img src="${this.escapeHtml(image.url)}" alt="${this.escapeHtml(image.altText || product.title)}" loading="lazy" decoding="async" />`
                        : ''
                    }
                </div>
                <div class="shop-item-info">
                    <h3 class="shop-item-name">${this.escapeHtml(product.title)}</h3>
                    <p class="shop-item-price">${this.escapeHtml(priceText)}</p>
                </div>
            </a>
        `;
    }

    render() {
        const q = this.query.trim().toLowerCase();
        // Hide draft products entirely; split the rest into active vs archived.
        const visible = this.products
            .filter((p) => p.status !== 'DRAFT')
            .filter((p) => this.matchesQuery(p, q));
        const active = visible.filter((p) => p.status !== 'ARCHIVED');
        const archived = visible.filter((p) => p.status === 'ARCHIVED');

        if (visible.length === 0) {
            this.gridActive.innerHTML = '';
            this.gridArchived.innerHTML = '';
            if (this.soldOutHeader) this.soldOutHeader.hidden = true;
            if (this.empty) this.empty.hidden = false;
            return;
        }
        if (this.empty) this.empty.hidden = true;

        this.gridActive.innerHTML = active.map((p) => this.renderTile(p, false)).join('');
        this.gridArchived.innerHTML = archived.map((p) => this.renderTile(p, true)).join('');
        if (this.soldOutHeader) this.soldOutHeader.hidden = archived.length === 0;
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
