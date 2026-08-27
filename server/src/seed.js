import { db, getSetting, setSetting } from './db.js';
import { hashPassword } from './auth.js';

const DEFAULT_SETTINGS = {
  siteName: 'exhibition hall',
  welcome: '欢迎来到星辉的小屋',
  tagline: '这里收藏着我写过的代码、拍过的照片、听过的歌，还有散落在日常里的心情碎片。',
  avatar: '/images/avatar-anime.svg',
  banner: '/images/banner.svg',
  name: 'XingHuiSama',
  bio: '✨ 喜欢二次元与代码的普通少女 · 记录生活 · 分享热爱 · 认真长大',
  occupation: '前端工程师',
  location: '中国 · 杭州',
  email: 'hello@xinghui.dev',
  contact: '欢迎通过邮件或社交平台与我交流',
  socials: [
    { name: 'GitHub', url: 'https://github.com', icon: 'github' },
    { name: '微博', url: 'https://weibo.com', icon: 'weibo' },
    { name: 'B站', url: 'https://bilibili.com', icon: 'bilibili' },
    { name: '邮箱', url: 'mailto:hello@example.com', icon: 'mail' }
  ],
  friendApply: '欢迎申请友链。请在留言板留下你的站点名称、链接与简介，我会在看到后尽快处理。',
  about: `## 你好，我是 XingHuiSama

我是一名全栈工程师，喜欢用代码解决问题，也喜欢用相机记录生活。这里是我的「数字花园」——一个既展示作品、也安放日常思绪的地方。

### 我做什么

- **前端**：Vue3、React、TypeScript，追求精致细腻的交互体验；
- **后端**：Node.js、Python，关注架构设计与接口稳定性；
- **数据库**：PostgreSQL、MongoDB，习惯为数据建模留下余量。

### 我关注什么

技术之外，我同样在意生活的质感：周末的徒步、黄昏的光影、一本翻到折角的书，都是我灵感的一部分。我相信好的作品源于对细节的耐心，也源于对生活的热爱。

### 关于这座花园

这里不只有文章。你会在「项目」里看到我打磨过的作品，在「照片墙」里遇见我走过的风景，在「杂谈」里读到一些不成熟的思考，也可以在「留言板」留下你的足迹。希望你能在这里逛得愉快。`
};

const POSTS = [
  {
    title: '如何搭建一座属于自己的数字花园',
    cover: '/images/post-cover-01.svg',
    tags: ['博客', '建站', '全栈'],
    content: `> 一篇关于「为什么要做个人博客」以及「如何从零开始」的随笔。

互联网很大，但真正属于我们自己的地方并不多。社交平台的账号会失效，平台会关闭，而一座由自己掌控的数字花园，却可以陪你走很久。

## 为什么是「花园」而不是「博客」

传统博客以文章为中心，而数字花园更像是把**作品、照片、思考与社交**一起种下去的空间。它可以是简历，可以是相册，也可以是一本公开的日记。

## 我选择了什么样的技术栈

\`\`\`text
前端：Vue 3 + Vite + Pinia
后端：Node.js + Express
数据库：SQLite
\`\`\`

选型的核心原则只有一条：**足够简单，足够可控**。这套组合上手快、依赖少，非常适合个人项目长期维护。

## 一点建议

1. 先有内容，再打磨样式；
2. 把发布门槛降到最低；
3. 坚持记录，哪怕只是三行字。`
  },
  {
    title: '用 Vue3 + Express 从零实现前后端分离',
    cover: '/images/post-cover-02.svg',
    tags: ['Vue3', 'Express', '实战'],
    content: `前后端分离的核心，是让前端专注于呈现、后端专注于数据与权限。

## 前端

Vue3 的组合式 API 让状态管理变得非常自然。主题切换、全局设置这些需求，用 \`Pinia\` 配合 \`localStorage\` 就能优雅地完成。

## 后端

Express 的路由层非常轻量，配合 SQLite 完全能满足个人站点的数据量。关键是做好**权限隔离**与**接口防护**：

- 后台接口统一经过鉴权中间件；
- 公开写接口加入基础频率限制；
- 所有输入都做校验，避免注入。

## 总结

小型项目的架构，克制比炫技更重要。清晰的边界，才能让项目走得更远。`
  },
  {
    title: '照片墙的瀑布流与懒加载实践',
    cover: '/images/post-cover-03.svg',
    tags: ['前端', '性能', 'CSS'],
    content: `照片墙既要好看，也要快。这里分享几个我用到的技巧。

## 瀑布流布局

使用 CSS \`columns\` 是最省心的方式：

\`\`\`css
.masonry {
  columns: 3;
  column-gap: 16px;
}
\`\`\`

配合 \`break-inside: avoid\`，就能让卡片自然地错落排列。

## 懒加载

给图片加上 \`loading="lazy"\`，再通过 \`IntersectionObserver\` 在进入视口时才真正替换 \`src\`，首屏速度会有明显提升。

## Lightbox 预览

点击图片后放大预览，支持左右切换和键盘操作，是小成本换来大质感的关键细节。`
  },
  {
    title: '一段关于秋天的随手记',
    cover: '/images/post-cover-04.svg',
    tags: ['生活', '随笔'],
    content: `入秋之后，天光开始变得温柔。

周末去山里走了走，风里已经带了点凉意。银杏还没全黄，但树影已经斑驳得好看。我拍了整整一个下午，回来整理照片时，才意识到自己已经很久没有这样专注地做一件「没有产出」的事了。

这大概就是数字花园想留住的东西——不只是项目与成就，还有这些看似无用、却让人真正活着的瞬间。

> 我们总是急着赶路，却忘了沿途也值得被认真记录。`
  },
  {
    title: '2026 年我关注的几个技术趋势',
    cover: '/images/post-cover-05.svg',
    tags: ['思考', '趋势'],
    content: `技术的浪潮一波接一波，但真正值得长期投入的并不多。记录一下我今年最关注的几个方向。

## AI 辅助开发

工具越来越聪明，但工程师的价值正在从「写代码」转向「定义问题、评估方案」。学会与 AI 协作，比拒绝它更重要。

## 本地优先

数据主权越来越被重视，\`local-first\` 与 SQLite 生态的崛起，让个人项目有了更多可能性。

## 极简与性能

当功能不再稀缺，体验与性能就成了真正的护城河。小而美的产品，反而更有生命力。`
  }
];

