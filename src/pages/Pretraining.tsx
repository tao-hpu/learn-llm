// 旧页进入第 2 步会清零 shard 指针和计时器，进入第 3 步会清零蓄水槽（滑块保留）；这里离开再回来都保留。max_steps 初始 19073 按 step=100 显示为 19100，说明里的 19073 是写死的。
import { useEffect, useRef, useState } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Pretraining.module.css'

const S1_ROWS = [
  { name: 'n_layer', toy: '4', real: '12', grow: '×3' },
  { name: 'n_head', toy: '4', real: '12', grow: '×3' },
  { name: 'n_embd', toy: '128', real: '768', grow: '×6' },
  { name: 'block_size', toy: '64', real: '1024', grow: '×16' },
  { name: 'vocab_size', toy: '65 (字符)', real: '50304 (BPE)', grow: '×773' },
]
const S1_FOCUS = [
  { k: 'real' as const, label: '▶ 看 GPT-2 124M 这列' },
  { k: 'toy' as const, label: '▶ 看字符级玩具这列' },
]
const S2_NSHARD = 20
const S2_BPE = ['Edu', 'cation', ' is', ' the', ' most', ' power', 'ful', ' weapon', '.']
const MICRO_TOK = 8 * 1024
const MAX_LR = 6e-4
const MIN_LR = 6e-5
const BASE_LOSS = 10.82

const fmt = (n: number) => n.toLocaleString('en-US')

function getLR(step: number, warmup: number, maxSteps: number) {
  if (step < warmup) return MAX_LR * (step + 1) / Math.max(1, warmup)
  if (step >= maxSteps) return MIN_LR
  const ratio = (step - warmup) / Math.max(1, maxSteps - warmup)
  const coeff = 0.5 * (1 + Math.cos(Math.PI * ratio))
  return MIN_LR + coeff * (MAX_LR - MIN_LR)
}

function monoFamily() {
  return getComputedStyle(document.body).getPropertyValue('--mono')
}

