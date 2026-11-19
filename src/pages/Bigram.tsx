import { useEffect, useRef, useState } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Bigram.module.css'

const SEQ = [
  { x: ['T', 'o', '␣'], y: ['o', '␣', 'b'] },
  { x: ['b', 'e', '␣'], y: ['e', '␣', 'o'] },
]
const VOCAB = ['o', '␣', 'b', 'e', 'r', 't']

type Question = {
  b: number
  t: number
  flat: number
  inCh: string
  target: string
  logits: number[]
  correctIdx: number
  probs: number[]
  pCorrect: number
}

function softmax(arr: number[]) {
  const m = Math.max(...arr)
  const ex = arr.map((v) => Math.exp(v - m))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((v) => v / s)
}

function makeLogits(flat: number, target: string) {
  let seed = (flat + 1) * 97
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const logits = VOCAB.map(() => rnd() * 3 - 1.5)
  let ci = VOCAB.indexOf(target)
  if (ci < 0) ci = 0
  logits[ci] += 1.6
  return { logits, correctIdx: ci }
}

const QUESTIONS: Question[] = []
for (let b = 0; b < 2; b++) {
  for (let t = 0; t < 3; t++) {
    const flat = b * 3 + t
    const made = makeLogits(flat, SEQ[b].y[t])
    const probs = softmax(made.logits)
    QUESTIONS.push({
      b, t, flat, inCh: SEQ[b].x[t], target: SEQ[b].y[t],
      logits: made.logits, correctIdx: made.correctIdx, probs, pCorrect: probs[made.correctIdx],
    })
  }
}

const LOOP = [
  { title: '取一批样本', code: 'get_batch("train")', desc: '随机抽 32×8 = 256 个 (x → y) 样本对:xb 是输入,yb 是目标。' },
  { title: 'forward 猜', code: 'model(xb, yb)', desc: '凭当前参数为每道题吐出 logits(打分)。第一圈参数是随机的,每个字符≈1/65 均等瞎猜 → 起步 loss≈ln(65)≈4.17。' },
  { title: 'cross_entropy 打分', code: '_, loss = ...', desc: '对照答案,把 256 道题压成一个标量 loss(成绩单)。' },
  { title: 'backward 算梯度', code: 'loss.backward()', desc: '反向传播,算出每个参数(开关)该往哪个方向扭。' },
  { title: 'step 扭开关', code: 'optimizer.step()', desc: '照梯度把参数各扭一小步 → 箭头回到第 1 步,开始下一圈。' },
]
const TILE_W = 150
const TILE_H = 64
const GAP_X = 20
const GAP_Y = 22
const KNOB_CELLS: [number, number][] = [[2, 3], [0, 1], [1, 2], [3, 1], [5, 0], [1, 0]]
const KNOB_NAMES = KNOB_CELLS.map(([r, c]) => `W[${VOCAB[r]}→${VOCAB[c]}]`)
const KNOB_BASE = [-32, 18, -8, 36, 6, -24]
const KNOB_CEIL = 2.5

