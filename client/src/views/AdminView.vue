<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'
import AppIcon from '../components/AppIcon.vue'
import UploadModal from '../components/UploadModal.vue'

const store = useAppStore()
const router = useRouter()

const activeTab = ref('overview')
const posts = ref([])
const projects = ref([])
const photos = ref([])
const messages = ref([])
const comments = ref([])
const links = ref([])
const music = ref([])
const collections = ref([])

const stats = computed(() => ({
  posts: posts.value.length,
  projects: projects.value.length,
  photos: photos.value.length,
  messages: messages.value.length,
  comments: comments.value.length,
  links: links.value.length,
  music: music.value.length,
  collections: collections.value.length
}))

const ENDPOINT = { post: 'posts', project: 'projects', photo: 'photos', link: 'links', music: 'music', collection: 'collections' }
const EMPTY = {
  post: { title: '', cover: '', tags: '', content: '', published: true, featured: false },
  project: { title: '', description: '', cover: '', tags: '', category: '工具', githubUrl: '', demoUrl: '', featured: false },
  photo: { url: '', title: '', album: '日常', year: new Date().getFullYear(), collection_id: null },
  link: { name: '', url: '', logo: '', description: '' },
  music: { title: '', artist: '', url: '', lrc: '', cover: '', sort: 0 },
  collection: { title: '', description: '', cover: '' }
}

const formType = ref('')
const editingId = ref(null)
const form = reactive({})
const formError = ref('')

const settingsForm = reactive({ socialsText: '' })
const replyTarget = ref(null)
const replyText = ref('')
const toastMsg = ref('')
let toastTimer = null

const uploadOpen = ref(false)
const uploadTarget = ref('')
const uploadAccept = ref('image/*')
const uploadTitle = ref('上传文件')
const uploadHint = ref('')

const postTitle = (id) => posts.value.find((p) => p.id === id)?.title || `文章 #${id}`

function toast(text) {
  toastMsg.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2200)
}

function splitTags(text) {
  return String(text).split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean)
}

async function loadAll() {
  const [p, pr, ph, m, c, l, mu, cols] = await Promise.all([
    api.get('/posts?limit=100'),
    api.get('/projects'),
    api.get('/photos'),
    api.get('/messages'),
    api.get('/comments?post_id=0').catch(() => []),
    api.get('/links'),
    api.get('/music'),
    api.get('/collections')
  ])
  posts.value = p
  projects.value = pr
  photos.value = ph
  messages.value = m
  links.value = l
  music.value = mu
  collections.value = cols
  comments.value = []
}

async function loadComments() {
  const all = []
  for (const post of posts.value) {
    try {
      const list = await api.get(`/comments?post_id=${post.id}`)
      all.push(...list.map((c) => ({ ...c, post_title: post.title })))
    } catch {
      /* ignore */
    }
  }
  comments.value = all
}

function openForm(type, item) {
  formType.value = type
  editingId.value = item ? item.id : null
  formError.value = ''
  const base = { ...EMPTY[type] }
  for (const k of Object.keys(base)) delete form[k]
  if (!item) {
    Object.assign(form, base)
    return
  }
  if (type === 'post') Object.assign(form, { title: item.title, cover: item.cover, tags: (item.tags || []).join(', '), content: item.content, published: !!item.published, featured: !!item.featured })
  if (type === 'project') Object.assign(form, { title: item.title, description: item.description, cover: item.cover, tags: (item.tags || []).join(', '), category: item.category, githubUrl: item.github_url, demoUrl: item.demo_url, featured: !!item.featured })
  if (type === 'photo') Object.assign(form, { url: item.url, title: item.title, album: item.album, year: item.year, collection_id: item.collection_id ?? null })
  if (type === 'link') Object.assign(form, { name: item.name, url: item.url, logo: item.logo, description: item.description })
  if (type === 'music') Object.assign(form, { title: item.title, artist: item.artist, url: item.url, lrc: item.lrc, cover: item.cover, sort: item.sort })
  if (type === 'collection') Object.assign(form, { title: item.title, description: item.description, cover: item.cover })
}

function closeForm() {
  formType.value = ''
  editingId.value = null
}

