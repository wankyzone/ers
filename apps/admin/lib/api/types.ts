export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestBody =
  | BodyInit
  | Record<string, unknown>
  | Array<unknown>
  | null;

export interface AuthTokenStore {
  getToken(): string | null;
  setToken(token: string | null): void;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: RequestBody;
  headers?: HeadersInit;
  params?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  skipAuth?: boolean;
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  authStore?: AuthTokenStore;
}
