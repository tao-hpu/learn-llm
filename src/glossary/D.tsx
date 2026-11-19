// 名词表 · Transformer 组件
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "mlp",
    titleText: "MLP multi-layer perceptron · 多层感知机",
    def: "最基础的神经网络:几层全连接(Linear)中间夹非线性(如 ReLU)。 \"多层\"指它不止一层线性变换。Transformer 里每个 Block 的 FeedForward 就是一个很小的 MLP (Linear → ReLU → Linear),负责对每个位置的向量单独\"加工\"。",
    title: [
      "MLP ",
      <En key={1}>{[
        "multi-layer perceptron · 多层感知机",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "最基础的神经网络:几层",
        <b key={1}>{[
          "全连接(",
          <a key={1} href={"#default"}>{[
            "Linear",
          ]}</a>,
          ")",
        ]}</b>,
        "中间夹",
        <b key={3}>{[
          "非线性",
        ]}</b>,
        "(如 ",
        <a key={5} href={"#relu"}>{[
          "ReLU",
        ]}</a>,
        ")。 \"多层\"指它不止一层线性变换。Transformer 里每个 ",
        <a key={7} href={"#block"}>{[
          "Block",
        ]}</a>,
        " 的 ",
        <a key={9} href={"#feedforward"}>{[
          "FeedForward",
        ]}</a>,
        " 就是一个很小的 MLP (",
        <code key={11}>{[
          "Linear → ReLU → Linear",
        ]}</code>,
        "),负责对每个位置的向量单独\"加工\"。",
      ]}</p>,
    ],
  },
  {
    id: "feedforward",
    titleText: "FeedForward(FFN) 前馈网络",
    def: "Transformer 层里的小 MLP:Linear(n_embd, 4·n_embd) → ReLU → Linear(4·n_embd, n_embd),中间放大 4 倍再压回。 它是逐位置(position-wise)的 —— 对每个 token 的向量单独加工,位置之间不交换信息。 分工:注意力让 token 互相\"沟通\",FFN 让每个 token 自己\"思考\"。",
    title: [
      "FeedForward(FFN) ",
      <En key={1}>{[
        "前馈网络",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "Transformer 层里的小 ",
        <a key={1} href={"#mlp"}>{[
          "MLP",
        ]}</a>,
        ":",
        <code key={3}>{[
          "Linear(n_embd, 4·n_embd) → ReLU → Linear(4·n_embd, n_embd)",
        ]}</code>,
        ",中间",
        <b key={5}>{[
          "放大 4 倍",
        ]}</b>,
        "再压回。 它是",
        <b key={7}>{[
          "逐位置(position-wise)",
        ]}</b>,
        "的 —— 对每个 token 的向量",
        <b key={9}>{[
          "单独",
        ]}</b>,
        "加工,位置之间不交换信息。 分工:",
        <b key={11}>{[
          "注意力让 token 互相\"沟通\",FFN 让每个 token 自己\"思考\"。",
        ]}</b>,
      ]}</p>,
    ],
  },
  {
    id: "relu",
    titleText: "ReLU rectified linear unit · 激活函数",
    def: "最常用的非线性激活函数:ReLU(x) = max(0, x),把负数清零、正数保留。 作用是给网络引入非线性 —— 没有它,多层 Linear 叠起来在数学上还是一个线性变换,层数白加。",
    title: [
      "ReLU ",
      <En key={1}>{[
        "rectified linear unit · 激活函数",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "最常用的",
        <b key={1}>{[
          "非线性激活函数",
        ]}</b>,
        ":",
        <code key={3}>{[
          "ReLU(x) = max(0, x)",
        ]}</code>,
        ",把负数清零、正数保留。 作用是给网络引入",
        <b key={5}>{[
          "非线性",
        ]}</b>,
        " —— 没有它,多层 ",
        <a key={7} href={"#default"}>{[
          "Linear",
        ]}</a>,
        " 叠起来在数学上还是",
        <b key={9}>{[
          "一个",
        ]}</b>,
        "线性变换,层数白加。",
      ]}</p>,
    ],
  },
  {
    id: "residual",
    titleText: "残差连接 residual connection · skip connection",
    def: "把子层的输出加回它的输入:x = x + 子层(x)。那个 + 是一条梯度高速公路, 反向传播时梯度能绕过子层直达底层,避免 梯度消失,深网络才堆得动。 子层只需学\"在原信号上加什么修正\"。出自 2015 年 ResNet,Transformer 全靠它。",
    title: [
      "残差连接 ",
      <En key={1}>{[
        "residual connection · skip connection",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把子层的输出",
        <b key={1}>{[
          "加回",
        ]}</b>,
        "它的输入:",
        <code key={3}>{[
          "x = x + 子层(x)",
        ]}</code>,
        "。那个 ",
        <b key={5}>{[
          "+",
        ]}</b>,
        " 是一条",
        <b key={7}>{[
          "梯度高速公路",
        ]}</b>,
        ", 反向传播时梯度能绕过子层直达底层,避免 ",
        <a key={9} href={"#vanishing"}>{[
          "梯度消失",
        ]}</a>,
        ",深网络才堆得动。 子层只需学\"在原信号上",
        <b key={11}>{[
          "加什么修正",
        ]}</b>,
        "\"。出自 2015 年 ",
        <b key={13}>{[
          "ResNet",
        ]}</b>,
        ",Transformer 全靠它。",
      ]}</p>,
    ],
  },
  {
    id: "layernorm",
    titleText: "LayerNorm 层归一化",
    def: "对每个位置那一根向量(沿特征维)做 归一化:减均值、除标准差,把数值拉回稳定范围,深网络训练才不发散。 它不跨位置、不跨 batch,与序列长度无关。pre-norm(先 norm 再进子层,x + 子层(ln(x)))比原始 Transformer 的 post-norm 更好训。",
    title: [
      "LayerNorm ",
      <En key={1}>{[
        "层归一化",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "对",
        <b key={1}>{[
          "每个位置那一根向量",
        ]}</b>,
        "(沿特征维)做 ",
        <a key={3} href={"#normalize"}>{[
          "归一化",
        ]}</a>,
        ":减均值、除标准差,把数值拉回稳定范围,深网络训练才不发散。 它",
        <b key={5}>{[
          "不跨位置、不跨 batch",
        ]}</b>,
        ",与序列长度无关。",
        <b key={7}>{[
          "pre-norm",
        ]}</b>,
        "(先 norm 再进子层,",
        <code key={9}>{[
          "x + 子层(ln(x))",
        ]}</code>,
        ")比原始 Transformer 的 post-norm 更好训。",
      ]}</p>,
    ],
  },
  {
    id: "block",
    titleText: "Block Transformer 层",
    def: "Transformer 的一层 = 注意力子层 + FFN 子层,各自带 残差 和 LayerNorm: x = x + sa(ln1(x)) 然后 x = x + ffwd(ln2(x))(沟通 + 思考)。 完整 GPT 就是把 n_layer 个 Block 摞起来。",
    title: [
      "Block ",
      <En key={1}>{[
        "Transformer 层",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "Transformer 的一层 = ",
        <b key={1}>{[
          "注意力子层 + FFN 子层",
        ]}</b>,
        ",各自带 ",
        <a key={3} href={"#residual"}>{[
          "残差",
        ]}</a>,
        " 和 ",
        <a key={5} href={"#layernorm"}>{[
          "LayerNorm",
        ]}</a>,
        ": ",
        <code key={7}>{[
          "x = x + sa(ln1(x))",
        ]}</code>,
        " 然后 ",
        <code key={9}>{[
          "x = x + ffwd(ln2(x))",
        ]}</code>,
        "(沟通 + 思考)。 完整 GPT 就是把 ",
        <code key={11}>{[
          "n_layer",
        ]}</code>,
        " 个 Block 摞起来。",
      ]}</p>,
    ],
  },
  {
    id: "dropout",
    titleText: "Dropout 随机失活",
    def: "训练时随机丢弃一部分连接(如 10%),逼网络别过度依赖某几条路径,防过拟合。 只在训练时生效,推理时关闭。模型变大后(第 3 关)容易死记硬背,所以加了它。",
    title: [
      "Dropout ",
      <En key={1}>{[
        "随机失活",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "训练时",
        <b key={1}>{[
          "随机丢弃",
        ]}</b>,
        "一部分连接(如 10%),逼网络别过度依赖某几条路径,",
        <b key={3}>{[
          "防过拟合",
        ]}</b>,
        "。 只在训练时生效,推理时关闭。模型变大后(第 3 关)容易死记硬背,所以加了它。",
      ]}</p>,
    ],
  },
  {
    id: "forward",
    titleText: "前向传播 forward pass",
    def: "把输入从头到尾过一遍网络、算出输出的过程 —— 这里就是 idx → 嵌入 → Block×N → ln_f → lm_head → logits。 训练和推理都要做前向;训练还会接着反向传播更新权重,推理则到 logits 就停、拿去采样。",
    title: [
      "前向传播 ",
      <En key={1}>{[
        "forward pass",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把输入从头到尾过一遍网络、算出输出的过程 —— 这里就是 ",
        <code key={1}>{[
          "idx → 嵌入 → Block×N → ln_f → lm_head → logits",
        ]}</code>,
        "。 ",
        <b key={3}>{[
          "训练和推理都要做前向",
        ]}</b>,
        ";训练还会接着",
        <b key={5}>{[
          "反向传播",
        ]}</b>,
        "更新权重,推理则到 logits 就停、拿去采样。",
      ]}</p>,
    ],
  },
  {
    id: "sampling",
    titleText: "采样 sampling",
    def: "按模型输出的概率分布随机抽一个 token 当下一个字符(代码 torch.multinomial(probs, 1)), 不是永远取最高分(argmax)。取最高分会陷入重复死循环;随机采样保多样,所以同一个开头每次生成都可能不同。",
    title: [
      "采样 ",
      <En key={1}>{[
        "sampling",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "按模型输出的",
        <a key={1} href={"#softmax"}>{[
          "概率分布",
        ]}</a>,
        <b key={2}>{[
          "随机抽",
        ]}</b>,
        "一个 token 当下一个字符(代码 ",
        <code key={4}>{[
          "torch.multinomial(probs, 1)",
        ]}</code>,
        "), ",
        <b key={6}>{[
          "不是永远取最高分",
        ]}</b>,
        "(argmax)。取最高分会陷入重复死循环;随机采样保多样,所以同一个开头每次生成都可能不同。",
      ]}</p>,
    ],
  },
  {
    id: "autoregressive",
    titleText: "自回归 autoregressive",
    def: "把自己刚生成的字符接回输入,再预测下一个,如此循环。GPT 生成文本就是这样一个字一个字滚出来的: 每多一个字,就把整条序列重新做一次前向传播。",
    title: [
      "自回归 ",
      <En key={1}>{[
        "autoregressive",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把",
        <b key={1}>{[
          "自己刚生成的字符接回输入",
        ]}</b>,
        ",再预测下一个,如此循环。GPT 生成文本就是这样",
        <b key={3}>{[
          "一个字一个字滚出来",
        ]}</b>,
        "的: 每多一个字,就把整条序列重新做一次",
        <a key={5} href={"#forward"}>{[
          "前向传播",
        ]}</a>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "prompt",
    titleText: "prompt 提示词",
    def: "喂给模型的开头文本。base 模型不理解\"任务\",只会顺着 prompt 续写最可能的下一个 token —— 想让它\"听懂指令答题\"是 SFT 之后的事。",
    title: [
      "prompt ",
      <En key={1}>{[
        "提示词",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "喂给模型的",
        <b key={1}>{[
          "开头文本",
        ]}</b>,
        "。",
        <a key={3} href={"#post-training"}>{[
          "base 模型",
        ]}</a>,
        "不理解\"任务\",只会顺着 prompt ",
        <b key={5}>{[
          "续写",
        ]}</b>,
        "最可能的下一个 token —— 想让它\"听懂指令答题\"是 ",
        <a key={7} href={"#sft"}>{[
          "SFT",
        ]}</a>,
        " 之后的事。",
      ]}</p>,
    ],
  },
  {
    id: "top-k",
    titleText: "top_k 采样 top-k sampling",
    def: "每步只保留概率最高的 k 个 token,其余打分置 −∞(概率 0)再归一化采样,把长尾低概率 token 一刀切掉,避免偶尔抽到离谱的词。默认 k=50。",
    title: [
      "top_k 采样 ",
      <En key={1}>{[
        "top-k sampling",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "每步只保留概率最高的 ",
        <b key={1}>{[
          "k 个",
        ]}</b>,
        " token,其余打分置 −∞(概率 0)再",
        <a key={3} href={"#normalize"}>{[
          "归一化",
        ]}</a>,
        <a key={4} href={"#sampling"}>{[
          "采样",
        ]}</a>,
        ",把长尾低概率 token ",
        <b key={6}>{[
          "一刀切掉",
        ]}</b>,
        ",避免偶尔抽到离谱的词。默认 k=50。",
      ]}</p>,
    ],
  },
  {
    id: "greedy",
    titleText: "贪心解码 greedy · argmax",
    def: "每步直接取概率最高的 token,不掷骰子。结果唯一、可复现,但无多样性、易陷入复读死循环 —— 等价于 top_k=1。随机采样正是为了跳出这种死循环。",
    title: [
      "贪心解码 ",
      <En key={1}>{[
        "greedy · argmax",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "每步直接取概率",
        <b key={1}>{[
          "最高",
        ]}</b>,
        "的 token,不掷骰子。结果唯一、可复现,但",
        <b key={3}>{[
          "无多样性",
        ]}</b>,
        "、易陷入复读死循环 —— 等价于 ",
        <a key={5} href={"#top-k"}>{[
          "top_k",
        ]}</a>,
        "=1。",
        <a key={7} href={"#sampling"}>{[
          "随机采样",
        ]}</a>,
        "正是为了跳出这种死循环。",
      ]}</p>,
    ],
  },
  {
    id: "kv-cache",
    titleText: "KV-cache 键值缓存",
    def: "把过去每个 token 算出的 K/V 向量缓存下来,生成新 token 时只算新一列、复用历史,避免每步把整段注意力重算一遍。计算量从平方级降到线性,本项目实测推理提速约 2.5–3.1×。",
    title: [
      "KV-cache ",
      <En key={1}>{[
        "键值缓存",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把过去每个 token 算出的 ",
        <b key={1}>{[
          "K/V 向量缓存",
        ]}</b>,
        "下来,生成新 token 时",
        <b key={3}>{[
          "只算新一列",
        ]}</b>,
        "、复用历史,避免每步把整段",
        <a key={5} href={"#self-attention"}>{[
          "注意力",
        ]}</a>,
        "重算一遍。计算量从",
        <b key={7}>{[
          "平方级降到线性",
        ]}</b>,
        ",本项目实测推理提速约 2.5–3.1×。",
      ]}</p>,
    ],
  },
]
