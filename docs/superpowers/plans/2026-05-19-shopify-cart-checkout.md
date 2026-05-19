# Shopify Cart & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-item Shopify-backed cart drawer and hosted-checkout handoff to the FOTU shop, and migrate existing product fetches from the Admin API to the Storefront API in the process.

**Architecture:** Storefront API (server-proxied via `/api/*`) holds the cart and returns a `checkoutUrl`; client `Cart.js` singleton holds only the `cartId` in `localStorage` and emits `cart:updated` events that `CartDrawer.js` and `Navbar.js` subscribe to. Click "Checkout" → `window.location = checkoutUrl` → Shopify-hosted checkout takes over.

**Tech Stack:** Vanilla JavaScript (no framework), Node `http` for local dev (`server.js`), Vercel serverless functions (`api/*.js`), Shopify Storefront API GraphQL.

**Spec:** `docs/superpowers/specs/2026-05-19-shopify-cart-checkout-design.md`

**Testing approach:** No test framework exists in this repo. Verification is **manual** at the end of every task: `curl` for API endpoints, `npm run dev` + browser for UI. Each task ends with an explicit verification step and a commit. Do not skip the verification step.

**XSS hygiene:** All UI components that build HTML via template strings MUST escape Shopify-derived strings (titles, option names, variant labels, image alt text, URLs) before interpolation. An `escapeHtml` helper is included in both `CartDrawer.js` and `ProductPage.js`. The existing `productDescription` already uses `descriptionHtml` from Shopify and is rendered as HTML (pre-existing behaviour — Shopify-authored, trusted).

**Token setup (do this before starting Task 1):**
1. Shopify admin → Settings → Apps and sales channels → Develop apps → Create app named "FOTU Storefront"
2. Configure Storefront API integration → scopes: `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`, `unauthenticated_write_checkouts`, `unauthenticated_read_checkouts`
3. Install app → reveal Storefront API access token → copy
4. Edit `.env` (local) and add `SHOPIFY_STOREFRONT_TOKEN=<token>` alongside the existing `SHOPIFY_STORE_DOMAIN`
5. Add the same env var in Vercel project settings (so deploys see it)

---

## File Structure

**Create:**
- `js/components/Cart.js` — singleton cart state + API calls + event bus
- `js/components/CartDrawer.js` — drawer UI, listens to `cart:updated`
- `css/cart.css` — drawer + variant-picker + qty-stepper styles
- `api/cart.js` — Vercel handler for all cart operations (POST / PATCH / DELETE / GET)

**Modify:**
- `.env.example` — replace Admin OAuth creds with `SHOPIFY_STOREFRONT_TOKEN`
- `api/products.js` — switch to Storefront API, keep response shape
- `api/product.js` — switch to Storefront API, add `product.options` to response
- `server.js` — mirror all three API handlers against Storefront API; add cart handler
- `js/components/ProductPage.js` — variant picker, qty stepper, Add to cart wiring
- `pages/product.html` — picker / qty / button containers + Cart script/CSS loads
- `pages/shop.html` — Cart script/CSS loads
- `js/components/Navbar.js` — `CART (n)` menu item, drawer open + count refresh
- `index.html`, `pages/about.html`, `pages/digital-fabric.html`, `pages/game.html` — Cart script/CSS loads for site-wide drawer

`ShopifyStore.js` is **not** modified — the response-shaping in `api/products.js` keeps the existing client-facing shape intact.

---

## Task 1: Migrate `/api/products` to Storefront API

**Goal:** Replace the Admin API + OAuth client-credentials flow with a single Storefront API call. Keep the JSON response shape identical so `ShopifyStore.js` requires no functional change.

**Files:**
- Modify: `.env.example`
- Modify: `api/products.js` (full rewrite)
- Modify: `server.js` (`handleProducts` function, ~lines 25-86)

- [ ] **Step 1: Update `.env.example`**

Replace the full contents of `.env.example` with:

```
SHOPIFY_STORE_DOMAIN=kkixr1-uq.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=your_storefront_access_token_here
```

- [ ] **Step 2: Rewrite `api/products.js`**

Replace the full contents of `api/products.js` with:

```javascript
const STOREFRONT_API_VERSION = '2024-10';

async function fetchStorefront(query, variables) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN } = process.env;
    const res = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
            },
            body: JSON.stringify({ query, variables }),
        }
    );
    if (!res.ok) {
        throw new Error(`Storefront API ${res.status}`);
    }
    const body = await res.json();
    if (body.errors) {
        throw new Error(`Storefront GraphQL: ${JSON.stringify(body.errors)}`);
    }
    return body.data;
}

const PRODUCTS_QUERY = `{
    products(first: 50) {
        edges {
            node {
                id
                title
                description
                handle
                priceRange {
                    minVariantPrice { amount currencyCode }
                }
                variants(first: 1) {
                    edges { node { price { amount currencyCode } } }
                }
                images(first: 1) {
                    edges { node { url altText } }
                }
            }
        }
    }
}`;

export default async function handler(req, res) {
    try {
        const data = await fetchStorefront(PRODUCTS_QUERY);
        // Reshape so client sees the same flat `variants[].node.price` string it had under Admin API
        const products = data.products.edges.map((e) => {
            const node = e.node;
            return {
                ...node,
                variants: {
                    edges: node.variants.edges.map((v) => ({
                        node: { price: v.node.price.amount },
                    })),
                },
            };
        });
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(products);
    } catch (err) {
        console.error('Storefront products error:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
}
```

- [ ] **Step 3: Update `server.js` `handleProducts`**

Replace the entire `handleProducts` function (lines 25-86) in `server.js` with:

