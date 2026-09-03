<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import { tagClass } from '../tags.js'

const route = useRoute()
const essay = ref(null)
const error = ref('')

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  try {
    essay.value = await api.get(`/essays/${route.params.id}`)
  } catch (e) {
    error.value = e.message
  }
})
</script>

<template>
  <div v-if="essay" class="card" style="padding: 36px 40px">
    <RouterLink to="/blog" class="btn btn--ghost btn--sm" style="margin-bottom: 18px">← 返回杂谈</RouterLink>
    <h1 style="font-size: 1.9rem; margin: 0 0 14px">{{ essay.title }}</h1>
    <div class="post-card__meta" style="margin-bottom: 18px">
      <span>{{ formatDate(essay.created_at) }}</span>
      <span v-for="tag in essay.tags" :key="tag" :class="tagClass(tag)">{{ tag }}</span>
    </div>
    <img v-if="essay.cover" :src="essay.cover" :alt="essay.title" style="width: 100%; border-radius: 14px; margin-bottom: 24px" />
    <MarkdownRenderer :content="essay.content" />
  </div>
  <div v-else-if="error" class="empty">{{ error }}</div>
  <div v-else class="empty">加载中…</div>
</template>
