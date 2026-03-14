import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import { hashPassword, verifyPassword, createToken, getAuthUser } from './auth.js';

// Sanitize HTML to prevent XSS
function sanitizeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rate limiter (in-memory)
const rateLimits = new Map();
function rateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now - entry.start > windowMs) {
    rateLimits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= maxAttempts;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.start > 300000) rateLimits.delete(key);
  }
}, 300000);

const app = new Hono();

app.use('*', logger());
app.use('/*', cors({
  origin: ['https://soulorangerie.ru', 'https://www.soulorangerie.ru', 'http://localhost:5173'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

// ============================================================
// Health check
// ============================================================
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ============================================================
// POST /api/signup
// ============================================================
app.post('/api/signup', async (c) => {
  try {
    const clientIp = c.req.header('x-real-ip') || 'unknown';
    if (!rateLimit('signup:' + clientIp, 3, 60000)) {
      return c.json({ error: 'Слишком много попыток. Подождите минуту' }, 429);
    }

    const { email, password, name } = await c.req.json();
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }
    if (String(email).length > 254) return c.json({ error: 'Email too long' }, 400);
    if (String(name).length > 100) return c.json({ error: 'Name too long' }, 400);
    if (String(password).length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
    if (String(password).length > 128) return c.json({ error: 'Password too long' }, 400);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return c.json({ error: 'User with this email already exists' }, 400);
    }

    const id = uuidv4();
    const password_hash = hashPassword(password);
    const safeName = sanitizeHtml(String(name).slice(0, 100));
    const avatar = safeName.charAt(0).toUpperCase();

    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, role, plan, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, email, password_hash, safeName, 'student', 'free', avatar);

    const token = createToken({ id, email, role: 'student' });
    console.log(`User created: ${email} (${id}), role=student`);
    return c.json({ success: true, userId: id, token });
  } catch (err) {
    console.log(`Signup error: ${err}`);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

// ============================================================
// POST /api/login
// ============================================================
app.post('/api/login', async (c) => {
  try {
    const clientIp = c.req.header('x-real-ip') || 'unknown';
    if (!rateLimit('login:' + clientIp, 5, 60000)) {
      return c.json({ error: 'Слишком много попыток. Подождите минуту' }, 429);
    }

    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return c.json({ error: 'Invalid login credentials' }, 401);
    }

    const token = createToken(user);
    console.log(`User logged in: ${email}`);
    return c.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, avatar: user.avatar }
    });
  } catch (err) {
    console.log(`Login error: ${err}`);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// ============================================================
// GET /api/user-profile
// ============================================================
app.get('/api/user-profile', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json(user);
});

// ============================================================
// PUT /api/user-profile
// ============================================================
app.put('/api/user-profile', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const updates = await c.req.json();

  // Handle password change
  if (updates.password) {
    if (updates.password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashPassword(updates.password), user.id);
  }

  const allowed = ['name', 'avatar'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(sanitizeHtml(String(updates[key]).slice(0, 100)));
    }
  }
  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  const updated = db.prepare('SELECT id, email, name, role, plan, avatar FROM users WHERE id = ?').get(user.id);
  return c.json(updated);
});

// seed-demo endpoint removed for security

// ============================================================
// GET /api/user-progress
// ============================================================
app.get('/api/user-progress', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const row = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(user.id);
  if (row) return c.json(JSON.parse(row.data));
  return c.json({ scores: {}, practiceCount: 0, totalMinutes: 0, streakDays: 0, completedPractices: [], achievements: [] });
});

// ============================================================
// PUT /api/user-progress
// ============================================================
app.put('/api/user-progress', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const updates = await c.req.json();
  const row = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(user.id);
  const existing = row ? JSON.parse(row.data) : {};
  const updated = { ...existing, ...updates };

  db.prepare('INSERT INTO user_progress (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = ?')
    .run(user.id, JSON.stringify(updated), JSON.stringify(updated));
  return c.json(updated);
});

// ============================================================
// GET /api/user-subscription
// ============================================================
app.get('/api/user-subscription', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id);
  if (row) return c.json({ plan: row.plan, status: row.status, startDate: row.start_date, endDate: row.end_date, ...JSON.parse(row.data || '{}') });
  return c.json({ plan: 'free', status: 'active', startDate: null, endDate: null });
});

