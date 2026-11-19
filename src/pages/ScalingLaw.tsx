// 旧页 goto 只切换步骤，不重置模型、热力图格子、滑块、拟合组、选中行和折叠。
import { useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import { scalingData as rawData } from './scalingLawData'
import styles from './ScalingLaw.module.css'

type CurvePt = { tokens: number; val: number }
type Row = {
  kind: string
  name: string
  n_layer: number
  n_embd: number
  N: number
  D: number
  val: number
  pred: number
  in_fit: boolean
  role: string
  id: string
  curve?: CurvePt[]
}
type FitPt = { pred: number; role: string; lo?: number; hi?: number }
type Fit = {
  key: string
  label: string
  n_fit: number
  E: number
  A: number
  B: number
  alpha: number
  beta: number
  G: number
  maxN: number
  maxD: number
  pts: Record<string, FitPt>
}
type Check = { id: string; label: string; N: number; D: number; val: number }
type DivPt = { tokens: number; val: number; gnorm: number; att: number; clip: number }
type ScalingData = {
  fit: { E: number; A: number; B: number; alpha: number; beta: number; G: number; holdout_N: number }
  rows: Row[]
  fits: Fit[]
  checks: Check[]
  ntot: Record<string, number>
  minutes: Record<string, number>
  nruns: Record<string, number>
  div: { base: DivPt[]; qk: DivPt[] }
  notes: {
    div: string
    div2: string
    d50: string
    ab: string
    ratio: string
    ch6: string
    fits: string[]
    honest: string
  }
  ok: string[]
}

const DATA = rawData as unknown as ScalingData
const F = DATA.fit
const TRAIN = DATA.rows.filter((r) => r.in_fit)
const SMALL = DATA.rows.filter((r) => r.kind === 'train' && r.N <= F.holdout_N)
const DCOL = ['#B9B5AA', '#8FA7D9', '#3a63c0', '#1f3a7a', '#0b1a3d']
const VALS = TRAIN.map((r) => r.val)
const VMIN = Math.min(...VALS)
const VMAX = Math.max(...VALS)

const LAW_NAME = 'scaling law \u00b7 规模定律'
const LAW_DEF = '模型最终 loss 随参数量 N、训练 token 数 D 按幂律下降的经验规律。常用形式 L(N, D) = E + A/N^α + B/D^β,用小模型拟合出系数,再外推到大模型。'
const QK_DEF = '算注意力分数之前,先对 q、k 各做一次 LayerNorm(按头),分数的量级就不会随训练无限变大。用来防止注意力 logit 增长导致的训练发散。'
const OPT_NAME = '算力最优 \u00b7 compute-optimal'
const OPT_DEF = '给定训练算力 C \u2248 6ND,让预测 loss 最小的那一组 (N, D)。Chinchilla 的结论是 N 和 D 大致同比例增长,约每个参数 20 个 token。'
const BOOT_NAME = 'bootstrap \u00b7 自助重抽样'
const BOOT_DEF = '从拟合点里有放回地随机抽同样多个点,重新拟合,重复几百次,看预测值的分布。用来估计只有少量数据点时,一个拟合结果有多不稳定。'

type XY = [number, number]
type Series = {
  pts?: XY[]
  col?: string
  dash?: boolean
  dots?: boolean
  r?: number
  w?: number
  label?: string
  hollow?: boolean
  line?: boolean
  band?: boolean
  x?: number
  lo?: number
  hi?: number
  vline?: number
}
type ChartOpts = {
  h?: number
  x0: number
  x1: number
  y0: number
  y1: number
  ystep: number
  ylog?: boolean
  yfix?: number
  xticks: number[]
  xlabel: string
}

function byName(name: string) {
  const r = SMALL.find((row) => row.name === name)
  if (!r) throw new Error(name)
  return r
}

const SIZES = [...new Set(SMALL.map((r) => r.name))].sort((a, b) => byName(a).N - byName(b).N)
const DS = [...new Set(SMALL.map((r) => Math.round(r.D / 1e6)))].sort((a, b) => a - b)

function fN(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
  return (n / 1e3).toFixed(0) + 'K'
}

function withBold(text: string): ReactNode[] {
  const parts = text.split(/(<b>|<\/b>)/)
  const out: ReactNode[] = []
  let bold = false
  for (const part of parts) {
    if (part === '<b>') { bold = true; continue }
    if (part === '</b>') { bold = false; continue }
    out.push(bold ? <b key={out.length}>{part}</b> : part)
  }
  return out
}

function lossOf(f: { E: number; A: number; alpha: number; B: number; beta: number }, n: number, d: number) {
  return f.E + f.A / Math.pow(n, f.alpha) + f.B / Math.pow(d, f.beta)
}

function pick(name: string, dm: number) {
  return TRAIN.find((r) => r.name === name && Math.round(r.D / 1e6) === dm)
}

function pickAny(name: string, dm: number) {
  return SMALL.find((r) => r.name === name && Math.round(r.D / 1e6) === dm)
}

function curveOf(r: Row) {
  if (!r.curve) throw new Error(r.id)
  return r.curve
}

function heat(v: number) {
  const t = (v - VMIN) / (VMAX - VMIN)
  const a = [58, 99, 192]
  const b = [242, 217, 206]
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t))
  return `rgb(${c.join(',')})`
}

