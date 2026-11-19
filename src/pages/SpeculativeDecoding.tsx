// 旧页 goto 不重置各步选择。切验收模式会清掉格子选中行；改 α、c 或 c 预设会清掉曲线上的蓝点。
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  CAUSAL_MAXDIFF, C_MEAS, C_PRESETS, DRAFT_G1, DRAFT_ROWS, expTok, GREEDY, MARK_ACCEPT, MARK_REJECT,
  MS, MTP_ROW, P8, P_BLOCK, P_HEAD_SHARED, P_MTP_SUM, P_NORMS, P_PROJ, P_TOK, PARAMS, Q8, R8, ROUNDS, ROWS,
  S1_CTX, S1_DRAFT, SC, TRACE, VAL, wallFac, type LedgerRow, type Round,
} from './speculativeDecodingData'
import styles from './SpeculativeDecoding.module.css'

const G = [1, 2, 3, 4, 5, 6, 7, 8]
const PARTS = [
  { name: '主干 4 层', code: 'GPT.blocks' },
  { name: '嵌入表', code: 'GPT.tok' },
  { name: '两个 RMSNorm', code: 'mtp_norm_h / mtp_norm_e' },
  { name: '投影 M', code: 'mtp_proj' },
  { name: 'MTP Block', code: 'mtp_block' },
  { name: '输出头', code: 'norm_f + lm_head' },
]

function showCh(c: string) {
  if (c === ' ') return '␣'
  if (c === '\n') return '↵'
  return c
}

function fmt(n: number) {
  return n.toLocaleString('en-US')
}

function cssVar(value: string): CSSProperties {
  return { '--c': value } as CSSProperties
}

function pick(dist: readonly number[]) {
  let u = Math.random()
  let acc = 0
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i]
    if (u < acc) return i
  }
  return dist.length - 1
}

function methodName(r: LedgerRow) {
  if (r.method === 'plain') return '普通生成'
  if (r.method === 'mtp') return 'MTP 自草稿'
  return '小草稿模型'
}

function MaskGrid({ toks, mode, row, onPick }: {
  toks: { c: string; d: boolean }[]
  mode: number
  row: number
  onPick: (i: number) => void
}) {
  const cs = 24
  const L = 30
  const T = 30
  const n = toks.length
  const last = S1_CTX.length - 1
  const width = L + n * cs + 190
  const height = T + n * cs + 6
  const gamma = n - S1_CTX.length
  const used = (i: number) => (mode === 1 ? i >= last : i === n - 1)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="因果掩码格子">
      <text x={L} y={11} fontSize="10" fill="#6B6B68">列 = 被看的字(key)</text>
      {toks.map((t, j) => (
        <text key={`h${j}`} x={L + j * cs + cs / 2} y={T - 6} fontSize="12" fontWeight="700" textAnchor="middle" fill={t.d ? '#b8512f' : '#1A1A18'}>{showCh(t.c)}</text>
      ))}
      {toks.map((t, i) => {
        const on = used(i)
        const sel = i === row
        const k = i - last
        const label = mode === 1 ? (k < gamma ? `→ p 验收草稿 ${k + 1}` : '→ p 全接受时再送 1 个') : '→ 只用这一行出 1 个字'
        return (
          <g key={`r${i}`} className="maskrow" onClick={() => onPick(i)}>
            <rect x={0} y={T + i * cs} width={L + n * cs + 186} height={cs} fill={sel ? '#FBF1EA' : 'transparent'} />
            <text x={L - 8} y={T + i * cs + 16} fontSize="12" fontWeight="700" textAnchor="end" fill={t.d ? '#b8512f' : '#1A1A18'}>{showCh(t.c)}</text>
            {toks.map((col, j) => {
              const vis = j <= i
              let fill = vis ? (on ? (col.d ? '#E9A98F' : '#D9CFBF') : '#ECE8DE') : '#fff'
              if (sel && vis) fill = col.d ? '#D97757' : '#8C8A83'
              return <rect key={j} x={L + j * cs + 1} y={T + i * cs + 1} width={cs - 2} height={cs - 2} rx={3} fill={fill} stroke="#E5E2D9" />
            })}
            {on ? <text x={L + n * cs + 8} y={T + i * cs + 16} fontSize="11.5" fontWeight="700" fill="#D97757">{label}</text> : null}
          </g>
        )
      })}
    </svg>
  )
}

