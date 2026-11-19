// 旧页进入一步会拨回默认：切蛋糕回到 4 头，拼接回到各自输出，FFN 回到输入，残差拨回开，并重播 loss 曲线。新页离开再回来保留这些选择，曲线停在离开时的进度。
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Transformer.module.css'

const DEF_FFN = 'Transformer 层里的小 MLP:Linear→ReLU→Linear,中间放大 4 倍。逐位置加工每个 token。注意力管「沟通」,FFN 管「思考」。'
const NAME_FFN = 'FeedForward · 前馈网络'

const N_EMBD = 128
const T = 8
const HEAD_I = [0, 1, 2, 3]
const RES_LAYERS = [6, 5, 4, 3, 2, 1]
const RES_N = 6
const SPLITS = [1, 2, 4, 8, 16]

type Score = (i: number, j: number) => number
const HEADS: { n: string; d: string; score: Score }[] = [
  { n: '头 1', d: '盯紧"前一个词"', score: (i, j) => (j === i - 1 ? 4 : j === i ? 0.5 : 0) + 0.05 },
  { n: '头 2', d: '回看"句首/远处"', score: (i, j) => (j === 0 ? 3.5 : 0.3) + (i - i) },
  { n: '头 3', d: '均匀回看(近似平均)', score: (i, j) => 1 + (i - i) + (j - j) },
  { n: '头 4', d: '盯紧"自己"(当前位置)', score: (i, j) => (j === i ? 4 : 0.2) },
]

const LOSS_ITERS = [0, 1000, 2000, 3000, 4999]
const LOSS_GPT = [4.17, 1.79, 1.67, 1.63, 1.57]
const CH2_FLOOR = 2.41
const LY_MIN = 1.4
const LY_MAX = 4.3
const NL = LOSS_ITERS.length
const Y_TICKS = [1.5, 2, 2.5, 3, 3.5, 4]
const lx = (i: number) => 50 + (i / (NL - 1)) * 690
const ly = (v: number) => 16 + (LY_MAX - v) / (LY_MAX - LY_MIN) * 194

function Dim({ kind, n, sub }: { kind: string; n: string; sub?: string }) {
  return <span className={`d d-${kind}`}>{n}{sub ? <i>{sub}</i> : null}</span>
}

function heatColor(t: number) {
  const x = Math.max(0, Math.min(1, t))
  const r = Math.round(240 - 23 * x)
  const g = Math.round(238 - 119 * x)
  const b = Math.round(230 - 143 * x)
  return { bg: `rgb(${r},${g},${b})`, fg: x > 0.55 ? '#fff' : '#6B6B68' }
}

function headMatrix(score: Score) {
  const M: number[][] = []
  for (let i = 0; i < T; i++) {
    const ex: Array<number | null> = []
    let sum = 0
    for (let j = 0; j < T; j++) {
      if (j > i) {
        ex.push(null)
        continue
      }
      const e = Math.exp(score(i, j))
      ex.push(e)
      sum += e
    }
    M.push(ex.map((e) => (e === null ? Number.NEGATIVE_INFINITY : e / sum)))
  }
  return M
}

function headFocus(sel: number) {
  if (sel === 0) return <><b>对角线下方一格</b>(每个位置看它前一个)</>
  if (sel === 1) return <><b>第 0 列</b>(每个位置都回看句首)</>
  if (sel === 2) return <><b>整个下三角</b>(过去各位置差不多平均)</>
  return <><b>主对角线</b>(每个位置主要看自己)</>
}

function SplitNote({ nh, hs }: { nh: number; hs: number }) {
  if (nh === 4) {
    return <div className="note"><b>本章设定。</b>4 个头各 32 维,拼起来正好 128。这正是 <code>head_size = n_embd / n_head = 128/4 = 32</code>。</div>
  }
  if (nh === 1) {
    return <div className="note">1 头 = 退回第 2 章那种<b>单头</b>:head_size 就等于整个 n_embd=128,只有一种注意力视角。</div>
  }
  return <div className="note">{nh} 个头,每头 <b>{hs}</b> 维。头越多→每头越薄(视角多但单头弱);头越少→每头越厚(单头强但视角少)。总和永远是 128。</div>
}

function barsFor(nh: number, hs: number) {
  const out: ReactNode[] = []
  for (let k = 0; k < nh; k++) {
    out.push(
      <div key={k} className="seg">
        <div className="sn">head {k + 1}</div>
        {nh <= 8 ? <div className="sh">{hs} 维</div> : null}
      </div>,
    )
  }
  return out
}

