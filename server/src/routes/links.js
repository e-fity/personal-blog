import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

router.get('/links', (req, res) => {
  ok(res, db.prepare('SELECT * FROM links ORDER BY created_at ASC').all());
});

router.post('/links', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    name: { required: true, label: '名称', maxLength: 60 },
    url: { required: true, label: '链接', maxLength: 300 },
    description: { label: '简介', maxLength: 200 },
    logo: { label: 'Logo', maxLength: 500 }
  });
  if (err) return fail(res, 400, err);

  const { name, url, logo = '', description = '' } = req.body;
  const info = db
    .prepare('INSERT INTO links (name, url, logo, description, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(String(name), String(url), String(logo), String(description), new Date().toISOString());
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/links/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM links WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '友链不存在');

  const err = validate(req.body, {
    name: { label: '名称', maxLength: 60 },
    url: { label: '链接', maxLength: 300 },
    description: { label: '简介', maxLength: 200 },
    logo: { label: 'Logo', maxLength: 500 }
  });
  if (err) return fail(res, 400, err);

  const b = req.body || {};
  db.prepare('UPDATE links SET name = ?, url = ?, logo = ?, description = ? WHERE id = ?').run(
    b.name === undefined ? row.name : String(b.name),
    b.url === undefined ? row.url : String(b.url),
    b.logo === undefined ? row.logo : String(b.logo),
    b.description === undefined ? row.description : String(b.description),
    id
  );
  ok(res, { ok: true });
});

router.delete('/links/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

export default router;
