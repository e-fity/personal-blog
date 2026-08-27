<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()
const router = useRouter()
const route = useRoute()
const username = ref('admin')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.post('/auth/login', { username: username.value, password: password.value })
    store.login(res.token)
    router.push(route.query.redirect || '/admin')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <div class="card">
      <h1 style="font-size: 1.3rem; margin: 0 0 4px">后台登录</h1>
      <p class="muted" style="margin: 0 0 22px; font-size: 0.88rem">仅博主可访问，请输入管理员账号。</p>
      <div class="field">
        <label>用户名</label>
        <input v-model="username" class="input" autocomplete="username" />
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" type="password" class="input" autocomplete="current-password" @keyup.enter="submit" />
      </div>
      <p v-if="error" style="color: #ef4444; font-size: 0.86rem">{{ error }}</p>
      <button class="btn btn--primary" style="width: 100%" :disabled="loading" @click="submit">
        {{ loading ? '登录中…' : '登录' }}
      </button>
      <p class="muted" style="font-size: 0.76rem; margin: 16px 0 0; text-align: center">默认账号 admin / admin123</p>
    </div>
  </div>
</template>
