# Shopify Cart & Checkout — Design

**Date:** 2026-05-19
**Status:** Approved (pending spec review)

## Goal

Add a multi-item cart and checkout flow to the FOTU shop. We do not write any payment or basket infrastructure ourselves. Products live in Shopify; we hand off checkout to Shopify's hosted checkout.

## Decisions

1. **Cart shape:** multi-item cart on the site (drawer UI), not single-item "Buy Now".
2. **Checkout mechanism:** Shopify Storefront API `cart` mutation. Cart object lives on Shopify; we hold only the `cartId` in `localStorage`. Click "Checkout" → redirect to the `checkoutUrl` Shopify returns.
3. **API migration:** all existing Admin API calls migrate to Storefront API. Single API, single token, consistent across product fetch + cart.
4. **Token handling:** Storefront token stays server-side and is proxied through our existing `/api/*` endpoints. The token is technically safe to expose to the browser, but proxying keeps the architecture uniform with the current setup and gives us a place for caching/rate-limit handling.
5. **Drawer UI** (not a dedicated `/cart` page): slide-in from the right, opens automatically on add-to-cart.
6. **Variant picker** rendered conditionally — only when a product has option values with cardinality > 1.

## Architecture

### Shopify side

- Single API: Storefront API for products and cart
- New env var: `SHOPIFY_STOREFRONT_TOKEN`
- Old `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` (Admin OAuth client-credentials flow) become unused and are removed from `.env.example`
- One-time Shopify setup (performed by user):
  1. Shopify admin → Settings → Apps and sales channels → Develop apps → Create app
  2. Configure Storefront API access with scopes:
     - `unauthenticated_read_product_listings`
     - `unauthenticated_read_product_inventory`
     - `unauthenticated_write_checkouts`
     - `unauthenticated_read_checkouts`
  3. Install app → copy Storefront API access token → set as `SHOPIFY_STOREFRONT_TOKEN` in `.env` and Vercel env
  4. Revoke Admin OAuth credentials after migration is verified

### Server proxy (`/api/*`)

