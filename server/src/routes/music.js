import { Router } from 'express';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asInt, ok, fail, validate } from '../helpers.js';
import {
  parsePlaylistText,
  materializeAudioFiles,
  extractZip,
  findPlaylistFile,
  isPlaylistFile
} from '../playlistParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '..', '..', 'uploads');
const TMP_DIR = join(__dirname, '..', '..', '.tmp-playlist');
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const router = Router();

// ---------- 公共工具：歌单解析与批量插入 ----------
// 返回歌单 id：存在则复用，否则新建
function resolvePlaylist(playlistId, name, source) {
  let plId = playlistId ? asInt(playlistId) : null;
  if (plId) {
    const exists = db.prepare('SELECT id FROM playlists WHERE id = ?').get(plId);
    if (!exists) plId = null;
  }
  if (!plId) {
    const info = db
      .prepare('INSERT INTO playlists (title, description, cover, source) VALUES (?, ?, ?, ?)')
      .run(name, '', '', source);
    plId = Number(info.lastInsertRowid);
  }
  return plId;
}

const basename = (url) => String(url || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');

// 批量插入曲目（去重、排序自增），返回 { inserted, skipped }
function insertTracks(plId, items, source, keyOf) {
  const existingRows = db
    .prepare('SELECT url, title, artist FROM music WHERE playlist_id = ?')
    .all(plId);
  const existing = new Set(existingRows.map(keyOf));
  let sortBase = db
    .prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM music WHERE playlist_id = ?')
    .get(plId).m;
  const insert = db.prepare(
    'INSERT INTO music (title, artist, url, lrc, cover, sort, playlist_id, duration, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const inserted = [];
  let skipped = 0;
  for (const it of items) {
    if (existing.has(keyOf(it))) {
      skipped += 1;
      continue;
    }
    const title = it.title || (it.url && basename(it.url)) || '未命名曲目';
    const info = insert.run(
      title,
      it.artist || '',
      it.url || '',
      '',
      '',
      ++sortBase,
      plId,
      Number(it.duration) || 0,
      source
    );
    existing.add(keyOf(it));
    inserted.push(Number(info.lastInsertRowid));
  }
  return { inserted, skipped };
}

// ---------- 歌单 ----------

router.get('/playlists', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM music m WHERE m.playlist_id = p.id) AS track_count
       FROM playlists p ORDER BY p.created_at DESC`
    )
    .all();
  ok(res, rows);
});

router.get('/playlists/:id', (req, res) => {
  const id = asInt(req.params.id);
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  if (!playlist) return fail(res, 404, '歌单不存在');
  const tracks = db.prepare('SELECT * FROM music WHERE playlist_id = ? ORDER BY sort ASC, id ASC').all(id);
  ok(res, { ...playlist, tracks });
});

router.post('/playlists', requireAdmin, (req, res) => {
  const err = validate(req.body, {
    title: { required: true, label: '歌单名称', maxLength: 120 },
    description: { label: '简介', maxLength: 500 },
    cover: { label: '封面', maxLength: 500 },
    source: { label: '来源', maxLength: 120 }
  });
  if (err) return fail(res, 400, err);
  const { title, description = '', cover = '', source = '' } = req.body;
  const info = db
    .prepare('INSERT INTO playlists (title, description, cover, source) VALUES (?, ?, ?, ?)')
    .run(String(title), String(description), String(cover), String(source));
  ok(res, { id: Number(info.lastInsertRowid) }, 201);
});

router.put('/playlists/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  const row = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  if (!row) return fail(res, 404, '歌单不存在');
  const b = req.body || {};
  db.prepare(
    'UPDATE playlists SET title = ?, description = ?, cover = ?, source = ? WHERE id = ?'
  ).run(
    b.title === undefined ? row.title : String(b.title),
    b.description === undefined ? row.description : String(b.description),
    b.cover === undefined ? row.cover : String(b.cover),
    b.source === undefined ? row.source : String(b.source),
    id
  );
  ok(res, { ok: true });
});

router.delete('/playlists/:id', requireAdmin, (req, res) => {
  const id = asInt(req.params.id);
  db.prepare('UPDATE music SET playlist_id = NULL WHERE playlist_id = ?').run(id);
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
  ok(res, { ok: true });
});

// ---------- 曲目 ----------

router.get('/music', (req, res) => {
  const playlistId = req.query.playlist_id ? asInt(req.query.playlist_id) : null;
  let rows;
  if (playlistId != null) {
    rows = db.prepare('SELECT * FROM music WHERE playlist_id = ? ORDER BY sort ASC, id ASC').all(playlistId);
  } else {
    rows = db.prepare('SELECT * FROM music ORDER BY sort ASC, id ASC').all();
  }
  ok(res, rows);
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

  const { title, artist = '', url, lrc = '', cover = '', sort = 0, playlist_id = null, duration = 0, source = '' } = req.body;
  const info = db
    .prepare('INSERT INTO music (title, artist, url, lrc, cover, sort, playlist_id, duration, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(String(title), String(artist), String(url), String(lrc), String(cover), asInt(sort, 0), playlist_id ? asInt(playlist_id) : null, Number(duration) || 0, String(source));
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
    'UPDATE music SET title = ?, artist = ?, url = ?, lrc = ?, cover = ?, sort = ?, playlist_id = ?, duration = ?, source = ? WHERE id = ?'
  ).run(
    b.title === undefined ? row.title : String(b.title),
    b.artist === undefined ? row.artist : String(b.artist),
    b.url === undefined ? row.url : String(b.url),
    b.lrc === undefined ? row.lrc : String(b.lrc),
    b.cover === undefined ? row.cover : String(b.cover),
    b.sort === undefined ? row.sort : asInt(b.sort, 0),
    b.playlist_id === undefined ? row.playlist_id : (b.playlist_id ? asInt(b.playlist_id) : null),
    b.duration === undefined ? row.duration : Number(b.duration) || 0,
    b.source === undefined ? row.source : String(b.source),
    id
  );
  ok(res, { ok: true });
});

router.delete('/music/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM music WHERE id = ?').run(asInt(req.params.id));
  ok(res, { ok: true });
});

// ---------- 歌单导入 ----------

/**
 * 导入歌单
 * body: {
 *   playlist_title: string,        // 歌单名称（可选，默认从文件名）
 *   playlist_id: number,           // 追加到已有歌单（可选）
 *   filename: string,              // 原始文件名
 *   data: string,                  // base64 或 dataURL 的歌单文件内容，或 zip
 *   mode: 'replace' | 'append'     // 替换歌单内容或追加（默认 append）
 * }
 */
router.post('/music/import', requireAdmin, async (req, res) => {
  try {
    const { filename, data, playlist_title, playlist_id, mode = 'append' } = req.body || {};
    if (!data || typeof data !== 'string') return fail(res, 400, '缺少文件数据');

    const m = data.match(/^data:([^;]+);base64,(.*)$/);
    const base64 = m ? m[2] : data;
    const buffer = Buffer.from(base64, 'base64');
    const fname = String(filename || 'playlist.m3u').trim();
    const ext = extname(fname).toLowerCase();

    let items = [];
    let playlistName = playlist_title || fname.replace(/\.[^.]+$/, '') || '导入歌单';
    const workDir = join(TMP_DIR, `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    mkdirSync(workDir, { recursive: true });

    if (ext === '.zip') {
      // 解压 zip，找到歌单文件
      await extractZip(buffer, workDir);
      const plFile = findPlaylistFile(workDir);
      if (!plFile) {
        cleanupDir(workDir);
        return fail(res, 400, 'zip 包内未找到歌单文件（支持 .m3u/.m3u8/.pls/.xspf）');
      }
      const text = readFileSync(plFile, 'utf-8');
      items = parsePlaylistText(text, plFile);
      // 把 zip 内的音频文件复制到 uploads
      items = materializeAudioFiles(items, workDir, UPLOAD_DIR, '/uploads');
      if (!playlist_title) {
        const plBase = plFile.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
        if (plBase) playlistName = plBase;
      }
    } else if (isPlaylistFile(fname)) {
      // 纯歌单文件，直接解析
      items = parsePlaylistText(buffer.toString('utf-8'), fname);
    } else {
      cleanupDir(workDir);
      return fail(res, 400, '不支持的文件类型，请上传 .m3u/.m3u8/.pls/.xspf 或 .zip');
    }

    cleanupDir(workDir);

    // 过滤无效条目
    items = items.filter((it) => it && it.url);
    if (!items.length) return fail(res, 400, '歌单中没有可导入的曲目');

    // 可选：自动下载歌单中的 http(s) 直链音频到本地 uploads
    if (req.body?.download) {
      for (const it of items) {
        const u = String(it.url || '')
        if (!/^https?:\/\//i.test(u)) continue
        try {
          const buf = await downloadRemoteFile(u)
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp3`
          writeFileSync(join(UPLOAD_DIR, safeName), buf)
          it.url = `/uploads/${safeName}`
        } catch (e) {
          console.warn('自动下载失败，保留原链接:', u, e.message)
        }
      }
    }

    // 确定歌单 ID（复用或新建）
    const plId = resolvePlaylist(playlist_id, playlistName, ext === '.zip' ? 'zip-import' : 'playlist-import');
    if (mode === 'replace') {
      db.prepare('UPDATE music SET playlist_id = NULL WHERE playlist_id = ?').run(plId);
    }

    // 批量插入曲目（按音频地址去重）
    const { inserted, skipped } = insertTracks(plId, items, 'playlist-import', (r) => r.url);
    ok(res, { playlist_id: plId, imported: inserted.length, skipped }, 201);
  } catch (e) {
    console.error('歌单导入失败:', e);
    fail(res, 500, e.message || '导入失败');
  }
});

function cleanupDir(dir) {
  try {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

// ---------- 链接导入（酷狗 / 网易云 / QQ音乐） ----------

// 下载 http(s) 直链音频到 Buffer（带重定向上限与大小/超时保护）
function downloadRemoteFile(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          if (redirects >= 3) return reject(new Error('重定向次数过多'))
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href
          return resolve(downloadRemoteFile(loc, redirects + 1))
        }
        if (res.statusCode >= 400) {
          res.resume()
          return reject(new Error(`下载失败：HTTP ${res.statusCode}`))
        }
        const chunks = []
        let total = 0
        const MAX = 45 * 1024 * 1024
        res.on('data', (c) => {
          total += c.length
          if (total > MAX) {
            req.destroy()
            return reject(new Error('音频超过 45MB 限制'))
          }
          chunks.push(c)
        })
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('下载超时'))
    })
  })
}

function fetchPage(url, timeout = 10000, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': new URL(url).origin
        },
        timeout
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 5) {
            return reject(new Error('重定向次数过多'));
          }
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return resolve(fetchPage(redirectUrl, timeout, redirects + 1));
        }
        if (res.statusCode >= 400) {
          res.resume();
          return reject(new Error(`目标页面返回 ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
  });
}

/**
 * 解析酷狗音乐歌单页面
 * 支持 https://www.kugou.com/yy/special/single/{id}.html 和短链
 */
function parseKugou(html) {
  const items = [];

  // 策略1：匹配 var songList = [...] 或 var songs = [...]
  const listMatch = html.match(/(?:songList|songs|song_list)\s*=\s*(\[[\s\S]*?\])\s*[;,\n]/);
  if (listMatch) {
    try {
      const arr = JSON.parse(listMatch[1].replace(/,\s*([}\]])/g, '$1'));
      for (const s of arr) {
        const title = s.songname || s.name || s.title || '';
        const artist = s.author || s.artist || s.singer || '';
        if (title) items.push({ title, artist, duration: Number(s.duration) || 0, url: '' });
      }
    } catch {
      /* ignore */
    }
  }

  // 策略2：匹配 global.specialList 或 window.__INITIAL_STATE__
  if (!items.length) {
    const globalMatch = html.match(/(?:global|window\.__INITIAL_STATE__|window\.__NUXT__)\s*=\s*(\{[\s\S]*?\})\s*[;,\n<]/);
    if (globalMatch) {
      try {
        const data = JSON.parse(globalMatch[1]);
        const songs = data.songList || data.songs || data?.specialInfo?.songs || [];
        for (const s of songs) {
          const title = s.songname || s.name || s.title || '';
          const artist = s.author || s.artist || s.singer || '';
          if (title) items.push({ title, artist, duration: Number(s.duration) || 0, url: '' });
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 策略3：从 DOM 列表中提取 <li ... songname="xxx" author="xxx">
  if (!items.length) {
    const liRe = /<li[^>]*?(?:songname|data-song|title)=["']([^"']+)["'][^>]*?(?:author|artist|singer)=["']([^"']*)["']/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
      items.push({ title: m[1], artist: m[2], duration: 0, url: '' });
    }
  }

  // 策略4：通用 DOM 提取：class="text" 内的 a[title] + span.author
  if (!items.length) {
    const blockRe = /<div[^>]*class="text"[^>]*>([\s\S]*?)<\/div>/gi;
    let bm;
    while ((bm = blockRe.exec(html)) !== null) {
      const block = bm[1];
      const titleMatch = block.match(/<a[^>]*title="([^"]+)"[^>]*>/);
      const authorMatch = block.match(/(?:author|artist|singer)[^>]*>([^<]+)</i);
      if (titleMatch) {
        items.push({
          title: titleMatch[1].trim(),
          artist: authorMatch ? authorMatch[1].trim() : '',
          duration: 0,
          url: ''
        });
      }
    }
  }

  // 提取歌单名称
  let playlistName = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) {
    playlistName = titleMatch[1].replace(/[-_].*酷狗音乐.*$/, '').trim();
  }
  const hMatch = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/);
  if (!playlistName && hMatch) playlistName = hMatch[1].trim();

  return { items, playlistName };
}

/**
 * 解析网易云音乐歌单页面
 */
function parseNetEase(html) {
  const items = [];
  // 网易云歌单页面有 <ul class="f-hide"><li><a href="/song?id=xxx">歌曲名</a></li></ul>
  const ulMatch = html.match(/<ul[^>]*class="f-hide"[^>]*>([\s\S]*?)<\/ul>/);
  if (ulMatch) {
    const liRe = /<li><a[^>]*>([^<]+)<\/a><\/li>/g;
    let m;
    while ((m = liRe.exec(ulMatch[1])) !== null) {
      items.push({ title: m[1].trim(), artist: '', duration: 0, url: '' });
    }
  }
  // 尝试从 window.__INITIAL_STATE__ 或类似获取更详细信息
  if (!items.length) {
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        const tracks = data?.playlist?.tracks || data?.playlist?.songList || [];
        for (const t of tracks) {
          const artists = (t.ar || t.artists || []).map((a) => a.name).join(' / ');
          items.push({ title: t.name || '', artist: artists, duration: (t.dt || t.duration || 0) / 1000, url: '' });
        }
      } catch {
        /* ignore */
      }
    }
  }
  let playlistName = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) playlistName = titleMatch[1].replace(/[-_].*网易云音乐.*$/, '').trim();
  return { items, playlistName };
}

