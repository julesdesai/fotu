// Cart singleton: localStorage-backed cart state + event bus + permalink builder.
// Other components MUST go through `window.Cart`.
(function () {
    const STORAGE_KEY = 'fotu_cart';
    const EVENT_NAME = 'cart:updated';
    const SHOP_DOMAIN = 'kkixr1-uq.myshopify.com';
    const MAX_QTY = 10;
    const MIN_QTY = 1;

    class Cart {
        constructor() {
            this.lines = this._load();
            // Defer the first emit until the next tick so subscribers attached
            // on DOMContentLoaded see initial state.
            queueMicrotask(() => this._emit());
        }

        _load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.warn('Cart load failed, starting empty:', e);
                return [];
            }
        }

        _save() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lines));
            } catch (e) {
                console.warn('Cart save failed:', e);
            }
        }

        _emit() {
            window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: this.state }));
        }

        get state() {
            const totalQuantity = this.lines.reduce((s, l) => s + l.quantity, 0);
            const subtotal = this.lines.reduce((s, l) => s + parseFloat(l.price.amount) * l.quantity, 0);
            const currencyCode = this.lines[0]?.price?.currencyCode || 'GBP';
            return {
                lines: this.lines,
                totalQuantity,
                subtotal: { amount: subtotal.toFixed(2), currencyCode },
            };
        }

        _clampQty(qty) {
            return Math.max(MIN_QTY, Math.min(MAX_QTY, qty | 0));
        }

        addLine(snapshot) {
            // snapshot: { variantId, quantity, title, variantTitle, price: {amount, currencyCode}, image?, handle }
            if (!snapshot || !snapshot.variantId) return;
            const existing = this.lines.find((l) => l.variantId === snapshot.variantId);
            if (existing) {
                existing.quantity = this._clampQty(existing.quantity + (snapshot.quantity || 1));
            } else {
                this.lines.push({
                    variantId: snapshot.variantId,
                    quantity: this._clampQty(snapshot.quantity || 1),
                    title: snapshot.title || '',
                    variantTitle: snapshot.variantTitle || '',
                    price: snapshot.price || { amount: '0.00', currencyCode: 'GBP' },
                    image: snapshot.image || null,
                    handle: snapshot.handle || '',
                });
            }
            this._save();
            this._emit();
        }

        updateLine(variantId, quantity) {
            const idx = this.lines.findIndex((l) => l.variantId === variantId);
            if (idx === -1) return;
            if (quantity <= 0) {
                this.lines.splice(idx, 1);
            } else {
                this.lines[idx].quantity = this._clampQty(quantity);
            }
            this._save();
            this._emit();
        }

        removeLine(variantId) {
            const before = this.lines.length;
            this.lines = this.lines.filter((l) => l.variantId !== variantId);
            if (this.lines.length !== before) {
                this._save();
                this._emit();
            }
        }

        clear() {
            this.lines = [];
            this._save();
            this._emit();
        }

        getCheckoutUrl() {
            if (this.lines.length === 0) return null;
            const parts = this.lines.map((l) => {
                // gid://shopify/ProductVariant/42178129 → 42178129
                const numericId = String(l.variantId).split('/').pop();
                return `${numericId}:${l.quantity}`;
            });
            return `https://${SHOP_DOMAIN}/cart/${parts.join(',')}`;
        }

        openDrawer() {
            window.dispatchEvent(new CustomEvent('cart:open'));
        }
    }

    window.Cart = new Cart();
})();
