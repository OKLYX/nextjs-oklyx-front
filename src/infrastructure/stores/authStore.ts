import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: {
    email: string;
    name: string;
    role: 'GUEST' | 'USER' | 'ADMIN';
  } | null;
  setUser: (user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'auth-store',
    }
  )
);
