// 同一套操作打在旧 HTML（file://）和新站上，比当前面板的文字、SVG 几何和高亮。
// 用法：先 pnpm build，再 pnpm compare:behavior。旧仓只读。
// ONLY=03:step-6,gpt-machine:part-2 只跑点名的章或步，用来复查。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { preview } from 'vite'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))
const oldRoot = join(process.env.HOME, 'Workspace/fim-ai/llm-from-scratch/web')
const ready = catalog.chapters.filter((c) => c.ready)
const only = (process.env.ONLY || '').split(',').filter(Boolean)
const previewServer = await preview({
  root,
  preview: { port: 5193, strictPort: false },
})
const newOrigin = (previewServer.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:5193').replace(/\/$/, '')

function wanted(ch, step) {
  if (!only.length) return true
  return only.some((item) => item === ch.num || item === ch.slug || item === `${ch.num}:${step.anchor}` || item === `${ch.slug}:${step.anchor}`)
}

function launch() {
  return chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }))
}

async function seed(context) {
  await context.addInitScript(() => {
    let s = 20241119
    Math.random = () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0
      return s / 4294967296
    }
  })
}

async function reseed(page) {
  await page.evaluate(() => {
    let s = 20241119
    Math.random = () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0
      return s / 4294967296
    }
  })
}

function panelFn() {
  const MARK = ['active', 'on', 'sel', 'primary', 'hl', 'picked', 'top', 'show', 'open', 'good', 'bad', 'rowsel']
  const panel = document.querySelector('section.panel.active')
  if (!panel) return { text: '', svg: '', marks: '' }
  const shown = (el) => {
    let n = el
    while (n && n.nodeType === 1) {
      if (n.hidden) return false
      const s = getComputedStyle(n)
      if (s.display === 'none' || s.visibility === 'hidden') return false
      n = n.parentElement
    }
    return true
  }
  const text = panel.innerText.replace(/\u00a0/g, ' ').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
  const svg = [...panel.querySelectorAll('line,circle,rect,path,polyline,polygon,text')].filter(shown).map((el) => {
    const bits = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'width', 'height', 'd', 'points'].map((name) => {
      const raw = el.getAttribute(name)
      if (raw == null) return ''
      const rounded = raw.replace(/-?\d+(?:\.\d+)?/g, (n) => String(Math.round(Number(n))))
      return `${name}=${rounded}`
    }).filter(Boolean)
    const label = (el.textContent || '').replace(/\s+/g, ' ').trim()
    return `${el.tagName} ${bits.join(' ')} ${label}`.trim()
  }).join('\n')
  const marks = [...panel.querySelectorAll('*')].filter(shown).map((el) => {
    const names = []
    for (const c of el.classList) {
      const chunks = c.split(/[^A-Za-z0-9]+/).flatMap((part) => part.split(/(?=[A-Z])/)).map((s) => s.toLowerCase())
      for (const m of MARK) {
        if (c === m || c.includes(`_${m}_`) || c.endsWith(`_${m}`) || chunks.includes(m)) names.push(m)
      }
    }
    const style = (el.getAttribute('style') || '').toLowerCase().replace(/\s+/g, '')
    if (style.includes('var(--good)') || style.includes('#3f7d63') || style.includes('rgb(63,125,99)')) names.push('good')
    if (style.includes('var(--bad)') || style.includes('#9a3a22') || style.includes('rgb(154,58,34)')) names.push('bad')
    const uniq = [...new Set(names)]
    if (!uniq.length) return ''
    const label = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim().slice(0, 24)
    // 色块自己没有文字，旧页用 var(--good) 上色，新页用同色十六进制。只比带文字的好坏标记。
    if (!label && uniq.every((n) => n === 'good' || n === 'bad')) return ''
    return `${uniq.sort().join('.')} ${label}`
  }).filter(Boolean).join('\n')
  return { text, svg, marks }
}

async function shot(page) {
  return page.evaluate(panelFn)
}

async function waitActive(page) {
  await page.waitForSelector('h1', { timeout: 8000 })
  await page.waitForFunction(() => document.querySelectorAll('section.panel.active').length === 1, null, { timeout: 8000 })
}

async function settle(page) {
  let prev = ''
  let quiet = 0
  for (let i = 0; i < 160; i++) {
    await page.clock.runFor(250)
    const snap = await shot(page)
    const now = `${snap.text}\n${snap.svg}\n${snap.marks}`
    if (now === prev) quiet += 1
    else { prev = now; quiet = 0 }
    if (quiet >= 2) return
  }
}

