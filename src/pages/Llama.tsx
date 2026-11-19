// 旧页 goto 只改当前步,不重置滑块、别扭、归一化开关、对照指标、KV 预设和折叠。
import { useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { ChapterShell } from '../components/ChapterShell'
import { Dig } from '../components/Dig'
import { HpBar, HpChip } from '../components/HpBar'
import { Term } from '../components/Term'
import {
  AB, AB_COLORS, INV, KV, NVEC, QCOL, QV,
  KVC_CTX_LBL, abView, dot, en, gluAt, gluParams, gqaAt, kvcAt, kvcFmt, normOf, rope,
  type AbMetric,
} from './llamaData'
import styles from './Llama.module.css'

const PAINS: { n: string; t: string; w: string; old: ReactNode; neu: ReactNode; cost: ReactNode }[] = [
  {
    n: '别扭 ①',
    t: '位置靠背表',
    w: '外推不了',
    old: <>第 3 章:<code>position_embedding_table = nn.Embedding(block_size, n_embd)</code>,每个绝对位置一行,查表后加到 token 向量上。</>,
    neu: <>换成 <b>RoPE</b>:不加任何向量,而是按位置把 q/k 旋转一个角度。</>,
    cost: <>代价:那张表只有 block_size 行,<b>训练时没见过的位置压根没有对应的参数</b>,想把上下文拉长就得重训。而且第 900 行和第 3 行之间毫无关系,模型得自己从头学"远近"。</>,
  },
  {
    n: '别扭 ②',
    t: '归一化做多了',
    w: '白花算子',
    old: <>第 3 章:<code>nn.LayerNorm(n_embd)</code>,先减均值、再除以标准差,还带一个 bias。</>,
    neu: <>换成 <b>RMSNorm</b>:只除以均方根,不减均值、不带 bias。</>,
    cost: <>代价:减均值那一步在实测里贡献很小,但它<b>每层要做两次</b>,几十上百层累起来就是白花的算力和参数。</>,
  },
  {
    n: '别扭 ③',
    t: 'ReLU 一刀切',
    w: '没有中间态',
    old: <>第 3 章:<code>nn.Linear → nn.ReLU → nn.Linear</code>,负数全部归零。</>,
    neu: <>换成 <b>SwiGLU</b>:一路当内容、一路过 SiLU 当闸门,逐元素相乘。</>,
    cost: <>代价:ReLU 的开关是通道自己说了算,只有"全开"和"关死"两种状态,做不到"这个通道放三成过去"。</>,
  },
  {
    n: '别扭 ④',
    t: '每头各存 K/V',
    w: '推理吃显存',
    old: <>第 3 章:4 个头,每个头有自己的 <code>Wk</code>/<code>Wv</code>,推理时要缓存 4 份 K/V。</>,
    neu: <>换成 <b>GQA</b>:query 仍是 4 个头,K/V 只留 2 份,每 2 个 query 头合用一份。</>,
    cost: <>代价:KV cache 随上下文线性增长,长对话时它能吃掉比模型权重还多的显存 —— 这是推理服务最硬的瓶颈之一。</>,
  },
]

function Step1() {
  const [sel, setSel] = useState(0)
  const p = PAINS[sel]
  return (
    <div className={styles.scope}>
      <h2>① 老架构的四处别扭</h2>
      <p className="lead">
        第 3 章那台 GPT 能跑、也训得动。但把它放到 2023 年之后的标准看,有四个地方会被换掉。{' '}
        <b>点下面任意一处</b>,看它在第 3 章代码里是哪一行、代价是什么、今天换成了什么:
      </p>
      <div className="painrow">
        {PAINS.map((item, i) => (
          <button key={item.n} type="button" className={i === sel ? 'pain active' : 'pain'} onClick={() => setSel(i)}>
            <div className="pn">{item.n}</div>
            <div className="pt">{item.t}</div>
            <div className="pw">{item.w}</div>
          </button>
        ))}
      </div>
      <div className="paincard">
        <div className="old"><span className="badge2 b-old">2019</span><div>{p.old}</div></div>
        <div className="new"><span className="badge2 b-new">今天</span><div>{p.neu}</div></div>
        <div className="cost">{p.cost}</div>
      </div>
      <div className="note">
        四处别扭里,<b>只有 GQA 是纯粹为了省</b>(省推理显存),另外三个都是"既省一点、也更好训一点"。{' '}
        这一关按 位置 → 归一化 → FFN → 注意力 的顺序一个一个换。
      </div>
      <Dig title="换了这四件,它还算 Transformer 吗?">
        算,而且骨架一动没动:<b>逐 token 嵌入 → N 层(注意力子层 + FFN 子层,各带残差与归一化)→ 映射回词表</b>,
        这条主干和 2017 年那篇论文一模一样。四个零件换的是"每个子层内部用什么实现":
        位置怎么进来、归一化怎么算、FFN 用什么非线性、K/V 存几份。
        所以你在第 3 章学的那套结构,今天读 LLaMA 的代码依然直接够用。
      </Dig>
      <Dig title="为什么这四件是一起出现的?它们之间有关系吗?">
        没有强耦合,四件<b>互相独立</b>,任何一件都能单独用(所以本关每件都做成了单独的开关)。
        它们凑在一起,是因为都在 2021–2023 年被反复验证"便宜且不亏",于是被 LLaMA 一次性打包进同一套配方,
        后来的开源模型就照着抄。真正有点关系的是 RoPE 和 GQA:两个都作用在注意力里,
        而且都对"推理时怎么处理长上下文"有影响。
      </Dig>
      <div className="next-hint">↳ 下一步:先修最要命的那个 —— 位置表是"背下来"的,一超长度就抓瞎。</div>
    </div>
  )
}

function RopeDials({ pos }: { pos: number }) {
  const R = 34
  const C = 44
  return (
    <div className="ropedials">
      {[0, 1, 2, 3].map((i) => {
        const ang = pos * INV[i]
        const x = (C + R * Math.cos(-ang)).toFixed(1)
        const y = (C + R * Math.sin(-ang)).toFixed(1)
        const turns = ang / (2 * Math.PI)
        const wave = (2 * Math.PI) / INV[i]
        return (
          <div key={i} className="dial">
            <div className="dl">第 {i + 1} 对维度</div>
            <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`第${i + 1}对维度的旋转角`}>
              <circle cx={C} cy={C} r={R} fill="none" stroke="var(--border)" strokeWidth="1.5" />
              <line x1={C} y1={C} x2={C + R} y2={C} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={C} y1={C} x2={x} y2={y} stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={x} cy={y} r="3.5" fill="var(--accent)" />
            </svg>
            <div className="dv">转了 {turns.toFixed(2)} 圈</div>
            <div className="dl">{wave < 1000 ? `每 ${wave.toFixed(0)} 个位置一圈` : '转一圈要几千位置'}</div>
          </div>
        )
      })}
    </div>
  )
}

