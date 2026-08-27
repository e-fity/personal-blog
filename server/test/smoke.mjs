import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const tmpDir = mkdtempSync(join(tmpdir(), 'garden-test-'));
process.env.DB_PATH = join(tmpDir, 'test.db');
process.env.UPLOAD_DIR = join(tmpDir, 'uploads');
process.env.ADMIN_PASSWORD = 'test-pass-123';

const { closeDb } = await import('../src/db.js');
const { createApp } = await import('../src/index.js');

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`PASS  ${name}`);
}

async function req(method, path, body, token) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

try {
  const settings = await req('GET', '/api/settings');
  check('settings 返回站点资料', settings.status === 200 && settings.data.name === 'XingHuiSama');

  const posts = await req('GET', '/api/posts?limit=5');
  check('posts 列表', posts.status === 200 && Array.isArray(posts.data) && posts.data.length === 5);

  const projects = await req('GET', '/api/projects');
  check('projects 列表', projects.status === 200 && projects.data.length >= 5);
  check('项目详情接口', (await req('GET', `/api/projects/${projects.data[0].id}`)).status === 200);
  check('项目详情404', (await req('GET', '/api/projects/99999')).status === 404);

  check('精选文章过滤(默认无)', (await req('GET', '/api/posts?featured=1')).data.length === 0);

  const photos = await req('GET', '/api/photos');
  check('photos 列表', photos.status === 200 && photos.data.length >= 10);

  const filters = await req('GET', '/api/photos/filters');
  check('photos filters', filters.status === 200 && Array.isArray(filters.data.years));

  const music = await req('GET', '/api/music');
  check('music 列表', music.status === 200 && music.data.length === 3);

  const quotes = await req('GET', '/api/quotes');
  check('说说接口已移除(404)', quotes.status === 404);

  const login = await req('POST', '/api/auth/login', { username: 'admin', password: 'test-pass-123' });
  check('登录成功', login.status === 200 && !!login.data.token);
  const token = login.data.token;

  const me = await req('GET', '/api/auth/me', null, token);
  check('auth/me', me.status === 200 && me.data.username === 'admin');

  const noAuth = await req('POST', '/api/posts', { title: 'x' });
  check('未授权写接口被拒', noAuth.status === 401);

  const tooLong = await req('POST', '/api/posts', { title: 'x'.repeat(300) }, token);
  check('超长标题被校验拒绝', tooLong.status === 400);

  const created = await req('POST', '/api/posts', { title: '测试文章', content: '# hi', tags: ['测试'] }, token);
  check('创建文章', created.status === 201 && created.data.id > 0);
  check('删除文章', (await req('DELETE', `/api/posts/${created.data.id}`, null, token)).status === 200);

  const featuredPost = await req('POST', '/api/posts', { title: '精选文章', content: 'x', tags: [], featured: 1 }, token);
  check('创建精选文章', featuredPost.status === 201);
  check('精选过滤命中', (await req('GET', '/api/posts?featured=1')).data.some((p) => p.title === '精选文章'));
  check('删除精选文章', (await req('DELETE', `/api/posts/${featuredPost.data.id}`, null, token)).status === 200);

  const comment = await req('POST', '/api/comments', { post_id: posts.data[0].id, nickname: '测试', content: '你好' });
  check('发表评论', comment.status === 201);
  check('发表留言', (await req('POST', '/api/messages', { nickname: '测试', content: '留言测试' })).status === 201);

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await req('POST', '/api/upload', { filename: 'a.png', data: png }, token);
  check('上传图片', up.status === 201 && up.data.url.startsWith('/uploads/'));
  check('非法扩展名被拒', (await req('POST', '/api/upload', { filename: 'evil.html', data: png }, token)).status === 400);

  // 其余 CRUD 覆盖
  check('友链列表', (await req('GET', '/api/links')).data.length === 4);
  const newLink = await req('POST', '/api/links', { name: '测试友链', url: 'https://example.com' }, token);
  check('新增友链', newLink.status === 201);
  check('删除友链', (await req('DELETE', `/api/links/${newLink.data.id}`, null, token)).status === 200);

  const newProject = await req('POST', '/api/projects', { title: '测试项目', tags: ['Vue3'], category: '前端' }, token);
  check('新增项目', newProject.status === 201);
  check('更新项目', (await req('PUT', `/api/projects/${newProject.data.id}`, { description: '更新描述' }, token)).status === 200);
  check('删除项目', (await req('DELETE', `/api/projects/${newProject.data.id}`, null, token)).status === 200);

  const newPhoto = await req('POST', '/api/photos', { url: '/uploads/a.png', title: '测试照片', album: '测试', year: 2026 }, token);
  check('新增照片', newPhoto.status === 201);
  check('删除照片', (await req('DELETE', `/api/photos/${newPhoto.data.id}`, null, token)).status === 200);

  const newMusic = await req('POST', '/api/music', { title: '测试曲目', url: '/uploads/a.mp3' }, token);
  check('新增曲目', newMusic.status === 201);
  check('更新曲目', (await req('PUT', `/api/music/${newMusic.data.id}`, { artist: '测试' }, token)).status === 200);
  check('删除曲目', (await req('DELETE', `/api/music/${newMusic.data.id}`, null, token)).status === 200);

  const msgList = await req('GET', '/api/messages');
  const msgId = msgList.data.find((m) => m.content === '留言测试').id;
  check('回复留言', (await req('POST', `/api/messages/${msgId}/reply`, { reply: '收到' }, token)).status === 200);
  check('评论列表', (await req('GET', `/api/comments?post_id=${posts.data[0].id}`)).data.length >= 1);

  check('更新设置', (await req('PUT', '/api/settings', { siteName: '测试站点' }, token)).status === 200);

  // 合集
  const col = await req('POST', '/api/collections', { title: '测试合集', description: 'desc' }, token);
  check('新增合集', col.status === 201);
  check('合集列表', (await req('GET', '/api/collections')).data.length >= 1);
  check('合集详情', (await req('GET', `/api/collections/${col.data.id}`)).status === 200);

  const colPhoto = await req('POST', '/api/photos', { url: '/uploads/a.png', title: '合集照片', album: '测试', year: 2026, collection_id: col.data.id }, token);
  check('照片加入合集', colPhoto.status === 201);
  check('按合集筛选照片', (await req('GET', `/api/photos?collection=${col.data.id}`)).data.some((p) => p.id === colPhoto.data.id));
  check('单独显示筛选', (await req('GET', '/api/photos?collection=none')).data.every((p) => !p.collection_id));

  check('合集评论', (await req('POST', '/api/comments', { collection_id: col.data.id, nickname: '测试', content: '合集评论' })).status === 201);
  check('按合集拉评论', (await req('GET', `/api/comments?collection_id=${col.data.id}`)).data.length >= 1);

  check('删除合集(照片自动解绑)', (await req('DELETE', `/api/collections/${col.data.id}`, null, token)).status === 200);
  check('删除后照片回到单独显示', (await req('GET', '/api/photos?collection=none')).data.some((p) => p.id === colPhoto.data.id));

  // 全局搜索
  const s1 = await req('GET', '/api/search?q=Vue3');
  check('搜索命中项目/文章', s1.status === 200 && (s1.data.projects.length > 0 || s1.data.posts.length > 0));
  const s2 = await req('GET', '/api/search?q=秋天');
  check('搜索命中文章', s2.status === 200 && s2.data.posts.length > 0);
  const s3 = await req('GET', '/api/search?q=不存在的关键词xyz');
  check('搜索空结果', s3.status === 200 && s3.data.posts.length + s3.data.projects.length + s3.data.photos.length + s3.data.links.length === 0);

  console.log(`\n全部通过：${passed} 项`);
} finally {
  server.close();
  closeDb();
  await new Promise((resolve) => setTimeout(resolve, 80));
  rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
