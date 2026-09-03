import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';
import { rateLimit } from '../middleware.js';

const router = Router();

// 获取留言列表，支持 ?type=guestbook|link_apply 筛选
router.get('/messages', (req, res) => {
  const type = String(req.query.type || '').trim();
  let rows;
  if (type === 'link_apply' || type === 'guestbook') {
    rows = db.prepare('SELECT * FROM messages WHERE type = ? ORDER BY created_at DESC').all(type);
  } else {
    rows = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all();
  }
  ok(res, rows);
});

// 发布留言（普通留言 or 友链申请）
router.post('/messages', rateLimit({ windowMs: 60_000, max: 20, name: 'messages' }), (req, res) => {
  const type = String(req.body.type || 'guestbook').trim();
  const isLinkApply = type === 'link_apply';

  const schema = {
    content: { required: true, label: '留言内容', maxLength: 600 },
    nickname: { label: '昵称', maxLength: 24 }
  };
  if (isLinkApply) {
    schema.link_name = { required: true, label: '站点名称', maxLength: 60 };
    schema.link_url = { required: true, label: '站点链接', maxLength: 255 };
  }
  const err = validate(req.body, schema);
  if (err) return fail(res, 400, err);

  const { nickname, content, link_name, link_url } = req.body;
  const info = db
    .prepare(
      'INSERT INTO messages (nickname, content, type, link_name, link_url, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      String(nickname || '访客').trim(),
      String(content).trim(),
      isLinkApply ? 'link_apply' : 'guestbook',
      isLinkApply ? String(link_name).trim() : '',
      isLinkApply ? String(link_url).trim() : '',
      isLinkApply ? 'pending' : 'approved',
      new Date().toISOString()
    );
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

// 博主回复
router.post('/messages/:id/reply', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '留言不存在');
  db.prepare('UPDATE messages SET reply = ? WHERE id = ?').run(String((req.body || {}).reply || '').slice(0, 1000), id);
  ok(res, { ok: true });
});

// 更新友链申请状态（pending / approved / rejected）
router.post('/messages/:id/status', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const status = String((req.body || {}).status || '').trim();
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return fail(res, 400, '状态只能是 pending / approved / rejected');
  }
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '留言不存在');
  db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, id);
  ok(res, { ok: true });
});

// 删除留言
router.delete('/messages/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

export default router;
