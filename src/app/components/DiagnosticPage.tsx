import { useState, useMemo } from 'react';
import { ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { BalanceWheel } from './BalanceWheel';
import { DIAGNOSTIC_QUESTIONS, DIRECTIONS, PRACTICES } from './data';
import { useAuth } from './AuthContext';
import { authFetch } from './api';
import { toast } from 'sonner';

interface DiagnosticPageProps {
  onNavigate: (page: string) => void;
}

export function DiagnosticPage({ onNavigate }: DiagnosticPageProps) {
  const { accessToken, isAuthenticated } = useAuth();
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);

  const progress = ((Object.keys(answers).length) / DIAGNOSTIC_QUESTIONS.length) * 100;

  const scores = useMemo(() => {
    const dirScores: Record<string, { sum: number; count: number }> = {};
    DIRECTIONS.forEach((d) => {
      dirScores[d.id] = { sum: 0, count: 0 };
    });

    Object.entries(answers).forEach(([qIdStr, value]) => {
      const qId = parseInt(qIdStr);
      const q = DIAGNOSTIC_QUESTIONS.find((q) => q.id === qId);
      if (q) {
        dirScores[q.direction].sum += value + 1;
        dirScores[q.direction].count += 1;
      }
    });

    const result: Record<string, number> = {};
    DIRECTIONS.forEach((d) => {
      const s = dirScores[d.id];
      result[d.id] = s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 2.5;
    });
    return result;
  }, [answers]);

  const weakDirections = useMemo(() => {
    return Object.entries(scores)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 3)
      .map(([id]) => DIRECTIONS.find((d) => d.id === id)!);
  }, [scores]);

  const recommendedPractices = useMemo(() => {
    const weakIds = weakDirections.map((d) => d.id);
    return PRACTICES.filter((p) => weakIds.includes(p.direction)).slice(0, 3);
  }, [weakDirections]);

  const handleAnswer = (value: number) => {
    setAnswers({ ...answers, [DIAGNOSTIC_QUESTIONS[currentQ].id]: value });
    if (currentQ < DIAGNOSTIC_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const handleFinish = async () => {
    setShowResults(true);

    // Save diagnostic results to server if authenticated
    if (isAuthenticated && accessToken) {
      setSaving(true);
      try {
        const res = await authFetch('/user-progress', accessToken, {
          method: 'PUT',
          body: JSON.stringify({ scores }),
        });
        if (res.ok) {
          toast.success('Результаты сохранены', {
            description: 'Ваше колесо баланса обновлено в личном кабинете',
          });
        } else {
          const data = await res.json();
          console.error('Failed to save diagnostic results:', data.error);
          toast.error('Не удалось сохранить результаты');
        }
      } catch (err) {
        console.error('Failed to save diagnostic results:', err);
        toast.error('Ошибка сохранения результатов');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleReset = () => {
    setStarted(false);
    setCurrentQ(0);
    setAnswers({});
    setShowResults(false);
  };

  if (!started) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#7A9B6D]/20 via-[#A8C5DA]/20 to-[#C4B5D4]/20 flex items-center justify-center text-4xl">
              🌿
            </div>
            <h1 className="text-3xl sm:text-4xl mb-4 text-foreground">Диагностика баланса</h1>
            <p className="text-muted-foreground max-w-xl mx-auto mb-4" style={{ lineHeight: 1.7 }}>
              Ответьте на 10 вопросов и получите оценку вашего состояния по 7 направлениям
              практики. По результатам мы составим персональный маршрут развития.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Время прохождения: ~3 минуты
            </p>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              onClick={() => setStarted(true)}
            >
              Начать диагностику
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl mb-3 text-foreground">Ваш результат</h1>
            <p className="text-muted-foreground">Колесо баланса показывает ваше текущее состояние по 7 направлениям</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Balance Wheel */}
            <div className="flex justify-center">
              <BalanceWheel scores={scores} size={340} />
            </div>

            {/* Scores */}
            <div className="space-y-3">
              <h3 className="text-lg mb-3">Оценка по направлениям</h3>
              {DIRECTIONS.map((d) => {
                const score = scores[d.id] || 0;
                const percent = (score / 5) * 100;
                return (
                  <div key={d.id} className="flex items-center gap-3">
                    <span className="text-lg w-6">{d.icon}</span>
                    <span className="text-sm w-20 shrink-0">{d.name}</span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${percent}%`, backgroundColor: d.color }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">
                      {score.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="mt-14">
            <h2 className="text-2xl mb-2 text-foreground">Рекомендации</h2>
            <p className="text-muted-foreground mb-6">
              Направления, которые стоит укрепить в первую очередь:
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-10">
              {weakDirections.map((d) => (
                <Card key={d.id} className="border-0 shadow-none bg-white/60">
                  <CardContent className="p-5 text-center">
                    <div
                      className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center text-2xl"
                      style={{ backgroundColor: d.colorLight }}
                    >
                      {d.icon}
                    </div>
                    <h4 className="text-base mb-1" style={{ color: d.color }}>{d.name}</h4>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {recommendedPractices.length > 0 && (
              <>
                <h3 className="text-lg mb-4">Рекомендованные практики</h3>
                <div className="grid sm:grid-cols-3 gap-4 mb-10">
                  {recommendedPractices.map((p) => {
                    const dir = DIRECTIONS.find((d) => d.id === p.direction);
                    return (
                      <Card key={p.id} className="border-0 shadow-none bg-white/60 cursor-pointer hover:shadow-md transition-all">
                        <CardContent className="p-4">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full mb-2 inline-block"
                            style={{ backgroundColor: dir?.colorLight, color: dir?.color }}
                          >
                            {dir?.name}
                          </span>
                          <h4 className="text-sm mb-1">{p.title}</h4>
                          <p className="text-xs text-muted-foreground">{p.duration} мин</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-3 justify-center">
              {isAuthenticated && saving && (
                <div className="w-full text-center mb-2">
                  <p className="text-xs text-muted-foreground animate-pulse">Сохраняем результаты...</p>
                </div>
              )}
              {!isAuthenticated && (
                <div className="w-full text-center mb-3">
                  <p className="text-xs text-muted-foreground">
                    <button
                      onClick={() => onNavigate('auth')}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Войдите или зарегистрируйтесь
                    </button>
                    , чтобы сохранить результаты в личный кабинет
                  </p>
                </div>
              )}
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={() => onNavigate('practices')}
              >
                Перейти к практикам
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
                Пройти заново
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = DIAGNOSTIC_QUESTIONS[currentQ];
  const dir = DIRECTIONS.find((d) => d.id === q.direction);

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Вопрос {currentQ + 1} из {DIAGNOSTIC_QUESTIONS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question */}
        <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: dir?.colorLight, color: dir?.color }}
              >
                {dir?.icon} {dir?.name}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl mb-8" style={{ lineHeight: 1.4 }}>
              {q.question}
            </h2>

            <div className="space-y-3">
              {q.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left px-5 py-3.5 rounded-xl text-sm transition-all cursor-pointer border ${
                    answers[q.id] === i
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background hover:border-primary/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0"
                      style={{
                        borderColor: answers[q.id] === i ? dir?.color : undefined,
                        backgroundColor: answers[q.id] === i ? dir?.color : undefined,
                        color: answers[q.id] === i ? 'white' : undefined,
                      }}
                    >
                      {i + 1}
                    </span>
                    {option}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="ghost"
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Button>

          {Object.keys(answers).length === DIAGNOSTIC_QUESTIONS.length ? (
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              onClick={handleFinish}
            >
              Показать результат
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setCurrentQ(Math.min(DIAGNOSTIC_QUESTIONS.length - 1, currentQ + 1))}
              disabled={currentQ === DIAGNOSTIC_QUESTIONS.length - 1}
              className="gap-2"
            >
              Далее
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}