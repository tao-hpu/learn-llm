// 旧页切换步骤不重置文字、合并、切分、滑块和例句。
import { Fragment, useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import { bpeData as D } from './bpeData'
import styles from './Bpe.module.css'

const en = (v: number) => v.toLocaleString('en-US')
const te = new TextEncoder()
const BYTE_BG = ['', 'var(--e2)', 'var(--e1)', 'var(--accent)', 'var(--e3)']
const PRESETS = ['Hello, world!', '光合作用把阳光转化为化学能。', 'LLM 从零手写 🙂 ok']
const PRESET_LABELS = ['英文', '中文', '混排 + emoji']
const TOY = 'the cat sat on the mat. the cat ate the rat. that fat cat sat there.'
const SPLIT_TXT = "The dog's bone. The dog! Is it the dog? It costs 1,250 dollars."
const RE_GPT2 = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu
const RE_SPACE = / ?\S+|\s+/g
const BYTE_RE = /^(<[0-9a-f]{2}>)+$/
const V16 = D.sweep[D.sweep.length - 1]
const V16S = D.sweep_space[D.sweep_space.length - 1]
const BPT_GAP = (V16S[2] - V16[2]).toFixed(3)
const BPT_GAP_PCT = ((V16S[2] / V16[2] - 1) * 100).toFixed(1)
const MIXED_PCT = (D.mixed_space / D.n_merges * 100).toFixed(1)
const SENT_KEYS = ['en', 'code', 'num', 'zh'] as const
const SENT_LABELS = ['英文句子', '代码', '数字', '中文']
const BANDS = [
  { items: D.first, label: '最先合并的 40 个', note: '最先合并的:常见字母组合和高频虚词,比如 ␣t、he、␣the、ing。' },
  { items: D.band4000, label: '第 4,000 次附近', note: '第 4,000 次附近:完整的常用词开始出现,也有 hel、acher 这类词的片段。' },
  { items: D.last, label: '最后合并的 40 个', note: '最后合并的:出现次数刚好排进前 16,128 的词,不少是专业词。' },
  { items: D.longest, label: '最长的 16 个', note: '最长的:训练语料里反复出现的长词整个成了一个 token。' },
]

const SW = 620
const SH = 262
const SL = 48
const SR = 18
const ST = 30
const SB = 36
const sx = (v: number) => SL + (Math.log2(v) - 8) / (Math.log2(65536) - 8) * (SW - SL - SR)
const sy = (v: number) => ST + (1 - (v - 1) / 4) * (SH - ST - SB)

interface Merge {
  a: string
  b: string
  t: string
  n: number
}
interface Toy {
  words: string[][]
  merges: Merge[]
  last: string | null
}

function toyInit(): Toy {
  return {
    words: (TOY.match(/ ?\S+/g) || []).map((w) => Array.from(w)),
    merges: [],
    last: null,
  }
}

function pairsOf(words: string[][]) {
  const cnt = new Map<string, number>()
  words.forEach((w) => {
    for (let i = 0; i + 1 < w.length; i++) {
      const k = w[i] + '\u0000' + w[i + 1]
      cnt.set(k, (cnt.get(k) || 0) + 1)
    }
  })
  return [...cnt.entries()].map(([k, n]) => {
    const [a, b] = k.split('\u0000')
    return { a, b, n }
  })
}

function mergeOnce(state: Toy): Toy {
  const ps = pairsOf(state.words)
  if (!ps.length) return state
  let best = ps[0]
  ps.forEach((p) => { if (p.n > best.n) best = p })
  if (best.n < 2) return state
  const nt = best.a + best.b
  const words = state.words.map((w) => {
    const o: string[] = []
    for (let i = 0; i < w.length; i++) {
      if (i + 1 < w.length && w[i] === best.a && w[i + 1] === best.b) {
        o.push(nt)
        i++
      } else o.push(w[i])
    }
    return o
  })
  return { words, merges: [...state.merges, { a: best.a, b: best.b, t: nt, n: best.n }], last: nt }
}

function mergeN(state: Toy, n: number) {
  let cur = state
  for (let i = 0; i < n; i++) {
    const next = mergeOnce(cur)
    if (next === cur) break
    cur = next
  }
  return cur
}

function kLabel(k: number | 'gpt2') {
  if (k === 'gpt2') return 'GPT-2'
  if (k === D.n_merges) return `全部 ${en(k)} 次`
  return `合并 ${en(k)} 次`
}

function Shown({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  let plain = ''
  const pushPlain = () => {
    if (!plain) return
    nodes.push(plain)
    plain = ''
  }
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') {
      pushPlain()
      nodes.push(<span key={nodes.length} className="sp">{ch === ' ' ? '␣' : '↵'}</span>)
    } else plain += ch
  }
  pushPlain()
  return <>{nodes}</>
}

