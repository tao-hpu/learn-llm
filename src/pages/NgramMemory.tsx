// 旧页 goto 只换步骤，不重置行数、真实规模、token、表长、撞行档、门控、对照数据集、曲线和放表位置。
import { useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  BB_FW, BB_FW0, COLL, DEMO_T, DEV, DISTINCT2, DISTINCT3, DS, FW_RUNS, GATES, HX_IDS, HX_ROWS, HX_TOKENS,
  ORD8, RAN, REAL, REAL_BTNS, ROW_OPTS, SHK_RUNS, SPEED, SPEED_TABLE_P,
  avg, en, fin, fmtP, hashH, mix, randColl, rowOf,
  type RealModel, type Run,
} from './ngramMemoryData'
import styles from './NgramMemory.module.css'

const HEADS = [0, 1, 2, 3, 4, 5, 6, 7]
const CAP_TICKS = [
  [1, '10'],
  [3, '1K'],
  [5, '100K'],
  [7, '10M'],
  [9, '1B'],
] as const
const COLL_TICKS = [0, 0.25, 0.5, 0.75, 1]
const MONO = 'ui-monospace,monospace'

function TokText({ s }: { s: string }) {
  const shown = s.replace(/\n/g, '⏎')
  if (shown.startsWith(' ')) return <><span className="sp">·</span>{shown.slice(1)}</>
  return <>{shown}</>
}

function qtok(i: number) {
  if (i < 0) return '⟨0 号补位⟩'
  return `"${(HX_TOKENS[i] ?? '').replace(/\n/g, '⏎')}"`
}

function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={on ? 'btn primary' : 'btn'} onClick={onClick}>{children}</button>
}

function CapSvg({ rows }: { rows: number }) {
  const W = 900
  const H = 240
  const T = 26
  const B = 30
  const tableP = 8 * rows * 16
  const bb = rows ? BB_FW : BB_FW0
  const read = rows ? 128 : 0
  const SX = 34
  const SW = 30
  const GAP = 13
  const HMAX = H - T - B - 10
  const BX = 440
  const BW = W - BX - 20
  const lg = (v: number) => (v <= 0 ? 0 : Math.max(0, (Math.log10(v) - 1) / 8) * BW)
  const bars = [
    [tableP, '表参数', '#b8512f'],
    [bb, '主干参数', '#3a63c0'],
    [read, '每 token 读的数', '#3f7d63'],
  ] as const
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="8 张表的高度与三根对数条">
      <text x={SX} y={T - 10} fontSize="11" fontFamily={MONO} fill="#6B6B68">{'8 张表(高度 ∝ log₂ 行数)· 橙线 = " transit" 读的行'}</text>
      {HEADS.map((k) => {
        const x = SX + k * (SW + GAP)
        if (rows === 0) {
          return (
            <g key={k}>
              <rect x={x} y={H - B - 8} width={SW} height={8} fill="none" stroke="#D9D5CA" strokeDasharray="3 2" />
              <text x={x + SW / 2} y={H - B + 14} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={k < 4 ? '#3f7d63' : '#3a63c0'}>{k < 4 ? '2g' : '3g'}{k}</text>
            </g>
          )
        }
        const h = Math.max(8, (HMAX * Math.log2(rows)) / 22)
        const y = H - B - h
        const ry = y + ((rowOf(DEMO_T, k, rows) + 0.5) / rows) * h
        return (
          <g key={k}>
            <rect x={x} y={y} width={SW} height={h} rx={3} fill={k < 4 ? '#E4EFE9' : '#E5EBF9'} stroke={k < 4 ? '#3f7d63' : '#3a63c0'} strokeWidth={1} />
            <line x1={x - 3} y1={ry} x2={x + SW + 3} y2={ry} stroke="#D97757" strokeWidth={3} />
            <text x={x + SW / 2} y={H - B + 14} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={k < 4 ? '#3f7d63' : '#3a63c0'}>{k < 4 ? '2g' : '3g'}{k}</text>
          </g>
        )
      })}
      {rows === 0 ? <text x={SX + 170} y={H - B - 40} textAnchor="middle" fontSize="12" fill="#6B6B68">不挂表</text> : null}
      {CAP_TICKS.map(([e, t]) => {
        const x = BX + ((e - 1) / 8) * BW
        return (
          <g key={t}>
            <line x1={x} y1={T + 6} x2={x} y2={H - B} stroke="#EAE7DE" />
            <text x={x} y={H - B + 14} textAnchor="middle" fontSize="10" fontFamily={MONO} fill="#6B6B68">{t}</text>
          </g>
        )
      })}
      {bars.map(([v, t, c], i) => {
        const y = T + 14 + i * 58
        const w = lg(v)
        return (
          <g key={t}>
            <text x={BX} y={y} fontSize="11.5" fill={c} fontWeight={700}>{t}</text>
            <rect x={BX} y={y + 6} width={w} height={22} rx={4} fill={c} opacity={0.85} />
            <text x={BX + w + 6} y={y + 22} fontSize="11.5" fontFamily={MONO} fill="#1A1A18">{v ? en(v) : '0'}</text>
          </g>
        )
      })}
    </svg>
  )
}

function RealSvg({ sel, onPick }: { sel: number; onPick: (i: number) => void }) {
  const W = 860
  const RH = 52
  const T = 8
  const L = 190
  const R = 70
  const H = T + REAL.length * RH + 4
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="四个模型的总参数、表参数与激活参数">
      {REAL.map((m, i) => {
        const y = T + i * RH
        const bw = W - L - R
        const on = i === sel
        const tw = (m.table / m.total) * bw
        const aw = (m.active / m.total) * bw
        const active = `激活 ${m.active.toFixed(m.unit === 'M' ? 2 : 1)}${m.unit}${tw > 0 ? ` · 表 ${m.table.toFixed(1)}${m.unit}(占 ${(100 * m.table / m.total).toFixed(0)}%)` : ''}`
        return (
          <g key={m.name} opacity={on ? 1 : 0.38} style={{ cursor: 'pointer' }} onClick={() => onPick(i)}>
            <rect x={0} y={y} width={W} height={RH - 4} fill="transparent" />
            <text x={L - 10} y={y + 20} textAnchor="end" fontSize="12" fontWeight={on ? 700 : 500} fill={on ? '#D97757' : '#1A1A18'}>{m.name}</text>
            <rect x={L} y={y + 6} width={bw - tw} height={16} fill="#8FA7D9" />
            {tw > 0 ? <rect x={L + bw - tw} y={y + 6} width={tw} height={16} fill="#b8512f" /> : null}
            <text x={L + bw + 6} y={y + 19} fontSize="11" fontFamily={MONO} fill="#1A1A18">{m.total.toFixed(1)}{m.unit}</text>
            <rect x={L} y={y + 26} width={Math.max(2, aw)} height={12} fill="#3f7d63" />
            <text x={L + Math.max(2, aw) + 6} y={y + 36} fontSize="10.5" fontFamily={MONO} fill="#3f7d63">{active}</text>
          </g>
        )
      })}
    </svg>
  )
}

function CollSvg({ sel, onPick }: { sel: number; onPick: (i: number) => void }) {
  const W = 860
  const H = 230
  const L = 46
  const R = 16
  const T = 18
  const B = 34
  const gw = (W - L - R) / 3
  const bw = gw * 0.26
  const Y = (v: number) => H - B - v * (H - B - T)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="三档表长的撞行比例">
      {COLL_TICKS.map((v) => (
        <g key={v}>
          <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke={v === 0 ? '#6B6B68' : '#EAE7DE'} />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="10.5" fontFamily={MONO} fill="#6B6B68">{v * 100}%</text>
        </g>
      ))}
      {COLL.map((c, i) => {
        const cx = L + i * gw + gw / 2
        const on = i === sel
        const series = [
          { v: avg(c.c2), n: DISTINCT2, col: '#3f7d63', side: -1 },
          { v: avg(c.c3), n: DISTINCT3, col: '#3a63c0', side: 1 },
        ]
        return (
          <g key={c.table}>
            {series.map((s) => {
              const x = cx + (s.side < 0 ? -bw - 4 : 4)
              const y = Y(s.v)
              const th = randColl(s.n, c.table)
              return (
                <g key={s.col}>
                  <rect x={x} y={y} width={bw} height={H - B - y} rx={3} fill={s.col} opacity={on ? 0.95 : 0.35} style={{ cursor: 'pointer' }} onClick={() => onPick(i)} />
                  <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight={700} fontFamily={MONO} fill={s.col} opacity={on ? 1 : 0.6}>{(100 * s.v).toFixed(1)}%</text>
                  <line x1={x - 3} y1={Y(th)} x2={x + bw + 3} y2={Y(th)} stroke="#1A1A18" strokeWidth={2.2} opacity={on ? 1 : 0.5} />
                </g>
              )
            })}
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="12" fontWeight={on ? 700 : 500} fontFamily={MONO} fill={on ? '#D97757' : '#6B6B68'}>{en(c.table)} 行</text>
          </g>
        )
      })}
    </svg>
  )
}

