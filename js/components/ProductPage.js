// Product detail: fetches one product, renders details + variant picker + qty + add-to-basket.
class ProductPage {
    constructor() {
        this.handle = new URLSearchParams(window.location.search).get('handle');
        this.product = null;
        this.variants = [];
        this.selectedOptions = {};   // { [optionName]: value }
        this.selectedVariant = null;
        this.qty = 1;
        this.galleryImages = [];     // [{ url, altText }] deduped product + variant images
        this.activeImageUrl = null;
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

    collectGalleryImages() {
        const seen = new Set();
        const list = [];
        const push = (img) => {
            if (img && img.url && !seen.has(img.url)) {
                seen.add(img.url);
                list.push({ url: img.url, altText: img.altText || '' });
            }
        };
        (this.product.images?.edges || []).forEach((e) => push(e.node));
        this.variants.forEach((v) => push(v.image));
        return list;
    }

    setActiveImage(url) {
        if (!url) return;
        this.activeImageUrl = url;
        this.renderActiveImage();
        this.renderThumbnails();
    }

    renderActiveImage() {
        const img = document.getElementById('productImage');
        if (!img) return;
        const active = this.galleryImages.find((i) => i.url === this.activeImageUrl) || this.galleryImages[0];
        if (active) {
            img.src = active.url;
            img.alt = active.altText || this.product.title;
        }
    }

    renderThumbnails() {
        const container = document.getElementById('productThumbs');
        if (!container) return;
        if (!this.galleryImages || this.galleryImages.length <= 1) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = this.galleryImages.map((img) => `
            <img class="product-thumb ${img.url === this.activeImageUrl ? 'is-active' : ''}"
                 src="${this.escapeHtml(img.url)}"
                 alt="${this.escapeHtml(img.altText || this.product.title)}"
                 data-url="${this.escapeHtml(img.url)}"
                 tabindex="0"
                 role="button"
                 aria-label="Show ${this.escapeHtml(img.altText || this.product.title)}" />
        `).join('');
        container.querySelectorAll('.product-thumb').forEach((thumb) => {
            thumb.addEventListener('click', () => {
                this.setActiveImage(thumb.dataset.url);
            });
            thumb.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.setActiveImage(thumb.dataset.url);
                }
            });
        });
    }

    setSelectedOption(name, value) {
        this.selectedOptions[name] = value;
        this.selectedVariant = this.findVariant(this.selectedOptions) || null;
        // When the new variant has its own image, switch the main gallery image to it.
        if (this.selectedVariant?.image?.url) {
            this.setActiveImage(this.selectedVariant.image.url);
        }
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
        const btn = document.getElementById('productAddToBasket');
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
            btn.textContent = 'Add to basket';
            btn.setAttribute('aria-label', `Add ${this.product.title} to basket`);
        }
    }

    bindAddToBasket() {
        const btn = document.getElementById('productAddToBasket');
        btn.addEventListener('click', () => {
            if (!this.selectedVariant || !this.selectedVariant.availableForSale) return;
            if (!window.Basket) {
                console.error('Basket not available');
                return;
            }
            const v = this.selectedVariant;
            const currency = this.product.priceRange?.minVariantPrice?.currencyCode || 'GBP';
            // Prefer the variant's own image; fall back to the first product image.
            const variantImg = v.image;
            const fallbackImg = this.product.images?.edges?.[0]?.node;
            const image = variantImg && variantImg.url
                ? { url: variantImg.url, altText: variantImg.altText || '' }
                : (fallbackImg ? { url: fallbackImg.url, altText: fallbackImg.altText || '' } : null);
            window.Basket.addLine({
                variantId: v.id,
                quantity: this.qty,
                title: this.product.title,
                variantTitle: v.title,
                price: { amount: String(v.price), currencyCode: currency },
                image,
                handle: this.product.handle,
            });
            window.dispatchEvent(new CustomEvent('basket:open'));
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

        this.galleryImages = this.collectGalleryImages();
        // Initial active image: the selected variant's image if it has one, else the first product image.
        this.activeImageUrl = this.selectedVariant?.image?.url
            || this.galleryImages[0]?.url
            || null;

        document.title = `FOTU - ${product.title}`;
        document.getElementById('productTitle').textContent = product.title;
        // descriptionHtml is Shopify-authored content; same trust model as the original code.
        document.getElementById('productDescription').innerHTML =
            product.descriptionHtml || this.escapeHtml(product.description || '');

        this.renderActiveImage();
        this.renderThumbnails();
        this.renderOptions();
        this.renderQty();
        this.renderPriceAndButton();
        this.bindAddToBasket();
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