function Token({ text, kind }: { text: string; kind: string }) {
  return <span className={`tk ${kind}`}><Shown text={text} /></span>
}

function Step1() {
  const [text, setText] = useState(PRESETS[0])
  const [preset, setPreset] = useState(0)
  const chars = Array.from(text)
  let bytes = 0
  const cards = chars.map((c, i) => {
    const raw = Array.from(te.encode(c))
    bytes += raw.length
    return (
      <div key={i} className="ch">
        <div className="cg">{c === ' ' ? <span className="sp">␣</span> : c}</div>
        <div className="cb">
          {raw.map((x, j) => <span key={j} style={{ background: BYTE_BG[raw.length] }}>{x.toString(16).padStart(2, '0')}</span>)}
        </div>
      </div>
    )
  })
  return (
    <div className={styles.scope}>
      <h2>① 任何文本先变成字节</h2>
      <p className="lead">
        第 1 章的字符级词表只认莎士比亚里出现过的 65 个字符,换一段中文就编不出来。{' '}
        字节级的做法是先把文本按 <b>UTF-8</b> 编成字节:英文字母 1 个字节,中文 3 个,emoji 4 个。{' '}
        一个字节只有 256 种取值,所以初始词表固定是 <b>256</b>,任何文本都编得出来。改下面的文字试试:
      </p>
      <div className="btn-row small">
        {PRESET_LABELS.map((label, i) => (
          <button key={label} type="button" className={preset === i ? 'btn primary' : 'btn'} onClick={() => { setPreset(i); setText(PRESETS[i]) }}>{label}</button>
        ))}
      </div>
      <div className="lab">
        <input className="txt-in" value={text} onChange={(e) => { setText(e.target.value); setPreset(-1) }} />
        <div className="chars">{cards.length ? cards : <span style={{ color: 'var(--ink2)', fontSize: 13 }}>(空)</span>}</div>
        <div className="legend">
          <span><i style={{ background: 'var(--e2)' }} />1 字节(ASCII)</span>
          <span><i style={{ background: 'var(--e1)' }} />2 字节</span>
          <span><i style={{ background: 'var(--accent)' }} />3 字节(常用汉字)</span>
          <span><i style={{ background: 'var(--e3)' }} />4 字节(emoji 等)</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{en(chars.length)}</div><div className="drl">字符数</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{en(bytes)}</div><div className="drl">字节数 = 初始 token 数</div></div>
          <div className="dr"><div className="drv">{bytes ? en(Math.floor(1024 / bytes)) : '\u2013'}</div><div className="drl">1024 上下文能装几个这样的句子</div></div>
        </div>
      </div>
      <div className="note">初始词表 = 256 个字节,任何 UTF-8 文本都能编码,不会出现"未知字符"。代价是序列长:英文一个 token 只代表 1 个字节。</div>
      <div className="codepath">↳ 代码:<b>16_bpe.py</b> 的 <code>train_bpe</code> 开头 <code>list(w.encode("utf-8"))</code></div>
      <Dig title="为什么不拿 Unicode 字符当初始词表?">
        Unicode 有十几万个码位,全放进基础词表太大;只放训练语料里见过的,又会遇到没见过的字符。{' '}
        GPT-2 论文 §2.2 的说法:字节级只需要 <b>256</b> 个基础符号,就能表示任意字符串,不需要未知符号。{' '}
        字节的代价是中文、日文这类每字 3 个字节的文字,初始序列是英文的 3 倍长,要靠合并压回来(第 5 步看训出来的效果)。
      </Dig>
      <Dig title="一个 token 只是半个汉字,解码时怎么办?">
        解码时先把每个 token 查回它代表的字节,整串拼起来,再按 UTF-8 解开。单独看一个 token 可能是半个汉字(比如 <code>{'<e5><85>'}</code>),{' '}
        拼上后一个就完整了。第 5 章 <code>05_sample.py</code> 的 <code>TokenStreamer</code> 边生成边打印,就是凑齐一个完整字符再输出,避免吐出 <code>�</code>。
      </Dig>
      <div className="next-hint">↳ 下一步:英文 1 个字节 1 个 token,1024 的上下文只装得下 1 KB 文本。把最常一起出现的两个字节合成一个 token,序列就短了。</div>
    </div>
  )
}

