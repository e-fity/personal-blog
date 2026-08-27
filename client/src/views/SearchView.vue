<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import PostCard from '../components/PostCard.vue'
import ProjectCard from '../components/ProjectCard.vue'

const route = useRoute()
const q = ref(route.query.q || '')
const loading = ref(false)
const result = ref({ posts: [], projects: [], photos: [], links: [] })

const total = computed(
  () => result.value.posts.length + result.value.projects.length + result.value.photos.length + result.value.links.length
)

async function run() {
  const keyword = q.value.trim()
  loading.value = true
  try {
    result.value = keyword
      ? await api.get(`/search?q=${encodeURIComponent(keyword)}`)
      : { posts: [], projects: [], photos: [], links: [] }
  } catch {
    result.value = { posts: [], projects: [], photos: [], links: [] }
  } finally {
    loading.value = false
  }
}

watch(
  () => route.query.q,
  (value) => {
    q.value = value || ''
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
      <section v-if="result.posts.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">文章</h3>
        <div class="grid grid--posts">
          <PostCard v-for="post in result.posts" :key="post.id" :post="post" />
        </div>
      </section>

      <section v-if="result.projects.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">项目</h3>
        <div class="grid grid--projects">
          <ProjectCard v-for="project in result.projects" :key="project.id" :project="project" />
        </div>
      </section>

      <section v-if="result.photos.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">照片</h3>
        <div class="masonry" style="columns: 4">
          <RouterLink v-for="photo in result.photos" :key="photo.id" to="/photos" class="photo-item">
            <img :src="photo.url" :alt="photo.title" loading="lazy" />
            <figcaption class="photo-item__caption">{{ photo.title }}</figcaption>
          </RouterLink>
        </div>
      </section>

      <section v-if="result.links.length" style="margin-bottom: 30px">
        <h3 class="search-group-title">友链</h3>
        <div class="grid grid--links">
          <a v-for="link in result.links" :key="link.id" class="card glass" style="padding: 16px 18px; color: inherit" :href="link.url" target="_blank" rel="noopener">
            <strong>{{ link.name }}</strong>
            <div class="muted" style="font-size: 0.84rem">{{ link.description }}</div>
          </a>
        </div>
      </section>

      <div v-if="!loading && !total" class="empty">没有找到「{{ q }}」相关内容，换个关键词试试</div>
    </template>
    <div v-else class="empty">在顶部搜索框输入关键词，搜索文章、项目、照片与友链</div>
  </div>
</template>
