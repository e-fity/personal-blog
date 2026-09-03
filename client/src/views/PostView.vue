<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import CommentSection from '../components/CommentSection.vue'
import { tagClass } from '../tags.js'

const route = useRoute()
const post = ref(null)
const error = ref('')

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  try {
    post.value = await api.get(`/posts/${route.params.id}`)
  } catch (e) {
    error.value = e.message
  }
})
</script>

<template>
  <div v-if="post" class="card" style="padding: 36px 40px">
    <RouterLink to="/archive" class="btn btn--ghost btn--sm" style="margin-bottom: 18px">← 返回归档</RouterLink>
    <h1 style="font-size: 1.9rem; margin: 0 0 14px">{{ post.title }}</h1>
    <div class="post-card__meta" style="margin-bottom: 18px">
      <span>{{ formatDate(post.created_at) }}</span>
      <span v-for="tag in post.tags" :key="tag" :class="tagClass(tag)">{{ tag }}</span>
    </div>
    <img v-if="post.cover" :src="post.cover" :alt="post.title" style="width: 100%; border-radius: 14px; margin-bottom: 24px" />
    <MarkdownRenderer :content="post.content" />
  </div>
  <div v-else-if="error" class="empty">{{ error }}</div>
  <div v-else class="empty">加载中…</div>

  <CommentSection v-if="post" :post-id="post.id" style="margin-top: 30px; display: block" />
</template>