function Step2() {
  const [toy, setToy] = useState(toyInit)
  const [active, setActive] = useState(0)
  const flat = toy.words.flat()
  const ranked = pairsOf(toy.words).sort((x, y) => y.n - x.n).slice(0, 8)
  const mx = ranked.length ? ranked[0].n : 1
  const base = new Set(Array.from(TOY)).size
  const lastMerge = toy.merges[toy.merges.length - 1]
  let k = 0
  return (
    <div className={styles.scope}>
      <h2>② 数相邻对,合并出现最多的一对</h2>
      <p className="lead">
        下面是一小段玩具语料,已经按空格切成词(每个词前面的空格记成 <span className="sp">␣</span>,算词的一部分)。{' '}
        左边是现在所有相邻对的出现次数,橙色那一对最多。点「合并一次」,它就变成一个新 token,记进{' '}
        <Term k="bpe-merges" name="合并表 · merges" def="BPE 训练的产物:按先后顺序记下的每一次合并(哪两个 token 合成了哪个新 token)。编码新文本时按这张表的顺序,能合就合。">合并表</Term>:
      </p>
      <div className="btn-row">
        {['合并一次', '连续合并 5 次', '重置'].map((label, i) => (
          <button
            key={label}
            type="button"
            className={active === i ? 'btn primary' : 'btn'}
            onClick={() => {
              setActive(i)
              if (i === 2) setToy(toyInit())
              else if (i === 1) setToy((s) => mergeN(s, 5))
              else setToy((s) => mergeOnce(s))
            }}
          >{label}</button>
        ))}
      </div>
      <div className="lab">
        <div className="mini-h">语料({TOY.length} 个字符,按空格切成 {toy.words.length} 个词)</div>
        <div className="toks">
          {toy.words.map((w, wi) => (
            <Fragment key={wi}>
              {wi > 0 && <span className="wgap" />}
              {w.map((t, ti) => {
                const kind = t === toy.last ? 'hl' : (k++ % 2 ? 'b' : 'a')
                return <Token key={`${wi}-${ti}`} text={t} kind={kind} />
              })}
            </Fragment>
          ))}
        </div>
        <div className="two-col" style={{ marginTop: 10 }}>
          <div>
            <div className="mini-h">相邻对出现次数(前 8)</div>
            <div className="pair-bars">
              {ranked.length ? ranked.map((p, i) => (
                <div key={`${p.a}\0${p.b}`} className={i === 0 && p.n >= 2 ? 'pb top' : 'pb'}>
                  <span className="pn"><Shown text={p.a} /> + <Shown text={p.b} /></span>
                  <span className="pt"><span className="pf" style={{ width: `${p.n / mx * 100}%` }} /></span>
                  <span className="pv">{p.n}</span>
                </div>
              )) : <div className="mini-h">没有能合并的对了</div>}
            </div>
          </div>
          <div>
            <div className="mini-h">合并表</div>
            <div className="merge-list">
              {toy.merges.length ? toy.merges.map((m, i) => (
                <div key={i} className={i === toy.merges.length - 1 ? 'new' : undefined}>
                  #{i + 1}{'  '}<Shown text={m.a} />{' + '}<Shown text={m.b} />{' → '}<Shown text={m.t} />{'   '}({m.n} 次)
                </div>
              )).reverse() : <div style={{ color: 'var(--ink2)' }}>(还没有合并)</div>}
            </div>
          </div>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{base} + {toy.merges.length}</div><div className="drl">词表大小(这段语料里的字节种类 + 合并次数)</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{flat.length}</div><div className="drl">语料现在几个 token</div></div>
          <div className="dr"><div className="drv">{(TOY.length / flat.length).toFixed(2)}</div><div className="drl">每 token 平均几个字节</div></div>
        </div>
      </div>
      <div className="note">
        {lastMerge ? (
          <>第 {toy.merges.length} 次合并:<b><Shown text={lastMerge.a} /> + <Shown text={lastMerge.b} /> → <Shown text={lastMerge.t} /></b>,它在语料里出现 {lastMerge.n} 次,语料从 {TOY.length} 个 token 缩到 {flat.length} 个。</>
        ) : (
          <>现在每个字符(这段语料全是 ASCII,一个字符就是一个字节)各是一个 token,共 {flat.length} 个。</>
        )}
      </div>
      <div className="codepath">↳ 代码:<b>16_bpe.py</b> 的 <code>train_bpe</code>(真实版会记下每一对出现在哪些段里,合并时只改这些段)</div>
      <Dig title="两对次数一样多,先合哪个?">
        规则里没有标准答案,只要固定一个次序,每次训练结果就一样。这个演示取先出现的那一对;<code>16_bpe.py</code> 用 Python <code>max</code> 在计数字典上取最大值,{' '}
        次数相同时取字典里排在前面的,同样是确定的。不同实现在这里的选择不同,所以用同一份语料、同样的词表大小训出来的合并表可能不完全相同。
      </Dig>
      <Dig title="编码新文本时,也要重新数对吗?">
        不用。训练完只留下合并表。编码时对每一段:在当前相邻对里找<b>合并表里排得最靠前</b>的一对,合掉,再找,直到没有一对在表里。{' '}
        这就是 <code>16_bpe.py</code> 的 <code>make_encoder</code>,和 tiktoken 的规则相同。解码更简单:每个 token 查回它的字节,拼起来。
      </Dig>
      <div className="next-hint">↳ 下一步:这里是先按空格切词再合并,标点粘在词上,于是 "cat." 和 "cat" 成了两个不同的段。GPT-2 用一条正则切得更细,看看差在哪。</div>
    </div>
  )
}

