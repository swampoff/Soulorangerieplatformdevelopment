import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { anonFetch } from './api';
import { DIRECTIONS } from './data';

interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  direction: string;
  author: string;
  image: string | null;
  created_at: string;
}

interface NewsDetailPageProps {
  postId: string;
  onNavigate: (page: string) => void;
}

const AUTHORS: Record<string, { name: string; fullName: string; avatar: string; bio: string }> = {
  nik: {
    name: 'Ник',
    fullName: 'Ник',
    avatar: '/platform/avatars/nik.jpg',
    bio: 'Духовный исследователь, практик трансформационных методов',
  },
  pavel: {
    name: 'Павел',
    fullName: 'Павел',
    avatar: '/platform/avatars/pavel.jpg',
    bio: 'Практик, преподаватель телесных и энергетических практик',
  },
};

function getDirectionInfo(id: string) {
  return DIRECTIONS.find(d => d.id === id) || { name: id, color: '#7A9B6D', icon: '📝', colorLight: 'rgba(122,155,109,0.1)' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function NewsDetailPage({ postId, onNavigate }: NewsDetailPageProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await anonFetch(`/posts/${postId}`);
        if (res.ok) {
          setPost(await res.json());
        } else {
          setError('Статья не найдена');
        }
      } catch {
        setError('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">{error || 'Статья не найдена'}</p>
        <Button variant="outline" onClick={() => onNavigate('news')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> К блогу
        </Button>
      </div>
    );
  }

  const dir = getDirectionInfo(post.direction);
  const author = AUTHORS[post.author] || { name: post.author, fullName: post.author, avatar: '', bio: '' };

  // Convert plain text content to paragraphs
  const paragraphs = post.content.split(/\n\n+/).filter(Boolean);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: post.excerpt, url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-16 bg-background">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: `radial-gradient(circle, ${dir.color} 0%, transparent 70%)` }} />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
        {/* Back button */}
        <button
          onClick={() => onNavigate('news')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Все статьи
        </button>

        {/* Direction + Date */}
        <div className="flex items-center gap-3 mb-4">
          <Badge
            variant="secondary"
            className="text-sm font-normal"
            style={{ backgroundColor: `${dir.color}15`, color: dir.color }}
          >
            {dir.icon} {dir.name}
          </Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(post.created_at)}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
          className="text-3xl sm:text-4xl text-foreground mb-6 leading-tight"
        >
          {post.title}
        </h1>

        {/* Author card */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border">
          <img
            src={author.avatar}
            alt={author.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <div className="text-sm font-medium text-foreground">{author.name}</div>
            <div className="text-xs text-muted-foreground">{author.bio}</div>
          </div>
          <button
            onClick={handleShare}
            className="ml-auto p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            title="Поделиться"
          >
            <Share2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <article className="prose prose-lg max-w-none">
          {paragraphs.map((p, i) => {
            // Check if paragraph looks like a heading (short, no period at end)
            const isHeading = p.length < 80 && !p.endsWith('.') && !p.endsWith('?') && !p.endsWith('!') && (p.startsWith('**') || p.startsWith('#') || /^[А-ЯA-Z]/.test(p));
            const cleanText = p.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');

            if (isHeading && p.startsWith('**')) {
              return <h3 key={i} className="text-xl font-medium text-foreground mt-8 mb-3">{cleanText}</h3>;
            }
            if (p.startsWith('#')) {
              return <h3 key={i} className="text-xl font-medium text-foreground mt-8 mb-3">{cleanText}</h3>;
            }
            // Regular paragraph — handle inline markdown bold
            const html = p
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>');
            return <p key={i} className="text-foreground/90 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: html }} />;
          })}
        </article>

        {/* Author signature */}
        <div className="mt-12 pt-8 border-t border-border flex items-center gap-4">
          <img
            src={author.avatar}
            alt={author.name}
            className="w-14 h-14 rounded-full object-cover"
          />
          <div>
            <div className="text-sm text-muted-foreground italic">С теплом и вниманием,</div>
            <div className="text-base font-medium text-foreground">{author.name}</div>
          </div>
        </div>

        {/* Back to blog */}
        <div className="mt-10 text-center">
          <Button variant="outline" onClick={() => onNavigate('news')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Все статьи
          </Button>
        </div>
      </div>
    </div>
  );
}
