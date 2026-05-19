# Shopify Cart & Checkout Implementation Plan (v2 — permalink approach)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-item localStorage-backed basket drawer to the FOTU shop, with checkout handed off via Shopify cart permalinks (`https://<shop>/cart/<varId>:<qty>,...`).

**Architecture:** Cart state lives entirely in the browser's `localStorage`. Drawer renders synchronously from cached line snapshots. "Checkout" builds a permalink URL and redirects to Shopify hosted checkout. No new server endpoints, no new Shopify tokens. The existing Admin-API-backed product fetches are untouched except for a single additive GraphQL field (`product.options { name values }`) used by the variant picker.

**Tech Stack:** Vanilla JavaScript (no framework), Node `http` for local dev (`server.js`), Vercel serverless functions (`api/*.js`), Shopify Admin API GraphQL (existing — unchanged for products).

**Spec:** `docs/superpowers/specs/2026-05-19-shopify-cart-checkout-design.md` (v2)

**Testing approach:** No test framework exists in this repo. Verification is **manual** at the end of every task: `curl` for API, `npm run dev` + browser for UI. Each task ends with an explicit verification step and a commit. Do not skip verification.

**XSS hygiene:** All UI components that build HTML via template strings MUST escape any string derived from Shopify (product title, variant title, option name/value, image alt) before interpolation. An `escapeHtml` helper is included in `BasketDrawer.js` and `ProductPage.js`. The existing `productDescription` block still renders `descriptionHtml` from Shopify as HTML (Shopify-authored content — same trust model as before).

**Permalink format note:** Shopify cart permalinks use the **numeric** variant ID, not the full GraphQL `gid://shopify/ProductVariant/<num>` form. Extract the numeric part with `variantId.split('/').pop()`. The shop domain is hardcoded as `kkixr1-uq.myshopify.com` (same value already in `.env`).

---

## File Structure

**Create:**
- `js/components/Basket.js` — singleton localStorage cart + event bus + permalink builder
- `js/components/BasketDrawer.js` — drawer UI
- `css/basket.css` — drawer + picker + qty-stepper styles

**Modify:**
- `api/product.js` — add `options { name values }` to GraphQL query
- `server.js` — same one-line addition to mirror query
- `js/components/Navbar.js` — `BASKET (n)` menu item, drawer open + count refresh
- `js/components/ProductPage.js` — variant picker, qty stepper, Add to basket
- `pages/product.html` — picker / qty / button containers + Cart script/CSS loads
- `pages/shop.html` — Cart script/CSS loads
- `index.html`, `pages/about.html`, `pages/digital-fabric.html`, `pages/game.html` — Cart script/CSS loads for site-wide drawer

---

## Task 1: Build `Basket.js` singleton (localStorage)

**Goal:** A single in-page `Basket` instance that owns cart state in `localStorage`, exposes synchronous mutation methods, broadcasts `basket:updated`, and can produce a Shopify cart permalink URL.

**Files:**
- Create: `js/components/Basket.js`

- [ ] **Step 1: Create `js/components/Basket.js`**

Create `js/components/Basket.js` with:

```javascript
// Basket singleton: localStorage-backed cart state + event bus + permalink builder.
// Other components MUST go through `window.Basket`.
(function () {
    const STORAGE_KEY = 'fotu_basket';
    const EVENT_NAME = 'basket:updated';
    const SHOP_DOMAIN = 'kkixr1-uq.myshopify.com';
    const MAX_QTY = 10;
    const MIN_QTY = 1;

    class Basket {
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
            window.dispatchEvent(new CustomEvent('basket:open'));
        }
    }

    window.Basket = new Basket();
})();
```

- [ ] **Step 2: Smoke test in browser console**

Add a temporary script tag to `pages/shop.html` BEFORE `ShopifyStore.js`:

```html
<script src="../js/components/Basket.js"></script>
```

(Task 2 finalises the shop.html loads; this is just so we can poke at it now.)

Run `npm run dev`, load `http://localhost:3000/pages/shop.html`, open devtools console:

