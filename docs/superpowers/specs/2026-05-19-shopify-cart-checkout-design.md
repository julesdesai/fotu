# Shopify Cart & Checkout — Design

**Date:** 2026-05-19
**Status:** Approved (v2 — pivoted from Storefront API cart to cart permalinks; see "Why this pivot" below)

## Goal

Add a multi-item cart and checkout flow to the FOTU shop. We do not write any payment or basket infrastructure ourselves. Products live in Shopify; we hand off checkout to Shopify's hosted checkout.

## Why this pivot

The original design relied on the Shopify **Storefront API** `cart` mutation. Getting a Storefront API access token on this store turned out to be blocked:

- The store is on **Shopify Starter**, which excludes the Headless sales channel.
- Shopify has retired the legacy "Develop apps" UI on this store; the only path is the new **Dev Dashboard**, whose generated OAuth tokens don't directly authenticate against the Storefront API.
- Minting a Storefront token via the `storefrontAccessTokenCreate` Admin API mutation requires a `write_storefronts`-class scope that isn't surfaced in the Dev Dashboard scope picker for Starter accounts.

So we pivot to **Shopify cart permalinks**: redirect the buyer to `https://<shop>.myshopify.com/cart/<variantId>:<qty>,...`, and Shopify's hosted checkout builds the cart and handles the rest. No new tokens, no new API endpoints, no cart object on Shopify side until the redirect. Cart state lives entirely in the browser.

The original v1 of this spec is in git history at the commit immediately before the v2 rewrite, if we ever need to revisit (e.g. moving off Starter).

## Decisions

1. **Basket shape:** multi-item basket on the site (drawer UI), not single-item "Buy Now".
2. **Checkout mechanism:** Shopify cart permalink redirect. Build a URL like `https://kkixr1-uq.myshopify.com/cart/42178129:2,42178131:1` from the variant IDs and quantities in the local cart, then `window.location.href = url`. Shopify hosted checkout takes over.
3. **Cart state:** lives entirely client-side in `localStorage`. We store a denormalised snapshot of each line (variant id, qty, plus cached product/variant info for rendering) so the drawer renders without any network call.
4. **No API changes for cart.** The existing `/api/products` and `/api/product` endpoints keep their current Admin-API-backed implementation. We add **one field** (`product.options { name values }`) to the `/api/product` GraphQL query so the variant picker can render cleanly. That's the only server-side change.
5. **Drawer UI** (not a dedicated `/cart` page): slide-in from the right, opens automatically on add-to-cart.
6. **Variant picker** rendered conditionally — only when a product has option values with cardinality > 1.

## Tradeoffs (intentional)

Compared to the Storefront API approach, the permalink approach gives up:

- **Stale prices** in the drawer if a product's price changes after items are added (cached client-side). Shopify's checkout always shows the current price, so the customer pays correctly — just a small UX mismatch.
- **Out-of-stock surprises** if a variant goes out of stock between add-time and checkout. The customer learns at the Shopify checkout step rather than in our drawer.
- **Automatic discounts / volume pricing** configured in Shopify won't show in our drawer's subtotal. They still apply at checkout.

All three are low-risk for a small-catalogue artisan brand with stable pricing and no automatic discount stacking. Accepted.

## Architecture

### Shopify side

- No new Shopify configuration. The existing custom-app credentials (`SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`) keep powering product fetches via Admin API client-credentials grant. No new tokens.
- The variant IDs returned by the existing GraphQL query include the full `gid://shopify/ProductVariant/<number>` form. The permalink format requires just `<number>`, which we extract with a regex/split.

### Server proxy (`/api/*`)

Unchanged except for one additive query field:

| Endpoint | Method | Purpose | Change |
|---|---|---|---|
| `/api/products` | GET | List products for shop grid | none |
| `/api/product?handle=` | GET | Single product for detail page | add `options { name values }` to GraphQL query so the variant picker can render grouped option values without inferring from `selectedOptions` |

### Client state — `Basket.js`

- Singleton, initialised once per page (loaded via a shared script tag on every page that includes the navbar)
- Persisted state: full cart array in `localStorage` under key `fotu_basket`
- Schema (per line):
  ```json
  {
    "variantId": "gid://shopify/ProductVariant/42178129",
    "quantity": 2,
    "title": "Slime Mould Dress",
    "variantTitle": "Medium / Black",
    "price": { "amount": "60.00", "currencyCode": "GBP" },
    "image": { "url": "...", "altText": "..." },
    "handle": "slime-mould-dress"
  }
  ```
  `variantTitle` is omitted when Shopify returns `"Default Title"` (single-variant products).
- Events: emits `cart:updated` whenever state changes; `BasketDrawer` and `Navbar` subscribe to re-render
- All operations are synchronous (no `await`, no fetch). The drawer can react instantly.
- Public methods:
  - `addLine(snapshot)` — accepts the full snapshot object (the product page builds it after the user selects a variant + qty). Merges with an existing line if `variantId` matches (sums quantities).
  - `updateLine(variantId, quantity)` — sets a line's qty; removes the line if `quantity <= 0`.
  - `removeLine(variantId)` — removes the line entirely.
  - `clear()` — empties the cart.
  - `getCheckoutUrl()` — returns `https://<SHOP_DOMAIN>/cart/<num>:<qty>,<num>:<qty>` built from the current lines.
  - `openDrawer()` — dispatches `basket:open`.
