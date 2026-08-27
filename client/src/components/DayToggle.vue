<script setup>
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'

const store = useAppStore()
</script>

<template>
  <button class="glass daymode" :title="store.isDark ? '切换到日间模式' : '切换到夜间模式'" @click="store.toggleTheme()">
    <span class="daymode__icon">
      <AppIcon :name="store.isDark ? 'moon' : 'sun'" :size="20" />
    </span>
    <span class="daymode__text">
      <strong>{{ store.isDark ? '夜间模式' : '日间模式' }}</strong>
      <span>{{ store.isDark ? '深紫夜色' : '柔和淡紫配色' }}</span>
    </span>
    <span class="daymode__switch" :class="{ on: !store.isDark }" />
  </button>
</template>
