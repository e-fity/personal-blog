<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { uploadFile } from '../api.js'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  accept: { type: String, default: 'image/*' },
  title: { type: String, default: '上传文件' },
  hint: { type: String, default: '' }
})

const emit = defineEmits(['close', 'use', 'exif'])

const urlInput = ref('')
const file = ref(null)
const preview = ref('')
const uploading = ref(false)
const error = ref('')
const result = ref('')
const dragging = ref(false)
const inputEl = ref(null)
const urlInputEl = ref(null)
const showLocal = ref(false)
const panelEl = ref(null)
const ratios = [
  { label: '原图', value: '' },
  { label: '1:1', value: '1/1' },
  { label: '4:3', value: '4/3' },
  { label: '16:9', value: '16/9' },
  { label: '3:4', value: '3/4' },
  { label: '9:16', value: '9/16' }
]
const ratio = ref('')
const crop = reactive({ x: 0.5, y: 0.5 })
const imgMeta = reactive({ w: 0, h: 0 })
const exifYear = ref(null)
let draggingCrop = false
let cropStart = { x: 0, y: 0, cx: 0, cy: 0 }

const isImage = computed(() => props.accept.includes('image'))
const isText = computed(() => props.accept.includes('.lrc') || props.accept.includes('.txt'))

const urlPreview = computed(() => {
  const value = urlInput.value.trim().toLowerCase()
  return isImage.value && /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(value)
})

const ratioValue = computed(() => {
  const [rw, rh] = ratio.value.split('/').map(Number)
  return rw && rh ? rw / rh : null
})

const showCrop = computed(() => isImage.value && ratioValue.value !== null && !!preview.value)

const cropImgStyle = computed(() => {
  const r = ratioValue.value
  if (!r || !imgMeta.w || !imgMeta.h) return {}
  const boxW = 320
  const boxH = boxW / r
  const scale = Math.max(boxW / imgMeta.w, boxH / imgMeta.h)
  const dispW = imgMeta.w * scale
  const dispH = imgMeta.h * scale
  const x = crop.x * (dispW - boxW)
  const y = crop.y * (dispH - boxH)
  return { width: `${dispW}px`, height: `${dispH}px`, transform: `translate(${-x}px, ${-y}px)` }
})

function reset() {
  urlInput.value = ''
  file.value = null
  preview.value = ''
  uploading.value = false
  error.value = ''
  result.value = ''
  dragging.value = false
  showLocal.value = false
  ratio.value = ''
  crop.x = 0.5
  crop.y = 0.5
  imgMeta.w = 0
  imgMeta.h = 0
  exifYear.value = null
}

watch(
  () => props.open,
  (value) => {
    if (value) {
      reset()
      nextTick(() => urlInputEl.value?.focus())
    }
  }
)

function choose() {
  inputEl.value?.click()
}

function onFile(e) {
  const f = e.target.files[0]
  if (f) setFile(f)
  e.target.value = ''
}

function onDrop(e) {
  dragging.value = false
  const f = e.dataTransfer?.files[0]
  if (f) setFile(f)
}

function setFile(f) {
  file.value = f
  error.value = ''
  result.value = ''
  if (isImage.value) {
    exifYear.value = null
    const reader = new FileReader()
    reader.onload = () => {
      preview.value = reader.result
      ratio.value = ''
      const img = new Image()
      img.onload = () => {
        imgMeta.w = img.naturalWidth
        imgMeta.h = img.naturalHeight
        crop.x = 0.5
        crop.y = 0.5
      }
      img.src = reader.result
    }
    reader.readAsDataURL(f)
    readExifDate(f).then((info) => {
      if (info) exifYear.value = info
    })
  } else {
    preview.value = ''
  }
}

