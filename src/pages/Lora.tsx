// 旧页 goto 不重置秩、B=0、epoch 进度和指令选择。离开第 4 步时若这一轮还在跑，立刻跳到结束状态；最后一个 epoch 中途离开也会标上 settled。回来不自动续播。
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Lora.module.css'

const RANKS = [1, 2, 4, 8, 16, 32]
const PER_RANK = 147456
const BASE_PARAMS = 124475904
const LOSS_SEQ = [2.09, 0.79, 0.29, 0.05, 0.12, 0.009, 0.008, 0.003]

const SAMPLES = [
  {
    instr: 'What is the capital of France?',
    base: '"For the purposes of this article, we do not consider the capital of France as the capital of the states. In fact, the name…"',
    baseStop: false,
    sft: '"The capital of France is Paris."',
    sftStop: true,
    tag: '训练里见过 · 答对 + 停',
  },
  {
    instr: 'Translate to French: I love cats.',
    base: '"For more information about this topic, please visit: Animal Diversity in the World / What is a cat? / What\'s a Cat?…"',
    baseStop: true,
    sft: '"J\'aime les chats."',
    sftStop: true,
    tag: '训练里见过 · 这次译得很准 + 停',
  },
  {
    instr: 'What is the capital of Germany?  (训练里没见过)',
    base: '"For the most part, the capital of Germany is Berlin, and Berlin is the capital of the united states. (循环复读…)"',
    baseStop: false,
    sft: '"The capital of Germany is Berlin."',
    sftStop: true,
    tag: '没训过 · 套用了格式还答对了',
  },
]

function fmtCount(n: number) {
  return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e3).toFixed(0) + 'K'
}

function rankView(index: number) {
  const r = RANKS[index]
  const train = PER_RANK * r
  const total = BASE_PARAMS + train
  const full = 768 * 768
  const side = (768 + 768) * r
  return {
    r,
    train: fmtCount(train),
    ratio: (100 * train / total).toFixed(2) + '%',
    size: (train * 4 / 1e6).toFixed(1) + ' MB',
    full: full.toLocaleString(),
    side: side.toLocaleString(),
    sidePct: (100 * side / full).toFixed(1) + '%',
  }
}

function Stop({ ok }: { ok: boolean }) {
  return <span className={ok ? 'stoptag yes' : 'stoptag no'}>{ok ? '⟨EOS,主动停⟩' : '没停 · 被截断'}</span>
}

function Step1() {
  return (
    <div className={styles.scope}>
      <h2>① 同一件事,何必把整座大楼都翻新?</h2>
      <p className="lead">
        第 8 章的全量 SFT 把 <b>124M 个参数全部更新</b>了一遍,训练要为每个参数都存梯度/优化器状态,存盘是一份完整的{' '}
        <b>~498MB</b> 新模型。可我们要教的只是"答题的姿态"这点小改动 —— 真有必要动到每一根钢筋吗?{' '}
        <b>LoRA 的想法:底座一个数都不动,只在旁边搭一条很细的"改装管道",改动量压到 1% 级别。</b>
      </p>
      <div className="vs">
        <div className="card2 full">
          <div className="t">全量 SFT(上一关 · 第 8 章)</div>
          <div className="big">124M</div>
          <div className="sub">参数全部可训练 · 存一份 <b>~498MB</b> 完整模型</div>
        </div>
        <div className="card2 lora">
          <div className="t">LoRA(这一关 · 第 9 章)</div>
          <div className="big">1.18M <span style={{ fontSize: 14, color: 'var(--ink2)' }}>≈0.94%</span></div>
          <div className="sub">底座冻结 · 只存 <b>~4.7MB</b> adapter</div>
        </div>
      </div>
      <div className="note">
        省的不只是硬盘:可训练参数少,<b>显存里要存的梯度和优化器状态也跟着少一大截</b> —— 这正是单卡/小显存能微调大模型的关键。{' '}
        代价是:LoRA 的表达力被"低秩"限制住,极端任务上可能略逊全量微调;但做 SFT 这类"调姿态"的活,通常<b>几乎追平</b>。
      </div>
      <div className="next-hint">↳ 下一步:这条"细管道"为什么这么省?拆开 <code>B·A</code> 算笔账。</div>
    </div>
  )
}