function Step1() {
  const [nh, setNh] = useState(4)
  const hs = N_EMBD / nh
  return (
    <div className={styles.scope}>
      <h2>Step 1 · 切蛋糕:把 128 维切成 4 个头(不是加 4 份)</h2>
      <p className="lead">
        <Term k="multi-head" name="多头注意力 · multi-head attention" def="把注意力拆成若干个并行的小头,每个头在 n_embd 的一个子空间(head_size = n_embd / n_head 维)里独立打分聚合,最后拼接再投影回 n_embd。">多头</Term>
        {' '}最容易误会的一点:它<b>不是</b>把模型加宽成好几倍,而是把<b>同一块</b> <Dim kind="emb" n="128" sub="n_embd" />
        {' '}切成 <Dim kind="nhead" n="4" sub="n_head" /> 份,每份 <Dim kind="head" n="32" sub="head_size" /> 维。
        {' '}<b>切几份,总料不变。</b>拨下面看 <code>head_size = n_embd / n_head</code> 怎么变。
      </p>
      <div className="btn-row">
        {SPLITS.map((n) => (
          <button key={n} type="button" className={nh === n ? 'btn primary' : 'btn'} onClick={() => setNh(n)}>
            {n === 4 ? '4 头(本章)' : `${n} 头`}
          </button>
        ))}
      </div>
      <div className="split-bar">{barsFor(nh, hs)}</div>
      <div className="split-sum">
        <Dim kind="nhead" n={String(nh)} sub="n_head" />
        {' '}×{' '}
        <Dim kind="head" n={String(hs)} sub="head_size" />
        {' '}= <b>128</b>{' '}
        <span style={{ color: 'var(--ink2)' }}>= n_embd(拼回去,总料不变)</span>
      </div>
      <SplitNote nh={nh} hs={hs} />
      <div className="sub-h"><span className="badge">代码</span>4 个头 = 4 份第 2 章的 <code>Head</code></div>
      <p className="lead" style={{ marginBottom: 6 }}>
        <code>MultiHeadAttention</code> 里就一行关键:<code>ModuleList</code> 装 <Dim kind="nhead" n="n_head" /> 个 第 2 章那个 <code>Head</code>,每个头有<b>自己独立的</b> <code>Wq/Wk/Wv</code>。
      </p>
      <pre className={styles.pre}>
        {'self.heads = nn.ModuleList([Head(head_size) '}<span className={styles.cmt}># head_size = 32</span>{'\nfor _ in range(num_heads)])  '}<span className={styles.cmt}># num_heads = 4</span>
      </pre>
      <p className="next-hint">下一步:4 个头各有各的 <code>Wq/Wk/Wv</code> → 各算出<b>不一样</b>的注意力。它们会自己分工。</p>
    </div>
  )
}

function Heat({ sel }: { sel: number }) {
  const M = headMatrix(HEADS[sel].score)
  const cells: ReactNode[] = []
  for (let i = 0; i < T; i++) {
    for (let j = 0; j < T; j++) {
      const v = M[i][j]
      if (v === Number.NEGATIVE_INFINITY) {
        cells.push(<div key={`${i}-${j}`} className="hc mask" />)
      } else {
        const col = heatColor(v)
        cells.push(
          <div key={`${i}-${j}`} className="hc" style={{ background: col.bg, color: col.fg, borderColor: 'transparent' }}>
            {v < 0.04 ? '' : v.toFixed(2)}
          </div>,
        )
      }
    }
  }
  return <div className="heat" style={{ gridTemplateColumns: `repeat(${T},1fr)` }}>{cells}</div>
}

