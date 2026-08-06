import type { AuthTokenStore } from "./types";

const AUTH_TOKEN_STORAGE_KEY = "ers_admin_access_token";

export const defaultAuthTokenStore: AuthTokenStore = {
  getToken: () => {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  },
  setToken: (token) => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      return;
    }

    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  },
};

export function getAuthToken(store: AuthTokenStore = defaultAuthTokenStore): string | null {
  return store.getToken();
}

export function setAuthToken(token: string | null, store: AuthTokenStore = defaultAuthTokenStore): void {
  store.setToken(token);
}

export function buildAuthorizationHeader(token: string | null | undefined): Record<string, string> {
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