```javascript
window.Basket.state
// → { lines: [], totalQuantity: 0, subtotal: { amount: "0.00", currencyCode: "GBP" } }

window.addEventListener('basket:updated', e => console.log('updated', e.detail));

window.Basket.addLine({
    variantId: 'gid://shopify/ProductVariant/42178129',
    quantity: 2,
    title: 'Test Item',
    variantTitle: 'Medium',
    price: { amount: '60.00', currencyCode: 'GBP' },
    handle: 'test-item',
});
window.Basket.state
// → totalQuantity: 2, subtotal.amount: "120.00", one line

window.Basket.addLine({
    variantId: 'gid://shopify/ProductVariant/42178129',
    quantity: 1,
    title: 'Test Item',
    price: { amount: '60.00', currencyCode: 'GBP' },
});
window.Basket.state.totalQuantity  // → 3 (merged)

window.Basket.updateLine('gid://shopify/ProductVariant/42178129', 5);
window.Basket.state.totalQuantity  // → 5

window.Basket.getCheckoutUrl();
// → "https://kkixr1-uq.myshopify.com/cart/42178129:5"

localStorage.getItem('fotu_basket');  // → JSON with the line
location.reload();
window.Basket.state.totalQuantity   // → 5 (persisted)

window.Basket.removeLine('gid://shopify/ProductVariant/42178129');
window.Basket.state.totalQuantity   // → 0
window.Basket.getCheckoutUrl();  // → null
```

All assertions should hold.

- [ ] **Step 3: Commit**

```bash
git add js/components/Basket.js pages/shop.html
git commit -m "Add localStorage-backed Basket singleton with permalink builder"
```

---

## Task 2: Build basket drawer UI

**Goal:** A slide-in right drawer that lists cart lines with qty/remove controls, shows subtotal, and exposes a CHECKOUT button that redirects to the permalink URL. Driven entirely by `cart:updated` events. Opens on `cart:open` events.

**Files:**
- Create: `css/basket.css`
- Create: `js/components/BasketDrawer.js`
- Modify: `pages/shop.html` (finalise script/CSS loads)

- [ ] **Step 1: Create `css/basket.css`**

Create `css/basket.css` with:

```css
/* Basket drawer overlay + panel */
.basket-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0);
    z-index: 998;
    pointer-events: none;
    transition: background 0.25s ease;
}

.basket-overlay.is-open {
    background: rgba(0, 0, 0, 0.25);
    pointer-events: auto;
}

.basket-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    max-width: 100%;
    height: 100vh;
    background: var(--bg-light);
    border-left: 1px solid var(--border-color);
    z-index: 999;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
    font-family: "Courier New", monospace;
}

.basket-drawer.is-open {
    transform: translateX(0);
}

.basket-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
}

.basket-drawer-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.basket-drawer-close {
    background: none;
    border: none;
    font-family: "Courier New", monospace;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 8px;
}

.basket-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
}

.basket-empty {
    text-align: center;
    padding: var(--spacing-2xl) var(--spacing-md);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.basket-line {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--border-color);
}

.basket-line-image {
    width: 60px;
    height: 80px;
    object-fit: cover;
    background: var(--bg-gray);
    display: block;
}

.basket-line-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.basket-line-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dark);
    text-decoration: none;
}

.basket-line-variant {
    font-size: 10px;
    font-weight: 400;
    color: var(--text-muted);
}

.basket-line-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
}

.basket-qty {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border-color);
}

.basket-qty button {
    background: none;
    border: none;
    width: 26px;
    height: 26px;
    font-family: "Courier New", monospace;
    font-size: 13px;
    cursor: pointer;
}

.basket-qty button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.basket-qty-value {
    min-width: 24px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
}

.basket-line-price {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
}

.basket-line-remove {
    background: none;
    border: none;
    font-family: "Courier New", monospace;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    margin-top: 4px;
    text-decoration: underline;
    text-underline-offset: 2px;
    align-self: flex-start;
}

.basket-line-remove:hover {
    color: var(--text-dark);
}

.basket-drawer-footer {
    border-top: 1px solid var(--border-color);
    padding: var(--spacing-md);
}

.basket-subtotal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.basket-subtotal-amount {
    font-size: 13px;
}

.basket-checkout-button {
    display: block;
    width: 100%;
    padding: var(--spacing-md);
    background: var(--text-dark);
    color: var(--bg-light);
    border: none;
    font-family: "Courier New", monospace;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: opacity 0.2s ease;
}

.basket-checkout-button:hover { opacity: 0.85; }
.basket-checkout-button:disabled { opacity: 0.4; cursor: not-allowed; }

.basket-footer-note {
    text-align: center;
    font-size: 9px;
    color: var(--text-muted);
    margin-top: var(--spacing-sm);
    text-transform: lowercase;
    letter-spacing: 0.05em;
    line-height: 1.4;
}

body.basket-open { overflow: hidden; }

/* Variant picker + qty stepper on product page */
.product-options {
    margin-bottom: var(--spacing-lg);
    font-family: "Courier New", monospace;
}

.product-option {
    margin-bottom: var(--spacing-md);
}

.product-option-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: var(--spacing-xs);
    display: block;
}

.product-option-values {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
}

.product-option-value {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-light);
    font-family: "Courier New", monospace;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
}

.product-option-value.is-selected {
    background: var(--text-dark);
    color: var(--bg-light);
    border-color: var(--text-dark);
}

.product-option-value:hover { border-color: var(--text-dark); }

.product-qty {
    margin-bottom: var(--spacing-lg);
}

.product-qty-stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border-color);
}

.product-qty-stepper button {
    width: 36px;
    height: 36px;
    background: none;
    border: none;
    font-family: "Courier New", monospace;
    font-size: 14px;
    cursor: pointer;
}

.product-qty-stepper button:disabled { opacity: 0.3; cursor: not-allowed; }

.product-qty-value {
    min-width: 32px;
    text-align: center;
    font-family: "Courier New", monospace;
    font-size: 12px;
    font-weight: 700;
}

.product-add-to-basket {
    display: block;
    width: 100%;
    max-width: 320px;
    padding: var(--spacing-md);
    background: var(--text-dark);
    color: var(--bg-light);
    border: none;
    font-family: "Courier New", monospace;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: opacity 0.2s ease;
    margin-bottom: var(--spacing-md);
}

.product-add-to-basket:hover { opacity: 0.85; }
.product-add-to-basket:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 600px) {
    .basket-drawer { width: 100%; border-left: none; }
}
```

- [ ] **Step 2: Create `js/components/BasketDrawer.js`**

Note: this file uses `innerHTML` to render line items because it's the only practical way to do template-style rendering in vanilla JS without a framework. Every interpolated value passes through `escapeHtml` first.

Create `js/components/BasketDrawer.js` with:

```javascript
// Basket drawer UI. Subscribes to window 'basket:updated' and 'basket:open' events.
(function () {
    if (!window.Basket) {
        console.error('CartDrawer requires Basket.js to be loaded first');
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
                <aside class="basket-drawer" aria-hidden="true" data-basket-drawer>
                    <header class="basket-drawer-header">
                        <span class="basket-drawer-title">Cart</span>
                        <button type="button" class="basket-drawer-close" data-basket-close aria-label="Close cart">✕</button>
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
                if (target.matches('[data-line-inc]')) {
                    const qty = parseInt(target.dataset.qty, 10);
                    window.Basket.updateLine(variantId, qty + 1);
                } else if (target.matches('[data-line-dec]')) {
                    const qty = parseInt(target.dataset.qty, 10);
                    window.Basket.updateLine(variantId, qty - 1);
                } else if (target.matches('[data-line-remove]')) {
                    window.Basket.removeLine(variantId);
                }
            });
        }

        open() {
            this.drawer.classList.add('is-open');
            this.overlay.classList.add('is-open');
            this.drawer.setAttribute('aria-hidden', 'false');
            document.body.classList.add('basket-open');
        }

        close() {
            this.drawer.classList.remove('is-open');
            this.overlay.classList.remove('is-open');
            this.drawer.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('basket-open');
        }

        render(state) {
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
                                    <button type="button" data-line-dec data-qty="${line.quantity}" aria-label="Decrease">−</button>
                                    <span class="basket-qty-value">${line.quantity}</span>
                                    <button type="button" data-line-inc data-qty="${line.quantity}" aria-label="Increase">+</button>
                                </span>
                                <span class="basket-line-price">${escapeHtml(formatPrice(lineTotal, currency))}</span>
                            </div>
                            <button type="button" class="basket-line-remove" data-line-remove>Remove</button>
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
                <p class="basket-footer-note">Shipping & taxes calculated at checkout. Prices and stock confirmed at checkout.</p>
            `;
            const checkoutBtn = this.footer.querySelector('[data-basket-checkout]');
            checkoutBtn.addEventListener('click', () => {
                const url = window.Basket.getCheckoutUrl();
                if (url) window.location.href = url;
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => new CartDrawer());
})();
```

- [ ] **Step 3: Finalise `pages/shop.html`**

Edit `pages/shop.html` and replace the `<head>` and end-of-body script blocks so the new CSS + scripts load correctly:

```html
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FOTU - Shop</title>
    <link rel="stylesheet" href="../css/main.css" />
    <link rel="stylesheet" href="../css/shop.css" />
    <link rel="stylesheet" href="../css/basket.css" />