function Step2() {
  const [headSel, setHeadSel] = useState(0)
  const h = HEADS[headSel]
  return (
    <div className={styles.scope}>
      <h2>Step 2 · 每个头各看各的:分工是训练"逼"出来的</h2>
      <p className="lead">
        4 个头吃<b>同一个</b>输入,但各有独立的 <code>Wq/Wk/Wv</code> → 各自算出一张<b>不同</b>的注意力权重表 <code>wei</code>。
        {' '}<b>点下面的头</b>,看它们关注的位置多么不一样。每个头画成 <b>8×8</b> 的下三角(<b>只是上屏占位:真实 <Dim kind="block" n="block_size=64" sub="T" /></b>,只能看过去),格子越深 = 关注越多。
      </p>
      <div className="head-tabs">
        {HEADS.map((item, i) => (
          <button key={item.n} type="button" className={i === headSel ? 'head-tab on' : 'head-tab'} onClick={() => setHeadSel(i)}>
            <div className="ht-n">{item.n}</div>
            <div className="ht-d">{item.d}</div>
          </button>
        ))}
      </div>
      <Heat sel={headSel} />
      <p className="heat-axis">行 = 发问的位置 i(query);列 = 被看的位置 j(key)。每行和为 1。</p>
      <div className="note">
        <b>{h.n} · {h.d}</b>:这个头的 <code>wei</code> 把注意力主要压在{headFocus(headSel)}。同一句话,4 个头给出 4 张完全不同的表 —— 这就是"各看各的"。
      </div>
      <Dig title={'这 4 个头的"专长",是谁分配的?'}>
        <b>没人分配,是训练中自己涌现的。</b>没有哪行代码写"1 号头管前一个词"。让它们分开的是两股力:
        {' '}① <b>初始随机不同</b> —— 每个头的 <code>Wq/Wk/Wv</code> 随机初始化,起点就有差异;
        {' '}② <b>"别重复"的压力</b> —— 若 4 个头算同一件事,等于浪费 3 个头的容量,<code>loss</code> 降不下去,
        {' '}梯度下降于是把它们推向<b>各管一摊</b>。<br />
        训练完用可解释性工具去看,确实能认出一些有名的头:专盯前一个词的、回看句首的、配对引号/括号的、
        {' '}以及 induction head(归纳头:见过 "AB",再遇 A 就预测 B)。<br />
        (上面四张图是<b>示意</b>,用来体现"每个头一种模式";真实的头多数更杂、更难一句话概括。)
      </Dig>
      <Dig title="这跟 Q/K/V 的分工是一回事吗?">
        <b>不是,两种分工的来源相反:</b><br />
        · <b>Q/K/V 是"公式钦定"的</b> —— q 站在点积左边(发问)、k 在右边(被问)、v 被聚合搬运,
        {' '}三者在算式里位置不同,角色天生被劈开,<b>绝不会冗余</b>。<br />
        · <b>多个头是"训练涌现"的</b> —— 架构上 4 个头完全对称、可互换,是训练动力学才把它们卷出了不同专长,
        {' '}<b>有时还会重复</b>(见下条)。<br />
        一句话:<b>Q/K/V 是三个不同工种;4 个头是四个一样的新人,在干活中自己卷出了专长。</b>
      </Dig>
      <Dig title="会不会两个头分化成一模一样?(冗余头)">
        <b>会,这叫"冗余头(redundant heads)"。</b>"别重复"的压力是软的、间接的,不是硬约束,头一多总有几个长得彼此很像。
        {' '}有研究(《Are Sixteen Heads Really Better than One?》)发现很多头是冗余的,训练后<b>剪掉(prune)性能几乎不掉</b>。
        {' '}冗余不是错,只是浪费 —— 这也是"头并非越多越好"的一个原因。代码里那行 <Term k="dropout" name="Dropout · 随机失活" def="训练时随机丢弃一部分连接(如 10%),逼网络别过度依赖某几条路径,防过拟合。只在训练时生效,推理时关闭。"><code>dropout</code></Term> 多少帮点忙,
        {' '}训练时随机丢连接,逼头之间别抱团长得太像。
      </Dig>
      <p className="next-hint">下一步:4 个头各吐一根 <Dim kind="head" n="32" /> 维向量,怎么拼回 <Dim kind="emb" n="128" />?头数又该怎么挑?</p>
    </div>
  )
}

function CatView({ n }: { n: number }) {
  if (n === 0) {
    return (
      <div className="cat-row">
        {HEAD_I.map((k) => (
          <div key={k} className="hstrip">head {k + 1}<br /><b>32 维</b></div>
        ))}
      </div>
    )
  }
  if (n === 1) {
    const nodes: ReactNode[] = []
    for (const k of HEAD_I) {
      nodes.push(<div key={`h${k}`} className="hstrip">head {k + 1}<br /><b>32</b></div>)
      if (k < 3) nodes.push(<span key={`p${k}`} className="op">+</span>)
    }
    nodes.push(<span key="eq" className="op">=</span>)
    nodes.push(<div key="box" className="catbox emb">cat<br /><b>128 维</b></div>)
    return <div className="cat-row">{nodes}</div>
  }
  return (
    <div className="cat-row">
      <div className="catbox">cat<br /><b>128</b></div>
      <span className="op">→</span>
      <div className="catbox" style={{ minWidth: 90 }}>proj<br /><small style={{ color: 'var(--ink2)' }}>Linear 128→128</small></div>
      <span className="op">→</span>
      <div className="catbox emb">输出<br /><b>128 维</b></div>
    </div>
  )
}

