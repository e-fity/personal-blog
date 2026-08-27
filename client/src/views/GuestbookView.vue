<script setup>
import { onMounted, ref } from 'vue'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'
import AppIcon from './../components/AppIcon.vue'

const store = useAppStore()
const messages = ref([])
const nickname = ref(localStorage.getItem('dg-nickname') || '')
const content = ref('')
const submitting = ref(false)
const error = ref('')
const replyTarget = ref(null)
const replyText = ref('')

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  try {
    messages.value = await api.get('/messages')
  } catch {
    messages.value = []
  }
}

async function submit() {
  const text = content.value.trim()
  if (!text) return
  submitting.value = true
  error.value = ''
  try {
    if (nickname.value.trim()) localStorage.setItem('dg-nickname', nickname.value.trim())
    await api.post('/messages', { nickname: nickname.value.trim() || '访客', content: text })
    content.value = ''
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

async function saveReply(id) {
  await api.post(`/messages/${id}/reply`, { reply: replyText.value })
  replyTarget.value = null
  replyText.value = ''
  await load()
}

async function remove(id) {
  if (!window.confirm('确认删除这条留言？')) return
  await api.del(`/messages/${id}`)
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="section-title">
      <span>留言板</span>
      <span class="muted" style="font-size: 0.88rem">共 {{ messages.length }} 条</span>
    </div>
    <p class="muted" style="margin: -10px 0 22px">无需注册，留下你的足迹，也可以自定义昵称。</p>

    <div class="card" style="padding: 20px; margin-bottom: 24px">
      <div class="field">
        <label>昵称</label>
        <input v-model="nickname" class="input" placeholder="自定义昵称（可留空）" maxlength="24" />
      </div>
      <div class="field">
        <label>留言</label>
        <textarea v-model="content" class="textarea" style="min-height: 90px" placeholder="想说点什么？" maxlength="600" />
      </div>
      <p v-if="error" style="color: #ef4444; font-size: 0.86rem">{{ error }}</p>
      <button class="btn btn--primary" :disabled="submitting" @click="submit">
        <AppIcon name="message" :size="16" /> {{ submitting ? '提交中…' : '发布留言' }}
      </button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 14px">
      <div v-for="m in messages" :key="m.id" class="card" style="padding: 18px 20px">
        <div class="post-card__meta" style="margin-bottom: 8px">
          <strong>{{ m.nickname }}</strong>
          <span>{{ formatDate(m.created_at) }}</span>
        </div>
        <p style="margin: 0">{{ m.content }}</p>
        <div v-if="m.reply" style="margin: 12px 0 0; padding: 12px 14px; background: var(--accent-soft); border-radius: 10px">
          <strong style="color: var(--accent); font-size: 0.84rem">博主回复</strong>
          <p style="margin: 4px 0 0; font-size: 0.92rem">{{ m.reply }}</p>
        </div>
        <div v-if="store.isAdmin" style="display: flex; gap: 8px; margin-top: 10px">
          <button v-if="replyTarget !== m.id" class="btn btn--ghost btn--sm" @click="replyTarget = m.id; replyText = m.reply">回复</button>
          <button class="btn btn--ghost btn--sm btn--danger" @click="remove(m.id)">删除</button>
        </div>
        <div v-if="store.isAdmin && replyTarget === m.id" style="margin-top: 10px">
          <textarea v-model="replyText" class="textarea" style="min-height: 70px" placeholder="输入回复内容" />
          <div style="display: flex; gap: 8px; margin-top: 8px">
            <button class="btn btn--sm btn--primary" @click="saveReply(m.id)">保存</button>
            <button class="btn btn--sm" @click="replyTarget = null">取消</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!messages.length" class="empty">还没有留言，来做第一个留言的人吧~</div>
  </div>
</template>