All Shopify calls remain server-side. Three endpoints, mirrored in both `api/*.js` (Vercel) and `server.js` (local dev).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/products` | GET | List products for shop grid (unchanged consumer shape) |
| `/api/product?handle=` | GET | Single product for detail page; includes `product.options` for picker |
| `/api/cart` | POST | Create cart (if no `cartId`) or add lines (if `cartId` given) |
| `/api/cart` | PATCH | Update line quantity |
| `/api/cart` | DELETE | Remove a line |
| `/api/cart?id=` | GET | Fetch existing cart by id |

### Client state — `Cart.js`

- Singleton, initialised once per page (loaded via shared script tag on every page that includes the navbar)
- Persisted state: `localStorage.fotu_cart_id` — the only thing stored locally
- In-memory state: full cart object (lines, totals, checkoutUrl), mutated **only** by API responses — Shopify is the single source of truth
- Events: emits `cart:updated` whenever state changes; `CartDrawer` and `Navbar` subscribe to re-render
- Init flow:
  - If `cartId` exists in localStorage → `GET /api/cart?id=...`
  - On 404 (`code: CART_NOT_FOUND`) → drop the stale id; do not create a new cart yet (lazy-create on first add-to-cart)
- Errors surface inline in the drawer; never silently swallowed
- Public methods: `addLine(variantId, qty)`, `updateLine(lineId, qty)`, `removeLine(lineId)`, `openDrawer()`

## API contracts

### Shared cart response shape

Used by every `/api/cart` response (and the body of any cart endpoint that returns data):

```json
{
  "id": "gid://shopify/Cart/...",
  "checkoutUrl": "https://shop.myshopify.com/cart/c/...",
  "totalQuantity": 3,
  "cost": {
    "subtotalAmount": { "amount": "120.00", "currencyCode": "GBP" }
  },
  "lines": [
    {
      "id": "gid://shopify/CartLine/...",
      "quantity": 2,
      "merchandise": {
        "id": "gid://shopify/ProductVariant/...",
        "title": "Medium / Black",
        "price": { "amount": "60.00", "currencyCode": "GBP" },
        "image": { "url": "...", "altText": "..." },
        "product": { "title": "...", "handle": "..." }
      }
    }
  ]
}
```

### Cart endpoints

| Method | Body / query | Maps to Shopify | Notes |
|---|---|---|---|
| `POST /api/cart` | `{ cartId?, lines: [{ merchandiseId, quantity }] }` | `cartCreate` if no `cartId`, else `cartLinesAdd` | Returns full cart |
| `PATCH /api/cart` | `{ cartId, lineId, quantity }` | `cartLinesUpdate` | Returns full cart |
| `DELETE /api/cart` | `{ cartId, lineId }` | `cartLinesRemove` | Returns full cart |
| `GET /api/cart?id=...` | — | `cart(id:)` query | Returns full cart, or 404 |

### Error contract

Non-2xx responses return:

```json
{ "error": "Human readable message", "code": "CART_NOT_FOUND" }
```

`code` values:

- `CART_NOT_FOUND` — stale `cartId`; client drops local id and treats next operation as a fresh `cartCreate`
- `OUT_OF_STOCK` — variant unavailable; client surfaces message in drawer/product page
- (unspecified) — generic failure; client shows inline error and keeps state

### Product endpoints

- `/api/products` rewritten against Storefront `products(first: 50)`. Response shape kept identical to the current Admin-API shape so `ShopifyStore.js` does not need to change beyond verifying field paths.
- `/api/product?handle=` rewritten against Storefront `product(handle:)`. Adds `product.options { name, values }` to the response so the variant picker can render cleanly.

## UI components

### Navbar (`js/components/Navbar.js`)

- Adds `CART (n)` link as the last item in both desktop typewriter menu and mobile overlay, styled with `.typewriter-link`
- Count comes from `Cart` state; when 0, link reads `CART` (no parenthetical)
- Click opens the drawer rather than navigating
- Subscribes to `cart:updated` to refresh count

### Cart drawer (`js/components/CartDrawer.js` + `css/cart.css`)

- Injected into `<body>` on every page (alongside `Navbar`)
- Hidden off-canvas right; opens via slide-in transform + backdrop fade
- Structure:
  - **Header:** `CART` title + `✕` close button (typewriter aesthetic)
  - **Line list (scrollable):** thumbnail (60px), product title (links to product page), variant title (greyed; omitted when `"Default Title"`), `− qty +` stepper, line price, `REMOVE` text link
  - **Footer (sticky):** `SUBTOTAL  £120.00` row, full-width `CHECKOUT` button (typewriter-styled), small note "Shipping & taxes calculated at checkout"
- Empty state: centred "YOUR CART IS EMPTY"
- Loading state during mutation: lines fade to 50% opacity, controls disabled
- Error state: inline message below footer; drawer remains usable
- Close behaviours: `✕` button, backdrop click, `Esc` key
- Body scroll-locked while drawer open

### Product page (`js/components/ProductPage.js` + `pages/product.html`)

After the description block, render:

- **Variant pickers** — only when `product.options.length > 0` AND any option has `values.length > 1`
  - One row per option (e.g. `SIZE`, `COLOR`) — option name as small-caps label, values as text buttons/chips matching the typewriter aesthetic (border, hover/active states)
  - Selecting values updates a tracked `{ optionName: value }` map → resolves to a `variantId` by matching `selectedOptions`
  - Default selection: first variant where `availableForSale === true`; fall back to first variant
- **Quantity stepper** — `−  1  +`, capped at 1–10
- **`ADD TO CART` button** — full-width, typewriter-styled
  - Disabled with label `SOLD OUT` when the resolved variant has `availableForSale === false`
  - On success: opens the drawer (signals state change without an extra toast)
  - On failure: inline error below button

## User flow

1. User on shop grid → clicks product
2. Product page renders; user picks variant + quantity; clicks ADD TO CART
3. `Cart.addLine()` calls `POST /api/cart` (creates cart on first add, otherwise adds line) → updates in-memory state → fires `cart:updated`
4. Drawer auto-opens with the new line; navbar count ticks up
5. User can edit quantities / remove lines (each fires PATCH / DELETE) or close the drawer and keep shopping
6. CHECKOUT button → `window.location.href = cart.checkoutUrl`
7. Shopify hosts address / shipping / payment / confirmation. We do nothing on return.

## Files

### Create

- `js/components/Cart.js` — singleton state + API calls + event bus
- `js/components/CartDrawer.js` — drawer UI, listens to `cart:updated`
- `css/cart.css` — drawer styles, variant picker styles, qty stepper styles
- `api/cart.js` — single Vercel handler dispatching on method

### Modify

- `api/products.js` — rewrite against Storefront API; preserve response shape for client
- `api/product.js` — rewrite against Storefront API; return `product.options`
- `server.js` — mirror all three API handlers (products, product, cart) against Storefront API
- `js/components/Navbar.js` — add `CART (n)` to desktop + mobile menus, wire to drawer open + `cart:updated`
- `js/components/ProductPage.js` — variant picker rendering, qty stepper, add-to-cart wiring
- `pages/product.html` — add `<link>` for `cart.css`, containers for variant pickers / qty / button, Cart/CartDrawer script loads
- `pages/shop.html` — `cart.css` + Cart/CartDrawer script loads
- `index.html`, `pages/about.html`, `pages/digital-fabric.html`, `pages/game.html` — same `cart.css` + Cart/CartDrawer script loads so the cart link works site-wide
- `.env.example` — replace `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` with `SHOPIFY_STOREFRONT_TOKEN`
- `js/components/ShopifyStore.js` — verify image / price field paths against new Storefront response (likely no functional change)

## Out of scope (this iteration)

- Discount code entry in our drawer (Shopify checkout handles it)
- Cart line attributes / custom notes
- Server-side cart hydration / SSR (fully client-driven)
- Multi-currency / locale switching
- Inventory polling beyond `availableForSale` at fetch time
- Saved carts across devices / customer accounts
