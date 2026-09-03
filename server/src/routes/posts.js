import { Router } from 'express';
import { db, toJsonRow, syncPostsFts } from '../db.js';
import { requireAdmin, verifyToken } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

function jsonTags(row) {
  return toJsonRow(row, ['tags']);
}

router.get('/posts', (req, res) => {
  const limit = Math.min(Math.max(asInt(req.query.limit, 100), 1), 100);
  const offset = Math.max(asInt(req.query.offset, 0), 0);
  const now = new Date().toISOString();

  // 后台全量列表（含草稿/定时）：需要管理员
  if (req.query.all === '1') {
    const token = (req.headers.authorization || '').startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '';
    if (!verifyToken(token)?.username) return fail(res, 401, '未授权');
    const rows = db
      .prepare(
        'SELECT id, title, cover, tags, featured, published, publish_at, created_at, updated_at, substr(content, 1, 180) AS excerpt FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?'
      )
      .all(limit, offset);
    return ok(res, rows.map(jsonTags));
  }

  const where = req.query.featured
    ? 'WHERE published = 1 AND (publish_at IS NULL OR publish_at <= ?) AND featured = 1'
    : 'WHERE published = 1 AND (publish_at IS NULL OR publish_at <= ?)';
  const rows = db
    .prepare(
      `SELECT id, title, cover, tags, featured, created_at, updated_at, substr(content, 1, 180) AS excerpt FROM posts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(now, limit, offset);
  ok(res, rows.map(jsonTags));
});

router.get('/posts/:id', (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '文章不存在');

  // 管理员可获取草稿/定时文章全文
  if (req.query.admin === '1') {
    const token = (req.headers.authorization || '').startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '';
    if (verifyToken(token)?.username) return ok(res, jsonTags(row));
  }

  const visible = row.published && (!row.publish_at || row.publish_at <= new Date().toISOString());
  if (!visible) return fail(res, 404, '文章不存在');
  ok(res, jsonTags(row));
});

router.post('/posts', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '标题', maxLength: 200 },
    content: { label: '正文', maxLength: 200000 },
    tags: { label: '标签', type: 'array' }
  });
  if (err) return fail(res, 400, err);

  const { title, content = '', cover = '', tags = [], published = 1, featured = 0, publish_at = null } = req.body;
  const now = new Date().toISOString();
  const info = db
    .prepare(
      'INSERT INTO posts (title, content, cover, tags, published, featured, publish_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(String(title), String(content), String(cover), JSON.stringify(tags), published ? 1 : 0, featured ? 1 : 0, publish_at || null, now, now);
  syncPostsFts();
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

  const { title, content, cover, tags, published, featured, publish_at } = req.body || {};
  db.prepare(
    'UPDATE posts SET title = ?, content = ?, cover = ?, tags = ?, published = ?, featured = ?, publish_at = ?, updated_at = ? WHERE id = ?'
  ).run(
    title === undefined ? row.title : String(title),
    content === undefined ? row.content : String(content),
    cover === undefined ? row.cover : String(cover),
    tags === undefined ? row.tags : JSON.stringify(tags),
    published === undefined ? row.published : (published ? 1 : 0),
    featured === undefined ? row.featured : (featured ? 1 : 0),
    publish_at === undefined ? row.publish_at : (publish_at || null),
    new Date().toISOString(),
    id
  );
  syncPostsFts();
  ok(res, { ok: true });
});

router.delete('/posts/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  syncPostsFts();
  ok(res, { ok: true });
});

export default router;
