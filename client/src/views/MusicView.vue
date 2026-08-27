<script setup>
import { onMounted } from 'vue'
import { useMusicStore } from '../stores/music.js'
import AppIcon from '../components/AppIcon.vue'

const store = useMusicStore()
onMounted(() => store.init())

function pick(index) {
  if (store.currentIndex === index && store.isPlaying) {
    store.togglePlay()
  } else {
    store.playTrack(index)
  }
}
</script>

<template>
  <div>
    <div class="section-title">
      <span>音乐列表</span>
      <span class="muted" style="font-size: 0.9rem">{{ store.tracks.length }} 首 · 点击即播放</span>
    </div>

    <div class="music-list">
      <button
        v-for="(track, i) in store.tracks"
        :key="track.id"
        class="glass music-list__item"
        :class="{ active: i === store.currentIndex }"
        @click="pick(i)"
      >
        <img class="music-list__cover" :src="track.cover || '/images/music-01.svg'" alt="" />
        <span class="music-list__info">
          <strong>{{ track.title }}</strong>
          <span>{{ track.artist || '星辉小屋' }}</span>
        </span>
        <span class="music-list__play">
          <AppIcon v-if="i === store.currentIndex && store.isPlaying" name="pause" :size="20" />
          <AppIcon v-else name="play" :size="20" />
        </span>
      </button>
    </div>
    <div v-if="!store.tracks.length" class="empty">暂无歌曲</div>
  </div>
</template>
