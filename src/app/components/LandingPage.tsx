import { useState, useEffect } from 'react';
import { ArrowRight, Play, Star, ChevronRight, Check, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { DIRECTIONS, INSTRUCTORS, PRICING_PLANS, TESTIMONIALS } from './data';
import { ImageWithFallback } from './ImageWithFallback';
import { anonFetch } from './api';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  direction: string;
  author: string;
  created_at: string;
}

const BLOG_AUTHORS: Record<string, { name: string; avatar: string }> = {
  nik: { name: 'Ник', avatar: '/platform/avatars/nik.jpg' },
  pavel: { name: 'Павел', avatar: '/platform/avatars/pavel.jpg' },
};

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    anonFetch('/posts?limit=3')
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(data => setBlogPosts(data.posts || []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Watercolor background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[#A8C5DA]/10 blur-[100px] translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-[#7A9B6D]/10 blur-[100px] -translate-x-1/3 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full bg-[#C4B5D4]/8 blur-[80px] -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Цифровая школа гармоничного развития
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tight mb-6 text-foreground" style={{ lineHeight: 1.15 }}>
                Оранжерея
                <br />
                <span className="bg-gradient-to-r from-[#7A9B6D] via-[#A8C5DA] to-[#C4B5D4] bg-clip-text text-transparent">
                  Души
                </span>
              </h1>

              <p className="text-lg text-muted-foreground mb-8" style={{ lineHeight: 1.7 }}>
                Раскройте свой потенциал через 7 направлений практики: голос, дыхание,
                энергия, танец, питание, вода и музыка. Системный подход к телу и осознанности.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  onClick={() => onNavigate('diagnostic')}
                >
                  Пройти диагностику
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2"
                  onClick={() => onNavigate('practices')}
                >
                  <Play className="w-4 h-4" />
                  Смотреть практики
                </Button>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative w-full aspect-square max-w-lg mx-auto">
                {/* Decorative ring */}
                <div className="absolute inset-4 rounded-full border-2 border-dashed border-primary/15 animate-[spin_60s_linear_infinite]" />
                
                {/* Center image */}
                <div className="absolute inset-12 rounded-full overflow-hidden shadow-lg">
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1763348682543-e5b282af4c03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmVlbmhvdXNlJTIwb3JhbmdlcmllJTIwYm90YW5pY2FsJTIwZ2FyZGVuJTIwbGlnaHR8ZW58MXx8fHwxNzcwNTM3NDgzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Soul Orangerie"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Floating direction badges */}
                {DIRECTIONS.slice(0, 7).map((d, i) => {
                  const angle = (i / 7) * 2 * Math.PI - Math.PI / 2;
                  const radius = 48;
                  const x = 50 + radius * Math.cos(angle);
                  const y = 50 + radius * Math.sin(angle);
                  return (
                    <div
                      key={d.id}
                      className="absolute w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-white text-lg"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      {d.icon}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7 Directions */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-[#D4A574]/8 blur-[80px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl mb-4 text-foreground">7 направлений практики</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Каждое направление — это путь к определённому аспекту гармонии. Вместе они создают целостную систему развития.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {DIRECTIONS.map((d) => (
              <Card
                key={d.id}
                className="group cursor-pointer border-0 shadow-none hover:shadow-md transition-all duration-300 bg-white/60 backdrop-blur-sm"
                onClick={() => onNavigate('practices')}
              >
                <CardContent className="p-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: d.colorLight }}
                  >
                    {d.icon}
                  </div>
                  <h3 className="text-lg mb-2" style={{ color: d.color }}>
                    {d.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">{d.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {d.topics.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: d.colorLight, color: d.color }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl mb-4 text-foreground">Как работает школа</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Простой путь к гармонии за 4 шага
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Диагностика',
                desc: 'Пройдите тест и получите оценку состояния по 7 направлениям',
                color: '#7A9B6D',
              },
              {
                step: '02',
                title: 'Персональный маршрут',
                desc: 'Получите рекомендации практик, подобранных именно для вас',
                color: '#A8C5DA',
              },
              {
                step: '03',
                title: 'Практика',
                desc: 'Занимайтесь онлайн или на живых сессиях с преподавателями',
                color: '#C4B5D4',
              },
              {
                step: '04',
                title: 'Рост',
                desc: 'Отслеживайте прогресс и наблюдайте, как раскрывается ваш потенциал',
                color: '#D4A574',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-lg"
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    backgroundColor: item.color,
                  }}
                >
                  {item.step}
                </div>
                <h3 className="text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instructors Preview */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#C4B5D4]/8 blur-[80px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-14 gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl mb-2 text-foreground">Преподаватели</h2>
              <p className="text-muted-foreground">Мастера своего дела с многолетним опытом</p>
            </div>
            <Button variant="ghost" className="gap-1 text-primary" onClick={() => onNavigate('instructors')}>
              Все преподаватели <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {INSTRUCTORS.map((inst) => (
              <Card
                key={inst.id}
                className="overflow-hidden border-0 shadow-none bg-white/60 backdrop-blur-sm hover:shadow-md transition-all group cursor-pointer"
                onClick={() => onNavigate('instructors')}
              >
                <div className="aspect-[4/5] overflow-hidden">
                  <ImageWithFallback
                    src={inst.image}
                    alt={inst.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-4">
                  <h3 className="text-base mb-1">{inst.name}</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {inst.specializations.map((s) => {
                      const dir = DIRECTIONS.find((d) => d.id === s);
                      return dir ? (
                        <span
                          key={s}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: dir.colorLight, color: dir.color }}
                        >
                          {dir.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl mb-4 text-foreground">Тарифы</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Выберите план, который подходит именно вам
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRICING_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`border-0 overflow-hidden transition-all ${
                  plan.highlighted
                    ? 'shadow-lg ring-2 ring-primary/30 bg-white'
                    : 'shadow-none bg-white/60 hover:shadow-md'
                }`}
              >
                {plan.highlighted && (
                  <div className="bg-primary text-primary-foreground text-center py-1.5 text-xs">
                    Популярный выбор
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-lg mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                      {plan.price === 0 ? 'Бесплатно' : `${plan.price.toLocaleString('ru-RU')}`}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-muted-foreground">руб{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : ''
                    }`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    onClick={() => onNavigate('pricing')}
                  >
                    {plan.price === 0 ? 'Начать бесплатно' : 'Выбрать план'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Section */}
      {blogPosts.length > 0 && (
        <section className="py-20 relative bg-secondary/20">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full bg-[#C4B5D4]/8 blur-[80px]" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-3xl sm:text-4xl mb-4 text-foreground">Блог мастеров</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Глубокие статьи, духовные практики и мудрость от наших мастеров</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogPosts.map((post) => {
                const dir = DIRECTIONS.find(d => d.id === post.direction) || { name: post.direction, color: '#7A9B6D', icon: '📝' };
                const author = BLOG_AUTHORS[post.author] || { name: post.author, avatar: '' };
                const date = new Date(post.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

                return (
                  <Card
                    key={post.id}
                    className="group border-border/50 hover:border-primary/20 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                    onClick={() => onNavigate(`post:${post.id}`)}
                  >
                    <CardContent className="p-0">
                      <div className="h-1.5" style={{ backgroundColor: dir.color }} />
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="secondary" className="text-xs font-normal" style={{ backgroundColor: `${dir.color}15`, color: dir.color }}>
                            {dir.icon} {dir.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{date}</span>
                        </div>
                        <h3 className="text-base font-medium text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                          {post.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.excerpt}</p>
                        <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                          <img src={author.avatar} alt={author.name} className="w-7 h-7 rounded-full object-cover" />
                          <span className="text-sm text-muted-foreground">{author.name}</span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors ml-auto" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="text-center mt-10">
              <Button variant="outline" size="lg" onClick={() => onNavigate('news')}>
                Все статьи <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-20 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-[300px] h-[300px] rounded-full bg-[#7A9B6D]/8 blur-[80px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl mb-4 text-foreground">Отзывы учеников</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => {
              const dir = DIRECTIONS.find((d) => d.id === t.direction);
              return (
                <Card key={t.id} className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-4 h-4 fill-[#C9A96E] text-[#C9A96E]" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4" style={{ lineHeight: 1.7 }}>
                      "{t.text}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm text-white"
                        style={{ backgroundColor: dir?.color || '#7A9B6D' }}
                      >
                        {t.avatar}
                      </div>
                      <div>
                        <p className="text-sm">{t.name}</p>
                        {dir && (
                          <p className="text-xs text-muted-foreground">
                            Практика: {dir.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-[#7A9B6D]/10 via-[#A8C5DA]/10 to-[#C4B5D4]/10 rounded-3xl p-10 sm:p-14 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#A8C5DA]/15 blur-[40px]" />
              <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-[#7A9B6D]/15 blur-[40px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl mb-4 text-foreground">Готовы начать путь?</h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Пройдите диагностику и получите персональный маршрут развития через 7 направлений практики.
              </p>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={() => onNavigate('diagnostic')}
              >
                Пройти диагностику
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
