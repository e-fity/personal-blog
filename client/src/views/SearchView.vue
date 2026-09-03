<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import PostCard from '../components/PostCard.vue'
import ProjectCard from '../components/ProjectCard.vue'
import AppIcon from '../components/AppIcon.vue'
import { useMusicStore } from '../stores/music.js'

const route = useRoute()
const router = useRouter()
const musicStore = useMusicStore()
const q = ref(route.query.q || '')
const loading = ref(false)
const result = ref({ posts: [], projects: [], photos: [], links: [], music: [] })
const activeFilter = ref('all')

const filters = [
  { key: 'all', label: '全部' },
  { key: 'posts', label: '文章' },
  { key: 'projects', label: '项目' },
  { key: 'music', label: '音乐' },
  { key: 'photos', label: '照片' },
  { key: 'links', label: '友链' }
]

const total = computed(
  () => result.value.posts.length + result.value.projects.length + result.value.photos.length + result.value.links.length + result.value.music.length
)

const counts = computed(() => ({
  all: total.value,
  posts: result.value.posts.length,
  projects: result.value.projects.length,
  music: result.value.music.length,
  photos: result.value.photos.length,
  links: result.value.links.length
}))

function highlight(text, keyword) {
  if (!keyword || !text) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'gi')
  return String(text).replace(re, '<mark class="search-highlight">$1</mark>')
}

async function run() {
  const keyword = q.value.trim()
  loading.value = true
  try {
    result.value = keyword
      ? await api.get(`/search?q=${encodeURIComponent(keyword)}`)
      : { posts: [], projects: [], photos: [], links: [], music: [] }
  } catch {
    result.value = { posts: [], projects: [], photos: [], links: [], music: [] }
  } finally {
    loading.value = false
  }
}

function playMusic(track) {
  const idx = musicStore.tracks.findIndex((t) => t.id === track.id)
  if (idx >= 0) {
    musicStore.playTrack(idx)
    if (!musicStore.isPlaying) musicStore.togglePlay()
  }
  router.push('/music')
}

watch(
  () => route.query.q,
  (value) => {
    q.value = value || ''
    activeFilter.value = 'all'
    run()
  }
)

onMounted(run)
</script>

<template>
  <div>
    <div class="section-title">
      <span>搜索{{ q ? `「${q}」` : '' }}</span>
      <span class="muted" style="font-size: 0.9rem">{{ loading ? '搜索中…' : `找到 ${total} 条结果` }}</span>
    </div>

    <template v-if="q">
      <!-- 分类筛选 -->
      <div class="search-filters">
        <button
          v-for="f in filters"
          :key="f.key"
          class="search-filter"
          :class="{ active: activeFilter === f.key }"
          @click="activeFilter = f.key"
        >
          {{ f.label }}
          <span class="search-filter__count">{{ counts[f.key] }}</span>
        </button>
      </div>

      <section v-if="(activeFilter === 'all' || activeFilter === 'posts') && result.posts.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">文章 ({{ result.posts.length }})</h3>
        <div class="grid grid--posts">
          <PostCard v-for="post in result.posts" :key="post.id" :post="post" />
        </div>
      </section>

      <section v-if="(activeFilter === 'all' || activeFilter === 'projects') && result.projects.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">项目 ({{ result.projects.length }})</h3>
        <div class="grid grid--projects">
          <ProjectCard v-for="project in result.projects" :key="project.id" :project="project" />
        </div>
      </section>

      <section v-if="(activeFilter === 'all' || activeFilter === 'music') && result.music.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">音乐 ({{ result.music.length }})</h3>
        <div class="search-music-list">
          <div v-for="track in result.music" :key="track.id" class="search-music-item glass" @click="playMusic(track)">
            <img class="search-music-item__cover" :src="track.cover || '/images/music-01.svg'" alt="" />
            <div class="search-music-item__info">
              <strong v-html="highlight(track.title, q)"></strong>
              <span v-html="highlight(track.artist || '未知艺术家', q)"></span>
            </div>
            <span class="search-music-item__play">
              <AppIcon name="play" :size="18" />
            </span>
          </div>
        </div>
      </section>

      <section v-if="(activeFilter === 'all' || activeFilter === 'photos') && result.photos.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">照片 ({{ result.photos.length }})</h3>
        <div class="masonry" style="columns: 4">
          <RouterLink v-for="photo in result.photos" :key="photo.id" to="/photos" class="photo-item">
            <img :src="photo.url" :alt="photo.title" loading="lazy" />
            <figcaption class="photo-item__caption" v-html="highlight(photo.title, q)"></figcaption>
          </RouterLink>
        </div>
      </section>

      <section v-if="(activeFilter === 'all' || activeFilter === 'links') && result.links.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">友链 ({{ result.links.length }})</h3>
        <div class="grid grid--links">
          <a v-for="link in result.links" :key="link.id" class="card glass" style="padding: 16px 18px; color: inherit" :href="link.url" target="_blank" rel="noopener">
            <strong v-html="highlight(link.name, q)"></strong>
            <div class="muted" style="font-size: 0.84rem" v-html="highlight(link.description, q)"></div>
          </a>
        </div>
      </section>

      <div v-if="!loading && !total" class="empty">没有找到「{{ q }}」相关内容，换个关键词试试</div>
    </template>
    <div v-else class="empty">在顶部搜索框输入关键词，搜索文章、项目、音乐、照片与友链</div>
  </div>
</template>

<style scoped>
.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
.search-filter {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.search-filter:hover {
  border-color: var(--accent);
}
.search-filter.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.search-filter__count {
  font-size: 0.75rem;
  opacity: 0.7;
  background: rgba(0, 0, 0, 0.12);
  padding: 1px 7px;
  border-radius: 10px;
}
.search-filter.active .search-filter__count {
  background: rgba(255, 255, 255, 0.25);
}
.search-music-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.search-music-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.search-music-item:hover {
  transform: translateX(4px);
}
.search-music-item__cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
}
.search-music-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.search-music-item__info strong {
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search-music-item__info span {
  font-size: 0.82rem;
  color: var(--muted);
}
.search-music-item__play {
  color: var(--accent);
  display: flex;
}
:deep(.search-highlight) {
  background: var(--accent-soft);
  color: var(--accent);
  padding: 0 2px;
  border-radius: 3px;
  font-weight: 600;
}
</style>