function Step3() {
  const [splitMode, setSplitMode] = useState(0)
  const [cmp, setCmp] = useState<'gpt2' | 'space'>('gpt2')
  const segs = SPLIT_TXT.match(splitMode === 0 ? RE_GPT2 : RE_SPACE) || []
  const dogs = [...new Set(segs.filter((s) => /dog/.test(s)))]
  const ex = cmp === 'gpt2' ? D.mixed_ex : D.mixed_space_ex
  return (
    <div className={styles.scope}>
      <h2>③ 预切分:合并只在段内发生</h2>
      <p className="lead">
        合并之前先把文本切成小段,合并不能跨段。GPT-2 的{' '}
        <Term k="pretokenize" name="预切分 · pre-tokenization" def="BPE 合并前先用规则把文本切成小段(词、数字、标点、空白),合并只在段内发生。GPT-2 用一条正则按字母 / 数字 / 其他符号分类切。">预切分</Term>
        {' '}正则把字母串、数字串、其他符号、空白分成不同的段;只按空格切时,标点跟着前面的词。切换看同一句话怎么分段:
      </p>
      <div className="btn-row">
        {['GPT-2 正则', '只按空格'].map((label, i) => (
          <button key={label} type="button" className={splitMode === i ? 'btn primary' : 'btn'} onClick={() => setSplitMode(i)}>{label}</button>
        ))}
      </div>
      <div className="lab">
        <div className="toks">
          {segs.map((s, i) => <Token key={i} text={s} kind={i % 2 ? 'b' : 'a'} />)}
        </div>
        <div className="mini-h">
          {segs.length} 段 · 含 dog 的段:{dogs.map((d, i) => (
            <Fragment key={d}>
              {i > 0 ? ' ' : null}
              <code><Shown text={d} /></code>
            </Fragment>
          ))}({dogs.length} 种写法)
        </div>
      </div>
      <div className="sub-h"><span className="badge">实测</span>两种切法各训一个 16,384 词表</div>
      <p className="lead" style={{ marginBottom: 10 }}>同样 8 MB 语料、同样 16,128 次合并,只换预切分。点一边看词表里字母和标点粘在一起的 token:</p>
      <div className="cmp">
        <div className={cmp === 'gpt2' ? 'side sel' : 'side'} onClick={() => setCmp('gpt2')}>
          <div className="mini-h">GPT-2 正则</div>
          <div className="big">{en(D.mixed)}</div>
          <div className="cap">个 token 里字母和标点粘在一起</div>
          <div className="big" style={{ fontSize: 17, marginTop: 6 }}>{V16[2].toFixed(3)}</div>
          <div className="cap">测试语料每 token 字节数</div>
        </div>
        <div className={cmp === 'space' ? 'side sel' : 'side'} onClick={() => setCmp('space')}>
          <div className="mini-h">只按空格</div>
          <div className="big" style={{ color: 'var(--bad)' }}>{en(D.mixed_space)}</div>
          <div className="cap">个 token 里字母和标点粘在一起</div>
          <div className="big" style={{ fontSize: 17, marginTop: 6 }}>{V16S[2].toFixed(3)}</div>
          <div className="cap">测试语料每 token 字节数</div>
        </div>
      </div>
      <div className="lab">
        <div className="mini-h">
          {cmp === 'gpt2'
            ? `GPT-2 正则:全部 ${D.mixed} 个字母 + 标点 token`
            : `只按空格:${en(D.mixed_space)} 个里的前 ${ex.length} 个(按合并先后)`}
        </div>
        <div className="cloud">
          {ex.map((t, i) => <Token key={`${t}-${i}`} text={t} kind={i % 2 ? 'b' : 'a'} />)}
        </div>
      </div>
      <div className="note">
        只按空格切,测试语料每 token 多 {BPT_GAP} 字节;词表里 <b>{en(D.mixed_space)}</b> 个 token({MIXED_PCT}%)是"词 + 标点"的变体。GPT-2 正则下只有 {D.mixed} 个,全是 's 't 这类缩写。
      </div>
      <div className="codepath">↳ 代码:<b>16_bpe.py</b> 的 <code>GPT2_SPLIT</code> / <code>SPACE_SPLIT</code> · 对照跑法 <code>--split space</code></div>
      <Dig title="只按空格切,压缩率反而更高,为什么还要细切?">
        标点粘在词上时,<code>information,</code> 这样一个 token 能顶两个,测试语料上每 token 多装了 <b>{BPT_GAP} 字节({BPT_GAP_PCT}%)</b>。{' '}
        代价在词表:<code>s,</code> <code>s.</code> <code>ing,</code> <code>ation.</code> 这类变体占掉 2,279 个位置,约 14%,{' '}
        同一个词带不同标点的几种写法各有各的嵌入向量,各自只拿到一部分训练信号。{' '}
        GPT-2 论文 §2.2 描述了这个现象:BPE 会学出 <code>dog.</code> <code>dog!</code> <code>dog?</code> 这类变体,词表和模型容量分配得不理想,所以禁止合并跨越字符类别。
      </Dig>
      <Dig title="正则开头那几个 's 't 're 是做什么的?">
        英文缩写单独成段,<code>dog's</code> 切成 <code>dog</code> 和 <code>'s</code>,<code>don't</code> 切成 <code>don</code> 和 <code>'t</code>。{' '}
        用 GPT-2 正则训出的词表里,字母和标点粘在一起的 7 个 token 全是这几个缩写。完整正则见 <code>16_bpe.py</code> 的 <code>GPT2_SPLIT</code>,取自 openai/gpt-2 仓库 <code>src/encoder.py</code>。{' '}
        GPT-4 的 cl100k 改过这条正则:缩写不分大小写,数字最多 3 位一段。
      </Dig>
      <div className="next-hint">↳ 下一步:预切分定好了。合并多少次、词表多大才合适?</div>
    </div>
  )
}

