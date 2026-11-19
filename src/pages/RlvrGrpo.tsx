import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import { rlvrData as D } from './rlvrData'
import styles from './RlvrGrpo.module.css'
import { useState } from 'react'

const pct = (v: number) => (v * 100).toFixed(1) + '%'

function withBold(text: string): ReactNode[] {
  const parts = text.split(/(<b>|<\/b>)/)
  const out: ReactNode[] = []
  let bold = false
  for (const part of parts) {
    if (part === '<b>') { bold = true; continue }
    if (part === '</b>') { bold = false; continue }
    out.push(bold ? <b key={out.length}>{part}</b> : part)
  }
  return out
}

function showSample(t: string) {
  return t.replace(/\n$/, '').replace(/^ /, '␣')
}

const PRE = [
  [1, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 0, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
]
const ARM = [
  ['sft', 'SFT', '#3a63c0', '标准答案'],
  ['dpo', 'DPO', '#a3548c', '判分器挑的偏好对'],
  ['grpo', 'GRPO', '#D97757', '判分器当场打分'],
] as const

function advOf(r: number[]) {
  const n = r.length
  const m = r.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1))
  return { m, sd, a: r.map((x) => (x - m) / (sd + 1e-4)) }
}

function LineChart({ series, xmax, xticks, xlabel }: {
  series: { pts?: [number, number][]; col: string; dash?: boolean; hline?: number }[]
  xmax: number
  xticks: number[]
  xlabel: string
}) {
  const W = 620
  const H = 240
  const L = 44
  const R = 14
  const T = 14
  const B = 34
  const xs = (v: number) => L + (v / xmax) * (W - L - R)
  const ys = (v: number) => T + (1 - v) * (H - T - B)
  const ysTicks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', fontFamily: 'ui-monospace, monospace' }}>
      {ysTicks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={ys(v)} y2={ys(v)} stroke="#E5E2D9" />
          <text x={L - 6} y={ys(v) + 4} fontSize="10.5" textAnchor="end" fill="#6B6B68">{Math.round(v * 100)}%</text>
        </g>
      ))}
      {xticks.map((v) => <text key={v} x={xs(v)} y={H - B + 15} fontSize="10.5" textAnchor="middle" fill="#6B6B68">{v}</text>)}
      <text x={(L + W - R) / 2} y={H - 4} fontSize="10.5" textAnchor="middle" fill="#6B6B68">{xlabel}</text>
      {series.map((se, i) => {
        if (se.hline !== undefined) {
          return <line key={i} x1={L} x2={W - R} y1={ys(se.hline)} y2={ys(se.hline)} stroke={se.col} strokeDasharray="4 4" strokeWidth="1.5" />
        }
        const pts = se.pts ?? []
        return (
          <g key={i}>
            <polyline fill="none" stroke={se.col} strokeWidth="2" strokeDasharray={se.dash ? '5 4' : undefined} points={pts.map((p) => `${xs(p[0])},${ys(p[1])}`).join(' ')} />
            {pts.map((p, j) => <circle key={j} cx={xs(p[0])} cy={ys(p[1])} r="2.6" fill={se.col} />)}
          </g>
        )
      })}
    </svg>
  )
}

