// 旧页 goto 只切换面板和 hash，不重置滑块、读法、焦点块、支路开关和对照选择。
import { useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './SparseAttention.module.css'
import {
  BLOCK_LEN, BLOCK_SIZE, BR_KEYS, BR_NAME, COL, CTX_LBL, LM, LM_CHOSEN, LM_ORDER, LM_PROBES, LM_TEXT,
  NB, NSA_ON, RC, RC_CHOSEN, RC_KEYS, RC_ORDER, RC_PROBES, RC_T, SER_COL, STEPS, TOP_N, WINDOW,
  readAvg, recallStats, showCh, tokensRead,
  type BrKey, type GateLayer, type LmKey, type RcKey,
} from './sparseAttentionData'

const FONT = 'ui-monospace,monospace'

function en(v: number) {
  return v.toLocaleString('en-US')
}

function unionCount(t: number, picked: number[]) {
  const u = new Set<number>()
  for (let p = Math.max(0, t - WINDOW + 1); p <= t; p++) u.add(p)
  picked.forEach((b) => {
    for (let p = b * BLOCK_LEN; p < Math.min((b + 1) * BLOCK_LEN, t + 1); p++) u.add(p)
  })
  return u.size
}

function blockLook(b: number, t: number, pick: Set<number> | null, focus: number | null) {
  const end = b * BLOCK_LEN + BLOCK_LEN - 1
  const curB = Math.floor(t / BLOCK_LEN)
  const picked = pick?.has(b) ?? false
  let cls = 'blk'
  let tag = ''
  if (picked) {
    cls += ' pick'
    tag = b === curB ? '当前·必选' : '挑中'
  } else if (end <= t) {
    cls += ' done'
    tag = pick ? '' : '摘要 ✓'
  } else if (b === curB) {
    cls += ' cur'
    tag = '进行中'
  } else {
    cls += ' future'
  }
  if (focus === b) cls += ' focus'
  if (b === curB && !picked) cls = cls.replace(' done', '')
  return { cls, tag }
}

function BlockCard({ b, t, pick, focus, showWin, onPick }: {
  b: number
  t: number
  pick: Set<number> | null
  focus: number | null
  showWin: boolean
  onPick?: (block: number) => void
}) {
  const { cls, tag } = blockLook(b, t, pick, focus)
  const p0 = b * BLOCK_LEN
  return (
    <div className={cls} onClick={onPick ? () => onPick(b) : undefined}>
      <div className="bh"><span>块 {b}</span><span className="bt">{tag}</span></div>
      <div className="chars">
        {Array.from({ length: BLOCK_LEN }, (_, i) => {
          const p = p0 + i
          const ch = LM_TEXT[p] || ' '
          let cc = 'c'
          if (ch === ' ' || ch === '\n') cc += ' ws'
          if (showWin && p <= t && t - p < WINDOW) cc += ' win'
          if (p === t) cc += ' now'
          return <span key={p} className={cc}>{showCh(ch)}</span>
        })}
      </div>
    </div>
  )
}

function Card({ v, label, color, small }: { v: ReactNode; label: string; color: string; small?: boolean }) {
  return (
    <div className="dr">
      <div className="drv" style={small ? { color, fontSize: 18 } : { color }}>{v}</div>
      <div className="drl">{label}</div>
    </div>
  )
}

function ReadStrip({ t, mode, picked }: { t: number; mode: number; picked: number[] | null }) {
  const CW = 9
  const CH = 16
  const GAP = 3
  const ROWH = 34
  const LX = 30
  const TOP = 6
  const W = LX + 64 * CW + 7 * GAP + 4
  const H = TOP + 4 * ROWH
  const xOf = (p: number) => {
    const col = p % 64
    return LX + col * CW + Math.floor(col / 8) * GAP
  }
  const yOf = (p: number) => TOP + Math.floor(p / 64) * ROWH
  const pickSet = new Set(picked ?? [])
  const curB = Math.floor(t / BLOCK_LEN)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label={`位置 ${t} 的 query 读取掩码`}>
      {Array.from({ length: 4 }, (_, r) => (
        <text key={`row${r}`} x={LX - 5} y={TOP + r * ROWH + 12} textAnchor="end" fontSize={9} fontFamily={FONT} fill="#6B6B68">{r * 64}</text>
      ))}
      {Array.from({ length: BLOCK_SIZE }, (_, p) => {
        const block = Math.floor(p / BLOCK_LEN)
        let fill: string = COL.unread
        let op = 1
        if (p > t) fill = COL.future
        else if (mode === 0) fill = COL.full
        else if (mode === 1) {
          if (t - p < WINDOW) fill = COL.win
        } else if (t - p < WINDOW) fill = COL.win
        else if (pickSet.has(block)) {
          fill = COL.sel
          op = 0.75
        }
        return (
          <rect key={`cell${p}`} x={xOf(p)} y={yOf(p)} width={CW - 1} height={CH} rx={1.5} fill={fill} fillOpacity={op} stroke={p > t ? '#E5E2D9' : 'none'} strokeWidth={0.8} />
        )
      })}
      {mode === 2 && Array.from({ length: NB }, (_, b) => {
        const p0 = b * BLOCK_LEN
        const x = xOf(p0)
        const y = yOf(p0)
        const w = 8 * CW - 1
        return (
          <g key={b}>
            {pickSet.has(b) && (
              <rect x={x - 1.2} y={y - 1.2} width={w + 2.4} height={CH + 2.4} rx={3} fill="none" stroke={b === curB ? COL.cur : COL.sel} strokeWidth={1.8} />
            )}
            {(b + 1) * BLOCK_LEN - 1 <= t && (
              <rect x={x} y={y + CH + 4} width={w} height={4} rx={2} fill={COL.cmp} />
            )}
          </g>
        )
      })}
      <rect x={xOf(t) - 1} y={yOf(t) - 3} width={CW + 1} height={CH + 6} rx={2} fill="none" stroke="#1A1A18" strokeWidth={1.6} />
    </svg>
  )
}

function BigSvg({ exp }: { exp: number }) {
  const s = 2 ** exp
  const c = s / 16
  const se = 16 * 64
  const w = 512
  const tot = c + se + w
  const W = 620
  const H = 78
  const LX = 86
  const BW = W - LX - 10
  const px = (v: number) => Math.max(1.5, BW * v / s)
  const x1 = LX + px(c)
  const x2 = x1 + px(se)
  const xEnd = x2 + px(w)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label="全注意力与 NSA 每步读取量">
      <text x={LX - 8} y={23} textAnchor="end" fontSize={11} fontFamily={FONT} fill="#6B6B68">全注意力</text>
      <rect x={LX} y={10} width={BW} height={20} rx={4} fill={COL.full} />
      <text x={LX - 8} y={61} textAnchor="end" fontSize={11} fontFamily={FONT} fill="#6B6B68">NSA</text>
      <rect x={LX} y={48} width={BW} height={20} rx={4} fill="#F4F2EA" stroke="#E5E2D9" />
      <rect x={LX} y={48} width={px(c)} height={20} fill={COL.cmp} />
      <rect x={x1} y={48} width={px(se)} height={20} fill={COL.sel} />
      <rect x={x2} y={48} width={px(w)} height={20} fill={COL.win} />
      <text x={Math.min(xEnd + 6, W - 120)} y={62} fontSize={11} fontWeight={700} fontFamily={FONT} fill="#1A1A18">{(100 * tot / s).toFixed(1)}%</text>
    </svg>
  )
}