function Step2() {
  const [pos, setPos] = useState(0)
  const [m, setM] = useState(5)
  const [n, setN] = useState(3)
  const score = dot(rope(QV, m), rope(KV, n))
  const m7 = Math.min(63, m + 7)
  const n7 = Math.min(63, n + 7)
  const shifted = dot(rope(QV, m7), rope(KV, n7))
  return (
    <div className={styles.scope}>
      <h2>② RoPE:把位置从"查表"变成"转角度"</h2>
      <p className="lead">
        第 3 章的位置信息来自一张 <code>nn.Embedding(block_size, n_embd)</code> 表:第几个位置就查第几行,加到 token 向量上。{' '}
        <b>RoPE 换了个思路</b>:不加任何东西,而是把 q 和 k 这两个向量按"你在第几个位置"<b>旋转</b>一个角度。{' '}
        向量两两配对当成平面上的点,位置越靠后转得越多。拖滑块看它怎么转:
      </p>
      <div className="ropelab">
        <RopeDials pos={pos} />
        <div className="rk-row">
          <label>token 的位置 m</label>
          <input type="range" min={0} max={63} step={1} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
          <span className="rk-val">{pos}</span>
        </div>
        <div className="hp-note" style={{ marginTop: 2 }}>
          四对维度 = 四个不同的转速。<b>靠前的转得快</b>(管邻近关系),<b>靠后的转得慢</b>(几十个位置才转一圈,管远距离)。{' '}
          真实每个头有 <b>16</b> 对(head_size=32),这里只画前 4 对。
        </div>
      </div>
      <div className="sub-h"><span className="badge">关键</span>转完之后,注意力只看得见"相对距离"</div>
      <p className="lead" style={{ marginBottom: 12 }}>
        这是 RoPE 真正的好处,不是省参数。把 q 放在位置 <b>m</b>、k 放在位置 <b>n</b>,{' '}
        算出来的注意力分数 <code>q·k</code> <b>只跟 m−n 有关</b>,跟它俩具体在第几个位置无关。{' '}
        拖两个滑块试试:一起往右拖,距离不变,分数纹丝不动。
      </p>
      <div className="ropelab">
        <div className="rk-row">
          <label>q 的位置 m</label>
          <input type="range" min={0} max={63} step={1} value={m} onChange={(e) => setM(Number(e.target.value))} />
          <span className="rk-val">{m}</span>
        </div>
        <div className="rk-row">
          <label>k 的位置 n</label>
          <input type="range" min={0} max={63} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <span className="rk-val">{n}</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{m - n}</div><div className="drl">相对距离 m−n</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{score.toFixed(4)}</div><div className="drl">注意力分数 q·k</div></div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => { if (m < 63 && n < 63) { setM(m + 1); setN(n + 1) } }}>两个一起 +1(距离不变)</button>
          <button type="button" className="btn" onClick={() => { setM(5); setN(3) }}>复位</button>
        </div>
        <div className="note" style={{ marginTop: 10 }}>
          把 m、n 同时右移 7 个位置(变成 {m7} 和 {n7}),分数是 <b>{shifted.toFixed(4)}</b> —— 和上面那个数一样。<b>绝对位置换了,分数不变;只要距离变了,分数才变。</b>
        </div>
      </div>
      <div className="codepath">↳ 代码:<b>10_llama.py</b> 的 <code>build_rope_cache</code> / <code>apply_rope</code> · 开关 <code>--rope 1</code></div>
      <Dig title={'"只依赖相对距离"为什么值钱?'}>
        因为语言里真正重要的是"<b>这个词和那个词隔多远</b>",不是"它们在第几个字符"。
        同一句话出现在文章开头还是第 900 个 token,内部关系应该一样。
        可学习的位置表做不到这点:它给每个绝对位置一行独立的参数,第 900 行和第 3 行毫无关系,
        <b>而且训练时没见过的位置(超过 block_size)根本没有那一行</b> —— 这就是老架构"外推不了"的根源。
        RoPE 把位置变成角度之后,超出训练长度也照样能转(效果会下降,但不是无中生有),
        所以后来那些"把上下文从 4K 拉到 128K"的做法(NTK / YaRN 之类),动的都是 RoPE 的频率。
      </Dig>
      <Dig title='为什么是"两两配对"地转?'>
        旋转是<b>平面</b>上的操作,得有两个坐标才能定义"转多少度"。
        所以 RoPE 把 head_size=32 的向量拆成 <b>16 对</b>,每一对当成一个平面上的点,各自按自己的频率转。
        每对配一个不同的转速,是为了让模型同时拥有"看近"和"看远"两种尺度 ——
        转得快的那几对,隔几个位置角度就差很多,适合分辨近处;转得慢的那几对,几十个位置才转一点,
        用来编码长距离。这和傅里叶那套"用不同频率叠出复杂信号"的思路是一个味道。
      </Dig>
      <Dig title="它对 v 也转吗?">
        <b>不转</b>,只转 q 和 k。因为位置信息是要影响"<b>谁该看谁</b>"这个打分过程,
        而打分只用到 q·k;v 是"被搬运的内容",不参与打分。代码里也就是{' '}
        <code>apply_rope(q, …)</code> 和 <code>apply_rope(k, …)</code> 两行,没有 v 的份。
      </Dig>
      <div className="next-hint">↳ 下一步:位置解决了。再看每一层都要做两次、但其实做多了的那个操作 —— 归一化。</div>
    </div>
  )
}

function VecRow({ vals }: { vals: number[] }) {
  return (
    <div className="vecrow">
      {vals.map((v, i) => <span key={i} className="vcell">{v.toFixed(2)}</span>)}
    </div>
  )
}

