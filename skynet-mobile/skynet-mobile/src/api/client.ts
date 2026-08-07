import { getApiBaseUrl } from '../config';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server returned an invalid response (status ${res.status}).`);
  }

  // The Next.js API always returns { success, ... } even on error, but
  // surface non-2xx statuses too in case something upstream 500s without JSON.
  if (!res.ok && json?.success === undefined) {
    throw new Error(json?.error || `Request failed with status ${res.status}`);
  }

  return json as T;
}

export const apiGet = <T>(path: string) => request<T>(path, { method: 'GET' });

export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