```javascript
const STOREFRONT_API_VERSION = '2024-10';

async function fetchStorefront(query, variables) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN } = process.env;
    const res = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
            },
            body: JSON.stringify({ query, variables }),
        }
    );
    if (!res.ok) throw new Error(`Storefront API ${res.status}`);
    const body = await res.json();
    if (body.errors) throw new Error(`Storefront GraphQL: ${JSON.stringify(body.errors)}`);
    return body.data;
}

async function handleProducts(req, res) {
    const query = `{
        products(first: 50) {
            edges {
                node {
                    id
                    title
                    description
                    handle
                    priceRange {
                        minVariantPrice { amount currencyCode }
                    }
                    variants(first: 1) {
                        edges { node { price { amount currencyCode } } }
                    }
                    images(first: 1) {
                        edges { node { url altText } }
                    }
                }
            }
        }
    }`;
    const data = await fetchStorefront(query);
    const products = data.products.edges.map((e) => {
        const node = e.node;
        return {
            ...node,
            variants: {
                edges: node.variants.edges.map((v) => ({
                    node: { price: v.node.price.amount },
                })),
            },
        };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(products));
}
```

`fetchStorefront` will be reused by `handleProduct` and `handleCart` in later tasks — leave it where it is.

- [ ] **Step 4: Verify locally**

Start the dev server:

```bash
npm run dev
```

In another terminal:

```bash
curl -s http://localhost:3000/api/products | head -c 600
```

Expected: JSON array of products. Each item has `title`, `handle`, `priceRange.minVariantPrice.amount`, `variants.edges[0].node.price` (string), `images.edges[0].node.url`.

Then load `http://localhost:3000/pages/shop.html` in a browser. Expected: the shop grid renders with the same products, prices, and images as before.

- [ ] **Step 5: Commit**

```bash
git add .env.example api/products.js server.js
git commit -m "Migrate /api/products to Shopify Storefront API"
```

---

## Task 2: Migrate `/api/product` to Storefront API

**Goal:** Same migration for the single-product endpoint, plus add `product.options { name, values }` to the response so the variant picker has what it needs in Task 7.

**Files:**
- Modify: `api/product.js` (full rewrite)
- Modify: `server.js` (`handleProduct` function)

- [ ] **Step 1: Rewrite `api/product.js`**

Replace the full contents of `api/product.js` with:

```javascript
const STOREFRONT_API_VERSION = '2024-10';

async function fetchStorefront(query, variables) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN } = process.env;
    const res = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
            },
            body: JSON.stringify({ query, variables }),
        }
    );
    if (!res.ok) throw new Error(`Storefront API ${res.status}`);
    const body = await res.json();
    if (body.errors) throw new Error(`Storefront GraphQL: ${JSON.stringify(body.errors)}`);
    return body.data;
}

const PRODUCT_QUERY = `query Product($handle: String!) {
    product(handle: $handle) {
        id
        title
        description
        descriptionHtml
        handle
        options { name values }
        priceRange {
            minVariantPrice { amount currencyCode }
        }
        variants(first: 100) {
            edges {
                node {
                    id
                    title
                    availableForSale
                    price { amount currencyCode }
                    selectedOptions { name value }
                }
            }
        }
        images(first: 10) {
            edges { node { url altText } }
        }
    }
}`;

export default async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const handle = url.searchParams.get('handle');
    if (!handle) {
        res.status(400).json({ error: 'Missing handle parameter' });
        return;
    }
    try {
        const data = await fetchStorefront(PRODUCT_QUERY, { handle });
        if (!data.product) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        // Reshape variants so the existing client receives `price` as a string,
        // matching the prior Admin API contract. Keep new fields (`options`) on the product.
        const product = {
            ...data.product,
            variants: {
                edges: data.product.variants.edges.map((v) => ({
                    node: {
                        ...v.node,
                        price: v.node.price.amount,
                    },
                })),
            },
        };
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(product);
    } catch (err) {
        console.error('Storefront product error:', err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
}
```

- [ ] **Step 2: Update `server.js` `handleProduct`**

Replace the entire `handleProduct` function in `server.js` with:

```javascript
async function handleProduct(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const handle = url.searchParams.get('handle');
    if (!handle) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing handle parameter' }));
        return;
    }
    const query = `query Product($handle: String!) {
        product(handle: $handle) {
            id
            title
            description
            descriptionHtml
            handle
            options { name values }
            priceRange {
                minVariantPrice { amount currencyCode }
            }
            variants(first: 100) {
                edges {
                    node {
                        id
                        title
                        availableForSale
                        price { amount currencyCode }
                        selectedOptions { name value }
                    }
                }
            }
            images(first: 10) {
                edges { node { url altText } }
            }
        }
    }`;
    const data = await fetchStorefront(query, { handle });
    if (!data.product) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Product not found' }));
        return;
    }
    const product = {
        ...data.product,
        variants: {
            edges: data.product.variants.edges.map((v) => ({
                node: { ...v.node, price: v.node.price.amount },
            })),
        },
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(product));
}
```

- [ ] **Step 3: Verify locally**

Pick any product handle from the shop grid (right-click a tile → inspect → look at the `href`). Then:

```bash
curl -s "http://localhost:3000/api/product?handle=<handle>" | python3 -m json.tool | head -60
```

Expected: JSON with `title`, `description`, `options` (array of `{ name, values }`), `variants.edges[].node` containing `id`, `title`, `availableForSale`, `price` (string), `selectedOptions`.

Then load `http://localhost:3000/pages/product.html?handle=<handle>` in a browser. Expected: product title, price, description, and image all render as before.

- [ ] **Step 4: Commit**

```bash
git add api/product.js server.js
git commit -m "Migrate /api/product to Storefront API, expose product options"
```

---

## Task 3: Add `/api/cart` endpoint

**Goal:** A single endpoint that dispatches by HTTP method to `cartCreate`, `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`, and `cart(id:)`. Same JSON shape on every successful response.

**Files:**
- Create: `api/cart.js`
- Modify: `server.js` (add `handleCart` function + route dispatch)

- [ ] **Step 1: Create `api/cart.js`**

Create `api/cart.js` with:

