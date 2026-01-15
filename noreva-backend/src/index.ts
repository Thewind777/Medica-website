
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

// Helper: Clean phone number
function cleanPhone(phone: string): string {
	return (phone || '').toString().replace(/\D/g, '');
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: CORS_HEADERS });
		}

		const url = new URL(request.url);

		// === GET /products ===
		if (request.method === 'GET' && url.pathname === '/products') {
			try {
				const cached = await env.NOREVA_CACHE.get('products_data');
				if (cached) {
					const parsed = JSON.parse(cached);
					const age = Date.now() - (parsed.timestamp || 0);
					if (age > 60 * 1000) { ctx.waitUntil(updateCache(env)); }
					return new Response(JSON.stringify(parsed.data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS } });
				}
				const freshData = await updateCache(env);
				return new Response(JSON.stringify(freshData), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS } });
			} catch (err: any) {
				return new Response(JSON.stringify({ error: 'Failed to load products', reason: err.message }), { status: 500, headers: CORS_HEADERS });
			}
		}

		// === POST /update-cache (PURGE STRATEGY) ===
		if (request.method === 'POST' && (url.pathname === '/update-cache' || url.pathname === '/')) {
			const authHeader = request.headers.get('Authorization');
			if (authHeader !== `Bearer ${env.SHARED_SECRET}`) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
			}
			try {
				await env.NOREVA_CACHE.delete('products_data');
				await updateCache(env);
				return new Response(JSON.stringify({ status: 'Cache Purged & Refreshed' }), { headers: CORS_HEADERS });
			} catch (err: any) {
				return new Response(JSON.stringify({ error: 'Cache update failed', reason: err.message }), { status: 500, headers: CORS_HEADERS });
			}
		}

		// === POST /auth/signup ===
		if (request.method === 'POST' && url.pathname === '/auth/signup') {
			try {
				const body = await request.json() as any;
				const { name, phone, email, region } = body;

				if (!name || !phone || !region) {
					return new Response(JSON.stringify({ error: 'Missing fields', reason: 'Name, Phone, and Region are required. Example: Janzour-Alola Pharmacy' }), { status: 400, headers: CORS_HEADERS });
				}

				// LIVE FETCH - wrapped in try/catch
				let customers: any[];
				try {
					customers = await fetchSheetData(env, 'Customers', 'A1:K1000');
				} catch (sheetErr: any) {
					console.error('Sheet fetch error:', sheetErr);
					return new Response(JSON.stringify({ error: 'Sheet Error', reason: sheetErr.message, debug: 'Signup fetch failed' }), { status: 503, headers: CORS_HEADERS });
				}

				const cleanedPhone = cleanPhone(phone);
				const existingPhone = customers.find((row: any[]) => cleanPhone(row[10]) === cleanedPhone);
				if (existingPhone) {
					return new Response(JSON.stringify({ error: 'Duplicate', reason: 'Phone number already registered.' }), { status: 409, headers: CORS_HEADERS });
				}

				if (email) {
					const existingEmail = customers.find((row: any[]) => row[7] && row[7].toString().toLowerCase() === email.toLowerCase());
					if (existingEmail) {
						return new Response(JSON.stringify({ error: 'Duplicate', reason: 'Email already registered.' }), { status: 409, headers: CORS_HEADERS });
					}
				}

				const newId = `PHAR-WEB-${Date.now().toString().slice(-6)}`;
				const newRow = [newId, name, region, 'C', '1000', '0', 'Web Signup', email || '', '0', '0', phone];

				try {
					await appendSheetData(env, 'Customers', 'A:K', newRow);
				} catch (appendErr: any) {
					console.error('Sheet append error:', appendErr);
					return new Response(JSON.stringify({ error: 'Failed to save', reason: 'Google Sheets is busy. Please try again. Technical: ' + appendErr.message }), { status: 503, headers: CORS_HEADERS });
				}

				return new Response(JSON.stringify({ success: true, customer: { id: newId, name, region }, message: `Welcome ${name}!` }), { headers: CORS_HEADERS });

			} catch (err: any) {
				console.error('Signup crash:', err);
				return new Response(JSON.stringify({ error: 'Signup failed', reason: err.message }), { status: 500, headers: CORS_HEADERS });
			}
		}

		// === POST /auth/login ===
		if (request.method === 'POST' && url.pathname === '/auth/login') {
			try {
				const body = await request.json() as any;
				const { email, phone } = body;

				let customers: any[];
				try {
					customers = await fetchSheetData(env, 'Customers', 'A1:K1000');
				} catch (sheetErr: any) {
					console.error('Sheet fetch error:', sheetErr);
					return new Response(JSON.stringify({ error: 'Sheet Error', reason: sheetErr.message, debug: 'Login fetch failed' }), { status: 503, headers: CORS_HEADERS });
				}

				const cleanedPhone = cleanPhone(phone);
				const byPhone = customers.find((row: any[]) => cleanPhone(row[10]) === cleanedPhone);

				if (byPhone) {
					if (email && byPhone[7] && byPhone[7].toString().toLowerCase() !== email.toLowerCase()) {
						return new Response(JSON.stringify({ error: 'Conflict', reason: 'Phone is registered to a different email.' }), { status: 403, headers: CORS_HEADERS });
					}
					return new Response(JSON.stringify({ status: 'ok', customer: formatCustomer(byPhone), message: `Welcome back ${byPhone[1]}!` }), { headers: CORS_HEADERS });
				}

				const byEmail = email ? customers.find((row: any[]) => row[7] && row[7].toString().toLowerCase() === email.toLowerCase()) : null;
				if (byEmail) {
					if (phone && cleanPhone(byEmail[10]) !== cleanedPhone) {
						return new Response(JSON.stringify({ error: 'Conflict', reason: 'Email is registered to a different phone.' }), { status: 403, headers: CORS_HEADERS });
					}
					return new Response(JSON.stringify({ status: 'ok', customer: formatCustomer(byEmail), message: `Welcome back ${byEmail[1]}!` }), { headers: CORS_HEADERS });
				}

				return new Response(JSON.stringify({ error: 'Not Found', reason: 'Phone number not found. Please sign up first.' }), { status: 404, headers: CORS_HEADERS });

			} catch (err: any) {
				console.error('Login crash:', err);
				return new Response(JSON.stringify({ error: 'Login failed', reason: err.message }), { status: 500, headers: CORS_HEADERS });
			}
		}

		// === POST /orders ===
		if (request.method === 'POST' && url.pathname === '/orders') {
			try {
				const body = await request.json() as any;
				const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
				ctx.waitUntil((async () => {
					try { body.orderId = orderId; await fetch(env.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }); } catch (e) { console.error(e); }
				})());
				return new Response(JSON.stringify({ result: 'success', orderId }), { headers: CORS_HEADERS });
			} catch (err: any) {
				return new Response(JSON.stringify({ error: 'Order failed', reason: err.message }), { status: 500, headers: CORS_HEADERS });
			}
		}

		// === GET /auth/history (Filter Orders by Pharmacy ID in Column C) ===
		if (request.method === 'GET' && url.pathname === '/auth/history') {
			try {
				const pharmacyId = url.searchParams.get('pharmacyId');
				if (!pharmacyId) {
					return new Response(JSON.stringify({ error: 'Missing pharmacyId parameter' }), { status: 400, headers: CORS_HEADERS });
				}

				const orders = await fetchSheetData(env, 'Orders', 'A1:J1000');
				// Column C (index 2) is Pharmacy ID
				const userOrders = orders.slice(1).filter((row: any[]) => row[2] === pharmacyId);

				const formattedOrders = userOrders.map((row: any[]) => ({
					orderId: row[0],
					timestamp: row[1],
					productCodes: row[3],
					totalAmount: row[4],
					status: row[5],
					paymentStatus: row[6],
					deliveryDate: row[7],
					note: row[9]
				}));

				return new Response(JSON.stringify({ orders: formattedOrders }), { headers: CORS_HEADERS });
			} catch (err: any) {
				return new Response(JSON.stringify({ error: 'History fetch failed', reason: err.message }), { status: 500, headers: CORS_HEADERS });
			}
		}

		return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: CORS_HEADERS });
	},
};