function Step1() {
  const [gamma, setGamma] = useState(3)
  const [mode, setMode] = useState(1)
  const [picked, setPicked] = useState(-1)
  const toks = [...S1_CTX].map((c) => ({ c, d: false })).concat([...S1_DRAFT.slice(0, gamma)].map((c) => ({ c, d: true })))
  const row = picked >= toks.length ? -1 : picked
  const hid = toks.length - 1 - row
  return (
    <div className={styles.scope}>
      <h2>① 一次 forward 验收一串</h2>
      <p className="lead">
        第 2 章的<Term k="causal-mask" name="因果掩码 · causal mask" def="注意力矩阵右上角置为 −∞,让每个位置只能看见自己和之前的 token。">因果掩码</Term>让第 k 个位置只看得见前 k 个字。{' '}
        所以把"上下文 + γ 个草稿"一起喂给主模型,<b>每一行输出都是"只看前面"时的结果</b>,一次 forward 就拿到 γ+1 个位置的分布 p。{' '}
        拖 γ、切模式,点格子里任意一行看它看得见什么:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>草稿长度 γ</label>
          <input type="range" min={1} max={6} step={1} value={gamma} onChange={(e) => {
            const g = Number(e.target.value)
            setGamma(g)
            setPicked((cur) => (cur >= S1_CTX.length + g ? -1 : cur))
          }} />
          <span className="rk-val">{gamma}</span>
        </div>
        <div className="btn-row sm">
          <button type="button" className={mode === 0 ? 'btn primary' : 'btn'} onClick={() => { setMode(0); setPicked(-1) }}>普通生成:每次只用最后一行</button>
          <button type="button" className={mode === 1 ? 'btn primary' : 'btn'} onClick={() => { setMode(1); setPicked(-1) }}>投机验收:一次用 γ+1 行</button>
        </div>
        <div className="tokstrip">
          {toks.map((t, i) => <span key={i} className={t.d ? 'tk draft' : 'tk'}>{showCh(t.c)}</span>)}
        </div>
        <div className="hp-note">灰色 8 个字取自验证集;橙色草稿字符是示意,不是模型输出。</div>
        <div className="scroll-x" style={{ marginTop: 8 }}>
          <MaskGrid toks={toks} mode={mode} row={row} onPick={setPicked} />
        </div>
        {mode === 0 ? (
          <div className="fwdstrip">
            {Array.from({ length: gamma + 1 }, (_, k) => (
              <span key={k} className="fwd">forward {k + 1}:读 {S1_CTX.length + k} 个字 → 出 1 个</span>
            ))}
          </div>
        ) : (
          <div className="fwdstrip">
            <span className="fwd one">forward 1:读 {toks.length} 个字 → 出 {gamma + 1} 个位置的 p</span>
          </div>
        )}
        <div className="dotread">
          <div className="dr"><div className="drv">{gamma + 1}</div><div className="drl">逐个生成这些字:主模型 forward 次数</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>1</div><div className="drl">投机验收:主模型 forward 次数</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--good)' }}>{CAUSAL_MAXDIFF.toFixed(1)}</div><div className="drl">实测:前 56 个位置的 logits 最大差</div></div>
        </div>
        <div className="note" style={{ marginTop: 10 }}>
          {row < 0 ? (
            mode === 1 ? (
              <>橙字标注的 <b>{gamma + 1}</b> 行都是有用输出:前 {gamma} 行各给出一个草稿位置上主模型的 p,最后一行在草稿全部接受时再给出一个字。点任意一行看它的视野。</>
            ) : (
              <>普通生成每次 forward 只取最后一行,吐 1 个字,接回输入再跑。要得到同样 {gamma + 1} 个字,主模型要跑 {gamma + 1} 次。</>
            )
          ) : (
            <>第 <b>{row + 1}</b> 行(字 <code>{showCh(toks[row].c)}</code>)看得见前 {row + 1} 列,{hid > 0 ? `右边 ${hid} 列被因果掩码挡住。` : '已经是最后一行。'}它输出的是"下一个字"的分布,和它右边喂了什么无关,所以草稿写在后面不会污染它。</>
          )}
        </div>
      </div>
      <div className="note">
        最右一格读数来自 <code>14_mtp.py</code>:同一段 64 字符的验证集文本,只喂前 56 个字 vs 喂满 64 个字,前 56 个位置的 logits 逐个比较,最大差 <b>0.0</b>。多喂的 8 个字没有改动前面任何一个位置的输出。
      </div>
      <div className="codepath">↳ 代码:<b>14_mtp.py</b> 的 <code>spec_draft_model</code> 【步骤 2】<code>main_model(crop(seq + drafts))</code> 取 <code>ml[0, -(gamma + 1):]</code></div>
      <Dig title="草稿中途猜错了,后面那几行不就白算了?">
        是白算了。第一个被拒绝的位置之后,草稿全部作废,那几行的 p 也一起丢掉。
        但这次 forward 本来就要跑:哪怕只接受 0 个草稿,主模型也会在拒绝位置重抽出 1 个字,不比普通生成少。
        错位置之前的那些行,因为因果掩码看不见后面的错字,算出来的 p 仍然有效。
      </Dig>
      <Dig title="真实推理系统里,这一步怎么和 KV cache 配合?">
        上下文的 K/V 已经在 <Term k="kv-cache" name="KV-cache · 键值缓存" def="把过去每个 token 的 K/V 缓存下来,生成新 token 时只算新的一列,避免重算整段。">KV cache</Term> 里,验收时只需要把"最后一个已确认的字 + γ 个草稿"这一小段送进去,
        算出它们的 γ+1 行输出,同时把它们的 K/V 追加进 cache。被拒绝的草稿对应的 K/V 截掉即可。
        本关的教学脚本没有 KV cache,每次 forward 都把最近 64 个字整段重算,机制一样,只是更慢。
      </Dig>
      <div className="next-hint">↳ 下一步:一次 forward 拿到了 γ+1 个 p,草稿员当时给的是它自己的分布 q。p 和 q 不一样时,收还是不收?</div>
    </div>
  )
}

function acceptHead(i: number) {
  const c = showCh(SC.top[i])
  const p = SC.p[i]
  const q = SC.q[i]
  if (q === 0) return <>草稿给 <span className="hl">{c}</span> 的概率 q = 0(四位小数下),草稿员几乎抽不到它;它主要从拒绝后的残差里来。</>
  if (p >= q) return <>草稿抽到 <span className="hl">{c}</span>:p = {p.toFixed(4)} ≥ q = {q.toFixed(4)},接受概率 min(1, p/q) = <span className="hl">1</span>,一定收下。</>
  return <>草稿抽到 <span className="hl">{c}</span>:p = {p.toFixed(4)} {'<'} q = {q.toFixed(4)},接受概率 min(1, p/q) = <span className="hl">{(p / q).toFixed(3)}</span>,其余 {(1 - p / q).toFixed(3)} 被拒绝后重抽。</>
}