function Step1() {
  const [i, setI] = useState(0)
  const g = D.groups[i]
  const ok = g.reward.filter((x) => x).length
  const note = ok === 0
    ? '这一组全错。'
    : ok === g.reward.length
      ? '这一组全对。'
      : `这一组 ${ok} 对 ${g.reward.length - ok} 错,对错混在一起,下一步就从这种组里算出更新方向。`
  return (
    <div className={styles.scope}>
      <h2>① 判分器只会对答案</h2>
      <p className="lead">
        任务是两位数加法,数字逐位写:<code>6 0 + 9 2 =</code>,正确回答 <code> 1 5 2</code>。{' '}
        <Term k="verifier" name="判分器 · verifier" def="检查模型回答对不对的程序,只输出分数(这里答对 1、答错 0),不告诉模型正确答案是什么。">判分器</Term>
        {' '}是 <code>verify</code> 函数里的一行比较:回答去掉空格,等不等于正确的和。下面是训练第一批里的真实采样(温度 1,同一道题 8 次)。换一道题:
      </p>
      <div className="btn-row small">
        {D.groups.map((group, idx) => (
          <button key={group.prompt + group.step} type="button" className={idx === i ? 'btn primary' : 'btn'} onClick={() => setI(idx)}>{group.prompt}</button>
        ))}
      </div>
      <div className="lab">
        <div className="prob">{g.prompt} <span className="ans">正确答案 {g.answer}</span></div>
        <div className="samples">
          {g.samples.map((s, j) => (
            <div key={j} className={g.reward[j] ? 'smp ok' : 'smp no'}>
              <div className="st">{showSample(s)}</div>
              <div className="sr">{g.reward[j] ? '✓ 奖励 1' : '✗ 奖励 0'}</div>
            </div>
          ))}
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv good">{ok} / {g.reward.length}</div><div className="drl">答对几个(奖励 1)</div></div>
          <div className="dr"><div className="drv">{(ok / g.reward.length).toFixed(3)}</div><div className="drl">组内平均奖励</div></div>
          <div className="dr"><div className="drv">{g.step}</div><div className="drl">训练第几步采的</div></div>
        </div>
      </div>
      <div className="note">判分器只输出 0 / 1,不告诉模型正确答案是多少。{note} 这些组来自热身 1000 道的起点(第 {g.step} 步是训练中途采的)。</div>
      <div className="codepath">↳ 代码:<b>19_grpo.py</b> 的 <code>verify</code> · <code>generate</code>(每道题生成 G 个回答)</div>
      <Dig title='题目为什么写成 "6 0 + 9 2",不写 "60 + 92"?'>
        GPT-2 的词表里 10 到 99、20 到 198 各是一个整体 token,<code>60</code> 和 <code>152</code> 都是单个 token,模型看不到个位和十位,只能死记 90 × 90 张表。
        用那种写法先试过:4096 道题 SFT 后 500 道评测题只对 5% 到 9%。逐位用空格隔开后每个数字一个 token,同样 4096 道题 SFT 能到六成以上。
        分词怎样影响数字,见 <Link to="/ch/bpe#step-5" style={{ color: 'var(--accent)' }}>第 18 章 STEP 5</Link>。
      </Dig>
      <Dig title='基座一开始会做加法吗?为什么要先"热身"?'>
        基本不会。124M 基座对 500 道评测题贪心解码只对 <b>{pct(D.w200.base.pass1)}</b>,采样 8 次至少一次对的比例 <b>{pct(D.w200.base.pass8)}</b>,很多回答连格式都不对。
        RL 的信号来自"同一道题里有的对、有的错",全错就学不到东西(第 3 步)。所以先用一小批带答案的题做一次热身 SFT,得到共同起点 warm,再从 warm 分出三条路。
        本页有两个起点:热身 200 道(warm 贪心 <b>{pct(D.w200.warm.pass1)}</b>)和热身 1000 道(<b>{pct(D.w1000.warm.pass1)}</b>)。热身用的题和训练题、评测题都不重叠。
      </Dig>
      <div className="next-hint">↳ 下一步:8 个回答各拿到 0 或 1。怎样把"这一个比同组其他的好"变成更新方向?</div>
    </div>
  )
}

