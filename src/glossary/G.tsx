// 名词表 · 预训练工程(124M)
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "bpe",
    titleText: "BPE 子词分词 · Byte-Pair Encoding",
    def: "把文本切成子词单元的分词法,介于字符级和整词级之间。GPT-2 的 BPE 词表有 50257 个 token —— 本项目 124M 复现就用它(代码里向上取整到 50304,凑 128 的倍数更省 GPU)。训练方法:从单个字符(或字节)出发,反复统计相邻两个 token 的出现次数,把最多的那一对合并成新 token,直到词表够大。第 18 章从零实现了一遍,见 字节级 BPE。",
    title: [
      "BPE ",
      <En key={1}>{[
        "子词分词 · Byte-Pair Encoding",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把文本切成",
        <b key={1}>{[
          "子词",
        ]}</b>,
        "单元的分词法,介于",
        <a key={3} href={"#tokenizer"}>{[
          "字符级",
        ]}</a>,
        "和整词级之间。GPT-2 的 BPE 词表有 ",
        <b key={5}>{[
          "50257",
        ]}</b>,
        " 个 token —— 本项目 124M 复现就用它(代码里向上取整到 50304,凑 128 的倍数更省 GPU)。",
      ]}</p>,
      <p key={1}>{[
        "训练方法:从单个字符(或字节)出发,反复统计相邻两个 token 的出现次数,把最多的那一对合并成新 token,直到词表够大。第 18 章从零实现了一遍,见 ",
        <a key={1} href={"#byte-level-bpe"}>{[
          "字节级 BPE",
        ]}</a>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "fineweb",
    titleText: "FineWeb-Edu 教育向网页语料",
    def: "经过教育质量筛选的大规模英文网页语料,常用于预训练。本项目用其子集(300M / 10B token)做 GPT-2 124M 复现 —— 全英文,所以模型不会中文。",
    title: [
      "FineWeb-Edu ",
      <En key={1}>{[
        "教育向网页语料",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "经过",
        <b key={1}>{[
          "教育质量筛选",
        ]}</b>,
        "的大规模英文网页语料,常用于预训练。本项目用其子集(300M / 10B token)做 GPT-2 124M 复现 —— 全英文,所以模型",
        <b key={3}>{[
          "不会中文",
        ]}</b>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "shard",
    titleText: "shard 数据分片",
    def: "把超大数据集切成的一块块文件(这里是 .npy),训练时一片片顺序读入,不必把整个 10B token 数据集一次塞进内存。",
    title: [
      "shard ",
      <En key={1}>{[
        "数据分片",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把超大数据集切成的",
        <b key={1}>{[
          "一块块文件",
        ]}</b>,
        "(这里是 ",
        <code key={3}>{[
          ".npy",
        ]}</code>,
        "),训练时",
        <b key={5}>{[
          "一片片顺序读入",
        ]}</b>,
        ",不必把整个 10B token 数据集一次塞进内存。",
      ]}</p>,
    ],
  },
  {
    id: "adamw",
    titleText: "AdamW 带权重衰减的 Adam",
    def: "优化器的事实标准:Adam 的改良版,把权重衰减从梯度里拆出来单独做。本项目用 betas=(0.9, 0.95),并对参数分组(权重给衰减、bias/LayerNorm 不给)。",
    title: [
      "AdamW ",
      <En key={1}>{[
        "带权重衰减的 Adam",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        <a key={0} href={"#optimizer"}>{[
          "优化器",
        ]}</a>,
        "的事实标准:Adam 的改良版,把",
        <b key={2}>{[
          "权重衰减",
        ]}</b>,
        "从梯度里拆出来单独做。本项目用 ",
        <code key={4}>{[
          "betas=(0.9, 0.95)",
        ]}</code>,
        ",并对参数",
        <b key={6}>{[
          "分组",
        ]}</b>,
        "(权重给衰减、bias/LayerNorm 不给)。",
      ]}</p>,
    ],
  },
  {
    id: "bf16",
    titleText: "bf16 混合精度 · bfloat16",
    def: "16 位浮点。前向用它算更快、省一半显存,数值范围和 fp32 一样大、精度几乎无损 —— 大模型训练的常规操作。需要 N 卡支持。",
    title: [
      "bf16 ",
      <En key={1}>{[
        "混合精度 · bfloat16",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "16 位浮点。前向用它算",
        <b key={1}>{[
          "更快、省一半显存",
        ]}</b>,
        ",数值范围和 fp32 一样大、精度几乎无损 —— 大模型训练的常规操作。",
        <b key={3}>{[
          "需要 N 卡",
        ]}</b>,
        "支持。",
      ]}</p>,
    ],
  },
  {
    id: "flash-attention",
    titleText: "Flash-Attention 省显存的注意力实现",
    def: "把注意力算得又快又省显存的实现(F.scaled_dot_product_attention):不显式构造 T×T 注意力矩阵,边算边融合。和普通注意力数学等价,只是更高效。做法:把 Q、K、V 切成块,一块 Q 在片上 SRAM 里依次和每块 K/V 算分数、用 online softmax 累加输出,T×T 的分数矩阵从不写回显存。 第 19 章用 Triton 手写了前向 kernel,换进第 6 章的 124M 后 val loss 与 SDPA 一致。出处 Dao et al., arXiv 2205.14135;FlashAttention-2 见 arXiv 2307.08691。",
    title: [
      "Flash-Attention ",
      <En key={1}>{[
        "省显存的注意力实现",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把",
        <a key={1} href={"#self-attention"}>{[
          "注意力",
        ]}</a>,
        "算得",
        <b key={3}>{[
          "又快又省显存",
        ]}</b>,
        "的实现(",
        <code key={5}>{[
          "F.scaled_dot_product_attention",
        ]}</code>,
        "):不显式构造 T×T 注意力矩阵,边算边融合。和普通注意力",
        <b key={7}>{[
          "数学等价",
        ]}</b>,
        ",只是更高效。",
      ]}</p>,
      <p key={1}>{[
        "做法:把 Q、K、V 切成块,一块 Q 在片上 SRAM 里依次和每块 K/V 算分数、用 ",
        <a key={1} href={"#online-softmax"}>{[
          "online softmax",
        ]}</a>,
        " 累加输出,T×T 的分数矩阵从不写回显存。 第 19 章用 ",
        <a key={3} href={"#triton"}>{[
          "Triton",
        ]}</a>,
        " 手写了前向 kernel,换进第 6 章的 124M 后 val loss 与 SDPA 一致。出处 Dao et al., arXiv 2205.14135;FlashAttention-2 见 arXiv 2307.08691。",
      ]}</p>,
    ],
  },
]
