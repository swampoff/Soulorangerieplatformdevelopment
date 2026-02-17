import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Clock, Flame, TrendingUp, Calendar, Settings,
  ChevronRight, Bell, Loader2, Sparkles, Heart
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BalanceWheel } from './BalanceWheel';
import { DIRECTIONS, PRACTICES, SCHEDULE_EVENTS } from './data';
import { useAuth } from './AuthContext';
import { authFetch } from './api';
import { useFavorites } from './useFavorites';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

interface UserProgress {
  scores: Record<string, number>;
  practiceCount: number;
  totalMinutes: number;
  streakDays: number;
  completedPractices: string[];
  achievements: { id: string; title: string; desc: string; icon: string; earned: boolean }[];
  weeklyActivity: { day: string; minutes: number }[];
  directionProgress: Record<string, number>;
}

const DEFAULT_ACTIVITY = [
  { day: 'Пн', minutes: 0 },
  { day: 'Вт', minutes: 0 },
  { day: 'Ср', minutes: 0 },
  { day: 'Чт', minutes: 0 },
  { day: 'Пт', minutes: 0 },
  { day: 'Сб', minutes: 0 },
  { day: 'Вс', minutes: 0 },
];

const PLAN_NAMES: Record<string, string> = {
  free: 'Бесплатный',
  basic: 'Базовый',
  premium: 'Премиум',
  unlimited: 'Безлимит',
};

function computeAchievements(p: UserProgress) {
  const dp = p.directionProgress || {};
  const directionsUsed = Object.keys(dp).filter((k) => dp[k] > 0).length;
  const uniqueCount = p.completedPractices?.length || 0;
  return [
    { id: '1', title: 'Первый шаг', desc: 'Прошли первую практику', icon: '🌱', earned: p.practiceCount >= 1, current: Math.min(p.practiceCount, 1), target: 1, color: '#7A9B6D' },
    { id: '2', title: '7 дней подряд', desc: 'Практика каждый день неделю', icon: '🔥', earned: p.streakDays >= 7, current: Math.min(p.streakDays, 7), target: 7, color: '#D4A574' },
    { id: '3', title: 'Голос открыт', desc: '10 практик по голосу', icon: '🎵', earned: (dp.voice || 0) >= 10, current: Math.min(dp.voice || 0, 10), target: 10, color: '#A8C5DA' },
    { id: '4', title: 'Водный мастер', desc: '10 практик с водой', icon: '💧', earned: (dp.water || 0) >= 10, current: Math.min(dp.water || 0, 10), target: 10, color: '#A8C5DA' },
    { id: '5', title: 'Поток энергии', desc: '20 практик цигуна', icon: '✨', earned: (dp.energy || 0) >= 20, current: Math.min(dp.energy || 0, 20), target: 20, color: '#C4B5D4' },
    { id: '6', title: '30 дней подряд', desc: 'Месяц без пропусков', icon: '🏆', earned: p.streakDays >= 30, current: Math.min(p.streakDays, 30), target: 30, color: '#C9A96E' },
    { id: '7', title: 'Исследователь', desc: 'Практики в 3+ направлениях', icon: '🧭', earned: directionsUsed >= 3, current: Math.min(directionsUsed, 3), target: 3, color: '#7A9B6D' },
    { id: '8', title: 'Марафонец', desc: '100+ минут практик', icon: '⏱️', earned: p.totalMinutes >= 100, current: Math.min(p.totalMinutes, 100), target: 100, color: '#D4A574' },
    { id: '9', title: 'Многогранность', desc: '5+ уникальных практик', icon: '💎', earned: uniqueCount >= 5, current: Math.min(uniqueCount, 5), target: 5, color: '#C4B5D4' },
    { id: '10', title: 'Мастер', desc: '50 завершённых практик', icon: '👑', earned: p.practiceCount >= 50, current: Math.min(p.practiceCount, 50), target: 50, color: '#C9A96E' },
  ];
}

