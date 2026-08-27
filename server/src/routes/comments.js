import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin, verifyToken } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';
import { rateLimit } from '../middleware.js';

const router = Router();

router.get('/comments', (req, res) => {
  let rows;
  if (req.query.collection_id) {
    rows = db
      .prepare('SELECT * FROM comments WHERE collection_id = ? ORDER BY created_at ASC')
      .all(asInt(req.query.collection_id));
  } else {
    rows = db
      .prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC')
      .all(asInt(req.query.post_id));
  }
  ok(res, rows);
});

router.post('/comments', rateLimit({ windowMs: 60_000, max: 20, name: 'comments' }), (req, res) => {
  const err = validate(req.body, {
    content: { required: true, label: '评论内容', maxLength: 1000 },
    nickname: { label: '昵称', maxLength: 24 }
  });
  if (err) return fail(res, 400, err);

  const { post_id, collection_id, nickname, content, reply_to } = req.body;
  const postId = asInt(post_id);
  const colId = collection_id ? asInt(collection_id) : null;
  if (colId) {
    const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(colId);
    if (!collection) return fail(res, 404, '合集不存在');
  } else {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) return fail(res, 404, '文章不存在');
  }

  const token = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';
  const admin = verifyToken(token);
  const isAdmin = admin && admin.username ? 1 : 0;

  const info = db
    .prepare(
      'INSERT INTO comments (post_id, collection_id, nickname, content, is_admin, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      colId ? 0 : postId,
      colId,
      String(nickname || (isAdmin ? '博主' : '访客')).trim(),
      String(content).trim(),
      isAdmin,
      reply_to ? asInt(reply_to) : null,
      new Date().toISOString()
    );
  ok(res, { id: Number(info.lastInsertRowid), is_admin: isAdmin }, 201);
});

router.delete('/comments/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  db.prepare('DELETE FROM comments WHERE id = ? OR reply_to = ?').run(id, id);
  ok(res, { ok: true });
});

export default router;
