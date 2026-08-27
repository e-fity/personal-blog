const CATEGORY_MAP = [
  { type: 'frontend', keywords: ['vue', 'react', 'typescript', 'javascript', 'css', 'html', 'echarts', 'canvas', 'nuxt', 'next', 'svelte', 'vite', 'webpack', 'tailwind', '前端'] },
  { type: 'backend', keywords: ['node', 'express', 'fastapi', 'python', 'java', 'go', 'rust', 'django', 'flask', 'websocket', 'api', '后端'] },
  { type: 'database', keywords: ['sql', 'sqlite', 'postgres', 'postgresql', 'mysql', 'mongodb', 'redis', '数据库', 'orm', 'prisma'] },
  { type: 'tool', keywords: ['cli', 'docker', 'git', '工具', 'devops', 'ci', '测试', 'lrc', '音频'] }
]

export function tagCategory(tag) {
  const value = String(tag).toLowerCase()
  for (const group of CATEGORY_MAP) {
    if (group.keywords.some((k) => value.includes(k))) return group.type
  }
  return 'default'
}

export function tagClass(tag) {
  const type = tagCategory(tag)
  return type === 'default' ? 'tag' : `tag tag--${type}`
}