```javascript
const STOREFRONT_API_VERSION = '2024-10';

async function fetchStorefront(query, variables) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN } = process.env;
    const res = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
            },
            body: JSON.stringify({ query, variables }),
        }
    );
    if (!res.ok) throw new Error(`Storefront API ${res.status}`);
    const body = await res.json();
    if (body.errors) throw new Error(`Storefront GraphQL: ${JSON.stringify(body.errors)}`);
    return body.data;
}

const CART_FIELDS = `
    id
    checkoutUrl
    totalQuantity
    cost {
        subtotalAmount { amount currencyCode }
    }
    lines(first: 100) {
        edges {
            node {
                id
                quantity
                merchandise {
                    ... on ProductVariant {
                        id
                        title
                        availableForSale
                        price { amount currencyCode }
                        image { url altText }
                        product { title handle }
                    }
                }
            }
        }
    }
`;

function shapeCart(cart) {
    if (!cart) return null;
    return {
        id: cart.id,
        checkoutUrl: cart.checkoutUrl,
        totalQuantity: cart.totalQuantity,
        cost: cart.cost,
        lines: cart.lines.edges.map((e) => ({
            id: e.node.id,
            quantity: e.node.quantity,
            merchandise: e.node.merchandise,
        })),
    };
}

async function getCart(id) {
    const data = await fetchStorefront(
        `query Cart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
        { id }
    );
    return data.cart;
}

async function createCart(lines) {
    const data = await fetchStorefront(
        `mutation CartCreate($lines: [CartLineInput!]) {
            cartCreate(input: { lines: $lines }) {
                cart { ${CART_FIELDS} }
                userErrors { field message code }
            }
        }`,
        { lines }
    );
    return data.cartCreate;
}

async function addLines(cartId, lines) {
    const data = await fetchStorefront(
        `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
            cartLinesAdd(cartId: $cartId, lines: $lines) {
                cart { ${CART_FIELDS} }
                userErrors { field message code }
            }
        }`,
        { cartId, lines }
    );
    return data.cartLinesAdd;
}

async function updateLine(cartId, lineId, quantity) {
    const data = await fetchStorefront(
        `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
            cartLinesUpdate(cartId: $cartId, lines: $lines) {
                cart { ${CART_FIELDS} }
                userErrors { field message code }
            }
        }`,
        { cartId, lines: [{ id: lineId, quantity }] }
    );
    return data.cartLinesUpdate;
}

async function removeLine(cartId, lineId) {
    const data = await fetchStorefront(
        `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
            cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                cart { ${CART_FIELDS} }
                userErrors { field message code }
            }
        }`,
        { cartId, lineIds: [lineId] }
    );
    return data.cartLinesRemove;
}

function sendError(res, status, message, code) {
    res.status(status).json(code ? { error: message, code } : { error: message });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        if (req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id');
            if (!id) return sendError(res, 400, 'Missing id parameter');
            const cart = await getCart(id);
            if (!cart) return sendError(res, 404, 'Cart not found', 'CART_NOT_FOUND');
            return res.status(200).json(shapeCart(cart));
        }

        if (req.method === 'POST') {
            const { cartId, lines } = req.body || {};
            if (!Array.isArray(lines) || lines.length === 0) {
                return sendError(res, 400, 'Missing lines');
            }
            const result = cartId ? await addLines(cartId, lines) : await createCart(lines);
            if (result.userErrors && result.userErrors.length) {
                const ue = result.userErrors[0];
                const code = ue.code === 'NOT_ENOUGH_IN_STOCK' ? 'OUT_OF_STOCK' : undefined;
                return sendError(res, 422, ue.message, code);
            }
            return res.status(200).json(shapeCart(result.cart));
        }

        if (req.method === 'PATCH') {
            const { cartId, lineId, quantity } = req.body || {};
            if (!cartId || !lineId || typeof quantity !== 'number') {
                return sendError(res, 400, 'Missing cartId, lineId, or quantity');
            }
            const result = await updateLine(cartId, lineId, quantity);
            if (result.userErrors && result.userErrors.length) {
                return sendError(res, 422, result.userErrors[0].message);
            }
            return res.status(200).json(shapeCart(result.cart));
        }

        if (req.method === 'DELETE') {
            const { cartId, lineId } = req.body || {};
            if (!cartId || !lineId) return sendError(res, 400, 'Missing cartId or lineId');
            const result = await removeLine(cartId, lineId);
            if (result.userErrors && result.userErrors.length) {
                return sendError(res, 422, result.userErrors[0].message);
            }
            return res.status(200).json(shapeCart(result.cart));
        }

        sendError(res, 405, 'Method not allowed');
    } catch (err) {
        console.error('Cart API error:', err);
        sendError(res, 500, 'Cart operation failed');
    }
}
```

Note on `req.body`: on Vercel Node functions `req.body` is automatically parsed when `Content-Type: application/json`. The local `server.js` uses raw `http` so we'll parse JSON manually there (next step).

- [ ] **Step 2: Add `handleCart` to `server.js`**

Add the following inside `server.js`, after the existing `handleProduct` function (and before `serveStatic`):

```javascript
const CART_FIELDS = `
    id
    checkoutUrl
    totalQuantity
    cost {
        subtotalAmount { amount currencyCode }
    }
    lines(first: 100) {
        edges {
            node {
                id
                quantity
                merchandise {
                    ... on ProductVariant {
                        id
                        title
                        availableForSale
                        price { amount currencyCode }
                        image { url altText }
                        product { title handle }
                    }
                }
            }
        }
    }
`;