function FinalSvg({ ds, runSel, onPick }: { ds: number; runSel: string; onPick: (id: string) => void }) {
  const D = DS[ds]
  const runs = D.runs
  const W = 860
  const H = 250
  const L = 56
  const R = 120
  const T = 26
  const B = 36
  const vals = runs.flatMap((r) => {
    const f = fin(r)
    return [f[1], f[2]]
  })
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const X = (i: number) => L + ((i + 0.5) / D.cats.length) * (W - L - R)
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B)
  const yTicks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4)
  const main = runs.filter((r) => !r.two).slice().sort((a, b) => a.table - b.table)
  const path = (idx: number) => main.map((r, i) => {
    const f = fin(r)
    return `${i ? 'L' : 'M'}${X(D.cats.indexOf(r.table)).toFixed(1)},${Y(f[idx]).toFixed(1)}`
  }).join(' ')
  const diamond = (cx: number, cy: number, s: number) => `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="最终 train / val loss 随表大小">
      {yTicks.map((v, k) => (
        <g key={k}>
          <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="#EAE7DE" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="10.5" fontFamily={MONO} fill="#6B6B68">{v.toFixed(ds === 0 ? 3 : 2)}</text>
        </g>
      ))}
      {D.cats.map((c, i) => (
        <text key={c} x={X(i)} y={H - 12} textAnchor="middle" fontSize="11.5" fontFamily={MONO} fill="#6B6B68">{c === 0 ? '不挂表' : `${en(c)} 行`}</text>
      ))}
      <path d={path(1)} fill="none" stroke="#6B6B68" strokeWidth={1.6} strokeDasharray="5 4" />
      <path d={path(2)} fill="none" stroke="#D97757" strokeWidth={2.4} />
      {runs.map((r) => {
        const i = D.cats.indexOf(r.table)
        const on = r.id === runSel
        const f = fin(r)
        if (!r.two) {
          const x = X(i)
          return (
            <g key={r.id}>
              <circle cx={x} cy={Y(f[1])} r={on ? 6 : 4.5} fill="#fff" stroke="#6B6B68" strokeWidth={1.6} style={{ cursor: 'pointer' }} onClick={() => onPick(r.id)} />
              <circle cx={x} cy={Y(f[2])} r={on ? 8 : 6} fill="#D97757" stroke={on ? '#1A1A18' : '#fff'} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => onPick(r.id)} />
              <text x={x} y={Y(f[2]) - 13} textAnchor="middle" fontSize="11" fontWeight={700} fontFamily={MONO} fill="#D97757">{f[2].toFixed(4)}</text>
            </g>
          )
        }
        const x = X(i) + 30
        return (
          <g key={r.id}>
            <path d={diamond(x, Y(f[1]), on ? 7 : 5.5)} fill="#fff" stroke="#3a63c0" strokeWidth={1.6} style={{ cursor: 'pointer' }} onClick={() => onPick(r.id)} />
            <path d={diamond(x, Y(f[2]), on ? 9 : 7)} fill="#3a63c0" stroke={on ? '#1A1A18' : '#fff'} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => onPick(r.id)} />
            <text x={x + 12} y={Y(f[2]) + 4} fontSize="11" fontWeight={700} fontFamily={MONO} fill="#3a63c0">{f[2].toFixed(4)} 只 2-gram</text>
          </g>
        )
      })}
      <text x={L} y={T - 12} fontSize="10.5" fill="#6B6B68">最终 loss(第 4999 步)</text>
    </svg>
  )
}

function CurveSvg({ ds, runSel, onPick }: { ds: number; runSel: string; onPick: (id: string) => void }) {
  const D = DS[ds]
  const W = 860
  const H = 230
  const L = 56
  const R = 20
  const T = 14
  const B = 30
  const X = (s: number) => L + ((s - D.from) / (5000 - D.from)) * (W - L - R)
  const Y = (v: number) => T + ((D.yhi - Math.min(D.yhi, v)) / (D.yhi - D.ylo)) * (H - T - B)
  const yTicks = [0, 1, 2, 3, 4].map((k) => D.ylo + ((D.yhi - D.ylo) * k) / 4)
  const xTicks = [D.from, 2000, 3000, 4000, 5000]
  const line = (r: Run, idx: number) => r.curve.filter((p) => p[0] >= D.from).map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[idx]).toFixed(1)}`).join(' ')
  const order = D.runs.slice().sort((a, b) => Number(a.id === runSel) - Number(b.id === runSel))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="val loss 训练曲线">
      {yTicks.map((v, k) => (
        <g key={k}>
          <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="#EAE7DE" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="10.5" fontFamily={MONO} fill="#6B6B68">{v.toFixed(2)}</text>
        </g>
      ))}
      {xTicks.map((s) => (
        <text key={s} x={X(s)} y={H - 10} textAnchor="middle" fontSize="10.5" fontFamily={MONO} fill="#6B6B68">{s}</text>
      ))}
      {order.map((r) => {
        const on = r.id === runSel
        const lp = fin(r)
        return (
          <g key={r.id}>
            {on ? <path d={line(r, 1)} fill="none" stroke={r.col} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.9} /> : null}
            <path d={line(r, 2)} fill="none" stroke={r.col} strokeWidth={on ? 3 : 1.6} opacity={on ? 1 : 0.55} style={{ cursor: 'pointer' }} onClick={() => onPick(r.id)} />
            {on ? <circle cx={X(lp[0])} cy={Y(lp[2])} r={4.5} fill={r.col} /> : null}
          </g>
        )
      })}
    </svg>
  )
}

type FlowBox = { x: number; y: number; w: number; h: number; cx: number; cy: number }

