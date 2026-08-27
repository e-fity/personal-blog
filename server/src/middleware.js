// Minimal in-memory rate limiter for public write endpoints.
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 30, name = 'default' } = {}) {
  return (req, res, next) => {
    const key = `${name}:${req.ip || 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}
