import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';
import { rateLimit } from '../middleware.js';

const router = Router();

router.get('/messages', (req, res) => {
  ok(res, db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all());
});

router.post('/messages', rateLimit({ windowMs: 60_000, max: 20, name: 'messages' }), (req, res) => {
  const err = validate(req.body, {
    content: { required: true, label: '留言内容', maxLength: 600 },
    nickname: { label: '昵称', maxLength: 24 }
  });
  if (err) return fail(res, 400, err);

  const { nickname, content } = req.body;
  const info = db
    .prepare('INSERT INTO messages (nickname, content, created_at) VALUES (?, ?, ?)')
    .run(String(nickname || '访客').trim(), String(content).trim(), new Date().toISOString());
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.post('/messages/:id/reply', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '留言不存在');
  db.prepare('UPDATE messages SET reply = ? WHERE id = ?').run(String((req.body || {}).reply || '').slice(0, 1000), id);
  ok(res, { ok: true });
});

router.delete('/messages/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

export default router;