// ============================================================
// PUT /api/user-subscription
// ============================================================
app.put('/api/user-subscription', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'admin') return c.json({ error: 'Forbidden: admin only' }, 403);

  const updates = await c.req.json();
  db.prepare(`INSERT INTO subscriptions (user_id, plan, status) VALUES (?, ?, 'active')
    ON CONFLICT(user_id) DO UPDATE SET plan = COALESCE(?, plan), status = COALESCE(?, status)`)
    .run(user.id, updates.plan || 'free', updates.plan, updates.status);

  if (updates.plan) {
    db.prepare('UPDATE users SET plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(updates.plan, user.id);
  }

  const row = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(user.id);
  return c.json({ plan: row.plan, status: row.status, startDate: row.start_date, endDate: row.end_date });
});

// ============================================================
// Achievement definitions
// ============================================================
function computeAchievements(p) {
  const dp = p.directionProgress || {};
  const pc = Number(p.practiceCount) || 0;
  const streak = Number(p.streakDays) || 0;
  const mins = Number(p.totalMinutes) || 0;
  const completed = Array.isArray(p.completedPractices) ? p.completedPractices.length : 0;
  const directionsUsed = Object.keys(dp).filter(k => dp[k] > 0).length;
  return [
    { id: '1', title: 'Первый шаг', desc: 'Прошли первую практику', icon: '🌱', earned: pc >= 1 },
    { id: '2', title: '7 дней подряд', desc: 'Практика каждый день неделю', icon: '🔥', earned: streak >= 7 },
    { id: '3', title: 'Голос открыт', desc: '10 практик по голосу', icon: '🎵', earned: (dp.voice || 0) >= 10 },
    { id: '4', title: 'Водный мастер', desc: '10 практик с водой', icon: '💧', earned: (dp.water || 0) >= 10 },
    { id: '5', title: 'Поток энергии', desc: '20 практик цигуна', icon: '✨', earned: (dp.energy || 0) >= 20 },
    { id: '6', title: '30 дней подряд', desc: 'Месяц без пропусков', icon: '🏆', earned: streak >= 30 },
    { id: '7', title: 'Исследователь', desc: 'Практики в 3+ направлениях', icon: '🧭', earned: directionsUsed >= 3 },
    { id: '8', title: 'Марафонец', desc: '100+ минут практик', icon: '⏱️', earned: mins >= 100 },
    { id: '9', title: 'Многогранность', desc: '5+ уникальных практик', icon: '💎', earned: completed >= 5 },
    { id: '10', title: 'Мастер', desc: '50 завершённых практик', icon: '👑', earned: pc >= 50 },
  ];
}

// ============================================================
// POST /api/complete-practice
// ============================================================
app.post('/api/complete-practice', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { practiceId, duration, direction } = await c.req.json();
  if (!practiceId || !duration || !direction) {
    return c.json({ error: 'practiceId, duration, and direction are required' }, 400);
  }

  const DEFAULT_WEEK = [
    { day: 'Пн', minutes: 0 }, { day: 'Вт', minutes: 0 }, { day: 'Ср', minutes: 0 },
    { day: 'Чт', minutes: 0 }, { day: 'Пт', minutes: 0 }, { day: 'Сб', minutes: 0 }, { day: 'Вс', minutes: 0 },
  ];

  const row = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(user.id);
  const existing = row ? JSON.parse(row.data) : {
    scores: {}, practiceCount: 0, totalMinutes: 0, streakDays: 0,
    lastPracticeDate: null, completedPractices: [], directionProgress: {},
    weeklyActivity: JSON.parse(JSON.stringify(DEFAULT_WEEK)), weekStartDate: null,
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const completed = Array.isArray(existing.completedPractices) ? [...existing.completedPractices] : [];
  if (!completed.includes(practiceId)) completed.push(practiceId);

  const practiceCount = (Number(existing.practiceCount) || 0) + 1;
  const totalMinutes = (Number(existing.totalMinutes) || 0) + Number(duration);

  const dirProg = existing.directionProgress || {};
  dirProg[direction] = (dirProg[direction] || 0) + 1;

  let streakDays = Number(existing.streakDays) || 0;
  const lastPracticeDate = existing.lastPracticeDate;
  if (lastPracticeDate === todayStr) {
    // already practiced today
  } else if (lastPracticeDate) {
    const diff = Math.round((new Date(todayStr + 'T00:00:00Z').getTime() - new Date(lastPracticeDate + 'T00:00:00Z').getTime()) / 86400000);
    streakDays = diff === 1 ? streakDays + 1 : 1;
  } else {
    streakDays = 1;
  }

  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset);
  const mondayStr = monday.toISOString().split('T')[0];

  let weeklyActivity = Array.isArray(existing.weeklyActivity) && existing.weeklyActivity.length === 7
    ? existing.weeklyActivity.map(d => ({ ...d }))
    : JSON.parse(JSON.stringify(DEFAULT_WEEK));

  if (existing.weekStartDate !== mondayStr) {
    weeklyActivity = JSON.parse(JSON.stringify(DEFAULT_WEEK));
  }

  const dayMap = [6, 0, 1, 2, 3, 4, 5];
  weeklyActivity[dayMap[dayOfWeek]].minutes += Number(duration);

  const oldAchievements = computeAchievements(existing);
  const updated = {
    ...existing, practiceCount, totalMinutes, streakDays,
    lastPracticeDate: todayStr, completedPractices: completed,
    directionProgress: dirProg, weeklyActivity, weekStartDate: mondayStr,
  };
  const newAchievements = computeAchievements(updated);
  const newlyEarned = newAchievements.filter(na => na.earned && !oldAchievements.find(oa => oa.id === na.id && oa.earned));
  updated.achievements = newAchievements;

  db.prepare('INSERT INTO user_progress (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = ?')
    .run(user.id, JSON.stringify(updated), JSON.stringify(updated));

  return c.json({ ...updated, newAchievements: newlyEarned });
});