function onCropDown(e) {
  draggingCrop = true
  cropStart.x = e.clientX
  cropStart.y = e.clientY
  cropStart.cx = crop.x
  cropStart.cy = crop.y
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

function onCropMove(e) {
  if (!draggingCrop) return
  const r = ratioValue.value
  if (!r || !imgMeta.w || !imgMeta.h) return
  const boxW = 320
  const boxH = boxW / r
  const scale = Math.max(boxW / imgMeta.w, boxH / imgMeta.h)
  const dispW = imgMeta.w * scale
  const dispH = imgMeta.h * scale
  const dx = e.clientX - cropStart.x
  const dy = e.clientY - cropStart.y
  crop.x = Math.min(1, Math.max(0, cropStart.cx + dx / Math.max(dispW - boxW, 1)))
  crop.y = Math.min(1, Math.max(0, cropStart.cy + dy / Math.max(dispH - boxH, 1)))
}

function onCropUp() {
  draggingCrop = false
}

async function cropToDataUrl() {
  const r = ratioValue.value
  const img = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = preview.value
  })
  const targetW = 1600
  const targetH = Math.round(targetW / r)
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  const scale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight)
  const cropW = targetW / scale
  const cropH = targetH / scale
  const sx = crop.x * (img.naturalWidth - cropW)
  const sy = crop.y * (img.naturalHeight - cropH)
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, targetW, targetH)
  return canvas.toDataURL('image/webp', 0.9)
}

// 图片压缩：最长边 1600、WebP 输出（SVG/GIF/AVIF 保持原样）
async function compressToDataUrl() {
  const img = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = preview.value
  })
  const max = 1600
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/webp', 0.85)
}

function shouldCompress(file) {
  return /\.(jpe?g|png|webp|bmp)$/i.test(file.name)
}

// 读取 JPEG EXIF 拍摄日期（DateTimeOriginal / DateTime）
async function readExifDate(file) {
  if (!/\.jpe?g$/i.test(file.name)) return null
  try {
    const buf = new Uint8Array(await file.slice(0, 131072).arrayBuffer())
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
    let off = 2
    while (off < buf.length - 4) {
      if (buf[off] !== 0xff) {
        off++
        continue
      }
      const marker = buf[off + 1]
      const len = (buf[off + 2] << 8) | buf[off + 3]
      if (marker === 0xe1 && len > 8) {
        const seg = buf.subarray(off + 4, off + 2 + len)
        if (String.fromCharCode(...seg.subarray(0, 6)) === 'Exif\0\0') return parseExifTiff(seg)
      }
      off += 2 + len
    }
  } catch {
    return null
  }
  return null
}

function parseExifTiff(seg) {
  const le = String.fromCharCode(seg[6], seg[7]) === 'II'
  const u16 = (o) => (le ? seg[o] | (seg[o + 1] << 8) : (seg[o] << 8) | seg[o + 1])
  const u32 = (o) =>
    le
      ? seg[o] | (seg[o + 1] << 8) | (seg[o + 2] << 16) | (seg[o + 3] << 24)
      : (seg[o] << 24) | (seg[o + 1] << 16) | (seg[o + 2] << 8) | seg[o + 3]
  if (u16(8) !== 0x2a) return null
  const ifd0 = u32(10)
  const count = u16(ifd0)
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12
    const tag = u16(entry)
    if (tag === 0x9003 || tag === 0x0132) {
      if (u16(entry + 2) === 2) {
        const len = u32(entry + 4)
        const dataOff = len > 4 ? entry + 8 + u32(entry + 8) : entry + 8
        const dateStr = String.fromCharCode(...seg.subarray(dataOff, dataOff + Math.min(len, 19)))
        const m = dateStr.match(/(\d{4}):(\d{2}):(\d{2})/)
        if (m) return { year: Number(m[1]), date: dateStr.replaceAll(':', '-') }
      }
    }
  }
  return null
}

function useUrl() {
  const value = urlInput.value.trim()
  if (value) emit('use', value)
}

async function upload() {
  if (!file.value) return
  uploading.value = true
  error.value = ''
  try {
    let dataUrl = null
    if (isImage.value && file.value && shouldCompress(file.value)) {
      dataUrl = showCrop.value ? await cropToDataUrl() : await compressToDataUrl()
    }
    result.value = dataUrl ? await uploadFile(dataUrl) : await uploadFile(file.value)
  } catch (e) {
    error.value = e.message
  } finally {
    uploading.value = false
  }
}