function Step2() {
  const [preset, setPreset] = useState(1)
  const [tog, setTog] = useState(PRE[1].slice())
  const { m, sd, a } = advOf(tog)
  const iOk = tog.indexOf(1)
  const iNo = tog.indexOf(0)
  const k = tog.filter((x) => x).length
  const mx = 2.8
  return (
    <div className={styles.scope}>
      <h2>② 组内比较:每个回答的优势</h2>
      <p className="lead">
        GRPO 不训价值网络,用同组的平均奖励当基线:{' '}
        <Term k="advantage" name="优势 · advantage" def="一个回答比基线好多少。GRPO 里 A = (r − 组内均值) / 组内标准差;A > 0 的回答被加强,A < 0 的被压低,组内奖励全相同时 A 全为 0。">优势</Term>{' '}
        <code>A = (r − 组内均值) / 组内标准差</code>。比平均好的回答 A &gt; 0,更新时它的概率被抬高;比平均差的被压低。
        点下面 8 个回答,切换对错,看优势怎么变:
      </p>
      <div className="btn-row small">
        {['1 对 7 错', '4 对 4 错', '7 对 1 错', '全错', '全对'].map((label, i) => (
          <button key={label} type="button" className={preset === i ? 'btn primary' : 'btn'} onClick={() => { setPreset(i); setTog(PRE[i].slice()) }}>{label}</button>
        ))}
      </div>
      <div className="lab">
        <div className="samples">
          {tog.map((v, j) => (
            <div key={j} className={v ? 'smp click ok' : 'smp click no'} onClick={() => { setPreset(-1); setTog((cur) => cur.map((bit, i) => i === j ? bit ^ 1 : bit)) }}>
              <div className="st">回答 {j + 1}</div>
              <div className="sr">{v ? '✓ 对' : '✗ 错'}</div>
            </div>
          ))}
        </div>
        <div className="advbars">
          {a.map((v, j) => {
            const h = Math.min(1, Math.abs(v) / mx) * 50
            const top = v >= 0 ? 50 - h : 50
            const labelTop = v >= 0 ? Math.max(0, top - 12) : Math.min(88, top + h + 1)
            return (
              <div key={j} className="advcol">
                <div className="ax" />
                <div className="ab" style={{ top: `${top}%`, height: `${Math.max(h, 0.6)}%`, background: v > 0 ? '#3f7d63' : v < 0 ? '#9a3a22' : '#B9B5AA' }} />
                <div className="av" style={{ top: `${labelTop}%` }}>{v.toFixed(2)}</div>
              </div>
            )
          })}
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{m.toFixed(3)}</div><div className="drl">组内均值(基线)</div></div>
          <div className="dr"><div className="drv">{sd.toFixed(3)}</div><div className="drl">组内标准差</div></div>
          <div className="dr"><div className="drv good">{iOk >= 0 ? a[iOk].toFixed(2) : '–'}</div><div className="drl">答对的那条 A</div></div>
          <div className="dr"><div className="drv bad">{iNo >= 0 ? a[iNo].toFixed(2) : '–'}</div><div className="drl">答错的那条 A</div></div>
        </div>
      </div>
      <div className="note">
        {k === 0 || k === 8
          ? <>{k === 0 ? '全错' : '全对'}:每条回答都等于均值,<b>8 条的优势全是 0</b>,这道题对这一步的更新没有贡献。</>
          : <>{k} 对 {8 - k} 错:答对的每条 A = {a[iOk].toFixed(2)},答错的每条 A = {a[iNo].toFixed(2)}。一组的优势加起来是 0,更新只改变"对的和错的之间"的相对概率。</>}
      </div>
      <div className="codepath">↳ 代码:<b>19_grpo.py</b> 的 <code>run_grpo</code>,【步骤 3】<code>adv = (rg − 均值) / (标准差 + 1e-4)</code></div>
      <Dig title="然后怎么更新?和 SFT 差在哪?">
        loss = −A · log π(回答) + β · KL,按回答里的 token 平均。log π(回答) 就是第 8 章 SFT 的那个量:SFT 对标准答案做 −log π,相当于每条回答的 A 都是 1;
        GRPO 对模型<b>自己采样</b>的回答做,A 可正可负。KL 项用论文 (4) 式的估计 π_ref/π − log(π_ref/π) − 1,拉住模型别离热身起点太远。
        这里每批采样只更新一次,更新前后是同一个策略,PPO 的比值裁剪 clip(π/π_old) 恒等于 1,代码里省掉了。
      </Dig>
      <Dig title="1 对 7 错时,答对那条的优势为什么比 7 对 1 错时大这么多?">
        除以标准差之后,少数派的 |A| 大。1 对 7 错:均值 0.125,标准差 0.354,答对那条 A = 2.47,每条答错的 −0.35;7 对 1 错反过来。
        效果是:难题上偶然答对的那一次被强力加强,容易题上偶然答错的那一次被强力压低。
        按标准差归一化会让不同难度的题权重不同,Dr. GRPO(Liu et al., arXiv 2503.20783)认为这带来偏差,建议去掉除以标准差;本脚本按 DeepSeekMath 原式保留。
      </Dig>
      <Dig title="和 PPO、第 10 章的 DPO 比,GRPO 少了什么?">
        比 PPO 少了价值网络(critic)。PPO 要另训一个和策略差不多大的网络估计每个状态的期望回报当基线;GRPO 同一道题采 G 个,拿组内均值当基线,省掉这个网络。
        DeepSeekMath §4.1 的动机就是省下 critic 的显存和算力。
        和 DPO 比:DPO 用离线的成对数据,不在训练中采样;GRPO 每一步都用当前模型采样,判分器当场打分。
      </Dig>
      <div className="next-hint">↳ 下一步:"全错"时 8 条的优势都是 0,这道题对更新毫无贡献。训练中这种组有多少?</div>
    </div>
  )
}