function Step2() {
  const [sel, setSel] = useState(1)
  const [scale, setScale] = useState(0)
  const [hist, setHist] = useState<number[]>(() => new Array(8).fill(0))
  const [n, setN] = useState(0)
  const [log, setLog] = useState<ReactNode>('点"抽一次"。')
  const widthOf = (v: number) => `${(scale === 0 ? 100 * v : 100 * Math.sqrt(v)).toFixed(2)}%`
  const p = SC.p[sel]
  const q = SC.q[sel]
  const ch = showCh(SC.top[sel])
  const mn = Math.min(p, q)
  const rs = Math.max(0, p - q)
  const tv = n ? 0.5 * P8.reduce((acc, v, i) => acc + Math.abs(hist[i] / n - v), 0) : 0
  function drawOne() {
    const x = pick(Q8)
    const a = Math.min(1, P8[x] / Q8[x])
    const u = Math.random()
    const ok = u < a
    const y = ok ? x : pick(R8)
    setHist((prev) => {
      const next = prev.slice()
      next[y] += 1
      return next
    })
    setN((prev) => prev + 1)
    setLog(<>草稿从 q 抽到 <b>{showCh(SC.top[x])}</b>,接受概率 {a.toFixed(3)},随机数 u = {u.toFixed(3)} → {ok ? <><span className="acc">接受</span>,输出 {showCh(SC.top[y])}</> : <><span className="rej">拒绝</span>,从残差 max(0,p−q) 重抽到 <b>{showCh(SC.top[y])}</b></>}</>)
  }
  function drawMany() {
    const next = hist.slice()
    let count = n
    let rej = 0
    for (let k = 0; k < 10000; k++) {
      const x = pick(Q8)
      const a = Math.min(1, P8[x] / Q8[x])
      const u = Math.random()
      if (u < a) {
        next[x] += 1
        count += 1
      } else {
        rej += 1
        next[pick(R8)] += 1
        count += 1
      }
    }
    setHist(next)
    setN(count)
    setLog(<>这 1 万次里拒绝 <span className="rej">{rej}</span> 次,接受率 {(1 - rej / 10000).toFixed(4)}。</>)
  }
  return (
    <div className={styles.scope}>
      <h2>② 接受规则:min(1, p/q)</h2>
      <p className="lead">
        草稿员从 q 里抽出一个字 x。主模型给它的概率是 p(x)。规则(Leviathan et al. 2023,arXiv 2211.17192 §2.3):{' '}
        <b>以 <code>min(1, p(x)/q(x))</code> 的概率接受</b>;拒绝时从 <code>max(0, p−q)</code> 归一化后的分布里重抽一个。{' '}
        下面是验证集里一个真实位置,上下文结尾 <code>{SC.context.slice(-12).replace(/\n/g, '↵')}</code>,主模型与草稿模型对下一个字的前 8 名。<b>点一行</b>,假设草稿抽到了它:
      </p>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className={scale === 0 ? 'btn primary' : 'btn'} onClick={() => setScale(0)}>条长:线性</button>
          <button type="button" className={scale === 1 ? 'btn primary' : 'btn'} onClick={() => setScale(1)}>条长:√ 放大小概率</button>
        </div>
        <div className="legend">
          <span style={cssVar('var(--accent)')}>p · 主模型</span>
          <span style={cssVar('var(--e1)')}>q · 草稿模型</span>
          <span style={cssVar('var(--good)')}>投机采样 20 万次的频率</span>
        </div>
        <div>
          {SC.top.map((c, i) => (
            <div key={c} className={i === sel ? 'pqrow sel' : 'pqrow'} onClick={() => setSel(i)}>
              <div className="ch">{showCh(c)}</div>
              <div className="pqbars">
                <div className="pqbar" style={{ width: widthOf(SC.p[i]), background: 'var(--accent)' }} />
                <div className="pqbar" style={{ width: widthOf(SC.q[i]), background: 'var(--e1)' }} />
                <div className="pqbar" style={{ width: widthOf(SC.spec[i]), background: 'var(--good)' }} />
              </div>
              <div className="pqnum">p {SC.p[i].toFixed(4)}<br />q {SC.q[i].toFixed(4)} · 投机 {SC.spec[i].toFixed(4)}</div>
            </div>
          ))}
        </div>
        <div className="glucalc">
          {acceptHead(sel)}<br />
          输出 {ch} 的概率 = 草稿抽到且接受 min(p,q) = {mn.toFixed(4)} + 残差补上 max(0, p−q) = {rs.toFixed(4)} = <span className="hl">{(mn + rs).toFixed(4)}</span> = p({ch})
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--good)' }}>{SC.tv_spec_vs_p.toFixed(4)}</div><div className="drl">20 万次:投机采样 vs p 的总变差距离</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{SC.tv_q_vs_p.toFixed(4)}</div><div className="drl">草稿 q vs p 的总变差距离</div></div>
          <div className="dr"><div className="drv">{SC.accept_rate.toFixed(4)}({SC.alpha_theory.toFixed(3)})</div><div className="drl">20 万次里的接受率(理论 Σmin(p,q))</div></div>
        </div>
      </div>
      <div className="sub-h"><span className="badge">亲手抽</span>在页面里跑同一套规则</div>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className="btn" onClick={drawOne}>抽一次</button>
          <button type="button" className="btn" onClick={drawMany}>连抽 1 万次</button>
          <button type="button" className="btn" onClick={() => { setHist(new Array(8).fill(0)); setN(0); setLog('点"抽一次"。') }}>清零</button>
        </div>
        <div className="simlog">{log}</div>
        <div style={{ marginTop: 10 }}>
          {SC.top.map((c, i) => {
            const f = n ? hist[i] / n : 0
            return (
              <div key={c} className="pqrow" style={{ cursor: 'default' }}>
                <div className="ch">{showCh(c)}</div>
                <div className="pqbars">
                  <div className="pqbar" style={{ width: widthOf(P8[i]), background: 'var(--accent)' }} />
                  <div className="pqbar" style={{ width: widthOf(f), background: '#8C8A83' }} />
                </div>
                <div className="pqnum">p {P8[i].toFixed(4)}<br />页面 {f.toFixed(4)}({hist[i]} 次)</div>
              </div>
            )
          })}
        </div>
        <div className="hp-note">
          {n > 0 ? (
            <>已抽 <b>{n.toLocaleString('en-US')}</b> 次,灰条是页面模拟的频率,与 p 的总变差距离 <b>{tv.toFixed(4)}</b>。页面只用前 8 名的 p、q 并各自重新归一化(其余 57 个字符 p 合计约 0.0002)。</>
          ) : (
            <>页面模拟只用前 8 名的 p、q 并各自重新归一化(其余 57 个字符 p 合计约 0.0002)。</>
          )}
        </div>
      </div>
      <div className="note">总变差距离:投机采样离 p 是 <b>0.0005</b>,草稿 q 自己离 p 是 <b>0.053</b>。经过验收的输出分布回到了 p。</div>
      <div className="codepath">↳ 代码:<b>14_mtp.py</b> 的 <code>Counter.check</code>(接受 / 残差重抽)· 20 万次模拟在脚本里"正确性(采样)"那一段</div>
      <Dig title="为什么这样验收之后,输出分布和 p 完全相同?">
        对任意一个字 x,它被输出有两条路:
        <br />① 草稿抽到 x 并被接受:<code>q(x) · min(1, p(x)/q(x)) = min(p(x), q(x))</code>;
        <br />② 草稿被拒绝(总概率 <code>1 − Σ min(p,q)</code>),再从残差里抽到 x:残差是 <code>max(0, p−q)</code> 除以它的总和, 而这个总和恰好等于 <code>Σ (p − min(p,q)) = 1 − Σ min(p,q)</code>,两者约掉,这条路的概率是 <code>max(0, p(x) − q(x))</code>。
        <br />两条路相加:<code>min(p,q) + max(0, p−q) = p(x)</code>。上面的计算卡对每个字都把这两项算了出来。 证明见 Leviathan 2023 附录 A.1;平均接受率 α = Σ min(p,q)(Corollary 3.6)。
      </Dig>
      <Dig title="主模型比草稿更确定(p > q)的字,为什么一定接受?">
        p(x) ≥ q(x) 时 <code>p/q ≥ 1</code>,接受概率取 1。草稿抽到 x 的频率 q(x) 还不够 p(x),全部收下也只是"不超额";
        差的那部分 <code>p(x) − q(x)</code> 由拒绝后的残差分布补上。
        反过来 q(x) &gt; p(x) 的字(本例里的 <code>e</code>:q=0.0489,p=0.0062)草稿抽得太多,只按 p/q 的比例收下,多出来的被拒绝。
      </Dig>
      <div className="next-hint">↳ 下一步:每个草稿有一定概率被接受。那一轮该让草稿员猜几个?猜多了,后面的更容易作废。</div>
    </div>
  )
}

function axisTicks(ymax: number) {
  const step = ymax <= 2 ? 0.5 : 1
  const out: number[] = []
  for (let i = 0; i * step <= ymax + 1e-9; i++) out.push(i * step)
  return out
}

function axisText(v: number) {
  return v % 1 ? v.toFixed(1) : v.toFixed(0)
}

function GammaChart({ alpha, c, metric, sel, onPick }: {
  alpha: number
  c: number
  metric: number
  sel: number
  onPick: (i: number) => void
}) {
  const W = 600
  const H = 270
  const L = 46
  const R = 16
  const T = 16
  const B = 40
  const f = (g: number) => (metric === 0 ? expTok(alpha, g) : wallFac(alpha, g, c))
  const real = (r: LedgerRow) => (metric === 0 ? r.tokens_per_main : (r.speedup_wall ?? 1))
  const ys = G.map(f).concat(DRAFT_ROWS.map(real))
  const ymax = Math.max(metric === 0 ? 4 : 2, Math.ceil(Math.max(...ys) * 2) / 2)
  const X = (g: number) => L + ((g - 1) * (W - L - R)) / 7
  const Y = (v: number) => T + (H - T - B) * (1 - v / ymax)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="γ 与期望吐字数 / 墙钟加速">
      {axisTicks(ymax).map((v) => (
        <g key={v}>
          <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke="#EEEBE1" />
          <text x={L - 6} y={Y(v) + 4} fontSize="10.5" textAnchor="end" fill="#6B6B68">{axisText(v)}</text>
        </g>
      ))}
      {metric === 1 ? (
        <>
          <line x1={L} y1={Y(1)} x2={W - R} y2={Y(1)} stroke="#9a3a22" strokeDasharray="4 3" />
          <text x={W - R - 2} y={Y(1) - 5} fontSize="10.5" textAnchor="end" fill="#9a3a22">1.0 = 和普通生成一样快</text>
        </>
      ) : null}
      {G.map((g) => <text key={g} x={X(g)} y={H - B + 16} fontSize="11" textAnchor="middle" fill="#6B6B68">{g}</text>)}
      <text x={(L + W - R) / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="#6B6B68">γ(每轮草稿长度)</text>
      <polyline fill="none" stroke="#D97757" strokeWidth="2.5" points={G.map((g) => `${X(g)},${Y(f(g)).toFixed(1)}`).join(' ')} />
      {G.map((g) => <circle key={`o${g}`} cx={X(g)} cy={Y(f(g))} r="3" fill="#D97757" />)}
      {DRAFT_ROWS.map((r, i) => (
        <g key={r.gamma} className="maskrow s3dot" onClick={() => onPick(i)}>
          <circle cx={X(r.gamma)} cy={Y(real(r))} r={i === sel ? 8 : 6} fill="#3a63c0" stroke="#fff" strokeWidth="2" />
          <text x={X(r.gamma) + 9} y={Y(real(r)) - 8} fontSize="10.5" fontWeight="700" fill="#3a63c0">{real(r).toFixed(3)}</text>
        </g>
      ))}
    </svg>
  )
}

