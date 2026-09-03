<script setup>
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'

const store = useAppStore()
const accents = [
  { key: 'lavender', label: '淡紫', colors: ['#6366f1', '#a855f7'] },
  { key: 'mint', label: '薄荷', colors: ['#14b8a6', '#34d399'] },
  { key: 'sky', label: '晴空', colors: ['#3b82f6', '#38bdf8'] },
  { key: 'peach', label: '蜜桃', colors: ['#fb7185', '#f59e0b'] }
]
</script>

<template>
  <Transition name="fade">
    <div v-if="store.settingsOpen" class="overlay show" @click="store.settingsOpen = false" />
  </Transition>
  <aside class="drawer" :class="{ open: store.settingsOpen }">
    <div class="drawer__head">
      <h2>{{ store.t('settingsTitle') }}</h2>
      <button class="icon-btn" @click="store.settingsOpen = false">
        <AppIcon name="close" :size="18" />
      </button>
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">{{ store.t('darkMode') }}</div>
        <div class="setting-row__hint">{{ store.t('darkMode') }}</div>
      </div>
      <button class="switch" :class="{ on: store.isDark }" @click="store.toggleTheme()" />
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">{{ store.t('font') }}</div>
        <div class="setting-row__hint">{{ Math.round(store.fontScale * 100) }}%</div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px">
        <button class="btn btn--sm" @click="store.setFontScale(store.fontScale - 0.1)">-</button>
        <button class="btn btn--sm" @click="store.setFontScale(store.fontScale + 0.1)">+</button>
      </div>
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">{{ store.t('animation') }}</div>
        <div class="setting-row__hint">{{ store.t('animation') }}</div>
      </div>
      <button class="switch" :class="{ on: store.animations }" @click="store.toggleAnimations()" />
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">{{ store.t('theme') }}</div>
        <div class="setting-row__hint">Lavender / Mint / Sky / Peach</div>
      </div>
      <div class="accent-swatches">
        <button
          v-for="a in accents"
          :key="a.key"
          class="accent-swatch"
          :class="{ active: store.accent === a.key }"
          :title="a.label"
          :style="{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})` }"
          @click="store.setAccent(a.key)"
        />
      </div>
    </div>

    <div class="setting-row">
      <div>
        <div class="setting-row__label">{{ store.t('language') }}</div>
        <div class="setting-row__hint">中文 / English</div>
      </div>
      <button class="btn btn--sm" @click="store.toggleLang()">{{ store.lang === 'zh' ? 'EN' : '中文' }}</button>
    </div>

    <p class="muted" style="font-size: 0.8rem; margin-top: 20px">
      {{ store.t('savedLocal') }}
    </p>
  </aside>
</template>
