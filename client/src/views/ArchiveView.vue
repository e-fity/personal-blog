<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import api from '../api.js'
import { useAppStore } from '../stores/app.js'
import * as THREE from '../vendor/three/three.module.js'
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js'

const posts = ref([])
const store = useAppStore()
const view = ref(localStorage.getItem('dg-archive-view') || '3d')
const stageEl = ref(null)
const detail = reactive({ show: false, title: '', date: '', excerpt: '', tags: [] })

const CARD_RADIUS = 9.5
const CARD_W = 3.4
const CARD_H = 4.4

let renderer = null
let scene = null
let camera = null
let controls = null
let clock = null
let cardGroup = null
let cardMeshes = []
let innerParticles = null
let groundRing = null
let energyLines = null
let waveMesh = null
let rafId = 0
let resizeObs = null
let disposed = false
let hoverMesh = null
let pressed = { x: 0, y: 0 }

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const COLOR_WHITE = new THREE.Color(0xffffff)
const COLOR_HOVER = new THREE.Color(0x88ddff)

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateShort(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function setView(v) {
  view.value = v
  localStorage.setItem('dg-archive-view', v)
}

// ============ 外层全息光柱（大圆柱 · 菲涅尔 · 扫描线 · 噪波） ============
function createOuterCylinder() {
  const geo = new THREE.CylinderGeometry(3.6, 3.6, 20, 64, 1, true)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
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
      uniform float uTime;
      varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
        float scan = 0.5 + 0.5 * sin(vPos.y * 28.0 - uTime * 1.8);
        float noise = hash(floor(vPos * 10.0));
        // 纵向能量流
        float flow = 0.5 + 0.5 * sin(vPos.y * 4.0 + uTime * 0.8 + hash(floor(vPos.xz * 3.0)) * 6.28);
        vec3 col = vec3(0.08, 0.55, 1.0) * (0.15 + fresnel * 2.2 + scan * 0.08 + noise * 0.04 + flow * 0.12);
        float alpha = (0.12 + fresnel * 0.6) * (0.7 + scan * 0.3);
        gl_FragColor = vec4(col, alpha);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 4
  mesh.userData.isOuter = true
  return mesh
}

// ============ 内层核心光柱（更亮 · 粒子感） ============
function createInnerCylinder() {
  const geo = new THREE.CylinderGeometry(2.2, 2.8, 18, 48, 1, true)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
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
      uniform float uTime;
      varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.8);
        float scan = 0.5 + 0.5 * sin(vPos.y * 50.0 - uTime * 3.0);
        float glow = 0.5 + 0.5 * sin(vPos.y * 2.0 - uTime * 1.2);
        vec3 col = mix(vec3(0.2, 0.7, 1.0), vec3(0.6, 0.9, 1.0), glow);
        col *= (0.3 + fresnel * 1.5 + scan * 0.15);
        float alpha = (0.08 + fresnel * 0.35) * (0.6 + glow * 0.4);
        gl_FragColor = vec4(col, alpha);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 4
  return mesh
}

