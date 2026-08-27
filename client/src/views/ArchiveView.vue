<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import api from '../api.js'
import * as THREE from '../vendor/three/three.module.js'
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js'

const posts = ref([])
const stageEl = ref(null)
const detail = reactive({ show: false, title: '', date: '', excerpt: '' })

const CARD_RADIUS = 8
const CYCLE = 10 // 圆柱可见 5s + 不可见 5s
const FADE = 0.8

let renderer = null
let scene = null
let camera = null
let controls = null
let clock = null
let cylinderMat = null
let cardGroup = null
let cardMeshes = []
let rafId = 0
let resizeObs = null
let disposed = false
let hoverMesh = null
let pressed = { x: 0, y: 0 }

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const COLOR_WHITE = new THREE.Color(0xffffff)
const COLOR_HOVER = new THREE.Color(0xcfefff)

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ============ 模块一：时间轴全息圆柱（高12 半径2 · 青色 · 菲涅尔辉光 · 扫描线噪波） ============
function createCylinder() {
  const geo = new THREE.CylinderGeometry(2, 2, 12, 64, 1, true)
  cylinderMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vPos = position;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime; uniform float uOpacity;
      varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.6);
        float scan = 0.5 + 0.5 * sin(vPos.y * 36.0 - uTime * 2.2);
        float noise = hash(floor(vPos * 14.0));
        vec3 base = vec3(0.06, 0.80, 0.96);
        vec3 col = base * (0.28 + fresnel * 1.8 + scan * 0.12 + noise * 0.06);
        float alpha = (0.28 + fresnel * 0.75) * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, cylinderMat)
  mesh.position.y = 3
  return mesh
}

// ============ 模块二：归档全息矩形卡片（环形半径8 · 面向圆心 · 永久显示） ============
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = ''
  let yy = y
  for (const ch of String(text).split('')) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = ch
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

function createCardTexture(post) {
  const w = 512
  const h = 700
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, 'rgba(150, 120, 255, 0.30)')
  g.addColorStop(0.5, 'rgba(110, 160, 255, 0.18)')
  g.addColorStop(1, 'rgba(170, 110, 255, 0.26)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = `rgba(180, 210, 255, ${Math.random() * 0.1})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2)
  }

  ctx.strokeStyle = 'rgba(130, 220, 255, 0.95)'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(80, 200, 255, 0.9)'
  ctx.shadowBlur = 18
  ctx.strokeRect(8, 8, w - 16, h - 16)
  ctx.shadowBlur = 0

  return new Promise((resolve) => {
    const iw = w - 24
    const ih = Math.round(iw * 0.62)
    const fallback = () => {
      const pg = ctx.createLinearGradient(12, 12, w - 12, 12 + ih)
      pg.addColorStop(0, '#8fd0f5')
      pg.addColorStop(1, '#c9b8ef')
      ctx.fillStyle = pg
      ctx.fillRect(12, 12, iw, ih)
      finish()
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!img.width) return fallback()
      const scale = Math.max(iw / img.width, ih / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(12, 12, iw, ih, 10)
      ctx.clip()
      ctx.drawImage(img, (iw - dw) / 2 + 12, (ih - dh) / 2 + 12, dw, dh)
      ctx.restore()
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(12, 12, iw, ih)
      finish()
    }
    img.onerror = fallback
    img.src = post.cover || '/images/post-cover-01.svg'

    function finish() {
      ctx.fillStyle = 'rgba(235, 250, 255, 0.96)'
      ctx.font = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif'
      ctx.shadowColor = 'rgba(80, 200, 255, 0.8)'
      ctx.shadowBlur = 10
      wrapText(ctx, post.title, 28, 340, w - 56, 38)
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(150, 220, 255, 0.85)'
      ctx.font = '22px "PingFang SC","Microsoft YaHei",sans-serif'
      ctx.fillText(formatDate(post.created_at), 28, h - 28)

      const tex = new THREE.CanvasTexture(canvas)
      tex.anisotropy = 4
      resolve(tex)
    }
  })
}

async function createCards(list) {
  const group = new THREE.Group()
  const n = list.length
  const topY = 7.2
  const stepY = n > 1 ? 10.5 / (n - 1) : 0
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2
    const y = topY - i * stepY // 最新在最上方
    const x = Math.sin(angle) * CARD_RADIUS
    const z = Math.cos(angle) * CARD_RADIUS
    const tex = await createCardTexture(list[i])
    const geo = new THREE.PlaneGeometry(2.2, 3.0)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.lookAt(0, y, 0)
    mesh.rotation.y += Math.PI
    mesh.userData = { index: i }
    group.add(mesh)
    cardMeshes.push(mesh)
  }
  return group
}

