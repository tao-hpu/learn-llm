// 旧页每次进入一段都会重播:装机从随机再扫一遍,推理从当前预设开头重生成。这里离开再回来保留进度,不重播。
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  ATTN, FFN_DEAD, FFN_HID_Y, FFN_IN_Y, FFN_LINES, FFN_OUT_Y, FFN_XH, FFN_XI, FFN_XO,
  HOST_LEN, PARTS_BLK, PARTS_EMB, PARTS_FIN, PART_TOTAL, PRESETS, PROBS, TG, TOK,
  attnWeights, candsOf, embColor, hmColor, noiseAt, showChar, structColor,
} from './gptMachineData'
import styles from './GptMachine.module.css'

type Part = { name: string; size: string; cls: string }

function Mini({ order, mi, prog }: { order: number; mi: number; prog: number }) {
  const reveal = Math.max(0, Math.min(1, prog * PART_TOTAL - order))
  const cells: ReactNode[] = []
  for (let i = 0; i < TG; i++) {
    for (let j = 0; j < TG; j++) {
      const structured = 0.5 + 0.45 * Math.sin(i * 0.9 + j * 1.25 + mi * 1.7 + HOST_LEN)
      const noise = noiseAt(mi * 97 + i * 13 + j * 7 + HOST_LEN * 3 + 1)
      const t = noise + (structured - noise) * reveal
      cells.push(<i key={`${i}-${j}`} style={{ background: structColor(t) }} />)
    }
  }
  return <div className="pmini" style={{ gridTemplateColumns: `repeat(${TG},1fr)` }}>{cells}</div>
}

function PartGroup({ parts, prog, orderAt }: { parts: Part[]; prog: number; orderAt: (i: number) => number }) {
  return (
    <div className="parts">
      {parts.map((part, mi) => (
        <div key={part.name} className={`pcard ${part.cls}`}>
          <div className="pname">{part.name}</div>
          <Mini order={orderAt(mi)} mi={mi} prog={prog} />
          <div className="psize">{part.size}</div>
        </div>
      ))}
    </div>
  )
}

