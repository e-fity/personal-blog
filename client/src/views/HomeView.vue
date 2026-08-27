<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api.js'
import PostCard from '../components/PostCard.vue'
import ProjectCard from '../components/ProjectCard.vue'
import MusicCard from '../components/MusicCard.vue'
import AppIcon from '../components/AppIcon.vue'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()
const posts = ref([])
const featuredPosts = ref([])
const projects = ref([])
const featuredProjects = ref([])
const photos = ref([])

const chips = computed(() => {
  const tags = []
  for (const post of posts.value) {
    for (const tag of post.tags || []) {
      if (!tags.includes(tag)) tags.push(tag)
      if (tags.length >= 4) break
    }
    if (tags.length >= 4) break
  }
  return tags
})

// 展览精品：管理员勾选「精选」的内容优先展示；没有则按最新文章兜底
const hasExhibition = computed(() => featuredPosts.value.length > 0 || featuredProjects.value.length > 0)
const exhibitionPosts = computed(() => (hasExhibition.value ? featuredPosts.value : posts.value.slice(0, 6)))
const exhibitionProjects = computed(() => (hasExhibition.value ? featuredProjects.value : []))

onMounted(async () => {
  try {
    const [all, featured, allProjects, allPhotos] = await Promise.all([
      api.get('/posts?limit=100'),
      api.get('/posts?featured=1&limit=100'),
      api.get('/projects'),
      api.get('/photos')
    ])
    posts.value = all
    featuredPosts.value = featured
    projects.value = allProjects
    featuredProjects.value = allProjects.filter((p) => p.featured)
    photos.value = allPhotos
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <div class="home">
    <div class="home-top">
      <aside class="glass profile-card">
        <img class="profile-card__avatar" :src="store.settings.avatar || '/images/avatar-anime.svg'" alt="头像" />
        <h1>{{ store.settings.name || 'XingHuiSama' }}</h1>
        <p class="profile-card__bio">{{ store.settings.bio || '记录生活 · 分享热爱 · 认真长大' }}</p>
        <div class="profile-card__stats">
          <div><strong>{{ posts.length }}</strong><span>文章</span></div>
          <div><strong>{{ projects.length }}</strong><span>项目</span></div>
          <div><strong>{{ photos.length }}</strong><span>照片</span></div>
        </div>
        <div class="profile-card__socials">
          <a v-for="s in (store.settings.socials || [])" :key="s.name" :href="s.url" target="_blank" rel="noopener" :title="s.name">
            <AppIcon :name="s.icon || 'link'" :size="17" />
          </a>
        </div>
      </aside>

      <div class="glass welcome-card">
        <div class="welcome-card__tagline">✦ WELCOME TO MY GARDEN</div>
        <h2>{{ store.settings.welcome || '欢迎来到星辉的小屋' }}</h2>
        <p>{{ store.settings.tagline }}</p>
        <div class="welcome-card__chips">
          <span v-for="chip in chips" :key="chip"># {{ chip }}</span>
        </div>
      </div>

      <MusicCard />
    </div>

    <section>
      <div class="section-title">
        <span>展览精品</span>
        <RouterLink to="/projects" class="more">更多作品 →</RouterLink>
      </div>
      <div class="masonry">
        <ProjectCard v-for="project in exhibitionProjects" :key="`proj-${project.id}`" :project="project" />
        <PostCard v-for="post in exhibitionPosts" :key="`post-${post.id}`" :post="post" />
      </div>
    </section>
  </div>
</template>
