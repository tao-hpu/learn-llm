import type { ReactNode } from 'react'

/** 折叠答疑。章节正文里的 <details class="dig"> 是同一份结构。 */
export function Dig({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="dig">
      <summary>{title}</summary>
      <div className="dig-body">{children}</div>
    </details>
  )
}
