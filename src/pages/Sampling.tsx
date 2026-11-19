// 旧页 goto 进入第 4 步会清空已采 token，进入第 5 步会把生成进度拨回 0（收尾说明不还原）。离开再回来，这里都保留。
import { useState } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Sampling.module.css'

const CONT_TOKS = [' mat', ' floor', ' sofa', ' roof', ' bed', ' couch', ' grass', ' xq7z']
const CONT_LOGITS = [3.0, 2.0, 1.6, 0.9, 0.5, 0.2, -0.4, -2.0]

const S1 = [
  {
    name: '续写 · "The cat sat on the"',
    kind: 'cont' as const,
    toks: CONT_TOKS,
    logits: CONT_LOGITS,
  },
  {
    name: '问句 · "Q: 2+2=? A:"',
    kind: 'qa' as const,
    toks: [' I', ' The', ' Q', ' What', '\\n', ' 2', ' Yes', ' 4'],
    logits: [2.4, 2.0, 1.7, 1.3, 1.0, 0.6, 0.2, 0.0],
  },
]

const S4_PROMPT = 'The cat'
const S4_STEPS = [
  { pick: ' sat', toks: [' sat', ' is', ' ran', ' sleeps', ' xq'], logits: [2.6, 1.7, 1.2, 0.6, -1.5] },
  { pick: ' on', toks: [' on', ' by', ' near', ' under', ' qz'], logits: [2.4, 1.6, 1.1, 0.7, -1.6] },
  { pick: ' the', toks: [' the', ' a', ' my', ' that', ' zx'], logits: [2.8, 1.9, 0.9, 0.4, -1.7] },
  { pick: ' warm', toks: [' warm', ' old', ' soft', ' red', ' vq'], logits: [2.2, 1.8, 1.3, 0.8, -1.4] },
  { pick: ' mat', toks: [' mat', ' rug', ' floor', ' bed', ' kx'], logits: [2.5, 1.6, 1.2, 0.7, -1.5] },
]
const S4_DONE = S4_PROMPT + S4_STEPS.map((s) => s.pick).join('')

const S5_PROMPT_LEN = 2
const S5_MAX = 6

function showTok(t: string) {
  return t.replace(/ /g, '␣')
}

