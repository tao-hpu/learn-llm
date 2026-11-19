import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import styles from './Posttraining.module.css'

const MODELS = [
  { nm: 'tiny(第1-3章)', p: 0.8e6, pl: '0.8M', d: 1e6, dl: '~1M 字符', me: false },
  { nm: '你的 124M', p: 124e6, pl: '124M', d: 10e9, dl: '10B token', me: true },
  { nm: '真实大模型', p: 100e9, pl: '数百 B', d: 5e12, dl: '数 T token', me: false },
]

function log10(x: number) { return Math.log10(x) }

function barWidths(key: 'p' | 'd') {
  const vals = MODELS.map((m) => log10(m[key]))
  const mn = Math.min(...vals) - 0.5
  const mx = Math.max(...vals) + 0.2
  return MODELS.map((m) => ((log10(m[key]) - mn) / (mx - mn)) * 100)
}

function Axis({ kind, picked, onPick }: { kind: 'p' | 'd'; picked: number | null; onPick: (i: number) => void }) {
  const widths = useMemo(() => barWidths(kind), [kind])
  const [grown, setGrown] = useState(() => MODELS.map(() => false))
  useEffect(() => {
    const ids = MODELS.map((_, i) => window.setTimeout(() => {
      setGrown((prev) => {
        const next = prev.slice()
        next[i] = true
        return next
      })
    }, 60 + i * 90))
    return () => { ids.forEach((id) => window.clearTimeout(id)) }
  }, [])
  return (
    <div className={styles.axbars}>
      {MODELS.map((m, i) => {
        const on = picked === null ? m.me : picked === i
        return (
          <div key={m.nm} className={on ? `${styles.axbar} ${styles.sel}` : styles.axbar} onClick={() => onPick(i)}>
            <span className={styles.nm}>{m.nm}</span>
            <div className={styles.trk}>
              <div className={`${styles.fl} ${kind === 'p' ? styles.p : styles.d}`} style={{ width: grown[i] ? `${widths[i]}%` : '0%' }} />
            </div>
            <span className={`${styles.vv} ${kind === 'p' ? styles.vp : styles.vd}`}>{kind === 'p' ? m.pl : m.dl}</span>
          </div>
        )
      })}
    </div>
  )
}

function Step1() {
  const [picked, setPicked] = useState<number | null>(null)
  const m = picked === null ? null : MODELS[picked]
  return (
    <>
      <h2>① 你练出来的,是一台"底座":两个独立的数字</h2>
      <p className="lead">
        描述一个模型,先分清两个<b>各管各、互不替代</b>的数字:<b>参数量</b>(模型多大 / 脑容量)和{' '}
        <b>训练数据量</b>(喂了多少 token / 读过多少书)。点下面任一行,看它在两个轴上的位置。
      </p>
      <div className="sub-h"><span className="badge">轴一</span>参数量 · 模型有多大</div>
      <Axis kind="p" picked={picked} onPick={setPicked} />
      <div className="sub-h"><span className="badge">轴二</span>训练数据 · 喂了多少 token</div>
      <Axis kind="d" picked={picked} onPick={setPicked} />
      <div className="note">
        {m ? (
          <>
            <b>{m.nm}</b>:参数量 <b style={{ color: '#3a63c0' }}>{m.pl}</b>(脑容量) × 训练数据 <b style={{ color: '#3f7d63' }}>{m.dl}</b>(读过多少书)。
            {m.me ? ' 这就是你练出来的那台 —— 两个数字各管各,不能合成一个。' : ' 和你的 124M 对比一下:两个轴是独立移动的。'}
          </>
        ) : (
          <>
            你的模型 = <b>参数量 124M</b>(GPT-2 small 配置)× <b>训练数据 10B token</b>(FineWeb-Edu)。
            这两个数字一个量"脑子多大",一个量"读过多少书",<b>不能互相换算、也不能合成一个数</b>。
          </>
        )}
      </div>
      <div className="sub-h"><span className="badge">身份</span>这台底座现在会 / 不会什么</div>
      <div className={styles.idcard}>
        <span className={styles.idtag}>✅ 会:<b>顺着上文续写</b></span>
        <span className={styles.idtag}>❌ 不会:听指令<b>答题</b></span>
        <span className={styles.idtag}>❌ 不会:<b>主动停下</b>(不知道何时该收尾)</span>
        <span className={styles.idtag}>🌐 只会:<b>英文</b>(语料全英文)</span>
      </div>
      <p className={`lead ${styles.leadGap}`}>
        <Term k="post-training" name="基座模型 · base model" def="只经过预训练的模型,只会续写,不会答题,也不知道何时停。要靠后训练(SFT / 偏好对齐)才会听话。">base 模型</Term>的本性就是
        "<Term k="post-training" name="预训练 · pre-training" def="在海量无标注文本上做『预测下一个 token』,让模型学会语言的统计规律。Phase 1 做的就是这一步。">预训练</Term>= 学会把话说得像"。让它"说得对、答得上、该停就停",是 Phase 2 要补的课。
      </p>
      <div className="next-hint">↳ 下一步:从"会续写"到"会听话",中间要经过哪几道工序?看后训练地图。</div>
    </>
  )
}

