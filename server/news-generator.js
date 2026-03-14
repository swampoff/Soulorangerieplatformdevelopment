import Database from 'better-sqlite3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHANNEL = '@soulorangerie';
const SITE_URL = 'https://soulorangerie.ru/platform/news';

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

// DB
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure posts table exists
db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  direction TEXT NOT NULL,
  author TEXT NOT NULL,
  image TEXT,
  sent_to_telegram INTEGER DEFAULT 0,
  telegram_message_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_direction ON posts(direction);
`);

// 7 directions
const DIRECTIONS = [
  { id: 'voice', name: 'Голос', emoji: '🎵', topics: ['вокал', 'звукотерапия', 'мантры', 'обертонное пение', 'голосовые практики'] },
  { id: 'nutrition', name: 'Питание', emoji: '🌿', topics: ['осознанное питание', 'аюрведа', 'детокс', 'суперфуды', 'пищевые ритуалы'] },
  { id: 'breath', name: 'Дыхание', emoji: '🌬️', topics: ['пранаяма', 'холотропное дыхание', 'ребёфинг', 'дыхание огня', 'медитативное дыхание'] },
  { id: 'energy', name: 'Энергия', emoji: '✨', topics: ['чакры', 'рейки', 'цигун', 'энергетическая гигиена', 'кристаллы'] },
  { id: 'dance', name: 'Танец', emoji: '💃', topics: ['экстатический танец', '5 ритмов', 'контактная импровизация', 'танцевальная медитация', 'тело и движение'] },
  { id: 'water', name: 'Вода', emoji: '💧', topics: ['водные практики', 'закаливание', 'купание в природе', 'структурирование воды', 'водная медитация'] },
  { id: 'music', name: 'Музыка', emoji: '🎶', topics: ['поющие чаши', 'гонг-медитация', 'бинауральные биты', 'музыкотерапия', 'исцеляющие частоты'] },
];

const AUTHORS = [
  { id: 'nik', name: 'Ник', style: 'Ты — мастер Ник. Твой стиль — глубокий, философский, с элементами мистики. Ты делишься личным опытом и трансформационными инсайтами. Используешь метафоры из природы и космоса.' },
  { id: 'pavel', name: 'Павел', style: 'Ты — мастер Павел. Твой стиль — тёплый, заземлённый, практичный. Ты даёшь конкретные упражнения и техники. Используешь научный подход в сочетании с духовностью.' },
];

// Pick direction and author
function pickDirectionAndAuthor() {
  // Get last post to alternate author and avoid repeating direction
  const lastPost = db.prepare('SELECT direction, author FROM posts ORDER BY created_at DESC LIMIT 1').get();

  // Alternate author
  let authorIdx = 0;
  if (lastPost) {
    authorIdx = lastPost.author === 'nik' ? 1 : 0;
  }

  // Pick direction different from last
  let availableDirections = DIRECTIONS.filter(d => !lastPost || d.id !== lastPost.direction);
  const direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];

  return { direction, author: AUTHORS[authorIdx] };
}

// Generate post with Gemini
async function generatePost(direction, author) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const topic = direction.topics[Math.floor(Math.random() * direction.topics.length)];

  const prompt = `${author.style}

Напиши глубокую, вдохновляющую статью на тему "${topic}" в контексте направления "${direction.name}" ${direction.emoji}.

Требования:
- Объём: 300-500 слов
- Стиль: духовный, но не банальный. Глубокий анализ, личный опыт, практическая мудрость
- Начни с интригующего заголовка (НЕ используй кавычки в заголовке)
- Включи 1-2 конкретных практических совета или упражнения
- Добавь элемент духовности и внутренней трансформации
- Пиши на русском языке
- Заверши мотивирующей мыслью или вопросом для саморефлексии

Формат ответа (строго):
TITLE: [заголовок без кавычек]
EXCERPT: [краткое описание 1-2 предложения]
CONTENT:
[полный текст статьи]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse response
  const titleMatch = text.match(/TITLE:\s*(.+)/);
  const excerptMatch = text.match(/EXCERPT:\s*(.+)/);
  const contentMatch = text.match(/CONTENT:\s*([\s\S]+)/);

  if (!titleMatch || !contentMatch) {
    throw new Error('Failed to parse Gemini response');
  }

  return {
    title: titleMatch[1].trim().replace(/^["«]|["»]$/g, ''),
    excerpt: excerptMatch ? excerptMatch[1].trim() : '',
    content: contentMatch[1].trim(),
  };
}

// Send to Telegram
async function sendToTelegram(post, direction, author) {
  if (!TG_BOT_TOKEN) {
    console.log('TG_BOT_TOKEN not set, skipping Telegram');
    return null;
  }

  const dirEmoji = DIRECTIONS.find(d => d.id === direction.id)?.emoji || '';
  const authorName = author.name;

  const message = `${dirEmoji} <b>${post.title}</b>

${post.excerpt}

<i>— Мастер ${authorName}</i>

<a href="${SITE_URL}/${post.id}">Читать полностью →</a>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHANNEL,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      console.log(`Sent to Telegram, message_id: ${data.result.message_id}`);
      return data.result.message_id;
    } else {
      console.error('Telegram error:', data.description);
      return null;
    }
  } catch (err) {
    console.error('Telegram send failed:', err.message);
    return null;
  }
}

// Main
async function main() {
  console.log(`[${new Date().toISOString()}] Generating new post...`);

  const { direction, author } = pickDirectionAndAuthor();
  console.log(`Direction: ${direction.name}, Author: ${author.name}`);

  const post = await generatePost(direction, author);
  console.log(`Generated: "${post.title}"`);

  const id = `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Determine if this post goes to Telegram (every other post)
  const totalPosts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
  const sendToTg = totalPosts % 2 === 0; // even-numbered posts go to TG

  let telegramMsgId = null;
  if (sendToTg) {
    telegramMsgId = await sendToTelegram({ ...post, id }, direction, author);
  }

  // Save to DB
  db.prepare(`INSERT INTO posts (id, title, content, excerpt, direction, author, sent_to_telegram, telegram_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, post.title, post.content, post.excerpt, direction.id, author.id,
    sendToTg ? 1 : 0, telegramMsgId
  );

  console.log(`Saved post ${id}, telegram: ${sendToTg ? 'yes' : 'no'}`);
}

main().catch(err => {
  console.error('News generator error:', err);
  process.exit(1);
});