function Step2() {
  const [rankIdx, setRankIdx] = useState(3)
  const view = rankView(rankIdx)
  return (
    <div className={styles.scope}>
      <h2>② 低秩旁路:用两块小矩阵代替一块大矩阵</h2>
      <p className="lead">
        原来一层是 <code>y = W·x</code>,<code>W</code> 是个大方阵(例如 768×768 ≈ <b>59 万</b>个数)。{' '}
        LoRA 不去改 <code>W</code>,而是在旁边并上 <code>y = W·x + (B·A)·x</code> ——{' '}
        <code>A</code> 把 768 维<b>压到 r 维</b>(瓶颈),<code>B</code> 再<b>升回</b> 768 维。{' '}
        <code>r</code> 很小,所以 <code>A</code>、<code>B</code> 加起来比 <code>W</code> 小得多。拨动 <code>r</code> 看整模型的账:
      </p>
      <div className="calc">
        <div className="rk-row">
          <label>秩 r =</label>
          <input type="range" min={0} max={5} step={1} value={rankIdx} onChange={(e) => setRankIdx(Number(e.target.value))} />
          <span className="rk-val">{view.r}</span>
        </div>
        <div className="stat-grid">
          <div className="stat hi"><div className="sv">{view.train}</div><div className="sl">可训练参数(A+B 全层合计)</div></div>
          <div className="stat hi"><div className="sv">{view.ratio}</div><div className="sl">占总参数比例</div></div>
          <div className="stat"><div className="sv">{view.size}</div><div className="sl">adapter 存盘大小(≈)</div></div>
        </div>
        <div className="hp-note" style={{ marginTop: 12 }}>
          单看一个 768×768 的层:全量要动 <b>{view.full}</b> 个数,LoRA 只加 <b>{view.side}</b> 个(A+B)≈ 原来的 <b>{view.sidePct}</b>。
        </div>
      </div>
      <div className="note">
        "<b>低秩</b>"是关键假设:微调要做的那点改变 <code>ΔW</code>,其实<b>用一个很"扁"的矩阵就能近似</b>(秩很低),{' '}
        不需要一个满秩的大方阵。所以拿 <code>B·A</code>(秩最多 r)去逼近它就够了。<code>r</code> 越大表达力越强、参数也越多 —— 是个旋钮。
      </div>
      <div className="codepath">↳ 代码:<b>07_lora.py</b> 的 <b>LoRALinear</b>(<code>lora_A: in→r</code>,<code>lora_B: r→out</code>)· 实测 r=8 → 可训练 <b>1,179,648</b></div>
      <div className="next-hint">↳ 下一步:旁路刚挂上时会不会扰乱 base?看 <code>B=0</code> 这个小心机。</div>
    </div>
  )
}

