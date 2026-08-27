<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  items: { type: Array, required: true },
  index: { type: Number, required: true }
})
const emit = defineEmits(['close', 'update:index'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowLeft') emit('update:index', (props.index - 1 + props.items.length) % props.items.length)
  if (e.key === 'ArrowRight') emit('update:index', (props.index + 1) % props.items.length)
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="lightbox" @click.self="emit('close')">
      <img class="lightbox__img" :src="items[index].url" :alt="items[index].title" />
      <div class="lightbox__caption">{{ items[index].title }}</div>
      <button class="lightbox__close" title="关闭" @click="emit('close')">
        <AppIcon name="close" :size="22" />
      </button>
      <button class="lightbox__arrow lightbox__arrow--prev" title="上一张" @click="emit('update:index', (index - 1 + items.length) % items.length)">
        <AppIcon name="chevron-left" :size="22" />
      </button>
      <button class="lightbox__arrow lightbox__arrow--next" title="下一张" @click="emit('update:index', (index + 1) % items.length)">
        <AppIcon name="chevron-right" :size="22" />
      </button>
    </div>
  </Teleport>
</template>
