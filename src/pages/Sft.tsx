// 旧页 goto 不重置样本选择、epoch 进度和对比指令。
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { findChapter } from '../chapters'
import { ChapterShell, useStepLive } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Sft.module.css'

const DASH = ' \u2014\u2014 '

const SAMPLES = [
  { instr: 'What is the capital of France?', resp: 'The capital of France is Paris.' },
  { instr: 'Translate to French: I love cats.', resp: "J'aime les chats." },
  { instr: 'What is 2 + 2?', resp: '2 + 2 = 4.' },
  { instr: 'Name three fruits.', resp: 'Three fruits are apple, banana, and orange.' },
]

const BA = [
  {
    instr: 'What is the capital of France?',
    base: '"For the purposes of this article, we do not consider the capital of France as the capital of the states. In fact\u2026"',
    sft: '"The capital of France is Paris."',
    tag: '训练里见过 · 答对 + 停',
  },
  {
    instr: 'Translate to French: I love cats.',
    base: '"For more information about this topic, you may want to search our database of books and articles on cats\u2026"',
    sft: '"J\'aime leur."',
    tag: '玩具级 · 略偏但有格式 + 停',
  },
  {
    instr: 'What is the capital of Germany?  (训练里没见过)',
    base: '"For the purposes of this article, we do not consider the capital of Germany as the capital of Germany, but as the\u2026"',
    sft: '"The capital of Germany is Berlin."',
    tag: '没训过 · 套用了格式还答对了',
  },
]

const LOSS = [2.16, 1.32, 0.85, 0.58, 0.4, 0.31, 0.28, 0.22, 0.18, 0.15]

function SampleButtons({ sel, onPick }: { sel: number; onPick: (i: number) => void }) {
  return (
    <div className="btn-row">
      <span className="hp-note" style={{ marginRight: 4 }}>换样本:</span>
      {SAMPLES.map((s, i) => (
        <button key={s.instr} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => onPick(i)}>样本 {i + 1}</button>
      ))}
    </div>
  )
}

function TemplateView({ instr, resp }: { instr: string; resp: string }) {
  return (
    <div className={styles.tmpl}>
      <span className={`${styles.seg} ${styles.segMark}`}>{'### Instruction:\n'}</span>
      <span className={`${styles.seg} ${styles.segInstr}`}>{instr}</span>
      <span className={`${styles.seg} ${styles.segMark}`}>{'\n\n### Response:\n'}</span>
      <span className={`${styles.seg} ${styles.segResp}`}>{resp}</span>
      <span className={`${styles.seg} ${styles.segEos}`}>{'<|endoftext|>'}</span>
    </div>
  )
}

function MaskRibbon({ instr, resp }: { instr: string; resp: string }) {
  const prompt = ['###', 'Instruction:', ...instr.split(' '), '###', 'Response:']
  const answer = [...resp.split(' '), '<EOS>']
  return (
    <div className={styles.ribbon}>
      {prompt.map((t, i) => (
        <div key={`p${i}`} className={`${styles.tok} ${styles.prompt}`}>{t}<span className={styles.mk}>×</span></div>
      ))}
      {answer.map((t, i) => (
        <div key={`r${i}`} className={t === '<EOS>' ? `${styles.tok} ${styles.resp} ${styles.special}` : `${styles.tok} ${styles.resp}`}>{t}<span className={styles.mk}>↑</span></div>
      ))}
    </div>
  )
}

