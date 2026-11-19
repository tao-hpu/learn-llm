// 旧页 goto 不重置偏好对、滑块和训练下标。离开第 4 步只停「跑到收敛」计时器，进度保留。
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Dpo.module.css'

const PREF = [
  {
    instr: 'What is the capital of France?',
    chosen: 'The capital of France is Paris.',
    rejected: 'Why are you asking me that? Look it up yourself.',
  },
  {
    instr: 'Rewrite politely: give me the report.',
    chosen: 'Could you please send me the report?',
    rejected: 'Give me the report right now.',
  },
  {
    instr: 'Write a short greeting.',
    chosen: 'Hello! It is nice to meet you.',
    rejected: 'What do you want?',
  },
  {
    instr: 'What is 2 + 2?',
    chosen: '2 + 2 = 4.',
    rejected: 'That is a really stupid question, but fine, it is 4.',
  },
]

const BA = [
  {
    instr: 'Rewrite politely: give me the report.',
    before: '"Hello."',
    after: '"Could you please send me the report?"',
    tag: '明显往 chosen 风格靠 ✓(SFT 起点本就没答好)',
  },
  {
    instr: 'Write a short greeting.',
    before: '"Hello! It is nice to meet you."',
    after: '"Hello! It is nice to meet you!"',
    tag: '保持得体 · 风格稳定',
  },
  {
    instr: 'What is 2 + 2?',
    before: '"2 + 2 = 4."',
    after: '"2 + 2 = 16."',
    tag: '玩具级副作用:DPO 轻微扰动了已有知识 ⚠',
  },
]