function shapeCart(cart) {
    if (!cart) return null;
    return {
        id: cart.id,
        checkoutUrl: cart.checkoutUrl,
        totalQuantity: cart.totalQuantity,
        cost: cart.cost,
        lines: cart.lines.edges.map((e) => ({
            id: e.node.id,
            quantity: e.node.quantity,
            merchandise: e.node.merchandise,
        })),
    };
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            if (!data) return resolve({});
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

async function handleCart(req, res) {
    const method = req.method;

    if (method === 'GET') {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const id = url.searchParams.get('id');
        if (!id) return sendJson(res, 400, { error: 'Missing id parameter' });
        const data = await fetchStorefront(
            `query Cart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
            { id }
        );
        if (!data.cart) return sendJson(res, 404, { error: 'Cart not found', code: 'CART_NOT_FOUND' });
        return sendJson(res, 200, shapeCart(data.cart));
    }

    const body = await readJsonBody(req);

    if (method === 'POST') {
        const { cartId, lines } = body;
        if (!Array.isArray(lines) || lines.length === 0) {
            return sendJson(res, 400, { error: 'Missing lines' });
        }
        const mutation = cartId
            ? `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
                   cartLinesAdd(cartId: $cartId, lines: $lines) {
                       cart { ${CART_FIELDS} }
                       userErrors { field message code }
                   }
               }`
            : `mutation($lines: [CartLineInput!]) {
                   cartCreate(input: { lines: $lines }) {
                       cart { ${CART_FIELDS} }
                       userErrors { field message code }
                   }
               }`;
        const variables = cartId ? { cartId, lines } : { lines };
        const data = await fetchStorefront(mutation, variables);
        const result = cartId ? data.cartLinesAdd : data.cartCreate;
        if (result.userErrors && result.userErrors.length) {
            const ue = result.userErrors[0];
            const code = ue.code === 'NOT_ENOUGH_IN_STOCK' ? 'OUT_OF_STOCK' : undefined;
            return sendJson(res, 422, code ? { error: ue.message, code } : { error: ue.message });
        }
        return sendJson(res, 200, shapeCart(result.cart));
    }

    if (method === 'PATCH') {
        const { cartId, lineId, quantity } = body;
        if (!cartId || !lineId || typeof quantity !== 'number') {
            return sendJson(res, 400, { error: 'Missing cartId, lineId, or quantity' });
        }
        const data = await fetchStorefront(
            `mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
                cartLinesUpdate(cartId: $cartId, lines: $lines) {
                    cart { ${CART_FIELDS} }
                    userErrors { field message code }
                }
            }`,
            { cartId, lines: [{ id: lineId, quantity }] }
        );
        const result = data.cartLinesUpdate;
        if (result.userErrors && result.userErrors.length) {
            return sendJson(res, 422, { error: result.userErrors[0].message });
        }
        return sendJson(res, 200, shapeCart(result.cart));
    }

    if (method === 'DELETE') {
        const { cartId, lineId } = body;
        if (!cartId || !lineId) return sendJson(res, 400, { error: 'Missing cartId or lineId' });
        const data = await fetchStorefront(
            `mutation($cartId: ID!, $lineIds: [ID!]!) {
                cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                    cart { ${CART_FIELDS} }
                    userErrors { field message code }
                }
            }`,
            { cartId, lineIds: [lineId] }
        );
        const result = data.cartLinesRemove;
        if (result.userErrors && result.userErrors.length) {
            return sendJson(res, 422, { error: result.userErrors[0].message });
        }
        return sendJson(res, 200, shapeCart(result.cart));
    }

    sendJson(res, 405, { error: 'Method not allowed' });
}
```

- [ ] **Step 3: Route `/api/cart` in `server.js`**

In `server.js`, find the request dispatcher near the bottom (`if (req.url === '/api/products')` etc.) and update it to:

```javascript
const server = http.createServer(async (req, res) => {
    try {
        const pathname = req.url.split('?')[0];
        if (pathname === '/api/products') {
            await handleProducts(req, res);
        } else if (pathname === '/api/product') {
            await handleProduct(req, res);
        } else if (pathname === '/api/cart') {
            await handleCart(req, res);
        } else {
            serveStatic(req, res);
        }
    } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end('Server error');
    }
});
```

(This also fixes a small existing inconsistency where `/api/product` was matched with `startsWith('/api/product?')`.)

- [ ] **Step 4: Verify with curl**

Start the dev server:

```bash
npm run dev
```

Get a variant ID by hitting the product endpoint for some handle, e.g.:

```bash
curl -s "http://localhost:3000/api/product?handle=<handle>" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['variants']['edges'][0]['node']['id'])"
```

Use that ID (call it `$VID`) to create a cart:

```bash
curl -s -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"lines":[{"merchandiseId":"<VID>","quantity":1}]}' | python3 -m json.tool
```

Expected output structure:
```
{
  "id": "gid://shopify/Cart/...",
  "checkoutUrl": "https://...myshopify.com/cart/c/...",
  "totalQuantity": 1,
  "cost": { "subtotalAmount": { "amount": "...", "currencyCode": "GBP" } },
  "lines": [ { "id": "gid://shopify/CartLine/...", "quantity": 1, "merchandise": { "id": "...", "title": "...", "price": {...}, "image": {...}, "product": {...} } } ]
}
```

Capture the cart `id` and line `id`, then test PATCH (update qty to 2), GET, and DELETE in the same way. Each should return the full cart shape; DELETE leaves `lines: []`.

Visit the `checkoutUrl` from the POST response in a browser — Shopify's hosted checkout should load with the right item.

- [ ] **Step 5: Commit**

```bash
git add api/cart.js server.js
git commit -m "Add /api/cart endpoint backed by Shopify Storefront cart mutations"
```

---

## Task 4: Build `Cart.js` singleton

**Goal:** A single in-page `Cart` instance that owns cart state, makes API calls, persists `cartId` in `localStorage`, and broadcasts `cart:updated` events. UI components subscribe to it; they never call the API directly.

**Files:**
- Create: `js/components/Cart.js`

- [ ] **Step 1: Create `js/components/Cart.js`**

Create `js/components/Cart.js` with:

```javascript
// Cart singleton: owns cart state, talks to /api/cart, broadcasts changes.
// Other components MUST go through `window.Cart`, not call /api/cart directly.
(function () {
    const STORAGE_KEY = 'fotu_cart_id';
    const EVENT_NAME = 'cart:updated';

    class Cart {
        constructor() {
            this.state = { id: null, lines: [], totalQuantity: 0, cost: null, checkoutUrl: null };
            this.error = null;
            this.loading = false;
            this._init();
        }

        async _init() {
            const storedId = localStorage.getItem(STORAGE_KEY);
            if (!storedId) {
                this._emit();
                return;
            }
            try {
                const cart = await this._fetch(`/api/cart?id=${encodeURIComponent(storedId)}`);
                this._setState(cart);
            } catch (err) {
                if (err.code === 'CART_NOT_FOUND') {
                    localStorage.removeItem(STORAGE_KEY);
                    this._setState({ id: null, lines: [], totalQuantity: 0, cost: null, checkoutUrl: null });
                } else {
                    this.error = err.message;
                    this._emit();
                }
            }
        }

        async _fetch(url, options = {}) {
            const res = await fetch(url, options);
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                const err = new Error(body.error || `HTTP ${res.status}`);
                err.code = body.code;
                err.status = res.status;
                throw err;
            }
            return body;
        }

        _setState(cart) {
            this.state = {
                id: cart.id || null,
                lines: cart.lines || [],
                totalQuantity: cart.totalQuantity || 0,
                cost: cart.cost || null,
                checkoutUrl: cart.checkoutUrl || null,
            };
            if (cart.id) localStorage.setItem(STORAGE_KEY, cart.id);
            this.error = null;
            this.loading = false;
            this._emit();
        }

        _emit() {
            window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: this.state }));
        }

        _setLoading(loading) {
            this.loading = loading;
            this._emit();
        }

        async addLine(variantId, quantity = 1) {
            this._setLoading(true);
            try {
                const body = {
                    lines: [{ merchandiseId: variantId, quantity }],
                };
                if (this.state.id) body.cartId = this.state.id;
                const cart = await this._fetch('/api/cart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                this._setState(cart);
                return cart;
            } catch (err) {
                // Retry once if the cart is stale
                if (err.code === 'CART_NOT_FOUND' && this.state.id) {
                    localStorage.removeItem(STORAGE_KEY);
                    this.state.id = null;
                    return this.addLine(variantId, quantity);
                }
                this.error = err.message;
                this._setLoading(false);
                throw err;
            }
        }

        async updateLine(lineId, quantity) {
            if (!this.state.id) return;
            this._setLoading(true);
            try {
                const cart = await this._fetch('/api/cart', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cartId: this.state.id, lineId, quantity }),
                });
                this._setState(cart);
            } catch (err) {
                this.error = err.message;
                this._setLoading(false);
                throw err;
            }
        }

        async removeLine(lineId) {
            if (!this.state.id) return;
            this._setLoading(true);
            try {
                const cart = await this._fetch('/api/cart', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cartId: this.state.id, lineId }),
                });
                this._setState(cart);
            } catch (err) {
                this.error = err.message;
                this._setLoading(false);
                throw err;
            }
        }

        openDrawer() {
            window.dispatchEvent(new CustomEvent('cart:open'));
        }
    }

    window.Cart = new Cart();
})();
```

- [ ] **Step 2: Verify in browser console**

Add a temporary script tag to `pages/shop.html` BEFORE `ShopifyStore.js`:

```html
<script src="../js/components/Cart.js"></script>
```

(This will be made permanent in Task 5 — for now we're just smoke-testing.)

Restart `npm run dev`, load `http://localhost:3000/pages/shop.html`, open devtools console. Run:

```javascript
window.Cart.state          // → { id: null, lines: [], totalQuantity: 0, ... }
window.addEventListener('cart:updated', e => console.log('updated', e.detail));
await window.Cart.addLine('<VID from Task 3>', 1);
window.Cart.state          // → cart with one line, totalQuantity: 1
localStorage.getItem('fotu_cart_id');  // → "gid://shopify/Cart/..."
```

Reload the page. `window.Cart.state` should still have the line (loaded from server via the stored id).

```javascript
await window.Cart.updateLine(window.Cart.state.lines[0].id, 3);
await window.Cart.removeLine(window.Cart.state.lines[0].id);
window.Cart.state.totalQuantity   // → 0
```

- [ ] **Step 3: Commit**

```bash
git add js/components/Cart.js pages/shop.html
git commit -m "Add Cart singleton for client-side state and /api/cart calls"
```

---

## Task 5: Build cart drawer UI

**Goal:** A slide-in right drawer that lists cart lines with qty/remove controls, shows subtotal, and exposes a CHECKOUT button. Driven entirely by `cart:updated` events from Task 4. Opens on `cart:open` events (dispatched by `Cart.openDrawer()` and by Navbar in Task 6).

**Files:**
- Create: `css/cart.css`
- Create: `js/components/CartDrawer.js`
- Modify: `pages/shop.html` (finalise script/CSS loads)

- [ ] **Step 1: Create `css/cart.css`**

Create `css/cart.css` with:

```css
/* Cart drawer overlay + panel */
.cart-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0);
    z-index: 998;
    pointer-events: none;
    transition: background 0.25s ease;
}

.cart-overlay.is-open {
    background: rgba(0, 0, 0, 0.25);
    pointer-events: auto;
}

.cart-drawer {
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

.cart-drawer.is-open {
    transform: translateX(0);
}

.cart-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
}

.cart-drawer-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.cart-drawer-close {
    background: none;
    border: none;
    font-family: "Courier New", monospace;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 8px;
}

.cart-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
}

.cart-drawer.is-loading .cart-line {
    opacity: 0.5;
    pointer-events: none;
}

.cart-empty {
    text-align: center;
    padding: var(--spacing-2xl) var(--spacing-md);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.cart-line {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--border-color);
}

.cart-line-image {
    width: 60px;
    height: 80px;
    object-fit: cover;
    background: var(--bg-gray);
    display: block;
}

.cart-line-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.cart-line-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dark);
    text-decoration: none;
}

.cart-line-variant {
    font-size: 10px;
    font-weight: 400;
    color: var(--text-muted);
}

.cart-line-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
}

.cart-qty {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border-color);
}

.cart-qty button {
    background: none;
    border: none;
    width: 26px;
    height: 26px;
    font-family: "Courier New", monospace;
    font-size: 13px;
    cursor: pointer;
}

.cart-qty button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.cart-qty-value {
    min-width: 24px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
}

.cart-line-price {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
}

.cart-line-remove {
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

.cart-line-remove:hover {
    color: var(--text-dark);
}

.cart-drawer-footer {
    border-top: 1px solid var(--border-color);
    padding: var(--spacing-md);
}

.cart-subtotal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.cart-subtotal-amount {
    font-size: 13px;
}

.cart-checkout-button {
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

.cart-checkout-button:hover { opacity: 0.85; }
.cart-checkout-button:disabled { opacity: 0.4; cursor: not-allowed; }

.cart-footer-note {
    text-align: center;
    font-size: 9px;
    color: var(--text-muted);
    margin-top: var(--spacing-sm);
    text-transform: lowercase;
    letter-spacing: 0.05em;
}

.cart-error {
    color: #b00020;
    font-size: 10px;
    margin-bottom: var(--spacing-sm);
    text-align: center;
}

body.cart-open { overflow: hidden; }

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

.product-add-to-cart {
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

.product-add-to-cart:hover { opacity: 0.85; }
.product-add-to-cart:disabled { opacity: 0.4; cursor: not-allowed; }

.product-add-error {
    color: #b00020;
    font-size: 10px;
    font-family: "Courier New", monospace;
    margin-bottom: var(--spacing-md);
}

@media (max-width: 600px) {
    .cart-drawer { width: 100%; border-left: none; }
}
```

- [ ] **Step 2: Create `js/components/CartDrawer.js`**

Note: this file uses `innerHTML` to render line items because it's the only practical way to do template-style rendering in vanilla JS without a framework. Every interpolated value passes through `escapeHtml` first — keep that discipline if you edit the templates.

Create `js/components/CartDrawer.js` with:

```javascript
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

    // Escape all Shopify-derived strings before interpolating into HTML templates.
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
                const lineId = target.closest('[data-line-id]')?.dataset.lineId;
                if (!lineId) return;
                if (target.matches('[data-line-inc]')) {
                    const qty = parseInt(target.dataset.qty, 10);
                    window.Cart.updateLine(lineId, qty + 1).catch(() => {});
                } else if (target.matches('[data-line-dec]')) {
                    const qty = parseInt(target.dataset.qty, 10);
                    if (qty > 1) {
                        window.Cart.updateLine(lineId, qty - 1).catch(() => {});
                    } else {
                        window.Cart.removeLine(lineId).catch(() => {});
                    }
                } else if (target.matches('[data-line-remove]')) {
                    window.Cart.removeLine(lineId).catch(() => {});
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
            this.drawer.classList.toggle('is-loading', window.Cart.loading);

            if (!state.lines || state.lines.length === 0) {
                this.body.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
                this.footer.innerHTML = '';
                return;
            }

            this.body.innerHTML = state.lines.map((line) => {
                const v = line.merchandise || {};
                const variantTitle = v.title && v.title !== 'Default Title' ? v.title : '';
                const lineTotal = parseFloat(v.price?.amount || '0') * line.quantity;
                const currency = v.price?.currencyCode || 'GBP';
                const productHref = v.product?.handle
                    ? `product.html?handle=${encodeURIComponent(v.product.handle)}`
                    : '#';
                return `
                    <div class="cart-line" data-line-id="${escapeHtml(line.id)}">
                        ${v.image ? `<img class="cart-line-image" src="${escapeHtml(v.image.url)}" alt="${escapeHtml(v.image.altText || v.product?.title || '')}" />` : '<div class="cart-line-image"></div>'}
                        <div class="cart-line-info">
                            <a class="cart-line-title" href="${escapeHtml(productHref)}">${escapeHtml(v.product?.title || '')}</a>
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

            const subtotal = state.cost?.subtotalAmount;
            this.footer.innerHTML = `
                ${window.Cart.error ? `<div class="cart-error">${escapeHtml(window.Cart.error)}</div>` : ''}
                <div class="cart-subtotal-row">
                    <span>Subtotal</span>
                    <span class="cart-subtotal-amount">${subtotal ? escapeHtml(formatPrice(subtotal.amount, subtotal.currencyCode)) : ''}</span>
                </div>
                <button type="button" class="cart-checkout-button" data-cart-checkout ${state.checkoutUrl ? '' : 'disabled'}>Checkout</button>
                <p class="cart-footer-note">Shipping & taxes calculated at checkout</p>
            `;
            const checkoutBtn = this.footer.querySelector('[data-cart-checkout]');
            if (checkoutBtn) {
                checkoutBtn.addEventListener('click', () => {
                    if (state.checkoutUrl) window.location.href = state.checkoutUrl;
                });
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => new CartDrawer());
})();
```

- [ ] **Step 3: Wire into `pages/shop.html`**

Edit `pages/shop.html` and replace the `<head>` and end-of-body block so the new CSS + scripts are loaded:

```html
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FOTU - Shop</title>
    <link rel="stylesheet" href="../css/main.css" />
    <link rel="stylesheet" href="../css/shop.css" />
    <link rel="stylesheet" href="../css/cart.css" />
