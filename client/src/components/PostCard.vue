<script setup>
import { tagClass } from '../tags.js'

const props = defineProps({
  post: { type: Object, required: true },
  type: { type: String, default: 'post' } // 'post' | 'essay'
})

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

const detailPath = () => (props.type === 'essay' ? `/essay/${props.post.id}` : `/blog/${props.post.id}`)
</script>

<template>
  <RouterLink :to="detailPath()" class="glass card card--hover post-card" style="color: inherit">
    <div class="post-card__cover-wrap">
      <img class="post-card__cover" :src="post.cover || '/images/post-cover-01.svg'" :alt="post.title" loading="lazy" />
    </div>
    <div class="post-card__body">
      <div class="post-card__meta">
        <span>{{ formatDate(post.created_at) }}</span>
        <span v-if="post.featured" class="tag tag--frontend">精选</span>
        <span v-for="tag in (post.tags || [])" :key="tag" :class="tagClass(tag)">{{ tag }}</span>
      </div>
      <h3 class="post-card__title">{{ post.title }}</h3>
      <p class="post-card__excerpt">{{ post.excerpt }}</p>
      <div class="post-card__footer">
        <span class="post-card__author">XingHuiSama</span>
        <span>·</span>
        <span>阅读全文 →</span>
      </div>
    </div>
  </RouterLink>
</template>