const PROJECTS = [
  {
    title: '数字花园博客',
    description: '一个前后端分离的个人博客系统，集作品展示、照片墙、评论互动与音乐播放器于一体。',
    cover: '/images/project-01.svg',
    tags: ['Vue3', 'Express', 'SQLite'],
    category: '前端',
    githubUrl: 'https://github.com',
    demoUrl: '',
    featured: 1
  },
  {
    title: '实时协作白板',
    description: '基于 WebSocket 的多人实时绘图工具，支持画笔、图形与拖拽协作。',
    cover: '/images/project-02.svg',
    tags: ['React', 'WebSocket', 'Canvas'],
    category: '前端',
    githubUrl: 'https://github.com',
    demoUrl: 'https://example.com',
    featured: 1
  },
  {
    title: '任务管理 API',
    description: '一套 RESTful 风格的任务管理接口，含用户鉴权、权限控制与数据校验。',
    cover: '/images/project-03.svg',
    tags: ['Node.js', 'Express', 'PostgreSQL'],
    category: '后端',
    githubUrl: 'https://github.com',
    demoUrl: '',
    featured: 1
  },
  {
    title: '数据可视化面板',
    description: '把复杂数据变成清晰图表，支持多维度筛选与实时刷新。',
    cover: '/images/project-04.svg',
    tags: ['ECharts', 'Vue3', 'TypeScript'],
    category: '前端',
    githubUrl: 'https://github.com',
    demoUrl: 'https://example.com',
    featured: 0
  },
  {
    title: '轻量 ORM 工具',
    description: '一个面向小型项目的数据库映射工具，让 SQL 查询更优雅。',
    cover: '/images/project-05.svg',
    tags: ['Node.js', 'SQLite', '数据库'],
    category: '数据库',
    githubUrl: 'https://github.com',
    demoUrl: '',
    featured: 0
  },
  {
    title: '命令行效率工具集',
    description: '整理日常开发常用的脚本与命令，一键提升工作效率。',
    cover: '/images/project-06.svg',
    tags: ['Node.js', 'CLI', '工具'],
    category: '工具',
    githubUrl: 'https://github.com',
    demoUrl: '',
    featured: 0
  }
];

const PHOTOS = [
  { title: '山间的第一缕光', album: '风光', year: 2026, url: '/images/photo-01.svg' },
  { title: '黄昏的海岸线', album: '风光', year: 2026, url: '/images/photo-02.svg' },
  { title: '老城区的午后', album: '人文', year: 2025, url: '/images/photo-03.svg' },
  { title: '窗边的绿植', album: '日常', year: 2025, url: '/images/photo-04.svg' },
  { title: '雨后的街角', album: '人文', year: 2025, url: '/images/photo-05.svg' },
  { title: '一片银杏叶', album: '日常', year: 2024, url: '/images/photo-06.svg' },
  { title: '雪落山巅', album: '风光', year: 2024, url: '/images/photo-07.svg' },
  { title: '咖啡馆的猫', album: '日常', year: 2024, url: '/images/photo-08.svg' },
  { title: '夏日蝉鸣', album: '日常', year: 2023, url: '/images/photo-09.svg' },
  { title: '星空下的帐篷', album: '风光', year: 2023, url: '/images/photo-10.svg' },
  { title: '巷口的早餐铺', album: '人文', year: 2023, url: '/images/photo-11.svg' },
  { title: '冬日暖阳', album: '风光', year: 2023, url: '/images/photo-12.svg' }
];

