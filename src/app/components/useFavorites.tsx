import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { authFetch } from './api';
import { toast } from 'sonner';

/**
 * Custom hook for managing user favorites with server persistence.
 * Provides optimistic updates, heart-bounce animation state, and loading state.
 */
export function useFavorites() {
  const { accessToken, isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load favorites from server
  useEffect(() => {
    if (!accessToken) {
      setFavorites([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const res = await authFetch('/favorites', accessToken);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setFavorites(data.favorites || []);
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [accessToken]);

  const isFavorite = useCallback(
    (practiceId: string) => favorites.includes(practiceId),
    [favorites]
  );

  /** Returns true if this practiceId should have the bounce animation */
  const isBouncing = useCallback(
    (practiceId: string) => bouncingId === practiceId,
    [bouncingId]
  );

  const toggleFavorite = useCallback(async (practiceId: string) => {
    if (!accessToken || !isAuthenticated) {
      toast.info('Войдите, чтобы добавлять практики в избранное');
      return;
    }

    const wasFavorite = favorites.includes(practiceId);

    // Trigger bounce animation
    if (!wasFavorite) {
      setBouncingId(practiceId);
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = setTimeout(() => setBouncingId(null), 600);
    }

    // Optimistic update
    setFavorites((prev) =>
      wasFavorite ? prev.filter((id) => id !== practiceId) : [...prev, practiceId]
    );

    try {
      if (wasFavorite) {
        const res = await authFetch(`/favorites/${practiceId}`, accessToken, { method: 'DELETE' });
        if (!res.ok) {
          setFavorites((prev) => [...prev, practiceId]);
          toast.error('Не удалось убрать из избранного');
          return;
        }
        toast.success('Удалено из избранного');
      } else {
        const res = await authFetch('/favorites', accessToken, {
          method: 'POST',
          body: JSON.stringify({ practiceId }),
        });
        if (!res.ok) {
          setFavorites((prev) => prev.filter((id) => id !== practiceId));
          toast.error('Не удалось добавить в избранное');
          return;
        }
        toast.success('Добавлено в избранное');
      }
    } catch (err) {
      setFavorites((prev) =>
        wasFavorite ? [...prev, practiceId] : prev.filter((id) => id !== practiceId)
      );
      console.error('Toggle favorite error:', err);
      toast.error('Ошибка подключения к серверу');
    }
  }, [accessToken, isAuthenticated, favorites]);

  return { favorites, isFavorite, isBouncing, toggleFavorite, loading, favoritesCount: favorites.length };
}