function drawLR(cv: HTMLCanvasElement, warmup: number, maxSteps: number) {
  const W = cv.clientWidth || 760
  const H = 300
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  const padL = 58
  const padR = 18
  const padT = 22
  const padB = 34
  const x0 = padL
  const x1 = W - padR
  const y0 = H - padB
  const y1 = padT
  const sx = (s: number) => x0 + (s / Math.max(1, maxSteps)) * (x1 - x0)
  const sy = (lr: number) => y0 - (lr / MAX_LR) * (y0 - y1)
  ctx.font = '10px ' + monoFamily()
  ctx.textBaseline = 'middle'
  const yticks = [0, 1.5e-4, 3e-4, 4.5e-4, 6e-4]
  yticks.forEach((v) => {
    const y = sy(v)
    ctx.strokeStyle = '#EFEBE0'
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
    ctx.fillStyle = '#6B6B68'
    ctx.textAlign = 'right'
    ctx.fillText(v.toExponential(0).replace('e', 'e'), x0 - 6, y)
  })
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = '#3f7d63'
  ctx.beginPath()
  ctx.moveTo(x0, sy(MIN_LR))
  ctx.lineTo(x1, sy(MIN_LR))
  ctx.stroke()
  ctx.strokeStyle = '#7a5bd0'
  ctx.beginPath()
  ctx.moveTo(x0, sy(MAX_LR))
  ctx.lineTo(x1, sy(MAX_LR))
  ctx.stroke()
  ctx.setLineDash([])
  if (warmup > 0) {
    ctx.fillStyle = 'rgba(184,81,47,.08)'
    ctx.fillRect(x0, y1, sx(warmup) - x0, y0 - y1)
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = '#b8512f'
    ctx.beginPath()
    ctx.moveTo(sx(warmup), y0)
    ctx.lineTo(sx(warmup), y1)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#b8512f'
    ctx.textAlign = 'left'
    ctx.fillText('warmup ' + warmup, sx(warmup) + 4, y1 + 8)
  }
  ctx.strokeStyle = '#7a5bd0'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  const NPT = Math.min(W, 700)
  for (let i = 0; i <= NPT; i++) {
    const step = Math.round((i / NPT) * maxSteps)
    const lr = getLR(step, warmup, maxSteps)
    const X = sx(step)
    const Y = sy(lr)
    if (i === 0) ctx.moveTo(X, Y)
    else ctx.lineTo(X, Y)
  }
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.fillStyle = '#7a5bd0'
  ctx.beginPath()
  ctx.arc(sx(warmup), sy(MAX_LR), 4, 0, 7)
  ctx.fill()
  ctx.fillStyle = '#6B6B68'
  ctx.textAlign = 'center'
  ctx.fillText('step →  (0 … ' + maxSteps + ')', (x0 + x1) / 2, H - 12)
  ctx.save()
  ctx.translate(14, (y0 + y1) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillText('learning rate', 0, 0)
  ctx.restore()
}

function drawLoss(cv: HTMLCanvasElement) {
  const W = cv.clientWidth || 760
  const H = 280
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  const padL = 54
  const padR = 110
  const padT = 24
  const padB = 40
  const x0 = padL
  const x1 = W - padR
  const y0 = H - padB
  const y1 = padT
  const xMinL = Math.log10(1e7)
  const xMaxL = Math.log10(2e10)
  const sx = (tok: number) => x0 + ((Math.log10(tok) - xMinL) / (xMaxL - xMinL)) * (x1 - x0)
  const lossMin = 2.5
  const lossMax = 11
  const sy = (l: number) => y0 - ((l - lossMin) / (lossMax - lossMin)) * (y0 - y1)
  ctx.font = '10px ' + monoFamily()
  ctx.textBaseline = 'middle'
  ;[3, 4, 5, 6, 8, 10].forEach((v) => {
    const y = sy(v)
    ctx.strokeStyle = '#EFEBE0'
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
    ctx.fillStyle = '#6B6B68'
    ctx.textAlign = 'right'
    ctx.fillText(v.toFixed(0), x0 - 6, y)
  })
  const xticks: [number, string][] = [[1e7, '10M'], [1e8, '100M'], [3e8, '300M'], [1e9, '1B'], [1e10, '10B']]
  xticks.forEach(([t, lab]) => {
    const x = sx(t)
    ctx.fillStyle = '#6B6B68'
    ctx.textAlign = 'center'
    ctx.fillText(lab, x, H - 14)
    ctx.strokeStyle = '#EFEBE0'
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
    ctx.stroke()
  })
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = '#bbb'
  ctx.beginPath()
  ctx.moveTo(x0, sy(BASE_LOSS))
  ctx.lineTo(x1, sy(BASE_LOSS))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#999'
  ctx.textAlign = 'left'
  ctx.fillText('随机基线 ln(50257)≈10.82', x0 + 6, sy(BASE_LOSS) - 9)
  const P0 = { t: 5e6, l: BASE_LOSS }
  const P1 = { t: 3e8, l: 3.65 }
  const P2 = { t: 1e10, l: 3.02 }
  ctx.setLineDash([6, 5])
  ctx.strokeStyle = '#c9c4ba'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const f = i / 40
    const tok = 10 ** (Math.log10(P0.t) + (Math.log10(P1.t) - Math.log10(P0.t)) * f)
    const l = P0.l + (P1.l - P0.l) * f ** 0.55
    if (i === 0) ctx.moveTo(sx(tok), sy(l))
    else ctx.lineTo(sx(tok), sy(l))
  }
  for (let i = 0; i <= 40; i++) {
    const f = i / 40
    const tok = 10 ** (Math.log10(P1.t) + (Math.log10(P2.t) - Math.log10(P1.t)) * f)
    const l = P1.l + (P2.l - P1.l) * f
    ctx.lineTo(sx(tok), sy(l))
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineWidth = 1
  ctx.fillStyle = 'rgba(150,150,150,.55)'
  ctx.font = 'italic 13px ' + getComputedStyle(document.body).getPropertyValue('--serif')
  ctx.textAlign = 'center'
  ctx.fillText('示意趋势 · 非实测逐 step', (x0 + x1) / 2, y1 + 30)
  function dot(pen: CanvasRenderingContext2D, p: { t: number; l: number }, color: string, label: string, meta: string) {
    pen.fillStyle = color
    pen.beginPath()
    pen.arc(sx(p.t), sy(p.l), 6, 0, 7)
    pen.fill()
    pen.strokeStyle = '#fff'
    pen.lineWidth = 2
    pen.stroke()
    pen.lineWidth = 1
    pen.fillStyle = color
    pen.font = 'bold 12px ' + monoFamily()
    pen.textAlign = 'left'
    pen.fillText(label, sx(p.t) + 10, sy(p.l) - 4)
    pen.fillStyle = '#6B6B68'
    pen.font = '10px ' + monoFamily()
    pen.fillText(meta, sx(p.t) + 10, sy(p.l) + 10)
  }
  dot(ctx, P1, '#b8512f', '3.65', '300M·step1999')
  dot(ctx, P2, '#2c8a6b', '3.02', '10B·step19072')
  ctx.fillStyle = '#2c8a6b'
  ctx.font = 'bold 12px ' + monoFamily()
  ctx.textAlign = 'center'
  ctx.fillText('数据 ×33', (sx(P1.t) + sx(P2.t)) / 2, sy(3.0) - 2)
}

function Step1() {
  const [focus, setFocus] = useState<'real' | 'toy'>('real')
  const hl = focus === 'toy' ? 'hl-toy' : 'hl-real'
  return (
    <div className={styles.scope}>
      <h2>① 从玩具到真模型:同一套积木,数字全部放大</h2>
      <p className="lead">
        第 3 关那个<b>字符级小 GPT</b>(nanoGPT 风格)和这一关的 <b>GPT-2 124M</b>,零件清单完全一样 —— 区别只是每个数字往上跳了一大截。点下面两个按钮,看同一张配置表里<b>哪一列被点亮</b>,以及每行涨了多少倍。
      </p>
      <div className="btn-row">
        {S1_FOCUS.map((b) => (
          <button key={b.k} type="button" className={focus === b.k ? 'btn primary' : 'btn'} onClick={() => setFocus(b.k)}>{b.label}</button>
        ))}
      </div>
      <div className={styles.tableScroll}>
        <table className="cmp">
          <thead>
            <tr><th className="rowname">超参</th><th>字符级玩具(03)</th><th>GPT-2 124M(04)</th></tr>
          </thead>
          <tbody>
            {S1_ROWS.map((r) => (
              <tr key={r.name} className={hl}>
                <td className="rowname">{r.name}</td>
                <td className="cell-toy">{r.toy}</td>
                <td className="cell-real">{r.real} <span className="grow">{r.grow}</span></td>
              </tr>
            ))}
            <tr className="totalrow">
              <td className="rowname">参数量(运行时打印)</td>
              <td className="cell-toy">≈ 0.8 M</td>
              <td className="cell-real">≈ 124 M <span className="grow">×155</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="note">
        {focus === 'real' ? (
          <>当前高亮:<b>GPT-2 124M</b>。同一套零件(注意力+FFN+残差+LayerNorm),数字全面放大 → 参数量从 ≈0.8M 涨到 ≈124M。</>
        ) : (
          <>当前高亮:<b>字符级玩具</b>(03 默认 Mac 版)。麻雀虽小五脏俱全,正因为内核一样,放大就能变 124M。</>
        )}
      </div>
      <Dig title="vocab 为什么是 50304,不是 GPT-2 真实的 50257?">
        GPT-2 的 <Term k="bpe" name="BPE · 子词分词" def="Byte-Pair Encoding:把文本切成「子词」单元的分词法。GPT-2 的 BPE 词表有 50257 个 token,介于字符级和整词级之间。">BPE</Term> 词表真实大小是 <b>50257</b>。
        代码里把它<b>向上取整到 128 的倍数 → 50304</b>(<code>GPTConfig.vocab_size</code>)。原因纯粹是<b>硬件</b>:
        GPU 的矩阵乘对"维度是 2 的幂 / 128 的倍数"算得更快。多出来的 <code>50304-50257=47</code> 行
        永远不会作为真实 token 出现,<b>学不到也无害</b>,白拿一点速度。
      </Dig>
      <Dig title={'玩具是"字符级",GPT-2 是"BPE",差在哪?'}>
        第 3 关 vocab 只有 <span className="d d-vocab">65<i>vocab</i></span> —— 那是把莎士比亚文本里出现的<b>不同字符</b>(字母、标点、空格)去重数出来的,
        模型一次只预测<b>一个字母</b>。GPT-2 用 BPE,一个 token 往往是<b>一截子词</b>(如 <code>" the"</code>、<code>"ing"</code>),
        50304 个 token 覆盖了真实英文,所以同样长度能塞下多得多的信息。架构没变,只是"最底层的字典"换大了。
      </Dig>
      <p className="next-hint">模型壳子放大了,但<b>真模型要喂真数据</b>。下一步:FineWeb-Edu 语料怎么变成能一块块喂进去的东西。</p>
    </div>
  )
}

function Step2() {
  const live = useStepLive()
  const [pos, setPos] = useState(0)
  const [running, setRunning] = useState(false)
  const posRef = useRef(0)

  useEffect(() => {
    if (!live) setRunning(false)
  }, [live])

  useEffect(() => {
    if (!live || !running) return
    const id = window.setInterval(() => {
      const next = posRef.current + 1
      if (next >= S2_NSHARD) {
        posRef.current = S2_NSHARD
        setPos(S2_NSHARD)
        setRunning(false)
        return
      }
      posRef.current = next
      setPos(next)
    }, 220)
    return () => window.clearInterval(id)
  }, [live, running])

  function play() {
    if (running || posRef.current >= S2_NSHARD) return
    setRunning(true)
  }

  function reset() {
    setRunning(false)
    posRef.current = 0
    setPos(0)
  }

  const done = pos >= S2_NSHARD
  const pct = ((pos / S2_NSHARD) * 100).toFixed(0)
  const playLabel = done ? '✅ 一轮喂完' : running ? '…喂数据中' : '▶ 开始喂数据'
  return (
    <div className={styles.scope}>
      <h2>② 真数据 + 真 BPE + shards:把 10B token 切成块,顺序喂</h2>
      <p className="lead">
        训练数据是 <Term k="fineweb" name="FineWeb-Edu · 教育向网页语料" def="一个经过教育质量筛选的大规模英文网页语料,常用于预训练。本项目用它的子集做 GPT-2 复现。">FineWeb-Edu</Term>: 先用 GPT-2 的 BPE 把文本切成 token id,再把上百亿个 id 存成一批 <Term k="shard" name="shard · 数据分片" def="把超大数据集切成的一块块文件(这里是 .npy)。训练时一片片顺序读入,不必把整个数据集塞进内存。">shard</Term> (<code>.npy</code> 文件)。训练时 <code>DataLoaderLite</code> 一片片<b>顺序</b>读、读完换下一片。点「▶ 开始喂数据」看指针滑过。
      </p>
      <div className="pipeflow">
        <span className="stage">FineWeb-Edu 原文</span><span className="arrow">→</span>
        <span className="stage">GPT-2 BPE 分词</span><span className="arrow">→</span>
        <span className="stage">token id</span><span className="arrow">→</span>
        <span className="stage">存成 .npy shards</span><span className="arrow">→</span>
        <span className="stage">顺序喂训练</span>
      </div>
      <div className="sub-h"><span className="badge">BPE 示意</span>一句话被切成 token(下面切法是<b>示意</b>,非真实 BPE)</div>
      <div className="tokchips">
        {S2_BPE.map((t) => (
          <span key={t} className="tokchip">{t.replace(/ /g, '␣')}</span>
        ))}
      </div>
      <div className="sub-h"><span className="badge">shards</span>10B token 切成多片,指针顺序滑过</div>
      <div className="shardwrap">
        <div className="shardtrack">
          {Array.from({ length: S2_NSHARD }, (_, i) => (
            <div key={i} className={i < pos ? 'shard done' : i === pos ? 'shard cur' : 'shard'}>{i + 1}</div>
          ))}
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={done} onClick={play}>{playLabel}</button>
        <button type="button" className="btn ghost" onClick={reset}>↺ 重置</button>
        <span className="hp-note">
          {done ? (
            <>全部 {S2_NSHARD} 片喂完(示意)。真实里读完所有 shard 还会循环回第 0 片继续。</>
          ) : (
            <>已喂 <b>{pos}</b> / {S2_NSHARD} 片(示意)· 约 {pct}% · 真实约 <b>100</b> 片 × <b>~100M</b> token</>
          )}
        </span>
      </div>
      <div className="note">每片是一个 <code>.npy</code>(int token id);<code>DataLoaderLite.next_batch</code> 切出 <code>B×T+1</code> 个连续 token,前 B×T 个做输入、后移一位做标签。读完一片换下一片。</div>
      <Dig title="为什么不一次性把整个数据集读进内存?">
        10B token 即使按 2 字节存也有几十 GB,塞不进显存、也未必塞得进内存。切成
        shard 后,<code>DataLoaderLite</code> 同一时刻只 <code>np.load</code> <b>一片</b>到内存,指针 <code>pos</code> 在片内滑动,
        到头了 <code>cur_shard+1</code> 换下一片(循环)。这样无论数据多大,<b>内存占用是常数</b>。
      </Dig>
      <Dig title="上面这串 token 切法是真的吗?">
        <b>不是</b>,上面只是<b>示意</b>。真实 GPT-2 BPE 词表有 50257 个 token,切分规则复杂(按字节对频率合并),
        一个空格、一个词尾都可能单独成 token。这里只为让你直观看到"一句话 → 若干 token"这件事,
        别把具体切法当真。真实分词在 <code>prepare_fineweb.py</code> 里用 GPT-2 的 tokenizer 完成。
      </Dig>
      <p className="next-hint">数据备好了,但 GPT-2 一步要吃 <b>524288</b> 个 token —— 单卡一次根本喂不下。下一步:<b>梯度累积</b>。</p>
    </div>
  )
}

type Drip = 'count' | 'full' | 'flush' | 'autoDone' | 'empty'

function Step3() {
  const live = useStepLive()
  const [n, setN] = useState(64)
  const [filled, setFilled] = useState(0)
  const [auto, setAuto] = useState(false)
  const [drip, setDrip] = useState<Drip>('count')
  const filledRef = useRef(0)
  const nRef = useRef(64)
  nRef.current = n

  useEffect(() => {
    if (!live) setAuto(false)
  }, [live])

  useEffect(() => {
    if (!live || !auto) return
    let stop = false
    const id = window.setInterval(() => {
      if (stop) return
      const N = nRef.current
      if (filledRef.current >= N) {
        stop = true
        setAuto(false)
        setDrip('autoDone')
        return
      }
      filledRef.current += 1
      setFilled(filledRef.current)
      setDrip('count')
    }, 70)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [live, auto])

  function onSlide(raw: string) {
    const v = Number(raw)
    setAuto(false)
    nRef.current = v
    setN(v)
    filledRef.current = 0
    setFilled(0)
    setDrip('count')
  }

  function oneFill() {
    const N = nRef.current
    if (filledRef.current >= N) {
      filledRef.current = 0
      setFilled(0)
      setDrip('flush')
      return
    }
    filledRef.current += 1
    setFilled(filledRef.current)
    setDrip(filledRef.current >= N ? 'full' : 'count')
  }

  function startAuto() {
    if (auto) return
    filledRef.current = 0
    setFilled(0)
    setDrip('count')
    setAuto(true)
  }

  function resetTank() {
    setAuto(false)
    filledRef.current = 0
    setFilled(0)
    setDrip('empty')
  }

  const eff = n * MICRO_TOK
  const exact = eff === 524288
  const water = Math.min(100, (filled / n) * 100)
  return (
    <div className={styles.scope}>
      <h2>③ 梯度累积:显存放不下大 batch,就攒梯度</h2>
      <p className="lead">
        GPT-2 的等效大 batch 是 <span className="d d-batch">524288<i>token/步</i></span>(<code>total_batch_size</code>,2<sup>19</sup>)。 单卡一次只喂得下一个<b>微 batch</b>:<span className="d d-batch">8<i>micro_batch</i></span> 条序列 × <span className="d d-block">1024<i>seq_len</i></span> = 8192 token。 办法:连喂若干个微 batch、把梯度<b>累加</b>进"蓄水槽",攒满了才 <code>optimizer.step()</code> 走一步。拖滑块看要攒几次。
      </p>
      <div className="sliderbox">
        <div className="srow">
          <label>grad_accum 累积次数</label>
          <input type="range" min={1} max={128} step={1} value={n} onChange={(e) => onSlide(e.target.value)} />
          <span className="sval">{n}</span>
        </div>
        <div className="ticks"><span>1(不累积)</span><span>64 = 真实默认</span><span>128</span></div>
      </div>
      <div className="tankwrap">
        <div className="tank">
          <div className="water" style={{ height: `${water}%` }} />
          <div className="marks"><div className="fullline" /><div className="fulllabel">放水线 = step()</div></div>
        </div>
        <div className="tankinfo">
          <div className="bigstat"><span>{fmt(eff)}</span> <small>token / 优化步(等效 batch)</small></div>
          <div className="dripfx">
            {drip === 'flush' ? <>💧 <b>放水!</b> 攒满 {n} 次 → <code>optimizer.step()</code> 走一步,清空重攒。</> : null}
            {drip === 'full' ? <>✅ 攒满 <b>{n}</b> 次(={fmt(n * MICRO_TOK)} token)。再点一下 = <code>optimizer.step()</code> 放水走一步。</> : null}
            {drip === 'autoDone' ? <>✅ 攒满 <b>{n}</b> 次 → 该 <code>optimizer.step()</code> 放水走一步了。</> : null}
            {drip === 'count' ? <>蓄水槽:<b>{filled}</b> / {n} 个微 batch · 已攒 <b>{fmt(filled * MICRO_TOK)}</b> token</> : null}
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            累积 <b>{n}</b> 次 × 每次 <b>8192</b> token = <b>{fmt(eff)}</b> token/步。
            {exact ? <> 正好等于真实 <code>total_batch_size = 524288</code>(64 次)。</> : <> 真实默认是 <b>64 次 → 524288</b>(<code>total_batch_size</code>)。</>}
          </div>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={oneFill}>＋ 喂一个微 batch</button>
        <button type="button" className="btn ghost" onClick={startAuto}>⏩ 自动攒满</button>
        <button type="button" className="btn ghost" onClick={resetTank}>↺ 清空</button>
      </div>
      <Dig title="累积梯度,为什么 loss 要除以累积次数?">
        因为大 batch 的目标是对 <code>524288</code> 个 token 的损失求<b>平均</b>。代码里
        <code>loss = loss / grad_accum</code> 再 <code>loss.backward()</code>:每个微 batch 贡献 <code>1/N</code>,
        累加 N 次正好等于"在一个大 batch 上算一次平均梯度"。不除的话梯度会被放大 N 倍,等于偷偷把学习率乘了 N。
      </Dig>
      <Dig title={'累积出来的大 batch,和"真的一次喂这么大"完全等价吗?'}>
        在<b>数学梯度</b>上等价(忽略累加的浮点误差)。差别只在<b>含 batch 统计量的层</b> ——
        好在 GPT-2 用的是 <Term k="layernorm" name="LayerNorm · 层归一化" def="对每个 token 自己的特征做归一化,不跨样本统计。所以它不受 batch 大小影响,天然适合梯度累积。">LayerNorm</Term>(只在单个 token 内部归一化,不跨样本),
        所以累积和真大 batch 在这里<b>就是等价的</b>,可以放心拿显存换 batch。
      </Dig>
      <p className="next-hint">大 batch 攒好了,每一步该用<b>多大的学习率</b>?大模型不能一上来就猛冲。下一步:warmup + 余弦退火。</p>
    </div>
  )
}

function Step4() {
  const live = useStepLive()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [warmup, setWarmup] = useState(715)
  const [maxSteps, setMaxSteps] = useState(19100)

  useEffect(() => {
    if (!live) return
    const cv = canvasRef.current
    if (!cv) return
    const paint = () => drawLR(cv, warmup, maxSteps)
    paint()
    const raf = requestAnimationFrame(paint)
    const onResize = () => paint()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [live, warmup, maxSteps])

  const pct = ((warmup / maxSteps) * 100).toFixed(1)
  return (
    <div className={styles.scope}>
      <h2>④ 学习率 schedule:先热身,再余弦退火(本页交互重点)</h2>
      <p className="lead">
        学习率不是常数。前 <span className="d d-lr">warmup_steps<i>热身</i></span> 步从 0 <b>线性爬</b>到峰值 <span className="d d-lr">6e-4<i>max_lr</i></span>,之后<b>余弦</b>平滑退火到 <span className="d d-lr">6e-5<i>min_lr</i></span>(= max_lr × 0.1),末尾保持不变。 拖两个滑块,曲线<b>实时精确重画</b>(就是 <code>get_lr</code> 这个纯函数,不是示意)。
      </p>
      <div className="sliderbox">
        <div className="srow">
          <label>warmup_steps</label>
          <input type="range" min={0} max={3000} step={5} value={warmup} onChange={(e) => setWarmup(Number(e.target.value))} />
          <span className="sval">{warmup}</span>
        </div>
        <div className="ticks"><span>0(不热身)</span><span>715 = 10B 跑</span><span>3000</span></div>
      </div>
      <div className="sliderbox tight">
        <div className="srow">
          <label>max_steps</label>
          <input type="range" min={2000} max={25000} step={100} value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} />
          <span className="sval">{maxSteps}</span>
        </div>
        <div className="ticks"><span>2000</span><span>19073 = 10B 跑</span><span>25000</span></div>
      </div>
      <div className="chartbox">
        <canvas ref={canvasRef} height={300} />
        <div className="legend">
          <span><span className="sw" style={{ background: '#7a5bd0' }} />学习率 lr(step)</span>
          <span><span className="sw" style={{ background: '#b8512f', height: 0, borderTop: '2px dashed #b8512f' }} />warmup 区</span>
          <span><span className="dot" style={{ background: '#7a5bd0' }} />峰值 max_lr=6e-4</span>
          <span><span className="dot" style={{ background: '#3f7d63' }} />谷底 min_lr=6e-5</span>
        </div>
      </div>
      <div className="note">
        {warmup === 0 ? (
          <>⚠️ <b>warmup=0</b>:开局直接顶到 <b>6e-4</b> —— 真实大模型这样常常一步就发散。</>
        ) : (
          <>前 <b>{warmup}</b> 步线性爬到峰值 <b>6e-4</b>(约占总训练 {pct}%),之后余弦退火到 <b>6e-5</b>。这里的 warmup=715 / max_steps=19073 是 <b>10B 完整跑</b>的设置;脚本 argparse 默认是 warmup=100 / max_steps=2000。</>
        )}
      </div>
      <Dig title="为什么大模型不 warmup、开局就崩?">
        刚初始化时参数是随机的,梯度<b>又大又乱</b>。这时若直接上峰值学习率,一步就能把参数推到很离谱的地方,
        loss 直接发散(NaN)。warmup 让学习率<b>从 0 慢慢爬</b>,给模型几百步"找到合理方向"的时间,
        等梯度稳定了再加速。<code>get_lr</code> 里就是 <code>{'step < warmup_steps'}</code> 时
        <code>max_lr × (step+1) / warmup_steps</code> 这条线性斜坡。
      </Dig>
      <Dig title="为什么后面要余弦退火,不一直用大学习率?">
        大学习率适合"大步快走"快速下降,但接近谷底时步子太大会在最优点附近<b>反复横跳</b>下不去。
        余弦退火让学习率<b>越走越小</b>,后期小步精修、稳稳收敛。代码里是
        <code>coeff = 0.5×(1+cos(π·ratio))</code>,把进度 <code>ratio</code> 从 0→1 平滑映射成系数 1→0,
        再插值到 <code>[min_lr, max_lr]</code> 之间。
      </Dig>
      <Dig title={'优化器那一行还有哪些"老司机"设置?'}>
        优化器是 <Term k="adamw" name="AdamW · 带权重衰减的 Adam" def="Adam 优化器的改良版,把权重衰减(L2 正则)从梯度里拆出来单独做。是训练 Transformer 的事实标准。">AdamW</Term>:
        <code>betas=(0.9, 0.95)</code>(GPT 系比默认 0.999 更小的二阶动量)、<code>eps=1e-8</code>、<code>fused=True</code>(把更新融合成一个 CUDA kernel 提速)。
        <code>weight_decay=0.1</code> 还<b>分组</b>:只对 2 维参数(矩阵、嵌入)做衰减,bias 和 LayerNorm 的增益/偏置<b>不衰减</b>
        (<code>configure_optimizers</code> 里的 decay / nodecay 两组)。另外每步还做<b>梯度裁剪</b>把范数截到 1.0,防偶发巨梯度炸训练。
      </Dig>
      <p className="next-hint">学习率排好了,训练真跑起来 —— loss 会从哪降到哪?下一步用<b>两个真实端点</b>看收敛和数据量的关系。</p>
    </div>
  )
}

function Step5() {
  const live = useStepLive()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!live) return
    const cv = canvasRef.current
    if (!cv) return
    const paint = () => drawLoss(cv)
    paint()
    const raf = requestAnimationFrame(paint)
    window.addEventListener('resize', paint)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', paint)
    }
  }, [live])

  return (
    <div className={styles.scope}>
      <h2>⑤ 收敛 + 数据量对照:两个真实端点,数据多 33×</h2>
      <p className="lead">
        随机初始化时,模型对 50257 个 token 完全瞎猜,loss ≈ <code>ln(50257) ≈ 10.82</code>(代码开训前会打印这个基线)。 训练让它一路下降。本项目<b>没有保存逐 step 的 loss</b>,只有两次跑各自的<b>终点</b> —— 下面是这两个真实端点, 以及它们对应的<b>数据量差 33×</b>。
      </p>
      <div className="endpts">
        <div className="epcard short">
          <div className="eptag">短跑 · 约 300M token</div>
          <div className="epval">3.65 <small>val_loss</small></div>
          <div className="epmeta">step 1999 · 快速验证管线<br />(用了比 524288 更小的 batch)</div>
        </div>
        <div className="epcard long">
          <div className="eptag">长跑 · 约 10B token</div>
          <div className="epval">3.02 <small>val_loss</small></div>
          <div className="epmeta">step 19072 · max_steps=19073<br />warmup 715 · 完整余弦退火</div>
        </div>
      </div>
      <div className="sub-h"><span className="badge">⚠️ 示意</span>下降趋势(<b>非实测逐 step</b>,只有两端点是真的)</div>
      <div className="chartbox">
        <canvas ref={canvasRef} height={280} />
        <div className="legend">
          <span><span className="dot" style={{ background: '#b8512f' }} />真实端点 1:300M → 3.65</span>
          <span><span className="dot" style={{ background: '#2c8a6b' }} />真实端点 2:10B → 3.02</span>
          <span><span className="sw" style={{ background: '#bbb', height: 0, borderTop: '2px dashed #bbb' }} />示意趋势(非实测)</span>
        </div>
      </div>
      <div className="note">
        数据量从 <b>300M → 10B</b> 翻了约 <b>33×</b>,val_loss 从 <b>3.65 → 3.02</b>。 虚线只是<b>示意</b>大致形状,中间没有任何实测点 —— 别把它当真实曲线。两个圆点才是项目里真实跑出来的数。
      </div>
      <Dig title="那 bf16 / torch.compile / Flash-Attention 是什么,这页为什么不细讲?">
        它们是<b>纯工程提速</b>,不改训练数学:<Term k="bf16" name="bf16 · 混合精度" def="bfloat16,16 位浮点。前向用它算更快、省一半显存,数值范围和 fp32 一样大,精度几乎无损。">bf16</Term> 混合精度(算得快、省显存)、
        <code>torch.compile</code>(把模型编译成更快的 kernel)、<Term k="flash-attention" name="Flash-Attention" def="一种省显存又更快的注意力实现(F.scaled_dot_product_attention),不显式构造 T×T 的注意力矩阵。">Flash-Attention</Term>
        (<code>F.scaled_dot_product_attention</code>,不显式建 T×T 矩阵)。它们让同样的训练<b>更快更省</b>,但 loss 曲线该到哪还是到哪 —— 所以本页只点到为止。
      </Dig>
      <Dig title="loss 3.02 到底算好还是不好?">
        从 10.82 的随机基线降到 3.02,已经是一个能写出<b>通顺英文</b>的 base 模型了(GPT-2 124M 原版量级)。
        但它仍<b>只会续写、不会答题</b>。而且 loss 还没到底:继续喂更多 token、训更多步还能再降 ——
        这正是"数据量 33× → loss 明显更低"想说的:<b>规模和数据,是预训练最朴素也最硬的杠杆</b>。
      </Dig>
      <p className="next-hint">训练好了,这台机器怎么把字<b>吐出来</b>?去看「采样」那一关(<code>05_sample.py</code> / 05_sampling_viz)。点右下角「完成 🎉」。</p>
    </div>
  )
}

