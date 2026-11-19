// 旧页切换步骤不重置滑块、格式和选中行。
import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import { HIST, MAT_N, N_ALL, N_EMB, N_Q, OUT, PER_LAYER, ROW_EX, ROWS } from './quantizationData'
import styles from './Quantization.module.css'

const BITS = [2, 3, 4, 8]
const E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6]
const KINDS = ['attn.c_attn', 'attn.c_proj', 'mlp.c_fc', 'mlp.c_proj']
const KCOL = ['#3a63c0', '#a3548c', '#3f7d63', '#b8512f']
const A_LO = 0.005
const A_HI = OUT.absmax
const CW = 12
const SH = ['#E9A184', '#F2C8B6']
const MONO = 'ui-monospace, SF Mono, Menlo, Consolas, monospace'

const BY_NAME = Object.fromEntries(ROWS.map((r) => [r.name, r]))

function row(name: string) {
  const found = BY_NAME[name]
  if (!found) throw new Error(name)
  return found
}

const LAYERS = PER_LAYER.map((p) => {
  const m = /^h\.(\d+)\.(.+)\.weight$/.exec(p.key)
  if (!m) throw new Error(p.key)
  return { key: p.key, layer: Number(m[1]), kind: KINDS.indexOf(m[2]), r: p.absmax_over_std }
})

const E4M3 = (() => {
  const v: number[] = []
  for (let m = 0; m < 8; m++) v.push((m / 8) * 2 ** -6)
  for (let e = 1; e < 16; e++) {
    for (let m = 0; m < 8; m++) {
      if (e === 15 && m === 7) continue
      v.push((1 + m / 8) * 2 ** (e - 7))
    }
  }
  return [...new Set(v)].sort((a, b) => a - b)
})()

type ScopeKey = 'int4_tensor' | 'int4_row' | 'int4_g32' | 'nvfp4'
const SCOPES: { key: ScopeKey; per: number; bpw: string }[] = [
  { key: 'int4_tensor', per: MAT_N, bpw: '4.000' },
  { key: 'int4_row', per: 768, bpw: '4.021' },
  { key: 'int4_g32', per: 32, bpw: '4.5' },
  { key: 'nvfp4', per: 16, bpw: '4.5' },
]

const OUTC = ['fp32', 'int4_tensor', 'int4_tensor_outlier', 'int4_row']
const OUTN = ['fp32 原始', 'int4 整矩阵 1 个 scale', '+ 留 0.1% 离群值', 'int4 每行 1 个']

const TALLY: Record<string, [string, string, number][]> = {
  q4_k: [['权重码', '256 × 4', 1024], ['子块 scale + min', '8 × (6 + 6)', 96], ['超块 d + dmin', '2 × 16', 32]],
  nvfp4: [['权重码', '256 × 4', 1024], ['块 scale(E4M3)', '16 × 8', 128]],
  mxfp4: [['权重码', '256 × 4', 1024], ['块 scale(E8M0)', '8 × 8', 64]],
}
const LEGEND: Record<string, [string, string][]> = {
  q4_k: [['#D97757', '4 位权重码'], ['#3a63c0', '6 位子块 scale'], ['#3f7d63', '6 位子块 min'], ['#1A1A18', 'FP16 超块 d / dmin']],
  nvfp4: [['#D97757', '4 位权重码'], ['#a3548c', '8 位 E4M3 块 scale']],
  mxfp4: [['#D97757', '4 位权重码'], ['#a87b1f', '8 位 E8M0 块 scale']],
}
const FMT_KEYS = ['q4_k', 'nvfp4', 'mxfp4'] as const

function en(v: number) {
  return v.toLocaleString('en-US')
}

function roundGrid(x: number, grid: readonly number[]) {
  let best = grid[0] ?? 0
  for (const g of grid) {
    if (Math.abs(Math.abs(x) - g) < Math.abs(Math.abs(x) - best)) best = g
  }
  return best * Math.sign(x || 1)
}

function zeroFrac(lim: number) {
  const n = HIST.counts.length
  const bw = (2 * HIST.range) / n
  let acc = 0
  HIST.counts.forEach((c, i) => {
    const lo = -HIST.range + i * bw
    const hi = lo + bw
    const ov = Math.max(0, Math.min(hi, lim) - Math.max(lo, -lim))
    acc += (c * ov) / bw
  })
  return acc / MAT_N
}

function pctZero(zf: number) {
  return zf > 0.99 ? (100 * zf).toFixed(2) : (100 * zf).toFixed(1)
}

function perWeight(tot: number) {
  return (tot / 256).toFixed(tot % 256 ? 3 : 1).replace(/0+$/, '').replace(/\.$/, '')
}

function scaleAt(slider: number) {
  const a = A_LO * (A_HI / A_LO) ** (slider / 100)
  const t = OUT.absmax / (6 * 448)
  const bN = roundGrid(a / 6 / t, E4M3) * t
  const rN = a / bN
  const sM = 2 ** (Math.floor(Math.log2(a)) - 2)
  const rM = a / sM
  return { a, bN, rN, sM, rM }
}

function WithBreaks({ text }: { text: string }) {
  if (!text.includes('\n')) return <>{text}</>
  const parts = text.split('\n')
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="nl">⏎</span> : null}
          {i > 0 ? ' ' : null}
          {part}
        </Fragment>
      ))}
    </>
  )
}

function SampleView({ txt, base }: { txt: string; base: string | null }) {
  const a = txt.split(/(\s+)/)
  const b = (base ?? '').split(/(\s+)/)
  let k = 0
  if (base !== null) {
    while (k < a.length && k < b.length && a[k] === b[k]) k += 1
  }
  const same = a.slice(0, k).join('')
  const diff = a.slice(k).join('')
  return (
    <div className="sample">
      <span className="pr">The history of ancient Rome</span>
      <WithBreaks text={same} />
      {diff ? <mark><WithBreaks text={diff} /></mark> : null}
    </div>
  )
}

function Btn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={on ? 'btn primary' : 'btn'} onClick={onClick}>{children}</button>
}

function HistChart({ bits, log }: { bits: number; log: boolean }) {
  const qmax = 2 ** (bits - 1) - 1
  const s = OUT.absmax / qmax
  const sd = OUT.std
  const W = 860
  const H = 250
  const L = 48
  const R = 16
  const T = 18
  const B = 34
  const XR = 0.36
  const X = (v: number) => L + ((v + XR) / (2 * XR)) * (W - L - R)
  const n = HIST.counts.length
  const bw = (2 * HIST.range) / n
  const maxC = Math.max(...HIST.counts)
  const Y = (c: number) => (log
    ? (H - B) - (Math.log10(c + 1) / Math.log10(maxC + 1)) * (H - B - T)
    : (H - B) - (c / maxC) * (H - B - T))
  const ticks = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]
  const levels: number[] = []
  for (let k = -qmax; k <= qmax; k++) {
    const v = k * s
    if (Math.abs(v) <= XR) levels.push(v)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="权重直方图与量化格点">
      <rect x={X(-3 * sd)} y={T} width={X(3 * sd) - X(-3 * sd)} height={H - B - T} fill="#D7EBE0" opacity={0.6} />
      {HIST.counts.map((c, i) => {
        if (c === 0) return null
        const x0 = X(-HIST.range + i * bw)
        const x1 = X(-HIST.range + (i + 1) * bw)
        const y = Y(c)
        return <rect key={i} x={x0} y={y} width={x1 - x0 - 0.6} height={Math.max(0.8, H - B - y)} fill="#8FA7D9" />
      })}
      {levels.map((v) => (
        <line key={v} x1={X(v)} y1={T - 4} x2={X(v)} y2={H - B} stroke="#D97757" strokeWidth={bits === 8 ? 0.7 : 1.8} opacity={bits === 8 ? 0.55 : 0.9} />
      ))}
      {[-1, 1].map((sg) => (
        <line key={sg} x1={X(sg * OUT.absmax)} y1={T} x2={X(sg * OUT.absmax)} y2={H - B} stroke="#9a3a22" strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      <text x={X(OUT.absmax) - 4} y={T + 10} textAnchor="end" fontSize={11} fontFamily={MONO} fill="#9a3a22">|w| 最大 {OUT.absmax.toFixed(4)} = {OUT.absmax_over_std}σ</text>
      <text x={X(0)} y={T + 10} textAnchor="middle" fontSize={11} fontFamily={MONO} fill="#3f7d63">±3σ:{(100 * (1 - OUT.frac_over_3std)).toFixed(2)}% 的权重</text>
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="#6B6B68" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={X(v)} y1={H - B} x2={X(v)} y2={H - B + 4} stroke="#6B6B68" />
          <text x={X(v)} y={H - B + 17} textAnchor="middle" fontSize={11} fontFamily={MONO} fill="#6B6B68">{v.toFixed(1)}</text>
        </g>
      ))}
      <text x={L - 6} y={T + 4} textAnchor="end" fontSize={10} fontFamily={MONO} fill="#6B6B68">{log ? '对数' : en(maxC)}</text>
      <text x={W - R} y={H - 3} textAnchor="end" fontSize={10.5} fill="#6B6B68">权重值</text>
    </svg>
  )
}

