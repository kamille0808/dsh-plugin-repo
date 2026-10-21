/**
 * 客户端构建链：esbuild bundle src/client/index.jsx → CJS → 包一层 Lazy-CJS
 * 工厂协议（window.__ModuleLoader__.load({id, factory})）→ lib/client.js。
 *
 * externals 全部走浏览器侧基线共享模块（react / @deepseek-ai/*），
 * 见 docs/client-ui-design.md §5。
 *
 * 用法：node build.mjs            # 构建 + 协议自测
 *       node build.mjs --check    # 仅自测已有产物
 */
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(root, 'src/client/index.jsx')
const outfile = path.join(root, 'lib/client.js')
const moduleId = 'dsh-plugin-repo/client'

async function bundle() {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    target: 'es2022',
    jsx: 'automatic',
    outfile,
    external: ['react', 'react/*', '@deepseek-ai/*'],
    minify: false,
    sourcemap: false,
    logLevel: 'info',
    write: false,
  })
  const body = result.outputFiles[0].text
  const wrapped = `window.__ModuleLoader__.load({
\tid: "${moduleId}",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${body.split('\n').map((line) => `\t\t${line}`).join('\n')}
\t\treturn module.exports;
\t}
});
`
  await mkdir(path.dirname(outfile), { recursive: true })
  await writeFile(outfile, wrapped)
  console.log(`built ${outfile} (${wrapped.length} bytes)`)
}

/** 协议自测：Node 侧模拟 __ModuleLoader__ 执行工厂，断言客户端插件面存在。 */
async function selfTest() {
  const source = await readFile(outfile, 'utf8')
  const registry = new Map()
  globalThis.window = {
    __ModuleLoader__: {
      load: (registration) => registry.set(registration.id, registration),
    },
  }
  try {
    // eslint-disable-next-line no-eval -- 构建产物自测（可信本地输入）
    (0, eval)(source)
  } finally {
    delete globalThis.window
  }
  const registration = registry.get(moduleId)
  if (!registration) throw new Error('self-test: 产物未注册模块')
  // 基线共享模块在 Node 侧不存在，用透传 Proxy 桩代替：仅验证工厂能执行并导出插件面
  const stubModule = new Proxy(function StubComponent() {}, {
    get: (target, prop) => {
      if (prop === Symbol.toPrimitive) return () => 'stub'
      if (prop === '$$typeof' || typeof prop === 'symbol') return undefined
      return new Proxy(function StubComponent() {}, {})
    },
  })
  const stubRequire = (specifier) => {
    if (specifier === 'react' || specifier === 'react/jsx-runtime' || specifier.startsWith('@deepseek-ai/')) return stubModule
    throw new Error(`self-test: 未声明的外部依赖 ${specifier}`)
  }
  const exports = registration.factory(stubRequire)
  if (typeof exports.apply !== 'function' || !Array.isArray(exports.inject)) {
    throw new Error(`self-test: 客户端面不完整 ${JSON.stringify(Object.keys(exports))}`)
  }
  console.log(`self-test ok: ${moduleId} exports ${JSON.stringify(Object.keys(exports))}, inject ${JSON.stringify(exports.inject)}`)
}

const checkOnly = process.argv.includes('--check')
if (!checkOnly) await bundle()
await selfTest()
