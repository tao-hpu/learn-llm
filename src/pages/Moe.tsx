// 旧页 goto 不重置 token、路由类别、aux 开关、训练步、滑块、布局和实测组。
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  CAT_MATRIX, CURVE_STEPS, DENSE, ECOL, EVAL_STEPS, EXPERT_SHARE, FINAL_MOE_LOSS,
  LAY_UNIT, LAYOUTS, NLAYER, NONFFN, PER_EXPERT, ROUTE_TOKS, RUNS, TOP_CHARS,
  TOKS1, TOY_P, USAGE_OFF, USAGE_ON, VAL_HI, VAL_LO, VAL_OFF, VAL_ON,
} from './moeData'
import styles from './Moe.module.css'

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = n >> 16
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a.toFixed(2)})`
}

function comb(n: number, k: number) {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

function fmtInt(n: number) {
  return n.toLocaleString('en-US')
}

function rich(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /<b>(.*?)<\/b>/g
  let last = 0
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<b key={n}>{m[1]}</b>)
    n += 1
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function shufflePick(n: number, k: number) {
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = idx[i]
    idx[i] = idx[j]
    idx[j] = t
  }
  return idx.slice(0, k)
}

function Step1() {
  const [sel, setSel] = useState(2)
  const [shown, setShown] = useState(2)
  const [onCount, setOnCount] = useState(128)
  const live = useStepLive()

  useEffect(() => {
    if (!live || onCount >= 128) return
    const id = window.setTimeout(() => {
      setOnCount((k) => Math.min(128, k + 16))
    }, onCount === 0 ? 0 : 26)
    return () => window.clearTimeout(id)
  }, [live, onCount])

  useEffect(() => {
    if (onCount >= 128) setShown(sel)
  }, [onCount, sel])

  function fire(i: number) {
    setSel(i)
    setOnCount(0)
  }

  const ch = TOKS1[shown]
  const label = ch === '␣' ? '空格' : ch

  return (
    <div className={styles.scope}>
      <h2>① dense FFN:不管什么 token,全员上岗</h2>
      <p className="lead">
        第 3 章讲过:注意力负责 token 之间"沟通",FFN 负责每个 token 单独"思考"。{' '}
        但这个思考很浪费 —— <b>随便点下面哪个 token</b>,看它过 FFN 时点亮了多少参数:
      </p>
      <div className="ffn-stage">
        <div className="tokrow">
          {TOKS1.map((t, i) => (
            <span key={i} className={i === sel ? 'tok sel' : 'tok'} onClick={() => fire(i)}>{t}</span>
          ))}
        </div>
        <div className="ffn-mid">↓ 进入同一个 FFN(隐层 4·n_embd = 512 个神经元,下图 1 点 = 4 个)</div>
        <div className="neurons">
          {Array.from({ length: 128 }, (_, i) => (
            <div key={i} className={i < onCount ? 'nr on' : 'nr'} />
          ))}
        </div>
        <div className="ffn-cap">
          token「{label}」→ 激活隐层神经元 <b>512 / 512(100%)</b> —— 换哪个 token 都一样
        </div>
      </div>
      <div className="note">
        一个平平无奇的<b>空格</b>,和一个信息量很大的字母,动用的是<b>同一套全部 FFN 参数</b>。{' '}
        模型越大这笔账越吓人:GPT 这类架构里 <b>FFN 占了参数的大约 2/3</b>,而它对每个 token 都是全量计算。
      </div>
      <Dig title="为什么偏偏对 FFN 下手,不拆注意力?">
        注意力的工作是 token <b>之间</b>的交互,拆开会破坏"谁都能看谁"的沟通;{' '}
        FFN 是<b>逐位置独立</b>的加工 —— 每个 token 各算各的,谁跟谁都不打招呼。{' '}
        这种"天生并行、互不依赖"的结构才方便按 token 派给不同专家。{' '}
        (对注意力做稀疏化的研究也有,但主流 MoE 都是拆 FFN。)
      </Dig>
      <div className="next-hint">↳ 下一步:把这个 512 隐层的大 FFN 拆成 4 个 256 隐层的小 FFN,每个 token 只走 2 个 —— 谁来决定走哪 2 个?</div>
    </div>
  )
}

function Step2() {
  const [routeSel, setRouteSel] = useState(0)
  const probs = CAT_MATRIX[ROUTE_TOKS[routeSel].cat]
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a])
  const pick = order.slice(0, 2)
  const wsum = probs[pick[0]] + probs[pick[1]]
  const w0 = probs[pick[0]] / wsum
  const w1 = probs[pick[1]] / wsum

  return (
    <div className={styles.scope}>
      <h2>② 路由器:一个线性层,给每个 token 派单</h2>
      <p className="lead">
        <Term k="router" name="路由器 · router" def="一个 n_embd → n_expert 的线性层:输入 token 向量,输出对每个专家的打分。">路由器</Term>只是一个{' '}
        <code>n_embd → n_expert</code> 的线性层:token 向量进去,4 个分数出来,softmax 变成概率,{' '}
        <b>只留最高的 top_k=2 个</b>,权重重新归一化。选一个 token,看它被派给谁{' '}
        (下面的概率是 <code>09_moe.py</code> <b>训练后</b> layer 0 的真实路由统计,按字符类别汇总):
      </p>
      <div className="routebox">
        <div className="btn-row">
          {ROUTE_TOKS.map((t, i) => (
            <button key={t.ch} type="button" className={i === routeSel ? 'btn primary' : 'btn'} onClick={() => setRouteSel(i)}>{t.ch}</button>
          ))}
        </div>
        <div>
          {probs.map((p, e) => {
            const picked = pick.includes(e)
            return (
              <div key={e} className={picked ? 'rbar-row picked' : 'rbar-row'}>
                <span className="rb-name" style={{ color: ECOL[e] }}>Expert {e}</span>
                <div className="rb-track"><div className="rb-fill" style={{ width: `${p}%`, background: ECOL[e] }} /></div>
                <span className="rb-num">{p.toFixed(1)}%{picked ? <span className="rb-tag win">top-2 ✓</span> : null}</span>
              </div>
            )
          })}
        </div>
        <div className="routeout">
          归一化:w = {w0.toFixed(2)} / {w1.toFixed(2)}
          <br />
          out = <b style={{ color: ECOL[pick[0]] }}>{w0.toFixed(2)} · E{pick[0]}(x)</b>
          {' + '}
          <b style={{ color: ECOL[pick[1]] }}>{w1.toFixed(2)} · E{pick[1]}(x)</b>
          {' '}
          <span style={{ color: 'var(--ink2)' }}>(另外 2 个专家:这单不接,0 计算)</span>
        </div>
      </div>
      <div className="note">
        输出 = <b>选中专家的加权和</b>:<code>out = w·Expert_i(x) + w'·Expert_j(x)</code>,权重就是归一化后的路由概率。{' '}
        没被选中的专家<b>这个 token 完全不算</b> —— 这就是"参数在那儿,但不花算力"的稀疏激活。
      </div>
      <Dig title={'top-k 是"挑选",挑选不可导,路由器怎么学?'}>
        梯度走的是<b>权重</b>那条路:被选中的专家,其输出乘的系数 <code>w</code> 来自 softmax,是可导的。{' '}
        loss 对 <code>w</code> 的梯度会一路传回路由器 —— "这次派给 E1 效果好,下次给 E1 打分再高点"。{' '}
        没被选中的专家确实拿不到梯度,这正是下一步"强者恒强"问题的根源。
      </Dig>
      <Dig title="派单的单位是 token 还是整句话?">
        是 <b>token</b>。同一句话里,空格可能走 E1、字母 e 走 E2 —— 每个位置独立决策。{' '}
        代码里先把 <code>(B,T,C)</code> 摊平成 <code>(B·T, C)</code> 再路由,就是在强调"逐 token 派单"。
      </Dig>
      <div className="codepath">↳ 代码:<b>09_moe.py</b> 的 <b>MoELayer.forward</b>:router 打分 → <code>topk</code> → 归一化 → 加权求和</div>
      <div className="next-hint">↳ 下一步:派单派了 5000 步之后,4 个专家真的形成分工了吗?</div>
    </div>
  )
}

function Step3() {
  const cats = Object.entries(CAT_MATRIX)
  return (
    <div className={styles.scope}>
      <h2>③ 分工是训出来的,不是设计出来的</h2>
      <p className="lead">
        没有任何人规定"E1 管空格、E2 管元音"。但训练 5000 步后,把 val 集的 token 按类别统计{' '}
        "每类字符被派往哪个专家"(layer 0 真实数据),分工自己浮出来了:
      </p>
      <table className="hm">
        <tbody>
          <tr>
            <th />
            {ECOL.map((c, e) => <th key={e} style={{ color: c }}>Expert {e}</th>)}
          </tr>
          {cats.map(([name, row]) => (
            <tr key={name}>
              <td className="rowname">{name}</td>
              {row.map((v, e) => {
                const a = Math.min(1, v / 60)
                return (
                  <td
                    key={e}
                    style={{ background: hexA(ECOL[e], 0.12 + a * 0.88), color: a > 0.45 ? '#fff' : ECOL[e] }}
                    title={`${name} → Expert ${e}:${v.toFixed(1)}%`}
                  >{v.toFixed(0)}%</td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hp-note" style={{ textAlign: 'center' }}>每行加起来 = 100% · 颜色越深 = 该类字符越爱找这个专家 · 鼠标悬停看准确数值</div>
      <div className="sub-h">每个专家最常接手的字符(同一次训练的真实统计)</div>
      <div className="expert-cards">
        {TOP_CHARS.map((chs, e) => (
          <div key={e} className="exc" style={{ borderColor: ECOL[e] }}>
            <div className="eh" style={{ color: ECOL[e] }}>Expert {e}</div>
            <div className="echars">{chs.join(' ')}</div>
            <div className="eshare">接单量 {EXPERT_SHARE[e].toFixed(1)}%(均衡=25%)</div>
          </div>
        ))}
      </div>
      <div className="note">
        <b>这些分工是涌现的:</b>换个随机种子,分工方案会不一样,但"有分工"这件事稳定出现 ——{' '}
        路由器 + 专家在训练里互相适应:专家碰巧对某类 token 加工得好,路由器就更爱把这类 token 派给它,它就练得更专。
      </div>
      <Dig title={'专家 = "数学专家 / 法律专家"吗?'}>
        不是。大模型里的专家分工大多发生在<b>低层统计模式</b>上(词形、标点、语言、代码 token 之类),{' '}
        很少出现人类意义上的"学科专家"。Mixtral 论文自己也承认:看不出专家按主题分工。{' '}
        本页字符级模型的"空白/元音"分工,就是这种统计分工的微缩版。
      </Dig>
      <div className="next-hint">↳ 下一步:"接单多 → 练得好 → 接单更多"是个正反馈。它有一个危险的极端……</div>
    </div>
  )
}

function Step4() {
  const [auxMode, setAuxMode] = useState(0)
  const [ldIdx, setLdIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const idxRef = useRef(0)
  const live = useStepLive()
  const last = EVAL_STEPS.length - 1

  useEffect(() => {
    if (!live || !playing) return
    const id = window.setInterval(() => {
      idxRef.current += 1
      const next = idxRef.current
      setLdIdx(next)
      if (next >= last) setPlaying(false)
    }, 450)
    return () => window.clearInterval(id)
  }, [live, playing, last])

  function reset() {
    setPlaying(false)
    idxRef.current = 0
    setLdIdx(0)
  }
  function play() {
    if (playing) return
    if (idxRef.current >= last) idxRef.current = 0
    setPlaying(true)
  }
  function stepOnce() {
    if (idxRef.current >= last) idxRef.current = -1
    idxRef.current += 1
    setLdIdx(idxRef.current)
  }
  function pickAux(i: number) {
    setAuxMode(i)
    reset()
  }

  const U = (auxMode === 0 ? USAGE_ON : USAGE_OFF)[ldIdx]
  const V = (auxMode === 0 ? VAL_ON : VAL_OFF)[ldIdx]

  return (
    <div className={styles.scope}>
      <h2>④ 偏心的尽头:专家塌缩,和治它的 aux loss</h2>
      <p className="lead">
        正反馈不加管束,路由器会把越来越多 token 塞给少数专家 ——{' '}
        被冷落的专家拿不到梯度、逐渐报废,这叫<Term k="expert-collapse" name="专家塌缩 · expert collapse" def="路由器把绝大多数 token 派给极少数专家,其余专家得不到训练、逐渐闲置,MoE 退化成小 dense 模型。">专家塌缩</Term>。{' '}
        要看清它,得用最脆的设定:<b>top-1 路由</b>(Switch Transformer 同款,aux loss 就是它提出的)。{' '}
        下面是<b>同一份代码、都用 top-1 跑的两次真实训练</b>,唯一区别是<Term k="load-balancing" name="负载均衡 loss · auxiliary loss" def="aux = n_expert · Σ f_e·P_e。谁接单过热就压它的路由分数,把负载推回均匀。系数一般很小,如 0.01。">负载均衡</Term>开关。点 ▶ 看 layer 0 的负载怎么随训练演化:
      </p>
      <div className="btn-row">
        <button type="button" className={auxMode === 0 ? 'btn primary' : 'btn'} onClick={() => pickAux(0)}>top-1 · aux = 0.01(开)</button>
        <button type="button" className={auxMode === 1 ? 'btn primary' : 'btn'} onClick={() => pickAux(1)}>top-1 · aux = 0(关,放飞路由器)</button>
      </div>
      <div className="loadlab">
        <div className="load-read">
          <div className="ro"><div className="rv" style={{ color: 'var(--accent)' }}>step {EVAL_STEPS[ldIdx]}</div><div className="rl">训练进度</div></div>
          <div className="ro"><div className="rv" style={{ color: 'var(--accent)' }}>{V.toFixed(2)}</div><div className="rl">val loss</div></div>
          <div className="ro"><div className="rv" style={{ color: 'var(--bad)' }}>{Math.max(...U).toFixed(0)}%</div><div className="rl">最忙专家的负载</div></div>
        </div>
        <div>
          {U.map((v, e) => (
            <div key={e} className="lrow">
              <span className="lname" style={{ color: ECOL[e] }}>E{e}</span>
              <div className="ltrack"><div className="lfill" style={{ background: ECOL[e], width: `${v}%` }} /></div>
              <span className="lnum" style={{ color: ECOL[e] }}>{v.toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div className="ideal-line">完美均衡 = 每个专家 25%(虚线为参考)· 数据:layer 0,每 500 步采一次 · 更深的层塌得更狠,见下方折叠</div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary" disabled={playing} onClick={play}>▶ 播放训练过程</button>
          <button type="button" className="btn" onClick={stepOnce}>单步 +500</button>
          <button type="button" className="btn" onClick={reset}>重置</button>
        </div>
      </div>
      <div className="note">
        {auxMode === 0 ? (
          <><b>开着 aux(=0.01):</b>从第一次更新起就被拽回均衡,四个专家全程钉在 25% 附近 —— 每个专家都持续拿到梯度、持续变强。这就是那 0.01 买到的东西。</>
        ) : (
          <><b>关掉 aux(--aux 0):</b>"接单多 → 练得好 → 分数高 → 接单更多"的雪球肉眼可见:E1 从 38% 一路吸到 <b>45%+</b>,E0 被饿到 16%;别的层更狠(这次训练 layer 2 有专家只剩 <b>9.4%</b> 单量)。5000 步只是开始,这个趋势不会自己停。</>
        )}
      </div>
      <Dig title="诚实交代:本关的 top-2 配置,关掉 aux 其实也没塌">
        实测(同 5000 步):<b>top-2 + 4 专家</b>就算 <code>--aux 0</code>,最终负载也只是 20/24/27/29% 的轻微偏,{' '}
        val loss 1.549 和开 aux 打平。原因:top-2 下<b>每个 token 同时养 2 个专家</b>,4 选 2 让谁都分得到梯度,天生抗塌。{' '}
        专家越多、top_k 越小,饿死人的风险越大 —— 所以 top-1 的 Switch 最先撞上这个问题,{' '}
        每层 256 选 8 的 DeepSeek-V3 也在做负载均衡(STEP 6 另有一组 16 选 6 + 共享专家、完全不做均衡的实测)。上面的 top-1 实验里,偏载对 val loss 的伤害也很小{' '}
        (1.545 开 / 1.560 关,4 层玩具上差 0.015)—— 塌缩真正的代价是<b>买了的容量白买</b>,{' '}
        以及大规模多机训练时忙闲不均拖慢整批,这两笔账在大模型上才要命。
      </Dig>
      <Dig title="上图只画了 layer 0,别的层呢?(深层塌得更彻底)">
        路由是每层各自独立学的,所以每层塌的程度不一样,而且<b>越深越极端</b>。{' '}
        同一次 top-1 训练跑完 5000 步,四层的终局:
        <div className="tbl-scroll"><table className="minitbl">
          <tbody>
            <tr><th>layer</th><th>关 aux(--aux 0)</th><th>开 aux(默认)</th></tr>
            <tr><td>0</td><td>23 / <b>39</b> / 22 / 15</td><td>24 / 25 / 28 / 23</td></tr>
            <tr><td>1</td><td>10 / 18 / 16 / <b>56</b></td><td>26 / 23 / 23 / 29</td></tr>
            <tr><td>2</td><td><b>62</b> / 10 / <b>9</b> / 19</td><td>29 / 27 / 21 / 23</td></tr>
            <tr><td>3</td><td>2 / <b>72</b> / 4 / 22</td><td>22 / 25 / 31 / 22</td></tr>
          </tbody>
        </table></div>
        关掉 aux,layer 3 有一个专家吃掉 <b>72%</b> 的单、另一个只剩 <b>2%</b>,基本等于废掉;{' '}
        开着 aux,四层全部稳在 21–31%。所以"塌缩"不是上图那条曲线的全部,layer 0 反而是塌得最轻的一层。
      </Dig>
      <Dig title="aux loss 的公式为什么长这样?">
        <code>aux = n_expert · Σ f_e · P_e</code>:<code>f_e</code> 是实际派给专家 e 的 token 占比(不可导),{' '}
        <code>P_e</code> 是路由器给 e 的平均概率(可导)。两者都均匀时乘积和最小(=1);{' '}
        谁的 f 偏大,压它的 P 就最能降 loss —— 梯度顺着可导的 P 把"过热"的专家分数往下压。{' '}
        这是 Switch Transformer 的经典设计,系数 <code>aux_coef=0.01</code>,轻轻管一下就够。
      </Dig>
      <Dig title="塌缩之后,MoE 退化成了什么?">
        退化成一个<b>只有少数专家在干活的小 dense 模型</b>:参数表上还是 4 个专家,{' '}
        实际容量缩水一半甚至更多 —— 花了 MoE 的显存,买到的容量白买,最亏的局面。{' '}
        所以工业级 MoE(Switch / Mixtral / DeepSeek)全都带某种负载均衡手段。
      </Dig>
      <div className="codepath">↳ 代码:<b>09_moe.py</b> 的 <b>MoELayer.forward</b> 末尾 aux loss · 复现本组对照:<code>python 09_moe.py --top-k 1 --aux 0</code></div>
      <div className="next-hint">↳ 下一步:分工有了、均衡有了,回头算总账 —— 这笔交易到底赚在哪?</div>
    </div>
  )
}

function Step5() {
  const [nExpert, setNExpert] = useState(4)
  const [topK, setTopK] = useState(2)
  const E = nExpert
  const K = topK
  const total = NONFFN + NLAYER * E * PER_EXPERT
  const active = NONFFN + NLAYER * K * PER_EXPERT
  const max = NONFFN + NLAYER * 16 * PER_EXPERT

  function onExpert(e: ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value)
    setNExpert(next)
    setTopK((cur) => (cur > next ? next : cur))
  }
  function onTop(e: ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value)
    setTopK(next > nExpert ? nExpert : next)
  }

  return (
    <div className={styles.scope}>
      <h2>⑤ 算账:用 dense 的算力,买 2 倍的容量</h2>
      <p className="lead">
        MoE 的本质是一笔交易:<b>总参数(容量)↑,每 token <Term k="active-params" name="激活参数 · active parameters" def="处理一个 token 实际参与计算的参数量。dense 里它等于总参数;MoE 里只算 top-k 个专家,所以远小于总参数。省的是算力,不是显存。">激活</Term>的计算量不变</b>。{' '}
        拨动两个滑块,看这笔账怎么随 <code>n_expert</code> / <code>top_k</code> 变化(模型 = 本关的 4 层 GPT):
      </p>
      <div className="calc">
        <div className="rk-row">
          <label>n_expert(每层专家数)</label>
          <input type="range" min={2} max={16} step={1} value={nExpert} onChange={onExpert} />
          <span className="rk-val">{E}</span>
        </div>
        <div className="rk-row">
          <label>top_k(每 token 走几个)</label>
          <input type="range" min={1} max={4} step={1} value={topK} onChange={onTop} />
          <span className="rk-val">{K}</span>
        </div>
        <div className="pbars">
          <div className="pb-row">
            <span className="pb-name">总参数(要存)</span>
            <div className="pb-track"><div className="pb-fill" style={{ background: 'var(--accent)', width: `${(total / max) * 100}%` }} /></div>
            <span className="pb-num">{total.toFixed(2)} M</span>
          </div>
          <div className="pb-row">
            <span className="pb-name">每 token 激活</span>
            <div className="pb-track"><div className="pb-fill" style={{ background: 'var(--good)', width: `${(active / max) * 100}%` }} /></div>
            <span className="pb-num">{active.toFixed(2)} M</span>
          </div>
          <div className="pb-row">
            <span className="pb-name">dense 对照(03)</span>
            <div className="pb-track"><div className="pb-fill" style={{ background: '#B9B4A5', width: '18.6%' }} /></div>
            <span className="pb-num">0.82 M</span>
          </div>
        </div>
        <div className="hp-note" style={{ marginTop: 10 }}>
          {E === 4 && K === 2
            ? '← 本关配置:总参数 ≈ dense 的 1.6 倍,每 token 激活和 dense 持平(0.82 M vs 0.82 M)。'
            : `容量 ×${(total / DENSE).toFixed(1)},每 token 算力 ×${(active / DENSE).toFixed(1)}(相对 dense)。top_k 不变就"白拿"容量;top_k 加大,算力跟着涨。`}
        </div>
      </div>
      <div className="note">
        <b>MoE 省的是算力,不是显存</b> —— 总参数一个都不能少,全都得放在(显)存里待命;{' '}
        省下的是每个 token 的 FLOPs。所以它适合"显存管够、算力金贵"的大规模训练与推理。{' '}
        真实世界同款账本:<b>Mixtral 8×7B</b> 总 46.7B / 激活 12.9B;<b>DeepSeek-V3</b> 总 671B / 激活 37B。
      </div>
      <div className="sub-h"><span className="badge">达标</span>本关实测(四次训练 · 各 5000 步 · tiny shakespeare)</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>MoE val loss <b>{FINAL_MOE_LOSS}</b>,dense 对照(03)<b>~1.57</b>:同等每 token 算力下,容量翻倍换来更低的 loss。</div></li>
        <li><span className="ck">✓</span><div>负载均衡有效:top-1 关 aux 实测偏载滚雪球(最深一层单专家吃掉 <b>72%</b> 的单,同层另一个只剩 <b>2%</b>;layer 2 也有专家被饿到 9.4%),开 aux 则四层全部稳在 21–31%;本关的 top-2 配置天生抗塌(关 aux 也只轻微偏)。</div></li>
        <li><span className="ck">✓</span><div>专家分工涌现且清晰:空白 70.5% 涌向 E1、大写 50.8% 归 E0、元音偏 E2、辅音偏 E3(见 STEP 3 热力图,val 集实测)。</div></li>
      </ul>
      <div className="sub-h"><span className="badge">Q&A</span>常见疑问</div>
      <Dig title={'MoE 的"专家"和多头注意力的"头",都是"多个小的",区别在哪?'}>
        <b>头是全员上岗,专家是按需点名。</b>多头注意力里,每个 token 都要过<b>所有</b>的头,只是各头看不同关系;{' '}
        MoE 里每个 token 只走 top-k 个专家,其余专家对它零计算。{' '}
        一个是"并行分视角"(算力照付),一个是"稀疏选路"(算力打折),目的完全不同。
      </Dig>
      <Dig title={'现在的 MoE 还是"4 选 2"这么糙吗?'}>
        前五步教的是 Mixtral 同款的经典配方(少量大专家 + top-2)。DeepSeekMoE(arXiv 2401.06066)在它上面加了两个旋钮:{' '}
        <b>细粒度专家</b>,把每个专家切窄,个数和每 token 选中的个数同比放大(例如 16 选 2 → 64 选 8,激活的隐层总宽不变,{' '}
        组合数从 C(16,2)=120 变成 C(64,8)≈44 亿);<b>共享专家</b>,留出几个不经路由器、每个 token 必走的专家。{' '}
        DeepSeek-V3 每层 256 个路由专家选 8 个,外加 1 个共享专家(arXiv 2412.19437 §4.2);{' '}
        Qwen3-Next-80B-A3B 每层 512 个专家激活 10 个,另有 1 个共享专家(模型卡)。{' '}
        STEP 6 把这两个旋钮和 V3 的偏置均衡放到本关的 4 层模型上各跑了一遍。
      </Dig>
      <Dig title="既然容量翻倍这么香,为什么不是所有模型都用 MoE?">
        代价在工程:<b>显存占用照总参数算</b>、多机并行时 token 要跨设备找专家(通信开销)、{' '}
        负载不均会拖慢整批训练、微调也比 dense 娇气。小模型(显存不紧张)用 dense 更省心;{' '}
        MoE 的甜区是"参数规模顶到显存上限、还想再大"的场景 —— 所以你在千亿级模型上才总看到它。
      </Dig>
      <div className="codepath">↳ 跑法:<code>python 09_moe.py</code> · 对照塌缩 <code>python 09_moe.py --aux 0</code> · 训完自动打印负载 + 分工报告</div>
      <div className="next-hint">↳ 下一步:DeepSeek 系把专家切得更碎、留一个人人都过的共享专家,还换了一种不进 loss 的均衡办法。放到这台 1.35M 的小模型上,它们赢过 4 选 2 了吗?</div>
    </div>
  )
}

const LAY_BTNS = ['dense FFN', '经典 4×256 · 选 2', '细粒度 16×64 · 选 8', '16×64 · 选 6 + 1 个共享专家']
const RUN_BTNS = ['经典 4×256 · 选 2', '细粒度 16×64 · 选 8', '共享 · aux', '共享 · bias', '共享 · 不均衡']

function Step6() {
  const [layIdx, setLayIdx] = useState(3)
  const [layPick, setLayPick] = useState(() => shufflePick(LAYOUTS[3].n, LAYOUTS[3].k))
  const [toyB, setToyB] = useState(0)
  const [runIdx, setRunIdx] = useState(0)
  const [viewMode, setViewMode] = useState(0)
  const [layerIdx, setLayerIdx] = useState(0)
  const [curveIdx, setCurveIdx] = useState(10)

  const L = LAYOUTS[layIdx]
  const wOf = (h: number) => `${(h / LAY_UNIT) * 100}%`
  function chooseLayout(i: number) {
    setLayIdx(i)
    setLayPick(shufflePick(LAYOUTS[i].n, LAYOUTS[i].k))
  }

  const B = [0, 0, toyB, 0]
  const S = TOY_P.map((p, i) => p + B[i])
  const toyPick = [0, 1, 2, 3].sort((x, y) => S[y] - S[x] || x - y).slice(0, 2)
  const psum = TOY_P[toyPick[0]] + TOY_P[toyPick[1]]

  const R = RUNS[runIdx]
  const D = R.d
  const ci = curveIdx
  const U = viewMode === 0 ? D.final[layerIdx] : D.curve[ci]
  const uni = 100 / D.n
  const top = 2 * uni
  const mx = Math.max(...U)
  const mn = Math.min(...U)
  let usage = (viewMode === 0
    ? `layer ${layerIdx} 终局(最后一个训练 batch)`
    : `layer 0 · step ${CURVE_STEPS[ci]}(该次评估最后一个 val batch)`)
    + `:最闲 ${mn.toFixed(1)}% · 最忙 ${mx.toFixed(1)}% · 均匀 ${+uni.toFixed(2)}%`
  if (viewMode === 0 && D.bias) {
    const b = D.bias[layerIdx]
    const bl = Math.min(...b)
    const bh = Math.max(...b)
    usage += ` · 这一层偏置 b 在 ${bl.toFixed(3)} ~ ${bh.toFixed(3)}(差 ${(bh - bl).toFixed(3)})`
  }

  return (
    <div className={styles.scope}>
      <h2>⑥ 切碎专家、留一个常驻专家、换一种均衡</h2>
      <p className="lead">
        DeepSeek 系 MoE 在经典配方上改了三处:<Term k="shared-expert" name="细粒度专家 / 共享专家 · fine-grained / shared experts" def="细粒度:把专家切窄,个数和每 token 选中的个数同比放大,激活的隐层总宽不变。共享专家:不经路由器、每个 token 必走的专家。出自 DeepSeekMoE(arXiv 2401.06066)。">细粒度专家与共享专家</Term>(DeepSeekMoE,arXiv 2401.06066),{' '}
        以及<Term k="aux-free-balancing" name="无辅助损失的负载均衡 · auxiliary-loss-free balancing" def="每个专家一个偏置 b,只在挑 top-k 时加到分数上;门控权重仍用原始分数,偏置不进 loss。每个训练步按负载把 b 加减 γ。DeepSeek-V3 采用(arXiv 2412.19437 §2.1.2)。">偏置均衡</Term>(DeepSeek-V3,arXiv 2412.19437)。{' '}
        三处都不改每 token 激活的 FFN 隐层总宽。<b>点下面的布局</b>,看 dense FFN 的 512 个隐层神经元怎么分出去:
      </p>
      <div className="sub-h"><span className="badge">布局</span>每 token 激活的隐层都是 512</div>
      <div className="laylab">
        <div className="btn-row">
          {LAY_BTNS.map((label, i) => (
            <button key={label} type="button" className={i === layIdx ? 'btn primary' : 'btn'} onClick={() => chooseLayout(i)}>{label}</button>
          ))}
        </div>
        <div className="lay-cap">全部专家(格子宽度 ∝ 隐层宽度 · 橙 = 这个 token 选中 · 绿 = 共享专家,每个 token 必走)</div>
        <div className="lay-row">
          {L.sh ? <div className="lay-cell sh" style={{ width: wOf(L.sh) }} title={`共享专家 · 隐层 ${L.sh} · 每个 token 必走`}>共享</div> : null}
          {Array.from({ length: L.n }, (_, e) => {
            const on = layPick.includes(e)
            const txt = L.n === 1 ? 'FFN 隐层 512' : (L.h >= 128 ? `E${e}` : '')
            return (
              <div key={e} className={on ? 'lay-cell on' : 'lay-cell'} style={{ width: wOf(L.h) }} title={`${L.n === 1 ? 'dense FFN' : `路由专家 E${e}`} · 隐层 ${L.h}`}>{txt}</div>
            )
          })}
        </div>
        <div className="lay-cap">这个 token 实际用到的隐层</div>
        <div className="lay-row">
          {L.sh ? <div className="lay-cell sh" style={{ width: wOf(L.sh) }}>{L.sh}</div> : null}
          {Array.from({ length: L.k }, (_, i) => (
            <div key={i} className="lay-cell on" style={{ width: wOf(L.h) }}>{L.h >= 128 ? L.h : ''}</div>
          ))}
        </div>
        <div className="routeout">
          {L.n === 1 ? (
            <>
              隐层 <b>512</b> 个神经元全部参与,走法只有 1 种<br />
              整模型 {fmtInt(L.params)} 个参数,每 token 全部激活
            </>
          ) : (
            <>
              每 token 激活隐层 = {L.sh ? <>共享 {L.sh} + </> : null}{L.k} × {L.h} = <b>512</b> · 路由专家组合 C({L.n},{L.k}) = <b>{fmtInt(comb(L.n, L.k))}</b> 种<br />
              整模型总参数 {fmtInt(L.params)} · 每 token 激活 {fmtInt(L.active)}
            </>
          )}
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={() => setLayPick(shufflePick(L.n, L.k))}>换一个 token</button>
          <span className="hp-note">选中哪几个是随机示意;真实训练里由路由器打分决定</span>
        </div>
      </div>
      <div className="hp-note">四种布局的每 token 激活参数相差不到 1.2 万个:路由器从每层 128×4 变成 128×16,专家的偏置项也多了一些。</div>

      <div className="sub-h"><span className="badge">均衡</span>偏置只管挑谁,不改权重</div>
      <div className="fcard">
        <div><span className="fk">挑选</span>选中的 k 个 = TopK( p<sub>e</sub> + b<sub>e</sub> )</div>
        <div><span className="fk">权重</span>w<sub>e</sub> = p<sub>e</sub> / Σ<sub>选中</sub> p<sub>j</sub><span className="fc">← 用原始概率 p,不含 b</span></div>
        <div><span className="fk">更新</span>b<sub>e</sub> ← b<sub>e</sub> − γ · sign( load<sub>e</sub> − mean(load) )<span className="fc">每个训练步一次 · γ = 0.001 · 不进 loss</span></div>
      </div>
      <div className="routebox">
        <div className="rk-row">
          <label>E2 的偏置 b</label>
          <input type="range" min={0} max={25} step={1} value={toyB} onChange={(e) => setToyB(Number(e.target.value))} />
          <span className="rk-val">{(toyB / 100).toFixed(2)}</span>
        </div>
        <div>
          {TOY_P.map((p, e) => {
            const picked = toyPick.includes(e)
            return (
              <div key={e} className={picked ? 'rbar-row picked' : 'rbar-row'}>
                <span className="rb-name" style={{ color: ECOL[e] }}>Expert {e}</span>
                <div className="rb-track" style={{ display: 'flex' }}>
                  <div className="rb-fill" style={{ width: `${(p / 70) * 100}%`, background: ECOL[e] }} />
                  {B[e] ? <div className="rb-bias" style={{ width: `${(B[e] / 70) * 100}%` }} /> : null}
                </div>
                <span className="rb-num">
                  {(p / 100).toFixed(2)}{B[e] ? ` + ${(B[e] / 100).toFixed(2)}` : ''}
                  {picked ? <span className="rb-tag win">选中</span> : null}
                </span>
              </div>
            )
          })}
        </div>
        <div className="routeout">
          按 p + b 选中 E{toyPick[0]}、E{toyPick[1]}
          <br />
          权重只用 p:{toyPick.map((e, i) => (
            <span key={e}>
              {i > 0 ? ' · ' : null}
              E{e} {(TOY_P[e] / 100).toFixed(2)} / {(psum / 100).toFixed(2)} = <b style={{ color: ECOL[e] }}>{(TOY_P[e] / psum).toFixed(2)}</b>
            </span>
          ))}
          {toyPick.includes(2) && toyB > 0 ? (
            <>
              <br />
              <span style={{ color: 'var(--ink2)' }}>E2 靠偏置挤进前 2,权重仍按 p = 0.20 算,b 不进输出</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="hp-note">占位数字:4 个专家选 2,概率 p = 0.40 / 0.30 / 0.20 / 0.10 只为上屏;下面的真实训练是 16 个专家选 6。</div>
      <Dig title="DeepSeek-V3 论文原文怎么写这条规则?">
        挑选:<code>s_{'{'}i,t{'}'} + b_i ∈ Topk({'{'}s_{'{'}j,t{'}'} + b_j{'}'}, K_r)</code>。原句:"the bias term is only used for routing. The gating value, which will be multiplied with the FFN output, is still derived from the original affinity score s_{'{'}i,t{'}'}"(arXiv 2412.19437 §2.1.2)。<br />
        更新:"At the end of each step, we will decrease the bias term by γ if its corresponding expert is overloaded, and increase it by γ if its corresponding expert is underloaded"。<br />
        V3 前 14.3T token 用 γ = 0.001,最后 500B token 设为 0,另保留一个系数 0.0001 的序列级均衡 loss(§4.2)。方法最早出自 arXiv 2408.15664。{' '}
        本页代码拿 softmax 概率 p 当分数,对应论文里的亲和度 s。
      </Dig>

      <div className="sub-h"><span className="badge">实测</span>五次训练 · 同一份 09_moe.py · 各 5000 步</div>
      <div className="hp-note">RTX 4090 · CUDA · PyTorch 2.4.1,每组一个种子。STEP 1–5 的数字来自早先 Mac MPS 上的训练,硬件不同,两边不逐位比较(STEP 5 的 1.549 和下面经典组的 1.5392 是两台机器各跑一次的结果)。</div>
      <div className="runlab">
        <div className="btn-row">
          {RUN_BTNS.map((label, i) => (
            <button key={label} type="button" className={i === runIdx ? 'btn primary' : 'btn'} onClick={() => setRunIdx(i)}>{label}</button>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          {RUNS.map((row, i) => (
            <div key={row.short} className={i === runIdx ? 'vrow sel' : 'vrow'} onClick={() => setRunIdx(i)}>
              <span className="vname">{row.short}</span>
              <div className="vtrack"><div className="vfill" style={{ width: `${((row.d.val - VAL_LO) / (VAL_HI - VAL_LO)) * 100}%` }} /></div>
              <span className="vnum">{row.d.val.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div className="ideal-line">val loss @ step 4999(越短越低)· 横轴从 1.52 起,差距被放大 · 点柱子也能切换</div>
        <div className="load-read" style={{ marginTop: 14 }}>
          <div className="ro"><div className="rv" style={{ color: 'var(--accent)' }}>{fmtInt(D.params)}</div><div className="rl">总参数</div></div>
          <div className="ro"><div className="rv" style={{ color: 'var(--good)' }}>{fmtInt(D.active)}</div><div className="rl">每 token 激活</div></div>
          <div className="ro"><div className="rv" style={{ color: 'var(--accent)' }}>{D.val.toFixed(4)}</div><div className="rl">val loss</div></div>
        </div>
        <div className="note" style={{ marginTop: 8 }}>{rich(R.note)}</div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" className={viewMode === 0 ? 'btn primary' : 'btn'} onClick={() => setViewMode(0)}>各层终局负载</button>
          <button type="button" className={viewMode === 1 ? 'btn primary' : 'btn'} onClick={() => setViewMode(1)}>layer 0 训练过程</button>
        </div>
        <div className="btn-row" style={{ display: viewMode === 0 ? 'flex' : 'none' }}>
          {[0, 1, 2, 3].map((i) => (
            <button key={i} type="button" className={layerIdx === i ? 'btn primary' : 'btn'} onClick={() => setLayerIdx(i)}>layer {i}</button>
          ))}
        </div>
        <div className="rk-row" style={{ display: viewMode === 1 ? 'flex' : 'none' }}>
          <label>训练步</label>
          <input type="range" min={0} max={10} step={1} value={curveIdx} onChange={(e) => setCurveIdx(Number(e.target.value))} />
          <span className="rk-val">{CURVE_STEPS[ci]}</span>
        </div>
        <div className="ucols">
          <div className="uline" />
          {U.map((v, e) => {
            const cls = v === mx ? ' max' : (v === mn ? ' min' : '')
            return <div key={e} className={`ucol${cls}`} style={{ height: `${Math.min(100, (v / top) * 100)}%` }} title={`E${e}:${v.toFixed(1)}%`} />
          })}
        </div>
        <div className="ulabels">
          {U.map((_, e) => <span key={e}>E{e}</span>)}
        </div>
        <div className="ideal-line">{usage}</div>
        <div className="ideal-line">红 = 最忙 · 蓝 = 最闲 · 虚线 = 均匀负载 · 纵轴上限 = 均匀值的 2 倍</div>
      </div>
      <div className="note">
        <b>结论:</b>在 1.35M 参数、tiny shakespeare 字符级、5000 步这个规模上,细粒度切分和共享专家都没有赢过经典 4 选 2{' '}
        (纯细粒度高 0.023,加共享专家的三组高 0.005–0.011);三种均衡方式之间差不到 0.006,在单种子噪声的量级内。
      </div>
      <Dig title="差 0.006 能说明哪种均衡方式更好吗?">
        不能。每组只跑了一个种子,val 在同一次训练里也不是单调下降:细粒度组 step 4500 是 1.5604,step 4999 反而是 1.5625。{' '}
        三个共享专家组的初始化完全相同(step 0 的 val 都是 4.3544,layer 0 负载逐位相同),差别来自均衡方式加上训练中的随机性。{' '}
        要分出高下,得每组多跑几个种子取平均。
      </Dig>
      <Dig title="完全不做均衡,为什么没塌?">
        STEP 4 的 top-1 + 4 专家关掉 aux 后,最深一层有一个专家吃掉 72% 的单。这里是 16 个路由专家选 6 个、外加 1 个共享专家,{' '}
        关掉所有均衡,四层终局负载仍在 <b>3.1–9.2%</b>(均匀 6.25%);layer 0 的训练过程里,偏载在 step 2000 前后成形,之后最忙的专家从 8.1% 缓慢升到 8.9%。<br />
        和 STEP 4 比,条件差在三处:每个 token 同时选 6 个专家;有共享专家;只有 4 层、5000 步。这组实验没有把三处拆开测,{' '}
        说不清是哪一处起的作用,<b>只能说在这个设定、这个训练长度下没塌</b>。每层 256 选 8 的 DeepSeek-V3 仍然做均衡。{' '}
        另外,终局负载取自最后一个训练 batch,是一次快照。
      </Dig>
      <Dig title="偏置都学成了正数,是把所有专家一起抬高了吗?">
        top-k 只比较 p + b 的相对大小:给所有专家加同一个常数,选中的专家不变。所以要看的是<b>同一层内偏置之间的差</b>。{' '}
        更新规则每步给每个专家 +γ 或 −γ,欠载的专家多于过载的专家时,整层偏置就一起往上漂,绝对值本身不带信息。偏置均衡组的终局:
        <div className="tbl-scroll"><table className="minitbl">
          <tbody>
            <tr><th>layer</th><th>b 最小</th><th>b 最大</th><th>差</th><th>终局负载</th></tr>
            <tr><td>0</td><td>0.038</td><td>0.065</td><td>0.027</td><td>6.0–6.6%</td></tr>
            <tr><td>1</td><td>0.498</td><td>0.501</td><td>0.003</td><td>3.4–8.7%</td></tr>
            <tr><td>2</td><td>0.552</td><td>0.555</td><td>0.003</td><td>3.1–9.1%</td></tr>
            <tr><td>3</td><td>0.197</td><td>0.204</td><td>0.007</td><td>3.3–8.4%</td></tr>
          </tbody>
        </table></div>
        layer 0 的偏置差 0.027,和平均概率 1/16 ≈ 0.0625 同一量级,这一层的负载也是 16 专家四组里最整齐的;{' '}
        layer 1–3 的偏置差只有 0.003–0.007,终局负载也没有比 aux 组(4.3–8.0%)更齐。这组数据判断不了原因。{' '}
        一个没有验证过的猜测:固定步长的 sign 更新让这几层的专家在过载和欠载之间来回翻,偏置差攒不起来。
      </Dig>
      <Dig title="DeepSeek 在多大的规模上用这套配方?">
        <b>本页</b>:4 层,每层 16 个路由专家(隐层 64),训练约 2048 万个字符 token(5000 步 × batch 64 × block 64)。<br />
        <b>DeepSeek-V3</b>:61 层、hidden 7168,前 3 层之外全换成 MoE,每层 1 个共享专家 + 256 个路由专家(隐层 2048)选 8 个,{' '}
        预训练 14.3T + 500B token(arXiv 2412.19437 §4.2)。<br />
        <b>无 aux 均衡的方法论文</b>:实验最大 3B 参数、200B token(arXiv 2408.15664)。<br />
        <b>Qwen3-Next-80B-A3B</b>:每层 512 个专家激活 10 个,另有 1 个共享专家(HF 模型卡)。<br />
        光 token 数就差五个数量级以上。这些模型报告的收益,本页的小实验既验证不了,也否定不了。
      </Dig>
      <div className="codepath">↳ 代码:<b>09_moe.py</b> 的 <b>MoELayer.forward</b>:<code>sel_bias</code> 只进 topk 挑选,权重用 <code>probs.gather</code> 取原始概率,训练时按负载加减 γ · 复现(在 phase3-moe/ 下):<code>python 09_moe.py --n-expert 16 --expert-hidden 64 --top-k 6 --shared 1 --shared-hidden 128 --balance bias</code>,把 bias 换成 aux / none 得另两组;细粒度组是 <code>--n-expert 16 --expert-hidden 64 --top-k 8</code></div>
    </div>
  )
}

export function Moe() {
  const chapter = findChapter('moe')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />, <Step6 />]
  return (
    <ChapterShell
      slug="moe"
      title="手搓 MoE:参数翻倍,算力不变"
      subtitle={
        <>
          第 3 章的 GPT 里,FFN 是<b>每个 token 都要过的同一个小 MLP</b>。{' '}
          <Term k="moe" name="MoE · 专家混合" def="Mixture of Experts。把 FFN 拆成多个'专家',每个 token 只走其中 top-k 个 —— 总参数变多,每 token 计算量不变。">MoE</Term>
          {' '}把它拆开:多个<Term k="moe" name="专家 · expert" def="MoE 里的一个小 FFN。结构和普通 FFN 一样,只是隐层更窄;分工是训练中自己涌现的。">专家</Term>
          {' '}+ 一个<Term k="router" name="路由器 · router" def="一个线性层,给每个 token 对每个专家打分,决定这个 token 派给哪 top-k 个专家。">路由器</Term>,
          {' '}每个 token 只走最对口的 2 个专家。这是 Mixtral / DeepSeek 这代模型"参数千亿、激活百亿"的核心机关。{' '}
          本关用 <b>1.35M</b> 参数把它完整跑通 —— 大概算<b>全球最小的 MoE 之一</b>,但路由、分工、塌缩,和 671B 的 DeepSeek 是同一套机制。{' '}
          最后一步再看 DeepSeek 系的三处改法:细粒度专家、共享专家、偏置均衡。{' '}
          配套代码 <code>phase3-moe/09_moe.py</code>。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#b8512f" bg="#F7E6DE">n_expert <b>4</b> <i>每层专家数</i></HpChip>
          <HpChip color="#3a63c0" bg="#E5EBF9">top_k <b>2</b> <i>每 token 走几个</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">expert_hidden <b>256</b> <i>=2·n_embd·单个专家隐层</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">aux <b>0.01</b> <i>负载均衡系数</i></HpChip>
          <HpChip color="#6b6b68" bg="#ECE9E0">底座 <b>03 的 GPT</b> <i>4 层·n_embd=128</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">STEP 6 <b>16×64</b> <i>另一套配置:16 个窄专家,见该步</i></HpChip>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 手搓 MoE · 通关</div>
          <div className="cs">你已经亲手把 dense GPT 的 FFN 换成"路由器 + 专家",看到了分工的涌现、塌缩的风险、"参数翻倍算力不变"的账本,也在同一台小模型上试了细粒度专家、共享专家和偏置均衡。下次再看 DeepSeek-V3 的"256 选 8 + 1 个共享专家",你知道每个数字管什么了。</div>
        </>
      }
    />
  )
}
