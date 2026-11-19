# learn-llm

从零手写大语言模型的交互站。由 `llm-from-scratch/web/` 的单文件 HTML 迁到 Vite + React + TypeScript。内容、交互、视觉保持原页面，不改写教学内容。

旧站规范在 `~/Workspace/fim-ai/llm-from-scratch/可视化规范.md`。配色变量、分步导航、`#step-N` 深链、按钮 active、名词气泡、`.dig` 折叠、超参速查条都要守住。第 4 章是已知例外，深链用 `#part-N`。

## 不要动的

- 不要改 `~/Workspace/fim-ai/llm-from-scratch/` 里的任何文件。抽取脚本只读它。
- 不要 push，不要部署，不要连服务器。
- 不要改写、合并、精简教学内容。疑似错误写进 `docs/migration-notes.md`，不在正文里改。
- 不引入图表库或 UI 组件库。交互用手写 SVG、canvas、DOM。
- 包管理只用 pnpm。不要生成 `package-lock.json`。
- 新仓不含 Python，不含 notebooks。源码 / Colab 链接指回旧仓的 GitHub。

## 结构

- `src/catalog.json`：章节与首页的数据。`src/chapters.ts` 是类型和查询（`findChapter`、`chapterPath`）。首页卡片、左侧目录、步骤导航、分享卡都从这里来。
- 页内 tab 用 `steps[].nav`，首页卡片用 `steps[].card`。两句不完全一样，不要合成一句。
- `src/glossary.json` + `src/glossary.ts`：名词表。词条 `id` 对应旧 `glossary.html` 的锚点。
- `src/components/`：返回首页、文件名与源码链接、步骤导航、上一步/下一步、超参条、`Term`、`TermTip`、`Dig`、页脚、章节壳。
- `src/content/<slug>.json`：该章面板和超参条的 HTML，术语已写成 `<Term k>`。
- `src/content/<slug>.boot.js`：该章原来的交互脚本。
- `src/content/<slug>.css`：该章原来的 `<style>` 整段。
- `src/pages/`：首页、名词表、未迁页面、404。
- `nginx.conf`：旧文件名 301 到新路由。hash 由浏览器保留。
- `docs/url-map.md`：旧路径到新路由的全表。

路由：`/` 首页，`/glossary` 名词表，`/notes`、`/about`，`/ch/<slug>` 章节。已迁章节在 `catalog.json` 里 `ready: true`。

## 构建

```
pnpm install
pnpm dev          # http://localhost:5192
pnpm build        # check-terms + tsc + vite build + prerender
pnpm typecheck
pnpm test
pnpm compare      # 需要先 build。对照旧 HTML 与新站的可见文字，并点交互
pnpm extract      # 从旧站重新抽出 catalog / 名词表 / 已标记章节
```

`pnpm build` 会做三件事：

1. `scripts/check-terms.mjs`：每个 `<Term k>` 必须在名词表里，否则失败。
2. 预渲染 `dist/<route>/index.html`，写入 title、description、canonical（`https://learn-llm.fim.ai/...`）、og、twitter。图片用 `public/og.png`。
3. 写出 `dist/sitemap.xml` 和 `dist/robots.txt`。

深链是 `#step-N`（第 4 章是 `#part-N`）。章节脚本在加载时读 hash。301 不带走 hash，浏览器会把它接到新地址上。

## 迁下一章

1. 在 `scripts/extract_html.py` 的 `READY` 里加上文件名。slug 已在 `SLUG` 里。
2. `pnpm extract`，再把新的 `src/content/<slug>.{json,css,boot.js}` 接到 `src/content/specs.ts`。
3. `pnpm build`、`pnpm compare`。文字差异只允许来自源码 / Colab 链接。
4. 一批大约 5 章，一个 commit，提交说明写上这一批的章。

术语在动态字符串里写成 `<Term k="ppo">PPO</Term>`，由 `expandTerms` 换成气泡。定义沿用该处原来的 `data-def`；不写 `def` 时用名词表正文。

## 视觉

全站变量在 `src/site.css`：`--bg #F0EEE6`、`--accent #D97757`、衬线标题、等宽数字。各章原样式整段注入，避免把并不相同的规则（例如两种通关横幅）合成一份。`.panel` 在窄屏下 `overflow-x: auto`，避免 375px 出现整页横向滚动。