</head>
```

```html
<script src="../js/components/Navbar.js"></script>
<script src="../js/main.js"></script>
<script src="../js/components/Basket.js"></script>
<script src="../js/components/BasketDrawer.js"></script>
<script src="../js/components/ShopifyStore.js"></script>
```

- [ ] **Step 4: Verify in browser**

`npm run dev`, load `http://localhost:3000/pages/shop.html`, open devtools console:

```javascript
window.Basket.addLine({
    variantId: 'gid://shopify/ProductVariant/42178129',
    quantity: 1,
    title: 'Test Item',
    variantTitle: 'Medium',
    price: { amount: '60.00', currencyCode: 'GBP' },
    handle: 'test-item',
});
window.dispatchEvent(new CustomEvent('basket:open'));
```

Expected:
- Drawer slides in from the right with the line, qty controls, line price, subtotal £60.00, CHECKOUT button
- `+` increments qty; `−` decrements (removes the line when going below 1); REMOVE removes the line immediately
- Empty state shows "Your basket is empty" when no lines remain
- `Esc`, `✕`, and backdrop click all close the drawer
- Body scroll is locked while drawer is open
- Clicking CHECKOUT navigates to `https://kkixr1-uq.myshopify.com/cart/42178129:1` — Shopify's hosted checkout should load with the item (it may show an error for a fake variant id; that's fine — what we want is to see Shopify loading the URL)

Then clean up:

```javascript
window.Basket.clear();
```

- [ ] **Step 5: Commit**

```bash
git add css/basket.css js/components/BasketDrawer.js pages/shop.html
git commit -m "Add basket drawer UI rendering from localStorage cart state"
```

---

## Task 3: Add `BASKET (n)` to navbar

**Goal:** A new link at the end of the typewriter menu (desktop sidebar + homepage column + mobile overlay) that opens the drawer and reflects the cart's current total quantity.

**Files:**
- Modify: `js/components/Navbar.js`

- [ ] **Step 1: Add BASKET link to all three menu templates**

Edit `js/components/Navbar.js`. The `injectNavIntoTypewriter` method renders three `<nav class="typewriter-menu">` blocks: homepage column, sidebar on other pages, and mobile overlay. Each ends with this line:

```html
<a href="${paths.shop}" class="typewriter-link ${this.currentPage === "shop" ? "active" : ""}">SHOP</a>
```

In **all three** templates, immediately after that line, insert:

```html
<a href="#" class="typewriter-link" data-basket-link>BASKET</a>
```

- [ ] **Step 2: Add `bindCartLinks` method**

Inside the `Navbar` class, add this method directly above `init()`:

```javascript
bindCartLinks() {
    const links = document.querySelectorAll('[data-basket-link]');
    const refresh = (qty) => {
        const label = qty > 0 ? `BASKET (${qty})` : 'BASKET';
        links.forEach((a) => { a.textContent = label; });
    };
    links.forEach((a) => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('basket:open'));
            document.querySelector('.mobile-nav-overlay')?.classList.remove('active');
        });
    });
    window.addEventListener('basket:updated', (e) => refresh(e.detail.totalQuantity || 0));
    if (window.Basket) refresh(window.Basket.state.totalQuantity || 0);
}
```

