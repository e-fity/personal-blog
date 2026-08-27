<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import AppIcon from '../components/AppIcon.vue'
import { tagClass } from '../tags.js'

const route = useRoute()
const project = ref(null)
const error = ref('')

onMounted(async () => {
  try {
    project.value = await api.get(`/projects/${route.params.id}`)
  } catch (e) {
    error.value = e.message
  }
})
</script>

<template>
  <div v-if="project" class="glass project-detail">
    <RouterLink to="/projects" class="btn btn--ghost btn--sm" style="margin-bottom: 18px">← 返回项目</RouterLink>
    <img class="project-detail__cover" :src="project.cover || '/images/project-01.svg'" :alt="project.title" />
    <div class="project-detail__body">
      <div class="project-detail__head">
        <h1>{{ project.title }}</h1>
        <div style="display: flex; gap: 8px">
          <span v-if="project.category" :class="tagClass(project.category)">{{ project.category }}</span>
          <span v-if="project.featured" class="tag tag--frontend">精选</span>
        </div>
      </div>
      <div class="project-detail__tags">
        <span v-for="tag in project.tags" :key="tag" :class="tagClass(tag)">{{ tag }}</span>
      </div>
      <p class="project-detail__desc">{{ project.description }}</p>
      <div class="project-detail__links">
        <a v-if="project.github_url" class="btn" :href="project.github_url" target="_blank" rel="noopener">
          <AppIcon name="github" :size="17" /> GitHub 仓库
        </a>
        <a v-if="project.demo_url" class="btn btn--primary" :href="project.demo_url" target="_blank" rel="noopener">
          <AppIcon name="external" :size="17" /> 在线 Demo
        </a>
      </div>
    </div>
  </div>
  <div v-else-if="error" class="empty">{{ error }}</div>
  <div v-else class="empty">加载中…</div>
</template>
