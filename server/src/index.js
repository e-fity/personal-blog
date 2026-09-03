import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import routes from './routes/index.js';
import { seedIfEmpty } from './seed.js';
import { syncPostsFts, syncProjectsFts } from './db.js';
import { requireAdmin } from './auth.js';
import { ok, fail } from './helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '..', 'uploads');
const DIST_DIR = join(__dirname, '..', '..', 'client', 'dist');

mkdirSync(UPLOAD_DIR, { recursive: true });
seedIfEmpty();
syncPostsFts();
syncProjectsFts();

// 生产环境必须使用自定义密钥，避免默认密钥泄露
if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_SECRET || process.env.ADMIN_SECRET === 'digital-garden-local-secret-change-me')) {
  console.warn('⚠️  生产环境检测到默认 ADMIN_SECRET，请通过环境变量设置强随机密钥');
}

export function createApp() {
  const app = express();

  // 请求日志：只记录 API 请求，静态资源（图片/CSS/JS）不再刷屏；可用 DISABLE_REQUEST_LOG=1 关闭
  app.use((req, res, next) => {
    if (process.env.DISABLE_REQUEST_LOG !== '1' && req.path.startsWith('/api')) {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
    }
    next();
  });

  // CORS：默认放开（本地开发），可通过 CORS_ORIGIN 指定允许的来源（逗号分隔）
  const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true;
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '64mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(UPLOAD_DIR));

  // ---- 文件上传（base64）：图片 / 音频 / LRC / 歌单 / zip ----
  const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.wma']);
  const TEXT_EXTS = new Set(['.lrc', '.txt', '.srt']);
  const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']);
  const PLAYLIST_EXTS = new Set(['.m3u', '.m3u8', '.pls', '.xspf']);
  const ARCHIVE_EXTS = new Set(['.zip']);
  const ALLOWED_EXTS = new Set([...AUDIO_EXTS, ...TEXT_EXTS, ...IMAGE_EXTS, ...PLAYLIST_EXTS, ...ARCHIVE_EXTS]);

  function uploadLimit(ext) {
    if (AUDIO_EXTS.has(ext)) return 45 * 1024 * 1024;
    if (TEXT_EXTS.has(ext)) return 2 * 1024 * 1024;
    if (PLAYLIST_EXTS.has(ext)) return 2 * 1024 * 1024;
    if (ARCHIVE_EXTS.has(ext)) return 200 * 1024 * 1024;
    return 10 * 1024 * 1024;
  }

  app.post('/api/upload', requireAdmin, (req, res) => {
    const { filename, data } = req.body || {};
    if (!data || typeof data !== 'string') return fail(res, 400, '缺少文件数据');
    const m = data.match(/^data:([^;]+);base64,(.*)$/);
    const base64 = m ? m[2] : data;
    const mime = m ? m[1] : 'image/png';
    const ext = extname(String(filename || '')).toLowerCase() || (mime.includes('png') ? '.png' : mime.includes('audio') ? '.mp3' : '.jpg');
    if (!ALLOWED_EXTS.has(ext)) return fail(res, 400, '不支持的文件类型');

    const limit = uploadLimit(ext);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > limit) return fail(res, 400, `文件过大（上限 ${Math.round(limit / 1024 / 1024)}MB）`);
    writeFileSync(join(UPLOAD_DIR, safeName), buffer);
    ok(res, { url: `/uploads/${safeName}` }, 201);
  });

  app.use('/api', routes);

  // 生产模式：托管前端构建产物
  if (existsSync(DIST_DIR)) {
    app.use(
      express.static(DIST_DIR, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        }
      })
    );
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.setHeader('Cache-Control', 'no-store');
        return res.sendFile(join(DIST_DIR, 'index.html'));
      }
      next();
    });
  }

  app.use((err, req, res, next) => {
    console.error(err);
    fail(res, err.status || 500, err.message || '服务器内部错误');
  });

  return app;
}

// 直接运行时启动服务（测试环境通过 createApp 自行监听）
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = process.env.PORT || 3000;
  const server = createApp().listen(PORT, () => {
    console.log(`🌱 数字花园后端已启动: http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${PORT} 已被占用，请先关闭占用该端口的进程，或使用 set PORT=xxxx 换端口启动`);
    } else {
      console.error('❌ 服务器启动失败:', err.message);
    }
    process.exit(1);
  });
}