function RowChart({ scope }: { scope: ScopeKey }) {
  const orig = ROW_EX.orig
  const q = ROW_EX[scope]
  const W = 860
  const H = 250
  const L = 52
  const R = 14
  const T = 14
  const B = 26
  const YR = 0.065
  const X = (i: number) => L + ((i + 0.5) / 32) * (W - L - R)
  const Y = (v: number) => T + ((YR - v) / (2 * YR)) * (H - T - B)
  const levels = [...new Set(q.map((v) => Math.abs(v)))].flatMap((v) => (v === 0 ? [0] : [v, -v]))
  const yTicks = [-0.06, -0.03, 0, 0.03, 0.06]
  const xTicks = [0, 8, 16, 24, 31]
  const xb = (X(15) + X(16)) / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="32 个权重的原值与量化值">
      {levels.map((v, i) => (
        <line key={`lv${i}`} x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="#E9E5DA" strokeWidth={1.4} />
      ))}
      <line x1={L} y1={Y(0)} x2={W - R} y2={Y(0)} stroke="#B9B5AA" />
      {yTicks.map((v) => (
        <text key={v} x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={10.5} fontFamily={MONO} fill="#6B6B68">{v.toFixed(2)}</text>
      ))}
      {scope === 'nvfp4' ? (
        <>
          <line x1={xb} y1={T} x2={xb} y2={H - B} stroke="#a3548c" strokeDasharray="5 4" />
          <text x={xb + 5} y={T + 10} fontSize={10.5} fill="#a3548c">块边界(每 16 个一个 scale)</text>
        </>
      ) : null}
      {orig.map((o, i) => {
        const v = q[i]
        const x = X(i)
        return (
          <g key={i}>
            <line x1={x} y1={Y(o)} x2={x} y2={Y(v)} stroke="#D97757" strokeWidth={1.6} opacity={0.55} />
            <circle cx={x} cy={Y(o)} r={5} fill="#fff" stroke="#6B6B68" strokeWidth={1.5} />
            <circle cx={x} cy={Y(v)} r={3.6} fill={v === 0 && o !== 0 ? '#9a3a22' : '#D97757'} />
          </g>
        )
      })}
      {xTicks.map((i) => (
        <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fontFamily={MONO} fill="#6B6B68">{i}</text>
      ))}
    </svg>
  )
}

function LayerChart({ kind, sel, onPick }: { kind: number; sel: number; onPick: (i: number) => void }) {
  const W = 860
  const H = 250
  const L = 40
  const R = 10
  const T = 16
  const B = 30
  const YM = 32
  const gw = (W - L - R) / 12
  const bwid = gw / 5.2
  const Y = (v: number) => (H - B) - (v / YM) * (H - B - T)
  const guides = [0, 10, 20, 30]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="48 个矩阵的最大绝对值与标准差之比">
      {guides.map((v) => (
        <g key={v}>
          <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke={v === 0 ? '#6B6B68' : '#EAE7DE'} />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={10.5} fontFamily={MONO} fill="#6B6B68">{v}σ</text>
        </g>
      ))}
      {LAYERS.map((l, i) => {
        const x = L + l.layer * gw + gw * 0.1 + l.kind * bwid * 1.05
        const y = Y(l.r)
        const dim = kind > 0 && l.kind !== kind - 1
        const on = i === sel
        return (
          <Fragment key={l.key}>
            <rect
              x={x}
              y={y}
              width={bwid}
              height={H - B - y}
              rx={2}
              fill={KCOL[l.kind]}
              opacity={dim ? 0.13 : on ? 1 : 0.78}
              stroke={on ? '#1A1A18' : 'none'}
              strokeWidth={1.6}
              style={{ cursor: 'pointer' }}
              onClick={() => onPick(i)}
            />
            {on ? <text x={x + bwid / 2} y={y - 5} textAnchor="middle" fontSize={10.5} fontWeight={700} fontFamily={MONO} fill="#1A1A18">{l.r}</text> : null}
          </Fragment>
        )
      })}
      {LAYERS.slice(0, 12).map((_, k) => (
        <text key={k} x={L + k * gw + gw / 2} y={H - 10} textAnchor="middle" fontSize={10.5} fontFamily={MONO} fill="#6B6B68">h.{k}</text>
      ))}
    </svg>
  )
}

function E2Chart({ x }: { x: number }) {
  const W = 860
  const H = 130
  const L = 24
  const R = 24
  const X = (v: number) => L + ((v + 6.5) / 13) * (W - L - R)
  const fp = roundGrid(x, E2M1)
  const ik = Math.max(-7, Math.min(7, Math.round(x / (6 / 7))))
  const rows: [number, string, string][] = [[38, 'E2M1', '#D97757'], [92, '均匀 int4', '#3a63c0']]
  const spots = E2M1.flatMap((v) => [v, -v])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="E2M1 与均匀 int4 格点">
      {rows.map(([y, t, c]) => (
        <g key={t}>
          <line x1={L} y1={y} x2={W - R} y2={y} stroke="#D9D5CA" />
          <text x={L} y={y - 16} fontSize={11} fontFamily={MONO} fill={c}>{t}</text>
        </g>
      ))}
      {spots.map((u, i) => (
        <circle key={i} cx={X(u)} cy={38} r={Math.abs(u - fp) < 1e-9 ? 7 : 4.5} fill="#D97757" opacity={Math.abs(u - fp) < 1e-9 ? 1 : 0.55} />
      ))}
      {E2M1.map((v) => (
        <text key={v} x={X(v)} y={60} textAnchor="middle" fontSize={10} fontFamily={MONO} fill="#6B6B68">{v}</text>
      ))}
      {Array.from({ length: 15 }, (_, i) => i - 7).map((k) => (
        <circle key={k} cx={X(k * 6 / 7)} cy={92} r={k === ik ? 7 : 4.5} fill="#3a63c0" opacity={k === ik ? 1 : 0.55} />
      ))}
      <line x1={X(x)} y1={18} x2={X(x)} y2={112} stroke="#1A1A18" strokeWidth={1.5} strokeDasharray="3 3" />
      <text x={X(x)} y={126} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily={MONO} fill="#1A1A18">x = {x.toFixed(2)}</text>
    </svg>
  )
}

function ScaleChart({ rN, rM }: { rN: number; rM: number }) {
  const W = 860
  const H = 150
  const L = 110
  const R = 24
  const X = (v: number) => L + (v / 8) * (W - L - R)
  const rows: [number, string, number, string][] = [[40, 'NVFP4', rN, '#a3548c'], [100, 'MXFP4', rM, '#a87b1f']]
  const axis = [0, 1, 2, 3, 4, 6, 8]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="块内最大值除以 scale 后落在 E2M1 刻度上的位置">
      {rows.map(([y, name, rv, c]) => {
        const clip = rv > 6
        return (
          <g key={name}>
            <rect x={X(6)} y={y - 14} width={X(8) - X(6)} height={28} fill="#F3D9CE" opacity={0.8} />
            <line x1={L} y1={y} x2={W - R} y2={y} stroke="#D9D5CA" />
            <text x={L - 12} y={y + 4} textAnchor="end" fontSize={12} fontWeight={700} fontFamily={MONO} fill={c}>{name}</text>
            {E2M1.map((v) => <circle key={v} cx={X(v)} cy={y} r={3.5} fill="#6B6B68" opacity={0.6} />)}
            <circle cx={X(Math.min(rv, 8))} cy={y} r={7} fill={clip ? '#9a3a22' : c} />
            <text x={X(Math.min(rv, 8))} y={y - 12} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily={MONO} fill={clip ? '#9a3a22' : c}>amax/scale = {rv.toFixed(2)}</text>
          </g>
        )
      })}
      {axis.map((v) => (
        <text key={v} x={X(v)} y={H - 12} textAnchor="middle" fontSize={10.5} fontFamily={MONO} fill="#6B6B68">{v}</text>
      ))}
      <text x={(X(6) + X(8)) / 2} y={H - 26} textAnchor="middle" fontSize={10.5} fill="#9a3a22">&gt; 6 截断</text>
    </svg>
  )
}