function Step3() {
  const [isRMS, setRMS] = useState(false)
  const { mean, std, rms, out } = normOf(isRMS)
  return (
    <div className={styles.scope}>
      <h2>③ RMSNorm:同一件事,少做一半</h2>
      <p className="lead">
        <Term k="layernorm" name="LayerNorm · 层归一化" def="对每个位置那一根向量做归一化:先减均值,再除以标准差,最后乘缩放、加偏置。">LayerNorm</Term>{' '}
        做两件事:<b>①减均值</b>(把这根向量挪到 0 附近)、<b>②除以标准差</b>(把尺度拉回 1 附近)。{' '}
        RMSNorm 发现第 ① 步基本没用,干脆只做第 ②:<b>直接除以均方根</b>。{' '}
        点下面切换,看同一根向量在两种归一化下的处理步骤:
      </p>
      <div className="btn-row">
        <button type="button" className={isRMS ? 'btn' : 'btn primary'} onClick={() => setRMS(false)}>LayerNorm(第 3 章)</button>
        <button type="button" className={isRMS ? 'btn primary' : 'btn'} onClick={() => setRMS(true)}>RMSNorm(LLaMA)</button>
      </div>
      <div className="normlab">
        <div className="hp-note" style={{ marginBottom: 8 }}>一根 6 维的向量(真实是 n_embd=128 维):</div>
        <VecRow vals={NVEC} />
        <div className="nsteps" style={{ marginTop: 12 }}>
          <div className={isRMS ? 'nstep skip' : 'nstep'}>
            <div className="nh">① 减均值</div>
            <div className="nb">{isRMS ? 'RMSNorm 跳过这一步' : `均值 = ${mean.toFixed(3)},每个数都减掉它`}</div>
          </div>
          <div className="nstep">
            <div className="nh">② 除以{isRMS ? '均方根' : '标准差'}</div>
            <div className="nb">{isRMS ? `RMS = ${rms.toFixed(3)}` : `标准差 = ${std.toFixed(3)}`}</div>
          </div>
          <div className="nstep">
            <div className="nh">③ 乘可学习缩放</div>
            <div className="nb">{isRMS ? '只有 weight(128 个)' : 'weight + bias(256 个)'}</div>
          </div>
        </div>
        <div className="hp-note" style={{ margin: '10px 0 4px' }}>输出:</div>
        <VecRow vals={out} />
      </div>
      <div className="note">
        {isRMS
          ? <>RMSNorm 少了"减均值",所以输出<b>不再以 0 为中心</b>(上面的数正负分布和输入一致),但尺度同样被拉回了 1 附近 —— 归一化真正要的是后者。每层还省下 128 个 bias 参数。</>
          : <>LayerNorm 先把向量挪到 0 附近,再压尺度。<b>两步都做</b>,并且带 weight 和 bias 两组参数。</>}
      </div>
      <div className="codepath">↳ 代码:<b>10_llama.py</b> 的 <code>RMSNorm</code> · 开关 <code>--rmsnorm 1</code></div>
      <Dig title='减均值这一步,凭什么说它"基本没用"?'>
        这是个<b>经验结论,不是数学定理</b>。RMSNorm 那篇论文(2019)做的就是拆开来做消融:
        把 LayerNorm 的"减均值"去掉,在多个任务上训练稳定性和最终效果都没有明显损失,
        但省掉了一次求均值、一次减法,以及每层的 bias 参数。
        后来 LLaMA 等一批模型跟进采用,等于用大规模训练又验证了一遍。
        本关的玩具规模也能看到同样的现象:val loss 基本打平(见 STEP 6 的对照),参数还少了一点。
        <b>省下的那点算力单看很小</b>,但归一化在每层要做两次、几十上百层累起来就不小了。
      </Dig>
      <div className="next-hint">↳ 下一步:归一化省完了,轮到占参数大头的 FFN —— 那个一刀切负数的 ReLU。</div>
    </div>
  )
}

function GluBar({ v, color }: { v: number; color: string }) {
  const w = Math.min((Math.abs(v) / 4) * 50, 50)
  const style = v >= 0
    ? { background: color, left: '50%', width: `${w}%` }
    : { background: color, left: `${50 - w}%`, width: `${w}%` }
  return (
    <div className="gbar">
      <div className="gz" />
      <div className="gf" style={style} />
    </div>
  )
}

