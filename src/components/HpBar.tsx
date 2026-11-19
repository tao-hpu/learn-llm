import type { ReactNode } from 'react'

/** 超参速查条。各章只填芯片，条的样式在 site.css。 */
export function HpBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hp-bar">
      <span className="hp-label">{label}</span>
      {children}
    </div>
  )
}

export function HpChip({ color, bg, children }: { color: string; bg: string; children: ReactNode }) {
  return <span className="hp-chip" style={{ color, background: bg }}>{children}</span>
}
