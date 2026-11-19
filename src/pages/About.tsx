import { Link } from 'react-router-dom'
import { HomeLink } from '../components/HomeLink'
import styles from './About.module.css'

export function About() {
  return (
    <div className={`wrap ${styles.page}`}>
      <HomeLink />
      <header>
        <h1>关于本项目</h1>
        <p className="subtitle">LLM from Scratch 是一个从零手写大语言模型的教学项目。每一章由两部分组成:真正实现的 Python 代码,和一页可以亲手拨动的交互式可视化。</p>
      </header>

      <section className={styles.block}>
        <h2>为什么要手写</h2>
        <p>只会用 LLaMA-Factory、TRL 这类框架时,改的是配置项;模型出了问题,很难判断是哪一环。本项目回答的问题是:这些组件各自是怎么实现的。</p>
        <p>从 bigram 到 GPT-2 124M,从 SFT、LoRA、DPO 到 MoE 与 LLaMA 四件套,再到线性 / 稀疏注意力、投机解码、量化,以及分词器、注意力 kernel、scaling law 和 RLVR,全部手写,不调框架。弄清原理之后再用生产工具,每个配置项改动的是什么就有据可查。</p>
      </section>

      <section className={styles.block}>
        <h2>页面怎么用</h2>
        <ul>
          <li>每章 5 步左右,每步一个可拨动的交互,先建立直觉,再对照代码。首页卡片上的步骤可以直接跳到对应的一步。</li>
          <li>带虚线下划线的术语,悬停或点击会弹出解释,完整释义在 <Link to="/glossary">名词表</Link>。</li>
          <li>正课之外的历史与训练日志,收在 <Link to="/notes">学习札记</Link>。</li>
          <li>所有页面都是单个 HTML 文件,不依赖外部脚本、样式或字体,下载后离线双击即可打开。</li>
        </ul>
      </section>

      <section className={styles.block}>
        <h2>章节安排</h2>
        <div className={styles.tbl}>
          <table className={styles.table}>
            <tbody>
              <tr><th>阶段</th><th>章节</th><th>内容</th></tr>
              <tr><td>第一阶段 · nanoGPT</td><td className={styles.n}>1–4</td><td>bigram 基线、自注意力、完整 Transformer、整机俯瞰</td></tr>
              <tr><td>第一阶段 · 124M</td><td className={styles.n}>5–6</td><td>采样与 KV-cache、GPT-2 124M 预训练(FineWeb-Edu 10B token)</td></tr>
              <tr><td>第二阶段 · 后训练</td><td className={styles.n}>7–10</td><td>后训练地图、SFT、LoRA、DPO</td></tr>
              <tr><td>第三阶段 · 现代架构</td><td className={styles.n}>11–12</td><td>MoE、LLaMA 四件套(RoPE / RMSNorm / SwiGLU / GQA)</td></tr>
              <tr><td>第四阶段 · 长上下文与推理效率</td><td className={styles.n}>13–17</td><td>线性注意力、稀疏注意力、N-gram 查表、投机解码与 MTP、量化</td></tr>
              <tr><td>第五阶段 · 补齐全链路</td><td className={styles.n}>18–21</td><td>手写 BPE、FlashAttention Triton kernel、scaling law、RLVR 与 GRPO</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.block}>
        <h2>代码与硬件</h2>
        <p>代码在 <a href="https://github.com/tao-hpu/llm-from-scratch" target="_blank" rel="noopener">GitHub 仓库</a>,按阶段分目录(<code>phase1-nanogpt/</code>、<code>phase1-124m/</code> 等)。页面中的实验数字都来自这些脚本的实际运行。</p>
        <ul>
          <li>第一阶段玩具版、第三 / 四阶段的小模型实验:CUDA、Apple MPS、CPU 都能跑。</li>
          <li>GPT-2 124M 全量预训练:需要 NVIDIA GPU,单卡 RTX 4090 约 24 小时,val loss 3.02。</li>
          <li>FlashAttention Triton kernel、scaling law 的一批训练:需要 NVIDIA GPU。</li>
        </ul>
        <p>各脚本的运行方式与硬件要求见仓库 README。</p>
      </section>

      <section className={styles.block}>
        <h2>致谢与许可</h2>
        <p>整条路线参考 Andrej Karpathy 的 <a href="https://karpathy.ai/zero-to-hero.html" target="_blank" rel="noopener">Neural Networks: Zero to Hero</a> 系列、<a href="https://github.com/karpathy/nanoGPT" target="_blank" rel="noopener">nanoGPT</a> 与 <a href="https://github.com/karpathy/build-nanogpt" target="_blank" rel="noopener">build-nanogpt</a>,在其基础上做了逐行中文重写与讲解。数据集为 <a href="https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu" target="_blank" rel="noopener">FineWeb-Edu</a>。</p>
        <p>本项目以 MIT License 开源,可自由学习、修改、再发布。如果对你有帮助,欢迎在 GitHub 上点个 Star,也方便之后查看更新。</p>
      </section>
    </div>
  )
}