function heat(t: number) {
  const x = Math.max(0, Math.min(1, t))
  const lo = [250, 249, 245]
  const hi = [217, 119, 87]
  const c = lo.map((v, i) => Math.round(v + (hi[i] - v) * x))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function freshWeights() {
  let wsd = 20240627
  const rnd = () => {
    wsd = (wsd * 1103515245 + 12345) & 0x7fffffff
    return wsd / 0x7fffffff
  }
  const born: number[][] = []
  const target: number[][] = []
  for (let r = 0; r < 6; r++) {
    born[r] = []
    target[r] = []
    for (let c = 0; c < 6; c++) {
      born[r][c] = rnd() * 2 - 1
      target[r][c] = -0.5 + rnd() * 0.6
    }
  }
  ;[[2, 3, 5], [0, 1, 4.6], [1, 2, 4.3], [1, 0, 3.9], [3, 1, 4.5], [3, 4, 3.7], [5, 0, 4.2], [4, 1, 3.3]].forEach(([r, c, v]) => {
    target[r][c] = v
  })
  return { born, target }
}
const WEIGHTS = freshWeights()

const SVG_W = 560
const SVG_H = 280
const PAD_L = 44
const PAD_B = 40
const PAD_T = 16
const PAD_R = 16
const plotW = SVG_W - PAD_L - PAD_R
const plotH = SVG_H - PAD_T - PAD_B
const LOSS_MAX = 4.7
const px = (p: number) => PAD_L + p * plotW
const py = (loss: number) => PAD_T + (1 - loss / LOSS_MAX) * plotH

const CPL = 46
const CPB = 40
const CPT = 16
const CPR = 18
const cpw = 560 - CPL - CPR
const cph = 280 - CPT - CPB
const STEP_MAX = 3000
const L_MIN = 2.3
const L_MAX = 4.4
const CEIL = 2.5
const START = Math.log(65)
const cX = (step: number) => CPL + (step / STEP_MAX) * cpw
const cY = (loss: number) => CPT + (1 - (loss - L_MIN) / (L_MAX - L_MIN)) * cph
function lossAt(step: number) {
  const base = CEIL + (START - CEIL) * Math.exp(-step / 240)
  const wob = step > 120 ? 0.018 * Math.sin(step / 95) : 0
  return Math.max(2.46, base + wob)
}

function angDeg(i: number) { return -90 + i * 72 }
function ptAt(deg: number, r: number) {
  const a = (deg * Math.PI) / 180
  return { x: 300 + r * Math.cos(a), y: 300 + r * Math.sin(a) }
}

function Step1() {
  return (
    <div className={styles.scope}>
      <h2>Step 1 · 一个 batch 长什么样:x 和 y 错开一格</h2>
      <p className="lead">
        取字符串 <code>"To be or"</code> 切成 <b>B=2</b> 个序列、每个长度 <b>T=3</b>。
        规则:看到 <code>x[t]</code> 就要预测它的下一个字符 <code>y[t]</code> —— 所以 y 是 x 整体右移一位。
      </p>
      <div className="seq-block">
        {SEQ.map((s, b) => (
          <div key={b}>
            <div className="seq-title">序列 {b}  (b={b})</div>
            <div className="seq-row"><span className="tag">x (输入)</span>{s.x.map((ch, i) => <div key={i} className="cell x">{ch}</div>)}</div>
            <div className="arrows">{s.x.map((_, i) => <div key={i} className="arrow-col">↓</div>)}</div>
            <div className="seq-row"><span className="tag">y (目标)</span>{s.y.map((ch, i) => <div key={i} className="cell y">{ch}</div>)}</div>
          </div>
        ))}
      </div>
      <div className="legend">
        <span><i className="swatch" style={{ background: '#EEF1EC' }} /> x:输入字符(喂给模型)</span>
        <span><i className="swatch" style={{ background: 'var(--accent-soft)' }} /> y:目标字符(正确答案)</span>
        <span style={{ color: 'var(--accent)' }}>↓ 看到上面 → 该预测下面</span>
      </div>
      <div className="note">
        一个 <Term k="batch" name="批 · batch" def="一次喂给模型并行处理的一组样本。batch_size=32 表示一次处理 32 条序列。它是「几条样本」,和向量维度无关。">batch</Term> 的"题目数" = <b>batch_size × block_size</b> = 2 × 3 = <b>6 道独立的分类题</b>。
        真实代码里是 <span className="d d-batch">32<i>batch</i></span> × <span className="d d-block">8<i>block</i></span> = <b>256 道</b>。每道题都是:在 <span className="d d-vocab">65<i>vocab</i></span> 个字符里选出正确的下一个。
      </div>
    </div>
  )
}

function Step2() {
  const [flat, setFlat] = useState(false)
  return (
    <div className={styles.scope}>
      <h2>Step 2 · 把三维 logits 摊平成二维分类题</h2>
      <p className="lead">
        模型对每个位置都吐出一个长度 65 的打分向量,所以 <Term k="logits" name="logits" def="模型最后一层输出的、未经 softmax 的原始打分,可正可负。过 softmax 后才变成概率。">logits</Term> 形状是{' '}
        <span className="shape-tag">{flat ? '(6, 65)' : '(2, 3, 65)'}</span> —— B 行 × T 列,每格里藏着 65 个数。{' '}
        <code>view(B*T, C)</code> 把这个 2×3 网格 <b>拉直成一列</b>,得到 6 道并排的题。
      </p>
      <div className="flip-controls">
        <button type="button" className={flat ? 'btn primary' : 'btn'} onClick={() => setFlat(true)}>摊平 · view(B*T, C)</button>
        <button type="button" className={flat ? 'btn' : 'btn primary'} onClick={() => setFlat(false)}>复原成 (B, T)</button>
      </div>
      <div className="flip-stage" style={{ height: flat ? 6 * (TILE_H + 10) : 2 * TILE_H + GAP_Y + 8 }}>
        {QUESTIONS.map((q) => {
          const pos = flat ? { x: 0, y: q.flat * (TILE_H + 10) } : { x: q.t * (TILE_W + GAP_X), y: q.b * (TILE_H + GAP_Y) }
          return (
            <div key={q.flat} className="tile" style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, width: flat ? '100%' : undefined, maxWidth: flat ? 420 : undefined }}>
              <span className="idx">(b={q.b}, t={q.t})</span>
              <span className="ch">输入 "{q.inCh}"</span>
              <span className="clen">{flat ? `第 ${q.flat} 题 · 65 个打分` : '↳ 65 个打分'}</span>
            </div>
          )
        })}
      </div>
      <div className="note">
        摊平 <b>不改变任何数据</b>,只是换了个排列方式:从"2×3 的二维结构"拉直成"6 道独立分类题"。
        C=65 这一维(每格里的 65 个打分)始终原封不动地跟着走。真实代码是 256 × 65。
      </div>
    </div>
  )
}

