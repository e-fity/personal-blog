<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  postId: { type: Number, required: false, default: null },
  collectionId: { type: Number, required: false, default: null }
})
const store = useAppStore()

const comments = ref([])
const nickname = ref(localStorage.getItem('dg-nickname') || '')
const content = ref('')
const submitting = ref(false)
const error = ref('')
const replyTo = ref(null)

const grouped = computed(() => {
  const roots = comments.value.filter((c) => !c.reply_to)
  const replies = comments.value.filter((c) => c.reply_to)
  return roots.map((root) => ({ ...root, replies: replies.filter((r) => r.reply_to === root.id) }))
})

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  try {
    comments.value = props.collectionId
      ? await api.get(`/comments?collection_id=${props.collectionId}`)
      : await api.get(`/comments?post_id=${props.postId}`)
  } catch {
    comments.value = []
  }
}

async function submit() {
  const text = content.value.trim()
  if (!text) return
  submitting.value = true
  error.value = ''
  try {
    if (nickname.value.trim()) localStorage.setItem('dg-nickname', nickname.value.trim())
    await api.post('/comments', {
      post_id: props.collectionId ? 0 : props.postId,
      collection_id: props.collectionId,
      nickname: nickname.value.trim() || (store.isAdmin ? '博主' : '访客'),
      content: text,
      reply_to: replyTo.value
    })
    content.value = ''
    replyTo.value = null
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

async function remove(id) {
  if (!window.confirm('确认删除这条评论？')) return
  await api.del(`/comments/${id}`)
  await load()
}

onMounted(load)
</script>

<template>
  <section class="comments">
    <h3 class="section-title" style="font-size: 1.15rem">评论 ({{ comments.length }})</h3>

    <div v-if="grouped.length" style="display: flex; flex-direction: column; gap: 14px">
      <div v-for="item in grouped" :key="item.id" class="card" style="padding: 16px 18px">
        <div class="post-card__meta" style="margin-bottom: 6px">
          <strong :style="{ color: item.is_admin ? 'var(--accent)' : 'var(--text)' }">{{ item.nickname }}</strong>
          <span>{{ formatDate(item.created_at) }}</span>
          <span v-if="item.is_admin" class="tag tag--frontend">博主</span>
        </div>
        <p style="margin: 0">{{ item.content }}</p>
        <div style="display: flex; gap: 8px; margin-top: 8px">
          <button v-if="store.isAdmin" class="btn btn--ghost btn--sm" @click="replyTo = item.id">回复</button>
          <button v-if="store.isAdmin" class="btn btn--ghost btn--sm btn--danger" @click="remove(item.id)">删除</button>
        </div>
        <div v-if="item.replies.length" style="margin: 12px 0 0 14px; padding-left: 14px; border-left: 2px solid var(--border); display: flex; flex-direction: column; gap: 10px">
          <div v-for="reply in item.replies" :key="reply.id">
            <div class="post-card__meta" style="margin-bottom: 2px">
              <strong style="color: var(--accent)">{{ reply.nickname }}</strong>
              <span>{{ formatDate(reply.created_at) }}</span>
            </div>
            <p style="margin: 0">{{ reply.content }}</p>
            <button v-if="store.isAdmin" class="btn btn--ghost btn--sm btn--danger" style="margin-top: 4px" @click="remove(reply.id)">删除</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty">还没有评论，来抢个沙发吧~</div>

    <div class="card" style="padding: 20px; margin-top: 20px">
      <div v-if="replyTo" class="field" style="display: flex; justify-content: space-between; align-items: center">
        <span class="muted" style="font-size: 0.88rem">正在回复 #{{ replyTo }}</span>
        <button class="btn btn--sm" @click="replyTo = null">取消回复</button>
      </div>
      <div class="field">
        <label>昵称</label>
        <input v-model="nickname" class="input" placeholder="自定义昵称（可留空）" maxlength="24" />
      </div>
      <div class="field">
        <label>评论内容</label>
        <textarea v-model="content" class="textarea" style="min-height: 90px" placeholder="写下你的想法…" maxlength="1000" />
      </div>
      <p v-if="error" style="color: #ef4444; font-size: 0.86rem">{{ error }}</p>
      <button class="btn btn--primary" :disabled="submitting" @click="submit">
        <AppIcon name="message" :size="16" /> {{ submitting ? '提交中…' : '发表评论' }}
      </button>
    </div>
  </section>
</template>
