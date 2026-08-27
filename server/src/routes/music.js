import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

router.get('/music', (req, res) => {
  ok(res, db.prepare('SELECT * FROM music ORDER BY sort ASC').all());
});

router.post('/music', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '歌曲名', maxLength: 120 },
    url: { required: true, label: '音频地址', maxLength: 500 },
    artist: { label: '艺术家', maxLength: 60 },
    lrc: { label: '歌词地址', maxLength: 500 },
    cover: { label: '封面地址', maxLength: 500 }
  });
  if (err) return fail(res, 400, err);

  const { title, artist = '', url, lrc = '', cover = '', sort = 0 } = req.body;
  const info = db
    .prepare('INSERT INTO music (title, artist, url, lrc, cover, sort) VALUES (?, ?, ?, ?, ?, ?)')
    .run(String(title), String(artist), String(url), String(lrc), String(cover), asInt(sort, 0));
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/music/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM music WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '歌曲不存在');

  const err = validate(req.body, {
    title: { label: '歌曲名', maxLength: 120 },
    url: { label: '音频地址', maxLength: 500 },
    artist: { label: '艺术家', maxLength: 60 },
    lrc: { label: '歌词地址', maxLength: 500 },
    cover: { label: '封面地址', maxLength: 500 }
  });
  if (err) return fail(res, 400, err);

  const b = req.body || {};
  db.prepare(
    'UPDATE music SET title = ?, artist = ?, url = ?, lrc = ?, cover = ?, sort = ? WHERE id = ?'
  ).run(
    b.title === undefined ? row.title : String(b.title),
    b.artist === undefined ? row.artist : String(b.artist),
    b.url === undefined ? row.url : String(b.url),
    b.lrc === undefined ? row.lrc : String(b.lrc),
    b.cover === undefined ? row.cover : String(b.cover),
    b.sort === undefined ? row.sort : asInt(b.sort, 0),
    id
  );
  ok(res, { ok: true });
});

router.delete('/music/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM music WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

export default router;