function Chip({ bits, col, txt }: { bits: number; col: string; txt: string }) {
  return <div className="chip" style={{ width: (bits / 4) * CW, background: col }} title={txt}>{txt}</div>
}

function Cells({ n, shade }: { n: number; shade: string }) {
  const boxes = []
  for (let i = 0; i < n; i++) boxes.push(<div key={i} className="cell" style={{ background: shade }} />)
  return <>{boxes}</>
}

function Layout({ fmt }: { fmt: string }) {
  const rows: ReactNode[] = []
  if (fmt === 'q4_k') {
    rows.push(
      <div key="super" className="lay-row">
        <div className="rl">超块</div>
        <Chip bits={16} col="#1A1A18" txt="d FP16" />
        <Chip bits={16} col="#1A1A18" txt="dmin FP16" />
      </div>,
    )
  }
  for (let r = 0; r < 8; r++) {
    rows.push(
      <div key={r} className="lay-row">
        <div className="rl">{r * 32}{'\u2013'}{r * 32 + 31}</div>
        {fmt === 'q4_k' ? (
          <>
            <Chip bits={6} col="#3a63c0" txt="s" />
            <Chip bits={6} col="#3f7d63" txt="m" />
            <Cells n={32} shade={SH[r % 2]} />
          </>
        ) : null}
        {fmt === 'nvfp4' ? (
          <>
            <Chip bits={8} col="#a3548c" txt="E4M3" />
            <Cells n={16} shade={SH[r % 2]} />
            <Chip bits={8} col="#a3548c" txt="E4M3" />
            <Cells n={16} shade={SH[(r + 1) % 2]} />
          </>
        ) : null}
        {fmt === 'mxfp4' ? (
          <>
            <Chip bits={8} col="#a87b1f" txt="E8M0" />
            <Cells n={32} shade={SH[r % 2]} />
          </>
        ) : null}
      </div>,
    )
  }
  if (fmt === 'nvfp4') {
    rows.push(
      <div key="tensor" className="lay-row">
        <div className="rl">张量</div>
        <Chip bits={32} col="#6B6B68" txt="FP32 张量 scale" />
        <span className="hp-note" style={{ marginLeft: 8 }}>整个矩阵只有 1 个</span>
      </div>,
    )
  }
  return <div className="lay">{rows}</div>
}

function Step1() {
  const [bitsIdx, setBitsIdx] = useState(2)
  const [log, setLog] = useState(false)
  const bits = BITS[bitsIdx]
  const qmax = 2 ** (bits - 1) - 1
  const s = OUT.absmax / qmax
  const levels = 2 * qmax + 1
  const k3 = Math.min(qmax, Math.floor((3 * OUT.std) / s))
  const in3 = 2 * k3 + 1
  const zf = zeroFrac(s / 2)
  const sSig = (s / OUT.std).toFixed(bits === 8 ? 3 : 2)
  const mb32 = (MAT_N * 32 / 8 / 1e6).toFixed(2)
  const mb = (MAT_N * bits / 8 / 1e6).toFixed(2)
  const inside = (100 * (1 - OUT.frac_over_3std)).toFixed(2)
  return (
    <div className={styles.scope}>
      <h2>① 一个权重要几位</h2>
      <p className="lead">
        最朴素的做法是整个矩阵共用一个 scale:<code>scale = 最大绝对值 / qmax</code>,qmax = 2<sup>bits−1</sup> − 1。{' '}
        权重除以 scale、四舍五入,落到 −qmax … qmax 这些整数格点上。{' '}
        下图是第 6 层 <code>mlp.c_fc</code> 全部 <b>2,359,296</b> 个权重的真实分布,<b style={{ color: 'var(--accent)' }}>橙色竖线</b>是这个 scale 下能表示的值。拖滑块改位数:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>每个格点编号几位 bits</label>
          <input type="range" min={0} max={3} step={1} value={bitsIdx} onChange={(e) => setBitsIdx(Number(e.target.value))} />
          <span className="rk-val">{bits} 位</span>
        </div>
        <div className="btn-row small">
          <Btn on={!log} onClick={() => setLog(false)}>线性纵轴</Btn>
          <Btn on={log} onClick={() => setLog(true)}>对数纵轴(看两端的尾巴)</Btn>
        </div>
        <div className="scroll-x"><div className="chart"><HistChart bits={bits} log={log} /></div></div>
        <div className="legend">
          <span><i style={{ background: '#8FA7D9' }} />权重个数(80 格直方图,±8σ 以外并进两端)</span>
          <span><i style={{ background: 'var(--good-soft)', border: '1px solid var(--good)' }} />±3σ</span>
          <span><i style={{ background: 'var(--accent)' }} />能表示的值</span>
          <span><i style={{ background: 'var(--bad)' }} />最大绝对值</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{levels} 个</div><div className="drl">能表示几个值</div></div>
          <div className="dr"><div className="drv">{s.toFixed(4)}</div><div className="drl">格距 scale</div></div>
          <div className="dr"><div className="drv">{in3} 个</div><div className="drl">±3σ 里分到几个格点</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--bad)' }}>{pctZero(zf)}%</div><div className="drl">被舍成 0 的权重(按直方图估)</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--good)' }}>{mb} MB</div><div className="drl">这个矩阵占多大</div></div>
        </div>
      </div>
      <div className="note">
        {bits} 位有 <b>{levels}</b> 个格点。最大值在 {OUT.absmax_over_std}σ 处,格距被定成 <b>{sSig}σ</b>;装着 {inside}% 权重的 ±3σ 分到 <b>{in3}</b> 个格点,约 <b>{pctZero(zf)}%</b> 的权重被舍成 0。这个矩阵从 32 位的 {mb32} MB 变成 {mb} MB(不计 scale)。
      </div>
      <div className="codepath">↳ 代码:<b>15_quant.py</b> 的 <code>int_absmax(w, bits)</code>(group=None,整矩阵一个 scale)</div>
      <Dig title="为什么只用 −qmax … qmax,不把 int4 的 −8 … 7 用满?">
        对称取值让 <b>0 精确落在格点 0 上</b>,正负两侧格距相同,一个 scale 就够,不必再存偏移量。代价是少用一个编码(int4 用 15 个,空着 −8)。
        LLM.int8() 论文里的 absmax 量化也是这样定 scale 的,原文:
        "Absmax quantization scales inputs into the 8-bit range [−127, 127] by multiplying with s_xf16 which is 127 divided by the absolute maximum of the entire tensor"
        (Dettmers et al., <b>arXiv 2208.07339</b>,§2)。
      </Dig>
      <Dig title="这里量化完,显存真的省下来了吗?">
        没有。<code>15_quant.py</code> 做的是{' '}
        <Term k="fake-quant" name="假量化 · fake quantization" def="量化后立刻反量化回浮点,放回模型里算 loss。数值与真 4 位存储解码出来的一样,但内存里仍是浮点,不省显存也不提速。">假量化</Term>:
        每个矩阵量化成格点后<b>立刻乘回 scale</b>,得到浮点数放回模型,再算 loss 和续写。
        这组浮点数和真 4 位存储在计算时解码出来的值相同,所以 loss 与真 kernel 的结果一致,可以拿来比较格式好坏。
        但权重在内存里仍是浮点,不会省显存,也不会变快;要真的省,得把格点编号按位打包存储,再配专门的反量化 / 矩阵乘算子。
        本页里的 MB 都是按位数算出来的存储大小。
      </Dig>
      <Dig title="fp16 为什么一点没掉?">
        fp16 仍然是浮点:1 位符号、5 位指数、10 位尾数,每个数自带自己的"scale"(指数),相对精度约 2<sup>−10</sup> ≈ 千分之一。
        实测 fp16 的 val loss 是 <b>3.0213</b>,和 fp32 在 4 位小数上相同,贪心续写逐字一样。
        第 6 章训练时前向本来就跑在 <Term k="bf16" name="bf16 · 混合精度" def="bfloat16,16 位浮点。前向用它算更快、省一半显存,数值范围和 fp32 一样大。">bf16</Term> 混合精度下,模型对 16 位的舍入早就适应了。
        整数量化不同:所有权重共用少数几个 scale,舍入误差由 scale 管的那一片里最大的数决定。
      </Dig>
      <div className="next-hint">↳ 下一步:一个 10σ 的最大值把 4 位的格子撑开,一半权重被舍成 0。让一个 scale 只管一小段权重,会怎样?</div>
    </div>
  )
}

