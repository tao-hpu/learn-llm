// 旧页 goto 不重置各步选择：滑块、读块进度、Q 块、扫描格、代码高亮、实测模式都留着。
import { useState } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import { flashData as D, type BenchImpl, type FlashBench } from './flashAttentionData'
import styles from './FlashAttention.module.css'

const gpu = D.gpu.replace('NVIDIA GeForce ', '')
const en = (v: number) => v.toLocaleString('en-US')
const fmtMB = (v: number) => (
  v >= 1024
    ? (v / 1024).toFixed(v >= 10240 ? 0 : 1) + ' GB'
    : (v >= 10 ? Math.round(v) : v.toFixed(1)) + ' MB'
)
const DASH = '\u2013'
const MINUS_INF = '\u2212\u221e'
const btnCls = (on: boolean) => (on ? 'btn primary' : 'btn')

const OX = D.online_softmax.x
const OB = D.online_softmax.block
const NB = 6
const CELL = 40
const PAD = 26

const CODE: [string, number][] = [
  ['q = tl.load(Q + base + rows[:, None] * s_t + dims[None, :], mask=rows[:, None] < T)', 0],
  ['m = tl.full([BLOCK_M], float("-inf"), tl.float32)', 3],
  ['l = tl.zeros([BLOCK_M], tl.float32)', 3],
  ['acc = tl.zeros([BLOCK_M, D], tl.float32)', 4],
  ['hi = tl.minimum((pid_m + 1) * BLOCK_M, T)          # 因果:只读到对角线', 2],
  ['for start in range(0, hi, BLOCK_N):', -1],
  ['    cols = start + tl.arange(0, BLOCK_N)', -1],
  ['    k = tl.load(K + base + cols[None, :] * s_t + dims[:, None])', 1],
  ['    s = tl.dot(q, k) * scale                         # (BLOCK_M, BLOCK_N),留在片上', 1],
  ['    s = tl.where(rows[:, None] >= cols[None, :], s, float("-inf"))', 2],
  ['    m_new = tl.maximum(m, tl.max(s, 1))', 3],
  ['    p_ = tl.math.exp2(s - m_new[:, None])', 3],
  ['    alpha = tl.math.exp2(m - m_new)', 3],
  ['    l = l * alpha + tl.sum(p_, 1)', 3],
  ['    v = tl.load(V + base + cols[:, None] * s_t + dims[None, :])', 4],
  ['    acc = acc * alpha[:, None] + tl.dot(p_.to(v.dtype), v)', 4],
  ['    m = m_new', 3],
  ['acc = acc / l[:, None]', 5],
  ['tl.store(O + base + rows[:, None] * s_t + dims[None, :], acc.to(O.dtype.element_ty))', 5],
]
const CODE_BTNS = ['读一块 Q', '算一块 S', '因果掩码', '更新 m、l', '累加 acc', '除以 l、写回']
const CHECK_LAB: Record<string, string> = {
  naive: '朴素',
  blocked: 'PyTorch 分块',
  triton: 'Triton kernel',
  sdpa: 'SDPA(bf16)',
}
const IMPL = [
  ['naive', '朴素写法'],
  ['sdpa', 'SDPA'],
  ['triton', 'Triton kernel'],
] as const
const BENCH_KEYS = ['ms', 'mem_MB', 'tflops'] as const
const LOSS_LAB: Record<string, string> = {
  sdpa: 'SDPA(第 6 章原样)',
  naive: '朴素写法',
  triton: 'Triton kernel',
}

function stepOnce(read: number, prev: number | null) {
  if (read >= OX.length) return { read, prev }
  const nextPrev = read ? Math.max(...OX.slice(0, read)) : null
  return { read: Math.min(OX.length, read + OB), prev: nextPrev }
}

function cellFill(i: number, j: number, qb: number, kj: number) {
  let fill = '#fff'
  if (j > i) fill = '#ECEAE2'
  else if (j === i) fill = '#E5EBF9'
  if (i === qb && j <= kj) fill = j === kj ? '#D97757' : '#F2D9CE'
  return fill
}

function benchText(mode: number, impl: BenchImpl) {
  const v = impl[BENCH_KEYS[mode]]
  if (mode === 1) return fmtMB(v)
  if (mode === 0) return v < 10 ? v.toFixed(2) : v.toFixed(1)
  return v.toFixed(1)
}

