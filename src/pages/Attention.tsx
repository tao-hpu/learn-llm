// 旧页进入第 2 步会清掉选中格子、流水线回到 idx、轴芯片取消选中（batch 种子保留）；进入第 3–5 步会回到该步第一个按钮；进入第 6 步会清掉聚合行、参数真身回到训练后、loss 曲线回到起点。离开再回来，这些选择都保留。
import { useEffect, useState } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  AGG_TOK, AGG_V, AGG_WEI, A_NORM, A_ONES, A_TRIL, CHARS, L_SMAX, L_WALL, MB, MC, PX, SHAKE, TLEN,
  TRUTHS, WK, WQ, WV, aggRow, awf, batchStarts, f2, heatGrid, lcX, lcY, lossAt, matvec, showChar,
  truthColor, truthT, vhash, wf,
} from './attentionData'
import styles from './Attention.module.css'

const QV = matvec(PX, WQ)
const KV = matvec(PX, WK)
const VV = matvec(PX, WV)

function Grid({ data, cols, hot, onRow, mark }: {
  data: number[][]
  cols: number
  hot?: boolean
  onRow?: (ri: number) => void
  mark?: (ri: number) => string
}) {
  return (
    <div className="mgrid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {data.flatMap((row, ri) => row.map((v, ci) => {
        const extra = mark ? mark(ri) : ''
        const cls = ['cell', v === 0 ? 'zero' : '', hot && v !== 0 ? 'hot' : '', onRow ? 'clickable' : '', extra].filter(Boolean).join(' ')
        return (
          <div key={`${ri}-${ci}`} className={cls} onClick={onRow ? () => onRow(ri) : undefined}>{f2(v)}</div>
        )
      }))}
    </div>
  )
}

function VRow({ vals, filled, cls }: { vals: number[]; filled: boolean; cls?: string }) {
  return (
    <div className="vrow">
      {vals.map((v, i) => (
        <div key={i} className={filled ? (cls ? `vc ${cls}` : 'vc') : 'vc empty'}>{filled ? v : '?'}</div>
      ))}
    </div>
  )
}

function Step1() {
  const [sel, setSel] = useState(CHARS.length - 1)
  return (
    <div className={styles.scope}>
      <h2>Step 1 · 核心想法:让每个位置"往回看"它的过去</h2>
      <p className="lead">
        bigram 的天花板,在于它做预测时<b>只能看前 1 个字符</b>。<Term k="self-attention" name="自注意力 · self-attention" def="序列里每个位置,按相关性从其它位置聚合信息,得到融合上下文的新表示。q、k、v 都来自同一序列,故称 self。">自注意力</Term>的想法很简单:{' '}
        让第 <code>t</code> 个位置,能参考它<b>前面所有</b>位置(<code>0..t</code>)。{' '}
        <b>点下面任意一个位置</b>,看它能看到谁。
      </p>
      <p className="note solid">
        📜 <b>出处</b>:自注意力来自 2017 年的{' '}
        <Term k="attention-paper" name="Attention Is All You Need" def="2017 年 Google 提出 Transformer 的奠基论文:用自注意力取代 RNN/CNN,引入多头注意力与位置编码。GPT/BERT 都源于它。">《Attention Is All You Need》</Term>
        {' '}—— Transformer 的奠基之作。本章搭的是它的核心零件(单头自注意力),第 3 关会完整复现整套架构。
      </p>
      <div className="pos-idx">{CHARS.map((_, i) => <span key={i}>t={i}</span>)}</div>
      <div className="seq8">
        {CHARS.map((ch, i) => {
          const cls = i < sel ? 'scell see' : i === sel ? 'scell see cur' : 'scell future'
          return <div key={i} className={cls} onClick={() => setSel(i)}>{ch}</div>
        })}
      </div>
      <p className="seq-caption">
        位置 <b>t={sel}</b>(字符 "{CHARS[sel]}")能看到 <b>{sel + 1}</b> 个位置(0..{sel},橙色),看不到后面 <b>{CHARS.length - 1 - sel}</b> 个未来位置(灰色)。
      </p>
      <div className="pill-row">
        <div className="pill">
          <h4 style={{ color: 'var(--accent)' }}>只看过去 = <Term k="causal-mask" name="因果掩码 · causal mask" def="预测下一个字符时不能偷看未来:每个位置只允许看 0..t。靠下三角把未来位置设为 -∞ 实现。">因果(causal)</Term></h4>
          预测"下一个字符"时,<b>未来的答案不能偷看</b>。所以每个位置只允许看 <code>0..t</code>,看不到 <code>t+1</code> 之后。
        </div>
        <div className="pill">
          <h4 style={{ color: 'var(--accent)' }}>最朴素的"参考过去" = 平均</h4>
          先不讲复杂的:把能看到的那些位置的向量<b>取平均</b>,就是一种最简单的"往回看"。
        </div>
      </div>
      <div className="note solid">
        💡 这"最多往回看几个 token"就是 <code>block_size</code> = <span className="d d-block">8<i>block</i></span> ——{' '}
        也就是大家天天挂嘴边的<Term k="block-size" name="上下文窗口 · context window" def="模型一次能看到的最大 token 数 = block_size。超出窗口的更早历史会被截断,模型看不见。这就是新闻里说的「上下文长度」。">上下文窗口</Term>(context window)。本章设成 8,只为把直觉一眼看清。
      </div>
      <Dig title="上下文窗口能多大?它和 batch_size 是一回事吗?">
        GPT-2 是 1024,如今 <b>100 万 token 已是标配</b> —— 原理一样:再长也只是个<b>固定上限</b>,
        超出窗口的更早历史模型看不见(代码 <code>generate</code> 里 <code>idx[:, -block_size:]</code> 就是在裁这个)。<br />
        ⚠️ 它和 <code>batch_size</code> 不是一回事:<code>block_size</code>=<span className="d d-block">8<i>block</i></span> 是"<b>往回看几个 token</b>",
        <code>batch_size</code>=<span className="d d-batch">32<i>batch</i></span> 是"<b>同时并行几条句子</b>"。
      </Dig>
      <p className="next-hint">下一步:先把喂进去的数据"<b>形状</b>"看清 —— <b>B、T、C</b> 和那几个撞脸的 <b>32</b> 分别是谁。</p>
    </div>
  )
}

function pipeNote(n: number) {
  if (n === 0) return <><b>idx</b>:刚取出的 batch,只有 <span className="axB">B</span>×<span className="axT">T</span> 个<b>整数 id</b> —— 还<b>没有 C</b>,每个位置就是一个字符编号。</>
  if (n === 1) return <><b>嵌入后</b>:每个 id 查表换成 <span className="axC">C = n_embd = 32</span> 维向量,再加位置向量。<span className="axC">C</span> 从无到有 = <b>32</b>。</>
  if (n === 2) return <><b>投影后</b>:x 过三个 <code>nn.Linear</code> 变出 q、k、v 三个张量,<b>各自</b>形状都是 <span className="axB">B</span>×<span className="axT">T</span>×<span className="axC">32</span>(这里 <span className="axC">C = head_size</span>)。</>
  if (n === 3) return <><b>聚合后</b>:<code>wei @ v</code> 得到每个位置"看过历史"的新向量,形状不变,<span className="axC">C = head_size = 32</span>。</>
  return <><b>映射回词表</b>:<code>lm_head</code> 把 <span className="axC">C</span> 从 32 变成 <span className="axC">vocab_size = 65</span> —— 每个位置对"下一个字符是谁"的 65 个打分。</>
}

function axNote(n: number) {
  if (n < 0) return <>点上面任意一个超参,看它定的是 <span className="axB">B</span> / <span className="axT">T</span> / <span className="axC">C</span> 哪根轴。</>
  if (n === 0) return <><span className="axB">batch_size = 32 → B</span>:一个 batch <b>并行几条句子</b>。改成 64 不影响 T / C。</>
  if (n === 1) return <><span className="axT">block_size = 8 → T</span>:一条句子<b>几个位置</b>(往回看几个 token)。注意它是 <b>8,不是 32</b>。</>
  if (n === 2) return <><span className="axC">n_embd = 32 → C</span>:嵌入后每个位置向量<b>多长</b>。和 batch_size 同为 32,纯属撞脸。</>
  return <><span className="axC">head_size = 32 → C</span>:注意力头输出向量<b>多长</b>。单头时设得和 n_embd 一样,多头会更小。</>
}

