# 迁移笔记

第一批只迁了首页、名词表，以及第 1 章（`01_bigram_crossentropy_viz.html`）、第 7 章（`06_posttraining_viz.html`）、第 21 章（`21_rlvr_grpo_viz.html`）。正文按源页面抽出，没有改写句子。

## 源仓状态

迁移读的是 `llm-from-scratch` 工作区里的文件，不是 `HEAD`。当时有三处未提交改动：

- `web/06_posttraining_viz.html`
- `web/glossary.html`
- `web/index.html`

按阅读顺序，`06_posttraining_viz.html` 是第 7 章。本仓没有改那个仓库，也没有替它提交。

## 需要拍板

1. 未迁的 18 章，以及札记、关于页，首页仍然链过去。路由和 301 已经占上，打开后是一句「还没迁进新站」，不是原文。要不要在后续批次完成前先从首页拿掉这些链接。
2. 新路由的 slug 现为 `bigram`、`posttraining`、`rlvr-grpo` 这一套（完整表在 `docs/url-map.md`）。要改名就在继续搬之前改，否则 301 和已发出的链接会跟着变。
3. 首页卡片上的步骤文案和页内 tab 不是同一句（例如卡片写「一个 batch 的 x / y 错位」，tab 写「一个 batch 的 x / y」）。`chapters.ts` 里分成 `steps[].card` 和 `steps[].nav`，没有合成一句。如果希望两边永远用同一句，需要先改源站。
4. 气泡上的一句话来自各页原来的 `data-def`，名词表正文是另一段更长的说明。`<Term k>` 缺 `def` 时才回落到名词表。没有把两边合并成一段。
5. 第 1 章的通关是浮层，约 3.4 秒后消失；第 7、21 章是最后一步里的常驻横幅。两套动画都留在各章原来的脚本里，没有收成同一个函数。
6. 375px 时给 `.panel` 加了 `overflow-x: auto`。第 1 章第 2 步的方块会横向超出，原先会把整页撑出滚动条，现在滚动留在面板里。这是源页面没有的一条规则。
7. 章节页的 `<style>` 整段还挂在该页，没有从三章里抠掉重复规则。第 1 章的 `.congrats` 是固定定位，第 7、21 章是文档流里的横幅，合成一份会走样。

## 实现上记下的选择

- 交互脚本原样放在 `src/content/<slug>.boot.js`，只把 `document` 查询限定在本章根节点，名词气泡改由全站 `TermTip` 委托，`hashchange` 在离开页面时摘掉。
- 动态插入的字符串如果写成 `<Term k="ppo">PPO</Term>`，走 `expandTerms`。这三章的脚本本身没有在 `innerHTML` 里写术语。
- 旧页面里指向 `*.html` 的站内链接改到了新路由，可见文字没改。
- 没有开 React `StrictMode`。原脚本会在加载时绑定监听，开发模式双调用会绑两次。
- 构建期 `scripts/check-terms.mjs` 扫全部 `<Term k>`。这一批 68 处，名词表 113 条，都对得上。
- 源码和 Colab 链接写在 `chapters.ts` 的 `codeLinks` / `source` / `colab`。新仓不含 Python，也不含 notebook。没有配套脚本的章（整机俯瞰、后训练地图）`source` 为 `null`。
- 名词表 TOC 的顺序和正文词条顺序本来就不一致，两份都按原页面保留。

## 没有当成错误去改的

迁移过程中没有改教学句子，也没有单独做事实核对。看到的差异都记在上面，没有在正文里「顺手修正」。