function buildPayload() {
  const type = formType.value
  if (type === 'post') return { title: form.title, cover: form.cover, tags: splitTags(form.tags), content: form.content, published: form.published, featured: form.featured }
  if (type === 'project') return { title: form.title, description: form.description, cover: form.cover, tags: splitTags(form.tags), category: form.category, githubUrl: form.githubUrl, demoUrl: form.demoUrl, featured: form.featured }
  if (type === 'photo') return { url: form.url, title: form.title, album: form.album, year: Number(form.year), collection_id: form.collection_id }
  if (type === 'link') return { name: form.name, url: form.url, logo: form.logo, description: form.description }
  if (type === 'music') return { title: form.title, artist: form.artist, url: form.url, lrc: form.lrc, cover: form.cover, sort: Number(form.sort) || 0 }
  if (type === 'collection') return { title: form.title, description: form.description, cover: form.cover }
  return {}
}

async function saveForm() {
  const type = formType.value
  formError.value = ''
  try {
    if (editingId.value) {
      await api.put(`/${ENDPOINT[type]}/${editingId.value}`, buildPayload())
    } else {
      await api.post(`/${ENDPOINT[type]}`, buildPayload())
    }
    toast(editingId.value ? '已更新' : '已新增')
    closeForm()
    await loadAll()
  } catch (e) {
    formError.value = e.message
  }
}

async function removeItem(type, id) {
  if (!window.confirm('确认删除？此操作不可恢复。')) return
  await api.del(`/${ENDPOINT[type]}/${id}`)
  toast('已删除')
  await loadAll()
}

function openUpload(target, accept, title, hint = '') {
  uploadTarget.value = target
  uploadAccept.value = accept
  uploadTitle.value = title
  uploadHint.value = hint
  uploadOpen.value = true
}

function onUploadUse(url) {
  const target = uploadTarget.value
  if (target.startsWith('settingsForm.')) {
    settingsForm[target.replace('settingsForm.', '')] = url
  } else if (target.startsWith('form.')) {
    form[target.replace('form.', '')] = url
  }
  uploadOpen.value = false
  toast('已使用，记得保存')
}

async function saveSettings() {
  try {
    let socials = []
    try {
      socials = settingsForm.socialsText.trim() ? JSON.parse(settingsForm.socialsText) : []
    } catch {
      toast('社交链接 JSON 格式有误')
      return
    }
    await api.put('/settings', { ...settingsForm, socials })
    await store.fetchSettings()
    toast('设置已保存')
  } catch (e) {
    toast(e.message)
  }
}

async function saveReply(id) {
  await api.post(`/messages/${id}/reply`, { reply: replyText.value })
  replyTarget.value = null
  replyText.value = ''
  toast('已回复')
  await loadAll()
}

async function removeMessage(id) {
  if (!window.confirm('确认删除这条留言？')) return
  await api.del(`/messages/${id}`)
  toast('已删除')
  await loadAll()
}

async function removeComment(id) {
  if (!window.confirm('确认删除这条评论？')) return
  await api.del(`/comments/${id}`)
  toast('已删除')
  await loadComments()
}

function logout() {
  store.logout()
  router.push('/')
}

onMounted(async () => {
  await loadAll()
  await loadComments()
  const s = { ...store.settings }
  delete s.socials
  Object.assign(settingsForm, s, { socialsText: JSON.stringify(store.settings.socials || [], null, 2) })
})
</script>

