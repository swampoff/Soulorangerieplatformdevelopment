import { useState, useEffect, useCallback } from 'react';
import {
  Users, TrendingUp, BookOpen, BarChart3,
  Search, Shield, Edit, Trash2,
  Star, ArrowUpRight,
  Download, UserCheck, Loader2, MessageSquare, RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { PRACTICES, DIRECTIONS, INSTRUCTORS } from './data';
import { useAuth } from './AuthContext';
import { authFetch } from './api';

interface AdminPanelPageProps {
  onNavigate: (page: string) => void;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  avatar: string;
  practiceCount?: number;
  totalMinutes?: number;
  streakDays?: number;
}

interface AdminStats {
  totalUsers: number;
  studentCount: number;
  instructorCount: number;
  adminCount: number;
  planCounts: Record<string, number>;
  activeSubscriptions: number;
  monthlyRevenue: number;
  totalReviews: number;
  avgRating: number;
  totalBookings: number;
  recentReviews: AdminReview[];
}

interface AdminReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  practiceId: string;
  practiceTitle: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Ученик',
  instructor: 'Преподаватель',
  admin: 'Администратор',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  student: { bg: '#A8C5DA20', text: '#5A8EA8' },
  instructor: { bg: '#7A9B6D20', text: '#7A9B6D' },
  admin: { bg: '#C4B5D420', text: '#8B7BA3' },
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  basic: 'Базовый',
  premium: 'Премиум',
  unlimited: 'Безлимит',
};

const PLAN_COLORS: Record<string, string> = {
  free: '#8A8578',
  basic: '#A8C5DA',
  premium: '#C9A96E',
  unlimited: '#7A9B6D',
};