// ============================================================
// SCHEDULE BOOKINGS
// ============================================================

app.get('/api/schedule-bookings', async (c) => {
  const rows = db.prepare('SELECT event_id, COUNT(*) as cnt FROM bookings WHERE status = ? GROUP BY event_id').all('active');
  const counts = {};
  for (const r of rows) counts[r.event_id] = r.cnt;
  return c.json({ counts });
});

app.get('/api/my-bookings', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const bookings = db.prepare('SELECT event_id as eventId, title, date, time, booked_at as bookedAt FROM bookings WHERE user_id = ? AND status = ?').all(user.id, 'active');
  return c.json({ bookings });
});

app.post('/api/book-event', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { eventId, eventTitle, eventDate, eventTime } = await c.req.json();
  if (!eventId) return c.json({ error: 'eventId is required' }, 400);

  const existing = db.prepare('SELECT id FROM bookings WHERE user_id = ? AND event_id = ? AND status = ?').get(user.id, eventId, 'active');
  if (existing) return c.json({ error: 'Already booked for this event' }, 409);

  db.prepare('INSERT INTO bookings (user_id, event_id, title, date, time) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, eventId, eventTitle || '', eventDate || '', eventTime || '');

  const count = db.prepare('SELECT COUNT(*) as cnt FROM bookings WHERE event_id = ? AND status = ?').get(eventId, 'active');

  // Create notification
  const notifId = `book-${eventId}-${Date.now()}`;
  db.prepare('INSERT INTO notifications (id, user_id, type, title, message, icon, link) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(notifId, user.id, 'booking', 'Вы записаны!', `Вы записались на "${eventTitle}" (${eventDate} в ${eventTime})`, '📅', 'schedule');

  return c.json({ success: true, totalBooked: count.cnt });
});

app.post('/api/cancel-booking', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { eventId } = await c.req.json();
  if (!eventId) return c.json({ error: 'eventId is required' }, 400);

  const result = db.prepare('DELETE FROM bookings WHERE user_id = ? AND event_id = ? AND status = ?').run(user.id, eventId, 'active');
  if (result.changes === 0) return c.json({ error: 'Not booked for this event' }, 404);

  const count = db.prepare('SELECT COUNT(*) as cnt FROM bookings WHERE event_id = ? AND status = ?').get(eventId, 'active');
  return c.json({ success: true, totalBooked: count.cnt });
});

// ============================================================
// NOTIFICATIONS
// ============================================================

