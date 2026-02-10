import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Users, Loader2, LogIn, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { SCHEDULE_EVENTS, DIRECTIONS } from './data';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { authFetch, anonFetch } from './api';
import { useRealtimeUpdates } from './useRealtimeUpdates';

interface SchedulePageProps {
  onNavigate: (page: string) => void;
}

interface UserBooking {
  eventId: string;
  title: string;
  date: string;
  time: string;
  bookedAt: string;
}

export function SchedulePage({ onNavigate }: SchedulePageProps) {
  const { accessToken, isAuthenticated } = useAuth();
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [myBookings, setMyBookings] = useState<UserBooking[]>([]);
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [loadingEvents, setLoadingEvents] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);

  // Load booking data
  const loadData = useCallback(async () => {
    try {
      // Always load public booking counts
      const countsRes = await anonFetch('/schedule-bookings');
      if (countsRes.ok) {
        const data = await countsRes.json();
        setBookingCounts(data.counts || {});
      }

      // Load user's bookings if authenticated
      if (accessToken) {
        const bookingsRes = await authFetch('/my-bookings', accessToken);
        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setMyBookings(data.bookings || []);
        }
      }
    } catch (err) {
      console.error('Failed to load schedule data:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time updates for booking counts
  useRealtimeUpdates(
    ['schedule:booking-counts', 'schedule:bookings:'],
    loadData,
    30000 // Poll every 30s as fallback
  );

  const bookedEventIds = new Set(myBookings.map((b) => b.eventId));

  const filtered = SCHEDULE_EVENTS.filter((e) => {
    if (selectedDirection && e.direction !== selectedDirection) return false;
    return true;
  });

  const groupedByDate = filtered.reduce<Record<string, typeof SCHEDULE_EVENTS>>((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const handleBook = async (event: typeof SCHEDULE_EVENTS[0]) => {
    if (!accessToken) {
      toast.error('Войдите, чтобы записаться на занятие');
      onNavigate('auth');
      return;
    }

    setLoadingEvents((prev) => new Set([...prev, event.id]));
    try {
      const res = await authFetch('/book-event', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
        }),
      });

      if (res.ok) {
        // Optimistic update
        setMyBookings((prev) => [
          ...prev,
          {
            eventId: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            bookedAt: new Date().toISOString(),
          },
        ]);
        setBookingCounts((prev) => ({
          ...prev,
          [event.id]: (prev[event.id] || 0) + 1,
        }));
        toast.success(`Вы записаны на "${event.title}"`, {
          description: `${formatDate(event.date)} в ${event.time}`,
        });
      } else if (res.status === 409) {
        toast.info('Вы уже записаны на это занятие');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Не удалось записаться');
      }
    } catch (err) {
      console.error('Book event error:', err);
      toast.error('Ошибка при записи. Попробуйте позже.');
    } finally {
      setLoadingEvents((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
    }
  };

  const handleCancel = async (event: typeof SCHEDULE_EVENTS[0]) => {
    if (!accessToken) return;

    setLoadingEvents((prev) => new Set([...prev, event.id]));
    try {
      const res = await authFetch('/cancel-booking', accessToken, {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id }),
      });

      if (res.ok) {
        setMyBookings((prev) => prev.filter((b) => b.eventId !== event.id));
        setBookingCounts((prev) => ({
          ...prev,
          [event.id]: Math.max((prev[event.id] || 0) - 1, 0),
        }));
        toast.success(`Запись на "${event.title}" отменена`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Не удалось отменить запись');
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      toast.error('Ошибка при отмене. Попробуйте позже.');
    } finally {
      setLoadingEvents((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
    }
  };

  const myBookedCount = myBookings.length;

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl mb-3 text-foreground">Расписание живых занятий</h1>
          <p className="text-muted-foreground max-w-2xl">
            Записывайтесь на онлайн-сессии с преподавателями. Все занятия проходят в прямом эфире с возможностью взаимодействия.
          </p>
        </div>

        {/* My bookings summary */}
        {isAuthenticated && myBookedCount > 0 && (
          <Card className="border-0 shadow-none bg-primary/5 backdrop-blur-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Вы записаны на {myBookedCount} {getEventWord(myBookedCount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ближайшее:{' '}
                      {myBookings
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .filter((b) => b.date >= new Date().toISOString().split('T')[0])
                        .slice(0, 1)
                        .map((b) => `«${b.title}» ${formatDate(b.date)} в ${b.time}`)
                        .join('') || 'нет предстоящих'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not logged in hint */}
        {!isAuthenticated && (
          <Card className="border-0 shadow-none bg-amber-50/60 backdrop-blur-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <LogIn className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">
                  <button
                    onClick={() => onNavigate('auth')}
                    className="underline font-medium cursor-pointer hover:text-amber-900"
                  >
                    Войдите
                  </button>{' '}
                  или зарегистрируйтесь, чтобы записаться на живые занятия
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Direction Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedDirection(null)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
              !selectedDirection ? 'bg-primary text-primary-foreground' : 'bg-white/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            Все направления
          </button>
          {DIRECTIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDirection(selectedDirection === d.id ? null : d.id)}
              className="px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1.5"
              style={{
                backgroundColor: selectedDirection === d.id ? d.color : d.colorLight,
                color: selectedDirection === d.id ? 'white' : d.color,
              }}
            >
              {d.icon} {d.name}
            </button>
          ))}
        </div>

        {/* Loading */}
        {initialLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Schedule */}
        {!initialLoading && (
          <div className="space-y-8">
            {Object.entries(groupedByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, events]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h3 className="text-lg">{formatDate(date)}</h3>
                  </div>

                  <div className="space-y-3">
                    {events.map((event) => {
                      const dir = DIRECTIONS.find((d) => d.id === event.direction);
                      const isBooked = bookedEventIds.has(event.id);
                      const isLoading = loadingEvents.has(event.id);
                      const additionalBookings = bookingCounts[event.id] || 0;
                      const totalSpots = event.spots + additionalBookings;
                      const spotsLeft = event.maxSpots - totalSpots;
                      const almostFull = spotsLeft <= 3;
                      const isFull = spotsLeft <= 0;

                      return (
                        <Card
                          key={event.id}
                          className={`border-0 shadow-none backdrop-blur-sm hover:shadow-md transition-all ${
                            isBooked
                              ? 'bg-primary/5 ring-1 ring-primary/20'
                              : 'bg-white/60'
                          }`}
                        >
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              {/* Time */}
                              <div className="flex items-center gap-3 sm:w-24 shrink-0">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: dir?.color }}
                                />
                                <span className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                                  {event.time}
                                </span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base mb-1">{event.title}</h4>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>{event.instructor}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {event.duration} мин
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {isFull ? (
                                      <span className="text-[#C4564A] font-medium">Мест нет</span>
                                    ) : almostFull ? (
                                      <span className="text-[#C4564A]">Осталось {spotsLeft} мест</span>
                                    ) : (
                                      <span>{spotsLeft} мест свободно</span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Direction badge & Button */}
                              <div className="flex items-center gap-3 shrink-0">
                                {dir && (
                                  <Badge
                                    className="text-xs border-0 hidden sm:inline-flex"
                                    style={{ backgroundColor: dir.colorLight, color: dir.color }}
                                  >
                                    {dir.icon} {dir.name}
                                  </Badge>
                                )}
                                {isBooked ? (
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Записаны
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs text-muted-foreground hover:text-destructive gap-1 px-2"
                                      onClick={() => handleCancel(event)}
                                      disabled={isLoading}
                                    >
                                      {isLoading ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                      Отменить
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    onClick={() => handleBook(event)}
                                    disabled={isLoading || isFull}
                                  >
                                    {isLoading ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : isFull ? (
                                      'Мест нет'
                                    ) : (
                                      'Записаться'
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {!initialLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Нет занятий по выбранному направлению.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getEventWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return 'занятий';
  if (last === 1) return 'занятие';
  if (last >= 2 && last <= 4) return 'занятия';
  return 'занятий';
}