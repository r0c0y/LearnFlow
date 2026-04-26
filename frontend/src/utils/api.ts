import { useAuthStore } from '../store/authStore';

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const token = useAuthStore.getState().token;
    const headers = { ...(init.headers || {}) } as Record<string, string>;

    if (!(init.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(input, { ...init, headers });
}