function Step1() {
  return (
    <>
      <h2>① 起点:同一个问题,base 只会跑题、停不下来</h2>
      <p className="lead">
        Phase 1 的 124M 是个<Term k="post-training" name="基座模型 · base model" def="只经过预训练、只会续写的模型。不认指令、不会停。">base</Term>{DASH}它只会"顺着上文接着写"。你问它问题,它不答,而是把你的问题当开头继续编,直到撞上长度上限才被<b>强行截断</b>。 下面是 <code>06_sft.py</code> 训练<b>前</b>对 base 的真实采样:
      </p>
      <div className={`${styles.bubble} ${styles.base}`}>
        <div className={styles.bh}>指令 → base 的"回答"(实测)</div>
        <div className={styles.ans}>
          What is the capital of France?<br />{'→ "For the purposes of this article, we do not consider the capital of France as the capital of the states. In fact\u2026" '}<span className={`${styles.stoptag} ${styles.stopNo}`}>没停 · 被长度上限截断</span>
        </div>
      </div>
      <div className={`${styles.bubble} ${styles.sft}`}>
        <div className={styles.bh}>我们想要的样子</div>
        <div className={styles.ans}>
          What is the capital of France?<br />{'→ "The capital of France is Paris." '}<span className={`${styles.stoptag} ${styles.stopYes}`}>答完 · 主动停</span>
        </div>
      </div>
      <div className="note">
        base 不是"笨",它只是<b>没学过"被问就该答、答完就停"这件事</b>。这恰恰是 SFT 要教的。 而且注意:它续写里冒出来的 "capital / France" 说明<b>知识预训练时就有了</b>,SFT 不灌新知识,只拧"回答的姿态"。
      </div>
      <div className="next-hint">↳ 下一步:要教它,先得把"指令 + 理想回答"拼成一条它能学的训练样本。</div>
    </>
  )
}

function Step2() {
  const [sel, setSel] = useState(0)
  const sample = SAMPLES[sel]
  return (
    <>
      <h2>② 拼一条训练样本:对话模板 + EOS</h2>
      <p className="lead">
        SFT 的数据是<b>「指令 → 回答」成对</b>的。要喂给模型,得先用一个<b>固定模板</b>把它俩拼成一条序列, 并在回答末尾放一个 <b>EOS</b>。点下面换不同样本,看它怎么被拼起来:
      </p>
      <SampleButtons sel={sel} onPick={setSel} />
      <TemplateView instr={sample.instr} resp={sample.resp} />
      <div className={styles.legend}>
        <span><i className={`${styles.seg} ${styles.segMark}`}>模板标记</i> 标出"哪段是指令、哪段该我答"</span>
        <span><i className={`${styles.seg} ${styles.segInstr}`}>指令</i></span>
        <span><i className={`${styles.seg} ${styles.segResp}`}>回答</i></span>
        <span><i className={`${styles.seg} ${styles.segEos}`}>EOS</i> 答完就停</span>
      </div>
      <div className="note">
        <b>模板标记用什么文字不重要,重要的是"全程一致"。</b> 真实 chat 模型常用 <code>{'<|user|>'}</code>/<code>{'<|assistant|>'}</code>; <code>06_sft.py</code> 用的是 Alpaca 风格的纯文字模板 <code>### Instruction / ### Response</code>{DASH}好处是<b>不必给词表加新 token</b>(vocab 保持 50304、权重绑定不变)。EOS 直接复用 GPT-2 的 <code>{'<|endoftext|>'}</code>(id 50256)。
      </div>
      <div className={styles.codepath}>↳ 代码:<b>06_sft.py</b> 的 <b>PROMPT_TEMPLATE</b> + <b>build_example</b></div>
      <div className="next-hint">↳ 下一步:整条都喂进去,但 loss 只能算"回答"那一段{DASH}这是 SFT 唯一的新动作。</div>
    </>
  )
}

