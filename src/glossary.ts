// 名词表。词条 id 与旧 glossary.html 的锚点一一对应。
// 分组顺序、TOC 顺序都照原页面，不按字母重排。

import data from './glossary.json'

export interface GlossaryEntry {
  id: string
  titleHtml: string
  bodyHtml: string
}

export interface GlossaryGroup {
  num: string
  title: string
  entries: GlossaryEntry[]
}

export interface TocItem {
  id: string
  label: string
}

export const glossaryMeta = {
  docTitle: data.docTitle,
  description: data.description,
  shareTitle: data.shareTitle,
  shareDescription: data.shareDescription,
  eyebrow: data.eyebrow,
  h1: data.h1,
  subtitleHtml: data.subtitleHtml,
  footerHtml: data.footerHtml,
}

export const glossaryToc = data.toc as TocItem[]
export const glossaryGroups = data.groups as GlossaryGroup[]

export const glossaryEntries: GlossaryEntry[] = glossaryGroups.flatMap((g) => g.entries)

export const glossaryById: Record<string, GlossaryEntry> = Object.fromEntries(
  glossaryEntries.map((e) => [e.id, e]),
)

export function entryPlain(entry: GlossaryEntry): { title: string; def: string } {
  const title = strip(entry.titleHtml)
  const def = strip(entry.bodyHtml)
  return { title, def }
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
