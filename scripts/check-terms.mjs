// 构建期：每个 <Term k> 都必须在名词表里。缺一条就失败。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const glossary = JSON.parse(readFileSync(join(root, 'src/glossary.json'), 'utf8'))
const ids = new Set(glossary.groups.flatMap((g) => g.entries.map((e) => e.id)))
const toc = glossary.toc.map((t) => t.id)
for (const id of toc) {
  if (!ids.has(id)) {
    console.error(`名词表 TOC 指向 #${id}，但没有这条词条`)
    process.exit(1)
  }
}
for (const id of ids) {
  if (!toc.includes(id)) {
    console.error(`名词表词条 #${id} 没有进 TOC`)
    process.exit(1)
  }
}

const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(tsx?|json|html|js|mjs)$/.test(name)) files.push(p)
  }
}
walk(join(root, 'src'))

const re = /<Term\b[^>]*?\bk=\\?"([A-Za-z0-9_-]+)\\?"/g
const missing = []
let n = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(re)) {
    n++
    if (!ids.has(m[1])) missing.push(`${file}: #${m[1]}`)
  }
}
if (n === 0) {
  console.error('没有扫到任何 <Term k>，检查大概没跑对')
  process.exit(1)
}
if (missing.length) {
  console.error(`有 ${missing.length} 个 <Term k> 在名词表里不存在:`)
  for (const line of missing) console.error('  ' + line)
  process.exit(1)
}
console.log(`[check-terms] ${n} 处 <Term k>，${ids.size} 条名词，都对得上`)