function Step3() {
  const [sel, setSel] = useState(0)
  const sample = SAMPLES[sel]
  return (
    <>
      <h2>③ loss mask:整条都看,但只对"回答"算账</h2>
      <p className="lead">
        把拼好的序列喂进模型做<Link to="/ch/transformer#step-1" style={{ color: 'var(--accent)', textDecoration: 'none' }}>前向</Link>, 每个位置都会预测"下一个 token"。但我们<b>只对落在"回答段"的预测算 loss</b>, 指令/模板段的标签全标成 <code>-100</code>{DASH}PyTorch 的 <code>cross_entropy</code> 默认 <code>ignore_index=-100</code>,会自动跳过它们。
      </p>
      <SampleButtons sel={sel} onPick={setSel} />
      <MaskRibbon instr={sample.instr} resp={sample.resp} />
      <div className={styles.legend}>
        <span><i style={{ color: 'var(--ink2)' }}>灰底 ×</i> = 指令/模板,标签 <code style={{ fontFamily: 'var(--mono)' }}>-100</code>,不算 loss</span>
        <span><i style={{ color: '#8a3d23' }}>橙底 ↑</i> = 回答,算 loss</span>
      </div>
      <div className="note">
        <b>为什么只算回答?</b> 我们要教的是"<b>给定指令,该怎么答</b>"。如果连指令段也算 loss, 模型会分心去学"怎么生成用户的指令",注意力被带偏、答题质量下降。所以指令段必须 mask 掉。 <b>回答末尾的 EOS 也算 loss</b>{DASH}这正是它学会"答完就停"的地方。
      </div>
      <div className={styles.codepath}>↳ 代码:<b>06_sft.py</b> 的 <b>build_example</b> 里 <code>labels = [-100]*len(prompt_ids) + resp_ids</code></div>
      <Dig title={'那个 "错位一格"(x = full[:-1], y = labels[1:])是怎么回事?'}>
        语言模型是"用第 i 个 token 预测第 i+1 个"。所以输入 <code>x</code> 取整条序列去掉最后一个, 标签 <code>y</code> 取整条往左挪一格。掩码也跟着挪:第一个"回答 token"由"最后一个指令 token"预测出来, 这一对<b>要算 loss</b>(它是"从指令跨进回答"的关键一步);再往前的、预测指令内部 token 的位置,才是 -100。 这和 Phase 1 里 <code>x=chunk[:-1], y=chunk[1:]</code> 的错位是同一套,只是 y 多了 -100 掩码。
      </Dig>
      <div className="next-hint">↳ 下一步:有了带掩码的 (x, y),训练循环就和预训练几乎一模一样了。</div>
    </>
  )
}

function Step4() {
  const live = useStepLive()
  const [epIdx, setEpIdx] = useState(-1)
  const [lit, setLit] = useState(-1)
  const [running, setRunning] = useState(false)
  const epRef = useRef(-1)
  const stageRef = useRef(0)
  const runningRef = useRef(false)
  const timerRef = useRef(0)

  useEffect(() => {
    if (!live || !running) return
    timerRef.current = window.setInterval(() => {
      const stage = stageRef.current
      if (stage === 1) {
        const next = epRef.current + 1
        epRef.current = next
        setEpIdx(next)
      }
      const after = stage + 1
      stageRef.current = after
      if (after > 3) {
        window.clearInterval(timerRef.current)
        setLit(-1)
        runningRef.current = false
        setRunning(false)
      } else {
        setLit(stage)
      }
    }, 360)
    return () => window.clearInterval(timerRef.current)
  }, [live, running])

  function runEpoch() {
    if (runningRef.current) return
    if (epRef.current >= LOSS.length - 1) {
      epRef.current = -1
      setEpIdx(-1)
    }
    stageRef.current = 0
    setLit(-1)
    runningRef.current = true
    setRunning(true)
  }

  function resetEpoch() {
    epRef.current = -1
    setEpIdx(-1)
    setLit(-1)
  }

  const finished = epIdx >= LOSS.length - 1 && !running
  const epLabel = epIdx < 0 ? '' : finished ? '收敛 · 回答段 loss ≈ 0.15(已学会格式)' : `第 ${epIdx} 个 epoch`
  const lossText = epIdx < 0 ? '\u2014' : LOSS[epIdx].toFixed(2)
  const fc = (i: number, mask = false) => {
    const names = [styles.fc]
    if (mask) names.push(styles.mask)
    if (lit === i) names.push(styles.on)
    return names.join(' ')
  }

  return (
    <>
      <h2>④ 训练循环:就是预训练那个循环 + 一个掩码</h2>
      <p className="lead">
        SFT 的循环和 Phase 1 的 <code>04_gpt2_124m.py</code> 几乎逐字相同: <code>zero_grad → forward(算 loss) → backward → step</code>。唯一的差别是 forward 里的 loss <b>只来自回答段</b>(靠上一步的 -100 掩码)。点"跑一个 epoch"看回答段 loss 怎么掉:
      </p>
      <div className={styles.flow}>
        <div className={fc(0)}>zero_grad<small>梯度清零</small></div>
        <div className={styles.fa}>→</div>
        <div className={fc(1, true)}>forward<small>算 loss(只回答段)</small></div>
        <div className={styles.fa}>→</div>
        <div className={fc(2)}>backward<small>反向求梯度</small></div>
        <div className={styles.fa}>→</div>
        <div className={fc(3)}>step<small>更新权重</small></div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={running} onClick={runEpoch}>▶ 跑一个 epoch</button>
        <button type="button" className="btn" onClick={resetEpoch}>重置</button>
        <span className="hp-note">实测起点 <b>2.16</b> → 收敛到 <b>~0.15</b>(ckpt10b 上,几十秒)</span>
      </div>
      <div className={styles.losswrap}>
        <div>回答段 loss:<span className={styles.lossval}>{lossText}</span>{epLabel ? <>{' '}<span className="hp-note">{epLabel}</span></> : null}</div>
        <div className={styles.lossbars}>
          {LOSS.map((v, i) => (
            <div key={i} className={i === epIdx ? `${styles.lb} ${styles.cur}` : styles.lb} style={{ height: i <= epIdx ? `${(v / LOSS[0]) * 100}%` : '0%' }} />
          ))}
        </div>
      </div>
      <div className="note">
        和预训练比,SFT 只改两个旋钮:<b>学习率小 1~2 个量级</b>(<code>2e-5</code> vs 预训练 <code>6e-4</code>,别把底座学崩)、 <b>只过几遍数据</b>(epoch 少,数据少容易过拟合)。其余{DASH}优化器、反向、裁剪{DASH}全照搬。
      </div>
      <div className={styles.codepath}>↳ 代码:<b>06_sft.py</b> 的 <b>main</b> 训练循环 + <b>make_batches</b>(右侧补位用 -100,不产生梯度)</div>
      <div className="next-hint">↳ 下一步:训完再问一遍同样的问题{DASH}看行为有没有真的变。</div>
    </>
  )
}