function initScene() {
  const el = stageEl.value
  const w = Math.max(el.clientWidth, 200)
  const h = Math.max(el.clientHeight, 320)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 300)
  camera.position.set(14, 8, 16)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 3, 0)
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.7
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 10
  controls.maxDistance = 34
  controls.maxPolarAngle = Math.PI * 0.55

  scene.add(createCylinder())

  clock = new THREE.Clock()
  bindEvents()
  animate()
}

function setPointer(e) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
}

function onPointerMove(e) {
  setPointer(e)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(cardMeshes)[0]?.object || null
  if (hoverMesh !== hit) {
    hoverMesh = hit
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
  }
}

function onPointerDown(e) {
  pressed = { x: e.clientX, y: e.clientY }
}

function onPointerUp(e) {
  if (Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 6) return
  setPointer(e)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(cardMeshes)[0]
  if (hit) {
    const post = posts.value[hit.object.userData.index]
    detail.title = post.title
    detail.date = formatDate(post.created_at)
    detail.excerpt = (post.excerpt || '').trim()
    detail.show = true
  } else {
    detail.show = false
  }
}

function closeDetail() {
  detail.show = false
}

function bindEvents() {
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
}

function unbindEvents() {
  renderer?.domElement.removeEventListener('pointermove', onPointerMove)
  renderer?.domElement.removeEventListener('pointerdown', onPointerDown)
  renderer?.domElement.removeEventListener('pointerup', onPointerUp)
}

function computeOpacity(t) {
  const phase = t % CYCLE
  if (phase < 5) return phase < FADE ? phase / FADE : 1
  const inv = phase - 5
  return inv < FADE ? 1 - inv / FADE : 0
}

function animate() {
  if (disposed) return
  rafId = requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const elapsed = clock.elapsedTime

  // 圆柱显隐：material.opacity 淡入淡出
  const op = computeOpacity(elapsed)
  cylinderMat.opacity = op
  cylinderMat.uniforms.uTime.value = elapsed
  cylinderMat.uniforms.uOpacity.value = op

  // 卡片 hover 放大高亮
  for (const m of cardMeshes) {
    const active = m === hoverMesh
    const s = m.scale.x + ((active ? 1.08 : 1) - m.scale.x) * Math.min(1, delta * 8)
    m.scale.setScalar(s)
    m.material.color.lerp(active ? COLOR_HOVER : COLOR_WHITE, Math.min(1, delta * 8))
    m.material.opacity += ((active ? 1 : 0.94) - m.material.opacity) * Math.min(1, delta * 8)
  }

  controls.update()
  renderer.render(scene, camera)
}

onMounted(async () => {
  try {
    posts.value = await api.get('/posts?limit=100')
  } catch {
    posts.value = []
  }
  await nextTick()
  if (!posts.value.length || !stageEl.value) return
  initScene()
  cardGroup = await createCards(posts.value)
  scene.add(cardGroup)

  resizeObs = new ResizeObserver(() => {
    const el = stageEl.value
    if (!el || !renderer) return
    renderer.setSize(el.clientWidth, el.clientHeight)
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
  })
  resizeObs.observe(stageEl.value)

  window.__holo3d = {
    cards: cardMeshes.length,
    cylinder: true,
    projectCard(i) {
      const v = cardMeshes[i].getWorldPosition(new THREE.Vector3()).project(camera)
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((-v.y + 1) / 2) * window.innerHeight }
    }
  }
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  resizeObs?.disconnect()
  unbindEvents()
  controls?.dispose()
  scene?.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material.dispose()
      if (o.material.map) o.material.map.dispose()
    }
  })
  renderer?.dispose()
  if (renderer?.domElement && stageEl.value?.contains(renderer.domElement)) {
    stageEl.value.removeChild(renderer.domElement)
  }
})
</script>

<template>
  <div class="archive">
    <div class="section-title">
      <span>归档 · 全息时间轴</span>
      <span class="muted" style="font-size: 0.9rem">
        {{ posts.length }} 篇 · 圆柱 5s 可见 / 5s 隐藏 · 点击卡片查看详情 · 最新在最上方
      </span>
    </div>

    <div v-if="posts.length" ref="stageEl" class="holo3d" />
    <div v-else class="empty">暂无文章</div>

    <div class="holo-detail" :class="{ show: detail.show }">
      <button class="holo-detail__close" title="关闭" @click="closeDetail">×</button>
      <h2>{{ detail.title }}</h2>
      <div class="holo-detail__meta">{{ detail.date }}</div>
      <div class="holo-detail__excerpt">{{ detail.excerpt }}</div>
    </div>
  </div>
</template>
