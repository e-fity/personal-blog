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
const messageFilter = ref('all') // all | guestbook | link_apply
const comments = ref([])
const links = ref([])
const music = ref([])
const playlists = ref([])
const collections = ref([])
const essays = ref([])

const stats = computed(() => ({
  posts: posts.value.length,
  essays: essays.value.length,
  projects: projects.value.length,
  photos: photos.value.length,
  messages: messages.value.length,
  comments: comments.value.length,
  links: links.value.length,
  music: music.value.length,
  playlists: playlists.value.length
}))

const ENDPOINT = { post: 'posts', essay: 'essays', project: 'projects', photo: 'photos', link: 'links', music: 'music', collection: 'collections', playlist: 'playlists' }

const filteredMessages = computed(() => {
  if (messageFilter.value === 'all') return messages.value
  return messages.value.filter((m) => m.type === messageFilter.value)
})
const linkApplyCount = computed(() => messages.value.filter((m) => m.type === 'link_apply' && m.status === 'pending').length)
const EMPTY = {
  post: { title: '', cover: '', tags: '', content: '', published: true, featured: false, publish_at: '' },
  essay: { title: '', cover: '', tags: '', content: '' },
  project: { title: '', description: '', cover: '', tags: '', category: '工具', githubUrl: '', demoUrl: '', content_framework: '', featured: false },
  photo: { url: '', title: '', album: '日常', year: new Date().getFullYear(), collection_id: null },
  link: { name: '', url: '', logo: '', description: '' },
  music: { title: '', artist: '', url: '', lrc: '', cover: '', sort: 0, playlist_id: null },
  collection: { title: '', description: '', cover: '' },
  playlist: { title: '', description: '', cover: '', source: '' }
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
const selectedPhotos = ref([])
const bulkCollection = ref(null)
const collectionPhotos = ref([])

// 歌单导入
const importOpen = ref(false)
const importTab = ref('file') // 'file' | 'url'
const importFileName = ref('')
const importUrl = ref('')
const importPlaylistTitle = ref('')
const importTargetPlaylist = ref(null)
const importMode = ref('append')
const importLoading = ref(false)
const importResult = ref(null)
const importDownload = ref(false)
let importFileEl = null

const postTitle = (id) => posts.value.find((p) => p.id === id)?.title || `文章 #${id}`
const playlistTitle = (id) => playlists.value.find((p) => p.id === id)?.title || '未分组'

function toast(text) {
  toastMsg.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2200)
}

function splitTags(text) {
  return String(text).split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean)
}

async function loadAll() {
  const [p, es, pr, ph, m, c, l, mu, cols, pls] = await Promise.all([
    api.get('/posts?all=1&limit=100'),
    api.get('/essays?limit=100').catch(() => []),
    api.get('/projects'),
    api.get('/photos'),
    api.get('/messages'),
    api.get('/comments?post_id=0').catch(() => []),
    api.get('/links'),
    api.get('/music'),
    api.get('/collections'),
    api.get('/playlists').catch(() => [])
  ])
  posts.value = p
  essays.value = es
  projects.value = pr
  photos.value = ph
  messages.value = m
  links.value = l
  music.value = mu
  collections.value = cols
  playlists.value = pls
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
  if (type === 'post') {
    Object.assign(form, {
      title: item.title,
      cover: item.cover,
      tags: (item.tags || []).join(', '),
      content: item.content || '',
      published: !!item.published,
      featured: !!item.featured,
      publish_at: item.publish_at ? item.publish_at.slice(0, 16) : ''
    })
    api
      .get(`/posts/${item.id}?admin=1`)
      .then((full) => {
        if (formType.value === 'post' && editingId.value === item.id) form.content = full.content || ''
      })
      .catch(() => {})
  }
  if (type === 'essay') {
    Object.assign(form, {
      title: item.title,
      cover: item.cover,
      tags: (item.tags || []).join(', '),
      content: item.content || ''
    })
    api
      .get(`/essays/${item.id}`)
      .then((full) => {
        if (formType.value === 'essay' && editingId.value === item.id) form.content = full.content || ''
      })
      .catch(() => {})
  }
  if (type === 'project') Object.assign(form, { title: item.title, description: item.description, cover: item.cover, tags: (item.tags || []).join(', '), category: item.category, githubUrl: item.github_url, demoUrl: item.demo_url, content_framework: item.content_framework || '', featured: !!item.featured })
  if (type === 'photo') Object.assign(form, { url: item.url, title: item.title, album: item.album, year: item.year, collection_id: item.collection_id ?? null })
  if (type === 'link') Object.assign(form, { name: item.name, url: item.url, logo: item.logo, description: item.description })
  if (type === 'music') Object.assign(form, { title: item.title, artist: item.artist, url: item.url, lrc: item.lrc, cover: item.cover, sort: item.sort, playlist_id: item.playlist_id ?? null })
  if (type === 'playlist') Object.assign(form, { title: item.title, description: item.description, cover: item.cover, source: item.source })
  if (type === 'collection') {
    Object.assign(form, { title: item.title, description: item.description, cover: item.cover })
    collectionPhotos.value = []
    api
      .get(`/collections/${item.id}`)
      .then((c) => (collectionPhotos.value = c.photos || []))
      .catch(() => {})
  }
  if (type !== 'collection') collectionPhotos.value = []
}

