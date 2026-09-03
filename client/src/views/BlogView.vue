<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import PostCard from '../components/PostCard.vue'
import { useAppStore } from '../stores/app.js'

const route = useRoute()
const store = useAppStore()
const posts = ref([])
const query = ref(route.query.q || '')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return posts.value
  return posts.value.filter((p) =>
    `${p.title} ${p.excerpt} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)
  )
})

watch(
  () => route.query.q,
  (value) => {
    query.value = value || ''
  }
)

onMounted(async () => {
  try {
    posts.value = await api.get('/essays?limit=100')
  } catch {
    posts.value = []
  }
})
</script>

<template>
  <div>
    <div class="section-title">
      <span>{{ store.t('blog') }} · Blog</span>
      <span class="muted" style="font-size: 0.9rem">
        {{ query ? `搜索「${query}」· ${filtered.length} 篇` : `共 ${posts.length} 篇` }}
      </span>
    </div>
    <div v-if="filtered.length" class="grid grid--posts">
      <PostCard v-for="post in filtered" :key="post.id" :post="post" type="essay" />
    </div>
    <div v-else class="empty">{{ query ? '没有找到相关文章' : '暂无文章' }}</div>
  </div>
</template>
