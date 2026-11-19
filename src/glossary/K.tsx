// 名词表 · 补齐全链路(Phase 5)
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "byte-level-bpe",
    titleText: "字节级 BPE byte-level BPE",
    def: "初始词表是 256 个字节的 BPE:文本先按 UTF-8 编成字节,再反复把出现最多的相邻一对合并成新 token。 任何字符串都能编码,不需要\"未知字符\";代价是中文等每字 3 字节的文字初始序列长,要靠合并压回来。GPT-2 论文 §2.2 提出这一做法。第 18 章 phase5-fullstack/16_bpe.py 在 8 MB FineWeb-Edu 上训到 16,384 词表(16,128 次合并,纯 Python 约 2 分钟), 1 MB 测试语料每 token 4.252 字节,GPT-2 的 50,257 词表是 4.622。",
    title: [
      "字节级 BPE ",
      <En key={1}>{[
        "byte-level BPE",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "初始词表是 256 个字节的 ",
        <a key={1} href={"#bpe"}>{[
          "BPE",
        ]}</a>,
        ":文本先按 UTF-8 编成字节,再反复把出现最多的相邻一对合并成新 token。 任何字符串都能编码,不需要\"未知字符\";代价是中文等每字 3 字节的文字初始序列长,要靠合并压回来。GPT-2 论文 §2.2 提出这一做法。",
      ]}</p>,
      <p key={1}>{[
        "第 18 章 ",
        <code key={1}>{[
          "phase5-fullstack/16_bpe.py",
        ]}</code>,
        " 在 8 MB FineWeb-Edu 上训到 16,384 词表(16,128 次合并,纯 Python 约 2 分钟), 1 MB 测试语料每 token 4.252 字节,GPT-2 的 50,257 词表是 4.622。",
      ]}</p>,
    ],
  },
  {
    id: "bpe-merges",
    titleText: "合并表 BPE merges",
    def: "BPE 训练的全部产物:按先后顺序记下的每一次合并,第 i 条合并产生 id 为 256 + i 的新 token。 编码新文本时,在每一段里反复找\"合并表里排得最靠前\"的相邻对合掉,直到没有能合的;解码是把每个 token 查回它代表的字节拼起来。 只用合并表的前 k 条,就得到一个 256 + k 的小词表(第 18 章 STEP 4 的扫描就是这样做的)。",
    title: [
      "合并表 ",
      <En key={1}>{[
        "BPE merges",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "BPE 训练的全部产物:按先后顺序记下的每一次合并,第 i 条合并产生 id 为 256 + i 的新 token。 编码新文本时,在每一段里反复找\"合并表里排得最靠前\"的相邻对合掉,直到没有能合的;解码是把每个 token 查回它代表的字节拼起来。 只用合并表的前 k 条,就得到一个 256 + k 的小词表(第 18 章 STEP 4 的扫描就是这样做的)。",
      ]}</p>,
    ],
  },
  {
    id: "pretokenize",
    titleText: "预切分 pre-tokenization",
    def: "BPE 合并前先用规则把文本切成小段,合并不跨段。GPT-2 的正则按缩写('s 't …)、字母串、数字串、其他符号、空白分类切, 所以 dog. dog! 里的 dog 是同一个 token。第 18 章对照:同样 16,128 次合并,只按空格切时词表里有 2,279 个字母和标点粘在一起的 token(如 s, ation.), GPT-2 正则下只有 7 个(全是缩写);只按空格切的压缩率高 3.8%。",
    title: [
      "预切分 ",
      <En key={1}>{[
        "pre-tokenization",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "BPE 合并前先用规则把文本切成小段,合并不跨段。GPT-2 的正则按缩写('s 't …)、字母串、数字串、其他符号、空白分类切, 所以 ",
        <code key={1}>{[
          "dog.",
        ]}</code>,
        " ",
        <code key={3}>{[
          "dog!",
        ]}</code>,
        " 里的 ",
        <code key={5}>{[
          "dog",
        ]}</code>,
        " 是同一个 token。",
      ]}</p>,
      <p key={1}>{[
        "第 18 章对照:同样 16,128 次合并,只按空格切时词表里有 ",
        <b key={1}>{[
          "2,279",
        ]}</b>,
        " 个字母和标点粘在一起的 token(如 ",
        <code key={3}>{[
          "s,",
        ]}</code>,
        " ",
        <code key={5}>{[
          "ation.",
        ]}</code>,
        "), GPT-2 正则下只有 7 个(全是缩写);只按空格切的压缩率高 3.8%。",
      ]}</p>,
    ],
  },
  {
    id: "bytes-per-token",
    titleText: "每 token 字节数 bytes per token · 压缩率",
    def: "一段文本的 UTF-8 字节数除以编码后的 token 数。越大,一个 token 平均代表的文本越多,同样 1024 的上下文能装更多内容,训练同样多文本需要的步数也越少。 它依赖训练语料:第 18 章用英文语料训出的分词器,中文例句每 token 只有 1 个字节(一个汉字都没合并)。",
    title: [
      "每 token 字节数 ",
      <En key={1}>{[
        "bytes per token · 压缩率",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "一段文本的 UTF-8 字节数除以编码后的 token 数。越大,一个 token 平均代表的文本越多,同样 1024 的上下文能装更多内容,训练同样多文本需要的步数也越少。 它依赖训练语料:第 18 章用英文语料训出的分词器,中文例句每 token 只有 1 个字节(一个汉字都没合并)。",
      ]}</p>,
    ],
  },
  {
    id: "online-softmax",
    titleText: "online softmax 分段计算 softmax",
    def: "把一行数分成几段依次读,只记到目前为止的最大值 m 和按 m 算的指数和 l;新的一段带来更大的最大值时,之前的 l(以及累加中的输出)乘 exp(m_旧 − m_新) 缩回去。 读完一整行,结果与一次算完的 softmax 完全相同,不是近似。 出处 Milakov & Gimelshein, arXiv 1805.02867;它是 FlashAttention 能分块的前提。",
    title: [
      "online softmax ",
      <En key={1}>{[
        "分段计算 softmax",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把一行数分成几段依次读,只记到目前为止的最大值 m 和按 m 算的指数和 l;新的一段带来更大的最大值时,之前的 l(以及累加中的输出)乘 exp(m_旧 − m_新) 缩回去。 读完一整行,结果与一次算完的 ",
        <a key={1} href={"#softmax"}>{[
          "softmax",
        ]}</a>,
        " 完全相同,不是近似。 出处 Milakov & Gimelshein, arXiv 1805.02867;它是 ",
        <a key={3} href={"#flash-attention"}>{[
          "FlashAttention",
        ]}</a>,
        " 能分块的前提。",
      ]}</p>,
    ],
  },
  {
    id: "triton",
    titleText: "Triton GPU kernel 语言",
    def: "OpenAI 开源的 GPU 编程语言,写在 Python 里、按\"块\"描述计算:tl.load 读一块数据到片上,tl.dot 做块间矩阵乘, 线程分配、共享内存和流水由编译器决定。PyTorch 的 torch.compile 在 GPU 上生成的也是 Triton kernel。 第 19 章 17_flash_attn.py 的 _flash_fwd 用约 30 行 Triton 写了 FlashAttention 前向。",
    title: [
      "Triton ",
      <En key={1}>{[
        "GPU kernel 语言",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "OpenAI 开源的 GPU 编程语言,写在 Python 里、按\"块\"描述计算:",
        <code key={1}>{[
          "tl.load",
        ]}</code>,
        " 读一块数据到片上,",
        <code key={3}>{[
          "tl.dot",
        ]}</code>,
        " 做块间矩阵乘, 线程分配、共享内存和流水由编译器决定。PyTorch 的 ",
        <code key={5}>{[
          "torch.compile",
        ]}</code>,
        " 在 GPU 上生成的也是 Triton kernel。 第 19 章 ",
        <code key={7}>{[
          "17_flash_attn.py",
        ]}</code>,
        " 的 ",
        <code key={9}>{[
          "_flash_fwd",
        ]}</code>,
        " 用约 30 行 Triton 写了 FlashAttention 前向。",
      ]}</p>,
    ],
  },
  {
    id: "scaling-law",
    titleText: "Scaling law 规模定律",
    def: "模型最终 loss 随参数量 N 和训练 token 数 D 按幂律下降的经验规律。Chinchilla(Hoffmann et al., arXiv 2203.15556)用的形式是 L(N, D) = E + A/N^α + B/D^β:E 是数据本身降不下去的部分,另两项分别是模型太小、数据太少欠下的账。 做法是训一批小模型拟合系数,再外推到大模型。Kaplan et al.(arXiv 2001.08361)只数非嵌入参数,Chinchilla 数全部参数,两者的系数不能直接互换。第 20 章 18_scaling.py 用 21 个 0.6M–25M 小模型的训练终点拟合,外推第 6 章 124M 训 10B token 的 loss:预测 3.36,实测 3.03。拟合点的 D 最多 16 亿,外推越远,预测偏高越多。",
    title: [
      "Scaling law ",
      <En key={1}>{[
        "规模定律",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "模型最终 loss 随参数量 N 和训练 token 数 D 按幂律下降的经验规律。Chinchilla(Hoffmann et al., arXiv 2203.15556)用的形式是 ",
        <code key={1}>{[
          "L(N, D) = E + A/N^α + B/D^β",
        ]}</code>,
        ":E 是数据本身降不下去的部分,另两项分别是模型太小、数据太少欠下的账。 做法是训一批小模型拟合系数,再外推到大模型。Kaplan et al.(arXiv 2001.08361)只数非嵌入参数,Chinchilla 数全部参数,两者的系数不能直接互换。",
      ]}</p>,
      <p key={1}>{[
        "第 20 章 ",
        <code key={1}>{[
          "18_scaling.py",
        ]}</code>,
        " 用 21 个 0.6M–25M 小模型的训练终点拟合,外推第 6 章 124M 训 10B token 的 loss:预测 3.36,实测 3.03。拟合点的 D 最多 16 亿,外推越远,预测偏高越多。",
      ]}</p>,
    ],
  },
  {
    id: "compute-optimal",
    titleText: "算力最优 compute-optimal",
    def: "训练算力约 C ≈ 6·N·D(每个 token 前向 2N、反向 4N 次浮点运算)。C 固定时,让预测 loss 最小的那组 (N, D) 就是算力最优配比。 由 L(N, D) 求导可得 N_opt ∝ Cβ/(α+β)、D_opt ∝ Cα/(α+β)。Chinchilla 的结论是 N 与 D 大致同比例增长,约每个参数 20 个 token。 只看训练算力最省;推理成本也要算的话,常会刻意用更小的模型训更多 token。",
    title: [
      "算力最优 ",
      <En key={1}>{[
        "compute-optimal",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "训练算力约 C ≈ 6·N·D(每个 token 前向 2N、反向 4N 次浮点运算)。C 固定时,让预测 loss 最小的那组 (N, D) 就是算力最优配比。 由 L(N, D) 求导可得 N_opt ∝ C",
        <sup key={1}>{[
          "β/(α+β)",
        ]}</sup>,
        "、D_opt ∝ C",
        <sup key={3}>{[
          "α/(α+β)",
        ]}</sup>,
        "。Chinchilla 的结论是 N 与 D 大致同比例增长,约每个参数 20 个 token。 只看训练算力最省;推理成本也要算的话,常会刻意用更小的模型训更多 token。",
      ]}</p>,
    ],
  },
  {
    id: "bootstrap",
    titleText: "bootstrap 自助重抽样",
    def: "从 n 个数据点里有放回地随机抽 n 个(有的点被抽到多次,有的没被抽到),用这组点重新拟合,重复几百次,看结果的分布。 数据点少时,它能说明一个拟合值有多不稳定。第 20 章对 21 个拟合点做了 200 次,给出外推值的 90% 范围。 它只反映「换几个点结果会晃多少」;如果全部拟合点都偏在同一侧(比如都只覆盖训练前段),区间会很窄,却盖不住真实值,第 20 章主拟合对 124M 的外推就是这样。",
    title: [
      "bootstrap ",
      <En key={1}>{[
        "自助重抽样",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "从 n 个数据点里有放回地随机抽 n 个(有的点被抽到多次,有的没被抽到),用这组点重新拟合,重复几百次,看结果的分布。 数据点少时,它能说明一个拟合值有多不稳定。第 20 章对 21 个拟合点做了 200 次,给出外推值的 90% 范围。 它只反映「换几个点结果会晃多少」;如果全部拟合点都偏在同一侧(比如都只覆盖训练前段),区间会很窄,却盖不住真实值,第 20 章主拟合对 124M 的外推就是这样。",
      ]}</p>,
    ],
  },
  {
    id: "qk-norm",
    titleText: "qk-norm query-key normalization",
    def: "算注意力分数之前,先对每个头的 q、k 各做一次 LayerNorm。不加时,训练中 q、k 的量级可能越长越大,注意力分数(q·k/√d)随之失控, softmax 塌到只看一个位置,梯度暴涨,loss 回升,这叫注意力 logit 增长(Wortsman et al., arXiv 2309.14322)。 第 20 章里 1.8M 参数的模型训 4 亿 token 时,第 2 层注意力分数涨到约 1000 万;加 qk-norm 后同配置 val loss 从 4.95 降到 4.19。",
    title: [
      "qk-norm ",
      <En key={1}>{[
        "query-key normalization",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "算注意力分数之前,先对每个头的 q、k 各做一次 LayerNorm。不加时,训练中 q、k 的量级可能越长越大,注意力分数(q·k/√d)随之失控, softmax 塌到只看一个位置,梯度暴涨,loss 回升,这叫注意力 logit 增长(Wortsman et al., arXiv 2309.14322)。 第 20 章里 1.8M 参数的模型训 4 亿 token 时,第 2 层注意力分数涨到约 1000 万;加 qk-norm 后同配置 val loss 从 4.95 降到 4.19。",
      ]}</p>,
    ],
  },
  {
    id: "rlvr",
    titleText: "RLVR Reinforcement Learning with Verifiable Rewards",
    def: "奖励来自能自动判对错的程序(对最终答案、跑单元测试)的强化学习。和 RLHF 的区别在奖励从哪来:RLHF 用人类偏好训出的奖励模型打分, RLVR 用判分器,不需要标注也不会被\"讨好\"奖励模型。DeepSeek-R1 的推理能力主要靠这类训练得到。 第 21 章用它教 124M 做两位数加法。",
    title: [
      "RLVR ",
      <En key={1}>{[
        "Reinforcement Learning with Verifiable Rewards",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "奖励来自能自动判对错的程序(对最终答案、跑单元测试)的强化学习。和 ",
        <a key={1} href={"#rlhf"}>{[
          "RLHF",
        ]}</a>,
        " 的区别在奖励从哪来:RLHF 用人类偏好训出的奖励模型打分, RLVR 用",
        <a key={3} href={"#verifier"}>{[
          "判分器",
        ]}</a>,
        ",不需要标注也不会被\"讨好\"奖励模型。DeepSeek-R1 的推理能力主要靠这类训练得到。 第 21 章用它教 124M 做两位数加法。",
      ]}</p>,
    ],
  },
  {
    id: "grpo",
    titleText: "GRPO Group Relative Policy Optimization · 组相对策略优化",
    def: "DeepSeekMath(Shao et al., arXiv 2402.03300)提出的 RL 算法:同一道题采样 G 个回答,用组内平均奖励当基线、组内标准差归一化, 得到每个回答的优势;loss = −A · log π(回答) + β · KL(π ‖ π_ref)。 和 PPO 比省掉了价值网络(critic)。论文每题采 64 个,KL 系数 0.04。第 21 章 19_grpo.py 的 run_grpo 是它的最小实现。",
    title: [
      "GRPO ",
      <En key={1}>{[
        "Group Relative Policy Optimization · 组相对策略优化",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "DeepSeekMath(Shao et al., arXiv 2402.03300)提出的 RL 算法:同一道题采样 G 个回答,用组内平均奖励当基线、组内标准差归一化, 得到每个回答的",
        <a key={1} href={"#advantage"}>{[
          "优势",
        ]}</a>,
        ";loss = −A · log π(回答) + β · KL(π ‖ π_ref)。 和 PPO 比省掉了价值网络(critic)。论文每题采 64 个,KL 系数 0.04。第 21 章 ",
        <code key={3}>{[
          "19_grpo.py",
        ]}</code>,
        " 的 ",
        <code key={5}>{[
          "run_grpo",
        ]}</code>,
        " 是它的最小实现。",
      ]}</p>,
    ],
  },
  {
    id: "verifier",
    titleText: "判分器 verifier",
    def: "检查模型回答对不对的程序,只输出分数,不给出正确答案。第 21 章的判分器是一行比较:回答去掉空格后是否等于正确的和。 判分器能判的东西决定了 RLVR 能教什么:判分器看不到的行为(比如格式之外的胡言乱语),奖励也管不到。",
    title: [
      "判分器 ",
      <En key={1}>{[
        "verifier",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "检查模型回答对不对的程序,只输出分数,不给出正确答案。第 21 章的判分器是一行比较:回答去掉空格后是否等于正确的和。 判分器能判的东西决定了 RLVR 能教什么:判分器看不到的行为(比如格式之外的胡言乱语),奖励也管不到。",
      ]}</p>,
    ],
  },
  {
    id: "advantage",
    titleText: "优势 advantage",
    def: "一个回答比基线好多少。策略梯度按优势加权:A > 0 的回答概率被抬高,A < 0 的被压低。 GRPO 里 A = (r − 组内均值) / 组内标准差,同一组的优势加起来为 0;组内奖励全相同(全对或全错)时 A 全为 0,这道题不产生梯度。",
    title: [
      "优势 ",
      <En key={1}>{[
        "advantage",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "一个回答比基线好多少。策略梯度按优势加权:A > 0 的回答概率被抬高,A < 0 的被压低。 GRPO 里 A = (r − 组内均值) / 组内标准差,同一组的优势加起来为 0;组内奖励全相同(全对或全错)时 A 全为 0,这道题不产生梯度。",
      ]}</p>,
    ],
  },
  {
    id: "pass-at-k",
    titleText: "pass@k",
    def: "每道题采样 k 次,至少一次答对的题所占的比例。pass@1(常用贪心解码)衡量模型最常给出的答案对不对,pass@k 衡量它能不能采样出正确答案。 做 RL 之前,起点的 pass@k(k 取组大小)大致决定一组里能不能凑出对的回答,也就是 RL 有没有信号。",
    title: [
      "pass@k",
    ],
    body: [
      <p key={0}>{[
        "每道题采样 k 次,至少一次答对的题所占的比例。pass@1(常用贪心解码)衡量模型最常给出的答案对不对,pass@k 衡量它能不能采样出正确答案。 做 RL 之前,起点的 pass@k(k 取组大小)大致决定一组里能不能凑出对的回答,也就是 RL 有没有信号。",
      ]}</p>,
    ],
  },
]
