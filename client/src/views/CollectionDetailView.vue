<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import Lightbox from '../components/Lightbox.vue'
import CommentSection from '../components/CommentSection.vue'

const route = useRoute()
const collection = ref(null)
const error = ref('')
const lightboxIndex = ref(-1)

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  try {
    collection.value = await api.get(`/collections/${route.params.id}`)
  } catch (e) {
    error.value = e.message
  }
})
</script>

<template>
  <div v-if="collection">
    <RouterLink to="/photos" class="btn btn--ghost btn--sm" style="margin-bottom: 16px">← 返回时光印染</RouterLink>

    <div class="card polaroid-hero">
      <div class="polaroid-hero__frame">
        <img :src="collection.cover || collection.photos[0]?.url || '/images/photo-01.svg'" :alt="collection.title" />
      </div>
      <div class="polaroid-hero__info">
        <h1>{{ collection.title }}</h1>
        <div class="polaroid__date">{{ formatDate(collection.created_at) }}</div>
        <p class="muted">{{ collection.description || '相册' }}</p>
        <span class="tag">{{ collection.photos.length }} 张照片</span>
      </div>
    </div>

    <div v-if="collection.photos.length" class="masonry" style="margin-top: 26px">
      <figure v-for="(photo, i) in collection.photos" :key="photo.id" class="photo-item" @click="lightboxIndex = i">
        <img :src="photo.url" :alt="photo.title" loading="lazy" />
        <figcaption class="photo-item__caption">{{ photo.title }}</figcaption>
      </figure>
    </div>
    <div v-else class="empty">这个相册还没有照片</div>

    <CommentSection :collection-id="collection.id" style="margin-top: 28px; display: block" />

    <Lightbox
      v-if="lightboxIndex >= 0"
      :items="collection.photos"
      :index="lightboxIndex"
      @close="lightboxIndex = -1"
      @update:index="lightboxIndex = $event"
    />
  </div>
  <div v-else-if="error" class="empty">{{ error }}</div>
  <div v-else class="empty">加载中…</div>
</template>