function Step4() {
  const [x, setX] = useState(-1.2)
  const { relu, gate, up, glu } = gluAt(x)
  const params = gluParams()
  return (
    <div className={styles.scope}>
      <h2>④ SwiGLU:给 FFN 装一道闸门</h2>
      <p className="lead">
        第 3 章的 FFN 是 <code>放大 → ReLU → 压回</code>。ReLU 很粗暴:<b>负的全归零,正的原样通过</b>。{' '}
        SwiGLU 换成<b>门控</b>:同一个输入走两路,一路过{' '}
        <Term k="swiglu" name="SiLU · Swish 激活" def="SiLU(x) = x · sigmoid(x)。形状像平滑版 ReLU,负半轴不是硬归零而是缓慢趋近 0,处处可导。">SiLU</Term>{' '}
        当<b>闸门</b>,一路当<b>内容</b>,两路<b>逐元素相乘</b>——{' '}
        闸门决定每个通道放多少内容过去。拖滑块看两种做法怎么处理同一个值:
      </p>
      <div className="rk-row">
        <label>某个通道的输入值 x</label>
        <input type="range" min={-3} max={3} step={0.05} value={x} onChange={(e) => setX(Number(e.target.value))} />
        <span className="rk-val">{x.toFixed(2)}</span>
      </div>
      <div className="glulab">
        <div className="gcard">
          <h4>ReLU 版(第 3 章)</h4>
          <div className="glabel"><span>输入 x</span><b>{x.toFixed(2)}</b></div>
          <GluBar v={x} color="#8C8A83" />
          <div className="glabel"><span>ReLU(x) = max(0, x)</span><b>{relu.toFixed(2)}</b></div>
          <GluBar v={relu} color="#9a3a22" />
          <div className="hp-note" style={{ marginTop: 8 }}>
            {x < 0 ? <>负数 → <b>直接归零,信息全丢</b></> : <>正数 → 原样通过,不做任何调节</>}
          </div>
        </div>
        <div className="gcard">
          <h4>SwiGLU 版(LLaMA)</h4>
          <div className="glabel"><span>闸门 SiLU(gate)</span><b>{gate.toFixed(2)}</b></div>
          <GluBar v={gate} color="#3a63c0" />
          <div className="glabel"><span>内容 up</span><b>{up.toFixed(2)}</b></div>
          <GluBar v={up} color="#3f7d63" />
          <div className="glabel"><span>输出 = 闸门 × 内容</span><b>{glu.toFixed(2)}</b></div>
          <GluBar v={glu} color="var(--accent)" />
          <div className="hp-note" style={{ marginTop: 8 }}>闸门值 <b>{gate.toFixed(2)}</b> 由另一路独立算出,所以能做到"放一部分过去"</div>
        </div>
      </div>
      <div className="note">
        {x < 0
          ? <>x 是负的:ReLU 把它<b>压成 0</b>,这个通道到此为止;SwiGLU 的闸门值是 <b>{gate.toFixed(2)}</b> —— 注意它是<b>负的</b>,{' '}SiLU 在负半轴会探到约 −0.28 再回升。所以闸门不只能"关小",还能<b>把内容反号</b>,这是 ReLU 做不到的;{' '}而且整条曲线处处可导,不像 ReLU 在 0 处有个折角。</>
          : <>x 是正的:ReLU 原样放行,<b>不做任何调节</b>;SwiGLU 仍按闸门值 {gate.toFixed(2)} 缩放内容 —— 开关是连续的。</>}
      </div>
      <div className="sub-h"><span className="badge">算账</span>三个矩阵,为什么参数没变多?</div>
      <div className="glucalc">
        ReLU 版 FFN:两个矩阵,隐层 4·n_embd = <span className="hl">512</span><br />
        {'\u00a0\u00a0'}参数 ≈ 2 × 128 × 512 = <span className="hl">{en(params.relu)}</span><br /><br />
        SwiGLU:三个矩阵(gate / up / down),所以隐层要收窄<br />
        {'\u00a0\u00a0'}隐层 = 8/3 · n_embd ≈ <span className="hl">{params.h}</span>(凑成 8 的倍数)<br />
        {'\u00a0\u00a0'}参数 ≈ 3 × 128 × {params.h} = <span className="hl">{en(params.swi)}</span><br /><br />
        两者相差不到 {params.pct}% —— <b>这就是 8/3 这个奇怪系数的来历:让门控版和原版参数量对齐,比较才公平。</b>
      </div>
      <div className="codepath">↳ 代码:<b>10_llama.py</b> 的 <code>SwiGLU</code> · 开关 <code>--swiglu 1</code></div>
      <Dig title='门控到底强在哪?ReLU 不也能"关掉"通道吗?'>
        差别在<b>谁来决定关不关、关多少</b>。
        ReLU 的开关是<b>它自己</b>:这个通道的值为负就关死、为正就全开,没有中间态,也没有第二个信号参与。
        门控的开关来自<b>另一路独立的线性变换</b>:内容是一路算出来的,闸门是另一路算出来的,
        于是模型可以学出"这个通道的内容有用,但在当前上下文里只放三成过去"。
        多出来的那一路矩阵,买到的就是这种<b>逐通道、连续可调</b>的控制力。
        实测上它通常带来一点点稳定收益,不是革命性的 —— 属于"便宜且不亏"那一类改动。
      </Dig>
      <Dig title="SiLU、Swish、GELU 是什么关系?">
        <b>SiLU 和 Swish 是同一个函数的两个名字</b>(<code>x·sigmoid(x)</code>),分别在两篇论文里被独立提出。
        GELU 是另一个形状很接近的平滑激活(GPT-2 用的就是它)。
        三者共同点是:都比 ReLU 平滑,负半轴不硬归零而是缓慢趋近 0,处处可导。
        实践里换来换去差别很小,<b>真正带来变化的是"门控"这个结构</b>,而不是选了哪个平滑激活 ——
        所以名字里那个 GLU(Gated Linear Unit)才是重点。
      </Dig>
      <div className="next-hint">↳ 下一步:前三件都在省算力和参数。最后一件省的是另一样东西 —— 推理时的显存。</div>
    </div>
  )
}

function GqaSvg({ nkv }: { nkv: number }) {
  const nh = 4
  const rep = nh / nkv
  const W = 430
  const H = 150
  const qxOf = (q: number) => 45 + q * 100
  const kxOf = (i: number) => 45 + (i * rep + (rep - 1) / 2) * 100
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="query 头与 K/V 头的共享关系">
      <text x="8" y="18" fontSize="11" fontFamily="ui-monospace" fill="#6B6B68">query 头(4 个,各问各的)</text>
      <text x="8" y={H - 8} fontSize="11" fontFamily="ui-monospace" fill="#6B6B68">K/V 头({nkv} 份,被共用)</text>
      {Array.from({ length: nh }, (_, q) => {
        const kvi = Math.floor(q / rep)
        return <line key={q} x1={qxOf(q)} y1={46} x2={kxOf(kvi)} y2={H - 40} stroke={QCOL[q]} strokeWidth="2" opacity={0.55} />
      })}
      {Array.from({ length: nh }, (_, q) => (
        <g key={q}>
          <circle cx={qxOf(q)} cy={38} r={15} fill={QCOL[q]} />
          <text x={qxOf(q)} y={42} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">q{q}</text>
        </g>
      ))}
      {Array.from({ length: nkv }, (_, i) => {
        const kx = kxOf(i)
        const col = QCOL[i * rep]
        return (
          <g key={i}>
            <rect x={kx - 26} y={H - 48} width={52} height={26} rx={8} fill="#fff" stroke={col} strokeWidth="2" />
            <text x={kx} y={H - 30} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="ui-monospace" fill={col}>K/V {i}</text>
          </g>
        )
      })}
    </svg>
  )
}

const KVC_NAMES = ['本关玩具', 'LLaMA-2-7B(MHA)', 'LLaMA-3-8B(GQA)', 'Qwen3-Next-80B-A3B']