<template>
  <div>
    <div class="section-title">
      <span>后台管理</span>
      <div style="display: flex; gap: 8px">
        <RouterLink to="/" class="btn btn--sm">← 返回前台</RouterLink>
        <button class="btn btn--sm btn--danger" @click="logout">退出登录</button>
      </div>
    </div>

    <div class="admin-tabs">
      <button v-for="tab in ['overview','post','project','photo','collection','message','comment','link','music','settings']" :key="tab" class="admin-tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">
        {{ { overview: '概览', post: '文章', project: '项目', photo: '照片', collection: '合集', message: '留言', comment: '评论', link: '友链', music: '音乐', settings: '设置' }[tab] }}
      </button>
    </div>

    <!-- 概览 -->
    <div v-if="activeTab === 'overview'" class="stat-grid">
      <div v-for="(value, key) in stats" :key="key" class="card stat-card">
        <strong>{{ value }}</strong>
        <span>{{ { posts: '文章', projects: '项目', photos: '照片', collections: '合集', messages: '留言', comments: '评论', links: '友链', music: '音乐' }[key] }}</span>
      </div>
    </div>

    <!-- 文章 -->
    <div v-if="activeTab === 'post'">
      <button class="btn btn--primary btn--sm" @click="openForm('post')"><AppIcon name="plus" :size="15" /> 新增文章</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in posts" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.cover || '/images/post-cover-01.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ new Date(item.created_at).toLocaleDateString('zh-CN') }} · {{ item.published ? '已发布' : '草稿' }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('post', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('post', item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 项目 -->
    <div v-if="activeTab === 'project'">
      <button class="btn btn--primary btn--sm" @click="openForm('project')"><AppIcon name="plus" :size="15" /> 新增项目</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in projects" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.cover || '/images/project-01.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ item.category }} · {{ (item.tags || []).join(', ') }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('project', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('project', item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 照片 -->
    <div v-if="activeTab === 'photo'">
      <button class="btn btn--primary btn--sm" @click="openForm('photo')"><AppIcon name="plus" :size="15" /> 上传照片</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in photos" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.url" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ item.year }} · {{ item.album }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('photo', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('photo', item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 合集 -->
    <div v-if="activeTab === 'collection'">
      <button class="btn btn--primary btn--sm" @click="openForm('collection')"><AppIcon name="plus" :size="15" /> 新增合集</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in collections" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.cover || '/images/photo-01.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ item.description || '暂无简介' }} · {{ item.count }} 张图片</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('collection', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('collection', item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 留言 -->
    <div v-if="activeTab === 'message'">
      <div class="admin-list">
        <div v-for="item in messages" :key="item.id" class="card" style="padding: 16px 18px">
          <div class="post-card__meta" style="margin-bottom: 6px"><strong>{{ item.nickname }}</strong><span>{{ new Date(item.created_at).toLocaleString('zh-CN') }}</span></div>
          <p style="margin: 0 0 6px">{{ item.content }}</p>
          <div v-if="item.reply" style="padding: 10px 12px; background: var(--accent-soft); border-radius: 8px; font-size: 0.9rem"><strong style="color: var(--accent)">回复：</strong>{{ item.reply }}</div>
          <div style="display: flex; gap: 8px; margin-top: 8px">
            <button class="btn btn--sm" @click="replyTarget = item.id; replyText = item.reply">回复</button>
            <button class="btn btn--sm btn--danger" @click="removeMessage(item.id)">删除</button>
          </div>
          <div v-if="replyTarget === item.id" style="margin-top: 10px">
            <textarea v-model="replyText" class="textarea" style="min-height: 64px" />
            <div style="display: flex; gap: 8px; margin-top: 8px">
              <button class="btn btn--sm btn--primary" @click="saveReply(item.id)">保存</button>
              <button class="btn btn--sm" @click="replyTarget = null">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 评论 -->
    <div v-if="activeTab === 'comment'">
      <div class="admin-list">
        <div v-for="item in comments" :key="item.id" class="admin-row">
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.nickname }} <span v-if="item.is_admin" class="tag tag--frontend">博主</span></div>
            <div class="admin-row__sub">{{ postTitle(item.post_id) }} · {{ item.content }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm btn--danger" @click="removeComment(item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 友链 -->
    <div v-if="activeTab === 'link'">
      <button class="btn btn--primary btn--sm" @click="openForm('link')"><AppIcon name="plus" :size="15" /> 新增友链</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in links" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.logo || '/images/avatar.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.name }}</div>
            <div class="admin-row__sub">{{ item.url }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('link', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('link', item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 音乐 -->
    <div v-if="activeTab === 'music'">
      <button class="btn btn--primary btn--sm" @click="openForm('music')"><AppIcon name="plus" :size="15" /> 新增曲目</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in music" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.cover || '/images/music-01.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ item.artist }} · {{ item.url }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('music', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('music', item.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置 -->
    <div v-if="activeTab === 'settings'" class="card admin-panel">
      <h3>站点设置</h3>
      <div class="field"><label>站点名称</label><input v-model="settingsForm.siteName" class="input" /></div>
      <div class="field"><label>欢迎语</label><input v-model="settingsForm.welcome" class="input" /></div>
      <div class="field"><label>副标题</label><input v-model="settingsForm.tagline" class="input" /></div>
      <div class="field"><label>姓名</label><input v-model="settingsForm.name" class="input" /></div>
      <div class="field"><label>一句话简介</label><input v-model="settingsForm.bio" class="input" /></div>
      <div class="field"><label>职业</label><input v-model="settingsForm.occupation" class="input" /></div>
      <div class="field"><label>所在地</label><input v-model="settingsForm.location" class="input" /></div>
      <div class="field"><label>邮箱</label><input v-model="settingsForm.email" class="input" /></div>
      <div class="field"><label>联系方式</label><input v-model="settingsForm.contact" class="input" /></div>
      <div class="field"><label>头像地址</label><input v-model="settingsForm.avatar" class="input" /></div>
      <div class="field"><label>友链申请说明</label><input v-model="settingsForm.friendApply" class="input" /></div>
      <div class="field"><label>关于内容（Markdown）</label><textarea v-model="settingsForm.about" class="textarea" style="min-height: 200px" /></div>
      <div class="field"><label>社交链接（JSON 数组）</label><textarea v-model="settingsForm.socialsText" class="textarea" style="min-height: 120px; font-family: monospace" /></div>
      <div class="field">
        <label>上传头像（替换头像地址）</label>
        <button class="btn btn--sm" @click="openUpload('settingsForm.avatar', 'image/*', '上传头像')">上传头像图片</button>
        <img v-if="settingsForm.avatar" :src="settingsForm.avatar" alt="" style="width: 84px; height: 84px; border-radius: 50%; object-fit: cover; margin-top: 8px" />
      </div>
      <button class="btn btn--primary" @click="saveSettings">保存设置</button>
    </div>

    <!-- 通用编辑面板 -->
    <div v-if="formType && formType === activeTab" class="card admin-panel">
      <h3>{{ editingId ? '编辑' : '新增' }} {{ { post: '文章', project: '项目', photo: '照片', link: '友链', music: '曲目', collection: '合集' }[formType] }}</h3>

      <template v-if="formType === 'post'">
        <div class="field"><label>标题</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>标签（逗号分隔）</label><input v-model="form.tags" class="input" placeholder="Vue3, Express" /></div>
        <div class="field"><label>封面图 URL</label><input v-model="form.cover" class="input" /></div>
        <div class="field">
          <label>上传封面</label>
          <button class="btn btn--sm" @click="openUpload('form.cover', 'image/*', '上传封面图')">选择图片上传</button>
          <img v-if="form.cover" :src="form.cover" alt="" class="admin-row__thumb" style="width: 120px; height: 76px; margin-top: 8px" />
        </div>
        <div class="field"><label>正文（Markdown）</label><textarea v-model="form.content" class="textarea" style="min-height: 260px" /></div>
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px"><input type="checkbox" v-model="form.published" /> 发布</label>
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px"><input type="checkbox" v-model="form.featured" /> 精选（首页展览展示）</label>
      </template>

      <template v-else-if="formType === 'project'">
        <div class="field"><label>标题</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>简介</label><textarea v-model="form.description" class="textarea" style="min-height: 80px" /></div>
        <div class="field"><label>标签（逗号分隔）</label><input v-model="form.tags" class="input" /></div>
        <div class="field"><label>分类</label><select v-model="form.category" class="select"><option>前端</option><option>后端</option><option>数据库</option><option>工具</option><option>其他</option></select></div>
        <div class="field"><label>封面图 URL</label><input v-model="form.cover" class="input" /></div>
        <div class="field">
          <label>上传封面</label>
          <button class="btn btn--sm" @click="openUpload('form.cover', 'image/*', '上传项目封面')">选择图片上传</button>
          <img v-if="form.cover" :src="form.cover" alt="" class="admin-row__thumb" style="width: 120px; height: 76px; margin-top: 8px" />
        </div>
        <div class="field"><label>GitHub 地址</label><input v-model="form.githubUrl" class="input" /></div>
        <div class="field"><label>Demo 地址</label><input v-model="form.demoUrl" class="input" /></div>
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px"><input type="checkbox" v-model="form.featured" /> 精选（首页展示）</label>
      </template>

      <template v-else-if="formType === 'photo'">
        <div class="field"><label>标题</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>相册</label><input v-model="form.album" class="input" /></div>
        <div class="field"><label>年份</label><input v-model.number="form.year" type="number" class="input" /></div>
        <div class="field">
          <label>合集（不选则单独显示）</label>
          <select v-model="form.collection_id" class="select">
            <option :value="null">无合集（单独显示）</option>
            <option v-for="c in collections" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
        </div>
        <div class="field"><label>图片 URL</label><input v-model="form.url" class="input" /></div>
        <div class="field">
          <label>上传图片</label>
          <button class="btn btn--sm" @click="openUpload('form.url', 'image/*', '上传照片')">选择图片上传</button>
          <img v-if="form.url" :src="form.url" alt="" class="admin-row__thumb" style="width: 120px; height: 76px; margin-top: 8px" />
        </div>
      </template>

      <template v-else-if="formType === 'link'">
        <div class="field"><label>名称</label><input v-model="form.name" class="input" /></div>
        <div class="field"><label>链接</label><input v-model="form.url" class="input" /></div>
        <div class="field"><label>Logo URL</label><input v-model="form.logo" class="input" /></div>
        <div class="field">
          <label>上传 Logo</label>
          <button class="btn btn--sm" @click="openUpload('form.logo', 'image/*', '上传友链 Logo')">选择图片上传</button>
          <img v-if="form.logo" :src="form.logo" alt="" class="admin-row__thumb" style="width: 52px; height: 52px; border-radius: 10px; margin-top: 8px" />
        </div>
        <div class="field"><label>简介</label><input v-model="form.description" class="input" /></div>
      </template>

      <template v-else-if="formType === 'music'">
        <div class="field"><label>曲名</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>艺术家</label><input v-model="form.artist" class="input" /></div>
        <div class="field">
          <label>音频地址</label>
          <input v-model="form.url" class="input" placeholder="/music/track-01.wav 或 /uploads/xxx.mp3" />
          <button class="btn btn--sm" style="margin-top: 8px" @click="openUpload('form.url', 'audio/*', '上传歌曲', '支持 mp3 / wav / ogg / m4a / flac 等格式')">上传歌曲文件</button>
          <div v-if="form.url" class="muted" style="font-size: 0.78rem; margin-top: 6px">当前音频：{{ form.url }}</div>
        </div>
        <div class="field">
          <label>歌词文件地址（LRC）</label>
          <input v-model="form.lrc" class="input" placeholder="/music/track-01.lrc 或 /uploads/xxx.lrc" />
          <button class="btn btn--sm" style="margin-top: 8px" @click="openUpload('form.lrc', '.lrc,.txt,text/plain', '上传歌词文件', '上传 .lrc 标准歌词文件，播放时会自动滚动高亮')">上传 LRC 歌词</button>
        </div>
        <div class="field">
          <label>封面 URL</label>
          <input v-model="form.cover" class="input" />
          <button class="btn btn--sm" style="margin-top: 8px" @click="openUpload('form.cover', 'image/*', '上传歌曲封面')">上传封面图</button>
          <img v-if="form.cover" :src="form.cover" alt="" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover; margin-top: 8px" />
        </div>
        <div class="field"><label>排序</label><input v-model.number="form.sort" type="number" class="input" /></div>
      </template>

      <template v-else-if="formType === 'collection'">
        <div class="field"><label>名称</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>简介</label><textarea v-model="form.description" class="textarea" style="min-height: 80px" /></div>
        <div class="field"><label>封面 URL</label><input v-model="form.cover" class="input" /></div>
        <div class="field">
          <label>上传封面</label>
          <button class="btn btn--sm" @click="openUpload('form.cover', 'image/*', '上传合集封面')">选择图片上传</button>
          <img v-if="form.cover" :src="form.cover" alt="" class="admin-row__thumb" style="width: 120px; height: 76px; margin-top: 8px" />
        </div>
      </template>

      <p v-if="formError" style="color: #ef4444; font-size: 0.86rem">{{ formError }}</p>
      <div style="display: flex; gap: 8px">
        <button class="btn btn--primary" @click="saveForm">保存</button>
        <button class="btn" @click="closeForm">取消</button>
      </div>
    </div>

    <UploadModal
      :open="uploadOpen"
      :accept="uploadAccept"
      :title="uploadTitle"
      :hint="uploadHint"
      @close="uploadOpen = false"
      @use="onUploadUse"
    />

    <Transition name="fade">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>
