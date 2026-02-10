import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, X, User, GraduationCap, Shield, LogIn, LogOut, ChevronDown, Bell, Search } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from './AuthContext';
import { authFetch } from './api';
import { SearchPalette } from './SearchPalette';
import { useFavorites } from './useFavorites';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  icon: string;
  link?: string;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Главная' },
  { id: 'practices', label: 'Практики' },
  { id: 'schedule', label: 'Расписание' },
  { id: 'instructors', label: 'Преподаватели' },
  { id: 'pricing', label: 'Тарифы' },
  { id: 'diagnostic', label: 'Диагностика' },
];

export function Header({ currentPage, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, isAuthenticated, logout, hasRole, accessToken } = useAuth();
  const bellRef = useRef<HTMLDivElement>(null);
  const { favorites } = useFavorites();

  // Global Cmd+K / Ctrl+K shortcut for search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!accessToken) {
      setNotifications([]);
      return;
    }
    try {
      const res = await authFetch('/notifications', accessToken);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [accessToken]);

  useEffect(() => {
    loadNotifications();
    // Poll every 60s
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!accessToken) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await authFetch('/notifications/mark-read', accessToken, {
        method: 'POST',
        body: JSON.stringify({ ids: unreadIds }),
      });
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.link) {
      onNavigate(notif.link);
    }
    setBellOpen(false);

    // Mark as read
    if (!notif.read && accessToken) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      authFetch('/notifications/mark-read', accessToken, {
        method: 'POST',
        body: JSON.stringify({ ids: [notif.id] }),
      }).catch(() => {});
    }
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setNotifications([]);
    onNavigate('home');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'student': return 'Ученик';
      case 'instructor': return 'Преподаватель';
      case 'admin': return 'Администратор';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'student': return '#7A9B6D';
      case 'instructor': return '#A8C5DA';
      case 'admin': return '#C4B5D4';
      default: return '#7A9B6D';
    }
  };

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

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7A9B6D] to-[#A8C5DA] flex items-center justify-center text-white text-sm">
              S
            </div>
            <span style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-xl tracking-wide text-foreground">
              Soul Orangerie
            </span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  currentPage === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white/50 hover:bg-muted/50 transition-colors cursor-pointer text-muted-foreground text-sm"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-xs">Поиск</span>
              <kbd className="hidden lg:inline text-[10px] bg-muted/50 px-1 py-0.5 rounded border border-border ml-1">
                Ctrl+K
              </kbd>
            </button>

            {isAuthenticated && user ? (
              <>
                {/* Role-based quick links */}
                {hasRole(['instructor', 'admin']) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`hidden sm:flex items-center gap-1.5 text-xs hover:text-foreground ${
                      currentPage === 'instructor-panel' ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                    }`}
                    onClick={() => onNavigate('instructor-panel')}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span className="hidden lg:inline">Преподаватель</span>
                  </Button>
                )}
                {hasRole('admin') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`hidden sm:flex items-center gap-1.5 text-xs hover:text-foreground ${
                      currentPage === 'admin-panel' ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                    }`}
                    onClick={() => onNavigate('admin-panel')}
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden lg:inline">Админ</span>
                  </Button>
                )}

                {/* Notification Bell */}
                <div className="relative" ref={bellRef}>
                  <button
                    onClick={() => {
                      setBellOpen(!bellOpen);
                      setUserMenuOpen(false);
                    }}
                    className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Bell className="w-4.5 h-4.5 text-muted-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#C4564A] text-white text-[10px] font-medium flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {bellOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setBellOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-3 border-b border-border flex items-center justify-between">
                          <h4 className="text-sm font-medium">Уведомления</h4>
                          {unreadCount > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-xs text-primary hover:underline cursor-pointer"
                            >
                              Прочитать все
                            </button>
                          )}
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                              Нет уведомлений
                            </div>
                          ) : (
                            notifications.slice(0, 15).map((notif) => (
                              <button
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer last:border-0 ${
                                  !notif.read ? 'bg-primary/3' : ''
                                }`}
                              >
                                <div className="flex gap-3">
                                  <div className="text-lg shrink-0 mt-0.5">{notif.icon}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className={`text-sm truncate ${!notif.read ? 'font-medium' : ''}`}>
                                        {notif.title}
                                      </p>
                                      {!notif.read && (
                                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {notif.message}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                                      {timeAgo(notif.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* User menu */}
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => {
                      setUserMenuOpen(!userMenuOpen);
                      setBellOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white"
                      style={{ backgroundColor: getRoleColor(user.role) }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left hidden lg:block">
                      <div className="text-sm text-foreground leading-none">{user.name}</div>
                      <div className="text-xs text-muted-foreground leading-none mt-0.5">{getRoleLabel(user.role)}</div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-3 border-b border-border">
                          <div className="text-sm text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          <div
                            className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: `${getRoleColor(user.role)}15`,
                              color: getRoleColor(user.role),
                            }}
                          >
                            {getRoleLabel(user.role)}
                          </div>
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => { onNavigate('dashboard'); setUserMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 cursor-pointer"
                          >
                            <User className="w-4 h-4 text-muted-foreground" />
                            Личный кабинет
                          </button>
                          {hasRole(['instructor', 'admin']) && (
                            <button
                              onClick={() => { onNavigate('instructor-panel'); setUserMenuOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 cursor-pointer"
                            >
                              <GraduationCap className="w-4 h-4 text-muted-foreground" />
                              Панель преподавателя
                            </button>
                          )}
                          {hasRole('admin') && (
                            <button
                              onClick={() => { onNavigate('admin-panel'); setUserMenuOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 cursor-pointer"
                            >
                              <Shield className="w-4 h-4 text-muted-foreground" />
                              Админ-панель
                            </button>
                          )}
                        </div>
                        <div className="border-t border-border py-1">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            Выйти
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => onNavigate('auth')}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Войти</span>
                </Button>
                <Button
                  size="sm"
                  className="hidden sm:flex"
                  onClick={() => onNavigate('auth')}
                >
                  Начать
                </Button>
              </>
            )}

            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-4">
            <nav className="flex flex-col gap-1">
              {/* Mobile search button */}
              <button
                onClick={() => { setSearchOpen(true); setMobileOpen(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer mb-1"
              >
                <Search className="w-4 h-4" /> Поиск практик
              </button>

              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                    currentPage === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <div className="my-2 border-t border-border" />

              {isAuthenticated && user ? (
                <>
                  {/* User info */}
                  <div className="flex items-center gap-3 px-3 py-2 mb-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white"
                      style={{ backgroundColor: getRoleColor(user.role) }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</div>
                    </div>
                    {unreadCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-[20px] rounded-full bg-[#C4564A] text-white text-[10px] font-medium flex items-center justify-center px-1">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      onNavigate('dashboard');
                      setMobileOpen(false);
                    }}
                    className="px-3 py-2 rounded-lg text-sm text-left text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-2"
                  >
                    <User className="w-4 h-4" /> Личный кабинет
                  </button>

                  {hasRole(['instructor', 'admin']) && (
                    <button
                      onClick={() => {
                        onNavigate('instructor-panel');
                        setMobileOpen(false);
                      }}
                      className="px-3 py-2 rounded-lg text-sm text-left text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-2"
                    >
                      <GraduationCap className="w-4 h-4" /> Панель преподавателя
                    </button>
                  )}

                  {hasRole('admin') && (
                    <button
                      onClick={() => {
                        onNavigate('admin-panel');
                        setMobileOpen(false);
                      }}
                      className="px-3 py-2 rounded-lg text-sm text-left text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" /> Админ-панель
                    </button>
                  )}

                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileOpen(false);
                    }}
                    className="px-3 py-2 rounded-lg text-sm text-left text-destructive hover:bg-destructive/5 cursor-pointer flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Выйти
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onNavigate('auth');
                    setMobileOpen(false);
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-left text-primary hover:bg-primary/5 cursor-pointer flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> Войти / Регистрация
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
    <SearchPalette
      open={searchOpen}
      onClose={() => setSearchOpen(false)}
      onNavigate={onNavigate}
      favorites={favorites}
    />
    </>
  );
}