function Step5() {
  const [nkv, setNkv] = useState(2)
  const [preset, setPreset] = useState(2)
  const [bytes, setBytes] = useState(2)
  const [ce, setCe] = useState(15)
  const [conc, setConc] = useState(8)
  const [memG, setMemG] = useState(24)
  const g = gqaAt(nkv)
  const view = kvcAt(preset, ce, conc, bytes, memG)
  const ctxLabel = KVC_CTX_LBL[ce - 10]
  return (
    <div className={styles.scope}>
      <h2>⑤ GQA:让几个 query 头拼一份 K/V</h2>
      <p className="lead">
        第 5 章讲过 <Term k="kv-cache" name="KV-cache · 键值缓存" def="把过去每个 token 的 K/V 缓存下来,生成新 token 时只算新的一列,避免重算整段。">KV-cache</Term>:{' '}
        推理时把每个 token 的 K/V 存下来复用。问题是<b>它会一直变大</b> ——{' '}
        上下文每多一个 token,就要多存一份 K/V,长对话里它能吃掉比模型权重还多的显存。{' '}
        GQA 的办法很直接:<b>query 头保持 4 个,但 K/V 只留 2 份,每 2 个 query 头共用一份</b>。{' '}
        拖滑块看连线和账本:
      </p>
      <div className="rk-row">
        <label>n_kv_head(K/V 存几份)</label>
        <input type="range" min={1} max={4} step={1} value={nkv} onChange={(e) => setNkv(Number(e.target.value))} />
        <span className="rk-val">{nkv}</span>
      </div>
      <div className="gqalab"><GqaSvg nkv={nkv} /></div>
      <div className="dotread">
        <div className="dr"><div className="drv">{g.per} 个数</div><div className="drl">每 token 的 KV cache</div></div>
        <div className="dr"><div className="drv" style={{ color: '#3f7d63' }}>{g.save}%</div><div className="drl">相比 MHA 省下</div></div>
        <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{g.name}</div><div className="drl">这个配置叫</div></div>
      </div>
      <div className="note">
        {nkv === 4
          ? <>每个 query 头独占一份 K/V,就是第 3 章那套 <b>MHA</b>,一点没省。</>
          : nkv === 1
            ? <>4 个 query 头全部合用<b>同一份</b> K/V,这叫 <b>MQA</b>,省得最狠({g.save}%),但表达力损失也最明显。</>
            : <>每 <b>{g.rep}</b> 个 query 头合用一份 K/V,这就是 <b>GQA</b>。本关默认配置,KV cache 直接砍掉 {g.save}%,而 query 头依然各问各的。</>}
      </div>
      <div className="sub-h"><span className="badge">显存</span>放大到真实模型:一张卡能装多少上下文</div>
      <p className="lead" style={{ marginBottom: 10 }}>
        上面的账本只有 4 层、2 份 K/V,按"个数"算。真实模型要把它乘上层数和 head_dim,再乘每个数占几个字节,{' '}
        最后乘上下文长度和并发请求数。选一个模型,拖滑块:
      </p>
      <div className="kvclab">
        <div className="btn-row">
          {KVC_NAMES.map((name, i) => (
            <button key={name} type="button" className={i === preset ? 'btn primary' : 'btn'} onClick={() => setPreset(i)}>{name}</button>
          ))}
        </div>
        <div className="hp-note" style={{ margin: '4px 0 10px' }}>{view.p.desc}</div>
        <div className="rk-row">
          <label>上下文长度(token)</label>
          <input type="range" min={10} max={20} step={1} value={ce} onChange={(e) => setCe(Number(e.target.value))} />
          <span className="rk-val">{ctxLabel}</span>
        </div>
        <div className="rk-row">
          <label>并发请求数</label>
          <input type="range" min={1} max={64} step={1} value={conc} onChange={(e) => setConc(Number(e.target.value))} />
          <span className="rk-val">{conc}</span>
        </div>
        <div className="rk-row">
          <label>每个数占几个字节</label>
          <div className="btn-row" style={{ margin: 0 }}>
            <button type="button" className={bytes === 2 ? 'btn primary' : 'btn'} onClick={() => setBytes(2)}>FP16 = 2 字节</button>
            <button type="button" className={bytes === 1 ? 'btn primary' : 'btn'} onClick={() => setBytes(1)}>FP8 = 1 字节</button>
          </div>
        </div>
        <div className="rk-row">
          <label>给 KV 留的显存(GiB)</label>
          <input type="range" min={4} max={80} step={1} value={memG} onChange={(e) => setMemG(Number(e.target.value))} />
          <span className="rk-val">{memG}</span>
        </div>
        <div className="glucalc">
          每 token 字节 = 2(K 和 V)× 注意力层数 × kv 头数 × head_dim × 每个数的字节<br />
          {'\u00a0\u00a0'}= 2 × {view.p.layers} × {view.p.kv} × {view.p.hd} × {bytes} = <span className="hl">{en(view.per)} 字节</span> = {view.mibStr} MiB<br />
          一条请求 = {en(view.per)} 字节 × {en(view.ctx)} token = <span className="hl">{kvcFmt(view.req)}</span>;{' '}
          × {conc} 条并发 = <span className="hl">{kvcFmt(view.all)}</span><br />
          <span style={{ color: 'var(--ink2)' }}>(1 MiB = 1024² 字节,1 GiB = 1024³ 字节)</span>
        </div>
        <div className="dotread">
          <div className="dr"><div className="drv">{en(view.per)}</div><div className="drl">每 token 的 KV cache(字节)</div></div>
          <div className="dr"><div className="drv">{kvcFmt(view.req)}</div><div className="drl">一条请求满长时</div></div>
          <div className="dr"><div className="drv" style={{ color: view.all > view.mem ? '#9a3a22' : 'var(--ink)' }}>{kvcFmt(view.all)}</div><div className="drl">所有并发请求合计</div></div>
          <div className="dr"><div className="drv" style={{ color: '#3f7d63' }}>{en(view.cap)}</div><div className="drl">这块显存能装的 token 总数</div></div>
          <div className="dr"><div className="drv" style={{ color: 'var(--accent)' }}>{en(view.fit)} 条</div><div className="drl">能同时放下几条满长请求</div></div>
        </div>
        <div className="kvc-pool">
          <div className="kvc-cap" style={{ width: `${((100 * view.mem) / view.scale).toFixed(2)}%` }} />
          {Array.from({ length: conc }, (_, i) => {
            const ok = (i + 1) * view.req <= view.mem
            return (
              <div
                key={i}
                className="kvc-blk"
                style={{
                  left: `${((100 * i * view.req) / view.scale).toFixed(3)}%`,
                  width: `${((100 * view.req) / view.scale).toFixed(3)}%`,
                  background: ok ? 'var(--accent)' : '#9a3a22',
                  opacity: ok ? 1 : 0.7,
                }}
              />
            )
          })}
        </div>
        <div className="hp-note">
          绿色底 = 留给 KV 的 {memG} GiB 显存(虚线是上限);每个小块 = 一条 {ctxLabel} token 的满长请求({kvcFmt(view.req)});{' '}
          橙块放得下,红块超出显存。块太窄时按 2 像素画。
        </div>
      </div>
      <div className="note">
        显存里是一个<b>共享的 token 池</b>:上下文长度 × 并发数不能超过它。{' '}
        当前需要 {en(view.ctx)} × {conc} = <b>{en(view.need)}</b> token,池子能装 <b>{en(view.cap)}</b> token,{' '}
        {view.need <= view.cap
          ? <>放得下,还空着 {en(view.cap - view.need)} token。</>
          : <>超出 {en(view.need - view.cap)} token,{view.fit > 0 ? <>满长请求只能同时跑 {en(view.fit)} 条。</> : <>一条满长请求也放不下。</>}</>}
      </div>
      <Dig title="推理框架怎么管这个池子?">
        以 vLLM 为例,它的 <b>PagedAttention</b> 借用操作系统虚拟内存的分页做法:
        把 KV cache 切成固定大小的<b>块</b>,每块存固定数量 token 的 K/V(默认 <code>block_size=16</code> 个 token)。
        请求生成到哪里就申请到哪里,一块一块地要,不必按最大上下文长度预留一整段连续显存,池子里几乎没有空着的预留位。
        块还可以在<b>同一请求内</b>和<b>不同请求之间</b>共享,比如同一段提示词采样多条回答时,提示词那部分的块只存一份。
        论文报告吞吐提升 <b>2–4 倍</b>(Kwon et al., arXiv 2309.06180,SOSP 2023)。
      </Dig>
      <div className="codepath">↳ 代码:<b>10_llama.py</b> 的 <code>Attention</code>(<code>k_proj</code>/<code>v_proj</code> 只投 <code>n_kv_head</code> 份 + <code>repeat_interleave</code>)· 开关 <code>--n-kv-head 2</code></div>
      <Dig title='共享了 K/V,注意力还算"多头"吗?'>
        还算。<b>每个 query 头依然有自己独立的 <code>Wq</code></b>,依然算出自己的一套注意力权重、聚合出自己的一根输出向量。
        共享的只是"被查询的那一侧"。打个比方:4 个人各自带着自己的问题(query)去查资料,
        原本一人一套资料(K/V),现在两人合看一套 —— 问的问题还是各问各的,得到的答案也各不相同,
        只是可查的资料副本少了。表达力确实略有损失,所以是 <b>4→2</b> 这种温和的共享,
        而不是一步到位全共享。
      </Dig>
      <Dig title="为什么不干脆压到 1 份(MQA)?">
        可以,那就是 <b>MQA(Multi-Query Attention)</b>,省得最狠(本关配置下 KV cache 只剩 1/4),
        代码里 <code>--n-kv-head 1</code> 就能跑。代价是表达力损失更明显、训练也更容易不稳。
        GQA 正是被当作 <b>MHA 与 MQA 之间的折中</b>提出来的:
        大部分显存收益拿到手,质量损失又小到可以忽略。所以现在主流模型多用 GQA(比如 64 个 query 头配 8 份 K/V),
        而不是走极端。
      </Dig>
      <div className="next-hint">↳ 下一步:四件都换完了。回到第 3 章那台 GPT 边上,把六组真实训练摆一起算总账。</div>
    </div>
  )
}

