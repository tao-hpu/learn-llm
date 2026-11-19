import { Link } from 'react-router-dom'
import { HomeLink } from '../components/HomeLink'
import { Term } from '../components/Term'
import { bindId } from '../scroll'
import styles from './Notes.module.css'

export function Notes() {
  return (
    <div className={`wrap ${styles.page}`}>
      <HomeLink />
      <header>
        <h1>📖 学习札记 · 彩蛋</h1>
        <p className="subtitle">
          正课之外的边角料:它从哪儿来、为什么长这样、当年那帮人后来去哪了。
          不影响主线,但知道了会让你对着代码会心一笑。
        </p>
      </header>

      <article className={styles.card} id="egg-transformer" ref={bindId('egg-transformer')}>
        <span className={styles.tag}>彩蛋 01 · 前世今生</span>
        <h2>Transformer 的前世今生:一篇翻译论文,怎么变成全 AI 的地基</h2>
        <p className={styles.deck}>—— 你学的这条线(bigram → 注意力 → GPT)到底打哪儿来。</p>

        <h3>它本来只是想把翻译做快一点</h3>
        <p>
          2017 年,Google 一帮人发了篇{' '}
          <Term k="attention-paper" name="Attention Is All You Need" def="2017 年 Google 提出 Transformer 的奠基论文:用自注意力取代 RNN/CNN,实验跑的是机器翻译。GPT/BERT 都源于它。">《Attention Is All You Need》</Term>。
          当时的痛点很"工程":做翻译用的{' '}
          <Term k="self-attention" name="RNN / LSTM" def="Transformer 之前的主流序列模型,必须一个词一个词顺着算,慢、难并行、记不住长句。">RNN/LSTM</Term>
          {' '}<b>必须一个词一个词顺着算</b> —— 慢、没法并行、还记不住长句。他们想要个能<b>并行、又能抓长距离</b>的东西。
        </p>
        <p>
          注意力机制本身 2014 年就有人用了。他们真正"狠"的一招是:{' '}
          <span className={styles.hl}>干脆把循环结构整个删掉,只留注意力</span> —— 论文标题{' '}
          <i>Attention Is All You Need</i>(你只需要注意力)还带着点调皮的炫耀。
          实验跑的就是英→德、英→法翻译,<b>压根没想着"统一全 AI"</b>。
        </p>
        <div className={styles.aside}>
          🎯 <b>会心一笑点:</b>你在 <code>02_attention.py</code> 里写的那个"只看过去、不许偷看未来"的因果掩码,
          正是这篇论文为了"预测下一个词"埋下的种子;而你 Step 2 那"一次矩阵乘法搞定一整句",
          就是它取代 RNN"逐词顺算"的并行威力。
        </div>

        <h3>署名 8 个人,后来几乎全部"飞升"</h3>
        <p>
          论文署名 <b>8 位作者,全在 Google</b>,还特意加了个著名脚注:"<b>贡献均等,排名随机</b>"。
          如今这 8 人几乎个个开公司或进顶级团队 —— AI 圈最豪华的一次"师门散叶":
        </p>
        <table className={styles.table}>
          <tbody>
            <tr><th>作者</th><th>后来去了哪(大致)</th></tr>
            <tr><td>Ashish Vaswani</td><td>创办 Adept → 再创 <b>Essential AI</b></td></tr>
            <tr><td>Noam Shazeer <span className={styles.star}>★</span></td><td>创办 <b>Character.AI</b> → 2024 被 Google 重金请回,<b>联合领导 Gemini</b></td></tr>
            <tr><td>Niki Parmar</td><td>Adept → Essential AI(和 Vaswani 一路)</td></tr>
            <tr><td>Jakob Uszkoreit</td><td>创办 <b>Inceptive</b>(用 AI 设计 mRNA / 生物药)</td></tr>
            <tr><td>Llion Jones</td><td>创办 <b>Sakana AI</b>(东京)</td></tr>
            <tr><td>Aidan N. Gomez</td><td><b>Cohere</b> CEO(头部大模型公司;当年他还是实习生)</td></tr>
            <tr><td>Łukasz Kaiser</td><td>进 <b>OpenAI</b>(做推理模型 o 系列那条线)</td></tr>
            <tr><td>Illia Polosukhin</td><td>创办 <b>NEAR Protocol</b>(区块链)</td></tr>
          </tbody>
        </table>
        <p>
          光这 8 人后来创立/主导的公司,估值加起来好几百亿美金,方向还五花八门:大模型、生物、区块链、日本 AI……
        </p>

        <h3>无心插柳,还是本该如此?——两个都沾边</h3>
        <p>
          <b>无心插柳的一半:</b>他们解的是个很具体的"翻译提速"问题,<b>没预见它会变成全 AI 的地基</b> ——
          连作者后来都公开说"没想到能到这规模"。真正引爆威力的,是后来 GPT 把它<b>往大了 scale</b>。
        </p>
        <p>
          <b>本该如此的一半:</b>这也不是瞎猫碰死耗子。他们是一线顶尖研究员,<b>踩在一个真实的核心瓶颈上</b>{' '}
          (并行 + 长距离依赖),给的答案又足够<b>干净通用</b> —— 好的抽象往往如此:为翻译而造,却能解一切。
          所以那句"活该他们当大牛",<span className={styles.hl}>算实至名归</span>。
        </p>

        <h3>一张家谱:你学的是哪一栋楼</h3>
        <p>
          关键一句:<b>Transformer 是<u>架构(地基)</u>;BERT 和 GPT 是盖在上面的两栋楼。</b>{' '}
          不是"Transformer vs BERT" —— <b>BERT 的全名里就带着 Transformer</b>。
        </p>
        <div className={styles.houses}>
          <div className={`${styles.house} ${styles.u}`}>
            <h4>🏛 理解楼 · BERT 系</h4>
            <small><b>2018, Google.</b> 用 Transformer <b>编码器</b>那半边;<b>完形填空</b>式训练(能看左右两边)。 擅长理解 / 搜索 / 打标签,<b>不擅长生成</b>。2018–2021 统治 NLP,Google 搜索就用它。 百度 <b>文心 ERNIE 1.0</b>(2019)也站这栋(知识增强的编码器)。</small>
          </div>
          <div className={`${styles.house} ${styles.g}`}>
            <h4>🏗 生成楼 · GPT 系</h4>
            <small><b>2018, OpenAI.</b> 用 Transformer <b>解码器</b>那半边;<b>预测下一个词</b>(只看过去,带因果掩码)。 擅长生成 / 续写 / 对话。<b>ChatGPT 这波爆发就在这栋</b> —— 也是<b>你这套教程走的路线</b> (bigram → 注意力,一直在强调"只看过去")。</small>
          </div>
        </div>
        <ul className={styles.tl}>
          <li><span className={styles.yr}>~2017前</span>RNN / LSTM 时代:逐词顺算,慢、记不住长句。</li>
          <li><span className={styles.yr}>2017</span><b>Transformer</b> 诞生(本是翻译论文)—— 地基。</li>
          <li><span className={styles.yr}>2018</span>分叉:<b>GPT-1</b>(生成楼)与 <b>BERT</b>(理解楼)同年现身,都建在 Transformer 上。</li>
          <li><span className={styles.yr}>2019</span>百度 <b>文心 ERNIE 1.0</b>(理解楼,知识增强);BERT 进 Google 搜索。</li>
          <li><span className={styles.yr}>2020–22</span><b>Diffusion(扩散)</b>崛起做图像 —— 本是<b>另一套生成范式</b>(从噪声一步步去噪), 早期骨干是<b>卷积 U-Net</b>。</li>
          <li><span className={styles.yr}>2022→</span>ChatGPT 引爆生成楼;Diffusion 也改用 <b>Transformer 当骨干</b>(DiT:Sora、SD3、FLUX)。</li>
          <li><span className={styles.yr}>2023</span>百度 <b>文心一言</b>(ERNIE Bot)切到生成楼,对标 ChatGPT。</li>
        </ul>
        <div className={styles.aside}>
          🧩 <b>连 Diffusion 都来借它:</b>扩散是"怎么生成"的配方,Transformer 是"用什么网络干活"的骨架,
          两者本是正交的两层。早期 Diffusion 配卷积(U-Net),如今主流配 Transformer(DiT)——{' '}
          <b>强到别的范式都来拿它当钢筋</b>,这就是它为什么是这个时代的地基。
        </div>
      </article>

      <article className={styles.card} id="egg-real-run" ref={bindId('egg-real-run')}>
        <span className={styles.tag}>彩蛋 02 · 真实训练日志</span>
        <h2>别人的训练日志:12.75T token 那一年,到底出过什么岔子</h2>
        <p className={styles.deck}>—— 你在第 6 章看到的 loss 曲线是一条平滑的余弦。真实的大规模训练不长这样。</p>

        <h3>先对一下量级</h3>
        <table className={styles.table}>
          <tbody>
            <tr><th></th><th>本仓库(第 6 章)</th><th>Marin 8B</th></tr>
            <tr><td>参数量</td><td>124M</td><td>8B(约 65 倍)</td></tr>
            <tr>
              <td>训练数据</td>
              <td>
                <Term k="fineweb" name="FineWeb-Edu" def="从 Common Crawl 里筛出的教育向英文网页语料,本仓库第 6 章用的就是它的 10B token 版本。">FineWeb-Edu</Term>
                {' '}10B token
              </td>
              <td>12.75T token(约 1275 倍)</td>
            </tr>
            <tr><td>硬件</td><td>单卡 RTX 4090</td><td>TPU v5e-256 ×2 起步,中途换到 v4-2048</td></tr>
            <tr><td>训练过程</td><td>19073 步,一条余弦退火跑到底</td><td>五个阶段:中途换数据、换硬件、把学习率降下去又烧回来</td></tr>
          </tbody>
        </table>
        <p>
          数据量差着 1000 倍,零件却是同一套:你手搓过的{' '}
          <Term k="rope" name="RoPE · 旋转位置编码" def="把位置信息变成对 q/k 向量的旋转角度,不再额外加一个位置嵌入。第 12 章那一关拨的就是它。">RoPE</Term>、{' '}
          <Term k="adamw" name="AdamW" def="带权重衰减的 Adam 优化器,本仓库第 6 章逐个超参讲过 betas / eps / weight_decay。">AdamW</Term>、
          warmup + 退火,在 8B 上一个不多一个不少。差别在于:规模一上来,{' '}
          <span className={styles.hl}>每个零件都会以小模型上看不到的方式出问题</span>。
        </p>

        <h3>日志里才有、教程不写的三件事</h3>
        <p>
          <b>① 位置编码的配置默默错了很久。</b>训练跑出去一大截之后才发现,用的还是 Llama 2 那一版的旋转位置编码设置,
          中途才换成 Llama 3 式。你在第 12 章能一键开关的那个零件,在真实项目里是个会静默错下去的配置项:
          loss 照常下降,不会有任何报错提醒你。
        </p>
        <p>
          <b>② 学习率降到很低,loss 反而开始往上爬。</b>退火阶段本该是最稳的时候,训练 loss 却慢慢抬头。
          查下去,原因是输出层 <code>lm_head</code> 的权重范数在膨胀,加了一项系数 <code>1e-4</code> 的 z-loss 才压住。
          "学习率越小越安全"这个直觉在这里不成立。
        </p>
        <p>
          <b>③ 换硬件之后学习率怎么跟着改。</b>batch size 变大 k 倍,学习率乘 <code>√k</code>。
          这是那种不会写进任何教程、但每次扩机器都要用一次的经验公式。
        </p>

        <h3>真实预训练是分阶段的,不是填好超参按回车</h3>
        <p>它们给每个阶段起了动物名,一条曲线被切成五段:</p>
        <ul className={styles.tl}>
          <li><span className={styles.yr}>Kestrel</span>0 → 2.7T token。DCLM 数据配方,学习率 1e-3。</li>
          <li><span className={styles.yr}>Ocelot</span>2.7T → 3.78T。换到 v4-2048,学习率提到 1.7e-3。</li>
          <li><span className={styles.yr}>Jellyfish</span>3.78T → 4.78T。第一次冷却,学习率退到 1.7e-4。</li>
          <li><span className={styles.yr}>Phoenix</span>4.78T → 11.1T。学习率重新烧回 1.7e-3,数据换成 Nemotron-CC。切换那一刻 loss 短暂尖峰,随后回落到比之前更低。</li>
          <li><span className={styles.yr}>Starling</span>11.1T → 12.75T。第二次冷却到 1.7e-5,batch 提到 16Mi token/步。</li>
        </ul>
        <p>
          本仓库那组"300M vs 10B、唯一变量是数据量"的对照,在这里被拉长成一年:数据配方、学习率、批大小、硬件,{' '}
          <b>全都是跑的过程中改的</b>。看完这份日志再回头看自己那条平滑的余弦曲线,你会知道它平滑是因为规模小,
          不是因为训练本该如此。
        </p>
        <div className={styles.aside}>
          🔭 <b>这份日志出自哪:</b>Marin,2024 年在斯坦福发起、现由 Open Athena 主导的开放训练项目,
          把代码、权重、数据来源和实验记录(包括没跑通的方向)全部公开,目前在训一个 535B 的{' '}
          <Term k="moe" name="MoE · 混合专家" def="把 FFN 拆成多个专家,路由器每步只派单给其中几个,参数变多而每 token 算力不变。第 11 章手搓过一个 4 专家版。">MoE</Term>{' ('}<Term k="active-params" name="激活参数" def="MoE 里每个 token 实际参与计算的参数量,远小于总参数量。">激活参数</Term>
          {' '}23B,18T token)。
          它用 JAX + TPU,不是本仓库的 PyTorch,所以<b>值得看的是过程,不是代码</b>。
          <div className={styles.links}>
            <a href="https://marin.readthedocs.io/en/latest/reports/marin-8b-retro/" target="_blank" rel="noopener">8B 训练回顾(本文素材) ↗</a>
            <a href="https://marin.readthedocs.io/en/latest/reports/marin-32b-retro/" target="_blank" rel="noopener">32B 训练回顾 ↗</a>
            <a href="https://marin.readthedocs.io/en/latest/reports/agent-moe-experiments/" target="_blank" rel="noopener">MoE 实验摘要 ↗</a>
            <a href="https://github.com/marin-community/marin" target="_blank" rel="noopener">GitHub 仓库 ↗</a>
          </div>
        </div>
      </article>

      <article className={styles.card} id="egg-2026-archs" ref={bindId('egg-2026-archs')}>
        <span className={styles.tag}>彩蛋 03 · 拆两颗新模型</span>
        <h2>两颗 2026 年的模型,拆开对照本仓库第几章</h2>
        <p className={styles.deck}>Qwen3.8-Flash-Next(2026-08-26 发布)与 DeepSeek-V4-Flash(2026 preview 报告)。每个零件标出出处,再标出本仓库哪一章讲过它。</p>

        <h3>零件对照表</h3>
        <p>
          两颗都是{' '}
          <Term k="moe" name="MoE · 混合专家" def="把 FFN 拆成多个专家,路由器每个 token 只派给其中 top-k 个。总参数变多,每 token 计算量不变。第 11 章手搓过一个 4 专家版。">MoE</Term>,
          表里逐行列出 MoE 之外的注意力、记忆表、残差、优化器等零件。灰色小字是出处:「报告」指各自的技术报告,「HF 卡」指 Hugging Face 模型卡。
        </p>
        <div className={styles.tbl}>
          <table className={styles.table}>
            <tbody>
              <tr><th>零件</th><th>Qwen3.8-Flash-Next</th><th>DeepSeek-V4-Flash</th><th>本仓库</th></tr>
              <tr>
                <td className={styles.part}>MoE 专家配置</td>
                <td>
                  总参 125B,每 token{' '}
                  <Term k="active-params" name="激活参数" def="处理一个 token 实际参与计算的参数量。MoE 里只算 top-k 个专家,所以远小于总参数。省的是算力,不是显存。">激活</Term>
                  {' '}6B <span className={styles.src}>报告</span><br />
                  512 个专家,每 token 选 10 个,另有 1 个共享专家 <span className={styles.src}>config.json</span>
                </td>
                <td>总参 284B,激活 13B;256 个 routed 专家 + 1 个共享专家,每 token 选 6 个;前 3 个 MoE 层用 Hash routing <span className={styles.src}>报告 §4.2.1</span></td>
                <td className={styles.ch}><Link to="/ch/moe">第 11 章 · MoE</Link><br />路由器 + top-k;共享专家在该页折叠段</td>
              </tr>
              <tr>
                <td className={styles.part}>注意力</td>
                <td>
                  48 层 = 12 × (3 层 Gated DeltaNet + 1 层 QSA),每层后接 MoE <span className={styles.src}>HF 卡</span><br />
                  QSA 在持续预训练阶段替换原来的全注意力层:key 每 r=4 个 token 平均池化成一块,每个 query 在 K=2048 token 预算内选最多 512 块;索引器是 MQA,4 个 query 头共享 1 个 key 头{' '}
                  <span className={styles.src}>报告 §2.1.2</span>
                </td>
                <td>
                  CSA:每 m=4 个 token 的 KV 压成一条,再做 DeepSeek Sparse Attention,Flash 的 top-k=512;HCA:每 m′=128 个 token 压成一条,对压缩条目做稠密注意力;另有 128 token 滑窗和 attention sink{' '}
                  <span className={styles.src}>报告 §2.3、§4.2.1</span><br />
                  Flash 前两层只用滑窗,之后 CSA / HCA 交替 <span className={styles.src}>config.json</span><br />
                  索引器注意力用 FP4 计算 <span className={styles.src}>报告 §2.3</span>;KV 中带{' '}
                  <Term k="rope" name="RoPE · 旋转位置编码" def="把位置编成旋转角度,直接转进 q/k 里,注意力分数只依赖两个 token 的相对距离。第 12 章讲过。">RoPE</Term>
                  {' '}的维度存 BF16,其余维度存 FP8 <span className={styles.src}>报告</span>
                </td>
                <td className={styles.ch}>
                  <Link to="/ch/linear-attention">第 13 章 · 线性注意力</Link>(Gated DeltaNet、3:1 混合)<br />
                  <Link to="/ch/sparse-attention">第 14 章 · 稀疏注意力</Link>(NSA / DSA / CSA / QSA)<br />
                  <Link to="/ch/llama">第 12 章</Link>(MQA 是 GQA 的极端情况;RoPE)<br />
                  <Link to="/ch/quantization">第 17 章 · 量化</Link>(FP4 / FP8)
                </td>
              </tr>
              <tr>
                <td className={styles.part}>额外记忆表</td>
                <td>N-gram Embedding,只有 1 层,放在第 2 层;以每个 token 结尾的 bigram / trigram 作 key 查表;表参数 51B,放在主机内存,异步预取 <span className={styles.src}>报告摘要、§2.3;HF 卡</span></td>
                <td>V4 报告全文没有出现 Engram 或 n-gram 记忆表;前 3 个 MoE 层用的 Hash routing 是专家路由方式,与记忆表是两回事 <span className={styles.src}>报告 §4.2.1</span></td>
                <td className={styles.ch}><Link to="/ch/ngram-memory">第 15 章 · N-gram 查表</Link></td>
              </tr>
              <tr>
                <td className={styles.part}>多 token 预测</td>
                <td>附带 4B 参数的 MTP 模块 <span className={styles.src}>HF 卡</span></td>
                <td>MTP depth = 1 <span className={styles.src}>报告 §4.2.1</span></td>
                <td className={styles.ch}><Link to="/ch/speculative-decoding">第 16 章 · MTP 与投机解码</Link></td>
              </tr>
              <tr>
                <td className={styles.part}>残差</td>
                <td>Gated Residual:残差流拓宽成 4 支,读出走逐元素门控,去掉分支混合矩阵 H<sup>res</sup>;Tab.5 与 mHC 静态、动态两版做了对照 <span className={styles.src}>报告</span></td>
                <td>
                  mHC,n<sub>hc</sub> = 4,t<sub>max</sub> = 20 <span className={styles.src}>报告 §4.2.1</span><br />
                  mHC 用 Sinkhorn-Knopp 迭代 20 次,把 H<sup>res</sup> 投影成双随机矩阵(非负,行和、列和都为 1){' '}
                  <span className={styles.src}>mHC §4.1–4.2</span>
                </td>
                <td className={styles.ch}>
                  本仓库未手搓<br />
                  本仓库用的是单支{' '}
                  <Term k="residual" name="残差连接" def="把子层的输出加回它的输入:x = x + 子层(x)。第 3 章完整 Transformer 里用过。">残差</Term>
                  {' '}x + 子层(x),见 <Link to="/ch/transformer">第 3 章</Link>
                </td>
              </tr>
              <tr>
                <td className={styles.part}>优化器</td>
                <td>
                  Muon:注意力 q/k/v/o、GDN 输入输出投影、专家 fc1/fc2、n-gram 层 k/v 投影<br />
                  AdamW:输入 embedding、输出头、router、GR 低秩投影;n-gram 表用 Adam,不加 weight decay<br />
                  Newton-Schulz 8 步 <span className={styles.src}>报告 §3.1</span>
                </td>
                <td>
                  Muon:大多数参数;AdamW:embedding、预测头、RMSNorm 权重<br />
                  Newton-Schulz 共 10 次:前 8 次系数 (3.4445, −4.7750, 2.0315),后 2 次 (2, −1.5, 0.5){' '}
                  <span className={styles.src}>报告 §2.4、§4.2.2</span>
                </td>
                <td className={styles.ch}>
                  本仓库未手搓<br />
                  Muon 全称 MomentUm Orthogonalized by Newton-Schulz:用 Newton-Schulz 迭代把动量矩阵近似正交化后再更新。本仓库只用{' '}
                  <Term k="adamw" name="AdamW" def="带权重衰减的 Adam 优化器,本仓库第 6 章逐个超参讲过。">AdamW</Term>,见 <Link to="/ch/pretraining">第 6 章</Link>
                </td>
              </tr>
              <tr>
                <td className={styles.part}>上下文</td>
                <td>
                  报告在 1M 上下文下测 QSA:kernel 级 prefill 7.6×、decode 4.9× <span className={styles.src}>报告 §2.1.2</span><br />
                  max_position_embeddings = 262,144 <span className={styles.src}>config.json</span>
                </td>
                <td>
                  1M <span className={styles.src}>报告摘要</span><br />
                  同报告:V4-Pro 单 token 推理 FLOPs 为 V3.2 的 27%,KV cache 为 V3.2 的 10%
                </td>
                <td className={styles.ch}>
                  <Link to="/ch/sampling">第 5 章</Link>(
                  <Term k="kv-cache" name="KV-cache" def="把过去每个 token 的 K/V 缓存下来,生成新 token 时只算新的一列,避免重算整段。">KV-cache</Term>
                  {' '}的来历)<br />
                  第 13、14 章(长上下文下的注意力代价)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          表里的 QSA 层在 config.json 里是 24 个 query 头配 2 个 KV 头(head_dim 256),
          也就是第 12 章的{' '}
          <Term k="gqa" name="GQA · 分组查询注意力" def="多个 query 头共享一份 K/V。推理时 KV cache 按 kv 头数算,所以显存直接按比例省。">GQA</Term>。
        </p>

        <h3>两家都把「每 token 算多少」和「一共存多少」分开了</h3>
        <p>
          <b>第一层拆分是 MoE,两家相同。</b>Qwen3.8-Flash-Next 每 token 激活 6B / 125B,约 4.8%;
          DeepSeek-V4-Flash 激活 13B / 284B,约 4.6%。没被选中的专家仍占存储,只是不参与这个 token 的计算。
        </p>
        <p>
          <b>Qwen 另外把一部分参数挪出加速器,并减少全注意力层。</b>51B 的 n-gram 表放在主机内存,每个 token 只按自己结尾的短 n-gram 取表项。
          报告 Tab.8 在固定总参数下扫分配比例:n-gram 占 25% 时 loss 最低,下游指标没有随之改善。
          注意力这边,48 层里 36 层是 Gated DeltaNet,状态矩阵的形状固定,不随上下文变长;
          剩下 12 层 QSA 每个 query 最多看 2048 个 token。
        </p>
        <p>
          <b>DeepSeek 没有挂记忆表,压缩做在 KV 上。</b>每层都保留注意力,但 CSA 把 4 个 token 的 KV 合成 1 条、HCA 把 128 个合成 1 条,
          CSA 再只取 top-512;位宽方面,索引器用 FP4,KV 里不带 RoPE 的维度用 FP8。
          报告给出的 Pro 版对比是 KV cache 为 V3.2 的 10%。
          DeepSeek 在 Engram 论文里做过 n-gram 记忆表(Engram-27B 插在第 2、15 层),V4 报告里没有出现这个模块。
        </p>
        <div className={styles.aside}>
          📚 <b>出处:</b>表中「报告」对 Qwen 指其技术报告 <i>On the Design of Qwen3.8-Next Architecture</i>,
          对 DeepSeek 指 V4 报告(arXiv 2606.19348,2026 preview 版本);节号、表号取自原文。
          第 13–17 章页面讲这些零件的机制。
          <div className={styles.links}>
            <a href="https://github.com/QwenLM/Qwen3.8-Flash-Next" target="_blank" rel="noopener">Qwen3.8-Flash-Next 技术报告(GitHub) ↗</a>
            <a href="https://arxiv.org/abs/2606.19348" target="_blank" rel="noopener">DeepSeek-V4 · arXiv 2606.19348(2026 preview) ↗</a>
            <a href="https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct" target="_blank" rel="noopener">Qwen3-Next-80B-A3B 模型卡 ↗</a>
            <a href="https://arxiv.org/abs/2512.24880" target="_blank" rel="noopener">mHC · arXiv 2512.24880 ↗</a>
            <a href="https://arxiv.org/abs/2601.07372" target="_blank" rel="noopener">Engram · arXiv 2601.07372 ↗</a>
          </div>
        </div>
      </article>

      <footer className={styles.foot}>
        更多彩蛋持续补充中。回到正课 → <Link to="/">首页</Link> ·
        不懂的术语查 <Link to="/glossary">名词表</Link>。
        <div className={styles.copy}>
          © 2026 <a href="https://fim.ai" target="_blank" rel="noopener">FIM Labs</a> · 从零手写大语言模型 · MIT License
        </div>
      </footer>
    </div>
  )
}