/**
 * 解析 QQ 音乐歌单页面
 */
function parseQQMusic(html) {
  const items = [];
  // QQ音乐页面有 window.__INITIAL_STATE__ 或类似
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const songs = data?.playlist?.songList || data?.detail?.songList || [];
      for (const s of songs) {
        const artists = (s.singer || []).map((a) => a.name).join(' / ');
        items.push({ title: s.name || s.songName || '', artist: artists, duration: Number(s.interval) || 0, url: '' });
      }
    } catch {
      /* ignore */
    }
  }
  // DOM 回退
  if (!items.length) {
    const liRe = /<li[^>]*class="playlist__item"[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
      const block = m[1];
      const titleMatch = block.match(/class="playlist__title"[^>]*>([^<]+)</);
      const authorMatch = block.match(/class="playlist__author"[^>]*>([^<]+)</);
      if (titleMatch) {
        items.push({ title: titleMatch[1].trim(), artist: authorMatch ? authorMatch[1].trim() : '', duration: 0, url: '' });
      }
    }
  }
  let playlistName = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) playlistName = titleMatch[1].replace(/[-_].*QQ音乐.*$/, '').trim();
  return { items, playlistName };
}

function detectPlatform(url) {
  if (/kugou\.com/i.test(url)) return 'kugou';
  if (/music\.163\.com/i.test(url)) return 'netease';
  if (/y\.qq\.com|qq\.com/i.test(url)) return 'qqmusic';
  return 'unknown';
}

