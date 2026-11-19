# learn-llm

从零手写大语言模型的交互站，线上 https://learn-llm.fim.ai 。正文在本仓用 React + TypeScript 维护。配套的 Python 代码与 notebooks 在 `tao-hpu/llm-from-scratch`；它原来的 `web/` 单文件页面已迁到本仓，不再维护。

页面规范在 `docs/可视化规范.md`（从旧仓复制，正文里「单文件、零依赖」等条目以本文件为准）。配色、分步导航、`#step-N` 深链（第 4 章是 `#part-N`）、按钮 active、名词气泡、`.dig` 折叠、超参速查条都要守住。

## 约定

- push 前 `pnpm build` 必须通过。
- 不引入图表库或 UI 组件库。
- 只用 pnpm。不要生成 `package-lock.json`。
- 本仓不含 Python，不含 notebooks。源码 / Colab 链接指回旧仓的 GitHub。

## 结构

- `src/catalog.json` 与 `src/chapters.ts`：章节清单，只放纯文本。首页卡片、左侧目录、步骤标题、分享卡都从这里读。`steps[].card` 是首页文案，`steps[].nav` 是页内 tab，两句不一样就分两个字段。带排版的首页标题和卡片说明在 `src/pages/homeText.tsx`。
- `src/glossary.json`：名词表的页面元信息、分组和 TOC。正文在 `src/glossary/<分组>.tsx`，用普通 JSX 写，子节点不要包成数组。气泡用的纯文本在词条的 `def` 字段，应与正文去标签后一致。
- `src/components/ChapterShell.tsx`：分步导航、深链、上一步 / 下一步、最后一步「完成 🎉」、通关横幅和 confetti。各章只提供步骤数组。每一步都保持挂载，离开时去掉 `active`。`prefers-reduced-motion: reduce` 时只留横幅，不放 confetti。第 4 章 `#step-N` 按 `#part-N` 认，并改写成 `#part-N`。
- `src/components/Term.tsx`、`TermTip.tsx`、`Dig.tsx`、`HpBar.tsx`：名词、折叠、超参条。
- `src/pages/<Name>.tsx` 加同名 `.module.css`：一章一个页面。公共变量和外壳样式在 `src/site.css`。
- `nginx.conf`：手工维护。旧文件名 301 到新路由；`/index.html` 301 到 `/`；其余未知路径回 SPA 外壳，由前端显示 404。
- `docs/url-map.md`：旧路径到新路由。

离开一步时，如果这一步的动画还在跑，立刻跳到结束状态：文字、曲线、高亮都是跑完的样子，按钮恢复成可点。回来不自动重播。新写的计时器和 `requestAnimationFrame` 都按这条做。

## 构建

```
pnpm install
pnpm dev
pnpm build        # check-source + check-terms + tsc + vite build + prerender
pnpm typecheck
pnpm test
pnpm compare      # 先 build。对照旧 HTML 的可见文字（需要本机有 llm-from-scratch/web/）
pnpm compare:behavior  # 同一套点击和滑块，对照当前面板的文字、SVG 和高亮（同上）
```

`pnpm build` 会失败的条件，以及每条检查扫哪些文件，写在 `docs/source-checks.md`。`<Term k>` 在名词表里没有对应词条时同样失败。

预渲染写入 title、description、canonical（`https://learn-llm.fim.ai/...`）、og、twitter，以及 `sitemap.xml` 和 `robots.txt`。图片用 `public/og.png`。

## 加一章或改一章

新章加 `src/pages/<Name>.tsx` 和 `.module.css`，在 `catalog.json` 里登记（`ready: true`），在 `App.tsx` 挂上。新名词先进 `src/glossary/`，再用 `<Term k>`。

## 部署

Docker 镜像（`Dockerfile`：pnpm 9 构建 → nginx 1.27 托管 `dist/`，配置是本仓 `nginx.conf`），容器 `learn-llm` 监听 `127.0.0.1:5193`。服务器上由 Caddy 反代 `learn-llm.fim.ai`，与 l2a.fim.ai（linalg-to-attention）同一做法；服务器本地的 `docker-compose.override.yml` 让容器加入 Caddy 的 `web` 网络，不进 git。

服务器上在仓库目录运行 `./deploy.sh`：拉 `origin/main`、重建镜像、重启容器。服务器地址与路径不写进本仓。
