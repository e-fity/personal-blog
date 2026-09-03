<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import AppIcon from '../components/AppIcon.vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
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

      <!-- 技术栈 -->
      <div v-if="project.tags?.length" class="project-detail__section">
        <h3 class="project-detail__section-title">技术栈</h3>
        <div class="project-detail__tags">
          <span v-for="tag in project.tags" :key="tag" :class="tagClass(tag)">{{ tag }}</span>
        </div>
      </div>

      <p class="project-detail__desc">{{ project.description }}</p>

      <!-- 内容框架 -->
      <div v-if="project.content_framework" class="project-detail__section">
        <h3 class="project-detail__section-title">内容框架</h3>
        <div class="project-detail__framework">
          <MarkdownRenderer :content="project.content_framework" />
        </div>
      </div>

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

<style scoped>
.project-detail {
  overflow: hidden;
}
.project-detail__cover {
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  display: block;
}
.project-detail__body {
  padding: 28px 32px 32px;
}
.project-detail__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}
.project-detail__head h1 {
  margin: 0;
  font-size: 1.8rem;
}
.project-detail__section {
  margin: 20px 0;
}
.project-detail__section-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 10px;
  padding-left: 10px;
  border-left: 3px solid var(--accent);
  color: var(--text);
}
.project-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.project-detail__desc {
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--text-muted);
  margin: 0 0 20px;
}
.project-detail__framework {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 24px;
  font-size: 0.92rem;
  line-height: 1.8;
}
.project-detail__framework :deep(h2) {
  font-size: 1.1rem;
  margin: 18px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.project-detail__framework :deep(h2:first-child) {
  margin-top: 0;
}
.project-detail__framework :deep(h3) {
  font-size: 1rem;
  margin: 14px 0 8px;
}
.project-detail__framework :deep(ul),
.project-detail__framework :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}
.project-detail__framework :deep(li) {
  margin: 4px 0;
}
.project-detail__framework :deep(code) {
  background: var(--accent-soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.88em;
}
.project-detail__framework :deep(pre) {
  background: var(--bg3);
  padding: 14px;
  border-radius: 8px;
  overflow-x: auto;
}
.project-detail__framework :deep(blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 14px;
  margin: 10px 0;
  color: var(--text-muted);
}
.project-detail__links {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
</style>