/**
 * 通过链接导入歌单
 * body: { url, playlist_title, playlist_id, mode }
 */
router.post('/music/import-url', requireAdmin, async (req, res) => {
  try {
    const { url: rawUrl, playlist_title, playlist_id, mode = 'append' } = req.body || {};
    const targetUrl = String(rawUrl || '').trim();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return fail(res, 400, '请输入有效的歌单链接（以 http:// 或 https:// 开头）');
    }

    const platform = detectPlatform(targetUrl);
    if (platform === 'unknown') {
      return fail(res, 400, '暂不支持该平台，目前支持酷狗音乐、网易云音乐、QQ音乐的歌单链接');
    }

    let html;
    try {
      html = await fetchPage(targetUrl);
    } catch (e) {
      return fail(res, 502, `无法访问歌单页面：${e.message}`);
    }

    let parsed = { items: [], playlistName: '' };
    if (platform === 'kugou') parsed = parseKugou(html);
    else if (platform === 'netease') parsed = parseNetEase(html);
    else if (platform === 'qqmusic') parsed = parseQQMusic(html);

    const items = parsed.items.filter((it) => it && it.title);
    if (!items.length) {
      return fail(res, 400, '未能从页面中解析到歌曲列表，可能页面结构已变化或需要登录。建议改用导出 .m3u 歌单文件的方式导入');
    }

    const playlistName = playlist_title || parsed.playlistName || `${platform} 导入歌单`;

    // 确定歌单 ID（复用或新建）
    const plId = resolvePlaylist(playlist_id, playlistName, `${platform}-url-import`);
    if (mode === 'replace') {
      db.prepare('UPDATE music SET playlist_id = NULL WHERE playlist_id = ?').run(plId);
    }

    // 批量插入（链接导入的曲目音频 URL 为空，需用户后续上传或补充），按 标题|歌手 去重
    const { inserted, skipped } = insertTracks(plId, items, `${platform}-url`, (r) => `${r.title}|${r.artist}`);

    ok(res, {
      playlist_id: plId,
      platform,
      imported: inserted.length,
      skipped,
      note: '歌曲元数据已导入，音频地址需在后台逐首上传或补充'
    }, 201);
  } catch (e) {
    console.error('链接导入失败:', e);
    fail(res, 500, e.message || '导入失败');
  }
});

