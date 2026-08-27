import { Router } from 'express';
import { db, toJsonRow } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

function jsonTags(row) {
  return toJsonRow(row, ['tags']);
}

router.get('/posts', (req, res) => {
  const limit = Math.min(Math.max(asInt(req.query.limit, 100), 1), 100);
  const offset = Math.max(asInt(req.query.offset, 0), 0);
  const where = req.query.featured ? 'WHERE published = 1 AND featured = 1' : 'WHERE published = 1';
  const rows = db
    .prepare(
      `SELECT id, title, cover, tags, featured, created_at, updated_at, substr(content, 1, 180) AS excerpt FROM posts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
  ok(res, rows.map(jsonTags));
});

router.get('/posts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(asInt(req.params.id));
  if (!row || !row.published) return fail(res, 404, '文章不存在');
  ok(res, jsonTags(row));
});

router.post('/posts', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '标题', maxLength: 200 },
    content: { label: '正文', maxLength: 200000 },
    tags: { label: '标签', type: 'array' }
  });
  if (err) return fail(res, 400, err);

  const { title, content = '', cover = '', tags = [], published = 1, featured = 0 } = req.body;
  const now = new Date().toISOString();
  const info = db
    .prepare(
      'INSERT INTO posts (title, content, cover, tags, published, featured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(String(title), String(content), String(cover), JSON.stringify(tags), published ? 1 : 0, featured ? 1 : 0, now, now);
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/posts/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '文章不存在');

  const err = validate(req.body, {
    title: { label: '标题', maxLength: 200 },
    content: { label: '正文', maxLength: 200000 },
    tags: { label: '标签', type: 'array' }
  });
  if (err) return fail(res, 400, err);

  const { title, content, cover, tags, published, featured } = req.body || {};
  db.prepare(
    'UPDATE posts SET title = ?, content = ?, cover = ?, tags = ?, published = ?, featured = ?, updated_at = ? WHERE id = ?'
  ).run(
    title === undefined ? row.title : String(title),
    content === undefined ? row.content : String(content),
    cover === undefined ? row.cover : String(cover),
    tags === undefined ? row.tags : JSON.stringify(tags),
    published === undefined ? row.published : (published ? 1 : 0),
    featured === undefined ? row.featured : (featured ? 1 : 0),
    new Date().toISOString(),
    id
  );
  ok(res, { ok: true });
});

router.delete('/posts/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  ok(res, { ok: true });
});

export default router;
