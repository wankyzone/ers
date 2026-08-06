import { defaultAuthTokenStore, getAuthToken } from "./auth";
import { getApiBaseUrl } from "./config";
import { ApiError } from "./errors";
import type { ApiRequestOptions, AuthTokenStore, HttpMethod } from "./types";

export interface RequestConfig {
  baseUrl?: string;
  timeoutMs?: number;
  authStore?: AuthTokenStore;
}

function isAbsoluteUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

function buildUrl(path: string, baseUrl: string, params?: ApiRequestOptions["params"]): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const target = isAbsoluteUrl(path) ? path : `${baseUrl}${normalizedPath}`;
  const url = new URL(target);

  if (!params) {
    return url.toString();
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function shouldSerializeJson(body: RequestBody): boolean {
  return (
    body !== undefined &&
    body !== null &&
    typeof body !== "string" &&
    !(body instanceof Blob) &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(body)
  );
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.message === "string") {
      return record.message;
    }

    if (typeof record.error === "string") {
      return record.error;
    }
  }

  return fallback;
}

export async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
  config: RequestConfig = {},
): Promise<T> {
  const baseUrl = config.baseUrl ?? getApiBaseUrl();
  const timeoutMs = config.timeoutMs ?? 10000;
  const authStore = config.authStore ?? defaultAuthTokenStore;
  const method = (options.method ?? "GET") as HttpMethod;
  const url = buildUrl(path, baseUrl, options.params);
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!options.skipAuth) {
    const token = getAuthToken(authStore);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let body: BodyInit | null | undefined = options.body as BodyInit | null | undefined;

  if (shouldSerializeJson(options.body)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      body,
      headers,
      method,
      signal: controller.signal,
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      const fallbackMessage = `Request failed with status ${response.status}`;
      throw new ApiError(extractErrorMessage(payload, fallbackMessage), {
        status: response.status,
        statusText: response.statusText,
        body: payload,
        code: response.headers.get("x-request-id") ?? undefined,
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timed out", {
        status: 408,
        statusText: "Request Timeout",
        body: null,
        cause: error,
      });
    }

    throw new ApiError("Request failed", {
      status: 0,
      statusText: "Network Error",
      body: error,
      cause: error,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