const STAGES: { head: ReactNode; sub: string; needClass: string; need: string; you?: boolean; detail: ReactNode; ask: string; out: string }[] = [
  {
    you: true,
    needClass: styles.must,
    need: '必需',
    head: '预训练 Pre-training',
    sub: '海量纯文本,学"预测下一个 token"。产出 = 只会续写的 base。',
    ask: 'The history of Rome',
    out: 'The history of Rome, particularly the last one, is quite fascinating…(顺着续写,停不下来)',
    detail: (
      <>
        <div className={styles.sdT}>STAGE 1 · 预训练</div>
        <div className={styles.sdBody}>
          <b>用什么数据:</b>海量无标注纯文本(本项目 FineWeb-Edu 10B token)。<br />
          <b>把模型改成:</b>会预测下一个 token,也就是"会续写"。知识和语言能力基本都在这一步学到。<br />
          <b>必需。</b>后面每一段都在它的权重上继续调,没有它就没有可调的模型。<br />
          <b>本项目:</b><Link to="/ch/pretraining#step-1">第 6 章 · 预训练 124M →</Link>(你已经做完)
        </div>
      </>
    ),
  },
  {
    needClass: styles.opt,
    need: '可选',
    head: <Term k="mid-training" name="中期训练 · mid-training" def="预训练之后、SFT 之前,换成更精选的数据(代码、数学、长文档)接着做『预测下一个 token』,或专门拉长上下文窗口。">中期训练</Term>,
    sub: '接着预训练,但换精选数据(代码、数学、长文档),或拉长上下文。',
    ask: '一份 3 万 token 的合同 + 一个问题',
    out: '能把整份合同读进来再答(训练前只读得下开头一段)',
    detail: (
      <>
        <div className={styles.sdT}>STAGE 2 · 中期训练</div>
        <div className={styles.sdBody}>
          <b>用什么数据:</b>比预训练更精选的文本:代码、数学、教材、长文档。<br />
          <b>把模型改成:</b>某些领域更强,或能读更长的输入(上下文窗口拉长)。loss 仍是"预测下一个 token"。<br />
          <b>可选。</b>大厂的模型普遍做,但它解决的是"底座不够强",不是"不会听话"。<br />
          <b>本项目:</b>本项目不做:124M 的目标是看懂机制,不追底座能力。
        </div>
      </>
    ),
  },
  {
    needClass: styles.usual,
    need: '常规',
    head: 'SFT 监督微调',
    sub: '「指令→回答」成对数据,教它听指令、按格式答、答完就停。',
    ask: '用户:把 “I love cats” 翻成法语',
    out: "助手:J'aime les chats.〈EOS〉(听指令、给答案、停)",
    detail: (
      <>
        <div className={styles.sdT}>STAGE 3 · SFT 监督微调</div>
        <div className={styles.sdBody}>
          <b>用什么数据:</b>「指令 → 理想回答」成对数据 + 对话模板,通常几万到几十万条。<br />
          <b>把模型改成:</b>听懂指令、按助手口吻回答、答完输出 EOS 停下。<br />
          <b>常规。</b>几乎所有对话模型都做。少数推理模型试过跳过它直接上 RL(见下方折叠)。<br />
          <b>本项目:</b><Link to="/ch/sft#step-1">第 8 章 · SFT →</Link>,省参数版见 <Link to="/ch/lora#step-1">第 9 章 · LoRA →</Link>
        </div>
      </>
    ),
  },
  {
    needClass: styles.usual,
    need: '常规',
    head: '偏好优化',
    sub: '"A 比 B 好"的比较数据,把回答调得更有用、更合口味。',
    ask: '同一问题:回答 A vs 回答 B',
    out: '学会"多产出 A 这类回答" —— 调的是偏好,不是对错',
    detail: (
      <>
        <div className={styles.sdT}>STAGE 4 · 偏好优化</div>
        <div className={styles.sdBody}>
          <b>用什么数据:</b>同一个问题的两个回答 + 判断"A 比 B 好",判断来自人或另一个模型。<br />
          <b>把模型改成:</b>在"都能答"的基础上,答得更有用、更安全、更合口味。<br />
          <b>常规。</b>SFT 只能教"照这个答案写",分不出两个都通顺的回答谁更好,这一段补的就是比较。<br />
          <b>本项目:</b><Link to="/ch/dpo#step-1">第 10 章 · DPO →</Link>;RLHF 路线见本章第 5 步
        </div>
      </>
    ),
  },
  {
    needClass: styles.opt,
    need: '推理模型常规',
    head: <Term k="rlvr" name="RLVR · 可验证奖励强化学习" def="Reinforcement Learning with Verifiable Rewards。奖励由程序判对错(答案对不对、测试过没过),不用人打分。推理模型的长思考主要靠它。">RLVR</Term>,
    sub: '数学、代码这类能自动判对错的题,模型自己做、程序判分。',
    ask: '37 + 48 = ?',
    out: '先写过程再给 85;判分器只看最后的 85 对不对',
    detail: (
      <>
        <div className={styles.sdT}>STAGE 5 · RLVR</div>
        <div className={styles.sdBody}>
          <b>用什么数据:</b>有标准答案的题(数学、代码),外加一个判分程序。<br />
          <b>把模型改成:</b>自己写出推理过程,只要最后答案被判对就得奖励,慢慢学会"多想几步"。<br />
          <b>推理模型常规,普通对话模型可选。</b>它只适用于能自动判对错的任务。<br />
          <b>本项目:</b><Link to="/ch/rlvr-grpo#step-1">第 21 章 · RLVR 与 GRPO →</Link>
        </div>
      </>
    ),
  },
  {
    needClass: styles.usual,
    need: '常规 · 贯穿',
    head: '安全训练',
    sub: '红队测试、拒答训练、上线后的输入输出分类器。',
    ask: '教我配一种危险的化学品',
    out: '拒绝具体步骤,说明风险,给出安全的替代信息',
    detail: (
      <>
        <div className={styles.sdT}>STAGE 6 · 安全训练</div>
        <div className={styles.sdBody}>
          <b>用什么数据:</b>红队测试找出的危险提问 + 合适的拒答或安全回答。<br />
          <b>把模型改成:</b>遇到有害请求时拒绝或给安全替代,正常请求照常回答。<br />
          <b>常规,而且贯穿全程。</b>拒答数据混在 SFT 与偏好数据里,上线后还有单独的分类器把关。<br />
          <b>本项目:</b>本项目不做:124M 没有足够能力产生需要拦截的内容。
        </div>
      </>
    ),
  },
]