const METRICS: { key: AbMetric; label: string }[] = [
  { key: 'val', label: 'val loss(越低越好)' },
  { key: 'params', label: '总参数' },
  { key: 'kv', label: 'KV cache / token' },
]

function Step6() {
  const [metric, setMetric] = useState<AbMetric>('val')
  const [sel, setSel] = useState(5)
  const { width, fmt } = abView(metric)
  const row = AB[sel]
  const base = AB[0]
  const ll = AB[5]
  const dv = row.val - base.val
  const checks: ReactNode[] = [
    <>四件齐上 val loss <b>{ll.val.toFixed(4)}</b>,老架构基线 <b>{base.val.toFixed(4)}</b>,低了 <b>{(base.val - ll.val).toFixed(4)}</b> —— 而且是在参数更少、KV cache 减半的前提下拿到的。</>,
    <>每 token 的 KV cache 从 <b>{base.kv}</b> 降到 <b>{ll.kv}</b> 个数,<b>省 {(100 * (1 - ll.kv / base.kv)).toFixed(0)}%</b> —— 这是本关唯一能在玩具规模上实打实测到的收益。</>,
    <>参数从 <b>{(base.params / 1e6).toFixed(3)} M</b> 变成 <b>{(ll.params / 1e6).toFixed(3)} M</b>(位置表没了、bias 少了、FFN 按 8/3 对齐),结构变了但规模可比。</>,
    <>RoPE 的相对性可验证:同一对 q/k 一起平移,注意力分数不变(见 STEP 2,实测偏差 {'<'} 1e-5)。</>,
  ]
  return (
    <div className={styles.scope}>
      <h2>⑥ 四件齐上:六组真实对照</h2>
      <p className="lead">
        同一份数据、同一套超参、同样 5000 步,只换零件,一共跑了<b>六组</b>:{' '}
        老架构基线、四个零件各自单开、以及四件齐上。点柱子看每一组的数:
      </p>
      <div className="btn-row">
        {METRICS.map((item) => (
          <button key={item.key} type="button" className={metric === item.key ? 'btn primary' : 'btn'} onClick={() => setMetric(item.key)}>{item.label}</button>
        ))}
      </div>
      <div className="ablab">
        {AB.map((r, i) => (
          <div key={r.key} className={i === sel ? 'abrow sel' : 'abrow'} onClick={() => setSel(i)}>
            <div className="an">{r.name}</div>
            <div className="at"><div className="af" style={{ width: `${width(r[metric]).toFixed(1)}%`, background: AB_COLORS[r.key] }} /></div>
            <div className="av">{fmt(r[metric])}</div>
          </div>
        ))}
      </div>
      <div className="note">
        <b>{row.name}</b> · {row.desc}<br />
        val loss <b>{row.val.toFixed(4)}</b>(基线 {base.val.toFixed(4)},{dv <= 0 ? `低了 ${Math.abs(dv).toFixed(4)}` : `高了 ${dv.toFixed(4)}`})
        {' '}· 参数 <b>{(row.params / 1e6).toFixed(3)} M</b>
        {' '}· 每 token KV cache <b>{row.kv} 个数</b>{row.kv < base.kv ? `(省 ${(100 * (1 - row.kv / base.kv)).toFixed(0)}%)` : ''}
      </div>
      <Dig title="诚实交代:哪些差异是真的,哪些只是噪声">
        六组都是<b>单种子、各跑一次</b>,所以差多少要分开看:{' '}
        <b>RMSNorm(−0.001)和 GQA(−0.005)这个量级基本就是噪声</b>,{' '}
        换个随机种子完全可能翻过来 —— 别据此说"RMSNorm 更好"。{' '}
        <b>SwiGLU 单开 −0.039、四件齐上 −0.054</b> 幅度大得多,更可能是真的,{' '}
        但严格讲也该多跑几个种子才敢下结论。
        <br /><br />
        更要紧的是:这四件在真实模型上被采用,靠的<b>本来就不主要是 loss</b>,而是{' '}
        ① 大规模下的训练稳定性;② 长上下文的外推能力(RoPE);③ 推理显存与吞吐(GQA)。{' '}
        这三样在 0.8M 参数、64 上下文的玩具规模上根本显不出来。{' '}
        本关能<b>确实测到</b>、且不依赖规模的只有一条:<b>KV cache 实打实少了一半</b>。
      </Dig>
      <Dig title="那我什么时候能看到这四件的真实收益?">
        把三个条件里的任意一个放大就能看到:<b>模型更大</b>(几亿参数往上,训练稳定性开始成为瓶颈)、
        <b>上下文更长</b>(几千 token 往上,RoPE 的外推和 KV cache 的显存都成为硬约束)、
        <b>真做推理服务</b>(并发几十上百条对话,KV cache 直接决定你一张卡能塞多少用户)。
        本项目停在玩具规模,是因为再往上就不是"看懂机制"的问题,而是要真金白银的算力了。
      </Dig>
      <div className="sub-h"><span className="badge">达标</span>本关实测(六次训练 · 各 5000 步 · tiny shakespeare)</div>
      <ul className="checklist">
        {checks.map((node, i) => (
          <li key={i}><span className="ck">✓</span><div>{node}</div></li>
        ))}
      </ul>
      <div className="sub-h"><span className="badge">Q&A</span>常见疑问</div>
      <Dig title="今天的模型只改了这四处吗?">
        这四件是<b>覆盖面最广、几乎人人都用</b>的一组,但不是全部。常见的还有:
        <b>权重绑定</b>与词表大小的取舍、<b>QK-Norm</b>(对 q/k 再做一次归一化,稳大模型训练)、
        <b>MoE</b>(第 11 章那关)、更长上下文的位置插值(NTK / YaRN)、
        以及注意力实现层面的工程优化(FlashAttention、PagedAttention)。
        再加上 MoE,你手上这套已经能拼出一个相当接近现代开源模型的骨架了。
      </Dig>
      <Dig title="残差连接在新模型里也在改吗?">
        在改。第 3 章的残差只有一条流:每个子层把输出加回同一根向量,<code>x = x + f(x)</code>。
        <br /><br />
        <b>Hyper-Connections</b>(ByteDance Seed,arXiv 2409.19606)把这条流复制成 <b>n 条</b>并行的残差流,{' '}
        子层按可学习的权重从 n 条流里读入、再写回,流与流之间还用一个矩阵相互混合。{' '}
        论文里 <b>n=4</b> 效果最好,<b>n=8</b> 基本不再提升。
        <br /><br />
        代价出在那个混合矩阵上:它不受约束,几十层连乘之后,残差原本"原样传过去"的恒等映射就没了,信号会被放大。{' '}
        DeepSeek 的 <b>mHC</b>(arXiv 2512.24880)在 27B 模型上测到,HC 复合映射的增益峰值约 <b>3000</b>。{' '}
        mHC 用 <b>Sinkhorn-Knopp</b> 迭代(<code>t_max=20</code> 次)把混合矩阵投影成<b>双随机矩阵</b>:{' '}
        元素非负,每行之和、每列之和都是 1。这类矩阵谱范数不超过 1,相乘之后仍是双随机矩阵,{' '}
        所以层层叠加也不会放大,增益峰值降到约 <b>1.6</b>。{' '}
        n=4 时额外训练时间 <b>6.7%</b>,在 3B / 9B / 27B 三个规模上做了验证。{' '}
        DeepSeek-V4 采用了 mHC(<code>n_hc=4</code>)。
        <br /><br />
        本项目没有手搓这一件,<code>10_llama.py</code> 里的残差仍是第 3 章那一条。
      </Dig>
      <Dig title="优化器也在换吗?这一关的模型换成 Muon 训会怎样?">
        在换。<Term k="muon" name="Muon · 优化器" def="给隐藏层 2D 权重用的优化器:先做动量,再用 Newton-Schulz 迭代把更新矩阵近似正交化,各方向步长接近。嵌入、输出头、归一化仍用 AdamW。">Muon</Term>(Keller Jordan 2024)只管隐藏层的 2D 权重:{' '}
        先做动量,再用 5 步 Newton-Schulz 迭代把更新矩阵近似正交化,让它在各个方向上走的步子接近;嵌入、输出头、归一化参数仍交给 AdamW。{' '}
        Kimi K2、DeepSeek-V4、Qwen3.8-Flash-Next 都公开用了它。
        <br /><br />
        <code>10_llama.py --optim muon</code> 在本关四件齐上的模型上跑了三组(Mac MPS · 各 5000 步 · 同一种子):
        <div className="tbl-scroll">
          <table className="minitbl">
            <tbody>
              <tr><th>优化器</th><th>step 500</th><th>step 1000</th><th>step 2500</th><th>结束 val loss</th></tr>
              <tr><td>AdamW lr 1e-3</td><td>1.7777</td><td>1.6540</td><td>1.5767</td><td>1.5381</td></tr>
              <tr><td>Muon lr 0.02</td><td>1.7099</td><td>1.6358</td><td>1.5951</td><td>1.5612</td></tr>
              <tr><td>Muon lr 0.005</td><td>1.7202</td><td>1.6048</td><td>1.5516</td><td><b>1.5182</b></td></tr>
            </tbody>
          </table>
        </div>
        两组 Muon 前 1000 步都比 AdamW 降得快;lr 0.02 后段被 AdamW 反超,lr 0.005 全程领先,结束时低 0.020。{' '}
        只扫了两个学习率、AdamW 的学习率没动、单种子,这组数据只说明"学习率合适时 Muon 在这个玩具上不输 AdamW",不足以给出倍数。{' '}
        Moonshot 在大模型上的报告(arXiv 2502.16982)是:加 weight decay、按矩阵形状缩放更新后,达到同样效果约需 AdamW 52% 的算力。
        <br /><br />
        上表 AdamW 那一行比 STEP 6 六组对照里的 1.5235 高 0.015:两次运行的 PyTorch 版本不同,同一份代码、同一个种子也不会逐位复现。{' '}
        比较时只比同一次批量运行里的数字。
      </Dig>
      <Dig title="第 11 章的 MoE 和这一关能一起用吗?">
        能,而且真实模型就是这么干的。DeepSeek-V3、Qwen 的 MoE 版本,都是{' '}
        <b>RoPE + RMSNorm + SwiGLU + GQA 打底,再把 FFN 换成 MoE</b>。
        因为两边动的是不同零件:这一关换的是位置编码、归一化、FFN 内部结构和 K/V 份数,
        第 11 章换的是"FFN 有几份、每个 token 走哪几份"。
        本项目把它们拆成两关,就是为了让你能一件一件看清楚,而不是一上来面对一整套配方。
      </Dig>
      <Dig title="学完这一关,我离读懂真实开源模型的代码还差多远?">
        结构上基本不差了。去翻一份 LLaMA 或 Qwen 的建模文件,你会看到的正是:{' '}
        <code>RMSNorm</code>、<code>rotary_emb</code>、<code>gate_proj/up_proj/down_proj</code>、
        <code>num_key_value_heads</code> —— 这一关这四个零件的名字。
        剩下的差距主要在工程侧:分布式训练怎么切、推理怎么批处理和调度、量化怎么做。
        那些是"把它跑到生产上"的问题,不再是"它是怎么算的"的问题。
      </Dig>
      <div className="codepath">↳ 跑法:<code>python 10_llama.py</code>(四件齐上)· <code>--preset gpt2</code>(老架构对照)· <code>--preset rope</code> 等单开一件</div>
    </div>
  )
}