function Step3() {
  const [zero, setZero] = useState(true)
  return (
    <div className={styles.scope}>
      <h2>③ 底座冻结,B 置零 —— 从 base 平滑出发</h2>
      <p className="lead">
        注入 LoRA 时只动两件事:① 把原层 <code>W</code> 整段<b>冻结</b>(<code>requires_grad=False</code>,永不更新);{' '}
        ② 旁路里 <code>A</code> 用小随机数、<b><code>B</code> 全初始化成 0</b>。于是训练第 0 步旁路输出恒为 0,{' '}
        <b>"装了 LoRA 的模型"和原始 base 一模一样</b> —— 不会一上来就把 base 搅乱。点下面切换看:
      </p>
      <div className="btn-row">
        <button type="button" className={zero ? 'btn primary' : 'btn'} onClick={() => setZero(true)}>训练第 0 步(B=0)</button>
        <button type="button" className={zero ? 'btn' : 'btn primary'} onClick={() => setZero(false)}>训练若干步后(B≠0)</button>
      </div>
      <div className="lyr">
        <div className="lyr-diagram">
          <div className="lbox io">x<small>输入</small></div>
          <span className="larrow">→</span>
          <div className="lpath">
            <div className="lbox frozen"><span className="ice">❄</span> W<small>冻结·不更新</small></div>
            <div className={zero ? 'lbypass off' : 'lbypass'}>
              <div className="lbox train" style={{ minWidth: 54 }}>A<small>压到 r</small></div>
              <span className="larrow" style={{ fontSize: 14 }}>→</span>
              <div className="lbox train" style={{ minWidth: 54 }}>{zero ? 'B=0' : 'B'}<small>{zero ? '置零' : '已学出'}</small></div>
            </div>
          </div>
          <span className="larrow">→</span>
          <div className="lbox sum">+</div>
          <span className="larrow">→</span>
          <div className="lbox io">y<small>输出</small></div>
        </div>
        <div className="formula">
          {zero ? (
            <>y = <span className="frz">W·x</span> + scaling·<span className="zero">0</span>·(A·x) = <span className="frz">W·x</span> <span style={{ color: 'var(--ink2)' }}>←完全等于 base</span></>
          ) : (
            <>y = <span className="frz">W·x</span> + scaling·<span className="trn">B·(A·x)</span> <span style={{ color: 'var(--ink2)' }}>←旁路带来 ΔW,底座 W 始终没变</span></>
          )}
        </div>
      </div>
      <div className="note">
        {zero ? (
          <><b>第 0 步:旁路输出恒为 0</b>,模型行为 = 原始 base(还停不下来、会跑题)。所以 LoRA 是从"和 base 完全一致"的起点出发,再慢慢把旁路学出来 —— 不会一上来就破坏底座。</>
        ) : (
          <><b>训练若干步后:</b>A、B 被梯度推动,旁路 <code>B·A</code> 学出一个小小的 <code>ΔW</code>,叠加到冻结的 <code>W</code> 上改变输出。<b>整个过程 W 一个数都没动</b>,改的只是这条旁路。</>
        )}
      </div>
      <div className="codepath">↳ 代码:<b>07_lora.py</b> 的 <b>LoRALinear.__init__</b>(<code>normal_(A)</code> + <code>zeros_(B)</code>)与 <b>inject_lora</b> 前的全量 <code>requires_grad=False</code></div>
      <Dig title="为什么是 B 置零,不是 A 置零?">
        只要 <code>A</code>、<code>B</code> 有<b>一个</b>是 0,乘积 <code>B·A</code> 就是 0,初始旁路都为 0 —— 这点上两者等价。{' '}
        但若<b>两个都置零</b>,反向传播时梯度也会卡住(谁都推不动谁),旁路永远学不起来。{' '}
        所以标准做法是<b>一个随机(A)、一个置零(B)</b>:既保证"初始 ΔW=0",又留出梯度通路让它能被训起来。
      </Dig>
      <div className="next-hint">↳ 下一步:除了"优化器只拿到 A、B",训练循环和 <code>06_sft.py</code> 一字不差。</div>
    </div>
  )
}

