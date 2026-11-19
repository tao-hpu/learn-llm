// 用 Playwright 对照两侧每章每一步的可见文字，并在当前 dist 上点交互、查 375px 横向滚动。
// 用法：先 pnpm build，再 pnpm compare（对照 origin/main 的构建，报告写 docs/compare-text.md）。
// --ref=<git ref> 对照别的提交；--ref=legacy 对照迁移前的单文件旧页（报告写 docs/migration-diff.md）。
// --allow-diff 有差异也以 0 退出。参数见 scripts/compare-ref.mjs。
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { parseArgs, prepareRef, requireDist } from './compare-ref.mjs'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))
const opts = parseArgs()
const legacy = opts.legacy
requireDist(root)
const ref = prepareRef(root, opts)
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
  return page.evaluate((strip) => {
    const root = document.querySelector('.wrap') || document.querySelector('main.main') || document.body
    // legacy 模式去掉新旧两边写法不同的链接文字；main 模式两侧同一套 DOM，不去。
    const nodes = strip ? [...root.querySelectorAll('.code-link, .colab, .filename, .home-link')] : []
    const saved = nodes.map((el) => [el, el.textContent])
    for (const el of nodes) el.textContent = ''
    const text = root.innerText
    for (const [el, t] of saved) el.textContent = t
    return text
  }, legacy)
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
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  try {
    await page.waitForSelector('h1', { timeout: 8000 })
  } catch (err) {
    throw new Error(`${url} 没有出现 h1：${err.message.split('\n')[0]}`)
  }
  if (!hash) return
  const step = hash.match(/(\d+)$/)
  if (!step) return
  const index = Number(step[1]) - 1
  try {
    await page.waitForFunction((n) => {
      const panels = [...document.querySelectorAll('section.panel')]
      const active = panels.filter((p) => p.classList.contains('active'))
      if (active.length !== 1) return false
      if (active[0].id === 'panel' + n) return true
      return panels.indexOf(active[0]) === n
    }, index, { timeout: 8000 })
  } catch (err) {
    throw new Error(`${url} 没有激活第 ${index + 1} 步：${err.message.split('\n')[0]}`)
  }
}

async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true })
  } catch {
    return chromium.launch({ headless: true })
  }
}

const oldServer = legacy ? await staticServer(ref.dir) : null
const refPreview = legacy ? null : await preview({
  root: ref.dir,
  preview: { port: 5194, strictPort: false },
})
const oldOrigin = legacy
  ? `http://127.0.0.1:${oldServer.address().port}`
  : refPreview.resolvedUrls.local[0].replace(/\/$/, '')
// legacy 用旧文件名，main 两侧同一套路由。
const oldPath = (legacyFile, route) => (legacy ? `/${legacyFile}` : route)
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