const PIPE = [
  { name: 'idx', c: '—' },
  { name: '+emb', c: '32' },
  { name: 'q/k/v', c: '32' },
  { name: 'out', c: '32' },
  { name: 'logits', c: '65' },
]
const AXS = [
  { color: '#b8512f', name: 'batch_size = 32', sub: '→ B 句子数' },
  { color: '#3f7d63', name: 'block_size = 8', sub: '→ T 位置数' },
  { color: '#3a63c0', name: 'n_embd = 32', sub: '→ C 嵌入维度' },
  { color: '#a3548c', name: 'head_size = 32', sub: '→ C 头维度' },
]

function Step2() {
  const live = useStepLive()
  const [seed, setSeed] = useState(0)
  const [picked, setPicked] = useState<[number, number] | null>(null)
  const [pipe, setPipe] = useState(0)
  const [pipeRun, setPipeRun] = useState(false)
  const [pipeTok, setPipeTok] = useState(0)
  const [ax, setAx] = useState(-1)
  const starts = batchStarts(seed)
  const pickedCh = picked ? showChar(SHAKE[starts[picked[0]] + picked[1]]) : ''

  useEffect(() => {
    if (!live) setPipeRun(false)
  }, [live])

  useEffect(() => {
    if (!live || !pipeRun) return
    if (pipe >= 4) {
      setPipeRun(false)
      return
    }
    const id = window.setInterval(() => setPipe((i) => i + 1), 950)
    return () => window.clearInterval(id)
  }, [live, pipeRun, pipe, pipeTok])

  return (
    <div className={styles.scope}>
      <h2>Step 2 · 数据的形状:B、T、C(以及那几个撞脸的 32)</h2>
      <p className="lead">
        动手搭注意力前,先看清喂进去的数据长什么"形状"。代码里张量都按 <code>(B, T, C)</code> 三个大写字母标注 ——{' '}
        <b>拨一拨下面三组交互</b>,把它们和那几个 <code>32</code> 一次对清楚。
      </p>
      <div className="sub-h"><span className="badge">A</span>一个 batch 长什么样:<span className="axB">B</span> 条句子 × <span className="axT">T</span> 个位置</div>
      <p className="shape-sub">
        每次训练,<code>get_batch</code> 从全书<b>随机取 <span className="axB">B</span> 个起点</b>,每个起点<b>连抓 <span className="axT">T</span> 个字符</b>。
        点「🎲 再取一个 batch」换一批;<b>点任意一个格子</b>,看它其实是一根向量。
      </p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => { setSeed((s) => s + 1); setPicked(null) }}>🎲 再取一个 batch</button>
      </div>
      <div className="bgrid-wrap">
        <div className="bgrid-cols">{Array.from({ length: TLEN }, (_, j) => <span key={j}>t={j}</span>)}</div>
        <div>
          {starts.map((s, r) => (
            <div key={r} className="brow">
              <span className="rlab">{r}</span>
              {Array.from({ length: TLEN }, (_, j) => {
                const ch = showChar(SHAKE[s + j])
                const on = picked !== null && picked[0] === r && picked[1] === j
                return (
                  <div key={j} className={on ? 'bcell picked' : 'bcell'} onClick={() => setPicked([r, j])}>{ch}</div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="bmore">⋮ 这里只画 5 条,真实一个 batch 有 <span className="axB">batch_size = 32</span> 条,32 条<b>并行</b>一起算</div>
      </div>
      {picked && (
        <div className="vec-pop">
          <div className="vp-head">字符 <b>"{pickedCh}"</b> 进模型后,不是<b>一个</b>数,而是一根 <span className="axC">C 维</span>向量(查嵌入表得到):</div>
          <div className="vp-vec">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="vc">{vhash(pickedCh, i)}</div>)}
            <span className="vp-more">… 共 n_embd=32 个数</span>
          </div>
          <div className="shape-sub" style={{ margin: '8px 0 0' }}>
            于是整个 batch 从 <span className="axB">B</span>×<span className="axT">T</span> 的<b>整数表</b>,长成 <span className="axB">B</span>×<span className="axT">T</span>×<span className="axC">C</span> 的<b>向量立方体</b> —— 这就是 <code>(B,T,C)</code>。(格子里数字是随手示意,非真实权重)
          </div>
        </div>
      )}
      <div className="note">
        <span className="axB">B = Batch</span> 一批几条句子(并行)= <code>batch_size</code> ·{' '}
        <span className="axT">T = Time</span> 一条几个位置 = <code>block_size</code> ·{' '}
        <span className="axC">C = Channels</span> 每个位置的向量多长(下面 B 段细说)。
      </div>
      <div className="sub-h"><span className="badge">B</span><span className="axC">C</span> 会变:形状沿着网络一层层流动</div>
      <p className="shape-sub">点每一站,看 <code>(B,T,C)</code> 里的 <span className="axC">C</span> 怎么变 —— <b><span className="axB">B</span>、<span className="axT">T</span> 一路不变,只有 <span className="axC">C</span> 在变</b>。或点「▶ 一路跑到 logits」自动走一遍。</p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => { setPipe(0); setPipeRun(true); setPipeTok((n) => n + 1) }}>▶ 一路跑到 logits</button>
      </div>
      <div className="pipe">
        {PIPE.map((p, i) => (
          <div key={p.name} className={i === pipe ? 'pstage on' : 'pstage'} onClick={() => setPipe(i)}>
            <div className="pst-name">{p.name}</div>
            <div className="pst-shape">(<span className="axB">B</span>,<span className="axT">T</span>,{p.c === '—' ? <b>—</b> : <b className="axC">{p.c}</b>})</div>
          </div>
        ))}
      </div>
      <div className="note">{pipeNote(pipe)}</div>
      <div className="sub-h"><span className="badge">C</span>那几个 <code>32</code>(和一个 <code>8</code>)分别定哪根轴</div>
      <div className="axchips">
        {AXS.map((a, i) => (
          <div key={a.name} className={ax === i ? 'axchip on' : 'axchip'} style={{ color: a.color }} onClick={() => setAx(i)}>
            {a.name}<small>{a.sub}</small>
          </div>
        ))}
      </div>
      <div className="note">{axNote(ax)}</div>
      <div className="sub-h" style={{ color: 'var(--accent)' }}>⚠️ 别把 Q / K / V 对到 <span className="axB">B</span> / <span className="axT">T</span> / <span className="axC">C</span> 三根轴上</div>
      <p className="shape-sub" style={{ marginBottom: 8 }}>
        <code>Q</code>、<code>K</code>、<code>V</code> 是<b>三个张量</b>(三种角色),<b>不是</b>三根轴各分一个。同一个 <code>x</code> 复制 3 份、各用自己的 <code>W</code> 重调,得到的 q / k / v <b>各自都是完整的 <code>(B,T,32)</code></b>:
      </p>
      <div className="qkv">
        <div className="qkv-x">x<br /><b>(B,T,32)</b></div>
        <div className="qkv-arr">→</div>
        <div className="qkv-mid">复制 3 份,<br />各用自己的 W 重调</div>
        <div className="qkv-arr">→</div>
        <div className="qkv-out">
          <span className="qkv-q">Q (B,T,32)</span>
          <span className="qkv-k">K (B,T,32)</span>
          <span className="qkv-v">V (B,T,32)</span>
        </div>
      </div>
      <div className="note">
        三个都是 <b>32×8×32 的完整立方体</b>,没有谁"只分到一根轴"。正因如此,<code>q @ kᵀ</code> 才能拿两个完整张量两两位置算相关、得到 <span className="axB">B</span>×<span className="axT">T</span>×<span className="axT">T</span> 的分数表。{' '}
        <b>("三个"角色 和 "32" 维是两个无关的东西:把 head_size 改成 30,还是<b>三</b>张表,只是每个向量 30 个数。Q/K/V 的完整讲解在 <b>Step 4</b>。)</b>
      </div>
      <Dig title="训练时 B、T 永远等于 batch_size、block_size 吗?">
        训练时<b>是</b>(一个 batch 就是 32×8)。但代码写的是 <code>B, T, C = x.shape</code>,<b>动态从形状里读</b>、不写死 ——
        因为<b>采样生成</b>时不一样:<code>generate</code> 一次只喂 1 条,且上下文从 1 个字符慢慢长到 8。那时 <span className="axB">B</span>=1、<span className="axT">T</span> 从 1 涨到 8。
        所以严谨说:<b>B/T 是"这批数据当前实际的条数 / 长度"</b>,训练时<b>恰好</b>等于那两个超参。
      </Dig>
      <Dig title={<><span className="axC">C</span> 是"纯动态"随便变的吗?</>}>
        不是,它和 B/T 的"动态"是两码事:<br />
        · <b>B / T</b> 随<b>喂进来的数据</b>变(训练 32×8,采样可能 1×3);<br />
        · <b>C</b> 随<b>走到网络第几层</b>变,<b>和数据无关</b> —— 给定结构,每一层的 C 是多少都是<b>写死、确定</b>的(嵌入处 32、logits 处 65)。<br />
        一句话:<b>每一层有它自己固定的 C</b>,不是随机乱跳。
      </Dig>
      <Dig title="这一批整数(idx)是怎么从文本文件读进来的?">
        <code>02_attention.py</code> 开头四步,把一本书变成可训练的整数:<br />
        ① <code>open(path, "r", encoding="utf-8")</code> —— <code>"r"</code> = <b>read 只读模式</b>(只读不写;<code>"w"</code> 才是写入并清空原文件)。<br />
        ② <code>text = f.read()</code> —— 把<b>整本书一次性读成一条长字符串</b>(含所有换行、空格、标点),所以 <code>text</code> 是一整条不断行的长字符串。<br />
        ③ <code>sorted(set(text))</code> 去重排序得词表;<code>encode</code> 把每个字符换成整数 id → 整条文本变一长串数字。<br />
        ④ <code>torch.tensor(...)</code> 变张量,<code>get_batch</code> 再从中随机切出上面那个 <span className="axB">B</span>×<span className="axT">T</span> 的整数表。
      </Dig>
      <p className="next-hint">形状这把尺子拿稳了,下一步:怎么用<b>一次矩阵乘法</b>,既"只看过去"又"取平均"?</p>
    </div>
  )
}

function matNote(n: number) {
  if (n === 0) return <>起点:<code>torch.ones(3,3)</code> 全是 1,还没有任何约束。</>
  if (n === 1) return <><b style={{ color: 'var(--c-k)' }}>下三角</b>:<code>torch.tril</code> 把右上角清成 0 → 位置 i 对"未来"(j{'>'}i)权重恒为 0。<b>这就是因果。</b></>
  if (n === 2) return <><b style={{ color: 'var(--c-v)' }}>归一化</b>:每行 ÷ 该行的和 → 每行加起来 = 1。第2行 [½,½];第3行 [⅓,⅓,⅓]。<b>变成了"平均"。</b></>
  return <><code>c = a @ b</code> = 加权求和。<b>👆 点 c 的任意一行</b>,看它怎么由 b 的几行加权求和而来 ↓</>
}

function MatBreak({ i }: { i: number }) {
  const a = A_NORM[i]
  const t1: string[] = []
  const t2: string[] = []
  for (let k = 0; k <= i; k++) {
    t1.push(`${wf(a[k])}·b${k}`)
    t2.push(`${wf(a[k])}·[${MB[k].join(',')}]`)
  }
  return (
    <div className="mat-break">
      <div className="bk-head"><b>c 第 {i} 行</b>(位置 {i} 的新向量)= 它能看到的 {i + 1} 个位置,按权重加权求和:</div>
      <span className="bk-row">c[{i}] = {t1.join(' + ')}</span>
      <span className="bk-row">     = {t2.join(' + ')}</span>
      <span className="bk-row">     = [<b>{MC[i].join(', ')}</b>]</span>
    </div>
  )
}

const MAT_BTNS = ['0 · 全是 1', '1 · 下三角', '2 · 每行归一化', '3 · 算 c = a @ b']

function Step3() {
  const [n, setN] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const data = n === 0 ? A_ONES : n === 1 ? A_TRIL : A_NORM
  const show = n === 3
  return (
    <div className={styles.scope}>
      <h2>Step 3 · 用一个矩阵,实现"对过去做平均"</h2>
      <p className="lead">
        这正是 <code>02_attention.py</code> A 段做的事。一个下三角、再归一化的权重矩阵 <code>a</code>,
        乘上输入 <code>b</code>,就一次性完成"只看过去 + 取平均"。点按钮一步步看 <code>a</code> 怎么来。
      </p>
      <div className="note solid">
        ⚠️ 这一步是 <code>02_attention.py</code> <b>A 段的纯演示</b>:用固定数字讲清"下三角加权平均"这套数学,<b>不训练、也不是模型本体</b>。真正带 Q/K/V、会被训练的注意力从 <b>Step 4</b> 起。
      </div>
      <Dig title="为什么是 3×3?这 9 个格子是什么?">
        <b>9 个格子 = 权重表 <code>a</code>,大小 <code>3×3</code>。</b>它是"<b>位置 × 位置</b>":行 = 哪个位置在看,列 = 它在看哪个位置。
        两边都是 3,是因为这个演示只取了序列的<b>前 3 个位置</b>(如 "To be or" 的 <code>T o ␣</code>)。<br />
        点第 4 个按钮「算 <code>c=a@b</code>」后,右边出现的 <b><code>b</code> 是 <code>3×2</code>(6 格)</b>:3 个位置,每个位置一个 2 个数的向量。
        所以 <b>位置数</b>定 <code>a</code> 的行列(<code>3×3</code>)、定 <code>b</code> 的行(3);<b>每个向量多少个数</b>只定 <code>b</code> 的列(2)。<br />
        真实尺寸:位置数 = <code>block_size</code>=<span className="d d-block">8<i>block</i></span>、向量长度 = <code>head_size</code>=<span className="d d-head">32<i>head</i></span>,
        这张 <code>a</code> 就是 <b>8×8</b> —— 即 <b>Step 5</b> 的热力图。
      </Dig>
      <div className="btn-row">
        {MAT_BTNS.map((label, i) => (
          <button key={label} type="button" className={n === i ? 'btn primary' : 'btn'} onClick={() => { setN(i); setSel(null) }}>{label}</button>
        ))}
      </div>
      <div className="matwrap">
        <div className="mb-a">
          <div className="label-sm">权重 a (3×3)</div>
          <Grid data={data} cols={3} mark={show && sel !== null ? (ri) => (ri === sel ? 'rowsel' : '') : undefined} />
        </div>
        {show && (
          <>
            <div><span className="op">@</span></div>
            <div className="mb-b">
              <div className="label-sm">输入 b (3 位置 × 2 维)</div>
              <Grid data={MB} cols={2} hot mark={sel !== null ? (ri) => (ri <= sel ? 'rowcontrib' : '') : undefined} />
            </div>
            <div><span className="op">=</span></div>
            <div className="mb-c">
              <div className="label-sm">输出 c</div>
              <Grid data={MC} cols={2} hot onRow={setSel} mark={sel !== null ? (ri) => (ri === sel ? 'rowsel' : '') : undefined} />
            </div>
          </>
        )}
      </div>
      {show && (
        <p className="dim-hint">
          💡 <b>b 的 6 个格子</b> = 3 个位置 × 每位置 2 维。格子里 <b>0–5 只是 <code>torch.arange</code> 随手填的占位数</b>(好让你心算平均),真实代码里这里是各位置的 value 向量。<b>维度取 2 也只是为了好画,真实是 head_size = <span className="d d-head">32<i>head</i></span> 维</b>,逻辑一模一样。
        </p>
      )}
      <div className="note">{matNote(n)}</div>
      {show && sel !== null && <MatBreak i={sel} />}
      <div className="pill-row" style={{ marginTop: 18 }}>
        <div className="pill">
          <h4 style={{ color: 'var(--c-k)' }}><Term k="tril" name="下三角 · lower-triangular" def="对角线及左下保留,右上全为 0 的方阵(torch.tril)。这里用来屏蔽未来位置,管的是「哪些权重必须为 0」。">下三角</Term> ▾ 管「因果」</h4>
          管 <b>权重在哪里 = 0</b>。右上角恒为 0 → <span className="muted">未来位置被钉死,谁也偷看不到。</span>
        </div>
        <div className="pill">
          <h4 style={{ color: 'var(--c-v)' }}><Term k="normalize" name="归一化 · normalize" def="每行除以该行的和,使每行加起来 = 1,变成一组权重。管的是「尺度」,和因果(哪些为 0)互相独立。">归一化</Term> ▾ 管「平均」</h4>
          管 <b>权重总量 = 1</b>。每行和为 1 → <span className="muted">是加权平均,输出和输入同量级,不会越往后越爆。</span>
        </div>
      </div>
      <p className="next-hint">下一步:均匀平均太"蠢"——每个过去位置一视同仁。怎么让"<b>谁相关就多看谁</b>"?</p>
    </div>
  )
}

function projNote(on: boolean) {
  if (!on) return <>点下面按钮:把<b>同一个 x</b> 分别乘以 Wq、Wk、Wv,看它变出三个不同的向量。</>
  return <>同一个 <b>x = [2,0,1,3]</b> 过三个不同矩阵 → 得到三个不同向量 q、k、v。每个输出数字 = x 那 4 个数的一个<b>加权组合</b>(权重藏在 W 里)。这三个矩阵<b>随机初始化、训练中学出来,没人手写</b>。</>
}

function Step4() {
  const [on, setOn] = useState(false)
  return (
    <div className={styles.scope}>
      <h2>Step 4 · 升级:把"死平均"换成"按内容加权"——Q / K / V</h2>
      <p className="lead">
        上一步的权重是<b>写死的</b>(每个过去位置一样多)。真实语言里,有的词更该被关注。{' '}
        我们想让权重<b>由内容算出来</b>。办法:把<b>同一个</b>输入 <code>x</code>,投影成三种角色。{' '}
        像在图书馆找书 ——
      </p>
      <div className="pill-row">
        <div className="pill">
          <h4 style={{ color: 'var(--c-q)' }}>Query (q)</h4>
          <div className="role">我在找什么</div>
          心里的检索词:<br />"我要找讲<b>恐龙</b>的内容"
        </div>
        <div className="pill">
          <h4 style={{ color: 'var(--c-k)' }}>Key (k)</h4>
          <div className="role">我宣传自己是什么</div>
          书脊上的标签:<br />"本书关于:<b>恐龙</b>"
        </div>
        <div className="pill">
          <h4 style={{ color: 'var(--c-v)' }}>Value (v)</h4>
          <div className="role">你看我,我给你什么</div>
          翻开后的正文:<br />真正被取走的信息
        </div>
      </div>
      <div className="note">
        代码里就是三个 <code>nn.Linear</code>:<code>self.query / self.key / self.value</code>,把同一个 <code>x</code>{' '}
        投影成 <span className="tag t-q">q</span>、<span className="tag t-k">k</span>、<span className="tag t-v">v</span>。{' '}
        <b>这三个投影矩阵,就是这一层真正要训练的参数。</b>
      </div>
      <Dig title="为什么 k、v 要分开,不合成一个?">
        因为"<b>我宣传的标签</b>"和"<b>我实际给的货</b>"可以不同 —— 标签(key)为了好被搜到,正文(value)才是真信息。
      </Dig>
      <div className="sub-h"><span className="badge">★</span>那 x 到底怎么变成 q / k / v?</div>
      <p className="lead" style={{ marginBottom: 12 }}>
        <b>先说 x 是什么。</b>每个位置(每个 token)进注意力前,已经是一根向量:{' '}
        <code>x = tok_emb + pos_emb</code>(内容嵌入 + <Term k="positional-embedding" name="位置嵌入 · positional embedding" def="注意力本身看不出顺序,所以给「第几个位置」也学一个向量,加到 token 嵌入上,模型才知道谁先谁后。">位置嵌入</Term>),长度 <code>n_embd=32</code>。{' '}
        8 个位置就是 8 根 x。它是"这个 token、在这个位置"的数字表示,是还没分角色的<b>原料</b>。
        (注意:这里没有"用户提问"—— attention 里的 query 是<b>每个位置自己</b>发出的,只是个比喻。)
      </p>
      <p className="lead" style={{ margin: '0 0 8px' }}><b>这根 x 是从第 1 章"升级"来的</b>(对比一下就懂它的前因):</p>
      <div className="cmp">
        <div className="cmp-row">
          <span className="cmp-tag">第1章 bigram</span>token id <span className="cmp-arr">─查表→</span> <b>logits(<span className="d d-vocab">65<i>vocab</i></span>)</b>
          <small>嵌入表 <span className="d d-vocab">65<i>vocab</i></span>×<span className="d d-vocab">65<i>vocab</i></span>,<b>查出来直接就是得分</b>;没有语义空间、没有位置(只看 1 个字符,顺序无意义)。见 <code>01_bigram.py</code> 的 <code>BigramLanguageModel</code></small>
        </div>
        <div className="cmp-row">
          <span className="cmp-tag hot">第2章 attention</span>token id <span className="cmp-arr">─查表→</span> <span className="d d-emb">32<i>n_embd</i></span>维向量 <b>＋位置向量</b> <span className="cmp-arr">─注意力→ ─lm_head→</span> logits(<span className="d d-vocab">65<i>vocab</i></span>)
          <small>嵌入表改成 <span className="d d-vocab">65<i>vocab</i></span>×<span className="d d-emb">32<i>n_embd</i></span>,<b>先进 <span className="d d-emb">32<i>n_embd</i></span> 维语义空间</b>(还不是得分);位置另学一份加进来;混合完最后才用 <code>lm_head</code> 映射回 <span className="d d-vocab">65<i>vocab</i></span> 维得分。见 <code>02_attention.py</code> 的 <code>forward</code></small>
        </div>
      </div>
      <p className="lead" style={{ margin: '8px 0 14px' }}>
        所以 <code>x = tok_emb + pos_emb</code> <b>只在第 2 章才有</b>:第 1 章嵌入一步出得分;第 2 章把它拆成「嵌入 → 注意力 → lm_head」,中间那个 <span className="d d-emb">32<i>n_embd</i></span> 维向量才是 attention 处理的 <code>x</code>。
      </p>
      <p className="lead" style={{ marginBottom: 14 }}>
        <b>再说怎么变。</b>x 变成 q/k/v,靠一次<b>线性投影</b>(其实就是矩阵乘法):{' '}
        <code>q = x @ Wq</code>、<code>k = x @ Wk</code>、<code>v = x @ Wv</code>。三个权重矩阵各不相同,{' '}
        代码里就是三个 <code>nn.Linear(n_embd, head_size)</code>。它们<b>不是谁手写的规则</b> ——{' '}
        出生时随机初始化,训练中被梯度一点点学出来。下面拨一下看(x 画成 4 维方便上屏,真实是 <code>n_embd=32</code> 维 —— 注意是<b>维度</b>,不是 batch_size):
      </p>
      <div className="proj">
        <div className="proj-left">
          <VRow vals={PX} filled />
          <div className="proj-cap">x(输入向量)· 这 <b>4 个数是随手填的占位</b><br />(4 个独立的数 2、0、1、3,不是"2013")<br />真实是 <b>n_embd=32</b> 个(维度,非 batch),挑小数好心算</div>
        </div>
        <div className="proj-branch">→</div>
        <div className="proj-right">
          <div className="proj-lane">
            <span className="proj-mat mq">× Wq<small>可训练矩阵</small></span><span className="proj-arr">▶</span>
            <VRow vals={QV} filled={on} cls="cq" /><span className="proj-role" style={{ color: 'var(--c-q)' }}>q</span>
          </div>
          <div className="proj-lane">
            <span className="proj-mat mk">× Wk<small>可训练矩阵</small></span><span className="proj-arr">▶</span>
            <VRow vals={KV} filled={on} cls="ck" /><span className="proj-role" style={{ color: 'var(--c-k)' }}>k</span>
          </div>
          <div className="proj-lane">
            <span className="proj-mat mv">× Wv<small>可训练矩阵</small></span><span className="proj-arr">▶</span>
            <VRow vals={VV} filled={on} cls="cv" /><span className="proj-role" style={{ color: 'var(--c-v)' }}>v</span>
          </div>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className={on ? 'btn' : 'btn primary'} onClick={() => setOn(true)}>▶ 投影一下(x × W → q,k,v)</button>
        <button type="button" className={on ? 'btn primary' : 'btn'} onClick={() => setOn(false)}>复位</button>
      </div>
      <div className="note">{projNote(on)}</div>
      <div className="note solid">
        一次<b>线性投影</b> = 输出的每个数字,都是输入 x 所有数字的一个<b>加权组合</b>(权重就是矩阵里的数)。
        同一个 x 过三个不同矩阵,被"调"出三种不同向量 —— <b>不是把 x 切成三段,而是把整根 x 重新组合三次。</b>
      </div>
      <Dig title={'q/k/v 凭什么"思路不一样"?哪张是 Q,谁定的?'}>
        <b>不一样,是练出来的:</b><code>Wq/Wk/Wv</code> 初始化是<b>三组不同的随机数</b>,所以 q/k/v 出生就天生不同
        (因为<b>矩阵不同</b>,不是因为输入不同 —— 它们仨用<b>同一根 x</b>)。训练只为降"预测下一字符"的 loss,
        它不懂 query/key/value,但三个能独立拧的旋钮让梯度下降<b>试出</b>"一个擅长发问、一个擅长被检索、一个擅长搬运"最省 loss。<br />
        <b>但"哪张是 Q"是写死的,不是模型自己选:</b>角色由"输出被塞进公式哪个槽位"决定 ——
        <code>q = x @ Wq</code> 的输出被放去"当发问方点积",<code>v = x @ Wv</code> 被放去"被聚合",
        这些槽位<b>训练前就由程序员钉死</b>(<code>self.query=…</code>/<code>self.value=…</code>)。涌现的只是<b>每张表把自己那份活干好</b>,模型内部从不会分不清谁是谁。
      </Dig>
      <Dig title={'"三个 QKV" 和维度 head_size 是一回事吗?q/k/v 从哪段数据算?'}>
        <b>是两个无关的轴:</b>"<b>三</b>"=有几种<b>角色</b>(query/key/value,架构写死=3);
        <span className="d d-head">32<i>head_size</i></span>=每个向量<b>多长</b>(超参,可调)。把 head_size 改成 30,
        还是<b>恰好三张表</b>,只是每个 q/k/v 从 32 个数变 30 个 —— <b>不会变成"30 个 QKV"</b>。想要第 4 种角色得换架构,拉维度做不到。<br />
        <b>另外:q、k、v 全部只从输入段 <code>idx[:,0:8]</code> 算</b>;偏移 1 的目标段 <code>idx[:,1:9]</code> 只在最末尾给 logits 当"标准答案"判分,<b>从不进入</b> q/k/v。好比 "the cat sat on the ___",答案 "mat" 只判对错,不掺进你的思考。
      </Dig>
      <Dig title={'为什么偏偏是 QKV?是为将来 SFT 问答"挖的坑"吗?'}>
        一个常见的<b>因果倒置</b>,正过来:
        <ul>
          <li><b>QKV(2017)为机器翻译而生</b>,解决<b>当下</b>问题:每个位置<b>按内容去别处取相关信息</b>。而问答{' '}
            <Term k="sft" name="SFT · 监督微调" def="Supervised Fine-Tuning:预训练之后,用「问→答」成对数据继续训练同一批参数,把模型调成「以助手口吻回答」的姿态。能力是预训练就建好的,SFT 只拧风格。">SFT</Term>(2022)<b>晚了五年</b> —— 不可能"先挖坑等填"。</li>
          <li><b>"3" 照搬查字典结构:</b><span className="tag t-q">Query</span> 找什么 · <span className="tag t-k">Key</span> 怎么宣传自己 · <span className="tag t-v">Value</span> 取走的内容。Q、K 分开是因为"<b>按什么匹配</b>"和"<b>匹配上给什么</b>"本是两件事。</li>
          <li><b>SFT 不"填坑"</b>:它只是续训同一批参数(含 <code>Wq/Wk/Wv</code>),把预训练早已长出的"抓上下文"能力调成助手口吻。<b>能力是预训练建的,SFT 只拧风格。</b></li>
          <li><b>能换成别的吗?换过。</b>RNN/CNN/加性注意力都做过同样的事。QKV 胜在<b>能并行、表达力强、好堆叠</b>,不是"适合问答"。问答能力来自"<b>规模 × 预训练一个通用机制</b>"。</li>
        </ul>
        一句话:<b>不是挖坑等填料,而是造了把通用瑞士军刀,后来发现它能开的罐头远超当年只想削的那个苹果。</b>
      </Dig>
      <p className="next-hint">下一步:有了 <b>q</b> 和 <b>k</b>,怎么算出"谁该多看谁"的那张权重表?</p>
    </div>
  )
}

function heatNote(n: number) {
  if (n === 0) return <><b>① q·k 打分</b>:每个 query 和每个 key 点积。格子越深 = 越相关。现在是满表(8×8 全有值)。</>
  if (n === 1) return <><b>② 缩放</b>:全部 ÷ √32 ≈ 5.66。数值被压小,防止下一步 softmax 被推到极端(梯度消失)。</>
  if (n === 2) return <><b>③ 因果掩码</b>:右上角(未来,j{'>'}i)设成 -∞。下一步 exp(-∞)=0,它们权重变 0。<b>这就是 Step 3 的下三角。</b></>
  return <><b>④ softmax</b>:每行变成和为 1 的权重(逐行看,加起来 = 1)。<b>这就是 Step 3 的归一化。</b>这张表就是最终 <code>wei</code>,拿去 <code>wei @ v</code> 加权求和。</>
}

const HEAT_BTNS = ['1 · q·k 打分', '2 · ÷√d 缩放', '3 · 因果掩码', '4 · softmax']

function Step5() {
  const [n, setN] = useState(0)
  const cells = heatGrid(n)
  return (
    <div className={styles.scope}>
      <h2>Step 5 · 算注意力权重:打分 → <Term k="scaling" name="缩放 · scaling (÷√d)" def="把 q·k 的分数除以 √head_size。点积方差随维度增大,不缩放会让 softmax 过于尖锐、权重几乎全压给一个位置。">缩放</Term> → 掩码 → softmax</h2>
      <p className="lead">
        用 8 个位置演示注意力分数表 <code>wei</code>(8×8)。{' '}
        第 <code>i</code> 行第 <code>j</code> 列 = "位置 i 对位置 j 的关注度"。逐步点四个按钮看它怎么成形。
      </p>
      <div className="btn-row">
        {HEAT_BTNS.map((label, i) => (
          <button key={label} type="button" className={n === i ? 'btn primary' : 'btn'} onClick={() => setN(i)}>{label}</button>
        ))}
      </div>
      <div className="heat" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
        {cells.map((c, i) => (
          <div key={i} className={c.mask ? 'hc mask' : 'hc'} style={c.mask ? undefined : { background: c.bg, color: c.fg, borderColor: 'transparent' }}>{c.text}</div>
        ))}
      </div>
      <div className="note">{heatNote(n)}</div>
      <div className="note solid">
        <b>看穿这一步:</b>最终的 <code>wei</code> 就是 Step 3 那个矩阵 <code>a</code> 的"<b>活</b>"版本 ——{' '}
        同守两条铁律:① <Term k="causal-mask" name="因果掩码 · causal mask" def="把未来位置的分数设为 -∞,softmax 后权重变 0,从而看不到未来。靠下三角实现。">因果</Term>(右上为 0)② <b>每行和为 1</b>(<Term k="softmax" name="softmax" def="把一组打分变成和为 1 的概率分布:每个数取 exp 再除以总和。分数越大概率越大。">softmax</Term>)。唯一升级:权重不再写死,而是 <Term k="dot-product" name="点积 · dot product" def="两个等长向量对应元素相乘再求和,得一个标量。越大表示两向量越对齐,用来衡量 query 和 key 的相关性。"><code>q·k</code></Term> 由内容算出来的。
      </div>
      <Dig title="第 ② 步为什么非要 ÷√d 不可?">
        分数 <code>q·k</code> 是 <b><span className="d d-head">32<i>head_size</i></span> 个乘积相加</b>,摆动幅度天然 ≈ <code>√32 ≈ 5.66</code> —— <b>维度越大点积越容易爆炸</b>。
        而 <Term k="softmax" name="softmax" def="把一组打分变成和为 1 的概率分布:每个数取 exp 再除以总和。分数越大概率越大。">softmax</Term> 对大数极敏感:分数差 ±5.7,<code>exp</code> 后差约 6 万倍,权重塌成只认一个位置的 one-hot →{' '}
        <Term k="vanishing" name="梯度消失 · vanishing gradient" def="梯度变得极小,参数几乎不更新、模型学不动。softmax 过于尖锐(某项概率≈1)时发生。">梯度消失</Term>,学不动。
        <code>÷√head_size</code>(代码 <code>* head_size**-0.5</code>)把摆幅拉回 ~1,让 softmax 不论维度多大都待在<b>能学习的温和区间</b>。
      </Dig>
      <Dig title="代码里 transpose / masked_fill / register_buffer 在干嘛?">
        都在 <code>Head.forward</code>:<br />
        ① <code>k.transpose(-2,-1)</code>:把 <code>k</code> 从 <span className="d d-block">8<i>T</i></span>×<span className="d d-head">32<i>head</i></span> 对调成 <span className="d d-head">32<i>head</i></span>×<span className="d d-block">8<i>T</i></span>,
        这样 <code>q @ kᵀ</code> 才乘得出 <span className="d d-block">8<i>T</i></span>×<span className="d d-block">8<i>T</i></span> 分数表。<b>只为形状对得上,不改数值。</b><br />
        ② <code>masked_fill(tril==0, -inf)</code>:就是<b>掩码</b>,把未来位置填 -∞,softmax 后归零。<br />
        ③ 那张 <code>tril</code> 用 <code>register_buffer</code> 挂成<b>常量</b>(不训练,但随 <code>.to(device)</code> 搬家),区别于会被梯度拧的 <code>nn.Parameter</code>。
      </Dig>
      <p className="next-hint">下一步:有了权重表 <b>wei</b>,拿它去聚合 <b>value</b>,得到每个位置的新向量。</p>
    </div>
  )
}

function AggBreak({ sel }: { sel: number | null }) {
  if (sel === null) {
    return (
      <div className="agg-break">
        <div className="bk-head">👆 点 <b>wei</b> 任意一行,看 <b>out</b> 那一行怎么由 value 加权求和而来。</div>
      </div>
    )
  }
  const terms: string[] = []
  const nums: string[] = []
  for (let j = 0; j <= sel; j++) {
    if (AGG_WEI[sel][j] === 0) continue
    terms.push(`${awf(AGG_WEI[sel][j])}·v${j}`)
    nums.push(`${awf(AGG_WEI[sel][j])}·[${AGG_V[j].join(',')}]`)
  }
  const o = aggRow(sel)
  return (
    <div className="agg-break">
      <div className="bk-head"><b>out 第 {sel} 行</b>(位置 {sel} "{AGG_TOK[sel]}" 看过历史后的新向量)= 它能看到的位置按 wei 加权求和:</div>
      <span className="bk-row">out[{sel}] = {terms.join(' + ')}</span>
      <span className="bk-row">       = {nums.join(' + ')}</span>
      <span className="bk-row">       = [<b>{o.map((v) => v.toFixed(1)).join(', ')}</b>]</span>
    </div>
  )
}

function lossPath(upto: number) {
  let d = ''
  const N = 140
  for (let i = 0; i <= N; i++) {
    const ss = upto * (i / N)
    d += `${i === 0 ? 'M' : 'L'}${lcX(ss).toFixed(1)},${lcY(lossAt(ss)).toFixed(1)} `
  }
  return d
}

function LossNote({ upto }: { upto: number }) {
  const lv = lossAt(upto)
  if (upto < 5) {
    return <div className="note"><b>起点</b>:还没训练,loss ≈ <code>4.17</code> = <code>ln(65)</code>,等于"<b>65 个字符里瞎猜</b>"。点「▶ 跑训练」看它往下掉。</div>
  }
  if (lv >= L_WALL) {
    return <div className="note"><b>训练中</b>:loss ≈ <code>{lv.toFixed(2)}</code>,正在逼近 bigram 那道 2.49 的墙……</div>
  }
  return <div className="note">loss ≈ <code>{lv.toFixed(2)}</code> —— <b style={{ color: 'var(--accent)' }}>已跌破 2.49!</b>这是只看 1 个字符的 bigram 永远到不了的地方。</div>
}

function Step6() {
  const live = useStepLive()
  const [sel, setSel] = useState<number | null>(null)
  const [trained, setTrained] = useState(true)
  const [upto, setUpto] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)
  const outs = [0, 1, 2, 3].map((i) => aggRow(i))
  const wy = lcY(L_WALL)
  const lv = lossAt(upto)

  useEffect(() => {
    if (!live) setPlaying(false)
  }, [live])

  useEffect(() => {
    if (!live || !playing) return
    const t0 = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / 2800))
      const e = 1 - (1 - t) ** 2
      setUpto(L_SMAX * e)
      if (t < 1) raf = requestAnimationFrame(frame)
      else setPlaying(false)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [live, playing, run])

  return (
    <div className={styles.scope}>
      <h2>Step 6 · 加权聚合,与一次 forward 的全貌</h2>
      <p className="lead">
        最后一步:用权重表 <code>wei</code> 去对所有 <code>value</code> 加权求和,{' '}
        <code>out = wei @ v</code> —— 这正好对应 Step 3 的 <code>c = a @ b</code>。{' '}
        每个位置由此得到一根"<b>已经看过它的历史</b>"的新向量。
      </p>
      <div className="sub-h"><span className="badge">A</span>聚合:out = wei @ v(点一行,看它怎么把历史揉成一根新向量)</div>
      <p className="lead" style={{ marginBottom: 6 }}>
        和 Step 3 的 <code>c = a @ b</code> 是<b>同一件事</b> —— 用权重表 <code>wei</code> 对 <code>value</code> 加权求和。{' '}
        唯一不同:这里的权重<b>不再均匀</b>(是 Step 5 按相关性算出来的),相关的位置占比大。<b>点 <code>wei</code> 任意一行</b>,看 <code>out</code> 那一行怎么来。
      </p>
      <div className="agg">
        <div>
          <div className="label-sm">权重 wei(4×4,每行和=1)</div>
          <div className="mgrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {AGG_WEI.flatMap((row, ri) => row.map((v, ci) => (
              <div key={`${ri}-${ci}`} className={['cell', 'clickable', v === 0 ? 'zero' : '', sel === ri ? 'rowsel' : ''].filter(Boolean).join(' ')} onClick={() => setSel(ri)}>{awf(v)}</div>
            )))}
          </div>
        </div>
        <span className="op">@</span>
        <div>
          <div className="label-sm">value v(4 位置 × 3 维示意)</div>
          <div className="mgrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {AGG_V.flatMap((row, ri) => row.map((v, ci) => (
              <div key={`${ri}-${ci}`} className={['cell', sel !== null && ri <= sel && AGG_WEI[sel][ri] > 0 ? 'rowcontrib' : ''].filter(Boolean).join(' ')}>{v}</div>
            )))}
          </div>
        </div>
        <span className="op">=</span>
        <div>
          <div className="label-sm">out(4 × 3)</div>
          <div className="mgrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {outs.flatMap((row, ri) => row.map((v, ci) => (
              <div key={`${ri}-${ci}`} className={['cell', 'hot', sel === ri ? 'rowsel' : ''].filter(Boolean).join(' ')}>{v.toFixed(1)}</div>
            )))}
          </div>
        </div>
      </div>
      <AggBreak sel={sel} />
      <p className="lead" style={{ margin: '14px 0 0', fontSize: 13 }}>
        <code>out</code> 就是每个位置"<b>看过历史后</b>"的新向量。权重均匀 → 就是 Step 3 的死平均;权重由内容算出来 → 才叫<b>注意力</b>。
      </p>
      <Dig title={<><code>wei @ v</code> 在算什么?<code>wei</code> 是不是就"全部"了,<code>out</code> 只是 <code>v</code> 的拷贝?</>}>
        注意力分<b>两半</b>,角色完全不同:<br />
        ① <b>算权重(路由)</b>:<code>q·k → 缩放 → 掩码 → softmax</code> 得到 <code>wei</code> —— 一张"<b>谁看谁、各看多少</b>"的调度表,
        每行是<b>和为 1 的比例,本身不含任何内容</b>。两个意思天差地别的句子也可能算出相同的 <code>wei</code>,真正区分它们的是 <code>v</code>。
        所以 <code>wei</code> <b>不是"全部"</b>,它是"空的",内容全在 <code>v</code> 里。<br />
        ② <b>搬内容(聚合)</b>:<code>wei @ v</code> 才是<b>信息真正跨位置流动</b>的一步,也是注意力的主戏。<br />
        <code>out</code> <b>不是拷贝</b>,是<b>加权混合出的新向量</b>。看上面 <code>out</code> 任意一行:若该行权重是 <code>[0.7, 0.2, 0.1]</code>,
        则 <code>out = 0.7·v₀ + 0.2·v₁ + 0.1·v₂</code> —— 一根<b>原来不存在</b>的向量,既不是 <code>v₀</code> 也不是任何单行 <code>v</code>。
        只有当某个权重 = 1、其余 = 0(硬注意力)时,<code>out</code> 才恰好等于某一行 <code>v</code>,那才叫"拷贝";一般 softmax 出来都是小数,所以是<b>混合</b>。
      </Dig>
      <Dig title={<><code>out</code> 的形状(高、宽)是怎么定的?</>}>
        矩阵乘法 <code>(m×n) @ (n×p) = (m×p)</code>。这里 <code>wei</code> 是 <code>T×T</code>,<code>v</code> 是 <code>T×</code><span className="d d-head">head_size</span>,
        所以 <code>out = wei @ v</code> 是 <code>T×</code><span className="d d-head">head_size</span>:<br />
        · <b><code>out</code> 的高 = <code>wei</code> 的高</b>(<code>T</code> 个位置,每个位置输出一行结果);<br />
        · <b><code>out</code> 的宽 = <code>v</code> 的宽</b>(<span className="d d-head">head_size</span>,每个位置混出的新向量仍是 <span className="d d-head">head_size</span> 维)。<br />
        中间那个 <code>T</code> 被<b>消掉</b>了 —— 这正是"把 <code>T</code> 个 value 沿位置维<b>加权求和、压成一根</b>"的数学体现:
        聚合前每个位置面对 <code>T</code> 个历史向量,聚合后只剩它自己那一根。
      </Dig>
      <div className="sub-h"><span className="badge">B</span>放进模型:一次 forward 走完整条路</div>
      <p className="lead" style={{ marginBottom: 8 }}>代码里 <code>AttentionLanguageModel.forward</code> 就是这条链:</p>
      <div className="flow">
        <div className="fc">idx<small>输入字符</small></div>
        <div className="fa">→</div>
        <div className="fc">tok_emb + pos_emb<small>内容 + 位置</small></div>
        <div className="fa">→</div>
        <div className="fc">自注意力头<small>q,k,v → wei → wei@v</small></div>
        <div className="fa">→</div>
        <div className="fc">lm_head<small>映射回词表</small></div>
        <div className="fa">→</div>
        <div className="fc">logits<small>下一字符打分</small></div>
      </div>
      <div className="note solid">
        🔑 <b>全章其实就两个 <code>forward</code>,而且是<b>承上启下</b>的 —— 抓住这点就抓住了第 2 章。</b>
        <table className="truth" style={{ margin: '8px 0 4px' }}>
          <tbody>
            <tr><th>谁的 forward</th><th>干的事</th><th>角色</th></tr>
            <tr>
              <td className="lbl"><code>Head</code><br />.forward</td>
              <td>一个<b>零件</b>:输入 <span className="d d-emb">32<i>n_embd</i></span> 的向量 → q·k、缩放、掩码、softmax、<code>wei@v</code> → 输出 <span className="d d-head">32<i>head</i></span> 的"看过历史"向量。<b>这是本章全新的东西。</b></td>
              <td className="sum">启下<br /><small style={{ fontFamily: 'system-ui', color: 'var(--ink2)' }}>新机制</small></td>
            </tr>
            <tr>
              <td className="lbl"><code>Attention<br />LM</code><br />.forward</td>
              <td><b>总装线</b>:嵌入(tok+pos)→ <b>调用</b> <code>Head.forward</code> → <code>lm_head</code> 映射回词表 → <code>cross_entropy</code>。<b>这就是第 1 章那条老骨架,只多插了一行 <code>x = sa_head(x)</code>。</b></td>
              <td className="sum">承上<br /><small style={{ fontFamily: 'system-ui', color: 'var(--ink2)' }}>老骨架</small></td>
            </tr>
          </tbody>
        </table>
        <p className="lead" style={{ margin: '6px 0 0', fontSize: 13 }}>
          <b>外层承接 bigram</b>(嵌入→logits→交叉熵一字没改),<b>内层启出新本事</b>(把"看过去"封成零件)。bigram 只有一个 forward,因为它没有零件可调用。
        </p>
      </div>
      <Dig title={<>那 <code>loss</code> 到底怎么从 <code>logits</code> 算出来?(慢动作)</>}>
        <code>logits</code> 是 <span className="d d-batch">32<i>B</i></span>×<span className="d d-block">8<i>T</i></span>×<span className="d d-vocab">65<i>vocab</i></span>,<code>targets</code> 是 <span className="d d-batch">32<i>B</i></span>×<span className="d d-block">8<i>T</i></span>(每位置"真正下一个字符"id,偏移 1)。
        <Term k="cross-entropy" name="交叉熵 · cross entropy" def="衡量「预测概率分布」和「正确答案」的差距:把模型给正确字符的概率 p 取 -log(p)。p 越高损失越小。">交叉熵</Term> 只认"一摞预测+一摞答案",先<b>摊平</b>成 <b>(256, 65)</b> 和 <b>(256,)</b> ——
        <b><span className="d d-batch">32</span>×<span className="d d-block">8</span>=256 道独立的"预测下一字符"小考题</b>。<br />
        逐题:65 个分数 → softmax → 取"正确答案"被分到的概率 <code>p</code> → 损失 <code>-log(p)</code>(p 越高越不扣分);256 题取平均 = 那个 <code>loss</code>。<br />
        <b>和第 1 章 bigram 同一行、同一算法</b> —— 区别只是 bigram 的 65 个分数只看当前 1 个字符,attention 的分数来自<b>已吸收前文</b>的向量。<b>判分没变,被判的预测信息更足了。</b>
      </Dig>
      <Dig title={<>为什么要多一个 <code>pos_emb</code> 位置嵌入?</>}>
        注意力本身<b>看不见顺序</b> —— 把输入打乱,输出只会跟着一起打乱,权重不变。
        所以要额外加一份"<Term k="positional-embedding" name="位置嵌入 · positional embedding" def="注意力本身看不出顺序,所以给「第几个位置」也学一个向量,加到 token 嵌入上,模型才知道谁先谁后。">位置信息</Term>"告诉模型"这是第几个位置",<code>x = tok_emb + pos_emb</code> 就是把内容和位置相加。
      </Dig>
      <div className="sub-h"><span className="badge">C</span>参数真身:训练到底练出了什么</div>
      <p className="lead" style={{ marginBottom: 6 }}>
        和第 1 章那张 6×6 表一样,训练的产物就是<b>一堆数字旋钮</b>。第 2 章的"真身"是<b>这 6 块矩阵</b> ——{' '}
        出生是随机雪花,训练后被梯度调出结构。<b>点按钮看"训练前 → 训练后"。</b>
      </p>
      <div className="btn-row">
        <button type="button" className={trained ? 'btn' : 'btn primary'} onClick={() => setTrained(false)}>训练前(随机雪花)</button>
        <button type="button" className={trained ? 'btn primary' : 'btn'} onClick={() => setTrained(true)}>训练后(有结构)</button>
      </div>
      <div className="truths">
        {TRUTHS.map((m, mi) => (
          <div key={m.name} className="tcard">
            <div className="tname">{m.name}</div>
            <div className="tmini" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {Array.from({ length: 36 }, (_, k) => {
                const i = Math.floor(k / 6)
                const j = k % 6
                return <i key={k} style={{ background: truthColor(truthT(trained, mi, i, j)) }} />
              })}
            </div>
            <div className="tsize">{m.size}</div>
          </div>
        ))}
      </div>
      <p className="lead" style={{ margin: '2px 0 0', fontSize: 12.5 }}>
        (格子是<b>示意</b>,不是真实数值;真实每块更大,如 <code>token_emb</code> 是 <span className="d d-vocab">65<i>vocab</i></span>×<span className="d d-emb">32<i>n_embd</i></span>。{' '}
        <code>q/k/v/wei/out</code> 都<b>不在</b>这 6 块里 —— 它们是现算的中间产物,不是被训练的旋钮。)
      </p>
      <Dig title="这 6 块各多大?参数量怎么算(对照 bigram)?">
        和 bigram 用<b>同一个</b>交叉熵、<b>同一套</b>梯度下降,只是<b>旋钮变多了</b>:
        <div className="table-scroll">
          <table className="truth">
            <tbody>
              <tr><th>模型</th><th>训练出来的"旋钮"(参数真身)</th><th>规模</th></tr>
              <tr>
                <td className="lbl">第1章<br />bigram</td>
                <td><code>token_embedding_table</code><br /><small style={{ fontFamily: 'system-ui', color: 'var(--ink2)' }}>一张 <span className="d d-vocab">65<i>vocab</i></span>×<span className="d d-vocab">65<i>vocab</i></span> 表,既是"内容"又直接是"下一字符打分"</small></td>
                <td className="sum"><span className="d d-vocab">65</span>×<span className="d d-vocab">65</span><br />≈ 4,225</td>
              </tr>
              <tr>
                <td className="lbl">第2章<br />attention</td>
                <td>
                  <code>token_embedding</code> <span className="d d-vocab">65<i>vocab</i></span>×<span className="d d-emb">32<i>n_embd</i></span><br />
                  <code>position_embedding</code> <span className="d d-block">8<i>block</i></span>×<span className="d d-emb">32<i>n_embd</i></span><br />
                  <code>Wq</code>/<code>Wk</code>/<code>Wv</code> 各 <span className="d d-emb">32<i>n_embd</i></span>×<span className="d d-head">32<i>head</i></span><br />
                  <code>lm_head</code> <span className="d d-head">32<i>head</i></span>×<span className="d d-vocab">65<i>vocab</i></span>(+65 bias)
                </td>
                <td className="sum">2080+256<br />+1024×3<br />+2145<br />= 7,553</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Dig>
      <Dig title="这些维度谁定的、越大越好吗?head_size 必须等于 n_embd 吗?">
        <span className="d d-emb">32<i>n_embd</i></span> 和 <span className="d d-head">32<i>head</i></span> 都是<b>你自己设的超参(容量旋钮)</b>:维度越大能塞的信息越多 ——
        但<b>不是无脑越大越好</b>,参数算力跟着涨、数据少会过拟合。取 32 是<b>玩具级</b>(GPT-2 是 768,GPT-3 是 12288)。<br />
        <b>head_size 不"必须等于" n_embd:</b><code>nn.Linear(n_embd, head_size)</code> 里<b>输入被钉死成 <span className="d d-emb">32<i>n_embd</i></span></b>,
        <b>输出 <span className="d d-head">head_size</span> 随你挑</b>。本章<b>单头</b>图省事才设相等;第 3 章<b>多头</b>时每个头取 <code>head_size = n_embd / 头数</code>(更小),拼起来才凑回 <span className="d d-emb">32<i>n_embd</i></span>。<br />
        方向上:<b>比 n_embd 小</b>是常用的(多头压缩,每头看一个子空间);<b>比 n_embd 大基本是冗余</b> —— 输出再多也只是 <span className="d d-emb">32<i>n_embd</i></span> 维输入的线性组合,装不下更多信息。
      </Dig>
      <Dig title={'哪些"不是真身"?(q / k / v / wei / out 别记混)'}>
        它们每来一个输入就<b>现算一遍</b>,从不存储,梯度下降也不直接拧:
        <ul className="ghost-list">
          <li><code>q</code> / <code>k</code> / <code>v</code> 向量 —— 拿旋钮 <code>Wq/Wk/Wv</code> 乘 <code>x</code> 临时算的。</li>
          <li>得分表 <code>wei</code> 和它的 softmax 权重 —— 当场算的中间结果。<b>"那张表"不是参数。</b></li>
          <li><code>out</code> —— <code>Head.forward</code> 的返回值,是"看过历史"的新向量;<b>不是三张权重表</b>,真身 <code>Wq/Wk/Wv</code> 一直留在模块里。</li>
          <li>被拧的只有矩阵 <code>W</code>(旋钮),<code>q/k/v/wei/out</code> 全是"旋钮+输入"算出的咖啡。</li>
        </ul>
      </Dig>
      <Dig title="本章出现了两个 softmax,别混">
        ① Step 5 内部那次,作用在 <code>wei</code> 上,决定"对每个历史位置关注多少";
        ② 最末尾那次,作用在 <code>logits</code>(65 个)上,决定"下一个字符是谁" ——
        <b>第 ② 个才和 bigram 结尾那次是同一个</b>。softmax 自己没有参数。
      </Dig>
      <div className="sub-h"><span className="badge">D</span>跑起来:loss 怎么跌破 bigram 那道 2.49 的墙</div>
      <p className="lead" style={{ marginBottom: 6 }}>
        <code>02_attention.py</code> 训练 5000 步。点「<b>▶ 跑训练</b>」,看注意力的 loss 一路下探,<b>穿过</b> bigram 卡死的 <b>2.49</b> 虚线 —— 这就是这一章的兑现。
      </p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => { setUpto(0); setPlaying(true); setRun((n) => n + 1) }}>▶ 跑训练</button>
        <button type="button" className="btn" onClick={() => { setPlaying(false); setUpto(0) }}>复位</button>
      </div>
      <div className="loss-wrap">
        <svg viewBox="0 0 780 240">
          <line x1="44" y1={wy.toFixed(1)} x2="760" y2={wy.toFixed(1)} stroke="#9a948a" strokeWidth="1.5" strokeDasharray="6 4" />
          <text x="758" y={(wy - 6).toFixed(1)} textAnchor="end" fontSize="12" fill="#9a948a" fontFamily="monospace">bigram 墙 2.49</text>
          {[2.5, 3, 3.5, 4].map((v) => (
            <text key={v} x="38" y={(lcY(v) + 3).toFixed(1)} textAnchor="end" fontSize="11" fill="#b5afa3" fontFamily="monospace">{v.toFixed(1)}</text>
          ))}
          {[0, 1000, 2000, 3000, 4000, 5000].map((it) => (
            <text key={it} x={lcX(it).toFixed(1)} y="232" textAnchor="middle" fontSize="11" fill="#b5afa3" fontFamily="monospace">{it}</text>
          ))}
          <path d={lossPath(upto)} fill="none" stroke="#D97757" strokeWidth="2.5" />
          <circle cx={lcX(upto).toFixed(1)} cy={lcY(lv).toFixed(1)} r="5" fill="#D97757" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      <div className="loss-leg">
        <span><i style={{ borderTopStyle: 'solid', borderColor: 'var(--accent)' }} />attention(本章)val loss</span>
        <span><i style={{ borderTopStyle: 'dashed', borderColor: '#9a948a' }} />bigram 的墙 ≈ 2.49</span>
        <span className="loss-read">step <b className="step">{Math.round(upto)}</b> · loss <b className="val">{lv.toFixed(2)}</b></span>
      </div>
      <LossNote upto={upto} />
      <p className="lead" style={{ margin: '6px 0 14px', fontSize: 12 }}>(示意曲线:数量级与趋势对得上 <code>02_attention.py</code> 的实际打印,非逐位精确复现。)</p>
      <div className="note solid">
        🎯 <b>结果:打破 2.49 的墙。</b>装上注意力后,每个位置都能参考前文,{' '}
        <code>val loss</code> 终于跌破 bigram 那道 <code>2.49</code> 的天花板(2.49 → 2.41,小但真实)。这就是这一章的兑现。
      </div>
      <p className="next-hint">点右下角「完成 🎉」收下这一章。</p>
    </div>
  )
}

export function Attention() {
  const chapter = findChapter('attention')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />, <Step6 />]
  return (
    <ChapterShell
      slug="attention"
      title={'自注意力:让每个位置学会"往回看"'}
      subtitle={
        <>
          配套 <code>02_attention.py</code>。上一章 bigram 只看前 1 个字符,撞在 <code>val loss ≈ 2.49</code> 的墙上。{' '}
          这一章一步步搭出自注意力 —— 六步看懂直觉,再回去读代码就豁然开朗。
        </>
      }
      hp={
        <HpBar label="超参速查">
          <HpChip color="#b8512f" bg="#F7E6DE">batch_size <b>32</b> <i>句子数</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">block_size <b>8</b> <i>位置数 T</i></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>32</b> <i>维度 C</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">head_size <b>32</b> <i>头维度</i></HpChip>
          <span className="hp-note">⚠ 三个 32 含义不同,纯属撞脸;block_size 是 8</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 第 2 章 · 自注意力 通关!</div>
          <div className="cs">从"往回看"到加权聚合,你已看懂整条链路</div>
        </>
      }
    />
  )
}
