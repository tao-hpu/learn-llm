// 把文案里的 Term 标记换成气泡用的 span。
// 静态 HTML 和脚本拼出来的字符串走同一条，所以后插入的句子也能弹出气泡。
// name / def 有则用原文（各页 data-def 并不等于名词表正文）；没有则回名词表。

import { entryPlain, glossaryById } from '../glossary'

const TAG = /<Term\b((?:[^>"']|"[^"]*"|'[^']*')*)>((?:(?!<Term\b)[\s\S])*?)<\/Term>/g

function attr(raw: string, name: string): string | undefined {
  const m = raw.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`))
    ?? raw.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`))
  return m ? decode(m[1]) : undefined
}

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function encode(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function expandTerms(html: string): string {
  let out = html
  let guard = 0
  while (out.includes('<Term')) {
    if (++guard > 20) throw new Error('Term 嵌套超过 20 层')
    if (!TAG.test(out)) break
    TAG.lastIndex = 0
    out = out.replace(TAG, (_all, attrs: string, inner: string) => {
      const k = attr(attrs, 'k')
      if (!k) throw new Error('Term 缺少 k')
      const entry = glossaryById[k]
      if (!entry) throw new Error(`名词表没有 #${k}`)
      const plain = entryPlain(entry)
      const name = attr(attrs, 'name') || plain.title
      const def = attr(attrs, 'def') || plain.def
      return `<span class="term" data-key="${encode(k)}" data-term="${encode(name)}" data-def="${encode(def)}">${inner}</span>`
    })
  }
  return out
}
