// Cart drawer UI. Subscribes to window 'cart:updated' and 'cart:open' events.
(function () {
    if (!window.Cart) {
        console.error('CartDrawer requires Cart.js to be loaded first');
        return;
    }

    function formatPrice(amount, currencyCode) {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode || 'GBP',
        }).format(num);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    class CartDrawer {
        constructor() {
            this._mount();
            this._bind();
            this.render(window.Cart.state);
        }

        _mount() {
            const html = `
                <div class="cart-overlay" data-cart-overlay></div>
                <aside class="cart-drawer" aria-hidden="true" data-cart-drawer>
                    <header class="cart-drawer-header">
                        <span class="cart-drawer-title">Cart</span>
                        <button type="button" class="cart-drawer-close" data-cart-close aria-label="Close cart">✕</button>
                    </header>
                    <div class="cart-drawer-body" data-cart-body></div>
                    <footer class="cart-drawer-footer" data-cart-footer></footer>
                </aside>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            this.overlay = document.querySelector('[data-cart-overlay]');
            this.drawer = document.querySelector('[data-cart-drawer]');
            this.body = document.querySelector('[data-cart-body]');
            this.footer = document.querySelector('[data-cart-footer]');
        }

        _bind() {
            this.overlay.addEventListener('click', () => this.close());
            this.drawer.querySelector('[data-cart-close]').addEventListener('click', () => this.close());
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.drawer.classList.contains('is-open')) this.close();
            });
            window.addEventListener('cart:open', () => this.open());
            window.addEventListener('cart:updated', (e) => this.render(e.detail));

            // Body delegate for line controls
            this.body.addEventListener('click', (e) => {
                const target = e.target;
                const lineEl = target.closest('[data-variant-id]');
                if (!lineEl) return;
                const variantId = lineEl.dataset.variantId;
                if (target.matches('[data-line-inc]')) {
                    const qty = parseInt(target.dataset.qty, 10);
                    window.Cart.updateLine(variantId, qty + 1);
                } else if (target.matches('[data-line-dec]')) {
                    const qty = parseInt(target.dataset.qty, 10);
                    window.Cart.updateLine(variantId, qty - 1);
                } else if (target.matches('[data-line-remove]')) {
                    window.Cart.removeLine(variantId);
                }
            });
        }

        open() {
            this.drawer.classList.add('is-open');
            this.overlay.classList.add('is-open');
            this.drawer.setAttribute('aria-hidden', 'false');
            document.body.classList.add('cart-open');
        }

        close() {
            this.drawer.classList.remove('is-open');
            this.overlay.classList.remove('is-open');
            this.drawer.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('cart-open');
        }

        render(state) {
            if (!state.lines || state.lines.length === 0) {
                this.body.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
                this.footer.innerHTML = '';
                return;
            }

            this.body.innerHTML = state.lines.map((line) => {
                const variantTitle = line.variantTitle && line.variantTitle !== 'Default Title' ? line.variantTitle : '';
                const lineTotal = parseFloat(line.price.amount) * line.quantity;
                const currency = line.price.currencyCode || 'GBP';
                const productHref = line.handle
                    ? `product.html?handle=${encodeURIComponent(line.handle)}`
                    : '#';
                return `
                    <div class="cart-line" data-variant-id="${escapeHtml(line.variantId)}">
                        ${line.image ? `<img class="cart-line-image" src="${escapeHtml(line.image.url)}" alt="${escapeHtml(line.image.altText || line.title || '')}" />` : '<div class="cart-line-image"></div>'}
                        <div class="cart-line-info">
                            <a class="cart-line-title" href="${escapeHtml(productHref)}">${escapeHtml(line.title)}</a>
                            ${variantTitle ? `<span class="cart-line-variant">${escapeHtml(variantTitle)}</span>` : ''}
                            <div class="cart-line-row">
                                <span class="cart-qty">
                                    <button type="button" data-line-dec data-qty="${line.quantity}" aria-label="Decrease">−</button>
                                    <span class="cart-qty-value">${line.quantity}</span>
                                    <button type="button" data-line-inc data-qty="${line.quantity}" aria-label="Increase">+</button>
                                </span>
                                <span class="cart-line-price">${escapeHtml(formatPrice(lineTotal, currency))}</span>
                            </div>
                            <button type="button" class="cart-line-remove" data-line-remove>Remove</button>
                        </div>
                    </div>
                `;
            }).join('');

            const subtotal = state.subtotal;
            this.footer.innerHTML = `
                <div class="cart-subtotal-row">
                    <span>Subtotal</span>
                    <span class="cart-subtotal-amount">${escapeHtml(formatPrice(subtotal.amount, subtotal.currencyCode))}</span>
                </div>
                <button type="button" class="cart-checkout-button" data-cart-checkout>Checkout</button>
                <p class="cart-footer-note">Shipping & taxes calculated at checkout. Prices and stock confirmed at checkout.</p>
            `;
            const checkoutBtn = this.footer.querySelector('[data-cart-checkout]');
            checkoutBtn.addEventListener('click', () => {
                const url = window.Cart.getCheckoutUrl();
                if (url) window.location.href = url;
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => new CartDrawer());
})();
