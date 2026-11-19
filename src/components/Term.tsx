import type { MouseEvent, ReactNode } from 'react'
import { entryPlain, glossaryById } from '../glossary'

/** 名词气泡。定义优先用调用处传来的原文，否则用名词表。点击不向外冒泡。 */
export function Term({ k, name, def, children }: {
  k: string
  name?: string
  def?: string
  children: ReactNode
}) {
  const entry = glossaryById[k]
  if (!entry) throw new Error(`名词表没有 #${k}`)
  const plain = entryPlain(entry)
  function stop(e: MouseEvent) {
    e.stopPropagation()
  }
  return (
    <span
      className="term"
      data-key={k}
      data-term={name || plain.title}
      data-def={def || plain.def}
      onClick={stop}
      onMouseDown={stop}
    >
      {children}
    </span>
  )
}
