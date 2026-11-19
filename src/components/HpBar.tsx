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

/** color / bg 保留在签名里以兼容各章调用；全站统一为单色，不再按芯片上色。 */
export function HpChip({ children }: { color?: string; bg?: string; children: ReactNode }) {
  return <span className="hp-chip">{children}</span>
}