// ============ 光柱内部上升粒子 ============
function createInnerParticles() {
  const count = 400
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * 2.0
    positions[i * 3] = Math.cos(angle) * r
    positions[i * 3 + 1] = Math.random() * 18 - 5
    positions[i * 3 + 2] = Math.sin(angle) * r
    speeds[i] = 0.5 + Math.random() * 1.5
    sizes[i] = 0.04 + Math.random() * 0.08
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aSpeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        pos.y = mod(pos.y + uTime * aSpeed + 10.0, 18.0) - 5.0;
        // 螺旋运动
        float angle = uTime * 0.3 + position.x * 2.0;
        pos.x = cos(angle) * length(pos.xz);
        pos.z = sin(angle) * length(pos.xz);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 300.0 * uPixelRatio / -mv.z;
        vAlpha = 0.3 + 0.7 * smoothstep(-5.0, 2.0, pos.y) * smoothstep(13.0, 8.0, pos.y);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - d * 2.0;
        gl_FragColor = vec4(0.5, 0.85, 1.0, glow * vAlpha);
      }
    `
  })
  const points = new THREE.Points(geo, mat)
  points.position.y = 4
  return points
}

// ============ 底部发光地面圆盘 ============
function createGroundDisc() {
  const geo = new THREE.CircleGeometry(16, 64)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        float dist = length(vPos.xy);
        float ring1 = smoothstep(0.35, 0.4, dist) * smoothstep(0.5, 0.45, dist);
        float ring2 = smoothstep(0.55, 0.6, dist) * smoothstep(0.7, 0.65, dist);
        float ring3 = smoothstep(0.75, 0.8, dist) * smoothstep(0.95, 0.9, dist);
        float pulse = 0.7 + 0.3 * sin(uTime * 1.5);
        float centerGlow = smoothstep(0.4, 0.0, dist) * 0.4;
        // 能量辐射纹
        float angle = atan(vPos.y, vPos.x);
        float rays = 0.5 + 0.5 * sin(angle * 12.0 + uTime * 0.5);
        rays *= smoothstep(0.9, 0.2, dist);
        vec3 col = vec3(0.05, 0.4, 0.9);
        float alpha = (ring1 + ring2 * 0.7 + ring3 * 0.5) * pulse + centerGlow + rays * 0.08;
        gl_FragColor = vec4(col, alpha * 0.8);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = -5.5
  return mesh
}

// ============ 底部光环（Torus） ============
function createGlowRing(radius, tube, color, opacity) {
  const geo = new THREE.TorusGeometry(radius, tube, 16, 100)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = Math.PI / 2
  return mesh
}

// ============ 能量辐射线 ============
function createEnergyLines() {
  const count = 24
  const positions = new Float32Array(count * 2 * 3)
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const innerR = 3.5
    const outerR = 14 + Math.random() * 3
    positions[i * 6] = Math.cos(angle) * innerR
    positions[i * 6 + 1] = 0
    positions[i * 6 + 2] = Math.sin(angle) * innerR
    positions[i * 6 + 3] = Math.cos(angle) * outerR
    positions[i * 6 + 4] = 0
    positions[i * 6 + 5] = Math.sin(angle) * outerR
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.LineBasicMaterial({
    color: 0x2288ff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.position.y = -5.4
  return lines
}

// ============ 波浪曲面（光柱内部流动的波浪） ============
function createWaveSurface() {
  const geo = new THREE.PlaneGeometry(5, 16, 32, 32)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave1 = sin(pos.x * 1.5 + uTime * 1.2) * 0.3;
        float wave2 = sin(pos.y * 0.8 + uTime * 0.8) * 0.2;
        pos.z += wave1 + wave2;
        vWave = wave1 + wave2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float line = smoothstep(0.48, 0.5, abs(fract(vUv.y * 8.0 + uTime * 0.3) - 0.5));
        float glow = 0.3 + 0.7 * abs(vWave);
        vec3 col = mix(vec3(0.1, 0.5, 1.0), vec3(0.4, 0.8, 1.0), glow);
        float alpha = line * 0.15 + glow * 0.08;
        gl_FragColor = vec4(col, alpha);
      }
    `
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 4
  return mesh
}

// ============ 文章全息卡片纹理（大图 + 标题 + 关键字标签 + 日期） ============
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
  return yy
}

