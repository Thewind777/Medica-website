
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
					const parsed = JSON.parse(cached);
					// SWR Logic: If stale (>5 min), trigger background update
					const age = Date.now() - (parsed.timestamp || 0);
					if (age > 5 * 60 * 1000) {
						ctx.waitUntil(updateCache(env));
					}
					return new Response(JSON.stringify(parsed.data), {
						headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
					});
				}

				// 2. Fetch Fresh (Blocking if no cache)
				const freshData = await updateCache(env);
				return new Response(JSON.stringify(freshData), {
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
				});
			}

			// === POST / (Root Sync from Apps Script) or /update-cache ===
			// INSTANT SYNC: Respond OK immediately, process in background
			if (request.method === 'POST' && (url.pathname === '/update-cache' || url.pathname === '/')) {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${env.SHARED_SECRET}`) {
					return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
				}

				// Fire & Forget: Update cache in background
				ctx.waitUntil(updateCache(env));

				return new Response(JSON.stringify({ status: 'Refreshed' }), { headers: CORS_HEADERS });
			}

			// === POST /auth/signup ===
			if (request.method === 'POST' && url.pathname === '/auth/signup') {
				const body = await request.json() as any;
				const { name, phone, email, region } = body;

				if (!name || !phone || !region) {
					return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: CORS_HEADERS });
				}

				const customers = await fetchSheetData(env, 'Customers');

				// Check for duplicates
				const existingPhone = customers.find((row: any[]) => row[10] && row[10].toString().replace(/\D/g, '') === phone.replace(/\D/g, ''));
				if (existingPhone) {
					return new Response(JSON.stringify({ error: 'Phone number already registered' }), { status: 409, headers: CORS_HEADERS });
				}

				if (email) {
					const existingEmail = customers.find((row: any[]) => row[7] && row[7].toString().toLowerCase() === email.toLowerCase());
					if (existingEmail) {
						return new Response(JSON.stringify({ error: 'Email already registered' }), { status: 409, headers: CORS_HEADERS });
					}
				}

				// Generate ID
				const newId = `PHAR-WEB-${Date.now().toString().slice(-4)}`; // Simple ID generation

				// Columns: ID(0), Name(1), Region(2), Class(3), Limit(4), Points(5), Notes(6), Email(7), LTV(8), Balance(9), Phone(10)
				const newRow = [
					newId,
					name,
					region,
					'C', // Default Class
					'1000', // Default Limit
					'0', // Points
					'Web Signup', // Notes
					email || '',
					'0', // LTV
					'0', // Balance
					phone
				];

				// Append to Sheet
				await appendSheetData(env, 'Customers', newRow);

				return new Response(JSON.stringify({
					status: 'ok',
					customer: { id: newId, name, region, type: 'C', email, phone }
				}), { headers: CORS_HEADERS });
			}

			// === POST /auth/login (Guardrail) ===
			if (request.method === 'POST' && url.pathname === '/auth/login') {
				const body = await request.json() as any;
				const { email, name, phone } = body;

				const customers = await fetchSheetData(env, 'Customers');
				// Columns: ID(0), Name(1), Region(2), Class(3), Limit(4), Points(5), Notes(6), Email(7), LTV(8), Balance(9), Phone(10)

				// Find by Email (Index 7)
				let existing = null;
				if (email) {
					existing = customers.find((row: any[]) => row[7] && row[7].toString().toLowerCase() === email.toLowerCase());
				}

				// Find by Phone (Index 10)
				if (!existing && phone) {
					existing = customers.find((row: any[]) => row[10] && row[10].toString().replace(/\D/g, '') === phone.replace(/\D/g, ''));
				}

				if (existing) {
					return new Response(JSON.stringify({ status: 'ok', customer: formatCustomer(existing) }), { headers: CORS_HEADERS });
				}

				// Conflict Detection
				const byPhone = customers.find((row: any[]) => row[10] && row[10].toString().replace(/\D/g, '') === phone.replace(/\D/g, ''));
				const byEmail = email ? customers.find((row: any[]) => row[7] && row[7].toString().toLowerCase() === email.toLowerCase()) : null;

				if (byPhone) {
					if (email && byPhone[7] && byPhone[7].toString().toLowerCase() !== email.toLowerCase()) {
						return new Response(JSON.stringify({
							error: 'Phone number is registered to a different email address.',
							status: 'conflict'
						}), { status: 403, headers: CORS_HEADERS });
					}
					return new Response(JSON.stringify({ status: 'ok', customer: formatCustomer(byPhone) }), { headers: CORS_HEADERS });
				}

				if (byEmail) {
					if (phone && byEmail[10] && byEmail[10].toString().replace(/\D/g, '') !== phone.replace(/\D/g, '')) {
						return new Response(JSON.stringify({
							error: 'Email is registered to a different phone number.',
							status: 'conflict'
						}), { status: 403, headers: CORS_HEADERS });
					}
					return new Response(JSON.stringify({ status: 'ok', customer: formatCustomer(byEmail) }), { headers: CORS_HEADERS });
				}

				// Neither found -> Not Registered
				return new Response(JSON.stringify({
					error: 'Phone number not registered. Please sign up first.',
					status: 'not_found'
				}), { status: 403, headers: CORS_HEADERS });
			}

			// === POST /orders ===
			// INSTANT HANDSHAKE: Generate ID, Respond OK, Send to Sheet in Background
			if (request.method === 'POST' && url.pathname === '/orders') {
				const body = await request.json() as any;

				// 1. Generate ID here for speed
				const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

				// 2. Respond to Frontend IMMEDIATELY
				const instantResponse = new Response(JSON.stringify({ result: 'success', orderId }), { headers: CORS_HEADERS });

				// 3. Process Sheet Append in Background
				ctx.waitUntil((async () => {
					try {
						// Attach generated ID to body for Apps Script
						body.orderId = orderId;

						await fetch(env.APPS_SCRIPT_URL, {
							method: 'POST',
							body: JSON.stringify(body),
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (e) {
						console.error("Background Order Sync Failed:", e);
					}
				})());

				return instantResponse;
			}

			return new Response('Not Found', { status: 404, headers: CORS_HEADERS });

		} catch (err: any) {
			return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
		}
	},
};

async function updateCache(env: Env) {
	const products = await fetchSheetData(env, "Noreva's products");
	// Columns Update:
	// Brand(0), Name(1), Code(2), Size(3), DescAr(4), Price(5), Expiry(6), Inv(7), URL(8), FUNCTION(9), STATUS(10)
	const rows = products.slice(1);

	const transformed = rows.map((row: any[]) => {
		const statusVal = (row[10] || '').toLowerCase();

		return {
			id: row[2],
			norCode: row[2],
			nameEn: row[1],
			nameAr: row[1],
			descriptionAr: row[4],
			descriptionEn: row[4],
			size: row[3],
			price: parseFloat(row[5] || '0'),
			expiryDate: formatDate(row[6]),

			// Relaxed Category Mapping
			category: mapCategory(row[9]),

			imageUrl: row[8],
			stockLevel: mapStock(row[7]),
			brandLine: row[0] || 'Noreva',

			// New Status Mapping
			status: statusVal.includes('new') ? 'new' : (statusVal.includes('sor') ? 'sor' : 'normal'),
			isNew: statusVal.includes('new'),
			isSor: statusVal.includes('sor'),
		};
	});

	const payload = { timestamp: Date.now(), data: transformed };
	await env.NOREVA_CACHE.put('products_data', JSON.stringify(payload));
	return transformed;
}

// --- HELPERS ---

function mapCategory(cat: string) {
	if (!cat) return 'face';
	const c = cat.toLowerCase().trim();
	if (c.includes('face') || c.includes('visage')) return 'face';
	if (c.includes('body') || c.includes('corps')) return 'body';
	if (c.includes('sun') || c.includes('solaire') || c.includes('protection') || c.includes('spf')) return 'sun';
	if (c.includes('hair') || c.includes('cheveux') || c.includes('capillaire')) return 'hair';
	return 'face';
}

function mapStock(val: string) {
	if (!val) return 'high';
	const v = val.toLowerCase();
	if (v.includes('out') || v === '0') return 'out';
	if (v.includes('low')) return 'low';
	return 'high';
}

function formatDate(val: string) {
	if (!val) return '';
	return val;
}

function formatCustomer(row: any[]) {
	return {
		id: row[0],
		name: row[1],
		region: row[2],
		pharmacyClass: row[3],
		limit: row[4],
		points: row[5],
		email: row[7],
		balance: row[9],
		phone: row[10]
	};
}

async function fetchSheetData(env: Env, tabName: string) {
	const token = await getGoogleAuthToken(env);
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${encodeURIComponent(tabName)}!A:Z`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` }
	});
	const data = await res.json() as any;
	if (data.error) throw new Error(JSON.stringify(data.error));
	return data.values || [];
}

async function appendSheetData(env: Env, sheetName: string, rowValues: string[]) {
	const token = await getGoogleAuthToken(env);
	const spreadsheetId = env.SHEET_ID;
	const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:A:append?valueInputOption=USER_ENTERED`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			values: [rowValues]
		})
	});

	if (!response.ok) {
		const txt = await response.text();
		throw new Error('Failed to append sheet data: ' + txt);
	}
}

