import type { ReactNode } from 'react'
import { Dot } from '../glossary/marks'
export function HomeTitle() {
  return <>{[
      "LLM from Scratch ",
      <Dot key={1}>{[
        "·",
      ]}</Dot>,
      " 从零手写大语言模型",
    ]}</>
}

export function HomeSubtitle() {
  return <>{[
      "从最朴素的 ",
      <code key={1}>{[
        "bigram",
      ]}</code>,
      " 起步,手写到 GPT-2 124M 的预训练与推理,再做后训练、现代架构与推理效率, 最后补上分词器、注意力 kernel、scaling law 与 RLVR。每章配交互式可视化:先看懂直觉,再读代码。",
    ]}</>
}

export function CardDesc({ slug }: { slug: string }) {
  return cards[slug] ?? null
}

const cards: Record<string, ReactNode> = {
  "bigram": <>{[
      "最朴素的语言模型。一口气理解 tokenizer / batch / forward /",
      <code key={1}>{[
        "cross_entropy",
      ]}</code>,
      " / 训练循环这条主线。",
    ]}</>,
  "attention": <>{[
      "给模型装上\"往回看\"的能力。从\"对过去做平均\"出发,一步步升级成由内容算权重的自注意力,打破 bigram 的 ",
      <code key={1}>{[
        "2.49",
      ]}</code>,
      " 天花板。",
    ]}</>,
  "transformer": <>{[
      "四块新积木拼出 GPT:",
      <code key={1}>{[
        "多头",
      ]}</code>,
      "(同时看多种关系)、",
      <code key={3}>{[
        "FFN",
      ]}</code>,
      "(逐位置思考)、",
      <code key={5}>{[
        "残差 + LayerNorm",
      ]}</code>,
      "(让深网络训得动),再摞成多层。val loss 从 2.41 掉到 ~1.57。",
    ]}</>,
  "gpt-machine": <>{[
      "第 1–3 章的零件拼成整台 tiny GPT(≈0.8M)。两段全自动动画:",
      <code key={1}>{[
        "① 装机",
      ]}</code>,
      "(训练把所有权重调到位)+ ",
      <code key={3}>{[
        "② 跑起来",
      ]}</code>,
      "(",
      <code key={5}>{[
        "forward",
      ]}</code>,
      " 算出 logits → ",
      <code key={7}>{[
        "decode",
      ]}</code>,
      " 采样,预设开头自回归生成)。跑起来里点开 ",
      <code key={9}>{[
        "4×Block",
      ]}</code>,
      " 还能掀盖看注意力热力图 + FFN 内部。",
    ]}</>,
  "sampling": <>{[
      "对应 ",
      <code key={1}>{[
        "phase1-124m/05_sample.py",
      ]}</code>,
      ":把推理\"从打分到吐字\"拆成五步亲手拨——",
      <code key={3}>{[
        "base",
      ]}</code>,
      " 只续写不答题、",
      <code key={5}>{[
        "temperature",
      ]}</code>,
      " 捏尖/摊平分布、",
      <code key={7}>{[
        "top_k",
      ]}</code>,
      " 砍掉长尾、自回归逐 token 滚动、",
      <code key={9}>{[
        "KV-cache",
      ]}</code>,
      " 并排省掉重复计算(实测约 2.5–3.1×)。",
    ]}</>,
  "pretraining": <>{[
      "对应 ",
      <code key={1}>{[
        "phase1-124m/04_gpt2_124m.py",
      ]}</code>,
      ":把 GPT-2 124M 预训练拆成五步亲手拨——配置从字符级玩具跃迁到 ",
      <code key={3}>{[
        "12/12/768",
      ]}</code>,
      "、FineWeb-Edu 切 ",
      <code key={5}>{[
        "shard",
      ]}</code>,
      " 顺序喂、梯度累积攒满 524288 token 再走一步、",
      <code key={7}>{[
        "warmup + 余弦",
      ]}</code>,
      "学习率实时画曲线、用两个真实端点(300M→3.65 / 10B→3.02)看数据量 33× 的收敛对照。",
    ]}</>,
  "posttraining": <>{[
      "动手写代码前先对齐全景与术语:后训练全链路哪些",
      <code key={1}>{[
        "必需 / 常规 / 可选",
      ]}</code>,
      "、",
      <code key={3}>{[
        "任务 vs 手段",
      ]}</code>,
      "(SFT/DPO × 全量/LoRA)、SFT 改了哪三处(数据/模板/",
      <code key={5}>{[
        "loss mask",
      ]}</code>,
      ")、",
      <code key={7}>{[
        "RLHF",
      ]}</code>,
      " 与 ",
      <code key={9}>{[
        "DPO",
      ]}</code>,
      " 的关系,以及 SFT、DPO、RLHF、RLVR、蒸馏的两轴分类表。",
    ]}</>,
  "sft": <>{[
      "拿 Phase 1 的 124M base 做监督微调:",
      <code key={1}>{[
        "对话模板 + EOS",
      ]}</code>,
      "、",
      <code key={3}>{[
        "loss mask",
      ]}</code>,
      "(只对回答算 loss)、训练循环。配套代码 ",
      <code key={5}>{[
        "06_sft.py",
      ]}</code>,
      ",内含训练前后真实采样对比。",
    ]}</>,
  "lora": <>{[
      "换手段不换任务:同一件 SFT,冻住 124M 底座,只在每层旁挂低秩旁路 ",
      <code key={1}>{[
        "B·A",
      ]}</code>,
      ",只训 ",
      <code key={3}>{[
        "~0.94%",
      ]}</code>,
      " 参数、存 ",
      <code key={5}>{[
        "4.7MB",
      ]}</code>,
      " adapter。配套代码 ",
      <code key={7}>{[
        "07_lora.py",
      ]}</code>,
      ",内含真实采样与 loss 曲线。",
    ]}</>,
  "dpo": <>{[
      "换任务:从\"会答\"到\"答得合人意\"。接在 SFT 之后,用偏好对(chosen/rejected)+ 冻结参考模型做 DPO——",
      <code key={1}>{[
        "不训奖励模型、不走 RL",
      ]}</code>,
      "。配套代码 ",
      <code key={3}>{[
        "08_dpo.py",
      ]}</code>,
      ",真实曲线 loss↓ / margin↑ / 准确率 0→100%;加 ",
      <code key={5}>{[
        "--lora",
      ]}</code>,
      " 可切 LoRA 手段。",
    ]}</>,
  "moe": <>{[
      "把第 3 章 GPT 的 FFN 拆成 ",
      <code key={1}>{[
        "4 个专家 + 路由器",
      ]}</code>,
      ":top-2 派单、分工自己涌现、专家塌缩与负载均衡 aux loss,再算清\"总参数 ↑ 激活算力不变\"这笔账。最后一步换上 DeepSeek 系的细粒度专家、共享专家与偏置均衡,在同一台模型上跑五组对照。全部在 ",
      <code key={3}>{[
        "1.35M",
      ]}</code>,
      " 参数上跑通,大概算全球最小的 MoE 之一,机制却和 671B 的 DeepSeek 同款。配套代码 ",
      <code key={5}>{[
        "09_moe.py",
      ]}</code>,
      "。",
    ]}</>,
  "llama": <>{[
      "第 3 章那台 GPT 是 2019 年的样子。今天的开源模型换掉的不是 Transformer 本身,而是它身上四个零件:",
      <code key={1}>{[
        "RoPE",
      ]}</code>,
      " 把位置变成旋转角(注意力只看相对距离)、",
      <code key={3}>{[
        "RMSNorm",
      ]}</code>,
      " 少做一半、",
      <code key={5}>{[
        "SwiGLU",
      ]}</code>,
      " 给 FFN 装闸门、",
      <code key={7}>{[
        "GQA",
      ]}</code>,
      " 让 K/V 拼车(cache 减半)。每件都能单独开关,配套代码 ",
      <code key={9}>{[
        "10_llama.py",
      ]}</code>,
      ",含六组真实对照训练。",
    ]}</>,
  "linear-attention": <>{[
      "全注意力推理时每个 token 都要存 K/V,上下文越长 cache 越大。线性注意力每个头只留一块 32×32 的记忆板:写入是加一个外积,",
      <code key={1}>{[
        "delta rule",
      ]}</code>,
      " 先擦再写,遗忘门 α 按比例衰减,合起来就是 Qwen3-Next 用的 ",
      <code key={3}>{[
        "Gated DeltaNet",
      ]}</code>,
      "。配套代码 ",
      <code key={5}>{[
        "11_linear_attn.py",
      ]}</code>,
      ",9 组真实训练:测试长度拉到 512,全注意力 val loss 涨到 3.52,GDN 停在 1.53;键值检索 N=32 时 GDN 答对 99.9%,只加不减的 linear 16.6%。最后看工业界为什么用 3:1 混合。",
    ]}</>,
  "sparse-attention": <>{[
      "K/V 照样全存,每个 query 只挑一小部分去算。照 DeepSeek 的 ",
      <code key={1}>{[
        "NSA",
      ]}</code>,
      " 手写三条支路:压缩给每块留摘要、挑选只细看 top-n 块、滑窗兜住最近的字,再用 sigmoid 门加权。配套代码 ",
      <code key={3}>{[
        "12_sparse_attn.py",
      ]}</code>,
      ":256 上下文平均每个 query 读 76.8 个 key(全注意力 128.5);远处找钥匙任务上只滑窗 3.1%(乱猜),NSA 99.85%。再对照 DSA、DeepSeek-V4 的 CSA/HCA 与 Qwen3.8 的 QSA。",
    ]}</>,
  "ngram-memory": <>{[
      "给第 12 章的小模型挂一张哈希 n-gram 表:每个 token 按最近两三个 token 算出 8 个行号,只读 8 行 × 16 维,再由一个门决定加多少进残差流。表涨到主干的 4.6 倍,每 token 算力不变;行号在 forward 之前就能算出,表可以留在主机内存。配套代码 ",
      <code key={1}>{[
        "13_engram.py",
      ]}</code>,
      ",FineWeb-Edu 上 5000 步 val loss 降约 0.06(单种子),tiny shakespeare 字符级反例里表把训练集背了下来,另测了表在 GPU / CPU 的吞吐。",
    ]}</>,
  "speculative-decoding": <>{[
      "自回归生成每吐一个字都要跑一次主模型。投机解码让草稿员先猜 γ 个字,主模型一次 forward 算出这些位置的 p,以 ",
      <code key={1}>{[
        "min(1, p/q)",
      ]}</code>,
      " 接受、拒绝就从 ",
      <code key={3}>{[
        "max(0, p−q)",
      ]}</code>,
      " 重抽,输出分布不变。配套代码 ",
      <code key={5}>{[
        "14_mtp.py",
      ]}</code>,
      ",在 RTX 4090 上实测:1 层小草稿模型接受率 0.667–0.745,γ=6 时每次主 forward 吐 3.09 个字;DeepSeek-V3 式 MTP 头接受率 0.899,墙钟 1.27×;20 万次模拟后与 p 的总变差距离 0.0005。最后算清玩具规模下省了 forward 为什么没怎么省时间。",
    ]}</>,
  "quantization": <>{[
      "把第 6 章训出来的 GPT-2 124M 量化到 8 / 4 / 3 / 2 位:一个 ",
      <code key={1}>{[
        "scale",
      ]}</code>,
      " 管多少权重决定误差,一个 10σ 的离群值就能让整矩阵 int4 崩到 val loss 9.93,留出 0.1% 离群值又回到 3.26。再拆开 ",
      <code key={3}>{[
        "Q4_K",
      ]}</code>,
      "、",
      <code key={5}>{[
        "NVFP4",
      ]}</code>,
      "、",
      <code key={7}>{[
        "MXFP4",
      ]}</code>,
      " 三种 4 位格式怎么存 scale。配套代码 ",
      <code key={9}>{[
        "15_quant.py",
      ]}</code>,
      ",15 组真实评测:4.5 位的 NVFP4 从 497.9 MB 压到 126.9 MB,val loss 多 0.04。Phase 4 收尾。",
    ]}</>,
  "bpe": <>{[
      "第 6 章起一直调 tiktoken,这一关自己写:从 256 个字节出发,数相邻对、合并出现最多的一对,在 8 MB FineWeb-Edu 上训出 16,384 词表,编码再解码逐字还原。配套代码 ",
      <code key={1}>{[
        "16_bpe.py",
      ]}</code>,
      ",纯 CPU 约 2 分钟:每 token 4.25 字节(GPT-2 的 50,257 词表 4.62);只按空格预切分时,词表里 2,279 个 token 是「词 + 标点」的变体,GPT-2 正则下只有 7 个;英文语料训出的词表一个汉字都没合并。",
    ]}</>,
  "flash-attention": <>{[
      "朴素注意力要把 T×T 的分数矩阵整个写进显存,T = 4096 时约 7.5 GB。online softmax 边读边更新最大值与分母,分块之后这个矩阵不再落到显存。配套代码 ",
      <code key={1}>{[
        "17_flash_attn.py",
      ]}</code>,
      ",手写一个 Triton 前向 kernel:RTX 4090 上 T = 4096 用时 0.77 ms、占 24 MB,PyTorch 的 SDPA 0.76 ms;朴素写法 31.8 ms,T = 8192 起显存不够。换进第 6 章的 124M,val loss 与 SDPA 相差 0.0002。",
    ]}</>,
  "scaling-law": <>{[
      "第 6 章把 124M 训了一整天。能不能先训一批小模型,算出它会训到多少?训 23 次 0.6M–25M 参数的小模型(5000 万到 16 亿 token),拟合 ",
      <code key={1}>{[
        "L(N, D) = E + A/N^α + B/D^β",
      ]}</code>,
      ",外推到 124M 训 10B token:预测 3.36,实测 3.03。换三组拟合点对照,外推越远误差越大,主拟合的 bootstrap 区间也没盖住实测。配套代码 ",
      <code key={3}>{[
        "18_scaling.py",
      ]}</code>,
      ",顺带排查两次训练发散:第 2 层注意力分数涨到约 1000 万,加 qk-norm 后同配置 val loss 从 4.95 降到 4.19。",
    ]}</>,
  "rlvr-grpo": <>{[
      "只给一个会对答案的判分器,不给标准答案:同一道题采样 8 次,组内比较得出优势,按优势更新。配套代码 ",
      <code key={1}>{[
        "19_grpo.py",
      ]}</code>,
      ",把 124M 教会两位数加法,并在同一热身起点、同一评测、同样 4096 道题下和 SFT、DPO 同台比,学习率各自按 dev 挑。热身 1000 道的起点上 GRPO 从 41.0% 到 84.8%,有标准答案的 SFT 到 93.0%,离线 DPO 47.8%(学习率 3e-8,再大就掉到 warm 以下);热身 200 道的起点上 GRPO 的组大多 8 次全错,几乎学不到。Phase 5 收尾。",
    ]}</>,
}
