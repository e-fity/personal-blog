import { notify } from './toast.js'

let token = ''

export function setToken(value) {
  token = value || ''
}

async function request(method, url, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  const path = url.startsWith('http') || url.startsWith('/api') ? url : `/api${url}`
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.error || `请求失败 (${res.status})`
    const isLogin = url.includes('/auth/login')
    if (res.status === 401 && !isLogin) {
      localStorage.removeItem('dg-token')
      if (window.location.pathname.startsWith('/admin') && !window.location.pathname.endsWith('/admin/login')) {
        window.location.href = '/admin/login'
      }
    } else if (method !== 'GET' && !isLogin) {
      notify(msg)
    }
    throw new Error(msg)
  }
  return data
}

const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url)
}

export async function uploadFile(file) {
  const dataUrl =
    typeof file === 'string'
      ? file
      : await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
  const res = await api.post('/upload', { filename: typeof file === 'string' ? 'image.webp' : file.name, data: dataUrl })
  return res.url
}

export default api
