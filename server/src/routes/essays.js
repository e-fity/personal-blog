import { Router } from 'express';
import { db, toJsonRow } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

function jsonTags(row) {
  return toJsonRow(row, ['tags']);
}

// 杂谈列表（公开）
router.get('/essays', (req, res) => {
  const limit = Math.min(Math.max(asInt(req.query.limit, 100), 1), 100);
  const offset = Math.max(asInt(req.query.offset, 0), 0);
  const rows = db
    .prepare(
      'SELECT id, title, cover, tags, substr(content, 1, 180) AS excerpt, created_at, updated_at FROM essays ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset);
  ok(res, rows.map(jsonTags));
});

// 杂谈详情（公开）
router.get('/essays/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM essays WHERE id = ?').get(asInt(req.params.id));
  if (!row) return fail(res, 404, '杂谈不存在');
  ok(res, jsonTags(row));
});

// 创建杂谈（管理员）
router.post('/essays', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '标题', maxLength: 200 },
    tags: { label: '标签', type: 'array' }
  });
  if (err) return fail(res, 400, err);
  const { title, content = '', cover = '', tags = [] } = req.body;
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO essays (title, content, cover, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(title), String(content), String(cover), JSON.stringify(tags), now, now);
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

// 更新杂谈（管理员）
router.put('/essays/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM essays WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '杂谈不存在');
  const { title, content, cover, tags } = req.body || {};
  db.prepare(
    'UPDATE essays SET title = ?, content = ?, cover = ?, tags = ?, updated_at = ? WHERE id = ?'
  ).run(
    title === undefined ? row.title : String(title),
    content === undefined ? row.content : String(content),
    cover === undefined ? row.cover : String(cover),
    tags === undefined ? row.tags : JSON.stringify(tags),
    new Date().toISOString(),
    id
  );
  ok(res, { ok: true });
});

// 删除杂谈（管理员）
router.delete('/essays/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM essays WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

export default router;