app.get('/api/notifications', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const stored = db.prepare(
    'SELECT id, type, title, message, icon, link, read, created_at as createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(user.id).map(n => ({ ...n, read: !!n.read }));

  // Dynamic notifications
  const progressRow = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(user.id);
  const progress = progressRow ? JSON.parse(progressRow.data) : {};
  const dynamic = [];
  const todayStr = new Date().toISOString().split('T')[0];

  const lastPracticeDate = progress.lastPracticeDate;
  const streakDays = Number(progress.streakDays) || 0;
  if (lastPracticeDate && streakDays > 0) {
    const diffDays = Math.round((new Date(todayStr + 'T00:00:00Z').getTime() - new Date(lastPracticeDate + 'T00:00:00Z').getTime()) / 86400000);
    if (diffDays === 1) {
      dynamic.push({
        id: `streak-risk-${todayStr}`, type: 'streak', title: 'Сохраните свой стрик!',
        message: `У вас ${streakDays} ${streakDays === 1 ? 'день' : streakDays < 5 ? 'дня' : 'дней'} подряд. Не забудьте практику сегодня!`,
        createdAt: new Date().toISOString(), read: false, icon: '🔥', link: 'practices',
      });
    } else if (diffDays >= 2) {
      dynamic.push({
        id: `streak-lost-${todayStr}`, type: 'streak', title: 'Стрик прервался',
        message: 'Начните новую серию практик прямо сейчас!',
        createdAt: new Date().toISOString(), read: false, icon: '💪', link: 'practices',
      });
    }
  }

  const userBookings = db.prepare('SELECT event_id as eventId, title, date, time FROM bookings WHERE user_id = ? AND status = ?').all(user.id, 'active');
  for (const booking of userBookings) {
    if (booking.date === todayStr) {
      dynamic.push({
        id: `reminder-${booking.eventId}-${todayStr}`, type: 'reminder', title: 'Занятие сегодня!',
        message: `«${booking.title}» в ${booking.time}`, createdAt: new Date().toISOString(), read: false, icon: '⏰', link: 'schedule',
      });
    } else if (booking.date > todayStr) {
      const daysUntil = Math.round((new Date(booking.date + 'T00:00:00Z').getTime() - new Date(todayStr + 'T00:00:00Z').getTime()) / 86400000);
      if (daysUntil === 1) {
        dynamic.push({
          id: `reminder-tomorrow-${booking.eventId}`, type: 'reminder', title: 'Занятие завтра',
          message: `«${booking.title}» в ${booking.time}`, createdAt: new Date().toISOString(), read: false, icon: '📋', link: 'schedule',
        });
      }
    }
  }

  const practiceCount = Number(progress.practiceCount) || 0;
  if (practiceCount === 0 && stored.length === 0) {
    dynamic.push({
      id: 'welcome', type: 'welcome', title: 'Добро пожаловать!',
      message: 'Пройдите диагностику и начните свой первый путь к гармонии',
      createdAt: new Date().toISOString(), read: false, icon: '🌿', link: 'diagnostic',
    });
  }

  const allIds = new Set(stored.map(n => n.id));
  const mergedDynamic = dynamic.filter(d => !allIds.has(d.id));

  // Filter by user settings
  const settingsRow = db.prepare('SELECT settings FROM user_settings WHERE user_id = ?').get(user.id);
  const prefs = settingsRow ? (JSON.parse(settingsRow.settings).notifications || {}) : {};
  const typeToPreference = {
    booking: 'bookingConfirmations', 'booking-cancel': 'bookingConfirmations',
    'review-reply': 'reviewReplies', review: 'reviewReplies',
    streak: 'practiceReminders', 'practice-complete': 'practiceReminders', progress: 'practiceReminders',
    reminder: 'scheduleReminders', achievement: 'achievementAlerts', welcome: 'practiceReminders',
  };

  const all = [...mergedDynamic, ...stored];
  const filtered = all.filter(n => {
    const prefKey = typeToPreference[n.type];
    if (!prefKey || prefs[prefKey] === undefined) return true;
    return prefs[prefKey] !== false;
  });

  return c.json({ notifications: filtered });
});

app.post('/api/notifications/mark-read', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) return c.json({ error: 'ids array is required' }, 400);

  const stmt = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?');
  const batch = db.transaction((ids) => { for (const id of ids) stmt.run(id, user.id); });
  batch(ids);

  return c.json({ success: true });
});

// ============================================================
// USER SETTINGS
// ============================================================

app.get('/api/user/settings', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const row = db.prepare('SELECT settings FROM user_settings WHERE user_id = ?').get(user.id);
  if (row) return c.json(JSON.parse(row.settings));
  return c.json({
    notifications: {
      bookingConfirmations: true, reviewReplies: true, practiceReminders: true,
      scheduleReminders: true, achievementAlerts: true, weeklyDigest: true,
      promotions: false, newPractices: true,
    },
    digestFrequency: 'weekly', language: 'ru', timezone: 'Europe/Moscow',
  });
});