export function AdminPanelPage({ onNavigate }: AdminPanelPageProps) {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Filters
  const [userFilter, setUserFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<string>('all');

  // Edit user modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Load dashboard stats
  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await authFetch('/admin/stats', accessToken);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        const err = await res.json();
        console.error('Admin stats error:', err.error);
        toast.error('Ошибка загрузки статистики');
      }
    } catch (err) {
      console.error('Admin stats error:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Load users
  const loadUsers = useCallback(async () => {
    if (!accessToken) return;
    setUsersLoading(true);
    try {
      const res = await authFetch('/admin/users', accessToken);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        console.error('Admin users error');
      }
    } catch (err) {
      console.error('Admin users error:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [accessToken]);

  // Load reviews
  const loadReviews = useCallback(async () => {
    if (!accessToken) return;
    setReviewsLoading(true);
    try {
      const res = await authFetch('/admin/reviews', accessToken);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      } else {
        console.error('Admin reviews error');
      }
    } catch (err) {
      console.error('Admin reviews error:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadStats();
    loadUsers();
    loadReviews();
  }, [loadStats, loadUsers, loadReviews]);

  // Delete a review (moderation)
  const handleDeleteReview = async (review: AdminReview) => {
    if (!accessToken) return;
    try {
      const res = await authFetch(`/admin/reviews/${review.practiceId}/${review.id}`, accessToken, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        toast.success(`Отзыв от ${review.userName} удалён`);
        // Refresh stats
        loadStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Ошибка удаления отзыва');
      }
    } catch (err) {
      console.error('Delete review error:', err);
      toast.error('Ошибка подключения');
    }
  };

  // Save user changes
  const handleSaveUser = async () => {
    if (!accessToken || !editingUser) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (editRole && editRole !== editingUser.role) updates.role = editRole;
      if (editPlan && editPlan !== editingUser.plan) updates.plan = editPlan;

      if (Object.keys(updates).length === 0) {
        setEditingUser(null);
        return;
      }

      const res = await authFetch(`/admin/users/${editingUser.id}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        toast.success(`Профиль ${editingUser.name} обновлён`);
        setEditingUser(null);
        loadUsers();
        loadStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Ошибка обновления');
      }
    } catch (err) {
      console.error('Save user error:', err);
      toast.error('Ошибка подключения');
    } finally {
      setSaving(false);
    }
  };

  // CSV export handler
  const handleExport = async (type: 'users' | 'reviews') => {
    if (!accessToken) return;
    setExporting(true);
    try {
      const res = await authFetch(`/admin/export/${type}`, accessToken);
      if (res.ok) {
        const data = await res.json();
        // Create and download CSV file
        const BOM = '\uFEFF'; // UTF-8 BOM for Excel
        const blob = new Blob([BOM + data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || `export-${type}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Экспорт ${type === 'users' ? 'пользователей' : 'отзывов'} завершён`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Ошибка экспорта');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Ошибка подключения');
    } finally {
      setExporting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userFilter !== 'all' && u.role !== userFilter) return false;
    if (planFilter !== 'all' && u.plan !== planFilter) return false;
    if (userSearch && !u.name.toLowerCase().includes(userSearch.toLowerCase()) && !u.email.toLowerCase().includes(userSearch.toLowerCase())) return false;
    return true;
  });

  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'low') return r.rating <= 2;
    if (reviewFilter === 'high') return r.rating >= 4;
    return true;
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-background">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Загружаем данные админ-панели...</p>
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4B5D4] to-[#7A9B6D] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl text-foreground">Админ-панель</h1>
              <p className="text-sm text-muted-foreground">Soul Orangerie — Реальные данные платформы</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { loadStats(); loadUsers(); loadReviews(); toast.info('Данные обновлены'); }}
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Обновить</span>
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span className="hidden sm:inline">Экспорт</span>
              </Button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
                    <button
                      onClick={() => { handleExport('users'); setShowExportMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Экспорт пользователей (CSV)
                    </button>
                    <button
                      onClick={() => { handleExport('reviews'); setShowExportMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      Экспорт отзывов (CSV)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white/60">
            <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
            <TabsTrigger value="users">Пользователи</TabsTrigger>
            <TabsTrigger value="content">Контент</TabsTrigger>
            <TabsTrigger value="reviews">Модерация</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard">
            {/* Key metrics — real data */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label: 'Пользователей',
                  value: (stats?.totalUsers || 0).toString(),
                  change: `${stats?.studentCount || 0} учеников`,
                  icon: Users,
                  color: '#7A9B6D',
                },
                {
                  label: 'Активные подписки',
                  value: (stats?.activeSubscriptions || 0).toString(),
                  change: `из ${stats?.totalUsers || 0} пользователей`,
                  icon: UserCheck,
                  color: '#A8C5DA',
                },
                {
                  label: 'Отзывов',
                  value: (stats?.totalReviews || 0).toString(),
                  change: `Средний рейтинг: ${stats?.avgRating || 0}`,
                  icon: MessageSquare,
                  color: '#C9A96E',
                },
                {
                  label: 'Бронирований',
                  value: (stats?.totalBookings || 0).toString(),
                  change: `${PRACTICES.length} практик на платформе`,
                  icon: BookOpen,
                  color: '#C4B5D4',
                },
              ].map((stat) => (
                <Card key={stat.label} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                      <div className="flex items-center gap-0.5 text-[10px] text-green-600">
                        <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </div>
                    <p className="text-2xl mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.change}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Subscription distribution — real data */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#C9A96E]" />
                    Распределение подписок
                  </h3>
                  <div className="space-y-4">
                    {['free', 'basic', 'premium', 'unlimited'].map((plan) => {
                      const count = stats?.planCounts?.[plan] || 0;
                      const total = stats?.totalUsers || 1;
                      const percent = Math.round((count / total) * 100);
                      return (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm" style={{ color: PLAN_COLORS[plan] }}>
                              {PLAN_LABELS[plan]}
                            </span>
                            <span className="text-xs text-muted-foreground">{count} ({percent}%)</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: PLAN_COLORS[plan] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Role distribution */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#7A9B6D]" />
                    Роли пользователей
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { role: 'student', count: stats?.studentCount || 0, color: '#A8C5DA', icon: Users },
                      { role: 'instructor', count: stats?.instructorCount || 0, color: '#7A9B6D', icon: UserCheck },
                      { role: 'admin', count: stats?.adminCount || 0, color: '#C4B5D4', icon: Shield },
                    ].map((item) => (
                      <div key={item.role} className="p-4 rounded-xl bg-muted/30 text-center">
                        <item.icon className="w-6 h-6 mx-auto mb-2" style={{ color: item.color }} />
                        <p className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: item.color }}>
                          {item.count}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{ROLE_LABELS[item.role]}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recent reviews preview */}
                  <div className="mt-6">
                    <h4 className="text-sm text-muted-foreground mb-3">Последние отзывы</h4>
                    <div className="space-y-2">
                      {(stats?.recentReviews || []).slice(0, 3).map((r) => (
                        <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
                          <div className="flex gap-0.5 shrink-0 mt-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-muted'}`} />
                            ))}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs truncate">{r.text}</p>
                            <p className="text-[10px] text-muted-foreground">{r.userName} — {timeAgo(r.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                      {(!stats?.recentReviews || stats.recentReviews.length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-4">Отзывов пока нет</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Direction popularity */}
            <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm mt-8">
              <CardContent className="p-6">
                <h3 className="text-lg mb-6">Популярность направлений</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {DIRECTIONS.map((dir) => {
                    const dirPractices = PRACTICES.filter((p) => p.direction === dir.id);
                    const totalCompletions = dirPractices.reduce((s, p) => s + (p.completions || 0), 0);
                    return (
                      <Card key={dir.id} className="border-0 shadow-none bg-white/40">
                        <CardContent className="p-3 text-center">
                          <div
                            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-lg"
                            style={{ backgroundColor: dir.colorLight }}
                          >
                            {dir.icon}
                          </div>
                          <p className="text-xs mb-0.5" style={{ color: dir.color }}>{dir.name}</p>
                          <p className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            {(totalCompletions / 1000).toFixed(1)}K
                          </p>
                          <p className="text-[10px] text-muted-foreground">{dirPractices.length} практик</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS — real data */}
          <TabsContent value="users">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10 bg-white/60"
                />
              </div>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-[160px] bg-white/60">
                  <SelectValue placeholder="Роль" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все роли</SelectItem>
                  <SelectItem value="student">Ученики</SelectItem>
                  <SelectItem value="instructor">Преподаватели</SelectItem>
                  <SelectItem value="admin">Администраторы</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[160px] bg-white/60">
                  <SelectValue placeholder="Тариф" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все тарифы</SelectItem>
                  {Object.entries(PLAN_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                {usersLoading ? 'Загрузка...' : `Найдено: ${filteredUsers.length} пользователей`}
              </p>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={loadUsers}>
                <RefreshCw className="w-3 h-3" /> Обновить
              </Button>
            </div>

            {/* User table — real data */}
            <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-xs text-muted-foreground">Пользователь</th>
                      <th className="text-left p-3 text-xs text-muted-foreground hidden sm:table-cell">Роль</th>
                      <th className="text-left p-3 text-xs text-muted-foreground hidden md:table-cell">Тариф</th>
                      <th className="text-left p-3 text-xs text-muted-foreground hidden md:table-cell">Практик</th>
                      <th className="text-left p-3 text-xs text-muted-foreground hidden lg:table-cell">Минут</th>
                      <th className="text-left p-3 text-xs text-muted-foreground hidden lg:table-cell">Серия</th>
                      <th className="text-right p-3 text-xs text-muted-foreground">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.student;
                      return (
                        <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary shrink-0">
                                {u.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm truncate">{u.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden sm:table-cell">
                            <Badge
                              className="text-[10px] border-0"
                              style={{ backgroundColor: roleStyle.bg, color: roleStyle.text }}
                            >
                              {ROLE_LABELS[u.role] || u.role}
                            </Badge>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <span className="text-xs" style={{ color: PLAN_COLORS[u.plan] }}>
                              {PLAN_LABELS[u.plan] || u.plan}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                            {u.practiceCount ?? 0}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                            {u.totalMinutes ?? 0}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                            {u.streakDays ? `${u.streakDays} дн` : '—'}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingUser(u);
                                setEditRole(u.role);
                                setEditPlan(u.plan);
                              }}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredUsers.length === 0 && !usersLoading && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                          Пользователи не найдены
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Edit user modal */}
            {editingUser && (
              <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setEditingUser(null)} />
                <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[min(400px,90vw)] bg-card border border-border rounded-2xl shadow-2xl z-51 p-6">
                  <h3 className="text-lg mb-4 flex items-center gap-2">
                    <Edit className="w-4 h-4 text-primary" />
                    Редактировать: {editingUser.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">{editingUser.email}</p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Роль</label>
                      <Select value={editRole} onValueChange={setEditRole}>
                        <SelectTrigger className="bg-white/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Ученик</SelectItem>
                          <SelectItem value="instructor">Преподаватель</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Тариф</label>
                      <Select value={editPlan} onValueChange={setEditPlan}>
                        <SelectTrigger className="bg-white/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PLAN_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Отмена</Button>
                    <Button size="sm" onClick={handleSaveUser} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* CONTENT */}
          <TabsContent value="content">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Practices by direction */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-4">Практики по направлениям</h3>
                  <div className="space-y-3">
                    {DIRECTIONS.map((dir) => {
                      const count = PRACTICES.filter((p) => p.direction === dir.id).length;
                      const total = PRACTICES.length;
                      const percent = Math.round((count / total) * 100);
                      return (
                        <div key={dir.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm flex items-center gap-2">
                              <span>{dir.icon}</span> {dir.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{count} практик</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${percent}%`, backgroundColor: dir.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Instructors */}
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg">Преподаватели</h3>
                    <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onNavigate('instructors')}>
                      Все
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {INSTRUCTORS.map((inst) => {
                      const instPractices = PRACTICES.filter((p) => p.instructorId === inst.id);
                      const avgRating = instPractices.length > 0
                        ? (instPractices.reduce((s, p) => s + (p.rating || 0), 0) / instPractices.length).toFixed(1)
                        : '—';
                      return (
                        <div
                          key={inst.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                            <img src={inst.image} alt={inst.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">{inst.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {inst.specializations
                                .map((s) => DIRECTIONS.find((d) => d.id === s)?.name)
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs flex items-center gap-1">
                              <Star className="w-3 h-3 text-[#C9A96E]" /> {avgRating}
                            </p>
                            <p className="text-xs text-muted-foreground">{inst.practiceCount} практик</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* All practices list */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg">Все практики ({PRACTICES.length})</h3>
                <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => onNavigate('practices')}>
                  Каталог
                </Button>
              </div>
              <div className="space-y-2">
                {PRACTICES.map((practice) => {
                  const dir = DIRECTIONS.find((d) => d.id === practice.direction);
                  const inst = INSTRUCTORS.find((i) => i.id === practice.instructorId);
                  return (
                    <Card
                      key={practice.id}
                      className="border-0 shadow-none bg-white/60 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => onNavigate(`practice:${practice.id}`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-8 rounded overflow-hidden shrink-0">
                            <img src={practice.image} alt={practice.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{practice.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {inst?.name} — {dir?.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className="text-[10px] border-0"
                              style={{ backgroundColor: dir?.colorLight, color: dir?.color }}
                            >
                              {dir?.icon}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Star className="w-3 h-3 text-[#C9A96E]" /> {practice.rating}
                            </span>
                            {practice.premium && (
                              <Badge className="text-[9px] bg-[#C9A96E]/15 text-[#C9A96E] border-0">Premium</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* REVIEWS / MODERATION */}
          <TabsContent value="reviews">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <h3 className="text-lg flex items-center gap-2 flex-1">
                <MessageSquare className="w-5 h-5 text-[#C9A96E]" />
                Модерация отзывов ({reviews.length})
              </h3>
              <Select value={reviewFilter} onValueChange={setReviewFilter}>
                <SelectTrigger className="w-[160px] bg-white/60">
                  <SelectValue placeholder="Фильтр" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все отзывы</SelectItem>
                  <SelectItem value="low">Низкий рейтинг (1-2)</SelectItem>
                  <SelectItem value="high">Высокий рейтинг (4-5)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={loadReviews}>
                <RefreshCw className="w-3 h-3" /> Обновить
              </Button>
            </div>

            {reviewsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {reviewFilter !== 'all' ? 'Нет отзывов по выбранному фильтру' : 'Отзывов пока нет. Они появятся, когда пользователи начнут оставлять обратную связь.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((review) => {
                  const practice = PRACTICES.find((p) => p.id === review.practiceId);
                  const dir = practice ? DIRECTIONS.find((d) => d.id === practice.direction) : null;
                  return (
                    <Card key={review.id} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* User avatar */}
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary shrink-0">
                            {review.userName.charAt(0)}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-medium">{review.userName}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-muted'}`} />
                                ))}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{timeAgo(review.createdAt)}</span>
                            </div>

                            {/* Practice link */}
                            {practice && (
                              <button
                                onClick={() => onNavigate(`practice:${practice.id}`)}
                                className="flex items-center gap-1.5 mb-2 cursor-pointer hover:underline"
                              >
                                {dir && (
                                  <Badge
                                    className="text-[9px] border-0 px-1.5 py-0"
                                    style={{ backgroundColor: dir.colorLight, color: dir.color }}
                                  >
                                    {dir.icon}
                                  </Badge>
                                )}
                                <span className="text-xs text-primary">{practice.title}</span>
                              </button>
                            )}

                            {/* Review text */}
                            <p className="text-sm text-foreground">{review.text}</p>
                          </div>

                          {/* Actions */}
                          <div className="shrink-0 flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteReview(review)}
                              title="Удалить отзыв"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}