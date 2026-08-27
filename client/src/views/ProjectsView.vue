<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api.js'
import ProjectCard from '../components/ProjectCard.vue'

const projects = ref([])
const category = ref('全部')
const categories = computed(() => ['全部', ...new Set(projects.value.map((p) => p.category).filter(Boolean))])
const filtered = computed(() =>
  category.value === '全部' ? projects.value : projects.value.filter((p) => p.category === category.value)
)

onMounted(async () => {
  try {
    projects.value = await api.get('/projects')
  } catch {
    projects.value = []
  }
})
</script>

<template>
  <div>
    <div class="section-title">
      <span>项目作品集</span>
      <span class="muted" style="font-size: 0.88rem">共 {{ filtered.length }} 个项目</span>
    </div>
    <div class="filter-bar">
      <button v-for="c in categories" :key="c" class="filter-chip" :class="{ active: category === c }" @click="category = c">
        {{ c }}
      </button>
    </div>
    <div class="grid grid--projects">
      <ProjectCard v-for="project in filtered" :key="project.id" :project="project" />
    </div>
    <div v-if="!filtered.length" class="empty">暂无项目</div>
  </div>
</template>
