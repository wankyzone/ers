import { defaultAuthTokenStore } from "./auth";
import type { ApiClientOptions, ApiRequestOptions, RequestBody } from "./types";
import { request } from "./request";

export class ApiClient {
  constructor(private readonly options: ApiClientOptions = {}) {}

  private getRequestConfig(): { baseUrl?: string; timeoutMs?: number; authStore?: typeof defaultAuthTokenStore } {
    return {
      baseUrl: this.options.baseUrl,
      timeoutMs: this.options.timeoutMs,
      authStore: this.options.authStore,
    };
  }

  get<T>(path: string, options: Omit<ApiRequestOptions, "body" | "method"> = {}): Promise<T> {
    return request<T>(path, { ...options, method: "GET" }, this.getRequestConfig());
  }

  post<T>(path: string, body?: RequestBody, options: Omit<ApiRequestOptions, "body" | "method"> = {}): Promise<T> {
    return request<T>(path, { ...options, body, method: "POST" }, this.getRequestConfig());
  }

  put<T>(path: string, body?: RequestBody, options: Omit<ApiRequestOptions, "body" | "method"> = {}): Promise<T> {
    return request<T>(path, { ...options, body, method: "PUT" }, this.getRequestConfig());
  }

  patch<T>(path: string, body?: RequestBody, options: Omit<ApiRequestOptions, "body" | "method"> = {}): Promise<T> {
    return request<T>(path, { ...options, body, method: "PATCH" }, this.getRequestConfig());
  }

  delete<T>(path: string, body?: RequestBody, options: Omit<ApiRequestOptions, "body" | "method"> = {}): Promise<T> {
    return request<T>(path, { ...options, body, method: "DELETE" }, this.getRequestConfig());
  }
}

export const createApiClient = (options: ApiClientOptions = {}): ApiClient => new ApiClient(options);

export const apiClient = createApiClient();
