import { Router } from 'express';
import { db, toJsonRow } from '../db.js';
import { ok } from '../helpers.js';

const router = Router();

// 全局搜索：文章 / 项目 / 照片 / 友链
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return ok(res, { posts: [], projects: [], photos: [], links: [] });
  }
  const like = `%${q}%`;

  const posts = db
    .prepare(
      'SELECT id, title, cover, tags, featured, created_at, substr(content, 1, 180) AS excerpt FROM posts WHERE published = 1 AND (title LIKE ? OR content LIKE ? OR tags LIKE ?) ORDER BY created_at DESC LIMIT 20'
    )
    .all(like, like, like);

  const projects = db
    .prepare(
      'SELECT * FROM projects WHERE title LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY created_at DESC LIMIT 20'
    )
    .all(like, like, like);

  const photos = db
    .prepare('SELECT * FROM photos WHERE title LIKE ? OR album LIKE ? ORDER BY created_at DESC LIMIT 20')
    .all(like, like);

  const links = db
    .prepare('SELECT * FROM links WHERE name LIKE ? OR description LIKE ? ORDER BY created_at LIMIT 20')
    .all(like, like);

  ok(res, {
    posts: posts.map((r) => toJsonRow(r, ['tags'])),
    projects: projects.map((r) => toJsonRow(r, ['tags'])),
    photos,
    links
  });
});

export default router;