function Step2Note({ sel, zeros }: { sel: number; zeros: number }) {
  const maxAbs = Math.max(...ROW_EX.orig.map((v) => Math.abs(v)))
  if (sel === 0) {
    return (
      <div className="note">
        整个矩阵只有一个 scale({OUT.absmax.toFixed(4)} / 7 = {(OUT.absmax / 7).toFixed(4)}),这一行绝对值最大的 {maxAbs.toFixed(4)} 也只比格距大一点。32 个里 <b>{zeros}</b> 个被舍成 0,其余只剩 ±{(OUT.absmax / 7).toFixed(4)} 两个值。整模型 val loss <b>9.9342</b>。
      </div>
    )
  }
  if (sel === 1) {
    return (
      <div className="note">
        每行一个 scale,格距跟着这一行的最大值走,缩到 {Math.abs(ROW_EX.int4_row[0]).toFixed(4)}。舍成 0 的降到 <b>{zeros}</b> 个,val loss <b>3.2456</b>。
      </div>
    )
  }
  if (sel === 2) {
    return (
      <div className="note">
        这 32 个共用一个 scale,最大值 {maxAbs.toFixed(4)} 正好落在格点 7 上。误差再降一截,val loss <b>3.0949</b>,每权重多花 0.5 位存 scale。
      </div>
    )
  }
  return (
    <div className="note">
      每 16 个一个 8 位 scale,元素换成 E2M1 浮点。格点在 0 附近更密,舍成 0 的只有 <b>{zeros}</b> 个,val loss <b>3.0638</b>,和 int4 每 32 个同样 4.5 位。
    </div>
  )
}

function Step2Calc({ sel }: { sel: number }) {
  if (sel === 0) {
    return (
      <div className="calc">
        每权重位数 = 格点 4 位 + scale 位数 ÷ 一个 scale 管的权重数<br />
        = 4 + 16 / 2,359,296 ≈ <span className="hl">4.000</span>(scale 按 16 位存)
      </div>
    )
  }
  if (sel === 1) {
    return (
      <div className="calc">
        每权重位数 = 格点 4 位 + scale 位数 ÷ 一个 scale 管的权重数<br />
        = 4 + 16 / 768 = <span className="hl">4.021</span>(这个矩阵每行 768 个;全模型平均 4.016)
      </div>
    )
  }
  if (sel === 2) {
    return (
      <div className="calc">
        每权重位数 = 格点 4 位 + scale 位数 ÷ 一个 scale 管的权重数<br />
        = 4 + 16 / 32 = <span className="hl">4.5</span>
      </div>
    )
  }
  return (
    <div className="calc">
      每权重位数 = 格点 4 位 + scale 位数 ÷ 一个 scale 管的权重数<br />
      = 4 + 8 / 16 = <span className="hl">4.5</span>(块 scale 是 8 位 E4M3;张量级 FP32 scale 摊到全矩阵可忽略)
    </div>
  )
}

