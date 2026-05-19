// Fetch products from /api/products proxy and render the shop grid
class ShopifyStore {
    constructor() {
        this.grid = document.querySelector('.shop-grid');
        if (this.grid) this.init();
    }

    async fetchProducts() {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
    }

    formatPrice(amount, currencyCode) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    }

    renderProducts(products) {
        this.grid.innerHTML = products.map(product => {
            const image = product.images.edges[0]?.node;
            const variant = product.variants?.edges[0]?.node;
            const price = variant
                ? { amount: variant.price, currencyCode: product.priceRange.minVariantPrice.currencyCode }
                : product.priceRange.minVariantPrice;

            return `
                <a class="shop-item" href="product.html?handle=${encodeURIComponent(product.handle)}">
                    <div class="shop-item-image">
                        ${image
                            ? `<img src="${image.url}" alt="${image.altText || product.title}" />`
                            : ''
                        }
                    </div>
                    <div class="shop-item-info">
                        <h3 class="shop-item-name">${product.title}</h3>
                        <p class="shop-item-description">${product.description}</p>
                        <p class="shop-item-price">${this.formatPrice(price.amount, price.currencyCode)}</p>
                    </div>
                </a>
            `;
        }).join('');
    }

    async init() {
        try {
            const products = await this.fetchProducts();
            if (products.length) {
                this.renderProducts(products);
            }
        } catch (err) {
            console.error('Shopify fetch failed:', err);
            // Leave static placeholder items in place as fallback
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ShopifyStore();
});
