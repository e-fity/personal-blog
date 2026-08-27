<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'
import Lightbox from '../components/Lightbox.vue'

const router = useRouter()
const photos = ref([])
const years = ref([])
const albums = ref([])
const year = ref('全部')
const album = ref('全部')
const collections = ref([])
const lightboxIndex = ref(-1)

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

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

// 照片墙下方只展示「没有进入合集」的图片
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
        {{ collections.length }} 个相册 · {{ photos.length }} 张单独照片
      </span>
    </div>

    <!-- 拍立得相册卡片：点击进入相册详情 -->
    <div v-if="polaroids.length" class="polaroid-deck">
      <div
        v-for="c in polaroids"
        :key="c.id"
        class="polaroid"
        :style="{ '--rot': `${c.rot}deg`, '--dx': `${c.dx}px`, '--dy': `${c.dy}px` }"
        @click="openCollection(c.id)"
      >
        <img :src="c.cover" :alt="c.title" loading="lazy" />
        <div class="polaroid__info">
          <div class="polaroid__title">{{ c.title }}</div>
          <div class="polaroid__date">{{ formatDate(c.created_at) }}</div>
          <div class="polaroid__desc">{{ c.description || '相册' }}</div>
        </div>
      </div>
    </div>
    <div v-else class="empty" style="padding: 26px">还没有相册，去后台「合集」创建一个吧</div>

    <div class="filter-bar">
      <button class="filter-chip" :class="{ active: year === '全部' }" @click="year = '全部'; load()">全部年份</button>
      <button v-for="y in years" :key="y" class="filter-chip" :class="{ active: year === String(y) }" @click="year = String(y); load()">{{ y }}</button>
    </div>
    <div class="filter-bar">
      <button class="filter-chip" :class="{ active: album === '全部' }" @click="album = '全部'; load()">全部分类</button>
      <button v-for="a in albums" :key="a" class="filter-chip" :class="{ active: album === a }" @click="album = a; load()">{{ a }}</button>
    </div>

    <h3 class="search-group-title" style="margin-top: 4px">单独照片</h3>
    <div class="masonry">
      <figure v-for="(photo, i) in photos" :key="photo.id" class="photo-item" @click="lightboxIndex = i">
        <img :src="photo.url" :alt="photo.title" loading="lazy" />
        <figcaption class="photo-item__caption">{{ photo.title }}</figcaption>
      </figure>
    </div>
    <div v-if="!photos.length" class="empty">暂无单独照片</div>

    <Lightbox
      v-if="lightboxIndex >= 0"
      :items="photos"
      :index="lightboxIndex"
      @close="lightboxIndex = -1"
      @update:index="lightboxIndex = $event"
    />
  </div>
</template>