function createCardTexture(post) {
  const w = 640
  const h = 820
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  // 深色半透明背景
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, 'rgba(8, 20, 48, 0.92)')
  bg.addColorStop(0.5, 'rgba(12, 32, 68, 0.88)')
  bg.addColorStop(1, 'rgba(6, 16, 40, 0.92)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 网格背景
  ctx.strokeStyle = 'rgba(60, 140, 255, 0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // 扫描线
  for (let i = 0; i < h; i += 4) {
    ctx.fillStyle = `rgba(100, 180, 255, ${0.02 + Math.random() * 0.02})`
    ctx.fillRect(0, i, w, 1)
  }

  // 发光边框
  ctx.strokeStyle = 'rgba(80, 180, 255, 0.9)'
  ctx.lineWidth = 3
  ctx.shadowColor = 'rgba(60, 160, 255, 0.9)'
  ctx.shadowBlur = 20
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.shadowBlur = 0

  // 四角装饰
  const cornerSize = 24
  ctx.strokeStyle = 'rgba(120, 220, 255, 1)'
  ctx.lineWidth = 3
  const corners = [[10, 10, 1, 1], [w - 10, 10, -1, 1], [10, h - 10, 1, -1], [w - 10, h - 10, -1, -1]]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + dy * cornerSize)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + dx * cornerSize, cy)
    ctx.stroke()
  }

  return new Promise((resolve) => {
    const iw = w - 48
    const ih = Math.round(iw * 0.58)
    const iy = 36
    const fallback = () => {
      const pg = ctx.createLinearGradient(24, iy, w - 24, iy + ih)
      pg.addColorStop(0, '#1a4a8a')
      pg.addColorStop(0.5, '#2a6abf')
      pg.addColorStop(1, '#1a3a7a')
      ctx.fillStyle = pg
      ctx.fillRect(24, iy, iw, ih)
      // 占位图上的装饰
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.3)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(24, iy + ih * (0.2 + i * 0.15))
        ctx.lineTo(w - 24, iy + ih * (0.3 + i * 0.12))
        ctx.stroke()
      }
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
      ctx.roundRect(24, iy, iw, ih, 8)
      ctx.clip()
      ctx.drawImage(img, (iw - dw) / 2 + 24, (ih - dh) / 2 + iy, dw, dh)
      ctx.restore()
      // 图片上的蓝色叠加
      ctx.fillStyle = 'rgba(20, 80, 180, 0.15)'
      ctx.fillRect(24, iy, iw, ih)
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.5)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(24, iy, iw, ih)
      finish()
    }
    img.onerror = fallback
    img.src = post.cover || '/images/post-cover-01.svg'

    function finish() {
      const contentY = iy + ih + 28

      // 标题
      ctx.fillStyle = 'rgba(230, 245, 255, 0.98)'
      ctx.font = 'bold 34px "PingFang SC","Microsoft YaHei",sans-serif'
      ctx.shadowColor = 'rgba(80, 180, 255, 0.8)'
      ctx.shadowBlur = 12
      const titleEnd = wrapText(ctx, post.title, 36, contentY, w - 72, 42)
      ctx.shadowBlur = 0

      // 标签关键字
      const tags = Array.isArray(post.tags) ? post.tags : []
      let tagX = 36
      let tagY = titleEnd + 28
      ctx.font = '20px "PingFang SC","Microsoft YaHei",sans-serif'
      for (const tag of tags.slice(0, 4)) {
        const tagText = String(tag)
        const tw = ctx.measureText(tagText).width + 24
        if (tagX + tw > w - 36) {
          tagX = 36
          tagY += 36
        }
        ctx.fillStyle = 'rgba(40, 100, 200, 0.5)'
        ctx.beginPath()
        ctx.roundRect(tagX, tagY - 22, tw, 30, 6)
        ctx.fill()
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = 'rgba(150, 210, 255, 0.95)'
        ctx.fillText(tagText, tagX + 12, tagY)
        tagX += tw + 10
      }

      // 底部日期和装饰线
      const bottomY = h - 40
      ctx.strokeStyle = 'rgba(80, 160, 255, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(36, bottomY - 16)
      ctx.lineTo(w - 36, bottomY - 16)
      ctx.stroke()

      ctx.fillStyle = 'rgba(120, 190, 255, 0.8)'
      ctx.font = '20px "PingFang SC","Microsoft YaHei",sans-serif'
      ctx.fillText(formatDate(post.created_at), 36, bottomY + 8)

      // 右侧 ID 装饰
      ctx.fillStyle = 'rgba(80, 160, 255, 0.5)'
      ctx.font = '18px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`#${String(post.id).padStart(4, '0')}`, w - 36, bottomY + 8)
      ctx.textAlign = 'left'

      const tex = new THREE.CanvasTexture(canvas)
      tex.anisotropy = 8
      resolve(tex)
    }
  })
}

async function createCards(list) {
  const group = new THREE.Group()
  const n = list.length
  // 分多层环：每层最多 5 张
  const perLayer = 5
  const layers = Math.ceil(n / perLayer)
  const layerHeight = 4.5
  const topY = 7.5

  for (let i = 0; i < n; i++) {
    const layer = Math.floor(i / perLayer)
    const inLayer = i % perLayer
    const layerCount = Math.min(perLayer, n - layer * perLayer)
    const angle = (inLayer / layerCount) * Math.PI * 2 + layer * 0.4
    const y = topY - layer * layerHeight
    const radius = CARD_RADIUS + (layer % 2) * 0.8 // 奇偶层半径交替
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius

    const tex = await createCardTexture(list[i])
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.lookAt(0, y, 0)
    mesh.rotation.y += Math.PI
    mesh.userData = { index: i, baseY: y, layer }
    group.add(mesh)
    cardMeshes.push(mesh)
  }
  return group
}