function numbers(line) {
  return [...line.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
}

function svgClose(a, b) {
  const as = a.split('\n')
  const bs = b.split('\n')
  if (as.length !== bs.length) return false
  for (let i = 0; i < as.length; i++) {
    if (as[i] === bs[i]) continue
    const skel = (line) => line.replace(/-?\d+(?:\.\d+)?/g, '#')
    if (skel(as[i]) !== skel(bs[i])) return false
    const av = numbers(as[i])
    const bv = numbers(bs[i])
    if (av.some((v, k) => Math.abs(v - bv[k]) > 1)) return false
  }
  return true
}

function svgProgress(a, b) {
  const still = (line) => !/^(polyline|circle|path)\b/.test(line)
  const left = a.split('\n').filter(still)
  const right = b.split('\n').filter(still)
  if (left.join('\n') === right.join('\n')) return true
  return svgClose(left.join('\n'), right.join('\n'))
}

function allow(line) {
  return /confetti|彩纸|粒子|reduced-motion|横幅|完成 🎉|#step-99|#step-0|#part-99|越界/.test(line)
}

function firstDelta(a, b) {
  const as = a.split('\n')
  const bs = b.split('\n')
  const n = Math.max(as.length, bs.length)
  for (let i = 0; i < n; i++) {
    if ((as[i] || '') !== (bs[i] || '')) {
      return `第 ${i + 1} 行不同\n旧: ${(as[i] || '').slice(0, 220)}\n新: ${(bs[i] || '').slice(0, 220)}`
    }
  }
  return ''
}

const diffs = []
function pushDiff(label, kind, oldText, newText) {
  if (oldText === newText) return
  if (kind === 'SVG' && (svgClose(oldText, newText) || svgProgress(oldText, newText))) return
  const body = `${firstDelta(oldText, newText)}\n旧:\n${oldText.slice(0, 500)}\n新:\n${newText.slice(0, 500)}`
  if (allow(body)) return
  diffs.push({ label, kind, body })
}

const EXTRA = ['tok', 'bcell', 'pstage', 'ref-chip', 'lnode']

async function clickIndex(page, index) {
  return page.evaluate((n) => {
    const panel = document.querySelector('section.panel.active')
    if (!panel) return false
    const nodes = [...panel.querySelectorAll('button, .btn')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 1 && r.height > 1 && !el.disabled
    })
    const el = nodes[n]
    if (!el) return false
    el.click()
    return true
  }, index)
}

async function clickExtra(page, index) {
  return page.evaluate(({ n, names }) => {
    const panel = document.querySelector('section.panel.active')
    if (!panel) return false
    const nodes = [...panel.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) return false
      for (const c of el.classList) {
        for (const name of names) {
          if (c === name || new RegExp(`(?:^|_)${name}(?:_|$)`).test(c)) return true
        }
      }
      return false
    })
    const el = nodes[n]
    if (!el) return false
    el.click()
    return true
  }, { n: index, names: EXTRA })
}

