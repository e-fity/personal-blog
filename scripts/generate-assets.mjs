import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'client', 'public', 'images');
const MUSIC_DIR = join(ROOT, 'client', 'public', 'music');

mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(MUSIC_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// SVG placeholders
// ---------------------------------------------------------------------------
function svg({ w, h, label, from, to, seed = 1, square = false }) {
  const id = `g${Math.abs(seed)}${w}`;
  const circles = [];
  for (let i = 0; i < 3; i++) {
    const cx = ((seed * (i + 7) * 37) % 100);
    const cy = ((seed * (i + 11) * 53) % 100);
    const r = 8 + ((seed + i) % 18);
    circles.push(`<circle cx="${cx}%" cy="${cy}%" r="${r}%" fill="#ffffff" opacity="0.06"/>`);
  }
  const fontSize = Math.round(Math.min(w, h) / (square ? 9 : 10));
  const labelText = label
    ? `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="${fontSize}" fill="#ffffff" opacity="0.78" letter-spacing="4">${label}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id})"/>
  ${circles.join('\n  ')}
  ${labelText}
</svg>`;
}

function writeSvg(name, opts) {
  writeFileSync(join(IMG_DIR, name), svg(opts));
}

const PALETTES = [
  ['#5b6cf9', '#9b5cf6'],
  ['#12b8a6', '#3b82f6'],
  ['#f97316', '#ec4899'],
  ['#22c55e', '#0ea5e9'],
  ['#ef4444', '#f59e0b'],
  ['#8b5cf6', '#06b6d4'],
  ['#0ea5e9', '#6366f1'],
  ['#e11d48', '#f97316']
];

// Avatar & banner
writeSvg('avatar.svg', { w: 400, h: 400, label: '时楽曳', from: '#6366f1', to: '#a855f7', seed: 3, square: true });
writeSvg('banner.svg', { w: 1600, h: 480, label: 'DIGITAL GARDEN', from: '#0f172a', to: '#4f46e5', seed: 9 });
writeSvg('favicon.svg', { w: 64, h: 64, label: '园', from: '#6366f1', to: '#a855f7', seed: 1, square: true });

// Project covers
const projectLabels = ['数字花园', '白板', '任务 API', '数据面板', 'ORM', 'CLI'];
for (let i = 0; i < 6; i++) {
  const [from, to] = PALETTES[i % PALETTES.length];
  writeSvg(`project-${String(i + 1).padStart(2, '0')}.svg`, { w: 800, h: 500, label: projectLabels[i], from, to, seed: i + 11 });
}

// Post covers
const postLabels = ['数字花园', '前后端分离', '照片墙', '秋天随笔', '技术趋势'];
for (let i = 0; i < 5; i++) {
  const [from, to] = PALETTES[(i + 2) % PALETTES.length];
  writeSvg(`post-cover-${String(i + 1).padStart(2, '0')}.svg`, { w: 1200, h: 630, label: postLabels[i], from, to, seed: i + 31 });
}

// Photos (varied aspect ratios for masonry)
const photoSpecs = [
  ['山间的第一缕光', 800, 1000, 0],
  ['黄昏的海岸线', 800, 620, 1],
  ['老城区的午后', 800, 880, 2],
  ['窗边的绿植', 800, 640, 3],
  ['雨后的街角', 800, 960, 4],
  ['一片银杏叶', 800, 700, 5],
  ['雪落山巅', 800, 1040, 6],
  ['咖啡馆的猫', 800, 600, 7],
  ['夏日蝉鸣', 800, 900, 0],
  ['星空下的帐篷', 800, 660, 1],
  ['巷口的早餐铺', 800, 820, 2],
  ['冬日暖阳', 800, 720, 3]
];
photoSpecs.forEach(([title, w, h, pi], i) => {
  const [from, to] = PALETTES[pi % PALETTES.length];
  writeSvg(`photo-${String(i + 1).padStart(2, '0')}.svg`, { w, h, label: title, from, to, seed: i + 101 });
});

// Link logos (rounded initial tiles)
const linkSpecs = [
  ['link-vue.svg', 'V', '#42b883', '#35495e'],
  ['link-vite.svg', 'Vi', '#646cff', '#b453f6'],
  ['link-node.svg', 'N', '#3c873a', '#68a063'],
  ['link-mdn.svg', 'M', '#212121', '#6b7280']
];
linkSpecs.forEach(([name, label, from, to]) => {
  writeSvg(name, { w: 128, h: 128, label, from, to, seed: label.length + 7, square: true });
});

// Music covers
const musicLabels = ['晨光微雨', '夜航星海', '山间回响'];
for (let i = 0; i < 3; i++) {
  const [from, to] = PALETTES[(i + 4) % PALETTES.length];
  writeSvg(`music-${String(i + 1).padStart(2, '0')}.svg`, { w: 480, h: 480, label: musicLabels[i], from, to, seed: i + 201, square: true });
}

// ---------------------------------------------------------------------------
// Music synthesis (WAV) + synced LRC lyrics
// ---------------------------------------------------------------------------
const SAMPLE_RATE = 22050;

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function writeWav(path, samples) {
  const n = samples.length;
  const buffer = Buffer.alloc(44 + n * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + n * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

function addTone(data, start, dur, freq, amp, decay = 3.2) {
  for (let i = 0; i < dur && start + i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.006));
    const s = Math.sin(2 * Math.PI * freq * t) + 0.32 * Math.sin(4 * Math.PI * freq * t) + 0.12 * Math.sin(6 * Math.PI * freq * t);
    data[start + i] += amp * env * attack * s;
  }
}

function renderTrack({ bpm, scale, bars, lyrics, fileBase }) {
  const beat = SAMPLE_RATE * (60 / bpm);
  const total = Math.ceil(bars * 4 * beat);
  const data = new Float64Array(total);

  for (let bar = 0; bar < bars; bar++) {
    const base = (bar * 2) % Math.max(1, scale.length - 4);
    const chord = [scale[base], scale[base + 2], scale[base + 4], scale[base + 3]];
    // soft bass
    addTone(data, Math.floor(bar * 4 * beat), Math.floor(beat * 2.2), midiToFreq(scale[base] - 12), 0.16, 1.2);
    for (let b = 0; b < 4; b++) {
      const start = Math.floor((bar * 4 + b) * beat);
      const dur = Math.floor(beat * 1.6);
      addTone(data, start, dur, midiToFreq(chord[b]), 0.42, 2.8);
    }
  }

  // Normalize
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / peak) * 0.85;

  writeWav(join(MUSIC_DIR, `${fileBase}.wav`), data);

  const lines = lyrics.map((text, i) => {
    const sec = i * (60 / bpm) * 4;
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = (sec % 60).toFixed(2).padStart(5, '0');
    return `[${mm}:${ss}]${text}`;
  });
  writeFileSync(join(MUSIC_DIR, `${fileBase}.lrc`), lines.join('\n') + '\n');
}