function Step1() {
  const live = useStepLive()
  const [prog, setProg] = useState(1)
  const [phase, setPhase] = useState<'empty' | 'run' | 'done'>('empty')
  const played = useRef(false)
  const epoch = useRef(0)
  const raf = useRef(0)

  function play() {
    const id = ++epoch.current
    window.cancelAnimationFrame(raf.current)
    const t0 = performance.now()
    const frame = (now: number) => {
      if (epoch.current !== id) return
      const t = Math.min(1, Math.max(0, (now - t0) / 2400))
      setProg(t)
      setPhase(t < 1 ? 'run' : 'done')
      if (t < 1) raf.current = window.requestAnimationFrame(frame)
    }
    raf.current = window.requestAnimationFrame(frame)
  }

  useEffect(() => {
    if (!live) return
    if (!played.current) {
      played.current = true
      play()
    }
    return () => {
      epoch.current += 1
      window.cancelAnimationFrame(raf.current)
    }
  }, [live])

  return (
    <div className={styles.scope}>
      <h2>① 装机:训练 = 把整机所有权重,从随机雪花调成有结构</h2>
      <p className="lead">
        整台 GPT 就是下面这<b>一堆权重矩阵</b>(参数真身)。训练做的唯一一件事:用梯度下降把它们<b>从随机雪花,慢慢调出结构</b>。
        推理时它们<b>全部冻结、不再变</b>。点下面看一次"训练动画"。
      </p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={play}>▶ 重新训练一遍</button>
        <span className="hp-note">从随机 → 有结构,扫一遍(示意)</span>
      </div>
      <div className="grp-tag grp-emb">输入层 · 把字符变成向量</div>
      <PartGroup parts={PARTS_EMB} prog={prog} orderAt={(i) => i} />
      <div className="grp-tag grp-blk">4 × Block · 每层 = 多头注意力 + FFN(各带残差/LayerNorm)</div>
      <PartGroup parts={PARTS_BLK} prog={prog} orderAt={(i) => PARTS_EMB.length + i} />
      <div className="grp-tag grp-fin">收尾 · 把向量映射回字符打分</div>
      <PartGroup parts={PARTS_FIN} prog={prog} orderAt={(i) => PARTS_EMB.length + PARTS_BLK.length + i} />
      <div className="note">
        {phase === 'run' && <>🔧 <b>训练中…</b>梯度下降把每块矩阵从随机雪花调出结构(从输入层往收尾层扫)。</>}
        {phase === 'done' && <>✅ <b>装机完成。</b>这一整套矩阵就是模型的"真身"。推理时它们<b>冻结不动</b>,只负责把输入算成输出。</>}
      </div>
      <Dig title='这些矩阵和"中间产物"别混(谁是真身?)'>
        <b>真身 = 被训练、会存盘的权重</b>:上面这些 <code>token_emb / pos_emb / Wq,Wk,Wv / proj / FFN / ln / lm_head</code>。
        而 <code>q / k / v / wei / 注意力输出 / 每层的 x</code> 都是<b>推理时现算的中间产物</b>,不存储、训练也不直接拧它们。
        训练拧的永远是矩阵;中间产物只是"矩阵 × 输入"算出来的临时结果。
      </Dig>
      <Dig title="0.8M 是怎么来的?">
        粗算:嵌入 <code>65×128 + 64×128 ≈ 16.5k</code>;每个 <Term k="block" name="Block · Transformer 层" def="一层 = 注意力子层 + FFN 子层,各带残差和 LayerNorm。">Block</Term> 里
        注意力投影(<code>Wq/Wk/Wv/proj</code>)≈ 66k、<Term k="feedforward" name="FeedForward · 前馈网络" def="逐位置小 MLP:Linear→ReLU→Linear,中间放大 4 倍。">FFN</Term>(<code>128×512 + 512×128</code>)≈ 131k,
        合 ≈ 197k,<b>×4 层 ≈ 0.79M</b>;<code>lm_head 128×65 ≈ 8k</code>。总计 <b>≈ 0.8M</b>。GPT-2 是 124M,大了 150 倍,但<b>结构一模一样</b>。
      </Dig>
    </div>
  )
}

function SvgText({ x, y, fill, size, weight, anchor, children }: {
  x: number
  y: number
  fill: string
  size: number
  weight?: number
  anchor?: 'start' | 'middle' | 'end'
  children: string
}) {
  return (
    <text
      x={x}
      y={y}
      fill={fill}
      textAnchor={anchor ?? 'middle'}
      style={{ fontFamily: 'var(--mono)', fontSize: size, fontWeight: weight ?? 400 }}
    >
      {children}
    </text>
  )
}

