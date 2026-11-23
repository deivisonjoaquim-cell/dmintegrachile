import { useCallback, useEffect, useState } from 'react';

const FAVORITE_PARTNERS_STORAGE_KEY = 'dm_favorite_partners_v1';

function readStoredFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_PARTNERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return [];
  }
}

export function useFavoritePartners() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readStoredFavoriteIds);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITE_PARTNERS_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [favoriteIds]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_PARTNERS_STORAGE_KEY) {
        setFavoriteIds(readStoredFavoriteIds());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isFavorite = useCallback(
    (partnerId: string) => favoriteIds.includes(partnerId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback((partnerId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(partnerId) ? prev.filter((id) => id !== partnerId) : [partnerId, ...prev],
    );
  }, []);

  const removeFavorite = useCallback((partnerId: string) => {
    setFavoriteIds((prev) => prev.filter((id) => id !== partnerId));
  }, []);

  const clearFavorites = useCallback(() => {
    setFavoriteIds([]);
  }, []);

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites,
  };
}