async function getGoogleAuthToken(env: Env) {
	const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
	const header = { alg: 'RS256', typ: 'JWT' };
	const now = Math.floor(Date.now() / 1000);
	const claim = {
		iss: creds.client_email,
		scope: 'https://www.googleapis.com/auth/spreadsheets',
		aud: 'https://oauth2.googleapis.com/token',
		exp: now + 3600,
		iat: now,
	};

	const encodedHeader = btoaUrl(JSON.stringify(header));
	const encodedClaim = btoaUrl(JSON.stringify(claim));
	const input = `${encodedHeader}.${encodedClaim}`;

	const key = await importPrivateKey(creds.private_key);
	const signature = await crypto.subtle.sign(
		{ name: 'RSASSA-PKCS1-v1_5' },
		key,
		new TextEncoder().encode(input)
	);

	const signedJwt = `${input}.${btoaUrl(signature)}`;

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
	});

	const tokenData = await res.json() as any;
	if (!tokenData.access_token) throw new Error('Failed to get Google Token: ' + JSON.stringify(tokenData));
	return tokenData.access_token;
}

// Helper: PEM to CryptoKey
async function importPrivateKey(pem: string) {
	const binary = str2ab(atob(pem
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s+/g, '')
	));

	return crypto.subtle.importKey(
		'pkcs8',
		binary,
		{
			name: 'RSASSA-PKCS1-v1_5',
			hash: 'SHA-256',
		},
		false,
		['sign']
	);
}

// Helper: Base64Url Encode
function btoaUrl(input: string | ArrayBuffer) {
	let str = '';
	if (typeof input === 'string') {
		str = btoa(input);
	} else {
		str = btoa(String.fromCharCode(...new Uint8Array(input)));
	}
	return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: String to ArrayBuffer
function str2ab(str: string) {
	const buf = new ArrayBuffer(str.length);
	const bufView = new Uint8Array(buf);
	for (let i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}