- [ ] **Step 3: Wire `bindCartLinks` into `init()`**

Replace the existing `init()` method with:

```javascript
init() {
    const isHomepage =
      document.querySelector(".hero-fullscreen") &&
      !document.querySelector(".about-main");
    if (!isHomepage) {
      document.body.insertAdjacentHTML("beforeend", this.getFooterHTML());
    }
    this.injectNavIntoTypewriter();
    this.bindCartLinks();
}
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:3000/pages/shop.html`. Expected:
- The BASKET link appears at the bottom of the typewriter menu (under SHOP) styled like every other link
- Clicking CART opens the drawer
- After `window.Basket.addLine({...quantity: 2...})` in the console, the link reads `CART (2)`
- Clearing the cart returns the link to `BASKET`
- On mobile (devtools responsive mode), opening the mobile menu and tapping CART closes the menu overlay AND opens the drawer

- [ ] **Step 5: Commit**

```bash
git add js/components/Navbar.js
git commit -m "Add CART menu link to navbar that opens drawer and tracks count"
```

---

## Task 4: Product page — variant picker, qty stepper, Add to basket

**Goal:** Render variant pickers (when needed), a quantity stepper, and an ADD TO CART button on the product detail page. Clicking adds a snapshot of the selected variant to `window.Basket` and opens the drawer.

**Files:**
- Modify: `api/product.js` (add `options { name values }`)
- Modify: `server.js` (mirror addition)
- Modify: `pages/product.html`
- Modify: `js/components/ProductPage.js` (full rewrite)

- [ ] **Step 1: Add `options` to `api/product.js`**

Open `api/product.js`. Inside the GraphQL query string (the value of the `query` field in the request body), there's a block:

```
productByHandle(handle: "${handle}") {
    id
    title
    description
    descriptionHtml
    handle
    priceRange { ... }
    variants(first: 20) { ... }
    images(first: 10) { ... }
}
```

Add `options { name values }` after the `handle` field:

```
productByHandle(handle: "${handle}") {
    id
    title
    description
    descriptionHtml
    handle
    options { name values }
    priceRange {
        minVariantPrice { amount currencyCode }
    }
    variants(first: 20) { ... }
    images(first: 10) { ... }
}
```

(Leave the rest of `api/product.js` unchanged.)

- [ ] **Step 2: Same addition to `server.js`**

Open `server.js`. Locate the `handleProduct` function — it has the same GraphQL query string. Add the same `options { name values }` field in the same spot.

- [ ] **Step 3: Verify the API response includes `options`**

`npm run dev`. Pick any product handle from the shop grid (right-click a tile → inspect → href).

```bash
curl -s "http://localhost:3000/api/product?handle=<handle>" | python3 -m json.tool | head -30
```

Expected: `options` array near the top of the response, e.g. `"options": [{ "name": "Size", "values": ["S", "M", "L"] }]`. For a single-variant product it'll be something like `"options": [{ "name": "Title", "values": ["Default Title"] }]`.

- [ ] **Step 4: Update `pages/product.html`**

Replace the full contents of `pages/product.html` with:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FOTU - Product</title>
        <link rel="stylesheet" href="../css/main.css" />
        <link rel="stylesheet" href="../css/product.css" />
        <link rel="stylesheet" href="../css/basket.css" />
    </head>
    <body>
        <main class="product-main">
            <div class="product-layout">
                <div class="product-gallery">
                    <img class="product-image-main" id="productImage" src="" alt="" />
                </div>
                <div class="product-details">
                    <h1 class="product-title" id="productTitle"></h1>
                    <p class="product-price" id="productPrice"></p>
                    <div class="product-description" id="productDescription"></div>
                    <div class="product-options" id="productOptions"></div>
                    <div class="product-qty" id="productQty"></div>
                    <button class="product-add-to-basket" id="productAddToBasket" type="button" disabled>Add to basket</button>
                    <a class="product-back" href="shop.html">&larr; Back to shop</a>
                </div>
            </div>
        </main>

        <script src="../js/components/Navbar.js"></script>
        <script src="../js/main.js"></script>
        <script src="../js/components/Basket.js"></script>
        <script src="../js/components/BasketDrawer.js"></script>
        <script src="../js/components/ProductPage.js"></script>
    </body>