app.put('/api/user/settings', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const updates = await c.req.json();
  const row = db.prepare('SELECT settings FROM user_settings WHERE user_id = ?').get(user.id);
  const existing = row ? JSON.parse(row.settings) : {};
  const updated = {
    ...existing, ...updates,
    notifications: { ...(existing.notifications || {}), ...(updates.notifications || {}) },
  };

  db.prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET settings = ?')
    .run(user.id, JSON.stringify(updated), JSON.stringify(updated));
  return c.json(updated);
});

// ============================================================
// NOTIFICATIONS DIGEST
// ============================================================

app.get('/api/notifications/digest', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const period = c.req.query('period') || 'weekly';
  let msAgo, periodLabel;
  switch (period) {
    case 'daily': msAgo = 86400000; periodLabel = 'За последние 24 часа'; break;
    case 'monthly': msAgo = 30 * 86400000; periodLabel = 'За последний месяц'; break;
    default: msAgo = 7 * 86400000; periodLabel = 'За последнюю неделю'; break;
  }
  const cutoff = new Date(Date.now() - msAgo).toISOString();

  const periodNotifs = db.prepare(
    'SELECT id, type, title, message, icon, link, read, created_at as createdAt FROM notifications WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC'
  ).all(user.id, cutoff).map(n => ({ ...n, read: !!n.read }));

  const unreadCount = periodNotifs.filter(n => !n.read).length;
  const summary = { bookings: 0, reviews: 0, achievements: 0, practices: 0, other: 0 };
  for (const n of periodNotifs) {
    if (n.type === 'booking' || n.type === 'booking-cancel') summary.bookings++;
    else if (n.type === 'review-reply' || n.type === 'review') summary.reviews++;
    else if (n.type === 'achievement') summary.achievements++;
    else if (['practice-complete', 'streak', 'progress'].includes(n.type)) summary.practices++;
    else summary.other++;
  }

  const unread = periodNotifs.filter(n => !n.read);
  const readNotifs = periodNotifs.filter(n => n.read);
  const highlights = [...unread, ...readNotifs].slice(0, 10).map(n => ({
    type: n.type, title: n.title, message: n.message, icon: n.icon, createdAt: n.createdAt,
  }));

  const progressRow = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(user.id);
  const progress = progressRow ? JSON.parse(progressRow.data) : {};
  if ((progress.practiceCount || 0) > 0 && highlights.length < 10) {
    highlights.push({
      type: 'summary', title: `${progress.practiceCount} практик пройдено`,
      message: progress.streakDays > 0 ? `Текущая серия: ${progress.streakDays} дней подряд` : 'Продолжайте заниматься!',
      icon: '📊', createdAt: new Date().toISOString(),
    });
  }

  return c.json({ period: periodLabel, totalNotifications: periodNotifs.length, unreadCount, summary, highlights, generatedAt: new Date().toISOString() });
});

// ============================================================
// FAVORITES
// ============================================================

app.get('/api/favorites', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const rows = db.prepare('SELECT practice_id FROM favorites WHERE user_id = ?').all(user.id);
  return c.json({ favorites: rows.map(r => r.practice_id) });
});

app.post('/api/favorites', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { practiceId } = await c.req.json();
  if (!practiceId) return c.json({ error: 'practiceId is required' }, 400);

  db.prepare('INSERT OR IGNORE INTO favorites (user_id, practice_id) VALUES (?, ?)').run(user.id, practiceId);
  const rows = db.prepare('SELECT practice_id FROM favorites WHERE user_id = ?').all(user.id);
  return c.json({ success: true, favorites: rows.map(r => r.practice_id) });
});

app.delete('/api/favorites/:practiceId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const practiceId = c.req.param('practiceId');
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND practice_id = ?').run(user.id, practiceId);
  const rows = db.prepare('SELECT practice_id FROM favorites WHERE user_id = ?').all(user.id);
  return c.json({ success: true, favorites: rows.map(r => r.practice_id) });
});

// ============================================================
// REVIEWS
// ============================================================

