
import { JWT } from 'google-auth-library';
import { GoogleAuth } from 'google-auth-library';

export interface Env {
	NOREVA_CACHE: KVNamespace;
	GOOGLE_SERVICE_ACCOUNT_JSON: string;
	SHEET_ID: string;
	APPS_SCRIPT_URL: string;
	SHARED_SECRET: string;
}

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: CORS_HEADERS });
		}

		const url = new URL(request.url);

		try {
			// === GET /products ===
			if (request.method === 'GET' && url.pathname === '/products') {
				// 1. Try Cache
				const cached = await env.NOREVA_CACHE.get('products_data');
				if (cached) {
					// SWR: Check age? For now just return. Trigger background update if stale?
					// User said "SWR... Return KV immediately if exists. Fetch Sheets in background if stale (>5min)"
					// KV doesn't give timestamp easily unless stored in value.
					// We'll store { timestamp, data }.
					const parsed = JSON.parse(cached);
					const age = Date.now() - (parsed.timestamp || 0);
					if (age > 5 * 60 * 1000) {
						ctx.waitUntil(updateCache(env));
					}
					return new Response(JSON.stringify(parsed.data), {
						headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
					});
				}

				// 2. Fetch Fresh
				const freshData = await updateCache(env);
				return new Response(JSON.stringify(freshData), {
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
				});
			}

			// === POST /update-cache ===
			if (request.method === 'POST' && url.pathname === '/update-cache') {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${env.SHARED_SECRET}`) {
					return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
				}
				await updateCache(env);
				return new Response(JSON.stringify({ status: 'Refreshed' }), { headers: CORS_HEADERS });
			}

			// === POST /auth/login (Guardrail) ===
			if (request.method === 'POST' && url.pathname === '/auth/login') {
				const body = await request.json() as any;
				const { email, name, phone } = body;

				// Fetch Customers Sheet
				const customers = await fetchSheetData(env, 'Customers');
				// Headers: assumed [ID, Name, Phone, Email, ...]
				// Find by Email
				const existing = customers.find((row: any[]) => row[3] === email); // Adjust index based on sheet
				if (existing) {
					return new Response(JSON.stringify({ status: 'ok', customer: formatCustomer(existing) }), { headers: CORS_HEADERS });
				}

				// Fuzzy Match
				const conflict = customers.find((row: any[]) =>
					(name && row[1] && row[1].toString().toLowerCase() === name.toLowerCase()) ||
					(phone && row[2] && row[2].toString().replace(/\D/g, '') === phone.replace(/\D/g, ''))
				);

				if (conflict) {
					return new Response(JSON.stringify({
						status: 'conflict',
						possibleMatch: { name: conflict[1], region: conflict[4] || 'Unknown' } // Adjust index
					}), { status: 409, headers: CORS_HEADERS });
				}

				return new Response(JSON.stringify({ status: 'new' }), { headers: CORS_HEADERS });
			}

			// === POST /orders ===
			if (request.method === 'POST' && url.pathname === '/orders') {
				const body = await request.json();

				// Proxy to Apps Script
				const response = await fetch(env.APPS_SCRIPT_URL, {
					method: 'POST',
					body: JSON.stringify(body),
					headers: { 'Content-Type': 'application/json' }
				});

				const result = await response.json() as any;

				// Forward errors like 'out_of_stock'
				if (result.result === 'error') {
					return new Response(JSON.stringify(result), { status: 400, headers: CORS_HEADERS });
				}

				return new Response(JSON.stringify(result), { headers: CORS_HEADERS });
			}

			return new Response('Not Found', { status: 404, headers: CORS_HEADERS });

		} catch (err: any) {
			return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
		}
	},
};

async function updateCache(env: Env) {
	const products = await fetchSheetData(env, "Noreva's products");
	// Transform
	// Columns: Category, Product Name, Product Code, Size, Description (Arabic), Price (LYD), Expiry Date, Inventory, Pick URL
	// Index:   0         1             2             3     4                     5            6            7          8

	// Skip header
	const rows = products.slice(1);

	const transformed = rows.map((row: any[]) => ({
		id: row[2], // NOR Code as ID is generic? No user used ID '1' in local data.
		// We'll use Product Code as ID or generate one. Using Product Code 'NOR 100' is better.
		// Mapped to Frontend Type:
		// id, norCode, nameEn, nameAr, descriptionAr, descriptionEn, size, price, expiryDate, category, brandLine, imageUrl, isNew, isSor, stockLevel

		norCode: row[2],
		nameEn: row[1],
		nameAr: row[1],
		descriptionAr: row[4],
		descriptionEn: row[4], // duplicate for now if missing
		size: row[3],
		price: parseFloat(row[5] || '0'),
		expiryDate: formatDate(row[6]),
		category: mapCategory(row[0]),
		imageUrl: row[8], // Pick URL
		stockLevel: mapStock(row[7]),

		// Defaults/Missing
		brandLine: 'Noreva',
		isNew: false,
		isSor: false
	}));

	const payload = { timestamp: Date.now(), data: transformed };
	await env.NOREVA_CACHE.put('products_data', JSON.stringify(payload));
	return transformed;
}

async function fetchSheetData(env: Env, tabName: string) {
	const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
	const client = new JWT({
		email: creds.client_email,
		key: creds.private_key,
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
	});

	await client.authorize();

	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(tabName)}!A:Z`;
	const res = await client.request({ url });
	return (res.data as any).values || [];
}

function mapCategory(cat: string) {
	// Map sheet category to 'face', 'body', 'sun', 'hair'
	if (!cat) return 'face';
	const c = cat.toLowerCase();
	if (c.includes('face') || c.includes('visage')) return 'face';
	if (c.includes('body') || c.includes('corps')) return 'body';
	if (c.includes('sun') || c.includes('solaire')) return 'sun';
	if (c.includes('hair') || c.includes('cheveux')) return 'hair';
	return 'face';
}

function mapStock(val: string) {
	// Inventory: High, Low, Out?
	if (!val) return 'high';
	const v = val.toLowerCase();
	if (v.includes('out') || v === '0') return 'out';
	if (v.includes('low')) return 'low';
	return 'high';
}

function formatDate(val: string) {
	if (!val) return '';
	// Handle Sheet Date? usually string or number?
	// Google API returns formatted value (string) if valueRenderOption is FORMATTED_VALUE (default)
	return val;
}

function formatCustomer(row: any[]) {
	// row: [ID, Name, Phone, Email, Region, Class...]
	return {
		id: row[0],
		name: row[1],
		phone: row[2],
		email: row[3],
		region: row[4],
		pharmacyClass: row[5]
	};
}
