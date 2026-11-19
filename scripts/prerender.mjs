// 构建后为每个路由写一份静态 HTML，把 title / description / canonical / og / twitter 烤进去。
// 正文也在构建期用 src/entry-server.tsx 渲染进 #root，不跑脚本的搜索 / AI 爬虫能读到全文；浏览器里由前端重新渲染接管。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))
const glossary = JSON.parse(readFileSync(join(root, 'src/glossary.json'), 'utf8'))
const BASE = catalog.site.url.replace(/\/$/, '')
const indexHtml = readFileSync(join(root, 'dist/index.html'), 'utf8')

// SSR 包由 vite build --ssr 产出。useLayoutEffect 在服务端的提示不影响输出（前端不做 hydrate），静掉。
const origError = console.error
console.error = (...a) => { if (typeof a[0] === 'string' && a[0].includes('useLayoutEffect does nothing on the server')) return; origError(...a) }
const { render } = await import(join(root, 'dist-ssr/entry-server.js'))
function body(path) {
  const html = render(path)
  if (html.length < 200) throw new Error(`预渲染 ${path} 的正文过短（${html.length} 字符）`)
  return html
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function pageHtml({ title, description, shareTitle, shareDescription, url, type, path }) {
  let html = indexHtml.replace('<div id="root"></div>', () => `<div id="root">${body(path)}</div>`)
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
  writeFileSync(join(dir, 'index.html'), pageHtml({ path: `/${rel}`, ...meta }))
}

const home = catalog.home
writeFileSync(join(root, 'dist/index.html'), pageHtml({
  path: '/',
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

// 未知路径：nginx 以 404 状态返回这份，正文是前端的 404 页，并告诉爬虫不要收录。
writeFileSync(join(root, 'dist/404.html'), pageHtml({
  path: '/404',
  title: '页面不存在 · 从零手写大语言模型',
  description: '这个地址没有对应的页面。',
  shareTitle: '页面不存在 · 从零手写大语言模型',
  shareDescription: '这个地址没有对应的页面。',
  url: `${BASE}/`,
  type: 'website',
}).replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>'))

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
console.log(`[prerender] ${urls.length} 个路由的正文与 meta，外加 404.html / sitemap.xml / robots.txt`)