function CatNote({ n }: { n: number }) {
  if (n === 0) {
    return <div className="note"><b>① 各自输出。</b>4 个头各吐一根 <Dim kind="head" n="32" sub="head_size" /> 维向量,彼此独立。</div>
  }
  if (n === 1) {
    return <div className="note"><b>② 拼接。</b><code>torch.cat(..., dim=-1)</code> 沿特征维首尾相接:32×4 = <Dim kind="emb" n="128" sub="n_embd" />,正好回到主干维度。</div>
  }
  return <div className="note"><b>③ 投影融合。</b>拼接只是"摆在一起",<code>proj</code> 这个 <Dim kind="emb" n="128" />×<Dim kind="emb" n="128" /> 线性层让各头信息<b>互相融合</b>,再交给下一层。进 128、出 128,接口不变。</div>
}

const CAT_LABELS = ['① 4 个头各自输出', '② 拼接 cat → 128', '③ 投影 proj 融合']

function Step3() {
  const [n, setN] = useState(0)
  return (
    <div className={styles.scope}>
      <h2>Step 3 · 拼回去,与"头数怎么选"</h2>
      <p className="lead">
        每个头输出一根 <Dim kind="head" n="32" sub="head_size" /> 维的"看过历史"向量。4 根<b>拼接(concat)</b>正好回到{' '}
        <Dim kind="emb" n="128" sub="n_embd" />,再过一个 <code>proj</code> 线性层<b>融合</b>一下 —— 主干维度自始至终是 128,接口不变。{' '}
        <b>逐步点</b>:
      </p>
      <div className="btn-row">
        {CAT_LABELS.map((label, i) => (
          <button key={label} type="button" className={n === i ? 'btn primary' : 'btn'} onClick={() => setN(i)}>{label}</button>
        ))}
      </div>
      <CatView n={n} />
      <CatNote n={n} />
      <div className="sub-h"><span className="badge">代码</span>拼接 + 投影</div>
      <pre className={styles.pre}>
        {'out = torch.cat([h(x) for h in self.heads], dim=-1)  '}<span className={styles.cmt}># 4×32 → 128,沿特征维拼</span>{'\nreturn self.dropout(self.proj(out))                  '}<span className={styles.cmt}># proj: 128 → 128 融合</span>
      </pre>
      <div className="sub-h"><span className="badge">实战</span>头数怎么选?有没有最佳实践</div>
      <p className="lead" style={{ marginBottom: 6 }}>
        经验法则:<b>别直接挑头数,先把 <Dim kind="head" n="head_size" /> 锚在 64 附近</b>(32–128 都行),再反推 <code>n_head = n_embd / head_size</code>。真实模型几乎都这么干:
      </p>
      <div className={styles.scroll}>
        <table className="truth">
          <tbody>
            <tr><th>模型</th><th>n_embd</th><th>n_head</th><th>head_size</th></tr>
            <tr><td className="lbl">GPT-2 small</td><td>768</td><td>12</td><td className="sum">64</td></tr>
            <tr><td className="lbl">GPT-2 medium</td><td>1024</td><td>16</td><td className="sum">64</td></tr>
            <tr><td className="lbl">GPT-3</td><td>12288</td><td>96</td><td className="sum">128</td></tr>
            <tr><td className="lbl">本章(玩具)</td><td>128</td><td>4</td><td className="sum">32</td></tr>
          </tbody>
        </table>
      </div>
      <Dig title="加头数会爆显存、让训练时间暴涨吗?">
        <b>几乎不会。</b>因为 <code>head_size = n_embd / n_head</code> —— 你不是在"加头",是在<b>切同一块 128 维的蛋糕</b>:
        {' '}4 头×32 = 8 头×16 = 16 头×8,<b>总料始终 128</b>。显存、算力<b>基本持平</b>(不是线性涨,更不是指数),
        {' '}拼接后那个 <code>proj</code> 也永远是 <Dim kind="emb" n="128" />×<Dim kind="emb" n="128" />,与头数无关。<br />
        真正会爆显存/时间的是另几个:<b><Dim kind="block" n="block_size" /></b>(注意力 O(T²),序列翻倍算力四倍)、
        {' '}<b><Dim kind="emb" n="n_embd" /></b>、<b><Dim kind="layer" n="n_layer" /></b>、<b><Dim kind="batch" n="batch_size" /></b>。
        {' '}<code>n_head</code> 不在这张爆炸名单上。
      </Dig>
      <Dig title="那是头越多越好,还是越少越好?">
        都不是,是<b>"固定预算怎么切"的平衡</b>:<br />
        · <b>头多</b> → 每个头更薄(head_size 小),单头表达力弱,但<b>同时并行的视角多</b>;<br />
        · <b>头少</b> → 每个头更厚更强,但一次能看的关系少;<br />
        · 切太碎(如 128 切 64 个头、每头才 2 维)→ 每头薄到啥也表示不了,反而变差。<br />
        所以有个甜点区,把 <Dim kind="head" n="head_size" /> 放在 64 左右最省心;还要能<b>整除</b>(<code>n_embd % n_head == 0</code>),且习惯取 2 的幂(对硬件友好)。
      </Dig>
      <div className="note" style={{ borderStyle: 'solid', background: '#fff' }}>
        🎯 <b>多头一句话:把 <Dim kind="emb" n="128" /> 切成几个子空间,各看一种关系,再拼回 128。</b>{' '}
        接口(进 128、出 128)没变,所以它能像积木一样,叠进后面每一层 <code>Block</code> 里。
      </div>
      <p className="next-hint">下一步:横向收集完信息,每个位置还得自己"消化"一下 —— 这就是 FeedForward。</p>
    </div>
  )
}