// === CACHE UPDATE ===
async function updateCache(env: Env) {
	const products = await fetchSheetData(env, "Noreva's Products", 'A1:K1000');
	const rows = products.slice(1);
	const transformed = rows.map((row: any[]) => {
		const statusVal = (row[10] || '').toLowerCase();
		return {
			id: row[2], norCode: row[2], nameEn: row[1], nameAr: row[1],
			descriptionAr: row[4], descriptionEn: row[4], size: row[3],
			price: parseFloat(row[5] || '0'), expiryDate: row[6] || '',
			category: mapCategory(row[9]), imageUrl: row[8], stockLevel: mapStock(row[7]),
			brandLine: row[0] || 'Noreva',
			status: statusVal.includes('new') ? 'new' : (statusVal.includes('sor') ? 'sor' : 'normal'),
			isNew: statusVal.includes('new'), isSor: statusVal.includes('sor'),
		};
	});
	await env.NOREVA_CACHE.put('products_data', JSON.stringify({ timestamp: Date.now(), data: transformed }));
	return transformed;
}

// === HELPERS ===
function mapCategory(cat: string) { if (!cat) return 'face'; const c = cat.toLowerCase(); if (c.includes('body')) return 'body'; if (c.includes('sun') || c.includes('spf')) return 'sun'; if (c.includes('hair')) return 'hair'; return 'face'; }
function mapStock(val: string) { if (!val) return 'high'; const v = val.toLowerCase(); if (v.includes('out') || v === '0') return 'out'; if (v.includes('low')) return 'low'; return 'high'; }
function formatCustomer(row: any[]) { return { id: row[0], name: row[1], region: row[2], pharmacyClass: row[3], email: row[7], phone: row[10] }; }

