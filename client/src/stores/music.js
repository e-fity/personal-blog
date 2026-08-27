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
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    loopMode: true,
    lyrics: [],
    currentLyric: -1,
    expanded: false,
    inited: false
  }),
  getters: {
    currentTrack: (state) => state.tracks[state.currentIndex] || {}
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
    },
    async load() {
      try {
        this.tracks = await api.get('/music')
      } catch {
        this.tracks = []
      }
      await this.loadLyrics()
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
      if (!this.tracks.length) await this.load()
      if (!this.tracks.length) return
      this.currentIndex = (index + this.tracks.length) % this.tracks.length
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
      this.playTrack(this.currentIndex + 1)
    },
    prev() {
      this.playTrack(this.currentIndex - 1)
    },
    seek(value) {
      const a = getAudio()
      a.currentTime = value
      this.currentTime = value
    },
    onEnded() {
      if (this.loopMode) {
        this.playTrack(this.currentIndex + 1)
      } else {
        this.isPlaying = false
      }
    },
    toggleExpanded() {
      this.expanded = !this.expanded
    }
  }
})
