// 全站章节清单。首页卡片、左侧目录、步骤导航、分享卡都从这里读。
// 数据在 catalog.json（scripts/extract_html.py 从旧站抽出）。
// 页内 tab 文案是 steps[].nav，首页卡片上的步骤文案是 steps[].card。
// 两边用词不一样，所以分两个字段，不合成一句。

import catalog from './catalog.json'

export interface StepLink {
  sn: string
  card: string
  nav: string
  anchor: string
}

export interface CodeLink {
  href: string
  label: string
  kind: 'source' | 'colab'
}

export interface Chapter {
  num: string
  slug: string
  file: string
  cardId: string
  cardTitle: string
  sidebar: string
  cardDescHtml: string
  stepSummary: string
  goLabel: string
  colab: string | null
  /** 旧仓里的 .py 路径。没有配套脚本的章为 null。 */
  source: string | null
  codeLinks: CodeLink[]
  docTitle: string
  shareTitle: string
  description: string
  h1Html: string
  subtitleHtml: string
  steps: StepLink[]
  hashKind: 'step' | 'part'
  stepsClass: string
  prevClass: string
  confetti: boolean
  /** 这一批有没有把交互页迁进来。 */
  ready: boolean
}

export interface Phase {
  id: string
  kicker: string
  title: string
  count: string
  tocLabel: string
  slugs: string[]
}

export const site = catalog.site
export const home = catalog.home
export const phases = catalog.phases as Phase[]
export const chapters = catalog.chapters as Chapter[]

export const chapterPath = (c: Chapter) => `/ch/${c.slug}`

export function findChapter(slug: string): Chapter | undefined {
  return chapters.find((c) => c.slug === slug)
}

export function neighbors(slug: string): { prev?: Chapter; next?: Chapter } {
  const i = chapters.findIndex((c) => c.slug === slug)
  return {
    prev: i > 0 ? chapters[i - 1] : undefined,
    next: i >= 0 && i < chapters.length - 1 ? chapters[i + 1] : undefined,
  }
}