function Step3() {
  const [key, setKey] = useState<'w200' | 'w1000'>('w200')
  const R = D[key]
  const c = R.arms.grpo.curve
  const dead = c.reduce((sum, p) => sum + p.all_wrong + p.all_right, 0) / c.length
  return (
    <div className={styles.scope}>
      <h2>③ 全错的组没有信号</h2>
      <p className="lead">两个起点各跑一次 GRPO:每步 16 道题,记下其中 8 次全错、8 次全对的比例,以及采样的平均奖励和 dev 题上的贪心准确率。切换起点:</p>
      <div className="btn-row">
        <button type="button" className={key === 'w200' ? 'btn primary' : 'btn'} onClick={() => setKey('w200')}>热身 200 道</button>
        <button type="button" className={key === 'w1000' ? 'btn primary' : 'btn'} onClick={() => setKey('w1000')}>热身 1000 道</button>
      </div>
      <div className="lab">
        <div className="scroll-x">
          <div style={{ minWidth: 560 }}>
            <LineChart
              series={[
                { pts: c.map((p) => [p.step, p.all_wrong]), col: '#9a3a22' },
                { pts: c.map((p) => [p.step, p.all_right]), col: '#B9B5AA' },
                { pts: c.map((p) => [p.step, p.reward]), col: '#3a63c0', dash: true },
                { pts: c.map((p) => [p.step, p.acc]), col: '#D97757' },
              ]}
              xmax={256}
              xticks={[0, 64, 128, 192, 256]}
              xlabel="GRPO 训练步数(每步 16 道题 × 8 次采样)"
            />
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#9a3a22' }} />8 次全错的组</span>
          <span><i style={{ background: '#B9B5AA' }} />8 次全对的组</span>
          <span><i style={{ background: '#3a63c0' }} />采样平均奖励</span>
          <span><i style={{ background: '#D97757' }} />dev 贪心准确率</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{pct(R.warm.pass1)} / {pct(R.warm.pass8)}</div><div className="drl">起点:贪心 / pass@8</div></div>
          <div className="dr"><div className="drv bad">{pct(dead)}</div><div className="drl">训练中没有信号的组(全错 + 全对)</div></div>
          <div className="dr"><div className="drv accent">{pct(R.arms.grpo.final.pass1)}</div><div className="drl">GRPO 后评测贪心</div></div>
        </div>
      </div>
      <div className="note">
        {key === 'w200'
          ? <>热身 200 道的起点:训练全程平均 <b>{pct(dead)}</b> 的组没有信号(几乎全是全错),GRPO 只把评测贪心准确率从 {pct(R.warm.pass1)} 提到 {pct(R.arms.grpo.final.pass1)}。</>
          : <>热身 1000 道的起点:开头约 {pct(c[0].all_wrong)} 的组全错,之后降到 {pct(c[c.length - 1].all_wrong)};评测贪心准确率从 {pct(R.warm.pass1)} 到 <b>{pct(R.arms.grpo.final.pass1)}</b>。</>}
      </div>
      <Dig title="pass@8 是什么,为什么拿它看起点?">
        <Term k="pass-at-k" name="pass@k" def="每道题采样 k 次,至少一次答对的题所占比例。它衡量模型能不能采样出正确答案,贪心准确率(pass@1)衡量它最常给出的答案对不对。">pass@k</Term>
        是每道题采样 k 次、至少一次答对的比例。GRPO 训练时一组正好是 8 次采样,所以起点的 pass@8 基本就是"一道题能不能凑出至少一个对的"的概率:
        pass@8 低,大多数组全错,没有信号。热身 200 道的起点 pass@8 只有 <b>{pct(D.w200.warm.pass8)}</b>,热身 1000 道是 <b>{pct(D.w1000.warm.pass8)}</b>。
      </Dig>
      <Dig title="DeepSeek-R1-Zero 直接从基座做 RL,为什么这里不行?">
        R1-Zero(DeepSeek-AI,arXiv 2501.12948)从 DeepSeek-V3-Base 出发,基座本身已经能在一部分数学题上采样出正确答案,RL 有信号可放大。
        这里的 124M 基座对两位数加法 pass@8 约为 0,RL 无从下手,所以要先热身。
        同一篇报告里,R1 正式版在 RL 之前也先用几千条长思维链数据做了冷启动 SFT。
      </Dig>
      <div className="next-hint">↳ 下一步:两个起点上,GRPO 和只给答案的 SFT、离线 DPO 相比如何?</div>
    </div>
  )
}

