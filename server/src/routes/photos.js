import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

router.get('/photos', (req, res) => {
  const { year, album, collection } = req.query;
  let sql = 'SELECT * FROM photos';
  const conds = [];
  const args = [];
  if (year) {
    conds.push('year = ?');
    args.push(asInt(year));
  }
  if (album) {
    conds.push('album = ?');
    args.push(String(album));
  }
  if (collection === 'none') {
    conds.push('collection_id IS NULL');
  } else if (collection) {
    conds.push('collection_id = ?');
    args.push(asInt(collection));
  }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY year DESC, created_at DESC';
  ok(res, db.prepare(sql).all(...args));
});

router.get('/photos/filters', (req, res) => {
  const years = db.prepare('SELECT DISTINCT year FROM photos ORDER BY year DESC').all().map((r) => r.year);
  const albums = db.prepare('SELECT DISTINCT album FROM photos ORDER BY album').all().map((r) => r.album);
  ok(res, { years, albums });
});

router.post('/photos', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    url: { required: true, label: '图片地址', maxLength: 500 },
    title: { label: '标题', maxLength: 120 },
    album: { label: '相册', maxLength: 60 },
    year: { label: '年份', maxLength: 4 }
  });
  if (err) return fail(res, 400, err);

  const { url, title = '', album = '日常', year = new Date().getFullYear(), collection_id = null } = req.body;
  const info = db
    .prepare('INSERT INTO photos (url, title, album, year, collection_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(url), String(title), String(album), asInt(year), collection_id ? asInt(collection_id) : null, new Date().toISOString());
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/photos/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '照片不存在');
  const b = req.body || {};
  db.prepare('UPDATE photos SET url = ?, title = ?, album = ?, year = ?, collection_id = ? WHERE id = ?').run(
    b.url === undefined ? row.url : String(b.url),
    b.title === undefined ? row.title : String(b.title),
    b.album === undefined ? row.album : String(b.album),
    b.year === undefined ? row.year : asInt(b.year),
    b.collection_id === undefined ? row.collection_id : (b.collection_id ? asInt(b.collection_id) : null),
    id
  );
  ok(res, { ok: true });
});

router.delete('/photos/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM photos WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

export default router;