function FlowSvg({ mode }: { mode: (typeof DEV)[number]['key'] }) {
  const W = 900
  const H = 236
  const LANE: [number, number][] = [[16, 96], [132, 212]]
  const C = '#1A1A18'
  const A = '#D97757'
  const parts: ReactNode[] = []
  let n = 0
  const box = (lane: number, x: number, w: number, t1: string, t2: string, col: string): FlowBox => {
    const y = LANE[lane][0] + 26
    const h = 44
    const accent = col === A
    parts.push(
      <g key={n++}>
        <rect x={x} y={y} width={w} height={h} rx={8} fill="#fff" stroke={col} strokeWidth={accent ? 2.2 : 1.2} />
        <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize="11.5" fontWeight={700} fill={accent ? A : C}>{t1}</text>
        <text x={x + w / 2} y={y + 34} textAnchor="middle" fontSize="10" fontFamily={MONO} fill="#6B6B68">{t2}</text>
      </g>,
    )
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 }
  }
  const arrow = (a: FlowBox, b: FlowBox, label?: string) => {
    let x1: number
    let y1: number
    let x2: number
    let y2: number
    if (Math.abs(a.cy - b.cy) < 2) {
      x1 = a.x + a.w
      y1 = a.cy
      x2 = b.x
      y2 = b.cy
    } else {
      x1 = a.cx + (b.cx > a.cx ? a.w / 4 : -a.w / 4)
      y1 = a.cy < b.cy ? a.y + a.h : a.y
      x2 = b.cx + (b.cx > a.cx ? -b.w / 4 : b.w / 4)
      y2 = a.cy < b.cy ? b.y : b.y + b.h
    }
    parts.push(<line key={n++} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6B6B68" strokeWidth={1.4} markerEnd="url(#ah)" />)
    if (label) parts.push(<text key={n++} x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2 + 4} fontSize="10" fontFamily={MONO} fill="#b8512f">{label}</text>)
  }
  const lanes = [['CPU · 主机内存', '#F4F2EA'], ['GPU · 显存', '#E5EBF9']] as const
  lanes.forEach(([t, c], i) => {
    parts.push(<rect key={n++} x={4} y={LANE[i][0]} width={W - 8} height={LANE[i][1] - LANE[i][0]} rx={10} fill={c} stroke="#E5E2D9" />)
    parts.push(<text key={n++} x={14} y={LANE[i][0] + 16} fontSize="11" fontWeight={700} fontFamily={MONO} fill="#6B6B68">{t}</text>)
  })
  if (mode === 'none') {
    const b0 = box(0, 24, 150, '取 batch', 'x, y(token id)', C)
    const b1 = box(1, 300, 200, '嵌入 + 4 个 Block', '输出头 · loss', C)
    const b2 = box(1, 560, 230, '反向 · AdamW', '全部参数在 GPU', C)
    arrow(b0, b1, 'x, y')
    arrow(b1, b2)
  } else if (mode === 'same') {
    const b0 = box(0, 24, 130, '取 batch', 'x, y', C)
    const b1 = box(0, 176, 160, '算行号', 'ngram_rows(x)', A)
    const b2 = box(1, 300, 170, '查表 · 8 行 × 16 维', '表 4.19M 在 GPU', A)
    const b3 = box(1, 500, 170, '门控 + 注入', '+ 4 个 Block · loss', C)
    const b4 = box(1, 700, 180, '反向 · AdamW', '含表的 4.19M 参数', C)
    arrow(b0, b1)
    arrow(b1, b2, '行号')
    arrow(b2, b3, 'e')
    arrow(b3, b4)
  } else {
    const b0 = box(0, 24, 120, '取 batch', 'x, y', C)
    const b1 = box(0, 160, 140, '算行号', 'ngram_rows(x)', A)
    const b2 = box(0, 320, 170, '查表 · 8 行 × 16 维', '表 4.19M 在 CPU', A)
    const b5 = box(0, 700, 180, '表的 AdamW 更新', '4.19M 参数在 CPU', A)
    const b3 = box(1, 420, 170, '门控 + 注入', '+ 4 个 Block · loss', C)
    const b4 = box(1, 640, 200, '反向 · 其余 AdamW', '主干 7.24M 在 GPU', C)
    arrow(b0, b1)
    arrow(b1, b2)
    arrow(b2, b3, '每 token 128 个数')
    arrow(b3, b4)
    arrow(b4, b5, '表的梯度')
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="一步训练里数据在 CPU 与 GPU 之间怎么走">
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#6B6B68" />
        </marker>
      </defs>
      {parts}
    </svg>
  )
}

function Step1() {
  const [rowsIdx, setRowsIdx] = useState(6)
  const [realSel, setRealSel] = useState(0)
  const idx = Math.max(0, Math.min(ROW_OPTS.length - 1, Math.round(rowsIdx)))
  const rows = ROW_OPTS[idx]
  const tableP = 8 * rows * 16
  const bb = rows ? BB_FW : BB_FW0
  const read = rows ? 128 : 0
  const ratio = tableP / bb
  const ran = RAN[rows]
  const model: RealModel = REAL[realSel]
  return (
    <div className={styles.scope}>
      <h2>① 容量和算力可以拆开</h2>
      <p className="lead">表有 8 张(每个哈希头一张),每张 <code>行数 × 16</code> 维。一个 token 在每张表里只取 1 行,合计 8 × 16 = <b>128</b> 个数, 和表有多少行无关。下面左边是 8 张表(高度按行数的对数画),橙色横线是 token <code>" transit"</code> 在每张表里取的那一行; 右边三根条用对数刻度。拖滑块改每个头的行数:</p>
      <div className="lab">
        <div className="rk-row">
          <label>每个哈希头的行数</label>
          <input type="range" min={0} max={8} step={1} value={rowsIdx} onChange={(e) => setRowsIdx(Number(e.target.value))} />
          <span className="rk-val">{rows === 0 ? '0(不挂表)' : en(rows)}</span>
        </div>
        <div className="scroll-x"><div style={{ minWidth: 600 }}><CapSvg rows={rows} /></div></div>
        <div className="legend">
          <span><i style={{ background: '#b8512f' }} />表参数 = 8 × 行数 × 16</span>
          <span><i style={{ background: '#3a63c0' }} />主干参数(第 12 章四件套 · 4 层 · 含 5 万词表嵌入)</span>
          <span><i style={{ background: '#3f7d63' }} />每 token 从表里读的数</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: '#b8512f' }}>{rows ? fmtP(tableP) : '0'}</div><div className="drl">表参数</div></div>
          <div className="dr"><div className="drv">{rows ? `${ratio.toFixed(ratio < 1 ? 3 : 2)}×` : '–'}</div><div className="drl">表 ÷ 主干</div></div>
          <div className="dr"><div className="drv" style={{ color: '#3f7d63' }}>{read} 个</div><div className="drl">每 token 读的数</div></div>
          <div className="dr"><div className="drv">{rows ? `1 / ${en(rows)}` : '–'}</div><div className="drl">每 token 读到表的几分之一</div></div>
        </div>
      </div>
      <div className="note">
        {rows === 0 ? (
          <>不挂表时就是第 12 章的四件套小模型,主干 <b>{en(BB_FW0)}</b> 个参数。</>
        ) : (
          <>每个头 {en(rows)} 行时,表有 <b>{en(tableP)}</b> 个参数,是主干的 <b>{ratio.toFixed(2)}</b> 倍;每个 token 仍然只读 8 行 × 16 维 = <b>128</b> 个数。{ran ? ` 这一档在 ${ran}。` : ' 这一档没有实际训练过,只是按公式算的参数量。'}</>
        )}
      </div>
      <div className="sub-h"><span className="badge">真实规模</span>总参数里表占多少</div>
      <p className="lead" style={{ marginBottom: 10 }}>每组两根条:上面是总参数(橙色段是 n-gram 表),下面是 <Term k="active-params" name="激活参数 · active parameters" def="处理一个 token 实际参与计算的参数量。MoE 里每 token 只走 top-k 个专家,激活参数远小于总参数。">激活参数</Term>, 四组各按自己的总参数画满格。点按钮看出处:</p>
      <div className="btn-row small">
        {REAL_BTNS.map((label, i) => <Btn key={label} on={i === realSel} onClick={() => setRealSel(i)}>{label}</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x"><div style={{ minWidth: 560 }}><RealSvg sel={realSel} onPick={setRealSel} /></div></div>
        <div className="legend">
          <span><i style={{ background: '#8FA7D9' }} />主干 / 模型主体</span>
          <span><i style={{ background: '#b8512f' }} />n-gram 表</span>
          <span><i style={{ background: '#3f7d63' }} />激活参数</span>
        </div>
        <div className="calc">
          <span className="hl">{model.name}</span>
          {model.lines.map((line) => <span key={line}><br />{line}</span>)}
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>13_engram.py</b> 的 <code>NgramMemory.__init__</code>(<code>self.tables</code> 形状 <code>N_HEADS × TABLE × ROW_DIM</code>)· <code>NgramMemory.lookup</code></div>
      <Dig title="主干 7.24M 参数里,有多少是词嵌入?">
        <>大部分。GPT-2 词表 50,257 个 token × 128 维 = <b>6,432,896</b> 个参数的 <Term k="embedding" name="嵌入 · embedding" def="把 token id 映射成可训练的稠密向量,本质是一张按 id 查的表。">嵌入</Term>表(和输出头共用), 输出头 bias 50,257 个;4 个 Block 合计 <b>726,016</b> 个,最后一层 RMSNorm 128 个,加起来是不挂表时的 7,209,297。 挂表以后多出 33,536 个:门控用的 <code>w_k</code>、<code>w_v</code> 各 128 × 128,两个 RMSNorm 各 128,短卷积 128 × 4。<br /><br />词嵌入本身就是一张按单个 token id 查的表,每个 token 读 1 行 128 维。n-gram 表把"按 1 个 token 查"扩展成"按最近 2 到 3 个 token 查"。 262144 行的表是 4 个 Block 参数的 46 倍,每 token 前向里真正做矩阵乘的仍是这 4 个 Block、门控和输出头。</>
      </Dig>
      <Dig title="同样的总参数,把一部分专家换成表,划算吗?">
        <>Engram 论文(Cheng et al.,"Conditional Memory via Scalable Lookup: A New Axis of Sparsity for Large Language Models",<b>arXiv 2601.07372</b>)做了这组对照: Engram-27B 与 MoE-27B 都是 <b>26.7B 总参、3.8B 激活</b>,Engram-27B 把路由专家从 72 个减到 55 个,腾出的参数给 Engram 表(5.7B)。 结果 MMLU +3.0(摘要写 +3.4)、CMMLU +4.0、BBH +5.0、ARC-C +3.7、HumanEval +3.0、MATH +2.4,Multi-Query NIAH 从 84.2 到 97.0。<br /><br />分多少给表合适,第 5 步给了两份报告的扫描结果。</>
      </Dig>
      <div className="next-hint">↳ 下一步:每个 token 只读 8 行。这 8 个行号怎么来,为什么不用跑模型就能算出来?</div>
    </div>
  )
}

