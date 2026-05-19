// Basket drawer UI. Subscribes to window 'basket:updated' and 'basket:open' events.
(function () {
    if (!window.Basket) {
        console.error('BasketDrawer requires Basket.js to be loaded first');
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

    class BasketDrawer {
        constructor() {
            this._mount();
            this._bind();
            this.render(window.Basket.state);
        }

        _mount() {
            const html = `
                <div class="basket-overlay" data-basket-overlay></div>
                <aside class="basket-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="basket-drawer-title" data-basket-drawer>
                    <header class="basket-drawer-header">
                        <span class="basket-drawer-title" id="basket-drawer-title">Basket</span>
                        <button type="button" class="basket-drawer-close" data-basket-close aria-label="Close basket">&#x2715;</button>
                    </header>
                    <div class="basket-drawer-body" data-basket-body></div>
                    <footer class="basket-drawer-footer" data-basket-footer></footer>
                </aside>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            this.overlay = document.querySelector('[data-basket-overlay]');
            this.drawer = document.querySelector('[data-basket-drawer]');
            this.body = document.querySelector('[data-basket-body]');
            this.footer = document.querySelector('[data-basket-footer]');
        }

        _bind() {
            this.overlay.addEventListener('click', () => this.close());
            this.drawer.querySelector('[data-basket-close]').addEventListener('click', () => this.close());
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.drawer.classList.contains('is-open')) this.close();
            });
            window.addEventListener('basket:open', () => this.open());
            window.addEventListener('basket:updated', (e) => this.render(e.detail));

            // Body delegate for line controls
            this.body.addEventListener('click', (e) => {
                const target = e.target;
                const lineEl = target.closest('[data-variant-id]');
                if (!lineEl) return;
                const variantId = lineEl.dataset.variantId;
                const inc = target.closest('[data-line-inc]');
                if (inc) {
                    window.Basket.updateLine(variantId, parseInt(inc.dataset.qty, 10) + 1);
                    return;
                }
                const dec = target.closest('[data-line-dec]');
                if (dec) {
                    window.Basket.updateLine(variantId, parseInt(dec.dataset.qty, 10) - 1);
                    return;
                }
                if (target.closest('[data-line-remove]')) {
                    window.Basket.removeLine(variantId);
                }
            });
        }

        open() {
            this._returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            this.drawer.classList.add('is-open');
            this.overlay.classList.add('is-open');
            this.drawer.setAttribute('aria-hidden', 'false');
            document.body.classList.add('basket-open');
            // Focus the close button so keyboard users land inside the drawer
            this.drawer.querySelector('[data-basket-close]')?.focus();
        }

        close() {
            this.drawer.classList.remove('is-open');
            this.overlay.classList.remove('is-open');
            this.drawer.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('basket-open');
            // Return focus to whatever triggered the open (e.g. BASKET link in navbar)
            if (this._returnFocusTo && document.contains(this._returnFocusTo)) {
                this._returnFocusTo.focus();
            }
            this._returnFocusTo = null;
        }

        render(state) {
            if (!state) return;
            if (!state.lines || state.lines.length === 0) {
                this.body.innerHTML = '<div class="basket-empty">Your basket is empty</div>';
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
                    <div class="basket-line" data-variant-id="${escapeHtml(line.variantId)}">
                        ${line.image ? `<img class="basket-line-image" src="${escapeHtml(line.image.url)}" alt="${escapeHtml(line.image.altText || line.title || '')}" />` : '<div class="basket-line-image"></div>'}
                        <div class="basket-line-info">
                            <a class="basket-line-title" href="${escapeHtml(productHref)}">${escapeHtml(line.title)}</a>
                            ${variantTitle ? `<span class="basket-line-variant">${escapeHtml(variantTitle)}</span>` : ''}
                            <div class="basket-line-row">
                                <span class="basket-qty">
                                    <button type="button" data-line-dec data-qty="${escapeHtml(line.quantity)}" aria-label="Decrease quantity of ${escapeHtml(line.title)}">&#x2212;</button>
                                    <span class="basket-qty-value">${escapeHtml(line.quantity)}</span>
                                    <button type="button" data-line-inc data-qty="${escapeHtml(line.quantity)}" aria-label="Increase quantity of ${escapeHtml(line.title)}">+</button>
                                </span>
                                <span class="basket-line-price">${escapeHtml(formatPrice(lineTotal, currency))}</span>
                            </div>
                            <button type="button" class="basket-line-remove" data-line-remove aria-label="Remove ${escapeHtml(line.title)} from basket">Remove</button>
                        </div>
                    </div>
                `;
            }).join('');

            const subtotal = state.subtotal;
            this.footer.innerHTML = `
                <div class="basket-subtotal-row">
                    <span>Subtotal</span>
                    <span class="basket-subtotal-amount">${escapeHtml(formatPrice(subtotal.amount, subtotal.currencyCode))}</span>
                </div>
                <button type="button" class="basket-checkout-button" data-basket-checkout>Checkout</button>
                <p class="basket-footer-note">Shipping &amp; taxes calculated at checkout. Prices and stock confirmed at checkout.</p>
            `;
            const checkoutBtn = this.footer.querySelector('[data-basket-checkout]');
            checkoutBtn.addEventListener('click', () => {
                const url = window.Basket.getCheckoutUrl();
                if (url) window.location.href = url;
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => new BasketDrawer());
})();
