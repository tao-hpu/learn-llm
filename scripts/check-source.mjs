// 构建期源码约束。违反任何一条，pnpm build 失败。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const problems = []

const forbidden = [
  'dangerouslySetInnerHTML',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'getElementById',
  'querySelectorAll',
  'querySelector',
]
const htmlTag = /<(b|code|span|div|p|a|br|i|sub|sup|section|button|style|script|ul|li|h[1-6])\b/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(src)
for (const file of files) {
  if (file.endsWith('.boot.js') || file.endsWith('.json') && file.includes('/content/')) {
    problems.push(`${file}: 旧页面产物不应再出现`)
  }
  const text = readFileSync(file, 'utf8')
  if (/from\s+['"][^'"]*\.boot(\.js)?['"]/.test(text) || text.includes('expandTerms')) {
    problems.push(`${file}: 不得导入或运行旧页面脚本`)
  }
  if (/href\s*=\s*['"][^'"]*\d{2}_[a-z0-9_]+_viz\.html/.test(text) || /to=\{?['"][^'"]*\d{2}_[a-z0-9_]+_viz\.html/.test(text)) {
    problems.push(`${file}: 源码里还有指向旧章节 html 的链接`)
  }
  if (!/\.(tsx?|css|json)$/.test(file)) continue
  for (const word of forbidden) {
    if (text.includes(word)) problems.push(`${file}: 出现了禁用的 ${word}`)
  }
  if (file.endsWith('.json')) {
    if (htmlTag.test(text)) problems.push(`${file}: JSON 里存放了 HTML 字符串`)
  } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    const assigned = text.match(/(?:const|let|var)\s+\w+\s*=\s*(`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")/g) ?? []
    for (const s of assigned) {
      if (htmlTag.test(s)) problems.push(`${file}: 字符串常量里有 HTML：${s.slice(0, 80)}`)
    }
  }
}

const catalog = JSON.parse(readFileSync(join(src, 'catalog.json'), 'utf8'))
const app = readFileSync(join(src, 'App.tsx'), 'utf8')
for (const ch of catalog.chapters) {
  if (!ch.ready) continue
  const name = ch.slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  const page = join(src, 'pages', `${name}.tsx`)
  if (!existsSync(page)) {
    problems.push(`ready 章节 ${ch.slug} 没有页面组件 src/pages/${name}.tsx`)
    continue
  }
  const body = readFileSync(page, 'utf8')
  if (!body.includes('ChapterShell')) problems.push(`${name}.tsx: 步骤导航必须走 ChapterShell`)
  for (const tag of ['<Term', '<Dig', '<HpBar']) {
    if (!body.includes(tag)) problems.push(`${name}.tsx: 缺少 ${tag}`)
  }
  const css = join(src, 'pages', `${name}.module.css`)
  if (!existsSync(css)) problems.push(`${name}.tsx: 缺少同名 ${name}.module.css`)
  else {
    const rules = readFileSync(css, 'utf8')
    if (/:root\s*\{/.test(rules) || /\.term\s*\{/.test(rules) || /\.hp-bar\s*\{/.test(rules) || /\.step-tab\s*\{/.test(rules) || /\.dig\s*\{/.test(rules)) {
      problems.push(`${name}.module.css: 含有已在 site.css 里的公共规则`)
    }
  }
  if (!app.includes(name)) problems.push(`App.tsx 没有挂上 ${name}`)
}

if (problems.length) {
  console.error(`[check-source] ${problems.length} 个问题:`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('[check-source] 页面组件、禁用 API、HTML 字符串、旧文件名，都通过')