app.post('/api/reviews', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { practiceId, practiceTitle, rating, text } = await c.req.json();
  if (!practiceId || !rating || !text) return c.json({ error: 'practiceId, rating, and text are required' }, 400);
  if (rating < 1 || rating > 5) return c.json({ error: 'Rating must be between 1 and 5' }, 400);

  // Check if user already reviewed — update
  const existing = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND practice_id = ?').get(user.id, practiceId);
  const reviewId = existing ? existing.id : `rev-${practiceId}-${user.id}-${Date.now()}`;

  if (existing) {
    db.prepare('UPDATE reviews SET rating = ?, text = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(Number(rating), String(text).slice(0, 1000), reviewId);
  } else {
    db.prepare('INSERT INTO reviews (id, user_id, practice_id, practice_title, user_name, rating, text) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(reviewId, user.id, practiceId, practiceTitle || '', user.name, Number(rating), String(text).slice(0, 1000));
  }

  const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE practice_id = ?').get(practiceId);
  return c.json({ success: true, review: { id: reviewId }, avgRating: Math.round(stats.avg * 100) / 100, reviewCount: stats.cnt });
});

app.get('/api/reviews/:practiceId', async (c) => {
  const practiceId = c.req.param('practiceId');
  const reviews = db.prepare(
    `SELECT id, user_id as userId, user_name as userName, rating, text, practice_id as practiceId,
     practice_title as practiceTitle, created_at as createdAt,
     reply_text, reply_author_name, reply_author_id, reply_created_at
     FROM reviews WHERE practice_id = ? ORDER BY created_at DESC`
  ).all(practiceId).map(r => ({
    id: r.id, userId: r.userId, userName: r.userName, rating: r.rating, text: r.text,
    practiceId: r.practiceId, practiceTitle: r.practiceTitle, createdAt: r.createdAt,
    reply: r.reply_text ? { text: r.reply_text, authorName: r.reply_author_name, authorId: r.reply_author_id, createdAt: r.reply_created_at } : undefined,
  }));

  const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE practice_id = ?').get(practiceId);
  return c.json({ reviews, avgRating: stats.avg ? Math.round(stats.avg * 100) / 100 : 0, reviewCount: stats.cnt });
});

app.delete('/api/reviews/:practiceId/:reviewId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const practiceId = c.req.param('practiceId');
  const reviewId = c.req.param('reviewId');
  const result = db.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').run(reviewId, user.id);
  if (result.changes === 0) return c.json({ error: 'Review not found or not owned by user' }, 404);
  return c.json({ success: true });
});

// ============================================================
// REVIEW REPLIES
// ============================================================

app.post('/api/reviews/:practiceId/:reviewId/reply', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'instructor' && user.role !== 'admin') {
    return c.json({ error: 'Forbidden: only instructors and admins can reply to reviews' }, 403);
  }

  const practiceId = c.req.param('practiceId');
  const reviewId = c.req.param('reviewId');
  const { text } = await c.req.json();
  if (!text || !text.trim()) return c.json({ error: 'Reply text is required' }, 400);

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return c.json({ error: 'Review not found' }, 404);

  db.prepare('UPDATE reviews SET reply_text = ?, reply_author_name = ?, reply_author_id = ?, reply_created_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(String(text).trim().slice(0, 1000), user.name, user.id, reviewId);

  // Notify review author
  if (review.user_id !== user.id) {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, message, icon, link) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(`reply-${reviewId}-${Date.now()}`, review.user_id, 'review-reply', 'Ответ на ваш отзыв',
        `${user.name} ответил на ваш отзыв к практике «${review.practice_title}»`, '💬', `practice:${practiceId}`);
  }

  const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  return c.json({ success: true, review: updated });
});

// ============================================================
// INSTRUCTOR PANEL
// ============================================================

app.get('/api/instructor/stats', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'instructor' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const practiceIds = (c.req.query('practiceIds') || '').split(',').filter(Boolean);
  const eventIds = (c.req.query('eventIds') || '').split(',').filter(Boolean);

  let totalReviews = 0, totalRating = 0;
  const allReviews = [];
  for (const pid of practiceIds) {
    const reviews = db.prepare(
      `SELECT id, user_id as userId, user_name as userName, rating, text, practice_id as practiceId,
       practice_title as practiceTitle, created_at as createdAt, reply_text, reply_author_name, reply_author_id, reply_created_at
       FROM reviews WHERE practice_id = ? ORDER BY created_at DESC`
    ).all(pid);
    totalReviews += reviews.length;
    totalRating += reviews.reduce((s, r) => s + r.rating, 0);
    allReviews.push(...reviews);
  }

  const avgRating = totalReviews > 0 ? Math.round((totalRating / totalReviews) * 100) / 100 : 0;

  let totalEnrolled = 0;
  const enrollmentByEvent = {};
  for (const eid of eventIds) {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM bookings WHERE event_id = ? AND status = ?').get(eid, 'active');
    enrollmentByEvent[eid] = cnt.c;
    totalEnrolled += cnt.c;
  }

  allReviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return c.json({
    totalReviews, avgRating, totalEnrolled, enrollmentByEvent,
    recentReviews: allReviews.slice(0, 20).map(r => ({
      id: r.id, userId: r.userId, userName: r.userName, rating: r.rating, text: r.text,
      practiceId: r.practiceId, practiceTitle: r.practiceTitle, createdAt: r.createdAt,
      reply: r.reply_text ? { text: r.reply_text, authorName: r.reply_author_name, authorId: r.reply_author_id, createdAt: r.reply_created_at } : undefined,
    })),
  });
});