function Step2() {
  const [hxT, setHxT] = useState(DEMO_T)
  const [hxTable, setHxTable] = useState(262144)
  const [collSel, setCollSel] = useState(0)
  const rows = HX_ROWS[hxTable]
  let ok = 0
  const body = HEADS.map((k) => {
    const { x, parts } = hashH(hxT, k)
    const jr = rows[hxT][k]
    if (Number(x % BigInt(hxTable)) === jr) ok += 1
    const expr = parts.map(([id, m]) => `${id} × ${en(m)}`).join(' ⊕ ')
    return (
      <tr key={k} className={`o${ORD8[k]}`}>
        <td>h{k}</td>
        <td>{ORD8[k]}-gram</td>
        <td>{expr}</td>
        <td className="r">{en(Number(x))}</td>
        <td className="r" style={{ color: 'var(--accent)', fontWeight: 700 }}>{en(jr)}</td>
        <td><div className="pos"><i style={{ left: `calc(${(100 * jr / hxTable).toFixed(2)}% - 1px)` }} /></div></td>
      </tr>
    )
  })
  const c = COLL[collSel]
  const c2 = avg(c.c2)
  const c3 = avg(c.c3)
  const used = DISTINCT2 * (1 - c2)
  return (
    <div className={styles.scope}>
      <h2>② 哈希:行号只看最近几个 token</h2>
      <p className="lead">下面是 FineWeb-Edu val 里的一段 24 个 <Term k="bpe" name="BPE · 字节对编码" def="GPT-2 用的分词法:从字节出发反复合并高频相邻对,得到约 5 万个子词 token。">BPE</Term> token。点一个 token(橙色), 以它结尾的 2-gram 标绿、3-gram 再往前多一个标蓝。4 个 2-gram 头和 4 个 3-gram 头各有一组随机奇数乘子: <b>每个 token id 乘上对应的乘子 → 异或到一起 → 对表长取模</b>,得到行号。开头不足 n 个 token 时,前面用 0 号 token 补齐。 这一步叫 <Term k="ngram-hash" name="n-gram 哈希 · multiplicative-XOR hash" def="把以当前位置结尾的 n 个 token id 各乘一个随机奇数、异或到一起、对表长取模,得到行号。不同 n-gram 可能落到同一行(撞行),多个头用不同乘子,降低同时撞上的概率。">n-gram 哈希</Term>。</p>
      <div className="lab">
        <div className="toks">
          {HX_TOKENS.map((s, i) => {
            const cls = i === hxT ? 'tok cur' : i === hxT - 1 ? 'tok g2' : i === hxT - 2 ? 'tok g3' : 'tok'
            return <span key={i} className={cls} title={`id ${HX_IDS[i]}`} onClick={() => setHxT(i)}><TokText s={s} /></span>
          })}
        </div>
        <div className="btn-row small">
          <span className="hp-note" style={{ marginRight: 4 }}>表长:</span>
          <Btn on={hxTable === 16384} onClick={() => setHxTable(16384)}>16384 行</Btn>
          <Btn on={hxTable === 262144} onClick={() => setHxTable(262144)}>262144 行</Btn>
        </div>
        <div className="calc">
          位置 {hxT}:2-gram = {qtok(hxT - 1)} {qtok(hxT)} · 3-gram = {qtok(hxT - 2)} {qtok(hxT - 1)} {qtok(hxT)}<br />
          token id:{hxT >= 2 ? HX_IDS[hxT - 2] : 0}, {hxT >= 1 ? HX_IDS[hxT - 1] : 0}, <span className="hl">{HX_IDS[hxT]}</span> · 表长 <span className="hl">{en(hxTable)}</span> 行 / 头
        </div>
        <div className="scroll-x" style={{ marginTop: 10 }}>
          <table className="htab">
            <thead>
              <tr>
                <th>头</th>
                <th>n-gram</th>
                <th>token id × 乘子,再异或</th>
                <th style={{ textAlign: 'right' }}>异或结果 H</th>
                <th style={{ textAlign: 'right' }}>行号 = H mod 表长</th>
                <th>在表里的位置</th>
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        </div>
        <div className="hp-note" style={{ marginTop: 6 }}>
          {ok === 8 ? '行号取自 json 的 hash_example.rows(Python 算);页面按同一公式复算,8 个头全部一致。' : `注意:页面复算与 json 有 ${8 - ok} 个头不一致,表中显示的是 json 里的值。`}
        </div>
      </div>
      <div className="sub-h"><span className="badge">撞行</span>表太小,不同 n-gram 挤在同一行</div>
      <p className="lead" style={{ marginBottom: 10 }}>脚本在训练集前 20 万个 token 里统计:出现过 <b>111,302</b> 种 2-gram、<b>170,212</b> 种 3-gram;每个头上,有多少比例的 n-gram 和别的 n-gram 共用一行。 三档表长都来自真实运行(32768 行那组取自吞吐测量)。黑色短线是"把这么多 n-gram 均匀随机撒进这么多行"的理论值。点一组:</p>
      <div className="btn-row small">
        {COLL.map((row, i) => <Btn key={row.table} on={i === collSel} onClick={() => setCollSel(i)}>{row.table} 行</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x"><div style={{ minWidth: 560 }}><CollSvg sel={collSel} onPick={setCollSel} /></div></div>
        <div className="legend">
          <span><i style={{ background: 'var(--e2)' }} />2-gram 撞行比例(4 个头平均)</span>
          <span><i style={{ background: 'var(--e1)' }} />3-gram 撞行比例(4 个头平均)</span>
          <span><i style={{ background: '#1A1A18', height: 3 }} />均匀随机撒点的理论值</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--e2)' }}>{(100 * c2).toFixed(1)}%</div><div className="drl">2-gram 撞行</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{(100 * c3).toFixed(1)}%</div><div className="drl">3-gram 撞行</div></div>
          <div className="dr"><div className="drv">{(DISTINCT2 / used).toFixed(2)} 种</div><div className="drl">平均每行挤几种 2-gram</div></div>
        </div>
      </div>
      <div className="note">
        {collSel === 0 ? (
          <>16384 行:2-gram 撞行 <b>{(100 * c2).toFixed(1)}%</b>,每一行都被用上,平均每行挤 {(DISTINCT2 / used).toFixed(1)} 种 2-gram。取回的向量是好几个 n-gram 共用的,表太小,记不住。</>
        ) : collSel === 1 ? (
          <>32768 行:行数翻倍,2-gram 撞行降到 <b>{(100 * c2).toFixed(1)}%</b>,仍接近"行被用满"的下限 {(100 * (1 - c.table / DISTINCT2)).toFixed(1)}%。</>
        ) : (
          <>262144 行:行数超过 n-gram 种数,2-gram 撞行降到 <b>{(100 * c2).toFixed(1)}%</b>,3-gram <b>{(100 * c3).toFixed(1)}%</b>,和均匀随机撒点的理论值基本重合。</>
        )}
      </div>
      <div className="codepath">↳ 代码:<b>13_engram.py</b> 的 <code>hash_multipliers</code>(固定种子 2026)· <code>ngram_rows</code> · 脚本中段的撞行统计 <code>collision</code></div>
      <Dig title="为什么每种 n-gram 要用 4 个头,不用 1 个头配 4 倍的行?">
        <>两个 n-gram 在某个头上撞了行,它们取回的这一段 16 维是同一个向量。4 个头用 4 组不同的乘子,在一个头上撞了,在另一个头上多半撞不上; 拼起来的 128 维里只有一部分被共用,模型仍能区分这两个 n-gram。只用 1 个头时,一旦撞行,整根向量都相同。 代码里 <code>heads_per_order = 4</code>;Engram-27B 原文 "the number of heads to 8";Qwen3.8-Flash-Next 的 config 里是 <code>heads_per_ngram: 8</code>。</>
      </Dig>
      <Dig title="16384 行时 2-gram 撞行为什么正好是 85%?">
        <>撞行比例 = 1 − 用到的不同行数 ÷ 不同 n-gram 数。每个头只有 16384 行,11 万种 2-gram 最多用满 16384 行, 所以比例至少是 1 − 16384 / 111,302 = <b>85.3%</b>,实测 85.3%:行已经全部用满,平均每行 6.8 种 2-gram。 262144 行时行数多过 n-gram 种数,实测 18.4%,和均匀随机撒点的理论值 18.5% 一致,说明这个乘法加异或的哈希在这里分布均匀。<br /><br />统计只用了训练集前 20 万个 token。整个 9500 万 token 的训练段里 n-gram 种数更多,真实撞行比例比这里高。</>
      </Dig>
      <Dig title="Engram 和 Qwen3.8 的哈希部分还多做了什么?">
        <>Engram(<b>arXiv 2601.07372</b> §2.2):先做 tokenizer 压缩,用 NFKC 规范化和小写把 token 映射成规范 ID,128k 词表的有效大小减少 23%; 后缀 n-gram 最大 N = 3;每个阶 K 个头,哈希函数是 multiplicative-XOR,各头取回的向量拼接。<br />Qwen3.8-Flash-Next 的 HF config.json 里与此相关的字段:<code>ngram_size: 3</code>、<code>heads_per_ngram: 8</code>、<code>ngram_vocab_size_base: 20000000</code>。 技术报告没有解释 20000000 具体指什么。报告 §2.3 原句:"short n-grams ending at each token serve as keys into embedding tables"。</>
      </Dig>
      <div className="next-hint">↳ 下一步:撞了行,取回的向量就可能属于别的 n-gram。取出来的记忆和上下文不搭,怎么办?</div>
    </div>
  )
}

function Step3() {
  const [gSel, setGSel] = useState(0)
  const [gTok, setGTok] = useState(17)
  const G = GATES[gSel]
  const tok = gTok >= G.tokens.length ? 0 : gTok
  const v = G.v
  const lo = v.filter((x) => x < 0.1).length
  const hi = v.filter((x) => x > 0.9).length
  return (
    <div className={styles.scope}>
      <h2>③ 门控:这段记忆和上下文对不对得上</h2>
      <p className="lead">行号只看字面上的最近两三个 token,同一个 n-gram 在不同上下文里取回同一个向量,撞行时还混着别的 n-gram。 所以记忆向量 e 先过一道 <Term k="memory-gate" name="记忆门控 · context gate" def="用当前隐状态 h 当 query、记忆向量投影后当 key,两者 RMSNorm 后做点积、除以 √d、过 sigmoid,得到 0~1 的标量门。门值乘在记忆上,决定这个位置加多少记忆进残差流。">门</Term>: 当前隐状态 h 当 query,e 经 <code>w_k</code> 投影后当 key,两边各做 <Term k="rmsnorm" name="RMSNorm" def="只除以均方根、不减均值的归一化,第 12 章四件套之一。">RMSNorm</Term>,点积除以 √128,过 sigmoid 得到一个 0~1 的数。 门值乘上 <code>w_v · e</code>,经短卷积后加回 <Term k="residual" name="残差流 · residual" def="x = x + f(x):每层的输出加回主干上,主干那条线就是残差流。">残差流</Term>。 下面每格是一个 token,颜色越深门越开。悬停或点击看数值,切换模型:</p>
      <div className="calc">
        α<sub>t</sub> = σ( RMSNorm(h<sub>t</sub>) · RMSNorm(W<sub>k</sub> e<sub>t</sub>) / √128 )<br />
        x ← x + Conv1D<sub>k=4,因果</sub>( α<sub>t</sub> · W<sub>v</sub> e<sub>t</sub> ) <span style={{ color: 'var(--ink2)' }}>(只在第 2 个 Block 前做一次)</span>
      </div>
      <div className="btn-row small" style={{ marginTop: 12 }}>
        {GATES.map((g, i) => <Btn key={g.name} on={i === gSel} onClick={() => setGSel(i)}>{g.name}</Btn>)}
      </div>
      <div className="lab">
        <div className="gstrip">
          {G.tokens.map((s, i) => {
            const gv = G.v[i]
            return (
              <span
                key={i}
                className={i === tok ? 'gt sel' : 'gt'}
                title={`门值 ${gv.toFixed(3)}`}
                style={{ background: mix(gv), color: gv > 0.62 ? '#fff' : '#1A1A18' }}
                onMouseEnter={() => setGTok(i)}
                onClick={() => setGTok(i)}
              >
                <TokText s={s} />
              </span>
            )
          })}
        </div>
        <div className="legend"><span>门值 0 <span className="grad" /> 1</span><span>黑框 = 选中的 token</span></div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ fontSize: 15 }}><TokText s={G.tokens[tok]} /></div><div className="drl">选中的 token</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{v[tok].toFixed(3)}</div><div className="drl">门值 α</div></div>
          <div className="dr"><div className="drv">{avg(v).toFixed(3)}</div><div className="drl">这一段的平均门值</div></div>
          <div className="dr"><div className="drv">{lo} / {v.length}</div><div className="drl">门值 {'<'} 0.1 的位置</div></div>
          <div className="dr"><div className="drv">{hi} / {v.length}</div><div className="drl">门值 &gt; 0.9 的位置</div></div>
        </div>
      </div>
      <div className="note">
        {gSel === 0 ? (
          <>262144 行:门值多数落在中间,平均 <b>{avg(v).toFixed(2)}</b>;同一个 token 在不同位置开合不同,比如两处 " rapid transit" 里的 " transit" 分别是 {v[17].toFixed(2)} 和 {v[36].toFixed(2)}。</>
        ) : gSel === 1 ? (
          <>16384 行:门值两极分化,<b>{lo}</b> 个位置 {'<'} 0.1、<b>{hi}</b> 个 &gt; 0.9。这组表的 2-gram 撞行 85%。</>
        ) : gSel === 2 ? (
          <>只查 2-gram:表参数和 262144 行那组一样多,4 个头每行 32 维,平均门值 <b>{avg(v).toFixed(2)}</b>。</>
        ) : (
          <>字符级 32768 行:64 个位置里 <b>{v.filter((x) => x >= 0.999).length}</b> 个门值 ≥ 0.999,只有一个位置接近 0。模型几乎在每个位置都全量使用表里的内容。</>
        )}
      </div>
      <div className="codepath">↳ 代码:<b>13_engram.py</b> 的 <code>NgramMemory.forward</code>(<code>gate = sigmoid(...)</code>)· <code>Model.forward</code>(<code>i == inject_layer</code> 时加一次)</div>
      <Dig title="门的公式和 Engram 原文一样吗?注入在哪一层?">
        <>门的形式一样。Engram §2.3 原句:"we utilize the current hidden state h_t … as a dynamic Query, while the retrieved memory e_t serves as the source for both Key and Value projections", 式 (3)(4) 为 <code>α_t = σ(RMSNorm(h_t)ᵀ RMSNorm(k_t)/√d)</code>,α_t 是标量。之后 Engram 接 kernel 4、dilation 3 的因果 Conv1D;本项目 kernel 4、不加 dilation。<br /><br />注入位置按各自原文写:<br />· 本项目 <code>13_engram.py</code>:<code>inject_layer = 1</code>,注释"0 起数;1 = 第 2 层",即第 2 个 Block 之前。<br />· Engram-27B:原文 "we instantiate the module at layers 2 and 15";单层消融中 Layer 2 最好。<br />· Qwen3.8-Flash-Next:技术报告写只有一层,放在 Layer 2(Fig.1 与 §2.3.1);config.json 为 <code>ple_layer_ids: [2]</code>,<code>ple_conv_kernel_size: 4</code>。</>
      </Dig>
      <Dig title="16384 行那组的门,为什么大多贴着 0 或 1?">
        <>先看数:这 64 个位置里,16384 行那组门值 {'<'} 0.1 的有 25 个、&gt; 0.9 的有 15 个;262144 行那组分别是 1 个和 7 个,多数落在中间。 一种解释:16384 行时 2-gram 撞行 85%,取回的向量常常混着别的 n-gram,对不少位置没有用处,门就把它关到接近 0;262144 行时撞行降到 18%,取回的内容更可信,门开得更均匀。 这只是一段 64 个 token 的观察,没有在更多文本上统计,当作参考。</>
      </Dig>
      <Dig title="字符级那组的门几乎全开,说明什么?">
        <>tiny shakespeare 32768 行那组,64 个位置里 63 个门值 ≥ 0.999。字符级数据只有 1,101 种 2-gram、7,425 种 3-gram(训练集前 20 万字符), 表每个头 32768 行,2-gram 撞行只有 1% 到 2%,几乎每个 n-gram 独占一行;训练 5000 步把 100 万字符的训练集看了约 20 遍,表里存的是训练集上的统计。 门在 val 文本上也全开,模型对表的依赖很重,而第 4 步会看到这组 val loss 比不挂表高 0.12。</>
      </Dig>
      <div className="next-hint">↳ 下一步:机制齐了。真训一遍,val loss 能降多少?</div>
    </div>
  )
}