const BETA = 0.1
const EP = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
const LOSS = [0.6931, 0.6140, 0.5408, 0.4737, 0.4131, 0.3588, 0.3106, 0.2683, 0.2313, 0.1991, 0.1712]
const MARG = [0, 1.669, 3.404, 5.205, 7.069, 8.992, 10.967, 12.986, 15.041, 17.125, 19.226]
const ACC = [0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
const REWC = [0, 0.003, 0.005, 0.007, 0.008, 0.008, 0.008, 0.006, 0.002, -0.003, -0.009]
const REWR = [0, -0.164, -0.335, -0.514, -0.699, -0.891, -1.089, -1.293, -1.502, -1.715, -1.932]
const REW_MAX = 2

function sig(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function Step1() {
  const [sel, setSel] = useState(0)
  const p = PREF[sel]
  return (
    <div className={styles.scope}>
      <h2>① 同一个问题,两个都"答到了",但有好坏之分</h2>
      <p className="lead">SFT 之后,模型已经会答题了。可"会答"不等于"答得好" —— 同一条指令,它可能给出好几种都说得通的回答, 但有的<b>礼貌/简洁/得体</b>,有的<b>生硬/啰嗦/冒犯</b>。偏好对齐要做的,就是让它<b>更偏向左边那种</b>。 点切换看几组真实偏好对(<code>08_dpo.py</code> 的训练数据):</p>
      <div className="ba-tabs">
        {PREF.map((item, i) => (
          <button key={item.instr} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => setSel(i)}>偏好对 {i + 1}</button>
        ))}
      </div>
      <div className="instr">[指令] {p.instr}</div>
      <div className="pref">
        <div className="ans-card chosen">
          <div className="h">✓ chosen(更合人意)<span className="pill up">想抬高</span></div>
          <div className="a">{p.chosen}</div>
        </div>
        <div className="ans-card rejected">
          <div className="h">✗ rejected(更差)<span className="pill down">想压低</span></div>
          <div className="a">{p.rejected}</div>
        </div>
      </div>
      <div className="note">注意:这里<b>两个回答都不是"错字病句"</b>,纯是<b>偏好</b>之分 —— 这正是 SFT 难覆盖的部分。 SFT 教"标准答案长什么样";偏好对齐教"在多个合理答案里挑人更喜欢的那个"。所以它接在 SFT <b>之后</b>。</div>
      <div className="codepath">↳ 代码:<b>08_dpo.py</b> 的 <b>PREF</b> 列表(指令, chosen, rejected)</div>
      <div className="next-hint">↳ 下一步:怎么在不训奖励模型的情况下,给"哪个更好"打分?DPO 的巧办法。</div>
    </div>
  )
}

function Step2() {
  return (
    <div className={styles.scope}>
      <h2>② 两个模型 + 一个"隐式奖励"</h2>
      <p className="lead">RLHF 的做法是先训一个<Link to="/ch/posttraining#step-5" style={{ color: 'var(--accent)', textDecoration: 'none' }}>奖励模型</Link>打分、再用 RL 去最大化分数,链路长。 DPO 把这步<b>省掉</b>:它只用两个模型,"分数"直接从这两个模型的概率差里读出来。</p>
      <div className="duo">
        <div className="mdl policy">
          <div className="mt">policy(要训练)</div>
          <div className="big">π<sub>θ</sub></div>
          <div className="md">从 SFT 模型出发,<br />DPO 会更新它</div>
        </div>
        <div className="mdl ref">
          <div className="mt">❄ ref(冻结)</div>
          <div className="big">π<sub>ref</sub></div>
          <div className="md">SFT 模型的副本,<br />永不更新,当锚点</div>
        </div>
      </div>
      <div className="rewardbox">
        某条回答 y 的<b>隐式奖励</b> r(y) = <span className="trn">β · ( logπ<sub>θ</sub>(y) − logπ<sub>ref</sub>(y) )</span>
        <div className="hp-note" style={{ marginTop: 8 }}>= "policy 比 ref <b>多给</b>了这条回答多少对数概率" × β</div>
      </div>
      <div className="note">不需要额外的奖励模型:<b>"policy 相对 ref 把某条回答抬高了多少"本身就是分数</b>。 ref 当锚点的意义是 —— 只奖励"<b>相对变化</b>",防止 policy 为了刷分而整体跑偏、把语言能力学崩。 一条回答的 <code>logπ</code> 就是它每个 token 的 log 概率之和(<b>只算 response 段</b>,和 <Link to="/ch/sft#step-3" style={{ color: 'var(--accent)', textDecoration: 'none' }}>SFT 的 loss mask</Link> 同一套)。</div>
      <div className="codepath">↳ 代码:<b>08_dpo.py</b> 的 <b>seq_logprob</b>(只累加 response 段)+ <b>main</b> 里 policy / ref 两份模型</div>
      <div className="next-hint">↳ 下一步:有了两条回答各自的分数,DPO 的 loss 只是想让它俩"拉开差距"。</div>
    </div>
  )
}

function Step3() {
  const [dc, setDc] = useState(0.1)
  const [dr, setDr] = useState(0)
  const margin = dc - dr
  const prob = sig(BETA * margin)
  const loss = -Math.log(Math.max(prob, 1e-9))
  return (
    <div className={styles.scope}>
      <h2>③ DPO loss:把 chosen 的分数拉到 rejected 之上</h2>
      <p className="lead">记 Δ = logπ<sub>θ</sub> − logπ<sub>ref</sub>(policy 相对 ref 的偏移)。DPO 想让 <b>chosen 的 Δ 高于 rejected 的 Δ</b>。 loss 就是个二分类的 logistic 形式 —— 拨动下面两个滑块(模拟训练把它俩推开),看 loss 怎么掉:</p>
      <div className="calc">
        <div className="rk-row">
          <label className="c">Δ chosen(往右=抬高)</label>
          <input type="range" min={-1} max={4} step={0.1} value={dc} onChange={(e) => setDc(Number(e.target.value))} />
          <span className="rk-val">{dc.toFixed(1)}</span>
        </div>
        <div className="rk-row">
          <label className="r">Δ rejected(往左=压低)</label>
          <input type="range" min={-20} max={2} step={0.1} value={dr} onChange={(e) => setDr(Number(e.target.value))} />
          <span className="rk-val">{dr.toFixed(1)}</span>
        </div>
        <div className="formula">loss = −log σ( <span className="b">β</span>·( <span className="c">Δc</span> − <span className="r">Δr</span> ) ) = −log σ( 0.1·( <span className="c">{dc.toFixed(1)}</span> − (<span className="r">{dr.toFixed(1)}</span>) ) )</div>
        <div className="stat-grid">
          <div className="stat hi"><div className="sv">{(margin >= 0 ? '+' : '') + margin.toFixed(1)}</div><div className="sl">margin = Δc − Δr</div></div>
          <div className="stat"><div className="sv">{(prob * 100).toFixed(0)}%</div><div className="sl">σ(β·margin)=把 chosen 排前面的概率</div></div>
          <div className="stat hi"><div className="sv">{loss.toFixed(3)}</div><div className="sl">loss = −log σ(β·margin)</div></div>
        </div>
      </div>
      <div className="note"><b>读出三件事:</b>① margin 越大 → loss 越小;② 起点 policy≡ref 时 Δc=Δr=0、margin=0、loss=<code>ln2≈0.693</code>(瞎猜); ③ 把 <b>rejected 往左压</b>和把 <b>chosen 往右抬</b>都能拉大 margin —— 实测里 DPO 主要靠<b>压低 rejected</b>(下一步会看到)。 β 固定 0.1:它是"放大镜",margin 同样大、β 越大 loss 反应越猛。</div>
      <div className="codepath">↳ 代码:<b>08_dpo.py</b> 的 <b>dpo_pass</b>:<code>loss = -F.logsigmoid(beta*(d_chosen - d_rejected))</code></div>
      <div className="next-hint">↳ 下一步:真跑起来,看这条 margin 怎么被一步步拉开。</div>
    </div>
  )
}

function Step4() {
  const live = useStepLive()
  const [epIdx, setEpIdx] = useState(-1)
  const [running, setRunning] = useState(false)
  const epRef = useRef(-1)
  const timer = useRef<number | null>(null)

  function setEp(i: number) {
    epRef.current = i
    setEpIdx(i)
  }

  function stopTimer() {
    if (timer.current != null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    setRunning(false)
  }

  useEffect(() => {
    if (live) return
    stopTimer()
  }, [live])

  useEffect(() => () => {
    if (timer.current != null) window.clearInterval(timer.current)
  }, [])

  function stepEpoch() {
    const next = epRef.current >= LOSS.length - 1 ? 0 : epRef.current + 1
    setEp(next)
  }

  function runAll() {
    if (timer.current != null) return
    if (epRef.current >= LOSS.length - 1) setEp(-1)
    setRunning(true)
    timer.current = window.setInterval(() => {
      const i = epRef.current + 1
      setEp(i)
      if (i >= LOSS.length - 1) {
        if (timer.current != null) window.clearInterval(timer.current)
        timer.current = null
        setRunning(false)
      }
    }, 420)
  }

  function resetEpoch() {
    stopTimer()
    setEp(-1)
  }

  const shown = epIdx < 0 ? 0 : epIdx
  const rc = REWC[shown]
  const rr = REWR[shown]
  return (
    <div className={styles.scope}>
      <h2>④ 训练起来:loss 往下、margin 往上</h2>
      <p className="lead">把全部 10 条偏好对的梯度累起来更新一次 policy(ref 始终不动),这就是一个 epoch。 点"跑一个 epoch"看 <code>08_dpo.py</code> 的<b>真实曲线</b> —— 留意两条奖励:谁动得多?</p>
      <div className="losswrap">
        <div className="readout">
          <div className="ro"><div className="rv" style={{ color: 'var(--accent)' }}>{LOSS[shown].toFixed(3)}</div><div className="rl">loss</div></div>
          <div className="ro"><div className="rv" style={{ color: 'var(--accent)' }}>{'+' + MARG[shown].toFixed(1)}</div><div className="rl">margin (Δc−Δr)</div></div>
          <div className="ro"><div className="rv" style={{ color: '#3f7d63' }}>{ACC[shown]}%</div><div className="rl">偏好准确率</div></div>
        </div>
        <div className="lossbars">
          {LOSS.map((v, i) => (
            <div key={i} className={i === epIdx ? 'lb cur' : 'lb'} style={{ height: i <= epIdx ? `${(v / LOSS[0]) * 100}%` : '0%' }} />
          ))}
        </div>
        <div className="hp-note" style={{ marginTop: 6 }}>{epIdx >= 0 ? `第 ${EP[epIdx]} 个 epoch${epIdx === LOSS.length - 1 ? ' · 收敛' : ''}` : ''}</div>
      </div>
      <div className="rewbars">
        <div className="hp-note" style={{ marginBottom: 4 }}>两条回答的隐式奖励(相对 ref,中线=0):</div>
        <div className="rrow">
          <span className="rname" style={{ color: '#3f7d63' }}>chosen</span>
          <div className="track"><div className="midline" /><div className="fillp" style={{ width: `${(Math.max(0, rc) / REW_MAX) * 50}%` }} /><div className="filln" style={{ width: 0 }} /></div>
          <span className="rnum" style={{ color: '#3f7d63' }}>{(rc >= 0 ? '+' : '') + rc.toFixed(2)}</span>
        </div>
        <div className="rrow">
          <span className="rname" style={{ color: '#9a3a22' }}>rejected</span>
          <div className="track"><div className="midline" /><div className="fillp" style={{ width: 0 }} /><div className="filln" style={{ width: `${(Math.max(0, -rr) / REW_MAX) * 50}%` }} /></div>
          <span className="rnum" style={{ color: '#9a3a22' }}>{(rr >= 0 ? '+' : '') + rr.toFixed(2)}</span>
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn primary" disabled={running} onClick={stepEpoch}>▶ 跑一个 epoch</button>
        <button type="button" className="btn" onClick={runAll}>跑到收敛</button>
        <button type="button" className="btn" onClick={resetEpoch}>重置</button>
      </div>
      <div className="note"><b>关键观察(实测):</b>margin(Δc−Δr,<b>logπ 单位</b>)一路从 0 拉到 <b>+19</b> —— 换算成<b>奖励 margin</b> 就是 β·19 ≈ <b>+1.9</b>(正好等于下方 chosen≈0 与 rejected≈−1.9 两条奖励之差)。 它<b>几乎全靠把 rejected 的奖励往下压</b>(降到约 −1.9),chosen 的奖励基本贴着 0 没怎么动。这是 DPO 常见现象 —— "对齐"很多时候是<b>学会少说不好的</b>,而非多说好的。 所以 lr 要<b>极小</b>(<code>5e-7</code>)、配 ref 当锚,否则 policy 会把 rejected 压垮、连带把语言能力带崩。</div>
      <div className="codepath">↳ 代码:<b>08_dpo.py</b> 的 <b>main</b> 训练循环 · 真实曲线 loss 0.693→0.171 / margin 0→+19 / 准确率 0%→100%</div>
      <div className="next-hint">↳ 下一步:训完采样,看回答风格有没有往 chosen 那边靠。</div>
    </div>
  )
}

function Step5() {
  const [sel, setSel] = useState(0)
  const b = BA[sel]
  return (
    <div className={styles.scope}>
      <h2>⑤ 训练前 vs 训练后 & 达标</h2>
      <p className="lead">下面是 <code>08_dpo.py</code> 的<b>真实采样</b>(起点=SFT 模型,终点=DPO 后)。 偏好对齐的变化常常很微妙,但有的指令上能看到明显往 chosen 风格靠:</p>
      <div className="ba-tabs">
        {BA.map((item, i) => (
          <button key={item.instr} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => setSel(i)}>指令 {i + 1}</button>
        ))}
      </div>
      <div className="instr">[指令] {b.instr}</div>
      <div className="bubble base">
        <div className="bh">DPO 前 · SFT 模型</div>
        <div className="ans">{b.before} <span className="stoptag yes">⟨EOS,主动停⟩</span></div>
      </div>
      <div className="bubble sft">
        <div className="bh">DPO 后</div>
        <div className="ans">{b.after} <span className="stoptag yes">⟨EOS,主动停⟩</span><br /><span className="hp-note">{b.tag}</span></div>
      </div>
      <div className="sub-h"><span className="badge">达标</span>玩具级 · 看硬指标不看刷榜</div>
      <ul className="checklist">
        <li><span className="ck">✓</span><div>DPO loss 从 <b>ln2≈0.693 稳步下降到 0.171</b>(不再"瞎猜")。</div></li>
        <li><span className="ck">✓</span><div><b>偏好准确率 0% → 100%</b>:隐式奖励把每一对的 chosen 都排到了 rejected 前面。</div></li>
        <li><span className="ck">✓</span><div><b>margin(Δc−Δr)0 → +19</b>(换算成奖励 margin = β·19 ≈ +1.9),主要由"压低 rejected"驱动;部分指令采样可见往 chosen 风格靠(如礼貌改写)。</div></li>
      </ul>
      <div className="note"><b>诚实交代:</b>玩具级(124M、10 对、纯英文)。采样里 "What is 2 + 2?" 训练后甚至答成了 "16" —— DPO 在这么小的规模会<b>轻微扰动已有知识</b>。所以这一关里"DPO 起作用"的可靠证据是 <b>loss↓ / 准确率↑ / margin↑ 这些硬指标</b>,而不是某一条采样文字。</div>
      <div className="codepath">↳ 跑法:<code>python 08_dpo.py --ckpt ckpt_sft/sft.pt --epochs 20</code> · 加 <code>--lora</code> 改用 LoRA 手段做 DPO</div>
      <div className="sub-h"><span className="badge">Q&A</span>常见疑问</div>
      <Dig title="DPO 和 RLHF 到底什么关系?DPO 是 PPO 的变体吗?">
        都是为了<b>偏好对齐</b>这同一个目标,但是<b>两条不同的路</b>,DPO <b>不是</b> PPO 的变体。 RLHF 先训奖励模型、再用 PPO 这类 RL 算法去最大化奖励(要采样、要在线交互); DPO 用数学推导证明:在同样的目标下,可以<b>跳过奖励模型和 RL</b>,把它等价成一个直接在偏好对上做的<b>监督式分类 loss</b>。 更省、更稳,是目前开源对齐的主流做法之一。详见 <Link to="/ch/posttraining#step-5" style={{ color: 'var(--accent)' }}>白皮书 step 5</Link>。
      </Dig>
      <Dig title="为什么训练里 chosen 的奖励几乎不涨,全靠压 rejected?">
        因为 chosen 本来就是 SFT 模型<b>已经倾向</b>给出的回答(它的 logπ 本就不低),抬升空间小; 而 rejected 那种冒犯/啰嗦的回答,模型压低它的概率要"容易"得多。 DPO 的 loss 只关心 <b>两者之差(margin)</b>,从哪边把差距拉开都行 —— 优化器自然挑了阻力最小的那条:<b>压 rejected</b>。
      </Dig>
      <Dig title="那 第 8 章(全量 SFT)、第 9 章(LoRA)、第 10 章(DPO)三者怎么拼?">
        <b>任务 × 手段是两个正交的轴</b>(<Link to="/ch/posttraining#step-3" style={{ color: 'var(--accent)' }}>白皮书的 2×2 表</Link>): 任务有 SFT(会答)/ 偏好对齐(答得好);手段有 全量 / LoRA。 第 8 章=全量×SFT,第 9 章=LoRA×SFT,第 10 章=全量×DPO。本关加 <code>--lora</code> 就补上了 LoRA×DPO 那一格 —— 四格都能跑通,证明两轴可自由组合。 典型生产流水线就是:<b>预训练 → SFT → 偏好对齐</b>,每步都可选全量或 LoRA。
      </Dig>
    </div>
  )
}

export function Dpo() {
  const chapter = findChapter('dpo')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="dpo"
      title={'手搓 DPO:从"会答"到"答得合人意"'}
      subtitle={<>手搓三关的收尾。第 8、9 关用 SFT 把 base 教成<b>会答题</b>;这一关换<b>任务</b> —— <Term k="preference-alignment" name="偏好对齐 · preference alignment" def="让模型在'都能答'的多个回答里,更偏向人类更喜欢的那个(更礼貌/简洁/得体)。">偏好对齐</Term>。 用 <Term k="dpo" name="DPO · 直接偏好优化" def="Direct Preference Optimization。不训奖励模型、不走 RL,直接用偏好对(chosen/rejected)做分类式优化。">DPO</Term>: <b>不训奖励模型、不走 RL</b>,拿一份冻结的<b>参考模型</b>当锚,直接把"chosen 比 rejected 好"这件事用一个 sigmoid loss 学进去。 配套代码 <code>phase2-sft-lora/08_dpo.py</code>。</>}
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">起点 <b>SFT 模型</b> <i>06 的产物</i></HpChip>
          <HpChip color="#6b6b68" bg="#ECE9E0">ref <b>冻结</b> <i>SFT 的副本·当锚</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">β <b>0.1</b> <i>能偏多远</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">偏好对 <b>10</b> · <i>不走 RL</i></HpChip>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 手搓 DPO · 通关 · Phase 2 手搓三关全部拿下</div>
          <div className="cs">你已经亲手用 SFT(全量 / LoRA)把 base 教成会答题,又用 DPO 把它对齐到"答得合人意"。预训练 → SFT → 对齐,一条龙都摸过了一遍。</div>
        </>
      }
    />
  )
}