function Step5() {
  const [sel, setSel] = useState(0)
  const item = BA[sel]
  return (
    <>
      <h2>⑤ 训练前 vs 训练后:行为真的变了</h2>
      <p className="lead">
        下面是 <code>06_sft.py</code> 在 124M 上的<b>真实采样</b>(同一指令、同一随机种子)。 点切换看每条指令训练前后的差别{DASH}重点不在"答得多对",而在<b>有没有套上格式、有没有在 EOS 处停下</b>。
      </p>
      <div className={styles.baTabs}>
        {BA.map((row, i) => (
          <button key={row.instr} type="button" className={i === sel ? 'btn primary' : 'btn'} onClick={() => setSel(i)}>指令 {i + 1}</button>
        ))}
      </div>
      <div className={styles.instr}>[指令] {item.instr}</div>
      <div className={`${styles.bubble} ${styles.base}`}>
        <div className={styles.bh}>训练前 · base</div>
        <div className={styles.ans}>{item.base}{' '}<span className={`${styles.stoptag} ${styles.stopNo}`}>没停 · 被截断</span></div>
      </div>
      <div className={`${styles.bubble} ${styles.sft}`}>
        <div className={styles.bh}>训练后 · SFT</div>
        <div className={styles.ans}>{item.sft}{' '}<span className={`${styles.stoptag} ${styles.stopYes}`}>⟨EOS,主动停⟩</span><br /><span className="hp-note">{item.tag}</span></div>
      </div>
      <div className="sub-h"><span className="badge">达标</span>玩具级 · 看行为不刷榜</div>
      <ul className={styles.checklist}>
        <li><span className={styles.ck}>✓</span><div><b>回答段 loss 明显下降</b>(实测 2.16 → 0.15)。</div></li>
        <li><span className={styles.ck}>✓</span><div>套上模板给指令,模型产出<b>"回答形状"并在 EOS 处主动停下</b>(不再无限续写)。</div></li>
        <li><span className={styles.ck}>✓</span><div>在训过的指令上大致扣题;甚至对<b>没训过</b>的 "capital of Germany" 也套用了格式(格式会泛化)。</div></li>
      </ul>
      <div className="note">
        <b>诚实交代:</b>这是玩具级。翻译那条 "J'aime leur." 就不太准{DASH}16 条数据、124M、只见过英文, 学到的是<b>回答的姿态与格式</b>,不是可靠的知识/能力。要能真聊天得换更大、含中文的底座(另一条线)。
      </div>
      <div className={styles.codepath}>↳ 代码:<b>06_sft.py</b> 的 <b>chat</b>(碰到 EOS 就 break)· 跑法:<code>python 06_sft.py --ckpt ../phase1-124m/ckpt10b/latest.pt --epochs 30</code></div>
      <div className="sub-h"><span className="badge">Q&A</span>常见疑问</div>
      <Dig title={'SFT 会不会把预训练学到的东西"洗掉"?'}>
        会有一点(叫"灾难性遗忘"),所以才用<b>很小的学习率 + 很少的 epoch</b>,轻轻拧、别学崩。 从结果也看得出:SFT 后它还知道 Paris、Berlin{DASH}知识基本还在,只是被套上了"答题"的姿态。
      </Dig>
      <Dig title="为什么用 16 条就能看出变化?真实 SFT 要多少?">
        16 条是为了<b>演示机制</b>:格式和"停"这种<b>姿态</b>很容易学,几十步就上身。 真实的指令微调通常要<b>几千到几十万条</b>高质量数据,才能覆盖各种任务、答得有用。这里只求"看见机制",不求能力。
      </Dig>
      <Dig title="接下来两关会做什么?">
        <b>第 9 章 · 手搓 LoRA</b>:这一关是<b>全量微调</b>(更新全部参数);下一关改成只训旁挂的低秩小矩阵,~1% 参数拿到同款效果。 <b>第 10 章 · DPO</b>:从"会答"进一步到"答得合人意"(偏好对齐)。机制见 <Link to="/ch/posttraining#step-3" style={{ color: 'var(--accent)' }}>白皮书的任务×手段表</Link>。
      </Dig>
    </>
  )
}

