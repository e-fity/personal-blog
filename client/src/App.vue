<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import TopNav from './components/TopNav.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import MusicPlayer from './components/MusicPlayer.vue'
import DayToggle from './components/DayToggle.vue'
import AppToast from './components/AppToast.vue'
import { useAppStore } from './stores/app.js'
import { useMusicStore } from './stores/music.js'

const store = useAppStore()
const music = useMusicStore()
const route = useRoute()
const isHome = computed(() => route.path === '/')

onMounted(() => {
  store.init()
  music.init()
})
</script>

<template>
  <div class="app-shell">
    <TopNav />

    <main class="main">
      <div class="container">
        <RouterView />
      </div>
    </main>

    <MusicPlayer v-if="!isHome" />
    <DayToggle />
    <SettingsDrawer />
    <AppToast />
  </div>
</template>