function Step4() {
  const [ds, setDs] = useState(0)
  const [runSel, setRunSel] = useState('fw262k')
  const D = DS[ds]
  const run = D.runs.find((x) => x.id === runSel) ?? D.runs[0]
  const base = D.runs[0]
  const f = fin(run)
  const fb = fin(base)
  const d = f[2] - fb[2]
  const last = run.curve.slice(-5)
  const lastB = base.curve.slice(-5)
  const md = avg(last.map((p, i) => p[2] - lastB[i][2]))
  const vmin = run.curve.reduce((a, p) => (p[2] < a[2] ? p : a))
  return (
    <div className={styles.scope}>
      <h2>④ 真实对照:FineWeb 主实验与字符级反例</h2>
      <p className="lead">两套数据各训 5000 步,batch 64 × 64 = 4096 个位置一步。<b>FineWeb-Edu</b>:GPT-2 BPE,训练段约 9500 万 token,5000 步随机抽到约 2050 万 token,多数文本只见一次。 <b>tiny shakespeare</b>:字符级,训练集约 100 万字符,5000 步相当于把训练集看约 20 遍。 上图是最终 loss 随表大小的变化,下图是 val loss 曲线;点上图的点选一组:</p>
      <div className="btn-row">
        <Btn on={ds === 0} onClick={() => { setDs(0); setRunSel(DS[0].def) }}>FineWeb-Edu(主实验)</Btn>
        <Btn on={ds === 1} onClick={() => { setDs(1); setRunSel(DS[1].def) }}>tiny shakespeare(反例)</Btn>
      </div>
      <div className="lab">
        <div className="scroll-x"><div style={{ minWidth: 560 }}><FinalSvg ds={ds} runSel={run.id} onPick={setRunSel} /></div></div>
        <div className="legend">
          <span><i style={{ background: 'var(--accent)' }} />val loss(2+3-gram)</span>
          <span><i style={{ background: '#fff', border: '1.5px dashed #6B6B68' }} />train loss(2+3-gram)</span>
          <span><i style={{ background: 'var(--e1)', transform: 'rotate(45deg)' }} />只查 2-gram(实心 val · 空心 train)</span>
        </div>
        <div className="scroll-x"><div style={{ minWidth: 560 }}><CurveSvg ds={ds} runSel={run.id} onPick={setRunSel} /></div></div>
        <div className="hp-note">下图:val loss 训练曲线(从第 {D.from} 步起),每 500 步评估一次;粗线 = 选中的一组,虚线 = 它的 train loss。颜色:{D.runs.map((r, i) => <span key={r.id}>{i > 0 ? ' · ' : null}<span style={{ color: r.col, fontWeight: 700 }}>{r.label}</span></span>)}</div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ fontSize: 14 }}>{run.label}</div><div className="drl">选中的一组</div></div>
          <div className="dr"><div className="drv" style={{ color: '#b8512f' }}>{run.table ? `${fmtP(run.tableP)} / ${fmtP(run.bb)}(${(run.tableP / run.bb).toFixed(2)}×)` : `0 / ${fmtP(run.bb)}`}</div><div className="drl">表参数 / 主干参数</div></div>
          <div className="dr"><div className="drv">{f[1].toFixed(4)} / {f[2].toFixed(4)}</div><div className="drl">最终 train / val</div></div>
          <div className="dr"><div className="drv" style={{ color: !run.table ? 'var(--ink2)' : d > 0 ? 'var(--bad)' : 'var(--good)' }}>{run.table ? `${d > 0 ? '+' : ''}${d.toFixed(4)}` : '基准'}</div><div className="drl">val 比不挂表</div></div>
          <div className="dr"><div className="drv">{run.table ? `${md > 0 ? '+' : ''}${md.toFixed(4)}` : '基准'}</div><div className="drl">后 5 个评估点 val 平均比不挂表</div></div>
          <div className="dr"><div className="drv">{run.coll2 == null ? '–' : `${(100 * run.coll2).toFixed(1)}%`}</div><div className="drl">2-gram 撞行</div></div>
        </div>
      </div>
      <div className="note">
        {ds === 0 ? (
          <>FineWeb:表从 0 → 16384 行,val 降 <b>0.013</b>(单种子,接近噪声量级);→ 262144 行,降 <b>0.062</b>。只查 2-gram 与 2+3-gram 差 0.005,这个规模上分不出高下。5000 步时 loss 还在 5.0 附近往下走,是小规模、训练早期的对照。</>
        ) : (
          <>shakespeare:表越大,train 越低、val 越高。不挂表 val <b>1.5334</b>;32768 行 train 降到 <b>1.0813</b>,val 涨到 <b>1.6536</b>。选中这组的 val 最低点在第 {vmin[0]} 步({vmin[2].toFixed(4)})。</>
        )}
      </div>
      <div className="note">记忆表要配<b>数据量远大于表参数</b>、不反复看同一批文本的训练才划算;数据少到被来回看很多遍时,表会把训练集背下来。</div>
      <div className="codepath">↳ 跑法:<code>python 13_engram.py --table 262144 --json runs/ch15_fw_262144.json</code> · <code>--orders 2</code> 只查 2-gram · <code>--data shakespeare</code> 换字符级</div>
      <Dig title="FineWeb 上降 0.013 和 0.06,这两个数能信几分?">
        <>每组只训了一次(同一个随机种子 1337),评估时 train / val 各取 50 个 batch。<br />· 0 → 16384 行,最终 val 降 <b>0.013</b>,接近噪声量级;看后 5 个评估点(3000 到 4999 步),每点降 0.013 到 0.038,平均 0.026,点与点之间的起伏和差值本身差不多大。<br />· 0 → 262144 行,最终降 <b>0.062</b>;后 5 个评估点每点降 0.036 到 0.066,平均 0.053,方向在这 2000 步里一直保持。<br />· 只查 2-gram(4.9898)和 2+3-gram(4.9945)差 <b>0.005</b>。后 5 个评估点里只查 2-gram 那组每点低 0.005 到 0.007,但这些点出自同一次训练,不是独立的重复,换个种子可能翻过来。 另外两组表参数一样多:只查 2-gram 时是 4 个头 × 每行 32 维,2-gram 分到的维数翻了一倍。这个规模上的结果不能用来说明 3-gram 没用。<br /><br />要把 0.01 量级的差距说实,需要多个种子取均值和误差条。本页没有做。</>
      </Dig>
      <Dig title="5000 步、loss 5.0,这个差距放到训练完的模型上还成立吗?">
        <>不知道。FineWeb 这几组在 5000 步时 loss 还在 5.0 左右往下走(第 6 章的 124M 训完是 3 左右),属于训练早期;这是一组小规模对照,只能说明在这个步数、这个规模上表带来的变化,不代表收敛后的差距。 表越大、每行被更新的次数越少,早期和后期的差距可能变大也可能变小,需要更长的训练才能回答。</>
      </Dig>
      <Dig title="字符级那组为什么表越大 val 越差?">
        <>典型的 <Term k="overfitting" name="过拟合 · overfitting" def="模型在训练集上的 loss 继续下降,在没见过的数据上的 loss 却上升:参数记住了训练集的具体内容,而没有学到能推广的规律。">过拟合</Term>。 训练集约 100 万字符,32768 行的表有 <b>4,194,304</b> 个参数,是主干 776,385 的 5.4 倍,也比训练集的字符数多;5000 步里每个字符平均被看约 20 遍。 字符级 n-gram 种类少(前 20 万字符里 2-gram 1,101 种),每个 n-gram 几乎独占一行,表可以把训练集里每个短语后面接什么直接存下来。<br /><br />看曲线:32768 行那组 val 在 2500 步到最低 1.5657,之后一路涨到 1.6536,train 同期从 1.212 降到 1.0813。不挂表那组 val 一直在降,最终 1.5334。 前 1000 步表是有用的:1000 步时 32768 行那组 val 1.5925,不挂表 1.654。</>
      </Dig>
      <Dig title="FineWeb 那组看过的 token 比表参数还少,为什么没有背下来?">
        <>5000 步抽到约 2050 万 token,262144 行的表有 3355 万参数,单看数量,看过的 token 少于表参数。差别在重复次数:FineWeb 训练段有 9500 万 token,随机抽窗口时同一段文本很少被抽中两次, 表的每一行每次更新面对的多是新文本;shakespeare 的每个字符被看了约 20 遍。<br /><br />FineWeb 这组也有一个值得盯的数:262144 行时最终 train 4.9604、val 4.9945,train 比 val 低 0.034;不挂表时 train 5.0752、val 5.0561,train 反而比 val 高 0.019。 单次评估有噪声,不据此下结论;训练更久、数据被反复看时,要留意 train 与 val 的差距。</>
      </Dig>
      <div className="next-hint">↳ 下一步:262144 行的表已经是主干的 4.6 倍,放大到几百亿参数时显存装不下。这张表放哪?</div>
    </div>
  )
}