function Step2() {
  const [sel, setSel] = useState(0)
  const sc = SCOPES[sel]
  const q = ROW_EX[sc.key]
  let sq = 0
  let zeros = 0
  ROW_EX.orig.forEach((o, i) => {
    const v = q[i]
    sq += (o - v) ** 2
    if (v === 0) zeros += 1
  })
  const labels = ['整矩阵 1 个 scale', '每行 1 个', '每 32 个 1 个', 'NVFP4 · 每 16 个 1 个']
  return (
    <div className={styles.scope}>
      <h2>② 一个 scale 管多少个权重</h2>
      <p className="lead">
        scale 管的范围越小,它只需要照顾这一小段里的最大值,格子就贴得越紧。{' '}
        下面是同一个矩阵(第 6 层 <code>mlp.c_fc</code>)<b>第 123 行的前 32 个权重</b>:空心圈是原值,实心点是 4 位量化再乘回来的值,竖线是误差。切换 scale 的管法:
      </p>
      <div className="btn-row">
        {labels.map((label, i) => <Btn key={label} on={sel === i} onClick={() => setSel(i)}>{label}</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x"><div className="chart"><RowChart scope={sc.key} /></div></div>
        <div className="legend">
          <span><i style={{ background: '#fff', border: '1.5px solid var(--ink2)', borderRadius: '50%' }} />原值</span>
          <span><i style={{ background: 'var(--accent)', borderRadius: '50%' }} />量化后</span>
          <span><i style={{ background: 'var(--bad)', borderRadius: '50%' }} />被舍成 0</span>
          <span><i style={{ background: '#E9E5DA' }} />用到的格点值</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{en(sc.per)}</div><div className="drl">一个 scale 管几个权重</div></div>
          <div className="dr"><div className="drv">{sc.bpw}</div><div className="drl"><Term k="bpw" name="bpw · bits per weight" def="每个权重平均占几位 = 格点位数 + scale 的位数摊到它管的权重上。int4 每 32 个一个 16 位 scale:4 + 16/32 = 4.5。">每权重平均几位</Term></div></div>
          <div className="dr"><div className="drv">{Math.sqrt(sq / 32).toFixed(4)}</div><div className="drl">这 32 个的均方根误差</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--bad)' }}>{zeros} 个</div><div className="drl">被舍成 0 的(共 32 个)</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{row(sc.key).val_loss.toFixed(4)}</div><div className="drl">整模型 val loss(fp32 3.0213)</div></div>
        </div>
        <Step2Calc sel={sel} />
      </div>
      <Step2Note sel={sel} zeros={zeros} />
      <div className="codepath">↳ 代码:<b>15_quant.py</b> 的 <code>int_absmax(w, 4, group)</code>(group = None / 'row' / 32)· <code>nvfp4</code></div>
      <Dig title="管得越细越好,为什么不每 4 个权重配一个 scale?">
        scale 也要存。16 位的 scale 摊到 4 个权重上是每个 +4 位,4 位量化的存储就变成了 8 位。实测三档:
        <b>每行 1 个</b> 4.016 位、Δ +0.2243;<b>每 128 个 1 个</b> 4.125 位、Δ +0.1147;<b>每 32 个 1 个</b> 4.5 位、Δ +0.0736。
        位数与误差要取折中,第 4 步的三种工业格式把块大小定在 16 和 32。
      </Dig>
      <Dig title="NVFP4 那一档的点为什么更密?">
        它的元素是 4 位浮点 E2M1,8 个非负值是 0、0.5、1、1.5、2、3、4、6,<b>靠近 0 的地方更密</b>,正好对上权重扎堆在 0 附近的分布。
        这 32 个权重在 NVFP4 下用到 12 种绝对值(含 0),int4 每 32 个一个 scale 只用到 7 种。
        说明:生成这组示例时,<code>15_quant.py</code> 只把这一行传进 <code>nvfp4</code>,所以示例里的张量级 scale 取自这一行本身;块级 scale 照常每 16 个一个。
      </Dig>
      <div className="next-hint">↳ 下一步:管细了就不崩。整矩阵一个 scale 为什么会崩到 9.93?看看每个矩阵的最大值离正常权重有多远。</div>
    </div>
  )
}

function Step3() {
  const [kind, setKind] = useState(0)
  const [sel, setSel] = useState(() => LAYERS.findIndex((l) => l.key === 'h.0.attn.c_proj.weight'))
  const [out, setOut] = useState(1)
  const layer = LAYERS[sel]
  const k3 = Math.min(7, Math.floor((3 * 7) / layer.r))
  const shown = LAYERS.filter((x) => kind === 0 || x.kind === kind - 1).map((x) => x.r)
  const over = LAYERS.filter((x) => x.r > 21).length
  const picked = row(OUTC[out])
  const kindLabels = ['全部 48 个', 'attn.c_attn', 'attn.c_proj', 'mlp.c_fc', 'mlp.c_proj']

  function pickKind(i: number) {
    setKind(i)
    if (i > 0 && LAYERS[sel].kind !== i - 1) {
      let best = -1
      LAYERS.forEach((l, j) => {
        if (l.kind === i - 1 && (best < 0 || l.r > LAYERS[best].r)) best = j
      })
      setSel(best)
    }
  }

  return (
    <div className={styles.scope}>
      <h2>③ 离群值:一个大数撑大所有格子</h2>
      <p className="lead">
        给 12 层里全部 48 个被量化的矩阵各算一个数:<b>最大绝对值是标准差的几倍</b>(记作 r)。{' '}
        int4 整矩阵一个 scale 时,格距 = r/7 个标准差,r 越大,正常大小的权重分到的格点越少。{' '}
        这些远离主体的少数权重叫 <Term k="outlier" name="离群值 · outlier" def="比同一矩阵里绝大多数数值大很多倍的少数权重或激活。整矩阵共用一个 scale 时,它们决定格距,让其余数值的舍入误差变大。">离群值</Term>。点柱子看某个矩阵:
      </p>
      <div className="btn-row small">
        {kindLabels.map((label, i) => <Btn key={label} on={kind === i} onClick={() => pickKind(i)}>{label}</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x"><div className="chart wide"><LayerChart kind={kind} sel={sel} onPick={setSel} /></div></div>
        <div className="legend">
          <span><i style={{ background: 'var(--e1)' }} />attn.c_attn</span>
          <span><i style={{ background: 'var(--e3)' }} />attn.c_proj</span>
          <span><i style={{ background: 'var(--e2)' }} />mlp.c_fc</span>
          <span><i style={{ background: 'var(--e0)' }} />mlp.c_proj</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ fontSize: 14 }}>{layer.key.replace('.weight', '')}</div><div className="drl">选中的矩阵</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{layer.r}×</div><div className="drl">最大绝对值 / 标准差</div></div>
          <div className="dr"><div className="drv">{(layer.r / 7).toFixed(2)}σ</div><div className="drl">int4 整矩阵的格距</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--bad)' }}>{`|w| < ${(layer.r / 14).toFixed(2)}σ`}</div><div className="drl">这个范围内全部舍成 0</div></div>
          <div className="dr"><div className="drv">{2 * k3 + 1} 个</div><div className="drl">±3σ 里的格点(共 15 个)</div></div>
        </div>
      </div>
      {k3 === 0 ? (
        <div className="note">
          <b>{layer.key}</b> 的最大值是标准差的 {layer.r} 倍。int4 整矩阵一个 scale 时格距是 {(layer.r / 7).toFixed(2)}σ,±3σ 里只剩 0 这一个格点,{`|w| < ${(layer.r / 14).toFixed(2)}σ`} 的全部舍成 0。48 个矩阵里有 <b>{over}</b> 个倍数超过 21,都是这种情况。
        </div>
      ) : (
        <div className="note">
          <b>{layer.key}</b> 的倍数是 {layer.r},格距 {(layer.r / 7).toFixed(2)}σ,±3σ 里有 {2 * k3 + 1} 个格点。当前显示的矩阵里,倍数从 {Math.min(...shown)} 到 {Math.max(...shown)}。一个模型里只要有几个矩阵的格点被离群值撑开,loss 就会崩。
        </div>
      )}

      <div className="sub-h"><span className="badge">对照</span>只把 0.1% 的离群值挪出去</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        <code>int4_keep_outliers</code>:每个矩阵里绝对值最大的 <b>0.1%</b> 权重原样留 16 位(另存 32 位位置),剩下 99.9% 照旧用整矩阵一个 scale 量化,{' '}
        平均每个权重多 0.001 × (16 + 32) = <b>0.048 位</b>。点按钮看 val loss 和续写:
      </p>
      <div className="btn-row small">
        {OUTN.map((label, i) => <Btn key={label} on={out === i} onClick={() => setOut(i)}>{label}</Btn>)}
      </div>
      <div className="lab">
        {OUTC.map((k, i) => {
          const r = row(k)
          const w = Math.min(100, (r.val_loss / 10) * 100)
          const col = k === 'fp32' ? '#8C8A83' : r.delta > 1 ? '#9a3a22' : '#D97757'
          return (
            <div key={k} className={i === out ? 'lbar sel' : 'lbar'}>
              <div className="ln">{OUTN[i]}</div>
              <div className="lt"><div className="lf" style={{ width: `${w.toFixed(1)}%`, background: col, opacity: i === out ? 1 : 0.45 }} /></div>
              <div className="lv">{r.val_loss.toFixed(4)}</div>
            </div>
          )
        })}
        <div className="hp-note">条长按 val loss 0 → 10 画</div>
        <div className="sample-h">{OUTN[out]} · {picked.bits_per_weight} 位 / 权重 · 贪心续写(标出与 fp32 分叉之后的部分):</div>
        <SampleView txt={picked.sample} base={out === 0 ? null : row('fp32').sample} />
      </div>
      <div className="note">整矩阵 int4 的 val loss 是 <b>9.9342</b>;只挪走 0.1% 的权重,回到 <b>3.2633</b>,续写重新成句。</div>
      <div className="codepath">↳ 代码:<b>15_quant.py</b> 的 <code>int4_keep_outliers</code> · 每个矩阵的倍数在脚本末尾 <code>per_layer_outlier</code></div>
      <Dig title="LLM.int8() 是怎么处理离群值的?">
        Dettmers et al.,<b>LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale</b>(<b>arXiv 2208.07339</b>,NeurIPS 2022)。
        §3 的做法分两部分:按行 / 列分别定 scale 的 vector-wise 量化,加上 mixed-precision decomposition,把含离群值的特征维单独拆出来用 FP16 算,其余走 int8。
        §4 报告离群特征在约 6.7B 参数处集中出现,原文 "at the 6.7B scale, 150,000 outliers occur"。
        <br /><br />
        论文处理的是<b>激活</b>里的离群特征维。本页把同一个思路搬到<b>权重</b>上,按单个权重挑出最大的 0.1%。
      </Dig>
      <Dig title="0.1% 这个比例是怎么定的?">
        代码里固定取 <code>frac=0.001</code>,没有扫这个参数。拿第 6 层 <code>mlp.c_fc</code> 对照:超过 6σ 的权重占 <b>0.0002%</b>,超过 3σ 的占 <b>0.369%</b>,0.1% 落在两者之间。
        比例取大,离群值的存储开销(每个 48 位)跟着涨;取小,剩下的最大值仍然偏大。
      </Dig>
      <Dig title={'留离群值和"每行一个 scale"效果差不多,选哪个?'}>
        实测留离群值 <b>4.048 位、3.2633</b>,每行一个 scale <b>4.016 位、3.2456</b>,相差 0.018,只评测了一次,不宜据此排先后。
        工程上每行一个 scale 更规整:存储是定长的,反量化是一次乘法;留离群值要额外存稀疏位置,算的时候再按位置填回去。
        两者都比每 32 个一个 scale(Δ +0.0736)差得多,这就是主流 4 位格式都用分组的原因。
      </Dig>
      <div className="next-hint">↳ 下一步:分组 scale 是几种工业 4 位格式共同的出发点。Q4_K、NVFP4、MXFP4 的差别在 scale 怎么存。</div>
    </div>
  )
}

function FmtMeta({ fmt }: { fmt: string }) {
  if (fmt === 'q4_k') {
    return (
      <div className="fmt-meta">
        <div className="fm"><div className="fh">元素</div>4 位无符号整数 q = 0 … 15,反量化 <b>x = a·q + b</b>(非对称)</div>
        <div className="fm"><div className="fh">scale</div>子块 32 个:6 位 scale + 6 位 min;超块 256 个:FP16 的 d、dmin 把 6 位值还原</div>
        <div className="fm"><div className="fh">出处</div>llama.cpp k-quants,PR ggml-org/llama.cpp#1684(2023-06);<code>ggml-common.h</code> 的 block_q4_K</div>
      </div>
    )
  }
  if (fmt === 'nvfp4') {
    return (
      <div className="fmt-meta">
        <div className="fm"><div className="fh">元素</div>E2M1 4 位浮点,值域 ±6</div>
        <div className="fm"><div className="fh">scale</div>每 16 个值一个 8 位 FP8(E4M3)scale;另有整个张量一个 FP32 scale,摊到上千万权重上可忽略</div>
        <div className="fm"><div className="fh">出处</div>NVIDIA 技术博客 "Introducing NVFP4 for Efficient and Accurate Low-Precision Inference"(2025-06-24)</div>
      </div>
    )
  }
  return (
    <div className="fmt-meta">
      <div className="fm"><div className="fh">元素</div>E2M1 4 位浮点,值域 ±6</div>
      <div className="fm"><div className="fh">scale</div>每 32 个值一个 8 位 E8M0 scale,只能是 2 的整数次幂</div>
      <div className="fm"><div className="fh">出处</div>OCP Microscaling Formats (MX) v1.0;Rouhani et al., arXiv 2310.10537;参数以 NVIDIA 博客对照为准</div>
    </div>
  )
}