function Sweep({ index }: { index: number }) {
  const row = D.sweep[index]
  const line = (arr: [number, number, number][], col: string) => (
    <g>
      <polyline fill="none" stroke={col} strokeWidth="2" points={arr.map((a) => `${sx(a[0])},${sy(a[2])}`).join(' ')} />
      {arr.map((a) => <circle key={a[0]} cx={sx(a[0])} cy={sy(a[2])} r="3.2" fill={col} />)}
    </g>
  )
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} width="100%" style={{ display: 'block', fontFamily: 'ui-monospace, monospace' }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={SL} x2={SW - SR} y1={sy(v)} y2={sy(v)} stroke="#E5E2D9" />
          <text x={SL - 8} y={sy(v) + 4} fontSize="10.5" textAnchor="end" fill="#6B6B68">{v}</text>
        </g>
      ))}
      {[256, 1024, 4096, 16384, 65536].map((v) => (
        <text key={v} x={sx(v)} y={SH - SB + 16} fontSize="10.5" textAnchor="middle" fill="#6B6B68">{en(v)}</text>
      ))}
      <text x={(SL + SW - SR) / 2} y={SH - 4} fontSize="10.5" textAnchor="middle" fill="#6B6B68">词表大小(对数刻度)</text>
      <text x="12" y="14" fontSize="10.5" fill="#6B6B68">字节/token</text>
      {line(D.sweep_space, '#3a63c0')}
      {line(D.sweep, '#D97757')}
      <circle cx={sx(D.gpt2[0])} cy={sy(D.gpt2[2])} r="5" fill="#B9B5AA" />
      <text x={sx(D.gpt2[0]) - 8} y={sy(D.gpt2[2]) - 9} fontSize="10.5" textAnchor="end" fill="#6B6B68">GPT-2 {D.gpt2[2].toFixed(2)}</text>
      <line x1={sx(row[0])} x2={sx(row[0])} y1={ST} y2={SH - SB} stroke="#D97757" strokeDasharray="3 3" />
      <circle cx={sx(row[0])} cy={sy(row[2])} r="6" fill="none" stroke="#D97757" strokeWidth="2" />
      <text x={sx(row[0]) + 8} y={sy(row[2]) + 16} fontSize="11" fill="#D97757" fontWeight="700">{row[2].toFixed(2)}</text>
    </svg>
  )
}