function Fbox({ d, t, wide, h }: { d: string; t?: string; wide?: boolean; h: number }) {
  return (
    <div className={wide ? 'ffn-box wide' : 'ffn-box'} style={{ height: h }}>
      <div className="fb-d">{d}</div>
      {t ? <div className="fb-t">{t}</div> : null}
    </div>
  )
}

function Arr() {
  return <span className="op" style={{ fontSize: 18 }}>→</span>
}

function FfnView({ n }: { n: number }) {
  if (n === 0) return <div className="ffn-row"><Fbox d="128" t="输入 x" h={66} /></div>
  if (n === 1) return <div className="ffn-row"><Fbox d="128" t="x" h={66} /><Arr /><Fbox d="512" t="放大 4×" wide h={96} /></div>
  if (n === 2) return <div className="ffn-row"><Fbox d="512" t="ReLU 掐掉负数" wide h={96} /></div>
  return <div className="ffn-row"><Fbox d="512" wide h={96} /><Arr /><Fbox d="128" t="压回 n_embd" h={66} /></div>
}

function FfnNote({ n }: { n: number }) {
  if (n === 0) return <div className="note"><b>① 输入。</b>每个位置一根 <Dim kind="emb" n="128" sub="n_embd" /> 维向量(多头刚加工完的结果)。</div>
  if (n === 1) return <div className="note"><b>② 拓宽。</b>第一个 <code>Linear(128, 4·128)</code> 把维度<b>放大 4 倍</b>到 512 —— 给"思考"腾出更大的草稿纸。</div>
  if (n === 2) return <div className="note"><b>③ 非线性。</b><code>ReLU</code> 把负数清零。<b>这一步最关键</b>:没有它,两个 Linear 叠起来还是一个线性变换,等于白叠。</div>
  return <div className="note"><b>④ 压回。</b>第二个 <code>Linear(4·128, 128)</code> 把维度压回 <Dim kind="emb" n="128" /> —— 方便下一步和原输入做残差相加。</div>
}

const FFN_LABELS = ['① 输入 x · 128', '② 拓宽 →512(×4)', '③ ReLU 掐负', '④ 压回 →128']

function Step4() {
  const [n, setN] = useState(0)
  return (
    <div className={styles.scope}>
      <h2>Step 4 · FeedForward:注意力管"沟通",它管"思考"</h2>
      <p className="lead">
        多头让每个位置<b>横向</b>从别人那收集信息(沟通)。收集完,总得<b>自己消化</b>一下 —— 这就是{' '}
        <Term k="feedforward" name={NAME_FFN} def={DEF_FFN}><code>FeedForward</code></Term>:一个<b>逐位置</b>(position-wise)的小{' '}
        <Term k="mlp" name="MLP · 多层感知机" def="最基础的神经网络:几层全连接(Linear)中间夹非线性(如 ReLU)。FFN 就是一个很小的 MLP。">MLP</Term>,对每个位置的向量<b>单独</b>加工,位置之间互不干涉。{' '}
        结构是<b>放大 → <Term k="relu" name="ReLU · 激活函数" def="非线性激活:ReLU(x)=max(0,x),把负数清零。给网络引入非线性,否则多层 Linear 叠起来还是一个线性变换,层数白加。">ReLU</Term> 非线性 → 压回</b>,逐步点:
      </p>
      <div className="btn-row">
        {FFN_LABELS.map((label, i) => (
          <button key={label} type="button" className={n === i ? 'btn primary' : 'btn'} onClick={() => setN(i)}>{label}</button>
        ))}
      </div>
      <FfnView n={n} />
      <FfnNote n={n} />
      <div className="sub-h"><span className="badge">代码</span>FeedForward</div>
      <pre className={styles.pre}>
        {'nn.Sequential(\n    nn.Linear(n_embd, 4 * n_embd),  '}<span className={styles.cmt}># 128 → 512 放大 4 倍</span>{'\n    nn.ReLU(),                      '}<span className={styles.cmt}># 非线性(关键)</span>{'\n    nn.Linear(4 * n_embd, n_embd),  '}<span className={styles.cmt}># 512 → 128 压回,方便残差相加</span>{'\n)'}
      </pre>
      <Dig title={'"逐位置(position-wise)"到底什么意思?'}>
        同一个 MLP <b>独立</b>作用在每个位置的向量上,位置之间<b>不交换</b>任何信息 —— 8 个位置就是把同一个 FFN 跑 8 遍。
        {' '}换句话说:<b>注意力横向沟通(让 token 互相看),FFN 纵向加工(每个 token 自己想)。</b>
        {' '}一个 Transformer 层就是这"沟通 + 思考"的组合拳。
      </Dig>
      <Dig title="为什么中间放大 4 倍?为什么非要 ReLU?">
        <b>放大 4 倍</b>是惯例(经验值):给非线性变换更大的"草稿纸",表达力更强;算完再压回 n_embd。<br />
        <b>ReLU 不能省</b>:它把负数清零,提供<b>非线性</b>。否则 <code>Linear ∘ Linear</code> 数学上还是<b>一个</b>线性变换,
        {' '}整个 FFN 会退化成一个矩阵,放大 4 倍也白搭。非线性才是 FFN "能思考"的来源。
      </Dig>
      <p className="next-hint">下一步:多头、FFN 这些子层,怎么稳稳叠很多层而不"训崩"?靠残差 + LayerNorm。</p>
    </div>
  )
}