export function Llama() {
  const chapter = findChapter('llama')
  if (!chapter) return null
  const panels = [<Step1 />, <Step2 />, <Step3 />, <Step4 />, <Step5 />, <Step6 />]
  return (
    <ChapterShell
      slug="llama"
      title="把 GPT-2 升级成 LLaMA:四个零件"
      subtitle={
        <>
          第 3 章那台 GPT 是 <b>2019 年</b>的样子。今天的开源模型(LLaMA / Qwen / Mistral / DeepSeek)长得不太一样了 —— 但换掉的<b>不是 Transformer 本身</b>,而是它身上四个零件:{' '}
          <Term k="rope" name="RoPE · 旋转位置编码" def="不再用一张可学习的位置表,而是把位置编成旋转角度,直接转进 q/k 里。注意力分数因此只依赖两个 token 的相对距离。">RoPE</Term>、{' '}
          <Term k="rmsnorm" name="RMSNorm · 均方根归一化" def="LayerNorm 的简化版:只除以均方根,不减均值、不带 bias。少一半算子,效果基本持平。">RMSNorm</Term>、{' '}
          <Term k="swiglu" name="SwiGLU · 门控前馈网络" def="FFN 的门控版:一路过 SiLU 当闸门,一路当内容,逐元素相乘。比 ReLU 一刀切负数更精细。">SwiGLU</Term>、{' '}
          <Term k="gqa" name="GQA · 分组查询注意力" def="多个 query 头共享一份 K/V。推理时 KV cache 按 kv 头数算,所以显存直接按比例省。">GQA</Term>。{' '}
          注意力、残差、训练循环一行没动。本关一次换一个,每个都能单独开关,最后跑一组{' '}
          <b>六选一的真实对照</b>。配套代码 <code>phase3-moe/10_llama.py</code>。
        </>
      }
      hp={
        <HpBar label="这一关">
          <HpChip color="#3a63c0" bg="#E5EBF9">n_embd <b>128</b> <i>主干维度</i></HpChip>
          <HpChip color="#a3548c" bg="#F6E6F0">n_head <b>4</b> <i>query 头数</i></HpChip>
          <HpChip color="#3f7d63" bg="#E4EFE9">head_size <b>32</b> <i>=128/4</i></HpChip>
          <HpChip color="#b8512f" bg="#F7E6DE">n_kv_head <b>2</b> <i>K/V 头数(GQA)</i></HpChip>
          <HpChip color="#a87b1f" bg="#FAEFD6">block_size <b>64</b> <i>上下文</i></HpChip>
          <span className="hp-note">底座 = 第 3 章那台 4 层 GPT · 配套 <code>10_llama.py</code></span>
        </HpBar>
      }
      steps={chapter.steps.map((s, i) => ({ title: s.nav, panel: panels[i] }))}
      congrats={
        <>
          <div className="ct">🎉 把 GPT-2 升级成 LLaMA · 通关</div>
          <div className="cs">你已经亲手把位置表换成旋转、把 LayerNorm 换成 RMSNorm、给 FFN 装上闸门、让 K/V 拼车。再加上第 11 章的 MoE,现代开源模型那套配方,你四件零件都手搓过一遍了。</div>
        </>
      }
    />
  )
}