function Step4() {
  const [vocab, setVocab] = useState(4)
  const row = D.sweep[vocab]
  const space = D.sweep_space[vocab]
  const prev = vocab > 0 ? D.sweep[vocab - 1] : null
  return (
    <div className={styles.scope}>
      <h2>④ 词表多大:压缩率与嵌入表</h2>
      <p className="lead">
        同一个分词器,只用合并表的前一部分,就是一个更小的词表。下面是 1 MB 测试语料在不同词表下的{' '}
        <Term k="bytes-per-token" name="每 token 字节数 · 压缩率" def="一段文本的字节数除以编码后的 token 数。越大说明一个 token 平均代表的文本越多,同样的上下文长度能装更多内容。">每 token 字节数</Term>,
        {' '}灰点是 GPT-2 的 50,257 词表。拖滑块:
      </p>
      <div className="lab">
        <div className="rk-row">
          <label>词表大小</label>
          <input type="range" min={0} max={6} step={1} value={vocab} onChange={(e) => setVocab(Number(e.target.value))} />
          <span className="rk-val">{en(row[0])}</span>
        </div>
        <div className="scroll-x"><div style={{ minWidth: 560 }}><Sweep index={vocab} /></div></div>
        <div className="legend">
          <span><i style={{ background: 'var(--accent)' }} />GPT-2 正则预切分</span>
          <span><i style={{ background: 'var(--e1)' }} />只按空格(对照)</span>
          <span><i style={{ background: '#B9B5AA' }} />GPT-2(tiktoken)</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{row[2].toFixed(3)}</div><div className="drl">每 token 字节数</div></div>
          <div className="dr"><div className="drv">{en(row[1])}</div><div className="drl">1 MB 测试语料的 token 数</div></div>
          <div className="dr"><div className="drv">{(1024 * row[2] / 1000).toFixed(1)} KB</div><div className="drl">1024 上下文约装多少 KB 文本</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--e3)' }}>{(row[0] * 768 / 1e6).toFixed(1)}M</div><div className="drl">嵌入表参数(词表 × n_embd=768)</div></div>
        </div>
      </div>
      <div className="note">
        {prev ? (
          <>从 {en(prev[0])} 翻到 <b>{en(row[0])}</b>:每 token 多 {(row[2] - prev[2]).toFixed(3)} 字节,测试语料少 {en(prev[1] - row[1])} 个 token,嵌入表多 {((row[0] - prev[0]) * 768 / 1e6).toFixed(2)}M 参数。只按空格切的同尺寸词表:{space[2].toFixed(3)}。</>
        ) : (
          <>词表 256 时一个 token 就是一个字节,1 MB 测试语料编成 {en(row[1])} 个 token。</>
        )}
      </div>
      <div className="codepath">↳ 代码:<b>16_bpe.py</b> 的 <code>make_encoder(merges, limit)</code>:只用前 limit 条合并</div>
      <Dig title="词表越大越好吗?">
        两头都有代价。词表每翻一倍,嵌入表(与输出头共用)多 <code>词表 × n_embd</code> 个参数;第 6 章 124M 的 50,304 × 768 = 38.6M,占全部参数的约 31%。{' '}
        输出层每一步都要对整个词表算 softmax,词表大,这一步也更贵。另一头,排在后面的合并对应的 token 出现次数少,嵌入学得差。{' '}
        本页曲线越往右越平:从 256 到 512 每 token 多 1.02 字节,从 8,192 到 16,384 只多 0.38 字节。
      </Dig>
      <Dig title="GPT-2 的 50,257 是怎么来的?">
        256 个字节 + 50,000 次合并 + 1 个 <code>{'<|endoftext|>'}</code> 特殊 token。第 6 章代码里向上取整到 50,304(128 的倍数),多出来的 47 行永远不会被用到。{' '}
        它是在 GPT-2 自己的 WebText 上训的,不是 FineWeb-Edu;本页对照用的是同一段测试语料,两者训练语料不同,压缩率差距里也含有这部分影响。
      </Dig>
      <div className="next-hint">↳ 下一步:同一个句子在合并 0 次、100 次、全部 16,128 次时分别怎么切?中文又会怎样?</div>
    </div>
  )
}