function initScene() {
  const el = stageEl.value
  const w = Math.max(el.clientWidth, 200)
  const h = Math.max(el.clientHeight, 400)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  el.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 300)
  camera.position.set(16, 6, 18)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 2, 0)
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.5
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 12
  controls.maxDistance = 36
  controls.maxPolarAngle = Math.PI * 0.6

  // 外层光柱
  scene.add(createOuterCylinder())
  // 内层光柱
  scene.add(createInnerCylinder())
  // 内部波浪
  waveMesh = createWaveSurface()
  scene.add(waveMesh)
  // 内部上升粒子
  innerParticles = createInnerParticles()
  scene.add(innerParticles)

  // 底部地面圆盘
  groundRing = createGroundDisc()
  scene.add(groundRing)
  // 底部光环（多层）
  const ring1 = createGlowRing(4.5, 0.08, 0x44aaff, 0.8)
  ring1.position.y = -5.3
  scene.add(ring1)
  const ring2 = createGlowRing(8, 0.05, 0x2288ff, 0.5)
  ring2.position.y = -5.35
  scene.add(ring2)
  const ring3 = createGlowRing(12, 0.04, 0x1166dd, 0.3)
  ring3.position.y = -5.4
  scene.add(ring3)
  // 能量辐射线
  energyLines = createEnergyLines()
  scene.add(energyLines)

  // 环境光
  const ambient = new THREE.AmbientLight(0x335588, 0.6)
  scene.add(ambient)
  const pointLight = new THREE.PointLight(0x4499ff, 2, 40)
  pointLight.position.set(0, 4, 0)
  scene.add(pointLight)

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
    detail.tags = post.tags || []
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

