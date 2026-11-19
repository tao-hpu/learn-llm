# learn-llm

从零手写大语言模型的交互站。正文在本仓用 React + TypeScript 维护。`llm-from-scratch/web/` 只作为迁完之前的对照，不再改，也不再从那边生成页面。

旧站规范在 `~/Workspace/fim-ai/llm-from-scratch/可视化规范.md`。配色、分步导航、`#step-N` 深链（第 4 章是 `#part-N`）、按钮 active、名词气泡、`.dig` 折叠、超参速查条都要守住。

## 不要动的

- 不要改 `~/Workspace/fim-ai/llm-from-scratch/`。
- 不要 push，不要部署，不要连服务器。
- 不要改写教学内容。疑似错误写进 `docs/migration-notes.md`。
- 不引入图表库或 UI 组件库。
- 只用 pnpm。不要生成 `package-lock.json`。
- 本仓不含 Python，不含 notebooks。源码 / Colab 链接指回旧仓的 GitHub。

## 结构

- `src/catalog.json` 与 `src/chapters.ts`：章节清单。首页卡片、左侧目录、步骤标题、分享卡都从这里读。`steps[].card` 是首页文案，`steps[].nav` 是页内 tab，两句不一样就分两个字段。
- `src/glossary.json` 与 `src/glossary.ts`：名词表。`id` 对应旧锚点。行内排版是节点，不是 HTML 字符串，由 `Rich` 渲染。
- `src/components/ChapterShell.tsx`：分步导航、深链、上一步 / 下一步、最后一步「完成 🎉」、通关横幅和 confetti。各章只提供步骤数组。
- `src/components/Term.tsx`、`TermTip.tsx`、`Dig.tsx`、`HpBar.tsx`：名词、折叠、超参条。
- `src/pages/<Name>.tsx` 加同名 `.module.css`：一章一个页面。公共变量和外壳样式在 `src/site.css`。
- `nginx.conf`：手工维护。旧文件名 301 到新路由；`/index.html` 301 到 `/`；其余未知路径回 SPA 外壳，由前端显示 404。
- `docs/url-map.md`：旧路径到新路由。

`ready: false` 的章只有目录和分享卡，打开是「还没迁进新站」。

## 构建

```
pnpm install
pnpm dev
pnpm build        # check-source + check-terms + tsc + vite build + prerender
pnpm typecheck
pnpm test
pnpm compare      # 先 build。对照旧 HTML 的可见文字，并点交互
```

`pnpm build` 会失败，如果：

- 已迁章节没有 `src/pages/<Name>.tsx`，或页面没用 `ChapterShell` / `Term` / `Dig` / `HpBar`
- `src/` 里出现 `dangerouslySetInnerHTML`、`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`getElementById`、`querySelector`、`querySelectorAll`
- JSON 或 TS 常量里存放 HTML 标签，或导入旧页面脚本
- 源码里有指向 `NN_xxx_viz.html` 的链接
- `<Term k>` 在名词表里没有对应词条

预渲染写入 title、description、canonical（`https://learn-llm.fim.ai/...`）、og、twitter，以及 `sitemap.xml` 和 `robots.txt`。图片用 `public/og.png`。

## 再迁一章

在新仓里加 `src/pages/<Name>.tsx` 和 `.module.css`，把 `catalog.json` 里该章 `ready` 改成 `true`，在 `App.tsx` 挂上。对照旧 HTML 核对文案。一批大约 5 章，一个 commit。不要从旧仓生成页面。
