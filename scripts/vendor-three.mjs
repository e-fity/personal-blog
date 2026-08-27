// 一次性脚本：把 Three.js 模块与所需 addon 复制到 client/src/vendor/three，
// 并把 addon 里 `from 'three'` 改写为相对导入，供 Vite 本地打包（不依赖 CDN / npm）。
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = 'C:/Users/陈立文/AppData/Local/Temp/three-vendor/node_modules/three'
const DST = join(ROOT, 'client', 'src', 'vendor', 'three')

rmSync(DST, { recursive: true, force: true })
mkdirSync(join(DST, 'controls'), { recursive: true })
mkdirSync(join(DST, 'postprocessing'), { recursive: true })
mkdirSync(join(DST, 'shaders'), { recursive: true })

copyFileSync(join(SRC, 'build', 'three.module.js'), join(DST, 'three.module.js'))

const addons = [
  ['controls/OrbitControls.js', 'controls'],
  ['postprocessing/EffectComposer.js', 'postprocessing'],
  ['postprocessing/RenderPass.js', 'postprocessing'],
  ['postprocessing/UnrealBloomPass.js', 'postprocessing'],
  ['postprocessing/Pass.js', 'postprocessing'],
  ['postprocessing/ShaderPass.js', 'postprocessing'],
  ['postprocessing/MaskPass.js', 'postprocessing'],
  ['shaders/CopyShader.js', 'shaders'],
  ['shaders/LuminosityHighPassShader.js', 'shaders']
]

for (const [rel, dir] of addons) {
  const file = join(DST, rel)
  copyFileSync(join(SRC, 'examples', 'jsm', rel), file)
  const code = readFileSync(file, 'utf8').replace(/from\s+'three'/g, "from '../three.module.js'")
  writeFileSync(file, code)
}

console.log('✅ Three.js 本地化完成 ->', DST)