function AttnFigure({ layer, q, onPick }: { layer: number; q: number; onPick: (r: number) => void }) {
  const { cell, gx, gy, qx, kx, ty0, tgap, nw, nh } = ATTN
  const n = TOK.length
  const arcW = attnWeights(q, layer)
  const arcs: ReactNode[] = []
  for (let s = 0; s <= q; s++) {
    const yq = ty0 + q * tgap
    const yk = ty0 + s * tgap
    const x1 = qx + nw / 2
    const x2 = kx - nw / 2
    const mx = (x1 + x2) / 2
    arcs.push(
      <path
        key={`p${s}`}
        d={`M ${x1} ${yq} C ${mx} ${yq}, ${mx} ${yk}, ${x2} ${yk}`}
        fill="none"
        stroke="#D97757"
        strokeLinecap="round"
        strokeWidth={1 + 5 * arcW[s]}
        opacity={0.22 + 0.7 * arcW[s]}
      />,
    )
    if (arcW[s] > 0.12) {
      arcs.push(
        <SvgText key={`t${s}`} x={x2 - 10} y={yk - 5} fill="#D97757" size={9} weight={700} anchor="end">
          {`${Math.round(arcW[s] * 100)}%`}
        </SvgText>,
      )
    }
  }
  const cells: ReactNode[] = []
  for (let r = 0; r < n; r++) {
    const w = attnWeights(r, layer)
    for (let c = 0; c < n; c++) {
      const x = gx + c * cell
      const y = gy + r * cell
      if (c > r) {
        cells.push(<rect key={`m${r}-${c}`} x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} rx={5} fill="#FBFAF6" stroke="#EFEDE4" />)
        continue
      }
      const sel = r === q
      cells.push(
        <rect
          key={`r${r}-${c}`}
          x={x + 1}
          y={y + 1}
          width={cell - 2}
          height={cell - 2}
          rx={5}
          fill={hmColor(w[c])}
          stroke={sel ? '#a3548c' : 'none'}
          strokeWidth={sel ? 2 : 0}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => onPick(r)}
        />,
      )
      cells.push(
        <text
          key={`x${r}-${c}`}
          x={x + cell / 2}
          y={y + cell / 2 + 3}
          textAnchor="middle"
          fill={w[c] < 0.35 ? '#6B6B68' : '#fff'}
          style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, pointerEvents: 'none' }}
        >
          {sel ? `${Math.round(w[c] * 100)}%` : ''}
        </text>,
      )
    }
  }
  const nodes: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const y = ty0 + i * tgap
    nodes.push(
      <g key={`q${i}`} style={{ cursor: 'pointer' }} onMouseEnter={() => onPick(i)}>
        <rect
          x={qx - nw / 2}
          y={y - nh / 2}
          width={nw}
          height={nh}
          rx={6}
          fill="#fff"
          stroke={i === q ? '#a3548c' : '#E5E2D9'}
          strokeWidth={i === q ? 2.2 : 1.3}
        />
        <SvgText x={qx} y={y + 4} fill="#1A1A18" size={12} weight={700}>{showChar(TOK[i])}</SvgText>
      </g>,
    )
    nodes.push(
      <rect
        key={`k${i}`}
        x={kx - nw / 2}
        y={y - nh / 2}
        width={nw}
        height={nh}
        rx={6}
        fill="#fff"
        stroke={i <= q ? '#D97757' : '#E5E2D9'}
        strokeWidth={i <= q ? 2 : 1.3}
      />,
    )
    nodes.push(<SvgText key={`kt${i}`} x={kx} y={y + 4} fill="#1A1A18" size={12} weight={700}>{showChar(TOK[i])}</SvgText>)
  }
  return (
    <svg viewBox="0 0 560 340" preserveAspectRatio="xMidYMid meet">
      <SvgText x={gx} y={gy - 30} fill="#1A1A18" size={11.5} weight={700} anchor="start">注意力矩阵</SvgText>
      <SvgText x={gx} y={gy - 16} fill="#a8a293" size={9} weight={700} anchor="start">列=被看 key / 行=在看 query</SvgText>
      <SvgText x={qx} y={ty0 - 18} fill="#6B6B68" size={9} weight={700}>query 在看</SvgText>
      <SvgText x={kx} y={ty0 - 18} fill="#6B6B68" size={9} weight={700}>key 被看</SvgText>
      {TOK.map((ch, c) => (
        <SvgText key={`h${c}`} x={gx + c * cell + cell / 2} y={gy - 3} fill="#6B6B68" size={12} weight={700}>{showChar(ch)}</SvgText>
      ))}
      {TOK.map((ch, r) => (
        <SvgText key={`y${r}`} x={gx - 11} y={gy + r * cell + cell / 2 + 4} fill={r === q ? '#a3548c' : '#6B6B68'} size={12} weight={700} anchor="end">{showChar(ch)}</SvgText>
      ))}
      {cells}
      {nodes}
      <g>{arcs}</g>
    </svg>
  )
}