function softmax(logits: number[], temp: number) {
  const z = logits.map((l) => l / temp)
  const m = Math.max(...z)
  const e = z.map((v) => Math.exp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function sampleDist(logits: number[], temp: number, k: number) {
  const idx = logits.map((_, i) => i).sort((a, b) => logits[b] - logits[a])
  const keep = new Set(idx.slice(0, k))
  const masked = logits.map((l, i) => (keep.has(i) ? l : Number.NEGATIVE_INFINITY))
  return { probs: softmax(masked, temp), kept: logits.map((_, i) => keep.has(i)) }
}

function argmax(probs: number[]) {
  return probs.indexOf(Math.max(...probs))
}

function Dim({ kind, n, sub }: { kind: string; n: string; sub: string }) {
  return <span className={`d d-${kind}`}>{n}<i>{sub}</i></span>
}

function Dist({ toks, probs, kept, chosen }: { toks: string[]; probs: number[]; kept?: boolean[]; chosen: number }) {
  const flags = kept ?? toks.map(() => true)
  const maxP = Math.max(...probs, 1e-6)
  return (
    <div className="dist">
      {toks.map((tk, i) => {
        const cut = !flags[i]
        const cls = 'brow' + (i === chosen ? ' chosen' : '') + (cut ? ' cut' : '')
        const pct = cut ? '0' : `${(probs[i] * 100).toFixed(1)}%`
        return (
          <div key={`${i}-${tk}`} className={cls}>
            <span className="tok">{showTok(tk)}</span>
            <div className="track"><div className="fill" style={{ width: `${(probs[i] / maxP) * 100}%` }} /></div>
            <span className="pct">{pct}</span>
          </div>
        )
      })}
    </div>
  )
}

function TempNote({ t, probs }: { t: number; probs: number[] }) {
  const top = (Math.max(...probs) * 100).toFixed(0)
  const label = t.toFixed(2)
  if (t <= 0.4) {
    return <>🧊 <b>低温({label})</b>:分布很<b>尖</b>,冠军占 {top}%,几乎只会挑它 → 稳但容易<b>复读</b>。</>
  }
  if (t <= 1.1) {
    return <>🌡️ <b>接近默认({label})</b>:冠军占 {top}%,留了点变化空间 —— 真实默认 <b>0.9</b>。</>
  }
  return <>🔥 <b>高温({label})</b>:分布被<b>摊平</b>,冠军只剩 {top}%,连 "␣xq7z" 这种垃圾都有机会 → 易<b>胡说</b>。</>
}

function TopkNote({ k, cut }: { k: number; cut: number }) {
  if (k === 1) return <>✂️ <b>k=1</b>:只剩冠军,等于<b>贪心(argmax)</b> —— 结果唯一、无随机。</>
  if (k >= 8) return <><b>k=8</b>:示意词表全留,等于<b>没裁剪</b>;真实里这相当于在 50257 个真 token 里一个不删。</>
  return <>✂️ <b>k={k}</b>:切掉了尾部 <b>{cut}</b> 个低概率 token(置 0),剩下的重新归一化 —— 概率质量集中到靠谱候选上。真实默认 <b>50</b>。</>
}

function kvAt(step: number) {
  const rows: { label: string; total: number; last: boolean }[] = []
  let cntA = 0
  let cntB = 0
  for (let s = 0; s <= step; s++) {
    const total = S5_PROMPT_LEN + s
    rows.push({ label: s === 0 ? 'prompt' : `+${s}`, total, last: s === step })
    cntA += total
    cntB += s === 0 ? total : 1
  }
  return { rows, cntA, cntB, ratio: (cntA / cntB).toFixed(1) }
}

function Step1() {
  const [sel, setSel] = useState(0)
  const p = S1[sel]
  const probs = softmax(p.logits, 1)
  return (
    <div className={styles.scope}>
      <h2>① base 模型只会"续写":它永远在猜下一个 token</h2>
      <p className="lead">给一段开头(<Term k="prompt" name="prompt · 提示词" def="喂给模型的开头文本。模型不会「理解任务」,只会顺着它往下接最可能的 token。">prompt</Term>), 模型把它过一遍前向,在<b>最后一个位置</b>吐出对下一个 token 的一整排打分,再 <Term k="softmax" name="softmax" def="把一排打分(logits)变成和为 1 的概率分布,打分越高概率越大。">softmax</Term> 成概率。 <b>它不答题、只续写。</b>换上一个"问句"开头,你会看到正确答案那个 token <b>并不在高处</b> —— 因为基座模型从没学过"回答"。</p>
      <div className="btn-row">
        {S1.map((item, i) => (
          <button key={item.kind} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => setSel(i)}>{item.name}</button>
        ))}
      </div>
      <div className="prompt-box">
        {p.kind === 'cont' ? (
          <>
            <span className="pq">The cat sat on the </span>
            <span className="pblank">?</span>
            <span className="pcaret" />
          </>
        ) : (
          <>
            <span className="pq">Q: 2+2=? A:</span>
            <span className="pcaret" />
          </>
        )}
      </div>
      <div className="sub-h"><span className="badge">下一个 token</span>概率分布(只截了示意词表的前 8 名)</div>
      <Dist toks={p.toks} probs={probs} chosen={argmax(probs)} />
      <div className="note">
        {p.kind === 'qa' ? (
          <><b>⚠️ </b>注意:正确答案 <b>"␣4"</b> 排在<b>最低</b>!base 没在"算题",只在续一段"像问答文本"的东西。<b>会答题是 Phase 2 的 SFT 才教的。</b></>
        ) : (
          <>最高分是 <b>"␣mat"</b> —— 模型在续一句通顺的话,这正是 base 该干的:猜下一个 token。</>
        )}
      </div>
      <Dig title={'"它不会答题" 到底什么意思?那 ChatGPT 怎么会答?'}>
        base 模型只学过"海量文本里,这个词后面通常接什么"。所以给它 <code>Q: 2+2=? A:</code>, 它会接着续一段<b>像那种文本</b>的东西(再问一句、换行、复述题目…),而不是真去算"4"。 "会顺着指令回答问题"是 <Term k="sft" name="SFT · 指令微调" def="Supervised Fine-Tuning:在基座模型上,用「指令 → 理想回答」成对数据继续训练,教会它听话回答。是 Phase 2 的内容。">SFT</Term> 在 <b>Phase 2</b> 用「指令→回答」数据另外教出来的。本页(Phase 1)的模型还停在"只会续写"。
      </Dig>
      <p className="next-hint">同一排 logits,挑字的方式不只一种。先拨第一个旋钮:<b>temperature</b> —— 它决定模型有多"敢"。</p>
    </div>
  )
}

function Step2() {
  const [temp, setTemp] = useState(0.9)
  const probs = softmax(CONT_LOGITS, temp)
  return (
    <div className={styles.scope}>
      <h2>② temperature:一个旋钮,把分布捏尖或摊平</h2>
      <p className="lead">采样前先做一步 <code>logits / temperature</code> 再 softmax。<b>温度低</b> → 分布变<b>尖</b>,几乎只挑最高分那个(保守、稳,但容易复读); <b>温度高</b> → 分布变<b>平</b>,小众 token 也有机会(发散、有创意,但容易胡说)。真实默认 <Dim kind="temp" n="0.9" sub="temp" />。拖滑块实时看分布形状变化(用 STEP 1 的续写示意分布)。</p>
      <div className="sliderbox">
        <div className="srow">
          <label>temperature</label>
          <input type="range" min={0.1} max={2} step={0.05} value={temp} onChange={(e) => setTemp(Number.parseFloat(e.target.value))} />
          <span className="sval">{temp.toFixed(2)}</span>
        </div>
        <div className="ticks"><span>0.1 极保守</span><span>0.9 默认</span><span>2.0 极发散</span></div>
      </div>
      <Dist toks={CONT_TOKS} probs={probs} chosen={argmax(probs)} />
      <div className="note"><TempNote t={temp} probs={probs} /></div>
      <Dig title={'为什么除以温度就能改变"尖/平"?'}>
        softmax 比的是 logits 之间的<b>差距</b>。除以一个小温度(如 0.3)会把所有差距<b>放大</b>,最高分一骑绝尘 → 分布更尖; 除以一个大温度(如 1.8)把差距<b>压扁</b>,大家拉近 → 分布更平。温度 = 1 就是原样。 代码里就是 <code>sample_next</code> 里的一行 <code>logits = logits / temperature</code>。
      </Dig>
      <p className="next-hint">温度只是把整排概率重新塑形 —— 长长的"垃圾尾巴"还在。下一步用 <b>top_k</b> 直接把尾巴一刀切掉。</p>
    </div>
  )
}

function Step3() {
  const [k, setK] = useState(4)
  const [temp, setTemp] = useState(0.9)
  const { probs, kept } = sampleDist(CONT_LOGITS, temp, k)
  const cut = kept.filter((x) => !x).length
  return (
    <div className={styles.scope}>
      <h2>③ top_k:只在概率最高的 k 个里采样,尾巴一刀切掉</h2>
      <p className="lead">就算温度不高,词表里仍有一长串<b>低概率 token</b>,偶尔被抽中就是一处"胡言"。 <Term k="top-k" name="top_k 采样" def="每一步只保留概率最高的 k 个 token,其余直接置为 0(−∞),再归一化采样。把长尾的低概率 token 一刀切掉。">top_k</Term> 只保留<b>最高的 k 个</b>,其余打分设成 −∞(等于概率 0),再归一化采样。 真实默认 <Dim kind="topk" n="50" sub="top_k" />(在 50257 个真 token 里留 50 个)。这里示意词表只有 8 个,拖 k 看尾巴被切、概率质量重新分配。</p>
      <div className="sliderbox">
        <div className="srow">
          <label>top_k</label>
          <input type="range" min={1} max={8} step={1} value={k} onChange={(e) => setK(Number.parseInt(e.target.value, 10))} />
          <span className="sval">{k}</span>
        </div>
        <div className="ticks"><span>1 只留冠军(=贪心)</span><span>越大留得越多</span><span>8 全留(=不裁剪)</span></div>
      </div>
      <div className="sliderbox" style={{ marginTop: 0 }}>
        <div className="srow">
          <label>temperature</label>
          <input type="range" min={0.1} max={2} step={0.05} value={temp} onChange={(e) => setTemp(Number.parseFloat(e.target.value))} />
          <span className="sval">{temp.toFixed(2)}</span>
        </div>
        <div className="ticks"><span>先裁 top_k,再按这个温度采样</span></div>
      </div>
      <Dist toks={CONT_TOKS} probs={probs} kept={kept} chosen={argmax(probs)} />
      <div className="note"><TopkNote k={k} cut={cut} /></div>
      <Dig title={'top_k=1 和"直接取最高分"是一回事吗?为什么不总用它?'}>
        是的,<code>top_k=1</code> 等于每步都取最高分(<Term k="greedy" name="贪心解码 · greedy / argmax" def="每步直接取概率最高的那个 token(argmax),不掷骰子。结果唯一可复现,但容易陷入重复死循环、读起来呆板。">贪心 argmax</Term>)。 问题是它<b>没有多样性</b>:同一个开头永远生成同一句,还容易陷入"复读机"死循环。所以实践里留一小撮候选(k=50)再 <Term k="sampling" name="按概率采样 · multinomial" def="按概率分布随机抽一个 token,概率大的更容易被抽中,但不是必中。代码里是 torch.multinomial(probs, 1)。">随机采样</Term>, 兼顾"不胡说"和"有变化"。
      </Dig>
      <p className="next-hint">现在你会"挑一个 token"了。可一句话有几十个 token —— 怎么从一个变成一串?靠<b>自回归</b>循环。</p>
    </div>
  )
}

function Step4() {
  const [n, setN] = useState(0)
  const [pop, setPop] = useState(false)
  const done = n >= S4_STEPS.length
  const gen = S4_STEPS.slice(0, n).map((s) => s.pick).join('')
  const cur = n > 0 ? S4_STEPS[n - 1] : null
  const probs = cur ? softmax(cur.logits, 0.9) : null
  return (
    <div className={styles.scope}>
      <h2>④ 自回归:采一个 → 接回末尾 → 再采下一个</h2>
      <p className="lead">模型一次只吐<b>一个</b> token。把它<b>拼回输入末尾</b>,整条序列再喂一遍、再采下一个,如此滚动 —— 这就是 <Term k="autoregressive" name="自回归 · autoregressive" def="把自己刚生成的 token 接回输入,再预测下一个,如此循环。GPT 生成文本就是这样一个 token 一个 token 滚出来的。">自回归</Term>生成。 点「采下一个 token」,看序列一格一格长出来(灰=prompt,橙=生成;用预设示意分布,每步顺带亮一下被采中的候选)。</p>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={done} onClick={() => { if (done) return; setN(n + 1); setPop(true) }}>采下一个 token →</button>
        <button type="button" className="btn ghost" onClick={() => { setN(0); setPop(false) }}>↺ 重来</button>
        <span className="hp-note">已生成 <b>{n}</b> / {S4_STEPS.length} 个 token</span>
      </div>
      <div className="sub-h"><span className="badge">序列</span>当前文本(末尾闪烁处 = 下一个要采的位置)</div>
      <div className="ribbon">
        {S4_PROMPT.split('').map((c, i) => <div key={`p${i}`} className="rchar prompt">{showTok(c)}</div>)}
        {gen.split('').map((c, i) => <div key={`g${i}`} className={pop && i === gen.length - 1 ? 'rchar gen pop' : 'rchar gen'}>{showTok(c)}</div>)}
        <div className="rcaret" />
      </div>
      <div className="sub-h"><span className="badge">这一步</span>末位 token 的 logits → softmax → 采样(示意)</div>
      {cur && probs ? <Dist toks={cur.toks} probs={probs} chosen={0} /> : <div className="dist" />}
      <div className="note">
        {n === 0 ? '点「采下一个 token」开始 ↑' : null}
        {cur && n < S4_STEPS.length ? <>第 {n} 步:对当前序列前向 → 采到 <b>"{showTok(cur.pick)}"</b>,接回末尾 ↓</> : null}
        {n >= S4_STEPS.length ? <>✅ 生成完毕:"<b>{S4_DONE}</b>"。每个字都是"采一个 → 接回去 → 再采"滚出来的 —— 这就是<b>自回归</b>。「↺ 重来」再看一遍。</> : null}
      </div>
      <Dig title="什么时候停?会一直生成下去吗?">
        base 模型不会自己"说完了"。<code>05_sample.py</code> 用 <code>--max_new_tokens</code>(默认 200)<b>定额</b>生成多少个就停。 每步还会把上下文截到最近 <Dim kind="block" n="1024" sub="block_size" /> 个 token(<code>idx[:, -block_size:]</code>), 因为模型一次最多看这么长。(SFT 之后的对话模型会专门学一个"结束符"来自己收尾,那是 Phase 2 的事。)
      </Dig>
      <p className="next-hint">注意:每采一个新字,上面都把<b>整条</b>序列重过一遍 —— 越生成越长、越来越慢。最后一步:<b>KV-cache</b> 把这份浪费省掉。</p>
    </div>
  )
}

function KvGrid({ rows, mode }: { rows: { label: string; total: number; last: boolean }[]; mode: 'slow' | 'cache' }) {
  return (
    <div className="kvgrid">
      {rows.map((row) => (
        <div key={row.label} className="kvr">
          <span className="stp">{row.label}</span>
          {Array.from({ length: row.total }, (_, c) => {
            const hot = mode === 'slow' ? row.last : c === row.total - 1 && row.last
            const cls = mode === 'slow'
              ? (hot ? 'kvcell recompute' : 'kvcell cached')
              : (hot ? 'kvcell newtok' : 'kvcell cached')
            return <div key={c} className={cls} />
          })}
        </div>
      ))}
    </div>
  )
}

function Step5() {
  const [step, setStep] = useState(0)
  const { rows, cntA, cntB, ratio } = kvAt(step)
  const done = step >= S5_MAX
  return (
    <div className={styles.scope}>
      <h2>⑤ KV-cache:别把过去重算一遍(<code>05_sample.py</code> 里加的推理优化)</h2>
      <p className="lead">注意力要用到序列里每个位置的 <Term k="kv-cache" name="K / V · key 与 value" def="注意力里每个 token 算出的 key 和 value 向量。新 token 要去和过去所有 token 的 K/V 做注意力。把过去的 K/V 缓存下来就不用重算。">K/V</Term>。 <b>无 cache</b>:每生成一个 token,都把<b>过去所有位置</b>的 K/V <b>从头重算一遍</b>(下图不断变大的橙色三角 = 纯浪费); <b>有 cache</b>:把过去的 K/V <b>缓存</b>下来,每步<b>只算新 token 那一列</b>(绿)。点「下一步」并排看。</p>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={done} onClick={() => { if (!done) setStep(step + 1) }}>▶ 生成下一个 token</button>
        <button type="button" className="btn ghost" onClick={() => setStep(0)}>↺ 重来</button>
        <span className="hp-note">已生成 <b>{step}</b> 个 · 计算量比 <b>{cntA} : {cntB}</b> ≈ <b>{ratio}×</b></span>
      </div>
      <div className="kv-cols">
        <div className="kvcol slow">
          <div className="kvh">无 cache · 每步重算整段</div>
          <div className="kvsub">
            {step === 0 ? 'prompt 先算一遍(预填充)。' : <>第 {step} 个新 token:过去 {S5_PROMPT_LEN + step - 1} 列<b>又全重算</b>(橙)。</>}
          </div>
          <KvGrid rows={rows} mode="slow" />
          <div className="kvcount"><span>K/V 累计计算量</span><span><b>{cntA}</b> <small>列</small></span></div>
        </div>
        <div className="kvcol fast">
          <div className="kvh">有 cache · 每步只算新列</div>
          <div className="kvsub">
            {step === 0 ? 'prompt 预填充一次,K/V 存进缓存。' : <>第 {step} 个新 token:过去全部<b>命中缓存</b>(浅绿),只算<b>新 1 列</b>(深绿)。</>}
          </div>
          <KvGrid rows={rows} mode="cache" />
          <div className="kvcount"><span>K/V 累计计算量</span><span><b>{cntB}</b> <small>列</small></span></div>
        </div>
      </div>
      <div className="note">
        {done ? (
          <>左边累计是 <b>三角形(平方级)</b>,右边是<b>一条线(线性)</b> —— 序列越长,差距越大。但<b>墙钟</b>没省这么多:实测约 <b>2.5–3.1×</b>(注意力只是前向的一部分,见下方折叠)。</>
        ) : (
          <>生成 <b>n</b> 个 token:无 cache 要算 <code>1+2+…+n</code> 列(随长度<b>平方级</b>膨胀);有 cache 只算 <code>n</code> 列(<b>线性</b>)。点上面逐步对比。</>
        )}
      </div>
      <Dig title={'那"计算量省了一大截",为什么实测只快 2.5–3.1 倍,不是好几十倍?'}>
        上图省掉的是<b>注意力里重复的 K/V 计算</b>,但一次前向还有很多别的开销(MLP、LayerNorm、采样、框架调度),这些没省。 所以墙钟加速<b>没有列数比那么夸张</b>。<code>05_sample.py</code> 在 Mac MPS 上实测:<b>有 cache 比无 cache 快约 2.5–3.1×</b> (例如某次 <code>7.4 → 23.1 tok/s ≈ 3.1×</code>,另一次 <code>17.5 → 48 tok/s ≈ 2.7×</code>;序列越长、省得越多)。 代码里就是 <code>generate_nocache</code>(每步重喂整段)对 <code>generate_cached</code>(prompt 预填充一次,之后每步只喂上一个新 token + 历史 KV)。
      </Dig>
      <Dig title="缓存了过去,新 token 还看得到全部历史吗?会不会偷看未来?">
        看得到全部历史:新 token 的 query 去和"缓存的过去 K/V + 自己这一列"做注意力,信息一点不少。 也不会偷看未来 —— 解码时<b>每步只来 1 个新 token</b>,它后面根本还没生成,自然无未来可看; 所以 <code>05_sample.py</code> 里这步连因果掩码都省了(<code>is_causal = q.size(2) &gt; 1</code>,只有一次喂多个 token 的 prompt 预填充才需要掩码)。
      </Dig>
      <p className="next-hint">Phase 1 到此收口:你已经能让这台机器"跑起来"续写文字了。但它<b>只会续写、不会答题</b> —— 教它"听话回答",是 Phase 2 的 SFT。点右下角「完成 🎉」。</p>
    </div>
  )
}

export function Sampling() {
  const chapter = findChapter('sampling')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="sampling"
      title="跑起来:从 logits 到文字(采样与 KV-cache)"
      subtitle={
        <>
          本页对应 <code>phase1-124m/05_sample.py</code>。模型每一步只做一件事:对<b>下一个 token</b> 打分(<Term k="logits" name="logits · 原始打分" def="模型最后一层对词表里每个 token 输出的一排实数打分,还没归一化成概率。越大越倾向选它。">logits</Term>)。 这一页把"打分 → 怎么挑一个字 → 一个字接一个字滚成句子 → 怎么加速"五步拆开,每步亲手拨一个旋钮。 演示用一个<b>小示意词表</b>(标着「示意」),真实里词表是 <Dim kind="vocab" n="50304" sub="vocab" /> 个 token —— 其中 <b>50257</b> 个是真 token,另 47 个是为对齐 GPU 补的空位,采样时会被屏蔽掉,所以每步实际只在 <b>50257</b> 个里挑。
        </>
      }
      hp={
        <HpBar label="采样旋钮">
          <HpChip color="#b8512f" bg="#F7E6DE">temperature <b>0.9</b> <i>默认</i></HpChip>
          <HpChip color="#168f8f" bg="#D9EDED">top_k <b>50</b> <i>默认</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">vocab <b>50304</b> <i>词表大小</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">block_size <b>1024</b> <i>能回看多远</i></HpChip>
          <span className="hp-note">演示词表只 <b>8</b> 个是<b>示意</b> · 真实每步在 50257 个真 token 里挑 · 配套 <code style={{ fontFamily: 'var(--mono)' }}>05_sample.py</code></span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 跑起来 · Phase 1 收口!</div>
          <div className="cs">logits → 温度 → top_k → 自回归 → KV-cache,你已让模型续写出文字</div>
        </>
      }
    />
  )
}
