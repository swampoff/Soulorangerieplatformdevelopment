import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { authFetch, anonFetch } from './api';

export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canAccess: (page: string) => boolean;
  accessToken: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROTECTED_PAGES = ['dashboard', 'instructor-panel', 'admin-panel', 'profile-settings'];

const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard: ['student', 'instructor', 'admin'],
  'instructor-panel': ['instructor', 'admin'],
  'admin-panel': ['admin'],
  'profile-settings': ['student', 'instructor', 'admin'],
};

async function fetchUserProfile(token: string): Promise<User | null> {
  try {
    const res = await authFetch('/user-profile', token);
    if (!res.ok) {
      console.error('Failed to fetch user profile, status:', res.status);
      return null;
    }
    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as UserRole,
      plan: data.plan,
      avatar: data.avatar,
    };
  } catch (err) {
    console.error('Failed to fetch user profile:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);

  // Initialize: restore session from localStorage
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        const savedToken = localStorage.getItem('access_token');
        if (savedToken) {
          setAccessToken(savedToken);
          const profile = await fetchUserProfile(savedToken);
          if (profile) {
            setUser(profile);
          } else {
            // Token expired or invalid — clear
            console.log('Token invalid or expired, clearing');
            localStorage.removeItem('access_token');
            setAccessToken(null);
          }
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        setInitialized(true);
      }
    };

    init();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await anonFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes('Invalid login credentials')) {
          return { success: false, error: 'Неверный email или пароль' };
        }
        return { success: false, error: data.error || 'Ошибка входа' };
      }

      if (!data.token) {
        return { success: false, error: 'Не удалось получить токен сессии' };
      }

      localStorage.setItem('access_token', data.token);
      setAccessToken(data.token);

      if (data.user) {
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
          plan: data.user.plan,
          avatar: data.user.avatar,
        });
        return { success: true };
      }

      // Fallback: fetch profile
      const profile = await fetchUserProfile(data.token);
      if (profile) {
        setUser(profile);
        return { success: true };
      }

      return { success: false, error: 'Не удалось загрузить профиль пользователя' };
    } catch (err) {
      console.error('Unexpected login error:', err);
      return { success: false, error: `Ошибка входа: ${err}` };
    }
  }, []);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await anonFetch('/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.error?.includes('already exists')) {
          return { success: false, error: 'Пользователь с таким email уже зарегистрирован' };
        }
        return { success: false, error: result.error || 'Ошибка регистрации' };
      }

      // Server returns token on signup — use it directly
      if (result.token) {
        localStorage.setItem('access_token', result.token);
        setAccessToken(result.token);
        const profile = await fetchUserProfile(result.token);
        if (profile) {
          setUser(profile);
          return { success: true };
        }
      }

      // Fallback: login after signup
      return await login(email, password);
    } catch (err) {
      console.error('Unexpected registration error:', err);
      return { success: false, error: `Ошибка регистрации: ${err}` };
    }
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setUser(null);
    setAccessToken(null);
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      if (!user) return false;
      if (Array.isArray(role)) return role.includes(user.role);
      return user.role === role;
    },
    [user]
  );

  const canAccess = useCallback(
    (page: string) => {
      if (!PROTECTED_PAGES.includes(page)) return true;
      if (!user) return false;
      const allowedRoles = PAGE_ROLES[page];
      if (!allowedRoles) return true;
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (!accessToken) return;
    const profile = await fetchUserProfile(accessToken);
    if (profile) {
      setUser(profile);
    }
  }, [accessToken]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A9B6D] to-[#A8C5DA] flex items-center justify-center text-white text-sm animate-pulse">
            S
          </div>
          <p className="text-sm text-muted-foreground">Восстановление сессии...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, register, logout, hasRole, canAccess, accessToken, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
