import type { ReactNode } from 'react'

/** 英文括注。对应旧名词表里的 span.en。 */
export function En({ children }: { children: ReactNode }) {
  return <span className="en">{children}</span>
}

/** 标题里的间隔点。 */
export function Dot({ children }: { children: ReactNode }) {
  return <span className="dot">{children}</span>
}

/** 正文里用来示意「可点名词」的样子。 */
export function Mark({ children }: { children: ReactNode }) {
  return <span className="sample-term">{children}</span>
}