function animate() {
  if (disposed) return
  rafId = requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const elapsed = clock.elapsedTime

  // 更新所有 shader 的 uTime
  scene.traverse((o) => {
    if (o.material && o.material.uniforms && o.material.uniforms.uTime) {
      o.material.uniforms.uTime.value = elapsed
    }
  })

  // 波浪面旋转
  if (waveMesh) waveMesh.rotation.y = elapsed * 0.15

  // 能量线脉动
  if (energyLines) {
    energyLines.material.opacity = 0.15 + 0.15 * Math.sin(elapsed * 2)
    energyLines.rotation.y = elapsed * 0.05
  }

  // 卡片 hover 放大高亮 + 浮动
  for (const m of cardMeshes) {
    const active = m === hoverMesh
    const targetScale = active ? 1.1 : 1
    const s = m.scale.x + (targetScale - m.scale.x) * Math.min(1, delta * 6)
    m.scale.setScalar(s)
    m.material.color.lerp(active ? COLOR_HOVER : COLOR_WHITE, Math.min(1, delta * 6))
    // 浮动
    m.position.y = m.userData.baseY + Math.sin(elapsed * 0.8 + m.userData.index * 0.5) * 0.15
  }

  if (view.value === '3d') {
    controls.update()
    renderer.render(scene, camera)
  }
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
      <span>{{ store.t('archiveTitle') }}</span>
      <span class="archive-view-toggle">
        <button :class="{ active: view === '3d' }" @click="setView('3d')">3D 全息</button>
        <button :class="{ active: view === 'list' }" @click="setView('list')">列表</button>
      </span>
    </div>

    <div v-if="posts.length" ref="stageEl" v-show="view === '3d'" class="holo3d" />
    <div v-else class="empty">暂无文章</div>

    <div v-if="view === 'list' && posts.length" class="archive-list">
      <RouterLink v-for="post in posts" :key="post.id" :to="`/blog/${post.id}`" class="archive-card">
        <div class="archive-card__cover">
          <img :src="post.cover || '/images/post-cover-01.svg'" :alt="post.title" />
        </div>
        <div class="archive-card__body">
          <div class="archive-card__meta">
            <span class="archive-card__date">{{ formatDate(post.created_at) }}</span>
            <span v-if="!post.published" class="tag">草稿</span>
            <span v-if="post.featured" class="tag tag--accent">精选</span>
          </div>
          <h3 class="archive-card__title">{{ post.title }}</h3>
          <p class="archive-card__excerpt">{{ post.excerpt || '暂无摘要' }}</p>
          <div v-if="post.tags?.length" class="archive-card__tags">
            <span v-for="tag in post.tags.slice(0, 4)" :key="tag" class="archive-card__tag">{{ tag }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <div class="holo-detail" :class="{ show: detail.show }">
      <button class="holo-detail__close" title="关闭" @click="closeDetail">×</button>
      <h2>{{ detail.title }}</h2>
      <div class="holo-detail__meta">{{ detail.date }}</div>
      <div v-if="detail.tags?.length" class="holo-detail__tags">
        <span v-for="t in detail.tags" :key="t" class="holo-detail__tag">{{ t }}</span>
      </div>
      <div class="holo-detail__excerpt">{{ detail.excerpt }}</div>
    </div>
  </div>
</template>

<style scoped>
.archive {
  position: relative;
}
.holo3d {
  width: 100%;
  height: 72vh;
  min-height: 500px;
  border-radius: 16px;
  overflow: hidden;
  background: radial-gradient(ellipse at center bottom, #0a1838 0%, #050a18 50%, #020510 100%);
  border: 1px solid rgba(60, 140, 255, 0.2);
  box-shadow: 0 0 60px rgba(30, 100, 220, 0.15), inset 0 0 80px rgba(20, 60, 150, 0.1);
}
.holo3d :deep(canvas) {
  display: block;
}
.archive-view-toggle {
  display: flex;
  gap: 4px;
}
.archive-view-toggle button {
  padding: 4px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}
.archive-view-toggle button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.archive-list {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.archive-card {
  display: flex;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: all 0.25s ease;
  min-height: 160px;
}
.archive-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}
.archive-card__cover {
  width: 33.33%;
  flex: none;
  position: relative;
  overflow: hidden;
  clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%);
}
.archive-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}
.archive-card:hover .archive-card__cover img {
  transform: scale(1.05);
}
.archive-card__body {
  flex: 1;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.archive-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
  color: var(--muted);
}
.archive-card__date {
  font-family: monospace;
}
.archive-card__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.archive-card:hover .archive-card__title {
  color: var(--accent);
}
.archive-card__excerpt {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.archive-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}
.archive-card__tag {
  padding: 2px 10px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 10px;
  font-size: 0.75rem;
}
.tag--accent {
  background: var(--accent);
  color: #fff;
}
@media (max-width: 640px) {
  .archive-card {
    flex-direction: column;
    min-height: auto;
  }
  .archive-card__cover {
    width: 100%;
    height: 160px;
    clip-path: polygon(0 0, 100% 0, 100% 88%, 0 100%);
  }
}
.holo-detail {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.9);
  width: 90%;
  max-width: 520px;
  background: rgba(8, 20, 48, 0.95);
  border: 1px solid rgba(80, 180, 255, 0.5);
  border-radius: 16px;
  padding: 28px;
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s;
  box-shadow: 0 0 60px rgba(30, 100, 220, 0.4);
  backdrop-filter: blur(10px);
}
.holo-detail.show {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}
.holo-detail__close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.5rem;
  cursor: pointer;
}
.holo-detail__close:hover {
  color: #fff;
}
.holo-detail h2 {
  margin: 0 0 8px;
  color: #e6f5ff;
  font-size: 1.3rem;
}
.holo-detail__meta {
  color: rgba(120, 190, 255, 0.8);
  font-size: 0.88rem;
  margin-bottom: 16px;
}
.holo-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.holo-detail__tag {
  padding: 3px 10px;
  background: rgba(40, 100, 200, 0.4);
  border: 1px solid rgba(100, 180, 255, 0.4);
  border-radius: 10px;
  font-size: 0.78rem;
  color: rgba(150, 210, 255, 0.95);
}
.holo-detail__excerpt {
  color: rgba(200, 220, 255, 0.85);
  font-size: 0.92rem;
  line-height: 1.7;
  max-height: 200px;
  overflow-y: auto;
}
</style>