function pointOf(f: Fit, id: string) {
  const p = f.pts[id]
  if (!p) throw new Error(id)
  return p
}

function reach(f: Fit, c: Check) {
  const n = c.N / f.maxN
  const d = c.D / f.maxD
  const parts: string[] = []
  if (n > 1.05) parts.push('N \u00d7' + n.toFixed(1))
  if (d > 1.05) parts.push('D \u00d7' + d.toFixed(0))
  return parts.length ? parts.join('\u3001') : '范围内'
}

const EMB_SHARE = (() => {
  const r = TRAIN.find((row) => row.n_embd === 128)
  return r ? ((1 - r.N / DATA.ntot[r.name]) * 100).toFixed(0) + '%' : '\u2013'
})()

function Chart({ series, o }: { series: Series[]; o: ChartOpts }) {
  const W = 620
  const H = o.h || 250
  const L = 46
  const R = 16
  const T = 14
  const B = 36
  const lx = (v: number) => Math.log10(v)
  const xs = (v: number) => L + (lx(v) - lx(o.x0)) / (lx(o.x1) - lx(o.x0)) * (W - L - R)
  const yt = (v: number) => (o.ylog ? Math.log10(v) : v)
  const Y0 = yt(o.y0)
  const Y1 = yt(o.y1)
  const ys = (v: number) => T + (1 - (yt(v) - Y0) / (Y1 - Y0)) * (H - T - B)
  const yticks: number[] = []
  if (o.ylog) {
    for (let k = Math.ceil(Y0); k <= Math.floor(Y1); k += o.ystep || 1) yticks.push(Math.pow(10, k))
  } else {
    for (let v = o.y0; v <= o.y1 + 1e-9; v += o.ystep) yticks.push(v)
  }
  const ylab = (v: number) => (o.ylog
    ? (v >= 1e6 ? v / 1e6 + 'M' : v >= 1e3 ? v / 1e3 + 'K' : String(v))
    : v.toFixed(o.yfix || 1))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', fontFamily: 'ui-monospace,monospace' }}>
      {yticks.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke="#E5E2D9" />
          <text x={L - 6} y={ys(v) + 4} fontSize="10.5" textAnchor="end" fill="#6B6B68">{ylab(v)}</text>
        </g>
      ))}
      {o.xticks.map((v) => (
        <text key={v} x={xs(v)} y={H - B + 15} fontSize="10.5" textAnchor="middle" fill="#6B6B68">{fN(v)}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 4} fontSize="10.5" textAnchor="middle" fill="#6B6B68">{o.xlabel}</text>
      {series.map((se, i) => {
        if (se.band) {
          return <line key={i} x1={xs(se.x ?? 1)} x2={xs(se.x ?? 1)} y1={ys(Math.max(o.y0, se.lo ?? o.y0))} y2={ys(Math.min(o.y1, se.hi ?? o.y1))} stroke="#cfc9ba" strokeWidth={10} strokeLinecap="round" />
        }
        if (se.vline !== undefined) {
          return <line key={i} x1={xs(se.vline)} x2={xs(se.vline)} y1={T} y2={H - B} stroke={se.col} strokeDasharray="4 4" />
        }
        const pts = (se.pts ?? []).filter((p) => (o.ylog ? p[1] > 0 : p[1] >= o.y0 - 0.5 && p[1] <= o.y1 + 0.5))
        const last = pts[pts.length - 1]
        return (
          <g key={i}>
            {se.line !== false && (
              <polyline fill="none" stroke={se.col} strokeWidth={se.w || 2} strokeDasharray={se.dash ? '5 4' : undefined} points={pts.map((p) => `${xs(p[0])},${ys(Math.max(o.y0, Math.min(o.y1, p[1])))}`).join(' ')} />
            )}
            {se.dots !== false && pts.map((p, j) => (
              <circle key={j} cx={xs(p[0])} cy={ys(p[1])} r={se.r || 3} fill={se.hollow ? '#fff' : se.col} stroke={se.col} strokeWidth={1.6} />
            ))}
            {se.label && last && (
              <text x={xs(last[0]) + 6} y={ys(last[1]) + 4} fontSize="10.5" fill={se.col}>{se.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Step1() {
  const [nIdx, setNIdx] = useState(Math.min(3, SIZES.length - 1))
  const [divIdx, setDivIdx] = useState(1)
  const name = SIZES[nIdx]
  const all = DS.map((d) => pickAny(name, d)).filter((r): r is Row => !!r)
  const runs = all.filter((r) => r.in_fit)
  const r0 = runs[0]
  const last = runs[runs.length - 1]
  const at100 = runs.find((r) => Math.round(r.D / 1e6) === 100)
  const colOf = (r: Row) => (r.in_fit ? DCOL[DS.indexOf(Math.round(r.D / 1e6))] : '#9a3a22')
  const mid = curveOf(last).reduce((best, c) => (Math.abs(c.tokens - 1e8) < Math.abs(best.tokens - 1e8) ? c : best))
  const divKey = (['val', 'att', 'gnorm'] as const)[divIdx]
  const divSeries: Series[] = (['base', 'qk'] as const).map((k, i) => ({
    pts: DATA.div[k].map((p) => [p.tokens, p[divKey]] as XY),
    col: i === 0 ? '#9a3a22' : '#3f7d63',
    r: 2,
  }))
  if (divIdx === 2) {
    divSeries.push({ pts: [[7e6, 1], [4.5e8, 1]], col: '#6B6B68', dash: true, dots: false, w: 1, label: '裁剪阈值 1.0' })
  }
  const divOpt: ChartOpts = divIdx === 0
    ? { x0: 7e6, x1: 4.5e8, y0: 4, y1: 7, ystep: 0.5, yfix: 1, xticks: [1e7, 3e7, 1e8, 3e8], xlabel: '已训 token 数(对数)', h: 230 }
    : { x0: 7e6, x1: 4.5e8, y0: divIdx === 1 ? 1 : 0.1, y1: divIdx === 1 ? 1e8 : 1e4, ystep: 1, ylog: true, xticks: [1e7, 3e7, 1e8, 3e8], xlabel: '已训 token 数(对数) \u00b7 纵轴对数', h: 230 }
  return (
    <div className={styles.scope}>
      <h2>① 一批小模型,各训几档 token</h2>
      <p className="lead">
        5 种宽度 / 深度,每种训 4 次:5000 万、1 亿、2 亿、4 亿 token;较大的三种再各训一次 16 亿。每次学习率都按自己的总步数从头做 warmup + 余弦退火。 选一个模型,看它各次训练的 val loss 曲线(红色虚线是发散、不参加拟合的那次):
      </p>
      <div className="btn-row small">
        {SIZES.map((n, i) => (
          <button key={n} type="button" className={i === nIdx ? 'btn primary' : 'btn'} onClick={() => setNIdx(i)}>N = {fN(byName(n).N)}</button>
        ))}
      </div>
      <div className="lab">
        <div className="scroll-x">
          <div style={{ minWidth: 560 }}>
            <Chart
              series={all.map((r) => ({
                pts: curveOf(r).map((c) => [c.tokens, c.val] as XY),
                col: colOf(r),
                dash: !r.in_fit,
                dots: curveOf(r).length < 15,
                r: 2.5,
                label: r.in_fit ? r.val.toFixed(2) : '发散',
              }))}
              o={{ x0: 5e6, x1: 2.5e9, y0: 3.5, y1: 8, ystep: 0.5, xticks: [1e7, 3e7, 1e8, 3e8, 1e9], xlabel: '已训 token 数(对数)\u00b7 纵轴 val loss' }}
            />
          </div>
        </div>
        <div className="legend">
          {all.map((r) => (
            <span key={r.id}><i style={{ background: colOf(r) }} />D = {fN(r.D)}{r.in_fit ? '' : '(发散)'}</span>
          ))}
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ fontSize: 15 }}>{r0.n_layer} 层 {'\u00d7'} {r0.n_embd}</div><div className="drl">层数 {'\u00d7'} 宽度</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{fN(r0.N)}</div><div className="drl">N(非嵌入参数)</div></div>
          <div className="dr"><div className="drv">{fN(DATA.ntot[name])}</div><div className="drl">算上嵌入的总参数</div></div>
          <div className="dr"><div className="drv">{DATA.minutes[name].toFixed(0)} 分钟</div><div className="drl">{DATA.nruns[name]} 次训练合计用时</div></div>
        </div>
      </div>
      <div className="note">
        同一个模型,D 从 {fN(r0.D)} 到 {fN(last.D)},最终 val loss 从 {r0.val.toFixed(3)} 降到 <b>{last.val.toFixed(3)}</b>。{at100 ? <>训 {fN(last.D)} 那次在第 {fN(mid.tokens)} token 时是 {mid.val.toFixed(3)},单独训 1 亿并退火到底的那次是 {at100.val.toFixed(3)}。</> : null}
      </div>
      <div className="codepath">↳ 代码:<b>18_scaling.py train</b>(模型与第 6 章 <code>04_gpt2_124m.py</code> 相同,层数 / 宽度可调){'\u00b7 '}网格 <code>runs/queue_scaling.sh</code></div>
      <Dig title="为什么每档 D 都要从头训,不能训一次 4 亿、中途记 loss?">
        学习率的余弦退火要在训练结束时降到底,loss 才降到这个 D 能达到的水平。训 4 亿 token 的那次,在第 1 亿 token 时学习率还很高,loss 比专门训 1 亿、退火到底的那次要高。
        Chinchilla 论文(Hoffmann et al., arXiv 2203.15556)指出 Kaplan 等人对所有模型用了同样的训练 token 数和学习率计划,认为这是两篇结论不同的原因之一;Chinchilla 自己让退火长度和训练 token 数匹配。
        图里 4 亿那条曲线在 1 亿处的值,可以和单独训 1 亿那条的终点比一比。
      </Dig>
      <Dig title="为什么 N 不算嵌入参数?">
        这批小模型的词表都是 50,304,嵌入表 50,304 {'\u00d7'} 宽度:宽度 128 的模型,嵌入占 <b>{EMB_SHARE}</b>,Transformer 层只有 0.6M。
        算上嵌入,小模型的"大小"几乎全由词表决定。Kaplan et al.(arXiv 2001.08361)图 6 显示,只数非嵌入参数时,不同深宽比的模型落在同一条曲线上,所以用这个口径。
        Chinchilla 数的是全部参数,两篇的系数因此不能直接互相套用。
      </Dig>
      <Dig title="有两次训练的 loss 后半程往上走,是怎么回事?">
        <p style={{ margin: '0 0 8px' }}>
          L4_d192 训 4 亿 token、L6_d256 训 16 亿 token 这两次,val loss 先降后升。原因是注意力分数失控,可以用{' '}
          <Term k="qk-norm" name="qk-norm" def={QK_DEF}>qk-norm</Term>
          {' '}修好。下图是 L4_d192 {'\u00b7'} 4 亿 token 这次的原结构与加 qk-norm 对照(同配置、同随机种子):
        </p>
        <p style={{ margin: '0 0 8px' }}>{DATA.notes.div}</p>
        <div className="btn-row small">
          {['val loss', '第 2 层注意力分数最大值', '梯度范数(裁剪前)'].map((label, i) => (
            <button key={label} type="button" className={i === divIdx ? 'btn primary' : 'btn'} onClick={() => setDivIdx(i)}>{label}</button>
          ))}
        </div>
        <div className="scroll-x">
          <div style={{ minWidth: 520, background: '#fff', borderRadius: 2 }}>
            <Chart series={divSeries} o={divOpt} />
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--bad)' }} />原结构</span>
          <span><i style={{ background: 'var(--good)' }} />加 qk-norm</span>
        </div>
        <p style={{ margin: '8px 0 0' }}>{withBold(DATA.notes.div2)}</p>
      </Dig>
      <div className="next-hint">↳ 下一步:把各次训练的终点摆进一张 N {'\u00d7'} D 的表,看 loss 往哪个方向降得快。</div>
    </div>
  )
}

function Step2() {
  const [hm, setHm] = useState({ n: SIZES[2], d: DS[1] })
  const rowR = DS.map((d) => pick(hm.n, d)).filter((r): r is Row => !!r)
  const colR = SIZES.map((n) => pick(n, hm.d)).filter((r): r is Row => !!r)
  const row0 = rowR[0]
  const rl = rowR[rowR.length - 1]
  const col0 = colR[0]
  const cl = colR[colR.length - 1]
  return (
    <div className={styles.scope}>
      <h2>② N 和 D 两个方向</h2>
      <p className="lead">每格是一次训练的最终 val loss,颜色越深越低。点一格,下面画出同一行(同样 N、D 变)和同一列(同样 D、N 变)的变化,横轴都是对数:</p>
      <div className="lab scroll-x">
        <table className="hm">
          <thead>
            <tr>
              <th>N \ D</th>
              {DS.map((d) => <th key={d}>{fN(d * 1e6)}</th>)}
            </tr>
          </thead>
          <tbody>
            {SIZES.slice().reverse().map((n) => (
              <tr key={n}>
                <th>{fN(byName(n).N)}</th>
                {DS.map((d) => {
                  const r = pick(n, d)
                  const x = pickAny(n, d)
                  if (!r) {
                    if (x) {
                      return <td key={d} style={{ background: 'var(--bad-soft)', color: 'var(--bad)', cursor: 'default', fontSize: 11 }}>{x.val.toFixed(2)}<br />发散</td>
                    }
                    return <td key={d} style={{ cursor: 'default', color: '#cfc9ba' }}>{'\u2013'}</td>
                  }
                  const t = (r.val - VMIN) / (VMAX - VMIN)
                  const on = n === hm.n && d === hm.d
                  return (
                    <td key={d} className={on ? 'sel' : undefined} style={{ background: heat(r.val), color: t < 0.55 ? '#fff' : '#1A1A18' }} onClick={() => setHm({ n, d })}>{r.val.toFixed(3)}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lab">
        <div className="scroll-x">
          <div style={{ minWidth: 560 }}>
            <Chart
              series={[
                { pts: rowR.map((r) => [r.D / row0.D, r.val] as XY), col: '#3a63c0' },
                { pts: colR.map((r) => [r.N / col0.N, r.val] as XY), col: '#3f7d63' },
              ]}
              o={{ x0: 1, x1: 50, y0: 3, y1: 6.5, ystep: 0.5, xticks: [1, 2, 4, 8, 16, 32], xlabel: '相对最小那档的倍数(对数)\u00b7 纵轴 val loss', h: 230 }}
            />
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--e1)' }} />固定 N,D 变</span>
          <span><i style={{ background: 'var(--e2)' }} />固定 D,N 变</span>
        </div>
      </div>
      <div className="note">
        N = {fN(byName(hm.n).N)} 这一行,D 从 {fN(row0.D)} 到 {fN(rl.D)}({Math.round(rl.D / row0.D)} 倍),loss 变化 <b>{(rl.val - row0.val).toFixed(3)}</b>;{colR.length > 1
          ? <>D = {fN(hm.d * 1e6)} 这一列,N 从 {fN(col0.N)} 到 {fN(cl.N)}({(cl.N / col0.N).toFixed(0)} 倍),loss 变化 <b>{(cl.val - col0.val).toFixed(3)}</b>。</>
          : <>D = {fN(hm.d * 1e6)} 这一列只有一个拟合点。</>}
      </div>
      <Dig title="为什么 D = 50M 那一列的 loss 都挤在一起?">{DATA.notes.d50}</Dig>
      <div className="next-hint">↳ 下一步:两个方向各自按幂律下降,还有一个降不下去的底。把它写成一个公式来拟合。</div>
    </div>
  )
}

function Step3() {
  const [nExp, setNExp] = useState('7')
  const [dExp, setDExp] = useState('8.3')
  const n = Math.pow(10, +nExp)
  const d = Math.pow(10, +dExp)
  const np = F.A / Math.pow(n, F.alpha)
  const dp = F.B / Math.pow(d, F.beta)
  const loss = F.E + np + dp
  let best: { r: Row; dist: number } | null = null
  for (const r of DATA.rows) {
    if (r.role === 'excluded') continue
    const dist = Math.abs(Math.log10(r.N / n)) + Math.abs(Math.log10(r.D / d))
    if (!best || dist < best.dist) best = { r, dist }
  }
  return (
    <div className={styles.scope}>
      <h2>③ 拟合 L(N, D) = E + A/N<sup>α</sup> + B/D<sup>β</sup></h2>
      <p className="lead">
        <b>E</b> 是数据本身的不确定性,模型再大、数据再多也降不下去;<b>A/N<sup>α</sup></b> 是模型太小欠的账,<b>B/D<sup>β</sup></b> 是数据太少欠的账。 按 Chinchilla §3.3,对 log L 做 Huber 回归、L-BFGS 求解,拟合用 21 个点(发散的两个不算)。拖两个滑块,看预测的 loss 由三部分怎么组成:
      </p>
      <div className="formula">
        L = <span className="t" style={{ background: '#ECEAE2' }}>{F.E.toFixed(3)}</span>
        {' + '}
        <span className="t" style={{ background: 'var(--e1s)' }}>{F.A.toPrecision(3)} / N<sup>{F.alpha.toFixed(3)}</sup></span>
        {' + '}
        <span className="t" style={{ background: 'var(--e2s)' }}>{F.B.toPrecision(3)} / D<sup>{F.beta.toFixed(3)}</sup></span>
      </div>
      <div className="lab">
        <div className="rk-row">
          <label>N(非嵌入参数)</label>
          <input type="range" min={5} max={9} step={0.05} value={nExp} onChange={(e) => setNExp(e.target.value)} />
          <span className="rk-val">{fN(n)}</span>
        </div>
        <div className="rk-row">
          <label>D(训练 token)</label>
          <input type="range" min={7.5} max={10.5} step={0.05} value={dExp} onChange={(e) => setDExp(e.target.value)} />
          <span className="rk-val">{fN(d)}</span>
        </div>
        <div className="stack">
          <div style={{ width: `${F.E / 8 * 100}%`, background: '#6B6B68' }}>E {F.E.toFixed(2)}</div>
          <div style={{ width: `${np / 8 * 100}%`, background: 'var(--e1)' }}>{np > 0.25 ? np.toFixed(2) : ''}</div>
          <div style={{ width: `${dp / 8 * 100}%`, background: 'var(--e2)' }}>{dp > 0.25 ? dp.toFixed(2) : ''}</div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#6B6B68' }} />E 数据的底</span>
          <span><i style={{ background: 'var(--e1)' }} />A/N<sup>α</sup> 模型太小</span>
          <span><i style={{ background: 'var(--e2)' }} />B/D<sup>β</sup> 数据太少</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{loss.toFixed(3)}</div><div className="drl">预测 loss</div></div>
          <div className="dr"><div className="drv">{np.toFixed(3)}</div><div className="drl">模型项</div></div>
          <div className="dr"><div className="drv">{dp.toFixed(3)}</div><div className="drl">数据项</div></div>
          <div className="dr"><div className="drv" style={{ fontSize: 14 }}>{best && best.dist < 0.08 ? `${best.r.val.toFixed(3)}(预测 ${best.r.pred.toFixed(3)})` : '附近没有'}</div><div className="drl">最近的实测点</div></div>
        </div>
      </div>
      <div className="note">
        {np > dp
          ? `现在模型项(${np.toFixed(3)})比数据项(${dp.toFixed(3)})大:再加数据收益小,该加参数。`
          : `现在数据项(${dp.toFixed(3)})比模型项(${np.toFixed(3)})大:该多训 token。`}
      </div>
      <div className="codepath">↳ 代码:<b>18_scaling.py fit</b> 的 <code>fit_params</code>(4500 组初值,取初始损失最小的 64 组跑 L-BFGS)</div>
      <Dig title="拟合出的 α、β 和 Chinchilla 论文的对得上吗?">{DATA.notes.ab}</Dig>
      <Dig title="为什么对 log L 拟合,还要用 Huber 损失?">
        对 log L 拟合,相当于看相对误差,loss 6 和 loss 4 的点权重相近。Huber 损失在残差小于 δ(这里 1e-3,同 Chinchilla)时是平方,大于 δ 时变成线性, 个别偏离的点(比如退火不充分的短训练)不会把整条曲线拉歪。参数写成 A = e<sup>a</sup>、B = e<sup>b</sup>、E = e<sup>e</sup>,log L{'\u0302'} 用 log-sum-exp 算,数值更稳。
      </Dig>
      <div className="next-hint">↳ 下一步:有了公式,就能回答一个预算问题:给定算力,模型该多大、训多少 token?</div>
    </div>
  )
}

function Step4() {
  const [cExp, setCExp] = useState('17')
  const C = Math.pow(10, +cExp)
  const Ns: number[] = []
  for (let e = 5; e <= 10.5; e += 0.05) Ns.push(Math.pow(10, e))
  const nopt = F.G * Math.pow(C / 6, F.beta / (F.alpha + F.beta))
  const dopt = C / 6 / nopt
  const lopt = lossOf(F, nopt, dopt)
  const y0 = Math.max(2, Math.floor((lopt - 0.3) * 2) / 2)
  const y1 = y0 + 3
  return (
    <div className={styles.scope}>
      <h2>④ 算力怎么分:固定 C,N 和 D 此消彼长</h2>
      <p className="lead">
        训练算力约 <code>C {'\u2248'} 6{'\u00b7'}N{'\u00b7'}D</code>(每个 token 前向 2N、反向 4N 次浮点运算)。C 固定时,模型越大能训的 token 越少。 拖 C,曲线是公式预测的 loss 随 N 的变化,最低点就是这个预算下的{' '}
        <Term k="compute-optimal" name={OPT_NAME} def={OPT_DEF}>算力最优</Term>
        {' '}模型大小:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>算力 C(FLOPs)</label>
          <input type="range" min={15} max={21} step={0.1} value={cExp} onChange={(e) => setCExp(e.target.value)} />
          <span className="rk-val">{C.toExponential(0).replace('e+', 'e')}</span>
        </div>
        <div className="scroll-x">
          <div style={{ minWidth: 560 }}>
            <Chart
              series={[
                { pts: Ns.map((n) => [n, lossOf(F, n, C / 6 / n)] as XY), col: '#D97757', dots: false },
                { vline: nopt, col: '#3a63c0' },
                { pts: [[nopt, lopt]], col: '#3a63c0', line: false, r: 5 },
              ]}
              o={{ x0: 1e5, x1: 3e10, y0, y1, ystep: 0.5, xticks: [1e6, 1e7, 1e8, 1e9, 1e10], xlabel: 'N(对数);D = C / 6N \u00b7 纵轴预测 loss', h: 250 }}
            />
          </div>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{fN(nopt)}</div><div className="drl">最优 N</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e2)' }}>{fN(dopt)}</div><div className="drl">最优 D</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{(dopt / nopt).toFixed(0)}</div><div className="drl">D / N(每个参数几个 token)</div></div>
          <div className="dr"><div className="drv">{lopt.toFixed(3)}</div><div className="drl">这个预算下的最低 loss</div></div>
        </div>
      </div>
      <div className="note">
        C = {C.toExponential(1)} FLOPs:最优约 N = <b>{fN(nopt)}</b>、D = <b>{fN(dopt)}</b>。比它小的模型数据项占主导,比它大的模型训不到足够 token。C 每乘 10,最优 N 乘 10<sup>β/(α+β)</sup> = {Math.pow(10, F.beta / (F.alpha + F.beta)).toFixed(2)},最优 D 乘 {Math.pow(10, F.alpha / (F.alpha + F.beta)).toFixed(2)}。
      </div>
      <div className="codepath">↳ 代码:<b>18_scaling.py fit</b> 末尾:<code>N_opt = G {'\u00b7'} (C/6)^(β/(α+β))</code>,G = (αA / βB)<sup>1/(α+β)</sup></div>
      <Dig title="这里算出的 D/N 为什么远大于 Chinchilla 的 20?">{DATA.notes.ratio}</Dig>
      <Dig title="第 6 章的 124M 按这个标准训多了还是少了?">{DATA.notes.ch6}</Dig>
      <div className="next-hint">↳ 下一步:把第 6 章的 N = 85.1M、D = 10B 代进公式,和那次真实训练对照。</div>
    </div>
  )
}

function MissChart({ fit, sel }: { fit: Fit; sel: number }) {
  const W = 620
  const H = 190
  const L = 46
  const R = 16
  const T = 12
  const B = 40
  const cs = DATA.checks
  const bw = (W - L - R) / cs.length
  const ys = (v: number) => T + (1 - (v + 0.45) / 0.6) * (H - T - B)
  const ticks = [-0.4, -0.3, -0.2, -0.1, 0, 0.1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', fontFamily: 'ui-monospace,monospace' }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke={v === 0 ? '#6B6B68' : '#E5E2D9'} />
          <text x={L - 6} y={ys(v) + 4} fontSize="10.5" textAnchor="end" fill="#6B6B68">{v.toFixed(1)}</text>
        </g>
      ))}
      {cs.map((c, i) => {
        const p = pointOf(fit, c.id)
        const x = L + i * bw + bw * 0.2
        const w = bw * 0.6
        const label = c.id === 'ckpt' ? '124M \u00b7 10B' : `${fN(c.N)} \u00b7 ${fN(c.D)}`
        if (p.role === 'fit') {
          return (
            <g key={c.id}>
              <text x={L + i * bw + bw / 2} y={H - B + 14} fontSize="10" textAnchor="middle" fill="#6B6B68">{label}</text>
              <text x={L + i * bw + bw / 2} y={ys(0) - 6} fontSize="10" textAnchor="middle" fill="#6B6B68">参加拟合</text>
            </g>
          )
        }
        const m = c.val - p.pred
        const y = Math.min(ys(0), ys(m))
        const h = Math.abs(ys(m) - ys(0))
        return (
          <g key={c.id}>
            <text x={L + i * bw + bw / 2} y={H - B + 14} fontSize="10" textAnchor="middle" fill="#6B6B68">{label}</text>
            <rect x={x} y={y} width={w} height={Math.max(1, h)} rx={3} fill={i === sel ? '#D97757' : Math.abs(m) > 0.1 ? '#c98a74' : '#b9b5aa'} />
            <text x={x + w / 2} y={m < 0 ? ys(m) + 12 : ys(m) - 4} fontSize="10.5" textAnchor="middle" fill="#1A1A18">{(m >= 0 ? '+' : '') + m.toFixed(2)}</text>
          </g>
        )
      })}
      <text x={(L + W - R) / 2} y={H - 6} fontSize="10.5" textAnchor="middle" fill="#6B6B68">按离拟合范围的远近从左到右排</text>
    </svg>
  )
}

function Step5() {
  const [fitIdx, setFitIdx] = useState(1)
  const [hold, setHold] = useState(DATA.checks.length - 1)
  const f = DATA.fits[fitIdx]
  const c = DATA.checks[hold]
  const p = pointOf(f, c.id)
  const ds: number[] = []
  for (let e = 7.5; e <= 10.3; e += 0.05) ds.push(Math.pow(10, e))
  const series: Series[] = [{ pts: ds.map((d) => [d, lossOf(f, c.N, d)] as XY), col: '#D97757', dots: false }]
  if (p.lo !== undefined && p.hi !== undefined) series.push({ band: true, x: c.D, lo: p.lo, hi: p.hi })
  series.push({ pts: [[c.D, c.val]], col: '#1A1A18', line: false, r: 5 })
  series.push({ pts: [[c.D, p.pred]], col: '#D97757', line: false, r: 5, hollow: true })
  return (
    <div className={styles.scope}>
      <h2>⑤ 外推到 124M,和真实训练对照</h2>
      <p className="lead">
        下面几个点都没参加拟合,按离拟合范围的远近排:往 D 方向外推的 16 亿 token 训练、往 N 方向外推的 49M 与 124M 结构(4 亿 token),以及第 6 章训了 10B token 的 124M。 灰色区间是{' '}
        <Term k="bootstrap" name={BOOT_NAME} def={BOOT_DEF}>bootstrap</Term>
        {' '}的 90% 范围(拟合点有放回地重抽、重新拟合 200 次)。先选用哪批点拟合,再点一行:
      </p>
      <div className="btn-row small">
        {DATA.fits.map((item, i) => (
          <button key={item.key} type="button" className={i === fitIdx ? 'btn primary' : 'btn'} onClick={() => setFitIdx(i)}>{item.label} {'\u00b7'} {item.n_fit} 点</button>
        ))}
      </div>
      <div className="formula" style={{ fontSize: 16 }}>
        L = {f.E.toFixed(3)} + {f.A.toPrecision(3)} / N<sup>{f.alpha.toFixed(3)}</sup> + {f.B.toPrecision(3)} / D<sup>{f.beta.toFixed(3)}</sup>
      </div>
      <div className="lab scroll-x">
        <table className="tb">
          <thead>
            <tr>
              <th>检验点</th><th>N</th><th>D</th><th>超出拟合范围</th><th>实测</th><th>预测</th><th>实测 {'\u2212'} 预测</th><th>bootstrap 90%</th>
            </tr>
          </thead>
          <tbody>
            {DATA.checks.map((row, i) => {
              const pt = pointOf(f, row.id)
              const inFit = pt.role === 'fit'
              const diff = row.val - pt.pred
              return (
                <tr key={row.id} className={i === hold ? 'hl' : undefined} style={{ cursor: 'pointer' }} onClick={() => setHold(i)}>
                  <td>{row.label}</td>
                  <td>{fN(row.N)}</td>
                  <td>{fN(row.D)}</td>
                  <td>{inFit ? '\u2013' : reach(f, row)}</td>
                  <td><b>{row.val.toFixed(3)}</b></td>
                  {inFit ? (
                    <td colSpan={3} style={{ textAlign: 'center', color: '#6B6B68' }}>这组拟合里参加了拟合</td>
                  ) : (
                    <>
                      <td>{pt.pred.toFixed(3)}</td>
                      <td style={{ color: Math.abs(diff) > 0.1 ? '#9a3a22' : '#1A1A18' }}>{(diff >= 0 ? '+' : '') + diff.toFixed(3)}</td>
                      <td>{pt.lo !== undefined && pt.hi !== undefined ? `${pt.lo.toFixed(3)} \u2013 ${pt.hi.toFixed(3)}` : '\u2013'}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="lab">
        <div className="mini-h">实测 {'\u2212'} 预测(负数 = 实测比预测好)</div>
        <div className="scroll-x"><div style={{ minWidth: 560 }}><MissChart fit={f} sel={hold} /></div></div>
      </div>
      <div className="lab">
        <div className="scroll-x">
          <div style={{ minWidth: 560 }}>
            <Chart series={series} o={{ x0: 3e7, x1: 2e10, y0: 2.5, y1: 5.5, ystep: 0.5, xticks: [1e8, 1e9, 1e10], xlabel: `D(对数)\u00b7 橙线:这组公式在 N = ${fN(c.N)} 下的预测 \u00b7 黑点:实测 \u00b7 空心:预测 \u00b7 灰条:bootstrap 90%` }} />
          </div>
        </div>
      </div>
      <div className="note">{withBold(DATA.notes.fits[fitIdx])}</div>
      <Dig title="为什么外推总是偏高,主拟合的 bootstrap 区间也没盖住实测?">{DATA.notes.honest}</Dig>
      <Dig title="第 6 章的 124M 和这批小模型的训练配方一样吗?">
        结构、分词器、数据、上下文长度、AdamW 设置、学习率峰值(宽度 768 按本章规则也是 6e-4)与余弦退火到 10% 都相同。不同的是两处:第 6 章每步 524,288 个 token(本章 65,536,8 倍), warmup 715 步(本章 100 步)。本章按同一配方训了 124M 结构 4 亿 token 的点,公式对它的预测也偏高(见表中「12 层 {'\u00d7'} 768」一行), 说明误差不全来自配方差异。要把配方的影响单独拆出来,得按本章配方把 124M 训满 10B token,在这块 4090 上约一天。
      </Dig>
      <Dig title="重评的 124M 为什么是 3.0301,不是第 6 章写的 3.02?">
        评测口径不同。第 6 章训练脚本每次只在 val shard 开头取 20 批 × 8 × 1024 = 163,840 个 token; 本章所有点(包括这个 124M)统一用开头 40 批 = 327,680 个 token,bf16 前向。拟合点和检验点必须用同一个口径,所以 124M 也按本章口径重评。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测</div>
      <ul className="checklist">
        {DATA.ok.map((t) => (
          <li key={t}><span className="ck">✓</span><div>{withBold(t)}</div></li>
        ))}
      </ul>
      <div className="codepath">↳ 跑法:<code>bash runs/queue_scaling.sh</code>(CUDA,4090 上约 7.1 小时){'\u00b7 '}<code>python 18_scaling.py fit runs/s_*.json --exclude L4_d192_D400M L6_d256_D1600M --out runs/ch20_fit.json</code>(CPU;加 <code>--max-d 400e6</code> / <code>--holdout 1e9</code> 得到另两组拟合)</div>
    </div>
  )
}

export function ScalingLaw() {
  const chapter = findChapter('scaling-law')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="scaling-law"
      title="Scaling Law:用小模型预测 124M 的 loss"
      subtitle={
        <>
          第 6 章花了 4090 一整天,把 124M 训了 10B token。能不能先训一批小模型(每个几分钟到两小时),算出大模型会训到多少?{' '}
          <Term k="scaling-law" name={LAW_NAME} def={LAW_DEF}>Scaling law</Term>
          {' '}的做法:参数量 N 从 0.6M 到 25M,每个配几档训练 token 数 D,拟合 <code>L(N, D) = E + A/N^α + B/D^β</code>,再把第 6 章的 N 和 D 代进去。 这次的预测是 3.36,实测 3.03,偏高 0.33;这一关把误差从哪来也一起查清楚。配套代码 <code>phase5-fullstack/18_scaling.py</code>,全部在 RTX 4090 上训练,和第 6 章同一套 GPT-2 结构、分词器与 FineWeb-Edu 数据。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">N <b>0.6M {'\u2026'} 25M</b> <i>非嵌入参数 {'\u00b7'} 5 档</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">D <b>50M {'\u2026'} 1.6B</b> <i>训练 token {'\u00b7'} 4 档 + 16 亿</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">检验 <b>49M {'\u00b7'} 85M</b> <i>不参加主拟合</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">目标 <b>124M {'\u00b7'} 10B</b> <i>第 6 章,N=85.1M</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">batch <b>65,536</b> <i>token / 步</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECEAE2">评测 <b>327,680</b> <i>val token,所有点同一份</i></HpChip>
          <span className="hp-note">N 只数非嵌入参数(Kaplan 口径),124M 的非嵌入部分是 85.1M</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">{'🎉 Scaling Law \u00b7 通关'}</div>
          <div className="cs">你用一批小模型拟合出 L(N, D),外推到第 6 章训了一整天的 124M,看到外推越远误差越大、bootstrap 盖不住形状上的偏差,还排查了一次注意力分数失控的训练。下一关回到后训练:只给判分器,用 RL 教 124M 做加法。</div>
        </>
      }
    />
  )
}