function Step3() {
  const [sel, setSel] = useState(0)
  const [prob, setProb] = useState(false)
  const q = QUESTIONS[sel]
  const vals = prob ? q.probs : q.logits
  const maxAbs = prob ? Math.max(...q.probs) : Math.max(...vals.map((v) => Math.abs(v)))
  const sum = q.probs.reduce((a, b) => a + b, 0)
  const p = q.probs[q.correctIdx]
  return (
    <div className={styles.scope}>
      <h2>Step 3 · 单道题里 cross_entropy 的三步</h2>
      <p className="lead">
        点一道题,看 <Term k="cross-entropy" name="交叉熵 · cross_entropy" def="分类损失:先 softmax 得概率,取正确类别概率 p,loss = -ln(p)。越确信正确答案 loss 越小。">cross_entropy</Term> 内部发生什么:<b>① <Term k="softmax" name="softmax" def="把一组打分变成和为 1 的概率分布:每个数取 exp 再除以总和。分数越大概率越大。">softmax</Term></b> 把打分变成概率 →{' '}
        <b>② 找出正确答案那一类</b> → <b>③ 取它概率的 -log</b>。词表用 6 个示意字符。
      </p>
      <div className="q-picker">
        {QUESTIONS.map((item) => (
          <button key={item.flat} type="button" className={item.flat === sel ? 'q-btn sel' : 'q-btn'} onClick={() => { setSel(item.flat); setProb(false) }}>
            第 {item.flat} 题:看 "{item.inCh}"
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 2 }}>
        第 {sel} 题:模型看到 "{q.inCh}",正确的下一个字符是 "{q.target}"(高亮那一类)。
      </div>
      <div className="bars">
        {VOCAB.map((ch, i) => {
          const v = vals[i]
          const h = Math.max(4, prob ? (q.probs[i] / maxAbs) * 100 : ((v + maxAbs) / (2 * maxAbs)) * 100)
          const on = i === q.correctIdx
          return (
            <div key={ch} className="bar-col">
              <div className="bar-val">{prob ? q.probs[i].toFixed(3) : v.toFixed(2)}</div>
              <div className={on ? 'bar correct' : 'bar'} style={{ height: `${h}%` }} />
              <div className={on ? 'bar-label correct' : 'bar-label'}>{ch}</div>
            </div>
          )
        })}
      </div>
      <div className="flip-controls" style={{ marginTop: 4 }}>
        <button type="button" className={prob ? 'btn primary' : 'btn'} onClick={() => setProb(true)}>应用 softmax(打分 → 概率)</button>
        <button type="button" className={prob ? 'btn ghost' : 'btn ghost primary'} onClick={() => setProb(false)}>看原始 logits</button>
      </div>
      <div className="calc-box">
        {prob ? (
          <>
            softmax 后所有概率之和 = <b>{sum.toFixed(3)}</b> ✓<br />
            正确类 "{q.target}" 的概率 &nbsp; p = <b>{p.toFixed(4)}</b><br /><br />
            loss = -ln(p) = -ln({p.toFixed(4)}) = <span className="big">{(-Math.log(p)).toFixed(4)}</span>
          </>
        ) : (
          <>当前是 <b>原始 logits</b>(可正可负的打分)。点上面的「应用 softmax」把它们变成加起来 = 1 的概率分布。</>
        )}
      </div>
      <div className="note">
        <code>cross_entropy(logits, target)</code> = 内部先做 <b>softmax</b> 得到概率分布,
        再取 <b>正确类别</b>的概率 p,最后 <b>loss = -ln(p)</b>。
        (实现上用 log_softmax 更数值稳定,但意义等价。)
      </div>
    </div>
  )
}

function Curve({ p }: { p: number }) {
  let d = ''
  for (let i = 0; i <= 200; i++) {
    const x = 0.005 + (1 - 0.005) * (i / 200)
    const loss = Math.min(LOSS_MAX, -Math.log(x))
    d += (i === 0 ? 'M' : 'L') + px(x).toFixed(1) + ',' + py(loss).toFixed(1) + ' '
  }
  const loss = -Math.log(p)
  const x = px(p)
  const y = py(Math.min(LOSS_MAX, loss))
  const yr = py(Math.log(65))
  return (
    <svg className="curve" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="#ccc7ba" />
      <line x1={PAD_L} y1={PAD_T + plotH} x2={PAD_L + plotW} y2={PAD_T + plotH} stroke="#ccc7ba" />
      {[0, 1, 2, 3, 4].map((v) => (
        <g key={v}>
          <line x1={PAD_L - 4} y1={py(v)} x2={PAD_L} y2={py(v)} stroke="#ccc7ba" />
          <text x={PAD_L - 8} y={py(v) + 4} fontSize="10" fill="#6B6B68" textAnchor="end">{v}</text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={px(v)} y1={PAD_T + plotH} x2={px(v)} y2={PAD_T + plotH + 4} stroke="#ccc7ba" />
          <text x={px(v)} y={PAD_T + plotH + 18} fontSize="10" fill="#6B6B68" textAnchor="middle">{v}</text>
        </g>
      ))}
      <line x1={PAD_L} y1={yr} x2={PAD_L + plotW} y2={yr} stroke="#D97757" strokeDasharray="4 4" opacity="0.5" />
      <text x={PAD_L + plotW} y={yr - 5} fontSize="10" fill="#D97757" textAnchor="end">≈4.17 随机初始</text>
      <text x={PAD_L + plotW / 2} y={SVG_H - 4} fontSize="11" fill="#6B6B68" textAnchor="middle">p (正确类概率)</text>
      <path d={d} fill="none" stroke="#1A1A18" strokeWidth="2" />
      <circle cx={x} cy={y} r="7" fill="#D97757" stroke="#fff" strokeWidth="2" />
      <line x1={x} x2={x} y1={y} y2={PAD_T + plotH} stroke="#D97757" strokeDasharray="3 3" opacity="0.5" />
    </svg>
  )
}

function Step4() {
  const [slider, setSlider] = useState(50)
  const p = slider / 100
  const loss = -Math.log(p)
  const terms = QUESTIONS.map((q) => -Math.log(q.pCorrect))
  const mean = terms.reduce((a, b) => a + b, 0) / terms.length
  return (
    <div className={styles.scope}>
      <h2>Step 4 · 核心直觉:loss = -ln(p)</h2>
      <p className="lead">
        拖动滑块改变"模型给真实下一字符的概率 p",观察 loss 怎么变。{' '}
        <b>模型越确信正确答案(p→1),loss→0;越瞎猜,loss 越大。</b>
      </p>
      <div className="slider-row">
        <input className="slider" type="range" min={1} max={100} value={slider} style={{ ['--fill' as string]: `${p * 100}%` }} onChange={(e) => setSlider(Number(e.target.value))} />
        <div className="readout">
          <div className="item"><div className="k">p(正确类)</div><div className="v">{p.toFixed(p < 0.1 ? 3 : 2)}</div></div>
          <div className="item"><div className="k">loss = -ln(p)</div><div className="v">{loss.toFixed(2)}</div></div>
        </div>
      </div>
      <div className="refs">
        {[[0.0154, 'p≈1/65=0.015 · 随机初始 loss≈4.17'], [0.5, 'p=0.5 · loss≈0.69'], [0.9, 'p=0.9 · loss≈0.11'], [1, 'p=1.0 · loss=0(完美)']].map(([pv, label]) => (
          <span key={label as string} className="ref-chip" onClick={() => setSlider(Math.round(Math.max(1, Math.min(100, Number(pv) * 100))))}>{label}</span>
        ))}
      </div>
      <Curve p={p} />
      <div className="note">
        训练就是不断把"模型给真实下一字符的概率"往 1 推,从而把 loss 从随机的{' '}
        <b>ln(65)≈4.17</b> 一路压向 0。这就是为什么 nanoGPT 一开始 loss 接近 4.17 不是 bug。
      </div>
      <div className="avg-box">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          最终的标量 loss = 6 道题各自 -ln(p) 的平均(reduction='mean')
        </div>
        <div className="avg-terms">各题 -ln(p): [ {terms.map((t) => t.toFixed(3)).join(',  ')} ]</div>
        <div className="avg-result">平均 = ( {terms.map((t) => t.toFixed(2)).join(' + ')} ) / 6 = <b>{mean.toFixed(4)}</b></div>
        <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 10, lineHeight: 1.6 }}>
          ⚠️ 这个平均(上面那个数)只是<b>这 6 道示意题</b>的 loss —— 它们的 logits 是<b>为演示故意调得偏准的</b>(正确答案概率偏高),所以数字偏小。
          它<b>不是</b>真实 bigram 的训练 loss(真实起步 ≈4.17、收敛 ~2.5);这里只为看清"<b>多道题的 loss 怎么平均成一个标量</b>"这件事。
        </div>
      </div>
    </div>
  )
}