</html>
```

- [ ] **Step 5: Rewrite `js/components/ProductPage.js`**

Replace the full contents of `js/components/ProductPage.js` with:

```javascript
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
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode || 'GBP',
        }).format(num);
    }

    findVariant(options) {
        return this.variants.find((v) => {
            const map = Object.fromEntries((v.selectedOptions || []).map((o) => [o.name, o.value]));
            return Object.keys(options).every((k) => map[k] === options[k]);
        });
    }

    setSelectedOption(name, value) {
        this.selectedOptions[name] = value;
        const match = this.findVariant(this.selectedOptions);
        if (match) this.selectedVariant = match;
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
            return;
        }
        const currency = this.product.priceRange?.minVariantPrice?.currencyCode || 'GBP';
        priceEl.textContent = this.formatPrice(v.price, currency);
        if (!v.availableForSale) {
            btn.disabled = true;
            btn.textContent = 'Sold out';
        } else {
            btn.disabled = false;
            btn.textContent = 'Add to basket';
        }
    }

    bindAddToCart() {
        const btn = document.getElementById('productAddToBasket');
        btn.addEventListener('click', () => {
            if (!this.selectedVariant || !this.selectedVariant.availableForSale) return;
            const v = this.selectedVariant;
            const currency = this.product.priceRange?.minVariantPrice?.currencyCode || 'GBP';
            const image = this.product.images?.edges?.[0]?.node || null;
            window.Basket.addLine({
                variantId: v.id,
                quantity: this.qty,
                title: this.product.title,
                variantTitle: v.title,
                price: { amount: String(v.price), currencyCode: currency },
                image: image ? { url: image.url, altText: image.altText } : null,
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

        document.title = `FOTU - ${product.title}`;
        document.getElementById('productTitle').textContent = product.title;
        // Shopify-authored HTML content. Same trust model as before this change.
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
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ProductPage());
```

- [ ] **Step 6: Verify single-variant product**

From the shop page, click a product that has only one variant (most products if you haven't set up size variants in Shopify). Expected:
- No option pickers render (the `productOptions` container is empty)
- Quantity stepper shows `1`; `−` disabled at 1, `+` enabled up to 10
- Price reflects the variant
- ADD TO CART is enabled (assuming the variant is in stock)
- Click ADD TO CART → drawer opens with the line, navbar shows `CART (1)`, drawer shows correct title + price + thumbnail

- [ ] **Step 7: Verify multi-variant product (if available)**

If your store has a multi-variant product, navigate to it. Expected:
- One row per option (e.g. SIZE / COLOR), values rendered as buttons
- Initial selection is the first available variant; matching buttons highlighted
- Clicking a different value updates the price (if variants are priced differently)
- If the resulting variant is unavailable, ADD TO CART reads "Sold out" and is disabled
- Adding to cart stores the correct `variantId` (check `localStorage.getItem('fotu_basket')` in devtools)

If your catalogue has no multi-variant product, skip this step; the conditional render in `renderOptions()` exercises the multi-variant path when applicable.

- [ ] **Step 8: Commit**

```bash
git add api/product.js server.js pages/product.html js/components/ProductPage.js
git commit -m "Add variant picker, qty stepper, and Add to basket on product page"
```

---

## Task 5: Site-wide drawer integration

**Goal:** Load `Basket.js` + `BasketDrawer.js` + `basket.css` on every page that has the navbar so the BASKET link works everywhere.

**Files:**
- Modify: `index.html`
- Modify: `pages/about.html`
- Modify: `pages/digital-fabric.html`
- Modify: `pages/game.html`

- [ ] **Step 1: Update `index.html`**

In `index.html`, add `basket.css` to `<head>` after the existing stylesheets:

```html
<link rel="stylesheet" href="css/basket.css" />
```

In the script block at the bottom, after `<script src="js/components/Navbar.js"></script>`, add:

```html
<script src="js/components/Basket.js"></script>
<script src="js/components/BasketDrawer.js"></script>
```

- [ ] **Step 2: Update `pages/about.html`**

```html
<link rel="stylesheet" href="../css/basket.css" />
```

After the navbar script:

```html
<script src="../js/components/Basket.js"></script>
<script src="../js/components/BasketDrawer.js"></script>
```

- [ ] **Step 3: Update `pages/digital-fabric.html`**

Same pattern:

```html
<link rel="stylesheet" href="../css/basket.css" />
```

After the navbar script:

```html
<script src="../js/components/Basket.js"></script>
<script src="../js/components/BasketDrawer.js"></script>
```

- [ ] **Step 4: Update `pages/game.html`**

Same pattern:

```html
<link rel="stylesheet" href="../css/basket.css" />
```

After the navbar script:

```html
<script src="../js/components/Basket.js"></script>
<script src="../js/components/BasketDrawer.js"></script>
```

- [ ] **Step 5: Verify site-wide**

`npm run dev`. With at least one item in the cart (added via the product page), visit:
- `http://localhost:3000/` (home)
- `http://localhost:3000/pages/about.html`
- `http://localhost:3000/pages/digital-fabric.html`
- `http://localhost:3000/pages/game.html`

On every page:
- The BASKET link shows `BASKET (n)` matching the current cart count
- Clicking the link opens the drawer with the cart contents
- The drawer's CHECKOUT button redirects to a `kkixr1-uq.myshopify.com/cart/...` URL

- [ ] **Step 6: Commit**

```bash
git add index.html pages/about.html pages/digital-fabric.html pages/game.html
git commit -m "Load basket drawer site-wide so BASKET link works on every page"
```

---

## Task 6: End-to-end verification

**Goal:** Walk through the full purchase flow and confirm the permalink hands off correctly to Shopify checkout.

- [ ] **Step 1: Full flow in incognito**

Open an incognito window so `localStorage` is empty. Then:

1. `http://localhost:3000/pages/shop.html` — confirm grid renders
2. Click a product — confirm detail page renders
3. (If multi-variant) pick a non-default variant
4. Set qty to 2
5. Click ADD TO CART — drawer opens with the line, navbar shows `CART (2)`
6. Increment qty in the drawer to 3 — count updates, subtotal updates
7. Add a second product (different variant id) — drawer shows two lines
8. Navigate to `/pages/about.html` — `BASKET (n)` persists, drawer opens on click
9. Open drawer, click CHECKOUT — browser navigates to `https://kkixr1-uq.myshopify.com/cart/<id>:<qty>,<id>:<qty>`
10. Shopify hosted checkout loads with the correct items, quantities, and prices. (If a variant is sold out, Shopify will show an error here — that's the expected failure surface for the permalink approach.)
11. Close the Shopify tab without completing
12. Return to your site, reload — cart still shows the items (persisted in localStorage)
13. Use REMOVE in the drawer to empty the cart — drawer shows empty state, navbar returns to `BASKET`

- [ ] **Step 2: Verify `localStorage` persistence**

In devtools console:

```javascript
JSON.parse(localStorage.getItem('fotu_basket'))
```

Should be an array of line objects matching the drawer. Reload — same data. `Basket.clear()` should empty both the in-memory state and the localStorage entry.

- [ ] **Step 3: Confirm no dead Storefront API references**

```bash
grep -rn "Storefront\|cartCreate\|cartLinesAdd\|SHOPIFY_STOREFRONT" js/ api/ server.js
```

Expected: no matches in the cart-related code paths. (The spec doc mentions Storefront in the "Why this pivot" section; that's fine — it's historical context.)

- [ ] **Step 4: Final review**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

Skim the file list against the spec's "Files" section — every file expected to change should have changed; no surprise changes.

---

## Done

The shop now supports browsing, multi-item basket management via a slide-in drawer, and Shopify-hosted checkout via the permalink redirect. No new Shopify configuration was required.

**Out of scope reminder (intentional):** discount-code entry in our drawer, custom cart attributes, customer accounts / saved carts across devices, multi-currency, inventory polling, auto-clear after checkout. Add as separate follow-up plans if needed.