async function verifyShell(page, base) {
  await page.goto(`${base}?fresh=${Date.now()}#step-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#panel0.active')
  await page.locator('.step-tab').nth(2).click()
  await page.waitForFunction(() => location.hash === '#step-3' && !!document.getElementById('panel2')?.classList.contains('active'))
  note('posttraining', '路由 hash 切到第 3 步', '已点过')
  await page.goto(`${base}?fresh=${Date.now()}#step-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#panel0.active')
  await page.locator('#panel0').getByText('tiny(第1-3章)', { exact: true }).first().click()
  await page.waitForTimeout(450)
  const widthBefore = await page.locator('#panel0 [class*="trk"] > div').first().evaluate((el) => el.style.width)
  await page.locator('.step-tab').nth(1).click()
  const hidden = await page.locator('#panel0').evaluate((el) => getComputedStyle(el).display === 'none' && !el.classList.contains('active'))
  await page.locator('.step-tab').nth(0).click()
  const widthAfter = await page.locator('#panel0 [class*="trk"] > div').first().evaluate((el) => el.style.width)
  const step1 = await page.locator('#panel0').innerText()
  const barsOk = !!widthBefore && widthBefore !== '0%' && widthBefore === widthAfter && step1.includes('tiny(第1-3章)') && hidden
  note('posttraining', '第 1 步选择保留，条形动画不重播', barsOk ? '已点过' : `有问题：宽 ${widthBefore} → ${widthAfter}，隐藏=${hidden}`)

  await page.locator('.step-tab').nth(1).click()
  await page.locator('#panel1 [class*="pstage"]').nth(2).click()
  await page.locator('#panel1 summary').first().click()
  await page.locator('.step-tab').nth(0).click()
  await page.locator('.step-tab').nth(1).click()
  const step2 = await page.locator('#panel1').innerText()
  const digOpen = await page.locator('#panel1 details').first().evaluate((el) => el.open)
  note('posttraining', '第 2 步阶段和折叠保留', step2.includes('STAGE 3 · SFT') && digOpen ? '已点过' : '有问题：阶段或折叠丢了')

  await page.locator('.step-tab').nth(2).click()
  await page.locator('#panel2').getByRole('button', { name: /LoRA SFT/ }).click()
  await page.locator('.step-tab').nth(0).click()
  await page.locator('.step-tab').nth(2).click()
  const cellKept = await page.locator('#panel2').getByRole('button', { name: /LoRA SFT/ }).evaluate((el) => el.className.includes('cellSel'))
  note('posttraining', '第 3 步格子选择保留', cellKept ? '已点过' : '有问题：格子回到了默认')

  await page.locator('.step-tab').nth(3).click()
  await page.locator('#panel3').getByRole('button', { name: '对照:连指令也算' }).click()
  await page.locator('.step-tab').nth(0).click()
  await page.locator('.step-tab').nth(3).click()
  const modeKept = await page.locator('#panel3').getByRole('button', { name: '对照:连指令也算' }).evaluate((el) => el.classList.contains('primary'))
  note('posttraining', '第 4 步遮罩选择保留', modeKept ? '已点过' : '有问题：遮罩回到了默认')

  await page.locator('.step-tab').nth(4).click()
  await page.locator('#panel4').getByRole('button', { name: 'RLHF / PPO' }).click()
  await page.locator('.step-tab').nth(0).click()
  await page.locator('.step-tab').nth(4).click()
  const routeKept = await page.locator('#panel4').getByRole('button', { name: 'RLHF / PPO' }).evaluate((el) => el.classList.contains('primary'))
  note('posttraining', '第 5 步路线选择保留', routeKept ? '已点过' : '有问题：路线回到了默认')

  await page.locator('.step-tab').nth(5).click()
  await page.locator('#panel5').getByRole('button', { name: '强化学习', exact: true }).click()
  const lit = page.locator('#panel5').getByRole('button', { name: /RLHF/ })
  await lit.click()
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('#panel5 button')].find((b) => b.textContent.includes('RLHF'))
    return getComputedStyle(btn).borderTopColor === 'rgb(217, 119, 87)'
  })
  const border = await lit.evaluate((el) => getComputedStyle(el).borderTopColor)
  await page.locator('.step-tab').nth(0).click()
  await page.locator('.step-tab').nth(5).click()
  const borderBack = await page.locator('#panel5').getByRole('button', { name: /RLHF/ }).evaluate((el) => getComputedStyle(el).borderTopColor)
  const accent = border === 'rgb(217, 119, 87)' && borderBack === border
  note('posttraining', '第 6 步高亮格子边框是 accent，选择保留', accent ? '已点过' : `有问题：边框 ${border} → ${borderBack}`)

  await page.locator('.step-tab').nth(6).click()
  await page.locator('#panel6 summary').first().click()
  await page.locator('.step-tab').nth(0).click()
  await page.locator('.step-tab').nth(6).click()
  const dig7 = await page.locator('#panel6 details').first().evaluate((el) => el.open)
  note('posttraining', '第 7 步折叠保留', dig7 ? '已点过' : '有问题：折叠收起了')

  async function jump(raw, expectHash, panelId) {
    await page.evaluate((h) => { location.hash = h }, raw)
    const id = panelId.slice(1)
    try {
      await page.waitForFunction(
        ([h, pid]) => location.hash === h && !!document.getElementById(pid)?.classList.contains('active'),
        [expectHash, id],
        { timeout: 3000 },
      )
      return true
    } catch {
      return false
    }
  }
  const far = await jump('#step-99', '#step-7', '#panel6')
  const zero = await jump('#step-0', '#step-1', '#panel0')
  const bad = await jump('#not-a-step', '#step-1', '#panel0')
  note('posttraining', '#step-99 夹到第 7 步并改写 hash', far ? '已点过' : '有问题')
  note('posttraining', '#step-0 夹到第 1 步并改写 hash', zero ? '已点过' : '有问题')
  note('posttraining', '非法 hash 改写成 #step-1', bad ? '已点过' : '有问题')

  await page.goto(`${base}?fresh=${Date.now()}#step-7`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#panel6.active')
  await page.evaluate(() => {
    let n = 0
    const orig = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (...args) {
      if (this.classList && this.classList.contains('congrats')) n += 1
      return orig.apply(this, args)
    }
    window.__congratsScrolls = () => n
  })
  await page.locator('#nextBtn').click()
  await page.waitForTimeout(80)
  await page.locator('#nextBtn').click()
  await page.waitForTimeout(80)
  const scrolls = await page.evaluate(() => window.__congratsScrolls())
  note('posttraining', '每次点完成都滚到横幅', scrolls >= 2 ? '已点过' : `有问题：scrollIntoView ${scrolls} 次`)
}