function copy() {
  navigator.clipboard?.writeText(result.value)
}

function use() {
  if (result.value) emit('use', result.value)
  if (exifYear.value) emit('exif', { year: exifYear.value.year })
}

function onKey(e) {
  if (e.key === 'Escape' && props.open) emit('close')
  if (e.key === 'Tab' && props.open) {
    const panel = panelEl.value
    if (!panel) return
    const focusables = [...panel.querySelectorAll('button, input, [href], select, textarea')].filter((el) => !el.disabled)
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="modal">
        <div class="modal__overlay" @click="emit('close')" />
        <div ref="panelEl" class="modal__panel glass">
          <div class="modal__head">
            <h3>{{ title }}</h3>
            <button class="icon-btn" title="关闭" @click="emit('close')">
              <AppIcon name="close" :size="18" />
            </button>
          </div>
          <p v-if="hint" class="modal__hint">{{ hint }}</p>

          <div class="field">
            <label>填写文件地址（可粘贴链接）</label>
            <input
              ref="urlInputEl"
              v-model="urlInput"
              class="input"
              placeholder="/uploads/xxx.png 或 https://…"
              @keyup.enter="useUrl"
            />
            <img v-if="urlPreview" class="modal__preview" :src="urlInput" alt="预览" />
          </div>
          <div class="modal__actions" style="margin-top: 0">
            <button class="btn btn--primary" :disabled="!urlInput.trim()" @click="useUrl">使用此地址</button>
          </div>

          <button class="btn btn--ghost btn--sm local-toggle" @click="showLocal = !showLocal">
            {{ showLocal ? '收起本地上传' : '或从本地上传文件' }}
          </button>

          <template v-if="showLocal">
            <div class="modal__divider"><span>选择本地文件</span></div>

            <div
              class="dropzone"
              :class="{ dragging }"
              @click="choose"
              @dragover.prevent="dragging = true"
              @dragleave="dragging = false"
              @drop.prevent="onDrop"
            >
              <input ref="inputEl" type="file" :accept="accept" class="hidden-input" @change="onFile" />
              <AppIcon :name="isImage ? 'image' : 'music'" :size="26" />
              <p v-if="!file">点击选择本地文件，或将文件拖到这里</p>
              <p v-else class="file-name">{{ file.name }}（{{ (file.size / 1024 / 1024).toFixed(2) }} MB）</p>
            </div>

            <div v-if="isImage && file" class="ratio-bar">
              <span class="ratio-bar__label">比例</span>
              <button
                v-for="r in ratios"
                :key="r.value || 'orig'"
                class="filter-chip"
                :class="{ active: ratio === r.value }"
                @click="ratio = r.value"
              >
                {{ r.label }}
              </button>
            </div>

            <div
              v-if="showCrop"
              class="crop-box"
              :style="{ aspectRatio: ratioValue }"
              @pointerdown="onCropDown"
              @pointermove="onCropMove"
              @pointerup="onCropUp"
              @pointercancel="onCropUp"
            >
              <img :src="preview" :style="cropImgStyle" alt="裁剪预览" />
              <span class="crop-box__hint">拖动图片调整裁剪位置</span>
            </div>
            <img v-else-if="isImage && preview" class="modal__preview" :src="preview" alt="预览" />
            <div v-else-if="isText && file" class="modal__preview modal__preview--text">
              文本文件已就绪，点击「开始上传」后会返回一个地址，把它填入歌词字段即可。
            </div>

            <p v-if="error" class="modal__error">{{ error }}</p>

            <div class="modal__actions">
              <button class="btn" :disabled="!file || uploading" @click="upload">
                {{ uploading ? '上传中…' : '开始上传' }}
              </button>
            </div>

            <div v-if="result" class="modal__result">
              <div class="modal__url">{{ result }}</div>
              <div style="display: flex; gap: 8px">
                <button class="btn btn--sm" @click="copy">复制地址</button>
                <button class="btn btn--sm btn--primary" @click="use">使用此地址</button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
