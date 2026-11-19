// 名词表。词条 id 与旧 glossary.html 的锚点一一对应。
// 分组顺序、TOC 顺序都照原页面，不按字母重排。正文在新仓里手工维护。

import data from './glossary.json'
import { runsToText, type Run } from './runs'

export interface GlossaryEntry {
  id: string
  title: Run[]
  body: Run[]
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
  subtitle: data.subtitle as Run[],
}

export const glossaryToc = data.toc as TocItem[]
export const glossaryGroups = data.groups as GlossaryGroup[]

export const glossaryEntries: GlossaryEntry[] = glossaryGroups.flatMap((g) => g.entries)

export const glossaryById: Record<string, GlossaryEntry> = Object.fromEntries(
  glossaryEntries.map((e) => [e.id, e]),
)

export function entryPlain(entry: GlossaryEntry): { title: string; def: string } {
  return { title: runsToText(entry.title), def: runsToText(entry.body) }
}