function ResNote({ on }: { on: boolean }) {
  if (on) {
    return (
      <div className="note">
        <b>残差开:</b>每层都是 <code>x = x + 子层(x)</code>,那个 <b>+</b> 是一条<b>梯度高速公路</b>(橙色竖条),梯度能从顶层一路直达底层 —— 所以 <Dim kind="layer" n="4" /> 层、几十层都堆得动。
      </div>
    )
  }
  return (
    <div className="note">
      <b>残差关:</b>没有 <code>+</code> 这条直通路,梯度逐层相乘<b>越传越小</b>,底层几乎收不到信号(图中越往下越淡)—— 这就是<b>梯度消失</b>,深网络根本训不动。
    </div>
  )
}

function Step5() {
  const [on, setOn] = useState(true)
  return (
    <div className={styles.scope}>
      <h2>Step 5 · 残差 + LayerNorm:让深网络训得动</h2>
      <p className="lead">
        多头、<Term k="feedforward" name={NAME_FFN} def={DEF_FFN}>FFN</Term> 都是"子层"。要把它们叠很多层(本章 <Dim kind="layer" n="4" sub="n_layer" /> 层),靠两个稳定器:{' '}
        <Term k="residual" name="残差连接 · residual" def="把子层输出加回输入:x = x + 子层(x)。那个 + 是梯度高速公路,让梯度直达底层、避免梯度消失,深网络才堆得动。出自 2015 ResNet。">残差连接</Term>(子层外包一个 <code>x = x + 子层(x)</code>)和{' '}
        <Term k="layernorm" name="LayerNorm · 层归一化" def="对每个位置那根向量(沿特征维)减均值除标准差,稳住数值分布,深网络才不发散。先 norm 再进子层叫 pre-norm,更好训。">LayerNorm</Term>(进子层前先归一化)。{' '}
        一个 <Term k="block" name="Block · Transformer 层" def="一层 Transformer = 注意力子层 + FFN 子层,各带残差和 LayerNorm。完整 GPT 就是摞 n_layer 个 Block。"><code>Block</code></Term> = <code>x = x + sa(ln1(x))</code> 然后 <code>x = x + ffwd(ln2(x))</code>。{' '}
        <b>把残差开关拨一下</b>,看堆深时的差别:
      </p>
      <div className="btn-row">
        <button type="button" className={on ? 'btn primary' : 'btn'} onClick={() => setOn(true)}>残差:开</button>
        <button type="button" className={on ? 'btn' : 'btn primary'} onClick={() => setOn(false)}>残差:关</button>
      </div>
      <div className="res-stack">
        {RES_LAYERS.map((k) => (
          <div
            key={k}
            className={on ? 'res-layer on' : 'res-layer'}
            style={on ? undefined : { opacity: (0.22 + 0.78 * (k - 1) / (RES_N - 1)).toFixed(2) }}
          >
            <span className="hw" />Block {k}<span className="res-cap">x = x + 子层(x)</span>
          </div>
        ))}
      </div>
      <ResNote on={on} />
      <Dig title="残差到底解决了什么?(梯度高速公路)">
        反向传播时,梯度要从顶层一路乘回底层。层一深,连乘会让梯度<b>越来越小 → <Term k="vanishing" name="梯度消失 · vanishing gradient" def="深网络里梯度逐层相乘越传越小,底层几乎收不到梯度、学不动。残差连接就是为缓解它而生。">梯度消失</Term></b>,底层学不动。
        {' '}残差那个 <code>+</code> 给梯度开了一条<b>直通车</b>:它可以绕过子层直接往下传,不被连乘衰减。
        {' '}于是子层只需学"<b>在原信号上加什么修正 Δ</b>",而不是从头重建整个信号 —— 这就是 2015 年 <b>ResNet</b> 的核心思想,Transformer 全靠它堆深。
      </Dig>
      <Dig title="LayerNorm 在归一化什么?pre-norm vs post-norm">
        <b>LayerNorm</b> 对<b>每个位置那一根向量</b>(沿特征维)做归一化:减均值、除标准差,把数值拉回稳定范围,深网络才不发散。
        {' '}它<b>不跨位置、不跨 batch</b>,所以和序列长度无关。<br />
        代码里是 <code>x + 子层(ln(x))</code> —— <b>先 norm 再进子层</b>,叫 <b>pre-norm</b>;比原始 Transformer 的 post-norm(子层后再 norm)更好训、更稳。
      </Dig>
      <p className="next-hint">下一步:把 <Dim kind="layer" n="4" /> 个这样的 Block 摞起来,配上嵌入和输出头 —— 完整 GPT。</p>
    </div>
  )
}