function AttnReadout({ layer, q }: { layer: number; q: number }) {
  const w = attnWeights(q, layer)
  const parts = w.map((x, s) => ({ s, c: TOK[s], x })).sort((a, b) => b.x - a.x)
  return (
    <div className="zoom-ro">
      第 <b>{layer}</b> 层,“<b>{showChar(TOK[q])}</b>” 在读:{parts.map((o, i) => (
        <span key={o.s}>{i > 0 ? ' · ' : ''}<code>{showChar(o.c)}</code> {Math.round(o.x * 100)}%</span>
      ))}。{q === 0 ? ' 第一个字只能看自己。' : ' 看不到右边(更晚的字)——因果。'}
    </div>
  )
}

type InfNote =
  | { kind: 'start'; name: string }
  | { kind: 'embed'; seed: string }
  | { kind: 'blocks' }
  | { kind: 'logits' }
  | { kind: 'sample'; ch: string }
  | { kind: 'done'; name: string; last: string; gen: string }

function shownGen(gen: string) {
  return [...gen].map(showChar).join('')
}

function InfNoteView({ note }: { note: InfNote }) {
  if (note.kind === 'start') return <>▶ 开始生成 “{note.name}” …</>
  if (note.kind === 'embed') return <>把当前序列喂进去,末位字符 <b>"{showChar(note.seed)}"</b> 先嵌入成向量…</>
  if (note.kind === 'blocks') return <>过 <b>4 层 Block</b>:每层多头注意力看前文 + FFN 加工…</>
  if (note.kind === 'logits') return <>末位向量 → <code>lm_head</code> → 65 个字符的打分(logits)…</>
  if (note.kind === 'sample') return <><code>softmax</code> 出概率,采样到 <b>"{showChar(note.ch)}"</b> ↓</>
  return (
    <>
      ✅ <b>生成完毕。</b>"{note.name}" → "<b>{showChar(note.last)}</b>…<b>{shownGen(note.gen)}</b>"。每多一个字,都把整条序列重过一遍四站 —— 这就是<b>自回归</b>。点别的开头或「重播」再看一次。
    </>
  )
}

function Ribbon({ prompt, gen, pop }: { prompt: string; gen: string; pop: boolean }) {
  return (
    <div className="ribbon">
      {[...prompt].map((c, i) => <div key={`p${i}`} className="rchar prompt">{showChar(c)}</div>)}
      {[...gen].map((c, i) => (
        <div key={`g${i}`} className={pop && i === gen.length - 1 ? `rchar gen pop ${styles.popAnim}` : 'rchar gen'}>{showChar(c)}</div>
      ))}
      <div className={`rcaret ${styles.blinkAnim}`} />
    </div>
  )
}

type Bars = { idx: number; ch: string; cands: string[]; grown: boolean }

function FfnFigure({ lit, relu, out }: { lit: number; relu: boolean; out: boolean }) {
  return (
    <svg viewBox="0 0 960 360" preserveAspectRatio="xMidYMid meet">
      <SvgText x={FFN_XI} y={44} fill="#3a63c0" size={12} weight={700}>输入 128 维</SvgText>
      <SvgText x={FFN_XI} y={58} fill="#a8a293" size={9}>(从残差流读)</SvgText>
      <SvgText x={FFN_XH} y={44} fill="#9a7b2f" size={12} weight={700}>隐藏 512 维</SvgText>
      <SvgText x={FFN_XH} y={58} fill="#a8a293" size={9}>Linear→ReLU 放大4倍</SvgText>
      <SvgText x={FFN_XO} y={44} fill="#c2693f" size={12} weight={700}>输出 128 维</SvgText>
      <SvgText x={FFN_XO} y={58} fill="#a8a293" size={9}>Linear→加回残差流</SvgText>
      {FFN_LINES.map((line, i) => {
        const on = line.side === 1 ? relu : out && !FFN_DEAD[line.j]
        return (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={on ? '#D97757' : '#d8cab9'}
            strokeWidth={on ? 2 : 1.4}
            opacity={on ? 0.9 : 0.5}
          />
        )
      })}
      {FFN_IN_Y.map((y, i) => (
        <circle key={`i${i}`} cx={FFN_XI} cy={y} r={10} fill={i < lit ? '#7d9be6' : '#E5EBF9'} stroke="#3a63c0" strokeWidth={1.3} />
      ))}
      {FFN_HID_Y.map((y, j) => (
        <circle key={`h${j}`} cx={FFN_XH} cy={y} r={8} fill={relu ? (FFN_DEAD[j] ? '#EEEBE1' : '#e8cf7a') : '#fff'} stroke="#9a7b2f" strokeWidth={1.2} />
      ))}
      {FFN_OUT_Y.map((y, k) => (
        <circle key={`o${k}`} cx={FFN_XO} cy={y} r={10} fill={out ? '#D97757' : '#fff'} stroke="#D97757" strokeWidth={1.3} />
      ))}
      <SvgText x={FFN_XH} y={348} fill="#a3548c" size={11} weight={700}>⚠ 全程只有 1 个 token —— FFN 不跨 token,只在维度之间</SvgText>
    </svg>
  )
}

