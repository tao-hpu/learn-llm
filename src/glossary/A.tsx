// 名词表 · 基础概念
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "tensor",
    titleText: "张量 tensor",
    def: "多维数组,深度学习里数据的基本容器。标量是 0 维、向量 1 维、矩阵 2 维,再高维就统称张量。 形如 (B, T, C) 的数据就是一个 3 维张量:B 个序列 × 每序列 T 个位置 × 每位置 C 维向量。",
    title: [
      "张量 ",
      <En key={1}>{[
        "tensor",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "多维数组,深度学习里数据的基本容器。标量是 0 维、向量 1 维、矩阵 2 维,再高维就统称张量。 形如 ",
        <code key={1}>{[
          "(B, T, C)",
        ]}</code>,
        " 的数据就是一个 3 维张量:B 个序列 × 每序列 T 个位置 × 每位置 C 维向量。",
      ]}</p>,
    ],
  },
  {
    id: "batch",
    titleText: "批 batch / batch_size",
    def: "一次喂给模型并行处理的一组样本。batch_size=32 表示一次处理 32 条序列。 批越大,梯度估计越稳,但越吃显存。注意它和\"向量维度\"是两码事 —— 一个是\"几条样本\",一个是\"每个 token 几个数字\"。",
    title: [
      "批 ",
      <En key={1}>{[
        "batch / batch_size",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "一次喂给模型",
        <b key={1}>{[
          "并行处理",
        ]}</b>,
        "的一组样本。",
        <code key={3}>{[
          "batch_size=32",
        ]}</code>,
        " 表示一次处理 32 条序列。 批越大,梯度估计越稳,但越吃显存。注意它和\"向量维度\"是两码事 —— 一个是\"几条样本\",一个是\"每个 token 几个数字\"。",
      ]}</p>,
    ],
  },
  {
    id: "embedding",
    titleText: "嵌入 embedding",
    def: "把离散的 token(整数 id)映射成一个可训练的稠密向量。nn.Embedding 本质是一张查找表: 第 i 行就是第 i 个 token 的向量。训练让语义相近的 token 拥有相近的向量。",
    title: [
      "嵌入 ",
      <En key={1}>{[
        "embedding",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把离散的 token(整数 id)映射成一个",
        <b key={1}>{[
          "可训练的稠密向量",
        ]}</b>,
        "。",
        <code key={3}>{[
          "nn.Embedding",
        ]}</code>,
        " 本质是一张查找表: 第 i 行就是第 i 个 token 的向量。训练让语义相近的 token 拥有相近的向量。",
      ]}</p>,
    ],
  },
  {
    id: "tokenizer",
    titleText: "分词器 tokenizer",
    def: "把文本和数字互相转换的工具:encode 把字符串变成整数 id 序列,decode 反过来。 第 1–4 章用最简单的\"字符级\"切分 —— 每个字符一个 id;第 6 章起用 GPT-2 的 BPE(tiktoken);第 18 章从零训了一个字节级 BPE。",
    title: [
      "分词器 ",
      <En key={1}>{[
        "tokenizer",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把文本和数字互相转换的工具:",
        <code key={1}>{[
          "encode",
        ]}</code>,
        " 把字符串变成整数 id 序列,",
        <code key={3}>{[
          "decode",
        ]}</code>,
        " 反过来。 第 1–4 章用最简单的\"字符级\"切分 —— 每个字符一个 id;第 6 章起用 GPT-2 的 ",
        <a key={5} href={"#bpe"}>{[
          "BPE",
        ]}</a>,
        "(tiktoken);第 18 章从零训了一个字节级 BPE。",
      ]}</p>,
    ],
  },
  {
    id: "default",
    titleText: "缺省 / 默认参数 default argument",
    def: "函数定义时给参数设的默认值,调用时不传就用它。例如 forward(self, idx, targets=None) 里 targets 缺省为 None —— 只想前向出 logits、不算 loss 时,就不传 targets。",
    title: [
      "缺省 / 默认参数 ",
      <En key={1}>{[
        "default argument",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "函数定义时给参数设的",
        <b key={1}>{[
          "默认值",
        ]}</b>,
        ",调用时不传就用它。例如 ",
        <code key={3}>{[
          "forward(self, idx, targets=None)",
        ]}</code>,
        " 里 ",
        <code key={5}>{[
          "targets",
        ]}</code>,
        " 缺省为 ",
        <code key={7}>{[
          "None",
        ]}</code>,
        " —— 只想前向出 logits、不算 loss 时,就不传 targets。",
      ]}</p>,
    ],
  },
  {
    id: "block-size",
    titleText: "上下文长度 block_size / context length",
    def: "模型一次能看到的最大 token 数。block_size=8 意味着每个位置最多回看前 8 个字符; 更早的历史会被截断(generate 时要 idx[:, -block_size:])。这是注意力的\"视野上限\"。",
    title: [
      "上下文长度 ",
      <En key={1}>{[
        "block_size / context length",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "模型一次能看到的",
        <b key={1}>{[
          "最大 token 数",
        ]}</b>,
        "。",
        <code key={3}>{[
          "block_size=8",
        ]}</code>,
        " 意味着每个位置最多回看前 8 个字符; 更早的历史会被截断(generate 时要 ",
        <code key={5}>{[
          "idx[:, -block_size:]",
        ]}</code>,
        ")。这是注意力的\"视野上限\"。",
      ]}</p>,
    ],
  },
  {
    id: "n_embd",
    titleText: "嵌入维度 n_embd",
    def: "每个 token 用多长的向量来表示,本项目 n_embd=32。它决定了 token_embedding、 位置表、Wq/Wk/Wv 的形状。⚠️ 本章里它和 batch_size、 head_size 数值都撞成 32,但含义完全不同:一个是\"每个 token 几个数字(维度)\", 一个是\"一次几条句子\",一个是\"注意力头的输出宽度\"。看到 32 先问\"这是谁的 32\"。",
    title: [
      "嵌入维度 ",
      <En key={1}>{[
        "n_embd",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "每个 token 用",
        <b key={1}>{[
          "多长的向量",
        ]}</b>,
        "来表示,本项目 ",
        <code key={3}>{[
          "n_embd=32",
        ]}</code>,
        "。它决定了 token_embedding、 位置表、",
        <code key={5}>{[
          "Wq/Wk/Wv",
        ]}</code>,
        " 的形状。⚠️ 本章里它和 ",
        <a key={7} href={"#batch"}>{[
          "batch_size",
        ]}</a>,
        "、 head_size ",
        <b key={9}>{[
          "数值都撞成 32,但含义完全不同",
        ]}</b>,
        ":一个是\"每个 token 几个数字(维度)\", 一个是\"一次几条句子\",一个是\"注意力头的输出宽度\"。看到 32 先问\"这是谁的 32\"。",
      ]}</p>,
    ],
  },
]