</head>
```

```html
<script src="../js/components/Navbar.js"></script>
<script src="../js/main.js"></script>
<script src="../js/components/Cart.js"></script>
<script src="../js/components/CartDrawer.js"></script>
<script src="../js/components/ShopifyStore.js"></script>
```

- [ ] **Step 4: Verify in browser**

`npm run dev`, load `http://localhost:3000/pages/shop.html`, open devtools console. Run:

```javascript
await window.Cart.addLine('<VID>', 1);
window.dispatchEvent(new CustomEvent('cart:open'));
```

Expected:
- Drawer slides in from the right with the line item, qty controls, line price, subtotal, and CHECKOUT button
- Clicking `+` increments qty; `−` decrements (and removes when going below 1); REMOVE removes the line
- Empty state shows "YOUR CART IS EMPTY" when no lines remain
- `Esc`, the `✕` button, and backdrop click all close the drawer
- Body scroll is locked while drawer is open
- Clicking CHECKOUT navigates to `cart.shopify.com/c/...` (or `<store>.myshopify.com/cart/c/...` depending on Shopify's host)

- [ ] **Step 5: Commit**

```bash
git add css/cart.css js/components/CartDrawer.js pages/shop.html
git commit -m "Add cart drawer UI with line controls and Shopify checkout handoff"
```

---

## Task 6: Add `CART (n)` to navbar

**Goal:** A new link at the end of the typewriter menu (desktop sidebar + mobile overlay) that opens the drawer and reflects the cart's current `totalQuantity`.

**Files:**
- Modify: `js/components/Navbar.js`

- [ ] **Step 1: Add CART link to all three menu templates**

Edit `js/components/Navbar.js`. The `injectNavIntoTypewriter` method renders three `<nav class="typewriter-menu">` blocks: one for the homepage column, one for the sidebar on other pages, and one inside the mobile overlay. Each ends with this line:

```html
<a href="${paths.shop}" class="typewriter-link ${this.currentPage === "shop" ? "active" : ""}">SHOP</a>
```

In **all three** templates, immediately after that line, insert:

```html
<a href="#" class="typewriter-link" data-cart-link>CART</a>
```

- [ ] **Step 2: Add `bindCartLinks` method**

Inside the `Navbar` class, add this method directly above `init()`:

```javascript
bindCartLinks() {
    const links = document.querySelectorAll('[data-cart-link]');
    const refresh = (qty) => {
        const label = qty > 0 ? `CART (${qty})` : 'CART';
        links.forEach((a) => { a.textContent = label; });
    };
    links.forEach((a) => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('cart:open'));
            document.querySelector('.mobile-nav-overlay')?.classList.remove('active');
        });
    });
    window.addEventListener('cart:updated', (e) => refresh(e.detail.totalQuantity || 0));
    if (window.Cart) refresh(window.Cart.state.totalQuantity || 0);
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
- The CART link appears at the bottom of the typewriter menu (under SHOP) styled like every other link
- Clicking CART opens the drawer
- After running `await window.Cart.addLine('<VID>', 2);` in the console, the link reads `CART (2)`; after removing the line, back to `CART`
- On mobile (devtools responsive mode), opening the menu and tapping CART closes the menu overlay and opens the drawer

- [ ] **Step 5: Commit**

```bash
git add js/components/Navbar.js
git commit -m "Add CART menu link to navbar that opens drawer and tracks count"
```

---

## Task 7: Product page — variant picker, qty stepper, Add to cart

**Goal:** Render variant pickers (only when needed), a quantity stepper, and an ADD TO CART button on the product detail page. Clicking adds the selected variant to the cart and opens the drawer.

**Files:**
- Modify: `pages/product.html`
- Modify: `js/components/ProductPage.js` (full rewrite)

- [ ] **Step 1: Update `pages/product.html`**

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
        <link rel="stylesheet" href="../css/cart.css" />
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
                    <p class="product-add-error" id="productAddError" hidden></p>
                    <button class="product-add-to-cart" id="productAddToCart" type="button" disabled>Add to cart</button>
                    <a class="product-back" href="shop.html">&larr; Back to shop</a>
                </div>
            </div>
        </main>

        <script src="../js/components/Navbar.js"></script>
        <script src="../js/main.js"></script>
        <script src="../js/components/Cart.js"></script>
        <script src="../js/components/CartDrawer.js"></script>
        <script src="../js/components/ProductPage.js"></script>
    </body>
</html>
```

- [ ] **Step 2: Rewrite `js/components/ProductPage.js`**

Note: this file uses `innerHTML` to render variant pickers because templating in vanilla JS without a framework leaves few good alternatives. Every Shopify-derived string (option names, values, description-html-fallback text) passes through `escapeHtml` first. The `productDescription` block keeps the pre-existing behaviour of rendering Shopify's `descriptionHtml` as HTML (Shopify-authored content, trusted by definition).

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
            const map = Object.fromEntries(v.selectedOptions.map((o) => [o.name, o.value]));
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
        const btn = document.getElementById('productAddToCart');
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
            btn.textContent = 'Add to cart';
        }
    }

    bindAddToCart() {
        const btn = document.getElementById('productAddToCart');
        const errEl = document.getElementById('productAddError');
        btn.addEventListener('click', async () => {
            if (!this.selectedVariant) return;
            errEl.hidden = true;
            btn.disabled = true;
            btn.textContent = 'Adding...';
            try {
                await window.Cart.addLine(this.selectedVariant.id, this.qty);
                window.dispatchEvent(new CustomEvent('cart:open'));
            } catch (err) {
                errEl.textContent = err.message || 'Could not add to cart';
                errEl.hidden = false;
            } finally {
                this.renderPriceAndButton();
            }
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

- [ ] **Step 3: Verify in browser — single-variant product**

`npm run dev`. From the shop page, click a product that has only one variant. Expected:
- No option pickers render (the `productOptions` container is empty)
- The Quantity stepper shows `1`; `−` is disabled at 1, `+` enabled up to 10
- The price reflects the single variant
- Clicking ADD TO CART changes the button to "Adding...", then the drawer opens with the line, the navbar count updates, and the button returns to "Add to cart"

- [ ] **Step 4: Verify in browser — multi-variant product**

If your store has a multi-variant product, navigate to it. Expected:
- One row per option (e.g. SIZE / COLOR), values rendered as buttons
- The initial selection is the first available variant; the matching buttons are highlighted
- Clicking a different value updates the price (if variants are priced differently) and the selected variant
- If the resulting variant is unavailable, the ADD TO CART button reads "Sold out" and is disabled
- Adding to cart sends the correct variant id (check the request body in devtools Network tab)

If your store has no multi-variant product, you can skip the multi-variant verification and rely on the single-variant path. The picker code path is exercised by the conditional render in `renderOptions()`.

- [ ] **Step 5: Commit**

```bash
git add pages/product.html js/components/ProductPage.js
git commit -m "Add variant picker, qty stepper, and Add to cart on product page"
```

---

## Task 8: Site-wide drawer integration

**Goal:** Load `Cart.js` + `CartDrawer.js` + `cart.css` on every page that has the navbar so the CART link works everywhere, not just the shop and product pages.

**Files:**
- Modify: `index.html`
- Modify: `pages/about.html`
- Modify: `pages/digital-fabric.html`
- Modify: `pages/game.html`

- [ ] **Step 1: Update `index.html`**

In `index.html`, add `cart.css` to `<head>` after the existing stylesheets:

```html
<link rel="stylesheet" href="css/cart.css" />
```

In the script block at the bottom, after `<script src="js/components/Navbar.js"></script>`, add:

```html
<script src="js/components/Cart.js"></script>
<script src="js/components/CartDrawer.js"></script>
```

- [ ] **Step 2: Update `pages/about.html`**

In `pages/about.html`, add to `<head>`:

```html
<link rel="stylesheet" href="../css/cart.css" />
```

After `<script src="../js/components/Navbar.js"></script>`, add:

```html
<script src="../js/components/Cart.js"></script>
<script src="../js/components/CartDrawer.js"></script>
```

- [ ] **Step 3: Update `pages/digital-fabric.html`**

Same pattern as `pages/about.html`:

```html
<link rel="stylesheet" href="../css/cart.css" />
```

After the navbar script:

```html
<script src="../js/components/Cart.js"></script>
<script src="../js/components/CartDrawer.js"></script>
```

- [ ] **Step 4: Update `pages/game.html`**

Same pattern:

```html
<link rel="stylesheet" href="../css/cart.css" />
```

After the navbar script:

```html
<script src="../js/components/Cart.js"></script>
<script src="../js/components/CartDrawer.js"></script>
```

- [ ] **Step 5: Verify site-wide**

`npm run dev`. With at least one item in the cart (use Task 5/7 to add one), visit each of:
- `http://localhost:3000/` (home)
- `http://localhost:3000/pages/about.html`
- `http://localhost:3000/pages/digital-fabric.html`
- `http://localhost:3000/pages/game.html`

On every page:
- The CART link shows `CART (n)` matching the current cart count
- Clicking the link opens the drawer with the cart contents
- The drawer's CHECKOUT button still redirects to Shopify

- [ ] **Step 6: Commit**

```bash
git add index.html pages/about.html pages/digital-fabric.html pages/game.html
git commit -m "Load cart drawer site-wide so CART link works on every page"
```

---

## Task 9: End-to-end verification + cleanup

**Goal:** Walk through the full purchase flow as a customer would, then remove any dead code or commented-out fragments left over from the migration.

- [ ] **Step 1: Full purchase flow in incognito**

Open an incognito window so `localStorage` is empty. Then:

1. `http://localhost:3000/pages/shop.html` — confirm grid renders
2. Click a product — confirm detail page renders, options/qty/button visible
3. (If multi-variant) pick a non-default variant
4. Set qty to 2
5. Click ADD TO CART — drawer opens with the line, navbar shows `CART (2)`
6. Increment qty in the drawer to 3 — count updates, subtotal updates
7. Navigate to `/pages/about.html` — `CART (3)` persists, drawer opens on click
8. Open drawer, click CHECKOUT — Shopify hosted checkout loads with the right item + quantity
9. Close the Shopify tab without completing
10. Return to your site, reload — cart still shows `CART (3)` (loaded from server via stored cart id)
11. Remove the line in the drawer — count returns to `CART`, drawer shows empty state

- [ ] **Step 2: Stale-cart recovery**

In devtools console:

```javascript
localStorage.setItem('fotu_cart_id', 'gid://shopify/Cart/does-not-exist');
location.reload();
```

Expected: page loads cleanly, `window.Cart.state.id` is `null`, `localStorage.fotu_cart_id` is gone (the singleton detected `CART_NOT_FOUND` and cleared it). Adding to cart now creates a fresh cart.

- [ ] **Step 3: Scan for leftover Admin API references**

```bash
grep -rn "admin/oauth\|admin/api\|SHOPIFY_CLIENT_ID\|SHOPIFY_CLIENT_SECRET" api/ server.js .env.example
```

Expected: no matches. If any remain, remove them.

- [ ] **Step 4: Update local `.env`**

Edit `.env` (not tracked) to remove `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` and confirm `SHOPIFY_STOREFRONT_TOKEN` is set. Restart `npm run dev` and re-run the flow from Step 1 to make sure nothing relied on the old vars.

- [ ] **Step 5: Final review of changed files**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

Skim the file list against the spec's "Files" section — every file expected to change should have changed; no surprise changes.

- [ ] **Step 6: Commit any cleanup**

If any dead code was removed in Step 3:

```bash
git add -u
git commit -m "Remove leftover Admin API references after Storefront migration"
```

(Otherwise no commit needed.)

---

## Done

The shop now supports browsing, multi-item cart management, and Shopify-hosted checkout, with all Shopify communication going through the Storefront API.

**Out of scope reminder (intentional):** discount-code entry in our drawer, custom cart attributes, customer accounts / saved carts across devices, multi-currency, inventory polling beyond `availableForSale` at fetch time. Add as separate follow-up plans if needed.