async function setSlider(page, index, mode) {
  return page.evaluate(({ n, mode: which }) => {
    const panel = document.querySelector('section.panel.active')
    if (!panel) return false
    const el = [...panel.querySelectorAll('input[type="range"]')][n]
    if (!el) return false
    const min = Number(el.min || 0)
    const max = Number(el.max || 100)
    const mid = Math.round((min + max) / 2)
    const value = which === 'min' ? min : which === 'max' ? max : mid
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { n: index, mode })
}

const browser = await launch()
try {
  for (const ch of ready) {
    for (const step of ch.steps) {
      if (!wanted(ch, step)) continue
      const label = `${ch.num} ${ch.slug} #${step.anchor}`
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      await seed(ctx)
      const oldPage = await ctx.newPage()
      const newPage = await ctx.newPage()
      await oldPage.clock.install()
      await newPage.clock.install()
      const oldUrl = `${pathToFileURL(join(oldRoot, ch.file)).href}#${step.anchor}`
      const newUrl = `${newOrigin}/ch/${ch.slug}#${step.anchor}`
      try {
        await oldPage.goto(oldUrl, { waitUntil: 'domcontentloaded' })
        await newPage.goto(newUrl, { waitUntil: 'domcontentloaded' })
        await waitActive(oldPage)
        await waitActive(newPage)
        await settle(oldPage)
        await settle(newPage)
        const first = await Promise.all([shot(oldPage), shot(newPage)])
        pushDiff(label + ' 初始', '文字', first[0].text, first[1].text)
        pushDiff(label + ' 初始', 'SVG', first[0].svg, first[1].svg)
        pushDiff(label + ' 初始', '高亮', first[0].marks, first[1].marks)

        const nBtn = await oldPage.evaluate(() => {
          const panel = document.querySelector('section.panel.active')
          if (!panel) return 0
          return [...panel.querySelectorAll('button, .btn')].filter((el) => el.getBoundingClientRect().width > 1 && !el.disabled).length
        })
        for (let i = 0; i < Math.min(nBtn, 12); i++) {
          await reseed(oldPage)
          await reseed(newPage)
          await clickIndex(oldPage, i)
          await clickIndex(newPage, i)
          await settle(oldPage)
          await settle(newPage)
          const once = await Promise.all([shot(oldPage), shot(newPage)])
          pushDiff(`${label} 按钮${i} ×1`, '文字', once[0].text, once[1].text)
          pushDiff(`${label} 按钮${i} ×1`, 'SVG', once[0].svg, once[1].svg)
          pushDiff(`${label} 按钮${i} ×1`, '高亮', once[0].marks, once[1].marks)
          for (let k = 0; k < 4; k++) {
            await clickIndex(oldPage, i)
            await clickIndex(newPage, i)
          }
          await settle(oldPage)
          await settle(newPage)
          const more = await Promise.all([shot(oldPage), shot(newPage)])
          pushDiff(`${label} 按钮${i} ×5`, '文字', more[0].text, more[1].text)
          pushDiff(`${label} 按钮${i} ×5`, '高亮', more[0].marks, more[1].marks)
        }

        const nExtra = await oldPage.evaluate((names) => {
          const panel = document.querySelector('section.panel.active')
          if (!panel) return 0
          return [...panel.querySelectorAll('*')].filter((el) => {
            const r = el.getBoundingClientRect()
            if (r.width <= 1 || r.height <= 1) return false
            for (const c of el.classList) {
              for (const name of names) {
                if (c === name || new RegExp(`(?:^|_)${name}(?:_|$)`).test(c)) return true
              }
            }
            return false
          }).length
        }, EXTRA)
        for (let i = 0; i < Math.min(nExtra, 8); i++) {
          await reseed(oldPage)
          await reseed(newPage)
          await clickExtra(oldPage, i)
          await clickExtra(newPage, i)
          await settle(oldPage)
          await settle(newPage)
          const hit = await Promise.all([shot(oldPage), shot(newPage)])
          pushDiff(`${label} 可点${i}`, '文字', hit[0].text, hit[1].text)
          pushDiff(`${label} 可点${i}`, '高亮', hit[0].marks, hit[1].marks)
        }

        const nRange = await oldPage.evaluate(() => document.querySelectorAll('section.panel.active input[type="range"]').length)
        for (let i = 0; i < nRange; i++) {
          for (const mode of ['min', 'mid', 'max']) {
            await reseed(oldPage)
            await reseed(newPage)
            await setSlider(oldPage, i, mode)
            await setSlider(newPage, i, mode)
            await settle(oldPage)
            await settle(newPage)
            const slid = await Promise.all([shot(oldPage), shot(newPage)])
            pushDiff(`${label} 滑块${i} ${mode}`, '文字', slid[0].text, slid[1].text)
            pushDiff(`${label} 滑块${i} ${mode}`, 'SVG', slid[0].svg, slid[1].svg)
          }
        }
      } catch (err) {
        diffs.push({ label, kind: '打开失败', body: String(err).split('\n')[0] })
      }
      await ctx.close()
    }
  }
} finally {
  await browser.close()
  await previewServer.close()
}

const lines = [
  '# 行为对照',
  '',
  '旧页用 file://，新页用预览。同一套点击和滑块之后，比当前面板的文字、SVG 几何和高亮。',
  '动画用假时钟拨到停稳再比。每次点击前把 Math.random 拨回同一个种子。',
  '白名单：通关横幅、confetti、减少动效、越界深链。坐标差 1 像素以内、藏起来的图不算差异。',
  '',
]
if (!diffs.length) lines.push('差异：0')
else {
  lines.push(`差异：${diffs.length}`, '')
  for (const row of diffs.slice(0, 80)) {
    lines.push(`## ${row.label} · ${row.kind}`, '', '```', row.body, '```', '')
  }
}
writeFileSync(join(root, 'docs/behavior-diff.md'), lines.join('\n') + '\n')
console.log(`behavior diffs ${diffs.length}`)
if (diffs.length) process.exitCode = 1
