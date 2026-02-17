import { useState, useEffect, useCallback } from 'react';
import {
  Users, Calendar, Star, TrendingUp, Plus,
  Clock, Eye, MessageSquare, Video,
  BarChart3, Edit, Radio, Loader2, ChevronDown, ChevronUp, Send
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import {
  PRACTICES, DIRECTIONS, INSTRUCTORS, SCHEDULE_EVENTS,
  LEVEL_LABELS, FORMAT_LABELS
} from './data';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from './AuthContext';
import { authFetch } from './api';

interface InstructorPanelPageProps {
  onNavigate: (page: string) => void;
}

interface ReviewData {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  practiceId: string;
  practiceTitle: string;
  createdAt: string;
  reply?: {
    text: string;
    authorName: string;
    authorId: string;
    createdAt: string;
  };
}

interface StudentData {
  id: string;
  name: string;
  email: string;
  plan: string;
}

interface InstructorStats {
  totalReviews: number;
  avgRating: number;
  totalEnrolled: number;
  enrollmentByEvent: Record<string, number>;
  recentReviews: ReviewData[];
}

const WEEKLY_ACTIVITY = [
  { day: 'Пн', students: 42 },
  { day: 'Вт', students: 58 },
  { day: 'Ср', students: 35 },
  { day: 'Чт', students: 67 },
  { day: 'Пт', students: 51 },
  { day: 'Сб', students: 73 },
  { day: 'Вс', students: 29 },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  basic: 'Базовый',
  premium: 'Премиум',
  unlimited: 'Безлимит',
};

export function InstructorPanelPage({ onNavigate }: InstructorPanelPageProps) {
  const { user, accessToken } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPractice, setNewPractice] = useState({
    title: '',
    description: '',
    direction: '',
    level: '',
    format: '',
    duration: '',
  });

  // Real data state
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStudents, setSessionStudents] = useState<Record<string, StudentData[]>>({});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState<Set<string>>(new Set());

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Determine the instructor from the user profile
  const currentInstructor = INSTRUCTORS.find(
    (i) => i.name === user?.name
  ) || INSTRUCTORS[0];

  const myPractices = PRACTICES.filter((p) => p.instructorId === currentInstructor.id);
  const mySessions = SCHEDULE_EVENTS.filter((s) => s.instructor === currentInstructor.name);

  // Load instructor stats from server
  const loadStats = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const practiceIds = myPractices.map((p) => p.id).join(',');
      const eventIds = mySessions.map((s) => s.id).join(',');
      const res = await authFetch(
        `/instructor/stats?practiceIds=${practiceIds}&eventIds=${eventIds}`,
        accessToken
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        console.error('Failed to load instructor stats');
      }
    } catch (err) {
      console.error('Load instructor stats error:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Load enrolled students for a session
  const loadSessionStudents = async (eventId: string) => {
    if (sessionStudents[eventId] || !accessToken) return;
    setLoadingStudents((prev) => new Set([...prev, eventId]));
    try {
      const res = await authFetch(`/instructor/session-students/${eventId}`, accessToken);
      if (res.ok) {
        const data = await res.json();
        setSessionStudents((prev) => ({ ...prev, [eventId]: data.students || [] }));
      }
    } catch (err) {
      console.error('Load session students error:', err);
    } finally {
      setLoadingStudents((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const toggleSessionExpand = (eventId: string) => {
    if (expandedSession === eventId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(eventId);
      loadSessionStudents(eventId);
    }
  };

  const handleCreatePractice = () => {
    if (!newPractice.title || !newPractice.direction) {
      toast.error('Заполните обязательные поля');
      return;
    }
    toast.success(`Практика «${newPractice.title}» создана и отправлена на модерацию`);
    setShowCreateForm(false);
    setNewPractice({ title: '', description: '', direction: '', level: '', format: '', duration: '' });
  };

  // Handle reply to review
  const handleReplySubmit = async (reviewId: string, practiceId: string) => {
    if (!accessToken || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await authFetch(`/reviews/${practiceId}/${reviewId}/reply`, accessToken, {
        method: 'POST',
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (res.ok) {
        toast.success('Ответ отправлен! Ученик получит уведомление.');
        setReplyingTo(null);
        setReplyText('');
        // Refresh stats to get updated reviews
        loadStats();
      } else {
        const data = await res.json();
        console.error('Reply error:', data.error);
        toast.error(data.error || 'Не удалось отправить ответ');
      }
    } catch (err) {
      console.error('Reply error:', err);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Derived values
  const totalReviews = stats?.totalReviews ?? 0;
  const avgRating = stats?.avgRating ?? 0;
  const totalEnrolled = stats?.totalEnrolled ?? 0;
  const recentReviews = stats?.recentReviews ?? [];
  const enrollmentByEvent = stats?.enrollmentByEvent ?? {};
  const totalCompletions = myPractices.reduce((s, p) => s + (p.completions || 0), 0);
  const positivePercent = totalReviews > 0
    ? Math.round((recentReviews.filter((r) => r.rating >= 4).length / Math.min(recentReviews.length, 20)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-background">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Загружаем данные панели...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 mt-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
              <ImageWithFallback
                src={currentInstructor.image}
                alt={currentInstructor.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl text-foreground">Панель преподавателя</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentInstructor.name} — {currentInstructor.specializations
                  .map((s) => DIRECTIONS.find((d) => d.id === s)?.name)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="w-4 h-4" />
            Новая практика
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/60">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="practices">Мои практики</TabsTrigger>
            <TabsTrigger value="schedule">Расписание</TabsTrigger>
            <TabsTrigger value="feedback">Отзывы</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Записано на сессии', value: totalEnrolled, icon: Users, color: '#7A9B6D' },
                { label: 'Отзывов', value: totalReviews, icon: MessageSquare, color: '#C4B5D4' },
                { label: 'Средний рейтинг', value: avgRating > 0 ? avgRating.toFixed(2) : '—', icon: Star, color: '#C9A96E' },
                { label: 'Прохождений', value: totalCompletions, icon: Eye, color: '#E8B4A0' },
                { label: 'Живых сессий', value: mySessions.length, icon: Radio, color: '#D4A574' },
                { label: 'Мои практики', value: myPractices.length, icon: Video, color: '#A8C5DA' },
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
              {/* Activity chart */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Активность учеников за неделю
                  </h3>
                  <div className="flex items-end gap-3 h-40">
                    {WEEKLY_ACTIVITY.map((day) => {
                      const maxVal = Math.max(...WEEKLY_ACTIVITY.map((d) => d.students));
                      const height = Math.max((day.students / maxVal) * 100, 8);
                      return (
                        <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-xs text-muted-foreground">{day.students}</span>
                          <div
                            className="w-full rounded-t-lg transition-all"
                            style={{
                              height: `${height}%`,
                              background: 'linear-gradient(to top, #7A9B6D, #A8C5DA)',
                            }}
                          />
                          <span className="text-xs text-muted-foreground">{day.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Popular practices */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Популярные практики
                  </h3>
                  <div className="space-y-3">
                    {[...myPractices].sort((a, b) => (b.completions || 0) - (a.completions || 0)).map((p) => {
                      const pDir = DIRECTIONS.find((d) => d.id === p.direction);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => onNavigate(`practice:${p.id}`)}
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                            <ImageWithFallback
                              src={p.image}
                              alt={p.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{p.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-[#C9A96E]" /> {p.rating}
                              </span>
                              <span>{p.completions?.toLocaleString('ru-RU')} прох.</span>
                            </div>
                          </div>
                          <Badge
                            className="text-[10px] border-0 shrink-0"
                            style={{ backgroundColor: pDir?.colorLight, color: pDir?.color }}
                          >
                            {pDir?.icon}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent feedback from server */}
            {recentReviews.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg mb-4">Последние отзывы</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {recentReviews.slice(0, 4).map((fb) => (
                    <Card key={fb.id} className="border-0 shadow-none bg-white/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm">{fb.userName}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${s <= fb.rating ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-muted'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{fb.practiceTitle}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{fb.text}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(fb.createdAt).toLocaleDateString('ru-RU')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* MY PRACTICES */}
          <TabsContent value="practices">
            {/* Create form */}
            {showCreateForm && (
              <Card className="border-0 shadow-none bg-white/80 backdrop-blur-sm mb-6">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-4">Создать новую практику</h3>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
                      <Input
                        placeholder="Название практики"
                        value={newPractice.title}
                        onChange={(e) => setNewPractice({ ...newPractice, title: e.target.value })}
                        className="bg-white/60"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Направление *</label>
                      <Select
                        value={newPractice.direction}
                        onValueChange={(v) => setNewPractice({ ...newPractice, direction: v })}
                      >
                        <SelectTrigger className="bg-white/60">
                          <SelectValue placeholder="Выберите направление" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentInstructor.specializations.map((specId) => {
                            const d = DIRECTIONS.find((dir) => dir.id === specId);
                            return d ? (
                              <SelectItem key={d.id} value={d.id}>
                                {d.icon} {d.name}
                              </SelectItem>
                            ) : null;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Уровень</label>
                      <Select
                        value={newPractice.level}
                        onValueChange={(v) => setNewPractice({ ...newPractice, level: v })}
                      >
                        <SelectTrigger className="bg-white/60">
                          <SelectValue placeholder="Уровень" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Формат</label>
                      <Select
                        value={newPractice.format}
                        onValueChange={(v) => setNewPractice({ ...newPractice, format: v })}
                      >
                        <SelectTrigger className="bg-white/60">
                          <SelectValue placeholder="Формат" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Длительность (мин)</label>
                      <Input
                        type="number"
                        placeholder="30"
                        value={newPractice.duration}
                        onChange={(e) => setNewPractice({ ...newPractice, duration: e.target.value })}
                        className="bg-white/60"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                    <Textarea
                      placeholder="Подробное описание практики..."
                      value={newPractice.description}
                      onChange={(e) => setNewPractice({ ...newPractice, description: e.target.value })}
                      className="bg-white/60 min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreatePractice}>Создать практику</Button>
                    <Button variant="outline" onClick={() => setShowCreateForm(false)}>Отмена</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Practices list */}
            <div className="space-y-3">
              {myPractices.map((practice) => {
                const pDir = DIRECTIONS.find((d) => d.id === practice.direction);
                return (
                  <Card
                    key={practice.id}
                    className="border-0 shadow-none bg-white/60 backdrop-blur-sm hover:shadow-md transition-all"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
                          <ImageWithFallback
                            src={practice.image}
                            alt={practice.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="text-sm">{practice.title}</h4>
                            {pDir && (
                              <Badge
                                className="text-[10px] border-0"
                                style={{ backgroundColor: pDir.colorLight, color: pDir.color }}
                              >
                                {pDir.icon} {pDir.name}
                              </Badge>
                            )}
                            {practice.premium && (
                              <Badge className="text-[10px] bg-[#C9A96E] text-white border-0">Premium</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{practice.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {practice.duration} мин
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-[#C9A96E]" /> {practice.rating}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {practice.completions?.toLocaleString('ru-RU')}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> {practice.reviewCount}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onNavigate(`practice:${practice.id}`)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toast.info('Редактирование практики')}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {myPractices.length === 0 && (
                <div className="text-center py-12">
                  <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">У вас пока нет практик</p>
                  <Button className="mt-3" onClick={() => setShowCreateForm(true)}>
                    Создать первую практику
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SCHEDULE */}
          <TabsContent value="schedule">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg">Мои предстоящие сессии</h3>
              <Button size="sm" className="gap-2" onClick={() => toast.info('Создание новой сессии')}>
                <Plus className="w-4 h-4" />
                Запланировать
              </Button>
            </div>

            {mySessions.length > 0 ? (
              <div className="space-y-3">
                {mySessions.map((session) => {
                  const sDir = DIRECTIONS.find((d) => d.id === session.direction);
                  const enrolledCount = enrollmentByEvent[session.id] || 0;
                  const isExpanded = expandedSession === session.id;
                  const students = sessionStudents[session.id] || [];
                  const isLoadingStudents = loadingStudents.has(session.id);

                  return (
                    <Card key={session.id} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0"
                            style={{ backgroundColor: sDir?.colorLight }}
                          >
                            {sDir?.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm">{session.title}</h4>
                              <Badge className="text-[10px] bg-green-100 text-green-700 border-0">
                                <Radio className="w-2.5 h-2.5 mr-1" /> Живая сессия
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {session.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {session.time} ({session.duration} мин)
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span className="font-medium text-foreground">{session.spots + enrolledCount}</span>/{session.maxSpots} записано
                                {enrolledCount > 0 && (
                                  <span className="text-primary ml-1">(+{enrolledCount} новых)</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => toggleSessionExpand(session.id)}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Ученики</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Enrolled students panel */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            {isLoadingStudents ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Загрузка учеников...
                              </div>
                            ) : students.length > 0 ? (
                              <div>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Записавшиеся ученики ({students.length})
                                </p>
                                <div className="space-y-2">
                                  {students.map((student) => (
                                    <div
                                      key={student.id}
                                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary shrink-0">
                                        {student.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm truncate">{student.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] shrink-0"
                                      >
                                        {PLAN_LABELS[student.plan] || student.plan}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">
                                Пока никто не записался через платформу
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Нет запланированных сессий</p>
              </div>
            )}
          </TabsContent>

          {/* FEEDBACK */}
          <TabsContent value="feedback">
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <Card className="border-0 shadow-none bg-white/60">
                <CardContent className="p-4 text-center">
                  <Star className="w-6 h-6 text-[#C9A96E] mx-auto mb-2" />
                  <p className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {avgRating > 0 ? avgRating.toFixed(2) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Средний рейтинг</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-none bg-white/60">
                <CardContent className="p-4 text-center">
                  <MessageSquare className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {totalReviews}
                  </p>
                  <p className="text-xs text-muted-foreground">Всего отзывов</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-none bg-white/60">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 text-[#7A9B6D] mx-auto mb-2" />
                  <p className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    {totalReviews > 0 ? `${positivePercent}%` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Положительных</p>
                </CardContent>
              </Card>
            </div>

            {recentReviews.length > 0 ? (
              <div className="space-y-3">
                {recentReviews.map((fb) => (
                  <Card key={fb.id} className="border-0 shadow-none bg-white/60">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary">
                            {fb.userName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm">{fb.userName}</p>
                            <p className="text-xs text-muted-foreground">{fb.practiceTitle}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= fb.rating ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-muted'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{fb.text}</p>

                      {/* Existing reply display */}
                      {fb.reply && (
                        <div className="mt-3 pl-4 border-l-2 border-[#7A9B6D]/30 bg-[#7A9B6D]/5 rounded-r-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-[#7A9B6D]/20 flex items-center justify-center text-[9px] text-[#7A9B6D]">
                              {fb.reply.authorName.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-[#7A9B6D]">{fb.reply.authorName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(fb.reply.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80">{fb.reply.text}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          {new Date(fb.createdAt).toLocaleDateString('ru-RU')}
                        </p>
                        {!fb.reply ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => { setReplyingTo(fb.id); setReplyText(''); }}
                          >
                            <Send className="w-3 h-3" />
                            Ответить
                          </Button>
                        ) : (
                          <Badge className="text-[10px] border-0 bg-[#7A9B6D]/10 text-[#7A9B6D]">
                            Ответ отправлен
                          </Badge>
                        )}
                      </div>

                      {/* Inline reply form */}
                      {replyingTo === fb.id && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#7A9B6D]/15 flex items-center justify-center text-[10px] text-[#7A9B6D] shrink-0 mt-1">
                              {currentInstructor.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <Textarea
                                placeholder="Напишите ответ ученику..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className="bg-white/60 min-h-[80px] text-sm resize-none"
                                autoFocus
                              />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] text-muted-foreground">
                                  {replyText.length}/1000
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                    disabled={submittingReply}
                                  >
                                    Отмена
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="text-xs gap-1.5"
                                    onClick={() => handleReplySubmit(fb.id, fb.practiceId)}
                                    disabled={submittingReply || !replyText.trim()}
                                  >
                                    {submittingReply ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Send className="w-3 h-3" />
                                    )}
                                    Отправить
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Пока нет отзывов. Ученики смогут оставлять отзывы на страницах ваших практик.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}