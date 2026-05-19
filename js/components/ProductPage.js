// Product detail: fetches one product, renders details + variant picker + qty + add-to-cart.
class ProductPage {
    constructor() {
        this.handle = new URLSearchParams(window.location.search).get('handle');
        this.product = null;
        this.variants = [];
        this.selectedOptions = {};   // { [optionName]: value }
        this.selectedVariant = null;
        this.qty = 1;
        if (this.handle) this.init();
    }

    escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    async fetchProduct() {
        const res = await fetch(`/api/product?handle=${encodeURIComponent(this.handle)}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
    }

    formatPrice(amount, currencyCode) {
        const num = amount == null ? 0 : (typeof amount === 'string' ? parseFloat(amount) : amount);
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode || 'GBP',
        }).format(isNaN(num) ? 0 : num);
    }

    findVariant(options) {
        return this.variants.find((v) => {
            const map = Object.fromEntries((v.selectedOptions || []).map((o) => [o.name, o.value]));
            return Object.keys(options).every((k) => map[k] === options[k]);
        });
    }

    setSelectedOption(name, value) {
        this.selectedOptions[name] = value;
        this.selectedVariant = this.findVariant(this.selectedOptions) || null;
        this.renderOptions();
        this.renderPriceAndButton();
    }

    renderOptions() {
        const container = document.getElementById('productOptions');
        const options = (this.product.options || []).filter((o) => o.values && o.values.length > 1);
        if (options.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = options.map((opt) => `
            <div class="product-option">
                <span class="product-option-label">${this.escapeHtml(opt.name)}</span>
                <div class="product-option-values">
                    ${opt.values.map((val) => `
                        <button type="button"
                            class="product-option-value ${this.selectedOptions[opt.name] === val ? 'is-selected' : ''}"
                            data-option-name="${this.escapeHtml(opt.name)}"
                            data-option-value="${this.escapeHtml(val)}">${this.escapeHtml(val)}</button>
                    `).join('')}
                </div>
            </div>
        `).join('');
        container.querySelectorAll('.product-option-value').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.setSelectedOption(btn.dataset.optionName, btn.dataset.optionValue);
            });
        });
    }

    renderQty() {
        const container = document.getElementById('productQty');
        container.innerHTML = `
            <span class="product-option-label">Quantity</span>
            <div class="product-qty-stepper">
                <button type="button" data-qty-dec aria-label="Decrease">−</button>
                <span class="product-qty-value" data-qty-value>${this.qty}</span>
                <button type="button" data-qty-inc aria-label="Increase">+</button>
            </div>
        `;
        const value = container.querySelector('[data-qty-value]');
        const dec = container.querySelector('[data-qty-dec]');
        const inc = container.querySelector('[data-qty-inc]');
        const refresh = () => {
            value.textContent = this.qty;
            dec.disabled = this.qty <= 1;
            inc.disabled = this.qty >= 10;
        };
        dec.addEventListener('click', () => { if (this.qty > 1) { this.qty--; refresh(); } });
        inc.addEventListener('click', () => { if (this.qty < 10) { this.qty++; refresh(); } });
        refresh();
    }

    renderPriceAndButton() {
        const priceEl = document.getElementById('productPrice');
        const btn = document.getElementById('productAddToCart');
        const v = this.selectedVariant;
        if (!v) {
            btn.disabled = true;
            btn.textContent = 'Unavailable';
            btn.setAttribute('aria-label', 'Unavailable');
            return;
        }
        const currency = this.product.priceRange?.minVariantPrice?.currencyCode || 'GBP';
        priceEl.textContent = this.formatPrice(v.price, currency);
        if (!v.availableForSale) {
            btn.disabled = true;
            btn.textContent = 'Sold out';
            btn.setAttribute('aria-label', `${this.product.title} is sold out`);
        } else {
            btn.disabled = false;
            btn.textContent = 'Add to cart';
            btn.setAttribute('aria-label', `Add ${this.product.title} to cart`);
        }
    }

    bindAddToCart() {
        const btn = document.getElementById('productAddToCart');
        btn.addEventListener('click', () => {
            if (!this.selectedVariant || !this.selectedVariant.availableForSale) return;
            if (!window.Cart) {
                console.error('Cart not available');
                return;
            }
            const v = this.selectedVariant;
            const currency = this.product.priceRange?.minVariantPrice?.currencyCode || 'GBP';
            const image = this.product.images?.edges?.[0]?.node || null;
            window.Cart.addLine({
                variantId: v.id,
                quantity: this.qty,
                title: this.product.title,
                variantTitle: v.title,
                price: { amount: String(v.price), currencyCode: currency },
                image: image ? { url: image.url, altText: image.altText } : null,
                handle: this.product.handle,
            });
            window.dispatchEvent(new CustomEvent('cart:open'));
        });
    }

    render(product) {
        this.product = product;
        this.variants = (product.variants?.edges || []).map((e) => e.node);

        // Default selection: first available variant, else first variant.
        this.selectedVariant = this.variants.find((v) => v.availableForSale) || this.variants[0] || null;
        if (this.selectedVariant) {
            this.selectedOptions = Object.fromEntries(
                (this.selectedVariant.selectedOptions || []).map((o) => [o.name, o.value])
            );
        }

        document.title = `FOTU - ${product.title}`;
        document.getElementById('productTitle').textContent = product.title;
        // descriptionHtml is Shopify-authored content; same trust model as the original code.
        document.getElementById('productDescription').innerHTML =
            product.descriptionHtml || this.escapeHtml(product.description || '');

        const image = product.images?.edges?.[0]?.node;
        if (image) {
            const img = document.getElementById('productImage');
            img.src = image.url;
            img.alt = image.altText || product.title;
        }

        this.renderOptions();
        this.renderQty();
        this.renderPriceAndButton();
        this.bindAddToCart();
    }

    async init() {
        try {
            const product = await this.fetchProduct();
            this.render(product);
        } catch (err) {
            console.error('Product fetch failed:', err);
            const layout = document.querySelector('.product-layout');
            if (layout) {
                layout.innerHTML = '<p class="product-error">Product could not be loaded. <a href="shop.html">Back to shop</a></p>';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ProductPage());
