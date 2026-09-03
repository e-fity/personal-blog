import { Router } from 'express';
import { db, toJsonRow, syncProjectsFts } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';

const router = Router();

router.get('/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY featured DESC, created_at DESC').all();
  ok(res, rows.map((r) => toJsonRow(r, ['tags'])));
});

router.get('/projects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(asInt(req.params.id));
  if (!row) return fail(res, 404, '项目不存在');
  ok(res, toJsonRow(row, ['tags']));
});

router.post('/projects', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '项目标题', maxLength: 120 },
    description: { label: '简介', maxLength: 2000 },
    tags: { label: '技术栈', type: 'array' },
    category: { label: '分类', maxLength: 20 },
    content_framework: { label: '内容框架', maxLength: 10000 }
  });
  if (err) return fail(res, 400, err);

  const { title, description = '', cover = '', tags = [], category = '工具', githubUrl = '', demoUrl = '', content_framework = '', featured = 0 } = req.body;
  const info = db
    .prepare(
      'INSERT INTO projects (title, description, cover, tags, category, github_url, demo_url, content_framework, featured, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(String(title), String(description), String(cover), JSON.stringify(tags), String(category), String(githubUrl), String(demoUrl), String(content_framework), featured ? 1 : 0, new Date().toISOString());
  syncProjectsFts();
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/projects/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '项目不存在');

  const err = validate(req.body, {
    title: { label: '项目标题', maxLength: 120 },
    description: { label: '简介', maxLength: 2000 },
    tags: { label: '技术栈', type: 'array' },
    category: { label: '分类', maxLength: 20 },
    content_framework: { label: '内容框架', maxLength: 10000 }
  });
  if (err) return fail(res, 400, err);

  const b = req.body || {};
  db.prepare(
    'UPDATE projects SET title = ?, description = ?, cover = ?, tags = ?, category = ?, github_url = ?, demo_url = ?, content_framework = ?, featured = ? WHERE id = ?'
  ).run(
    b.title === undefined ? row.title : String(b.title),
    b.description === undefined ? row.description : String(b.description),
    b.cover === undefined ? row.cover : String(b.cover),
    b.tags === undefined ? row.tags : JSON.stringify(b.tags),
    b.category === undefined ? row.category : String(b.category),
    b.githubUrl === undefined ? row.github_url : String(b.githubUrl),
    b.demoUrl === undefined ? row.demo_url : String(b.demoUrl),
    b.content_framework === undefined ? row.content_framework : String(b.content_framework),
    b.featured === undefined ? row.featured : (b.featured ? 1 : 0),
    id
  );
  syncProjectsFts();
  ok(res, { ok: true });
});

router.delete('/projects/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(asInt(req.params.id));
  syncProjectsFts();
  ok(res, { ok: true });
});

export default router;
