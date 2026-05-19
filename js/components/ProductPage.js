// Fetch single product and render the product detail page
class ProductPage {
    constructor() {
        this.handle = new URLSearchParams(window.location.search).get('handle');
        if (this.handle) this.init();
    }

    async fetchProduct() {
        const res = await fetch(`/api/product?handle=${encodeURIComponent(this.handle)}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
    }

    formatPrice(amount, currencyCode) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    }

    render(product) {
        const image = product.images.edges[0]?.node;
        const variant = product.variants?.edges[0]?.node;
        const price = variant
            ? { amount: variant.price, currencyCode: product.priceRange.minVariantPrice.currencyCode }
            : product.priceRange.minVariantPrice;

        document.title = `FOTU - ${product.title}`;

        document.getElementById('productTitle').textContent = product.title;
        document.getElementById('productPrice').textContent = this.formatPrice(price.amount, price.currencyCode);
        document.getElementById('productDescription').innerHTML = product.descriptionHtml || product.description;

        if (image) {
            const img = document.getElementById('productImage');
            img.src = image.url;
            img.alt = image.altText || product.title;
        }
    }

    async init() {
        try {
            const product = await this.fetchProduct();
            this.render(product);
        } catch (err) {
            console.error('Product fetch failed:', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ProductPage();
});