function GateChart({ layers }: { layers: GateLayer[] }) {
  const W = 600
  const H = 190
  const LX = 36
  const BOT = H - 26
  const TOPY = 14
  const gw = (W - LX - 10) / 4
  const ticks = [0, 0.25, 0.5, 0.75]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label="每层三条支路的平均门值">
      {ticks.map((v) => {
        const y = BOT - (BOT - TOPY) * v / 0.75
        return (
          <g key={`tick${v}`}>
            <line x1={LX} x2={W - 6} y1={y} y2={y} stroke="#E5E2D9" strokeWidth={1} />
            <text x={LX - 5} y={y + 3} textAnchor="end" fontSize={9} fontFamily={FONT} fill="#6B6B68">{v}</text>
          </g>
        )
      })}
      {layers.map((g, li) => {
        const keys = BR_KEYS.filter((b) => g[b] !== undefined)
        const bw = Math.min(34, (gw - 24) / keys.length)
        const x0 = LX + li * gw + (gw - bw * keys.length) / 2
        const sum = keys.reduce((a, b) => a + (g[b] ?? 0), 0)
        return (
          <g key={`layer${li}`}>
            {keys.map((b, ki) => {
              const h = (BOT - TOPY) * (g[b] ?? 0) / 0.75
              const x = x0 + ki * bw
              return (
                <g key={b}>
                  <rect x={x + 2} y={BOT - h} width={bw - 4} height={h} rx={3} fill={COL[b]} />
                  <text x={x + bw / 2} y={BOT - h - 3} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily={FONT} fill={COL[b]}>{g[b]}</text>
                </g>
              )
            })}
            <text x={LX + li * gw + gw / 2} y={H - 10} textAnchor="middle" fontSize={10.5} fontFamily={FONT} fill="#1A1A18">第 {li + 1} 层 · 和 {sum.toFixed(2)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function LossCurve({ sel }: { sel: LmKey }) {
  const W = 620
  const H = 250
  const LX = 46
  const RX = 12
  const TOPY = 12
  const BOT = H - 40
  const y0 = 1.45
  const y1 = 1.85
  const xs = (step: number) => LX + (W - LX - RX) * step / 4000
  const ys = (v: number) => BOT - (BOT - TOPY) * (Math.min(v, y1) - y0) / (y1 - y0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label="四组 val loss 曲线">
      {[1.45, 1.55, 1.65, 1.75, 1.85].map((v) => (
        <g key={`y${v}`}>
          <line x1={LX} x2={W - RX} y1={ys(v)} y2={ys(v)} stroke="#E5E2D9" />
          <text x={LX - 5} y={ys(v) + 3} textAnchor="end" fontSize={9} fontFamily={FONT} fill="#6B6B68">{v.toFixed(2)}</text>
        </g>
      ))}
      {[500, 1000, 2000, 3000, 4000].map((step) => (
        <text key={step} x={xs(step)} y={BOT + 14} textAnchor="middle" fontSize={9} fontFamily={FONT} fill="#6B6B68">{step}</text>
      ))}
      <text x={(W + LX) / 2} y={H - 8} textAnchor="middle" fontSize={10} fontFamily={FONT} fill="#6B6B68">训练步数(step 0 的 4.3 左右不画)</text>
      {LM_ORDER.map((k) => {
        const pts = STEPS.map((step, i) => [step, LM[k].curve[i]] as const).filter(([step]) => step > 0)
        const on = sel === k
        return (
          <g key={k}>
            <polyline points={pts.map(([step, v]) => `${xs(step).toFixed(1)},${ys(v).toFixed(1)}`).join(' ')} fill="none" stroke={SER_COL[k]} strokeWidth={on ? 3 : 1.6} opacity={on ? 1 : 0.7} />
            {pts.map(([step, v]) => (
              <circle key={step} cx={Number(xs(step).toFixed(1))} cy={Number(ys(v).toFixed(1))} r={on ? 3 : 2} fill={SER_COL[k]} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

function RecallSvg({ i }: { i: number }) {
  const t = RC_PROBES[i]
  const key = RC_KEYS[i]
  const val = key + 1
  const chosen = RC_CHOSEN[i]
  const ch = new Set(chosen)
  const cb = Math.floor(t / BLOCK_LEN)
  const CW = 9
  const CH = 18
  const GAP = 4
  const ROWH = 42
  const LX = 30
  const TOP = 16
  const W = LX + 64 * CW + 7 * GAP + 6
  const H = TOP + 2 * ROWH + 4
  const xOf = (p: number) => {
    const col = p % 64
    return LX + col * CW + Math.floor(col / 8) * GAP
  }
  const yOf = (p: number) => TOP + Math.floor(p / 64) * ROWH
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label="找钥匙样本的挑选结果">
      {Array.from({ length: 2 }, (_, r) => (
        <text key={`row${r}`} x={LX - 5} y={TOP + r * ROWH + 13} textAnchor="end" fontSize={9} fontFamily={FONT} fill="#6B6B68">{r * 64}</text>
      ))}
      {Array.from({ length: RC_T / BLOCK_LEN }, (_, b) => {
        const x = xOf(b * BLOCK_LEN)
        const y = yOf(b * BLOCK_LEN)
        const on = ch.has(b)
        return (
          <text key={`b${b}`} x={x + 4 * CW} y={y - 4} textAnchor="middle" fontSize={8.5} fontFamily={FONT} fill={on ? (b === cb ? COL.cur : COL.sel) : '#9a978d'} fontWeight={on ? 700 : 400}>块{b}</text>
        )
      })}
      {Array.from({ length: RC_T }, (_, p) => {
        let fill = '#E9E6DC'
        if (p >= 1 && p <= 32) fill = p % 2 === 1 ? '#b9c7ea' : '#b7d6c6'
        else if (p >= 97) fill = p % 2 === 1 ? '#e2c3d8' : '#efdfe9'
        if (p > t) fill = '#fff'
        return <rect key={`cell${p}`} x={xOf(p)} y={yOf(p)} width={CW - 1} height={CH} rx={1.5} fill={fill} stroke={p > t ? '#E5E2D9' : 'none'} strokeWidth={0.8} />
      })}
      {chosen.map((b) => (
        <rect key={`pick${b}`} x={xOf(b * BLOCK_LEN) - 1.5} y={yOf(b * BLOCK_LEN) - 1.5} width={8 * CW - 1 + 3} height={CH + 3} rx={3} fill={b === cb ? COL.cur : COL.sel} fillOpacity={0.18} stroke={b === cb ? COL.cur : COL.sel} strokeWidth={2} />
      ))}
      <rect x={xOf(key) - 1.5} y={yOf(key) - 1.5} width={CW + 2} height={CH + 3} rx={2} fill="none" stroke="#3a63c0" strokeWidth={2.2} />
      <text x={xOf(key) + CW / 2} y={yOf(key) + CH + 11} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily={FONT} fill="#3a63c0">钥匙</text>
      <rect x={xOf(val) - 1.5} y={yOf(val) - 1.5} width={CW + 2} height={CH + 3} rx={2} fill="none" stroke="#3f7d63" strokeWidth={2.2} />
      <text x={xOf(val) + CW / 2} y={yOf(val) + CH + 11} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily={FONT} fill="#3f7d63">值</text>
      <rect x={xOf(t) - 1.5} y={yOf(t) - 1.5} width={CW + 2} height={CH + 3} rx={2} fill="none" stroke="#1A1A18" strokeWidth={2.2} />
      <text x={xOf(t) + CW / 2} y={yOf(t) + CH + 11} textAnchor="middle" fontSize={9} fontWeight={700} fontFamily={FONT} fill="#1A1A18">提问</text>
    </svg>
  )
}

function branchClause(name: string) {
  if (name === 'cmp+sel+win') return 'cmp,sel,win'
  if (name === 'cmp+sel') return 'cmp,sel'
  return name
}

function LmNote({ k }: { k: LmKey }) {
  const r = LM[k]
  const f = LM.full
  const d = r.val - f.val
  const pct = (100 * (r.params / f.params - 1)).toFixed(1)
  return (
    <>
      <b>{r.name}</b>(<code>--branches {branchClause(r.branches)}</code>,Mac MPS,4000 步)· val loss <b>{r.val.toFixed(4)}</b>
      {k !== 'full' && (
        <>(比全注意力{d <= 0 ? `低 ${(-d).toFixed(4)}` : `高 ${d.toFixed(4)}`}{Math.abs(d) < 0.01 ? ',小于 0.01,单种子下算噪声' : ''})</>
      )}
      {' '}· train {r.train.toFixed(4)} · 参数 <b>{(r.params / 1e6).toFixed(3)}M</b>
      {k !== 'full' && <>({r.params > f.params ? '+' : ''}{pct}%)</>}
      {' '}· 最后一个 query 读 {r.read_last} 个 · 平均 {r.read_avg} 个 · 训练 {r.sec} 秒
    </>
  )
}

function RcNote({ k }: { k: RcKey }) {
  const r = RC[k]
  return (
    <>
      <b>{r.name}</b>(找钥匙,RTX 4090 · CUDA · PyTorch 2.4.1,6000 步)· 准确率 <b>{(100 * r.acc).toFixed(2)}%</b> · val loss {r.val.toFixed(4)} · 参数 <b>{(r.params / 1e6).toFixed(3)}M</b> · 训练 {r.sec} 秒
      {k === 'win' ? ' · 值有 32 种,乱猜是 3.125%' : ''}
    </>
  )
}

function lmRunFor(on: Record<BrKey, boolean>) {
  const key = BR_KEYS.filter((b) => on[b]).join('+')
  if (key === 'cmp+sel+win') return LM.nsa
  if (key === 'cmp+sel') return LM.cmpsel
  if (key === 'win') return LM.win
  return null
}

function rcRunFor(on: Record<BrKey, boolean>) {
  const key = BR_KEYS.filter((b) => on[b]).join('+')
  if (key === 'cmp+sel+win') return RC.nsa
  if (key === 'win') return RC.win
  return null
}

function Step1() {
  const [readMode, setReadMode] = useState(2)
  const [t, setT] = useState(143)
  const [exp, setExp] = useState(16)
  const pi = LM_PROBES.indexOf(t)
  const curB = Math.floor(t / BLOCK_LEN)
  const picked = readMode === 2 ? (pi >= 0 ? LM_CHOSEN[pi] : [curB]) : null
  const s = 2 ** exp
  const c = s / 16
  const se = 16 * 64
  const w = 512
  const tot = c + se + w
  const winN = Math.min(t + 1, WINDOW)
  const selN = Math.min(t + 1, TOP_N * BLOCK_LEN)
  const cmpN = Math.floor((t + 1) / BLOCK_LEN) + 1
  let detail: ReactNode
  if (readMode === 2 && picked) {
    detail = pi >= 0
      ? <>t={t} 有真实挑选记录(NSA 语言建模模型最后一层):挑中块 <b>[{picked.join(', ')}]</b>。滑窗和挑选块合起来,去重后读 <b>{unionCount(t, picked)}</b> 个原始 token,外加 <b>{cmpN}</b> 个摘要。</>
      : <>t={t} 没有保存挑选结果,图里只画了必选的当前块;另外 {Math.min(TOP_N - 1, curB)} 块由打分决定。拨到 15、31、47 … 255(每 16 个位置一次)可以看真实挑中的块。</>
  } else if (readMode === 1) {
    detail = t >= WINDOW
      ? <>位置 0–{t - WINDOW} 的 {t - WINDOW + 1} 个 token 完全读不到。</>
      : <>t 还没超过窗口长度,滑窗和全注意力读的一样多。</>
  } else {
    detail = <>读取量随 t 线性增长;生成第 256 个 token 时要读满 256 个。</>
  }
  return (
    <div className={styles.scope}>
      <h2>① 每个 query 到底读多少个 key</h2>
      <p className="lead">
        第 2 章的因果注意力里,位置 <code>t</code> 的 query 要和 <code>t+1</code> 个 key 逐个打分(见{' '}
        <Term k="causal-mask" name="因果掩码 · causal mask" def="注意力矩阵右上角置为 −∞,让每个位置只能看见自己和之前的 token。">因果掩码</Term>)。{' '}上下文越长,每一步读得越多。拖滑块选一个 query 位置,切换三种读法,看这一行掩码里哪些格子亮着:
      </p>
      <div className="lab">
        <div className="btn-row">
          {['全注意力', '只滑窗', 'NSA 三支路'].map((label, i) => (
            <button key={label} type="button" className={readMode === i ? 'btn primary' : 'btn'} onClick={() => setReadMode(i)}>{label}</button>
          ))}
        </div>
        <div className="rk-row">
          <label>query 位置 t</label>
          <input type="range" min={0} max={255} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
          <span className="rk-val">{t}</span>
        </div>
        <div className="svgbox"><ReadStrip t={t} mode={readMode} picked={picked} /></div>
        <div className="legend">
          {readMode === 0 && <span><i className="sw" style={{ background: COL.full }} />读取</span>}
          {readMode >= 1 && <span><i className="sw" style={{ background: COL.win }} />滑窗读取</span>}
          {readMode === 2 && <span><i className="sw" style={{ background: COL.sel }} />挑中块里的 token</span>}
          {readMode === 2 && <span><i className="sw" style={{ background: COL.cmp }} />已写满块的摘要(每块 1 个)</span>}
          <span><i className="sw" style={{ background: COL.unread }} />不读</span>
          <span><i className="sw" style={{ background: COL.future }} />未来位置</span>
          {readMode === 2 && <span><i className="sw" style={{ background: '#fff', border: `2px solid ${COL.cur}` }} />当前块(必选)</span>}
        </div>
        <div className="dotread">
          {readMode === 0 && <Card v={t + 1} label="读取的 key 数 = t+1" color="var(--accent)" />}
          {readMode === 1 && <Card v={tokensRead(t, { win: true })} label="读取的 key 数 = min(t+1, 32)" color="var(--good)" />}
          {readMode === 1 && <Card v={t + 1} label="全注意力会读" color="var(--ink2)" />}
          {readMode === 2 && <Card v={winN} label="滑窗 min(t+1, 32)" color="var(--good)" />}
          {readMode === 2 && <Card v={selN} label="挑选 min(t+1, 4×8)" color="var(--e1)" />}
          {readMode === 2 && <Card v={cmpN} label="压缩 ⌊(t+1)/8⌋ + 1 空槽" color="var(--amber)" />}
          {readMode === 2 && <Card v={tokensRead(t, NSA_ON)} label="合计(去重前上界)" color="var(--accent)" />}
          {readMode === 2 && <Card v={t + 1} label="全注意力会读" color="var(--ink2)" />}
        </div>
        <div className="note">
          {detail}
          <br />
          全部 256 个位置平均:全注意力 <b>{readAvg('full').toFixed(1)}</b> · 只滑窗 <b>{readAvg({ win: true }).toFixed(1)}</b> · NSA <b>{readAvg(NSA_ON).toFixed(1)}</b>(和训练 json 里的 <code>tokens_read_avg</code> 相同)。
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>12_sparse_attn.py</b> 的 <code>tokens_read</code>(读数公式)· 掩码 <code>CAUSAL</code> / <code>WINDOW</code> / <code>BLOCK_DONE</code></div>
      <div className="sub-h"><span className="badge">放大</span>换成 NSA 论文的默认配置</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        论文默认:压缩块 <code>l=32</code>、步长 <code>d=16</code>;挑选块 <code>l′=64</code>、挑 <code>n=16</code> 块;滑窗 <code>w=512</code>。{' '}解码时每一步最多读 <code>s/d</code> 个压缩 token、<code>n·l′</code> 个挑选 token、<code>w</code> 个邻近 token。拖上下文长度:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>上下文长度 s</label>
          <input type="range" min={13} max={20} step={1} value={exp} onChange={(e) => setExp(Number(e.target.value))} />
          <span className="rk-val">{CTX_LBL[exp]}</span>
        </div>
        <div className="svgbox"><BigSvg exp={exp} /></div>
        <div className="dotread">
          <Card v={en(s)} label="全注意力每步读" color="var(--accent)" small />
          <Card v={en(c)} label="压缩 s/16" color="var(--amber)" small />
          <Card v={en(se)} label="挑选 16×64" color="var(--e1)" small />
          <Card v={en(w)} label="滑窗 512" color="var(--good)" small />
          <Card v={en(tot)} label="NSA 合计" color="var(--ink)" small />
          <Card v={`${(s / tot).toFixed(1)}×`} label="访存量之比" color="var(--good)" small />
        </div>
        <div className="hp-note">
          {exp <= 16
            ? '8K–64K 四档与 NSA 论文表 4 的"每步访存 token 数"一致;论文说解码是访存瓶颈,预期加速约等于这个比值。'
            : '超过 64K 的档位是按同一公式外推的,论文表 4 只列到 64K。压缩那一段随长度线性增长,占比越来越大。'}
        </div>
      </div>
      <Dig title="压缩支路读的数为什么还随长度增长?">
        压缩支路给每块留一个摘要,块数 = 上下文长度 / 步长。所以它读的量是 <code>s/16</code>(论文配置)或 <code>t/8</code>(本关配置), 和上下文长度成正比,只是除掉了一个常数。挑选和滑窗两条支路读的量是固定的(1024 与 512)。 上下文到 1M 时,压缩摘要有 65,536 个,占 NSA 读取量的 98% 左右;这也是后来 DeepSeek-V3.2、V4 和 Qwen3.8 换用更轻的打分器、或把压缩率拉大的原因之一(STEP 5)。
      </Dig>
      <Dig title="三条支路的读数加起来,会不会重复算了同一个 token?">
        会。<code>tokens_read</code> 的注释写的是"去重之前的上界":当前块同时在滑窗和挑选里,最近的几块也可能被挑中。 上面的格子图在 t 有真实挑选记录时(t = 15, 31, 47 … 255)会额外给出去重后的原始 token 数。 三条支路各有自己的 K/V 投影,所以即使位置重复,读到的向量也不同,按支路分开计数也说得通。
      </Dig>
      <div className="next-hint">↳ 下一步:只读几十个 key,前提是知道该读哪几块。先给每块做一个便宜的摘要。</div>
    </div>
  )
}

function Step2() {
  const [t, setT] = useState(100)
  const [focus, setFocus] = useState(12)
  const curB = Math.floor(t / BLOCK_LEN)
  const nDone = Math.floor((t + 1) / BLOCK_LEN)
  const p0 = focus * BLOCK_LEN
  const visible = p0 + BLOCK_LEN - 1 <= t
  return (
    <div className={styles.scope}>
      <h2>② 压缩:把一块 token 压成一个摘要</h2>
      <p className="lead">
        下面是验证集里一段真实的 256 个字符(NSA 那组训练脚本存下的 <code>sample_text</code>),按{' '}
        <span className="d d-blen">8<i>block_len</i></span>
        {' '}切成 32 块。{' '}拖 query 位置:<b>已经写满的块</b>才有摘要可看(橙框),query 所在的块还没写完(紫色虚框),后面的块看不见。{' '}
        <b>点任意一块</b>,看 8 个 key 怎么变成 1 个摘要 key:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>query 位置 t</label>
          <input type="range" min={0} max={255} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
          <span className="rk-val">{t}</span>
        </div>
        <div className="hp-note">query 在位置 <b>{t}</b>(块 {curB}),可见摘要 <b>{nDone}</b> 个 + 1 个空槽。</div>
        <div className="blkgrid">
          {Array.from({ length: NB }, (_, b) => (
            <BlockCard key={b} b={b} t={t} pick={null} focus={focus} showWin={false} onPick={setFocus} />
          ))}
        </div>
        <div className="legend">
          <span><i className="sw" style={{ background: '#fff', border: '2px solid var(--amber)' }} />已写满 · 摘要可见</span>
          <span><i className="sw" style={{ background: '#fff', border: '2px dashed var(--e3)' }} />query 所在块 · 摘要不可见</span>
          <span><i className="sw" style={{ background: 'var(--accent)' }} />query 自己</span>
          <span>· 空格 ↵ 换行</span>
        </div>
        <div className="cmpflow">
          <div>
            <div className="hp-note" style={{ marginBottom: 3 }}>
              块 {focus} 的 8 个 key(各 <span className="d d-head">32<i>head_size</i></span> 维)+ <code>blk_pos</code>
            </div>
            <div className="vecs">
              {Array.from({ length: BLOCK_LEN }, (_, i) => {
                const ch = LM_TEXT[p0 + i] || ' '
                return (
                  <div key={i} className="vec">
                    <div className="vl">{showCh(ch)}</div>
                    <div className="vb" />
                    <div className="vl">+pos{i}</div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="arrow">拼接<br />→</div>
          <div>
            <div className="hp-note" style={{ marginBottom: 3 }}>
              <span className="d d-blen">8<i>block_len</i></span> × <span className="d d-head">32<i>head_size</i></span> = 256 维
            </div>
            <div className="longbar" />
          </div>
          <div className="arrow"><code>cmp_k</code><br />Linear(256→32)<br />→</div>
          <div style={{ textAlign: 'center' }}>
            <div className="hp-note" style={{ marginBottom: 3 }}>摘要 key</div>
            <div className="sumvec" style={{ margin: '0 auto' }} />
            <div className="vl" style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--ink2)' }}>32 维</div>
          </div>
        </div>
        <div className="note">
          块 {focus} 覆盖位置 {p0}–{p0 + BLOCK_LEN - 1}。对 t={t} 的 query,这个摘要{visible ? <b>可见</b> : <b>不可见</b>}{visible ? ':块已写满' : ':块的最后一个位置还在 t 之后'}。 value 那一侧同样处理(<code>cmp_v</code>),每块得到一对摘要 key/value。256 个 key 最终压成 32 对摘要,query 对它们做一次普通注意力,就是压缩支路的输出。
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>12_sparse_attn.py</b> 的 <code>SparseAttention.forward</code>「支路 1:压缩」· <code>blk_pos</code> / <code>cmp_k</code> / <code>cmp_v</code> / <code>sink_kv</code></div>
      <Dig title="为什么摘要要等块写满才能看?">
        摘要是把块里 8 个 key 拼起来再过线性层,它混进了这 8 个位置的全部信息。 如果 query 在块中间就去看这个摘要,等于偷看了自己后面的 token,训练时就泄漏了答案。 所以代码用 <code>BLOCK_DONE</code> 做掩码:块的最后一个位置 ≤ t,这块的摘要才对 t 可见。 query 所在的那块没有摘要可看,它的内容交给挑选支路(当前块必选)和滑窗支路。
      </Dig>
      <Dig title="开头 7 个位置一块完整的都没有,压缩支路怎么算?">
        全部被掩掉时 softmax 的分母是 0,会算出 NaN。代码加了一个永远可见的"空槽" <code>sink_kv</code>(可学习参数,初值为 0), 拼在所有摘要的最前面。于是 t = 0…6 的 query 至少能看见这一格,读数公式里压缩支路那一项也因此多了 <code>+1</code>。
      </Dig>
      <Dig title="论文里的压缩和这里有哪些不同?">
        NSA 论文(§3.3.1 式 (7))的压缩函数 φ 是一个带块内位置编码的 MLP,块长 <code>l=32</code>、步长 <code>d=16</code>, 相邻块有一半重叠,论文的解释是减轻信息被切碎。本关用一个 <code>Linear</code> 加可学习的 <code>blk_pos</code> 代替 MLP, 步长等于块长(不重叠),这样挑选块和压缩块能共用同一套切分,打分可以直接复用(下一步)。 另外,摘要 key 没有加 RoPE,块内先后顺序由 <code>blk_pos</code> 和拼接的顺序表达。
      </Dig>
      <div className="next-hint">↳ 下一步:query 对 32 个摘要打完分,分数最高的几块就值得逐字细看。</div>
    </div>
  )
}

function Step3() {
  const [selDs, setSelDs] = useState(0)
  const [selIdx, setSelIdx] = useState<[number, number]>([8, 0])
  const probes = selDs === 0 ? LM_PROBES : RC_PROBES
  const i = selIdx[selDs]
  const st = recallStats()
  let view: ReactNode
  let legend: ReactNode
  let note: ReactNode
  let desc: ReactNode
  if (selDs === 0) {
    const t = LM_PROBES[i]
    const ch = LM_CHOSEN[i]
    const pick = new Set(ch)
    const outside = ch.filter((b) => (b + 1) * BLOCK_LEN - 1 < t - WINDOW + 1)
    const avail = Math.floor((t + 1) / BLOCK_LEN)
    const nTok = ch.reduce((a, b) => a + Math.max(0, Math.min(BLOCK_LEN, t + 1 - b * BLOCK_LEN)), 0)
    desc = <>语言建模 NSA 模型 · 验证集一段 256 字符 · 每 16 个位置记录一次挑选(json 的 <code>probe_positions</code> / <code>chosen_blocks</code>)</>
    view = (
      <div className="blkgrid">
        {Array.from({ length: NB }, (_, b) => (
          <BlockCard key={b} b={b} t={t} pick={pick} focus={null} showWin />
        ))}
      </div>
    )
    legend = (
      <>
        <span><i className="sw" style={{ background: 'var(--e1s)', border: '2px solid var(--e1)' }} />挑中的块</span>
        <span><i className="sw" style={{ background: '#fff', border: '2px solid var(--amber)' }} />已写满、没挑中</span>
        <span><i className="sw" style={{ background: '#F4F2EA', borderBottom: '3px solid var(--good)' }} />在滑窗内(最近 32 个)</span>
        <span><i className="sw" style={{ background: 'var(--accent)' }} />query</span>
      </>
    )
    note = <>query 在 t={t}(字符 “{showCh(LM_TEXT[t] || ' ')}”),可挑的已写满块有 {avail} 个,挑中 <b>[{ch.join(', ')}]</b>,其中 <b>{outside.length}</b> 块完全在滑窗之外{outside.length ? `(块 ${outside.join('、')})` : ''}。 挑选支路逐个读这 {ch.length} 块里 ≤ t 的 token,共 {nTok} 个。</>
  } else {
    const t = RC_PROBES[i]
    const key = RC_KEYS[i]
    const ch = RC_CHOSEN[i]
    const kb = Math.floor(key / BLOCK_LEN)
    const vb = Math.floor((key + 1) / BLOCK_LEN)
    const hk = ch.includes(kb)
    const hv = ch.includes(vb)
    desc = <>找钥匙 NSA 模型(RTX 4090)· 128 个位置:1–32 放 16 对钥匙和值,33–96 噪声,97–127 把 16 把钥匙打乱再问一遍 · 只记录了最后一层第 0 组 K/V 头</>
    view = <div className="svgbox"><RecallSvg i={i} /></div>
    legend = (
      <>
        <span><i className="sw" style={{ background: '#b9c7ea' }} />钥匙</span>
        <span><i className="sw" style={{ background: '#b7d6c6' }} />值</span>
        <span><i className="sw" style={{ background: '#E9E6DC' }} />噪声</span>
        <span><i className="sw" style={{ background: '#e2c3d8' }} />提问区</span>
        <span><i className="sw" style={{ background: 'rgba(58,99,192,.18)', border: '2px solid var(--e1)' }} />挑中的块</span>
        <span><i className="sw" style={{ background: 'rgba(163,84,140,.18)', border: '2px solid var(--e3)' }} />当前块</span>
      </>
    )
    note = <>提问在 t={t},问的钥匙在位置 {key}(块 {kb}),答案值在位置 {key + 1}(块 {vb})。这一次挑中 <b>[{ch.join(', ')}]</b>: 钥匙块 {hk ? <b>在内</b> : '不在内'},值块 {hv ? <b>在内</b> : '不在内'}。滑窗此时最远只到位置 {t - WINDOW + 1}。<br />16 个提问合计:挑中钥匙块 <b>{st.k}/16</b>,挑中值块 <b>{st.v}/16</b>,至少挑中其一 <b>{st.any}/16</b>; 除当前块外共挑 {st.far} 块,其中 <b>{st.farKey}</b> 块落在钥匙区(块 0–3)。原因见下方第二个折叠问题。</>
  }
  return (
    <div className={styles.scope}>
      <h2>③ 挑选:只细看分数最高的 top-n 块</h2>
      <p className="lead">
        压缩支路算注意力时已经有了 query 对每个摘要的分数。挑选支路直接复用这组分数,取最高的{' '}
        <b>top_n = 4</b> 块(query 所在的当前块强制入选),把这几块里的原始 token 逐个拿来做注意力。{' '}下面是训练结束后<b>最后一层</b>真实挑中的块。点一个 query 位置:
      </p>
      <div className="lab">
        <div className="btn-row">
          {['tiny shakespeare 样本', '远处找钥匙样本'].map((label, idx) => (
            <button key={label} type="button" className={selDs === idx ? 'btn primary' : 'btn'} onClick={() => setSelDs(idx)}>{label}</button>
          ))}
        </div>
        <div className="hp-note" style={{ margin: '4px 0 6px' }}>{desc}</div>
        <div className="btn-row small">
          {probes.map((p, idx) => (
            <button key={p} type="button" className={idx === i ? 'btn primary' : 'btn'} onClick={() => setSelIdx((prev) => {
              const next: [number, number] = [prev[0], prev[1]]
              next[selDs] = idx
              return next
            })}>t={p}</button>
          ))}
        </div>
        <div>{view}</div>
        <div className="legend">{legend}</div>
        <div className="note">{note}</div>
      </div>
      <div className="codepath">↳ 代码:<b>12_sparse_attn.py</b> 的 <code>SparseAttention.forward</code>「支路 2:挑选」· <code>score.topk</code> · 记录在 <code>self.last["chosen"]</code></div>
      <Dig title="挑选的分数怎么算?topk 不可导,挑选能学吗?">
        分数 = <code>softmax(q·摘要key / √head_size)</code>,和 NSA 论文 §3.3.2 式 (8) 一致。 同一组 K/V 的两个 query 头把分数相加后一起挑(论文式 (10)),这样一组只需要加载一份被选中的 K/V。 当前块的分数被直接设成 <code>1e4</code>,保证入选。
        <br /><br />
        整个挑选过程在 <code>torch.no_grad()</code> 里,挑哪几块这件事本身不产生梯度。 摘要 key 通过压缩支路的输出拿到梯度,越训越能反映块的内容,挑选复用它的分数,也就跟着变准。 挑中之后,块里 token 的注意力计算是正常可导的。
      </Dig>
      <Dig title="找钥匙准确率 99.85%,为什么图里挑中的块只有一半左右盖住钥匙?">
        脚本只保存了<b>最后一层、第 0 组 K/V 头</b>的挑选结果(<code>chosen[0, t]</code>)。 每层有 2 组 K/V 头,第 1 组挑了什么没有存;前三层挑了什么也没有存。 答案要从值 token 那里取,取的动作可以发生在更早的层,之后再由残差流一路带到最后一层, 所以最后一层这一组不一定还需要回头看钥匙。 门控数据也和这一点对得上:找钥匙模型第 2、3 层挑选门的均值是 0.609 与 0.565,最后一层是 0.458(STEP 4 可切换查看)。 这张图能说明的是:挑选确实会越过 64 个噪声位置跳回前面的钥匙区,但不能说明检索具体发生在哪一层。
      </Dig>
      <Dig title="为什么当前块一定要选?">
        当前块还没写满,压缩支路里没有它的摘要,而紧挨着 query 的几个 token 对预测下一个字最重要。 NSA 论文的做法类似:16 个挑选块里固定包含开头 1 块和本地 2 块(§4.1)。
      </Dig>
      <div className="next-hint">↳ 下一步:挑中的块是跳着的,最近的几十个字不一定都在里面。所以还要一条滑窗支路,并决定三条支路各听几成。</div>
    </div>
  )
}

function Step4() {
  const [on, setOn] = useState<Record<BrKey, boolean>>({ cmp: true, sel: true, win: true })
  const [gateDs, setGateDs] = useState(0)
  const onKeys = BR_KEYS.filter((b) => on[b])
  const lmRun = gateDs === 0 ? lmRunFor(on) : null
  const rcRun = gateDs === 1 ? rcRunFor(on) : null
  const gates = gateDs === 0 ? lmRun?.gates : rcRun?.gates
  const params = gateDs === 0 ? lmRun?.params : rcRun?.params
  let note: ReactNode
  if (onKeys.length === 0) {
    note = '三条支路全关就没有注意力输出了。对照组"全注意力"在 STEP 5。'
  } else if (gateDs === 0 ? !lmRun : !rcRun) {
    note = <>这个组合({onKeys.map((b) => BR_NAME[b]).join(' + ')}){gateDs === 1 ? '在找钥匙任务上' : ''}没有训练过,只能给出读数公式算出的数。训练过的组合:{gateDs === 0 ? '只滑窗、压缩+挑选、三支路' : '只滑窗、三支路'}。</>
  } else if (!gates) {
    note = gateDs === 0
      ? <>这组训练过(val loss {lmRun?.val.toFixed(4)}),但脚本只在含挑选支路时记录门值,只有滑窗时没有门的数据。</>
      : <>这组训练过(准确率 {rcRun ? (100 * rcRun.acc).toFixed(2) : '' }%),但脚本只在含挑选支路时记录门值,只有滑窗时没有门的数据。</>
  } else if (gateDs === 0 && lmRun === LM.nsa) {
    note = <>语言建模里<b>每一层滑窗门都最大</b>(0.424 → 0.637),越往后越大;挑选门第二,压缩门最小。预测下一个字符主要靠最近的字。</>
  } else if (gateDs === 0) {
    note = <>去掉滑窗后,<b>挑选门在每一层都大于压缩门</b>,第 2–4 层在 0.5 以上:当前块必选,局部信息只能从挑选支路拿。</>
  } else {
    note = <>找钥匙任务里<b>第 2–4 层挑选门最大</b>(0.609、0.565、0.458),和语言建模的排序不同:答案在滑窗够不到的地方,模型更依赖挑选支路。第 1 层仍是滑窗门最大(0.411)。</>
  }
  const legendKeys = gates ? BR_KEYS.filter((b) => gates[0][b] !== undefined) : []
  return (
    <div className={styles.scope}>
      <h2>④ 滑窗兜底,门控分配权重</h2>
      <p className="lead">
        第三条支路是{' '}
        <Term k="sliding-window" name="滑窗注意力 · sliding window attention" def="每个 query 只看最近 w 个 token。读取量固定为 w,看不到窗口以外的内容。">滑窗注意力</Term>: 最近 32 个 token 必看。三条支路各算出一个输出,再各乘一个门值相加。门是 <code>sigmoid(Linear(x))</code>,<b>每个头、每个位置、每条支路各一个</b>,三个门互不约束。{' '}开关下面三条支路,看读数怎么变;对应组合真训练过的,会画出每层的平均门值:
      </p>
      <div className="lab">
        <div className="btn-row">
          {BR_KEYS.map((b) => (
            <button key={b} type="button" className={on[b] ? 'btn primary' : 'btn'} onClick={() => setOn((prev) => ({ ...prev, [b]: !prev[b] }))}>
              {b === 'cmp' ? '压缩 cmp' : b === 'sel' ? '挑选 sel' : '滑窗 win'}
            </button>
          ))}
        </div>
        <div className="btn-row">
          {['语言建模(tiny shakespeare)', '远处找钥匙'].map((label, idx) => (
            <button key={label} type="button" className={gateDs === idx ? 'btn primary' : 'btn'} onClick={() => setGateDs(idx)}>{label}</button>
          ))}
        </div>
        <div className="formula">
          out = {BR_KEYS.map((b, idx) => (
            <span key={b}>
              {idx > 0 ? ' + ' : ''}
              <span className={on[b] ? 'hl' : 'off'}>g<sub>{b}</sub>·o<sub>{b}</sub></span>
            </span>
          ))}
          <br />
          <span style={{ color: 'var(--ink2)' }}>g = sigmoid(Linear(x)) → 形状 (batch, n_head=4, T, 3),每个头、每个位置、每条支路一个数</span>
        </div>
        <div className="dotread">
          {onKeys.length > 0 && <Card v={tokensRead(BLOCK_SIZE - 1, on)} label="最后一个 query 读几个" color="var(--accent)" />}
          {onKeys.length > 0 && <Card v={readAvg(on).toFixed(1)} label="256 个位置平均" color="var(--accent)" />}
          {gateDs === 0 && lmRun && <Card v={lmRun.val.toFixed(4)} label="val loss(MPS)" color="var(--ink)" />}
          {gateDs === 1 && rcRun && <Card v={`${(100 * rcRun.acc).toFixed(2)}%`} label="找钥匙准确率(4090)" color="var(--ink)" />}
          {params !== undefined && <Card v={`${(params / 1e6).toFixed(3)}M`} label="总参数" color="var(--ink2)" />}
        </div>
        <div className="svgbox">{gates && <GateChart layers={gates} />}</div>
        <div className="note">
          {legendKeys.map((b, idx) => (
            <span key={b}>
              {idx > 0 ? ' ' : ''}
              <span style={{ color: COL[b], fontWeight: 700 }}>■ {BR_NAME[b]}</span>
            </span>
          ))}
          {legendKeys.length > 0 && <br />}
          {note}
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>12_sparse_attn.py</b> 的 <code>SparseAttention.forward</code>「支路 3:滑窗」与「门控加权」· <code>self.gate = nn.Linear(n_embd, 3 * n_head)</code></div>
      <Dig title="为什么用三个独立的 sigmoid,不用一个 softmax?">
        NSA 论文 §3.2 写的就是 sigmoid:<code>g ∈ [0,1]</code>,由输入特征经 MLP 和 sigmoid 得到。 softmax 会强迫三个门加起来等于 1,一条支路变重,另外两条必须变轻;sigmoid 允许三条同时开大或同时关小, 等于顺带学了一个整体缩放。图里语言建模 NSA 每层三个门之和从 0.65 到 1.03,找钥匙 NSA 在 1.08 到 1.26 之间,用的就是这个自由度。
      </Dig>
      <Dig title="图里最后一层的数和 json 里的 gate_mean_last_layer 为什么差一点?">
        两个数取自不同的前向:<code>gate_mean_last_layer</code> 只喂了 1 条验证样本(语言建模 NSA:cmp 0.145、sel 0.232、win 0.652), 图里的 <code>gate_mean_per_layer</code> 喂的是整批(语言建模 32 条,找钥匙 128 条),最后一层是 cmp 0.14、sel 0.255、win 0.637。 样本不同,平均值略有差别,两者给出的排序一致。
      </Dig>
      <Dig title="三条支路为什么各有一套 K/V 投影?">
        NSA 论文的理由是防止一条支路的梯度通过共享投影去影响另一条:滑窗支路学局部模式最快, 共用投影时它会主导 K/V 的学习,压缩和挑选支路就学不起来。代价是参数变多: 本关每层每条支路一个 <code>Linear(128 → 2×2×32)</code>,NSA 那组总参数 0.947M,全注意力 0.743M。STEP 5 比 loss 时要算上这一点。
      </Dig>
      <div className="next-hint">↳ 下一步:机制拆完了。把四组语言建模、三组找钥匙的真实结果摆在一起算总账,再看工业版怎么做。</div>
    </div>
  )
}

function BarRow({ name, width, color, value, on, onClick }: {
  name: string
  width: number
  color: string
  value: string
  on: boolean
  onClick: () => void
}) {
  return (
    <div className={on ? 'abrow sel' : 'abrow'} onClick={onClick}>
      <div className="an">{name}</div>
      <div className="at"><div className="af" style={{ width: `${width.toFixed(1)}%`, background: color }} /></div>
      <div className="av">{value}</div>
    </div>
  )
}

function Step5() {
  const [metric, setMetric] = useState(0)
  const [selLm, setSelLm] = useState<LmKey>('nsa')
  const [selRc, setSelRc] = useState<RcKey>('nsa')
  const st = recallStats()
  const labels = ['val loss(语言建模)', 'val 曲线', '找钥匙准确率', '平均每 query 读几个 key', '训练秒数']
  let body: ReactNode
  let note: ReactNode
  if (metric === 0) {
    const vs = LM_ORDER.map((k) => LM[k].val)
    const mx = Math.max(...vs)
    const mn = Math.min(...vs)
    body = (
      <>
        <div className="abgroup">语言建模 · 最终 val loss · Mac MPS(条越长 loss 越低,按组内最高与最低拉开)</div>
        {LM_ORDER.map((k) => (
          <BarRow key={k} name={LM[k].name} width={22 + 78 * (mx - LM[k].val) / (mx - mn)} color={SER_COL[k]} value={LM[k].val.toFixed(4)} on={selLm === k} onClick={() => setSelLm(k)} />
        ))}
      </>
    )
    note = <LmNote k={selLm} />
  } else if (metric === 1) {
    body = (
      <>
        <div className="abgroup">语言建模 · 每 500 步评测一次的 val loss · Mac MPS</div>
        <div className="svgbox"><LossCurve sel={selLm} /></div>
        <div className="legend">
          {LM_ORDER.map((k) => (
            <span key={k} className="abrow" style={{ margin: 0, cursor: 'pointer' }} onClick={() => setSelLm(k)}>
              <i className="sw" style={{ background: SER_COL[k] }} />{LM[k].name}
            </span>
          ))}
        </div>
      </>
    )
    note = <>
      <LmNote k={selLm} />
      <br />
      压缩+挑选(蓝)在前 2500 步明显落后,另外三条在 2500 步以后交错,相邻两次评测能上下跳 0.005–0.015。
    </>
  } else if (metric === 2) {
    body = (
      <>
        <div className="abgroup">远处找钥匙 · 最终准确率 · RTX 4090 · CUDA · PyTorch 2.4.1</div>
        {RC_ORDER.map((k) => (
          <BarRow key={k} name={RC[k].name} width={Math.max(2, 100 * RC[k].acc)} color={SER_COL[k]} value={`${(100 * RC[k].acc).toFixed(2)}%`} on={selRc === k} onClick={() => setSelRc(k)} />
        ))}
      </>
    )
    note = <RcNote k={selRc} />
  } else if (metric === 3) {
    body = (
      <>
        <div className="abgroup">语言建模 4 组 · 256 个位置平均每个 query 读几个 key(json 的 tokens_read_avg,去重前上界)</div>
        {LM_ORDER.map((k) => (
          <BarRow key={k} name={LM[k].name} width={100 * LM[k].read_avg / 128.5} color={SER_COL[k]} value={LM[k].read_avg.toFixed(1)} on={selLm === k} onClick={() => setSelLm(k)} />
        ))}
      </>
    )
    note = <>
      <LmNote k={selLm} />
      <br />
      找钥匙序列只有 128 个位置,那 3 组 json 由旧版脚本写出,<code>tokens_read_avg</code> 按 256 个位置算;脚本已改成按实际序列长度统计,这 3 组没有重跑,所以这里只列语言建模 4 组。
    </>
  } else {
    const mx1 = Math.max(...LM_ORDER.map((k) => LM[k].sec))
    const mx2 = Math.max(...RC_ORDER.map((k) => RC[k].sec))
    body = (
      <>
        <div className="abgroup">语言建模 · Mac MPS · 4000 步</div>
        {LM_ORDER.map((k) => (
          <BarRow key={k} name={LM[k].name} width={100 * LM[k].sec / mx1} color={SER_COL[k]} value={`${LM[k].sec} 秒`} on={selLm === k} onClick={() => setSelLm(k)} />
        ))}
        <div className="abgroup">远处找钥匙 · RTX 4090 · 6000 步 · batch 128(硬件不同,不和上面比)</div>
        {RC_ORDER.map((k) => (
          <BarRow key={`rc-${k}`} name={RC[k].name} width={100 * RC[k].sec / mx2} color={SER_COL[k]} value={`${RC[k].sec} 秒`} on={selRc === k} onClick={() => setSelRc(k)} />
        ))}
      </>
    )
    note = <>用 mask 模拟稀疏不会变快:MPS 上 NSA 三支路 {LM.nsa.sec} 秒,是全注意力 {LM.full.sec} 秒的 {(LM.nsa.sec / LM.full.sec).toFixed(1)} 倍;4090 上是 {(RC.nsa.sec / RC.full.sec).toFixed(1)} 倍。原因见下方折叠问题。</>
  }
  return (
    <div className={styles.scope}>
      <h2>⑤ 真实对照与工业版</h2>
      <p className="lead">
        同一份代码、同一个种子,只换 <code>--branches</code>。两套实验在<b>不同硬件</b>上跑:{' '}语言建模 4 组在 <b>Mac MPS</b>(各 4000 步),远处找钥匙 3 组在 <b>RTX 4090 · CUDA · PyTorch 2.4.1</b>(各 6000 步,batch 128)。{' '}两套之间的训练秒数不能互相比较。切换指标,点行看细节:
      </p>
      <div className="btn-row">
        {labels.map((label, idx) => (
          <button key={label} type="button" className={metric === idx ? 'btn primary' : 'btn'} onClick={() => setMetric(idx)}>{label}</button>
        ))}
      </div>
      <div className="ablab">{body}</div>
      <div className="note">{note}</div>
      <Dig title="NSA 的 val loss 最低,能说它比全注意力好吗?">
        不能直接这么说。三个原因: <b>① 参数不一样多</b>:NSA 0.947M,全注意力 0.743M,多 27.5%,多出来的主要是三套 K/V 投影和压缩器; <b>② 单种子</b>:每组只跑了一次; <b>③ 评测本身有抖动</b>:全注意力最后三次评测是 1.4946 → 1.4998 → 1.5038,相邻两次差到 0.005,NSA 是 1.4820 → 1.4970 → 1.4825,差到 0.015。
        <br /><br />
        按这个抖动量级看:只滑窗 1.5052 与全注意力 1.5038 差 0.0014,是噪声;压缩+挑选(不带滑窗)1.5321,高出 0.028,更可能是真的, 说明去掉滑窗之后局部信息不够。NSA 低 0.021,方向和论文一致(论文 Figure 4:27B 模型上 NSA 的预训练 loss 低于全注意力),但这组数据不足以给出幅度。
      </Dig>
      <Dig title="只滑窗在语言建模上几乎不掉点,为什么找钥匙会掉到 3.1%?">
        tiny shakespeare 是字符级文本,预测下一个字符主要靠最近几十个字符,32 的窗口基本够用。 找钥匙任务是专门反过来设计的:128 个位置里,钥匙和值放在 1–32,中间 33–96 是噪声,提问在 97–127。 滑窗在提问区往回最远看到位置 66,碰不到任何一把钥匙。值有 32 种,乱猜的准确率是 1/32 = 3.125%,只滑窗那组 3.11% 就是乱猜。 全注意力 100%,NSA 99.85%:挑选支路把前面的块找了回来。
      </Dig>
      <Dig title="教学版为什么没有变快,反而更慢?">
        教学版是在稠密的 256×256 注意力矩阵上加掩码来"模拟"稀疏:<code>F.scaled_dot_product_attention</code> 照样把整张矩阵算完, 被掩掉的位置只是不参与 softmax。三条支路就是三次完整的注意力,再加压缩和打分,所以 MPS 上 NSA 那组训练 2756 秒,全注意力 801 秒。 算出来的数值和真稀疏实现一致,速度不一致。
        <br /><br />
        真正变快要靠只取被选中块的 kernel。NSA 论文用 Triton 实现,在 8×A100 上 64K 长度训练前向快 9.0 倍、反向快 6.0 倍; 解码每步的访存量从 65,536 个 token 降到 5,632 个,按访存量估计的加速是 11.6 倍(表 4)。
      </Dig>
      <Dig title="稀疏注意力和第 13 章的线性注意力,各省的是什么?">
        <b>稀疏注意力省"读"</b>:K/V 全部保存,每个 query 只读其中一部分,所以精确检索能力保留(本关找钥匙 99.85%),但 KV cache 照样随上下文增长。 <b>线性注意力省"存"</b>:历史压进固定大小的状态,KV cache 不增长,代价是很难从状态里精确取回很久以前的某个 token。
        <br /><br />
        两者可以叠加。Qwen3.8-Flash-Next 是 <code>12 × (3 × Gated DeltaNet + 1 × QSA)</code>:四层里三层用线性注意力省存储,剩下一层用稀疏注意力省读取。 DeepSeek-V4 在稀疏之外还做了 KV 压缩(CSA 每 4 个 token 压成一条,HCA 每 128 个压成一条), 论文报告 V4-Pro 的 KV cache 是 V3.2 的 10%。
      </Dig>
      <div className="sub-h"><span className="badge">工业版</span>四种真实模型怎么挑</div>
      <div className="indgrid">
        <div className="ind">
          <h4>NSA</h4>
          <div className="src">DeepSeek · arXiv 2502.11089</div>
          <ul>
            <li>三支路 + sigmoid 门,和本关同一结构</li>
            <li>压缩 <code>l=32</code> 步长 <code>d=16</code>;挑 <code>n=16</code> 块 × <code>l′=64</code>(含开头 1 块、本地 2 块);滑窗 <code>w=512</code></li>
            <li>挑选分数复用压缩支路的注意力分数</li>
            <li>用 <b>27B 总参 / 3B 激活</b>的 MoE 模型从预训练开始按稀疏方式训练(260B token)</li>
          </ul>
        </div>
        <div className="ind">
          <h4>DSA</h4>
          <div className="src">DeepSeek-V3.2 · arXiv 2512.02556 §2.1</div>
          <ul>
            <li>单独一个{' '}
              <Term k="lightning-indexer" name="lightning indexer · 闪电索引器" def="DeepSeek-V3.2 DSA 里给 (query, 历史 token) 打分的小模块:头数少、可用 FP8 实现,每个 query 按分数选 2048 个 token 做注意力。">lightning indexer</Term>
              {' '}打分:<code>I = Σⱼ wⱼ · ReLU(qⱼ · k)</code>
            </li>
            <li>按 token 挑,不按块:每个 query 选 <b>2048</b> 个 token</li>
            <li>indexer 头数少,可用 <b>FP8</b> 实现</li>
            <li>基于 MLA 的 MQA 模式实例化;先稠密预热 1000 步,再稀疏训练 15000 步</li>
          </ul>
        </div>
        <div className="ind">
          <h4>CSA + HCA</h4>
          <div className="src">DeepSeek-V4 · arXiv 2606.19348(2026 preview)</div>
          <ul>
            <li><b>CSA</b>:每 <b>4</b> 个 token 的 KV 压成 1 条,再用 indexer 挑 top-k 条:Flash <b>512</b>,Pro <b>1024</b></li>
            <li><b>HCA</b>:每 <b>128</b> 个 token 压成 1 条,对压缩条目做稠密注意力</li>
            <li>另有滑窗支路 <code>n_win=128</code>;CSA、HCA 逐层交错</li>
            <li>indexer 的注意力计算用 <b>FP4</b></li>
          </ul>
        </div>
        <div className="ind">
          <h4>QSA</h4>
          <div className="src">Qwen3.8-Flash-Next 技术报告 §2.1.2</div>
          <ul>
            <li>indexer 是 MQA:<b>4</b> 个 query 头 + <b>1</b> 个共享 key 头</li>
            <li>key 每 <b>4</b> 个 token 平均池化成一块,只给已写满的块打分</li>
            <li>预算 <b>2048</b> token,即最多 <b>512</b> 块,再加上最后未写满块的尾部 token</li>
            <li>48 层 = <code>12 × (3 GDN + 1 QSA)</code>;在 256K 长度的持续预训练阶段把全注意力层换成 QSA</li>
          </ul>
        </div>
      </div>
      <div className="note">四家共同点:K/V 全存,每个 query 先用便宜的方式给历史打分,再只对高分部分做完整注意力。差别在打分器(复用压缩分数 / 独立 indexer)和挑的单位(块 / token / 压缩条目)。</div>
      <div className="sub-h"><span className="badge">达标</span>本关实测</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>平均每个 query 读的 key:全注意力 <b>{LM.full.read_avg}</b>,NSA <b>{LM.nsa.read_avg}</b>({(100 * LM.nsa.read_avg / LM.full.read_avg).toFixed(1)}%);最后一个 query 从 <b>256</b> 降到 <b>97</b>。换成论文配置,64K 上下文每步只读 5,632 个(8.6%)。</div></li>
        <li><span className="ck">✓</span><div>语言建模 val loss:全注意力 <b>{LM.full.val}</b> · 只滑窗 <b>{LM.win.val}</b> · 压缩+挑选 <b>{LM.cmpsel.val}</b> · NSA <b>{LM.nsa.val}</b>。NSA 最低,但参数多 {(100 * (LM.nsa.params / LM.full.params - 1)).toFixed(1)}%({(LM.nsa.params / 1e6).toFixed(3)}M 对 {(LM.full.params / 1e6).toFixed(3)}M),单种子。</div></li>
        <li><span className="ck">✓</span><div>远处找钥匙(RTX 4090):全注意力 <b>{(100 * RC.full.acc).toFixed(0)}%</b>,只滑窗 <b>{(100 * RC.win.acc).toFixed(1)}%</b>(乱猜水平),NSA <b>{(100 * RC.nsa.acc).toFixed(2)}%</b>:K/V 全存、只读一部分,检索能力没丢。</div></li>
        <li><span className="ck">✓</span><div>门控学出了任务差异:语言建模 NSA 每层滑窗门最大,找钥匙 NSA 第 2–4 层挑选门最大。</div></li>
        <li><span className="ck">✓</span><div>最后一层第 0 组 K/V 头的挑选,在 16 个提问里有 <b>{st.any}</b> 个盖住了钥匙块或值块;除当前块外挑中的 {st.far} 块里 <b>{st.farKey}</b> 块在钥匙区。</div></li>
      </ul>
      <div className="codepath">↳ 跑法:<code>python 12_sparse_attn.py --branches full | win | cmp,sel | cmp,sel,win</code> · 加 <code>--task recall</code> 换成找钥匙</div>
    </div>
  )
}

export function SparseAttention() {
  const chapter = findChapter('sparse-attention')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="sparse-attention"
      title="稀疏注意力:每个 query 只挑一部分历史去读"
      subtitle={
        <>
          第 13 章把{' '}
          <Term k="kv-cache" name="KV-cache · 键值缓存" def="把过去每个 token 的 K/V 缓存下来,生成新 token 时只算新的一列,避免重算整段。">KV cache</Term>
          {' '}压成固定大小的记忆板,换来的是精确检索变弱。这一关走另一条路:K/V 照样全存, 但每个 query 只挑一小部分去算,这叫{' '}
          <Term k="sparse-attention" name="稀疏注意力 · sparse attention" def="每个 query 只和一部分 key 算注意力分数,其余位置不参与。K/V 仍可全部保存,省的是每一步要读和要算的量。">稀疏注意力</Term>。{' '}挑法取自 DeepSeek 的{' '}
          <Term k="nsa" name="NSA · Native Sparse Attention" def="DeepSeek 2025(arXiv 2502.11089):压缩、挑选、滑窗三条支路并行,各自的输出乘一个 sigmoid 门再相加;从预训练开始就按稀疏方式训练。">NSA</Term>:{' '}压缩、挑选、滑窗三条支路,再用门控加权。配套代码 <code>phase4-efficiency/12_sparse_attn.py</code>,{' '}含四组语言建模训练(Mac MPS)与三组"远处找钥匙"训练(RTX 4090)。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3f7d63" bg="#E4EFE9">block_size <b>256</b> <i>上下文长度</i></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">block_len <b>8</b> <i>一块几个 token</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">top_n <b>4</b> <i>每个 query 细看几块(含当前块)</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">window <b>32</b> <i>滑窗长度</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">n_kv_head <b>2</b> <i>K/V 头数(同组共用一次挑选)</i></HpChip>
          <span className="hp-note">另:n_embd 128 · n_head 4 · head_size 32 · 4 层。window=32 与 top_n×block_len=32 数值相同,含义不同。</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 稀疏注意力 · 通关</div>
          <div className="cs">你亲手拆开了 NSA 的三条支路:压缩给每块留摘要,挑选只细看几块,滑窗兜住最近的字,门控决定各听几成。K/V 全存、只读一部分,找钥匙照样答对。</div>
        </>
      }
    />
  )
}