function Step1() {
  const [tIdx, setTIdx] = useState(2)
  const row = D.bench[tIdx]
  const naive = row.naive
  const mx = Math.max(row.qkvo_MB, row.S_MB, naive ? naive.mem_MB : 0, row.sdpa.mem_MB, 24 * 1024)
  const bars: { name: string; v: number | null; color: string }[] = [
    { name: 'Q + K + V + O', v: row.qkvo_MB, color: '#3a63c0' },
    { name: '一张 S(bf16)', v: row.S_MB, color: 'var(--accent)' },
    { name: '朴素写法实测', v: naive ? naive.mem_MB : null, color: '#9a3a22' },
    { name: 'SDPA 实测', v: row.sdpa.mem_MB, color: '#3f7d63' },
  ]
  return (
    <div className={styles.scope}>
      <h2>① T×T 的分数矩阵有多大</h2>
      <p className="lead">
        朴素写法 <code>S = QKᵀ/√d → softmax → P·V</code>:每个头都要一张 T×T 的 S,再来一张同样大的 P。{' '}
        Q、K、V、输出只随 T 线性增长,S 随 T² 增长。拖 T 看两者在显存里各占多少(batch 4、12 个头、bf16):
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>序列长度 T</label>
          <input
            type="range"
            min={0}
            max={D.bench.length - 1}
            step={1}
            value={tIdx}
            onChange={(e) => setTIdx(Number(e.target.value))}
          />
          <span className="rk-val">{en(row.T)}</span>
        </div>
        <div>
          {bars.map((bar) => {
            const width = bar.v == null ? 100 : Math.max(0.4, (bar.v / mx) * 100)
            const background = bar.v == null
              ? 'repeating-linear-gradient(45deg,#F3D9CE,#F3D9CE 6px,#fff 6px,#fff 12px)'
              : bar.color
            return (
              <div className="mbar" key={bar.name}>
                <span className="mn">{bar.name}</span>
                <span className="mt"><span className="mf" style={{ width: `${width}%`, background }} /></span>
                <span className="mv">{bar.v == null ? '显存不够' : fmtMB(bar.v)}</span>
              </div>
            )
          })}
          <div className="mini-h" style={{ marginTop: 4 }}>条长以 24 GB(这块卡的显存)为满格</div>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{(row.S_MB / row.qkvo_MB).toFixed(1)}×</div><div className="drl">一张 S 是 Q+K+V+O 的几倍</div></div>
          <div className="dr"><div className="drv" style={{ color: '#9a3a22' }}>{naive ? fmtMB(naive.mem_MB) : 'OOM'}</div><div className="drl">朴素写法实测多占的显存</div></div>
          <div className="dr"><div className="drv" style={{ color: '#3f7d63' }}>{fmtMB(row.sdpa.mem_MB)}</div><div className="drl">SDPA 实测多占的显存</div></div>
        </div>
      </div>
      <div className="note">
        T = {en(row.T)}:一张 S 是 <b>{fmtMB(row.S_MB)}</b>,Q+K+V+O 合计 {fmtMB(row.qkvo_MB)}。{naive
          ? <>朴素写法多占 {fmtMB(naive.mem_MB)}(S、掩码后的副本、fp32 的 softmax 结果都要落地),SDPA 只多出输出本身的 {fmtMB(row.sdpa.mem_MB)}。</>
          : <>朴素写法在这块卡上显存不够,SDPA 只多出输出本身的 {fmtMB(row.sdpa.mem_MB)}。</>}
      </div>
      <div className="codepath">↳ 代码:<b>17_flash_attn.py</b> 的 <code>naive_attention</code>(第 2 章的写法)</div>
      <Dig title="显存够的时候,朴素写法慢在哪?">
        慢在读写显存。GPU 的矩阵乘单元很快,片上 SRAM 也快,但显存(HBM)带宽有限。朴素写法把 S 写回显存、softmax 再整张读出来、写出 P、P·V 再读一遍,{' '}
        T² 规模的数据来回搬了好几趟,算术单元大部分时间在等数据。FlashAttention 论文 §2.2 把注意力归为受显存带宽限制的操作,{' '}
        §3.2 的定理 2 给出分块版的显存访问量是 Θ(T²d²/M)(M 是 SRAM 大小),朴素版是 Θ(Td + T²)。
      </Dig>
      <Dig title="第 5 章的 KV cache 也和 T 有关,是同一回事吗?">
        不是。KV cache 存的是每个 token 的 K 和 V,随 T <b>线性</b>增长,生成时一直占着;第 12 章 STEP 5 算过它的账。{' '}
        本页的 S 是一次前向里的<b>临时</b>中间结果,随 T <b>平方</b>增长,算完就可以扔。FlashAttention 省的是后者,KV cache 一个字节也不省。
      </Dig>
      <div className="next-hint">↳ 下一步:不存 S,就得分块算。可 softmax 要先知道整行的最大值和总和,分块时一行被切成好几段,怎么办?</div>
    </div>
  )
}

