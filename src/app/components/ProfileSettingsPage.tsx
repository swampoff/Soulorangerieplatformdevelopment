import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, User, Bell, Shield, Mail, Eye, EyeOff,
  Save, Loader2, Calendar, MessageSquare, Award, Megaphone,
  Zap, Clock, ChevronRight, Sparkles, BookOpen, AlertTriangle,
  Globe, Palette, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { authFetch } from './api';

interface ProfileSettingsPageProps {
  onNavigate: (page: string) => void;
}

interface NotificationPreferences {
  bookingConfirmations: boolean;
  reviewReplies: boolean;
  practiceReminders: boolean;
  scheduleReminders: boolean;
  achievementAlerts: boolean;
  weeklyDigest: boolean;
  promotions: boolean;
  newPractices: boolean;
}

interface UserSettings {
  notifications: NotificationPreferences;
  digestFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
  language: string;
  timezone: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    bookingConfirmations: true,
    reviewReplies: true,
    practiceReminders: true,
    scheduleReminders: true,
    achievementAlerts: true,
    weeklyDigest: true,
    promotions: false,
    newPractices: true,
  },
  digestFrequency: 'weekly',
  language: 'ru',
  timezone: 'Europe/Moscow',
};

interface DigestItem {
  type: string;
  title: string;
  message: string;
  icon: string;
  createdAt: string;
}

interface DigestData {
  period: string;
  totalNotifications: number;
  unreadCount: number;
  summary: {
    bookings: number;
    reviews: number;
    achievements: number;
    practices: number;
    other: number;
  };
  highlights: DigestItem[];
  generatedAt: string;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Бесплатный',
  basic: 'Базовый',
  premium: 'Премиум',
  unlimited: 'Безлимит',
};

const PLAN_COLORS: Record<string, string> = {
  free: '#8A8578',
  basic: '#7A9B6D',
  premium: '#C9A96E',
  unlimited: '#C4B5D4',
};

const ROLE_LABELS: Record<string, string> = {
  student: 'Ученик',
  instructor: 'Преподаватель',
  admin: 'Администратор',
};

const NOTIFICATION_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof Bell;
  color: string;
  category: 'activity' | 'content' | 'marketing';
}[] = [
  { key: 'bookingConfirmations', label: 'Подтверждения записи', description: 'Уведомления при записи на живые сессии', icon: Calendar, color: '#7A9B6D', category: 'activity' },
  { key: 'reviewReplies', label: 'Ответы на отзывы', description: 'Когда преподаватель отвечает на ваш отзыв', icon: MessageSquare, color: '#A8C5DA', category: 'activity' },
  { key: 'practiceReminders', label: 'Напоминания о практике', description: 'Напоминания для поддержания серии занятий', icon: Zap, color: '#D4A574', category: 'activity' },
  { key: 'scheduleReminders', label: 'Расписание сессий', description: 'Уведомления за час до начала сессии', icon: Clock, color: '#E8B4A0', category: 'activity' },
  { key: 'achievementAlerts', label: 'Достижения', description: 'Уведомления о новых достижениях и бейджах', icon: Award, color: '#C9A96E', category: 'content' },
  { key: 'newPractices', label: 'Новые практики', description: 'Когда появляются новые практики по вашим направлениям', icon: BookOpen, color: '#C4B5D4', category: 'content' },
  { key: 'weeklyDigest', label: 'Еженедельный дайджест', description: 'Сводка активности за неделю', icon: Mail, color: '#7A9B6D', category: 'marketing' },
  { key: 'promotions', label: 'Акции и предложения', description: 'Специальные предложения и промокоды', icon: Megaphone, color: '#C4564A', category: 'marketing' },
];

