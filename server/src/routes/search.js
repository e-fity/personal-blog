import { Router } from 'express';
import { db, toJsonRow, ftsEnabled } from '../db.js';
import { ok } from '../helpers.js';

const router = Router();

// 全局搜索：文章 / 项目 / 照片 / 友链 / 音乐
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return ok(res, { posts: [], projects: [], photos: [], links: [], music: [] });
  }
  const like = `%${q}%`;
  const now = new Date().toISOString();
  const visiblePosts = 'published = 1 AND (publish_at IS NULL OR publish_at <= ?)';
  const ftsPhrase = '"' + q.replaceAll('"', '""') + '"';

  let posts;
  if (ftsEnabled && q.length >= 3) {
    posts = db
      .prepare(
        `SELECT id, title, cover, tags, featured, created_at, substr(content, 1, 180) AS excerpt FROM posts WHERE ${visiblePosts} AND id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?) ORDER BY created_at DESC LIMIT 20`
      )
      .all(now, ftsPhrase);
    if (!posts.length) {
      posts = db
        .prepare(
          `SELECT id, title, cover, tags, featured, created_at, substr(content, 1, 180) AS excerpt FROM posts WHERE ${visiblePosts} AND (title LIKE ? OR content LIKE ? OR tags LIKE ?) ORDER BY created_at DESC LIMIT 20`
        )
        .all(now, like, like, like);
    }
  } else {
    posts = db
      .prepare(
        `SELECT id, title, cover, tags, featured, created_at, substr(content, 1, 180) AS excerpt FROM posts WHERE ${visiblePosts} AND (title LIKE ? OR content LIKE ? OR tags LIKE ?) ORDER BY created_at DESC LIMIT 20`
      )
      .all(now, like, like, like);
  }

  let projects;
  if (ftsEnabled && q.length >= 3) {
    projects = db
      .prepare(
        'SELECT * FROM projects WHERE id IN (SELECT rowid FROM projects_fts WHERE projects_fts MATCH ?) ORDER BY created_at DESC LIMIT 20'
      )
      .all(ftsPhrase);
    if (!projects.length) {
      projects = db
        .prepare('SELECT * FROM projects WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY created_at DESC LIMIT 20')
        .all(like, like, like);
    }
  } else {
    projects = db
      .prepare('SELECT * FROM projects WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY created_at DESC LIMIT 20')
      .all(like, like, like);
  }

  const photos = db
    .prepare('SELECT * FROM photos WHERE title LIKE ? OR album LIKE ? ORDER BY created_at DESC LIMIT 20')
    .all(like, like);

  const links = db
    .prepare('SELECT * FROM links WHERE name LIKE ? OR description LIKE ? ORDER BY created_at LIMIT 20')
    .all(like, like);

  const music = db
    .prepare('SELECT * FROM music WHERE title LIKE ? OR artist LIKE ? ORDER BY sort ASC, id ASC LIMIT 20')
    .all(like, like);

  ok(res, {
    posts: posts.map((r) => toJsonRow(r, ['tags'])),
    projects: projects.map((r) => toJsonRow(r, ['tags'])),
    photos,
    links,
    music
  });
});

export default router;