function closeForm() {
  formType.value = ''
  editingId.value = null
}

function buildPayload() {
  const type = formType.value
  if (type === 'post') return { title: form.title, cover: form.cover, tags: splitTags(form.tags), content: form.content, published: form.published, featured: form.featured, publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null }
  if (type === 'essay') return { title: form.title, cover: form.cover, tags: splitTags(form.tags), content: form.content }
  if (type === 'project') return { title: form.title, description: form.description, cover: form.cover, tags: splitTags(form.tags), category: form.category, githubUrl: form.githubUrl, demoUrl: form.demoUrl, content_framework: form.content_framework, featured: form.featured }
  if (type === 'photo') return { url: form.url, title: form.title, album: form.album, year: Number(form.year), collection_id: form.collection_id }
  if (type === 'link') return { name: form.name, url: form.url, logo: form.logo, description: form.description }
  if (type === 'music') return { title: form.title, artist: form.artist, url: form.url, lrc: form.lrc, cover: form.cover, sort: Number(form.sort) || 0, playlist_id: form.playlist_id ? Number(form.playlist_id) : null }
  if (type === 'playlist') return { title: form.title, description: form.description, cover: form.cover, source: form.source }
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

function togglePhoto(id) {
  selectedPhotos.value = selectedPhotos.value.includes(id)
    ? selectedPhotos.value.filter((x) => x !== id)
    : [...selectedPhotos.value, id]
}

async function applyBulkMove() {
  if (!selectedPhotos.value.length) return
  for (const id of selectedPhotos.value) {
    await api.put(`/photos/${id}`, { collection_id: bulkCollection.value })
  }
  selectedPhotos.value = []
  bulkCollection.value = null
  toast('已批量更新')
  await loadAll()
}

function onExif(info) {
  if (formType.value === 'photo' && info?.year) {
    form.year = info.year
  }
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

async function updateMessageStatus(id, status) {
  await api.post(`/messages/${id}/status`, { status })
  toast(status === 'approved' ? '已通过' : status === 'rejected' ? '已拒绝' : '已重置为待审核')
  await loadAll()
}

async function removeComment(id) {
  if (!window.confirm('确认删除这条评论？')) return
  await api.del(`/comments/${id}`)
  toast('已删除')
  await loadComments()
}

// ---------- 歌单导入 ----------

function openImport() {
  importOpen.value = true
  importTab.value = 'file'
  importFileName.value = ''
  importUrl.value = ''
  importPlaylistTitle.value = ''
  importTargetPlaylist.value = null
  importMode.value = 'append'
  importResult.value = null
  importLoading.value = false
}

function onImportFileChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    importFileName.value = file.name
    importFileEl = file
  }
}

async function doImport() {
  if (!importFileEl) {
    toast('请先选择歌单文件')
    return
  }
  importLoading.value = true
  importResult.value = null
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(importFileEl)
    })
    const result = await api.post('/music/import', {
      filename: importFileEl.name,
      data: dataUrl,
      playlist_title: importPlaylistTitle.value || '',
      playlist_id: importTargetPlaylist.value ? Number(importTargetPlaylist.value) : null,
      mode: importMode.value,
      download: importDownload.value
    })
    importResult.value = result
    toast(`导入成功：${result.imported} 首`)
    await loadAll()
  } catch (e) {
    toast(e.message || '导入失败')
  } finally {
    importLoading.value = false
  }
}

