import { useState } from 'react';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { PRICING_PLANS } from './data';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { authFetch } from './api';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

export function PricingPage({ onNavigate }: PricingPageProps) {
  const { isAuthenticated, user, accessToken, refreshProfile } = useAuth();
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  const currentPlan = user?.plan || 'free';

  const handleSelect = async (planId: string, planName: string) => {
    if (!isAuthenticated || !accessToken) {
      onNavigate('auth');
      toast.info('Войдите или зарегистрируйтесь', {
        description: 'Для выбора тарифа необходимо авторизоваться',
      });
      return;
    }

    // Already on this plan
    if (currentPlan === planId) {
      toast.info('Вы уже на этом тарифе');
      return;
    }

    setSavingPlan(planId);
    try {
      const now = new Date();
      const endDate = planId === 'unlimited'
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : planId === 'free'
          ? null
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const res = await authFetch('/user-subscription', accessToken, {
        method: 'PUT',
        body: JSON.stringify({
          plan: planId,
          status: 'active',
          startDate: now.toISOString(),
          endDate: endDate ? endDate.toISOString() : null,
        }),
      });

      if (res.ok) {
        // Refresh user profile to get updated plan
        await refreshProfile();

        if (planId === 'free') {
          toast.success('Бесплатный план активирован', {
            description: 'Добро пожаловать в Soul Orangerie!',
          });
        } else {
          toast.success(`Тариф "${planName}" активирован`, {
            description: 'Подписка успешно оформлена. Приятных практик!',
          });
        }
      } else {
        const data = await res.json();
        console.error('Subscription error:', data.error);
        toast.error('Не удалось активировать тариф', {
          description: data.error || 'Попробуйте ещё раз',
        });
      }
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setSavingPlan(null);
    }
  };

  const getButtonLabel = (planId: string, price: number) => {
    if (savingPlan === planId) {
      return (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Оформление...
        </span>
      );
    }
    if (currentPlan === planId && isAuthenticated) {
      return 'Текущий план';
    }
    if (price === 0) return 'Начать бесплатно';
    return 'Выбрать план';
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl mb-4 text-foreground">Выберите свой путь</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Начните бесплатно или выберите план, который поможет вам расти быстрее.
            Все тарифы включают доступ к диагностике и колесу баланса.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {PRICING_PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id && isAuthenticated;

            return (
              <Card
                key={plan.id}
                className={`border-0 overflow-hidden transition-all ${
                  isCurrentPlan
                    ? 'shadow-xl ring-2 ring-primary/50 bg-white scale-[1.02]'
                    : plan.highlighted
                      ? 'shadow-xl ring-2 ring-primary/30 bg-white scale-[1.02]'
                      : 'shadow-none bg-white/60 hover:shadow-md'
                }`}
              >
                {isCurrentPlan ? (
                  <div className="bg-gradient-to-r from-[#7A9B6D] to-[#A8C5DA] text-white text-center py-2 text-xs flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Ваш текущий план
                  </div>
                ) : plan.highlighted ? (
                  <div className="bg-gradient-to-r from-[#7A9B6D] to-[#A8C5DA] text-white text-center py-2 text-xs">
                    Популярный выбор
                  </div>
                ) : null}
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl">{plan.name}</h3>
                    {isCurrentPlan && (
                      <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                        Активен
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span
                      className="text-4xl"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {plan.price === 0 ? '0' : plan.price.toLocaleString('ru-RU')}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground">руб{plan.period}</span>
                    )}
                  </div>

                  {plan.price === 0 && (
                    <p className="text-sm text-muted-foreground mb-4">Навсегда</p>
                  )}
                  {plan.price > 0 && plan.period === '/мес' && (
                    <p className="text-xs text-muted-foreground mb-4">Автопродление, отмена в любой момент</p>
                  )}
                  {plan.period === '/год' && (
                    <p className="text-xs text-primary mb-4">Экономия ~37% по сравнению с месячной</p>
                  )}

                  <div className="border-t border-border pt-4 mb-6">
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className={`w-full ${
                      isCurrentPlan
                        ? 'bg-muted text-muted-foreground cursor-default hover:bg-muted'
                        : plan.highlighted || (!isAuthenticated && plan.id === 'premium')
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : ''
                    }`}
                    variant={
                      isCurrentPlan
                        ? 'secondary'
                        : plan.highlighted || (!isAuthenticated && plan.id === 'premium')
                          ? 'default'
                          : 'outline'
                    }
                    disabled={isCurrentPlan || savingPlan !== null}
                    onClick={() => handleSelect(plan.id, plan.name)}
                  >
                    {getButtonLabel(plan.id, plan.price)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl text-center mb-8">Частые вопросы</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Могу ли я сменить тариф?',
                a: 'Да, вы можете перейти на другой тариф в любой момент. При переходе на более дорогой тариф разница будет рассчитана пропорционально.',
              },
              {
                q: 'Как отменить подписку?',
                a: 'Вы можете отменить подписку в любой момент в личном кабинете. Доступ сохраняется до конца оплаченного периода.',
              },
              {
                q: 'Какие способы оплаты поддерживаются?',
                a: 'Мы принимаем банковские карты (Visa, Mastercard, МИР) через ЮKassa. Для международных платежей также доступен Stripe.',
              },
              {
                q: 'Есть ли пробный период?',
                a: 'Бесплатный тариф доступен без ограничений по времени. Для платных тарифов предусмотрен 7-дневный пробный период.',
              },
            ].map((faq) => (
              <Card key={faq.q} className="border-0 shadow-none bg-white/60">
                <CardContent className="p-5">
                  <h4 className="text-sm mb-2">{faq.q}</h4>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <p className="text-muted-foreground mb-4">Не уверены, какой тариф выбрать?</p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => onNavigate('diagnostic')}
          >
            Пройдите диагностику — мы поможем
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
