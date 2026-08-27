<script setup>
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { tagClass } from '../tags.js'

const props = defineProps({ project: { type: Object, required: true } })
const router = useRouter()

function go() {
  router.push(`/projects/${props.project.id}`)
}
</script>

<template>
  <article
    class="card card--hover project-card project-card--link"
    role="link"
    tabindex="0"
    :aria-label="`查看项目 ${project.title}`"
    @click="go"
    @keyup.enter="go"
  >
    <img class="project-card__cover" :src="project.cover || '/images/project-01.svg'" :alt="project.title" loading="lazy" />
    <div class="project-card__body">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
        <h3 class="project-card__title">{{ project.title }}</h3>
        <span style="display: flex; gap: 6px">
          <span v-if="project.featured" class="tag tag--frontend">精选</span>
          <span v-if="project.category" :class="tagClass(project.category)">{{ project.category }}</span>
        </span>
      </div>
      <p class="project-card__desc">{{ project.description }}</p>
      <div class="project-card__tags">
        <span v-for="tag in project.tags" :key="tag" :class="tagClass(tag)">{{ tag }}</span>
      </div>
      <div class="project-card__links">
        <a v-if="project.github_url" class="btn btn--sm" :href="project.github_url" target="_blank" rel="noopener" @click.stop>
          <AppIcon name="github" :size="15" /> GitHub
        </a>
        <a v-if="project.demo_url" class="btn btn--sm" :href="project.demo_url" target="_blank" rel="noopener" @click.stop>
          <AppIcon name="external" :size="15" /> Demo
        </a>
      </div>
    </div>
  </article>
</template>