function Step5() {
  const [sent, setSent] = useState(0)
  const [kIdx, setKIdx] = useState(5)
  const [band, setBand] = useState(0)
  const key = SENT_KEYS[sent]
  const ex = D.examples[key]
  const row = ex.rows[kIdx]
  const full = ex.rows[ex.rows.length - 2][1].length
  const gpt = ex.rows[ex.rows.length - 1][1].length
  const bandRow = BANDS[band]
  return (
    <div className={styles.scope}>
      <h2>⑤ 训出来的分词器</h2>
      <p className="lead">
        选一个句子,再选合并次数,看它被切成哪些 token(相邻 token 交替着色,<code>{'<e5>'}</code> 这类是还没拼成完整字符的字节):
      </p>
      <div className="btn-row small">
        {SENT_LABELS.map((label, i) => (
          <button key={label} type="button" className={sent === i ? 'btn primary' : 'btn'} onClick={() => setSent(i)}>{label}</button>
        ))}
      </div>
      <div className="btn-row small">
        {D.examples.en.rows.map((r, i) => (
          <button key={kLabel(r[0])} type="button" className={kIdx === i ? 'btn primary' : 'btn'} onClick={() => setKIdx(i)}>{kLabel(r[0])}</button>
        ))}
      </div>
      <div className="lab">
        <div className="mini-h">{ex.chars} 个字符 / {ex.bytes} 个字节 → {row[1].length} 个 token</div>
        <div className="toks">
          {row[1].map((t, i) => <Token key={i} text={t} kind={BYTE_RE.test(t) ? 'x' : (i % 2 ? 'b' : 'a')} />)}
        </div>
      </div>
      <div className="note">
        这句话:本分词器({en(D.n_merges)} 次合并)<b>{full}</b> 个 token,GPT-2 <b>{gpt}</b> 个,原始字节 {ex.bytes} 个。
        {key === 'zh' ? ' 训练语料是英文,汉字的字节一个都没被合并。' : null}
      </div>
      <div className="sub-h"><span className="badge">词表</span>学出来的 token 长什么样</div>
      <div className="btn-row small">
        {BANDS.map((b, i) => (
          <button key={b.label} type="button" className={band === i ? 'btn primary' : 'btn'} onClick={() => setBand(i)}>{b.label}</button>
        ))}
      </div>
      <div className="lab">
        <div className="cloud">
          {bandRow.items.map((t, i) => <Token key={`${t}-${i}`} text={t} kind={i % 2 ? 'b' : 'a'} />)}
        </div>
      </div>
      <div className="note">{bandRow.note}</div>
      <Dig title="中文为什么一个字都没合并出来?">
        训练语料 FineWeb-Edu 是英文网页,8 MB 里几乎没有汉字,汉字的字节对出现次数排不进 16,128 次合并,{' '}
        所以 22 个汉字编成 66 个 token,和字节数一样。GPT-2 的词表里有少量常用汉字(如本例的「光」「作」「的」),同一句是 45 个 token。{' '}
        分词器的压缩率取决于训练语料里有什么:Qwen、DeepSeek 这类面向中文的模型在含大量中文的语料上训分词器,词表也更大(十几万),常用汉字和词都能合成单个 token。
      </Dig>
      <Dig title="数字 8,045,311,447 为什么切得零零碎碎?">
        GPT-2 正则里数字串 <code>{'\\p{N}+'}</code> 是一段,合并就在这段里按频率进行,哪几位合在一起取决于训练语料里哪些数字组合常见。{' '}
        本分词器切成 <code>8</code> <code>,</code> <code>0</code> <code>45</code> …,GPT-2 切成 <code>045</code> <code>311</code> <code>447</code>,都不按位值对齐。{' '}
        第 21 章做加法时就遇到这个问题:<code>37</code>、<code>85</code> 在 GPT-2 词表里各是一个整体 token,模型看不到个位和十位,所以那一章把数字逐位写开。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>8 MB 训练语料,{en(D.n_merges)} 次合并,纯 Python 用时 <b>{Math.round(D.train_seconds)} 秒</b></div></li>
        <li><span className="ck">✓</span><div>1 MB 测试语料编码成 {en(V16[1])} 个 token,再解码<b>逐字还原</b>(脚本里有断言)</div></li>
        <li><span className="ck">✓</span><div>16,384 词表每 token <b>{V16[2].toFixed(3)}</b> 字节;GPT-2 的 50,257 词表 {D.gpt2[2].toFixed(3)}</div></li>
        <li><span className="ck">✓</span><div>预切分对照:GPT-2 正则下字母 + 标点 token {D.mixed} 个,只按空格 <b>{en(D.mixed_space)}</b> 个</div></li>
        <li><span className="ck">✓</span><div>中文例句 22 个字 = 66 字节 = 66 个 token(英文语料训出的词表没合并汉字),GPT-2 45 个</div></li>
      </ul>
      <div className="codepath">↳ 跑法:<code>python 16_bpe.py --json runs/ch18_bpe.json</code>(纯 CPU)· 对照 <code>--split space</code></div>
    </div>
  )
}

