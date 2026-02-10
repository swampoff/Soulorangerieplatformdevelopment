import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Clock, Star, Lock, Play, Headphones, TreePine, Video, Heart, X, History, TrendingUp, Sparkles } from 'lucide-react';
import { PRACTICES, DIRECTIONS, INSTRUCTORS, LEVEL_LABELS, FORMAT_LABELS } from './data';
import { Badge } from './ui/badge';
import { useAuth } from './AuthContext';
import { authFetch } from './api';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  favorites?: string[];
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="w-3 h-3" />,
  audio: <Headphones className="w-3 h-3" />,
  live: <Play className="w-3 h-3" />,
  outdoor: <TreePine className="w-3 h-3" />,
};

/**
 * Full-text search across practice title, description, fullDescription,
 * instructor name, direction name, and direction topics.
 */
function searchPractices(query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);

  const scored = PRACTICES.map((practice) => {
    const dir = DIRECTIONS.find((d) => d.id === practice.direction);
    const instructor = INSTRUCTORS.find((i) => i.id === practice.instructorId);

    const corpus = [
      practice.title,
      practice.description,
      practice.fullDescription || '',
      dir?.name || '',
      dir?.description || '',
      ...(dir?.topics || []),
      instructor?.name || '',
      instructor?.bio || '',
      LEVEL_LABELS[practice.level] || '',
      FORMAT_LABELS[practice.format] || '',
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    let allMatch = true;
    for (const term of terms) {
      if (corpus.includes(term)) {
        if (practice.title.toLowerCase().includes(term)) score += 10;
        else if (dir?.name.toLowerCase().includes(term)) score += 7;
        else if (instructor?.name.toLowerCase().includes(term)) score += 6;
        else if (practice.description.toLowerCase().includes(term)) score += 4;
        else score += 2;
      } else {
        allMatch = false;
      }
    }

    return { practice, score, allMatch };
  })
    .filter((r) => r.score > 0 && r.allMatch)
    .sort((a, b) => b.score - a.score);

  return scored.map((r) => r.practice);
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/** Smart recommendations based on favorites */
function getRecommendations(favorites: string[]) {
  if (favorites.length === 0) {
    // Show top-rated practices
    return [...PRACTICES].sort((a, b) => b.rating - a.rating).slice(0, 5);
  }

  // Find common directions from favorites
  const favPractices = favorites.map((id) => PRACTICES.find((p) => p.id === id)).filter(Boolean);
  const directionCounts: Record<string, number> = {};
  for (const p of favPractices) {
    if (p) directionCounts[p.direction] = (directionCounts[p.direction] || 0) + 1;
  }

  // Sort directions by count
  const topDirs = Object.entries(directionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([dir]) => dir);

  // Get practices from those directions that are NOT already in favorites
  const favSet = new Set(favorites);
  const recs = PRACTICES.filter((p) => !favSet.has(p.id) && topDirs.includes(p.direction))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  // Fill up with top-rated practices if not enough
  if (recs.length < 5) {
    const more = PRACTICES.filter((p) => !favSet.has(p.id) && !recs.includes(p))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5 - recs.length);
    recs.push(...more);
  }

  return recs;
}