// ---------- 下载代理 ----------

router.get('/music/:id/download', (req, res) => {
  const id = asInt(req.params.id);
  const track = db.prepare('SELECT * FROM music WHERE id = ?').get(id);
  if (!track) return fail(res, 404, '歌曲不存在');

  const url = String(track.url || '');
  const safeName = `${(track.title || 'track').replace(/[\\/:*?"<>|]/g, '_')}${extname(url) || '.mp3'}`;

  // 本地文件：直接发送
  if (url.startsWith('/uploads/')) {
    const filePath = join(UPLOAD_DIR, url.replace(/^\/uploads\//, ''));
    if (!existsSync(filePath)) return fail(res, 404, '音频文件不存在');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.sendFile(filePath);
  }

  // 本地 public 资源（/music/...）
  if (url.startsWith('/') && !url.startsWith('//')) {
    const publicDir = join(__dirname, '..', '..', '..', 'client', 'public');
    const filePath = join(publicDir, url.replace(/^\/+/, ''));
    if (existsSync(filePath)) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(filePath);
    }
  }

  // 外链：代理下载（支持一次重定向）
  if (/^https?:\/\//i.test(url)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const fetch = (target, redirects = 0) => {
      const client = target.startsWith('https') ? https : http;
      client.get(target, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (remote) => {
        if (remote.statusCode >= 300 && remote.statusCode < 400 && remote.headers.location) {
          remote.resume();
          if (redirects >= 5) {
            return fail(res, 502, '音频源重定向次数过多');
          }
          return fetch(remote.headers.location, redirects + 1);
        }
        if (remote.statusCode >= 400) {
          remote.resume();
          return fail(res, 502, `音频源返回 ${remote.statusCode}`);
        }
        remote.pipe(res);
      }).on('error', () => fail(res, 502, '无法连接到音频源'));
    };
    fetch(url);
    return;
  }

  fail(res, 400, '不支持的音频地址');
});

export default router;
