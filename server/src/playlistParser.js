import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.wma']);
const PLAYLIST_EXTS = new Set(['.m3u', '.m3u8', '.pls', '.xspf']);

export function isPlaylistFile(name) {
  return PLAYLIST_EXTS.has(extname(String(name || '').toLowerCase()));
}

export function isAudioFile(name) {
  return AUDIO_EXTS.has(extname(String(name || '').toLowerCase()));
}

/**
 * 解析 M3U / M3U8 文本
 * 返回 [{ title, artist, url, duration }]
 */
function parseM3u(text) {
  const lines = String(text).split(/\r?\n/);
  const items = [];
  let pending = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#EXTM3U') || line.startsWith('#PLAYLIST')) continue;
    const ext = line.match(/^#EXTINF:\s*(-?\d+(?:\.\d+)?)\s*,\s*(.*)$/i);
    if (ext) {
      const duration = Number(ext[1]) > 0 ? Number(ext[1]) : 0;
      const label = ext[2].trim();
      let artist = '';
      let title = label;
      const m = label.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (m) {
        artist = m[1].trim();
        title = m[2].trim();
      }
      pending = { title, artist, duration, url: '' };
      continue;
    }
    if (line.startsWith('#')) continue;
    if (pending) {
      pending.url = line;
      items.push(pending);
      pending = null;
    } else {
      items.push({ title: '', artist: '', duration: 0, url: line });
    }
  }
  return items;
}

/**
 * 解析 PLS 文本
 */
function parsePls(text) {
  const items = [];
  const map = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    const num = key.match(/\d+$/);
    if (!num) continue;
    const idx = Number(num[0]);
    const field = key.replace(/\d+$/, '');
    if (!map[idx]) map[idx] = { title: '', artist: '', duration: 0, url: '' };
    if (field === 'file') map[idx].url = value;
    else if (field === 'title') map[idx].title = value;
    else if (field === 'length') map[idx].duration = Number(value) > 0 ? Number(value) : 0;
  }
  for (const idx of Object.keys(map).sort((a, b) => Number(a) - Number(b))) {
    if (map[idx].url) items.push(map[idx]);
  }
  return items;
}

/**
 * 解析 XSPF (XML)，使用简单正则，避免依赖外部 XML 库
 */
function parseXspf(text) {
  const items = [];
  const trackRe = /<track\b[^>]*>([\s\S]*?)<\/track>/gi;
  let m;
  while ((m = trackRe.exec(text)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const mm = block.match(r);
      return mm ? decodeXml(mm[1].trim()) : '';
    };
    const duration = Number(get('duration')) > 0 ? Number(get('duration')) / 1000 : 0;
    items.push({
      title: get('title'),
      artist: get('creator') || get('artist'),
      url: get('location'),
      duration
    });
  }
  return items;
}

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 根据扩展名选择解析器
 */
export function parsePlaylistText(text, filename) {
  const ext = extname(String(filename || '').toLowerCase());
  if (ext === '.pls') return parsePls(text);
  if (ext === '.xspf') return parseXspf(text);
  return parseM3u(text); // m3u / m3u8 / 未知都按 m3u 处理
}

/**
 * 清理路径，防止目录穿越
 */
function safeJoin(base, target) {
  const resolved = resolve(base, target);
  const baseResolved = resolve(base);
  if (!resolved.startsWith(baseResolved + sep) && resolved !== baseResolved) {
    return null;
  }
  return resolved;
}

/**
 * 从已解压的目录中找到第一个歌单文件
 */
export function findPlaylistFile(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isFile() && isPlaylistFile(e.name)) return full;
    if (e.isDirectory()) {
      const found = findPlaylistFile(full);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 递归收集目录下所有音频文件，返回相对路径 -> 绝对路径 的映射
 */
function collectAudioFiles(dir, base) {
  const map = new Map();
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isFile() && isAudioFile(e.name)) {
      const rel = full.slice(base.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
      map.set(rel.toLowerCase(), full);
      map.set(e.name.toLowerCase(), full); // 也支持按文件名匹配
    } else if (e.isDirectory()) {
      const sub = collectAudioFiles(full, base);
      for (const [k, v] of sub) map.set(k, v);
    }
  }
  return map;
}

/**
 * 把歌单中引用的本地音频文件复制到 uploads 目录，重写 url
 * @param {Array} items 解析后的曲目
 * @param {string} playlistDir 歌单文件所在目录（用于解析相对路径）
 * @param {string} uploadDir 目标上传目录
 * @param {string} urlPrefix 访问 URL 前缀，如 /uploads
 * @returns {Array} 处理后的 items
 */
export function materializeAudioFiles(items, playlistDir, uploadDir, urlPrefix = '/uploads') {
  mkdirSync(uploadDir, { recursive: true });
  const audioMap = collectAudioFiles(playlistDir, playlistDir);
  return items.map((item) => {
    const url = String(item.url || '').trim();
    if (!url) return item;
    // 已经是 http(s) 外链，不处理
    if (/^https?:\/\//i.test(url)) return item;
    // data: URI 不处理
    if (url.startsWith('data:')) return item;

    // 尝试匹配 zip 内的音频文件
    const cleanUrl = url.replace(/^file:\/\//i, '').replace(/^\/+/, '');
    const matched = audioMap.get(cleanUrl.toLowerCase()) || audioMap.get(cleanUrl.split('/').pop().toLowerCase());
    if (matched && existsSync(matched)) {
      const ext = extname(matched).toLowerCase() || '.mp3';
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
      const dest = join(uploadDir, safeName);
      writeFileSync(dest, readFileSync(matched));
      return { ...item, url: `${urlPrefix}/${safeName}` };
    }
    return item;
  });
}

/**
 * 从 zip buffer 解压到临时目录（使用 node 内置能力 + 第三方 adm-zip 如果可用，否则回退）
 * 这里我们假设项目里可能没有 adm-zip，所以用一个简单的实现策略：
 * 实际上 Node 22+ 没有内置 zip 解压。我们检查是否有 adm-zip，没有则提示。
 */
export async function extractZip(zipBuffer, destDir) {
  mkdirSync(destDir, { recursive: true });
  // 尝试使用 adm-zip
  let AdmZip;
  try {
    AdmZip = (await import('adm-zip')).default;
  } catch {
    throw new Error('缺少 adm-zip 依赖，请在 server 目录执行 npm install adm-zip');
  }
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const target = safeJoin(destDir, entry.entryName);
    if (!target) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.getData());
  }
  return destDir;
}