function Step2() {
  const [os, setOs] = useState({ read: 0, prev: null as number | null })
  const [osBtn, setOsBtn] = useState(0)
  const readVals = OX.slice(0, os.read)
  const m = readVals.length ? Math.max(...readVals) : -Infinity
  const l = readVals.reduce((a, v) => a + Math.exp(v - m), 0)
  const gm = Math.max(...OX)
  const gl = OX.reduce((a, v) => a + Math.exp(v - gm), 0)
  const alpha = os.prev === null || !isFinite(os.prev) ? null : Math.exp(os.prev - m)
  function onOs(i: number) {
    setOsBtn(i)
    setOs((cur) => {
      if (i === 0) return stepOnce(cur.read, cur.prev)
      if (i === 1) {
        let next = cur
        while (next.read < OX.length) next = stepOnce(next.read, next.prev)
        return next
      }
      return { read: 0, prev: null }
    })
  }
  return (
    <div className={styles.scope}>
      <h2>② online softmax:分段读,结果不变</h2>
      <p className="lead">
        一行 8 个分数,每次只读 2 个(一块)。只记两个数:到目前为止的最大值 <b>m</b>,以及按 m 算的指数和 <b>l</b>。{' '}
        新一块带来更大的最大值时,旧的 l 乘上 <code>exp(m_旧 − m_新)</code> 缩回去。点「读下一块」:
      </p>
      <div className="btn-row">
        <button type="button" className={btnCls(osBtn === 0)} onClick={() => onOs(0)}>读下一块</button>
        <button type="button" className={btnCls(osBtn === 1)} onClick={() => onOs(1)}>一次读完</button>
        <button type="button" className={btnCls(osBtn === 2)} onClick={() => onOs(2)}>重来</button>
      </div>
      <div className="lab">
        <div className="osm">
          {OX.map((v, i) => {
            const st = i < os.read - OB ? 'read' : i < os.read ? 'now' : ''
            const isMax = i < os.read && v === m
            const p = os.read === OX.length ? (Math.exp(v - m) / l).toFixed(3) : '?'
            return (
              <div className={['c', st, isMax ? 'max' : ''].filter(Boolean).join(' ')} key={i}>
                <div className="v">{v}</div>
                <div className="p">{p}</div>
              </div>
            )
          })}
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{os.read} / {OX.length}</div><div className="drl">已读几个数</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{os.read ? m.toFixed(2) : MINUS_INF}</div><div className="drl">m:目前的最大值</div></div>
          <div className="dr"><div className="drv" style={{ color: '#3a63c0' }}>{os.read ? l.toFixed(4) : '0'}</div><div className="drl">l:Σ exp(x − m)</div></div>
          <div className="dr"><div className="drv">{alpha === null ? DASH : alpha.toFixed(4)}</div><div className="drl">这一块的缩放系数 exp(m_旧 − m_新)</div></div>
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          {!os.read ? (
            <>还没读。m 从 −∞ 开始,l 从 0 开始。每格下方的小字在读完整行后显示 softmax 概率。</>
          ) : os.read < OX.length ? (
            alpha !== null && alpha < 1 ? (
              <>这一块里出现了更大的数,m 从 {os.prev!.toFixed(2)} 升到 {m.toFixed(2)},之前攒的 l 乘了 {alpha.toFixed(4)} 再加上这一块。</>
            ) : (
              <>这一块没有更大的数,m 不变,缩放系数是 1,l 直接加上这一块的 exp(x − m)。</>
            )
          ) : (
            <>读完了:m = {m.toFixed(2)},l = {l.toFixed(4)}。一次算完整行得到的是 m = {gm.toFixed(2)},l = {gl.toFixed(4)},相同。每格下方的概率 = exp(x − m) / l。</>
          )}
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>17_flash_attn.py</b> 的 <code>online_softmax_trace</code>;同一组 8 个数脚本里算出的最大误差 <b>{D.online_softmax.max_err.toExponential(1)}</b></div>
      <Dig title="输出 P·V 也是分段累加的,也要跟着缩放吗?">
        要。累加器 <code>acc</code> 存的是 Σ exp(x − m)·v,用的是当时的 m;最大值变大后,acc 和 l 乘同一个系数 <code>alpha = exp(m_旧 − m_新)</code>。{' '}
        读完所有块,<code>acc / l</code> 就是 softmax(x)·V。<code>blocked_attention</code> 里是这三行:{' '}
        <code>l = l * alpha + p.sum(-1)</code>、<code>acc = acc * alpha + p @ v</code>、最后 <code>acc / l</code>。{' '}
        FlashAttention-2(arXiv 2307.08691)§3.1 的改动之一就是把 ÷l 从每块挪到最后只做一次。
      </Dig>
      <Dig title="为什么要减去最大值,不直接求 Σ exp(x)?">
        防溢出。fp16 最大只到 65504,exp(12) 就超出;fp32 和 bf16 在 exp(89) 附近上溢。softmax 分子分母同乘 exp(−m) 结果不变,{' '}
        减去最大值后每个指数都 ≤ 1。online softmax 在此基础上只多了一步:最大值中途变了,就把之前的和按新最大值重新缩放。{' '}
        递推出自 Milakov & Gimelshein,<b>Online normalizer calculation for softmax</b>(arXiv 1805.02867)。
      </Dig>
      <div className="next-hint">↳ 下一步:一行能分段,整张注意力就能切成块。看一个 Q 块怎样扫过 K/V 块,哪些数一直留在片上。</div>
    </div>
  )
}

