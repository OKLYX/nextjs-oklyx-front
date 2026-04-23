'use client';

const TOKEN_KEY = 'oklyx_token';

export const tokenStorage = {
  getToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const cookies = document.cookie.split('; ');
    const tokenCookie = cookies.find((cookie) => cookie.startsWith(`${TOKEN_KEY}=`));
    return tokenCookie ? tokenCookie.split('=')[1] : null;
  },

  setToken(token: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Strict`;
  },

  removeToken(): void {
    if (typeof window === 'undefined') {
      return;
    }

    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  },
};