export function SearchPalette({ open, onClose, onNavigate, favorites = [] }: SearchPaletteProps) {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => searchPractices(query), [query]);
  const recommendations = useMemo(() => getRecommendations(favorites), [favorites]);

  // Load search history
  useEffect(() => {
    if (!open || !accessToken) return;
    authFetch('/search-history', accessToken)
      .then((res) => res.ok ? res.json() : { history: [] })
      .then((data) => setSearchHistory(data.history || []))
      .catch(() => {});
  }, [open, accessToken]);

  // Record search query (debounced)
  const recordSearch = useCallback((q: string) => {
    if (!accessToken || !q.trim()) return;
    authFetch('/search-history', accessToken, {
      method: 'POST',
      body: JSON.stringify({ query: q.trim() }),
    }).catch(() => {});
  }, [accessToken]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open, onClose]);

  // Debounce search recording
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim() && results.length > 0) {
      debounceRef.current = setTimeout(() => recordSearch(query), 1500);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, results.length, recordSearch]);

  if (!open) return null;

  const handleSelect = (practiceId: string) => {
    if (query.trim()) recordSearch(query);
    onNavigate(`practice:${practiceId}`);
    onClose();
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    // No need to clear server side, it's just visual
  };

  const showEmptyState = !query.trim();
  const showNoResults = query.trim() && results.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed top-[10%] left-1/2 -translate-x-1/2 w-[min(600px,90vw)] bg-card border border-border rounded-2xl shadow-2xl z-[61] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск практик по названию, направлению, преподавателю..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="cursor-pointer p-1 hover:bg-muted/50 rounded">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {showEmptyState ? (
            <div className="py-2">
              {/* Search history */}
              {searchHistory.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between px-4 py-1.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <History className="w-3 h-3" /> Недавние запросы
                    </p>
                    <button
                      onClick={clearHistory}
                      className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Очистить
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                    {searchHistory.slice(0, 8).map((h, i) => (
                      <button
                        key={`${h}-${i}`}
                        onClick={() => handleHistoryClick(h)}
                        className="px-2.5 py-1 rounded-full text-xs bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations based on favorites */}
              <div>
                <p className="px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                  {favorites.length > 0 ? (
                    <><Sparkles className="w-3 h-3" /> Рекомендации на основе избранного</>
                  ) : (
                    <><TrendingUp className="w-3 h-3" /> Популярные практики</>
                  )}
                </p>
                {recommendations.map((practice) => {
                  const dir = DIRECTIONS.find((d) => d.id === practice.direction);
                  const isFav = favorites.includes(practice.id);
                  return (
                    <button
                      key={practice.id}
                      onClick={() => handleSelect(practice.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer flex items-center gap-3"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: dir?.colorLight }}
                      >
                        {dir?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm truncate">{practice.title}</p>
                          {isFav && <Heart className="w-3 h-3 text-[#E8B4A0] fill-[#E8B4A0] shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {practice.duration} мин &middot; {dir?.name} &middot;
                          <Star className="w-2.5 h-2.5 text-[#C9A96E] inline ml-1" /> {practice.rating}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : showNoResults ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Ничего не найдено по запросу «{query}»
            </div>
          ) : (
            <div className="py-2">
              <p className="px-4 py-1.5 text-xs text-muted-foreground">
                Найдено: {results.length} {getPracticeWord(results.length)}
              </p>
              {results.slice(0, 20).map((practice) => {
                const dir = DIRECTIONS.find((d) => d.id === practice.direction);
                const instructor = INSTRUCTORS.find((i) => i.id === practice.instructorId);
                const isFav = favorites.includes(practice.id);
                return (
                  <button
                    key={practice.id}
                    onClick={() => handleSelect(practice.id)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer flex items-start gap-3 border-b border-border/30 last:border-0"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
                      style={{ backgroundColor: dir?.colorLight }}
                    >
                      {dir?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm truncate">
                          {highlightMatch(practice.title, query)}
                        </p>
                        {isFav && <Heart className="w-3 h-3 text-[#E8B4A0] fill-[#E8B4A0] shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {highlightMatch(practice.description, query)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        {dir && (
                          <Badge
                            className="text-[9px] px-1.5 py-0 border-0"
                            style={{ backgroundColor: dir.colorLight, color: dir.color }}
                          >
                            {dir.name}
                          </Badge>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {practice.duration} мин
                        </span>
                        <span className="flex items-center gap-0.5">
                          {FORMAT_ICONS[practice.format]} {FORMAT_LABELS[practice.format]}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-[#C9A96E]" /> {practice.rating}
                        </span>
                        {instructor && (
                          <span className="truncate">{highlightMatch(instructor.name, query)}</span>
                        )}
                        {practice.premium && (
                          <span className="flex items-center gap-0.5 text-[#C9A96E]">
                            <Lock className="w-2.5 h-2.5" /> Premium
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Полнотекстовый поиск по {PRACTICES.length} практикам</span>
          <span className="hidden sm:inline">
            <kbd className="bg-muted/50 px-1 py-0.5 rounded border border-border mr-1">Ctrl</kbd>+
            <kbd className="bg-muted/50 px-1 py-0.5 rounded border border-border ml-1">K</kbd>
          </span>
        </div>
      </div>
    </>
  );
}

function getPracticeWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'практик';
  if (last === 1) return 'практика';
  if (last >= 2 && last <= 4) return 'практики';
  return 'практик';
}
