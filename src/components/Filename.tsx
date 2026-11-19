import type { CodeLink } from '../chapters'

export function Filename({ file, links }: { file: string; links: CodeLink[] }) {
  return (
    <>
      <span className="filename">{file}</span>
      {links.map((l) => (
        <a key={l.href} className="filename code-link" href={l.href} target="_blank" rel="noopener">{l.label}</a>
      ))}
    </>
  )
}
