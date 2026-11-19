import type { ReactNode } from 'react'
import { glossaryById } from '../glossary'

/** 名词。气泡文案优先用调用处传来的原文，否则用词条上的 def。 */
export function Term({ k, name, def, children }: {
  k: string
  name?: string
  def?: string
  children: ReactNode
}) {
  const entry = glossaryById[k]
  if (!entry) throw new Error(`名词表没有 #${k}`)
  return (
    <span
      className="term"
      data-key={k}
      data-term={name || entry.titleText}
      data-def={def || entry.def}
    >
      {children}
    </span>
  )
}