function Step4() {
  const live = useStepLive()
  const [epIdx, setEpIdx] = useState(-1)
  const [lit, setLit] = useState(-1)
  const [running, setRunning] = useState(false)
  const [settled, setSettled] = useState(false)
  const epRef = useRef(-1)
  const stageRef = useRef(0)

  useEffect(() => {
    if (!live || !running) return
    const id = window.setInterval(() => {
      const stage = stageRef.current
      setLit(stage)
      if (stage === 1) {
        const next = epRef.current + 1
        epRef.current = next
        setEpIdx(next)
      }
      const nextStage = stage + 1
      stageRef.current = nextStage
      if (nextStage > 3) {
        window.clearInterval(id)
        setRunning(false)
        setLit(-1)
        if (epRef.current >= LOSS_SEQ.length - 1) setSettled(true)
      }
    }, 360)
    return () => window.clearInterval(id)
  }, [live, running])

  useEffect(() => {
    if (live || !running) return
    if (stageRef.current <= 1) {
      epRef.current += 1
      setEpIdx(epRef.current)
    }
    stageRef.current = 4
    setLit(-1)
    setRunning(false)
    if (epRef.current >= LOSS_SEQ.length - 1) setSettled(true)
  }, [live, running])

  function runEpoch() {
    if (running) return
    if (epRef.current >= LOSS_SEQ.length - 1) {
      epRef.current = -1
      setEpIdx(-1)
      setSettled(false)
    }
    stageRef.current = 0
    setLit(-1)
    setRunning(true)
  }

  function resetEpoch() {
    epRef.current = -1
    setEpIdx(-1)
    setLit(-1)
    setSettled(false)
  }

  const lossText = epIdx < 0 ? '\u2014' : LOSS_SEQ[epIdx].toFixed(3)
  const label = epIdx < 0 ? '' : settled ? '收敛 · 回答段 loss ≈ 0.003(只训了 A、B)' : `第 ${epIdx} 个 epoch`
  return (
    <div className={styles.scope}>
      <h2>④ 训练循环:和 <code>06_sft.py</code> 逐字相同,只是优化器只拿到 A、B</h2>
      <p className="lead">
        <code>zero_grad → forward(算 loss) → backward → step</code> —— 一步没变。{' '}
        <Link to="/ch/sft#step-3" style={{ color: 'var(--accent)', textDecoration: 'none' }}>loss mask</Link>、对话模板、EOS 全照搬 06。{' '}
        唯一区别:交给 <code>AdamW</code> 的只有 <b>requires_grad=True 的 A、B</b>,{' '}
        <code>backward</code> 的梯度也只流到旁路,底座纹丝不动。点"跑一个 epoch"看真实 loss:
      </p>
      <div className="flow">
        <div className={lit === 0 ? 'fc on' : 'fc'}>zero_grad<small>梯度清零</small></div>
        <div className="fa">→</div>
        <div className={lit === 1 ? 'fc mask on' : 'fc mask'}>forward<small>算 loss(只回答段)</small></div>
        <div className="fa">→</div>
        <div className={lit === 2 ? 'fc on' : 'fc'}>backward<small>梯度→只到 A、B</small></div>
        <div className="fa">→</div>
        <div className={lit === 3 ? 'fc on' : 'fc'}>step<small>只更新 A、B</small></div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={running} onClick={runEpoch}>▶ 跑一个 epoch</button>
        <button type="button" className="btn" onClick={resetEpoch}>重置</button>
        <span className="hp-note">实测起点 <b>2.09</b> → 几个 epoch 内收敛到 <b>~0.003</b>(ckpt10b 上,几十秒)</span>
      </div>
      <div className="losswrap">
        <div>回答段 loss:<span className="lossval">{lossText}</span> <span className="hp-note">{label}</span></div>
        <div className="lossbars">
          {LOSS_SEQ.map((v, i) => (
            <div key={v} className={i === epIdx ? 'lb cur' : 'lb'} style={{ height: i <= epIdx ? `${(v / LOSS_SEQ[0]) * 100}%` : '0%' }} />
          ))}
        </div>
      </div>
      <div className="note">
        注意两个旋钮和第 8 章 SFT 反着调:LoRA 可训练参数少,通常用<b>更大的学习率</b>(<code>1e-3</code> vs 全量 <code>2e-5</code>)、{' '}
        <b>多过几遍数据</b>。底座本来就冻着,不怕学崩,可以大胆点。
      </div>
      <div className="codepath">↳ 代码:<b>07_lora.py</b> 的 <b>main</b> 训练循环 · <code>lora_params=[p for p in model.parameters() if p.requires_grad]</code> 只把它们交给优化器</div>
      <div className="next-hint">↳ 下一步:只动了 1% 参数,base 到底有没有真被调成会答题?</div>
    </div>
  )
}

