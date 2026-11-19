// 旧页 goto 不重置各步选择：滑块、写入、读的 key、β、α、指标、点选和层配方离开再回来都还在。
import { Fragment, useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  ALPHA, ALPHA_INIT, ARCH, COL, HEAD_COLORS, LM, LM_ORDER, MODES, N_VALS,
  RC_ORDER, RECALL, RECALL_NS, S1, SAMPLE, V2, V2_COL, WRITE_SEQ,
  ctxLabel, en, f2, fmtBytes, fmtCount, heatStyle, matMax, vec,
  type ArchSpec,
} from './linearAttentionData'
import styles from './LinearAttention.module.css'

type LmKey = typeof LM_ORDER[number]
type Mode = typeof MODES[number]
type ByLen = { '64': number; '128': number; '256': number; '512': number }
type Acc = { '8': number; '16': number; '24': number; '32': number }

const LENS = [64, 128, 256, 512]

function lenVal(byLen: ByLen, t: number) {
  if (t === 128) return byLen['128']
  if (t === 256) return byLen['256']
  if (t === 512) return byLen['512']
  return byLen['64']
}

function accAt(acc: Acc, n: number) {
  if (n === 8) return acc['8']
  if (n === 16) return acc['16']
  if (n === 24) return acc['24']
  return acc['32']
}

function mulSv(S: number[][], k: number[]) {
  return [S[0][0] * k[0] + S[0][1] * k[1], S[1][0] * k[0] + S[1][1] * k[1]]
}

function writeStep(S: number[][], k: number[], v: number[], mode: Mode, alpha: number, beta: number) {
  if (mode === 'linear') return S.map((row, r) => row.map((x, c) => x + v[r] * k[c]))
  const Sa = mode === 'gdn' ? S.map((row) => row.map((x) => alpha * x)) : S
  const vo = mulSv(Sa, k)
  return Sa.map((row, r) => row.map((x, c) => x + beta * (v[r] - vo[r]) * k[c]))
}

function runSeq(mode: Mode, alpha: number, beta: number) {
  const snaps: number[][][] = []
  let S = [[0, 0], [0, 0]]
  for (const e of WRITE_SEQ) {
    S = writeStep(S, e.k, e.v, mode, alpha, beta)
    snaps.push(S)
  }
  return { S, snaps }
}

type Arrow = { v: number[]; color: string; w?: number; op?: number; dash?: boolean; label?: string; id: string }

