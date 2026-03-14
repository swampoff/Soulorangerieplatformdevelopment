import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHANNEL = '@soulorangerie';
const SITE_URL = 'https://soulorangerie.ru/platform/news';

const DB_PATH = process.env.DB_PATH || join(__dirname, 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const DIRECTION_EMOJI = {
  voice: '🎵', nutrition: '🌿', breath: '🌬️', energy: '✨',
  dance: '💃', water: '💧', music: '🎶',
};

const AUTHOR_NAMES = { nik: 'Ник', pavel: 'Павел' };

async function sendToTelegram(post) {
  if (!TG_BOT_TOKEN) {
    console.log('TG_BOT_TOKEN not set, skipping Telegram');
    return null;
  }

  const emoji = DIRECTION_EMOJI[post.direction] || '📝';
  const authorName = AUTHOR_NAMES[post.author] || post.author;

  const message = `${emoji} <b>${post.title}</b>\n\n${post.excerpt}\n\n<i>— Мастер ${authorName}</i>\n\n<a href="${SITE_URL}/${post.id}">Читать полностью →</a>`;

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

async function main() {
  console.log(`[${new Date().toISOString()}] Publishing next post...`);

  // Get next unpublished draft
  const post = db.prepare('SELECT * FROM posts WHERE published = 0 ORDER BY rowid ASC LIMIT 1').get();

  if (!post) {
    console.log('No drafts to publish. Generate more posts with news-generator.js');
    return;
  }

  console.log(`Publishing: "${post.title}" by ${post.author}`);

  // Determine if this goes to Telegram (every other published post)
  const publishedCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE published = 1').get().count;
  const sendToTg = publishedCount % 2 === 0;

  let telegramMsgId = null;
  if (sendToTg) {
    telegramMsgId = await sendToTelegram(post);
  }

  // Mark as published with current timestamp
  db.prepare('UPDATE posts SET published = 1, created_at = CURRENT_TIMESTAMP, sent_to_telegram = ?, telegram_message_id = ? WHERE id = ?').run(
    sendToTg ? 1 : 0,
    telegramMsgId,
    post.id
  );

  const remaining = db.prepare('SELECT COUNT(*) as count FROM posts WHERE published = 0').get().count;
  console.log(`Published! Telegram: ${sendToTg ? 'yes' : 'no'}. Remaining drafts: ${remaining}`);
}

main().catch(err => {
  console.error('Publisher error:', err);
  process.exit(1);
});
