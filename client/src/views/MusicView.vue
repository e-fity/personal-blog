<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMusicStore } from '../stores/music.js'
import { useAppStore } from '../stores/app.js'
import AppIcon from '../components/AppIcon.vue'

const store = useMusicStore()
const app = useAppStore()
const searchKw = ref('')

onMounted(() => {
  store.init()
  store.loadPlaylists()
})

const grouped = computed(() => {
  const list = store.filteredTracks
  if (store.currentPlaylistId != null) {
    return [{ id: store.currentPlaylistId, title: store.playlistMap[store.currentPlaylistId]?.title || '歌单', tracks: list }]
  }
  // 按歌单分组，未分组的放最后
  const groups = []
  const byPlaylist = {}
  const ungrouped = []
  for (const t of list) {
    if (t.playlist_id) {
      if (!byPlaylist[t.playlist_id]) byPlaylist[t.playlist_id] = []
      byPlaylist[t.playlist_id].push(t)
    } else {
      ungrouped.push(t)
    }
  }
  for (const p of store.playlists) {
    if (byPlaylist[p.id]) {
      groups.push({ id: p.id, title: p.title, tracks: byPlaylist[p.id], cover: p.cover })
    }
  }
  if (ungrouped.length) groups.push({ id: null, title: '未分组', tracks: ungrouped })
  return groups
})

function onSearch() {
  store.setKeyword(searchKw.value)
}

function pick(track) {
  const list = store.filteredTracks
  const idx = list.findIndex((t) => t.id === track.id)
  if (idx < 0) return
  if (store.currentTrack.id === track.id && store.isPlaying) {
    store.togglePlay()
  } else {
    store.playTrack(idx)
    if (!store.isPlaying) store.togglePlay()
  }
}

function selectPlaylist(id) {
  store.setPlaylist(id)
}

function formatDuration(sec) {
  if (!sec || !Number.isFinite(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div>
    <div class="section-title">
      <span>{{ app.t('musicTitle') }}</span>
      <span class="muted" style="font-size: 0.9rem">{{ store.tracks.length }} 首 · 点击即播放</span>
    </div>

    <!-- 歌单筛选 + 搜索 -->
    <div class="music-toolbar">
      <div class="music-playlist-tabs">
        <button
          class="music-tab"
          :class="{ active: store.currentPlaylistId == null }"
          @click="selectPlaylist(null)"
        >
          全部
        </button>
        <button
          v-for="p in store.playlists"
          :key="p.id"
          class="music-tab"
          :class="{ active: store.currentPlaylistId === p.id }"
          @click="selectPlaylist(p.id)"
        >
          {{ p.title }}
          <span class="music-tab__count">{{ p.track_count }}</span>
        </button>
      </div>
      <div class="music-search">
        <AppIcon name="search" :size="15" />
        <input
          v-model="searchKw"
          placeholder="搜索歌曲 / 艺术家"
          @input="onSearch"
          @keyup.enter="onSearch"
        />
      </div>
    </div>

    <!-- 按歌单分组展示 -->
    <template v-for="group in grouped" :key="group.id || 'ungrouped'">
      <div v-if="group.tracks.length" class="music-group">
        <div class="music-group__title">
          <img v-if="group.cover" :src="group.cover" alt="" />
          <span>{{ group.title }}</span>
          <span class="muted" style="font-size: 0.8rem; margin-left: 8px">{{ group.tracks.length }} 首</span>
        </div>
        <div class="music-list">
          <button
            v-for="track in group.tracks"
            :key="track.id"
            class="glass music-list__item"
            :class="{ active: store.currentTrack.id === track.id }"
            @click="pick(track)"
          >
            <img class="music-list__cover" :src="track.cover || '/images/music-01.svg'" alt="" />
            <span class="music-list__info">
              <strong>{{ track.title }}</strong>
              <span>{{ track.artist || '星辉小屋' }}</span>
            </span>
            <span class="music-list__duration">{{ formatDuration(track.duration) }}</span>
            <span
              class="music-list__download"
              title="下载到本地"
              @click.stop="store.downloadTrack(track)"
            >
              <AppIcon name="download" :size="16" />
            </span>
            <span class="music-list__play">
              <AppIcon v-if="store.currentTrack.id === track.id && store.isPlaying" name="pause" :size="20" />
              <AppIcon v-else name="play" :size="20" />
            </span>
          </button>
        </div>
      </div>
    </template>

    <div v-if="!store.filteredTracks.length" class="empty">
      {{ searchKw ? `没有找到「${searchKw}」相关歌曲` : '暂无歌曲，可在后台导入歌单或上传曲目' }}
    </div>
  </div>
</template>

<style scoped>
.music-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.music-playlist-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.music-tab {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.88rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.music-tab:hover {
  border-color: var(--accent);
}
.music-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.music-tab__count {
  font-size: 0.75rem;
  opacity: 0.7;
  background: rgba(0, 0, 0, 0.15);
  padding: 1px 6px;
  border-radius: 10px;
}
.music-search {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  min-width: 200px;
}
.music-search input {
  border: none;
  background: transparent;
  outline: none;
  color: var(--text);
  font-size: 0.88rem;
  width: 100%;
}
.music-group {
  margin-bottom: 28px;
}
.music-group__title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text);
}
.music-group__title img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
}
.music-list__item {
  position: relative;
}
.music-list__duration {
  font-size: 0.82rem;
  color: var(--muted);
  min-width: 42px;
  text-align: right;
}
.music-list__download {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}
.music-list__download:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
