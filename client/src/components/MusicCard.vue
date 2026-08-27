<script setup>
import { onMounted } from 'vue'
import { useMusicStore } from '../stores/music.js'
import AppIcon from './AppIcon.vue'

const store = useMusicStore()

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function onSeek(e) {
  store.seek(Number(e.target.value))
}

onMounted(() => store.init())
</script>

<template>
  <aside class="glass music-card" id="music-card">
    <div class="music-card__head">
      <img class="music-card__mini" :src="store.currentTrack.cover || '/images/music-01.svg'" alt="" />
      <div class="music-card__titles">
        <strong>{{ store.currentTrack.title || '未命名曲目' }}</strong>
        <span>{{ store.currentTrack.artist || '星辉小屋' }}</span>
      </div>
    </div>

    <div class="music-card__cover" :class="{ playing: store.isPlaying }">
      <img :src="store.currentTrack.cover || '/images/music-01.svg'" alt="专辑封面" />
    </div>

    <div class="music-card__progress">
      <span>{{ formatTime(store.currentTime) }}</span>
      <div class="music-card__bar">
        <i :style="{ width: `${store.duration ? (store.currentTime / store.duration) * 100 : 0}%` }" />
      </div>
      <span>{{ formatTime(store.duration) }}</span>
    </div>

    <div class="music-card__controls">
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

    <div class="music-card__lyrics">
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
  </aside>
</template>