async function setRange(locator, value) {
  await locator.evaluate((el, next) => {
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto.set.call(el, next)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function hashJump(page, raw, expectHash, panelId) {
  await page.evaluate((h) => { location.hash = h }, raw)
  try {
    await page.waitForFunction(
      ([h, pid]) => location.hash === h && !!document.getElementById(pid)?.classList.contains('active'),
      [expectHash, panelId],
      { timeout: 3000 },
    )
    return true
  } catch {
    return false
  }
}

async function awayAndBack(page, stepIndex) {
  const other = stepIndex === 0 ? 1 : 0
  await page.locator('.step-tab').nth(other).click()
  await page.locator('.step-tab').nth(stepIndex).click()
  await page.waitForSelector(`#panel${stepIndex}.active`)
}

async function verifyBigram(page, base) {
  await page.goto(`${base}?fresh=${Date.now()}#step-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#panel0.active')
  note('bigram', '第 1 步没有可切换的选择', '已点过')
  note('bigram', '步骤 tab 的 click', '已点过')
  note('bigram', '上一步 / 下一步的 click', '已点过')

  await page.locator('.step-tab').nth(1).click()
  await page.getByRole('button', { name: '摊平 · view(B*T, C)' }).click()
  let flat = await page.locator('#panel1').innerText()
  note('bigram', 'flatBtn：摊平', flat.includes('(6, 65)') && flat.includes('第 0 题 · 65 个打分') ? '已点过' : '有问题：没有摊平')
  await page.getByRole('button', { name: '复原成 (B, T)' }).click()
  flat = await page.locator('#panel1').innerText()
  note('bigram', 'resetFlatBtn：复原', flat.includes('(2, 3, 65)') && !flat.includes('第 0 题 · 65 个打分') ? '已点过' : '有问题：没有复原')
  await page.getByRole('button', { name: '摊平 · view(B*T, C)' }).click()
  await awayAndBack(page, 1)
  flat = await page.locator('#panel1').innerText()
  note('bigram', '第 2 步摊平后离开再回来仍在', flat.includes('(6, 65)') ? '已点过' : '有问题：摊平被清掉了')

  await page.locator('.step-tab').nth(2).click()
  await page.getByRole('button', { name: '第 3 题:看 "b"' }).click()
  let step3 = await page.locator('#panel2').innerText()
  note('bigram', 'q-btn：换题', step3.includes('第 3 题:模型看到 "b"') ? '已点过' : '有问题：题目没换')
  await page.getByRole('button', { name: '应用 softmax(打分 → 概率)' }).click()
  step3 = await page.locator('#panel2').innerText()
  note('bigram', 'softmaxBtn', step3.includes('softmax 后所有概率之和') ? '已点过' : '有问题：没有切到概率')
  await page.getByRole('button', { name: '看原始 logits' }).click()
  step3 = await page.locator('#panel2').innerText()
  note('bigram', 'rawBtn', step3.includes('原始 logits') ? '已点过' : '有问题：没有回到 logits')
  await page.getByRole('button', { name: '应用 softmax(打分 → 概率)' }).click()
  await awayAndBack(page, 2)
  step3 = await page.locator('#panel2').innerText()
  note('bigram', '第 3 步题目和 softmax 离开再回来仍在', step3.includes('第 3 题:模型看到 "b"') && step3.includes('softmax 后所有概率之和') ? '已点过' : '有问题：选择丢了')

  await page.locator('.step-tab').nth(3).click()
  const slider = page.locator('#panel3 input[type="range"]')
  await setRange(slider, '90')
  let step4 = await page.locator('#panel3').innerText()
  note('bigram', '滑块 input', step4.includes('0.90') ? '已点过' : '有问题：p 没有变成 0.90')
  await page.locator('#panel3 .ref-chip').filter({ hasText: 'p=0.5' }).click()
  step4 = await page.locator('#panel3').innerText()
  note('bigram', 'ref-chip click', (await slider.inputValue()) === '50' && step4.includes('0.50') ? '已点过' : '有问题：参考点没有把滑块拨到 0.5')
  await setRange(slider, '90')
  await awayAndBack(page, 3)
  note('bigram', '第 4 步滑块离开再回来仍在', (await slider.inputValue()) === '90' ? '已点过' : '有问题：滑块回到了默认')

  await page.locator('.step-tab').nth(4).click()
  await page.getByRole('button', { name: '▶ 单步执行' }).click()
  let center = await page.locator('#panel4 .li-k').innerText()
  note('bigram', 'loopStepBtn', center.includes('第 1 步 · get_batch') ? '已点过' : `有问题：${center}`)
  await page.getByRole('button', { name: '▶▶ 自动循环' }).click()
  let moved = center
  try {
    await page.waitForFunction(() => document.querySelector('#panel4 .li-k')?.textContent?.includes('第 2 步'), null, { timeout: 3000 })
    moved = await page.locator('#panel4 .li-k').innerText()
  } catch {
    moved = await page.locator('#panel4 .li-k').innerText()
  }
  const pausedLabel = await page.getByRole('button', { name: '⏸ 暂停' }).count()
  if (pausedLabel) await page.getByRole('button', { name: '⏸ 暂停' }).click()
  note('bigram', 'loopAutoBtn：自动循环与暂停', pausedLabel === 1 && moved.includes('第 2 步') ? '已点过' : `有问题：中心 ${moved}`)
  await page.getByRole('button', { name: '复位' }).first().click()
  center = await page.locator('#panel4 .li-k').innerText()
  note('bigram', 'loopResetBtn', center === '训练循环' ? '已点过' : `有问题：${center}`)
  await page.getByRole('button', { name: '▶ 单步执行' }).click()
  await awayAndBack(page, 4)
  center = await page.locator('#panel4 .li-k').innerText()
  note('bigram', '第 5 步闭环下标离开再回来仍在', center.includes('第 1 步 · get_batch') ? '已点过' : `有问题：${center}`)

  const lossBefore = await page.locator('#panel4 .sc-v').innerText()
  await page.getByRole('button', { name: '执行一轮训练(扭旋钮 → loss 下降)' }).click()
  const lossAfter = await page.locator('#panel4 .sc-v').innerText()
  note('bigram', 'trainOneBtn', lossBefore === '4.170' && lossAfter !== lossBefore ? '已点过' : `有问题：${lossBefore} → ${lossAfter}`)
  await page.locator('#panel4').getByRole('button', { name: '复位' }).nth(1).click()
  const lossReset = await page.locator('#panel4 .sc-v').innerText()
  note('bigram', 'trainResetBtn', lossReset === '4.170' ? '已点过' : `有问题：${lossReset}`)
  await page.locator('#panel4 .wt-rh').first().click()
  const predict = await page.locator('#panel4 .wp-title').innerText()
  note('bigram', '权重表 [data-r] click', predict.includes('看到 "o"') ? '已点过' : `有问题：${predict}`)
  await awayAndBack(page, 4)
  const predictBack = await page.locator('#panel4 .wp-title').innerText()
  note('bigram', '第 5 步选中行离开再回来仍在', predictBack.includes('看到 "o"') ? '已点过' : `有问题：${predictBack}`)

  await page.getByRole('button', { name: '训练!' }).click()
  await page.waitForTimeout(400)
  const stepMid = Number(await page.locator('#panel4 .loss-readout .v').first().innerText())
  note('bigram', 'trainCurveBtn', stepMid > 0 ? '已点过' : `有问题：step ${stepMid}`)
  await page.getByRole('button', { name: '重置曲线' }).click()
  const stepZero = await page.locator('#panel4 .loss-readout .v').first().innerText()
  note('bigram', 'curveResetBtn', stepZero === '0' ? '已点过' : `有问题：step ${stepZero}`)

  await page.goto(`${base}?fresh=${Date.now()}#step-4`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#panel3.active')
  const direct = await page.evaluate(() => location.hash === '#step-4' && !!document.getElementById('panel3')?.classList.contains('active'))
  note('bigram', 'hashchange：#step-4 直达', direct ? '已点过' : '有问题')
  const far = await hashJump(page, '#step-99', '#step-5', 'panel4')
  const zero = await hashJump(page, '#step-0', '#step-1', 'panel0')
  const bad = await hashJump(page, '#not-a-step', '#step-1', 'panel0')
  note('bigram', 'hashchange：#step-99 夹到第 5 步', far ? '已点过' : '有问题')
  note('bigram', 'hashchange：#step-0 夹到第 1 步', zero ? '已点过' : '有问题')
  note('bigram', 'hashchange：非法 hash 改写成 #step-1', bad ? '已点过' : '有问题')

  await page.goto(`${base}?fresh=${Date.now()}#step-1`, { waitUntil: 'networkidle' })
  await page.locator('#panel0 .term').first().hover()
  await page.waitForTimeout(80)
  const hovered = await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))
  note('bigram', '名词 mouseenter', hovered ? '已点过' : '有问题：气泡没打开')
  await page.locator('h1').hover()
  await page.waitForTimeout(220)
  const left = await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))
  note('bigram', '名词 mouseleave', left ? '有问题：移开后气泡还在' : '已点过')
  await page.locator('#panel0 .term').first().click()
  await page.waitForTimeout(80)
  const clicked = await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))
  note('bigram', '名词 click', clicked ? '已点过' : '有问题：点击没打开气泡')
  await page.locator('#termTip').hover()
  await page.waitForTimeout(200)
  const held = await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))
  note('bigram', '气泡 mouseenter 期间不收起', held ? '已点过' : '有问题：气泡自己收了')
  await page.locator('h1').hover()
  await page.waitForTimeout(220)
  note('bigram', '气泡 mouseleave', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '有问题：移开气泡后还在' : '已点过')
  await page.locator('#panel0 .term').first().click()
  await page.locator('h1').click()
  await page.waitForTimeout(40)
  note('bigram', 'document click 收起气泡', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '有问题：点页面后气泡还在' : '已点过')
}