function LossChart({ prog }: { prog: number }) {
  const full = Math.max(0, Math.min(NL - 1, Math.floor(prog + 1e-9)))
  const pts: [number, number][] = []
  for (let i = 0; i <= full; i++) pts.push([lx(i), ly(LOSS_GPT[i])])
  if (prog > full && full < NL - 1) {
    const f = prog - full
    pts.push([
      lx(full) + (lx(full + 1) - lx(full)) * f,
      ly(LOSS_GPT[full] + (LOSS_GPT[full + 1] - LOSS_GPT[full]) * f),
    ])
  }
  const wy = ly(CH2_FLOOR)
  return (
    <svg viewBox="0 0 780 240">
      <line x1="50" y1={wy} x2="740" y2={wy} stroke="#9a948a" strokeWidth="1.5" strokeDasharray="6 4" />
      <text x="738" y={wy - 6} textAnchor="end" fontSize="11" fill="#9a948a" fontFamily="monospace">第2章单头 ≈ 2.41</text>
      {Y_TICKS.map((v) => (
        <text key={v} x="44" y={ly(v) + 3} textAnchor="end" fontSize="10" fill="#b5afa3" fontFamily="monospace">{v.toFixed(1)}</text>
      ))}
      {LOSS_ITERS.map((it, i) => (
        <text key={it} x={lx(i)} y="233" textAnchor="middle" fontSize="10" fill="#b5afa3" fontFamily="monospace">{it}</text>
      ))}
      {pts.length > 1 ? <polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke="#D97757" strokeWidth="2.5" /> : null}
      {LOSS_GPT.slice(0, full + 1).map((v, i) => (
        <g key={LOSS_ITERS[i]}>
          <circle cx={lx(i)} cy={ly(v)} r="4" fill="#D97757" />
          <text x={lx(i)} y={ly(v) - 9} textAnchor="middle" fontSize="10.5" fill="#8a3d23" fontFamily="monospace">{v.toFixed(2)}</text>
        </g>
      ))}
    </svg>
  )
}

function LossNote({ prog }: { prog: number }) {
  const full = Math.max(0, Math.min(NL - 1, Math.floor(prog + 1e-9)))
  const v = LOSS_GPT[full]
  const it = LOSS_ITERS[full]
  if (full === 0) {
    return <div className="note"><b>step 0</b>:还没训练,loss ≈ <code>4.17</code> = <code>ln(65)</code>,等于"65 个字符里瞎猜"。</div>
  }
  if (v >= CH2_FLOOR) {
    return <div className="note"><b>step {it}</b>:loss ≈ <code>{v.toFixed(2)}</code>,正在逼近第 2 章那道 2.41 的线。</div>
  }
  return <div className="note"><b>step {it}</b>:loss ≈ <code>{v.toFixed(2)}</code> —— <b>已跌破 2.41!</b>多头 + FFN + 堆深带来的提升,采样开始有"词"和对话结构。</div>
}

