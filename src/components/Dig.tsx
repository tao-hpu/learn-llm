import type { ReactNode } from 'react'

/** 折叠答疑。标题和正文由各章传入。 */
export function Dig({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details className="dig">
      <summary>{title}</summary>
      <div className="dig-body">{children}</div>
    </details>
  )
}