// === GOOGLE SHEETS API (Heavily Optimized) ===
let cachedToken: { token: string; expires: number } | null = null;
let cachedCryptoKey: any = null;
let cachedClientEmail: string | null = null;

async function fetchSheetData(env: Env, tabName: string, range: string): Promise<any[]> {
	const token = await getGoogleAuthToken(env);
	// Use specific range like A1:K1000 instead of A:Z to avoid exceeding column count
	const fullRange = `${tabName}!${range}`;
	const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(fullRange)}`;

	const res = await fetch(apiUrl, {
		headers: { Authorization: `Bearer ${token}` },
		cf: { cacheTtl: 0 }
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Sheet API ${res.status} for ${fullRange}: ${errText}`);
	}

	const data = await res.json() as any;
	if (data.error) throw new Error(`Range ${fullRange}: ${JSON.stringify(data.error)}`);
	return data.values || [];
}

async function appendSheetData(env: Env, sheetName: string, range: string, rowValues: string[]): Promise<void> {
	const token = await getGoogleAuthToken(env);
	const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(sheetName)}!${range}:append?valueInputOption=USER_ENTERED`;

	const res = await fetch(apiUrl, {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ values: [rowValues] })
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Append API ${res.status}: ${errText}`);
	}
}

async function getGoogleAuthToken(env: Env): Promise<string> {
	// Use cached token if still valid
	if (cachedToken && Date.now() < cachedToken.expires) {
		return cachedToken.token;
	}

	// Parse creds and import key ONCE (cache at module level)
	if (!cachedCryptoKey || !cachedClientEmail) {
		const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
		cachedClientEmail = creds.client_email;
		cachedCryptoKey = await importPrivateKey(creds.private_key);
	}

	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'RS256', typ: 'JWT' };
	const claim = {
		iss: cachedClientEmail,
		scope: 'https://www.googleapis.com/auth/spreadsheets',
		aud: 'https://oauth2.googleapis.com/token',
		exp: now + 3600,
		iat: now
	};

	const encodedHeader = btoaUrl(JSON.stringify(header));
	const encodedClaim = btoaUrl(JSON.stringify(claim));
	const input = `${encodedHeader}.${encodedClaim}`;

	const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, cachedCryptoKey, new TextEncoder().encode(input));
	const signedJwt = `${input}.${btoaUrl(signature)}`;

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Google Auth ${res.status}: ${errText}`);
	}

	const tokenData = await res.json() as any;
	if (!tokenData.access_token) throw new Error('No access_token in response');

	// Cache token for 55 minutes
	cachedToken = { token: tokenData.access_token, expires: Date.now() + 55 * 60 * 1000 };
	return tokenData.access_token;
}

async function importPrivateKey(pem: string): Promise<any> {
	// Handle both literal \n and actual newlines in the PEM string
	const pemHeader = '-----BEGIN PRIVATE KEY-----';
	const pemFooter = '-----END PRIVATE KEY-----';
	const pemContents = pem
		.replace(pemHeader, '')
		.replace(pemFooter, '')
		.replace(/\\n/g, '')  // Remove literal backslash-n from JSON
		.replace(/\n/g, '')   // Remove actual newlines
		.replace(/\r/g, '')   // Remove carriage returns
		.replace(/\s/g, '')   // Remove any remaining whitespace
		.trim();

	const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

	return crypto.subtle.importKey(
		'pkcs8',
		binaryDer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);
}

function btoaUrl(input: string | ArrayBuffer): string {
	let str: string;
	if (typeof input === 'string') {
		str = btoa(input);
	} else {
		str = btoa(String.fromCharCode(...new Uint8Array(input)));
	}
	return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