app.get('/api/instructor/session-students/:eventId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'instructor' && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const eventId = c.req.param('eventId');
  const students = db.prepare(
    `SELECT u.id, u.name, u.email, u.plan FROM bookings b
     JOIN users u ON b.user_id = u.id
     WHERE b.event_id = ? AND b.status = ?`
  ).all(eventId, 'active');

  return c.json({ students, total: students.length });
});

// ============================================================
// ADMIN PANEL
// ============================================================

app.get('/api/admin/stats', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const userStats = db.prepare(`SELECT
    COUNT(*) as totalUsers,
    SUM(CASE WHEN role='student' THEN 1 ELSE 0 END) as studentCount,
    SUM(CASE WHEN role='instructor' THEN 1 ELSE 0 END) as instructorCount,
    SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as adminCount,
    SUM(CASE WHEN plan='free' THEN 1 ELSE 0 END) as planFree,
    SUM(CASE WHEN plan='basic' THEN 1 ELSE 0 END) as planBasic,
    SUM(CASE WHEN plan='premium' THEN 1 ELSE 0 END) as planPremium,
    SUM(CASE WHEN plan='unlimited' THEN 1 ELSE 0 END) as planUnlimited
  FROM users`).get();

  const reviewStats = db.prepare('SELECT COUNT(*) as total, AVG(rating) as avg FROM reviews').get();
  const bookingCount = db.prepare('SELECT COUNT(*) as total FROM bookings WHERE status = ?').get('active');

  const recentReviews = db.prepare(
    `SELECT id, user_id as userId, user_name as userName, rating, text, practice_id as practiceId,
     practice_title as practiceTitle, created_at as createdAt
     FROM reviews ORDER BY created_at DESC LIMIT 20`
  ).all();

  const planCounts = { free: userStats.planFree, basic: userStats.planBasic, premium: userStats.planPremium, unlimited: userStats.planUnlimited };
  const activeSubscriptions = planCounts.basic + planCounts.premium + planCounts.unlimited;
  const monthlyRevenue = planCounts.basic * 990 + planCounts.premium * 1990 + Math.round(planCounts.unlimited * 14990 / 12);

  return c.json({
    totalUsers: userStats.totalUsers, studentCount: userStats.studentCount,
    instructorCount: userStats.instructorCount, adminCount: userStats.adminCount,
    planCounts, activeSubscriptions, monthlyRevenue,
    totalReviews: reviewStats.total, avgRating: reviewStats.avg ? Math.round(reviewStats.avg * 100) / 100 : 0,
    totalBookings: bookingCount.total, recentReviews,
  });
});

app.get('/api/admin/users', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const users = db.prepare('SELECT id, name, email, role, plan, avatar FROM users').all();
  for (const u of users) {
    const progress = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(u.id);
    if (progress) {
      const p = JSON.parse(progress.data);
      u.practiceCount = p.practiceCount || 0;
      u.totalMinutes = p.totalMinutes || 0;
      u.streakDays = p.streakDays || 0;
    }
  }
  return c.json({ users });
});

app.get('/api/admin/reviews', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const reviews = db.prepare(
    `SELECT id, user_id as userId, user_name as userName, rating, text, practice_id as practiceId,
     practice_title as practiceTitle, created_at as createdAt,
     reply_text, reply_author_name, reply_author_id, reply_created_at
     FROM reviews ORDER BY created_at DESC`
  ).all().map(r => ({
    id: r.id, userId: r.userId, userName: r.userName, rating: r.rating, text: r.text,
    practiceId: r.practiceId, practiceTitle: r.practiceTitle, createdAt: r.createdAt,
    reply: r.reply_text ? { text: r.reply_text, authorName: r.reply_author_name, authorId: r.reply_author_id, createdAt: r.reply_created_at } : undefined,
  }));
  return c.json({ reviews, total: reviews.length });
});

