import { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, Lock, Play, Headphones, Video, TreePine,
  Filter, CheckCircle2, Sparkles, Heart, Star, X
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { PRACTICES, DIRECTIONS, INSTRUCTORS, LEVEL_LABELS, FORMAT_LABELS } from './data';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from './AuthContext';
import { authFetch } from './api';
import { useFavorites } from './useFavorites';

interface PracticesPageProps {
  onNavigate: (page: string) => void;
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="w-3 h-3" />,
  audio: <Headphones className="w-3 h-3" />,
  live: <Play className="w-3 h-3" />,
  outdoor: <TreePine className="w-3 h-3" />,
};

type CompletionFilter = 'all' | 'completed' | 'new' | 'favorites';
type SortOption = 'default' | 'rating' | 'duration' | 'popular';

/** Full-text search across multiple fields */
function matchesSearch(practice: typeof PRACTICES[0], query: string): boolean {
  if (!query.trim()) return true;
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
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
    LEVEL_LABELS[practice.level] || '',
    FORMAT_LABELS[practice.format] || '',
  ]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => corpus.includes(term));
}

export function PracticesPage({ onNavigate }: PracticesPageProps) {
  const { accessToken } = useAuth();
  const { favorites, isFavorite, isBouncing, toggleFavorite } = useFavorites();
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [completedPractices, setCompletedPractices] = useState<string[]>([]);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  // Load completed practices from server
  useEffect(() => {
    if (!accessToken) {
      setCompletedPractices([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch('/user-progress', accessToken);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCompletedPractices(data.completedPractices || []);
        }
      } catch (err) {
        console.error('Failed to load completed practices:', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [accessToken]);

  const filtered = useMemo(() => {
    let result = PRACTICES.filter((p) => {
      if (selectedDirection && p.direction !== selectedDirection) return false;
      if (selectedLevel && p.level !== selectedLevel) return false;
      if (selectedFormat && p.format !== selectedFormat) return false;
      if (!matchesSearch(p, searchQuery)) return false;
      if (completionFilter === 'completed' && !completedPractices.includes(p.id)) return false;
      if (completionFilter === 'new' && completedPractices.includes(p.id)) return false;
      if (completionFilter === 'favorites' && !favorites.includes(p.id)) return false;
      return true;
    });

    // Sort
    switch (sortBy) {
      case 'rating':
        result = [...result].sort((a, b) => b.rating - a.rating);
        break;
      case 'duration':
        result = [...result].sort((a, b) => a.duration - b.duration);
        break;
      case 'popular':
        result = [...result].sort((a, b) => (b.completions || 0) - (a.completions || 0));
        break;
    }

    return result;
  }, [selectedDirection, selectedLevel, selectedFormat, searchQuery, completionFilter, completedPractices, favorites, sortBy]);

  const completedCount = filtered.filter((p) => completedPractices.includes(p.id)).length;
  const favoritesInView = filtered.filter((p) => favorites.includes(p.id)).length;
  const hasActiveFilters = selectedDirection || selectedLevel || selectedFormat || completionFilter !== 'all' || searchQuery.trim();

  const clearAllFilters = () => {
    setSelectedDirection(null);
    setSelectedLevel(null);
    setSelectedFormat(null);
    setCompletionFilter('all');
    setSearchQuery('');
    setSortBy('default');
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl mb-3 text-foreground">Каталог практик</h1>
          <p className="text-muted-foreground max-w-2xl">
            Выберите практику по направлению, уровню или формату. Начните свой путь к гармонии прямо сейчас.
          </p>
        </div>

        {/* Search & Filter Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, направлению, преподавателю..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-white/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-muted/50 rounded"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 rounded-lg border border-border bg-white/60 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="default">По умолчанию</option>
              <option value="rating">По рейтингу</option>
              <option value="popular">По популярности</option>
              <option value="duration">По длительности</option>
            </select>
            <Button
              variant="outline"
              className="gap-2 sm:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              Фильтры
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className={`mb-8 space-y-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
          {/* Directions */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Направления:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDirection(null)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
                  !selectedDirection ? 'bg-primary text-primary-foreground' : 'bg-white/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                Все
              </button>
              {DIRECTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDirection(selectedDirection === d.id ? null : d.id)}
                  className="px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: selectedDirection === d.id ? d.color : d.colorLight,
                    color: selectedDirection === d.id ? 'white' : d.color,
                  }}
                >
                  {d.icon} {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Уровень:</p>
            <div className="flex flex-wrap gap-2">
              {['beginner', 'intermediate', 'advanced'].map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(selectedLevel === level ? null : level)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
                    selectedLevel === level
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Формат:</p>
            <div className="flex flex-wrap gap-2">
              {['video', 'audio', 'live', 'outdoor'].map((format) => (
                <button
                  key={format}
                  onClick={() => setSelectedFormat(selectedFormat === format ? null : format)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedFormat === format
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {FORMAT_ICONS[format]}
                  {FORMAT_LABELS[format]}
                </button>
              ))}
            </div>
          </div>

          {/* Completion + Favorites Filter */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Статус:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCompletionFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
                  completionFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                Все
              </button>
              {favorites.length > 0 && (
                <button
                  onClick={() => setCompletionFilter('favorites')}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                    completionFilter === 'favorites'
                      ? 'bg-[#E8B4A0] text-white'
                      : 'bg-white/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Heart className={`w-3 h-3 ${completionFilter === 'favorites' ? 'fill-white' : ''}`} />
                  Избранное ({favorites.length})
                </button>
              )}
              {accessToken && completedPractices.length > 0 && (
                <>
                  <button
                    onClick={() => setCompletionFilter('completed')}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                      completionFilter === 'completed'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Пройденные
                  </button>
                  <button
                    onClick={() => setCompletionFilter('new')}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                      completionFilter === 'new'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Новые
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Results count + clear */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Найдено: {filtered.length} {getPracticeWord(filtered.length)}
          </p>
          {completedCount > 0 && (
            <Badge className="text-xs border-0 bg-primary/10 text-primary gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Пройдено: {completedCount}
            </Badge>
          )}
          {favoritesInView > 0 && completionFilter !== 'favorites' && (
            <Badge className="text-xs border-0 bg-[#E8B4A0]/15 text-[#E8B4A0] gap-1">
              <Heart className="w-3 h-3 fill-[#E8B4A0]" />
              В избранном: {favoritesInView}
            </Badge>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-primary hover:underline cursor-pointer ml-auto"
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        {/* Practice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((practice) => {
            const dir = DIRECTIONS.find((d) => d.id === practice.direction);
            const isDone = completedPractices.includes(practice.id);
            const isFav = isFavorite(practice.id);
            return (
              <Card
                key={practice.id}
                className={`overflow-hidden border-0 shadow-none backdrop-blur-sm hover:shadow-md transition-all group cursor-pointer ${
                  isDone ? 'bg-white/70 ring-1 ring-primary/20' : 'bg-white/60'
                }`}
                onClick={() => onNavigate(`practice:${practice.id}`)}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <ImageWithFallback
                    src={practice.image}
                    alt={practice.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {dir && (
                      <Badge
                        className="text-xs border-0"
                        style={{ backgroundColor: dir.color, color: 'white' }}
                      >
                        {dir.icon} {dir.name}
                      </Badge>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {/* Favorite button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(practice.id);
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isFav
                          ? 'bg-[#E8B4A0] text-white shadow-md'
                          : 'bg-white/80 text-muted-foreground hover:bg-white hover:text-[#E8B4A0] opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''} ${isBouncing(practice.id) ? 'heart-bounce' : ''}`} />
                    </button>
                    {isDone && (
                      <Badge className="text-xs bg-white/90 text-primary border-0 gap-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                        Пройдено
                      </Badge>
                    )}
                    {practice.premium ? (
                      <Badge className="text-xs bg-[#C9A96E] text-white border-0 gap-1">
                        <Lock className="w-3 h-3" /> Premium
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-[#7A9B6D] text-white border-0">
                        Free
                      </Badge>
                    )}
                  </div>

                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-foreground ml-0.5" />
                    </div>
                  </div>

                  {/* Completed overlay shimmer */}
                  {isDone && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-1"
                      style={{ backgroundColor: dir?.color || '#7A9B6D' }}
                    />
                  )}
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base line-clamp-1">{practice.title}</h3>
                    {isFav && (
                      <Heart className="w-3.5 h-3.5 text-[#E8B4A0] fill-[#E8B4A0] shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{practice.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {practice.duration} мин
                    </span>
                    <span className="flex items-center gap-1">
                      {FORMAT_ICONS[practice.format]} {FORMAT_LABELS[practice.format]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-[#C9A96E]" /> {practice.rating}
                    </span>
                    <span>{LEVEL_LABELS[practice.level]}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-3">Практики не найдены. Попробуйте изменить фильтры.</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearAllFilters}>
                Сбросить все фильтры
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
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