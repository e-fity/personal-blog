<script setup>
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'

const store = useAppStore()
</script>

<template>
  <Transition name="fade">
    <div v-if="store.settingsOpen" class="overlay show" @click="store.settingsOpen = false" />
  </Transition>
  <aside class="drawer" :class="{ open: store.settingsOpen }">
    <div class="drawer__head">
      <h2>个性化设置</h2>
      <button class="icon-btn" @click="store.settingsOpen = false">
        <AppIcon name="close" :size="18" />
      </button>
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">深色模式</div>
        <div class="setting-row__hint">切换全站深浅主题</div>
      </div>
      <button class="switch" :class="{ on: store.isDark }" @click="store.toggleTheme()" />
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">字体大小</div>
        <div class="setting-row__hint">当前：{{ Math.round(store.fontScale * 100) }}%</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px">
        <button class="btn btn--sm" @click="store.setFontScale(store.fontScale - 0.1)">-</button>
        <button class="btn btn--sm" @click="store.setFontScale(store.fontScale + 0.1)">+</button>
      </div>
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">过渡动画</div>
        <div class="setting-row__hint">开启后保留页面动效</div>
      </div>
      <button class="switch" :class="{ on: store.animations }" @click="store.toggleAnimations()" />
    </div>

    <p class="muted" style="font-size: 0.8rem; margin-top: 20px">
      所有设置均保存在浏览器本地，刷新页面不会丢失。
    </p>
  </aside>
</template>
