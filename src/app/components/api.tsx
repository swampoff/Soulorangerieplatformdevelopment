import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export const SUPABASE_URL = `https://${projectId}.supabase.co`;
export const SERVER_BASE = `${SUPABASE_URL}/functions/v1/make-server-5b6cbf80`;

// Singleton Supabase client
let _supabase: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, publicAnonKey);
  }
  return _supabase;
}

// Authenticated fetch helper (uses user's access token)
export async function authFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${SERVER_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  return res;
}

// Unauthenticated fetch helper (uses anon key)
export async function anonFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SERVER_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      ...(options?.headers || {}),
    },
  });
  return res;
}
