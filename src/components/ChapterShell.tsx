import { useEffect, useRef, useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { Filename } from './Filename'
import { HomeLink } from './HomeLink'
import { SiteFooter } from './SiteFooter'

const COLORS = ['#D97757', '#E8B04B', '#6FAE8F', '#5B8DEF', '#D98AC0', '#1A1A18']

export interface ShellStep {
  /** 页内 tab 上的短标题，与 catalog 的 steps[].nav 一致。 */
  title: string
  panel: ReactNode
}

/**
 * 章节外壳：分步导航、#step-N / #part-N、上一步 / 下一步、
 * 最后一步「完成 🎉」、通关横幅和 confetti。各章只交步骤。
 */
export function ChapterShell({ slug, title, subtitle, hp, steps, congrats }: {
  slug: string
  title: ReactNode
  subtitle: ReactNode
  hp: ReactNode
  steps: ShellStep[]
  congrats: ReactNode
}) {
  const chapter = findChapter(slug)
  const count = steps.length
  const [index, setIndex] = useState(() => initialIndex(chapter?.hashKind ?? 'step', count))
  const [done, setDone] = useState(false)
  const [burst, setBurst] = useState(0)
  const bannerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skipScroll = useRef(true)

  useEffect(() => {
    const kind = chapter?.hashKind ?? 'step'
    const hash = `#${kind}-${index + 1}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [index, chapter?.hashKind])

  useEffect(() => {
    const kind = chapter?.hashKind ?? 'step'
    function onHash() {
      const next = initialIndex(kind, count)
      setIndex(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [chapter?.hashKind, count])

  useEffect(() => {
    if (!done) return
    bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [done])

  useEffect(() => {
    if (!burst) return
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    cv.width = window.innerWidth
    cv.height = window.innerHeight
    cv.style.display = 'block'
    const parts = Array.from({ length: 140 }, (_, i) => ({
      x: Math.random() * cv.width,
      y: -20 - Math.random() * cv.height * 0.4,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      s: 5 + Math.random() * 7,
      c: COLORS[i % COLORS.length],
      a: Math.random() * 6.28,
      va: (Math.random() - 0.5) * 0.3,
    }))
    let raf = 0
    let t0 = 0
    const frame = (ts: number) => {
      if (!t0) t0 = ts
      const elapsed = ts - t0
      ctx.clearRect(0, 0, cv.width, cv.height)
      parts.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.04
        p.a += p.va
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.a)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6)
        ctx.restore()
      })
      if (elapsed < 3200) raf = requestAnimationFrame(frame)
      else {
        ctx.clearRect(0, 0, cv.width, cv.height)
        cv.style.display = 'none'
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      cv.style.display = 'none'
    }
  }, [burst])

  if (!chapter) return null
  const last = index === count - 1
  const navClass = chapter.stepsClass

  function finish() {
    setDone(true)
    setBurst((n) => n + 1)
  }

  return (
    <>
      <div className="wrap">
        <HomeLink />
        <header>
          <Filename file={chapter.file} links={chapter.codeLinks} />
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </header>
        <div className={navClass}>
          {steps.map((step, i) => (
            <button
              key={chapter.steps[i]?.anchor ?? i}
              type="button"
              className={i === index ? 'step-tab active' : 'step-tab'}
              onClick={() => setIndex(i)}
            >
              <div className="num">{chapter.steps[i]?.sn ?? `STEP ${i + 1}`}</div>
              <div className="label">{step.title}</div>
            </button>
          ))}
        </div>
        {hp}
        <section className="panel active" id={`panel${index}`}>
          {steps[index]?.panel}
          {last && (
            <div ref={bannerRef} className={done ? 'congrats show' : 'congrats'}>{congrats}</div>
          )}
        </section>
        <div className="nav">
          <button type="button" id="prevBtn" className={chapter.prevClass} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>← 上一步</button>
          <button type="button" id="nextBtn" className="btn primary" onClick={() => { if (last) finish(); else setIndex((i) => Math.min(count - 1, i + 1)) }}>
            {last ? '完成 🎉' : '下一步 →'}
          </button>
        </div>
      </div>
      <canvas id="confetti" ref={canvasRef} />
      <SiteFooter />
    </>
  )
}

function initialIndex(kind: string, count: number) {
  const m = new RegExp(`^#${kind}-(\\d+)$`).exec(window.location.hash)
  if (!m) return 0
  const n = Number(m[1]) - 1
  return n >= 0 && n < count ? n : 0
}
