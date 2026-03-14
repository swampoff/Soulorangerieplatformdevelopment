import { useState } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight,
  GraduationCap, UserCircle, LogIn, UserPlus, AlertCircle, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { useAuth, type UserRole } from './AuthContext';

interface AuthPageProps {
  onNavigate: (page: string) => void;
}

export function AuthPage({ onNavigate }: AuthPageProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSelectedRole('student');
    setAgreeTerms(false);
    setError('');
    setShowPassword(false);
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    resetForm();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      toast.success('Добро пожаловать!');
      onNavigate('dashboard');
    } else {
      setError(result.error || 'Ошибка входа');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Заполните все поля');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!agreeTerms) {
      setError('Примите условия пользовательского соглашения');
      return;
    }

    setLoading(true);
    const result = await register(name, email, password, selectedRole);
    setLoading(false);

    if (result.success) {
      toast.success('Регистрация прошла успешно!');
      onNavigate('dashboard');
    } else {
      setError(result.error || 'Ошибка регистрации');
    }
  };

  const ROLE_OPTIONS: { value: UserRole; label: string; desc: string; icon: typeof UserCircle }[] = [
    { value: 'student', label: 'Ученик', desc: 'Доступ к практикам и личному кабинету', icon: UserCircle },
    { value: 'instructor', label: 'Преподаватель', desc: 'Управление практиками и расписанием', icon: GraduationCap },
  ];

  return (
    <div className="min-h-screen pt-16 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7A9B6D 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #A8C5DA 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #C4B5D4 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Branding */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7A9B6D] to-[#A8C5DA] flex items-center justify-center text-white text-3xl mx-auto mb-6">
                S
              </div>
              <h1
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
                className="text-4xl mb-4 text-foreground"
              >
                Soul Orangerie
              </h1>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Цифровая школа гармоничного развития через 7 направлений: Голос, Питание, Дыхание, Энергия, Танец, Вода, Музыка
              </p>
            </div>

            <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1711346593093-d818bdb9eda0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZWFjZWZ1bCUyMG1lZGl0YXRpb24lMjBuYXR1cmUlMjB3YXRlcmNvbG9yJTIwbGlnaHR8ZW58MXx8fHwxNzcwNTM5MzIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Soul Orangerie"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#FBF8F3]/60 to-transparent" />
            </div>

            <div className="mt-8 grid grid-cols-7 gap-3">
              {['🎵', '🌿', '🌬️', '✨', '💃', '💧', '🎶'].map((emoji, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-lg shadow-sm"
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Auth form */}
          <div className="w-full max-w-md mx-auto">
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7A9B6D] to-[#A8C5DA] flex items-center justify-center text-white text-xl mx-auto mb-3">
                S
              </div>
              <h1
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
                className="text-2xl text-foreground"
              >
                Soul Orangerie
              </h1>
            </div>

            <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6 md:p-8">
                {/* Mode tabs */}
                <div className="flex rounded-xl bg-muted/50 p-1 mb-6">
                  <button
                    onClick={() => switchMode('login')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm transition-all cursor-pointer ${
                      mode === 'login'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    Вход
                  </button>
                  <button
                    onClick={() => switchMode('register')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm transition-all cursor-pointer ${
                      mode === 'register'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Регистрация
                  </button>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {mode === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground block mb-1.5">Пароль</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Минимум 6 символов"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary" />
                        <span className="text-sm text-muted-foreground">Запомнить меня</span>
                      </label>
                      <button type="button" className="text-sm text-primary hover:underline cursor-pointer">
                        Забыли пароль?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Вход...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Войти
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>

                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1.5">Имя</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Ваше имя"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground block mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground block mb-1.5">Пароль</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Минимум 6 символов"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground block mb-1.5">Подтвердите пароль</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Повторите пароль"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {password && confirmPassword && password === confirmPassword && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Пароли совпадают
                        </p>
                      )}
                    </div>

                    {/* Role selection */}
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">Роль</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSelectedRole(opt.value)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              selectedRole === opt.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <opt.icon
                              className={`w-5 h-5 ${
                                selectedRole === opt.value ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            />
                            <span className={`text-sm ${selectedRole === opt.value ? 'text-primary' : 'text-foreground'}`}>
                              {opt.label}
                            </span>
                            <span className="text-xs text-muted-foreground text-center leading-tight">
                              {opt.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Terms */}
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-primary mt-0.5"
                      />
                      <span className="text-sm text-muted-foreground leading-tight">
                        Я принимаю{' '}
                        <button type="button" className="text-primary hover:underline cursor-pointer">
                          условия пользовательского соглашения
                        </button>{' '}
                        и{' '}
                        <button type="button" className="text-primary hover:underline cursor-pointer">
                          политику конфиденциальности
                        </button>
                      </span>
                    </label>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Регистрация...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Создать аккаунт
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground mt-4">
              {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
              <button
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="text-primary hover:underline cursor-pointer"
              >
                {mode === 'login' ? 'Зарегистрируйтесь' : 'Войдите'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}