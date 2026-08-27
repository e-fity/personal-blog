<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores/app.js'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import AppIcon from '../components/AppIcon.vue'

const store = useAppStore()
const settings = computed(() => store.settings)
</script>

<template>
  <div>
    <div class="section-title"><span>关于</span></div>
    <div class="card" style="padding: 36px 40px">
      <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 22px">
        <img :src="settings.avatar || '/images/avatar.svg'" alt="" style="width: 92px; height: 92px; border-radius: 50%; object-fit: cover" />
        <div>
          <h1 style="margin: 0 0 4px; font-size: 1.5rem">{{ settings.name }}</h1>
          <p class="muted" style="margin: 0">{{ settings.bio }}</p>
        </div>
      </div>
      <MarkdownRenderer :content="settings.about" />
    </div>

    <section style="margin-top: 28px">
      <h3 class="section-title" style="font-size: 1.15rem">找到我</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 12px">
        <a v-for="s in settings.socials || []" :key="s.name" class="btn" :href="s.url" target="_blank" rel="noopener">
          <AppIcon :name="s.icon || 'link'" :size="17" /> {{ s.name }}
        </a>
      </div>
    </section>
  </div>
</template>
