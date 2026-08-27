import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

router.get('/collections', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM photos p WHERE p.collection_id = c.id) AS count,
        (SELECT p.url FROM photos p WHERE p.collection_id = c.id ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS first_photo
       FROM collections c ORDER BY c.created_at DESC`
    )
    .all();
  ok(res, rows);
});

router.get('/collections/:id', (req, res) => {
  const id = asInt(req.params.id);
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  if (!collection) return fail(res, 404, '合集不存在');
  const photos = db.prepare('SELECT * FROM photos WHERE collection_id = ? ORDER BY created_at DESC').all(id);
  ok(res, { ...collection, photos });
});

router.post('/collections', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '合集名称', maxLength: 120 },
    description: { label: '简介', maxLength: 2000 },
    cover: { label: '封面地址', maxLength: 500 }
  });
  if (err) return fail(res, 400, err);
  const { title, description = '', cover = '' } = req.body;
  const info = db
    .prepare('INSERT INTO collections (title, description, cover, created_at) VALUES (?, ?, ?, ?)')
    .run(String(title), String(description), String(cover), new Date().toISOString());
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/collections/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '合集不存在');
  const err = validate(req.body, {
    title: { label: '合集名称', maxLength: 120 },
    description: { label: '简介', maxLength: 2000 },
    cover: { label: '封面地址', maxLength: 500 }
  });
  if (err) return fail(res, 400, err);
  const b = req.body || {};
  db.prepare('UPDATE collections SET title = ?, description = ?, cover = ? WHERE id = ?').run(
    b.title === undefined ? row.title : String(b.title),
    b.description === undefined ? row.description : String(b.description),
    b.cover === undefined ? row.cover : String(b.cover),
    id
  );
  ok(res, { ok: true });
});

router.delete('/collections/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  db.prepare('UPDATE photos SET collection_id = NULL WHERE collection_id = ?').run(id);
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  ok(res, { ok: true });
});

export default router;