function Step4Note({ fmt }: { fmt: string }) {
  if (fmt === 'q4_k') {
    return <div className="note">Q4_K 把 scale 分两级存:子块的 scale / min 只用 6 位,再靠超块的两个 FP16 还原。实测 val loss <b>3.0656</b>,同样 4.5 位,比 int4 每 32 个一个 16 位 scale(3.0949)低 0.029。</div>
  }
  if (fmt === 'nvfp4') {
    return <div className="note">NVFP4 块更小(16 个),scale 是 8 位浮点。实测 val loss <b>3.0638</b>,和 Q4_K 同为 4.5 位,两者相差 0.0018。</div>
  }
  return <div className="note">MXFP4 块 32 个、scale 只能是 2 的幂,每权重 4.25 位,是三者里最省的。实测 val loss <b>3.1030</b>,比 NVFP4 多 0.039。</div>
}

function Step4() {
  const [fmtIdx, setFmtIdx] = useState(0)
  const [x, setX] = useState(0.7)
  const [amax, setAmax] = useState(57)
  const fmt = FMT_KEYS[fmtIdx]
  const tally = TALLY[fmt]
  const tot = tally.reduce((a, t) => a + t[2], 0)
  const rec = row(fmt)
  const fp = roundGrid(x, E2M1)
  const ik = Math.max(-7, Math.min(7, Math.round(x / (6 / 7))))
  const iv = ik * 6 / 7
  const sc = scaleAt(amax)
  const mxMsg = sc.rM > 6
    ? `块内最大值落在 ${sc.rM.toFixed(2)},超出 6,被截成 6 × scale = ${(6 * sc.sM).toFixed(4)},这个数少了 ${(100 * (1 - 6 / sc.rM)).toFixed(1)}%`
    : sc.rM < 5
      ? `块内最大值只到 ${sc.rM.toFixed(2)},E2M1 最上面的 6 用不上,可用的格点少一个`
      : `块内最大值落在 ${sc.rM.toFixed(2)},没有截断`
  const names = ['Q4_K(llama.cpp)', 'NVFP4', 'MXFP4']
  return (
    <div className={styles.scope}>
      <h2>④ 三种 4 位格式:scale 怎么存</h2>
      <p className="lead">
        三种格式的每个权重都是 4 位,差在<b>块多大、scale 用几位、元素是整数还是浮点</b>。{' '}
        下面画的是同样 256 个权重的存储布局:一格 = 4 位,色块宽度按位数画。选一种格式:
      </p>
      <div className="btn-row">
        {names.map((label, i) => <Btn key={label} on={fmtIdx === i} onClick={() => setFmtIdx(i)}>{label}</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x"><Layout fmt={fmt} /></div>
        <div className="legend">
          {LEGEND[fmt].map(([c, t]) => <span key={t}><i style={{ background: c }} />{t}</span>)}
        </div>
        <div className="calc">
          {tally.map((t) => (
            <Fragment key={t[0]}>
              {t[0]} {t[1]} = <span className="hl">{t[2]}</span> 位<br />
            </Fragment>
          ))}
          合计 {tot} 位 ÷ 256 个权重 = <span className="hl">{perWeight(tot)} 位 / 权重</span>
        </div>
        <FmtMeta fmt={fmt} />
        <div className="dotread">
          <div className="dr"><div className="drv">{rec.bits_per_weight}</div><div className="drl">每权重平均几位</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{rec.val_loss.toFixed(4)}</div><div className="drl">124M 实测 val loss</div></div>
          <div className="dr"><div className="drv">+{rec.delta.toFixed(4)}</div><div className="drl">比 fp32 多</div></div>
          <div className="dr"><div className="drv">3.0949</div><div className="drl">对照:int4 每 32 个(4.5 位)</div></div>
        </div>
      </div>
      <Step4Note fmt={fmt} />

      <div className="sub-h"><span className="badge">E2M1</span>4 位浮点只有 8 个非负值</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        NVFP4 和 MXFP4 的元素都是{' '}
        <Term k="fp4" name="FP4 · E2M1" def="4 位浮点:1 位符号、2 位指数、1 位尾数。非负值只有 0, 0.5, 1, 1.5, 2, 3, 4, 6 八个,靠近 0 更密,最大 6。">E2M1</Term>
        {' '}(1 位符号、2 位指数、1 位尾数)。把块内的值除以块 scale 后,四舍五入到最近的 E2M1 值。{' '}
        上排是 E2M1,下排是同样最大到 6 的均匀 int4 格点(−7 … 7 乘 6/7)。拖滑块:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>除以 scale 后的值 x</label>
          <input type="range" min={-6} max={6} step={0.05} value={x} onChange={(e) => setX(Number(e.target.value))} />
          <span className="rk-val">{x.toFixed(2)}</span>
        </div>
        <div className="scroll-x"><div className="chart"><E2Chart x={x} /></div></div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{fp}(误差 {Math.abs(x - fp).toFixed(2)})</div><div className="drl">舍到 E2M1</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{iv.toFixed(2)}(误差 {Math.abs(x - iv).toFixed(2)})</div><div className="drl">舍到均匀 int4</div></div>
        </div>
      </div>

      <div className="sub-h"><span className="badge">scale</span>块 scale 能不能是任意数</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        <Term k="nvfp4" name="NVFP4" def="NVIDIA 的 4 位浮点格式:元素 E2M1,每 16 个值共享一个 FP8(E4M3)scale,另有整个张量一个 FP32 scale。每权重 4.5 位。">NVFP4</Term>
        {' '}的块 scale 是 8 位浮点 E4M3,可以取 amax/6 附近的小数,块内最大值差不多正好落在 6 上。{' '}
        <Term k="mxfp4" name="MXFP4" def="OCP Microscaling 标准里的 4 位格式:元素 E2M1,每 32 个值共享一个 E8M0 scale(只能是 2 的整数次幂)。每权重 4.25 位。">MXFP4</Term>
        {' '}的块 scale 是 E8M0,只能是 2 的整数次幂:<code>15_quant.py</code> 取 <code>2^(floor(log2 amax) − 2)</code>,于是 amax/scale 落在 [4, 8),超过 6 的部分被截断。拖块内最大绝对值:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>块内最大绝对值 amax</label>
          <input type="range" min={0} max={100} step={1} value={amax} onChange={(e) => setAmax(Number(e.target.value))} />
          <span className="rk-val">{sc.a.toFixed(4)}</span>
        </div>
        <div className="scroll-x"><div className="chart"><ScaleChart rN={sc.rN} rM={sc.rM} /></div></div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>NVFP4</b>:块 scale = {sc.bN.toExponential(3)}(E4M3 能表示的最近值),amax/scale = <b>{sc.rN.toFixed(2)}</b>{sc.rN > 6 ? ',略超 6 的部分截掉' : ''}。{' '}
          <b>MXFP4</b>:块 scale = 2<sup>{Math.log2(sc.sM)}</sup> = {sc.sM.toExponential(3)},{mxMsg}。拖动滑块,MXFP4 的点在 4 到 8 之间来回跳,NVFP4 的点停在 6 附近。
        </div>
      </div>

      <div className="codepath">↳ 代码:<b>15_quant.py</b> 的 <code>q4_k_like</code> · <code>nvfp4</code> · <code>mxfp4</code> · <code>E2M1</code> / <code>e4m3_grid</code></div>
      <Dig title="Q4_K 为什么要多存一个 min(非对称)?">
        对称格式把 16 个格点正负各分一半。子块里的数如果偏向一侧,另一侧的格点就空着。
        <Term k="q4-k" name="Q4_K · llama.cpp k-quants" def="llama.cpp 的 4 位格式:每 256 个权重一个超块,切成 8 个 32 的子块;子块存 4 位非对称格点和 6 位 scale / min,超块存两个 FP16。每权重 4.5 位。">Q4_K</Term>
        {' '}按 <code>x = a·q + b</code> 反量化(llama.cpp <code>ggml-common.h</code> 里 block_q4_K 的注释),q 取 0 … 15,
        格点覆盖 [min(子块最小值, 0), 子块最大值],15 个格距都用在这一段上。
        每个子块的 scale 和 min 自己也被量化成 6 位,再由超块的两个 FP16(<code>d</code>、<code>dmin</code>)还原,
        合计 4 + (6+6)/32 + (16+16)/256 = <b>4.5 位</b>,注释原文 "Effectively 4.5 bits per weight"。
        出处:llama.cpp k-quants,PR ggml-org/llama.cpp#1684(Iwan Kawrakow,2023-06)。
      </Dig>
      <Dig title="MXFP4 在这里为什么比 NVFP4 差一截?">
        两处差别叠在一起。<b>块大小</b>:NVFP4 每 16 个一个 scale,MXFP4 每 32 个,块越小,一个离群值牵连的值越少。
        <b>scale 精度</b>:E8M0 只能表示 2 的幂,块内最大值落在 E2M1 的 4 到 8 之间,要么被截到 6,要么用不满 6 以上的格点;E4M3 能取小数,最大值基本正好落在 6 上。
        NVIDIA 博客用一个示例比较两种 scale,MSE 分别是 0.08 和 0.72。
        本页实测:NVFP4 Δ <b>+0.0425</b>(4.5 位),MXFP4 Δ <b>+0.0817</b>(4.25 位),MXFP4 省下的是每权重 0.25 位。
        <br /><br />
        出处:NVIDIA 技术博客 "Introducing NVFP4 for Efficient and Accurate Low-Precision Inference"(2025-06-24);
        MXFP4 标准见 OCP Microscaling Formats (MX) v1.0 Spec 与 Rouhani et al.,<b>arXiv 2310.10537</b>,块大小 32 与 E8M0 这两个参数以 NVIDIA 博客的对照为准。
      </Dig>
      <Dig title="E2M1 的 8 个值是怎么排出来的?">
        2 位指数 e、1 位尾数 m。e = 0 时是次正规数,值为 m × 0.5,得到 <b>0、0.5</b>;
        e ≥ 1 时值为 (1 + m/2) × 2<sup>e−1</sup>,e = 1、2、3 分别得到 <b>1、1.5</b>,<b>2、3</b>,<b>4、6</b>。
        再加 1 位符号,一共 15 个不同的数(+0 与 −0 相同)。<code>15_quant.py</code> 里直接写成常量 <code>E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6]</code>。
      </Dig>
      <Dig title="Q4_K 和 NVFP4 只差 0.0018,哪个更好?">
        这个量级分不出来。两者都是 4.5 位,val loss 3.0656 对 3.0638,只在固定的 131,072 个 token 上评了一次;
        换一段评测文本,小于 0.01 的先后完全可能翻过来。能确定的是:同样 4.5 位,两者都比 int4 每 32 个一个 scale(3.0949)低 0.03 左右。
      </Dig>
      <div className="next-hint">↳ 下一步:格式都看过了。回到第 6 章那个 124M,把 15 组实测放进一张账本。</div>
    </div>
  )
}

function StackDetail({ name }: { name: string }) {
  const r = row(name)
  const other = N_ALL - N_Q - N_EMB
  let q = N_Q * r.bits_per_weight
  let e = N_EMB * 16
  let o = other * 16
  if (r.name === 'fp32') {
    q = N_Q * 32
    e = N_EMB * 32
    o = other * 32
  } else if (r.name === 'int4_g32_with_emb') {
    e = N_EMB * r.bits_per_weight
  }
  const mb = (b: number) => b / 8 / 1e6
  const full = mb(N_ALL * 32)
  return (
    <>
      <div className="sample-h">
        <b style={{ color: 'var(--ink)' }}>{r.label}</b> · 按口径合计 {mb(q + e + o).toFixed(1)} MB(json 记为 {r.model_mb.toFixed(1)} MB):Linear 矩阵 {mb(q).toFixed(1)} + 词嵌入 {mb(e).toFixed(1)} + 其余 {mb(o).toFixed(1)}。条长以 fp32 的 {full.toFixed(1)} MB 为满格。
      </div>
      <div className="stack">
        <div style={{ width: `${((100 * mb(q)) / full).toFixed(2)}%`, background: 'var(--accent)' }} />
        <div style={{ width: `${((100 * mb(e)) / full).toFixed(2)}%`, background: 'var(--e1)' }} />
        <div style={{ width: `${((100 * mb(o)) / full).toFixed(2)}%`, background: '#B9B5AA' }} />
      </div>
    </>
  )
}

function Step5() {
  const [sort, setSort] = useState(0)
  const [sel, setSel] = useState('nvfp4')
  const list = ROWS.map((r, i) => ({ ...r, i }))
  if (sort === 1) list.sort((a, b) => a.delta - b.delta)
  if (sort === 2) list.sort((a, b) => a.model_mb - b.model_mb)
  const picked = row(sel)
  const fp16 = row('fp16')
  const fp32 = row('fp32')
  const int8row = row('int8_row')
  const tensor = row('int4_tensor')
  const outlier = row('int4_tensor_outlier')
  const nv = row('nvfp4')
  const q4 = row('q4_k')
  const mx = row('mxfp4')
  const emb = row('int4_g32_with_emb')
  const int3 = row('int3_g32')
  const int2 = row('int2_g32')
  const sorts = ['脚本里的顺序', '按 Δ loss 从小到大', '按模型大小从小到大']
  return (
    <div className={styles.scope}>
      <h2>⑤ 124M 的真实账本</h2>
      <p className="lead">
        同一份权重(第 6 章 10B token 训练,step 19072),每种格式量化后在 <b>131,072</b> 个 FineWeb-Edu val token 上算 loss,{' '}
        再用 <code>The history of ancient Rome</code> 做{' '}
        <Term k="greedy" name="贪心解码 · greedy" def="每一步都取概率最高的 token,不随机。同一个模型、同一个 prompt 每次续写都一样,方便对比。">贪心续写</Term>
        {' '}32 个 token。{' '}
        切换排序,点一行看它的大小构成和续写:
      </p>
      <div className="btn-row small">
        {sorts.map((label, i) => <Btn key={label} on={sort === i} onClick={() => setSort(i)}>{label}</Btn>)}
      </div>
      <div className="lab">
        <div className="scroll-x">
          <table className="ledger">
            <thead>
              <tr>
                <th>格式</th>
                <th style={{ textAlign: 'right' }}>位 / 权重</th>
                <th style={{ textAlign: 'right' }}>模型 MB</th>
                <th style={{ textAlign: 'right' }}>val loss</th>
                <th>Δ(比 fp32,条长 0 → 0.6,超出画满)</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const crash = r.delta > 1
                const w = Math.min(100, (Math.max(0, r.delta) / 0.6) * 100)
                const col = crash ? '#9a3a22' : r.delta < 0.01 ? '#3f7d63' : '#D97757'
                const delta = r.delta <= 0 ? '0.0000' : `+${r.delta.toFixed(4)}`
                return (
                  <tr key={r.name} className={r.name === sel ? 'sel' : undefined} onClick={() => setSel(r.name)}>
                    <td>{r.label}</td>
                    <td className="num">{r.bits_per_weight}</td>
                    <td className="num">{r.model_mb.toFixed(1)}</td>
                    <td className="num">{r.val_loss.toFixed(4)}</td>
                    <td>
                      <div className="dbar">
                        <div className="dt"><div className="df" style={{ width: `${w.toFixed(1)}%`, background: col }} /></div>
                        <div className="dn" style={{ color: col }}>{delta}{crash ? ' 崩' : ''}</div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="lab">
        <StackDetail name={sel} />
        <div className="legend">
          <span><i style={{ background: 'var(--accent)' }} />48 个 Linear 权重矩阵</span>
          <span><i style={{ background: 'var(--e1)' }} />词嵌入(与输出头共用)</span>
          <span><i style={{ background: '#B9B5AA' }} />位置嵌入 / LayerNorm / bias</span>
        </div>
        <div className="sample-h">fp32 原始续写:</div>
        <SampleView txt={fp32.sample} base={null} />
        <div className="sample-h">{picked.label} 的续写(标出与 fp32 分叉之后的部分):</div>
        <SampleView txt={picked.sample} base={picked.name === 'fp32' ? null : fp32.sample} />
      </div>
      <div className="note">
        大小口径:被量化的 48 个矩阵按"位 / 权重"计,其余参数(词嵌入、位置嵌入、LayerNorm、bias)按 16 位计;fp32 那一行全部按 32 位计。最后一行把词嵌入也量化成 int4 每 32 个一个 scale。
      </div>
      <div className="note">
        4.5 位的 NVFP4 / Q4_K 把 <b>497.9 MB</b> 压到 <b>126.9 MB</b>,val loss 多 0.04;连词嵌入一起压到 <b>71.3 MB</b>,多 0.09;int3 多 0.53,int2 崩到 9.24。
      </div>
      <Dig title="Δ 小于 0.01 的差异能信吗?">
        当成噪声量级看。fp16 与 fp32 在 4 位小数上相同;int8 每行一个 scale +0.0006,int8 整矩阵 +0.0087;Q4_K 与 NVFP4 相差 0.0018。
        评测是固定的 131,072 个 token、确定性计算,重跑结果不变,但换一段评测文本,这个量级的先后可能改变。
        能直接读出来的是大台阶:int8 与 fp32 几乎重合,4.5 位多 0.04 到 0.07,3.5 位多 0.53,整矩阵 int4 与 int2 崩掉。
      </Dig>
      <Dig title="为什么 4 位的模型还有 127 MB?">
        词嵌入表有 50,304 × 768 = <b>38,633,472</b> 个参数,按 16 位存是 <b>77.3 MB</b>,占 int4 每 32 个那一行 126.9 MB 的六成。
        124M 这个规模里嵌入占的比例高(约 31% 的参数),量化 Linear 层省下的只是剩下那部分。
        把嵌入也量化成 int4 每 32 个一个 scale,模型降到 <b>71.3 MB</b>,Δ 从 +0.0736 变成 +0.0914。
        词嵌入同时是输出头(权重共享),<code>15_quant.py</code> 的 <code>apply</code> 里要把 <code>lm_head.weight</code> 一起换掉。
      </Dig>
      <Dig title="同样 4 位,还能把误差再压低吗?">
        能。本页所有格式都是逐个权重四舍五入到最近格点,不看数据。另有两类方法用少量校准数据改进舍入:
        <br /><br />
        <b>GPTQ</b>(Frantar et al.,<b>arXiv 2210.17323</b>,ICLR 2023):"one-shot weight quantization method based on approximate second-order information",
        逐步量化权重,并调整还没量化的权重去抵消已产生的误差;论文里 175B 模型约 4 GPU 小时量化到 3 到 4 位。
        <br />
        <b>AWQ</b>(Lin et al.,<b>arXiv 2306.00978</b>,MLSys 2024):按激活分布找出约 1% 的显著通道,做逐通道缩放加以保护,不需要反向传播或重建。
        <br /><br />
        两者都能和分组 scale 叠加使用。本项目没有实现它们。
      </Dig>
      <Dig title="只量化了权重,KV cache 和激活呢?">
        另算。本页量化的只有权重,前向时的激活和{' '}
        <Term k="kv-cache" name="KV-cache · 键值缓存" def="把过去每个 token 的 K/V 缓存下来,生成新 token 时只算新的一列,避免重算整段。">KV cache</Term>
        {' '}都还是浮点。KV cache 随上下文长度线性增长,长对话里可能比权重还大,它的显存账见{' '}
        <Link to="/ch/llama#step-5" style={{ color: 'var(--accent)' }}>第 12 章 STEP 5</Link>(每个数从 FP16 换成 FP8,cache 减半)。
        激活量化更难,激活里的离群特征维就是第 3 步 LLM.int8() 要处理的对象。
      </Dig>
      <Dig title="llama.cpp 常见的 Q4_K_M 就是全部 Q4_K 吗?">
        不全是。引入 k-quants 的 PR(ggml-org/llama.cpp#1684)原文:Q4_K_M "uses Q6_K for half of the attention.wv and feed_forward.w2 tensors, else Q4_K",
        一部分对误差敏感的矩阵用 6 位。之后版本的混合规则可能调整过,以当前源码为准。本页的 <code>q4_k</code> 一行是所有 48 个矩阵全用 Q4_K。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测(15 组 · 131,072 个 val token)</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>fp16 与 fp32 的 val loss 都是 <b>{fp16.val_loss.toFixed(4)}</b>,贪心续写逐字相同;模型从 {fp32.model_mb} MB 到 {fp16.model_mb} MB。</div></li>
        <li><span className="ck">✓</span><div>int8 每行一个 scale:<b>{int8row.model_mb} MB</b>,Δ +{int8row.delta.toFixed(4)},续写与 fp32 相同。</div></li>
        <li><span className="ck">✓</span><div>int4 整矩阵一个 scale 崩到 <b>{tensor.val_loss.toFixed(4)}</b>;只留 0.1% 离群值回到 <b>{outlier.val_loss.toFixed(4)}</b>。</div></li>
        <li><span className="ck">✓</span><div>4.5 位的 NVFP4 / Q4_K:<b>{nv.model_mb} MB</b>,Δ +{nv.delta.toFixed(4)} / +{q4.delta.toFixed(4)};MXFP4 4.25 位,Δ +{mx.delta.toFixed(4)}。</div></li>
        <li><span className="ck">✓</span><div>词嵌入也量化成 int4 每 32 个一个 scale:<b>{emb.model_mb} MB</b>,Δ +{emb.delta.toFixed(4)};int3 Δ +{int3.delta.toFixed(4)},int2 崩到 {int2.val_loss.toFixed(4)}。</div></li>
      </ul>
      <div className="codepath">↳ 跑法:<code>python 15_quant.py --json runs/ch17_quant.json</code>(需要 <code>phase1-124m/ckpt10b/latest.pt</code>)· <code>--tokens 65536</code> 少评一点</div>
    </div>
  )
}

export function Quantization() {
  const chapter = findChapter('quantization')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="quantization"
      title="量化:把 124M 从 32 位压到 4 位"
      subtitle={
        <>
          第 6 章用 10B token 训出来的那个 GPT-2 124M,每个权重是 32 位浮点,整个模型 <b>497.9 MB</b>。{' '}
          <Term k="quantization" name="量化 · quantization" def="用更少的位数存权重:定一个 scale,权重除以 scale 后四舍五入成整数(或小浮点)格点,只存格点编号;用时乘回 scale。">量化</Term>
          {' '}把每个权重换成几位的格点编号:先定一个{' '}
          <Term k="quant-scale" name="scale · 缩放系数" def="把一段权重映射到格点上的系数。一个 scale 管多少个权重(整矩阵 / 每行 / 每 32 个)决定了格子有多细,scale 本身也要占位数。">scale</Term>,
          {' '}权重除以它、四舍五入,用的时候再乘回来。本关用配套代码 <code>phase4-efficiency/15_quant.py</code> 把 15 种做法挨个跑一遍,{' '}
          在同一份 <Term k="fineweb" name="FineWeb-Edu" def="HuggingFace 发布的教育类网页语料,第 6 章训练 124M 用的就是它。">FineWeb-Edu</Term> val 上看 loss 涨多少。{' '}
          Phase 4 讲效率,这是最后一章。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">模型 <b>124M</b> <i>第 6 章 · step 19072</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">被量化 <b>84.9M</b> <i>12 层 48 个 Linear 权重</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECEAE2">不量化 <b>39.5M</b> <i>嵌入 / LayerNorm / bias,按 16 位</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">评测 <b>131,072</b> <i>val token</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">group <b>32</b> <i>每 32 个权重一个 scale</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">bits <b>8/4/3/2</b> <i>格点编号几位</i></HpChip>
          <span className="hp-note">group 的 32 是"管几个权重",fp32 的 32 是"每个数几位",含义不同</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 量化 · 通关 · Phase 4 收尾</div>
          <div className="cs">你把第 6 章的 124M 从 497.9 MB 压到了 126.9 MB,val loss 多 0.04;也看到了一个 10σ 的离群值怎样让整矩阵 int4 崩掉,以及 Q4_K、NVFP4、MXFP4 各自怎么存 scale。Phase 4 从线性注意力、稀疏注意力、N-gram 查表、投机解码讲到量化,效率这一阶段到这里结束。</div>
        </>
      }
    />
  )
}