function bestGamma(alpha: number, c: number) {
  let best = 1
  G.forEach((g) => {
    if (wallFac(alpha, g, c) > wallFac(alpha, best, c)) best = g
  })
  return best
}

function Step3() {
  const [alpha, setAlpha] = useState(0.7)
  const [c, setC] = useState(C_PRESETS[0])
  const [metric, setMetric] = useState(0)
  const [sel, setSel] = useState(-1)
  const preset = C_PRESETS.findIndex((v) => Math.abs(v - c) < 1e-9)
  const best = bestGamma(alpha, c)
  const picked = sel >= 0 ? DRAFT_ROWS[sel] : undefined
  return (
    <div className={styles.scope}>
      <h2>③ γ 猜几个</h2>
      <p className="lead">
        设每个草稿被接受的概率都是 α(相互独立)。一轮里主模型 forward 1 次,期望吐出{' '}
        <code>(1 − α^(γ+1)) / (1 − α)</code> 个字(Leviathan 2023 式 (1))。{' '}
        但草稿员每轮要跑 γ 次,每次耗时是主模型的 c 倍,墙钟加速的期望是上式再除以 <code>γc + 1</code>(Theorem 3.8)。{' '}
        拖 α 和 c,橙线是公式,蓝点是本关小草稿模型的 6 次真实测量:
      </p>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className={metric === 0 ? 'btn primary' : 'btn'} onClick={() => setMetric(0)}>每次主 forward 吐几个字</button>
          <button type="button" className={metric === 1 ? 'btn primary' : 'btn'} onClick={() => setMetric(1)}>墙钟加速</button>
        </div>
        <div className="rk-row">
          <label>接受率 α</label>
          <input type="range" min={0.3} max={0.95} step={0.01} value={alpha} onChange={(e) => { setAlpha(Number(e.target.value)); setSel(-1) }} />
          <span className="rk-val">{alpha.toFixed(2)}</span>
        </div>
        <div className="rk-row">
          <label>草稿耗时比 c</label>
          <input type="range" min={0} max={0.6} step={0.01} value={c} onChange={(e) => { setC(Number(e.target.value)); setSel(-1) }} />
          <span className="rk-val">{c.toFixed(2)}</span>
        </div>
        <div className="btn-row sm">
          <button type="button" className={preset === 0 ? 'btn primary' : 'btn'} onClick={() => { setC(C_PRESETS[0]); setSel(-1) }}>本关实测 c</button>
          <button type="button" className={preset === 1 ? 'btn primary' : 'btn'} onClick={() => { setC(C_PRESETS[1]); setSel(-1) }}>c = 0.05</button>
          <button type="button" className={preset === 2 ? 'btn primary' : 'btn'} onClick={() => { setC(C_PRESETS[2]); setSel(-1) }}>c = 0(草稿不花时间)</button>
        </div>
        <div className="chartbox">
          <GammaChart alpha={alpha} c={c} metric={metric} sel={sel} onPick={setSel} />
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{c === 0 && alpha > 0 ? '越大越好' : `γ = ${best}`}</div><div className="drl">当前 α、c 下墙钟最快的 γ</div></div>
          <div className="dr"><div className="drv">{wallFac(alpha, best, c).toFixed(2)}×</div><div className="drl">这个 γ 的理论墙钟加速</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e1)' }}>{C_MEAS.toFixed(2)}</div><div className="drl">本关 c = 草稿 / 主模型单次 forward</div></div>
        </div>
        <div className="note" style={{ marginTop: 10 }}>
          {picked && picked.alpha != null && picked.speedup_wall != null && picked.expected_tokens_per_main != null ? (
            <><b>γ = {picked.gamma} 的真实测量</b>:接受率 α = {picked.alpha.toFixed(4)},主模型 forward {picked.main_forwards} 次、草稿 {picked.draft_forwards} 次, 每次主 forward 吐 <b>{picked.tokens_per_main}</b> 个字(用这一行自己的 α 代入式 (1) 期望 {picked.expected_tokens_per_main}), 墙钟 {picked.seconds.toFixed(2)} s,加速 <b>{picked.speedup_wall.toFixed(3)}×</b>;用这个 α 和实测 c 代入 Theorem 3.8 是 {wallFac(picked.alpha, picked.gamma, C_MEAS).toFixed(3)}×。</>
          ) : metric === 0 ? (
            <>α = {alpha.toFixed(2)} 时,γ 从 1 加到 8,期望吐字从 {expTok(alpha, 1).toFixed(2)} 涨到 {expTok(alpha, 8).toFixed(2)},上限是 1/(1−α) = {(1 / (1 - alpha)).toFixed(2)}:越往后的草稿越可能被前面的拒绝连累。点蓝点看真实测量。</>
          ) : (
            <>把草稿的耗时算进去,曲线在 γ = {best} 达到最高 {wallFac(alpha, best, c).toFixed(2)}×,再往后草稿跑得比省下的多。拖 c 到 0.05 看论文那种草稿够便宜时的形状。</>
          )}
        </div>
      </div>
      <div className="note">
        c 决定 γ 能开多大。本关草稿模型单次 forward 0.225 ms、主模型 0.836 ms,c ≈ 0.27;Leviathan 论文实验里草稿比目标模型小两个数量级,c 始终 <b>小于 0.05</b>(Definition 3.7 下的说明)。
      </div>
      <div className="codepath">↳ 代码:<b>14_mtp.py</b> 主测量那段 <code>for gamma in [1, 2, 3, 4, 6, 8]</code>,每行记下 <code>tokens_per_main</code> 与 <code>expected_tokens_per_main</code></div>
      <Dig title="γ=8 每次吐的字比 γ=6 还少,公式不对吗?">
        公式里的 α 是一个固定值,真实测量里每一行的 α 各不相同:γ=6 那次实测接受率 0.717,γ=8 那次 0.676。
        把各自的 α 代进公式,γ=6 期望 3.192 个、γ=8 期望 2.993 个,实测 3.093 和 2.956,方向一致。
        每行只生成 600 个字、跑一次,α 在 0.67–0.75 之间浮动属于这个样本量下的波动。
        公式还假设每个位置的接受相互独立,真实文本里难猜的字往往扎堆出现。
      </Dig>
      <div className="next-hint">↳ 下一步:小草稿模型要单独训练、单独部署,每轮还要自回归跑 γ 次。能不能让主模型训练时顺手学会打草稿?</div>
    </div>
  )
}

