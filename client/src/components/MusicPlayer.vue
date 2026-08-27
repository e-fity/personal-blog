<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useMusicStore } from '../stores/music.js'
import AppIcon from './AppIcon.vue'

const store = useMusicStore()
const dragging = ref(false)
const pos = reactive({ x: null, y: null })
let startX = 0
let startY = 0
let baseX = 0
let baseY = 0
let moved = false

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function onSeek(e) {
  store.seek(Number(e.target.value))
}

// 默认位置：右下角（right:24 / bottom:122，小球 54px）
function defaultX() {
  return window.innerWidth - 54 - 24
}
function defaultY() {
  return window.innerHeight - 122 - 54
}

const containerStyle = computed(() =>
  pos.x == null ? {} : { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' }
)

function onDown(e) {
  dragging.value = true
  moved = false
  startX = e.clientX
  startY = e.clientY
  baseX = pos.x ?? defaultX()
  baseY = pos.y ?? defaultY()
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

function onMove(e) {
  if (!dragging.value) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (Math.abs(dx) + Math.abs(dy) > 4) moved = true
  pos.x = Math.min(Math.max(baseX + dx, 8), window.innerWidth - 62)
  pos.y = Math.min(Math.max(baseY + dy, 8), window.innerHeight - 62)
}

function onUp() {
  dragging.value = false
}

function onClick() {
  if (moved) {
    moved = false
    return
  }
  store.toggleExpanded()
}

onMounted(() => store.init())
</script>

<template>
  <div class="music-player" :style="containerStyle">
    <div v-if="store.expanded" class="music-player__panel">
      <div class="music-player__head">
        <img class="music-player__cover" :src="store.currentTrack.cover || '/images/music-01.svg'" alt="" />
        <div class="music-player__meta">
          <div class="music-player__title">{{ store.currentTrack.title || '未命名曲目' }}</div>
          <div class="music-player__artist">{{ store.currentTrack.artist || '星辉小屋' }}</div>
        </div>
        <button class="icon-btn" style="width: 32px; height: 32px" @click="store.expanded = false">
          <AppIcon name="chevron-right" :size="17" />
        </button>
      </div>

      <div class="music-player__progress">
        <span>{{ formatTime(store.currentTime) }}</span>
        <input
          type="range"
          min="0"
          :max="store.duration || 1"
          step="0.1"
          :value="store.currentTime"
          @input="onSeek"
        />
        <span>{{ formatTime(store.duration) }}</span>
      </div>

      <div class="music-player__controls">
        <button class="player-btn" title="上一曲" @click="store.prev()">
          <AppIcon name="prev" :size="18" />
        </button>
        <button class="player-btn player-btn--main" title="播放/暂停" @click="store.togglePlay()">
          <AppIcon :name="store.isPlaying ? 'pause' : 'play'" :size="20" />
        </button>
        <button class="player-btn" title="下一曲" @click="store.next()">
          <AppIcon name="next" :size="18" />
        </button>
        <button class="player-btn" :class="{ active: store.loopMode }" title="列表循环" @click="store.loopMode = !store.loopMode">
          <AppIcon name="loop" :size="17" />
        </button>
      </div>

      <div class="lyrics">
        <div
          v-for="(line, i) in store.lyrics"
          :key="i"
          class="lyrics__line"
          :class="{ active: i === store.currentLyric }"
        >
          {{ line.text }}
        </div>
        <div v-if="!store.lyrics.length" class="lyrics__line muted">暂无歌词</div>
      </div>
    </div>

    <button
      class="music-player__fab"
      :class="{ playing: store.isPlaying }"
      :title="store.expanded ? '收起播放器' : '展开播放器（可拖拽）'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @click="onClick"
    >
      <span
        class="disc"
        :style="{ backgroundImage: `url(${store.currentTrack.cover || '/images/music-01.svg'})` }"
      />
    </button>
  </div>
</template>
