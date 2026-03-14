import { useEffect, useRef } from 'react';

type Callback = () => void;

/**
 * Periodic polling for data updates.
 * Replaces Supabase Realtime with simple interval-based refresh.
 *
 * @param keyPrefixes — Array of key prefixes (kept for API compatibility, not used)
 * @param callback — Function to call periodically
 * @param pollIntervalMs — Poll interval in ms (default: 15000)
 */
export function useRealtimeUpdates(
  keyPrefixes: string[],
  callback: Callback,
  pollIntervalMs = 15000
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const prefixesKey = keyPrefixes.join(',');

  useEffect(() => {
    if (!prefixesKey) return;
    const timer = setInterval(() => callbackRef.current(), pollIntervalMs);
    return () => clearInterval(timer);
  }, [prefixesKey, pollIntervalMs]);
}

/**
 * A lightweight variant: simple periodic polling.
 */
export function usePolling(callback: Callback, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);
}
