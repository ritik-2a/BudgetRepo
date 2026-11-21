import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'sync_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Normalises user input like "192.168.1.9:4000/" → "http://192.168.1.9:4000". */
export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export class SyncError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export async function request<T>(
  baseUrl: string,
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: opts.method ?? 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new SyncError(
      aborted
        ? `The server at ${baseUrl} took too long to answer.`
        : `Can't reach the server at ${baseUrl}. Check that your phone is on the same Wi-Fi and the server is running.`,
    );
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body
  }
  if (!res.ok) {
    const serverMsg =
      json && typeof json === 'object' && 'error' in json ? String(json.error) : '';
    throw new SyncError(serverMsg || `Server error (${res.status})`, res.status);
  }
  return json as T;
}
