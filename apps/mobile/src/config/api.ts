export const LOCAL_API_BASE_URL = 'http://YOUR_LOCAL_IP:3000';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? LOCAL_API_BASE_URL;

export const DEBUG_API = true;

export interface ApiDebugResponse {
  url: string;
  status: number;
  text: string;
}

type ApiDebugListener = (response: ApiDebugResponse) => void;

const listeners = new Set<ApiDebugListener>();

export function subscribeApiDebug(listener: ApiDebugListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function publishApiDebug(response: ApiDebugResponse) {
  listeners.forEach((listener) => listener(response));
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string, string>),
  };

  const res = await fetch(url, {
    ...options,
    headers: defaultHeaders,
  });
  const text = await res.text();

  console.log('RAW RESPONSE:', {
    url,
    status: res.status,
    body: text,
  });

  publishApiDebug({
    url,
    status: res.status,
    text,
  });

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('JSON parse failed:', e);
  }

  return {
    data,
    res,
    text,
    url,
  };
}