async function verifyRlvr(page, base) {
  await page.goto(`${base}?fresh=${Date.now()}#step-1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#panel0.active')
  await page.locator('#panel0 .btn-row .btn').nth(1).click()
  let step1 = await page.locator('#panel0').innerText()
  note('rlvr-grpo', 'grp 按钮', step1.includes('1 8 + 1 0 =') && step1.includes('正确答案 28') ? '已点过' : '有问题：没有换到第二组')
  await awayAndBack(page, 0)
  step1 = await page.locator('#panel0').innerText()
  note('rlvr-grpo', '第 1 步选题离开再回来仍在', step1.includes('正确答案 28') ? '已点过' : '有问题：回到了第一组')

  await page.locator('.step-tab').nth(1).click()
  await page.locator('#panel1 .smp').first().click()
  const presetOff = await page.locator('#panel1 .btn-row .btn.primary').count()
  note('rlvr-grpo', '样本 click：脱离预设', presetOff === 0 ? '已点过' : '有问题：预设按钮还亮着')
  await page.locator('#panel1').getByRole('button', { name: '全错', exact: true }).click()
  let step2 = await page.locator('#panel1').innerText()
  note('rlvr-grpo', 'preset 按钮', step2.includes('全错:每条回答都等于均值') ? '已点过' : '有问题：没有切到全错')
  await awayAndBack(page, 1)
  step2 = await page.locator('#panel1').innerText()
  note('rlvr-grpo', '第 2 步预设离开再回来仍在', step2.includes('全错:每条回答都等于均值') ? '已点过' : '有问题：预设丢了')

  await page.locator('.step-tab').nth(2).click()
  await page.locator('#panel2').getByRole('button', { name: '热身 1000 道' }).click()
  let step3 = await page.locator('#panel2').innerText()
  note('rlvr-grpo', 'start 按钮', step3.includes('热身 1000 道的起点') ? '已点过' : '有问题：没有切到 1000 道')
  await awayAndBack(page, 2)
  step3 = await page.locator('#panel2').innerText()
  note('rlvr-grpo', '第 3 步起点离开再回来仍在', step3.includes('热身 1000 道的起点') ? '已点过' : '有问题：回到了 200 道')

  await page.locator('.step-tab').nth(3).click()
  await page.locator('#panel3').getByRole('button', { name: '热身 200 道' }).click()
  let step4 = await page.locator('#panel3').innerText()
  const dpoLr = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#panel3 tr.hl')].find((tr) => tr.cells[0]?.textContent === 'DPO')
    return row?.cells[1]?.textContent ?? ''
  })
  note('rlvr-grpo', 'cmp 按钮：对照表', step4.includes('起点弱') ? '已点过' : '有问题：对照没有切到 200 道')
  note('rlvr-grpo', 'cmp 按钮：学习率表', dpoLr === '1e-7' ? '已点过' : `有问题：DPO 学习率 ${dpoLr}`)
  await awayAndBack(page, 3)
  step4 = await page.locator('#panel3').innerText()
  note('rlvr-grpo', '第 4 步起点离开再回来仍在', step4.includes('起点弱') ? '已点过' : '有问题：回到了 1000 道')

  await page.locator('.step-tab').nth(4).click()
  await page.getByRole('button', { name: 'KL 项' }).click()
  let step5 = await page.locator('#panel4').innerText()
  note('rlvr-grpo', 'abl 按钮', step5.includes('去掉 KL 后评测贪心') ? '已点过' : '有问题：没有切到 KL')
  await awayAndBack(page, 4)
  step5 = await page.locator('#panel4').innerText()
  note('rlvr-grpo', '第 5 步消融离开再回来仍在', step5.includes('去掉 KL 后评测贪心') ? '已点过' : '有问题：回到了组大小')

  await page.goto(`${base}?fresh=${Date.now()}#step-3`, { waitUntil: 'networkidle' })
  const direct = await page.evaluate(() => location.hash === '#step-3' && !!document.getElementById('panel2')?.classList.contains('active'))
  note('rlvr-grpo', 'hashchange：#step-3 直达', direct ? '已点过' : '有问题')
  note('rlvr-grpo', 'hashchange：#step-99 夹到第 5 步', (await hashJump(page, '#step-99', '#step-5', 'panel4')) ? '已点过' : '有问题')
  note('rlvr-grpo', 'hashchange：#step-0 夹到第 1 步', (await hashJump(page, '#step-0', '#step-1', 'panel0')) ? '已点过' : '有问题')
  note('rlvr-grpo', 'hashchange：非法 hash 改写成 #step-1', (await hashJump(page, '#not-a-step', '#step-1', 'panel0')) ? '已点过' : '有问题')

  await page.goto(`${base}?fresh=${Date.now()}#step-1`, { waitUntil: 'networkidle' })
  await page.locator('#panel0 .term').first().hover()
  await page.waitForTimeout(80)
  note('rlvr-grpo', '名词 mouseenter', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '已点过' : '有问题：气泡没打开')
  await page.locator('h1').hover()
  await page.waitForTimeout(220)
  note('rlvr-grpo', '名词 mouseleave', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '有问题：移开后气泡还在' : '已点过')
  await page.locator('#panel0 .term').first().click()
  await page.waitForTimeout(80)
  note('rlvr-grpo', '名词 click', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '已点过' : '有问题：点击没打开气泡')
  await page.locator('#termTip').hover()
  await page.waitForTimeout(200)
  note('rlvr-grpo', '气泡 mouseenter 期间不收起', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '已点过' : '有问题：气泡自己收了')
  await page.locator('h1').hover()
  await page.waitForTimeout(220)
  note('rlvr-grpo', '气泡 mouseleave', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '有问题：移开气泡后还在' : '已点过')
  await page.locator('#panel0 .term').first().click()
  await page.locator('h1').click()
  await page.waitForTimeout(40)
  note('rlvr-grpo', 'document click 收起气泡', (await page.evaluate(() => document.getElementById('termTip')?.classList.contains('show'))) ? '有问题：点页面后气泡还在' : '已点过')
}

async function settleText(page) {
  await page.bringToFront()
  let prev = ''
  let quiet = 0
  // 静止 1.5 秒才算停稳。缓出动画的最后一档可停留 1 秒以上（第 3 章 step 6 的 loss 播放 2.2 秒，
  // 末档约 1.1 秒），窗口短了会在末档前截下文字；页面切到后台后 rAF 暂停，截下的就是错的终态。
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100)
    const now = await visibleText(page)
    if (now === prev) quiet += 1
    else { prev = now; quiet = 0 }
    if (i >= 4 && quiet >= 15) return
  }
}