function Step5() {
  const live = useStepLive()
  const [loopIdx, setLoopIdx] = useState(-1)
  const [loopRound, setLoopRound] = useState(0)
  const [auto, setAuto] = useState(false)
  const [angles, setAngles] = useState(KNOB_BASE.slice())
  const [roundB, setRoundB] = useState(0)
  const [lossB, setLossB] = useState(4.17)
  const roundRef = useRef(0)
  const lossRef = useRef(4.17)
  const [delta, setDelta] = useState('')
  const [showGrad, setShowGrad] = useState(false)
  const [table, setTable] = useState(() => WEIGHTS.born.map((row) => row.slice()))
  const [wRound, setWRound] = useState(0)
  const [wRow, setWRow] = useState(2)
  const [curveStep, setCurveStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => {
      setLoopIdx((i) => {
        const next = i + 1
        if (next > 4) {
          setLoopRound((r) => r + 1)
          return 0
        }
        return next
      })
    }, 1100)
    return () => window.clearInterval(id)
  }, [auto])

  useEffect(() => {
    if (!live) setAuto(false)
  }, [live])

  useEffect(() => {
    if (!playing) return
    const t0 = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / 2600)
      const e = 1 - (1 - t) ** 2
      setCurveStep(STEP_MAX * e)
      if (t < 1) raf = requestAnimationFrame(frame)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  function trainOne() {
    const nextRound = roundRef.current + 1
    roundRef.current = nextRound
    const damp = 0.72 ** (nextRound - 1)
    const prev = lossRef.current
    const next = KNOB_CEIL + (prev - KNOB_CEIL) * 0.74
    lossRef.current = next
    const d = next - prev
    setRoundB(nextRound)
    setAngles((cur) => cur.map((a) => a + 16 * damp))
    setLossB(next)
    setDelta(`↓ ${d.toFixed(3)}${next - KNOB_CEIL < 0.02 ? '(已近天花板 2.5)' : ''}`)
    setShowGrad(true)
    setWRound((n) => n + 1)
    setTable((cur) => cur.map((row, r) => row.map((v, c) => v + (WEIGHTS.target[r][c] - v) * 0.5)))
  }

  function resetTrain() {
    roundRef.current = 0
    lossRef.current = 4.17
    setAngles(KNOB_BASE.slice())
    setRoundB(0)
    setLossB(4.17)
    setDelta('')
    setShowGrad(false)
    setTable(WEIGHTS.born.map((row) => row.slice()))
    setWRound(0)
  }

  const arcs = Array.from({ length: 5 }, (_, i) => {
    const a0 = angDeg(i) + 24
    const a1 = angDeg(i + 1) - 24
    const p0 = ptAt(a0, 200)
    const p1 = ptAt(a1, 200)
    const back = i === 4
    return { d: `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} A200,200 0 0 1 ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`, back }
  })
  const label = ptAt(angDeg(4) + 36, 224)
  const loop = loopIdx < 0 ? null : LOOP[loopIdx]
  let mn = Infinity
  let mx = -Infinity
  table.forEach((row) => row.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v }))
  const rng = (mx - mn) || 1
  const ps = softmax(table[wRow])
  const maxp = Math.max(...ps)
  const tip = wRound === 0
    ? '出生时:随机雪花表(颜色杂乱无规律)。点上方「执行一轮训练」看它逐渐变出结构。'
    : `已训练 ${wRound} 轮:雪花正在长出结构 —— 少数接龙格子升高变橘,其余压低变浅。`
  let curve = ''
  for (let i = 0; i <= 120; i++) {
    const s = curveStep * (i / 120)
    curve += (i === 0 ? 'M' : 'L') + cX(s).toFixed(1) + ',' + cY(lossAt(s)).toFixed(1) + ' '
  }

  return (
    <div className={styles.scope}>
      <h2>Step 5 · 训练循环:5 行代码 = 一个不断转的闭环</h2>
      <p className="lead">
        前 4 步只讲清了"怎么给一批题打一个分(loss)"。真正的训练,是把下面这{' '}
        <b>5 行</b>放进一个 <code>for</code> 里,转 <b>3000 圈</b>。每转一圈,模型的参数就被
        梯度推着扭一小步,loss 随之下降一点点。
      </p>
      <div className="sub-h"><span className="badge">A</span>这个闭环每一步在做什么</div>
      <p className="sub-desc">
        5 个动作沿圆环顺时针依次执行;点「单步执行」像调试器一样一步步走,或「自动循环」让高亮自动流动。
        注意第 5 步之后,箭头会<b>回到第 1 步</b> —— 这就是"闭环重复"。
      </p>
      <div className="flip-controls">
        <button type="button" className="btn primary" onClick={() => { setAuto(false); setLoopIdx((i) => (i + 1 > 4 ? (setLoopRound((r) => r + 1), 0) : i + 1)) }}>▶ 单步执行</button>
        <button type="button" className={auto ? 'btn primary' : 'btn ghost'} onClick={() => setAuto((v) => !v)}>{auto ? '⏸ 暂停' : '▶▶ 自动循环'}</button>
        <button type="button" className="btn ghost" onClick={() => { setAuto(false); setLoopIdx(-1); setLoopRound(0) }}>复位</button>
      </div>
      <div className="loop-wrap">
        <div className="loop-stage">
          <svg className="loop-svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="bigram-ahead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#D97757" />
              </marker>
              <marker id="bigram-ahead2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#c9c3b5" />
              </marker>
            </defs>
            {arcs.map((arc, i) => (
              <path key={i} d={arc.d} fill="none" stroke={arc.back ? '#D97757' : '#c9c3b5'} strokeWidth={arc.back ? 2.6 : 1.8} markerEnd={`url(#${arc.back ? 'bigram-ahead' : 'bigram-ahead2'})`} strokeDasharray={arc.back ? '7 5' : undefined} />
            ))}
            <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} fontSize="13" fill="#D97757" textAnchor="middle">闭环·重复</text>
          </svg>
          <div className="loop-center">
            <div className="li-k">{loop ? `第 ${loopIdx + 1} 步 · ${loop.code}` : '训练循环'}</div>
            <div className="li-desc">{loop ? loop.desc : '把这 5 步重复 3000 次。每一圈,模型都更聪明一点点。'}</div>
            <div className="li-count">{loop ? `已转 ${loopRound} 圈${loopIdx === 4 ? ' · ↩ 之后回到第 1 步' : ''}` : ''}</div>
          </div>
          {LOOP.map((n, i) => {
            const p = ptAt(angDeg(i), 200)
            return (
              <div key={n.code} className={i === loopIdx ? 'lnode on' : 'lnode'} style={{ left: `${(p.x / 600) * 100}%`, top: `${(p.y / 600) * 100}%` }}>
                <div className="ln-num">{i + 1}</div>
                <div className="ln-title">{n.title}</div>
                <div className="ln-code">{n.code}</div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="note">
        代码就是 <code>for it in range(max_iters): get_batch → forward → cross_entropy → backward → step</code>。
        5 个动作首尾相接,转一圈叫一次 <b>iteration</b>,转 3000 圈就训练完了。
      </div>
      <div className="sub-h"><span className="badge">B</span>参数是"开关",loss 是"成绩单"——点训练,旋钮 / 表 / 预测一起变</div>
      <p className="sub-desc">
        别把 loss 和参数搞混:<b>参数(旋钮 / 下面这张表)是因,loss(成绩单)是果</b>。
        旋钮只是拟物;参数真正的样子是<b>一张 vocab×vocab 的得分表</b>(第 i 行第 j 列 = "看到字符 i 后,下一个是 j 的得分"),
        形状由词表大小决定(真实 65×65,和 batch 的 2×3 无关)。下面用 6 字符示意画 <b>6×6</b>。
      </p>
      <div className="train-controls">
        <button type="button" className="btn primary" onClick={trainOne}>执行一轮训练(扭旋钮 → loss 下降)</button>
        <button type="button" className="btn" onClick={resetTrain}>复位</button>
      </div>
      <div className="bgrid">
        <div className="bcard">
          <div className="bcard-h">① 6 个示意旋钮(参数 = 开关)与 loss 成绩单</div>
          <div className="knob-loss-row">
            <div className="knob-row">
              {KNOB_NAMES.map((nm, i) => (
                <div key={nm} className="knob">
                  <div className={roundB > 0 ? 'knob-dial spun' : 'knob-dial'} style={{ transform: `rotate(${angles[i].toFixed(1)}deg)` }} />
                  <div className={showGrad ? 'knob-grad show' : 'knob-grad'}>↻ 右扭</div>
                  <div className="knob-name">{nm}</div>
                </div>
              ))}
            </div>
            <div className="score-card">
              <span className="sc-k">loss(成绩单)</span>
              <span className="sc-v">{lossB.toFixed(3)}</span>
              <span className="sc-arrow">{delta}</span>
            </div>
          </div>
          <div className="bcard-foot">
            真实是 <span className="d d-vocab">65<i>vocab</i></span>×<span className="d d-vocab">65<i>vocab</i></span> = 4225 个开关,这里画 6 个示意;每个旋钮下方箭头 = 梯度提示(该往哪扭)。
          </div>
        </div>
        <div className="bcard">
          <div className="bcard-h">② 参数真身:6×6 得分表(真实 65×65)· <span style={{ color: 'var(--accent)' }}>点一行看预测 ↓</span></div>
          <div className="wtable">
            <div className="wt-corner">行=当前<br />列=下一个</div>
            {VOCAB.map((ch) => <div key={ch} className="wt-h">{ch}</div>)}
            {table.map((row, r) => (
              <div key={VOCAB[r]} style={{ display: 'contents' }}>
                <div className={r === wRow ? 'wt-rh sel' : 'wt-rh'} onClick={() => setWRow(r)}>{VOCAB[r]}</div>
                {row.map((v, c) => {
                  const t = (v - mn) / rng
                  const knob = KNOB_CELLS.some(([a, b]) => a === r && b === c)
                  return (
                    <div key={c} className={['wt-cell', knob ? 'knob' : '', r === wRow ? 'rowsel' : ''].filter(Boolean).join(' ')} style={{ background: heat(t), color: t > 0.58 ? '#fff' : '#6B6B68' }} onClick={() => setWRow(r)}>
                      {v.toFixed(1)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="wt-legend">
            <span className="wt-tip">{tip}</span>
            <span className="wt-scale"><i />低分</span>
            <span className="wt-scale"><b />高分</span>
          </div>
          <div className="wpredict">
            <div className="wp-title">查表第 "<b>{VOCAB[wRow]}</b>" 行 → 6 个 logit 过 softmax = 看到 "{VOCAB[wRow]}" 时对下一个字符的概率猜测(和 ≈ 100%):</div>
            <div className="wp-bars">
              {ps.map((value, c) => {
                const top = value === maxp
                return (
                  <div key={VOCAB[c]} className="wp-col">
                    <div className="wp-val">{(value * 100).toFixed(0)}%</div>
                    <div className={top ? 'wp-bar top' : 'wp-bar'} style={{ height: `${Math.max(4, (value / maxp) * 100).toFixed(1)}%` }} />
                    <div className={top ? 'wp-lab top' : 'wp-lab'}>{VOCAB[c]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="note">
        <b>训练 = 把这 36(真实 4225)个数字,从随机雪花,调成字符接龙的统计规律。</b>
        {' '}每个旋钮(W[当前→下一个])就是表里的<b>一个格子</b>(橘色描边标出),旋钮一转,格子数字同步变,loss 随之下降。
        转动幅度为<b>确定性演示值</b>(非真实梯度,越接近天花板扭动越小)。
        {' '}<b>点某一行</b> = 取该行 6 个 logit 过 softmax,就是模型看到该字符时对"下一个字符"的概率猜测。
      </div>
      <div className="sub-h"><span className="badge">C</span>3000 圈下来,loss 怎么走</div>
      <p className="sub-desc">
        点「训练!」,看曲线从左到右画出来。起点 ≈ 4.17 是<b>随机瞎猜</b>(=ln(65)),
        迅速掉到 ~2.6,最后<b>卡在 ~2.5 下不去</b>。
      </p>
      <div className="flip-controls">
        <button type="button" className="btn primary" onClick={() => { setPlaying(false); setCurveStep(0); setPlaying(true) }}>训练!</button>
        <button type="button" className="btn ghost" onClick={() => { setPlaying(false); setCurveStep(0) }}>重置曲线</button>
      </div>
      <div className="loss-readout">
        <div className="item"><div className="k">step</div><div className="v">{Math.round(curveStep)}</div></div>
        <div className="item"><div className="k">loss</div><div className="v">{lossAt(curveStep).toFixed(2)}</div></div>
      </div>
      <svg className="loss-curve" viewBox="0 0 560 280" preserveAspectRatio="xMidYMid meet">
        <line x1={CPL} y1={CPT} x2={CPL} y2={CPT + cph} stroke="#ccc7ba" />
        <line x1={CPL} y1={CPT + cph} x2={CPL + cpw} y2={CPT + cph} stroke="#ccc7ba" />
        {[2.5, 3, 3.5, 4].map((v) => (
          <g key={v}>
            <line x1={CPL - 4} y1={cY(v)} x2={CPL} y2={cY(v)} stroke="#ccc7ba" />
            <text x={CPL - 8} y={cY(v) + 4} fontSize="10" fill="#6B6B68" textAnchor="end">{v}</text>
          </g>
        ))}
        {[0, 1000, 2000, 3000].map((v) => (
          <g key={v}>
            <line x1={cX(v)} y1={CPT + cph} x2={cX(v)} y2={CPT + cph + 4} stroke="#ccc7ba" />
            <text x={cX(v)} y={CPT + cph + 18} fontSize="10" fill="#6B6B68" textAnchor="middle">{v}</text>
          </g>
        ))}
        <line x1={CPL} y1={cY(START)} x2={CPL + cpw} y2={cY(START)} stroke="#D97757" strokeDasharray="4 4" opacity="0.55" />
        <text x={CPL + cpw} y={cY(START) - 5} fontSize="10" fill="#D97757" textAnchor="end">≈4.17 = ln(65) 随机起点</text>
        <line x1={CPL} y1={cY(CEIL)} x2={CPL + cpw} y2={cY(CEIL)} stroke="#8a8a85" strokeDasharray="4 4" opacity="0.55" />
        <text x={CPL + cpw} y={cY(CEIL) - 5} fontSize="10" fill="#6B6B68" textAnchor="end">≈2.5 bigram 天花板</text>
        <text x={CPL + cpw / 2} y={277} fontSize="11" fill="#6B6B68" textAnchor="middle">step(训练迭代次数)</text>
        <path d={curve} fill="none" stroke="#1A1A18" strokeWidth="2" />
        <circle cx={cX(curveStep).toFixed(1)} cy={cY(lossAt(curveStep)).toFixed(1)} r="5" fill="#D97757" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="note">
        两个关键点:① 起点 <b>4.17 = ln(vocab_size)</b>,是完全随机时的 loss,不是 bug;
        ② 卡在 <b>2.5</b> 下不去,是因为 bigram <b>只看前 1 个字符</b> —— 这是它的能力天花板,
        也正是下一课要加 <b>注意力(attention)</b> 的理由。
      </div>
      <Dig title={<>为什么每轮要先 <Term k="zero-grad" name="梯度清零 · zero_grad" def="PyTorch 的梯度默认累加,所以每轮开头必须先清零,否则会带着上一轮的陈旧方向。顺序:zero_grad → backward → step。"><code>optimizer.zero_grad()</code></Term>?</>}>
        PyTorch 的<Term k="gradient" name="梯度 · gradient" def="loss 对每个参数的偏导数,指出参数往哪个方向调、loss 下降最快。backward() 负责算它。">梯度</Term>是<b>累加</b>的:<code>loss.backward()</code> 会把新梯度<b>加到</b>旧梯度上,而不是覆盖。
        若不清零,这一轮就会带着上一轮的"陈旧方向",越走越偏。所以每圈开头必须先清零。
        <div className="order-flow">
          <span className="oc">zero_grad 清零</span>
          <span className="oa">→</span>
          <span className="oc">backward 算新梯度</span>
          <span className="oa">→</span>
          <span className="oc">step 扭开关</span>
          <span className="oa">· 顺序不能乱</span>
        </div>
      </Dig>
    </div>
  )
}

export function Bigram() {
  const chapter = findChapter('bigram')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="bigram"
      title="logits 摊平 & 交叉熵到底在算什么"
      subtitle={
        <>
          逐步拆解 nanoGPT bigram <code>forward</code> 的最后两行:{' '}
          <code>loss = F.cross_entropy(logits.view(B*T, C), targets.view(B*T))</code>。
          为了画面清晰,这里用 <b>B=2, T=3</b>(共 6 道题)的小例子,词表只画 6 个示意字符。
        </>
      }
      hp={
        <HpBar label="超参速查">
          <HpChip color="#b8512f" bg="#F7E6DE">batch_size <b>32</b> <i>句子数</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">block_size <b>8</b> <i>位置数 T</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">vocab_size <b>65</b> <i>词表大小</i></HpChip>
          <span className="hp-note">⚠ 本页为看清楚,用 B=2 / T=3 的小例子演示(真实 32 / 8)</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 第 1 章 · bigram 通关!</div>
          <div className="cs">你已看懂从一个 batch 到训练循环的全过程</div>
        </>
      }
    />
  )
}