function Step5() {
  const [sel, setSel] = useState(0)
  const item = SAMPLES[sel]
  return (
    <div className={styles.scope}>
      <h2>⑤ 训练前 vs 训练后:1% 参数,同款效果</h2>
      <p className="lead">
        下面是 <code>07_lora.py</code> 在 124M 上的<b>真实采样</b>。"训练前"是装了 LoRA 但 <code>B=0</code>(等价 base),{' '}
        "训练后"只更新了 A、B。重点和第 8 章一样:<b>有没有套上格式、有没有在 EOS 处停</b>。
      </p>
      <div className="ba-tabs">
        {SAMPLES.map((sample, i) => (
          <button key={sample.instr} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => setSel(i)}>指令 {i + 1}</button>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink2)', margin: '2px 0 8px' }}>[指令] {item.instr}</div>
      <div className="bubble base">
        <div className="bh">训练前 · base + 空 LoRA(B=0)</div>
        <div className="ans">{item.base} <Stop ok={item.baseStop} /></div>
      </div>
      <div className="bubble sft">
        <div className="bh">训练后 · LoRA(只训 A、B)</div>
        <div className="ans">{item.sft} <Stop ok={item.sftStop} /><br /><span className="hp-note">{item.tag}</span></div>
      </div>
      <div className="sub-h"><span className="badge">达标</span>玩具级 · 看机制不刷榜</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div><b>可训练参数 ≈ 0.94%</b>(1.18M / 125.7M),adapter 仅 <b>4.7MB</b> vs 完整 base 498MB。</div></li>
        <li><span className="ck">✓</span><div>回答段 loss 明显下降(实测 <b>2.09 → ~0.003</b>,再训到 60 epoch 已到 0.000),且训练前(B=0)输出确实等于 base。</div></li>
        <li><span className="ck">✓</span><div>只动 1% 参数,base 同样被调成<b>套格式、EOS 处主动停</b>;没训过的 "capital of Germany" 也答出 Berlin。</div></li>
      </ul>
      <div className="note">
        <b>诚实交代:</b>仍是玩具级(124M、16 条、纯英文),学到的是"答题姿态"而非可靠能力。{' '}
        有意思的是:同样 16 条数据,这次 LoRA 把 "I love cats" 译成了更准的 <b>"J'aime les chats."</b> ——{' '}
        别据此下"LoRA 比全量强"的结论,玩具规模波动很大,只说明<b>1% 参数足够拿下这点姿态改动</b>。
      </div>
      <div className="codepath">↳ 代码:<b>07_lora.py</b> 的 <b>chat</b> · 跑法:<code>python 07_lora.py --ckpt ../phase1-124m/ckpt10b/latest.pt --epochs 60</code></div>
      <div className="sub-h"><span className="badge">Q&A</span>常见疑问</div>
      <Dig title='训练完怎么用?adapter 要"合并"回底座吗?'>
        两种都行:① <b>推理时叠加</b> —— 加载原始 base,再挂上 adapter,前向时算 <code>Wx + scaling·BAx</code>(本关代码就是这样,一份底座可挂多个 adapter 切换任务);{' '}
        ② <b>合并</b> —— 把 <code>scaling·B·A</code> 直接加进 <code>W</code> 得到新权重(<code>W' = W + scaling·BA</code>),推理零额外开销,但就回到一份完整大模型、失去"可插拔"。
        <div className="note" style={{ marginTop: 10 }}>
          自己试第 ① 种(不训练,只加载):<br />
          <code>python 07_lora.py --ckpt ../phase1-124m/ckpt10b/latest.pt --load_lora ckpt_lora/lora.pt</code><br />
          它加载 498MB 的原始 base + 4.7MB 的 adapter(96 个旁路张量),底座一个数都不改, 直接就会按格式答题、在 EOS 处停 —— 那套"答题姿态"确实整个装在那 4.7MB 里。
        </div>
      </Dig>
      <Dig title="该给哪些层加 LoRA?为什么本关给了 4 个 Linear?">
        原始论文主要加在注意力的 q/v 上。工程上常见做法是给注意力 + MLP 的线性层都加,覆盖更广、效果更稳。{' '}
        本关 <code>inject_lora</code> 给每个 Block 的 <b>注意力 c_attn / c_proj</b> 和 <b>MLP c_fc / c_proj</b> 各挂一条(12 层 × 4 = 48 条)。{' '}
        <code>lm_head</code> 和 <code>wte</code> 权重绑定、属底座,不加。
      </Dig>
      <Dig title="下一关(第 10 章)会做什么?">
        第 8、9 关解决的都是"<b>会答题</b>"(SFT 任务,分别用全量 / LoRA 两种手段)。{' '}
        <b>第 10 章 · DPO</b> 进一步到"<b>答得合人意</b>"——{' '}
        <Term k="preference-alignment" name="偏好对齐 · preference alignment" def="让模型在'都能答'的多个回答里,更偏向人类更喜欢的那个。DPO 直接用偏好对(chosen/rejected)优化,不走 RL。">偏好对齐</Term>。{' '}
        机制见 <Link to="/ch/posttraining#step-5" style={{ color: 'var(--accent)' }}>白皮书:RLHF vs DPO</Link>。
      </Dig>
    </div>
  )
}

export function Lora() {
  const chapter = findChapter('lora')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="lora"
      title="手搓 LoRA:冻结底座,只训 1% 参数"
      subtitle={
        <>
          上一关 <Link to="/ch/sft" style={{ color: 'var(--accent)', textDecoration: 'none' }}>第 8 章 · SFT</Link> 是<b><Term k="full-finetune" name="全量微调 · full fine-tuning" def="更新模型的全部参数。它是一种「手段」(怎么改权重),不是一种任务 —— 既能做 SFT 也能做 DPO。">全量微调</Term></b> —— 124M 参数全更新。{' '}
          这一关换<b>手段</b>不换<b>任务</b>:还是同一件 SFT,但用{' '}
          <Term k="lora" name="LoRA · 低秩适配" def="冻结原权重,在每层旁边并联一条低秩小矩阵 B·A,只训练它。约 1% 参数拿到接近全量微调的效果。">LoRA</Term>
          {' '}—— <b>冻住底座</b>,只在每层旁边挂一条<b>低秩旁路</b> <code>B·A</code>,只训那 <b>~1%</b> 的新参数,存盘只是个几 MB 的{' '}
          <Term k="lora" name="adapter · 适配器" def="LoRA 训练得到的小权重包(只含 A、B)。用时把它叠回原始 base 即可,一份底座可挂多个 adapter。">adapter</Term>。{' '}
          配套代码 <code>phase2-sft-lora/07_lora.py</code>。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">base <b>124M</b> <i>整段冻结</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">r <b>8</b> · α <b>16</b> <i>旁路宽度/音量</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">可训练 <b>0.94%</b> <i>1.18M/125.7M</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">lr <b>1e-3</b> <i>比全量 SFT 大 50×</i></HpChip>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 手搓 LoRA · 通关</div>
          <div className="cs">你已经亲手冻结底座、挂上低秩旁路,用 1% 参数做完了 SFT,并看懂了 B=0 的小心机。下一关:<b>第 10 章 · DPO</b>。</div>
        </>
      }
    />
  )
}
