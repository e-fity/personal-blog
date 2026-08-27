<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const visible = ref(false)
const message = ref('')
let timer = null

function onToast(e) {
  message.value = e.detail?.message || '操作失败'
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (visible.value = false), 2600)
}

onMounted(() => window.addEventListener('app:toast', onToast))
onBeforeUnmount(() => {
  window.removeEventListener('app:toast', onToast)
  clearTimeout(timer)
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="toast">{{ message }}</div>
  </Transition>
</template>