const LINKS = [
  { name: 'Vue.js', url: 'https://cn.vuejs.org', logo: '/images/link-vue.svg', description: '渐进式 JavaScript 框架' },
  { name: 'Vite', url: 'https://vitejs.dev', logo: '/images/link-vite.svg', description: '下一代前端构建工具' },
  { name: 'Node.js', url: 'https://nodejs.org', logo: '/images/link-node.svg', description: 'JavaScript 运行时' },
  { name: 'MDN', url: 'https://developer.mozilla.org', logo: '/images/link-mdn.svg', description: 'Web 开发者文档' }
];

const MUSIC = [
  {
    title: '晨光微雨',
    artist: '数字花园',
    url: '/music/track-01.wav',
    lrc: '/music/track-01.lrc',
    cover: '/images/music-01.svg',
    sort: 1
  },
  {
    title: '夜航星海',
    artist: '数字花园',
    url: '/music/track-02.wav',
    lrc: '/music/track-02.lrc',
    cover: '/images/music-02.svg',
    sort: 2
  },
  {
    title: '山间回响',
    artist: '数字花园',
    url: '/music/track-03.wav',
    lrc: '/music/track-03.lrc',
    cover: '/images/music-03.svg',
    sort: 3
  }
];

export function seedIfEmpty() {
  // 仅当 admin 账号不存在时，判定为全新数据库，才填充示例数据。
  // 已有数据库（admin 已存在）绝不自动填充，避免用户删除后重启又恢复。
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const now = new Date().toISOString();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      'admin',
      hashPassword(password)
    );
    setSetting('site', JSON.stringify(DEFAULT_SETTINGS));

    const insertPost = db.prepare(
      'INSERT INTO posts (title, content, cover, tags, published, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    );
    POSTS.forEach((p, i) => {
      const date = new Date(Date.now() - i * 86400000 * 3).toISOString();
      insertPost.run(p.title, p.content, p.cover, JSON.stringify(p.tags), date, date);
    });

    const insertProject = db.prepare(
      'INSERT INTO projects (title, description, cover, tags, category, github_url, demo_url, featured, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    PROJECTS.forEach((p) => {
      insertProject.run(p.title, p.description, p.cover, JSON.stringify(p.tags), p.category, p.githubUrl, p.demoUrl, p.featured, now);
    });

    const insertPhoto = db.prepare(
      'INSERT INTO photos (url, title, album, year, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    PHOTOS.forEach((p) => insertPhoto.run(p.url, p.title, p.album, p.year, now));

    const insertLink = db.prepare(
      'INSERT INTO links (name, url, logo, description, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    LINKS.forEach((l) => insertLink.run(l.name, l.url, l.logo, l.description, now));

    const insertMusic = db.prepare(
      'INSERT INTO music (title, artist, url, lrc, cover, sort) VALUES (?, ?, ?, ?, ?, ?)'
    );
    MUSIC.forEach((m) => insertMusic.run(m.title, m.artist, m.url, m.lrc, m.cover, m.sort));

    const firstPost = db.prepare('SELECT id FROM posts ORDER BY created_at DESC LIMIT 1').get();
    if (firstPost) {
      db.prepare(
        "INSERT INTO comments (post_id, nickname, content, is_admin, created_at) VALUES (?, '访客阿白', '写得太好了，学到了！', 0, ?)"
      ).run(firstPost.id, new Date(Date.now() - 86400000).toISOString());
      db.prepare(
        "INSERT INTO comments (post_id, nickname, content, is_admin, created_at) VALUES (?, '博主', '谢谢支持，欢迎常来逛逛~', 1, ?)"
      ).run(firstPost.id, new Date(Date.now() - 80000000).toISOString());
    }

    db.prepare(
      "INSERT INTO messages (nickname, content, reply, created_at) VALUES ('路过的小林', '这个花园设计得真舒服，喜欢照片墙！', '谢谢喜欢，之后会继续更新的~', ?)"
    ).run(new Date(Date.now() - 172800000).toISOString());
    db.prepare(
      "INSERT INTO messages (nickname, content, created_at) VALUES ('旅人', '从友链摸过来的，很喜欢这里的气质。', ?)"
    ).run(new Date(Date.now() - 90000000).toISOString());
  } else {
    // 已有数据库：仅在站点设置完全缺失时写入默认值，绝不覆盖用户已修改的内容
    if (!getSetting('site')) {
      setSetting('site', JSON.stringify(DEFAULT_SETTINGS));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  seedIfEmpty();
  console.log('✅ 数据库初始化/种子数据完成');
}
