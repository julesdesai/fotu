export default async function handler(req, res) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } =
        process.env;

    try {
        // Step 1: Get a fresh Admin API token via client credentials
        const tokenRes = await fetch(
            `https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: SHOPIFY_CLIENT_ID,
                    client_secret: SHOPIFY_CLIENT_SECRET,
                }),
            }
        );

        if (!tokenRes.ok) {
            throw new Error(`Token request failed: ${tokenRes.status}`);
        }

        const { access_token } = await tokenRes.json();

        // Step 2: Fetch products from Admin API
        const productsRes = await fetch(
            `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`,
            {
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
            }
        );

        if (!productsRes.ok) {
            throw new Error(`Products request failed: ${productsRes.status}`);
        }

        const { data } = await productsRes.json();
        const products = data.products.edges.map((e) => e.node);

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(products);
    } catch (err) {
        console.error('Shopify API error:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
}
