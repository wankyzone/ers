export const DEFAULT_API_BASE_URL = "http://localhost:3001";

export function getApiBaseUrl(): string {
  const envValue = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!envValue) {
    return DEFAULT_API_BASE_URL;
  }

  // Normalize the provided API base URL by removing any trailing slash
  // and stripping a trailing '/api' segment if present. This prevents
  // accidental double '/api' prefixes when callers request paths like
  // '/api/admin/runners' and the environment already contains '/api'.
  let normalized = envValue.replace(/\/$/, "");

  // If the base URL ends with '/api', remove that segment to avoid
  // duplicating it when building request URLs.
  if (normalized.toLowerCase().endsWith('/api')) {
    normalized = normalized.slice(0, -('/api'.length));
  }

  return normalized;
}
