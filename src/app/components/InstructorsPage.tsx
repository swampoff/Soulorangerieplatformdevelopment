import { useState } from 'react';
import { BookOpen, Calendar } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { INSTRUCTORS, DIRECTIONS, SCHEDULE_EVENTS } from './data';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface InstructorsPageProps {
  onNavigate: (page: string) => void;
}

export function InstructorsPage({ onNavigate }: InstructorsPageProps) {
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);

  const selected = selectedInstructor
    ? INSTRUCTORS.find((i) => i.id === selectedInstructor)
    : null;

  const upcomingSessions = selected
    ? SCHEDULE_EVENTS.filter((e) => e.instructor === selected.name)
    : [];

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl mb-3 text-foreground">Наши преподаватели</h1>
          <p className="text-muted-foreground max-w-2xl">
            Каждый преподаватель — мастер своего направления с многолетним опытом практики и обучения.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Instructor list */}
          <div className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 gap-5">
              {INSTRUCTORS.map((inst) => (
                <Card
                  key={inst.id}
                  className={`overflow-hidden border-0 transition-all cursor-pointer ${
                    selectedInstructor === inst.id
                      ? 'shadow-lg ring-2 ring-primary/30 bg-white'
                      : 'shadow-none bg-white/60 hover:shadow-md'
                  }`}
                  onClick={() =>
                    setSelectedInstructor(selectedInstructor === inst.id ? null : inst.id)
                  }
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <ImageWithFallback
                      src={inst.image}
                      alt={inst.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <CardContent className="p-5">
                    <h3 className="text-lg mb-2">{inst.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {inst.specializations.map((s) => {
                        const dir = DIRECTIONS.find((d) => d.id === s);
                        return dir ? (
                          <Badge
                            key={s}
                            className="text-xs border-0"
                            style={{ backgroundColor: dir.colorLight, color: dir.color }}
                          >
                            {dir.icon} {dir.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3" style={{ lineHeight: 1.6 }}>
                      {inst.bio}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{inst.practiceCount} практик</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Details sidebar */}
          <div className="lg:col-span-1">
            {selected ? (
              <div className="sticky top-24 space-y-6">
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <h3 className="text-lg mb-3">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4" style={{ lineHeight: 1.7 }}>
                      {selected.bio}
                    </p>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Специализация:</p>
                      {selected.specializations.map((s) => {
                        const dir = DIRECTIONS.find((d) => d.id === s);
                        return dir ? (
                          <div key={s} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: dir.colorLight }}>
                            <span className="text-lg">{dir.icon}</span>
                            <div>
                              <p className="text-sm" style={{ color: dir.color }}>{dir.name}</p>
                              <p className="text-xs text-muted-foreground">{dir.description}</p>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </CardContent>
                </Card>

                {upcomingSessions.length > 0 && (
                  <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-primary" />
                        <h4 className="text-sm">Предстоящие занятия</h4>
                      </div>
                      <div className="space-y-2">
                        {upcomingSessions.map((s) => {
                          const dir = DIRECTIONS.find((d) => d.id === s.direction);
                          return (
                            <div
                              key={s.id}
                              className="p-3 rounded-lg bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => onNavigate('schedule')}
                            >
                              <p className="text-sm mb-1">{s.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{s.date}</span>
                                <span>{s.time}</span>
                                <span>{s.duration} мин</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="sticky top-24">
                <Card className="border-0 shadow-none bg-white/60 backdrop-blur-sm">
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground text-sm">
                      Выберите преподавателя, чтобы увидеть подробную информацию
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
