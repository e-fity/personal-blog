import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../auth.js';
import { ok } from '../helpers.js';

const router = Router();

router.get('/settings', (req, res) => {
  const raw = getSetting('site');
  ok(res, raw ? JSON.parse(raw) : {});
});

router.put('/settings', requireAdmin, (req, res) => {
  const value = typeof req.body === 'object' && req.body ? req.body : {};
  setSetting('site', JSON.stringify(value));
  ok(res, { ok: true, settings: value });
});

export default router;