async function compareOne(label, oldUrl, newUrl) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const a = await ctx.newPage()
  const b = await ctx.newPage()
  const errors = []
  b.on('pageerror', (err) => errors.push(String(err)))
  await openHash(a, oldUrl)
  await openHash(b, newUrl)
  await settleText(a)
  await settleText(b)
  const da = normLines(await visibleText(a))
  const db = normLines(await visibleText(b))
  const same = da.join('\n') === db.join('\n')
  const diff = same ? [] : lineDiff(da, db)
  report.push({ label, same, diffCount: diff.length, diff, errors })
  await ctx.close()
  return errors
}

try {
  await compareOne('首页', `${oldOrigin}${oldPath('index.html', '/')}`, `${newOrigin}/`)
  await compareOne('名词表', `${oldOrigin}${oldPath('glossary.html', '/glossary')}`, `${newOrigin}/glossary`)
  await compareOne('札记', `${oldOrigin}${oldPath('notes.html', '/notes')}`, `${newOrigin}/notes`)
  await compareOne('关于', `${oldOrigin}${oldPath('about.html', '/about')}`, `${newOrigin}/about`)

  for (const ch of ready) {
    for (const step of ch.steps) {
      const label = `${ch.num} ${ch.slug} #${step.anchor}`
      try {
        await compareOne(
          label,
          `${oldOrigin}${oldPath(ch.file, `/ch/${ch.slug}`)}#${step.anchor}`,
          `${newOrigin}/ch/${ch.slug}#${step.anchor}`,
        )
      } catch (err) {
        report.push({
          label,
          same: false,
          diffCount: 1,
          diff: [String(err).split('\n')[0]],
          errors: [String(err).split('\n')[0]],
        })
      }
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

    try {
      if (ch.slug === 'bigram') await verifyBigram(page, base)
      if (ch.slug === 'rlvr-grpo') await verifyRlvr(page, base)
    } catch (err) {
      note(ch.slug, '交互核对中断', `有问题：${String(err).split('\n')[0]}`)
    }
    if (ch.slug === 'posttraining') {
      await verifyShell(page, base)
      await page.goto(`${base}?fresh=${Date.now()}#step-2`, { waitUntil: 'networkidle' })
      await page.waitForSelector('#panel1.active')
      await page.locator('#panel1 .term').filter({ hasText: '中期训练' }).click()
      await page.waitForTimeout(150)
      const stayed = await page.evaluate(() => {
        const stages = [...document.querySelectorAll('#panel1 [class*="pstage"]')]
        const text = document.body.innerText
        const on0 = !!stages[0]?.className.split(' ').some((c) => c.includes('_on_') || c === 'on')
        const on1 = !!stages[1]?.className.split(' ').some((c) => c.includes('_on_') || c === 'on')
        return {
          ok: on0 && !on1 && text.includes('STAGE 1 · 预训练') && !text.includes('STAGE 2 · 中期训练'),
          on0, on1,
          c0: stages[0]?.className,
          c1: stages[1]?.className,
          stage2: text.includes('STAGE 2 · 中期训练'),
          tip: document.getElementById('termTip')?.className ?? '',
        }
      })
      note(ch.slug, '点「中期训练」不切换阶段', stayed.ok ? '已点过' : `有问题：${JSON.stringify(stayed)}`)
    }

    // 每个面板里的按钮点一下。跳过上一步/下一步，那两项上面单独记。
    let btnProblems = []
    for (let i = 0; i < ch.steps.length; i++) {
      await page.locator('.step-tab').nth(i).click()
      const buttons = page.locator('.panel.active button, .panel.active .btn')
      const n = await buttons.count()
      for (let k = 0; k < n; k++) {
        if (!(await buttons.nth(k).isVisible())) continue
        const label = (await buttons.nth(k).innerText()).trim().slice(0, 40)
        try {
          await buttons.nth(k).click({ timeout: 1500 })
        } catch (err) {
          btnProblems.push(`第 ${i + 1} 步「${label}」${err.message.split('\n')[0]}`)
        }
      }
    }
    note(ch.slug, '各步按钮', btnProblems.length ? `有问题：${btnProblems.join('；')}` : '已点过')

    let tipped = false
    const termPlaces = ['.subtitle .term']
    for (let i = 0; i < ch.steps.length; i++) termPlaces.push(`#panel${i} .term`)
    for (let i = 0; i < termPlaces.length && !tipped; i++) {
      if (i > 0) {
        await page.locator('.step-tab').nth(i - 1).click()
        await page.waitForSelector(`#panel${i - 1}.active`)
      }
      const terms = page.locator(termPlaces[i])
      const n = await terms.count()
      for (let k = 0; k < n && !tipped; k++) {
        const usable = await terms.nth(k).evaluate((el) => {
          let node = el.parentElement
          while (node) {
            if (node.tagName === 'DETAILS' && !node.open) return false
            node = node.parentElement
          }
          const r = el.getBoundingClientRect()
          return r.width > 1 && r.height > 1
        })
        if (!usable) continue
        try {
          await terms.nth(k).hover({ timeout: 4000 })
        } catch {
          continue
        }
        await page.waitForTimeout(80)
        const tip = await page.evaluate(() => {
          const el = document.getElementById('termTip')
          return {
            show: !!el?.classList.contains('show'),
            text: el?.innerText ?? '',
          }
        })
        if (!(tip.show && tip.text.includes('更多'))) continue
        note(ch.slug, '名词气泡', '已点过')
        await page.locator('#termTip .tt-more').click()
        await page.waitForURL(/\/glossary#/)
        const landed = await page.evaluate(() => location.pathname + location.hash)
        note(ch.slug, '气泡链到名词表', landed.startsWith('/glossary#') ? `已点过 ${landed}` : `有问题：${landed}`)
        tipped = true
      }
    }
    if (!tipped) {
      const any = await page.locator('.term').count()
      note(ch.slug, '名词气泡', any ? '有问题：没有能点开的名词' : '已点过，这一页没有名词')
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

  const touch = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  })
  const tp = await touch.newPage()
  await openHash(tp, `${newOrigin}/ch/posttraining#step-2`)
  await tp.locator('#panel1 .term').filter({ hasText: '中期训练' }).tap()
  await tp.waitForTimeout(150)
  const tapped = await tp.evaluate(() => {
    const el = document.getElementById('termTip')
    const stages = [...document.querySelectorAll('#panel1 [class*="pstage"]')]
    const text = document.body.innerText
    return {
      show: !!el?.classList.contains('show'),
      stage: !!stages[0]?.className.includes('on') && !stages[1]?.className.includes('on') && text.includes('STAGE 1 · 预训练') && !text.includes('STAGE 2 · 中期训练'),
    }
  })
  note('posttraining', '375px 触屏点「中期训练」弹出气泡且不切换阶段', tapped.show && tapped.stage ? '已点过' : `有问题：气泡 ${tapped.show}，阶段保持 ${tapped.stage}`)
  for (const slug of ['bigram', 'rlvr-grpo']) {
    await openHash(tp, `${newOrigin}/ch/${slug}#step-1`)
    await tp.locator('#panel0 .term').first().tap()
    await tp.waitForTimeout(150)
    const opened = await tp.evaluate(() => {
      const tip = document.getElementById('termTip')
      return !!tip?.classList.contains('show') && (tip.innerText || '').includes('更多')
    })
    const wide = await tp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    note(slug, '375px 触屏点开名词气泡', opened ? '已点过' : '有问题：气泡没打开')
    note(slug, '375px 触屏下无横向滚动', wide <= 1 ? '已点过' : `有问题：多出 ${wide}px`)
  }
  note('构建检查', '扫描 src 下的 ts、tsx、js、jsx、mjs、json、css；旧章节文件名只允许出现在 catalog 的 file 字段。出现 >{[ 或 <>{[ 时构建失败。范围见 docs/source-checks.md', '已点过')
  note('名词表正文', '普通 JSX。def 与正文去标签后一致，白名单为空，见 docs/migration-notes.md', '已点过')
  await touch.close()

  await ctx.close()
} finally {
  const diffDoc = legacy
    ? ['# 迁移文字对照', '', `对照侧：${ref.label}。当前侧：本工作区的 dist。`, '', '空白折叠成一行一个空格后，按行比较可见文字。对照前去掉了「源码 / Colab」链接的文字。', '']
    : ['# 文字对照', '', `对照侧：${ref.label}。当前侧：本工作区的 dist。`, '',
      '空白折叠成一行一个空格后，按行比较每页每一步的可见文字。没有白名单。',
      '有差异不一定是错：改了内容也会出现在这里。下面先列有差异的页，由审阅人确认每一条是有意的改动。', '']
  let bad = 0
  const ordered = legacy ? report : [...report.filter((r) => !r.same), ...report.filter((r) => r.same)]
  for (const row of ordered) {
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
  const failed = checks.filter((row) => row.status.startsWith('有问题'))
  if (!legacy) {
    diffDoc.push('', '## 当前 dist 的交互检查', '', `共 ${checks.length} 项，有问题 ${failed.length} 项。`)
    for (const row of failed) diffDoc.push(`- ${row.page} · ${row.item}：${row.status}`)
  }
  writeFileSync(join(root, legacy ? 'docs/migration-diff.md' : 'docs/compare-text.md'), diffDoc.join('\n') + '\n')

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
  if (legacy) writeFileSync(join(root, 'docs/migration-checklist.md'), checkDoc.join('\n') + '\n')

  console.log(`diff ${report.length} pages against ${ref.label}, ${bad} with differences`)
  for (const row of report) if (!row.same) console.log(' DIFF', row.label, row.diffCount)
  for (const row of checks) if (row.status.startsWith('有问题')) console.log(' CHECK', row.page, row.item, row.status)
  await browser.close()
  await previewServer.close()
  if (refPreview) await refPreview.close()
  if (oldServer) await new Promise((resolve) => oldServer.close(resolve))
  ref.cleanup()
  if (bad && !opts.allowDiff) process.exitCode = 1
}
