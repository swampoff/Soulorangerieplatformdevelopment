import { Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-secondary/50 border-t border-border mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7A9B6D] to-[#A8C5DA] flex items-center justify-center text-white text-sm">
                S
              </div>
              <span style={{ fontFamily: "'Cormorant Garamond', serif" }} className="text-lg tracking-wide">
                Soul Orangerie
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Цифровая школа гармоничного развития через 7 направлений практики.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="mb-3 text-sm text-foreground">Платформа</h4>
            <ul className="space-y-2">
              {[
                { id: 'practices', label: 'Практики' },
                { id: 'schedule', label: 'Расписание' },
                { id: 'instructors', label: 'Преподаватели' },
                { id: 'pricing', label: 'Тарифы' },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Directions */}
          <div>
            <h4 className="mb-3 text-sm text-foreground">Направления</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Голос</li>
              <li>Дыхание</li>
              <li>Энергия (Цигун)</li>
              <li>Танец</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-3 text-sm text-foreground">Контакты</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>hello@soulorangerie.com</li>
              <li>Telegram: @soulorangerie</li>
              <li>Москва, Россия</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            2026 Soul Orangerie. Все права защищены.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Создано с <Heart className="w-3 h-3 text-[#E8B4A0]" /> для гармоничной жизни
          </p>
        </div>
      </div>
    </footer>
  );
}
