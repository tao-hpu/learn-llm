// 名词表 · 现代架构零件(Phase 3)
import type { GlossaryEntry } from './types'
import { Link } from 'react-router-dom'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "rope",
    titleText: "RoPE Rotary Position Embedding · 旋转位置编码",
    def: "把\"第几个位置\"编码成旋转角度,直接转进 q 和 k 里,而不是像 位置嵌入那样查一张表再相加。 向量按两两一对当成平面上的点,位置越靠后转得越多;每对配一个不同的转速,快的管近处、慢的管远处。它最重要的性质是:转完之后 q·k 只依赖两个 token 的相对距离,与它们的绝对位置无关 —— 这正是语言里真正要紧的信息。而且没有\"表只有 block_size 行\"的限制,所以后来把上下文从 4K 拉到 128K 的做法 (NTK / YaRN 等)动的都是 RoPE 的频率。只作用在 q、k 上,v 不转(位置只该影响\"谁看谁\",不影响搬运的内容)。 本项目在第 12 章 / 10_llama.py 手搓了一遍。 🥚 它在真实训练里错过一次(整段跑了几万亿 token 才发现用的是上一代设置)→ 学习札记。",
    title: <>RoPE <En>Rotary Position Embedding · 旋转位置编码</En></>,
    body: <><p>把"第几个位置"编码成<b>旋转角度</b>,直接转进 q 和 k 里,而不是像 <a href={"#positional-embedding"}>位置嵌入</a>那样查一张表再相加。 向量按两两一对当成平面上的点,位置越靠后转得越多;每对配一个不同的转速,快的管近处、慢的管远处。</p><p>它最重要的性质是:转完之后 <code>q·k</code> <b>只依赖两个 token 的相对距离</b>,与它们的绝对位置无关 —— 这正是语言里真正要紧的信息。而且没有"表只有 block_size 行"的限制,所以后来把上下文从 4K 拉到 128K 的做法 (NTK / YaRN 等)动的都是 RoPE 的频率。<b>只作用在 q、k 上,v 不转</b>(位置只该影响"谁看谁",不影响搬运的内容)。 本项目在<b>第 12 章 / <code>10_llama.py</code></b> 手搓了一遍。 🥚 它在真实训练里错过一次(整段跑了几万亿 token 才发现用的是上一代设置)→ <Link to={"/notes#egg-real-run"}>学习札记</Link>。</p></>,
  },
  {
    id: "rmsnorm",
    titleText: "RMSNorm Root Mean Square Normalization",
    def: "LayerNorm 的简化版。LayerNorm 做两件事:①减均值 ②除以标准差; RMSNorm 只做第 ②,直接除以均方根,而且不带 bias。省掉的那一步在实测里贡献很小,但归一化每层要做两次,几十上百层累起来就是实打实的算力与参数。 效果基本持平,所以 LLaMA 之后的模型基本都换成了它。代价是输出不再以 0 为中心 —— 归一化真正要的是把尺度拉回来,这一点它照做。",
    title: <>RMSNorm <En>Root Mean Square Normalization</En></>,
    body: <><p><a href={"#layernorm"}>LayerNorm</a> 的简化版。LayerNorm 做两件事:①减均值 ②除以标准差; RMSNorm <b>只做第 ②</b>,直接除以均方根,而且不带 bias。</p><p>省掉的那一步在实测里贡献很小,但归一化<b>每层要做两次</b>,几十上百层累起来就是实打实的算力与参数。 效果基本持平,所以 LLaMA 之后的模型基本都换成了它。代价是输出不再以 0 为中心 —— 归一化真正要的是把<b>尺度</b>拉回来,这一点它照做。</p></>,
  },
  {
    id: "swiglu",
    titleText: "SwiGLU Swish-Gated Linear Unit · 门控前馈网络",
    def: "FFN 的门控版本。输入走两路:一路过 SiLU(x·sigmoid(x),也叫 Swish)当闸门,一路当内容,两路逐元素相乘,再压回主干。和 ReLU 的差别在于谁来决定关不关:ReLU 由通道自己说了算,只有\"全开\"和\"关死\"; 门控的开度来自另一路独立的线性变换,可以做到\"这个通道只放三成过去\"。 因为多了一个矩阵(gate / up / down 三个),隐层要收窄到 8/3·n_embd 才与 ReLU 版参数量相当 —— 这就是那个奇怪系数的来历。",
    title: <>SwiGLU <En>Swish-Gated Linear Unit · 门控前馈网络</En></>,
    body: <><p><a href={"#feedforward"}>FFN</a> 的门控版本。输入走<b>两路</b>:一路过 <b>SiLU</b>(<code>x·sigmoid(x)</code>,也叫 Swish)当<b>闸门</b>,一路当<b>内容</b>,两路逐元素相乘,再压回主干。</p><p>和 <a href={"#relu"}>ReLU</a> 的差别在于<b>谁来决定关不关</b>:ReLU 由通道自己说了算,只有"全开"和"关死"; 门控的开度来自另一路独立的线性变换,可以做到"这个通道只放三成过去"。 因为多了一个矩阵(gate / up / down 三个),隐层要收窄到 <b>8/3·n_embd</b> 才与 ReLU 版参数量相当 —— 这就是那个奇怪系数的来历。</p></>,
  },
  {
    id: "gqa",
    titleText: "GQA Grouped-Query Attention · 分组查询注意力",
    def: "让多个 query 头共享一份 K/V。query 头数不变(各问各的),但 K/V 只存 n_kv_head 份, 每组内的 query 头合用一份。因为 KV-cache 是按 K/V 头数算的, 显存直接按比例省:4 个 query 头配 2 份 K/V,cache 就少一半。两个极端:n_kv_head = n_head 就是普通多头注意力(MHA); n_kv_head = 1 是 MQA,省得最狠但表达力损失明显。 GQA 正是被当作两者之间的折中提出来的,现在主流模型多用它(比如 64 个 query 头配 8 份 K/V)。",
    title: <>GQA <En>Grouped-Query Attention · 分组查询注意力</En></>,
    body: <><p>让<b>多个 query 头共享一份 K/V</b>。query 头数不变(各问各的),但 K/V 只存 <code>n_kv_head</code> 份, 每组内的 query 头合用一份。因为 <a href={"#kv-cache"}>KV-cache</a> 是按 K/V 头数算的, 显存直接按比例省:4 个 query 头配 2 份 K/V,cache 就少一半。</p><p>两个极端:<code>n_kv_head = n_head</code> 就是普通<a href={"#multi-head"}>多头注意力</a>(MHA); <code>n_kv_head = 1</code> 是 <b>MQA</b>,省得最狠但表达力损失明显。 GQA 正是被当作两者之间的折中提出来的,现在主流模型多用它(比如 64 个 query 头配 8 份 K/V)。</p></>,
  },
  {
    id: "muon",
    titleText: "Muon MomentUm Orthogonalized by Newton-Schulz",
    def: "给隐藏层 2D 权重用的优化器(Keller Jordan 2024)。先做动量,再用 Newton-Schulz 迭代把更新矩阵近似正交化 (五次多项式系数 3.4445, −4.7750, 2.0315,迭代 5 步),让更新在各个方向上的步长接近;嵌入、输出头、归一化等参数仍用 AdamW。 Moonshot(arXiv 2502.16982)在大模型上加了 weight decay 和按矩阵形状缩放更新,报告达到同样效果约需 AdamW 52% 的算力。 Kimi K2、DeepSeek-V4、Qwen3.8-Flash-Next 都公开使用 Muon(后两者的 Newton-Schulz 分别是 10 次和 8 步)。 本项目 10_llama.py --optim muon 可以直接对照(第 12 章 STEP 6 的 Q&A)。",
    title: <>Muon <En>MomentUm Orthogonalized by Newton-Schulz</En></>,
    body: <><p>给隐藏层 2D 权重用的优化器(Keller Jordan 2024)。先做动量,再用 Newton-Schulz 迭代把更新矩阵近似正交化 (五次多项式系数 3.4445, −4.7750, 2.0315,迭代 5 步),让更新在各个方向上的步长接近;嵌入、输出头、归一化等参数仍用 <a href={"#adamw"}>AdamW</a>。 Moonshot(arXiv 2502.16982)在大模型上加了 weight decay 和按矩阵形状缩放更新,报告达到同样效果约需 AdamW 52% 的算力。 Kimi K2、DeepSeek-V4、Qwen3.8-Flash-Next 都公开使用 Muon(后两者的 Newton-Schulz 分别是 10 次和 8 步)。 本项目 <code>10_llama.py --optim muon</code>{" 可以直接对照(第 12 章 STEP 6 的 Q&A)。"}</p></>,
  },
]