export function Pretraining() {
  const chapter = findChapter('pretraining')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="pretraining"
      title="真训练:把玩具 GPT 喂真实数据(预训练 GPT-2 124M)"
      subtitle={
        <>
          本页对应 <code>phase1-124m/04_gpt2_124m.py</code>。架构内核和前几关<b>一模一样</b>(注意力 + FFN + 残差 + LayerNorm), 变的是<b>规模</b>和一整套"让大模型训得稳、训得动"的<b>训练工程</b>。这一页把"配置怎么涨 → 真数据怎么喂 → 显存不够怎么办 → 学习率怎么排 → 最后收敛到哪"五步拆开,每步亲手拨一个旋钮。
        </>
      }
      hp={
        <HpBar label="GPT-2 124M">
          <HpChip color="#9a7b2f" bg="#F4ECD6">n_layer <b>12</b></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">n_head <b>12</b></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>768</b></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">block_size <b>1024</b></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">vocab <b>50304</b></HpChip>
          <HpChip color="#2c7d8a" bg="#DCEef0">total_batch <b>524288</b> <i>token/步</i></HpChip>
          <HpChip color="#7a5bd0" bg="#EAE4F8">max_lr <b>6e-4</b></HpChip>
          <span className={`hp-note ${styles.hpCode}`}>这套就是 <code>GPTConfig</code> 真值 · 配套 <code>04_gpt2_124m.py</code></span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 真训练 · 跑通了!</div>
          <div className="cs">配置跃迁 → 真数据 shards → 梯度累积 → warmup+余弦 → loss 3.02,GPT-2 124M 预训练拼齐了</div>
        </>
      }
    />
  )
}
