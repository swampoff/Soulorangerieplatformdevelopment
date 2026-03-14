import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
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

const AUTHOR_INFO = {
  nik: { name: 'Ник', photo: join(__dirname, '..', 'public', 'avatars', 'nik.jpg') },
  pavel: { name: 'Павел', photo: join(__dirname, '..', 'public', 'avatars', 'pavel.jpg') },
};

async function sendToTelegram(post) {
  if (!TG_BOT_TOKEN) {
    console.log('TG_BOT_TOKEN not set, skipping Telegram');
    return null;
  }

  const emoji = DIRECTION_EMOJI[post.direction] || '📝';
  const author = AUTHOR_INFO[post.author] || { name: post.author, photo: null };

  const caption = `${emoji} <b>${post.title}</b>\n\n${post.excerpt}\n\n<i>— ${author.name}</i>\n\n<a href="${SITE_URL}/${post.id}">Читать полностью →</a>`;

  try {
    // Send photo with caption
    const photoPath = author.photo;
    let photoData;
    try {
      photoData = readFileSync(photoPath);
    } catch {
      console.log('Avatar file not found, sending text only');
      return await sendTextOnly(caption);
    }

    const form = new FormData();
    form.append('chat_id', TG_CHANNEL);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([photoData], { type: 'image/jpeg' }), `${post.author}.jpg`);

    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    });

    const data = await res.json();
    if (data.ok) {
      console.log(`Sent photo to Telegram, message_id: ${data.result.message_id}`);
      return data.result.message_id;
    } else {
      console.error('Telegram photo error:', data.description);
      // Fallback to text
      return await sendTextOnly(caption);
    }
  } catch (err) {
    console.error('Telegram send failed:', err.message);
    return null;
  }
}

async function sendTextOnly(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHANNEL,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`Sent text to Telegram, message_id: ${data.result.message_id}`);
      return data.result.message_id;
    }
    console.error('Telegram text error:', data.description);
    return null;
  } catch (err) {
    console.error('Telegram text fallback failed:', err.message);
    return null;
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Publishing next post...`);

  const post = db.prepare('SELECT * FROM posts WHERE published = 0 ORDER BY rowid ASC LIMIT 1').get();

  if (!post) {
    console.log('No drafts to publish. Generate more posts with news-generator.js');
    return;
  }

  console.log(`Publishing: "${post.title}" by ${post.author}`);

  const publishedCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE published = 1').get().count;
  const sendToTg = publishedCount % 2 === 0;

  let telegramMsgId = null;
  if (sendToTg) {
    telegramMsgId = await sendToTelegram(post);
  }

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
