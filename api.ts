
export const API_URL = import.meta.env.VITE_WORKER_URL;

if (!API_URL) {
    console.warn('VITE_WORKER_URL is not defined!');
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    email: string;
    region: string;
    pharmacyClass: string;
}

export interface AuthResponse {
    status: 'ok' | 'conflict' | 'new';
    customer?: Customer;
    possibleMatch?: { name: string; region: string };
}

export const api = {
    async getProducts() {
        if (!API_URL) return [];
        const res = await fetch(`${API_URL}/products`);
        if (!res.ok) throw new Error('Failed to fetch products');
        return res.json();
    },

    async login(data: { email?: string; phone?: string; name: string }) {
        if (!API_URL) return { status: 'new' };
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.status === 409) return res.json(); // Conflict
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },

    async register(data: { name: string; phone: string; email: string; region: string }) {
        if (!API_URL) throw new Error('API URL missing');
        const res = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Registration failed');
        return res.json();
    },

    async submitOrder(orderData: any) {
        if (!API_URL) throw new Error('API URL missing');
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });
        const result = await res.json();
        if (!res.ok || result.result === 'error') {
            throw new Error(result.error || 'Order failed');
        }
        return result;
    },

    async updateCache(secret: string) {
        if (!API_URL) return;
        await fetch(`${API_URL}/update-cache`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${secret}` }
        });
    }
};
