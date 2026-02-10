import { useEffect, useRef, useCallback } from 'react';
import { getSupabase } from './api';

const KV_TABLE = 'kv_store_5b6cbf80';

type Callback = () => void;

/**
 * Subscribes to Supabase Realtime changes on the KV table.
 * When a key matching one of the provided prefixes changes, the callback fires.
 * Falls back to periodic polling if Realtime is unavailable.
 *
 * @param keyPrefixes — Array of key prefixes to watch (e.g. ["reviews:practice:5", "schedule:bookings:"])
 * @param callback — Function to call when a matching change is detected
 * @param pollIntervalMs — Fallback poll interval in ms (default: 15000)
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

    const supabase = getSupabase();
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let realtimeActive = false;

    // Try Supabase Realtime subscription
    const channelName = `kv-watch-${prefixesKey.slice(0, 30)}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: KV_TABLE,
        },
        (payload: any) => {
          const changedKey = payload?.new?.key || payload?.old?.key || '';
          const prefixes = prefixesKey.split(',');
          if (prefixes.some((p) => changedKey.startsWith(p))) {
            callbackRef.current();
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          realtimeActive = true;
          // Clear poll timer if realtime works
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          realtimeActive = false;
          // Start polling as fallback
          if (!pollTimer) {
            pollTimer = setInterval(() => callbackRef.current(), pollIntervalMs);
          }
        }
      });

    // Start polling immediately as a safety net; will be cleared if realtime kicks in
    pollTimer = setInterval(() => {
      if (!realtimeActive) {
        callbackRef.current();
      }
    }, pollIntervalMs);

    return () => {
      supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [prefixesKey, pollIntervalMs]);
}

/**
 * A lightweight variant: simple periodic polling without Realtime.
 * Useful when you just need auto-refresh.
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
