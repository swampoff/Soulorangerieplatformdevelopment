import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getSupabase, authFetch } from './api';

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

// Pages that require authentication
const PROTECTED_PAGES = ['dashboard', 'instructor-panel', 'admin-panel'];

// Role-based page access mapping
const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard: ['student', 'instructor', 'admin'],
  'instructor-panel': ['instructor', 'admin'],
  'admin-panel': ['admin'],
};

// Fetch user profile from the server
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

  // Initialize: restore session from Supabase
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        const supabase = getSupabase();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session restoration error:', error.message);
        }

        if (session?.access_token) {
          setAccessToken(session.access_token);
          const profile = await fetchUserProfile(session.access_token);
          if (profile) {
            setUser(profile);
          } else {
            // Session exists but no profile — sign out
            console.log('Session exists but profile not found, signing out');
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        setInitialized(true);
      }
    };

    init();

    // Listen for auth state changes (token refresh, sign out)
    const supabase = getSupabase();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setAccessToken(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
        setAccessToken(session.access_token);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Supabase signIn error:', error.message);
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Неверный email или пароль' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: 'Email не подтверждён' };
        }
        return { success: false, error: error.message };
      }

      if (!data.session?.access_token) {
        return { success: false, error: 'Не удалось получить токен сессии' };
      }

      setAccessToken(data.session.access_token);

      const profile = await fetchUserProfile(data.session.access_token);
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
      // Call server signup endpoint (uses publicAnonKey for auth)
      const { anonFetch } = await import('./api');
      const res = await anonFetch('/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error('Signup server error:', result.error);
        if (result.error?.includes('already been registered') || result.error?.includes('already exists')) {
          return { success: false, error: 'Пользователь с таким email уже зарегистрирован' };
        }
        return { success: false, error: result.error || 'Ошибка регистрации' };
      }

      // Now sign in with the new credentials
      return await login(email, password);
    } catch (err) {
      console.error('Unexpected registration error:', err);
      return { success: false, error: `Ошибка регистрации: ${err}` };
    }
  }, [login]);

  const logout = useCallback(() => {
    // Fire and forget the async signOut
    getSupabase()
      .auth.signOut()
      .catch((err: unknown) => console.error('Logout error:', err));
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
      // Public pages are always accessible
      if (!PROTECTED_PAGES.includes(page)) return true;
      // Must be authenticated
      if (!user) return false;
      // Check role-based access
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
    // Show a subtle loading state while restoring session
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