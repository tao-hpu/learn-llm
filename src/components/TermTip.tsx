import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type Tip = { name: string; def: string; key: string; left: number; top: number; show: boolean }

/**
 * 全站一份气泡。鼠标移上 .term 就弹出。
 * 点在名词上时也弹出，并拦住冒泡，外层卡片不会跟着响应。
 * 点在名词里的链接上时不拦截，站内 Link 和外部链接照常跳转。
 */
export function TermTip() {
  const tipRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLElement | null>(null)
  const hideTimer = useRef(0)
  const [tip, setTip] = useState<Tip | null>(null)

  useLayoutEffect(() => {
    const el = anchor.current
    const node = tipRef.current
    if (!tip?.show || !el || !node) return
    const r = el.getBoundingClientRect()
    const tw = node.offsetWidth
    const th = node.offsetHeight
    let left = r.left
    let top = r.top - th - 8
    if (top < 8) top = r.bottom + 8
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - 8 - tw
    if (left < 8) left = 8
    if (Math.abs(left - tip.left) > 0.5 || Math.abs(top - tip.top) > 0.5) {
      setTip({ ...tip, left, top })
    }
  }, [tip])

  useEffect(() => {
    function show(el: HTMLElement) {
      window.clearTimeout(hideTimer.current)
      anchor.current = el
      setTip({
        name: el.dataset.term || el.textContent || '',
        def: el.dataset.def || '',
        key: el.dataset.key || '',
        left: 0,
        top: 0,
        show: true,
      })
    }
    function hideSoon() {
      hideTimer.current = window.setTimeout(() => {
        setTip((cur) => (cur ? { ...cur, show: false } : cur))
      }, 140)
    }
    function onOver(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Node)) return
      if (tipRef.current?.contains(t)) {
        window.clearTimeout(hideTimer.current)
        return
      }
      const el = t instanceof Element ? t.closest('.term') : null
      if (el instanceof HTMLElement) show(el)
    }
    function onOut(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Node)) return
      const next = e.relatedTarget
      const inTip = next instanceof Node && !!tipRef.current?.contains(next)
      const inTerm = next instanceof Node && t instanceof Element && !!t.closest('.term')?.contains(next)
      if (inTip || inTerm) return
      if (tipRef.current?.contains(t) || (t instanceof Element && t.closest('.term'))) hideSoon()
    }
    function onClickCapture(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Element)) return
      const term = t.closest('.term')
      if (!(term instanceof HTMLElement)) return
      const link = t.closest('a')
      if (link && term.contains(link)) return
      e.stopPropagation()
      show(term)
    }
    function onClick(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Element)) {
        setTip((cur) => (cur ? { ...cur, show: false } : cur))
        return
      }
      if (t.closest('.term') || tipRef.current?.contains(t)) return
      setTip((cur) => (cur ? { ...cur, show: false } : cur))
    }
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('click', onClickCapture, true)
    document.addEventListener('click', onClick)
    return () => {
      window.clearTimeout(hideTimer.current)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('click', onClickCapture, true)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return (
    <div
      id="termTip"
      ref={tipRef}
      className={tip?.show ? 'show' : undefined}
      style={{ left: tip?.left ?? -9999, top: tip?.top ?? 0 }}
      onMouseEnter={() => window.clearTimeout(hideTimer.current)}
      onMouseLeave={() => {
        hideTimer.current = window.setTimeout(() => {
          setTip((cur) => (cur ? { ...cur, show: false } : cur))
        }, 140)
      }}
    >
      {tip && (
        <>
          <div className="tt-name">{tip.name}</div>
          {tip.def}
          {tip.key && <Link className="tt-more" to={`/glossary#${tip.key}`}>更多 → 名词表 ↗</Link>}
        </>
      )}
    </div>
  )
}