function Step6() {
  const live = useStepLive()
  const liveRef = useRef(live)
  liveRef.current = live
  const [prog, setProg] = useState(0)
  const [playId, setPlayId] = useState(0)
  const started = useRef(false)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!live) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    if (started.current) return
    started.current = true
    setPlayId(1)
  }, [live])

  useEffect(() => {
    if (playId === 0) return
    const t0 = performance.now()
    const frame = (now: number) => {
      if (!liveRef.current) return
      const t = Math.min(1, Math.max(0, (now - t0) / 2200))
      const ease = 1 - (1 - t) ** 2
      setProg(t < 1 ? ease * (NL - 1) : NL - 1)
      if (t < 1) rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playId])

  function replay() {
    setProg(0)
    setPlayId((n) => n + 1)
  }

  return (
    <div className={styles.scope}>
      <h2>Step 6 · 堆成 GPT,跑出结果(破墙)</h2>
      <p className="lead">
        把 <Dim kind="layer" n="4" sub="n_layer" /> 个 <code>Block</code> 摞起来,前面接嵌入(tok+pos)、后面接 <code>ln_f</code> + <code>lm_head</code> —— 这就是完整 GPT 的 forward:
      </p>
      <div className="flow">
        <div className="fc">idx<small>输入字符</small></div>
        <div className="fa">→</div>
        <div className="fc">tok_emb + pos_emb<small>内容 + 位置</small></div>
        <div className="fa">→</div>
        <div className="fc">4 × Block<small>沟通+思考,带残差/norm</small></div>
        <div className="fa">→</div>
        <div className="fc">ln_f<small>末层归一化</small></div>
        <div className="fa">→</div>
        <div className="fc">lm_head<small>映射回词表</small></div>
        <div className="fa">→</div>
        <div className="fc">logits<small>下一字符打分</small></div>
      </div>
      <div className="sub-h"><span className="badge">跑起来</span>loss 跌破第 2 章的 2.41</div>
      <p className="lead" style={{ marginBottom: 6 }}>
        <code>03_transformer.py</code> 每 500 步打印一次 loss。下面的曲线<b>自动播放</b>训练过程,看它<b>穿过</b>第 2 章单头注意力卡住的 <b>2.41</b> 虚线,一路下探到 ~1.57。
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={replay}>▶ 重播动画</button>
      </div>
      <div className="loss-wrap"><LossChart prog={prog} /></div>
      <div className="loss-leg">
        <span><i style={{ borderTopStyle: 'solid', borderColor: 'var(--accent)' }} />完整 Transformer(本章)val loss</span>
        <span><i style={{ borderTopStyle: 'dashed', borderColor: '#9a948a' }} />第 2 章单头 ≈ 2.41</span>
      </div>
      <LossNote prog={prog} />
      <p className="lead" style={{ margin: '6px 0 14px', fontSize: 12 }}>(示意曲线:数量级与趋势对得上 <code>03_transformer.py</code> 的实际打印,非逐位精确复现。)</p>
      <div className="note" style={{ borderStyle: 'solid', background: '#fff' }}>
        🎯 <b>结果:破墙。</b>多头(看多种关系)+ FFN(逐位置思考)+ 残差/LayerNorm(堆得动 4 层),{' '}
        <code>val loss</code> 跌破第 2 章的 <code>2.41</code>,一路下探到 <code>~1.57</code> —— 采样开始有"词"和对话结构,不再是纯字母汤。{' '}
        这就是 nanoGPT 的内核。
      </div>
      <p className="next-hint">点右下角「完成 🎉」收下整章 —— 你已经从零搭出一个 GPT。</p>
    </div>
  )
}

export function Transformer() {
  const chapter = findChapter('transformer')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />, <Step6 />]
  return (
    <ChapterShell
      slug="transformer"
      title="完整 Transformer:四块新积木,拼出 GPT"
      subtitle={
        <>
          配套 <code>03_transformer.py</code>。第 2 章是<b>单头</b>注意力。这一章加四样东西凑成完整 GPT:{' '}
          <b>多头</b>(同时看多种关系)、<b>FeedForward</b>(逐位置思考)、<b>残差 + LayerNorm</b>(让深网络训得动),{' '}
          再把它们摞成多层 —— 六步走完,val loss 从 2.41 掉到 ~1.57。
        </>
      }
      hp={
        <HpBar label="超参速查">
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>128</b> <i>主干维度 C</i></HpChip>
          <HpChip color="#1f8a8a" bg="#DCEFEF">n_head <b>4</b> <i>头数</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">head_size <b>32</b> <i>每头维度</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">block_size <b>64</b> <i>位置数 T</i></HpChip>
          <HpChip color="#9a7b2f" bg="#F4ECD6">n_layer <b>4</b> <i>层数</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">vocab_size <b>65</b> <i>字符表</i></HpChip>
          <span className="hp-note">⚠ <code style={{ fontFamily: 'var(--mono)' }}>head_size = n_embd / n_head = 128/4 = 32</code></span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 完整 Transformer · 通关!</div>
          <div className="cs">多头 · FFN · 残差 · LayerNorm,你已搭出 GPT 内核</div>
        </>
      }
    />
  )
}
