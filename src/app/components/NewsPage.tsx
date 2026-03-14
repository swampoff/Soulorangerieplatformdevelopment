import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Calendar, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { anonFetch } from './api';
import { DIRECTIONS } from './data';

interface Post {
  id: string;
  title: string;
  excerpt: string;
  direction: string;
  author: string;
  image: string | null;
  created_at: string;
}

interface NewsPageProps {
  onNavigate: (page: string) => void;
}

const AUTHORS: Record<string, { name: string; avatar: string }> = {
  nik: { name: 'Ник', avatar: '/platform/avatars/nik.jpg' },
  pavel: { name: 'Павел', avatar: '/platform/avatars/pavel.jpg' },
};

function getDirectionInfo(id: string) {
  return DIRECTIONS.find(d => d.id === id) || { name: id, color: '#7A9B6D', icon: '📝', colorLight: 'rgba(122,155,109,0.1)' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function NewsPage({ onNavigate }: NewsPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeDirection, setActiveDirection] = useState<string | null>(null);

  const loadPosts = useCallback(async (pageNum: number, direction: string | null, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '9' });
      if (direction) params.set('direction', direction);

      const res = await anonFetch(`/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    loadPosts(1, activeDirection);
  }, [activeDirection, loadPosts]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage, activeDirection, true);
  };

  return (
    <div className="min-h-screen pt-20 pb-16 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #7A9B6D 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #A8C5DA 0%, transparent 70%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-3xl sm:text-4xl mb-3 text-foreground">
            Блог мастеров
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Глубокие статьи, практические советы и духовные инсайты от мастеров Soul Orangerie
          </p>
        </div>

        {/* Direction filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setActiveDirection(null)}
            className={`px-4 py-2 rounded-full text-sm transition-all cursor-pointer ${
              !activeDirection
                ? 'bg-foreground text-background'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            Все
          </button>
          {DIRECTIONS.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveDirection(d.id)}
              className={`px-4 py-2 rounded-full text-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                activeDirection === d.id
                  ? 'text-white shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              style={activeDirection === d.id ? { backgroundColor: d.color } : {}}
            >
              <span>{d.icon}</span>
              {d.name}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {loading && posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Загрузка статей...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">Статей пока нет</p>
            <p className="text-sm text-muted-foreground mt-1">Скоро здесь появятся новые публикации</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => {
                const dir = getDirectionInfo(post.direction);
                const author = AUTHORS[post.author] || { name: post.author, avatar: '' };

                return (
                  <Card
                    key={post.id}
                    className="group border-border/50 hover:border-primary/20 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                    onClick={() => onNavigate(`post:${post.id}`)}
                  >
                    <CardContent className="p-0">
                      {/* Direction color bar */}
                      <div className="h-1.5" style={{ backgroundColor: dir.color }} />

                      <div className="p-5">
                        {/* Direction badge + date */}
                        <div className="flex items-center justify-between mb-3">
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal"
                            style={{ backgroundColor: `${dir.color}15`, color: dir.color }}
                          >
                            {dir.icon} {dir.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.created_at)}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-medium text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                          {post.title}
                        </h3>

                        {/* Excerpt */}
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                          {post.excerpt}
                        </p>

                        {/* Author */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2">
                            <img
                              src={author.avatar}
                              alt={author.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span className="text-sm text-muted-foreground">{author.name}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Load more */}
            {posts.length < total && (
              <div className="text-center mt-10">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? 'Загрузка...' : 'Загрузить ещё'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
