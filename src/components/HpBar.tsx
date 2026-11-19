/** 超参速查条。内容各章不同，壳只写这一份。 */
export function HpBar({ html }: { html: string }) {
  return <div className="shell-slot" dangerouslySetInnerHTML={{ __html: `<div class="hp-bar">${html}</div>` }} />
}
