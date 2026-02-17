import { useState, useEffect } from 'react';
import {
  ArrowLeft, Play, Pause, Clock, Star, Users, Lock,
  Heart, Share2, BookOpen, ChevronRight, Video, Headphones, TreePine,
  CheckCircle2, Volume2, Loader2, RotateCcw, MessageSquare, Send, Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { PRACTICES, DIRECTIONS, INSTRUCTORS, LEVEL_LABELS, FORMAT_LABELS } from './data';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from './AuthContext';
import { authFetch, anonFetch } from './api';
import confetti from 'canvas-confetti';
import { useFavorites } from './useFavorites';
import { useRealtimeUpdates } from './useRealtimeUpdates';

interface PracticeDetailPageProps {
  practiceId: string;
  onNavigate: (page: string) => void;
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  audio: <Headphones className="w-4 h-4" />,
  live: <Play className="w-4 h-4" />,
  outdoor: <TreePine className="w-4 h-4" />,
};

export function PracticeDetailPage({ practiceId, onNavigate }: PracticeDetailPageProps) {
  const { isAuthenticated, accessToken, user } = useAuth();
  const { isFavorite, toggleFavorite, isBouncing } = useFavorites();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Reviews state
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [liveAvgRating, setLiveAvgRating] = useState<number | null>(null);
  const [liveReviewCount, setLiveReviewCount] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const practice = PRACTICES.find((p) => p.id === practiceId);

  // Check if practice is already completed
  useEffect(() => {
    if (!accessToken || !practiceId) return;
    let cancelled = false;
    setIsCompleted(false);
    const checkStatus = async () => {
      try {
        const res = await authFetch('/user-progress', accessToken);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.completedPractices?.includes(practiceId)) {
            setIsCompleted(true);
          }
        }
      } catch (err) {
        console.error('Failed to check practice completion status:', err);
      }
    };
    checkStatus();
    return () => { cancelled = true; };
  }, [accessToken, practiceId]);

  // Fetch reviews
  const fetchReviews = async () => {
    if (!practiceId) return;
    try {
      const res = await anonFetch(`/reviews/${practiceId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setLiveAvgRating(data.avgRating || 0);
        setLiveReviewCount(data.reviewCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (!practiceId) return;
    setReviewsLoading(true);
    fetchReviews();
  }, [practiceId]);

  // Real-time updates for reviews via Supabase Realtime
  useRealtimeUpdates(
    practiceId ? [`reviews:practice:${practiceId}`, `reviews:stats:${practiceId}`] : [],
    fetchReviews,
    20000 // Poll every 20s as fallback
  );

  if (!practice) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 text-center py-20">
          <p className="text-muted-foreground text-lg">Практика не найдена</p>
          <Button className="mt-4" onClick={() => onNavigate('practices')}>
            Вернуться к каталогу
          </Button>
        </div>
      </div>
    );
  }

  const dir = DIRECTIONS.find((d) => d.id === practice.direction);
  const instructor = INSTRUCTORS.find((i) => i.id === practice.instructorId);
  const relatedPractices = PRACTICES.filter(
    (p) => p.direction === practice.direction && p.id !== practice.id
  ).slice(0, 3);

  const handlePlay = () => {
    if (practice.premium) {
      toast.info('Для доступа к этой практике необходима подписка Премиум');
    }
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      // Simulate progress
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            return 100;
          }
          return prev + 0.5;
        });
      }, 100);
    }
  };

  const handleShare = () => {
    toast.success('Ссылка на практику скопирована');
  };

  const handleComplete = async () => {
    if (!accessToken || !practice) return;
    setCompleting(true);
    try {
      const res = await authFetch('/complete-practice', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          practiceId: practice.id,
          duration: practice.duration,
          direction: practice.direction,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsCompleted(true);
        toast.success('Практика завершена!', {
          description: `+${practice.duration} мин к вашему прогрессу. Серия: ${data.streakDays} ${getDaysWord(data.streakDays)}`,
        });

        // Basic completion confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: [dir?.color || '#7A9B6D', '#C9A96E', '#E8B4A0', '#A8C5DA'],
        });

        // Achievement celebration — enhanced confetti + toasts
        const newAchievements = data.newAchievements || [];
        if (newAchievements.length > 0) {
          newAchievements.forEach((achievement: { icon: string; title: string; desc: string }, idx: number) => {
            setTimeout(() => {
              toast(
                `${achievement.icon} ${achievement.title}`,
                {
                  description: achievement.desc,
                  duration: 6000,
                },
              );
              // Grand confetti burst for achievements
              const burst = () => {
                confetti({
                  particleCount: 60,
                  angle: 60,
                  spread: 55,
                  origin: { x: 0, y: 0.65 },
                  colors: ['#C9A96E', '#E8B4A0', '#7A9B6D', '#A8C5DA', '#D4B896'],
                });
                confetti({
                  particleCount: 60,
                  angle: 120,
                  spread: 55,
                  origin: { x: 1, y: 0.65 },
                  colors: ['#C9A96E', '#E8B4A0', '#7A9B6D', '#A8C5DA', '#D4B896'],
                });
              };
              burst();
              setTimeout(burst, 250);
            }, 1200 + idx * 1800);
          });
        }
      } else {
        const data = await res.json();
        console.error('Complete practice error:', data.error);
        toast.error('Не удалось сохранить прогресс', {
          description: data.error || 'Попробуйте ещё раз',
        });
      }
    } catch (err) {
      console.error('Complete practice error:', err);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setCompleting(false);
    }
  };

  const elapsedChapterTime = practice.chapters
    ? practice.chapters.slice(0, currentChapter).reduce((sum, ch) => sum + ch.duration, 0)
    : 0;

  const handleReviewSubmit = async () => {
    if (!accessToken || !practiceId || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await authFetch('/reviews', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          practiceTitle: practice?.title || '',
          rating: reviewRating,
          text: reviewText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update existing review or add new
        setReviews((prev) => {
          const idx = prev.findIndex((r) => r.userId === user?.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data.review;
            return updated;
          }
          return [data.review, ...prev];
        });
        setLiveAvgRating(data.avgRating);
        setLiveReviewCount(data.reviewCount);
        setReviewText('');
        setReviewRating(5);
        toast.success('Отзыв отправлен!');
      } else {
        const data = await res.json();
        console.error('Submit review error:', data.error);
        toast.error(data.error || 'Не удалось отправить отзыв');
      }
    } catch (err) {
      console.error('Submit review error:', err);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReviewDelete = async (reviewId: string) => {
    if (!accessToken || !practiceId) return;
    try {
      const res = await authFetch(`/reviews/${practiceId}/${reviewId}`, accessToken, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        // Recalculate
        const remaining = reviews.filter((r) => r.id !== reviewId);
        if (remaining.length > 0) {
          const avg = remaining.reduce((s, r) => s + r.rating, 0) / remaining.length;
          setLiveAvgRating(avg);
          setLiveReviewCount(remaining.length);
        } else {
          setLiveAvgRating(0);
          setLiveReviewCount(0);
        }
        toast.success('Отзыв удалён');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Не удалось удалить отзыв');
      }
    } catch (err) {
      console.error('Delete review error:', err);
      toast.error('Ошибка при удалении');
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <button
          onClick={() => onNavigate('practices')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 mt-4 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к каталогу
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content — video + description */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video player area */}
            <div className="relative rounded-2xl overflow-hidden bg-black/5 aspect-video group">
              <ImageWithFallback
                src={practice.image}
                alt={practice.title}
                className={`w-full h-full object-cover transition-all duration-500 ${
                  isPlaying ? 'brightness-75' : ''
                }`}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

              {/* Play/Pause button */}
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
              >
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                    isPlaying
                      ? 'bg-white/20 backdrop-blur-md'
                      : 'bg-white/90 hover:bg-white hover:scale-110'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 text-white" />
                  ) : (
                    <Play className="w-7 h-7 text-foreground ml-1" />
                  )}
                </div>
              </button>

              {/* Premium badge */}
              {practice.premium && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-[#C9A96E] text-white border-0 gap-1 px-3 py-1">
                    <Lock className="w-3 h-3" /> Premium
                  </Badge>
                </div>
              )}

              {/* Bottom bar: progress + time */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-3 text-white text-xs mb-2">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{Math.round((progress / 100) * practice.duration)} мин / {practice.duration} мин</span>
                </div>
                <div className="h-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      background: dir?.color || '#7A9B6D',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Title + actions */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {dir && (
                  <Badge
                    className="text-xs border-0"
                    style={{ backgroundColor: dir.color, color: 'white' }}
                  >
                    {dir.icon} {dir.name}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs gap-1">
                  {FORMAT_ICONS[practice.format]} {FORMAT_LABELS[practice.format]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {LEVEL_LABELS[practice.level]}
                </Badge>
                {isCompleted && (
                  <Badge className="text-xs border-0 bg-primary/10 text-primary gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Пройдено
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl text-foreground mb-2">{practice.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> {practice.duration} мин
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-[#C9A96E]" /> {practice.rating} ({practice.reviewCount} отзывов)
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> {practice.completions?.toLocaleString('ru-RU')} прохождений
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePlay}
                  className="gap-2"
                  style={{ backgroundColor: dir?.color }}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Пауза' : 'Начать практику'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleFavorite(practiceId)}
                >
                  <Heart className={`w-4 h-4 ${isFavorite(practiceId) ? 'fill-[#E8B4A0] text-[#E8B4A0]' : ''} ${isBouncing(practiceId) ? 'heart-bounce' : ''}`} />
                </Button>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Full description */}
            <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="text-lg mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" style={{ color: dir?.color }} />
                  О практике
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {practice.fullDescription || practice.description}
                </p>
              </CardContent>
            </Card>

            {/* Chapter list */}
            {practice.chapters && practice.chapters.length > 0 && (
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <h3 className="text-lg mb-4">Содержание практики</h3>
                  <div className="space-y-1">
                    {practice.chapters.map((chapter, idx) => {
                      const isActive = idx === currentChapter;
                      const isChapterCompleted = idx < currentChapter;
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentChapter(idx)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                            isActive
                              ? 'bg-primary/10'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0"
                            style={{
                              backgroundColor: isActive ? dir?.color : isChapterCompleted ? `${dir?.color}30` : '#F0EBE3',
                              color: isActive ? 'white' : isChapterCompleted ? dir?.color : '#8A8578',
                            }}
                          >
                            {isChapterCompleted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {chapter.title}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {chapter.duration} мин
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Прогресс: {currentChapter}/{practice.chapters.length} разделов</span>
                      <span>{elapsedChapterTime} / {practice.duration} мин</span>
                    </div>
                    <Progress
                      value={(currentChapter / practice.chapters.length) * 100}
                      className="mt-2 h-1.5"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completion Card */}
            {isAuthenticated && (
              <Card
                className="border-0 shadow-none overflow-hidden"
                style={{
                  background: isCompleted
                    ? `linear-gradient(135deg, ${dir?.colorLight || 'rgba(122,155,109,0.15)'}, rgba(255,255,255,0.8))`
                    : `linear-gradient(135deg, rgba(255,255,255,0.7), ${dir?.colorLight || 'rgba(122,155,109,0.15)'})`,
                }}
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: isCompleted ? `${dir?.color}20` : dir?.colorLight,
                        }}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" style={{ color: dir?.color }} />
                        ) : (
                          <span className="text-lg">{dir?.icon}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base mb-0.5">
                          {isCompleted ? 'Практика пройдена' : 'Завершите практику'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {isCompleted
                            ? 'Результат сохранён в вашем прогрессе. Вы можете пройти практику ещё раз.'
                            : `Нажмите кнопку, чтобы записать +${practice.duration} мин в ваш прогресс и обновить серию дней`}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="shrink-0 gap-2 w-full sm:w-auto"
                      style={{ backgroundColor: completing ? undefined : dir?.color }}
                      onClick={handleComplete}
                      disabled={completing}
                    >
                      {completing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Сохраняю...
                        </>
                      ) : isCompleted ? (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Пройти снова
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Завершить практику
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Login hint for unauthenticated users */}
            {!isAuthenticated && (
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-5 text-center">
                  <p className="text-sm text-muted-foreground">
                    <button
                      onClick={() => onNavigate('auth')}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Войдите
                    </button>
                    , чтобы отслеживать прогресс и сохранять завершённые практики
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Related practices */}
            {relatedPractices.length > 0 && (
              <div>
                <h3 className="text-lg mb-4">Похожие практики</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  {relatedPractices.map((rp) => {
                    const rpDir = DIRECTIONS.find((d) => d.id === rp.direction);
                    return (
                      <Card
                        key={rp.id}
                        className="border-0 shadow-none bg-white/60 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                        onClick={() => onNavigate(`practice:${rp.id}`)}
                      >
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <ImageWithFallback
                            src={rp.image}
                            alt={rp.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        </div>
                        <CardContent className="p-3">
                          <Badge
                            className="text-[10px] border-0 mb-1.5"
                            style={{ backgroundColor: rpDir?.colorLight, color: rpDir?.color }}
                          >
                            {rpDir?.icon} {rpDir?.name}
                          </Badge>
                          <h4 className="text-sm mb-1 line-clamp-1">{rp.title}</h4>
                          <p className="text-xs text-muted-foreground">{rp.duration} мин</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Instructor card */}
            {instructor && (
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-5">
                  <h4 className="text-sm text-muted-foreground mb-3">Преподаватель</h4>
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-xl p-2 -m-2 transition-colors"
                    onClick={() => onNavigate('instructors')}
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
                      <ImageWithFallback
                        src={instructor.image}
                        alt={instructor.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{instructor.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {instructor.specializations
                          .map((s) => DIRECTIONS.find((d) => d.id === s)?.name)
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">{instructor.practiceCount} практик</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    {instructor.bio}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Practice info card */}
            <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
              <CardContent className="p-5">
                <h4 className="text-sm text-muted-foreground mb-3">Информация</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Длительность', value: `${practice.duration} минут` },
                    { label: 'Уровень', value: LEVEL_LABELS[practice.level] },
                    { label: 'Формат', value: FORMAT_LABELS[practice.format] },
                    { label: 'Направление', value: dir?.name || '' },
                    { label: 'Рейтинг', value: `${practice.rating} / 5.0` },
                    { label: 'Прохождений', value: practice.completions?.toLocaleString('ru-RU') || '—' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className="text-xs text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CTA: access / subscribe */}
            {practice.premium && (
              <Card
                className="border-0 shadow-none overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${dir?.colorLight}, ${dir?.color}20)` }}
              >
                <CardContent className="p-5 text-center">
                  <Lock className="w-6 h-6 mx-auto mb-2" style={{ color: dir?.color }} />
                  <h4 className="text-sm mb-1">Доступно по подписке</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Оформите подписку Премиум для полного доступа ко всем практикам
                  </p>
                  <Button
                    className="w-full"
                    style={{ backgroundColor: dir?.color }}
                    onClick={() => onNavigate('pricing')}
                  >
                    Смотреть тарифы
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Direction topics */}
            {dir && (
              <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                <CardContent className="p-5">
                  <h4 className="text-sm text-muted-foreground mb-3">
                    Темы направления «{dir.name}»
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {dir.topics.map((topic) => (
                      <Badge
                        key={topic}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: `${dir.color}40`, color: dir.color }}
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Reviews section */}
        <div className="mt-8">
          <h3 className="text-lg mb-4">Отзывы пользователей</h3>
          {reviewsLoading ? (
            <div className="text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
              Загрузка отзывов...
            </div>
          ) : (
            <div>
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => {
                    const dateStr = new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                    return (
                      <Card key={review.id} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-white shrink-0"
                              style={{ backgroundColor: dir?.color || '#7A9B6D' }}
                            >
                              {review.userName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">{review.userName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${i < review.rating ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-muted'}`}
                                />
                              ))}
                            </div>
                            {review.userId === user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleReviewDelete(review.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                            {review.text}
                          </p>

                          {/* Instructor reply */}
                          {review.reply && (
                            <div className="mt-3 pl-4 border-l-2 border-[#7A9B6D]/30 bg-[#7A9B6D]/5 rounded-r-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-6 h-6 rounded-full bg-[#7A9B6D]/20 flex items-center justify-center text-[10px] text-[#7A9B6D] shrink-0">
                                  {review.reply.authorName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-[#7A9B6D]">{review.reply.authorName}</span>
                                <Badge className="text-[9px] border-0 bg-[#7A9B6D]/10 text-[#7A9B6D] px-1.5 py-0">Преподаватель</Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(review.reply.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <p className="text-xs text-foreground/80 leading-relaxed">{review.reply.text}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  Пока нет отзывов. Будьте первым, кто оставит свой отзыв!
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          {isAuthenticated && user && (
            <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm mt-6">
              <CardContent className="p-5">
                <h4 className="text-sm mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: dir?.color }} />
                  Оставить отзыв
                </h4>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-white shrink-0"
                    style={{ backgroundColor: '#7A9B6D' }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm">{user.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  <span className="text-xs text-muted-foreground mr-2">Оценка:</span>
                  {Array.from({ length: 5 }, (_, i) => (
                    <button
                      key={i}
                      className="cursor-pointer p-0.5"
                      onMouseEnter={() => setHoverStar(i + 1)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => setReviewRating(i + 1)}
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          i < (hoverStar || reviewRating) ? 'text-[#C9A96E] fill-[#C9A96E]' : 'text-muted'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full h-24 p-3 border border-border rounded-lg text-sm bg-white/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                  placeholder="Поделитесь впечатлениями о практике..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
                <Button
                  className="mt-3 gap-2"
                  style={{ backgroundColor: dir?.color }}
                  onClick={handleReviewSubmit}
                  disabled={submittingReview || !reviewText.trim()}
                >
                  {submittingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Отправляю...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Отправить отзыв
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Pluralize "день" for Russian */
function getDaysWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
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