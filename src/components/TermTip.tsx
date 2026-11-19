import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 全站一份气泡。用事件委托，所以脚本后来 innerHTML 插进去的 .term 也能弹。
 * 点「更多」走站内路由，hash 会落到名词表对应词条。
 */
export function TermTip() {
  const navigate = useNavigate()

  useEffect(() => {
    const tip = document.createElement('div')
    tip.id = 'termTip'
    document.body.appendChild(tip)
    let hideTimer = 0

    function show(el: HTMLElement) {
      window.clearTimeout(hideTimer)
      const name = el.dataset.term || el.textContent || ''
      const def = el.dataset.def || ''
      const key = el.dataset.key
      tip.innerHTML = '<div class="tt-name"></div>'
      tip.querySelector('.tt-name')!.textContent = name
      tip.append(document.createTextNode(def))
      if (key) {
        const a = document.createElement('a')
        a.className = 'tt-more'
        a.href = `/glossary#${key}`
        a.textContent = '更多 → 名词表 ↗'
        tip.append(a)
      }
      tip.classList.add('show')
      const r = el.getBoundingClientRect()
      const tw = tip.offsetWidth
      const th = tip.offsetHeight
      let left = r.left
      let top = r.top - th - 8
      if (top < 8) top = r.bottom + 8
      if (left + tw > window.innerWidth - 8) left = window.innerWidth - 8 - tw
      if (left < 8) left = 8
      tip.style.left = left + 'px'
      tip.style.top = top + 'px'
    }

    function hide() {
      hideTimer = window.setTimeout(() => tip.classList.remove('show'), 140)
    }

    function onOver(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Node)) return
      if (tip.contains(t)) {
        window.clearTimeout(hideTimer)
        return
      }
      const el = t instanceof Element ? t.closest('.term') : null
      if (el instanceof HTMLElement) show(el)
    }

    function onOut(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Node)) return
      const next = e.relatedTarget
      if (next instanceof Node && (tip.contains(next) || (t instanceof Element && t.closest('.term')?.contains(next)))) return
      if (tip.contains(t) || (t instanceof Element && t.closest('.term'))) hide()
    }

    function onClick(e: MouseEvent) {
      const t = e.target
      if (!(t instanceof Element)) {
        tip.classList.remove('show')
        return
      }
      const more = t.closest('a.tt-more')
      if (more instanceof HTMLAnchorElement) {
        const url = new URL(more.href)
        if (url.origin === location.origin) {
          e.preventDefault()
          navigate(url.pathname + url.hash)
        }
        return
      }
      const term = t.closest('.term')
      if (term instanceof HTMLElement) {
        e.stopPropagation()
        show(term)
        return
      }
      tip.classList.remove('show')
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('click', onClick)
      tip.remove()
    }
  }, [navigate])

  return null
}