async function doImportUrl() {
  const url = importUrl.value.trim()
  if (!url) {
    toast('请粘贴歌单链接')
    return
  }
  importLoading.value = true
  importResult.value = null
  try {
    const result = await api.post('/music/import-url', {
      url,
      playlist_title: importPlaylistTitle.value || '',
      playlist_id: importTargetPlaylist.value ? Number(importTargetPlaylist.value) : null,
      mode: importMode.value
    })
    importResult.value = result
    toast(`导入成功：${result.imported} 首`)
    await loadAll()
  } catch (e) {
    toast(e.message || '导入失败')
  } finally {
    importLoading.value = false
  }
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
      <button v-for="tab in ['overview','post','essay','project','photo','message','comment','link','music','settings']" :key="tab" class="admin-tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">
        {{ { overview: '概览', post: '归档', essay: '杂谈', project: '项目', photo: '图片', message: '留言', comment: '评论', link: '友链', music: '音乐', settings: '设置' }[tab] }}
      </button>
    </div>

    <!-- 概览 -->
    <div v-if="activeTab === 'overview'" class="stat-grid">
      <div v-for="(value, key) in stats" :key="key" class="card stat-card">
        <strong>{{ value }}</strong>
        <span>{{ { posts: '归档', essays: '杂谈', projects: '项目', photos: '图片', messages: '留言', comments: '评论', links: '友链', music: '音乐', playlists: '歌单' }[key] }}</span>
      </div>
    </div>

    <!-- 归档 -->
    <div v-if="activeTab === 'post'">
      <button class="btn btn--primary btn--sm" @click="openForm('post')"><AppIcon name="plus" :size="15" /> 新增归档</button>
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

    <!-- 杂谈 -->
    <div v-if="activeTab === 'essay'">
      <button class="btn btn--primary btn--sm" @click="openForm('essay')"><AppIcon name="plus" :size="15" /> 新增杂谈</button>
      <div class="admin-list" style="margin-top: 16px">
        <div v-for="item in essays" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.cover || '/images/post-cover-01.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ new Date(item.created_at).toLocaleDateString('zh-CN') }} · {{ (item.tags || []).join(', ') || '无标签' }}</div>
          </div>
          <div class="admin-row__actions">
            <button class="btn btn--sm" @click="openForm('essay', item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="removeItem('essay', item.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!essays.length" class="empty">暂无杂谈</div>
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

    <!-- 图片（照片 + 合集） -->
    <div v-if="activeTab === 'photo'">
      <div style="display: flex; gap: 8px; margin-bottom: 14px">
        <button class="btn btn--primary btn--sm" @click="openForm('photo')"><AppIcon name="plus" :size="15" /> 上传照片</button>
        <button class="btn btn--sm" @click="openForm('collection')"><AppIcon name="plus" :size="15" /> 新建合集</button>
      </div>
      <div v-if="selectedPhotos.length" class="bulk-bar">
        <span>已选 {{ selectedPhotos.length }} 张</span>
        <select v-model="bulkCollection" class="select" style="width: auto">
          <option :value="null">移出合集（单独显示）</option>
          <option v-for="c in collections" :key="c.id" :value="c.id">移入：{{ c.title }}</option>
        </select>
        <button class="btn btn--sm btn--primary" @click="applyBulkMove">应用</button>
        <button class="btn btn--sm" @click="selectedPhotos = []">清空</button>
      </div>

      <!-- 合集列表 -->
      <div v-if="collections.length" style="margin-bottom: 20px">
        <h4 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--muted)">合集（{{ collections.length }}）</h4>
        <div class="admin-list">
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

      <!-- 照片列表 -->
      <h4 style="margin: 0 0 10px; font-size: 0.9rem; color: var(--muted)">照片（{{ photos.length }}）</h4>
      <div class="admin-list">
        <div v-for="item in photos" :key="item.id" class="admin-row">
          <input type="checkbox" :checked="selectedPhotos.includes(item.id)" @change="togglePhoto(item.id)" />
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

    <!-- 留言 -->
    <div v-if="activeTab === 'message'">
      <div class="msg-filter">
        <button :class="{ active: messageFilter === 'all' }" @click="messageFilter = 'all'">全部 ({{ messages.length }})</button>
        <button :class="{ active: messageFilter === 'guestbook' }" @click="messageFilter = 'guestbook'">普通留言</button>
        <button :class="{ active: messageFilter === 'link_apply' }" @click="messageFilter = 'link_apply'">
          友链申请
          <span v-if="linkApplyCount" class="msg-filter__badge">{{ linkApplyCount }}</span>
        </button>
      </div>
      <div class="admin-list" style="margin-top: 14px">
        <div v-for="item in filteredMessages" :key="item.id" class="card" style="padding: 16px 18px">
          <div class="post-card__meta" style="margin-bottom: 6px">
            <strong>{{ item.nickname }}</strong>
            <span>{{ new Date(item.created_at).toLocaleString('zh-CN') }}</span>
            <span v-if="item.type === 'link_apply'" class="tag tag--frontend">友链申请</span>
          </div>
          <!-- 友链申请信息 -->
          <div v-if="item.type === 'link_apply'" class="msg-linkinfo">
            <div class="msg-linkinfo__row">
              <span class="msg-linkinfo__label">站点</span>
              <strong>{{ item.link_name }}</strong>
            </div>
            <div class="msg-linkinfo__row">
              <span class="msg-linkinfo__label">链接</span>
              <a :href="item.link_url" target="_blank" rel="noopener" class="msg-linkinfo__url">{{ item.link_url }}</a>
            </div>
            <div class="msg-linkinfo__row">
              <span class="msg-linkinfo__label">状态</span>
              <span :class="['msg-status', `msg-status--${item.status}`]">
                {{ { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[item.status] || item.status }}
              </span>
            </div>
          </div>
          <p style="margin: 0 0 6px">{{ item.content }}</p>
          <div v-if="item.reply" style="padding: 10px 12px; background: var(--accent-soft); border-radius: 8px; font-size: 0.9rem"><strong style="color: var(--accent)">回复：</strong>{{ item.reply }}</div>
          <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap">
            <button class="btn btn--sm" @click="replyTarget = item.id; replyText = item.reply">回复</button>
            <template v-if="item.type === 'link_apply'">
              <button v-if="item.status !== 'approved'" class="btn btn--sm btn--primary" @click="updateMessageStatus(item.id, 'approved')">通过</button>
              <button v-if="item.status !== 'rejected'" class="btn btn--sm btn--danger" @click="updateMessageStatus(item.id, 'rejected')">拒绝</button>
              <button v-if="item.status !== 'pending'" class="btn btn--sm" @click="updateMessageStatus(item.id, 'pending')">重置</button>
            </template>
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
      <div v-if="!filteredMessages.length" class="empty">暂无留言</div>
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
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px">
        <button class="btn btn--primary btn--sm" @click="openForm('music')"><AppIcon name="plus" :size="15" /> 新增曲目</button>
        <button class="btn btn--sm" @click="openForm('playlist')"><AppIcon name="plus" :size="15" /> 新建歌单</button>
        <button class="btn btn--sm" @click="openImport"><AppIcon name="upload" :size="15" /> 导入歌单</button>
      </div>

      <!-- 歌单列表 -->
      <div v-if="playlists.length" style="margin-bottom: 24px">
        <h4 style="margin: 0 0 10px; font-size: 0.95rem; color: var(--muted)">歌单（{{ playlists.length }}）</h4>
        <div class="admin-list">
          <div v-for="pl in playlists" :key="pl.id" class="admin-row">
            <img class="admin-row__thumb" :src="pl.cover || '/images/music-01.svg'" alt="" />
            <div class="admin-row__main">
              <div class="admin-row__title">{{ pl.title }}</div>
              <div class="admin-row__sub">{{ pl.track_count }} 首 · {{ pl.source || '手动创建' }}</div>
            </div>
            <div class="admin-row__actions">
              <button class="btn btn--sm" @click="openForm('playlist', pl)">编辑</button>
              <button class="btn btn--sm btn--danger" @click="removeItem('playlist', pl.id)">删除</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 曲目列表 -->
      <h4 style="margin: 0 0 10px; font-size: 0.95rem; color: var(--muted)">曲目（{{ music.length }}）</h4>
      <div class="admin-list">
        <div v-for="item in music" :key="item.id" class="admin-row">
          <img class="admin-row__thumb" :src="item.cover || '/images/music-01.svg'" alt="" />
          <div class="admin-row__main">
            <div class="admin-row__title">{{ item.title }}</div>
            <div class="admin-row__sub">{{ item.artist }} · {{ playlistTitle(item.playlist_id) }}</div>
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
    <div v-if="formType && (formType === activeTab || (activeTab === 'music' && formType === 'playlist') || (activeTab === 'photo' && formType === 'collection'))" class="card admin-panel">
      <h3>{{ editingId ? '编辑' : '新增' }} {{ { post: '文章', project: '项目', photo: '照片', link: '友链', music: '曲目', collection: '合集', playlist: '歌单' }[formType] }}</h3>

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
        <div class="field"><label>定时发布（可选，留空立即发布）</label><input v-model="form.publish_at" type="datetime-local" class="input" /></div>
      </template>

      <template v-else-if="formType === 'essay'">
        <div class="field"><label>标题</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>标签（逗号分隔）</label><input v-model="form.tags" class="input" placeholder="随笔, 生活" /></div>
        <div class="field"><label>封面图 URL</label><input v-model="form.cover" class="input" /></div>
        <div class="field">
          <label>上传封面</label>
          <button class="btn btn--sm" @click="openUpload('form.cover', 'image/*', '上传封面图')">选择图片上传</button>
          <img v-if="form.cover" :src="form.cover" alt="" class="admin-row__thumb" style="width: 120px; height: 76px; margin-top: 8px" />
        </div>
        <div class="field"><label>正文（Markdown）</label><textarea v-model="form.content" class="textarea" style="min-height: 260px" /></div>
      </template>

      <template v-else-if="formType === 'project'">
        <div class="field"><label>标题</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>简介</label><textarea v-model="form.description" class="textarea" style="min-height: 80px" /></div>
        <div class="field"><label>技术栈（逗号分隔）</label><input v-model="form.tags" class="input" placeholder="Vue3, Express, SQLite" /></div>
        <div class="field"><label>分类</label><select v-model="form.category" class="select"><option>前端</option><option>后端</option><option>数据库</option><option>工具</option><option>其他</option></select></div>
        <div class="field"><label>封面图 URL</label><input v-model="form.cover" class="input" /></div>
        <div class="field">
          <label>上传封面</label>
          <button class="btn btn--sm" @click="openUpload('form.cover', 'image/*', '上传项目封面')">选择图片上传</button>
          <img v-if="form.cover" :src="form.cover" alt="" class="admin-row__thumb" style="width: 120px; height: 76px; margin-top: 8px" />
        </div>
        <div class="field"><label>GitHub 地址</label><input v-model="form.githubUrl" class="input" /></div>
        <div class="field"><label>Demo 地址</label><input v-model="form.demoUrl" class="input" /></div>
        <div class="field">
          <label>内容框架（Markdown，用于项目解析、亮点、架构等）</label>
          <textarea v-model="form.content_framework" class="textarea" style="min-height: 200px" placeholder="## 项目亮点&#10;- 亮点1&#10;- 亮点2&#10;&#10;## 技术架构&#10;...&#10;&#10;## 难点与解决方案&#10;..." />
        </div>
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
          <label>所属歌单</label>
          <select v-model="form.playlist_id" class="select">
            <option :value="null">未分组</option>
            <option v-for="pl in playlists" :key="pl.id" :value="pl.id">{{ pl.title }}</option>
          </select>
        </div>
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

      <template v-else-if="formType === 'playlist'">
        <div class="field"><label>歌单名称</label><input v-model="form.title" class="input" /></div>
        <div class="field"><label>简介</label><textarea v-model="form.description" class="textarea" style="min-height: 60px" /></div>
        <div class="field"><label>来源（如：网易云 / QQ音乐 / 手动）</label><input v-model="form.source" class="input" /></div>
        <div class="field">
          <label>封面 URL</label>
          <input v-model="form.cover" class="input" />
          <button class="btn btn--sm" style="margin-top: 8px" @click="openUpload('form.cover', 'image/*', '上传歌单封面')">上传封面图</button>
          <img v-if="form.cover" :src="form.cover" alt="" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover; margin-top: 8px" />
        </div>
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
        <div v-if="collectionPhotos.length" class="field">
          <label>从相册里选封面（点击设为封面）</label>
          <div class="cover-picker">
            <img
              v-for="p in collectionPhotos"
              :key="p.id"
              :src="p.url"
              :alt="p.title"
              :class="{ active: form.cover === p.url }"
              @click="form.cover = p.url"
            />
          </div>
        </div>
      </template>

      <p v-if="formError" style="color: #ef4444; font-size: 0.86rem">{{ formError }}</p>
      <div style="display: flex; gap: 8px">
        <button class="btn btn--primary" @click="saveForm">保存</button>
        <button class="btn" @click="closeForm">取消</button>
      </div>
    </div>

    <!-- 歌单导入弹窗 -->
    <div v-if="importOpen" class="modal-overlay" @click.self="importOpen = false">
      <div class="modal card">
        <div class="modal__head">
          <h3>导入歌单</h3>
          <button class="icon-btn" @click="importOpen = false"><AppIcon name="close" :size="18" /></button>
        </div>
        <div class="modal__body">
          <!-- Tab 切换 -->
          <div class="import-tabs">
            <button :class="{ active: importTab === 'file' }" @click="importTab = 'file'">上传文件</button>
            <button :class="{ active: importTab === 'url' }" @click="importTab = 'url'">粘贴链接</button>
          </div>

          <!-- 文件导入 -->
          <div v-if="importTab === 'file'">
            <div class="field">
              <label>选择歌单文件</label>
              <input type="file" accept=".m3u,.m3u8,.pls,.xspf,.zip" @change="onImportFileChange" />
              <div v-if="importFileName" class="muted" style="font-size: 0.82rem; margin-top: 6px">已选：{{ importFileName }}</div>
              <div class="muted" style="font-size: 0.78rem; margin-top: 6px">
                支持 .m3u / .m3u8 / .pls / .xspf 歌单文件，或打包了歌单+音频的 .zip；也可勾选「下载直链音频」自动把歌单里的 http(s) 音频下载到本地。
              </div>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; margin: 8px 0 4px">
              <input type="checkbox" v-model="importDownload" /> 下载歌单中的直链音频到本地（仅 .m3u 等里的 http/https 直链）
            </label>
          </div>

          <!-- 链接导入 -->
          <div v-if="importTab === 'url'">
            <div class="field">
              <label>歌单链接</label>
              <input v-model="importUrl" class="input" placeholder="粘贴酷狗/网易云/QQ音乐歌单分享链接" />
              <div class="muted" style="font-size: 0.78rem; margin-top: 6px">
                支持酷狗音乐、网易云音乐、QQ音乐的歌单分享链接。链接导入会获取歌曲名和艺术家，音频地址需后续手动上传补充。
              </div>
            </div>
          </div>

          <div class="field">
            <label>新歌单名称（留空用默认）</label>
            <input v-model="importPlaylistTitle" class="input" placeholder="我的收藏" />
          </div>
          <div class="field">
            <label>导入到已有歌单（可选）</label>
            <select v-model="importTargetPlaylist" class="select">
              <option :value="null">— 创建新歌单 —</option>
              <option v-for="pl in playlists" :key="pl.id" :value="pl.id">{{ pl.title }}</option>
            </select>
          </div>
          <div v-if="importTargetPlaylist" class="field">
            <label>导入方式</label>
            <select v-model="importMode" class="select">
              <option value="append">追加（保留原有曲目）</option>
              <option value="replace">替换（清空后重新导入）</option>
            </select>
          </div>
          <div v-if="importResult" class="muted" style="font-size: 0.88rem; padding: 10px; background: var(--accent-soft); border-radius: 8px">
            导入完成：新增 {{ importResult.imported }} 首，跳过重复 {{ importResult.skipped }} 首
            <div v-if="importResult.note" style="margin-top: 4px; font-size: 0.8rem">{{ importResult.note }}</div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn" @click="importOpen = false">取消</button>
          <button class="btn btn--primary" :disabled="importLoading" @click="importTab === 'file' ? doImport() : doImportUrl()">
            {{ importLoading ? '导入中…' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>

    <UploadModal
      :open="uploadOpen"
      :accept="uploadAccept"
      :title="uploadTitle"
      :hint="uploadHint"
      @close="uploadOpen = false"
      @use="onUploadUse"
      @exif="onExif"
    />

    <Transition name="fade">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 0;
}
.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal__head h3 {
  margin: 0;
  font-size: 1.1rem;
}
.modal__body {
  padding: 16px 20px;
}
.modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
.import-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--border);
}
.import-tabs button {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.92rem;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.import-tabs button:hover {
  color: var(--text);
}
.import-tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.msg-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.msg-filter button {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.msg-filter button:hover {
  color: var(--text);
}
.msg-filter button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.msg-filter__badge {
  background: #ef4444;
  color: #fff;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.msg-linkinfo {
  background: var(--accent-soft);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}
.msg-linkinfo__row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 2px 0;
}
.msg-linkinfo__label {
  color: var(--muted);
  min-width: 36px;
  flex: none;
}
.msg-linkinfo__url {
  color: var(--accent);
  text-decoration: none;
  word-break: break-all;
}
.msg-linkinfo__url:hover {
  text-decoration: underline;
}
.msg-status {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
}
.msg-status--pending {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}
.msg-status--approved {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}
.msg-status--rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}
</style>
