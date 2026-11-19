// 名词表。词条 id 与旧 glossary.html 的锚点一一对应。
// 分组顺序、TOC 顺序都照原页面。正文在 src/glossary/*.tsx，这里只接目录。

import data from './glossary.json'
import { entriesByGroup } from './glossary/index'
import type { GlossaryEntry } from './glossary/types'

export type { GlossaryEntry }

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
}

export const glossaryToc = data.toc as TocItem[]

export const glossaryGroups: GlossaryGroup[] = data.groups.map((group) => {
  const list = entriesByGroup[group.num]
  if (!list) throw new Error(`名词表缺少分组 ${group.num}`)
  const byId = new Map(list.map((entry) => [entry.id, entry]))
  const entries = group.ids.map((id) => {
    const entry = byId.get(id)
    if (!entry) throw new Error(`分组 ${group.num} 缺少词条 ${id}`)
    return entry
  })
  if (entries.length !== list.length) {
    throw new Error(`分组 ${group.num} 的词条数量和目录不一致`)
  }
  return { num: group.num, title: group.title, entries }
})

export const glossaryEntries: GlossaryEntry[] = glossaryGroups.flatMap((g) => g.entries)

export const glossaryById: Record<string, GlossaryEntry> = Object.fromEntries(
  glossaryEntries.map((e) => [e.id, e]),
)