function Step4() {
  const [key, setKey] = useState<'w200' | 'w1000'>('w1000')
  const R = D[key]
  const best = ARM.reduce((b, a) => R.arms[a[0]].final.pass1 > R.arms[b[0]].final.pass1 ? a : b)
  const rows: { name: string; sup: string; lr: string; f: typeof R.base; hl: boolean }[] = [
    { name: '基座 124M', sup: '—', lr: '–', f: R.base, hl: false },
    { name: '起点 warm', sup: `${key === 'w200' ? 200 : 1000} 道带答案的题`, lr: '–', f: R.warm, hl: false },
    ...ARM.map((a) => ({
      name: a[1],
      sup: a[3] + (a[0] === 'dpo' ? `(${R.arms.dpo.n_pairs} 对)` : ''),
      lr: R.arms[a[0]].lr,
      f: R.arms[a[0]].final,
      hl: a[0] === best[0],
    })),
  ]
  return (
    <div className={styles.scope}>
      <h2>④ 三条路同台:同一起点、同一评测、同样 4096 道题</h2>
      <p className="lead">三条路从同一份热身权重出发,看同一串 4096 道训练题,在同样 500 道没见过的题上评测。每个起点上,每条路各扫 3 到 6 个学习率,按 dev 题挑。切换起点:</p>
      <div className="btn-row">
        <button type="button" className={key === 'w200' ? 'btn primary' : 'btn'} onClick={() => setKey('w200')}>热身 200 道</button>
        <button type="button" className={key === 'w1000' ? 'btn primary' : 'btn'} onClick={() => setKey('w1000')}>热身 1000 道</button>
      </div>
      <div className="lab scroll-x">
        <table className="tb">
          <thead>
            <tr><th>模型</th><th style={{ textAlign: 'left' }}>用了什么</th><th>学习率</th><th>评测贪心</th><th>有进位</th><th>无进位</th><th>pass@8</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className={row.hl ? 'hl' : undefined}>
                <td className="l">{row.name}</td>
                <td className="l" style={{ color: 'var(--ink2)', fontSize: 12 }}>{row.sup}</td>
                <td>{row.lr}</td>
                <td><b>{pct(row.f.pass1)}</b></td>
                <td>{pct(row.f.pass1_carry)}</td>
                <td>{pct(row.f.pass1_nocarry)}</td>
                <td>{pct(row.f.pass8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lab">
        <div className="mini-h">dev 题贪心准确率随训练步数</div>
        <div className="scroll-x">
          <div style={{ minWidth: 560 }}>
            <LineChart
              series={[
                { hline: R.warm.dev, col: '#B9B5AA' },
                ...ARM.map((a) => ({
                  pts: [[0, R.warm.dev] as [number, number]].concat(R.arms[a[0]].curve.map((p) => [p.step, p.acc] as [number, number])),
                  col: a[2],
                })),
              ]}
              xmax={256}
              xticks={[0, 64, 128, 192, 256]}
              xlabel="训练步数(每步 16 道题)"
            />
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#3a63c0' }} />SFT</span>
          <span><i style={{ background: '#a3548c' }} />DPO</span>
          <span><i style={{ background: '#D97757' }} />GRPO</span>
          <span><i style={{ background: '#B9B5AA' }} />起点 warm</span>
        </div>
      </div>
      <div className="note">
        {key === 'w200'
          ? <>起点弱(warm 贪心 {pct(R.warm.pass1)}):有标准答案的 SFT 到 <b>{pct(R.arms.sft.final.pass1)}</b>;GRPO 大部分组全错,只到 {pct(R.arms.grpo.final.pass1)};DPO {pct(R.arms.dpo.final.pass1)}。</>
          : <>起点能采样出对的答案(warm pass@8 {pct(R.warm.pass8)}):GRPO 到 <b>{pct(R.arms.grpo.final.pass1)}</b>,SFT {pct(R.arms.sft.final.pass1)},DPO {pct(R.arms.dpo.final.pass1)}。</>}
      </div>
      <div className="codepath">↳ 代码:<b>19_grpo.py</b> 的 <code>run_sft</code> / <code>run_dpo</code> / <code>run_grpo</code> · 学习率扫描 <code>runs/queue_grpo_lr.sh</code> 与 <code>queue_grpo.sh</code></div>
      <Dig title='三条路各用了什么"监督"?算力一样吗?'>
        <b>SFT</b>:4096 道题的标准答案,每道题 1 次前向 + 反向。
        <b>DPO</b>:不用答案,warm 对每道题采 8 次,判分器从中挑一对一错凑成偏好对,凑不出(全对或全错)的题丢掉;训练时同样 256 步。
        <b>GRPO</b>:不用答案,每一步当场对 16 道题各采 8 次,判分器打分,8 条回答都参与反向。
        所以"同样 4096 道题"指看过的题相同;GRPO 的生成和反向是 SFT 的约 8 倍。换成 SFT 看更多带答案的题,准确率也会继续涨,本页没有做这组。
      </Dig>
      <Dig title="学习率是怎么挑的?">
        <div className="scroll-x">
          <table className="tb" style={{ minWidth: 420, margin: '4px 0 8px' }}>
            <thead><tr><th>路</th><th>学习率</th><th>dev 贪心</th><th>评测贪心</th></tr></thead>
            <tbody>
              {ARM.map((a) => D.lr[key][a[0]].map((r) => {
                const lr = String(r[0])
                return (
                  <tr key={a[0] + lr} className={lr === R.arms[a[0]].lr ? 'hl' : undefined}>
                    <td>{a[1]}</td><td>{lr}</td><td>{pct(Number(r[1]))}</td><td>{pct(Number(r[2]))}</td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
        每个学习率跑完整的 256 步,看 200 道 dev 题的贪心准确率,取最高的;评测题的准确率列在旁边,只用来对照,不参与挑选。dev 只有 200 道,差一两个百分点就是差两三道题,几个学习率接近时,挑中哪个带有偶然性;dev 并列时取较大的学习率。最优值落在扫描区间边上时,再往外补点,直到它落在区间内部。全部在 RTX 4090 上跑。
      </Dig>
      <Dig title="DPO 为什么只在很小的学习率下才涨?">{withBold(D.dpo_note)}</Dig>
      <Dig title="只给判分器的 GRPO,和有标准答案的 SFT 差多少?">{withBold(D.grpo_note)}</Dig>
      <div className="next-hint">↳ 下一步:组大小 G 和 KL 项对结果的影响。</div>
    </div>
  )
}

function Step5() {
  const [mode, setMode] = useState(0)
  const w = D.w1000.warm.pass1
  const rows = mode === 0
    ? D.ablate.G.map((r) => ({ name: `G = ${r.G}${r.G === 8 ? '(默认)' : ''}`, pass1: r.pass1, pass8: r.pass8, mark: r.G === 8 }))
    : D.ablate.kl.map((r) => ({ name: r.kl ? `β = ${r.kl}(默认)` : 'β = 0(去掉 KL)', pass1: r.pass1, pass8: r.pass8, mark: !!r.kl }))
  const note = mode === 0
    ? D.ablate.G.map((r) => `G = ${r.G}:没有信号的组平均 ${pct(r.dead)}`).join(';') + '。G 越大,一组里同时有对有错的机会越大。'
    : `去掉 KL 后评测贪心 ${pct(D.ablate.kl[1].pass1)},带 KL(β = 0.04)${pct(D.ablate.kl[0].pass1)};训练结束时带 KL 那次与起点的逐 token KL 约 ${D.ablate.kl[0].kl_end.toFixed(3)}。`
  return (
    <div className={styles.scope}>
      <h2>⑤ 组大小与 KL</h2>
      <p className="lead">都从热身 1000 道的起点出发,学习率 3e-6、4096 道题不变,只改一个设置。每一行的竖线是起点 warm 的评测贪心准确率:</p>
      <div className="btn-row small">
        <button type="button" className={mode === 0 ? 'btn primary' : 'btn'} onClick={() => setMode(0)}>组大小 G</button>
        <button type="button" className={mode === 1 ? 'btn primary' : 'btn'} onClick={() => setMode(1)}>KL 项</button>
      </div>
      <div className="lab">
        {rows.map((r) => (
          <div key={r.name} className="gbar">
            <span className="gn">{r.name}</span>
            <span className="gt">
              <span className="gf" style={{ width: `${r.pass1 * 100}%`, background: r.mark ? 'var(--accent)' : '#3a63c0' }} />
              <span className="gm" style={{ left: `${w * 100}%` }} />
            </span>
            <span className="gv">{pct(r.pass1)} · p@8 {pct(r.pass8)}</span>
          </div>
        ))}
        <div className="mini-h">条长 = 评测贪心准确率;竖线 = 起点 warm {pct(w)}</div>
      </div>
      <div className="note">{note}</div>
      <Dig title="G 越大越好吗?">
        G 大,一组里更容易同时有对有错,全错 / 全对的组少,基线也估得更准;代价是每道题的采样和反向随 G 线性增加。
        G = 2 时一组只有两条,要么一对一错(A 为 ±1),要么全同(无信号)。
        DeepSeekMath §4.2 的设置是每题采 64 个。这里 G = 16 的开销是 G = 8 的两倍。
        没有信号的组的比例随 G 单调下降,准确率却不是:G = 4 比 G = 2 还低。每个设置只跑了一个随机种子,这种先后可能来自噪声,不宜解读。
      </Dig>
      <Dig title="去掉 KL 反而更高,为什么还要它?">
        KL 项防止模型离起点太远:奖励只看最后的数字对不对,没有 KL 时模型可以把其他行为(比如续写别的文本的能力)改得面目全非,判分器看不见。
        这里任务单一、只训 256 步,KL 的约束只表现为稍慢一点的提升。DAPO(Yu et al., arXiv 2503.14476)等后续工作在长思维链推理上去掉了 KL 项;
        是否保留取决于任务和训练长度,本页的一组对照不足以下结论。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测</div>
      <ul className="checklist">
        {D.ok.map((t) => <li key={t}><span className="ck">✓</span><div>{withBold(t)}</div></li>)}
      </ul>
      <div className="codepath">↳ 跑法:<code>bash runs/queue_grpo_lr.sh && bash runs/queue_grpo.sh</code>(CUDA / MPS / CPU;RTX 4090 上每次约 2 分钟)</div>
    </div>
  )
}

export function RlvrGrpo() {
  const chapter = findChapter('rlvr-grpo')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />]
  return (
    <ChapterShell
      slug="rlvr-grpo"
      title="RLVR 与 GRPO:只给判分器,不给答案"
      subtitle={
        <>
          第 8 章的 SFT 要标准答案,第 10 章的 DPO 要一对好坏回答。{' '}
          <Term k="rlvr" name="RLVR · 可验证奖励的强化学习" def="Reinforcement Learning with Verifiable Rewards:奖励来自能自动判对错的程序(对答案、跑测试),不来自人工打分或奖励模型。模型自己采样回答,判分器给分,按分数更新。">RLVR</Term>
          {' '}只要一个能自动判对错的程序:模型自己答,程序判分,按分数更新。本关用{' '}
          <Term k="grpo" name="GRPO · 组相对策略优化" def="同一道题采样 G 个回答,用组内平均奖励当基线、组内标准差做归一化,算出每个回答的优势,不需要价值网络。出自 DeepSeekMath(arXiv 2402.03300)。">GRPO</Term>
          {' '}把第 6 章的 124M 教会两位数加法,再在同一基座、同一评测、同样 4096 道题下和 SFT、DPO 同台比。配套代码 <code>phase5-fullstack/19_grpo.py</code>,在 RTX 4090 上跑完。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">基座 <b>124M</b> <i>第 6 章 · 10B token</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">G <b>8</b> <i>每道题采样几次</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">训练题 <b>4,096</b> <i>每条路都一样</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">batch <b>16</b> <i>每步几道题 → 256 步</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">β <b>0.04</b> <i>KL 系数</i></HpChip>
          <HpChip color="#6B6B68" bg="#ECEAE2">评测 <b>500</b> <i>没见过的题 · dev 另 200 道</i></HpChip>
          <span className="hp-note">G 的 8 与 pass@8 的 8 含义不同:前者是训练时每题采几次,后者是评测时采几次</span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 RLVR 与 GRPO · 通关 · Phase 5 收尾</div>
          <div className="cs">你只给了一个会对答案的判分器,就让 124M 学会了两位数加法:同一道题采样 8 次,组内比较得出优势,按优势更新。也看到起点采样不出对的答案时 RL 拿不到信号。Phase 5 从分词器、FlashAttention、scaling law 走到 RLVR,补齐了这条学习线的全链路。</div>
        </>
      }
    />
  )
}
