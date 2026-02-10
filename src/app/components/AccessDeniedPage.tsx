import { ShieldOff, ArrowLeft, LogIn, Home } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from './AuthContext';

interface AccessDeniedPageProps {
  onNavigate: (page: string) => void;
  requiredRole?: string;
}

export function AccessDeniedPage({ onNavigate, requiredRole }: AccessDeniedPageProps) {
  const { isAuthenticated, user } = useAuth();

  const roleLabels: Record<string, string> = {
    student: 'ученика',
    instructor: 'преподавателя',
    admin: 'администратора',
  };

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-10 h-10 text-destructive" />
        </div>

        <h1
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
          className="text-3xl mb-3 text-foreground"
        >
          Доступ ограничен
        </h1>

        {!isAuthenticated ? (
          <p className="text-muted-foreground mb-8">
            Для доступа к этой странице необходимо войти в аккаунт
          </p>
        ) : (
          <p className="text-muted-foreground mb-8">
            Эта страница доступна только для роли{' '}
            <span className="text-foreground">
              {requiredRole ? roleLabels[requiredRole] || requiredRole : 'с более высокими правами'}
            </span>.
            Ваша текущая роль:{' '}
            <span className="text-foreground">
              {user?.role === 'student' ? 'ученик' : user?.role === 'instructor' ? 'преподаватель' : 'администратор'}
            </span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isAuthenticated ? (
            <Button onClick={() => onNavigate('auth')} className="gap-2">
              <LogIn className="w-4 h-4" />
              Войти в аккаунт
            </Button>
          ) : (
            <Button onClick={() => onNavigate('dashboard')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              В личный кабинет
            </Button>
          )}
          <Button variant="outline" onClick={() => onNavigate('home')} className="gap-2">
            <Home className="w-4 h-4" />
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
}