function Step2() {
  const [cur, setCur] = useState(0)
  const stage = STAGES[cur]
  return (
    <>
      <h2>② 后训练地图:从预训练到安全训练</h2>
      <p className="lead">
        现代大模型是<b>一条流水线</b>下来的,你现在站在第一段的终点。每段右上角标了它是{' '}
        <span className={`${styles.need} ${styles.must}`}>必需</span>、<span className={`${styles.need} ${styles.usual}`}>常规</span>还是<span className={`${styles.need} ${styles.opt}`}>可选</span>。
        点每一段,看它<b>用什么数据、把模型改成什么样</b>,以及本项目在哪一章做它。
      </p>
      <div className={styles.pipe}>
        {STAGES.map((s, i) => (
          <div key={i} className={i === cur ? `${styles.pstage} ${styles.on}` : styles.pstage} onClick={() => setCur(i)}>
            {s.you && <span className={styles.youhere}>你在这</span>}
            <div className={styles.stn}>STAGE {i + 1} <span className={`${styles.need} ${s.needClass}`}>{s.need}</span></div>
            <div className={styles.sttitle}>{s.head}</div>
            <div className={styles.stsub}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div className={styles.stageDetail}>
        {stage.detail}
        <div className={styles.saybox}>
          <div className={`${styles.say} ${styles.ask}`}><div className={styles.sh}>输入</div><div className={styles.txt}>{stage.ask}</div></div>
          <div className={`${styles.say} ${styles.out}`}><div className={styles.sh}>这一段后,模型会</div><div className={styles.txt}>{stage.out}</div></div>
        </div>
      </div>
      <div className="note">
        <b>各段是叠加,不是替换。</b>每一段都在上一段的权重上继续调。本项目 Phase 2 做<b>第 3、4 段</b>,第 5 段在第 21 章。
      </div>
      <Dig title="SFT 能跳过吗?">
        能,但很少这么做。DeepSeek-R1-Zero(2025)没做 SFT,直接在基座上跑 <b>RLVR</b>,推理能力照样练出来了,
        只是输出常常中英混杂、可读性差。正式版 DeepSeek-R1 于是先补了一小段 SFT 做<b>冷启动</b>,再进 RL。
        所以 SFT 是惯例,不是硬性前提;只有预训练是真正必需的。
      </Dig>
      <Dig title="真实的训练是一段接一段走完的吗?">
        不完全是。SFT、偏好优化、RL 常常<b>交替跑好几轮</b>:每轮用上一轮的模型生成新数据,筛选后再训下一轮。
        安全训练也不单独排在最后,拒答数据混在 SFT 和偏好数据里,红队测试在每轮之后都做。
        这张地图画的是<b>每段解决什么问题</b>,不是严格的时间顺序。
      </Dig>
      <div className="next-hint">↳ 下一步:同样是"微调",为什么有人说"全量",有人说"LoRA"?那是另一个轴。</div>
    </>
  )
}

const CELLS: ReactNode[] = [
  <><b>任务=SFT,手段=全量微调。</b>更新模型<b>全部</b>参数去学答题。效果直接,但每个任务都要存一份完整模型,显存/硬盘开销大。→ 脚本 <code>06_sft.py</code>。</>,
  <><b>任务=SFT,手段=LoRA。</b>冻结主干,只训练旁挂的低秩 A·B 小矩阵去学答题。省显存、一个底座挂多个适配器。→ 脚本 <code>07_lora.py</code>。</>,
  <><b>任务=偏好对齐,手段=全量微调。</b>用全部参数在偏好对上做对齐。注意:DPO 是"任务",全量是"手段",两者正交。→ 脚本 <code>08_dpo.py</code>。</>,
  <><b>任务=偏好对齐,手段=LoRA。</b>旁路低秩矩阵上做偏好对齐,最省的对齐方式。→ 脚本 <code>08_dpo.py</code> 里一个开关即可。</>,
]

function Step3() {
  const [cell, setCell] = useState(0)
  const cells = [
    ['全量 SFT', '改全部权重学答题', '06_sft.py'],
    ['LoRA SFT', '冻主干,旁路学答题', '07_lora.py'],
    ['全量 DPO', '改全部权重学偏好', '08_dpo.py'],
    ['LoRA DPO', '旁路学偏好', '08_dpo.py'],
  ]
  return (
    <>
      <h2>③ 别混:"任务"和"手段"是两个正交的轴</h2>
      <p className="lead">
        <b>任务</b>(教什么:SFT / 偏好对齐)和<b>手段</b>(怎么改权重:全量微调 / LoRA)是<b>两件独立的事</b>。
        任何一个任务,都能用任意一种手段去做。点格子看每种组合是什么。
      </p>
      <div className={styles.grid2}>
        <div className={`${styles.gh} ${styles.corner}`} />
        <div className={`${styles.gh} ${styles.col}`}>全量微调<br /><span className={styles.ghSub}>更新所有参数</span></div>
        <div className={`${styles.gh} ${styles.col}`}>LoRA / PEFT<br /><span className={styles.ghSub}>只更新旁挂小矩阵</span></div>
        <div className={`${styles.gh} ${styles.row}`}>SFT</div>
        {cells.slice(0, 2).map((c, i) => (
          <button key={c[0]} type="button" className={i === cell ? `${styles.gcell} ${styles.cellSel}` : styles.gcell} onClick={() => setCell(i)}>
            <div className={styles.ct}>{c[0]}</div><div className={styles.cs}>{c[1]}</div><span className={styles.cscript}>{c[2]}</span>
          </button>
        ))}
        <div className={`${styles.gh} ${styles.row}`}>偏好对齐<br /><span className={styles.ghSub}>DPO</span></div>
        {cells.slice(2).map((c, i) => (
          <button key={c[0]} type="button" className={i + 2 === cell ? `${styles.gcell} ${styles.cellSel}` : styles.gcell} onClick={() => setCell(i + 2)}>
            <div className={styles.ct}>{c[0]}</div><div className={styles.cs}>{c[1]}</div><span className={styles.cscript}>{c[2]}</span>
          </button>
        ))}
      </div>
      <div className={styles.cellDetail}>{CELLS[cell]}</div>
      <div className="note">
        看这张表就懂两件事:① <b>"全量微调"只是一整列(一种手段)</b>,它能做 SFT 也能做 DPO ——
        所以"全量微调 = SFT"是把<b>手段</b>误当成了<b>任务</b>。② <b>"全量 vs LoRA"是同一件事换种省钱方式</b>,
        不是先后步骤,而是二选一。
      </div>
      <Dig title="三关的顺序为什么是 SFT → LoRA → DPO?">
        按"每关只加一个新东西"排的:<br />
        · <b>第 8 章 SFT</b> 换的是<b>任务</b>(教它答题),训练循环几乎等于 Phase 1 的预训练循环,
        新机制只有模板 / EOS / loss mask —— 所以放第一关,门槛最低。<br />
        · <b>第 9 章 LoRA</b> 任务不变(还是同一件 SFT),换的是<b>手段</b>,新零件是低秩旁路 B·A。
        任务不变才能把"手段"这一个变量单独看清。<br />
        · <b>第 10 章 DPO</b> 再换回<b>任务</b>(从会答到答得好),手段先用全量,加
        <code>--lora</code> 就补上第四格。
      </Dig>
      <div className="next-hint">↳ 下一步:SFT 到底改了什么?其实只在预训练的 loss 上动了三处。</div>
    </>
  )
}

const TOKS: { t: string; role: 'prompt' | 'resp'; sp?: boolean }[] = [
  { t: '<|user|>', role: 'prompt', sp: true },
  { t: 'Translate', role: 'prompt' }, { t: 'to', role: 'prompt' }, { t: 'French:', role: 'prompt' },
  { t: 'I', role: 'prompt' }, { t: 'love', role: 'prompt' }, { t: 'cats.', role: 'prompt' },
  { t: '<|assistant|>', role: 'prompt', sp: true },
  { t: "J'aime", role: 'resp' }, { t: 'les', role: 'resp' }, { t: 'chats.', role: 'resp' },
  { t: '<EOS>', role: 'resp', sp: true },
]

function Step4() {
  const [mode, setMode] = useState<'resp' | 'all'>('resp')
  return (
    <>
      <h2>④ SFT 机制:同一个 loss,只动三处</h2>
      <p className="lead">
        SFT 和预训练用的是<b>同一个</b><Term k="cross-entropy" name="交叉熵 · cross-entropy" def="预测下一个 token 的损失:正确 token 概率越高,loss 越低。预训练和 SFT 用的是同一个它。">交叉熵</Term>(预测下一个 token),没有新数学。
        改动只有三处:<b>① 数据换成「指令→回答」对、② 套对话模板并在结尾放 EOS、③ loss 只算回答那一段。</b>{' '}
        用这类指令数据做的 SFT 也叫<Term k="instruction-tuning" name="指令微调 · instruction tuning" def="用大量『指令 → 回答』数据做 SFT,让模型学会按指令做事。Google 的 FLAN 与 BigScience 的 T0(都在 2021 年)发现:训过足够多种指令任务后,模型对没见过的任务也能照指令完成。">指令微调</Term>。
        下面把整条样本拼出来,拨一下"loss 算在哪些 token 上"。
      </p>
      <div className="btn-row">
        <button type="button" className={mode === 'resp' ? 'btn primary' : 'btn'} onClick={() => setMode('resp')}>✅ 标准:只算回答</button>
        <button type="button" className={mode === 'all' ? 'btn primary' : 'btn'} onClick={() => setMode('all')}>对照:连指令也算</button>
      </div>
      <div className={styles.ribbon}>
        {TOKS.map((tk) => {
          const counted = mode === 'all' || tk.role === 'resp'
          const cls = [styles.tok, tk.role === 'prompt' ? styles.prompt : styles.resp, tk.sp ? styles.special : '', counted ? styles.counted : styles.skipped].filter(Boolean).join(' ')
          return <div key={tk.t + tk.role} className={cls}>{tk.t}<span className={styles.mk}>{counted ? '↑' : '×'}</span></div>
        })}
      </div>
      <div className={styles.legend}>
        <span><i style={{ color: 'var(--ink2)' }}>灰底</i> = 指令/模板(prompt)</span>
        <span><i style={{ color: '#8a3d23' }}>橙底</i> = 回答(response)</span>
        <span><i style={{ color: 'var(--accent)' }}>↑ 边框高亮</i> = 这个 token 算进 loss</span>
        <span><i style={{ color: '#b9b4a6' }}>×</i> = 标成 <code style={{ fontFamily: 'var(--mono)' }}>-100</code> 不算</span>
      </div>
      <div className="note">
        {mode === 'resp' ? (
          <><b>标准做法:</b>只有<b>回答段</b>(橙)算进 loss,指令/模板段(灰)标成 <code>-100</code> 被忽略。模型只学"给定指令该怎么答"。</>
        ) : (
          <><b>对照(不推荐):</b>连指令段也算 loss,模型会分心去学"生成用户的指令",答题质量下降。所以真实 SFT 一定把 prompt 段 mask 掉。</>
        )}
      </div>
      <div className={styles.cmp}>
        <div className={`${styles.cc} ${styles.good}`}>
          <h4>✅ 只算回答(标准做法)</h4>
          模型学的是"<b>给定这条指令,该怎么回答</b>"。prompt 段标成 <code>-100</code> 被忽略,梯度只来自回答。
        </div>
        <div className={`${styles.cc} ${styles.bad}`}>
          <h4>⚠️ 连指令也算(跑偏)</h4>
          模型还会去学"<b>怎么生成用户的指令</b>",注意力被带偏,答题质量下降。所以 prompt 一定要 mask。
        </div>
      </div>
      <div className="sub-h"><span className="badge">对照</span>预训练 vs SFT:只有两行不一样</div>
      <div className={styles.cmp}>
        <div className={styles.cc}>
          <h4>预训练</h4>
          loss:交叉熵 · 算 loss 的位置:<b>每个 token</b> · 数据:连续纯文本 · 学习率:较大
        </div>
        <div className={styles.cc}>
          <h4>SFT</h4>
          loss:<b>完全一样</b> · 算 loss 的位置:<b>只回答段</b> · 数据:指令→回答对+模板 · 学习率:<b>小 1~2 个量级</b>
        </div>
      </div>
      <Dig title="结尾那个 EOS 为什么重要?">
        base 模型的老毛病是<b>不会停</b>,会一直往下续写。SFT 在每条回答末尾放一个
        <code>&lt;EOS&gt;</code>(结束标记)并让它算进 loss,就是在教模型"答完就输出 EOS、然后停"。
        没有这一步,模型答完正事还会继续瞎扯。
      </Dig>
      <div className="next-hint">↳ 下一步:SFT 教会"能答",但答得"合不合人意"靠偏好对齐 —— RLHF 和 DPO 是什么关系?</div>
    </>
  )
}

function Step5() {
  const [route, setRoute] = useState<'dpo' | 'rlhf'>('dpo')
  return (
    <>
      <h2>⑤ 偏好对齐:同一个目标,两条不同的路</h2>
      <p className="lead">
        "偏好对齐"是<b>目标</b>(让回答更合人类口味),实现它有两条路。它们<b>共享数据</b>(都用"A 比 B 好"的人类偏好),
        但<b>手段不同</b>。点下面切换看两条路。
      </p>
      <div className={styles.routeTabs}>
        <button type="button" className={route === 'dpo' ? 'btn primary' : 'btn'} onClick={() => setRoute('dpo')}>DPO(本项目走这条)</button>
        <button type="button" className={route === 'rlhf' ? 'btn primary' : 'btn'} onClick={() => setRoute('rlhf')}>RLHF / PPO</button>
      </div>
      {route === 'dpo' ? (
        <>
          <div style={{ margin: '8px 0 2px' }}><span className={`${styles.tagrl} ${styles.no}`}>非 RL · 类监督</span></div>
          <div className={styles.flow}>
            <div className={`${styles.fc} ${styles.sup}`}>偏好对<small>chosen 好 / rejected 差</small></div>
            <div className={styles.fa}>→</div>
            <div className={`${styles.fc} ${styles.sup}`}>一个 DPO 损失<small>直接拉高 chosen、压低 rejected</small></div>
            <div className={styles.fa}>→</div>
            <div className={`${styles.fc} ${styles.sup}`}>更新模型<small>无奖励模型 / 无采样</small></div>
          </div>
          <div className="note">DPO:把偏好对直接喂进一个<b>类监督损失</b>,一步到位。没有奖励模型、没有在线采样、没有 RL 循环 —— 单机就能跑,实现简单。</div>
        </>
      ) : (
        <>
          <div style={{ margin: '8px 0 2px' }}><span className={`${styles.tagrl} ${styles.is}`}>真 · 强化学习(PPO)</span></div>
          <div className={styles.flow}>
            <div className={styles.fc}>偏好对</div>
            <div className={styles.fa}>→</div>
            <div className={`${styles.fc} ${styles.rl}`}>训奖励模型<small>给回答打分</small></div>
            <div className={styles.fa}>→</div>
            <div className={`${styles.fc} ${styles.rl}`}>PPO 循环<small>采样 rollout + 价值网络</small></div>
            <div className={styles.fa}>→</div>
            <div className={`${styles.fc} ${styles.rl}`}>更新模型<small>最大化奖励</small></div>
          </div>
          <div className="note">RLHF:先用偏好数据训一个<b>奖励模型</b>,再用 <b>PPO</b>(一种强化学习算法)让模型最大化奖励。要在线采样、要价值网络,工程量数倍。</div>
        </>
      )}
      <div className="note">
        关键澄清:<b>DPO 不是 PPO 的变体或衍生版</b>,它俩是实现"偏好对齐"的<b>两条平行路线</b> ——{' '}
        <Term k="rlhf" name="RLHF · 人类反馈强化学习" def="用强化学习做偏好对齐:先训一个奖励模型给回答打分,再用 PPO 让模型最大化这个分数。要采样 rollout、要价值网络,工程重。">RLHF</Term>{' '}
        走真<Term k="rlhf" name="强化学习 · RL" def="智能体通过『试错 + 奖励信号』来学策略。RLHF 用的 PPO 就是一种 RL 算法。">强化学习</Term>(<Term k="ppo" name="PPO · 近端策略优化" def="Proximal Policy Optimization(Schulman 等,2017),一种通用的强化学习算法。每步更新被裁剪住、不许一次改太多,所以训练稳定。RLHF 用它按奖励模型的分数更新模型。">PPO</Term>),{' '}
        <Term k="dpo" name="DPO · 直接偏好优化" def="Direct Preference Optimization。把 RLHF 的目标推成闭式解,直接在偏好对上做一个类监督损失,不需要奖励模型、不需要采样、不走 RL 循环。">DPO</Term>{' '}
        不走 RL(直接在偏好对上做类监督损失)。DPO 的卖点正是"<b>不用 RL 那套笨重机器,也能拿到 RLHF 的效果</b>"。
      </div>
      <div className="note">
        <b>本项目的取舍:</b>偏好对齐只做 <b>DPO</b>(轻、单机能跑、覆盖教学目标);RLHF / PPO 只在白皮书里讲清原理,{' '}
        <b>不写成脚本</b> —— 它要额外训奖励模型 + 在线采样,工程量数倍,对"理解偏好对齐"边际收益低。
      </div>
      <Dig title="RLHF 用 PPO 训练时,显存里要同时放几个模型?">
        四个:<br />
        · <b>主模型</b>:正在训的那个,负责生成回答;<br />
        · <b>参考模型</b>:SFT 后冻结的版本,用来算 <Term k="kl-penalty" name="KL 惩罚 · KL penalty" def="训练时额外扣的一项分:主模型的输出分布离参考模型越远,扣得越多。防止模型为了刷高奖励跑偏。">KL 惩罚</Term>,不让主模型偏离太远、去钻奖励模型的空子;<br />
        · <b><Term k="reward-model" name="奖励模型 · reward model" def="用『A 比 B 好』的偏好数据训出来的打分模型:输入一个回答,输出一个分数。RLHF 里由它代替人给每个回答打分。">奖励模型</Term></b>:给每个回答打分;<br />
        · <b>价值模型</b>(critic):估计"这个回答比平均水平好多少",帮 PPO 算更新方向。<br />
        DPO 只需要前两个。第 21 章的 <b>GRPO</b> 去掉了价值模型,改用同一道题一组回答的平均分当基线。
      </Dig>
      <div className="next-hint">↳ 下一步:除了 DPO 和 RLHF,还有 SFT、RLVR、蒸馏。它们之间是什么关系?用一张表放到一起看。</div>
    </>
  )
}

const METHODS: { d: ReactNode; dist: ReactNode }[] = [
  {
    d: <><b>RLHF / RLAIF:模型自己生成 + 信号是偏好。</b>先用偏好数据训一个奖励模型;模型现场生成回答,奖励模型打分,PPO 按分数更新。偏好由人给叫 RLHF(InstructGPT、早期 ChatGPT);由另一个模型按一套写好的原则来判叫 RLAIF,Anthropic 的 Constitutional AI(2022)是代表。→ 本章第 5 步</>,
    dist: <>RLAIF 里给回答排好坏的那个模型,就是教师。</>,
  },
  {
    d: <><b>DPO:现成数据 + 信号是偏好。</b>拿事先收集好的(好回答, 差回答)配对直接算损失,不训奖励模型,也不现场生成。优化的目标和 RLHF 相同。→ <Link to="/ch/dpo#step-1">第 10 章 · 08_dpo.py</Link></>,
    dist: <>教师当裁判给一批回答排好坏,得到偏好数据再做 DPO(偏好蒸馏)。Hugging Face 的 Zephyr(2023)用教师模型排好序的数据做 DPO,全程没有人工标注。</>,
  },
  {
    d: <><b>RLVR:模型自己生成 + 信号是对错。</b>模型自己解题,判分程序看最后答案对不对给奖励,再用 GRPO 或 PPO 更新。推理模型的长思考主要来自这一格。→ <Link to="/ch/rlvr-grpo#step-1">第 21 章 · 19_grpo.py</Link></>,
    dist: <>这一格本身不用教师:判分的是程序。另有一种"在线策略蒸馏",学生自己生成、教师逐 token 给分,形式上也落在左列。</>,
  },
  {
    d: <><b>SFT:现成数据 + 信号是标准答案。</b>照着「指令 → 回答」学,loss 和预训练是同一个交叉熵。→ <Link to="/ch/sft#step-1">第 8 章 · 06_sft.py</Link></>,
    dist: <>教师写答案、学生照学(数据蒸馏),是现在最常见的蒸馏。DeepSeek-R1 同时发布的几个小模型只做了这一步,没有跑 RL。</>,
  },
]

const LENS = ['none', 'rl', 'pref', 'distill'] as const
const LENS_CELLS: Record<(typeof LENS)[number], number[]> = {
  none: [],
  rl: [0, 2],
  pref: [0, 1],
  distill: [0, 1, 2, 3],
}

function Step6() {
  const [lens, setLens] = useState<(typeof LENS)[number]>('none')
  const [sel, setSel] = useState(-1)
  const names = ['RLHF / RLAIF', 'DPO', 'RLVR', 'SFT']
  const grid = [
    ['RLHF / RLAIF', '奖励模型打分,PPO 更新', '本章第 5 步'],
    ['DPO', '好坏配对直接算损失', '08_dpo.py'],
    ['RLVR', '程序判对错,GRPO 更新', '19_grpo.py'],
    ['SFT', '照标准答案学', '06_sft.py'],
  ]
  let detail: ReactNode
  if (sel >= 0) {
    detail = <>{METHODS[sel].d}{lens === 'distill' && <><br /><b>蒸馏在这一格:</b>{METHODS[sel].dist}</>}</>
  } else if (lens === 'distill') {
    detail = (
      <>
        <b>蒸馏 = 四格都可能出现。</b>它说的是信号来自一个更强的教师模型,跟用哪种方法训无关:
        <ul>
          {[3, 1, 0, 2].map((i) => <li key={i}><b>{names[i]}:</b>{METHODS[i].dist}</li>)}
        </ul>
      </>
    )
  } else if (lens === 'rl') {
    detail = <><b>强化学习 = 左列。</b>判据只有一个:训练时模型自己生成回答,再按得到的分数调整。分数来自奖励模型(RLHF)、另一个模型(RLAIF)还是程序(RLVR),都属于强化学习。</>
  } else if (lens === 'pref') {
    detail = <><b>偏好优化 = 上行。</b>它说的是信号的形态是"A 比 B 好"的比较,不指某种算法。同一种信号既能走强化学习(RLHF),也能不走(DPO)。</>
  } else {
    detail = <>两个问题定一格:① 训练时模型自己生成回答吗?② 信号是"A 比 B 好"的比较吗?点格子看每一格是什么。</>
  }
  return (
    <>
      <h2>⑥ 一张表分清:SFT、DPO、RLHF、RLVR</h2>
      <p className="lead">
        SFT、DPO、RLHF、<Term k="rlaif" name="RLAIF · AI 反馈强化学习" def="Reinforcement Learning from AI Feedback。和 RLHF 流程相同,只是『哪个回答更好』改由另一个模型按一套写好的原则来判,减少人工标注。">RLAIF</Term>、RLVR,
        都能用两个问题定位:<b>① 训练时模型自己生成回答吗?② 信号是"A 比 B 好"的比较吗?</b>{' '}
        点格子看每一格是什么;再点上面的标签,看"强化学习""偏好优化""<Term k="distillation" name="蒸馏 · distillation" def="训练信号来自一个更强的教师模型:教师写答案、当裁判或逐 token 给分,学生照此学习。它说的是信号的来源,SFT、DPO、RL 都能拿来做蒸馏。">蒸馏</Term>"各覆盖哪几格。
      </p>
      <div className="btn-row">
        {(['不加标签', '强化学习', '偏好优化', '蒸馏'] as const).map((label, i) => (
          <button key={label} type="button" className={lens === LENS[i] ? 'btn primary' : 'btn'} onClick={() => { setLens(LENS[i]); setSel(-1) }}>{label}</button>
        ))}
      </div>
      <div className={styles.grid2}>
        <div className={`${styles.gh} ${styles.corner}`} />
        <div className={`${styles.gh} ${styles.col}`}>模型自己生成回答<br /><span className={styles.ghSub}>= 强化学习</span></div>
        <div className={`${styles.gh} ${styles.col}`}>拿现成数据训<br /><span className={styles.ghSub}>= 非强化学习</span></div>
        <div className={`${styles.gh} ${styles.row}`}>信号:<br />A 比 B 好</div>
        {grid.slice(0, 2).map((c, i) => {
          const lit = LENS_CELLS[lens].includes(i)
          const on = sel === i
          return (
            <button key={c[0]} type="button" className={[styles.mcell, lit ? styles.lit : '', on ? styles.cellSel : ''].filter(Boolean).join(' ')} onClick={() => setSel(i)}>
              <div className={styles.ct}>{c[0]}</div><div className={styles.cs}>{c[1]}</div><span className={styles.cscript}>{c[2]}</span>
            </button>
          )
        })}
        <div className={`${styles.gh} ${styles.row}`}>信号:<br />标准答案 / 对错</div>
        {grid.slice(2).map((c, i) => {
          const idx = i + 2
          const lit = LENS_CELLS[lens].includes(idx)
          const on = sel === idx
          return (
            <button key={c[0]} type="button" className={[styles.mcell, lit ? styles.lit : '', on ? styles.cellSel : ''].filter(Boolean).join(' ')} onClick={() => setSel(idx)}>
              <div className={styles.ct}>{c[0]}</div><div className={styles.cs}>{c[1]}</div><span className={styles.cscript}>{c[2]}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.cellDetail}>{detail}</div>
      <div className="note">
        <b>三个标签各管一个维度:</b>强化学习看训练时模型自己生成不生成,偏好优化看信号是不是比较,蒸馏看信号是不是来自教师模型。一种训练方法可以同时带好几个标签。
      </div>
      <Dig title="PPO、GRPO 和 RLHF、RLVR 是什么关系?">
        RLHF、RLAIF、RLVR 说的是<b>奖励从哪来</b>:人的偏好、AI 的判断、程序的判定。
        PPO、GRPO 是<b>算法</b>,说的是拿到奖励之后怎么更新模型。两边可以任意搭配:
        早期的 RLHF 用 PPO;AI2 的 Tülu 3(2024,RLVR 这个名字出自这篇)用 PPO 做 RLVR;DeepSeek-R1 用 GRPO 做 RLVR。
      </Dig>
      <Dig title={'最早的"知识蒸馏"学的是什么?'}>
        Hinton 等人(2015)提出时,学生学的不是"正确答案是哪个词",而是教师在每个位置给<b>所有词的概率分布</b>,
        用 KL 散度衡量两个分布的差距。分布里带着"第二可能的词是什么"这类信息,比单个正确答案多。
        这种做法要拿到教师的 logits,两个模型的词表也得一样,所以多用在同一家机构自己的大小模型之间。它落在右下格:不走强化学习,信号也不是偏好。
      </Dig>
      <Dig title="自蒸馏是什么?">
        教师和学生是<b>同一个模型</b>:先让它在更有利的条件下作答(多采样几次挑出答对的、给更多提示或换一种更顺手的格式),
        再拿这些回答训练它在普通条件下的表现。用的训练方法通常就是 SFT。
      </Dig>
      <div className="next-hint">↳ 下一步:这些落到本项目的哪几个脚本?用哪个底座?训成什么样算达标?</div>
    </>
  )
}

function Step7() {
  return (
    <>
      <h2>⑦ Phase 2 路线图 · 底座 · 达标标准</h2>
      <p className="lead">
        把前面的概念落到<b>三个脚本</b>。每个脚本对应一个值得手搓的新机制,合起来覆盖"任务 × 手段"那张表。
      </p>
      <div className={styles.scards}>
        <div className={styles.scard}>
          <div className={styles.sf}>06_sft.py</div>
          <div className={styles.stt}>全量 SFT</div>
          <div className={styles.sd}>新机制:对话模板 / EOS / loss mask。在 124M 上跑通"会答题"。</div>
          <Link className={styles.done} to="/ch/sft#step-1">已上线 · 第 8 章 →</Link>
        </div>
        <div className={styles.scard}>
          <div className={styles.sf}>07_lora.py</div>
          <div className={styles.stt}>手搓 LoRA + LoRA SFT</div>
          <div className={styles.sd}>新机制:低秩 A·B 旁路、冻结主干。只训 ~1% 参数拿到同款效果。</div>
          <Link className={styles.done} to="/ch/lora#step-1">已上线 · 第 9 章 →</Link>
        </div>
        <div className={styles.scard}>
          <div className={styles.sf}>08_dpo.py</div>
          <div className={styles.stt}>DPO(全量 / LoRA 开关)</div>
          <div className={styles.sd}>新机制:偏好对比损失。一个文件覆盖全量 DPO 和 LoRA DPO。</div>
          <Link className={styles.done} to="/ch/dpo#step-1">已上线 · 第 10 章 →</Link>
        </div>
      </div>
      <div className="note">
        <b>底座沿用 124M,不往上加。</b> 目标是"看懂机制 + 看到行为变化",124M 完全够演示;
        放大只增加成本、不增加新知识点。(注意:124M 是<b>英文玩具级</b>,SFT 后是"像在答题"而非能真聊天;
        想要能中文对话的助手是另一条线,得换含中文的开源底座。)
      </div>
      <div className="note">
        地图第 5 段 <b>RLVR</b> 不在 Phase 2:它在 <Link to="/ch/rlvr-grpo#step-1" className={styles.inkLink}>第 21 章</Link>(<code>19_grpo.py</code>)用 GRPO 教 124M 做两位数加法。
      </div>
      <div className="sub-h"><span className="badge">达标</span>训成什么样算到位(玩具级 · 看行为,不刷榜)</div>
      <ul className={styles.checklist}>
        <li><span className={styles.ck}>✓</span><div><b>SFT 达标:</b>回答段 loss 明显下降;套上模板给指令,模型产出"回答形状"并<b>在 EOS 处停下</b>(不再无限续写);在训过的玩具指令上大致扣题。</div></li>
        <li><span className={styles.ck}>✓</span><div><b>LoRA 达标:</b>只训约 1% 参数,拿到接近全量 SFT 的同款行为变化;能亲眼看到可训练参数量差一两个数量级。</div></li>
        <li><span className={styles.ck}>✓</span><div><b>DPO 达标:</b>chosen 回答相对 rejected 的 logprob(reward margin)上升;采样更偏 chosen 风格。</div></li>
      </ul>
      <div className="sub-h"><span className="badge">Q&A</span>开工前的常见疑问</div>
      <Dig title={'"参数量 124M"和"训练数据 10B"到底哪个是模型大小?'}>
        <b>参数量 124M 才是模型大小</b>(脑容量),10B 是喂进去的 token 数(读过多少书)。两个数字各管各:
        同样 124M 的模型,喂 0.3B 和喂 10B,脑子一样大,但后者"读得多、说得好"。它们不能互相换算。
      </Dig>
      <Dig title="全量微调和 LoRA,是要先做一个再做另一个吗?">
        不是先后,是<b>二选一</b>:做某一次微调,要么全量、要么 LoRA。本项目两个都写,纯粹是为了<b>对照着学</b>
        (看 LoRA 怎么用 ~1% 参数逼近全量效果),不是流程上必须先全量再 LoRA。
      </Dig>
      <Dig title="偏好对齐就是强化学习吗?DPO 算 RL 吗?">
        偏好对齐是<b>目标</b>,不等于 RL。实现它有两条路:<b>RLHF 走 RL(PPO)</b>,<b>DPO 不走 RL</b>(直接在偏好对上做类监督损失)。
        所以 DPO 不算强化学习,也不是 PPO 的变体,而是绕开 RL 的另一条路。
      </Dig>
      <Dig title="SFT 之后,这个 124M 能跟我聊天了吗?">
        能"像在答题",但<b>别期待真能基础沟通</b>。124M 是非常小的模型,且只见过英文。SFT 让它学会答题的<b>格式与姿态</b>,
        产出是玩具级。要一个能流畅对话(尤其中文)的助手,得换更大、且预训练含中文的开源底座 —— 那是另一条线。
      </Dig>
    </>
  )
}

export function Posttraining() {
  const chapter = findChapter('posttraining')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />, <Step6 />, <Step7 />]
  return (
    <ChapterShell
      slug="posttraining"
      title="Phase 2 开篇 · 后训练白皮书"
      subtitle={
        <>
          Phase 1 练出来的是一台只会<b>续写</b>的<Term k="post-training" name="基座模型 · base model" def="只经过预训练、还没对齐的模型。它学会的是『把话说得像』,只会顺着上文接着写,不会听指令答题。">底座模型</Term>。
          这一页是 Phase 2 的<b>地图与术语对齐</b>:从"会续写"到"会听话"要经过哪几步、有哪两个容易混的轴、{' '}
          <Term k="sft" name="SFT · 监督微调" def="用『指令→理想回答』成对数据继续训练,把底座调成会听指令答题的姿态。和预训练用同一个 loss,只是数据和算 loss 的范围变了。">SFT</Term> 到底改了什么、{' '}
          <Term k="preference-alignment" name="偏好对齐 · preference alignment" def="让模型的回答更合人类口味的阶段。有两条路:RLHF(走强化学习)和 DPO(不走强化学习)。">偏好对齐</Term>里 RLHF 和 DPO 是什么关系,以及 SFT、DPO、RLHF、RLVR、蒸馏在一张表上各占哪一格。先建立全景,再去写代码。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">底座 <b>GPT-2 124M</b> <i>参数量/脑容量</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">训练数据 <b>10B token</b> <i>读过多少书</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">语言 <b>英文 base</b> <i>只见过英文</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">目标 <b>会听话答题</b> <i>SFT 起步</i></HpChip>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 Phase 2 地图已对齐</div>
          <div className="cs">你已经分清:参数量 vs 数据量 · 后训练各段必需与否 · 任务 vs 手段 · SFT 改了哪三处 · RLHF vs DPO · 各种训练方法在两轴表上的位置。接下来就是 <code>06_sft.py</code> 动手。</div>
        </>
      }
    />
  )
}