const C_MAJOR_PENT = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86];
const A_MINOR_PENT = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
const G_MAJOR_PENT = [55, 59, 62, 64, 67, 69, 71, 74, 76, 79, 81, 83];

renderTrack({
  bpm: 96,
  scale: C_MAJOR_PENT,
  bars: 12,
  fileBase: 'track-01',
  lyrics: ['晨光透过薄雾', '雨滴落在屋檐', '风轻轻翻动书页', '咖啡冒着热气', '世界慢慢苏醒', '光影爬上窗台', '一只鸟飞过天边', '日子安静地流淌', '心事被阳光晒暖', '露珠晶莹又短暂', '我听见时光低语', '温柔得像一场梦']
});

renderTrack({
  bpm: 84,
  scale: A_MINOR_PENT,
  bars: 12,
  fileBase: 'track-02',
  lyrics: ['夜色漫过城市', '星光洒满海面', '我们乘着一叶舟', '驶向梦的深处', '风从远方吹来', '带着海盐的气息', '灯塔在远处闪烁', '像一句没说出口的问候', '波浪轻轻摇晃', '心事慢慢放空', '这一程没有终点', '只有无垠的星海']
});

renderTrack({
  bpm: 108,
  scale: G_MAJOR_PENT,
  bars: 12,
  fileBase: 'track-03',
  lyrics: ['走进寂静的山谷', '听见自己的脚步', '溪水在石间跳跃', '鸟儿在枝头应和', '阳光穿过树梢', '铺成斑驳的小路', '山风轻轻掠过', '带来松针的清香', '回声在山间荡漾', '像是自然的合唱', '心也跟着安静下来', '一切都刚刚好']
});

console.log('✅ 资源生成完成:', IMG_DIR, MUSIC_DIR);
