import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data', 'blog.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  publish_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT '工具',
  github_url TEXT NOT NULL DEFAULT '',
  demo_url TEXT NOT NULL DEFAULT '',
  content_framework TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  album TEXT NOT NULL DEFAULT '日常',
  year INTEGER NOT NULL DEFAULT 2026,
  collection_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  nickname TEXT NOT NULL DEFAULT '访客',
  content TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  reply_to INTEGER,
  collection_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL DEFAULT '访客',
  content TEXT NOT NULL,
  reply TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'guestbook',
  link_name TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  logo TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS music (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  lrc TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  playlist_id INTEGER,
  duration REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS essays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_year ON photos(year DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);
CREATE INDEX IF NOT EXISTS idx_music_sort ON music(sort);
CREATE INDEX IF NOT EXISTS idx_playlists_created_at ON playlists(created_at DESC);

`);

// 兼容旧库：posts 增加 featured（精选）字段
const postCols = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
if (!postCols.includes('featured')) {
  db.exec('ALTER TABLE posts ADD COLUMN featured INTEGER NOT NULL DEFAULT 0');
}

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}
ensureColumn('photos', 'collection_id', 'INTEGER');
ensureColumn('comments', 'collection_id', 'INTEGER');
ensureColumn('posts', 'publish_at', 'TEXT');
ensureColumn('music', 'playlist_id', 'INTEGER');
ensureColumn('music', 'duration', 'REAL NOT NULL DEFAULT 0');
ensureColumn('music', 'source', "TEXT NOT NULL DEFAULT ''");
ensureColumn('messages', 'type', "TEXT NOT NULL DEFAULT 'guestbook'");
ensureColumn('messages', 'link_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('messages', 'link_url', "TEXT NOT NULL DEFAULT ''");
ensureColumn('messages', 'status', "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn('projects', 'content_framework', "TEXT NOT NULL DEFAULT ''");
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_collection ON photos(collection_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_comments_collection ON comments(collection_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_music_playlist ON music(playlist_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);');

// ---- 全文检索（FTS5 + trigram，兼容中文；不可用时自动回退 LIKE） ----
export const ftsEnabled = (() => {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(title, content, tags, tokenize='trigram');
      CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(title, description, tags, tokenize='trigram');
    `);
    return true;
  } catch (e) {
    console.warn('⚠️ FTS5 全文检索不可用，搜索回退为 LIKE 匹配：', e.message);
    return false;
  }
})();

// 重建全文索引（个人博客数据量小，写后重建开销可忽略）
export function syncPostsFts() {
  if (!ftsEnabled) return;
  db.exec('DELETE FROM posts_fts');
  db.exec('INSERT INTO posts_fts(rowid, title, content, tags) SELECT id, title, content, tags FROM posts');
}

export function syncProjectsFts() {
  if (!ftsEnabled) return;
  db.exec('DELETE FROM projects_fts');
  db.exec('INSERT INTO projects_fts(rowid, title, description, tags) SELECT id, title, description, tags FROM projects');
}

// Helpers to parse/stringify JSON columns.
export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function toJsonRow(row, keys) {
  if (!row) return row;
  const out = { ...row };
  for (const key of keys) {
    if (key in out) {
      try {
        out[key] = JSON.parse(out[key]);
      } catch {
        out[key] = [];
      }
    }
  }
  return out;
}

export function closeDb() {
  db.close();
}
