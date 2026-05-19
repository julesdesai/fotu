export default async function handler(req, res) {
    const { SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } =
        process.env;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const handle = url.searchParams.get('handle');

    if (!handle) {
        res.status(400).json({ error: 'Missing handle parameter' });
        return;
    }

    try {
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

        const productRes = await fetch(
            `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': access_token,
                },
                body: JSON.stringify({
                    query: `{
                        productByHandle(handle: "${handle}") {
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
                }),
            }
        );

        if (!productRes.ok) {
            throw new Error(`Product request failed: ${productRes.status}`);
        }

        const { data } = await productRes.json();

        if (!data.productByHandle) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).json(data.productByHandle);
    } catch (err) {
        console.error('Shopify API error:', err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
}
