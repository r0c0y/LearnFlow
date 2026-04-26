import { create } from 'zustand';

type User = { id: string; email: string } | null;

interface AuthState {
    token: string | null;
    user: User;
    setAuth: (token: string, user: User) => void;
    clearAuth: () => void;
}

const initialToken = typeof window !== 'undefined' ? localStorage.getItem('learnflow_token') : null;
const initialUser = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('learnflow_user') || 'null')
    : null;

export const useAuthStore = create<AuthState>((set) => ({
    token: initialToken,
    user: initialUser,
    setAuth: (token, user) => {
        localStorage.setItem('learnflow_token', token);
        localStorage.setItem('learnflow_user', JSON.stringify(user));
        set({ token, user });
    },
    clearAuth: () => {
        localStorage.removeItem('learnflow_token');
        localStorage.removeItem('learnflow_user');
        set({ token: null, user: null });
    },
}));
