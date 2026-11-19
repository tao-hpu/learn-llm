import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { findChapter, phases } from '../chapters'
import { bindId } from '../scroll'
import { CardDesc, HomeSubtitle, HomeTitle } from './homeText'
import homeCss from './home.css?raw'

export function Home() {
  const secRefs = useRef<(HTMLElement | null)[]>([])
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    function update() {
      const secs = secRefs.current.filter((el): el is HTMLElement => !!el)
      if (!secs.length) return
      let cur = secs[0].id
      secs.forEach((s) => {
        if (s.getBoundingClientRect().top < window.innerHeight * 0.35) cur = s.id
      })
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        cur = secs[secs.length - 1].id
      }
      itemRefs.current.forEach((li) => {
        if (!li) return
        li.classList.toggle('on', li.dataset.phase === cur)
      })
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('hashchange', update)
    update()
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('hashchange', update)
    }
  }, [])

  return (
    <>
      <style>{homeCss}</style>
      <div className="layout">
        <aside className="side">
          <a className="brand" href="#top"><b>LLM from Scratch</b><span>从零手写大语言模型</span></a>
          <ul className="toc">
            {phases.map((phase, i) => (
              <li key={phase.id} data-phase={phase.id} ref={(el) => { itemRefs.current[i] = el }}>
                <a className="ph" href={`#${phase.id}`}>{phase.tocLabel}</a>
                <ol>
                  {phase.slugs.map((slug) => {
                    const c = findChapter(slug)
                    if (!c) return null
                    const anchor = c.steps[0]?.anchor ?? 'step-1'
                    return (
                      <li key={slug}>
                        <Link to={`/ch/${slug}#${anchor}`}><i>{c.num}</i>{c.sidebar}</Link>
                      </li>
                    )
                  })}
                </ol>
              </li>
            ))}
          </ul>
          <nav className="side-links">
            <Link to="/glossary">📖 名词表</Link>
            <Link to="/notes">🥚 学习札记</Link>
            <Link to="/about">关于本项目</Link>
            <a href="https://github.com/tao-hpu/llm-from-scratch" target="_blank" rel="noopener">GitHub ↗</a>
          </nav>
        </aside>

        <main className="main" id="top" ref={bindId('top')}>
          <header>
            <h1><HomeTitle /></h1>
            <p className="subtitle"><HomeSubtitle /></p>
            <div className="cta">
              <Link to="/ch/bigram#step-1">从第 1 章开始 →</Link>
              <Link to="/glossary">📖 名词表</Link>
              <a className="star" href="https://github.com/tao-hpu/llm-from-scratch" target="_blank" rel="noopener">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg>
                {' '}在 GitHub 上点个 Star
              </a>
            </div>
          </header>

          {phases.map((phase, i) => (
            <section
              className="phase-sec"
              id={phase.id}
              key={phase.id}
              ref={(el) => { secRefs.current[i] = el; bindId(phase.id)(el) }}
            >
              <div className="phase-title">
                <span className="pt-num">{phase.kicker}</span>
                <h2>{phase.title}</h2>
                <span className="pt-count">{phase.count}</span>
              </div>
              <div className="chapters">
                {phase.slugs.map((slug) => {
                  const c = findChapter(slug)
                  if (!c) return null
                  const first = c.steps[0]?.anchor ?? 'step-1'
                  return (
                    <article className="card" id={c.cardId} key={slug} ref={bindId(c.cardId)}>
                      <span className="ch-num">CHAPTER {c.num}</span>
                      <h3><Link to={`/ch/${slug}#${first}`}>{c.cardTitle}</Link></h3>
                      <p className="desc"><CardDesc slug={c.slug} /></p>
                      <div className="card-foot">
                        <details>
                          <summary>{c.stepSummary}</summary>
                          <ul className="steps">
                            {c.steps.map((s) => (
                              <li key={s.anchor}>
                                <Link to={`/ch/${slug}#${s.anchor}`}>
                                  <span className="sn">{s.sn}</span>
                                  <span className="st">{s.card}</span>
                                  <span className="arrow">→</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                        {c.colab && (
                          <a className="colab" href={c.colab} target="_blank" rel="noopener" title="在 Colab 里跑这一章的代码">▶ Colab</a>
                        )}
                        <Link className="go" to={`/ch/${slug}#${first}`}>{c.goLabel}</Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}

          <footer>
            © 2026 <a href="https://fim.ai" target="_blank" rel="noopener">FIM Labs</a> · 从零手写大语言模型 · MIT License · <Link to="/about">关于本项目</Link>
          </footer>
        </main>
      </div>
    </>
  )
}