function partBody(part: number) {
  if (part === 0) return <>主模型自己的 4 个 Block,{fmt(4 * P_BLOCK)} 个参数。MTP 不改它,只读它最后一层输出的隐状态 h<sub>t</sub>(<code>forward</code> 返回的第二个值)。</>
  if (part === 1) return <>与主模型<b>共用</b>,{fmt(P_TOK)} 个参数(65 个字符 × 128 维)。MTP 用它查 x<sub>t+1</sub> 的嵌入。</>
  if (part === 2) return <>MTP 自己的,各 128 个参数,共 {P_NORMS}。h<sub>t</sub> 和 Emb(x<sub>t+1</sub>) 尺度不同,先各自归一化再拼接。</>
  if (part === 3) return <>MTP 自己的,把拼接后的 2×128 = 256 维压回 128 维:256 × 128 = <b>{fmt(P_PROJ)}</b> 个参数。对应 DeepSeek-V3 式 (21) 的 M<sub>k</sub> ∈ R<sup>d×2d</sup>。</>
  if (part === 4) return <>MTP 自己的 1 个 Block,结构和主干每层相同(GQA 注意力 + SwiGLU):<b>{fmt(P_BLOCK)}</b> 个参数,占 MTP 模块的 {(100 * P_BLOCK / PARAMS.mtp).toFixed(0)}%。</>
  return <>与主模型<b>共用</b>,{fmt(P_HEAD_SHARED)} 个参数。所以 MTP 头的 logits 和主模型在同一个 65 字符的词表上,可以直接当草稿分布 q。</>
}

