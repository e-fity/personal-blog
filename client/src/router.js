import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from './stores/app.js'

const routes = [
  { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
  { path: '/projects', name: 'projects', component: () => import('./views/ProjectsView.vue') },
  { path: '/projects/:id', name: 'project', component: () => import('./views/ProjectDetailView.vue') },
  { path: '/search', name: 'search', component: () => import('./views/SearchView.vue') },
  { path: '/music', name: 'music', component: () => import('./views/MusicView.vue') },
  { path: '/photos', name: 'photos', component: () => import('./views/PhotosView.vue') },
  { path: '/collections/:id', name: 'collection', component: () => import('./views/CollectionDetailView.vue') },
  { path: '/blog', name: 'blog', component: () => import('./views/BlogView.vue') },
  { path: '/blog/:id', name: 'post', component: () => import('./views/PostView.vue') },
  { path: '/archive', name: 'archive', component: () => import('./views/ArchiveView.vue') },
  { path: '/guestbook', name: 'guestbook', component: () => import('./views/GuestbookView.vue') },
  { path: '/about', name: 'about', component: () => import('./views/AboutView.vue') },
  { path: '/links', name: 'links', component: () => import('./views/LinksView.vue') },
  { path: '/admin/login', name: 'admin-login', component: () => import('./views/AdminLoginView.vue') },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/AdminView.vue'),
    meta: { requiresAuth: true }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const store = useAppStore()
    if (!store.isAdmin) return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
})

export default router
