import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper: create admin Supabase client (service role)
const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// Helper: verify user from Authorization header
async function getAuthUser(authHeader: string | null | undefined) {
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  const supabase = adminClient();
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// ============================================================
// Health check
// ============================================================
app.get("/make-server-5b6cbf80/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================================
// POST /signup — Register a new user via Supabase Auth + store profile in KV
// ============================================================
app.post("/make-server-5b6cbf80/signup", async (c) => {
  try {
    const { email, password, name, role = "student" } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log(`Signup error for ${email}: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile in KV
    const profile = {
      name,
      email,
      role,
      plan: "free",
      avatar: name.charAt(0).toUpperCase(),
    };
    await kv.set(`user:profile:${data.user.id}`, profile);

    console.log(`User created: ${email} (${data.user.id}), role=${role}`);
    return c.json({ success: true, userId: data.user.id });
  } catch (err) {
    console.log(`Unexpected signup error: ${err}`);
    return c.json({ error: `Signup failed: ${err}` }, 500);
  }
});

// ============================================================
// GET /user-profile — Get current user's profile from KV
// ============================================================
app.get("/make-server-5b6cbf80/user-profile", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized: invalid or missing token in GET /user-profile" }, 401);
    }

    let profile = await kv.get(`user:profile:${user.id}`);
    if (!profile) {
      // If no profile in KV (e.g. user was created outside our flow), create a default
      profile = {
        name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
        email: user.email,
        role: "student",
        plan: "free",
        avatar: (user.user_metadata?.name || user.email || "U").charAt(0).toUpperCase(),
      };
      await kv.set(`user:profile:${user.id}`, profile);
      console.log(`Created default profile for user ${user.id}`);
    }

    return c.json({ ...profile, id: user.id });
  } catch (err) {
    console.log(`Get user profile error: ${err}`);
    return c.json({ error: `Failed to get profile: ${err}` }, 500);
  }
});

// ============================================================
// PUT /user-profile — Update current user's profile in KV
// ============================================================
app.put("/make-server-5b6cbf80/user-profile", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized: invalid or missing token in PUT /user-profile" }, 401);
    }

    const updates = await c.req.json();
    const existing = (await kv.get(`user:profile:${user.id}`)) || {};
    // Don't allow changing id from client
    delete updates.id;
    const updated = { ...existing, ...updates };
    await kv.set(`user:profile:${user.id}`, updated);

    console.log(`Updated profile for user ${user.id}`);
    return c.json({ ...updated, id: user.id });
  } catch (err) {
    console.log(`Update user profile error: ${err}`);
    return c.json({ error: `Failed to update profile: ${err}` }, 500);
  }
});

// ============================================================
// POST /seed-demo — Idempotently create 3 demo accounts
// ============================================================
app.post("/make-server-5b6cbf80/seed-demo", async (c) => {
  try {
    const supabase = adminClient();

    const demoUsers = [
      { email: "student@test.com", password: "password123", name: "Алина Морозова", role: "student", plan: "premium", avatar: "А" },
      { email: "instructor@test.com", password: "password123", name: "Елена Светлова", role: "instructor", plan: "unlimited", avatar: "Е" },
      { email: "admin@test.com", password: "password123", name: "Администратор", role: "admin", plan: "unlimited", avatar: "A" },
    ];

    // Fetch existing users once to avoid repeated list calls
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUsers = listData?.users || [];

    const results: { email: string; status: string }[] = [];

    for (const demo of demoUsers) {
      const existing = existingUsers.find((u: { email?: string }) => u.email === demo.email);
      let userId: string;

      if (existing) {
        userId = existing.id;
        // Ensure password is correct
        await supabase.auth.admin.updateUserById(userId, { password: demo.password });
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: demo.email,
          password: demo.password,
          user_metadata: { name: demo.name },
          // Automatically confirm the user's email since an email server hasn't been configured.
          email_confirm: true,
        });
        if (error || !data.user) {
          console.log(`Seed-demo: failed to create ${demo.email}: ${error?.message}`);
          results.push({ email: demo.email, status: "error" });
          continue;
        }
        userId = data.user.id;
      }

      // Always upsert profile in KV
      const profile = {
        name: demo.name,
        email: demo.email,
        role: demo.role,
        plan: demo.plan,
        avatar: demo.avatar,
      };
      await kv.set(`user:profile:${userId}`, profile);
      results.push({ email: demo.email, status: existing ? "updated" : "created" });
    }

    console.log(`Seed-demo completed:`, JSON.stringify(results));
    return c.json({ success: true, results });
  } catch (err) {
    console.log(`Seed demo error: ${err}`);
    return c.json({ error: `Seed demo failed: ${err}` }, 500);
  }
});

// ============================================================
// GET /user-progress — Get user progress data from KV
// ============================================================
app.get("/make-server-5b6cbf80/user-progress", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in GET /user-progress" }, 401);
    }

    const progress = await kv.get(`user:progress:${user.id}`);
    return c.json(
      progress || {
        scores: {},
        practiceCount: 0,
        totalMinutes: 0,
        streakDays: 0,
        completedPractices: [],
        achievements: [],
      },
    );
  } catch (err) {
    console.log(`Get user progress error: ${err}`);
    return c.json({ error: `Failed to get progress: ${err}` }, 500);
  }
});

// ============================================================
// PUT /user-progress — Update user progress data in KV
// ============================================================
app.put("/make-server-5b6cbf80/user-progress", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in PUT /user-progress" }, 401);
    }

    const updates = await c.req.json();
    const existing = (await kv.get(`user:progress:${user.id}`)) || {};
    const updated = { ...existing, ...updates };
    await kv.set(`user:progress:${user.id}`, updated);

    console.log(`Updated progress for user ${user.id}`);
    return c.json(updated);
  } catch (err) {
    console.log(`Update user progress error: ${err}`);
    return c.json({ error: `Failed to update progress: ${err}` }, 500);
  }
});

// ============================================================
// GET /user-subscription — Get user subscription data
// ============================================================
app.get("/make-server-5b6cbf80/user-subscription", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in GET /user-subscription" }, 401);
    }

    const subscription = await kv.get(`user:subscription:${user.id}`);
    return c.json(
      subscription || {
        plan: "free",
        status: "active",
        startDate: null,
        endDate: null,
      },
    );
  } catch (err) {
    console.log(`Get subscription error: ${err}`);
    return c.json({ error: `Failed to get subscription: ${err}` }, 500);
  }
});

// ============================================================
// PUT /user-subscription — Update user subscription data
// ============================================================
app.put("/make-server-5b6cbf80/user-subscription", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in PUT /user-subscription" }, 401);
    }

    const updates = await c.req.json();
    const existing = (await kv.get(`user:subscription:${user.id}`)) || {};
    const updated = { ...existing, ...updates };
    await kv.set(`user:subscription:${user.id}`, updated);

    // Also update plan in user profile
    const profile = await kv.get(`user:profile:${user.id}`);
    if (profile && updates.plan) {
      await kv.set(`user:profile:${user.id}`, { ...profile, plan: updates.plan });
    }

    console.log(`Updated subscription for user ${user.id}: plan=${updated.plan}`);
    return c.json(updated);
  } catch (err) {
    console.log(`Update subscription error: ${err}`);
    return c.json({ error: `Failed to update subscription: ${err}` }, 500);
  }
});

// ============================================================
// Achievement definitions (server-side, mirrors DashboardPage)
// ============================================================
interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  earned: boolean;
}

function computeAchievements(p: Record<string, unknown>): Achievement[] {
  const dp = (p.directionProgress || {}) as Record<string, number>;
  const pc = Number(p.practiceCount) || 0;
  const streak = Number(p.streakDays) || 0;
  const mins = Number(p.totalMinutes) || 0;
  const completed = Array.isArray(p.completedPractices) ? p.completedPractices.length : 0;
  const directionsUsed = Object.keys(dp).filter((k) => dp[k] > 0).length;
  return [
    { id: "1", title: "Первый шаг", desc: "Прошли первую практику", icon: "🌱", earned: pc >= 1 },
    { id: "2", title: "7 дней подряд", desc: "Практика каждый день неделю", icon: "🔥", earned: streak >= 7 },
    { id: "3", title: "Голос открыт", desc: "10 практик по голосу", icon: "🎵", earned: (dp.voice || 0) >= 10 },
    { id: "4", title: "Водный мастер", desc: "10 практик с водой", icon: "💧", earned: (dp.water || 0) >= 10 },
    { id: "5", title: "Поток энергии", desc: "20 практик цигуна", icon: "✨", earned: (dp.energy || 0) >= 20 },
    { id: "6", title: "30 дней подряд", desc: "Месяц без пропусков", icon: "🏆", earned: streak >= 30 },
    { id: "7", title: "Исследователь", desc: "Практики в 3+ направлениях", icon: "🧭", earned: directionsUsed >= 3 },
    { id: "8", title: "Марафонец", desc: "100+ минут практик", icon: "⏱️", earned: mins >= 100 },
    { id: "9", title: "Многогранность", desc: "5+ уникальных практик", icon: "💎", earned: completed >= 5 },
    { id: "10", title: "Мастер", desc: "50 завершённых практик", icon: "👑", earned: pc >= 50 },
  ];
}

// ============================================================
// POST /complete-practice — Record practice completion with streak & activity logic
// ============================================================
app.post("/make-server-5b6cbf80/complete-practice", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in POST /complete-practice" }, 401);
    }

    const { practiceId, duration, direction } = await c.req.json();
    if (!practiceId || !duration || !direction) {
      return c.json(
        { error: "practiceId, duration, and direction are required" },
        400,
      );
    }

    const DEFAULT_WEEK = [
      { day: "Пн", minutes: 0 },
      { day: "Вт", minutes: 0 },
      { day: "Ср", minutes: 0 },
      { day: "Чт", minutes: 0 },
      { day: "Пт", minutes: 0 },
      { day: "Сб", minutes: 0 },
      { day: "Вс", minutes: 0 },
    ];

    const existing = (await kv.get(`user:progress:${user.id}`)) as Record<string, unknown> || {
      scores: {},
      practiceCount: 0,
      totalMinutes: 0,
      streakDays: 0,
      lastPracticeDate: null,
      completedPractices: [],
      directionProgress: {},
      weeklyActivity: JSON.parse(JSON.stringify(DEFAULT_WEEK)),
      weekStartDate: null,
    };

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // e.g. "2026-02-10"

    // --- completedPractices (unique set) ---
    const completed: string[] = Array.isArray(existing.completedPractices)
      ? [...(existing.completedPractices as string[])]
      : [];
    if (!completed.includes(practiceId)) {
      completed.push(practiceId);
    }

    // --- practiceCount & totalMinutes (always increment, even repeats) ---
    const practiceCount = (Number(existing.practiceCount) || 0) + 1;
    const totalMinutes = (Number(existing.totalMinutes) || 0) + Number(duration);

    // --- directionProgress ---
    const dirProg: Record<string, number> =
      (existing.directionProgress as Record<string, number>) || {};
    dirProg[direction] = (dirProg[direction] || 0) + 1;

    // --- Streak logic ---
    let streakDays = Number(existing.streakDays) || 0;
    const lastPracticeDate = existing.lastPracticeDate as string | null;

    if (lastPracticeDate === todayStr) {
      // Already practiced today — streak unchanged
    } else if (lastPracticeDate) {
      const lastDate = new Date(lastPracticeDate + "T00:00:00Z");
      const today = new Date(todayStr + "T00:00:00Z");
      const diffDays = Math.round(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        // Consecutive day → extend streak
        streakDays += 1;
      } else {
        // Gap → reset
        streakDays = 1;
      }
    } else {
      // Very first practice
      streakDays = 1;
    }

    // --- Weekly activity ---
    const dayOfWeek = now.getDay(); // 0=Sun .. 6=Sat
    // Compute Monday of current ISO week
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset);
    const mondayStr = monday.toISOString().split("T")[0];

    type DayEntry = { day: string; minutes: number };
    let weeklyActivity: DayEntry[] =
      Array.isArray(existing.weeklyActivity) && (existing.weeklyActivity as DayEntry[]).length === 7
        ? (existing.weeklyActivity as DayEntry[]).map((d) => ({ ...d }))
        : JSON.parse(JSON.stringify(DEFAULT_WEEK));

    // Reset if new week
    if ((existing.weekStartDate as string | null) !== mondayStr) {
      weeklyActivity = JSON.parse(JSON.stringify(DEFAULT_WEEK));
    }

    // Map JS getDay() → our 0-based Mon index: Sun=6, Mon=0 .. Sat=5
    const dayMap = [6, 0, 1, 2, 3, 4, 5];
    const todayIndex = dayMap[dayOfWeek];
    weeklyActivity[todayIndex].minutes += Number(duration);

    // --- Achievements: compare before vs after ---
    const oldAchievements = computeAchievements(existing);

    // --- Persist ---
    const updated = {
      ...existing,
      practiceCount,
      totalMinutes,
      streakDays,
      lastPracticeDate: todayStr,
      completedPractices: completed,
      directionProgress: dirProg,
      weeklyActivity,
      weekStartDate: mondayStr,
    };

    const newAchievements = computeAchievements(updated);
    const newlyEarned = newAchievements.filter(
      (na) => na.earned && !oldAchievements.find((oa) => oa.id === na.id && oa.earned),
    );

    // Store achievements in progress for dashboard consistency
    updated.achievements = newAchievements as unknown;

    await kv.set(`user:progress:${user.id}`, updated);

    console.log(
      `Practice ${practiceId} completed by user ${user.id}: dir=${direction}, dur=${duration}min, streak=${streakDays}, total=${practiceCount}, newAchievements=${newlyEarned.length}`,
    );
    return c.json({ ...updated, newAchievements: newlyEarned });
  } catch (err) {
    console.log(`Complete practice error: ${err}`);
    return c.json({ error: `Failed to complete practice: ${err}` }, 500);
  }
});

// ============================================================
// SCHEDULE BOOKINGS
// ============================================================

// GET /schedule-bookings — Get booking counts for all events (public)
app.get("/make-server-5b6cbf80/schedule-bookings", async (c) => {
  try {
    const counts = (await kv.get("schedule:booking-counts")) as Record<string, number> || {};
    return c.json({ counts });
  } catch (err) {
    console.log(`Get schedule bookings error: ${err}`);
    return c.json({ error: `Failed to get schedule bookings: ${err}` }, 500);
  }
});

// GET /my-bookings — Get current user's booked event IDs
app.get("/make-server-5b6cbf80/my-bookings", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in GET /my-bookings" }, 401);
    }
    const bookings = await kv.get(`user:bookings:${user.id}`);
    return c.json({ bookings: Array.isArray(bookings) ? bookings : [] });
  } catch (err) {
    console.log(`Get my bookings error: ${err}`);
    return c.json({ error: `Failed to get bookings: ${err}` }, 500);
  }
});

// POST /book-event — Book current user for an event
app.post("/make-server-5b6cbf80/book-event", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in POST /book-event" }, 401);
    }

    const { eventId, eventTitle, eventDate, eventTime } = await c.req.json();
    if (!eventId) {
      return c.json({ error: "eventId is required" }, 400);
    }

    // Check if already booked
    const eventBookings: string[] = (await kv.get(`schedule:bookings:${eventId}`)) as string[] || [];
    if (eventBookings.includes(user.id)) {
      return c.json({ error: "Already booked for this event" }, 409);
    }

    // Add user to event bookings
    eventBookings.push(user.id);
    await kv.set(`schedule:bookings:${eventId}`, eventBookings);

    // Update aggregate booking counts
    const allCounts = (await kv.get("schedule:booking-counts")) as Record<string, number> || {};
    allCounts[eventId] = eventBookings.length;
    await kv.set("schedule:booking-counts", allCounts);

    // Add event to user's bookings list
    interface UserBooking {
      eventId: string;
      title: string;
      date: string;
      time: string;
      bookedAt: string;
    }
    const userBookings: UserBooking[] = (await kv.get(`user:bookings:${user.id}`)) as UserBooking[] || [];
    userBookings.push({
      eventId,
      title: eventTitle || "",
      date: eventDate || "",
      time: eventTime || "",
      bookedAt: new Date().toISOString(),
    });
    await kv.set(`user:bookings:${user.id}`, userBookings);

    // Create a notification for the booking
    interface Notification {
      id: string;
      type: string;
      title: string;
      message: string;
      createdAt: string;
      read: boolean;
      icon: string;
      link?: string;
    }
    const notifications: Notification[] = (await kv.get(`user:notifications:${user.id}`)) as Notification[] || [];
    notifications.unshift({
      id: `book-${eventId}-${Date.now()}`,
      type: "booking",
      title: "Вы записаны!",
      message: `Вы записались на "${eventTitle}" (${eventDate} в ${eventTime})`,
      createdAt: new Date().toISOString(),
      read: false,
      icon: "📅",
      link: "schedule",
    });
    // Keep only last 50 notifications
    if (notifications.length > 50) notifications.length = 50;
    await kv.set(`user:notifications:${user.id}`, notifications);

    console.log(`User ${user.id} booked event ${eventId} (${eventTitle})`);
    return c.json({ success: true, totalBooked: eventBookings.length });
  } catch (err) {
    console.log(`Book event error: ${err}`);
    return c.json({ error: `Failed to book event: ${err}` }, 500);
  }
});

// POST /cancel-booking — Cancel current user's booking for an event
app.post("/make-server-5b6cbf80/cancel-booking", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in POST /cancel-booking" }, 401);
    }

    const { eventId } = await c.req.json();
    if (!eventId) {
      return c.json({ error: "eventId is required" }, 400);
    }

    // Remove user from event bookings
    const eventBookings: string[] = (await kv.get(`schedule:bookings:${eventId}`)) as string[] || [];
    const idx = eventBookings.indexOf(user.id);
    if (idx === -1) {
      return c.json({ error: "Not booked for this event" }, 404);
    }
    eventBookings.splice(idx, 1);
    await kv.set(`schedule:bookings:${eventId}`, eventBookings);

    // Update aggregate booking counts
    const allCounts = (await kv.get("schedule:booking-counts")) as Record<string, number> || {};
    allCounts[eventId] = eventBookings.length;
    await kv.set("schedule:booking-counts", allCounts);

    // Remove event from user's bookings
    interface UserBooking {
      eventId: string;
      title: string;
      date: string;
      time: string;
      bookedAt: string;
    }
    const userBookings: UserBooking[] = (await kv.get(`user:bookings:${user.id}`)) as UserBooking[] || [];
    const filtered = userBookings.filter((b) => b.eventId !== eventId);
    await kv.set(`user:bookings:${user.id}`, filtered);

    console.log(`User ${user.id} cancelled booking for event ${eventId}`);
    return c.json({ success: true, totalBooked: eventBookings.length });
  } catch (err) {
    console.log(`Cancel booking error: ${err}`);
    return c.json({ error: `Failed to cancel booking: ${err}` }, 500);
  }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

// GET /notifications — Get user notifications (stored + dynamic)
app.get("/make-server-5b6cbf80/notifications", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in GET /notifications" }, 401);
    }

    interface Notification {
      id: string;
      type: string;
      title: string;
      message: string;
      createdAt: string;
      read: boolean;
      icon: string;
      link?: string;
    }

    // Get stored notifications
    const stored: Notification[] = (await kv.get(`user:notifications:${user.id}`)) as Notification[] || [];

    // Generate dynamic notifications based on user progress
    const progress = (await kv.get(`user:progress:${user.id}`)) as Record<string, unknown> || {};
    const dynamic: Notification[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    // Streak risk notification
    const lastPracticeDate = progress.lastPracticeDate as string | null;
    const streakDays = Number(progress.streakDays) || 0;
    if (lastPracticeDate && streakDays > 0) {
      const lastDate = new Date(lastPracticeDate + "T00:00:00Z");
      const today = new Date(todayStr + "T00:00:00Z");
      const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        dynamic.push({
          id: `streak-risk-${todayStr}`,
          type: "streak",
          title: "Сохраните свой стрик!",
          message: `У вас ${streakDays} ${streakDays === 1 ? 'день' : streakDays < 5 ? 'дня' : 'дней'} подряд. Не забудьте практику сегодня!`,
          createdAt: new Date().toISOString(),
          read: false,
          icon: "🔥",
          link: "practices",
        });
      } else if (diffDays >= 2) {
        dynamic.push({
          id: `streak-lost-${todayStr}`,
          type: "streak",
          title: "Стрик прервался",
          message: "Начните новую серию практик прямо сейчас!",
          createdAt: new Date().toISOString(),
          read: false,
          icon: "💪",
          link: "practices",
        });
      }
    }

    // Upcoming bookings reminders
    const userBookings = (await kv.get(`user:bookings:${user.id}`)) as { eventId: string; title: string; date: string; time: string }[] || [];
    for (const booking of userBookings) {
      if (booking.date === todayStr) {
        dynamic.push({
          id: `reminder-${booking.eventId}-${todayStr}`,
          type: "reminder",
          title: "Занятие сегодня!",
          message: `«${booking.title}» в ${booking.time}`,
          createdAt: new Date().toISOString(),
          read: false,
          icon: "⏰",
          link: "schedule",
        });
      } else if (booking.date > todayStr) {
        const eventDate = new Date(booking.date + "T00:00:00Z");
        const today = new Date(todayStr + "T00:00:00Z");
        const daysUntil = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil === 1) {
          dynamic.push({
            id: `reminder-tomorrow-${booking.eventId}`,
            type: "reminder",
            title: "Занятие завтра",
            message: `«${booking.title}» в ${booking.time}`,
            createdAt: new Date().toISOString(),
            read: false,
            icon: "📋",
            link: "schedule",
          });
        }
      }
    }

    // Welcome notification for new users
    const practiceCount = Number(progress.practiceCount) || 0;
    if (practiceCount === 0 && stored.length === 0) {
      dynamic.push({
        id: "welcome",
        type: "welcome",
        title: "Добро пожаловать!",
        message: "Пройдите диагностику и начните свой первый путь к гармонии",
        createdAt: new Date().toISOString(),
        read: false,
        icon: "🌿",
        link: "diagnostic",
      });
    }

    // Merge: dynamic first (deduplicated by id), then stored
    const allIds = new Set(stored.map(n => n.id));
    const mergedDynamic = dynamic.filter(d => !allIds.has(d.id));

    return c.json({ notifications: [...mergedDynamic, ...stored] });
  } catch (err) {
    console.log(`Get notifications error: ${err}`);
    return c.json({ error: `Failed to get notifications: ${err}` }, 500);
  }
});

// POST /notifications/mark-read — Mark notifications as read
app.post("/make-server-5b6cbf80/notifications/mark-read", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in POST /notifications/mark-read" }, 401);
    }

    const { ids } = await c.req.json();
    if (!Array.isArray(ids)) {
      return c.json({ error: "ids array is required" }, 400);
    }

    interface Notification {
      id: string;
      type: string;
      title: string;
      message: string;
      createdAt: string;
      read: boolean;
      icon: string;
      link?: string;
    }

    const notifications: Notification[] = (await kv.get(`user:notifications:${user.id}`)) as Notification[] || [];
    const idsSet = new Set(ids);
    for (const n of notifications) {
      if (idsSet.has(n.id)) n.read = true;
    }
    await kv.set(`user:notifications:${user.id}`, notifications);

    console.log(`Marked ${ids.length} notifications as read for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Mark notifications read error: ${err}`);
    return c.json({ error: `Failed to mark notifications: ${err}` }, 500);
  }
});

// ============================================================
// FAVORITES
// ============================================================

// GET /favorites — Get user's favorite practice IDs
app.get("/make-server-5b6cbf80/favorites", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in GET /favorites" }, 401);
    }
    const favorites = (await kv.get(`user:favorites:${user.id}`)) as string[] || [];
    return c.json({ favorites });
  } catch (err) {
    console.log(`Get favorites error: ${err}`);
    return c.json({ error: `Failed to get favorites: ${err}` }, 500);
  }
});

// POST /favorites — Add a practice to favorites
app.post("/make-server-5b6cbf80/favorites", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in POST /favorites" }, 401);
    }
    const { practiceId } = await c.req.json();
    if (!practiceId) {
      return c.json({ error: "practiceId is required" }, 400);
    }
    const favorites: string[] = (await kv.get(`user:favorites:${user.id}`)) as string[] || [];
    if (!favorites.includes(practiceId)) {
      favorites.push(practiceId);
      await kv.set(`user:favorites:${user.id}`, favorites);
    }
    console.log(`User ${user.id} added practice ${practiceId} to favorites`);
    return c.json({ success: true, favorites });
  } catch (err) {
    console.log(`Add favorite error: ${err}`);
    return c.json({ error: `Failed to add favorite: ${err}` }, 500);
  }
});

// DELETE /favorites/:practiceId — Remove a practice from favorites
app.delete("/make-server-5b6cbf80/favorites/:practiceId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in DELETE /favorites" }, 401);
    }
    const practiceId = c.req.param("practiceId");
    const favorites: string[] = (await kv.get(`user:favorites:${user.id}`)) as string[] || [];
    const idx = favorites.indexOf(practiceId);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      await kv.set(`user:favorites:${user.id}`, favorites);
    }
    console.log(`User ${user.id} removed practice ${practiceId} from favorites`);
    return c.json({ success: true, favorites });
  } catch (err) {
    console.log(`Remove favorite error: ${err}`);
    return c.json({ error: `Failed to remove favorite: ${err}` }, 500);
  }
});

// ============================================================
// REVIEWS
// ============================================================

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  practiceId: string;
  practiceTitle: string;
  createdAt: string;
}

// POST /reviews — Submit a review for a practice
app.post("/make-server-5b6cbf80/reviews", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in POST /reviews" }, 401);
    }

    const { practiceId, practiceTitle, rating, text } = await c.req.json();
    if (!practiceId || !rating || !text) {
      return c.json({ error: "practiceId, rating, and text are required" }, 400);
    }
    if (rating < 1 || rating > 5) {
      return c.json({ error: "Rating must be between 1 and 5" }, 400);
    }

    const profile = await kv.get(`user:profile:${user.id}`);
    const userName = (profile as { name?: string })?.name || user.email?.split("@")[0] || "Пользователь";

    const reviews: Review[] = (await kv.get(`reviews:practice:${practiceId}`)) as Review[] || [];

    // Check if user already reviewed this practice
    const existingIdx = reviews.findIndex((r) => r.userId === user.id);
    const review: Review = {
      id: `rev-${practiceId}-${user.id}-${Date.now()}`,
      userId: user.id,
      userName,
      rating: Number(rating),
      text: String(text).slice(0, 1000),
      practiceId,
      practiceTitle: practiceTitle || "",
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      // Update existing review
      reviews[existingIdx] = review;
    } else {
      reviews.unshift(review);
    }

    await kv.set(`reviews:practice:${practiceId}`, reviews);

    // Also store in a per-instructor key for quick instructor panel access
    // We compute average rating
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await kv.set(`reviews:stats:${practiceId}`, {
      avgRating: Math.round(avg * 100) / 100,
      count: reviews.length,
    });

    console.log(`Review submitted by ${user.id} for practice ${practiceId}: ${rating}/5`);
    return c.json({ success: true, review, avgRating: avg, reviewCount: reviews.length });
  } catch (err) {
    console.log(`Submit review error: ${err}`);
    return c.json({ error: `Failed to submit review: ${err}` }, 500);
  }
});

// GET /reviews/:practiceId — Get reviews for a practice
app.get("/make-server-5b6cbf80/reviews/:practiceId", async (c) => {
  try {
    const practiceId = c.req.param("practiceId");
    const reviews: Review[] = (await kv.get(`reviews:practice:${practiceId}`)) as Review[] || [];
    const stats = (await kv.get(`reviews:stats:${practiceId}`)) as { avgRating: number; count: number } || null;

    return c.json({
      reviews,
      avgRating: stats?.avgRating || 0,
      reviewCount: stats?.count || 0,
    });
  } catch (err) {
    console.log(`Get reviews error: ${err}`);
    return c.json({ error: `Failed to get reviews: ${err}` }, 500);
  }
});

// DELETE /reviews/:practiceId/:reviewId — Delete own review
app.delete("/make-server-5b6cbf80/reviews/:practiceId/:reviewId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in DELETE /reviews" }, 401);
    }

    const practiceId = c.req.param("practiceId");
    const reviewId = c.req.param("reviewId");

    const reviews: Review[] = (await kv.get(`reviews:practice:${practiceId}`)) as Review[] || [];
    const idx = reviews.findIndex((r) => r.id === reviewId && r.userId === user.id);
    if (idx === -1) {
      return c.json({ error: "Review not found or not owned by user" }, 404);
    }

    reviews.splice(idx, 1);
    await kv.set(`reviews:practice:${practiceId}`, reviews);

    // Update stats
    if (reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await kv.set(`reviews:stats:${practiceId}`, { avgRating: Math.round(avg * 100) / 100, count: reviews.length });
    } else {
      await kv.del(`reviews:stats:${practiceId}`);
    }

    console.log(`Review ${reviewId} deleted by ${user.id} for practice ${practiceId}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Delete review error: ${err}`);
    return c.json({ error: `Failed to delete review: ${err}` }, 500);
  }
});

// ============================================================
// INSTRUCTOR PANEL — Real data endpoints
// ============================================================

// GET /instructor/stats — Get aggregated stats for instructor's practices
app.get("/make-server-5b6cbf80/instructor/stats", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized in GET /instructor/stats" }, 401);
    }
    const profile = await kv.get(`user:profile:${user.id}`);
    const role = (profile as { role?: string })?.role;
    if (role !== "instructor" && role !== "admin") {
      return c.json({ error: "Forbidden: instructor role required" }, 403);
    }

    // We receive practiceIds from the client (instructor knows their own practices from static data)
    const practiceIds = c.req.query("practiceIds")?.split(",") || [];

    let totalReviews = 0;
    let totalRating = 0;
    const allReviews: Review[] = [];

    for (const pid of practiceIds) {
      if (!pid) continue;
      const reviews: Review[] = (await kv.get(`reviews:practice:${pid}`)) as Review[] || [];
      totalReviews += reviews.length;
      totalRating += reviews.reduce((s, r) => s + r.rating, 0);
      allReviews.push(...reviews);
    }

    const avgRating = totalReviews > 0 ? Math.round((totalRating / totalReviews) * 100) / 100 : 0;

    // Get enrollment counts from schedule bookings for instructor's events
    const eventIds = c.req.query("eventIds")?.split(",") || [];
    let totalEnrolled = 0;
    const enrollmentByEvent: Record<string, number> = {};
    for (const eid of eventIds) {
      if (!eid) continue;
      const bookings: string[] = (await kv.get(`schedule:bookings:${eid}`)) as string[] || [];
      enrollmentByEvent[eid] = bookings.length;
      totalEnrolled += bookings.length;
    }

    // Sort reviews by date (most recent first)
    allReviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return c.json({
      totalReviews,
      avgRating,
      totalEnrolled,
      enrollmentByEvent,
      recentReviews: allReviews.slice(0, 20),
    });
  } catch (err) {
    console.log(`Get instructor stats error: ${err}`);
    return c.json({ error: `Failed to get instructor stats: ${err}` }, 500);
  }
});

// GET /instructor/session-students/:eventId — Get enrolled students for a session
app.get("/make-server-5b6cbf80/instructor/session-students/:eventId", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const profile = await kv.get(`user:profile:${user.id}`);
    const role = (profile as { role?: string })?.role;
    if (role !== "instructor" && role !== "admin") {
      return c.json({ error: "Forbidden: instructor role required" }, 403);
    }

    const eventId = c.req.param("eventId");
    const userIds: string[] = (await kv.get(`schedule:bookings:${eventId}`)) as string[] || [];

    // Fetch student profiles
    const students: { id: string; name: string; email: string; plan: string }[] = [];
    for (const uid of userIds) {
      const p = await kv.get(`user:profile:${uid}`);
      if (p) {
        const pTyped = p as { name: string; email: string; plan: string };
        students.push({ id: uid, name: pTyped.name, email: pTyped.email, plan: pTyped.plan });
      }
    }

    return c.json({ students, total: students.length });
  } catch (err) {
    console.log(`Get session students error: ${err}`);
    return c.json({ error: `Failed to get session students: ${err}` }, 500);
  }
});

// ============================================================
// ADMIN PANEL — Real data endpoints
// ============================================================

// Helper: verify admin role
async function requireAdmin(authHeader: string | null | undefined) {
  const user = await getAuthUser(authHeader);
  if (!user) return { user: null, error: "Unauthorized" };
  const profile = await kv.get(`user:profile:${user.id}`);
  if ((profile as any)?.role !== "admin") return { user: null, error: "Forbidden: admin role required" };
  return { user, error: null };
}

// GET /admin/stats — Real-time platform statistics
app.get("/make-server-5b6cbf80/admin/stats", async (c) => {
  try {
    const { user, error } = await requireAdmin(c.req.header("Authorization"));
    if (!user) return c.json({ error: `Admin stats: ${error}` }, error === "Unauthorized" ? 401 : 403);

    // Count users by role and plan from KV profiles
    const profiles = await kv.getByPrefix("user:profile:");
    let totalUsers = 0;
    let studentCount = 0;
    let instructorCount = 0;
    let adminCount = 0;
    const planCounts: Record<string, number> = { free: 0, basic: 0, premium: 0, unlimited: 0 };

    for (const p of profiles) {
      const prof = p as { role?: string; plan?: string };
      totalUsers++;
      if (prof.role === "student") studentCount++;
      else if (prof.role === "instructor") instructorCount++;
      else if (prof.role === "admin") adminCount++;
      if (prof.plan && planCounts[prof.plan] !== undefined) planCounts[prof.plan]++;
    }

    // Count total reviews across all practices
    const allReviews = await kv.getByPrefix("reviews:practice:");
    let totalReviews = 0;
    let totalRatingSum = 0;
    const recentReviews: Review[] = [];
    for (const reviewList of allReviews) {
      const list = reviewList as Review[];
      if (Array.isArray(list)) {
        totalReviews += list.length;
        for (const r of list) {
          totalRatingSum += r.rating;
          recentReviews.push(r);
        }
      }
    }
    // Sort recent reviews by date desc
    recentReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Count bookings
    const allBookings = await kv.getByPrefix("schedule:bookings:");
    let totalBookings = 0;
    for (const blist of allBookings) {
      if (Array.isArray(blist)) totalBookings += blist.length;
    }

    const avgRating = totalReviews > 0 ? Math.round((totalRatingSum / totalReviews) * 100) / 100 : 0;
    const activeSubscriptions = planCounts.basic + planCounts.premium + planCounts.unlimited;
    const monthlyRevenue = planCounts.basic * 990 + planCounts.premium * 1990 + Math.round(planCounts.unlimited * 14990 / 12);

    console.log(`Admin stats: ${totalUsers} users, ${totalReviews} reviews, ${totalBookings} bookings`);
    return c.json({
      totalUsers,
      studentCount,
      instructorCount,
      adminCount,
      planCounts,
      activeSubscriptions,
      monthlyRevenue,
      totalReviews,
      avgRating,
      totalBookings,
      recentReviews: recentReviews.slice(0, 20),
    });
  } catch (err) {
    console.log(`Admin stats error: ${err}`);
    return c.json({ error: `Failed to get admin stats: ${err}` }, 500);
  }
});

// GET /admin/users — List all users with profiles
app.get("/make-server-5b6cbf80/admin/users", async (c) => {
  try {
    const { user, error } = await requireAdmin(c.req.header("Authorization"));
    if (!user) return c.json({ error: `Admin users: ${error}` }, error === "Unauthorized" ? 401 : 403);

    const profiles = await kv.getByPrefix("user:profile:");
    // We need keys too for user IDs. Use the raw data approach
    const supabase = adminClient();
    const { data, error: dbError } = await supabase
      .from("kv_store_5b6cbf80")
      .select("key, value")
      .like("key", "user:profile:%");
    
    if (dbError) {
      console.log(`Admin users DB error: ${dbError.message}`);
      return c.json({ error: `Failed to list users: ${dbError.message}` }, 500);
    }

    const users = (data || []).map((row: { key: string; value: any }) => {
      const userId = row.key.replace("user:profile:", "");
      const p = row.value as { name?: string; email?: string; role?: string; plan?: string; avatar?: string };
      return {
        id: userId,
        name: p.name || "Unknown",
        email: p.email || "",
        role: p.role || "student",
        plan: p.plan || "free",
        avatar: p.avatar || "",
      };
    });

    // Enrich with progress data
    for (const u of users) {
      try {
        const progress = await kv.get(`user:progress:${u.id}`);
        if (progress) {
          const pg = progress as { practiceCount?: number; totalMinutes?: number; streakDays?: number };
          (u as any).practiceCount = pg.practiceCount || 0;
          (u as any).totalMinutes = pg.totalMinutes || 0;
          (u as any).streakDays = pg.streakDays || 0;
        }
      } catch { /* ignore */ }
    }

    console.log(`Admin users: returned ${users.length} users`);
    return c.json({ users });
  } catch (err) {
    console.log(`Admin users error: ${err}`);
    return c.json({ error: `Failed to list users: ${err}` }, 500);
  }
});

// GET /admin/reviews — List all reviews for moderation
app.get("/make-server-5b6cbf80/admin/reviews", async (c) => {
  try {
    const { user, error } = await requireAdmin(c.req.header("Authorization"));
    if (!user) return c.json({ error: `Admin reviews: ${error}` }, error === "Unauthorized" ? 401 : 403);

    const supabase = adminClient();
    const { data, error: dbError } = await supabase
      .from("kv_store_5b6cbf80")
      .select("key, value")
      .like("key", "reviews:practice:%");
    
    if (dbError) {
      return c.json({ error: `Failed to list reviews: ${dbError.message}` }, 500);
    }

    const allReviews: Review[] = [];
    for (const row of data || []) {
      const list = row.value as Review[];
      if (Array.isArray(list)) {
        allReviews.push(...list);
      }
    }
    allReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`Admin reviews: returned ${allReviews.length} total reviews`);
    return c.json({ reviews: allReviews, total: allReviews.length });
  } catch (err) {
    console.log(`Admin reviews error: ${err}`);
    return c.json({ error: `Failed to list reviews: ${err}` }, 500);
  }
});

// DELETE /admin/reviews/:practiceId/:reviewId — Admin deletes any review
app.delete("/make-server-5b6cbf80/admin/reviews/:practiceId/:reviewId", async (c) => {
  try {
    const { user, error } = await requireAdmin(c.req.header("Authorization"));
    if (!user) return c.json({ error: `Admin delete review: ${error}` }, error === "Unauthorized" ? 401 : 403);

    const practiceId = c.req.param("practiceId");
    const reviewId = c.req.param("reviewId");

    const reviews: Review[] = (await kv.get(`reviews:practice:${practiceId}`)) as Review[] || [];
    const idx = reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) {
      return c.json({ error: "Review not found" }, 404);
    }

    const removed = reviews.splice(idx, 1)[0];
    await kv.set(`reviews:practice:${practiceId}`, reviews);

    // Update stats
    if (reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await kv.set(`reviews:stats:${practiceId}`, { avgRating: Math.round(avg * 100) / 100, count: reviews.length });
    } else {
      await kv.del(`reviews:stats:${practiceId}`);
    }

    console.log(`Admin deleted review ${reviewId} by user ${removed.userId} for practice ${practiceId}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Admin delete review error: ${err}`);
    return c.json({ error: `Failed to delete review: ${err}` }, 500);
  }
});

// PUT /admin/users/:userId — Update a user's role or plan
app.put("/make-server-5b6cbf80/admin/users/:userId", async (c) => {
  try {
    const { user, error } = await requireAdmin(c.req.header("Authorization"));
    if (!user) return c.json({ error: `Admin update user: ${error}` }, error === "Unauthorized" ? 401 : 403);

    const userId = c.req.param("userId");
    const updates = await c.req.json();
    
    const profile = await kv.get(`user:profile:${userId}`);
    if (!profile) {
      return c.json({ error: "User not found" }, 404);
    }

    const updated = { ...(profile as Record<string, any>) };
    if (updates.role && ["student", "instructor", "admin"].includes(updates.role)) {
      updated.role = updates.role;
    }
    if (updates.plan && ["free", "basic", "premium", "unlimited"].includes(updates.plan)) {
      updated.plan = updates.plan;
    }
    if (updates.name) {
      updated.name = String(updates.name).slice(0, 100);
    }

    await kv.set(`user:profile:${userId}`, updated);
    console.log(`Admin updated user ${userId}: role=${updated.role}, plan=${updated.plan}`);
    return c.json({ success: true, profile: updated });
  } catch (err) {
    console.log(`Admin update user error: ${err}`);
    return c.json({ error: `Failed to update user: ${err}` }, 500);
  }
});

// GET /admin/search-history-stats — Return global search history
app.get("/make-server-5b6cbf80/admin/search-history-stats", async (c) => {
  try {
    const { user, error } = await requireAdmin(c.req.header("Authorization"));
    if (!user) return c.json({ error: `Admin search stats: ${error}` }, error === "Unauthorized" ? 401 : 403);

    const history = (await kv.get("global:search-history")) as { query: string; count: number; lastUsed: string }[] || [];
    return c.json({ history });
  } catch (err) {
    console.log(`Admin search history error: ${err}`);
    return c.json({ error: `Failed to get search history: ${err}` }, 500);
  }
});

// POST /search-history — Record a search query (authenticated users)
app.post("/make-server-5b6cbf80/search-history", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { query } = await c.req.json();
    if (!query || !query.trim()) return c.json({ success: true });

    const q = String(query).trim().toLowerCase().slice(0, 100);

    // Per-user history
    const userHistory: string[] = (await kv.get(`user:search-history:${user.id}`)) as string[] || [];
    // Remove duplicate and add to front
    const filtered = userHistory.filter((h) => h !== q);
    filtered.unshift(q);
    await kv.set(`user:search-history:${user.id}`, filtered.slice(0, 20));

    // Global search popularity counter
    const globalHistory = (await kv.get("global:search-history")) as { query: string; count: number; lastUsed: string }[] || [];
    const existing = globalHistory.find((h) => h.query === q);
    if (existing) {
      existing.count++;
      existing.lastUsed = new Date().toISOString();
    } else {
      globalHistory.push({ query: q, count: 1, lastUsed: new Date().toISOString() });
    }
    globalHistory.sort((a, b) => b.count - a.count);
    await kv.set("global:search-history", globalHistory.slice(0, 50));

    return c.json({ success: true });
  } catch (err) {
    console.log(`Search history error: ${err}`);
    return c.json({ success: true }); // Non-critical
  }
});

// GET /search-history — Get user's search history
app.get("/make-server-5b6cbf80/search-history", async (c) => {
  try {
    const user = await getAuthUser(c.req.header("Authorization"));
    if (!user) return c.json({ history: [] });

    const history: string[] = (await kv.get(`user:search-history:${user.id}`)) as string[] || [];
    return c.json({ history });
  } catch (err) {
    console.log(`Get search history error: ${err}`);
    return c.json({ history: [] });
  }
});

Deno.serve(app.fetch);