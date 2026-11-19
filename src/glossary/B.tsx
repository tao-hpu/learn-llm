// 名词表 · 损失与训练
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "logits",
    titleText: "logits",
    def: "模型最后一层输出的、未经 softmax 的原始打分。可正可负,数值大小代表\"倾向\"; 过 softmax 后才变成概率。形状常见为 (B, T, vocab_size) —— 每个位置对词表里每个字符都打一个分。",
    title: [
      "logits",
    ],
    body: [
      <p key={0}>{[
        "模型最后一层输出的、",
        <b key={1}>{[
          "未经 softmax",
        ]}</b>,
        " 的原始打分。可正可负,数值大小代表\"倾向\"; 过 softmax 后才变成概率。形状常见为 ",
        <code key={3}>{[
          "(B, T, vocab_size)",
        ]}</code>,
        " —— 每个位置对词表里每个字符都打一个分。",
      ]}</p>,
    ],
  },
  {
    id: "softmax",
    titleText: "softmax",
    def: "把一组任意实数(打分)变成一组和为 1 的正数(概率分布):每个数取 exp 再除以总和。 分数越大,概率越大。它天生保证\"每行加起来 = 1\"。",
    title: [
      "softmax",
    ],
    body: [
      <p key={0}>{[
        "把一组任意实数(打分)变成一组",
        <b key={1}>{[
          "和为 1 的正数",
        ]}</b>,
        "(概率分布):每个数取 ",
        <code key={3}>{[
          "exp",
        ]}</code>,
        " 再除以总和。 分数越大,概率越大。它天生保证\"每行加起来 = 1\"。",
      ]}</p>,
    ],
  },
  {
    id: "normalize",
    titleText: "归一化 normalize",
    def: "把一组数按比例缩放,使其满足某种总量约束。本项目里特指\"每行除以该行的和\", 让每行加起来 = 1,从而变成一组权重(概率分布)。softmax 内部做的也是这件事。 它管的是\"尺度\",和\"哪些位置为 0\"(因果)是两件正交的事。",
    title: [
      "归一化 ",
      <En key={1}>{[
        "normalize",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把一组数按比例缩放,使其满足某种总量约束。本项目里特指\"",
        <b key={1}>{[
          "每行除以该行的和",
        ]}</b>,
        "\", 让每行加起来 = 1,从而变成一组权重(概率分布)。softmax 内部做的也是这件事。 它管的是\"尺度\",和\"哪些位置为 0\"(因果)是两件正交的事。",
      ]}</p>,
    ],
  },
  {
    id: "cross-entropy",
    titleText: "交叉熵 cross_entropy",
    def: "分类任务的损失函数。先对 logits 做 softmax 得概率,取正确类别的概率 p, loss = -ln(p)。模型越确信正确答案(p→1),loss→0;越瞎猜,loss 越大。 随机初始时 loss ≈ ln(vocab_size)。",
    title: [
      "交叉熵 ",
      <En key={1}>{[
        "cross_entropy",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "分类任务的损失函数。先对 logits 做 softmax 得概率,取",
        <b key={1}>{[
          "正确类别",
        ]}</b>,
        "的概率 p, ",
        <code key={3}>{[
          "loss = -ln(p)",
        ]}</code>,
        "。模型越确信正确答案(p→1),loss→0;越瞎猜,loss 越大。 随机初始时 loss ≈ ",
        <code key={5}>{[
          "ln(vocab_size)",
        ]}</code>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "gradient",
    titleText: "梯度 gradient",
    def: "loss 对每个参数的偏导数,指出\"参数往哪个方向调、loss 下降最快\"。 loss.backward() 负责把它算出来,优化器再据此更新参数。",
    title: [
      "梯度 ",
      <En key={1}>{[
        "gradient",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "loss 对每个参数的偏导数,指出\"参数往哪个方向调、loss 下降最快\"。 ",
        <code key={1}>{[
          "loss.backward()",
        ]}</code>,
        " 负责把它算出来,优化器再据此更新参数。",
      ]}</p>,
    ],
  },
  {
    id: "vanishing",
    titleText: "梯度消失 vanishing gradient",
    def: "梯度在传播中变得极小,参数几乎不更新、模型学不动。本项目会在两处碰到它:① 层一深就连乘衰减:梯度从顶层一路乘回底层,层数越多越小 —— 这是它最经典的成因,靠残差连接开一条直通车来治。 ② softmax 被推到极端:某一项概率接近 1 时,它对输入的导数趋近 0,梯度也就传不回去 —— 这正是注意力要对分数做缩放的原因。",
    title: [
      "梯度消失 ",
      <En key={1}>{[
        "vanishing gradient",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "梯度在传播中变得",
        <b key={1}>{[
          "极小",
        ]}</b>,
        ",参数几乎不更新、模型学不动。本项目会在两处碰到它:",
      ]}</p>,
      <p key={1}>{[
        "① ",
        <b key={1}>{[
          "层一深就连乘衰减",
        ]}</b>,
        ":梯度从顶层一路乘回底层,层数越多越小 —— 这是它最经典的成因,靠",
        <a key={3} href={"#residual"}>{[
          "残差连接",
        ]}</a>,
        "开一条直通车来治。",
        <br key={5} />,
        " ② ",
        <b key={7}>{[
          "softmax 被推到极端",
        ]}</b>,
        ":某一项概率接近 1 时,它对输入的导数趋近 0,梯度也就传不回去 —— 这正是注意力要对分数做",
        <a key={9} href={"#scaling"}>{[
          "缩放",
        ]}</a>,
        "的原因。",
      ]}</p>,
    ],
  },
  {
    id: "zero-grad",
    titleText: "梯度清零 zero_grad",
    def: "PyTorch 的梯度默认累加(backward 把新梯度加到旧的上)。所以每轮训练开头必须先 optimizer.zero_grad() 清零,否则会带着上一轮的陈旧方向越走越偏。 顺序:zero_grad → backward → step。",
    title: [
      "梯度清零 ",
      <En key={1}>{[
        "zero_grad",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "PyTorch 的梯度默认",
        <b key={1}>{[
          "累加",
        ]}</b>,
        "(backward 把新梯度加到旧的上)。所以每轮训练开头必须先 ",
        <code key={3}>{[
          "optimizer.zero_grad()",
        ]}</code>,
        " 清零,否则会带着上一轮的陈旧方向越走越偏。 顺序:",
        <code key={5}>{[
          "zero_grad → backward → step",
        ]}</code>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "optimizer",
    titleText: "优化器 optimizer / AdamW",
    def: "拿到梯度后,真正决定\"每个参数走多大一步\"的算法。AdamW 是 Adam 的改良版(带权重衰减), 是当下训练 Transformer 的常用默认选择。lr(学习率)控制步子大小。",
    title: [
      "优化器 ",
      <En key={1}>{[
        "optimizer / AdamW",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "拿到梯度后,真正决定\"每个参数走多大一步\"的算法。",
        <code key={1}>{[
          "AdamW",
        ]}</code>,
        " 是 Adam 的改良版(带权重衰减), 是当下训练 Transformer 的常用默认选择。",
        <code key={3}>{[
          "lr",
        ]}</code>,
        "(学习率)控制步子大小。",
      ]}</p>,
    ],
  },
]
