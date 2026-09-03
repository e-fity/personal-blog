<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'
import AppIcon from './../components/AppIcon.vue'

const store = useAppStore()
const links = ref([])
const settings = computed(() => store.settings)

// 友链申请
const applications = ref([])
const form = ref({
  nickname: localStorage.getItem('dg-nickname') || '',
  link_name: '',
  link_url: '',
  content: ''
})
const submitting = ref(false)
const formError = ref('')
const formSuccess = ref(false)

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function loadLinks() {
  try {
    links.value = await api.get('/links')
  } catch {
    links.value = []
  }
}

async function loadApplications() {
  try {
    const all = await api.get('/messages?type=link_apply')
    // 前台只展示审核中或已通过的，拒绝的不展示
    applications.value = all.filter((m) => m.status !== 'rejected')
  } catch {
    applications.value = []
  }
}

async function submitApply() {
  const linkName = form.value.link_name.trim()
  const linkUrl = form.value.link_url.trim()
  const content = form.value.content.trim()
  if (!linkName || !linkUrl || !content) {
    formError.value = '请填写站点名称、链接和简介'
    return
  }
  if (!/^https?:\/\//i.test(linkUrl)) {
    formError.value = '站点链接需以 http:// 或 https:// 开头'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    if (form.value.nickname.trim()) localStorage.setItem('dg-nickname', form.value.nickname.trim())
    await api.post('/messages', {
      type: 'link_apply',
      nickname: form.value.nickname.trim() || '访客',
      link_name: linkName,
      link_url: linkUrl,
      content
    })
    formSuccess.value = true
    form.value.link_name = ''
    form.value.link_url = ''
    form.value.content = ''
    setTimeout(() => (formSuccess.value = false), 4000)
    await loadApplications()
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

const statusMap = {
  pending: { label: '审核中', class: 'status--pending' },
  approved: { label: '已通过', class: 'status--approved' },
  rejected: { label: '未通过', class: 'status--rejected' }
}

onMounted(async () => {
  await Promise.all([loadLinks(), loadApplications()])
})
</script>

<template>
  <div>
    <div class="section-title"><span>{{ store.t('linksTitle') }}</span></div>
    <p class="muted" style="margin: -10px 0 22px">一些常逛的优质站点，欢迎来串门。</p>
    <div class="grid grid--links">
      <a v-for="link in links" :key="link.id" class="card card--hover" style="padding: 20px; display: flex; gap: 14px; align-items: center; color: inherit" :href="link.url" target="_blank" rel="noopener">
        <img :src="link.logo || '/images/avatar.svg'" alt="" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover; flex: none" />
        <div style="min-width: 0">
          <div style="display: flex; align-items: center; gap: 6px">
            <strong style="font-size: 1rem">{{ link.name }}</strong>
            <AppIcon name="external" :size="14" style="color: var(--text-faint)" />
          </div>
          <div class="muted" style="font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ link.description }}</div>
        </div>
      </a>
    </div>
    <div v-if="!links.length" class="empty">暂无友链</div>

    <!-- 友链申请 -->
    <div class="card" style="padding: 24px; margin-top: 32px">
      <h3 style="margin: 0 0 6px; font-size: 1.1rem">友链申请</h3>
      <p class="muted" style="margin: 0 0 20px; font-size: 0.9rem">{{ settings.friendApply || '欢迎申请友链，请填写你的站点信息，我会在看到后尽快处理。' }}</p>

      <div class="apply-form">
        <div class="apply-form__row">
          <div class="field">
            <label>站点名称 <span class="required">*</span></label>
            <input v-model="form.link_name" class="input" placeholder="你的博客/网站名称" maxlength="60" />
          </div>
          <div class="field">
            <label>站点链接 <span class="required">*</span></label>
            <input v-model="form.link_url" class="input" placeholder="https://example.com" maxlength="255" />
          </div>
        </div>
        <div class="field">
          <label>站点简介 <span class="required">*</span></label>
          <textarea v-model="form.content" class="textarea" style="min-height: 80px" placeholder="简单介绍一下你的站点，以及想交换友链的原因" maxlength="600" />
        </div>
        <div class="field">
          <label>昵称（可选）</label>
          <input v-model="form.nickname" class="input" placeholder="怎么称呼你" maxlength="24" />
        </div>
        <p v-if="formError" style="color: #ef4444; font-size: 0.86rem; margin: 0 0 10px">{{ formError }}</p>
        <p v-if="formSuccess" style="color: #22c55e; font-size: 0.86rem; margin: 0 0 10px">申请已提交，等待博主审核~</p>
        <button class="btn btn--primary" :disabled="submitting" @click="submitApply">
          <AppIcon name="link" :size="16" /> {{ submitting ? '提交中…' : '提交申请' }}
        </button>
      </div>
    </div>

    <!-- 申请列表 -->
    <div v-if="applications.length" style="margin-top: 28px">
      <h3 style="font-size: 1rem; margin: 0 0 14px">友链申请记录（{{ applications.length }}）</h3>
      <div style="display: flex; flex-direction: column; gap: 12px">
        <div v-for="app in applications" :key="app.id" class="card apply-item">
          <div class="apply-item__head">
            <div class="apply-item__site">
              <strong>{{ app.link_name }}</strong>
              <a :href="app.link_url" target="_blank" rel="noopener" class="apply-item__url">{{ app.link_url }}</a>
            </div>
            <span :class="['status', statusMap[app.status]?.class || 'status--pending']">{{ statusMap[app.status]?.label || '审核中' }}</span>
          </div>
          <p class="apply-item__content">{{ app.content }}</p>
          <div class="apply-item__meta">
            <span>{{ app.nickname }}</span>
            <span>{{ formatDate(app.created_at) }}</span>
          </div>
          <div v-if="app.reply" class="apply-item__reply">
            <strong>博主回复</strong>
            <p>{{ app.reply }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apply-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.required {
  color: #ef4444;
}
.apply-item {
  padding: 16px 20px;
}
.apply-item__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.apply-item__site {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.apply-item__site strong {
  font-size: 0.98rem;
}
.apply-item__url {
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
  word-break: break-all;
}
.apply-item__url:hover {
  text-decoration: underline;
}
.apply-item__content {
  margin: 0 0 8px;
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.6;
}
.apply-item__meta {
  display: flex;
  gap: 14px;
  font-size: 0.8rem;
  color: var(--muted);
}
.apply-item__reply {
  margin-top: 12px;
  padding: 12px 14px;
  background: var(--accent-soft);
  border-radius: 10px;
}
.apply-item__reply strong {
  color: var(--accent);
  font-size: 0.82rem;
}
.apply-item__reply p {
  margin: 4px 0 0;
  font-size: 0.88rem;
}
.status {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  flex: none;
}
.status--pending {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}
.status--approved {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}
.status--rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}
@media (max-width: 600px) {
  .apply-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
