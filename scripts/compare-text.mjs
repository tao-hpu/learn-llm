// 用 Playwright 对照旧 HTML 和新站：每章每一步的可见文字，以及交互、375px 横向滚动。
// 用法：先 pnpm build，再 node scripts/compare-text.mjs
// 旧站只读，不起 llm-from-scratch 里的任何写操作。
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))
const oldRoot = join(process.env.HOME, 'Workspace/fim-ai/llm-from-scratch/web')
const ready = catalog.chapters.filter((c) => c.ready)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
}

function staticServer(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      let path = decodeURIComponent(url.pathname)
      if (path === '/') path = '/index.html'
      const file = normalize(join(dir, path))
      if (!file.startsWith(dir)) {
        res.writeHead(403)
        res.end()
        return
      }
      try {
        statSync(file)
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
        res.end(readFileSync(file))
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function normLines(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
}

async function visibleText(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.code-link, .colab')]
    const saved = nodes.map((el) => [el, el.textContent])
    for (const el of nodes) el.textContent = ''
    const text = document.body.innerText
    for (const [el, t] of saved) el.textContent = t
    return text
  })
}

function lineDiff(a, b) {
  const out = []
  const max = Math.max(a.length, b.length)
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (j < b.length && (i >= a.length || !a.slice(i, i + 6).includes(b[j]))) {
      out.push(`+ ${b[j]}`)
      j++
      continue
    }
    if (i < a.length && (j >= b.length || !b.slice(j, j + 6).includes(a[i]))) {
      out.push(`- ${a[i]}`)
      i++
      continue
    }
    out.push(`- ${a[i]}`)
    out.push(`+ ${b[j]}`)
    i++
    j++
    if (out.length > 80) {
      out.push('… 差异过多，后面略')
      break
    }
    if (max > 0 && out.length > max) break
  }
  return out
}

async function openHash(page, url) {
  const hash = new URL(url).hash
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1', { timeout: 8000 })
  if (!hash) return
  const step = hash.match(/(\d+)$/)
  if (!step) return
  const id = 'panel' + (Number(step[1]) - 1)
  await page.waitForFunction((pid) => {
    const el = document.getElementById(pid)
    return !!el && el.classList.contains('active')
  }, id, { timeout: 8000 })
}

async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true })
  } catch {
    return chromium.launch({ headless: true })
  }
}