app.delete('/api/admin/reviews/:practiceId/:reviewId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const reviewId = c.req.param('reviewId');
  const result = db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);
  if (result.changes === 0) return c.json({ error: 'Review not found' }, 404);
  return c.json({ success: true });
});

app.put('/api/admin/users/:userId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const userId = c.req.param('userId');
  const updates = await c.req.json();

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!target) return c.json({ error: 'User not found' }, 404);

  const sets = [];
  const vals = [];
  if (updates.role && ['student', 'instructor', 'admin'].includes(updates.role)) {
    sets.push('role = ?'); vals.push(updates.role);
  }
  if (updates.plan && ['free', 'basic', 'premium', 'unlimited'].includes(updates.plan)) {
    sets.push('plan = ?'); vals.push(updates.plan);
  }
  if (updates.name) {
    sets.push('name = ?'); vals.push(String(updates.name).slice(0, 100));
  }
  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(userId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  const updated = db.prepare('SELECT id, name, email, role, plan, avatar FROM users WHERE id = ?').get(userId);
  return c.json({ success: true, profile: updated });
});

// ============================================================
// SEARCH HISTORY
// ============================================================

app.get('/api/admin/search-history-stats', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const history = db.prepare('SELECT query, count, last_used as lastUsed FROM global_search_history ORDER BY count DESC LIMIT 50').all();
  return c.json({ history });
});

app.post('/api/search-history', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { query } = await c.req.json();
  if (!query || !query.trim()) return c.json({ success: true });
  const q = String(query).trim().toLowerCase().slice(0, 100);

  // Per-user: keep last 20
  db.prepare('INSERT INTO search_history (user_id, query) VALUES (?, ?)').run(user.id, q);
  db.prepare(`DELETE FROM search_history WHERE user_id = ? AND id NOT IN (
    SELECT id FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  )`).run(user.id, user.id);

  // Global
  db.prepare(`INSERT INTO global_search_history (query, count, last_used) VALUES (?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(query) DO UPDATE SET count = count + 1, last_used = CURRENT_TIMESTAMP`).run(q);

  return c.json({ success: true });
});

app.get('/api/search-history', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const rows = db.prepare('SELECT query FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(user.id);
  return c.json({ history: rows.map(r => r.query) });
});

// ============================================================
// ADMIN EXPORT
// ============================================================

app.get('/api/admin/export/users', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const users = db.prepare('SELECT id, name, email, role, plan FROM users').all();
  const rows = ['Имя,Email,Роль,Тариф,Практик,Минут,Серия дней'];
  for (const u of users) {
    const progress = db.prepare('SELECT data FROM user_progress WHERE user_id = ?').get(u.id);
    const p = progress ? JSON.parse(progress.data) : {};
    rows.push(`"${(u.name || '').replace(/"/g, '""')}","${u.email}","${u.role}","${u.plan}",${p.practiceCount || 0},${p.totalMinutes || 0},${p.streakDays || 0}`);
  }
  return c.json({ csv: rows.join('\n'), filename: `users-${new Date().toISOString().split('T')[0]}.csv` });
});

app.get('/api/admin/export/reviews', async (c) => {
  const user = getAuthUser(c.req.header('Authorization'));
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

  const reviews = db.prepare('SELECT user_name, practice_title, rating, text, created_at, reply_text, reply_author_name FROM reviews ORDER BY created_at DESC').all();
  const rows = ['Пользователь,Практика,Рейтинг,Текст,Дата,Ответ преподавателя'];
  for (const r of reviews) {
    const replyText = r.reply_text ? `${r.reply_author_name}: ${r.reply_text}` : '';
    rows.push(`"${(r.user_name || '').replace(/"/g, '""')}","${(r.practice_title || '').replace(/"/g, '""')}",${r.rating},"${(r.text || '').replace(/"/g, '""')}","${r.created_at}","${replyText.replace(/"/g, '""')}"`);
  }
  return c.json({ csv: rows.join('\n'), filename: `reviews-${new Date().toISOString().split('T')[0]}.csv` });
});

// ============================================================
// Start server
// ============================================================
const port = Number(process.env.PORT) || 3100;
console.log(`Soul Orangerie API server starting on port ${port}...`);
serve({ fetch: app.fetch, port });
console.log(`Server running at http://localhost:${port}`);