function MtpBox({ i, x, y, w, h, label, sub, shared, part, onPick }: {
  i: number
  x: number
  y: number
  w: number
  h: number
  label: string
  sub: string
  shared: boolean
  part: number
  onPick: (i: number) => void
}) {
  const sel = i === part
  return (
    <g className="mtp-part" onClick={() => onPick(i)}>
      <rect x={x} y={y} width={w} height={h} rx={9} fill={sel ? '#FBF1EA' : shared ? '#F4F2EA' : '#fff'} stroke={sel ? '#D97757' : shared ? '#cfc9ba' : '#3f7d63'} strokeWidth={sel ? 2.5 : 1.5} strokeDasharray={shared ? '5 3' : undefined} />
      <text x={x + w / 2} y={y + h / 2 - 3} fontSize="12" fontWeight="700" textAnchor="middle" fill="#1A1A18">{label}</text>
      <text x={x + w / 2} y={y + h / 2 + 13} fontSize="10" textAnchor="middle" fill="#6B6B68">{sub}</text>
    </g>
  )
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8C8A83" strokeWidth="1.5" markerEnd="url(#sdArrow)" />
}

function roundNote(rd: Round, chars: string[]) {
  const txt = chars.slice(rd.s, rd.s + rd.n).map(showCh).join('')
  if (rd.k === 'first') return <>第 1 次 forward 还没有草稿,主模型采样出 <b>{txt}</b>,MTP 头给出第一个草稿。</>
  if (rd.k === 'acc') {
    const extra = rd.n > 1 ? showCh(chars[rd.s + 1]) : '(样本在此截断)'
    return <>这次 forward 验收上一轮的草稿 <b>{showCh(chars[rd.s])}</b>:<span className="acc">接受</span>,主模型顺手再采样 <b>{extra}</b>,一次吐 {rd.n} 个字。</>
  }
  return <>这次 forward 验收上一轮的草稿:<span className="rej">拒绝</span>,从残差里重抽出 <b>{txt}</b>,一次吐 1 个字。</>
}

function CmpBar({ name, v, max, color, band }: { name: string; v: number; max: number; color: string; band?: boolean }) {
  return (
    <div className="abrow">
      <div className="an">{name}</div>
      <div className="at">
        {band ? <div className="band" style={{ left: '85%', width: '5%' }} title="DeepSeek-V3 报告 85%–90%" /> : null}
        <div className="af" style={{ width: `${((100 * v) / max).toFixed(1)}%`, background: color }} />
      </div>
      <div className="av">{v.toFixed(4)}</div>
    </div>
  )
}

function Step4() {
  const [part, setPart] = useState(3)
  const [color, setColor] = useState(0)
  const [round, setRound] = useState(1)
  const chars = [...TRACE.text]
  const rd = ROUNDS[round - 1] ?? ROUNDS[0]
  const meta = PARTS[part]
  const box = (i: number, x: number, y: number, w: number, h: number, label: string, sub: string, shared: boolean) => (
    <MtpBox i={i} x={x} y={y} w={w} h={h} label={label} sub={sub} shared={shared} part={part} onPick={setPart} />
  )
  return (
    <div className={styles.scope}>
      <h2>④ MTP:主模型自带草稿头</h2>
      <p className="lead">
        DeepSeek-V3 的 Multi-Token Prediction(arXiv 2412.19437 §2.2):主模型最后一层的隐状态 h<sub>t</sub> 已经编码了前文,{' '}
        再拼上"下一个字"的嵌入,过一个小 Block,就能预测<b>下下个字</b>。嵌入表和输出头与主模型共用。{' '}
        推理时它每次猜 1 个字,正好当草稿员。点图里的部件看它是什么、多少参数:
      </p>
      <div className="lab">
        <div className="btn-row sm">
          {PARTS.map((item, i) => (
            <button key={item.code} type="button" className={part === i ? 'btn primary' : 'btn'} onClick={() => setPart(i)}>{item.name}</button>
          ))}
        </div>
        <div className="scroll-x">
          <svg width={640} height={250} viewBox="0 0 640 250" role="img" aria-label="MTP 模块结构">
            <defs>
              <marker id="sdArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#8C8A83" />
              </marker>
            </defs>
            <text x="10" y="236" fontSize="11" fill="#6B6B68">x₀…x_t</text>
            <Arrow x1={40} y1={222} x2={70} y2={196} />
            {box(0, 20, 140, 120, 52, '主干 4 层', '输出 h_t', true)}
            {box(5, 20, 40, 120, 48, '输出头', '→ p(x_t+1)', true)}
            <Arrow x1={80} y1={140} x2={80} y2={90} />
            {box(1, 180, 176, 110, 46, '嵌入表', 'Emb(x_t+1)', true)}
            {box(2, 180, 96, 110, 56, 'RMSNorm ×2', 'h_t 与 Emb 各一个', false)}
            <Arrow x1={140} y1={166} x2={180} y2={130} />
            <Arrow x1={235} y1={176} x2={235} y2={154} />
            {box(3, 330, 96, 110, 56, '投影 M', '256 → 128', false)}
            <Arrow x1={290} y1={124} x2={330} y2={124} />
            {box(4, 480, 96, 110, 56, 'MTP Block', 'GQA + SwiGLU', false)}
            <Arrow x1={440} y1={124} x2={480} y2={124} />
            {box(5, 480, 16, 110, 46, '输出头(共用)', '→ q(x_t+2)', true)}
            <Arrow x1={535} y1={96} x2={535} y2={64} />
            <text x="330" y="200" fontSize="10.5" fill="#6B6B68">实线框 = MTP 自己的参数</text>
            <text x="330" y="216" fontSize="10.5" fill="#6B6B68">虚线框 = 与主模型共用</text>
          </svg>
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <b>{meta.name}</b> · <code>{meta.code}</code><br />
          {partBody(part)}<br />
          MTP 自己的参数合计 {P_NORMS} + {fmt(P_PROJ)} + {fmt(P_BLOCK)} = <b>{fmt(P_MTP_SUM)}</b>{P_MTP_SUM === PARAMS.mtp ? ',与 json 的 params_mtp 一致' : <>(json 记录 {fmt(PARAMS.mtp)})</>},是主模型 {fmt(PARAMS.main)} 的 {(100 * PARAMS.mtp / PARAMS.main).toFixed(0)}%。
        </div>
      </div>
      <div className="sub-h"><span className="badge">真实样本</span>MTP 自草稿生成的 240 个字</div>
      <p className="lead" style={{ marginBottom: 8 }}>
        主模型每次 forward 做两件事:验收上一轮 MTP 头给的草稿,再顺手采样一个字;MTP 头接着给下一轮的草稿。{' '}
        接受时这次 forward 吐 2 个字,拒绝时吐 1 个。拖滑块逐次看:
      </p>
      <div className="lab">
        <div className="btn-row sm">
          <button type="button" className={color === 0 ? 'btn primary' : 'btn'} onClick={() => setColor(0)}>按来源上色</button>
          <button type="button" className={color === 1 ? 'btn primary' : 'btn'} onClick={() => setColor(1)}>不上色</button>
        </div>
        <div className="legend">
          <span style={cssVar('var(--good-soft)')}>被接受的草稿</span>
          <span style={cssVar('#E5E2D9')}>主模型采样</span>
          <span style={cssVar('var(--bad-soft)')}>拒绝后重抽</span>
        </div>
        <div className="rk-row">
          <label>第 k 次主模型 forward</label>
          <input type="range" min={1} max={ROUNDS.length} step={1} value={round} onChange={(e) => setRound(Number(e.target.value))} />
          <span className="rk-val">{round}</span>
        </div>
        <div className="hp-note">{roundNote(rd, chars)}</div>
        <div className={color === 1 ? 'trace plain' : 'trace'}>
          {chars.map((c, i) => {
            const mk = TRACE.marks[i] || 'm'
            const on = i >= rd.s && i < rd.s + rd.n
            const cls = `m${mk}${on ? ' cur' : ''}`
            if (c === '\n') {
              return <Fragment key={i}><span className={cls}>↵</span><br /></Fragment>
            }
            return <span key={i} className={cls}>{c}</span>
          })}
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{ROUNDS.length}</div><div className="drl">主模型 forward 次数</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{(chars.length / ROUNDS.length).toFixed(2)}</div><div className="drl">每次 forward 吐几个字</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--good)' }}>{(MARK_ACCEPT / (MARK_ACCEPT + MARK_REJECT)).toFixed(3)}</div><div className="drl">这段样本的草稿接受率</div></div>
        </div>
      </div>
      <div className="sub-h"><span className="badge">对比</span>同样每轮猜 1 个:MTP 头 vs 小草稿模型</div>
      <div className="lab">
        <div className="hp-note" style={{ marginBottom: 4 }}><b>接受率</b>(600 字、temperature 1.0 的主测量;蓝色虚线带 = DeepSeek-V3 报告的 85%–90%)</div>
        <CmpBar name="MTP 头" v={MTP_ROW.alpha ?? 0} max={1} color="var(--good)" band />
        <CmpBar name="小草稿模型 γ=1" v={DRAFT_G1.alpha ?? 0} max={1} color="var(--e3)" band />
        <div className="hp-note" style={{ margin: '12px 0 4px' }}><b>每次主 forward 吐几个字</b>(γ=1 时上限 2)</div>
        <CmpBar name="MTP 头" v={MTP_ROW.tokens_per_main} max={2} color="var(--good)" />
        <CmpBar name="小草稿模型 γ=1" v={DRAFT_G1.tokens_per_main} max={2} color="var(--e3)" />
        <div className="hp-note" style={{ margin: '12px 0 4px' }}><b>val loss</b>(越低越好;MTP 头预测下下个字,另外两个预测下一个字)</div>
        <CmpBar name="主模型" v={VAL.main_mtp} max={2} color="var(--e1)" />
        <CmpBar name="MTP 头" v={VAL.mtp_head} max={2} color="var(--good)" />
        <CmpBar name="小草稿模型" v={VAL.draft} max={2} color="var(--e3)" />
        <div className="hp-note" style={{ marginTop: 8 }}>MTP 头墙钟加速 {(MTP_ROW.speedup_wall ?? 0).toFixed(3)}×,小草稿模型 γ=1 为 {(DRAFT_G1.speedup_wall ?? 0).toFixed(3)}×。</div>
      </div>
      <div className="note">
        DeepSeek-V3 用顺序 MTP、深度 D=1,报告第二个 token 的接受率在 <b>85%–90%</b>,解码 TPS 为原来的 <b>1.8 倍</b>(§5.4.3)。MTP loss 权重 λ 在前 10T token 取 0.3,之后的 4.8T 取 0.1。
      </div>
      <div className="codepath">↳ 代码:<b>14_mtp.py</b> 的 <code>GPT.mtp_logits</code> · <code>spec_mtp</code> · <code>train</code> 里 <code>loss = main + args.lam * mtp</code></div>
      <Dig title="MTP 头预测的是隔一个字,val loss 为什么和主模型差不多?">
        它的输入里已经有 x<sub>t+1</sub> 的嵌入,预测 x<sub>t+2</sub> 时和主模型预测下一个字面对的是同一类问题,只是多了主模型 4 层算好的 h<sub>t</sub> 可用。
        结束时 MTP 头 val loss <b>1.5332</b>,主模型 <b>1.5276</b>。小草稿模型只有主模型 7% 的参数、从原始字符算起,val loss <b>1.8862</b>。
        推理时 x<sub>t+1</sub> 是主模型刚采样出来的真字,所以 MTP 头的草稿建立在正确的前一个字上。
      </Dig>
      <Dig title="本关 MTP 接受率落在 DeepSeek-V3 报告的区间里,算复现吗?">
        不算。DeepSeek-V3 是 671B 总参数、每 token 激活 37B 的 MoE,在 14.8T token 上预训练,评测的是多领域生成;
        本关主模型 0.74M 参数、字符级 tiny shakespeare、单种子。规模和任务差了几个数量级,两个数字接近只能说明机制在两端都能工作,不能互相印证。
      </Dig>
      <Dig title="Meta 2024 年的 MTP 和 DeepSeek-V3 的有什么不同?">
        Gloeckle et al.(arXiv 2404.19737,ICML 2024)在共享主干上接 n 个<b>独立</b>输出头,各自是一层 Transformer,并行预测后面 n 个 token;
        4-token 预测的模型用自投机解码,推理最多快 3 倍。
        DeepSeek-V3 改成<b>顺序</b>模块:第 k 个模块吃第 k−1 个的隐状态和第 i+k 个 token 的嵌入,
        原文是 "sequentially predict additional tokens and keep the complete causal chain at each prediction depth"。本关代码只做深度 1:模块输入里除了 h<sub>t</sub>,还有 x<sub>t+1</sub> 的嵌入,这是它和独立并行头最直观的区别。
      </Dig>
      <div className="next-hint">↳ 下一步:forward 次数确实少了。钟表上快了多少?把所有方法摆进一张账本。</div>
    </div>
  )
}

