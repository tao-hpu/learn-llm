import type { Chapter } from '../chapters'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 分步导航。active 由章节脚本用 classList 改，所以这里把 DOM 交出去，
 * React 不再持有每个 tab 的 className，避免一次重绘把高亮打回第一步。
 */
export function StepNav({ chapter }: { chapter: Chapter }) {
  const tabs = chapter.steps.map((s, i) => {
    const active = i === 0 ? ' active' : ''
    return `<div class="step-tab${active}" data-step="${i}"><div class="num">${esc(s.sn)}</div><div class="label">${esc(s.nav)}</div></div>`
  }).join('')
  const html = `<div class="${chapter.stepsClass}">${tabs}</div>`
  return <div className="shell-slot" dangerouslySetInnerHTML={{ __html: html }} />
}
