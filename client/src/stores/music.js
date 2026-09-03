import { defineStore } from 'pinia'
import api from '../api.js'

let audio = null
function getAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'metadata'
  }
  return audio
}

function parseLrc(text) {
  const result = []
  for (const raw of String(text).split('\n')) {
    const m = raw.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)/)
    if (!m) continue
    const frac = m[3] ? Number(m[3].padEnd(3, '0')) / 1000 : 0
    result.push({ time: Number(m[1]) * 60 + Number(m[2]) + frac, text: m[4] })
  }
  return result.sort((a, b) => a.time - b.time)
}

export const useMusicStore = defineStore('music', {
  state: () => ({
    tracks: [],
    playlists: [],
    currentPlaylistId: null, // null = 全部
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loopMode: true,
    lyrics: [],
    currentLyric: -1,
    expanded: false,
    inited: false,
    keyword: ''
  }),
  getters: {
    currentTrack: (state) => state.tracks[state.currentIndex] || {},
    filteredTracks(state) {
      const kw = state.keyword.trim().toLowerCase()
      let list = state.tracks
      if (state.currentPlaylistId != null) {
        list = list.filter((t) => t.playlist_id === state.currentPlaylistId)
      }
      if (!kw) return list
      return list.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(kw) ||
          (t.artist || '').toLowerCase().includes(kw)
      )
    },
    playlistMap(state) {
      const m = {}
      for (const p of state.playlists) m[p.id] = p
      return m
    }
  },
  actions: {
    init() {
      if (this.inited) return
      this.inited = true
      const a = getAudio()
      a.addEventListener('timeupdate', () => {
        this.currentTime = a.currentTime
        this.duration = a.duration || 0
        this.syncLyric()
      })
      a.addEventListener('ended', () => this.onEnded())
      a.addEventListener('play', () => {
        this.isPlaying = true
      })
      a.addEventListener('pause', () => {
        this.isPlaying = false
      })
      this.load()
      this.loadPlaylists()
    },
    async load() {
      try {
        this.tracks = await api.get('/music')
      } catch {
        this.tracks = []
      }
      await this.loadLyrics()
    },
    async loadPlaylists() {
      try {
        this.playlists = await api.get('/playlists')
      } catch {
        this.playlists = []
      }
    },
    setPlaylist(id) {
      this.currentPlaylistId = id
      this.currentIndex = 0
    },
    setKeyword(kw) {
      this.keyword = kw
    },
    syncLyric() {
      const idx = this.lyrics.reduce((acc, line, i) => (line.time <= this.currentTime ? i : acc), -1)
      if (idx !== this.currentLyric) this.currentLyric = idx
    },
    async loadLyrics() {
      this.lyrics = []
      this.currentLyric = -1
      const url = this.currentTrack.lrc
      if (!url) return
      try {
        const res = await fetch(url)
        this.lyrics = parseLrc(await res.text())
      } catch {
        this.lyrics = []
      }
    },
    async playTrack(index) {
      const list = this.filteredTracks
      if (!list.length) {
        await this.load()
        if (!this.filteredTracks.length) return
      }
      const target = this.filteredTracks[index]
      if (!target) return
      // 在全量 tracks 中找到真实索引
      const realIndex = this.tracks.findIndex((t) => t.id === target.id)
      this.currentIndex = realIndex >= 0 ? realIndex : 0
      this.currentTime = 0
      this.duration = 0
      await this.loadLyrics()
      const a = getAudio()
      a.src = this.currentTrack.url
      if (this.isPlaying) {
        await a.play().catch(() => {})
      }
    },
    togglePlay() {
      const a = getAudio()
      if (this.isPlaying) {
        a.pause()
      } else {
        if (!a.src) {
          if (!this.tracks.length) {
            this.load().then(() => {
              const audio = getAudio()
              audio.src = this.currentTrack.url
              audio.play().catch(() => {})
            })
            return
          }
          a.src = this.currentTrack.url
        }
        a.play().catch(() => {})
      }
    },
    next() {
      const list = this.filteredTracks
      if (!list.length) return
      const curId = this.currentTrack.id
      const idx = list.findIndex((t) => t.id === curId)
      const nextIdx = (idx + 1) % list.length
      this.playTrack(nextIdx)
    },
    prev() {
      const list = this.filteredTracks
      if (!list.length) return
      const curId = this.currentTrack.id
      const idx = list.findIndex((t) => t.id === curId)
      const prevIdx = (idx - 1 + list.length) % list.length
      this.playTrack(prevIdx)
    },
    seek(value) {
      const a = getAudio()
      a.currentTime = value
      this.currentTime = value
    },
    onEnded() {
      if (this.loopMode) {
        this.next()
      } else {
        this.isPlaying = false
      }
    },
    toggleExpanded() {
      this.expanded = !this.expanded
    },
    /**
     * 下载曲目到本地
     */
    downloadTrack(track) {
      if (!track || !track.url) return
      // 使用后端代理下载，统一处理外链和本地文件
      const link = document.createElement('a')
      link.href = `/api/music/${track.id}/download`
      const safeName = `${(track.title || 'track').replace(/[\\/:*?"<>|]/g, '_')}.mp3`
      link.download = safeName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
    /**
     * 导入歌单
     * @param {File} file 歌单文件(.m3u/.m3u8/.pls/.xspf/.zip)
     * @param {Object} opts { playlist_title, playlist_id, mode }
     */
    async importPlaylist(file, opts = {}) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      return api.post('/music/import', {
        filename: file.name,
        data: dataUrl,
        playlist_title: opts.playlist_title || '',
        playlist_id: opts.playlist_id || null,
        mode: opts.mode || 'append'
      })
    }
  }
})