- Edge cases:
  - Quantity capped at 1–10 per line (drawer + product page both enforce; defence-in-depth).
  - `SHOP_DOMAIN` is hard-coded in the file (it's not secret; same value sits in `.env.example`).

### Checkout handoff

- "Checkout" button → `window.location.href = Basket.getCheckoutUrl()`.
- Shopify's hosted checkout reads the permalink, creates a cart server-side, redirects the buyer through address / shipping / payment.
- On the Shopify "thank you" page, the customer can navigate back to our site. We do not clear the cart on our side automatically — there's no reliable signal that the order completed (no return URL with confirmation). Users who want to clear the cart can use the drawer's REMOVE links. (Acceptable for now; a follow-up could add a "Continue shopping" button that clears.)

## UI components

### Navbar (`js/components/Navbar.js`)

- Adds `BASKET (n)` link as the last item in desktop typewriter menu and mobile overlay, styled with `.typewriter-link`
- Count comes from `Basket` state's total quantity; when 0, link reads `BASKET` (no parenthetical)
- Click opens the drawer rather than navigating
- Subscribes to `basket:updated` to refresh count

### Basket drawer (`js/components/BasketDrawer.js` + `css/basket.css`)

- Injected into `<body>` on every page (alongside `Navbar`)
- Hidden off-canvas right; opens via slide-in transform + backdrop fade
- Structure:
  - **Header:** `BASKET` title + `✕` close button (typewriter aesthetic)
  - **Line list (scrollable):** thumbnail (60px), product title (links to product page), variant title (greyed; omitted when single-variant), `− qty +` stepper, line price, `REMOVE` text link
  - **Footer (sticky):** `SUBTOTAL £120.00` row computed client-side from cached line prices, full-width `CHECKOUT` button (typewriter-styled), small note: "Shipping & taxes calculated at checkout. Prices and stock confirmed at checkout."
- Empty state: centred "YOUR BASKET IS EMPTY"
- Close behaviours: `✕` button, backdrop click, `Esc` key
- Body scroll-locked while drawer open

### Product page (`js/components/ProductPage.js` + `pages/product.html`)

After the description block, render:

- **Variant pickers** — only when `product.options.length > 0` AND any option has `values.length > 1`
  - One row per option (`SIZE`, `COLOR`, etc.) — option name as small-caps label, values as text buttons/chips matching the typewriter aesthetic
  - Selecting values updates a tracked `{ optionName: value }` map → resolves to a variant by matching `selectedOptions`
  - Default selection: first variant where `availableForSale === true`; fall back to first variant
- **Quantity stepper** — `−  1  +`, capped at 1–10
- **`ADD TO CART` button** — full-width, typewriter-styled
  - Disabled with label `SOLD OUT` when the resolved variant's `availableForSale === false`
  - On click: builds a cart-line snapshot from the selected variant + product + qty, calls `Basket.addLine(snapshot)`, opens the drawer
  - No async failure path (no network call), so no inline error needed beyond ordinary form validation

## User flow

1. User on shop grid → clicks product
2. Product page renders; user picks variant + quantity; clicks ADD TO CART
3. `Basket.addLine()` mutates localStorage + fires `cart:updated`
4. Drawer auto-opens with the new line; navbar count ticks up
5. User can edit quantities / remove lines or close the drawer and keep shopping
6. CHECKOUT button → `window.location.href = Basket.getCheckoutUrl()` → Shopify hosted checkout
7. Shopify validates the cart, customer pays, gets confirmation. We're done.

## Files

### Create

- `js/components/Basket.js` — singleton localStorage cart + event bus + permalink builder
- `js/components/BasketDrawer.js` — drawer UI, listens to `cart:updated`
- `css/basket.css` — drawer styles, variant picker styles, qty stepper styles

### Modify

- `api/product.js` — add `options { name values }` to the GraphQL query (single line change)
- `server.js` — same one-line addition in the mirror GraphQL query
- `js/components/Navbar.js` — add `BASKET (n)` to desktop + mobile menus, wire to drawer open + `cart:updated`
- `js/components/ProductPage.js` — variant picker rendering, qty stepper, Add-to-cart wiring
- `pages/product.html` — add `<link>` for `basket.css`, containers for variant pickers / qty / button, Cart/CartDrawer script loads
- `pages/shop.html` — `basket.css` + Cart/CartDrawer script loads
- `index.html`, `pages/about.html`, `pages/digital-fabric.html`, `pages/game.html` — same `basket.css` + Cart/CartDrawer script loads so the cart link works site-wide

### Not touched (intentionally)

- `api/products.js`, `api/cart.js` (cart endpoint not built — no Storefront API, no cart proxy)
- `.env.example`, `.env` (no new env vars)
- `js/components/ShopifyStore.js` (response shape unchanged)

## Out of scope (this iteration)

- Discount code entry in our drawer (Shopify checkout handles it)
- Cart line attributes / custom notes (could be passed via permalink query string in a later iteration)
- Server-side cart hydration / SSR (fully client-driven)
- Multi-currency / locale switching
- Inventory polling beyond `availableForSale` at fetch time
- Saved carts across devices / customer accounts
- Auto-clearing the cart after a successful Shopify checkout (no reliable return signal)