function flowCap(mode: (typeof DEV)[number]['key']) {
  if (mode === 'none') return '不挂表:第 12 章四件套小模型,所有参数和计算都在 GPU 上。'
  if (mode === 'same') return '表在 GPU:行号在 CPU 上随 batch 算好,只传行号;查表、表的梯度和更新都在 GPU。'
  return '表在 CPU:查表在 CPU 上做,只把取出的 128 个数 / token 送进 GPU;反向时表的梯度回到 CPU,表的 AdamW 更新也在 CPU 上算。'
}

function Step5() {
  const [devSel, setDevSel] = useState(1)
  const mode = DEV[devSel].key
  const v = SPEED[mode]
  const rel = v / SPEED.same - 1
  const mx = Math.max(SPEED.none, SPEED.same, SPEED.cpu)
  const slow = (100 * (1 - SPEED.same / SPEED.none)).toFixed(1)
  const cpuSlow = (100 * (1 - SPEED.cpu / SPEED.same)).toFixed(1)
  const fw0 = fin(FW_RUNS[0])
  const fw16 = fin(FW_RUNS[1])
  const fw262 = fin(FW_RUNS[2])
  const fw2 = fin(FW_RUNS[3])
  const s0 = fin(SHK_RUNS[0])
  const s32 = fin(SHK_RUNS[3])
  return (
    <div className={styles.scope}>
      <h2>⑤ 表可以不进 GPU</h2>
      <p className="lead">行号只取决于输入的 token id,<code>get_batch</code> 取数据时就在 CPU 上算好了,forward 还没开始就知道每个 token 要读哪 8 行。 所以表可以留在主机内存里,只把取出来的 8 × 16 个数送进 GPU,这叫 <Term k="host-offload" name="主机内存放表 · host offload + prefetch" def="把大参数表留在 CPU 内存(或更慢的存储)里,只把本步要用的行取出来送进加速器。n-gram 表的行号只依赖输入 token,可以在 forward 之前算好并提前异步取出。">把表放主机内存、提前取行</Term>。 选一种放法,看数据怎么走,以及单卡 RTX 4090 上 400 步训练的实测吞吐(STEP 4 的 loss 对照在 Mac 上跑,吞吐单独在 4090 上测):</p>
      <div className="btn-row">
        {DEV.map((d, i) => <Btn key={d.key} on={i === devSel} onClick={() => setDevSel(i)}>{d.name}</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x"><div style={{ minWidth: 620 }}><FlowSvg mode={mode} /></div></div>
        <div className="flow-cap">{flowCap(mode)}</div>
        <div style={{ marginTop: 10 }}>
          {DEV.map((d, i) => {
            const spd = SPEED[d.key]
            return (
              <div key={d.key} className={i === devSel ? 'lbar sel' : 'lbar'}>
                <div className="ln">{d.name}</div>
                <div className="lt"><div className="lf" style={{ width: `${(100 * spd / mx).toFixed(1)}%`, background: i === devSel ? '#D97757' : '#B9B5AA' }} /></div>
                <div className="lv">{en(spd)}</div>
              </div>
            )
          })}
          <div className="hp-note">token / 秒 · 单卡 RTX 4090 · 各 400 步测一次 · 挂表的两组都是 32768 行(4,194,304 参数)</div>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{en(v)}</div><div className="drl">token / 秒(400 步)</div></div>
          <div className="dr"><div className="drv">{mode === 'same' ? '基准' : `${rel > 0 ? '+' : ''}${(100 * rel).toFixed(1)}%`}</div><div className="drl">比表在 GPU</div></div>
          <div className="dr"><div className="drv">{mode === 'same' ? en(SPEED_TABLE_P) : '0'}</div><div className="drl">留在加速器上的表参数</div></div>
        </div>
      </div>
      <div className="note">
        {mode === 'none' ? (
          <>不挂表 <b>{en(SPEED.none)}</b> token/s,表在 GPU 时 <b>{en(SPEED.same)}</b>,低 {slow}%,单次测量。</>
        ) : mode === 'same' ? (
          <>表在 GPU:<b>{en(SPEED.same)}</b> token/s。每 token 只读 8 行,挂上 4.19M 参数的表以后吞吐比不挂表低 {slow}%。</>
        ) : (
          <>表在 CPU:<b>{en(SPEED.cpu)}</b> token/s,比表在 GPU 慢 <b>{cpuSlow}%</b>,换来显存里不放这 4.19M 个表参数。</>
        )}
      </div>
      <div className="sub-h"><span className="badge">真实</span>工业版把表放在哪</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div><b>Qwen3.8-Flash-Next</b>:125B 总参、6B 激活,另有 51B n-gram 表参数。技术报告摘要原句 "additional 51B parameters of n-gram embedding tables held off the accelerator";§2.3:表放主机内存,异步预取。</div></li>
        <li><span className="ck">✓</span><div><b>Engram</b>(<b>arXiv 2601.07372</b> §3.1):固定稀疏参数预算时,原句 "reallocating roughly 20%–25% of the sparse parameter budget to Engram yields the best performance",loss 随分配比例呈 U 形。</div></li>
        <li><span className="ck">✓</span><div><b>Qwen3.8 报告 Tab.8</b>:固定总参数,loss 在 n-gram 占 25% 参数时最低,与 Engram 的结论一致;下游指标看不出改善。</div></li>
      </ul>
      <div className="codepath">↳ 代码:<b>13_engram.py</b> 的 <code>run</code>(先在表所在设备上 <code>lookup</code>,再 <code>.to(device)</code>)· <code>get_batch</code> 里的 <code>ngram_rows(x)</code> · 吞吐:<code>--max-iters 400 --eval-iters 1 --table-device cpu</code></div>
      <Dig title="表放 CPU 为什么慢了 43%?">
        <>RTX 4090 的显存和主机内存之间隔着 PCIe。表在 CPU 时,查表、反向时把梯度写回表的那些行、AdamW 更新 4,194,304 个表参数都改在 CPU 上算, 每步还要把取出的行拷进显存、把表的梯度拷回主机。实测 148,229 token/s,表在 GPU 时 262,066,慢 43.4%。 这里主干只有 7.24M 参数,GPU 算一步很快,CPU 上的表更新和两次拷贝占的比例就大;主干越大,这部分开销占比越小(推断,本项目没有测更大的主干)。<br /><br />三组各测一次,每组 400 步;表在 GPU 比不挂表(276,231)低 5.1%,是查表、门控和短卷积的开销。 测量用的是 32768 行的表(4.19M 参数),不是主实验的 262144 行。脚本里查表和拷贝跟着 forward 同步进行;Qwen3.8 报告写的是异步预取,取行和拷贝与上一步的 GPU 计算并行。</>
      </Dig>
      <Dig title={'"提前取"具体提前在哪?'}>
        <>训练时,下一个 batch 的 token 在读数据时就定了,行号可以和数据加载一起算,取行、拷贝可以和上一步的 GPU 计算并行。 推理时,新 token 一采样出来,它结尾的 2-gram、3-gram 就确定了,不用等下一层的计算结果。 MoE 做不到这一点:选哪个专家要看路由器对当前隐状态的打分,得算到那一层才知道。 <code>13_engram.py</code> 只做了最简单的同步版本:<code>run</code> 里先查表,再 <code>.to(device)</code>,没有实现异步预取。</>
      </Dig>
      <Dig title="Gemma 3n 的 PLE 也放 CPU,它是 n-gram 表吗?">
        <>两者的键不同。 <Term k="ple" name="PLE · Per-Layer Embeddings" def="Gemma 3n 的逐层嵌入:按单个 token id 给每一层查一段向量,门控后乘入该层。表可以放在 CPU 上,加速器只放主体参数。">PLE</Term>(Per-Layer Embeddings) 在 HF transformers 的 <code>modeling_gemma3n.py</code> 里用 <code>embed_tokens_per_layer(input_ids)</code> 按<b>单个 token id</b> 查表(vocab_size_per_layer_input 262144,每层 256 维),在每层经门控乘入。 官方说明:"PLE allows a significant portion of these parameters (the embeddings associated with each layer) to be loaded and computed efficiently on the CPU",E2B / E4B 总参 5B / 8B,加速器上约 2B / 4B。<br /><br />两者都是地址确定、可以放主机内存的稀疏表,差在键:PLE 用单个 token,n-gram 表用最近几个 token。 Qwen3.8 报告 §2.3 把 Gemma 3n 归为 embedding-based memory,原句 "N-gram embeddings further generalize unigram lookup by conditioning memory retrieval on local context rather than token identity alone"。</>
      </Dig>
      <Dig title="n-gram 表和 MoE 是什么关系?">
        <>两者都让总参数远大于每 token 的计算量,取参数的方式不同。 <Term k="moe" name="MoE · 混合专家" def="把 FFN 拆成多个专家,路由器按隐状态为每个 token 选 top-k 个专家计算。总参数变多,每 token 算力不变。">MoE</Term> 由路由器看当前隐状态打分,选出几个专家,再让 token 过这几个专家的矩阵乘,选谁要算到那一层才知道; n-gram 表按输入 token 的字面地址直接取向量,取出来只做一次门控和投影。<br /><br />DeepSeek-V4 前 3 个 MoE 层用 Hash routing,按 token 哈希选专家,token 仍然要过专家做计算,和 n-gram 查表是两回事;V4 报告全文里也没有 Engram。 Engram 论文把查表记忆和 MoE 并列为两种稀疏方式,在同一个总参数预算里分配(第 1 步的 Engram-27B 对 MoE-27B)。</>
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>FineWeb-Edu:不挂表 val <b>{fw0[2].toFixed(4)}</b>;16384 行 <b>{fw16[2].toFixed(4)}</b>(−{(fw0[2] - fw16[2]).toFixed(3)});262144 行 <b>{fw262[2].toFixed(4)}</b>(−{(fw0[2] - fw262[2]).toFixed(3)}),表 33,554,432 参数,是主干的 4.63 倍。</div></li>
        <li><span className="ck">✓</span><div>只查 2-gram(262144 行)val <b>{fw2[2].toFixed(4)}</b>,与 2+3-gram 差 {(fw262[2] - fw2[2]).toFixed(4)},噪声量级。</div></li>
        <li><span className="ck">✓</span><div>2-gram 撞行:16384 行 <b>85.3%</b>,32768 行 71.5%,262144 行 <b>18.4%</b>。</div></li>
        <li><span className="ck">✓</span><div>tiny shakespeare 字符级:不挂表 val {s0[2].toFixed(4)};32768 行 train <b>{s32[1].toFixed(4)}</b>、val <b>{s32[2].toFixed(4)}</b>,表把训练集背了下来。</div></li>
        <li><span className="ck">✓</span><div>吞吐(32768 行,400 步):不挂表 {en(SPEED.none)} · 表在 GPU {en(SPEED.same)} · 表在 CPU <b>{en(SPEED.cpu)}</b> token/s。</div></li>
      </ul>
    </div>
  )
}

export function NgramMemory() {
  const chapter = findChapter('ngram-memory')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="ngram-memory"
      title="N-gram 查表:给模型挂一本短语词典"
      subtitle={<>第 11 章的 MoE 让总参数变多、每个 token 的算力不变。这一关换一种做法:在第 12 章那台小模型旁边挂一张大表, 每个 token 只按<b>最近两三个 token</b> 算出 8 个行号,从表里取 8 行拼成一根向量,再由一个门决定加多少进残差流。 这种结构叫 <Term k="ngram-memory" name="N-gram 查表记忆 · n-gram memory" def="一张按局部 n-gram 哈希寻址的参数表。每个 token 用以它结尾的 2-gram / 3-gram 算出几个行号,取出这几行拼成记忆向量,经门控后加回残差流。表多大,每 token 都只读固定几行。">N-gram 查表记忆</Term> (DeepSeek 的 Engram、Qwen3.8 的 N-gram Embedding)。配套代码 <code>phase4-efficiency/13_engram.py</code>, 在 Mac(MPS)上跑了 <Term k="fineweb" name="FineWeb-Edu" def="HuggingFace 发布的教育类网页语料,第 6 章训练 124M 用的就是它。">FineWeb-Edu</Term> 四组、tiny shakespeare 五组对照,外加三组吞吐测量。</>}
      hp={(
        <HpBar label="这一关">
          <HpChip color="#3f7d63" bg="#E4EFE9">数据 <b>FineWeb-Edu</b> <i>GPT-2 BPE token</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">表 <b>262144</b> <i>行 / 每个哈希头</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">哈希头 <b>8</b> <i>2-gram 4 + 3-gram 4</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">每行 <b>16</b> <i>维</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECEAE2">注入 <b>第 2 个 Block 前</b> <i>inject_layer = 1</i></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>128</b> <i>残差流宽度</i></HpChip>
          <span className="hp-note">8 个头 × 每行 16 维 = 128,拼起来正好等于 n_embd;262144 是每个头的行数,8 张表合计 33.6M 参数</span>
        </HpBar>
      )}
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={(
        <>
          <div className="ct">🎉 N-gram 查表 · 通关</div>
          <div className="cs">你给第 12 章的小模型挂上了一张 3355 万参数的 n-gram 表:每个 token 只读 8 行,行号在 forward 之前就能算出,表可以留在主机内存。FineWeb 上 val loss 降了约 0.06,字符级数据上也看到了表把训练集背下来的样子。下一章讲投机解码与 MTP。</div>
        </>
      )}
    />
  )
}
