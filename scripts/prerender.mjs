// 构建后为每个路由写一份静态 HTML，把 title / description / canonical / og / twitter 烤进去。
// 不跑 JS 的分享爬虫读的是这份。正文仍由前端接管。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))
const glossary = JSON.parse(readFileSync(join(root, 'src/glossary.json'), 'utf8'))
const BASE = catalog.site.url.replace(/\/$/, '')
const indexHtml = readFileSync(join(root, 'dist/index.html'), 'utf8')

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function pageHtml({ title, description, shareTitle, shareDescription, url, type }) {
  let html = indexHtml
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(title)}</title>`)
  const set = (re, val) => { html = html.replace(re, (_m, a, b) => `${a}${escAttr(val)}${b}`) }
  set(/(<meta name="description" content=")[^"]*(")/, description)
  set(/(<meta property="og:title" content=")[^"]*(")/, shareTitle)
  set(/(<meta property="og:description" content=")[^"]*(")/, shareDescription)
  set(/(<meta property="og:type" content=")[^"]*(")/, type)
  set(/(<meta property="og:url" content=")[^"]*(")/, url)
  set(/(<meta name="twitter:title" content=")[^"]*(")/, shareTitle)
  set(/(<meta name="twitter:description" content=")[^"]*(")/, shareDescription)
  set(/(<link rel="canonical" href=")[^"]*(")/, url)
  return html
}

function writePage(rel, meta) {
  const dir = join(root, 'dist', rel)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), pageHtml(meta))
}

const home = catalog.home
writeFileSync(join(root, 'dist/index.html'), pageHtml({
  title: home.docTitle,
  description: home.description,
  shareTitle: home.shareTitle,
  shareDescription: home.shareDescription,
  url: BASE,
  type: 'website',
}))

const pages = [
  {
    rel: 'glossary',
    title: glossary.docTitle,
    description: glossary.description,
    shareTitle: glossary.shareTitle,
    shareDescription: glossary.shareDescription,
    url: `${BASE}/glossary`,
    type: 'article',
  },
  {
    rel: 'notes',
    title: '学习札记 · 彩蛋',
    description: '正课之外的边角料:Transformer 的前世今生;12.75T token 的真实训练日志里出过什么岔子;Qwen3.8-Flash-Next 与 DeepSeek-V4-Flash 逐个零件对照本仓库章节。',
    shareTitle: '学习札记 · 从零手写大语言模型',
    shareDescription: '正课之外的边角料:Transformer 的前世今生;12.75T token 的真实训练日志里出过什么岔子;Qwen3.8-Flash-Next 与 DeepSeek-V4-Flash 逐个零件对照本仓库章节。',
    url: `${BASE}/notes`,
    type: 'article',
  },
  {
    rel: 'about',
    title: '关于本项目 · 从零手写大语言模型',
    description: 'LLM from Scratch 是什么、页面怎么用、21 章分哪五个阶段、代码与硬件、致谢与许可。',
    shareTitle: '关于本项目 · 从零手写大语言模型',
    shareDescription: 'LLM from Scratch 是什么、页面怎么用、21 章分哪五个阶段、代码与硬件、致谢与许可。',
    url: `${BASE}/about`,
    type: 'article',
  },
]

for (const p of pages) writePage(p.rel, p)

for (const ch of catalog.chapters) {
  writePage(`ch/${ch.slug}`, {
    title: ch.docTitle,
    description: ch.description,
    shareTitle: ch.shareTitle,
    shareDescription: ch.description,
    url: `${BASE}/ch/${ch.slug}`,
    type: 'article',
  })
}

const urls = [
  `${BASE}/`,
  `${BASE}/glossary`,
  `${BASE}/notes`,
  `${BASE}/about`,
  ...catalog.chapters.map((c) => `${BASE}/ch/${c.slug}`),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u, i) => `  <url><loc>${u}</loc><priority>${i === 0 ? '1.0' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`
writeFileSync(join(root, 'dist/sitemap.xml'), sitemap)
writeFileSync(join(root, 'dist/robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`)
console.log(`[prerender] ${urls.length} 个路由的 meta，外加 sitemap.xml / robots.txt`)
