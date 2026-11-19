import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { findChapter, phases } from '../chapters'
import { bindContent, contentScroller, registeredNodes, scrollContentToTop } from '../scroll'

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { pathname, hash } = useLocation()
  const [phaseOn, setPhaseOn] = useState('')

  useEffect(() => {
    if (pathname !== '/') return
    const scroller = contentScroller()
    if (!scroller) return
    const box = scroller
    function update() {
      const secs = registeredNodes().filter((el) => el.classList.contains('phase-sec'))
      if (!secs.length) return
      let cur = secs[0].id
      const top = box.getBoundingClientRect().top
      secs.forEach((s) => {
        if (s.getBoundingClientRect().top - top < box.clientHeight * 0.35) cur = s.id
      })
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) {
        cur = secs[secs.length - 1].id
      }
      setPhaseOn(cur)
    }
    update()
    box.addEventListener('scroll', update, { passive: true })
    return () => box.removeEventListener('scroll', update)
  }, [pathname])

  return (
    <nav className="sidebar" aria-label="全书导航">
      <Link to="/" className={`side-home ${pathname === '/' ? 'is-active' : ''}`} onClick={onNavigate}>
        目录首页
      </Link>
      {phases.map((phase) => (
        <div className="side-part" key={phase.id}>
          <Link
            to={`/#${phase.id}`}
            className={`side-part-name ${pathname === '/' && (phaseOn === phase.id || hash === `#${phase.id}`) ? 'is-active' : ''}`}
            onClick={onNavigate}
          >
            {phase.tocLabel}
          </Link>
          <ul>
            {phase.slugs.map((slug) => {
              const chapter = findChapter(slug)
              if (!chapter) return null
              const anchor = chapter.steps[0]?.anchor ?? 'step-1'
              const active = pathname === `/ch/${slug}`
              return (
                <li key={slug}>
                  <NavLink to={`/ch/${slug}#${anchor}`} onClick={onNavigate} className={`side-link ${active ? 'is-active' : ''}`}>
                    <span className="side-num">{chapter.num}</span>
                    <span className="side-title">{chapter.sidebar}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div className="side-extra">
        <Link to="/glossary" onClick={onNavigate}>名词表</Link>
      </div>
    </nav>
  )
}

export function Layout() {
  const { pathname, hash } = useLocation()
  const [open, setOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 960 : true))

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)')
    const onChange = () => {
      if (mq.matches) setOpen(false)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const id = hash.startsWith('#') ? hash.slice(1) : ''
    if (id && !/^(step|part)-\d+$/.test(id)) return
    scrollContentToTop('auto')
  }, [pathname, hash])

  function closeIfNarrow() {
    if (typeof window !== 'undefined' && window.innerWidth <= 960) setOpen(false)
  }

  return (
    <div className={`shell ${open ? 'nav-open' : 'nav-closed'}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button type="button" className="nav-toggle" onClick={() => setOpen((v) => !v)} aria-label="切换侧栏" aria-expanded={open}>
            {open ? '✕' : '☰'}
          </button>
          <Link to="/" className="wordmark">
            从零手写<span className="wordmark-em">大语言模型</span>
          </Link>
        </div>
        <nav className="topnav">
          <NavLink to="/glossary" className={({ isActive }) => (isActive ? 'active' : '')}>名词表</NavLink>
          <a className="star-link" href="https://github.com/tao-hpu/llm-from-scratch" target="_blank" rel="noopener">★ GitHub</a>
        </nav>
      </header>
      <div className="body">
        {open && <Sidebar onNavigate={closeIfNarrow} />}
        {open && <div className="nav-scrim" onClick={() => setOpen(false)} />}
        <main className="content" ref={bindContent}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
