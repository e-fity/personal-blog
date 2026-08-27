// 轻量全局提示（事件驱动，避免与 Pinia 循环依赖）
export function notify(message, type = 'error') {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }))
}