export function Sft() {
  const chapter = findChapter('sft')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="sft"
      title="SFT:把 base 调成会答题"
      subtitle={
        <>
          <Link to="/ch/posttraining#step-4" style={{ color: 'var(--accent)', textDecoration: 'none' }}>白皮书</Link>讲了 SFT 的轮廓,这一关动手把它跑通{DASH}直接拿 Phase 1 的 <b>124M base</b> 做监督微调。一句话打底:<b>SFT 和预训练用<Term k="cross-entropy" name="交叉熵 · cross-entropy" def="预测下一个 token 的损失。预训练和 SFT 用的是同一个它,没有新数学。">同一个 loss</Term>,只动三处</b>{DASH}<Term k="chat-template" name="对话模板 · chat template" def="把指令和回答按固定格式拼成一条序列的模板,并在结尾放 EOS 教模型停。">模板</Term>、 <Term k="chat-template" name="EOS · 结束标记" def={"<|endoftext|>(id 50256)。放在每条回答末尾,教模型答完就停。"}>EOS</Term>、 <Term k="loss-mask" name="loss mask · 标签掩码" def="整条序列都喂进去,但只对回答段算 loss,指令段标成 -100 被忽略。">loss mask</Term>。 配套代码 <code>phase2-sft-lora/06_sft.py</code>。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">base <b>124M</b> <i>Phase1 训的底座</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">数据 <b>16 条</b> <i>玩具指令对</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">lr <b>2e-5</b> <i>比预训练小30×</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">EOS <b>50256</b> <i>教它停</i></HpChip>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 SFT · 监督微调 · 通关</div>
          <div className="cs">你已经把 base 亲手调成了"会答题、会停"的模型,并看懂了模板 / loss mask / EOS。下一关:<b>第 9 章 · 手搓 LoRA</b>。</div>
        </>
      }
    />
  )
}
