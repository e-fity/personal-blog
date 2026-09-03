<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'
import Lightbox from '../components/Lightbox.vue'
import { useAppStore } from '../stores/app.js'

const router = useRouter()
const store = useAppStore()
const photos = ref([])
const years = ref([])
const albums = ref([])
const year = ref('全部')
const album = ref('全部')
const collections = ref([])
const lightboxIndex = ref(-1)
const viewMode = ref('collection') // 'collection' = 印染集, 'photo' = 点染

// 预设分类标签，合并后端返回的
const presetTags = ['日常', '美食', '旅途', '游戏', '风景', '人物', '其他']
const allTags = computed(() => {
  const set = new Set([...presetTags, ...albums.value])
  return Array.from(set)
})

// 拍立得相册卡片：错落旋转 + 偏移，制造堆叠层次感
const polaroids = computed(() =>
  collections.value.map((c) => ({
    ...c,
    rot: Math.round((Math.random() - 0.5) * 16),
    dx: Math.round((Math.random() - 0.5) * 14),
    dy: Math.round((Math.random() - 0.5) * 12),
    cover: c.cover || c.first_photo || '/images/photo-01.svg'
  }))
)

// 按年份筛选合集
const filteredCollections = computed(() => {
  if (year.value === '全部') return polaroids.value
  return polaroids.value.filter((c) => new Date(c.created_at).getFullYear() === Number(year.value))
})

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function load() {
  const query = new URLSearchParams()
  query.set('collection', 'none')
  if (year.value !== '全部') query.set('year', year.value)
  if (album.value !== '全部') query.set('album', album.value)
  try {
    photos.value = await api.get(`/photos?${query.toString()}`)
  } catch {
    photos.value = []
  }
}

function openCollection(id) {
  router.push(`/collections/${id}`)
}

function switchView(mode) {
  viewMode.value = mode
}

onMounted(async () => {
  try {
    const [filters, cols] = await Promise.all([api.get('/photos/filters'), api.get('/collections')])
    years.value = filters.years
    albums.value = filters.albums
    collections.value = cols
    await load()
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <div>
    <div class="section-title">
      <span>时光印染</span>
      <span class="muted" style="font-size: 0.88rem">
        {{ collections.length }} 个印染集 · {{ photos.length }} 张点染
      </span>
    </div>

    <!-- 视图切换：印染集 / 点染 -->
    <div class="view-toggle">
      <button :class="{ active: viewMode === 'collection' }" @click="switchView('collection')">
        <span class="view-toggle__icon">📚</span> 印染集
      </button>
      <button :class="{ active: viewMode === 'photo' }" @click="switchView('photo')">
        <span class="view-toggle__icon">🖼️</span> 点染
      </button>
    </div>

    <!-- 筛选栏：年份 + 分类标签 -->
    <div class="filter-section">
      <div class="filter-row">
        <span class="filter-row__label">年份</span>
        <div class="filter-bar">
          <button class="filter-chip" :class="{ active: year === '全部' }" @click="year = '全部'; load()">全部</button>
          <button v-for="y in years" :key="y" class="filter-chip" :class="{ active: year === String(y) }" @click="year = String(y); load()">{{ y }}</button>
        </div>
      </div>
      <div v-if="viewMode === 'photo'" class="filter-row">
        <span class="filter-row__label">分类</span>
        <div class="filter-bar">
          <button class="filter-chip" :class="{ active: album === '全部' }" @click="album = '全部'; load()">全部</button>
          <button v-for="a in allTags" :key="a" class="filter-chip" :class="{ active: album === a }" @click="album = a; load()">{{ a }}</button>
        </div>
      </div>
    </div>

    <!-- 印染集：拍立得相册卡片 -->
    <div v-if="viewMode === 'collection'">
      <div v-if="filteredCollections.length" class="polaroid-deck">
        <div
          v-for="c in filteredCollections"
          :key="c.id"
          class="polaroid"
          :style="{ '--rot': `${c.rot}deg`, '--dx': `${c.dx}px`, '--dy': `${c.dy}px` }"
          @click="openCollection(c.id)"
        >
          <img :src="c.cover" :alt="c.title" loading="lazy" />
          <div class="polaroid__info">
            <div class="polaroid__title">{{ c.title }}</div>
            <div class="polaroid__date">{{ formatDate(c.created_at) }}</div>
            <div class="polaroid__desc">{{ c.description || '印染集' }}</div>
          </div>
        </div>
      </div>
      <div v-else class="empty" style="padding: 26px">该年份暂无印染集，去后台「合集」创建一个吧</div>
    </div>

    <!-- 点染：单独照片瀑布流 -->
    <div v-else>
      <div class="masonry">
        <figure v-for="(photo, i) in photos" :key="photo.id" class="photo-item" @click="lightboxIndex = i">
          <img :src="photo.url" :alt="photo.title" loading="lazy" />
          <figcaption class="photo-item__caption">{{ photo.title }}</figcaption>
        </figure>
      </div>
      <div v-if="!photos.length" class="empty">暂无点染照片</div>
    </div>

    <Lightbox
      v-if="lightboxIndex >= 0"
      :items="photos"
      :index="lightboxIndex"
      @close="lightboxIndex = -1"
      @update:index="lightboxIndex = $event"
    />
  </div>
</template>

<style scoped>
.view-toggle {
  display: flex;
  gap: 0;
  margin: -6px 0 20px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
  width: fit-content;
}
.view-toggle button {
  padding: 10px 28px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.95rem;
  border-radius: 9px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.view-toggle button:hover {
  color: var(--text);
}
.view-toggle button.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.view-toggle__icon {
  font-size: 1.1rem;
}
.filter-section {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.filter-row__label {
  font-size: 0.88rem;
  color: var(--muted);
  min-width: 40px;
  flex: none;
  font-weight: 500;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-chip {
  padding: 6px 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.filter-chip:hover {
  color: var(--text);
  border-color: var(--accent);
}
.filter-chip.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.polaroid-deck {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  justify-content: center;
  padding: 20px 0 30px;
}
.polaroid {
  width: 240px;
  background: #fff;
  padding: 14px 14px 18px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  transform: rotate(var(--rot)) translate(var(--dx), var(--dy));
}
.polaroid:hover {
  transform: rotate(0deg) translate(0, -6px) scale(1.03);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  z-index: 10;
}
.polaroid img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  display: block;
}
.polaroid__info {
  padding-top: 12px;
  text-align: center;
}
.polaroid__title {
  font-weight: 700;
  font-size: 1rem;
  color: #333;
}
.polaroid__date {
  font-size: 0.78rem;
  color: #999;
  margin-top: 4px;
}
.polaroid__desc {
  font-size: 0.82rem;
  color: #666;
  margin-top: 6px;
}
.masonry {
  column-count: 4;
  column-gap: 16px;
}
.photo-item {
  break-inside: avoid;
  margin: 0 0 16px;
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
}
.photo-item img {
  width: 100%;
  display: block;
  transition: transform 0.3s ease;
}
.photo-item:hover img {
  transform: scale(1.03);
}
.photo-item__caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 12px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  color: #fff;
  font-size: 0.82rem;
  opacity: 0;
  transition: opacity 0.2s;
}
.photo-item:hover .photo-item__caption {
  opacity: 1;
}
@media (max-width: 900px) {
  .masonry { column-count: 3; }
}
@media (max-width: 600px) {
  .masonry { column-count: 2; }
  .view-toggle button { padding: 8px 18px; font-size: 0.88rem; }
}
</style>
