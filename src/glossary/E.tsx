// 名词表 · 里程碑
import type { GlossaryEntry } from './types'
import { Link } from 'react-router-dom'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "attention-paper",
    titleText: "Attention Is All You Need 2017 · Vaswani et al.",
    def: "Google 2017 年的论文,提出 Transformer 架构:用自注意力彻底取代 RNN / CNN 来建模序列依赖, 并引入多头注意力与位置编码。它是 GPT、BERT 等几乎所有现代大模型的共同基石。 本项目第 2 关搭的单头自注意力是它的核心零件,第 3 关会完整复现它的架构(多头 + 残差 + LayerNorm + 前馈网络)。 🥚 它的\"前世今生\"(8 位作者、翻译起源、家谱)有个小故事 → 学习札记。",
    title: [
      "Attention Is All You Need ",
      <En key={1}>{[
        "2017 · Vaswani et al.",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "Google 2017 年的论文,提出 ",
        <b key={1}>{[
          "Transformer",
        ]}</b>,
        " 架构:用自注意力",
        <b key={3}>{[
          "彻底取代 RNN / CNN",
        ]}</b>,
        " 来建模序列依赖, 并引入",
        <b key={5}>{[
          "多头注意力",
        ]}</b>,
        "与",
        <b key={7}>{[
          "位置编码",
        ]}</b>,
        "。它是 GPT、BERT 等几乎所有现代大模型的共同基石。 本项目第 2 关搭的单头自注意力是它的核心零件,",
        <b key={9}>{[
          "第 3 关会完整复现它的架构",
        ]}</b>,
        "(多头 + 残差 + LayerNorm + 前馈网络)。 🥚 它的\"前世今生\"(8 位作者、翻译起源、家谱)有个小故事 → ",
        <Link key={11} to={"/notes#egg-transformer"}>{[
          "学习札记",
        ]}</Link>,
        "。",
      ]}</p>,
    ],
  },
]