export function Bpe() {
  const chapter = findChapter('bpe')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="bpe"
      title="手写 BPE:自己训一个分词器"
      subtitle={
        <>
          第 1 章用字符级分词,65 个字符;第 6 章起一直直接调 <code>tiktoken.get_encoding("gpt2")</code>。{' '}
          这一关从零写一个同类的{' '}
          <Term k="byte-level-bpe" name="字节级 BPE · byte-level BPE" def="初始词表是 256 个字节,反复把出现最多的相邻一对合并成新 token。任何 UTF-8 文本都能编码,没有未知字符。GPT-2 / GPT-4 / LLaMA 3 的分词器都属于这一类。">字节级 BPE</Term>:
          {' '}从 256 个字节出发,数相邻对、合并出现最多的一对,重复 16,128 次。配套代码 <code>phase5-fullstack/16_bpe.py</code>,{' '}
          在第 6 章那份 <Term k="fineweb" name="FineWeb-Edu" def="HuggingFace 发布的教育类网页语料,第 6 章训练 124M 用的就是它。">FineWeb-Edu</Term> 的 8 MB 原文上训练,{' '}
          再在另外 1 MB 上和 GPT-2 的分词器对照。Phase 5 补齐全链路,这是第一关。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">训练语料 <b>8 MB</b> <i>FineWeb-Edu 原文</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">测试语料 <b>1 MB</b> <i>同一 shard 靠后,不重叠</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">词表 <b>16,384</b> <i>256 个字节 + 16,128 次合并</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECEAE2">GPT-2 词表 <b>50,257</b> <i>对照</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">n_embd <b>768</b> <i>只用来算嵌入表多大</i></HpChip>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 手写 BPE · 通关</div>
          <div className="cs">你从 256 个字节出发,用"数对、合并出现最多的一对"训出了一个 16,384 词表的分词器,编码再解码逐字还原;也看到预切分让词表少花在标点变体上,以及词表大小、训练语料怎样决定压缩率。下一关拆开注意力的另一个黑盒:FlashAttention。</div>
        </>
      }
    />
  )
}
