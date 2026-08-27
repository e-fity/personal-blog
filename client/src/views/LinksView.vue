<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'
import AppIcon from './../components/AppIcon.vue'

const store = useAppStore()
const links = ref([])
const settings = computed(() => store.settings)

onMounted(async () => {
  try {
    links.value = await api.get('/links')
  } catch {
    links.value = []
  }
})
</script>

<template>
  <div>
    <div class="section-title"><span>友链</span></div>
    <p class="muted" style="margin: -10px 0 22px">一些常逛的优质站点，欢迎来串门。</p>
    <div class="grid grid--links">
      <a v-for="link in links" :key="link.id" class="card card--hover" style="padding: 20px; display: flex; gap: 14px; align-items: center; color: inherit" :href="link.url" target="_blank" rel="noopener">
        <img :src="link.logo || '/images/avatar.svg'" alt="" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover; flex: none" />
        <div style="min-width: 0">
          <div style="display: flex; align-items: center; gap: 6px">
            <strong style="font-size: 1rem">{{ link.name }}</strong>
            <AppIcon name="external" :size="14" style="color: var(--text-faint)" />
          </div>
          <div class="muted" style="font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ link.description }}</div>
        </div>
      </a>
    </div>
    <div v-if="!links.length" class="empty">暂无友链</div>

    <div class="card" style="padding: 20px; margin-top: 28px">
      <h3 style="margin: 0 0 8px; font-size: 1.05rem">友链申请</h3>
      <p class="muted" style="margin: 0; font-size: 0.9rem">{{ settings.friendApply || '欢迎申请友链，请在留言板留下你的站点信息。' }}</p>
    </div>
  </div>
</template>
