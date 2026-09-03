<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'
import api from '../api.js'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const query = ref('')
const suggestions = ref([])
const showSuggestions = ref(false)
const suggestionLoading = ref(false)
let searchTimer = null

const links = [
  { to: '/', key: 'home' },
  { to: '/projects', key: 'projects' },
  { to: '/archive', key: 'archive' },
  { to: '/photos', key: 'photos' },
  { to: '/music', key: 'music' },
  { to: '/blog', key: 'blog' },
  { to: '/links', key: 'links' },
  { to: '/about', key: 'about' }
]

function isActive(link) {
  if (link.to === '/') return route.path === '/'
  return route.path.startsWith(link.to)
}

function onSearch() {
  const q = query.value.trim()
  showSuggestions.value = false
  router.push(q ? { path: '/search', query: { q } } : '/search')
}

function onInput() {
  clearTimeout(searchTimer)
  const kw = query.value.trim()
  if (!kw) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  suggestionLoading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(kw)}`)
      const list = []
      for (const p of res.posts.slice(0, 3)) list.push({ type: '文章', title: p.title, url: `/blog/${p.id}` })
      for (const p of res.projects.slice(0, 2)) list.push({ type: '项目', title: p.title, url: `/projects/${p.id}` })
      for (const m of res.music.slice(0, 3)) list.push({ type: '音乐', title: `${m.title} - ${m.artist || '未知'}`, url: '/music' })
      for (const l of res.links.slice(0, 2)) list.push({ type: '友链', title: l.name, url: l.url })
      suggestions.value = list.slice(0, 6)
      showSuggestions.value = true
    } catch {
      suggestions.value = []
    } finally {
      suggestionLoading.value = false
    }
  }, 250)
}

function pickSuggestion(s) {
  query.value = ''
  suggestions.value = []
  showSuggestions.value = false
  if (s.url.startsWith('http')) {
    window.open(s.url, '_blank')
  } else {
    router.push(s.url)
  }
}

function onBlur() {
  // 延迟关闭，让点击建议先触发
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

// 路由变化时同步搜索框
watch(
  () => route.query.q,
  (v) => {
    if (route.path === '/search') query.value = v || ''
  }
)

onMounted(() => {
  if (route.path === '/search' && route.query.q) query.value = route.query.q
})
</script>

<template>
  <header class="topnav glass">
    <RouterLink to="/" class="brand">
      <span class="brand__dot">星</span>
      <span class="brand__name">{{ store.settings.siteName || 'exhibition hall' }}</span>
    </RouterLink>

    <nav class="topnav__links">
      <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="topnav__link" :class="{ active: isActive(link) }">
        {{ store.t(link.key) }}
      </RouterLink>
    </nav>

    <div class="topnav__actions">
      <div class="search topnav-search">
        <AppIcon name="search" :size="16" />
        <input
          v-model="query"
          :placeholder="store.t('searchPlaceholder')"
          @keyup.enter="onSearch"
          @input="onInput"
          @focus="onInput"
          @blur="onBlur"
        />
        <!-- 搜索建议下拉 -->
        <div v-if="showSuggestions && (suggestions.length || suggestionLoading)" class="search-suggestions">
          <div v-if="suggestionLoading" class="search-suggestions__loading">搜索中…</div>
          <button
            v-for="(s, i) in suggestions"
            :key="i"
            class="search-suggestions__item"
            @mousedown.prevent="pickSuggestion(s)"
          >
            <span class="search-suggestions__type">{{ s.type }}</span>
            <span class="search-suggestions__title">{{ s.title }}</span>
          </button>
        </div>
      </div>
      <button class="icon-btn" :title="store.t('settingsTitle')" @click="store.settingsOpen = true">
        <AppIcon name="settings" :size="18" />
      </button>
      <RouterLink v-if="!store.isAdmin" class="icon-btn" title="后台登录" to="/admin/login">
        <AppIcon name="user" :size="18" />
      </RouterLink>
      <RouterLink v-else class="icon-btn" title="进入后台" to="/admin">
        <AppIcon name="list" :size="18" />
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.topnav-search {
  position: relative;
}
.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 6px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
  max-height: 320px;
  overflow-y: auto;
}
.search-suggestions__loading {
  padding: 12px 16px;
  font-size: 0.88rem;
  color: var(--muted);
}
.search-suggestions__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.search-suggestions__item:hover {
  background: var(--accent-soft);
}
.search-suggestions__type {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
}
.search-suggestions__title {
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
