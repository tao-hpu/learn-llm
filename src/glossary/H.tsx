// 名词表 · MoE 与稀疏激活(Phase 3)
import type { GlossaryEntry } from './types'
import { En } from './marks'

export const entries: GlossaryEntry[] = [
  {
    id: "moe",
    titleText: "MoE / 专家 Mixture of Experts · expert",
    def: "把 Transformer 的 FFN 拆成多个\"专家\"(结构相同、各自更窄的小 FFN), 每个 token 由路由器派给其中 top-k 个处理。 效果是总参数(容量)变多、每 token 计算量不变 —— Mixtral 8×7B(总 46.7B / 激活 12.9B)、 DeepSeek-V3(总 671B / 激活 37B)都是这个机关。专家的分工不是人设计的,是训练中自己涌现的, 而且多为词形/标点这类低层统计分工,不是\"数学专家/法律专家\"。本项目在 09_moe.py 手搓(4 专家 · top-2)。",
    title: [
      "MoE / 专家 ",
      <En key={1}>{[
        "Mixture of Experts · expert",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "把 Transformer 的 ",
        <a key={1} href={"#feedforward"}>{[
          "FFN",
        ]}</a>,
        " 拆成多个\"",
        <b key={3}>{[
          "专家",
        ]}</b>,
        "\"(结构相同、各自更窄的小 FFN), 每个 token 由",
        <a key={5} href={"#router"}>{[
          "路由器",
        ]}</a>,
        "派给其中 ",
        <b key={7}>{[
          "top-k 个",
        ]}</b>,
        "处理。 效果是",
        <b key={9}>{[
          "总参数(容量)变多、每 token 计算量不变",
        ]}</b>,
        " —— Mixtral 8×7B(总 46.7B / 激活 12.9B)、 DeepSeek-V3(总 671B / 激活 37B)都是这个机关。专家的分工不是人设计的,是训练中自己涌现的, 而且多为词形/标点这类",
        <b key={11}>{[
          "低层统计分工",
        ]}</b>,
        ",不是\"数学专家/法律专家\"。本项目在 ",
        <code key={13}>{[
          "09_moe.py",
        ]}</code>,
        " 手搓(4 专家 · top-2)。",
      ]}</p>,
    ],
  },
  {
    id: "router",
    titleText: "路由器 / top-k 门控 router · top-k gating",
    def: "MoE 的派单员:一个 n_embd → n_expert 的线性层,给每个 token 对每个专家打分, softmax 后只保留分数最高的 top_k 个,输出 = 选中专家的加权和(k>1 时权重在选中的几个里重新归一化)。 派单单位是 token(同一句话里相邻字符可以走不同专家)。top-k 挑选本身不可导, 但选中专家的权重来自 softmax、可导 —— 梯度顺着权重传回路由器,它就学会了\"该派给谁\"。⚠️ 所以那个权重是路由器唯一的学习通道,top-1 时千万别归一化:只剩一个专家,归一化后权重恒等于 1, 梯度随之归零、路由器等于被冻住。Switch Transformer 的 top-1 就是直接拿未归一化的概率当权重。",
    title: [
      "路由器 / top-k 门控 ",
      <En key={1}>{[
        "router · top-k gating",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "MoE 的派单员:一个 ",
        <code key={1}>{[
          "n_embd → n_expert",
        ]}</code>,
        " 的",
        <b key={3}>{[
          "线性层",
        ]}</b>,
        ",给每个 token 对每个专家打分, softmax 后",
        <b key={5}>{[
          "只保留分数最高的 top_k 个",
        ]}</b>,
        ",输出 = 选中专家的加权和(k>1 时权重在选中的几个里重新归一化)。 派单单位是 ",
        <b key={7}>{[
          "token",
        ]}</b>,
        "(同一句话里相邻字符可以走不同专家)。top-k 挑选本身不可导, 但选中专家的权重来自 softmax、可导 —— 梯度顺着权重传回路由器,它就学会了\"该派给谁\"。",
      ]}</p>,
      <p key={1}>{[
        "⚠️ 所以那个权重是路由器",
        <b key={1}>{[
          "唯一",
        ]}</b>,
        "的学习通道,",
        <b key={3}>{[
          "top-1 时千万别归一化",
        ]}</b>,
        ":只剩一个专家,归一化后权重恒等于 1, 梯度随之归零、路由器等于被冻住。Switch Transformer 的 top-1 就是直接拿",
        <b key={5}>{[
          "未归一化",
        ]}</b>,
        "的概率当权重。",
      ]}</p>,
    ],
  },
  {
    id: "load-balancing",
    titleText: "负载均衡 loss load balancing / auxiliary loss",
    def: "治路由器偏心的辅助损失(Switch Transformer 式):aux = n_expert · Σ f_e·P_e, 其中 f_e 是实际派给专家 e 的 token 占比(不可导)、P_e 是路由器给 e 的平均概率(可导)。 负载均匀时取最小值 1;谁过热,梯度就顺着可导的 P 压谁的分数。以小系数(如 0.01)加进总 loss, 防止专家塌缩。",
    title: [
      "负载均衡 loss ",
      <En key={1}>{[
        "load balancing / auxiliary loss",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "治路由器偏心的辅助损失(Switch Transformer 式):",
        <code key={1}>{[
          "aux = n_expert · Σ f_e·P_e",
        ]}</code>,
        ", 其中 ",
        <code key={3}>{[
          "f_e",
        ]}</code>,
        " 是实际派给专家 e 的 token 占比(不可导)、",
        <code key={5}>{[
          "P_e",
        ]}</code>,
        " 是路由器给 e 的平均概率(可导)。 负载均匀时取最小值 1;谁过热,梯度就顺着可导的 P 压谁的分数。以小系数(如 0.01)加进总 loss, 防止",
        <a key={7} href={"#expert-collapse"}>{[
          "专家塌缩",
        ]}</a>,
        "。",
      ]}</p>,
    ],
  },
  {
    id: "expert-collapse",
    titleText: "专家塌缩 expert collapse",
    def: "MoE 不加管束时的失败模式:\"接单多 → 练得好 → 分数高 → 接单更多\"的正反馈滚雪球, 路由器把绝大多数 token 塞给一两个专家,其余专家拿不到梯度、彻底闲置 —— 参数还在,容量已废,MoE 退化成小 dense 模型。解法就是负载均衡 loss。 top_k 越小、专家越多,越容易塌;09_moe.py 里 --top-k 1 --aux 0(Switch 同款 top-1)可以亲眼看偏载滚雪球, 而默认的 top-2 + 4 专家配置天生抗塌(每个 token 同时养 2 个专家,谁都饿不死)。",
    title: [
      "专家塌缩 ",
      <En key={1}>{[
        "expert collapse",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "MoE 不加管束时的失败模式:\"接单多 → 练得好 → 分数高 → 接单更多\"的",
        <b key={1}>{[
          "正反馈滚雪球",
        ]}</b>,
        ", 路由器把绝大多数 token 塞给一两个专家,其余专家拿不到梯度、彻底闲置 —— 参数还在,容量已废,MoE 退化成小 dense 模型。解法就是",
        <a key={3} href={"#load-balancing"}>{[
          "负载均衡 loss",
        ]}</a>,
        "。 top_k 越小、专家越多,越容易塌;",
        <code key={5}>{[
          "09_moe.py",
        ]}</code>,
        " 里 ",
        <code key={7}>{[
          "--top-k 1 --aux 0",
        ]}</code>,
        "(Switch 同款 top-1)可以亲眼看偏载滚雪球, 而默认的 top-2 + 4 专家配置天生抗塌(每个 token 同时养 2 个专家,谁都饿不死)。",
      ]}</p>,
    ],
  },
  {
    id: "active-params",
    titleText: "激活参数 active parameters · 稀疏激活",
    def: "处理一个 token 实际参与计算的参数量。dense 模型里激活参数 = 总参数; MoE 里每 token 只走 top-k 个专家,激活参数远小于总参数 —— 所以模型简介里会写两个数字 (如\"总 671B / 激活 37B\")。注意 MoE 省的是算力(FLOPs),不是显存:没被激活的专家参数也得放在显存里待命。",
    title: [
      "激活参数 ",
      <En key={1}>{[
        "active parameters · 稀疏激活",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "处理",
        <b key={1}>{[
          "一个 token",
        ]}</b>,
        " 实际参与计算的参数量。dense 模型里激活参数 = 总参数; MoE 里每 token 只走 top-k 个专家,激活参数远小于总参数 —— 所以模型简介里会写两个数字 (如\"总 671B / 激活 37B\")。注意 ",
        <b key={3}>{[
          "MoE 省的是算力(FLOPs),不是显存",
        ]}</b>,
        ":没被激活的专家参数也得放在显存里待命。",
      ]}</p>,
    ],
  },
  {
    id: "shared-expert",
    titleText: "细粒度专家 / 共享专家 fine-grained experts · shared experts",
    def: "DeepSeekMoE(arXiv 2401.06066)对 MoE 的两处改法。细粒度:把 N 个专家各自切窄成 mN 个,激活数同比放大到 mK, 每 token 的算力不变,可选的专家组合从 C(N,K) 变成 C(mN,mK)。共享专家:单独留出几个专家不经路由器, 每个 token 都过,承担各类 token 都要用的通用加工。DeepSeek-V3 每层 256 个路由专家选 8 个,外加 1 个共享专家。 本项目在 09_moe.py 用 --n-expert 16 --expert-hidden 64 --top-k 6 --shared 1 跑过一组对照(第 11 章 STEP 6)。",
    title: [
      "细粒度专家 / 共享专家 ",
      <En key={1}>{[
        "fine-grained experts · shared experts",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "DeepSeekMoE(arXiv 2401.06066)对 ",
        <a key={1} href={"#moe"}>{[
          "MoE",
        ]}</a>,
        " 的两处改法。",
        <b key={3}>{[
          "细粒度",
        ]}</b>,
        ":把 N 个专家各自切窄成 mN 个,激活数同比放大到 mK, 每 token 的算力不变,可选的专家组合从 C(N,K) 变成 C(mN,mK)。",
        <b key={5}>{[
          "共享专家",
        ]}</b>,
        ":单独留出几个专家不经",
        <a key={7} href={"#router"}>{[
          "路由器",
        ]}</a>,
        ", 每个 token 都过,承担各类 token 都要用的通用加工。DeepSeek-V3 每层 256 个路由专家选 8 个,外加 1 个共享专家。 本项目在 ",
        <code key={9}>{[
          "09_moe.py",
        ]}</code>,
        " 用 ",
        <code key={11}>{[
          "--n-expert 16 --expert-hidden 64 --top-k 6 --shared 1",
        ]}</code>,
        " 跑过一组对照(第 11 章 STEP 6)。",
      ]}</p>,
    ],
  },
  {
    id: "aux-free-balancing",
    titleText: "无辅助损失的负载均衡 auxiliary-loss-free load balancing",
    def: "DeepSeek-V3 的做法(arXiv 2412.19437 §2.1.2;方法出自 arXiv 2408.15664):每个专家配一个偏置 b,只在挑选 top-k 时加到分数上, 门控权重仍用原始分数,偏置也不进 loss。每步训练后,接单高于平均的专家 b 减 γ,低于平均的加 γ(V3 前 14.3T token 用 γ=0.001)。 和 aux loss 相比,它不往语言模型的梯度里掺别的目标。 V3 另外保留一个系数 0.0001 的序列级均衡 loss。本项目 09_moe.py --balance bias 是它的教学版。",
    title: [
      "无辅助损失的负载均衡 ",
      <En key={1}>{[
        "auxiliary-loss-free load balancing",
      ]}</En>,
    ],
    body: [
      <p key={0}>{[
        "DeepSeek-V3 的做法(arXiv 2412.19437 §2.1.2;方法出自 arXiv 2408.15664):每个专家配一个偏置 b,",
        <b key={1}>{[
          "只在挑选 top-k 时加到分数上",
        ]}</b>,
        ", 门控权重仍用原始分数,偏置也不进 loss。每步训练后,接单高于平均的专家 b 减 γ,低于平均的加 γ(V3 前 14.3T token 用 γ=0.001)。 和 ",
        <a key={3} href={"#load-balancing"}>{[
          "aux loss",
        ]}</a>,
        " 相比,它不往语言模型的梯度里掺别的目标。 V3 另外保留一个系数 0.0001 的序列级均衡 loss。本项目 ",
        <code key={5}>{[
          "09_moe.py --balance bias",
        ]}</code>,
        " 是它的教学版。",
      ]}</p>,
    ],
  },
]
