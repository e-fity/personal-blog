import { defineStore } from 'pinia'
import api, { setToken } from '../api.js'
import { t as translate } from '../i18n.js'

const THEME_KEY = 'dg-theme'
const FONT_KEY = 'dg-font-scale'
const ANIM_KEY = 'dg-animations'
const TOKEN_KEY = 'dg-token'
const ACCENT_KEY = 'dg-accent'
const LANG_KEY = 'dg-lang'

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: localStorage.getItem(THEME_KEY) || 'light',
    fontScale: Number(localStorage.getItem(FONT_KEY) || 1),
    animations: localStorage.getItem(ANIM_KEY) !== '0',
    token: localStorage.getItem(TOKEN_KEY) || '',
    accent: localStorage.getItem(ACCENT_KEY) || 'lavender',
    lang: localStorage.getItem(LANG_KEY) || 'zh',
    settings: {},
    loaded: false,
    settingsOpen: false
  }),
  getters: {
    isDark: (state) => state.theme === 'dark',
    isAdmin: (state) => !!state.token,
    t: (state) => (key) => translate(key, state.lang)
  },
  actions: {
    applyPreferences() {
      document.documentElement.dataset.theme = this.theme
      document.documentElement.dataset.accent = this.accent
      document.documentElement.lang = this.lang === 'en' ? 'en' : 'zh-CN'
      document.documentElement.style.fontSize = `${this.fontScale * 100}%`
      document.documentElement.classList.toggle('reduce-motion', !this.animations)
    },
    init() {
      this.applyPreferences()
      setToken(this.token)
      this.fetchSettings()
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, this.theme)
      this.applyPreferences()
    },
    setAccent(value) {
      this.accent = value
      localStorage.setItem(ACCENT_KEY, value)
      this.applyPreferences()
    },
    toggleLang() {
      this.lang = this.lang === 'zh' ? 'en' : 'zh'
      localStorage.setItem(LANG_KEY, this.lang)
      this.applyPreferences()
    },
    setTheme(value) {
      this.theme = value === 'dark' ? 'dark' : 'light'
      localStorage.setItem(THEME_KEY, this.theme)
      this.applyPreferences()
    },
    setFontScale(value) {
      this.fontScale = Math.min(1.4, Math.max(0.8, Number(value) || 1))
      localStorage.setItem(FONT_KEY, String(this.fontScale))
      this.applyPreferences()
    },
    toggleAnimations() {
      this.animations = !this.animations
      localStorage.setItem(ANIM_KEY, this.animations ? '1' : '0')
      this.applyPreferences()
    },
    async fetchSettings() {
      try {
        this.settings = await api.get('/settings')
      } catch {
        this.settings = {}
      }
      this.loaded = true
    },
    login(token) {
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
      setToken(token)
    },
    logout() {
      this.token = ''
      localStorage.removeItem(TOKEN_KEY)
      setToken('')
    }
  }
})