function Speed({ r }: { r: LedgerRow }) {
  const maxS = 1.4
  const sp = r.speedup_wall ?? 1
  const col = r.method === 'plain' ? '#8C8A83' : sp >= 1 ? 'var(--good)' : 'var(--bad)'
  return (
    <>
      {r.speedup_wall == null ? '1(基准)' : <b>{r.speedup_wall.toFixed(3)}×</b>}
      <span className="spd">
        <i style={{ width: `${((100 * Math.min(sp, maxS)) / maxS).toFixed(1)}%`, background: col }} />
        <em style={{ left: `${(100 / maxS).toFixed(1)}%` }} />
      </span>
    </>
  )
}

function Step5() {
  const [sort, setSort] = useState(0)
  const [sel, setSel] = useState(-1)
  const order = ROWS.map((_, i) => i)
  if (sort === 1) order.sort((a, b) => ROWS[b].tokens_per_main - ROWS[a].tokens_per_main)
  if (sort === 2) order.sort((a, b) => (ROWS[b].speedup_wall ?? 1) - (ROWS[a].speedup_wall ?? 1))
  const picked = sel >= 0 ? ROWS[sel] : undefined
  const gi = GREEDY.identical
  return (
    <div className={styles.scope}>
      <h2>⑤ 真实账本</h2>
      <p className="lead">
        每种方法都从 <code>ROMEO:\n</code> 开始,temperature 1.0 采样生成 600 个字,记下主模型和草稿的 forward 次数与墙钟秒数。{' '}
        RTX 4090 · CUDA · PyTorch 2.4.1 · batch=1 · 每行只跑一次。点表头按钮排序,点一行看理论值:
      </p>
      <div className="btn-row sm">
        <button type="button" className={sort === 0 ? 'btn primary' : 'btn'} onClick={() => setSort(0)}>原顺序</button>
        <button type="button" className={sort === 1 ? 'btn primary' : 'btn'} onClick={() => setSort(1)}>按每次吐字</button>
        <button type="button" className={sort === 2 ? 'btn primary' : 'btn'} onClick={() => setSort(2)}>按墙钟加速</button>
      </div>
      <div className="tbl-scroll">
        <table className="ledger">
          <tbody>
            <tr>
              <th>方法</th><th>γ</th><th>主 forward</th><th>草稿 forward</th><th>每次主 forward 吐字</th><th>接受率</th><th>秒</th><th>墙钟加速</th>
            </tr>
            {order.map((i) => {
              const r = ROWS[i]
              return (
                <tr key={`${r.method}-${r.gamma}`} className={i === sel ? 'row sel' : 'row'} onClick={() => setSel(i)}>
                  <td>{methodName(r)}</td>
                  <td>{r.method === 'plain' ? '–' : r.gamma}</td>
                  <td>{r.main_forwards}</td>
                  <td>{r.draft_forwards}</td>
                  <td><b>{r.tokens_per_main.toFixed(3)}</b></td>
                  <td>{r.alpha == null ? '–' : r.alpha.toFixed(4)}</td>
                  <td>{r.seconds.toFixed(2)}</td>
                  <td><Speed r={r} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="note">
        {picked == null ? '条上的竖线是 1.0×。点一行看它的理论墙钟加速。' : picked.method === 'plain' ? (
          <><b>普通生成</b>:600 个字、主模型 forward {picked.main_forwards} 次、{picked.seconds.toFixed(2)} s,其余各行的墙钟加速都以它为基准。</>
        ) : picked.method === 'draft' && picked.alpha != null && picked.speedup_wall != null ? (
          <><b>小草稿模型 γ={picked.gamma}</b>:α = {picked.alpha.toFixed(4)},c = {MS.draft} / {MS.main} ≈ {C_MEAS.toFixed(3)}。 Theorem 3.8 理论墙钟加速 {wallFac(picked.alpha, picked.gamma, C_MEAS).toFixed(3)}×,实测 <b>{picked.speedup_wall.toFixed(3)}×</b>。 主模型 forward 从 600 次降到 {picked.main_forwards} 次,草稿 forward {picked.draft_forwards} 次。</>
        ) : (
          <><b>MTP 自草稿</b>:α = {picked.alpha?.toFixed(4)},每次 forward 期望吐 1 + α = {picked.expected_tokens_per_main},实测 {picked.tokens_per_main}。 MTP 头的耗时没有单独计时,没法代入 Theorem 3.8;它不需要单独的草稿模型从头跑,只在主模型的隐状态上多过 1 个 Block。实测墙钟 <b>{picked.speedup_wall?.toFixed(3)}×</b>。</>
        )}
      </div>
      <div className="note">
        forward 次数最多省到 <b>1/3</b>(γ=6 每次吐 3.09 个字),墙钟加速最高 <b>1.27×</b>(MTP),γ=6、γ=8 比普通生成还慢。
      </div>
      <div className="sub-h"><span className="badge">正确性</span>输出没有被改动</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div><b>贪心逐字一致</b>:{GREEDY.prompts} 段验证集提示(各 {GREEDY.prompt_len} 字)× 各生成 {GREEDY.tokens_each} 字,投机解码与主模型贪心生成逐字相同的段数: 小草稿 γ=1 <b>{gi.draft_g1}/{GREEDY.prompts}</b>、γ=4 <b>{gi.draft_g4}/{GREEDY.prompts}</b>、γ=8 <b>{gi.draft_g8}/{GREEDY.prompts}</b>、MTP <b>{gi.mtp}/{GREEDY.prompts}</b>。</div></li>
        <li><span className="ck">✓</span><div><b>采样分布一致</b>:同一位置重复 20 万次投机采样,与 p 的总变差距离 <b>{SC.tv_spec_vs_p}</b>;草稿 q 本身与 p 相差 <b>{SC.tv_q_vs_p}</b>(见 STEP 2,推导也在那里)。</div></li>
        <li><span className="ck">✓</span><div><b>一次 forward 验收的前提成立</b>:前 56 个位置单独算与多喂 8 个字再算,logits 最大差 <b>{CAUSAL_MAXDIFF.toFixed(1)}</b>(见 STEP 1)。</div></li>
        <li><span className="ck">✓</span><div><b>带 MTP loss 训练的主模型</b>:val loss <b>{VAL.main_mtp}</b>,不带的 <b>{VAL.main_nomtp}</b>,差 {(VAL.main_mtp - VAL.main_nomtp).toFixed(4)},在单种子噪声量级内,本关不据此判断 MTP 让主模型变好或变差。</div></li>
      </ul>
      <Dig title="forward 省了三分之二,墙钟为什么只快 1.0–1.3 倍,γ=6、8 还变慢?">
        ① <b>草稿不够便宜</b>:草稿模型单次 forward 0.225 ms,是主模型 0.836 ms 的约 27%。γ=8 时每轮 8 次草稿 forward 加起来比一次主 forward 还贵。
        <br />② <b>γ 次草稿逐个跑</b>:草稿员自己也是自回归,γ 个字要 γ 次 forward,每次都有 Python 调度、kernel 启动的固定开销。
        这类开销不随模型变小而缩小:草稿模型参数只有主模型的 7%,单次 forward 却要主模型 27% 的时间。
        <br />③ <b>每个字都有采样开销</b>:batch=1,脚本每抽一个字都把分布拷回 CPU 再 multinomial,草稿的字也要抽,验收时还有 <code>.item()</code> 同步。
        普通生成 600 个字 0.53 s,折合每个字约 0.88 ms,比单次 forward 的 0.836 ms 多出来的主要是这类开销。
        <br />④ <b>每行只测一次</b>:几百毫秒量级的计时,相邻两行差 0.02–0.03 s 可能就是抖动。
        <br />点表里任意一行,可以看到用该行 α 和 c ≈ 0.27 代进 Theorem 3.8 的理论墙钟加速,实测都低于它。式子只计 forward 的耗时,③ 不在式子里。
      </Dig>
      <Dig title="600 个字早就超出 64 的上下文窗口了,这几行的输出还和主模型一致吗?">
        一致的是<b>分布</b>,口径是"验收时的截断规则"。总长超过 block_size=64 以后,普通生成每步把窗口右移 1 格;
        验收时却是把"已生成 + γ 个草稿"整体截成最后 64 个字,靠后的草稿位置看到的历史更短。
        两边其实是窗口规则不同的两台生成器。所以这几行保证的是:输出分布等于"主模型在验收截断规则下"的分布,不是和普通滑窗生成逐字对应。
        <br /><br />
        这也是贪心一致性检查只在窗口以内做的原因:8 个字的提示 + 生成 48 个字 + 最多 8 个草稿 = 64。
        真实系统用 KV cache,上下文远长于生成长度,不会碰到这个问题。
      </Dig>
      <Dig title="贪心解码时,接受规则变成什么?">
        temperature=0 时脚本把 p、q 都换成 argmax 位置为 1 的 one-hot(<code>dist</code> 函数)。
        草稿抽到的字 x 是 q 的 argmax:若它也是 p 的 argmax,p(x)/q(x) = 1,接受;否则 p(x) = 0,必拒绝,
        残差 <code>max(0, p−q)</code> 只剩 p 的 argmax 那一格,重抽出来的就是主模型自己会选的字。
        所以贪心下投机解码的输出应当和主模型贪心逐字相同,下面的检查就是验证这一点。
      </Dig>
      <Dig title="带 MTP loss 训练,主模型本身变好了吗?">
        本关看不出来。同样 5000 步,带 MTP loss(λ=0.3)的主模型 val loss <b>1.5276</b>,不带的 <b>1.5357</b>,差 −0.008。
        两次都是单种子,这个差距在种子噪声的量级内,不足以说明 MTP 让主模型变好。
        Gloeckle 2024 报告的收益出现在 13B 规模的代码任务上,和本关的规模、数据都不同。
      </Dig>
      <Dig title="读原论文时,为什么 Chen 2023 和 Leviathan 2023 的 p、q 对不上?">
        两篇论文同期独立提出同一套规则,字母含义相反。
        Leviathan et al.(arXiv 2211.17192,ICML 2023)里 <b>p 是目标模型、q 是草稿</b>,接受概率 <code>min(1, p/q)</code>;
        Chen et al.(DeepMind,arXiv 2302.01318)里 <b>q 是目标模型、p 是草稿</b>,写作 <code>min(1, q/p)</code>,残差 <code>(q − p)₊</code>。
        本页统一用 Leviathan 的记号:p = 主模型,q = 草稿。Chen 2023 在 Chinchilla 70B 上报告分布式环境下 2–2.5 倍解码加速。
      </Dig>
      <Dig title="Medusa、EAGLE 又是怎么打草稿的?">
        <b>Medusa</b>(Cai et al.,arXiv 2401.10774):在主模型上加几个额外的解码头,并行预测后面多个 token,再用树注意力一次验收多条候选。Medusa-1 加速超过 2.2 倍,Medusa-2 为 2.3–3.6 倍。
        <br /><b>EAGLE</b>(Li et al.,arXiv 2401.15077):草稿在特征层(倒数第二层)做自回归,原文认为这比在 token 层自回归更直接;LLaMA2-Chat 70B 上 2.7–3.5 倍。
        DeepSeek-V3 论文提到自己保持因果链的做法和 EAGLE 相近,区别是 EAGLE 的目标是投机解码,MTP 首先用来改进训练。
      </Dig>
      <div className="codepath">↳ 跑法:<code>python 14_mtp.py</code>(主模型 + MTP 头 + 草稿模型 + 全部测量)· <code>python 14_mtp.py --mtp 0 --no-spec</code>(不带 MTP loss 的对照)</div>
    </div>
  )
}

export function SpeculativeDecoding() {
  const chapter = findChapter('speculative-decoding')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="speculative-decoding"
      title="投机解码与 MTP:先便宜地猜,再一次验收"
      subtitle={
        <>
          第 5 章的<Term k="autoregressive" name="自回归 · autoregressive" def="每次只生成一个 token,把它接回输入再生成下一个。">自回归</Term>生成,每吐一个字都要把主模型完整跑一遍。{' '}
          <Term k="speculative-decoding" name="投机解码 · speculative decoding" def="让便宜的草稿员先猜 γ 个 token,主模型一次 forward 算出这些位置的分布,按 min(1, p/q) 逐个接受,拒绝时从 max(0, p−q) 重抽。输出分布与主模型逐个采样相同,省的是主模型 forward 次数。">投机解码</Term>换一种分工:{' '}
          便宜的草稿员先猜 γ 个字,主模型<b>一次 forward</b> 把这 γ 个位置全算出来,再按一条接受规则逐个验收。{' '}
          草稿员可以是一个小模型,也可以是主模型自带的{' '}
          <Term k="mtp" name="MTP · 多 token 预测" def="Multi-Token Prediction:训练时让主模型顺带预测更远的 token。DeepSeek-V3 用顺序的 MTP 模块(深度 1),推理时它就是现成的草稿员。">MTP 头</Term>。{' '}
          本关两种都真训一遍,再在 RTX 4090 上量账。配套代码 <code>phase4-efficiency/14_mtp.py</code>。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">主模型 <b>4 层 · 0.743M</b> <i>n_embd 128,第 12 章 LLaMA 骨架</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">草稿模型 <b>1 层 64 维</b> <i>0.055M,主模型的 7%</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">γ <b>1–8</b> <i>每轮草稿长度</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">MTP 深度 <b>1</b> <i>多预测 1 个字</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">λ <b>0.3</b> <i>MTP loss 权重</i></HpChip>
          <HpChip color="#6B6B68" bg="#EEEBE1">block_size <b>64</b> <i>上下文窗口</i></HpChip>
          <span className="hp-note">RTX 4090 · CUDA · PyTorch 2.4.1 · tiny shakespeare 字符级 · 单种子</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 投机解码与 MTP · 通关</div>
          <div className="cs">你亲手验过了接受规则为什么不改分布、γ 为什么不能无限加、MTP 头为什么接受率更高,也看清了玩具规模下省 forward 不等于省时间。</div>
        </>
      }
    />
  )
}