const oldServer = await staticServer(oldRoot)
const oldOrigin = `http://127.0.0.1:${oldServer.address().port}`
const previewServer = await preview({
  root,
  preview: { port: 5192, strictPort: false },
})
const newOrigin = (previewServer.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${previewServer.config.preview.port}`).replace(/\/$/, '')
const browser = await launch()

const report = []
const checks = []

function note(page, item, status) {
  checks.push({ page, item, status })
}

async function compareOne(label, oldUrl, newUrl) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const a = await ctx.newPage()
  const b = await ctx.newPage()
  const errors = []
  b.on('pageerror', (err) => errors.push(String(err)))
  await openHash(a, oldUrl)
  await openHash(b, newUrl)
  const da = normLines(await visibleText(a))
  const db = normLines(await visibleText(b))
  const same = da.join('\n') === db.join('\n')
  const diff = same ? [] : lineDiff(da, db)
  report.push({ label, same, diffCount: diff.length, diff, errors })
  await ctx.close()
  return errors
}

try {
  await compareOne('首页', `${oldOrigin}/index.html`, `${newOrigin}/`)
  await compareOne('名词表', `${oldOrigin}/glossary.html`, `${newOrigin}/glossary`)

  for (const ch of ready) {
    for (const step of ch.steps) {
      const label = `${ch.num} ${ch.slug} #${step.anchor}`
      await compareOne(
        label,
        `${oldOrigin}/${ch.file}#${step.anchor}`,
        `${newOrigin}/ch/${ch.slug}#${step.anchor}`,
      )
    }
  }

  // 交互与窄屏。只点新站。
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))

  async function overflow() {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${newOrigin}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1')
  note('首页', '375px 无横向滚动', (await overflow()) <= 1 ? '已点过' : `有问题：scrollWidth 多出 ${await overflow()}px`)
  await page.goto(`${newOrigin}/glossary`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.gentry')
  note('名词表', '375px 无横向滚动', (await overflow()) <= 1 ? '已点过' : `有问题：scrollWidth 多出 ${await overflow()}px`)
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto(`${newOrigin}/#phase-3`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#phase-3')
  await page.waitForTimeout(50)
  const phaseSeen = await page.evaluate(() => {
    const el = document.getElementById('phase-3')
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0
  })
  note('首页', '加载时 #phase-3 滚到对应位置', phaseSeen ? '已点过' : '有问题：阶段不在视口里')

  await page.goto(`${newOrigin}/glossary#softmax`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#softmax')
  const glossHit = await page.evaluate(() => document.getElementById('softmax')?.className.includes('gentry') ?? false)
  note('名词表', '#softmax 锚点', glossHit ? '已点过' : '有问题：没有落到 #softmax')

  for (const ch of ready) {
    const base = `${newOrigin}/ch/${ch.slug}`
    errors.length = 0
    await page.setViewportSize({ width: 1280, height: 900 })
    await openHash(page, `${base}#${ch.steps[0].anchor}`)

    let tabsOk = true
    const tabCount = await page.locator('.step-tab').count()
    for (let i = 0; i < tabCount; i++) {
      await page.locator('.step-tab').nth(i).click()
      const active = await page.evaluate((idx) => {
        const tabs = [...document.querySelectorAll('.step-tab')]
        const on = tabs[idx]?.classList.contains('active')
        const only = tabs.filter((t) => t.classList.contains('active')).length === 1
        const panel = document.getElementById('panel' + idx)?.classList.contains('active')
        return on && only && panel
      }, i)
      if (!active) tabsOk = false
    }
    note(ch.slug, '步骤 tab 切换且只有一个 active', tabsOk ? '已点过' : '有问题：active 态或面板对不上')

    await page.locator('.step-tab').nth(0).click()
    await page.locator('#nextBtn').click()
    const forward = await page.evaluate(() => location.hash)
    await page.locator('#prevBtn').click()
    const back = await page.evaluate(() => location.hash)
    const navOk = forward.endsWith(ch.steps[1].anchor) && back.endsWith(ch.steps[0].anchor)
    note(ch.slug, '上一步 / 下一步', navOk ? '已点过' : `有问题：下一步 ${forward}，上一步 ${back}`)

    await openHash(page, `${base}#${ch.steps[0].anchor}`)
    const ranges = page.locator('input[type="range"]')
    const rangeCount = await ranges.count()
    if (rangeCount === 0) {
      note(ch.slug, '滑块', '这一页没有 range 滑块')
    } else {
      let rangeOk = true
      for (let i = 0; i < rangeCount; i++) {
        const before = await ranges.nth(i).inputValue()
        await ranges.nth(i).evaluate((el) => {
          const input = el
          const max = Number(input.max || 100)
          const min = Number(input.min || 0)
          input.value = String(min + (max - min) * 0.2)
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
        })
        const after = await ranges.nth(i).inputValue()
        if (after === before && Number(before) !== Number(after)) rangeOk = false
        if (after === before) {
          // 起点碰巧就是 20% 时再拨到另一头
          await ranges.nth(i).evaluate((el) => {
            const input = el
            input.value = String(input.max || 100)
            input.dispatchEvent(new Event('input', { bubbles: true }))
          })
          if ((await ranges.nth(i).inputValue()) === before) rangeOk = false
        }
      }
      note(ch.slug, `滑块 ${rangeCount} 个`, rangeOk ? '已点过' : '有问题：拨动后值没有变')
    }

    if (ch.slug === 'posttraining') {
      await openHash(page, `${base}#step-2`)
      await page.getByText('中期训练', { exact: true }).click()
      await page.waitForTimeout(80)
      const stayed = await page.evaluate(() => {
        const text = document.body.innerText
        return text.includes('STAGE 1 · 预训练') && !text.includes('STAGE 2 · 中期训练')
      })
      note(ch.slug, '点「中期训练」不切换阶段', stayed ? '已点过' : '有问题：阶段被气泡点击带走了')
    }

    // 每个面板里的按钮点一下。跳过上一步/下一步，那两项上面单独记。
    let btnProblems = []
    for (let i = 0; i < ch.steps.length; i++) {
      await page.locator('.step-tab').nth(i).click()
      const buttons = page.locator('.panel.active button, .panel.active .btn')
      const n = await buttons.count()
      for (let k = 0; k < n; k++) {
        const label = (await buttons.nth(k).innerText()).trim().slice(0, 40)
        try {
          await buttons.nth(k).click({ timeout: 1500 })
        } catch (err) {
          btnProblems.push(`第 ${i + 1} 步「${label}」${err.message.split('\n')[0]}`)
        }
      }
    }
    note(ch.slug, '各步按钮', btnProblems.length ? `有问题：${btnProblems.join('；')}` : '已点过')

    await openHash(page, `${base}#${ch.steps[0].anchor}`)
    const term = page.locator('.panel.active .term').first()
    if (await term.count()) {
      await term.hover()
      await page.waitForTimeout(80)
      const tip = await page.evaluate(() => {
        const el = document.getElementById('termTip')
        return {
          show: !!el?.classList.contains('show'),
          text: el?.innerText ?? '',
        }
      })
      note(ch.slug, '名词气泡', tip.show && tip.text.includes('更多') ? '已点过' : `有问题：气泡 show=${tip.show} text=${tip.text.slice(0, 80)}`)
      if (tip.show) {
        await page.locator('#termTip .tt-more').click()
        await page.waitForURL(/\/glossary#/)
        const landed = await page.evaluate(() => location.pathname + location.hash)
        note(ch.slug, '气泡链到名词表', landed.startsWith('/glossary#') ? `已点过 ${landed}` : `有问题：${landed}`)
      }
    } else {
      note(ch.slug, '名词气泡', '有问题：第一步没有 .term')
    }

    const last = ch.steps[ch.steps.length - 1]
    await openHash(page, `${base}#${last.anchor}`)
    await page.locator('#nextBtn').click()
    await page.waitForTimeout(200)
    const celebrated = await page.evaluate(() => {
      const banner = document.querySelector('.congrats.show, .congrats')
      const shown = !!document.querySelector('.congrats.show')
      const title = (banner?.innerText ?? '').split('\n').map((s) => s.trim()).filter(Boolean)[0] ?? ''
      return { shown, text: title }
    })
    note(ch.slug, '最后一步完成庆祝', celebrated.shown ? `已点过 ${celebrated.text}` : '有问题：没有 .congrats.show')

    await page.setViewportSize({ width: 375, height: 812 })
    let wide = 0
    for (const step of ch.steps) {
      await openHash(page, `${base}#${step.anchor}`)
      wide = Math.max(wide, await overflow())
    }
    note(ch.slug, '375px 无横向滚动', wide <= 1 ? '已点过' : `有问题：最多多出 ${wide}px`)

    if (errors.length) note(ch.slug, '页面异常', `有问题：${errors.join(' | ')}`)
    else note(ch.slug, '页面异常', '已点过，没有 pageerror')
  }

  await ctx.close()
} finally {
  await browser.close()
  await previewServer.close()
  await new Promise((resolve) => oldServer.close(resolve))
}

const diffDoc = ['# 迁移文字对照', '', '空白折叠成一行一个空格后，按行比较可见文字。对照前去掉了「源码 / Colab」链接的文字。', '']
let bad = 0
for (const row of report) {
  diffDoc.push(`## ${row.label}`, '')
  diffDoc.push(row.same ? '差异行数：0' : `差异行数：${row.diffCount}`)
  if (!row.same) {
    bad++
    diffDoc.push('', '```diff')
    diffDoc.push(...row.diff.slice(0, 60))
    diffDoc.push('```')
  }
  if (row.errors.length) diffDoc.push('', '页面错误：', ...row.errors.map((e) => `- ${e}`))
  diffDoc.push('')
}
diffDoc.push(`合计 ${report.length} 处，其中 ${bad} 处有差异。`)
writeFileSync(join(root, 'docs/migration-diff.md'), diffDoc.join('\n') + '\n')

const byPage = new Map()
for (const row of checks) {
  if (!byPage.has(row.page)) byPage.set(row.page, [])
  byPage.get(row.page).push(row)
}
const checkDoc = ['# 迁移交互清单', '', '下列各项由脚本在 Chrome 里点过。状态只有「已点过」和「有问题」。', '']
for (const [page, rows] of byPage) {
  checkDoc.push(`## ${page}`, '')
  for (const row of rows) checkDoc.push(`- ${row.item}：${row.status}`)
  checkDoc.push('')
}
writeFileSync(join(root, 'docs/migration-checklist.md'), checkDoc.join('\n') + '\n')

console.log(`diff ${report.length} pages, ${bad} with differences`)
for (const row of report) if (!row.same) console.log(' DIFF', row.label, row.diffCount)
for (const row of checks) if (row.status.startsWith('有问题')) console.log(' CHECK', row.page, row.item, row.status)
if (bad) process.exitCode = 2
