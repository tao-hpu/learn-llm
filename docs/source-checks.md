# 构建期检查

`pnpm build` 先跑 `scripts/check-source.mjs`，再跑 `scripts/check-terms.mjs`。下面任何一条失败，构建就停。

## check-source

扫的根目录是 `src/`。下表里的扩展名都相对这个目录，包含子目录。

| 检查 | 范围 | 怎样算失败 |
| --- | --- | --- |
| 旧页面产物 | `src/` 下全部文件名 | 文件名以 `.boot.js` 结尾，或路径在 `src/content/` 里且以 `.json` 结尾 |
| 旧脚本 | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.json` `.css` | 出现 `expandTerms`，或 import 路径指向 `.boot` / `.boot.js` |
| 禁用 DOM API | 同上 | 出现 `dangerouslySetInnerHTML`、`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`getElementById`、`querySelector`、`querySelectorAll`。注释里写到这些词也算 |
| HTML 字符串 | `.json` | 文本里出现 `b`、`code`、`span`、`div`、`p`、`a`、`br`、`i`、`sub`、`sup`、`section`、`button`、`style`、`script`、`ul`、`li`、`h1`–`h6` 这类标签 |
| HTML 字符串 | `.ts` `.tsx` `.js` `.jsx` `.mjs` | `const` / `let` / `var` 赋给一段字符串，且这段字符串里有上面那些标签 |
| 嵌套排版 | `.json` | 对象里有键 `b`、`code`、`p`、`div`、`term`，并且值是数组或对象 |
| 旧章节文件名 | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.json` `.css` | 出现 `NN_xxx_viz.html`。唯一例外是 `src/catalog.json` 里 `"file"` 的值，而且这个值必须等于某一章的 `file` |
| 已迁章节的页面 | `catalog.json` 里 `ready: true` 的章 | 没有 `src/pages/<Name>.tsx`，或文件里没有 `ChapterShell`、`<Term`、`<Dig`、`<HpBar`，或 `App.tsx` 没有挂上这个组件名 |
| 页面样式 | 同上，同名 `.module.css` | 文件不存在，或里面再写了 `:root`、`.term`、`.hp-bar`、`.step-tab`、`.dig` |

`NN` 是两位数字，`xxx` 是小写字母、数字和下划线。`scripts/` 不在这套扫描里。

## check-terms

| 检查 | 范围 | 怎样算失败 |
| --- | --- | --- |
| 目录和词条 | `src/glossary.json` 的 `toc` 和 `groups[].ids` | TOC 里的 id 没有对应词条，或词条没有进 TOC |
| `<Term k>` | `src/` 下的 `.ts` `.tsx` `.json` `.html` `.js` `.mjs` | `k` 不在名词表 id 里，或一个 `<Term` 都没扫到 |
