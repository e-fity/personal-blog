import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

export function renderMarkdown(source) {
  if (!source) return ''
  return marked.parse(source)
}
