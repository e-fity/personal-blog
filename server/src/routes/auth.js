import { Router } from 'express';
import { db } from '../db.js';
import { verifyPassword, issueToken, requireAdmin } from '../auth.js';
import { ok, fail } from '../helpers.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
    return fail(res, 401, '用户名或密码错误');
  }
  ok(res, { token: issueToken(user.username), username: user.username });
});

router.get('/auth/me', requireAdmin, (req, res) => {
  ok(res, { username: req.admin.username });
});

export default router;