function Plane({ arrows, radius }: { arrows: Arrow[]; radius: number }) {
  const W = 250
  const C = W / 2
  const sc = (W / 2 - 18) / radius
  const clamp = (v: number) => Math.max(-radius, Math.min(radius, v))
  return (
    <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} role="img" aria-label="二维向量平面">
      <defs>
        {arrows.map((a, i) => (
          <marker key={a.id + i} id={'ah' + a.id + i} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={a.color} />
          </marker>
        ))}
      </defs>
      <rect x="1" y="1" width={W - 2} height={W - 2} rx="12" fill="#fff" stroke="var(--border)" />
      <line x1="10" y1={C} x2={W - 10} y2={C} stroke="var(--border)" />
      <line x1={C} y1="10" x2={C} y2={W - 10} stroke="var(--border)" />
      <circle cx={C + sc} cy={C} r="0" />
      <text x={C + sc} y={C + 13} fontSize="9" textAnchor="middle" fill="#9a978f" fontFamily="ui-monospace">1</text>
      <line x1={C + sc} y1={C - 3} x2={C + sc} y2={C + 3} stroke="#9a978f" />
      <line x1={C - 3} y1={C - sc} x2={C + 3} y2={C - sc} stroke="#9a978f" />
      {arrows.map((a, i) => {
        const x = C + clamp(a.v[0]) * sc
        const y = C - clamp(a.v[1]) * sc
        if (Math.hypot(a.v[0], a.v[1]) < 1e-6) {
          return <circle key={a.id + i} cx={C} cy={C} r="4" fill={a.color} />
        }
        return (
          <g key={a.id + i}>
            <line
              x1={C} y1={C} x2={x} y2={y}
              stroke={a.color}
              strokeWidth={a.w || 2.5}
              strokeDasharray={a.dash ? '5 4' : undefined}
              opacity={a.op ?? 1}
              markerEnd={'url(#ah' + a.id + i + ')'}
            />
            {a.label ? (
              <text
                x={x + (a.v[0] >= 0 ? 5 : -5)}
                y={y + (a.v[1] >= 0 ? -5 : 13)}
                fontSize="11"
                fontWeight="700"
                textAnchor={a.v[0] >= 0 ? 'start' : 'end'}
                fill={a.color}
                fontFamily="ui-monospace"
              >{a.label}</text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function Heat({ M, cls, digits }: { M: number[][]; cls: string; digits: number | null }) {
  const n = M[0].length
  const scale = Math.max(matMax(M), 1e-9)
  const cells = M.flatMap((row, r) => row.map((x, c) => (
    <div key={r + '-' + c} className="hc" style={heatStyle(x, scale)} title={String(x)}>
      {digits === null ? null : x.toFixed(digits)}
    </div>
  )))
  return (
    <div className={'heat ' + cls} style={{ gridTemplateColumns: 'repeat(' + n + ', auto)' }}>
      {cells}
    </div>
  )
}

function AlphaChart({ alphas }: { alphas: number[] }) {
  const W = 560
  const H = 210
  const L = 46
  const R = 14
  const T = 14
  const B = 34
  const NMAX = 10
  const x = (n: number) => L + (W - L - R) * n / NMAX
  const y = (v: number) => T + (H - T - B) * (1 - v)
  const ys: number[] = []
  for (let v = 0; v <= 1.0001; v += 0.25) ys.push(v)
  const xs: number[] = []
  for (let n = 0; n <= NMAX; n += 2) xs.push(n)
  const path = (a: number) => {
    let d = ''
    for (let i = 0; i <= 40; i++) {
      const n = NMAX * i / 40
      d += (i ? 'L' : 'M') + x(n).toFixed(1) + ',' + y(Math.pow(a, n)).toFixed(1)
    }
    return d
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="每个头的记忆保留曲线">
      {ys.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EEEBE1" />
          <text x={L - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#6B6B68" fontFamily="ui-monospace">{v.toFixed(2)}</text>
        </g>
      ))}
      {xs.map((n) => (
        <text key={n} x={x(n)} y={H - B + 16} fontSize="10" textAnchor="middle" fill="#6B6B68" fontFamily="ui-monospace">{n}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 4} fontSize="10.5" textAnchor="middle" fill="#6B6B68">过了几个 token(n)</text>
      <path d={path(ALPHA_INIT)} fill="none" stroke="#8C8A83" strokeWidth="2" strokeDasharray="5 4" />
      <text x={x(NMAX) - 4} y={y(Math.pow(ALPHA_INIT, NMAX)) - 6} fontSize="10.5" textAnchor="end" fill="#6B6B68" fontFamily="ui-monospace">开训时 α={ALPHA_INIT.toFixed(3)}</text>
      {alphas.map((a, h) => (
        <path key={h} d={path(a)} fill="none" stroke={HEAD_COLORS[h]} strokeWidth="2.4" />
      ))}
    </svg>
  )
}

function LossChart({ zoom, sel }: { zoom: number; sel: LmKey }) {
  const W = 600
  const H = 300
  const L = 52
  const R = 90
  const T = 16
  const B = 38
  const y0 = zoom === 0 ? 1.4 : 1.5
  const y1 = zoom === 0 ? 3.6 : 1.7
  const x = (i: number) => L + (W - L - R) * i / 3
  const y = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0))
  const step = zoom === 0 ? 0.4 : 0.04
  const ys: number[] = []
  for (let v = y0; v <= y1 + 1e-9; v += step) ys.push(v)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="不同上下文长度下的 val loss">
      <defs>
        <clipPath id="s4clip">
          <rect x={L} y={T} width={W - L - R} height={H - T - B} />
        </clipPath>
      </defs>
      {ys.map((v) => (
        <g key={v.toFixed(4)}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EEEBE1" />
          <text x={L - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#6B6B68" fontFamily="ui-monospace">{v.toFixed(2)}</text>
        </g>
      ))}
      {LENS.map((t, i) => (
        <text key={t} x={x(i)} y={H - B + 16} fontSize="10.5" textAnchor="middle" fill="#6B6B68" fontFamily="ui-monospace">{t}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 4} fontSize="10.5" textAnchor="middle" fill="#6B6B68">测试时的上下文长度(训练只见过 64)</text>
      <g clipPath="url(#s4clip)">
        {LM_ORDER.map((k) => {
          const row = LM[k]
          const on = k === sel
          const d = LENS.map((t, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(lenVal(row.byLen, t)).toFixed(1)).join('')
          return (
            <g key={k}>
              <path d={d} fill="none" stroke={COL[k]} strokeWidth={on ? 3.6 : 2} opacity={on ? 1 : 0.55} />
              {LENS.map((t, i) => (
                <circle key={t} cx={x(i)} cy={y(lenVal(row.byLen, t))} r={on ? 4.5 : 3} fill={COL[k]} opacity={on ? 1 : 0.7} />
              ))}
            </g>
          )
        })}
      </g>
      {LM_ORDER.map((k, j) => {
        const v = lenVal(LM[k].byLen, 512)
        const yy = y(Math.min(y1, v))
        const ty = zoom === 0 ? (k === 'attn' ? yy + 4 : y(1.62) + (j - 1) * 13) : T + 14 + j * 15
        return (
          <text key={k} x={W - R + 8} y={ty} fontSize="10.5" fontWeight={k === sel ? 700 : 400} fill={COL[k]} fontFamily="ui-monospace">
            {LM[k].short} {v.toFixed(3)}{v > y1 ? ' ↑' : ''}
          </text>
        )
      })}
    </svg>
  )
}

function RecallCurve() {
  const W = 600
  const H = 280
  const L = 46
  const R = 92
  const T = 14
  const B = 38
  const XM = 6000
  const YM = 5.2
  const x = (v: number) => L + (W - L - R) * v / XM
  const y = (v: number) => T + (H - T - B) * (1 - v / YM)
  const ys = [0, 1, 2, 3, 4, 5]
  const xs = [0, 1000, 2000, 3000, 4000, 5000, 6000]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="检索任务训练曲线">
      {ys.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EEEBE1" />
          <text x={L - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#6B6B68" fontFamily="ui-monospace">{v}</text>
        </g>
      ))}
      {xs.map((v) => (
        <text key={v} x={x(v)} y={H - B + 16} fontSize="10" textAnchor="middle" fill="#6B6B68" fontFamily="ui-monospace">{v}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 4} fontSize="10.5" textAnchor="middle" fill="#6B6B68">训练步数 · 纵轴 = val loss(只在答案位置算)</text>
      {RC_ORDER.map((k, j) => {
        const curve = RECALL[k].curve
        const d = curve.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[2]).toFixed(1)).join('')
        const last = curve[curve.length - 1]
        const ty = k === 'linear' ? y(last[2]) + 4 : y(0) - 30 + j * 14
        return (
          <g key={k}>
            <path d={d} fill="none" stroke={COL[k]} strokeWidth="2.4" />
            {curve.map((p) => (
              <circle key={p[0]} cx={x(p[0])} cy={y(p[2])} r="2.6" fill={COL[k]}>
                <title>{RECALL[k].name + ' · step ' + p[0] + ' · train ' + p[1] + ' · val ' + p[2]}</title>
              </circle>
            ))}
            <text x={W - R + 8} y={ty} fontSize="10.5" fill={COL[k]} fontFamily="ui-monospace">{k} {last[2]}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ArchStrip({ arch }: { arch: ArchSpec }) {
  const reps = arch.rep || 1
  const letter = !(arch.rep && arch.rep > 1)
  const blocks: ReactNode[] = []
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i < 3; i++) {
      blocks.push(
        <div key={'l' + r + '-' + i} className="ly" style={{ background: '#3f7d63' }} title={'第 ' + (4 * r + i + 1) + ' 层 · ' + arch.lin}>
          {letter ? 'L' : null}
        </div>,
      )
    }
    blocks.push(
      <div key={'a' + r} className="ly" style={{ background: arch.attC }} title={'第 ' + (4 * r + 4) + ' 层 · ' + arch.att}>
        {letter ? 'A' : null}
      </div>,
    )
    if (r < reps - 1) blocks.push(<div key={'g' + r} style={{ width: 4 }} />)
  }
  return (
    <div className="strip">
      {blocks}
      {arch.rep ? null : <div className="ly" style={{ background: 'transparent', color: 'var(--ink2)', width: 'auto', padding: '0 6px' }}>× ?</div>}
    </div>
  )
}

function ArchNote({ index }: { index: number }) {
  if (index === 0) {
    return <><code>PRESETS["hybrid"] = ["gdn", "gdn", "gdn", "attn"]</code>:4 层,注意力层放在最后。注意力层带 RoPE 与 GQA(n_kv_head=2)。</>
  }
  if (index === 1) {
    return <>HF 模型卡原文 <code>12 * (3 * (Gated DeltaNet -&gt; MoE) -&gt; 1 * (Gated Attention -&gt; MoE))</code>,48 层;80B 总参 / 3B 激活;原生上下文 262,144。</>
  }
  if (index === 2) {
    return <>HF 模型卡 Qwen/Qwen3.5-397B-A17B:<code>15 * (3 * (Gated DeltaNet -&gt; MoE) -&gt; 1 * (Gated Attention -&gt; MoE))</code>,60 层;397B 总参 / 17B 激活。</>
  }
  if (index === 3) {
    return <>HF 模型卡 <code>12 × (3 × (Gated DeltaNet → MoE) → 1 × (Qwen Sparse Attention → MoE))</code>,48 层;125B 总参 / 6B 激活。技术报告:每 4 层 1 层全注意力,持续预训练阶段换成 QSA(稀疏注意力,第 14 章)。</>
  }
  return <>Kimi Linear(Moonshot,arXiv 2510.26692):"repeating 3 KDA layers to 1 full MLA layer";KDA 在 Gated DeltaNet 上加了更细的门控;KV cache 最多省 75%;48B 总参 / 3B 激活;MLA 层不用位置编码(NoPE)。总层数本页没有核对,只画一个周期。</>
}

function Step1() {
  const [mode, setMode] = useState(0)
  const [exp, setExp] = useState(12)
  const cfg = S1[mode]
  const T = 2 ** exp
  const tot = cfg.rows.map((r) => r.per * T + r.fixed)
  const mx = Math.max(...tot)
  const [a, g, h] = cfg.rows
  const cross = g.fixed / a.per
  const ratio = tot[0] / tot[1]
  const ratioText = ratio >= 10 ? Math.round(ratio).toLocaleString('en-US') : ratio.toFixed(2)
  const pct = (100 * tot[2] / tot[0]).toFixed(1)
  return (
    <div className={styles.scope}>
      <h2>① KV cache 越存越长</h2>
      <p className="lead">
        全注意力层每个 token 要存一份 K 和 V,上下文每长一个 token,cache 就多一份。
        记忆板层每个头只存一块 head_size × head_size 的矩阵,读多长的文本都是这么大。
        拖滑块改上下文长度,比较三种层配方要存多少个数:
      </p>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className={mode === 0 ? 'btn primary' : 'btn'} onClick={() => setMode(0)}>本关玩具(4 层)</button>
          <button type="button" className={mode === 1 ? 'btn primary' : 'btn'} onClick={() => setMode(1)}>Qwen3-Next-80B-A3B(48 层)</button>
        </div>
        <div className="hp-note" style={{ margin: '4px 0 10px' }}>{cfg.desc}</div>
        <div className="rk-row">
          <label>上下文长度 T(token)</label>
          <input type="range" min={6} max={20} step={1} value={exp} onChange={(e) => setExp(Number(e.target.value))} />
          <span className="rk-val">{ctxLabel(T)}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          {cfg.rows.map((r, i) => {
            const w = Math.max(0.4, 100 * tot[i] / mx)
            const sub = r.per && r.fixed ? en(r.per) + '×T + ' + en(r.fixed) : (r.per ? en(r.per) + ' × T' : '固定,与 T 无关')
            return (
              <div key={r.key} className="abrow">
                <div className="an">{r.name}</div>
                <div className="at"><div className="af" style={{ width: w.toFixed(2) + '%', background: COL[r.key] }} /></div>
                <div className="av">
                  {fmtCount(tot[i])} 个数
                  <small>{cfg.bytes ? fmtBytes(tot[i] * 2) + ' · ' : ''}{sub}</small>
                </div>
              </div>
            )
          })}
        </div>
        <div className="glucalc">
          {a.name}:{en(a.per)} × {en(T)} = <span className="hl">{en(tot[0])}</span> 个数<br />
          {g.name}:<span className="hl">{en(tot[1])}</span> 个数(读多长都一样)<br />
          {h.name}:{en(h.per)} × {en(T)} + {en(h.fixed)} = <span className="hl">{en(tot[2])}</span> 个数
          {cfg.bytes ? <><br /><span style={{ color: 'var(--ink2)' }}>(字节按每个数 2 字节折算,1 GiB = 1024³ 字节)</span></> : null}
        </div>
      </div>
      <div className="note">
        上下文超过 <b>{en(cross)}</b> 个 token 之后,全注意力存的数就比全 GDN 多;当前 T = {en(T)},是全 GDN 的 <b>{ratioText} 倍</b>。
        {' '}3:1 混合是全注意力的 <b>{pct}%</b>{T >= 65536 ? ',长度越长越接近 25%(只有四分之一的层存 KV)' : ''}。
      </div>
      <Dig title="玩具这三个数是怎么算出来的?">
        <code>11_linear_attn.py</code> 训练完把两项写进 json:
        {' '}<code>kv_per_token = 2 × n_kv_head × head_size × 注意力层数</code>,
        {' '}<code>state_const = n_head × head_size × head_size × 记忆板层数</code>。
        全注意力(4 层):2 × 2 × 32 × 4 = <b>512</b> 个数 / token;
        全 GDN(4 层):4 × 32 × 32 × 4 = <b>16,384</b> 个数,与长度无关;
        3:1 混合:注意力 1 层 = <b>128</b> 个数 / token,记忆板 3 层 = <b>12,288</b> 个数。
        三组数分别来自 <code>runs/cuda/ch13_lm_attn.json</code>、<code>ch13_lm_gdn.json</code>、<code>ch13_lm_hybrid.json</code>。
        记忆板层还带一个 kernel=4 的短卷积,推理时要缓存最近 3 个 token 的输入,量级很小,这里没有计入。
      </Dig>
      <Dig title="Qwen3-Next 那一栏按什么配置估算?">
        出自 HF 模型卡 Qwen/Qwen3-Next-80B-A3B-Instruct:48 层,布局 <code>12 × (3 × (Gated DeltaNet → MoE) → 1 × (Gated Attention → MoE))</code>。
        Gated Attention:16 个 Q 头、<b>2 个 KV 头</b>、head dim <b>256</b>,所以 12 层注意力每 token 存 2 × 12 × 2 × 256 = 12,288 个数。
        Gated DeltaNet:V <b>32</b> 头、QK 16 头、head dim <b>128</b>,本页按每层 32 × 128 × 128 个数估算记忆板,36 层共 18,874,368 个数。
        "48 层全用注意力"和"48 层全用 GDN"两行是按同一套头配置算出的假想对照,用来和实际布局比。字节数一律按每个数 2 字节(BF16)折算,不含短卷积缓存。
      </Dig>
      <div className="next-hint">↳ 下一步:一块固定大小的矩阵,怎么装得下越来越长的历史?先看怎么往里写。</div>
    </div>
  )
}

function s2Keys(deg: number) {
  const th = deg * Math.PI / 180
  return [[1, 0], [0, 1], [Math.cos(th), Math.sin(th)]]
}

function Step2Note({ on, read, err, o, K, q }: { on: boolean[]; read: number; err: number; o: number[]; K: number[][]; q: number[] }) {
  if (!on[read]) {
    return <>k{read + 1} 这一对<b>没写入</b>,读出来的 {vec(o)} 全是别的 key 串过来的内容。</>
  }
  if (err < 0.005) {
    return <>读得准:参与写入的 key 和 k{read + 1} 要么就是它自己,要么和它<b>正交</b>(点积 0),其他 value 一点都没混进来。</>
  }
  const bits = [0, 1, 2].filter((i) => on[i] && i !== read).map((i) => 'k' + (i + 1) + '·k' + (read + 1) + ' = ' + f2(K[i][0] * q[0] + K[i][1] * q[1]))
  return <>出现串扰,误差 <b>{err.toFixed(3)}</b>:{bits.join(',')},点积不为 0 的那些 key,会按点积的大小把自己的 value 混进读出值。2 维空间里第三个 key 不可能和前两个都正交。</>
}

function Step2() {
  const [on, setOn] = useState([true, true, false])
  const [read, setRead] = useState(0)
  const [deg, setDeg] = useState(37)
  const K = s2Keys(deg)
  const S = [[0, 0], [0, 0]]
  for (let i = 0; i < 3; i++) {
    if (!on[i]) continue
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) S[r][c] += V2[i][r] * K[i][c]
  }
  const q = K[read]
  const o = [S[0][0] * q[0] + S[0][1] * q[1], S[1][0] * q[0] + S[1][1] * q[1]]
  const want = V2[read]
  const err = Math.hypot(o[0] - want[0], o[1] - want[1])
  const written = [0, 1, 2].filter((i) => on[i])
  const arrows: Arrow[] = []
  for (let i = 0; i < 3; i++) arrows.push({ v: K[i], color: V2_COL[i], w: 1.5, op: on[i] ? 0.45 : 0.15, label: 'k' + (i + 1), id: 'k' })
  arrows.push({ v: want, color: '#3f7d63', dash: true, label: 'v' + (read + 1), id: 'w' })
  arrows.push({ v: o, color: '#D97757', w: 3, label: 'o', id: 'o' })
  const k3dot = q[0] * K[2][0] + q[1] * K[2][1]
  return (
    <div className={styles.scope}>
      <h2>② 记忆板:写入就是加一个外积</h2>
      <p className="lead">
        把 (k, v) 写进记忆板:<code>S ← S + v kᵀ</code>。读的时候拿 query 去乘:<code>o = S q</code>。
        {' '}如果 q 恰好等于某个写过的 k,而且所有 k 互相正交、长度为 1,读出来的就是那个 k 对应的 v。
        {' '}下面用 2 维向量演示(只为了上屏;真实每个头 head_size=32,记忆板 32×32)。
        {' '}<b>点按钮写入或撤掉一对,再选一个 key 去读:</b>
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>写入(可多选)</label>
          <div className="btn-row sm" style={{ margin: 0 }}>
            {[0, 1, 2].map((i) => (
              <button key={i} type="button" className={on[i] ? 'btn primary' : 'btn'} onClick={() => setOn((prev) => prev.map((v, j) => j === i ? !v : v))}>写入 (k{i + 1}, v{i + 1})</button>
            ))}
          </div>
        </div>
        <div className="rk-row">
          <label>用哪个 key 读</label>
          <div className="btn-row sm" style={{ margin: 0 }}>
            {[0, 1, 2].map((i) => (
              <button key={i} type="button" className={read === i ? 'btn primary' : 'btn'} onClick={() => setRead(i)}>用 k{i + 1} 读</button>
            ))}
          </div>
        </div>
        <div className="rk-row">
          <label>k3 的方向(与 k1 的夹角)</label>
          <input type="range" min={0} max={90} step={1} value={deg} onChange={(e) => setDeg(Number(e.target.value))} />
          <span className="rk-val">{deg}°</span>
        </div>
        <div className="duo" style={{ marginTop: 12 }}>
          <div>
            <div className="mat-cap">记忆板 S(2×2)</div>
            <Heat M={S} cls="big" digits={2} />
            <div className="hp-note" style={{ marginTop: 6 }}>橙 = 正,蓝 = 负,颜色越深绝对值越大</div>
          </div>
          <div className="scroll-x"><Plane arrows={arrows} radius={1.6} /></div>
        </div>
        <div className="glucalc">
          S = {written.length ? written.map((i) => 'v' + (i + 1) + '·k' + (i + 1) + 'ᵀ').join(' + ') : '0(还没写入)'}<br />
          k3 = ({f2(K[2][0])}, {f2(K[2][1])}) · k{read + 1}·k1 = {f2(q[0])} · k{read + 1}·k2 = {f2(q[1])}
          {read === 2 ? null : <> · k{read + 1}·k3 = {f2(k3dot)}</>}
          <br />
          o = S · k{read + 1} = <span className="hl">{vec(o)}</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{vec(o)}</div><div className="drl">读出 o = S q</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--good)' }}>{vec(want)}</div><div className="drl">这个 key 写入时的 v</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{err.toFixed(3)}</div><div className="drl">误差 ‖o − v‖</div></div>
        </div>
      </div>
      <div className="note"><Step2Note on={on} read={read} err={err} o={o} K={K} q={q} /></div>
      <div className="codepath">↳ 代码:<b>11_linear_attn.py</b> 的 <code>RecurrentMixer.forward</code>(<code>mode == "linear"</code> 那一支)</div>
      <Dig title="这和第 2 章的 softmax 注意力是什么关系?">
        去掉 softmax 之后,注意力的输出是 <code>o_t = Σ_i v_i (k_iᵀ q_t) = (Σ_i v_i k_iᵀ) q_t</code>。
        括号里那一坨就是 S:把所有历史 (k, v) 的外积加起来。先求和再乘 q,和逐个打分再加权,算出来一样。
        所以不需要留着每个 k_i、v_i,留着它们的和就够了,这就是 Katharopoulos et al. 2020
        "Transformers are RNNs"(arXiv 2006.16236)的出发点,论文把复杂度从 O(N²) 降到 O(N)。
        代价是 softmax 没了:softmax 能让最匹配的那个 key 压过其余所有 key,线性版只能靠 key 之间正交来避免串扰。
      </Dig>
      <Dig title="32 维的记忆板能装多少对?">
        32 维空间里最多有 <b>32 个</b>互相正交的单位向量,所以一个头最多无串扰地存 32 对;再多就必然有 key 不正交,读出时混进别的 value。
        本页的 2 维版本只能装 2 对,第三对一写进去就开始互相干扰。
        Schlag et al. 2021(arXiv 2102.11174)从"快速权重"的角度推出了同一个结论,原文称之为 "memory capacity limitation"。
        本项目的 <code>linear</code> 模式里 q、k 先过 <code>elu + 1</code>,所有分量都是正数,两个全正向量的点积不会小于 0,更难做到正交。
      </Dig>
      <div className="next-hint">↳ 下一步:同一个 key 写两次,只加不减会把新旧值叠在一起。能不能先擦掉旧的再写?</div>
    </div>
  )
}

function Formula({ mode }: { mode: Mode }) {
  if (mode === 'linear') {
    return (
      <>
        S<sub>t</sub> = S<sub>t−1</sub> + v<sub>t</sub> k<sub>t</sub>ᵀ
        <div className="src">线性注意力 · Katharopoulos et al. 2020,"Transformers are RNNs",arXiv 2006.16236</div>
      </>
    )
  }
  if (mode === 'delta') {
    return (
      <>
        S<sub>t</sub> = S<sub>t−1</sub>(I − β<sub>t</sub> k<sub>t</sub> k<sub>t</sub>ᵀ) + β<sub>t</sub> v<sub>t</sub> k<sub>t</sub>ᵀ
        {' '}= S<sub>t−1</sub> − β<sub>t</sub>(S<sub>t−1</sub>k<sub>t</sub> − v<sub>t</sub>) k<sub>t</sub>ᵀ
        <div className="src">DeltaNet · Yang et al.,"Parallelizing Linear Transformers with the Delta Rule over Sequence Length",arXiv 2406.06484;β<sub>t</sub> = σ(W<sub>β</sub>x<sub>t</sub>) ∈ (0,1),k 做 L2 归一化</div>
      </>
    )
  }
  return (
    <>
      S<sub>t</sub> = S<sub>t−1</sub>(α<sub>t</sub>(I − β<sub>t</sub> k<sub>t</sub> k<sub>t</sub>ᵀ)) + β<sub>t</sub> v<sub>t</sub> k<sub>t</sub>ᵀ , o<sub>t</sub> = S<sub>t</sub> q<sub>t</sub>
      <div className="src">Gated DeltaNet 式 (10) · Yang, Kautz, Hatamizadeh,arXiv 2412.06464 §3.1(ICLR 2025);α<sub>t</sub> ∈ (0,1) 是随输入变化的标量衰减,β<sub>t</sub> ∈ (0,1) 是写入强度。代码写法 <code>S ← αS;S ← S + β(v − S k)kᵀ</code> 与此式相同</div>
    </>
  )
}

function Step3Note({ mode, beta, alpha, oA }: { mode: Mode; beta: number; alpha: number; oA: number[] }) {
  const eA = Math.hypot(oA[0] - WRITE_SEQ[2].v[0], oA[1] - WRITE_SEQ[2].v[1])
  if (mode === 'linear') {
    return <>linear 读 A 得到 {vec(oA)},正好是<b>旧值 + 新值</b>:同一个 key 写两次,两个 value 叠在一起,旧值擦不掉。B 没受影响,因为 kA、kB 正交。</>
  }
  if (mode === 'delta') {
    if (beta >= 0.999) {
      return <>delta、β=1:第 ③ 次写入先读出 A 当前存的 {vec(WRITE_SEQ[0].v)},只补上"新值 − 旧值"这份差额,读 A 得到<b>新值</b>。B 原样保留。</>
    }
    return <>delta、β={beta.toFixed(2)}:每次只补差额的 {Math.round(beta * 100)}%,读 A 离新值还差 {eA.toFixed(3)}。β 由 <code>b_proj</code> 逐 token 算出,模型自己决定这一步写多重。</>
  }
  return <>gdn:每写一次之前,整块 S 先乘 α={alpha.toFixed(2)}。B 写入后又经历 1 次衰减,读 B 只剩原来的 <b>{Math.round(alpha * 100)}%</b>;A 的旧值在第 ③ 步前衰减了 2 次,{beta >= 0.999 ? 'β=1 时仍被整个换成新值' : 'β<1 时读 A 是衰减后的旧值与新值的混合'}。α=1 时退回 delta。</>
}

function Step3() {
  const [modeI, setModeI] = useState(2)
  const [beta, setBeta] = useState(1)
  const [alpha, setAlpha] = useState(0.8)
  const [src, setSrc] = useState(0)
  const mode = MODES[modeI]
  const { S, snaps } = runSeq(mode, alpha, beta)
  const oA = mulSv(S, WRITE_SEQ[0].k)
  const oB = mulSv(S, WRITE_SEQ[1].k)
  const key = src === 0 ? 'gdn' : 'hybrid'
  const al = ALPHA[key]
  const arrows: Arrow[] = [
    { v: WRITE_SEQ[0].v, color: '#8C8A83', dash: true, label: 'A 旧', id: 'a' },
    { v: WRITE_SEQ[2].v, color: '#3f7d63', dash: true, label: 'A 新', id: 'b' },
    { v: WRITE_SEQ[1].v, color: '#9fb4e3', dash: true, label: 'B', id: 'c' },
    { v: oB, color: '#3a63c0', w: 3, label: '读 B', id: 'd' },
    { v: oA, color: '#D97757', w: 3, label: '读 A', id: 'e' },
  ]
  return (
    <div className={styles.scope}>
      <h2>③ 先擦再写:delta rule 与遗忘门</h2>
      <p className="lead">
        只加不减的写法擦不掉旧值。<Term k="delta-rule" name="delta rule · 增量写入规则" def="S ← S + β·(v − S·k)·kᵀ:先读出 k 当前存的值,只把与目标 v 的差额写进去。等价于对 ½‖S·k − v‖² 做一步 SGD,β 是学习率。">delta rule</Term> 先读出这个 key 当前存的值,只补差额;Gated DeltaNet 再加一个遗忘门 α。
        {' '}下面是一串三次写入:先把 A 写成旧值,再写 B,最后把 A 改成新值。然后分别用 kA、kB 去读。
        {' '}<b>切换三种写法,拖 β、α 看读出值怎么变:</b>
      </p>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className={modeI === 0 ? 'btn primary' : 'btn'} onClick={() => setModeI(0)}>linear:只加</button>
          <button type="button" className={modeI === 1 ? 'btn primary' : 'btn'} onClick={() => setModeI(1)}>delta:先读旧值,只补差额</button>
          <button type="button" className={modeI === 2 ? 'btn primary' : 'btn'} onClick={() => setModeI(2)}>gdn:再加遗忘门 α</button>
        </div>
        <div className="rk-row">
          <label>β 写入强度</label>
          <input type="range" min={0} max={1} step={0.05} value={beta} disabled={mode === 'linear'} onChange={(e) => setBeta(Number(e.target.value))} />
          <span className="rk-val">{mode === 'linear' ? '—' : beta.toFixed(2)}</span>
        </div>
        <div className="rk-row">
          <label>α 保留率(只有 gdn)</label>
          <input type="range" min={0} max={1} step={0.05} value={alpha} disabled={mode !== 'gdn'} onChange={(e) => setAlpha(Number(e.target.value))} />
          <span className="rk-val">{mode === 'gdn' ? alpha.toFixed(2) : '—'}</span>
        </div>
        <div className="tline">
          {WRITE_SEQ.map((e, i) => (
            <div key={e.lab} className="tcard">
              <div className="th">{e.lab}</div>
              <div className="tw">{e.kn} = {vec(e.k)}<br />v = {vec(e.v)}</div>
              <div className="mat-cap">写完后的 S</div>
              <Heat M={snaps[i]} cls="mid" digits={2} />
            </div>
          ))}
        </div>
        <div className="duo">
          <div className="dotread" style={{ gridTemplateColumns: '1fr', minWidth: 220 }}>
            <div className="dr"><div className="drv">{vec(oA)}</div><div className="drl">用 kA 读(新值应为 (−0.70, 0.40))</div></div>
            <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{vec(oB)}</div><div className="drl">用 kB 读(写入时为 (−0.30, 0.80))</div></div>
          </div>
          <div className="scroll-x"><Plane arrows={arrows} radius={1.6} /></div>
        </div>
        <div className="fcard"><Formula mode={mode} /></div>
      </div>
      <div className="note"><Step3Note mode={mode} beta={beta} alpha={alpha} oA={oA} /></div>
      <div className="sub-h"><span className="badge">真实</span>训完之后,第一层的 α 学成了多少</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        代码里 α 的偏置初始化成 3.0,开训时 α = sigmoid(3) ≈ 0.95。下面是训练 5000 步后,第一层 4 个头在 val 文本上的平均 α,
        画成"一条记忆过 n 个 token 后还剩几成"(按平均 α 粗算 αⁿ;实际 α 每个 token 各算一次):
      </p>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className={src === 0 ? 'btn primary' : 'btn'} onClick={() => setSrc(0)}>4 层 GDN(gdn.json)</button>
          <button type="button" className={src === 1 ? 'btn primary' : 'btn'} onClick={() => setSrc(1)}>3:1 混合(hybrid.json)</button>
        </div>
        <div className="scroll-x"><AlphaChart alphas={al} /></div>
        <div className="hp-note">
          <div className="legend" style={{ marginTop: 4 }}>
            {al.map((a, h) => (
              <span key={h}><i style={{ background: HEAD_COLORS[h] }} />head {h}:α={a.toFixed(4)},约 {(Math.log(0.5) / Math.log(a)).toFixed(2)} 个 token 衰减一半</span>
            ))}
          </div>
          数据:<code>{'runs/cuda/ch13_lm_' + key + '.json'}</code> 的 <code>alpha_mean_per_head</code>(第一层,64 段 × 256 个 val token 上的平均)。
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>11_linear_attn.py</b> 的 <code>RecurrentMixer</code>(<code>b_proj</code> 算 β,<code>a_proj</code> 算 α)· 开关 <code>--preset linear / delta / gdn</code></div>
      <Dig title="为什么叫 delta rule?">
        写入量正比于"想存的值 v"和"当前读出的值 S·k"之差,也就是误差 delta。
        Yang et al. 2024(arXiv 2406.06484)把它写成 <code>S_t = S_{'t-1'} − β_t (S_{'t-1'} k_t − v_t) k_tᵀ</code>,
        并解释为对在线回归损失 <code>½‖S k_t − v_t‖²</code> 做一步 SGD,β_t 就是学习率。
        k 做了 L2 归一化时,β_t = 1 让 <code>I − k_t k_tᵀ</code> 成为投影矩阵:先把 k_t 方向上的旧内容整个投影掉,再写新值。
        最早把 delta rule 用到线性 Transformer 上的是 Schlag et al. 2021(arXiv 2102.11174)。
      </Dig>
      <Dig title="第一层的 α 只有 0.6 左右,是不是忘得太快了?">
        按平均 α 粗算,一条记忆过 1.2 到 1.7 个 token 衰减到一半,第一层的记忆板主要在记最近几个字符。
        这里有两点要分开看:① 这是 64 段 × 256 个 val token 上的<b>平均值</b>,α 每个位置由 <code>a_proj</code> 各算一次,个别位置可以接近 1;
        ② 只统计了第一层,代码没有导出后面三层的 α。开训时 α ≈ 0.95,训练把第一层压到了 0.55–0.66,
        说明对字符级语言模型的第一层来说,忘得快的记忆板让 loss 更低。更长的依赖交给哪几层、α 是多少,本实验没有测。
      </Dig>
      <div className="next-hint">↳ 下一步:三种写法在玩具上的差别看清楚了。真训一遍语言模型,val loss 差多少?</div>
    </div>
  )
}

function Step4() {
  const [metric, setMetric] = useState(0)
  const [zoom, setZoom] = useState(0)
  const [sel, setSel] = useState<LmKey>('gdn')
  const row = LM[sel]
  const vals = LM_ORDER.map((k) => LM[k].val)
  const hi = Math.max(...vals)
  const lo = Math.min(...vals)
  const showS = row.S
  return (
    <div className={styles.scope}>
      <h2>④ 五种层配方的真实对照</h2>
      <p className="lead">
        同一份 tiny shakespeare、同一套超参(4 层、5000 步、batch 64、lr 1e-3、seed 1337),只换每层用什么:
        全注意力、全 linear、全 delta、全 GDN、3 GDN + 1 注意力。训练长度 64,训完再拿 128 / 256 / 512 长的片段测 val loss。
        {' '}<b>切换指标,点一组看细节:</b>
      </p>
      <div className="btn-row sm">
        <button type="button" className={metric === 0 ? 'btn primary' : 'btn'} onClick={() => setMetric(0)}>val loss @64(训练长度)</button>
        <button type="button" className={metric === 1 ? 'btn primary' : 'btn'} onClick={() => setMetric(1)}>长度外推 64 → 512</button>
      </div>
      <div className="btn-row sm" style={{ display: metric === 1 ? 'flex' : 'none' }}>
        <button type="button" className={zoom === 0 ? 'btn primary' : 'btn'} onClick={() => setZoom(0)}>纵轴全范围</button>
        <button type="button" className={zoom === 1 ? 'btn primary' : 'btn'} onClick={() => setZoom(1)}>放大 1.50–1.70</button>
      </div>
      <div className="lab scroll-x">
        {metric === 0 ? (
          <>
            <div className="hp-note" style={{ marginBottom: 6 }}>val loss 越低越好;柱长按"离最差那组多远"画,四位小数的差别才看得见</div>
            {LM_ORDER.map((k) => {
              const r = LM[k]
              const w = 18 + 82 * (hi - r.val) / Math.max(hi - lo, 1e-9)
              const d = r.val - LM.attn.val
              return (
                <div key={k} className={k === sel ? 'abrow click sel' : 'abrow click'} onClick={() => setSel(k)}>
                  <div className="an">{r.name}<br /><span style={{ fontWeight: 400 }}>{r.layers}</span></div>
                  <div className="at"><div className="af" style={{ width: w.toFixed(1) + '%', background: COL[k] }} /></div>
                  <div className="av">{r.val.toFixed(4)}<small>比全注意力 {d >= 0 ? '+' : ''}{d.toFixed(4)}</small></div>
                </div>
              )
            })}
          </>
        ) : (
          <>
            <LossChart zoom={zoom} sel={sel} />
            <div className="legend">
              {LM_ORDER.map((k) => (
                <span key={k} className={k === sel ? 'lg-click sel' : 'lg-click'} onClick={() => setSel(k)}>
                  <i style={{ background: COL[k] }} />{LM[k].name}
                </span>
              ))}
            </div>
            <div className="hp-note">右侧数字 = 512 长度的 val loss;{zoom === 1 ? '放大后超出范围的线被裁掉(全注意力 128 之后出界)' : '点图例高亮一条'}</div>
          </>
        )}
      </div>
      <div className="lab">
        <div className="duo" style={{ alignItems: 'start' }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: COL[sel] }}>
              {row.name} <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink2)', fontWeight: 400 }}>{row.layers}</span>
            </div>
            <div className="tbl-scroll">
              <table className="minitbl">
                <tbody>
                  <tr><td>val loss @64</td><td><b>{row.val.toFixed(4)}</b>(train {row.train.toFixed(4)})</td></tr>
                  <tr><td>val @64 / 128 / 256 / 512</td><td>{LENS.map((t) => lenVal(row.byLen, t).toFixed(3)).join(' / ')}</td></tr>
                  <tr><td>参数</td><td>{(row.params / 1e6).toFixed(3)} M</td></tr>
                  <tr><td>训练用时</td><td>{row.secs} 秒(与其余 11 组同卡同时跑)</td></tr>
                  <tr><td>KV / token</td><td>{row.kv} 个数</td></tr>
                  <tr><td>固定状态</td><td>{en(row.state)} 个数</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            {showS ? (
              <>
                <div className="mat-cap">第一个记忆板层 · head 0 · 左上 8×8(读完 256 个字符后)· 最大 |S| = <b style={{ color: 'var(--accent)' }}>{matMax(showS)}</b></div>
                <Heat M={showS} cls="tiny" digits={null} />
                <div className="hp-note" style={{ marginTop: 4 }}>颜色按本矩阵自己的最大值归一化;悬停看数值</div>
              </>
            ) : (
              <div className="hp-note">全注意力没有记忆板,推理时每个 token 存 {row.kv} 个数的 K/V。</div>
            )}
          </div>
        </div>
      </div>
      <div className="note">
        训练长度 64 上,五组 val loss 落在 <b>1.5357–1.5722</b> 之间;拉到 512,全注意力涨到 <b>3.5171</b>,GDN 与 3:1 混合停在 <b>1.532 / 1.536</b>。
      </div>
      <Dig title="为什么全注意力拉长到 512 就崩了?">
        全注意力层用 RoPE(第 12 章):位置越靠后转的角度越大。训练只见过 0–63 的位置,
        到 128、256、512 时,q·k 里出现的相对距离和转角组合模型从没见过,val loss 从 1.539 涨到 1.941、2.855、3.517。
        记忆板层没有位置编码,顺序靠"一个一个往里写"自带,所以 GDN 在更长的片段上 loss 反而略降(1.569 → 1.517 @256),多出来的上文有用。
        3:1 混合的第 4 层也是带 RoPE 的注意力,512 时却是 1.536,没有崩。本实验没有单独做消融,这个现象的原因不在这里下结论。
      </Dig>
      <Dig title="@64 这些差距,哪些是真的、哪些是噪声?">
        每组只跑了一个种子。页面上同一个模型有两个 @64 的数:训练末尾的 <code>val</code>(200 个 batch)和外推测试里的 64(40 个 batch),
        两者最多差 <b>0.0069</b>(3:1 混合:1.5446 对 1.5515)。这就是这套评测的抽样噪声量级。
        所以 <b>GDN 与 delta 的 0.0005</b>、<b>全注意力与 3:1 混合的 0.0089</b> 都在噪声附近,不能据此排先后。
        全注意力比全 linear 低 <b>0.0365</b>,比全 GDN 低 <b>0.0289</b>,幅度大得多,更可能是真的差距。
      </Dig>
      <Dig title="linear 和 delta 为什么越长越差?">
        点上面的 linear 看它的记忆板:读完 256 个字符后,第一层 head 0 左上 8×8 的最大绝对值是 <b>215.6</b>;
        delta 是 <b>0.518</b>,GDN 是 <b>0.121</b>。linear 只加不减,越长累积越多,512 时 loss 涨到 1.673。
        delta 的写入会替换旧值,状态没有发散,但它没有遗忘门,没被重新写到的方向一直留着,512 时涨到 1.629。
        加了 α 的 GDN 在 512 时是 1.532。
      </Dig>
      <Dig title="记忆板这几组为什么训得慢这么多?">
        <code>RecurrentMixer.forward</code> 用 Python for 循环逐 token 更新 S,每层每步要循环 64 次,全注意力是一次矩阵乘。
        实测全注意力 <b>493 秒</b>,全 GDN <b>1603 秒</b>。另外这 9 组训练和第 14 章的 3 组是在同一张 RTX 4090 上<b>同时</b>跑的,
        互相抢 GPU,秒数只能看个大概。
        真实实现(flash-linear-attention 等)把序列切块并行计算,和逐 token 循环数学上等价;
        代码里写循环,是为了让"它是个 RNN"一眼看得出来。
      </Dig>
      <div className="codepath">↳ 跑法:<code>python 11_linear_attn.py --preset attn / linear / delta / gdn / hybrid</code>(默认 <code>--task lm</code>)</div>
      <div className="next-hint">↳ 下一步:loss 只差百分之几,记忆板还省了一大截 cache。它输在哪?换一个要精确找回的任务。</div>
    </div>
  )
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function Step5() {
  const [pick, setPick] = useState(0)
  const [view, setView] = useState(0)
  const [nIdx, setNIdx] = useState(3)
  const [archI, setArchI] = useState(0)
  const { N, keys, vals, order } = SAMPLE
  const qi = order[pick]
  const dist = (2 * N + 2 * pick) - (2 * qi)
  const Nnow = RECALL_NS[nIdx]
  const chance = 100 / N_VALS
  const arch = ARCH[archI]
  return (
    <div className={styles.scope}>
      <h2>⑤ 精确检索与 3:1 混合</h2>
      <p className="lead">
        键值检索任务:序列前半段是 N 对 (key, value),后半段把这 N 个 key 打乱再出一遍,每个 key 后面要答出它当初配的 value。
        只有答案位置算 loss。<b>点后半段任意一个 key,看它要去前面找哪一对:</b>
      </p>
      <div className="lab">
        <div className="hp-note">一条 N = 8 的样本(页面按 <code>get_batch</code> 同样的规则现场生成;训练用 N = 32,序列长 128)</div>
        <div>
          <div className="seq">
            <span className="seqsep">前半段</span>
            {keys.map((key, i) => {
              const hit = i === qi
              return (
                <Fragment key={'c' + i}>
                  <span className={hit ? 'tok k hit' : 'tok k'}>K{pad2(key)}</span>
                  <span className={hit ? 'tok v hit' : 'tok v'}>V{pad2(vals[i])}</span>
                </Fragment>
              )
            })}
          </div>
          <div className="seq">
            <span className="seqsep">后半段</span>
            {order.map((i, j) => {
              const hit = j === pick
              return (
                <Fragment key={'q' + j}>
                  <span className={hit ? 'tok qk hit' : 'tok qk'} onClick={() => setPick(j)}>K{pad2(keys[i])}</span>
                  <span className={hit ? 'tok ans hit' : 'tok ans'}>V{pad2(vals[i])}</span>
                </Fragment>
              )
            })}
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#E5EBF9', border: '1px solid #3a63c0' }} />key(token 0–63)</span>
          <span><i style={{ background: '#E4EFE9', border: '1px solid #3f7d63' }} />value(token 64–127,显示成 V00–V63)</span>
          <span><i style={{ background: '#F6E6F0', border: '1px dashed #a3548c' }} />要答的 value(只在这里算 loss)</span>
        </div>
        <div className="hp-note">
          选中的是后半段第 {pick + 1} 个 key <b>K{pad2(keys[qi])}</b>:它在前半段第 {qi + 1} 对,距离 {dist} 个 token,要答 <b>V{pad2(vals[qi])}</b>。
          {' '}value 是随机抽的,可能重复,只能靠"找到同一个 key、抄它后面那个 token"来答。
        </div>
      </div>
      <div className="sub-h"><span className="badge">真实</span>四种层配方答对多少</div>
      <div className="btn-row sm">
        <button type="button" className={view === 0 ? 'btn primary' : 'btn'} onClick={() => setView(0)}>准确率</button>
        <button type="button" className={view === 1 ? 'btn primary' : 'btn'} onClick={() => setView(1)}>训练曲线</button>
      </div>
      <div className="lab">
        <div hidden={view !== 0}>
          <div className="rk-row">
            <label>评测时的 N(训练固定 32)</label>
            <input type="range" min={0} max={3} step={1} value={nIdx} onChange={(e) => setNIdx(Number(e.target.value))} />
            <span className="rk-val">{Nnow}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            {RC_ORDER.map((k) => {
              const r = RECALL[k]
              const a = accAt(r.acc, Nnow) * 100
              return (
                <div key={k} className="abrow">
                  <div className="an">{r.name}</div>
                  <div className="at">
                    <div className="af" style={{ width: Math.max(0.4, a).toFixed(2) + '%', background: COL[k] }} />
                    <div className="chance" style={{ left: chance.toFixed(2) + '%' }} />
                  </div>
                  <div className="av">
                    {a >= 99.95 ? a.toFixed(2) : a.toFixed(1)}%
                    <small>序列长 {4 * Nnow} · 参数 {(r.params / 1e6).toFixed(3)} M</small>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="hp-note">竖线 = 随机猜的准确率 1/64 ≈ 1.56%(value 有 64 种)</div>
        </div>
        <div className="scroll-x" hidden={view !== 1}>
          <RecallCurve />
          <div className="legend">
            {RC_ORDER.map((k) => (
              <span key={k}><i style={{ background: COL[k] }} />{RECALL[k].name}({RECALL[k].secs} 秒)</span>
            ))}
          </div>
          <div className="hp-note">每 500 步评估一次;悬停圆点看 train / val。3:1 混合到 5999 步仍在下降。</div>
        </div>
      </div>
      <div className="note">
        同样 4 层、同样 32×32 的记忆板,<b>只加不减的 linear 在 N=32 时答对 16.6%</b>;带 delta rule 和遗忘门的 GDN 答对 <b>99.9%</b>,和全注意力的 100% 接近。
      </div>
      <Dig title="3:1 混合只有 88–93%,是不是说明混合不如纯 GDN?">
        这组数不能这么读,它<b>没训完</b>。切到"训练曲线"看:全注意力在 2000 → 2500 步之间 loss 从 2.60 骤降到 0.33,
        GDN 在 1500 → 2500 步从 1.77 降到 0.07;混合这组平台期拖到很后面,5000 步时还是 1.35,5500 步 0.65,
        最后一次评估(5999 步)train 0.1475 / val 0.1462,仍在往下走。训练预算固定 6000 步、只跑一个种子,
        它刚好在骤降的半路上停了。要比较混合和纯 GDN,需要训到 loss 都走平、再多跑几个种子;本页不给这个排序。
      </Dig>
      <Dig title="纯 GDN 这里也 99%,工业界为什么还要每 4 层留 1 层注意力?">
        要看条件。本实验最多记 <b>N = 32 对</b>,序列 128 个 token,每层 4 个头各有一块 32×32 的记忆板,要记的对数和 head_size 同一量级,
        纯 GDN 装得下。真实模型的上下文是几万到几十万 token(Qwen3-Next 原生 262,144),要精确找回的内容远多于记忆板的维度,
        固定大小的状态总有装不下的时候;全注意力层把每个 token 的 K/V 都留着,这类检索不受容量限制。
        Zoology(Arora et al.,arXiv 2312.04927)对比注意力与多种高效架构,原文:"82% of the gap is explained by each model's ability to recall information that is previously mentioned in-context"。
        Kimi Linear(arXiv 2510.26692)§5.2 的消融里,3 层 KDA 配 1 层 MLA 的 3:1 比例在质量与吞吐之间取舍最好。
      </Dig>
      <Dig title="linear 为什么只答对 6–17%?">
        它比随机猜(1.56%)高,但离检索还很远。两个原因叠在一起:S 只加不减,32 对写进去全部叠加;
        q、k 过了 <code>elu + 1</code> 全是正数,key 之间点积都大于 0,读任何一个 key 都会混进其他 value。
        训练曲线上它的 loss 从 2.60 降到 2.47 就停住了,没有出现另外三组那样的骤降。
      </Dig>
      <div className="sub-h"><span className="badge">工业</span>真实模型怎么排层</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        公开的线性注意力大模型都用<Term k="hybrid-attention" name="混合注意力 · 3:1 hybrid" def="大部分层用固定状态的线性注意力(如 Gated DeltaNet),每隔几层留一层保留全部 K/V 的注意力。Qwen3-Next、Kimi Linear 都是 3 层线性配 1 层注意力。">混合排布</Term>:每 3 层固定状态的层配 1 层保留 K/V 的注意力层。选一个模型看它的 48 或 60 层怎么排:
      </p>
      <div className="btn-row sm">
        <button type="button" className={archI === 0 ? 'btn primary' : 'btn'} onClick={() => setArchI(0)}>本关 hybrid</button>
        <button type="button" className={archI === 1 ? 'btn primary' : 'btn'} onClick={() => setArchI(1)}>Qwen3-Next-80B-A3B</button>
        <button type="button" className={archI === 2 ? 'btn primary' : 'btn'} onClick={() => setArchI(2)}>Qwen3.5-397B-A17B</button>
        <button type="button" className={archI === 3 ? 'btn primary' : 'btn'} onClick={() => setArchI(3)}>Qwen3.8-Flash-Next</button>
        <button type="button" className={archI === 4 ? 'btn primary' : 'btn'} onClick={() => setArchI(4)}>Kimi Linear</button>
      </div>
      <div className="lab">
        <ArchStrip arch={arch} />
        <div className="legend">
          <span><i style={{ background: '#3f7d63' }} />{arch.lin}(固定大小状态)</span>
          <span><i style={{ background: arch.attC }} />{arch.att}(保留 K/V)</span>
          <span>{arch.rep ? '共 ' + (arch.rep * 4) + ' 层 = ' + arch.rep + ' × (3 + 1)' : '3 : 1'}</span>
        </div>
        <div className="hp-note"><ArchNote index={archI} /></div>
      </div>
      <Dig title="Mamba2 和 Gated DeltaNet 是什么关系?">
        Gated DeltaNet 论文(Yang, Kautz, Hatamizadeh,arXiv 2412.06464,ICLR 2025)标题就是 "Improving Mamba2 with Delta Rule"。§2.1 把几种写法摆在一起:
        <div className="tbl-scroll"><table className="minitbl">
          <tbody>
            <tr><th>模型</th><th>记忆板更新</th></tr>
            <tr><td>线性注意力</td><td>S_t = S_{'t-1'} + v_t k_tᵀ</td></tr>
            <tr><td>Mamba2</td><td>S_t = <b>α_t</b> S_{'t-1'} + v_t k_tᵀ</td></tr>
            <tr><td>DeltaNet</td><td>S_t = S_{'t-1'}(I − <b>β_t</b> k_t k_tᵀ) + β_t v_t k_tᵀ</td></tr>
            <tr><td>Gated DeltaNet</td><td>S_t = S_{'t-1'}(<b>α_t</b>(I − <b>β_t</b> k_t k_tᵀ)) + β_t v_t k_tᵀ</td></tr>
          </tbody>
        </table></div>
        Mamba2 有遗忘门 α、没有 delta rule;DeltaNet 有 delta rule、没有遗忘门;Gated DeltaNet 两个都要。
        α 负责整块按比例清空,β 负责对单个 key 精确改写。Kimi Linear 的 KDA 在 Gated DeltaNet 基础上把门控做得更细。
      </Dig>
      <Dig title="为什么 delta 和 GDN 的 key 要做 L2 归一化?">
        delta rule 写完一次后,<code>S' k = S k + β (v − S k) ‖k‖²</code>。
        ‖k‖ = 1、β = 1 时,S'k 正好等于 v,"读出 S·k"才等于"这个 key 当前存的值"。
        如果 ‖k‖² = 4,同样的 β 会把差额放大 4 倍,读出值越过 v,反复写同一个 key 时误差按 |1 − β‖k‖²| = 3 倍往上翻,状态会发散。
        代码里 <code>F.normalize(q, dim=-1)</code>、<code>F.normalize(k, dim=-1)</code> 两行就是为此;linear 模式不归一化,用 <code>elu + 1</code>。
      </Dig>
      <Dig title="短卷积在这里干什么用?">
        <code>RecurrentMixer</code> 在算 q/k/v 之前先过一个 kernel=4 的因果卷积,让每个位置的 q/k/v 看到自己和前 3 个 token。
        检索任务里这一点很直接:读到 value 那一格时,应该以"前一个 token 的 key"为地址写入"这个 token 的 value";
        没有卷积,第 t 个位置的 k 只来自第 t 个 token 自己。
        Gated DeltaNet 与 Qwen3-Next 都带这个卷积(Qwen3.8-Flash-Next 的 config 里 conv kernel 也是 4)。
        代码对 linear / delta / gdn 三种写法都加了它,所以对照里的差别只来自写规则。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测(RTX 4090 · CUDA · PyTorch 2.4.1 · 单种子)</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>推理状态:全注意力每 token 存 <b>{LM.attn.kv}</b> 个数;全 GDN 固定 <b>{en(LM.gdn.state)}</b> 个数,上下文超过 <b>{LM.gdn.state / LM.attn.kv}</b> 个 token 就比全注意力省(见 STEP 1)。</div></li>
        <li><span className="ck">✓</span><div>训练长度 64 上,全注意力 val <b>{LM.attn.val.toFixed(4)}</b>、3:1 混合 <b>{LM.hybrid.val.toFixed(4)}</b>、全 GDN <b>{LM.gdn.val.toFixed(4)}</b>;混合与全注意力相差 {(LM.hybrid.val - LM.attn.val).toFixed(4)},在单种子噪声量级。</div></li>
        <li><span className="ck">✓</span><div>长度外推到 512:全注意力 <b>{lenVal(LM.attn.byLen, 512).toFixed(3)}</b>,全 GDN <b>{lenVal(LM.gdn.byLen, 512).toFixed(3)}</b>,3:1 混合 <b>{lenVal(LM.hybrid.byLen, 512).toFixed(3)}</b>。</div></li>
        <li><span className="ck">✓</span><div>键值检索 N=32:全注意力 <b>{(accAt(RECALL.attn.acc, 32) * 100).toFixed(1)}%</b>、全 GDN <b>{(accAt(RECALL.gdn.acc, 32) * 100).toFixed(1)}%</b>、全 linear <b>{(accAt(RECALL.linear.acc, 32) * 100).toFixed(1)}%</b>;3:1 混合 <b>{(accAt(RECALL.hybrid.acc, 32) * 100).toFixed(1)}%</b>,6000 步时 loss 仍在下降,未收敛。</div></li>
      </ul>
      <div className="codepath">↳ 代码:<b>11_linear_attn.py</b> 的 <code>get_batch</code>(recall 分支)· 跑法 <code>python 11_linear_attn.py --preset gdn --task recall</code></div>
    </div>
  )
}

export function LinearAttention() {
  const chapter = findChapter('linear-attention')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="linear-attention"
      title="线性注意力:把 KV cache 换成一块固定大小的记忆板"
      subtitle={
        <>
          第 12 章的注意力推理时要把每个 token 的 K/V 都存下来,上下文越长,{' '}
          <Term k="kv-cache" name="KV-cache · 键值缓存" def="把过去每个 token 的 K/V 缓存下来,生成新 token 时只算新的一列,避免重算整段。">KV cache</Term>
          {' '}越大。<Term k="linear-attention" name="线性注意力 · linear attention" def="不存历史 K/V,每个头只维护一块 head_size×head_size 的矩阵 S:来一个 token 就把 v·kᵀ 写进去,读的时候算 S·q。状态大小与上下文长度无关,模型变回 RNN。">线性注意力</Term>
          {' '}只留一块 head_size × head_size 的矩阵,每来一个 token 往里写一次,大小和上下文长度无关。
          本关从最朴素的写法出发,加上 delta rule 和遗忘门,得到 Qwen3-Next 用的{' '}
          <Term k="gated-deltanet" name="Gated DeltaNet · 门控 delta 网络" def="S ← α·S + β·(v − α·S·k)·kᵀ。α 是整块记忆的保留率,β 是这一步写多重;先读出 k 当前存的值,只补差额。Yang, Kautz, Hatamizadeh,arXiv 2412.06464。">Gated DeltaNet</Term>,
          再用 9 次真实训练看它在语言模型和精确检索上各输赢在哪。配套代码 <code>phase4-efficiency/11_linear_attn.py</code>。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>128</b> <i>主干维度</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">n_head <b>4</b> <i>头数</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">head_size <b>32</b> <i>记忆板 32×32</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">n_kv_head <b>2</b> <i>只在注意力层</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">block_size <b>64</b> <i>训练长度</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECE9E0">层配方 <b>3:1</b> <i>3 GDN + 1 注意力</i></HpChip>
          <span className="hp-note">4 层 · 其余零件同第 12 章四件齐上 · 训练在 RTX 4090 / CUDA / PyTorch 2.4.1</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={<><div className="ct">🎉 线性注意力 · 通关</div><div className="cs">你已经看过记忆板的三种写法:只加的 linear、先擦再写的 delta、再加遗忘门的 Gated DeltaNet,也看到了它在长度外推上的优势和精确检索上的容量边界。下一关换一条路:K/V 全存,但每个 query 只读一部分。</div></>}
    />
  )
}
