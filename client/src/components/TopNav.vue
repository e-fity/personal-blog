<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const query = ref('')

const links = [
  { to: '/', label: '首页' },
  { to: '/projects', label: '项目' },
  { to: '/archive', label: '归档' },
  { to: '/photos', label: '照片墙' },
  { to: '/music', label: '音乐' },
  { to: '/blog', label: '杂谈' },
  { to: '/links', label: '友链' },
  { to: '/about', label: '关于' }
]

function isActive(link) {
  if (link.to === '/') return route.path === '/'
  return route.path.startsWith(link.to)
}

function onSearch() {
  const q = query.value.trim()
  router.push(q ? { path: '/search', query: { q } } : '/search')
}
</script>

<template>
  <header class="topnav glass">
    <RouterLink to="/" class="brand">
      <span class="brand__dot">星</span>
      <span class="brand__name">{{ store.settings.siteName || 'exhibition hall' }}</span>
    </RouterLink>

    <nav class="topnav__links">
      <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="topnav__link" :class="{ active: isActive(link) }">
        {{ link.label }}
      </RouterLink>
    </nav>

    <div class="topnav__actions">
      <div class="search">
        <AppIcon name="search" :size="16" />
        <input v-model="query" placeholder="搜索文章 / 项目 / 照片…" @keyup.enter="onSearch" />
      </div>
      <button class="icon-btn" title="个性化设置" @click="store.settingsOpen = true">
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