function Step2() {
  const live = useStepLive()
  const [sel, setSel] = useState(0)
  const [ribbon, setRibbon] = useState({ prompt: PRESETS[0].prompt, gen: '', pop: false })
  const [stage, setStage] = useState(-1)
  const [lit, setLit] = useState(0)
  const [embed, setEmbed] = useState<string | null>(null)
  const [bars, setBars] = useState<Bars | null>(null)
  const [note, setNote] = useState<InfNote>({ kind: 'start', name: PRESETS[0].name })
  const [zoom, setZoom] = useState(false)
  const [zTab, setZTab] = useState<'attn' | 'ffn'>('attn')
  const [layer, setLayer] = useState(1)
  const [curQ, setCurQ] = useState(TOK.length - 1)
  const [ffnLit, setFfnLit] = useState(0)
  const [ffnRelu, setFfnRelu] = useState(false)
  const [ffnOut, setFfnOut] = useState(false)
  const [ffnPhase, setFfnPhase] = useState<'idle' | 'read' | 'relu' | 'out'>('idle')
  const started = useRef(false)
  const selRef = useRef(0)
  const runId = useRef(0)
  const timers = useRef<number[]>([])
  const ffnTimers = useRef<number[]>([])
  const zoomRef = useRef<HTMLDivElement>(null)
  selRef.current = sel

  function clearFfn() {
    ffnTimers.current.forEach((id) => window.clearTimeout(id))
    ffnTimers.current = []
  }

  function begin(index: number) {
    const id = ++runId.current
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    const p = PRESETS[index]
    setRibbon({ prompt: p.prompt, gen: '', pop: false })
    setStage(-1)
    setLit(0)
    setEmbed(null)
    setBars(null)
    setNote({ kind: 'start', name: p.name })
    const after = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(() => {
        if (runId.current !== id) return
        fn()
      }, ms))
    }
    // 旧调度在循环里同步取 seed,此时生成串还是空的,所以每一步嵌入的都是开头最后一个字符。
    const seed = p.prompt[p.prompt.length - 1] || p.prompt[0]
    let t = 700
    const step = 2600
    for (let c = 0; c < p.gen.length; c++) {
      const ch = p.gen[c]
      const at = t
      after(at, () => {
        setStage(0)
        setEmbed(seed)
        setNote({ kind: 'embed', seed })
      })
      after(at + 620, () => {
        setStage(1)
        setLit(0)
      })
      ;[1, 2, 3, 4].forEach((b, bi) => after(at + 620 + bi * 280, () => setLit(b)))
      after(at + 620, () => setNote({ kind: 'blocks' }))
      after(at + 1780, () => {
        setStage(2)
        setNote({ kind: 'logits' })
      })
      after(at + 2150, () => {
        setStage(3)
        setBars({ idx: c, ch, cands: candsOf(ch), grown: false })
        setNote({ kind: 'sample', ch })
      })
      after(at + 2190, () => setBars((prev) => (prev && prev.idx === c ? { ...prev, grown: true } : prev)))
      after(at + 2480, () => setRibbon({ prompt: p.prompt, gen: p.gen.slice(0, c + 1), pop: true }))
      t += step
    }
    after(t + 200, () => {
      setStage(-1)
      setLit(0)
      setNote({ kind: 'done', name: p.name, last: p.prompt[p.prompt.length - 1], gen: p.gen })
    })
  }

  function ffnPlay() {
    clearFfn()
    setFfnLit(0)
    setFfnRelu(false)
    setFfnOut(false)
    setFfnPhase('read')
    for (let i = 0; i < FFN_IN_Y.length; i++) {
      ffnTimers.current.push(window.setTimeout(() => setFfnLit(i + 1), i * 90))
    }
    ffnTimers.current.push(window.setTimeout(() => {
      setFfnRelu(true)
      setFfnPhase('relu')
    }, 1050))
    ffnTimers.current.push(window.setTimeout(() => {
      setFfnOut(true)
      setFfnPhase('out')
    }, 2100))
  }

  useEffect(() => {
    if (zoom) zoomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [zoom])

  useEffect(() => {
    if (!live) return
    if (!started.current) {
      started.current = true
      begin(selRef.current)
    }
    return () => {
      runId.current += 1
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
      ffnTimers.current.forEach((t) => window.clearTimeout(t))
      ffnTimers.current = []
    }
  }, [live])

  return (
    <div className={styles.scope}>
      <h2>② 跑起来:一个字符流过整机 → 采样出下一个 → 接着生</h2>
      <p className="lead">
        选一个<b>预设开头</b>(不用你打字),机器自动逐字生成。每生成一个字符,都要把当前序列<b>完整过一遍</b>下面四站,
        最后 <Term k="softmax" name="softmax" def="把一排打分(logits)变成和为 1 的概率分布,分越高概率越大。">softmax</Term> 出概率、采样一个字符接到末尾 —— 这叫<Term k="autoregressive" name="自回归 · autoregressive" def="把自己刚生成的字符接回输入,再预测下一个,如此循环。GPT 生成文本就是这样一个字一个字滚出来的。">自回归</Term>生成。
      </p>
      <div className="btn-row">
        <span className="hp-note" style={{ marginRight: 4 }}>预设开头:</span>
        {PRESETS.map((p, i) => (
          <button key={p.name} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => { started.current = true; setSel(i); begin(i) }}>“{p.name}”</button>
        ))}
        <button type="button" className="btn" onClick={() => { started.current = true; begin(sel) }}>▶ 重播</button>
      </div>
      <div className="sub-h" style={{ marginTop: 14 }}><span className="badge">序列</span>当前文本(灰=开头,橙=机器生成)</div>
      <Ribbon prompt={ribbon.prompt} gen={ribbon.gen} pop={ribbon.pop} />
      <div className="sub-h"><span className="badge">流水线</span>每个字符都走完这四站(高亮 = 正在算)</div>
      <div className="pipe">
        <div className={stage === 0 ? 'pstage on' : 'pstage'}>
          <div className="stn">STAGE 1</div>
          <div className="sttitle">嵌入</div>
          <div className="stsub">末位字符 → <span className="d d-emb">128<i>n_embd</i></span> 向量<br />(tok_emb + pos_emb)</div>
          <div className="embcells">
            {embed !== null && Array.from({ length: 10 }, (_, k) => (
              <i key={k} style={{ background: embColor(noiseAt(embed.charCodeAt(0) * 3.3 + k * 1.7)) }} />
            ))}
          </div>
        </div>
        <div className={stage === 1 ? 'pstage on' : 'pstage'} id="stageBlock" onClick={() => setZoom((v) => !v)}>
          <div className="stn">STAGE 2</div>
          <div className="sttitle">4 × Block</div>
          <div className="blkdots">
            {[1, 2, 3, 4].map((n) => <i key={n} className={n <= lit ? 'lit' : undefined}>{n}</i>)}
          </div>
          <div className="stsub">每层:多头注意力(看前文)<br />+ FFN(逐位置思考)</div>
          <span className={zoom ? 'zoom-hint opened' : `zoom-hint ${styles.zoomAnim}`}>{zoom ? '▲ 收起内部' : '👆 点开看内部'}</span>
        </div>
        <div className={stage === 2 ? 'pstage on' : 'pstage'}>
          <div className="stn">STAGE 3</div>
          <div className="sttitle">ln_f + lm_head</div>
          <div className="stsub">末位向量 → <span className="d d-vocab">65<i>vocab</i></span> 个打分<br />(下一个字符的 logits)</div>
        </div>
        <div className={stage === 3 ? 'pstage on' : 'pstage'}>
          <div className="stn">STAGE 4</div>
          <div className="sttitle">softmax → 采样</div>
          <div className="pbars">
            {bars && bars.cands.map((c, i) => (
              <div key={`${bars.idx}-${i}`} className={c === bars.ch ? 'pbar chosen' : 'pbar'}>
                <span className="pc">{showChar(c)}</span>
                <div className="ptrack"><div className="pfill" style={{ width: bars.grown ? `${PROBS[i] * 160}%` : '0%' }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="phase-band">
        <div className="pb fwd">forward 前向 · STAGE 1–3 算出 logits(推理只有前向,没有反向)</div>
        <div className="pb dec">decode · 挑 token</div>
      </div>
      <div className="note"><InfNoteView note={note} /></div>
      <div className={zoom ? 'blockzoom open' : 'blockzoom'} ref={zoomRef}>
        <div className="bz-head">
          <span className="bz-t">掀开 Block 看内部</span>
          <span className="hp-note">一个 Block = 在残差流上挂两个模块,各自「读 → 算 → 加回」</span>
          <span className="bz-close" onClick={(e) => { e.stopPropagation(); setZoom(false) }}>收起 ✕</span>
        </div>
        <div className="zoom-anat">
          <span className="za-lane"><Term k="residual" name="残差流 · residual stream" def="贯穿所有层的主干向量。每层从它读入、算完再加回(x = x + 子层(x))。层与层之间的信息就靠这条流向后传。">残差流</Term> x</span>
          <span className="za-op">→ <Term k="layernorm" name="LayerNorm · 层归一化" def="把向量数值拉回稳定范围,再送进子层。">LN</Term> →</span>
          <span className="za-mod attn"><Term k="self-attention" name="自注意力 · self-attention" def="每个 token 从前文按权重取信息,跨 token 混合。">注意力</Term><small>跨 token</small></span>
          <span className="za-plus">⊕</span>
          <span className="za-op">→ LN →</span>
          <span className="za-mod ffn"><Term k="feedforward" name="前馈网络 · FeedForward" def="逐位置小 MLP:Linear→ReLU→Linear,中间放大 4 倍。只在维度之间变换,不跨 token。">FFN</Term><small>跨维度</small></span>
          <span className="za-plus">⊕</span>
          <span className="za-lane">x'</span>
        </div>
        <div className="zoom-tabs">
          <button type="button" className={zTab === 'attn' ? 'ztab attn active' : 'ztab attn'} onClick={() => setZTab('attn')}>① 注意力 · 跨 token</button>
          <button type="button" className={zTab === 'ffn' ? 'ztab active' : 'ztab'} onClick={() => setZTab('ffn')}>② FFN · 跨维度(单 token)</button>
        </div>
        <div className={zTab === 'attn' ? 'zpane active' : 'zpane'}>
          <div className="zoom-ctrl">
            <span className="hp-note" style={{ marginRight: 2 }}>看第几层:</span>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" className={layer === n ? 'ztab-l active' : 'ztab-l'} onClick={() => setLayer(n)}>B{n}</button>
            ))}
          </div>
          <div className="zoom-svg"><AttnFigure layer={layer} q={curQ} onPick={setCurQ} /></div>
          <AttnReadout layer={layer} q={curQ} />
        </div>
        <div className={zTab === 'ffn' ? 'zpane active' : 'zpane'}>
          <div className="zoom-ctrl">
            <button type="button" className="btn primary" onClick={ffnPlay}>▶ 让值流过 FFN</button>
            <span className="hp-note">128 维 → 放大 512 维 → ReLU(砍负为0) → 压回 128 维 → 加回残差流</span>
          </div>
          <div className="zoom-svg"><FfnFigure lit={ffnLit} relu={ffnRelu} out={ffnOut} /></div>
          <div className="zoom-ro">
            {ffnPhase === 'idle' && '点「▶」看值流过:亮起的线 = 正在走的路径;灰色隐藏节点 = 被 ReLU 砍掉。全程只有 1 个 token。'}
            {ffnPhase === 'read' && '① 从残差流读入这个 token 的 128 维(蓝)…'}
            {ffnPhase === 'relu' && <>② Linear 放大到 512 维。<b>ReLU 把负的砍成 0</b>(灰点 = 被砍掉)——非线性就在这。</>}
            {ffnPhase === 'out' && <>③ Linear 压回 128 维(橙)→ <b>加回残差流</b>。连线 = 训练好的固定权重,对每个 token 都一样。</>}
          </div>
        </div>
      </div>
      <Dig title='为什么生成的是"莎士比亚味儿"的乱码,不是真句子?'>
        这台只有 <b>0.8M 参数 + 字符级</b>,又只训练几千步,能学到的是"字母怎么搭、单词长啥样、谁跟谁常一起出现",
        所以采样出来<b>像英文、有词形和对话结构</b>,但不成句意。<b>把模型放大(GPT-2 124M)、上更多数据,同一套机器就会越说越像人话。</b>{' '}
        (本页生成文本是<b>预设示意</b>,为了动画稳定;真跑 <code>03_transformer.py</code> 每次结果不同。)
      </Dig>
      <Dig title="采样为什么不直接取最高分?">
        若每次都取最高分(argmax),模型会陷入重复死循环(一直输出同几个字)。按概率<b>随机采样</b>能保持多样性,
        所以同一个开头每次生成都不一样。代码里就是 <code>torch.multinomial(probs, 1)</code>。
      </Dig>
    </div>
  )
}