function Step3() {
  const [qb, setQb] = useState(4)
  const [kj, setKj] = useState(-1)
  const [scanOn, setScanOn] = useState(0)
  const size = PAD + NB * CELL + 4
  const done = kj === qb
  return (
    <div className={styles.scope}>
      <h2>③ 分块:哪些数留在片上</h2>
      <p className="lead">
        把 T×T 的注意力切成 BLOCK_M × BLOCK_N 的格子。一个 Q 块(一行格子)由一个 program 负责:把这块 Q 读进片上,{' '}
        依次读 K/V 块,每块在片上算出小块 S、更新 m / l / acc,不写回显存。因果掩码下右上方的格子全被遮住,直接跳过。{' '}
        选一个 Q 块,点「下一格」看它的扫描顺序:
      </p>
      <div className="btn-row small">
        {Array.from({ length: NB }, (_, i) => (
          <button
            type="button"
            className={btnCls(qb === i)}
            key={i}
            onClick={() => { setQb(i); setKj(-1); setScanOn(2) }}
          >Q 块 {i}</button>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className={btnCls(scanOn === 0)} onClick={() => { setScanOn(0); setKj((k) => Math.min(qb, k + 1)) }}>下一格</button>
        <button type="button" className={btnCls(scanOn === 1)} onClick={() => { setScanOn(1); setKj(qb) }}>扫完这一行</button>
        <button type="button" className={btnCls(scanOn === 2)} onClick={() => { setScanOn(2); setKj(-1) }}>重来</button>
      </div>
      <div className="lab">
        <div className="grid-wrap">
          <div>
            <svg viewBox={`0 0 ${size} ${size}`} width={size} style={{ display: 'block', fontFamily: 'ui-monospace, monospace' }}>
              {Array.from({ length: NB }, (_, j) => (
                <text key={`k${j}`} x={PAD + j * CELL + CELL / 2} y={16} fontSize={10} textAnchor="middle" fill="#6B6B68">K{j}</text>
              ))}
              {Array.from({ length: NB }, (_, i) => (
                <g key={`q${i}`}>
                  <text x={12} y={PAD + i * CELL + CELL / 2 + 4} fontSize={10} textAnchor="middle" fill={i === qb ? '#D97757' : '#6B6B68'} fontWeight={i === qb ? 700 : 400}>Q{i}</text>
                  {Array.from({ length: NB }, (_, j) => (
                    <g key={j}>
                      <rect
                        x={PAD + j * CELL + 1}
                        y={PAD + i * CELL + 1}
                        width={CELL - 2}
                        height={CELL - 2}
                        rx={5}
                        fill={cellFill(i, j, qb, kj)}
                        stroke={i === qb ? '#D97757' : '#E5E2D9'}
                        strokeWidth={i === qb ? 1.5 : 1}
                      />
                      {j > i ? (
                        <text x={PAD + j * CELL + CELL / 2} y={PAD + i * CELL + CELL / 2 + 4} fontSize={11} textAnchor="middle" fill="#B9B5AA">×</text>
                      ) : null}
                    </g>
                  ))}
                </g>
              ))}
            </svg>
          </div>
          <div className="mem-col">
            <div className="mini-h">片上 SRAM(每个 program 自己的)</div>
            <div className="memrow">
              <span className="tag" style={{ background: '#D97757' }}>Q{qb}</span>
              <span>64 × 64,整个扫描期间一直在</span>
            </div>
            {kj >= 0 && (
              <div className="memrow">
                <span className="tag" style={{ background: '#3a63c0' }}>K{kj} V{kj}</span>
                <span>这一格读进来,用完就换下一块</span>
              </div>
            )}
            {kj >= 0 && (
              <div className="memrow">
                <span className="tag" style={{ background: '#a3548c' }}>S 块</span>
                <span>64 × 64 分数,只在片上存在</span>
              </div>
            )}
            <div className="memrow">
              <span className="tag" style={{ background: '#3f7d63' }}>m l acc</span>
              <span>每行一个 m、l,acc 64 × 64;{kj < 0 ? `初值 ${MINUS_INF} / 0 / 0` : `已经累加了 ${kj + 1} 块`}</span>
            </div>
            <div className="mini-h" style={{ marginTop: 12 }}>显存 HBM</div>
            <div className="memrow">
              <span className="tag" style={{ background: '#6B6B68' }}>Q K V</span>
              <span>完整的,只读</span>
            </div>
            <div className="memrow">
              <span className="tag" style={{ background: '#6B6B68' }}>O</span>
              <span>{kj === qb ? `Q${qb} 这一行写回了 64 行输出` : '扫完这一行才写 64 行'}</span>
            </div>
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--accent)' }} />正在算的格子</span>
          <span><i style={{ background: '#F2D9CE' }} />这一行已算完</span>
          <span><i style={{ background: '#E5EBF9' }} />对角线格(块内还要逐元素遮)</span>
          <span><i style={{ background: '#ECEAE2' }} />因果掩码全遮,跳过</span>
        </div>
      </div>
      <div className="note">
        {kj < 0 ? (
          <>Q 块 {qb} 要扫 K0 到 K{qb} 共 <b>{qb + 1}</b> 格,右边 {NB - 1 - qb} 格因果掩码全遮,跳过。整张 {NB}×{NB} 里只需要算 {NB * (NB + 1) / 2} 格,约一半。</>
        ) : done ? (
          <>这一行扫完:acc / l 写回显存。全程写回显存的只有 64 行输出,没有一格 S。</>
        ) : (
          <>正在算 Q{qb} × K{kj}:S 块在片上算出,更新 m、l,乘上 V{kj} 累加进 acc。</>
        )}
      </div>
      <div className="codepath">↳ 代码:<b>17_flash_attn.py</b> 的 <code>blocked_attention</code>(外循环 Q 块、内循环只走到对角线)</div>
      <Dig title="块为什么取 64 × 64?">
        受片上存储限制。一个 program 同时要放 Q 块(64×64)、K 块、V 块、S 块(64×64,fp32)和 acc(64×64,fp32),{' '}
        bf16 下合计几十 KB,落在一个 SM 的共享内存和寄存器容量内。块再大,单个 program 放不下或并发的 program 变少;块太小,矩阵乘单元吃不饱。{' '}
        FlashAttention 论文 Algorithm 1 按 SRAM 大小 M 取 B_c = ⌈M/4d⌉。实际 kernel 一般对几组块大小做自动调优,本脚本固定 64 × 64,没有调。
      </Dig>
      <Dig title="不同的 Q 块之间要不要通信?">
        不用。每个 Q 块的输出只依赖它自己的 m、l、acc,和别的 Q 块无关。所以 Triton 里 <code>grid = (Q 块数, batch × heads)</code>,{' '}
        每个 program 各干各的,4 × 12 个头、T = 4096 时一次发出 64 × 48 = 3072 个 program。{' '}
        按 Q 块并行是 FlashAttention-2 的做法;第一版的外循环是 K/V 块,需要把中间结果写回显存再合并。
      </Dig>
      <div className="next-hint">↳ 下一步:同一个算法,用 Triton 写成 GPU kernel。</div>
    </div>
  )
}

function CodeNote({ n }: { n: number }) {
  if (n === 0) return <>一个 program 先把自己负责的 BLOCK_M = 64 行 Q 读进片上。mask 处理 T 不是 64 整数倍时的最后一块。</>
  if (n === 1) return <>每次读一块 K,<code>tl.dot</code> 在片上做 64 × 64 × 64 的矩阵乘,得到小块 S。K 按转置的方式读(dims 在行、cols 在列),省掉一次转置。</>
  if (n === 2) return <><code>hi</code> 让循环只走到对角线;对角线那一块里 query 位置小于 key 位置的元素还要逐个置成 −∞。</>
  if (n === 3) return <>和第 2 步完全一样:新的最大值、这一块的 exp、旧和的缩放系数 alpha。</>
  if (n === 4) return <>acc 先乘 alpha,再加上 P 块 × V 块。P 转回 bf16 再做矩阵乘,和 FlashAttention-2 一样;acc 本身保持 fp32。</>
  return <>扫完所有块,每行除以自己的 l,写回显存。整个 kernel 只有这一处写显存。</>
}

function Step4() {
  const [codeOn, setCodeOn] = useState(0)
  const ts = Object.keys(D.check)
  const names = Object.keys(D.check[ts[0]])
  const later = D.check[ts[1]]
  return (
    <div className={styles.scope}>
      <h2>④ 写成 Triton kernel</h2>
      <p className="lead">
        <Term k="triton" name="Triton" def={'OpenAI 开源的 GPU kernel 语言,写在 Python 里。以块为单位描述计算(tl.load 一块、tl.dot 一次矩阵乘),线程分配、共享内存由编译器处理。'}>Triton</Term>
        {' '}以"块"为单位写 GPU 程序:<code>tl.load</code> 读一块到片上,<code>tl.dot</code> 做块间矩阵乘,线程怎么分由编译器处理。{' '}
        下面是 <code>_flash_fwd</code> 的主体,点按钮高亮对应的几行:
      </p>
      <div className="btn-row small">
        {CODE_BTNS.map((label, i) => (
          <button type="button" className={btnCls(codeOn === i)} key={label} onClick={() => setCodeOn(i)}>{label}</button>
        ))}
      </div>
      <div className="code">
        {CODE.map(([text, k], i) => {
          const hash = text.indexOf('#')
          return (
            <div className={k === codeOn ? 'on' : undefined} key={i}>
              {hash > 0 ? <>{text.slice(0, hash)}<span className="cm">{text.slice(hash)}</span></> : text}
            </div>
          )
        })}
      </div>
      <div className="note"><CodeNote n={codeOn} /></div>
      <div className="sub-h"><span className="badge">对数</span>四种实现和 fp32 SDPA 的最大绝对误差</div>
      <p className="lead" style={{ marginBottom: 10 }}>输入是 bf16 的随机 q/k/v(batch 2、12 个头),参考答案用 fp32 算。T = 1000 不是 64 的整数倍,用来检查边界:</p>
      <div className="lab scroll-x">
        <table className="tb">
          <thead>
            <tr>
              <th>实现</th>
              {ts.map((t) => <th key={t}>T = {t}</th>)}
            </tr>
          </thead>
          <tbody>
            {names.map((n) => (
              <tr className={n === 'triton' ? 'hl' : undefined} key={n}>
                <td>{CHECK_LAB[n] || n}</td>
                {ts.map((t) => <td key={t}>{D.check[t][n].toExponential(2)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note">
        四种实现的误差都在 10<sup>−2</sup> 以内,来自 bf16 的舍入:bf16 尾数只有 7 位,在 [1, 2) 区间相邻两个数相差 2<sup>−7</sup> ≈ 0.0078。{later.triton !== undefined ? <>T = {ts[1]} 时 Triton kernel 与 bf16 SDPA 的误差{later.triton === later.sdpa ? '完全相同' : '同一量级'}。</> : null}
      </div>
      <div className="codepath">↳ 代码:<b>17_flash_attn.py</b> 的 <code>_flash_fwd</code> / <code>flash_attn_triton</code></div>
      <Dig title="exp2 和 1.4427 是做什么的?">
        exp(x) = 2<sup>x · log₂e</sup>,log₂e ≈ 1.4427。GPU 上以 2 为底的指数有专门的快速指令,{' '}
        所以 kernel 把 softmax 缩放系数 1/√d 和 log₂e 乘在一起,整个 kernel 里用 <code>tl.math.exp2</code>。{' '}
        m 和 l 也就都是按 2 为底记的,最后 acc / l 时底数抵消,结果不变。Triton 官方 fused attention 教程也是这样写的。
      </Dig>
      <Dig title="这个 kernel 能拿来训练吗?">
        不能,只有前向。训练还要反向:需要 S 和 P 才能求梯度,而前向没存它们。{' '}
        FlashAttention 论文 §3.1 的办法是前向只额外存每行的 m 和 l(logsumexp),反向时按块重算 S 和 P,多算一遍矩阵乘,换来不存 T² 的中间结果。{' '}
        本页只做前向,换进 124M 也只做推理评测(第 5 步)。
      </Dig>
      <div className="next-hint">↳ 下一步:三种实现在 {gpu} 上比时间和显存,再把 kernel 换进第 6 章的 124M。</div>
    </div>
  )
}

function BenchNote({ mode }: { mode: number }) {
  const last = [...D.bench].reverse().find((r) => r.naive)
  const big = D.bench[D.bench.length - 1]
  if (!last?.naive) return null
  if (mode === 0) {
    return (
      <>
        T = {en(last.T)} 时朴素写法 {last.naive.ms.toFixed(1)} ms,Triton {last.triton ? last.triton.ms.toFixed(1) : DASH} ms,SDPA {last.sdpa.ms.toFixed(1)} ms。朴素写法的时间随 T² 涨得更快:它每一步都要把 T² 规模的数据写回显存再读出。
      </>
    )
  }
  if (mode === 1) {
    return (
      <>
        多占的显存:Triton 与 SDPA 只多出输出张量本身,随 T 线性增长;朴素写法随 T² 增长,T = {en(big.T)} 时{big.naive ? `多占 ${fmtMB(big.naive.mem_MB)}` : '显存不够'}。
      </>
    )
  }
  return <>有效算力按因果注意力 2·B·H·T²·d 次浮点运算折算。T 小时 kernel 启动开销占比大,T 越大,Triton / SDPA 越接近矩阵乘单元的吞吐;朴素写法受显存带宽限制,停在低位。</>
}

function benchRatio(row: FlashBench, mode: number) {
  const key = BENCH_KEYS[mode]
  if (!row.naive || !row.triton) return null
  return mode === 2 ? row.triton[key] / row.naive[key] : row.naive[key] / row.triton[key]
}

function Step5() {
  const [mode, setMode] = useState(0)
  const loss = D.model_loss.loss
  const lossKeys = Object.keys(loss)
  const lo = Math.min(...lossKeys.map((k) => loss[k as keyof typeof loss]))
  const hi = Math.max(...lossKeys.map((k) => loss[k as keyof typeof loss]))
  const r4 = D.bench.find((r) => r.T === 4096) ?? D.bench[D.bench.length - 2]
  const oom = D.bench.find((r) => r.naive === null)
  const naiveBit = r4.naive ? `${r4.naive.ms.toFixed(1)} ms / ${fmtMB(r4.naive.mem_MB)}` : '显存不够'
  return (
    <div className={styles.scope}>
      <h2>⑤ 实测:时间、显存,换进 124M</h2>
      <p className="lead">
        batch 4、12 个头、head_dim 64、bf16,因果注意力前向,每组取 10 次的中位数。切换看时间或显存,{' '}
        「显存不够」表示朴素写法在这块卡上直接报 OOM(测试时卡上另有一个常驻进程占着约 10 GB,可用约 13 GB):
      </p>
      <div className="btn-row small">
        {['时间(毫秒)', '多占的显存(MB)', '有效算力(TFLOPS)'].map((label, i) => (
          <button type="button" className={btnCls(mode === i)} key={label} onClick={() => setMode(i)}>{label}</button>
        ))}
      </div>
      <div className="lab scroll-x">
        <table className="tb">
          <thead>
            <tr>
              <th>T</th>
              {IMPL.map(([k, name]) => <th key={k}>{name}</th>)}
              <th>朴素 ÷ Triton</th>
            </tr>
          </thead>
          <tbody>
            {D.bench.map((row) => {
              const ratio = benchRatio(row, mode)
              return (
                <tr key={row.T}>
                  <td>{en(row.T)}</td>
                  {IMPL.map(([k]) => {
                    const impl = row[k]
                    return <td key={k}>{impl ? benchText(mode, impl) : <span style={{ color: '#9a3a22' }}>显存不够</span>}</td>
                  })}
                  <td>{ratio === null ? DASH : `${ratio.toFixed(1)}×`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="note"><BenchNote mode={mode} /></div>
      <div className="sub-h"><span className="badge">124M</span>把第 6 章模型的注意力换成三种实现</div>
      <p className="lead" style={{ marginBottom: 10 }}>同一份权重(10B token,step 19072)、同样 65,536 个 FineWeb-Edu val token,只换注意力函数:</p>
      <div className="lab">
        {lossKeys.map((k) => {
          const value = loss[k as keyof typeof loss]
          const width = 60 + ((value - lo) / Math.max(1e-9, hi - lo)) * 30
          return (
            <div className="mbar" key={k}>
              <span className="mn">{LOSS_LAB[k] || k}</span>
              <span className="mt">
                <span className="mf" style={{ width: `${width}%`, background: k === 'triton' ? 'var(--accent)' : '#B9B5AA' }} />
              </span>
              <span className="mv">{value.toFixed(5)}</span>
            </div>
          )
        })}
        <div className="mini-h">条长只放大了差值(以最小值为 60% 起画),三者相差 {(hi - lo).toFixed(5)}</div>
      </div>
      <div className="note">换成自己写的 Triton kernel,val loss <b>{loss.triton.toFixed(5)}</b>,原来的 SDPA {loss.sdpa.toFixed(5)},差 {Math.abs(loss.triton - loss.sdpa).toFixed(5)}。</div>
      <Dig title="自己写的 kernel 和 SDPA 差不多快,SDPA 还多做了什么?">
        PyTorch 的 SDPA 在 CUDA 上会按输入选后端(FlashAttention-2、memory-efficient、朴素数学实现),本页的 bf16、head_dim 64 走的是 FlashAttention-2 后端。{' '}
        它另有反向 kernel、dropout、各种 head_dim 和掩码,对角线块单独处理(本脚本对每一块都逐元素判断掩码),块大小按硬件调过。{' '}
        在这组规模上两者接近,说明性能主要来自"不落地 T×T"这个算法本身;更长的 T 或别的显卡上差距可能不同。
      </Dig>
      <Dig title="三种实现的 loss 为什么差在小数点后第四位?">
        bf16 下每种实现的累加顺序不同:朴素写法先整行 softmax 再乘 V,分块写法按块累加、中途缩放,舍入误差落在不同的位置。{' '}
        第 4 步用随机输入测过,单个输出元素的误差在 10<sup>−2</sup> 量级(bf16 的尾数只有 7 位),经过 12 层、再平均到 65,536 个 token 上,loss 差在 10<sup>−4</sup> 量级。{' '}
        三者算的是同一个数学式,没有近似。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>online softmax:8 个数分 4 块读,与一次算完的最大误差 <b>{D.online_softmax.max_err.toExponential(1)}</b></div></li>
        <li><span className="ck">✓</span><div>PyTorch 分块与 Triton kernel 和 fp32 SDPA 的误差与 bf16 SDPA 同一量级(T = 1000 覆盖了不整除 64 的边界)</div></li>
        <li><span className="ck">✓</span><div>T = {en(r4.T)}:朴素写法 {naiveBit},Triton <b>{r4.triton.ms.toFixed(1)} ms / {fmtMB(r4.triton.mem_MB)}</b></div></li>
        {oom ? <li><span className="ck">✓</span><div>朴素写法在 T = {en(oom.T)} 时显存不够,Triton 与 SDPA 照常运行</div></li> : null}
        <li><span className="ck">✓</span><div>124M 换成 Triton kernel 后 val loss {loss.triton.toFixed(5)},SDPA {loss.sdpa.toFixed(5)}</div></li>
      </ul>
      <div className="codepath">↳ 跑法:<code>python 17_flash_attn.py --json runs/ch19_flash.json</code>(Triton 需要 NVIDIA GPU;MPS / CPU 只跑朴素与分块的对数)</div>
    </div>
  )
}

export function FlashAttention() {
  const chapter = findChapter('flash-attention')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="flash-attention"
      title="手写 FlashAttention:拆开 SDPA 这个黑盒"
      subtitle={
        <>
          从第 6 章起,注意力一直是一行 <code>F.scaled_dot_product_attention</code>。它和第 2 章手写的注意力算的是同一个数,{' '}
          差别在 T×T 的分数矩阵放在哪。{' '}
          <Term k="flash-attention" name="FlashAttention" def="把 Q、K、V 切成小块,在片上 SRAM 里算完一块就累加进输出,T×T 的分数矩阵不写回显存。靠 online softmax 保证结果精确,不是近似。">FlashAttention</Term>
          {' '}把 Q、K、V 切块,每块在片上算完就累加进输出,用{' '}
          <Term k="online-softmax" name="online softmax" def="分段读一行数时,只记到目前为止的最大值 m 和指数和 l;遇到更大的最大值,把之前累加的结果乘 exp(m_旧 − m_新) 缩回去。读完一整行,结果与一次算完的 softmax 相同。">online softmax</Term>
          {' '}保证结果精确。配套代码 <code>phase5-fullstack/17_flash_attn.py</code> 写了三层:朴素写法、纯 PyTorch 分块、Triton kernel,{' '}
          在 {gpu} 上比时间和显存,再换进第 6 章的 124M 核对 loss。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#b8512f" bg="#F7E6DE">batch <b>4</b> <i>测速用</i></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">heads <b>12</b> <i>同 124M</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">head_dim <b>64</b> <i>同 124M</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">T <b>512 … 16,384</b> <i>序列长度</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">块 <b>64 × 64</b> <i>BLOCK_M × BLOCK_N</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECEAE2">dtype <b>bf16</b> <i>kernel 内部累加用 fp32</i></HpChip>
          <span className="hp-note">heads 12 和 head_dim 64 与第 6 章相同;124M 的上下文是 1024,更长的 T 只用来测速</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 手写 FlashAttention · 通关</div>
          <div className="cs">你把 SDPA 拆成了三层:online softmax 让一行可以分段算出精确结果,分块让 T×T 的 S 从不落地,Triton kernel 把同一个算法跑在 GPU 上,换进 124M 后 loss 与原来一致。下一关回到训练:用十几个小模型预测 124M 的 loss。</div>
        </>
      }
    />
  )
}