/** Smart recommendations: prefers favorite directions, excludes completed */
function getSmartRecommendations(favIds: string[], completedIds: string[]) {
  const favDirs = new Set<string>();
  favIds.forEach((id) => {
    const p = PRACTICES.find((pr) => pr.id === id);
    if (p) favDirs.add(p.direction);
  });
  const exclude = new Set([...favIds, ...completedIds]);
  const recs = PRACTICES
    .filter((p) => !exclude.has(p.id) && (favDirs.size === 0 || favDirs.has(p.direction)))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
  if (recs.length < 3) {
    const more = PRACTICES.filter((p) => !exclude.has(p.id) && !recs.find((r) => r.id === p.id))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3 - recs.length);
    recs.push(...more);
  }
  return recs;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, accessToken } = useAuth();
  const { favorites, isFavorite, toggleFavorite, isBouncing } = useFavorites();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [myBookings, setMyBookings] = useState<{ eventId: string; title: string; date: string; time: string }[]>([]);

  const firstName = user?.name?.split(' ')[0] || 'Гость';

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const loadData = async () => {
      try {
        const [progressRes, bookingsRes] = await Promise.all([
          authFetch('/user-progress', accessToken),
          authFetch('/my-bookings', accessToken),
        ]);
        if (!cancelled) {
          if (progressRes.ok) {
            const data = await progressRes.json();
            setProgress(data);
          }
          if (bookingsRes.ok) {
            const data = await bookingsRes.json();
            setMyBookings(data.bookings || []);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [accessToken]);

  const upcomingEvents = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (myBookings.length > 0) {
      const upcoming = myBookings
        .filter((b) => b.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      if (upcoming.length > 0) {
        return upcoming.slice(0, 3).map((b) => {
          const event = SCHEDULE_EVENTS.find((e) => e.id === b.eventId);
          return event || { id: b.eventId, title: b.title, date: b.date, time: b.time, direction: '', instructor: '', duration: 0, spots: 0, maxSpots: 0 };
        });
      }
    }
    return SCHEDULE_EVENTS.filter((e) => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [myBookings]);

  const scores = progress?.scores || {};
  const hasScores = Object.keys(scores).length > 0 && Object.values(scores).some((v) => v > 0);
  const directionProgress = progress?.directionProgress || {};
  const activity = progress?.weeklyActivity?.length ? progress.weeklyActivity : DEFAULT_ACTIVITY;

  const stats = useMemo(() => ({
    practiceCount: progress?.practiceCount || 0,
    totalMinutes: progress?.totalMinutes || 0,
    streakDays: progress?.streakDays || 0,
    level: PLAN_NAMES[user?.plan || 'free'] || 'Бесплатный',
  }), [progress, user?.plan]);

  const achievements = useMemo(() => {
    if (!progress) return computeAchievements({ scores: {}, practiceCount: 0, totalMinutes: 0, streakDays: 0, completedPractices: [], achievements: [], weeklyActivity: [], directionProgress: {} });
    return computeAchievements(progress);
  }, [progress]);

  const recentPractices = useMemo(() => {
    const completed = progress?.completedPractices || [];
    if (completed.length > 0) {
      return completed.map((id) => PRACTICES.find((p) => p.id === id)).filter(Boolean).slice(0, 3) as typeof PRACTICES;
    }
    return PRACTICES.slice(0, 3);
  }, [progress]);

  const monthlySummary = useMemo(() => {
    const totalHours = (stats.totalMinutes / 60).toFixed(1);
    const avgDuration = stats.practiceCount > 0 ? Math.round(stats.totalMinutes / stats.practiceCount) : 0;
    let favDir = '-';
    let maxP = 0;
    DIRECTIONS.forEach((d) => {
      const c = directionProgress[d.id] || 0;
      if (c > maxP) { maxP = c; favDir = d.name; }
    });
    return { totalHours, avgDuration, favDir, favDirCount: maxP };
  }, [stats, directionProgress]);

  const smartRecs = useMemo(() => getSmartRecommendations(favorites, progress?.completedPractices || []), [favorites, progress]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-background">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Загружаем ваш прогресс...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl text-foreground">Добрый день, {firstName}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats.streakDays > 0
                ? `Ваш путь гармонии продолжается. Сегодня — ${stats.streakDays}-й день подряд!`
                : 'Начните свой путь гармонии — пройдите диагностику или выберите практику.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onNavigate('profile-settings')}><Bell className="w-4 h-4" /><span className="hidden sm:inline">Уведомления</span></Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => onNavigate('profile-settings')}><Settings className="w-4 h-4" /><span className="hidden sm:inline">Настройки</span></Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/60">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="progress">Прогресс</TabsTrigger>
            <TabsTrigger value="achievements">Достижения</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Практик пройдено', value: stats.practiceCount, icon: BookOpen, color: '#7A9B6D' },
                { label: 'Минут занятий', value: stats.totalMinutes, icon: Clock, color: '#A8C5DA' },
                { label: 'Дней подряд', value: stats.streakDays, icon: Flame, color: '#D4A574' },
                { label: 'Подписка', value: stats.level, icon: TrendingUp, color: '#C4B5D4' },
              ].map((stat) => (
                <Card key={stat.label} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <p className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      {typeof stat.value === 'number' ? stat.value.toLocaleString('ru-RU') : stat.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Balance Wheel */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg">Колесо баланса</h3>
                    <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onNavigate('diagnostic')}>
                      {hasScores ? 'Обновить' : 'Пройти'}
                    </Button>
                  </div>
                  {hasScores ? (
                    <div className="flex justify-center"><BalanceWheel scores={scores} size={280} /></div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7A9B6D]/20 via-[#A8C5DA]/20 to-[#C4B5D4]/20 flex items-center justify-center text-3xl mb-4">
                        <Sparkles className="w-7 h-7 text-primary/60" />
                      </div>
                      <p className="text-sm text-muted-foreground max-w-xs">Пройдите диагностику, чтобы увидеть ваше колесо баланса</p>
                      <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={() => onNavigate('diagnostic')}>Пройти диагностику</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent & Upcoming */}
              <div className="space-y-6">
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />{myBookings.length > 0 ? 'Ваши записи' : 'Ближайшие сессии'}</h3>
                      <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onNavigate('schedule')}>Все <ChevronRight className="w-3 h-3" /></Button>
                    </div>
                    <div className="space-y-2">
                      {upcomingEvents.map((s) => {
                        const dir = DIRECTIONS.find((d) => d.id === s.direction);
                        return (
                          <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onNavigate('schedule')}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: dir?.colorLight }}>{dir?.icon}</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm truncate">{s.title}</p>
                              <p className="text-xs text-muted-foreground">{s.date} в {s.time}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />{(progress?.completedPractices?.length || 0) > 0 ? 'Последние практики' : 'Рекомендуемые'}</h3>
                      <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onNavigate('practices')}>Все <ChevronRight className="w-3 h-3" /></Button>
                    </div>
                    <div className="space-y-2">
                      {recentPractices.map((p) => {
                        const dir = DIRECTIONS.find((d) => d.id === p.direction);
                        return (
                          <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onNavigate(`practice:${p.id}`)}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: dir?.colorLight }}>{dir?.icon}</div>
                            <div className="min-w-0 flex-1"><p className="text-sm truncate">{p.title}</p><p className="text-xs text-muted-foreground">{p.duration} мин</p></div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Favorites */}
            {favorites.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg flex items-center gap-2">
                    <Heart className="w-5 h-5 text-[#E8B4A0]" />
                    Избранные практики ({favorites.length})
                  </h3>
                  <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onNavigate('practices')}>
                    Все <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.slice(0, 6).map((favId) => {
                    const p = PRACTICES.find((pr) => pr.id === favId);
                    if (!p) return null;
                    const dir = DIRECTIONS.find((d) => d.id === p.direction);
                    return (
                      <Card key={p.id} className="border-0 shadow-none bg-white/60 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate(`practice:${p.id}`)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: dir?.colorLight }}>{dir?.icon}</div>
                              <div className="min-w-0">
                                <h4 className="text-sm truncate">{p.title}</h4>
                                <p className="text-xs text-muted-foreground">{p.duration} мин &middot; {dir?.name}</p>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }} className="shrink-0 cursor-pointer p-1">
                              <Heart className={`w-4 h-4 text-[#E8B4A0] fill-[#E8B4A0] ${isBouncing(p.id) ? 'heart-bounce' : ''}`} />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Smart Recommendations */}
            <div className="mt-8">
              <h3 className="text-lg mb-4 flex items-center gap-2">
                {favorites.length > 0 ? (
                  <><Sparkles className="w-5 h-5 text-[#C9A96E]" /> Рекомендации на основе избранного</>
                ) : (
                  'Рекомендации для вас'
                )}
              </h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {smartRecs.map((p) => {
                  const dir = DIRECTIONS.find((d) => d.id === p.direction);
                  return (
                    <Card key={p.id} className="border-0 shadow-none bg-white/60 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate(`practice:${p.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="text-xs border-0" style={{ backgroundColor: dir?.colorLight, color: dir?.color }}>{dir?.icon} {dir?.name}</Badge>
                          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }} className="cursor-pointer p-0.5">
                            <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite(p.id) ? 'text-[#E8B4A0] fill-[#E8B4A0]' : 'text-muted-foreground hover:text-[#E8B4A0]'} ${isBouncing(p.id) ? 'heart-bounce' : ''}`} />
                          </button>
                        </div>
                        <h4 className="text-sm mb-1">{p.title}</h4>
                        <p className="text-xs text-muted-foreground">{p.duration} мин</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* PROGRESS */}
          <TabsContent value="progress">
            <div className="grid lg:grid-cols-2 gap-8">
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-6">Активность за неделю</h3>
                  <div className="flex items-end gap-3 h-40">
                    {activity.map((day) => {
                      const height = day.minutes > 0 ? Math.max((day.minutes / 60) * 100, 8) : 4;
                      return (
                        <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-xs text-muted-foreground">{day.minutes}м</span>
                          <div className="w-full rounded-t-lg transition-all" style={{ height: `${height}%`, background: day.minutes > 0 ? 'linear-gradient(to top, #7A9B6D, #A8C5DA)' : '#E8DFD0' }} />
                          <span className="text-xs text-muted-foreground">{day.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-6">Прогресс по направлениям</h3>
                  <div className="space-y-4">
                    {DIRECTIONS.map((d) => {
                      const practicesDone = directionProgress[d.id] || 0;
                      const percent = Math.min((practicesDone / 20) * 100, 100);
                      return (
                        <div key={d.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm flex items-center gap-2"><span>{d.icon}</span> {d.name}</span>
                            <span className="text-xs text-muted-foreground">{practicesDone}/20</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: d.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
              {[
                { label: 'Всего практик', value: `${stats.practiceCount}`, sub: stats.practiceCount > 0 ? 'Продолжайте!' : 'Начните сегодня', color: '#7A9B6D' },
                { label: 'Общее время', value: `${monthlySummary.totalHours} ч`, sub: `${stats.totalMinutes} мин`, color: '#A8C5DA' },
                { label: 'Любимое направление', value: monthlySummary.favDir, sub: monthlySummary.favDirCount > 0 ? `${monthlySummary.favDirCount} практик` : 'Пока нет данных', color: '#C4B5D4' },
                { label: 'Средняя длительность', value: monthlySummary.avgDuration > 0 ? `${monthlySummary.avgDuration} мин` : '-', sub: monthlySummary.avgDuration > 0 ? 'За практику' : 'Пока нет данных', color: '#D4A574' },
              ].map((item) => (
                <Card key={item.label} className="border-0 shadow-none bg-white/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: item.color }}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ACHIEVEMENTS */}
          <TabsContent value="achievements">
            <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A96E]/20 to-[#7A9B6D]/20 flex items-center justify-center text-lg"><Sparkles className="w-5 h-5 text-[#C9A96E]" /></div>
                    <div>
                      <p className="text-sm font-medium">{achievements.filter((a) => a.earned).length} из {achievements.length} достижений</p>
                      <p className="text-xs text-muted-foreground">{achievements.filter((a) => a.earned).length === achievements.length ? 'Все получены!' : `Ещё ${achievements.filter((a) => !a.earned).length} впереди`}</p>
                    </div>
                  </div>
                  <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(achievements.filter((a) => a.earned).length / achievements.length) * 100}%`, background: 'linear-gradient(to right, #7A9B6D, #C9A96E)' }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((a) => {
                const percent = a.target > 0 ? Math.round((a.current / a.target) * 100) : 0;
                return (
                  <Card key={a.id} className={`border-0 shadow-none transition-all ${a.earned ? 'bg-white/80' : 'bg-white/40'}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all ${a.earned ? 'scale-100' : 'grayscale-[50%] opacity-70'}`} style={{ backgroundColor: a.earned ? `${a.color}15` : '#f5f0eb' }}>{a.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-medium truncate">{a.title}</h4>
                            {a.earned && <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-1.5 py-0 shrink-0">Получено</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2.5">{a.desc}</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">{a.current}/{a.target}</span>
                              <span className="text-[10px] font-medium" style={{ color: a.earned ? a.color : '#9ca3af' }}>{percent}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: a.earned ? a.color : `${a.color}80` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-10">
              <h3 className="text-lg mb-4">Бейджи по направлениям</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {DIRECTIONS.map((d) => {
                  const count = directionProgress[d.id] || 0;
                  const level = count >= 16 ? 3 : count >= 6 ? 2 : count >= 1 ? 1 : 0;
                  return (
                    <Card key={d.id} className="border-0 shadow-none bg-white/60">
                      <CardContent className="p-4 text-center">
                        <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-xl" style={{ backgroundColor: d.colorLight }}>{d.icon}</div>
                        <p className="text-xs mb-1" style={{ color: d.color }}>{d.name}</p>
                        <div className="flex justify-center gap-0.5">
                          {[1, 2, 3].map((l) => (
                            <div key={l} className="w-2 h-2 rounded-full" style={{ backgroundColor: l <= level ? d.color : '#E8DFD0' }} />
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{count} практик</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}