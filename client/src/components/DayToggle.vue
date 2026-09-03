<script setup>
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'

const store = useAppStore()
</script>

<template>
  <button class="glass daymode" :title="store.isDark ? store.t('day') : store.t('night')" @click="store.toggleTheme()">
    <span class="daymode__icon">
      <AppIcon :name="store.isDark ? 'moon' : 'sun'" :size="20" />
    </span>
    <span class="daymode__text">
      <strong>{{ store.isDark ? store.t('night') : store.t('day') }}</strong>
      <span>{{ store.isDark ? store.t('nightHint') : store.t('dayHint') }}</span>
    </span>
    <span class="daymode__switch" :class="{ on: !store.isDark }" />
  </button>
</template>
