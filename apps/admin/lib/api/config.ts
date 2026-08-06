export const DEFAULT_API_BASE_URL = "http://localhost:3001";

export function getApiBaseUrl(): string {
  const envValue = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!envValue) {
    return DEFAULT_API_BASE_URL;
  }

  return envValue.replace(/\/$/, "");
}
