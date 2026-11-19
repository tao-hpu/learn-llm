import type { CodeLink } from '../chapters'

export function Filename({ links }: { links: CodeLink[] }) {
  if (!links.length) return null
  return (
    <div className="code-links">
      {links.map((l) => (
        <a key={l.href} className="code-link" href={l.href} target="_blank" rel="noopener">{l.label}</a>
      ))}
    </div>
  )
}
