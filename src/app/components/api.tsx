export const SERVER_BASE = '/api';

// Authenticated fetch helper (uses JWT token from localStorage)
export async function authFetch(path: string, _tokenOrOptions?: string | RequestInit, options?: RequestInit) {
  // Support both old signature (path, token, options) and new (path, options)
  let token: string | null = null;
  let fetchOptions: RequestInit | undefined;

  if (typeof _tokenOrOptions === 'string') {
    token = _tokenOrOptions;
    fetchOptions = options;
  } else {
    token = localStorage.getItem('access_token');
    fetchOptions = _tokenOrOptions;
  }

  const res = await fetch(`${SERVER_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions?.headers || {}),
    },
  });
  return res;
}

// Unauthenticated fetch helper
export async function anonFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SERVER_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  return res;
}
