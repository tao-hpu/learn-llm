// 名词表 · 注意力机制
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "self-attention",
    titleText: "自注意力 self-attention",
    def: "序列内部每个位置,通过 query/key/value 机制, 按相关性从其它位置(因果设定下只看过去)聚合信息,得到融合了上下文的新表示。 \"self\"指 q、k、v 都来自同一个序列。",
    title: [
      "自注意力 ",
      <En key={1}>{[
        "self-attention",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "序列内部每个位置,通过 ",
        <a key={1} href={"#qkv"}>{[
          "query/key/value",
        ]}</a>,
        " 机制, 按相关性从其它位置(因果设定下只看过去)",
        <b key={3}>{[
          "聚合信息",
        ]}</b>,
        ",得到融合了上下文的新表示。 \"self\"指 q、k、v 都来自同一个序列。",
      ]}</p>,
    ],
  },
  {
    id: "qkv",
    titleText: "Q / K / V query / key / value",
    def: "同一个输入经三个不同的线性投影得到的三种角色。query=我在找什么; key=我宣传自己是什么(被检索);value=你看我我给你什么(被取走的信息)。 用 query 比对所有 key 算出权重,再用权重聚合 value。",
    title: [
      "Q / K / V ",
      <En key={1}>{[
        "query / key / value",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "同一个输入经",
        <b key={1}>{[
          "三个不同的线性投影",
        ]}</b>,
        "得到的三种角色。",
        <b key={3}>{[
          "query",
        ]}</b>,
        "=我在找什么; ",
        <b key={5}>{[
          "key",
        ]}</b>,
        "=我宣传自己是什么(被检索);",
        <b key={7}>{[
          "value",
        ]}</b>,
        "=你看我我给你什么(被取走的信息)。 用 query 比对所有 key 算出权重,再用权重聚合 value。",
      ]}</p>,
    ],
  },
  {
    id: "dot-product",
    titleText: "点积 dot product",
    def: "两个等长向量对应元素相乘再求和,得到一个标量。结果越大,表示两向量方向越一致。 注意力用 q · k 来衡量\"query 和 key 有多相关\",作为关注分数。",
    title: [
      "点积 ",
      <En key={1}>{[
        "dot product",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "两个等长向量对应元素相乘再求和,得到一个标量。结果越大,表示两向量方向越一致。 注意力用 ",
        <code key={1}>{[
          "q · k",
        ]}</code>,
        " 来衡量\"query 和 key 有多相关\",作为关注分数。",
      ]}</p>,
    ],
  },
  {
    id: "tril",
    titleText: "下三角 lower-triangular / tril",
    def: "一个方阵,对角线及其左下方保留,右上方全部为 0。torch.tril 生成。 注意力用它做因果掩码:让第 i 个位置只能看到 0..i,看不到未来。 它管的是\"哪些位置必须为 0\"(结构),和归一化管的\"尺度\"互相独立。",
    title: [
      "下三角 ",
      <En key={1}>{[
        "lower-triangular / tril",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "一个方阵,",
        <b key={1}>{[
          "对角线及其左下方保留,右上方全部为 0",
        ]}</b>,
        "。",
        <code key={3}>{[
          "torch.tril",
        ]}</code>,
        " 生成。 注意力用它做",
        <a key={5} href={"#causal-mask"}>{[
          "因果掩码",
        ]}</a>,
        ":让第 i 个位置只能看到 0..i,看不到未来。 它管的是\"哪些位置必须为 0\"(结构),和归一化管的\"尺度\"互相独立。",
      ]}</p>,
    ],
  },
  {
    id: "causal-mask",
    titleText: "因果掩码 causal mask",
    def: "在注意力分数里,把\"未来位置\"设成 -∞,经 softmax 后它们权重变 0。 保证预测下一个字符时不能偷看答案。靠下三角实现: masked_fill(tril==0, -inf)。",
    title: [
      "因果掩码 ",
      <En key={1}>{[
        "causal mask",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "在注意力分数里,把\"",
        <b key={1}>{[
          "未来位置",
        ]}</b>,
        "\"设成 ",
        <code key={3}>{[
          "-∞",
        ]}</code>,
        ",经 softmax 后它们权重变 0。 保证预测下一个字符时",
        <b key={5}>{[
          "不能偷看答案",
        ]}</b>,
        "。靠",
        <a key={7} href={"#tril"}>{[
          "下三角",
        ]}</a>,
        "实现: ",
        <code key={9}>{[
          "masked_fill(tril==0, -inf)",
        ]}</code>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "scaling",
    titleText: "缩放 scaling (÷√d)",
    def: "注意力把 q·k 的分数除以 √head_size。因为点积的方差随维度增大, 不缩放会让 softmax 过于尖锐、把权重几乎全压给一个位置,导致梯度消失。 除以 √d 把分数尺度拉回正常。",
    title: [
      "缩放 ",
      <En key={1}>{[
        "scaling (÷√d)",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "注意力把 ",
        <code key={1}>{[
          "q·k",
        ]}</code>,
        " 的分数除以 ",
        <code key={3}>{[
          "√head_size",
        ]}</code>,
        "。因为点积的方差随维度增大, 不缩放会让 softmax 过于尖锐、把权重几乎全压给一个位置,导致",
        <a key={5} href={"#vanishing"}>{[
          "梯度消失",
        ]}</a>,
        "。 除以 √d 把分数尺度拉回正常。",
      ]}</p>,
    ],
  },
  {
    id: "positional-embedding",
    titleText: "位置嵌入 positional embedding",
    def: "因为注意力本身看不出顺序(打乱输入,输出只跟着打乱,权重不变), 所以额外给\"第几个位置\"也学一个向量,加到 token 嵌入上,模型才知道谁先谁后。 代码:x = tok_emb + pos_emb。",
    title: [
      "位置嵌入 ",
      <En key={1}>{[
        "positional embedding",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "因为注意力",
        <b key={1}>{[
          "本身看不出顺序",
        ]}</b>,
        "(打乱输入,输出只跟着打乱,权重不变), 所以额外给\"第几个位置\"也学一个向量,",
        <b key={3}>{[
          "加到 token 嵌入上",
        ]}</b>,
        ",模型才知道谁先谁后。 代码:",
        <code key={5}>{[
          "x = tok_emb + pos_emb",
        ]}</code>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "multi-head",
    titleText: "多头注意力 multi-head attention",
    def: "把注意力拆成若干个并行的头:每个头在 n_embd 的一个子空间里独立 打分聚合(每头 head_size = n_embd / n_head 维),最后把各头输出拼接(cat)再过一个 proj 线性层融合,回到 n_embd。 要点:不是把模型加宽,而是把同一块 n_embd 切成几份 —— 切几份总料不变,显存/算力基本持平。 每个头会在训练中自发分化出不同专长(盯前一词、回看句首、配对括号…),没人指定; 这与 Q/K/V 那种\"公式钦定\"的分工不同。本项目第 3 关开始用。",
    title: [
      "多头注意力 ",
      <En key={1}>{[
        "multi-head attention",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把注意力拆成若干个并行的",
        <b key={1}>{[
          "头",
        ]}</b>,
        ":每个头在 ",
        <a key={3} href={"#n_embd"}>{[
          "n_embd",
        ]}</a>,
        " 的一个",
        <b key={5}>{[
          "子空间",
        ]}</b>,
        "里独立 打分聚合(每头 ",
        <code key={7}>{[
          "head_size = n_embd / n_head",
        ]}</code>,
        " 维),最后把各头输出",
        <b key={9}>{[
          "拼接(cat)",
        ]}</b>,
        "再过一个 ",
        <code key={11}>{[
          "proj",
        ]}</code>,
        " 线性层融合,回到 n_embd。 要点:",
        <b key={13}>{[
          "不是把模型加宽,而是把同一块 n_embd 切成几份",
        ]}</b>,
        " —— 切几份总料不变,显存/算力基本持平。 每个头会在训练中",
        <b key={15}>{[
          "自发分化",
        ]}</b>,
        "出不同专长(盯前一词、回看句首、配对括号…),没人指定; 这与 ",
        <a key={17} href={"#qkv"}>{[
          "Q/K/V",
        ]}</a>,
        " 那种\"公式钦定\"的分工不同。本项目",
        <b key={19}>{[
          "第 3 关",
        ]}</b>,
        "开始用。",
      ]}</p>,
    ],
  },
  {
    id: "sft",
    titleText: "SFT Supervised Fine-Tuning · 监督微调",
    def: "预训练之后的一步:用「问 → 答」成对数据继续训练同一批参数(包括 Wq/Wk/Wv), 把模型调成\"以助手口吻回答\"的姿态。要点:\"抓相关上下文\"的能力是预训练就建好的,SFT 只是在上面拧风格 —— 它不会\"激活\" QKV 里某个为问答预留的用途(QKV 2017 年为翻译而生,SFT 2022 年才出现,不存在\"提前挖坑\")。 它属于后训练的第一段(注意:后训练 = SFT + 偏好对齐, SFT 本身还不是\"对齐\")。本项目在第 8 章 / 06_sft.py 手搓了一遍。",
    title: [
      "SFT ",
      <En key={1}>{[
        "Supervised Fine-Tuning · 监督微调",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "预训练之后的一步:用",
        <b key={1}>{[
          "「问 → 答」成对数据",
        ]}</b>,
        "继续训练",
        <b key={3}>{[
          "同一批参数",
        ]}</b>,
        "(包括 ",
        <a key={5} href={"#qkv"}>{[
          "Wq/Wk/Wv",
        ]}</a>,
        "), 把模型调成\"以助手口吻回答\"的姿态。要点:",
        <b key={7}>{[
          "\"抓相关上下文\"的能力是预训练就建好的,SFT 只是在上面拧风格",
        ]}</b>,
        " —— 它",
        <b key={9}>{[
          "不会",
        ]}</b>,
        "\"激活\" QKV 里某个为问答预留的用途(QKV 2017 年为翻译而生,SFT 2022 年才出现,不存在\"提前挖坑\")。 它属于",
        <b key={11}>{[
          "后训练",
        ]}</b>,
        "的第一段(注意:后训练 = SFT + ",
        <a key={13} href={"#preference-alignment"}>{[
          "偏好对齐",
        ]}</a>,
        ", SFT 本身还不是\"对齐\")。本项目在",
        <b key={15}>{[
          "第 8 章 / ",
          <code key={1}>{[
            "06_sft.py",
          ]}</code>,
        ]}</b>,
        " 手搓了一遍。",
      ]}</p>,
    ],
  },
]