export function ProfileSettingsPage({ onNavigate }: ProfileSettingsPageProps) {
  const { user, accessToken, refreshProfile } = useAuth();
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'digest' | 'security'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileDirty, setProfileDirty] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Security state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Digest state
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);

  // Load settings
  const loadSettings = useCallback(async () => {
    if (!accessToken) { setLoading(false); return; }
    try {
      const res = await authFetch('/user/settings', accessToken);
      if (res.ok) {
        const data = await res.json();
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          notifications: { ...DEFAULT_SETTINGS.notifications, ...data.notifications },
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setProfileName(user?.name || '');
  }, [user?.name]);

  // Save profile name
  const handleSaveProfile = async () => {
    if (!accessToken || !profileName.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch('/user-profile', accessToken, {
        method: 'PUT',
        body: JSON.stringify({ name: profileName.trim() }),
      });
      if (res.ok) {
        toast.success('Профиль обновлён');
        setProfileDirty(false);
        refreshProfile();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Не удалось сохранить профиль');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      toast.error('Ошибка сохранения профиля');
    } finally {
      setSaving(false);
    }
  };

  // Save notification settings
  const handleSaveSettings = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const res = await authFetch('/user/settings', accessToken, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Настройки уведомлений сохранены');
        setSettingsDirty(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Не удалось сохранить настройки');
      }
    } catch (err) {
      console.error('Save settings error:', err);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  // Toggle a notification preference
  const toggleNotif = (key: keyof NotificationPreferences) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));
    setSettingsDirty(true);
  };

  // Toggle all in a category
  const toggleCategory = (category: 'activity' | 'content' | 'marketing', value: boolean) => {
    setSettings((prev) => {
      const updated = { ...prev.notifications };
      NOTIFICATION_ITEMS.filter((i) => i.category === category).forEach((i) => {
        updated[i.key] = value;
      });
      return { ...prev, notifications: updated };
    });
    setSettingsDirty(true);
  };

  // Change password
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await authFetch('/user-profile', accessToken!, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(`Ошибка смены пароля: ${data.error || 'Неизвестная ошибка'}`);
      } else {
        toast.success('Пароль успешно изменён');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Change password error:', err);
      toast.error('Не удалось сменить пароль');
    } finally {
      setChangingPassword(false);
    }
  };

  // Load digest
  const handleLoadDigest = async () => {
    if (!accessToken) return;
    setLoadingDigest(true);
    try {
      const res = await authFetch(`/notifications/digest?period=${settings.digestFrequency || 'weekly'}`, accessToken);
      if (res.ok) {
        const data = await res.json();
        setDigest(data);
      } else {
        toast.error('Не удалось загрузить дайджест');
      }
    } catch (err) {
      console.error('Load digest error:', err);
      toast.error('Ошибка загрузки дайджеста');
    } finally {
      setLoadingDigest(false);
    }
  };

  // How many notifs are enabled in a category
  const categoryCount = (category: 'activity' | 'content' | 'marketing') => {
    const items = NOTIFICATION_ITEMS.filter((i) => i.category === category);
    const enabled = items.filter((i) => settings.notifications[i.key]).length;
    return { enabled, total: items.length };
  };

  const SECTIONS = [
    { id: 'profile' as const, label: 'Профиль', icon: User, color: '#7A9B6D' },
    { id: 'notifications' as const, label: 'Уведомления', icon: Bell, color: '#A8C5DA' },
    { id: 'digest' as const, label: 'Дайджест', icon: Mail, color: '#C9A96E' },
    { id: 'security' as const, label: 'Безопасность', icon: Shield, color: '#C4B5D4' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-background">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Загрузка настроек...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mt-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => onNavigate('dashboard')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl text-foreground" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Настройки
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Управление профилем, уведомлениями и безопасностью</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar Navigation */}
          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all cursor-pointer ${
                  activeSection === section.id
                    ? 'bg-white/80 shadow-sm text-foreground'
                    : 'text-muted-foreground hover:bg-white/40 hover:text-foreground'
                }`}
              >
                <section.icon
                  className="w-4.5 h-4.5 shrink-0"
                  style={{ color: activeSection === section.id ? section.color : undefined }}
                />
                {section.label}
                {section.id === 'notifications' && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {NOTIFICATION_ITEMS.filter((i) => settings.notifications[i.key]).length}/{NOTIFICATION_ITEMS.length}
                  </span>
                )}
              </button>
            ))}

            {/* Quick Info Card */}
            <div className="pt-4">
              <Card className="border-0 shadow-none bg-white/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm text-white shrink-0"
                      style={{ backgroundColor: PLAN_COLORS[user?.plan || 'free'] }}
                    >
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className="text-[10px] border-0"
                      style={{
                        backgroundColor: `${PLAN_COLORS[user?.plan || 'free']}15`,
                        color: PLAN_COLORS[user?.plan || 'free'],
                      }}
                    >
                      {PLAN_NAMES[user?.plan || 'free']}
                    </Badge>
                    <Badge
                      className="text-[10px] border-0"
                      style={{ backgroundColor: '#7A9B6D15', color: '#7A9B6D' }}
                    >
                      {ROLE_LABELS[user?.role || 'student']}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </nav>

          {/* Main Content */}
          <div className="space-y-6">
            {/* ====== PROFILE SECTION ====== */}
            {activeSection === 'profile' && (
              <>
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      Личная информация
                    </h2>
                    <p className="text-xs text-muted-foreground mb-6">Основные данные вашего профиля</p>

                    {/* Avatar */}
                    <div className="flex items-center gap-4 mb-6">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-xl text-white shrink-0"
                        style={{ backgroundColor: PLAN_COLORS[user?.plan || 'free'] }}
                      >
                        {profileName.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{profileName || 'Имя не указано'}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                        <Badge
                          className="text-[10px] border-0 mt-1"
                          style={{
                            backgroundColor: `${PLAN_COLORS[user?.plan || 'free']}15`,
                            color: PLAN_COLORS[user?.plan || 'free'],
                          }}
                        >
                          {PLAN_NAMES[user?.plan || 'free']}
                        </Badge>
                      </div>
                    </div>

                    <Separator className="my-5" />

                    {/* Name field */}
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Имя</label>
                        <Input
                          value={profileName}
                          onChange={(e) => {
                            setProfileName(e.target.value);
                            setProfileDirty(e.target.value !== user?.name);
                          }}
                          placeholder="Ваше имя"
                          className="bg-white/60"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                        <Input
                          value={user?.email || ''}
                          disabled
                          className="bg-muted/30 opacity-60"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Email нельзя изменить</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Роль</label>
                        <Input
                          value={ROLE_LABELS[user?.role || 'student']}
                          disabled
                          className="bg-muted/30 opacity-60"
                        />
                      </div>
                    </div>

                    {profileDirty && (
                      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border/50">
                        <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Сохранить
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => { setProfileName(user?.name || ''); setProfileDirty(false); }}
                        >
                          Отмена
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subscription Card */}
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      Подписка
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">Ваш текущий тарифный план</p>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-white/80 to-white/40 border border-border/30">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${PLAN_COLORS[user?.plan || 'free']}15` }}
                        >
                          <Sparkles className="w-5 h-5" style={{ color: PLAN_COLORS[user?.plan || 'free'] }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{PLAN_NAMES[user?.plan || 'free']}</p>
                          <p className="text-xs text-muted-foreground">
                            {user?.plan === 'free'
                              ? 'Доступ к бесплатным практикам'
                              : user?.plan === 'unlimited'
                                ? 'Полный доступ ко всему контенту'
                                : 'Расширенный доступ к практикам'}
                          </p>
                        </div>
                      </div>
                      {user?.plan !== 'unlimited' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 shrink-0"
                          onClick={() => onNavigate('pricing')}
                        >
                          Улучшить
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ====== NOTIFICATIONS SECTION ====== */}
            {activeSection === 'notifications' && (
              <>
                {/* Activity Notifications */}
                {(['activity', 'content', 'marketing'] as const).map((category) => {
                  const { enabled, total } = categoryCount(category);
                  const allEnabled = enabled === total;
                  const categoryLabel = category === 'activity' ? 'Активность'
                    : category === 'content' ? 'Контент' : 'Маркетинг';
                  const categoryDesc = category === 'activity' ? 'Уведомления о вашей активности на платформе'
                    : category === 'content' ? 'Обновления контента и достижений'
                    : 'Рассылки и специальные предложения';

                  return (
                    <Card key={category} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-1">
                          <h2 className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                            {categoryLabel}
                          </h2>
                          <button
                            onClick={() => toggleCategory(category, !allEnabled)}
                            className="text-xs text-primary hover:underline cursor-pointer"
                          >
                            {allEnabled ? 'Отключить все' : 'Включить все'}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-5">{categoryDesc}</p>

                        <div className="space-y-0">
                          {NOTIFICATION_ITEMS.filter((i) => i.category === category).map((item, idx, arr) => (
                            <div key={item.key}>
                              <div className="flex items-center justify-between py-3.5">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${item.color}12` }}
                                  >
                                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                                  </div>
                                  <div>
                                    <p className="text-sm">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                  </div>
                                </div>
                                <Switch
                                  checked={settings.notifications[item.key]}
                                  onCheckedChange={() => toggleNotif(item.key)}
                                />
                              </div>
                              {idx < arr.length - 1 && <Separator />}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Save button */}
                {settingsDirty && (
                  <div className="sticky bottom-4 flex justify-end">
                    <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md shadow-lg rounded-xl px-4 py-3 border border-border/30">
                      <span className="text-sm text-muted-foreground">Есть несохранённые изменения</span>
                      <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Сохранить
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ====== DIGEST SECTION ====== */}
            {activeSection === 'digest' && (
              <>
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      Дайджест активности
                    </h2>
                    <p className="text-xs text-muted-foreground mb-6">
                      Получайте сводку уведомлений с настраиваемой периодичностью
                    </p>

                    <div className="space-y-5">
                      {/* Frequency selector */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#C9A96E]/10 shrink-0">
                            <Clock className="w-4 h-4 text-[#C9A96E]" />
                          </div>
                          <div>
                            <p className="text-sm">Периодичность дайджеста</p>
                            <p className="text-xs text-muted-foreground">Как часто получать сводку</p>
                          </div>
                        </div>
                        <Select
                          value={settings.digestFrequency}
                          onValueChange={(v: UserSettings['digestFrequency']) => {
                            setSettings((prev) => ({ ...prev, digestFrequency: v }));
                            setSettingsDirty(true);
                          }}
                        >
                          <SelectTrigger className="w-40 bg-white/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Ежедневно</SelectItem>
                            <SelectItem value="weekly">Еженедельно</SelectItem>
                            <SelectItem value="monthly">Ежемесячно</SelectItem>
                            <SelectItem value="never">Отключен</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Language & Timezone */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#A8C5DA]/10 shrink-0">
                            <Globe className="w-4 h-4 text-[#A8C5DA]" />
                          </div>
                          <div>
                            <p className="text-sm">Язык уведомлений</p>
                            <p className="text-xs text-muted-foreground">Язык текста в уведомлениях и дайджесте</p>
                          </div>
                        </div>
                        <Select
                          value={settings.language}
                          onValueChange={(v) => {
                            setSettings((prev) => ({ ...prev, language: v }));
                            setSettingsDirty(true);
                          }}
                        >
                          <SelectTrigger className="w-40 bg-white/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ru">Русский</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {settingsDirty && (
                        <div className="flex justify-end pt-2">
                          <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Сохранить настройки
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Preview Digest */}
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                          Предпросмотр дайджеста
                        </h3>
                        <p className="text-xs text-muted-foreground">Посмотрите, как выглядит ваша сводка</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-xs"
                        onClick={handleLoadDigest}
                        disabled={loadingDigest}
                      >
                        {loadingDigest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Загрузить дайджест
                      </Button>
                    </div>

                    {digest ? (
                      <div className="space-y-5">
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {[
                            { label: 'Всего', value: digest.totalNotifications, color: '#7A9B6D' },
                            { label: 'Записи', value: digest.summary.bookings, color: '#A8C5DA' },
                            { label: 'Отзывы', value: digest.summary.reviews, color: '#C9A96E' },
                            { label: 'Достижения', value: digest.summary.achievements, color: '#C4B5D4' },
                            { label: 'Практики', value: digest.summary.practices, color: '#D4A574' },
                          ].map((s) => (
                            <div key={s.label} className="p-3 rounded-xl bg-white/50 text-center">
                              <p className="text-xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: s.color }}>
                                {s.value}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Highlights */}
                        {digest.highlights.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-3">Ключевые события</p>
                            <div className="space-y-2">
                              {digest.highlights.map((h, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/40">
                                  <span className="text-lg shrink-0">{h.icon}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm">{h.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{h.message}</p>
                                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                                      {new Date(h.createdAt).toLocaleDateString('ru-RU', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                      })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2">
                          <Check className="w-3 h-3" />
                          Сгенерировано {new Date(digest.generatedAt).toLocaleDateString('ru-RU', {
                            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                          })}
                          &middot; Период: {digest.period}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Mail className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Нажмите «Загрузить дайджест» чтобы увидеть сводку ваших уведомлений
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* ====== SECURITY SECTION ====== */}
            {activeSection === 'security' && (
              <>
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      Смена пароля
                    </h2>
                    <p className="text-xs text-muted-foreground mb-6">
                      Обновите пароль для защиты аккаунта
                    </p>

                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Новый пароль</label>
                        <div className="relative">
                          <Input
                            type={showPasswords ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Минимум 6 символов"
                            className="bg-white/60 pr-10"
                          />
                          <button
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {newPassword && newPassword.length < 6 && (
                          <p className="text-[10px] text-destructive mt-1">Минимум 6 символов</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Подтвердите пароль</label>
                        <Input
                          type={showPasswords ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Повторите пароль"
                          className="bg-white/60"
                        />
                        {confirmPassword && confirmPassword !== newPassword && (
                          <p className="text-[10px] text-destructive mt-1">Пароли не совпадают</p>
                        )}
                      </div>
                      <Button
                        onClick={handleChangePassword}
                        disabled={changingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                        className="gap-2"
                      >
                        {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        Сменить пароль
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Session info */}
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h2 className="text-lg mb-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      Сессия
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">Информация о текущей авторизации</p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">Авторизован как</span>
                        <span className="text-sm">{user?.email}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">Роль</span>
                        <Badge
                          className="text-[10px] border-0"
                          style={{ backgroundColor: '#7A9B6D15', color: '#7A9B6D' }}
                        >
                          {ROLE_LABELS[user?.role || 'student']}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-muted-foreground">ID пользователя</span>
                        <span className="text-xs text-muted-foreground font-mono">{user?.id?.slice(0, 12)}...</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="border-0 shadow-none bg-destructive/3 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <h2 className="text-lg text-destructive" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                        Опасная зона
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Эти действия необратимы. Будьте осторожны.
                    </p>
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => toast.info('Для удаления аккаунта обратитесь к администратору')}
                    >
                      Удалить аккаунт
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
