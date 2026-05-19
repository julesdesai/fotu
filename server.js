const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

async function handleProducts(req, res) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;

    const tokenRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: SHOPIFY_CLIENT_ID,
            client_secret: SHOPIFY_CLIENT_SECRET,
        }),
    });
    if (!tokenRes.ok) {
        throw new Error(`Shopify token request failed: ${tokenRes.status}`);
    }
    const { access_token } = await tokenRes.json();

    const productsRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': access_token,
        },
        body: JSON.stringify({
            query: `{
                products(first: 250) {
                    edges {
                        node {
                            id
                            title
                            description
                            handle
                            status
                            priceRange {
                                minVariantPrice {
                                    amount
                                    currencyCode
                                }
                            }
                            variants(first: 1) {
                                edges {
                                    node {
                                        price
                                    }
                                }
                            }
                            images(first: 1) {
                                edges {
                                    node {
                                        url
                                        altText
                                    }
                                }
                            }
                        }
                    }
                }
            }`,
        }),
    });
    const { data } = await productsRes.json();
    const products = data.products.edges.map((e) => e.node);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(products));
}

async function handleProduct(req, res) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const handle = url.searchParams.get('handle');

    if (!handle) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing handle parameter' }));
        return;
    }

    const tokenRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: SHOPIFY_CLIENT_ID,
            client_secret: SHOPIFY_CLIENT_SECRET,
        }),
    });
    if (!tokenRes.ok) {
        throw new Error(`Shopify token request failed: ${tokenRes.status}`);
    }
    const { access_token } = await tokenRes.json();

    const productRes = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': access_token,
        },
        body: JSON.stringify({
            query: `query ProductByHandle($handle: String!) {
                productByHandle(handle: $handle) {
                    id
                    title
                    description
                    descriptionHtml
                    handle
                    options { name values }
                    priceRange {
                        minVariantPrice {
                            amount
                            currencyCode
                        }
                    }
                    variants(first: 20) {
                        edges {
                            node {
                                id
                                title
                                price
                                availableForSale
                                selectedOptions {
                                    name
                                    value
                                }
                                image {
                                    id
                                    url
                                    altText
                                }
                            }
                        }
                    }
                    images(first: 10) {
                        edges {
                            node {
                                url
                                altText
                            }
                        }
                    }
                }
            }`,
            variables: { handle },
        }),
    });
    const { data } = await productRes.json();

    if (!data.productByHandle) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Product not found' }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.productByHandle));
}

function serveStatic(req, res) {
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
}

const server = http.createServer(async (req, res) => {
    try {
        if (req.url === '/api/products') {
            await handleProducts(req, res);
        } else if (req.url.startsWith('/api/product?')) {
            await handleProduct(req, res);
        } else {
            serveStatic(req, res);
        }
    } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end('Server error');
    }
});

server.listen(PORT, () => {
    console.log(`Dev server running at http://localhost:${PORT}`);
    console.log(`Shop page at http://localhost:${PORT}/pages/shop.html`);
});