export function GptMachine() {
  const chapter = findChapter('gpt-machine')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />]
  return (
    <ChapterShell
      slug="gpt-machine"
      title="整机俯瞰:一个字符,如何流过整台 GPT"
      subtitle={
        <>
          第 1–3 章把零件都拆懂了。这一页把它们<b>拼成整机</b>,只画<b>我们这个 tiny 模型</b>(≈ 0.8M 参数,不是 GPT-2)。
          分两段:<b>① 装机</b> —— 训练把所有权重矩阵调到位;<b>② 跑起来</b> —— 一个预设字符串走完<Term k="forward" name="前向传播 · forward" def="把输入从头到尾过一遍网络、算出输出(这里是下一个字符的打分 logits)的过程。训练和推理都要做前向;训练还会再反向更新权重。">前向传播</Term>,再<Term k="sampling" name="采样 · sampling" def="按模型输出的概率分布随机抽一个 token 作为下一个字符(不是永远取最高分),所以同一个开头每次生成可能不同。">采样</Term>出下一个字符。全程<b>自动播放</b>。
        </>
      }
      hp={
        <HpBar label="这台机器">
          <HpChip color="#a87b1f" bg="#FAEFD6">vocab <b>65</b> <i>字符表</i></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>128</b> <i>主干维度</i></HpChip>
          <HpChip color="#1f8a8a" bg="#DCEFEF">n_head <b>4</b> <i>头数</i></HpChip>
          <HpChip color="#9a7b2f" bg="#F4ECD6">n_layer <b>4</b> <i>层数</i></HpChip>
          <span className="hp-note">≈ 0.8M 参数 · 配套 <code>03_transformer.py</code></span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 整机俯瞰 · 通关</div>
          <div className="cs">你已经看着一个字符走完整台 GPT:嵌入 → 4×Block(注意力 + FFN)→ ln_f + lm_head → 采样,再接回末尾继续生成。第 1–3 章的零件,到这里合成了一台会说话的机器。</div>
        </>
      }
    />
  )
}
