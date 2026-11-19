import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { findChapter } from '../chapters'
import { scrollContentToTop } from '../scroll'
import { Filename } from './Filename'
import { SiteFooter } from './SiteFooter'

const COLORS = ['#D97757', '#E8B04B', '#6FAE8F', '#5B8DEF', '#D98AC0', '#1A1A18']

/** 当前面板是不是正在看的这一步。动画用它决定要不要播放。 */
const StepLiveContext = createContext(false)

export function useStepLive() {
  return useContext(StepLiveContext)
}

export interface ShellStep {
  /** 页内 tab 上的短标题，与 catalog 的 steps[].nav 一致。 */
  title: string
  panel: ReactNode
}

/**
 * 章节外壳：分步导航、#step-N / #part-N、上一步 / 下一步、
 * 最后一步「完成 🎉」、通关横幅和 confetti。各章只交步骤。
 * 每一步都留在树上，离开时只去掉 active。
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
  const kind = chapter?.hashKind ?? 'step'
  const [index, setIndex] = useState(() => clampIndex(window.location.hash, kind, count))
  const [done, setDone] = useState(false)
  const [burst, setBurst] = useState(0)
  const [enterId, setEnterId] = useState<number | null>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skipScroll = useRef(true)
  const playedEnter = useRef(new Set<number>())

  useEffect(() => {
    writeHash(kind, index)
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    scrollContentToTop('smooth')
  }, [index, kind])

  useEffect(() => {
    if (playedEnter.current.has(index)) {
      setEnterId(null)
      return
    }
    playedEnter.current.add(index)
    setEnterId(index)
    const timer = window.setTimeout(() => {
      setEnterId((cur) => (cur === index ? null : cur))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [index])

  useEffect(() => {
    function onHash() {
      const next = clampIndex(window.location.hash, kind, count)
      writeHash(kind, next)
      setIndex(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [kind, count])

  useEffect(() => {
    if (!burst) return
    bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [burst])

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
        <header>
          <Filename links={chapter.codeLinks} />
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
        {steps.map((step, i) => (
          <section
            key={chapter.steps[i]?.anchor ?? i}
            id={`panel${i}`}
            className={['panel', i === index ? 'active' : '', i === enterId ? 'enter' : ''].filter(Boolean).join(' ')}
          >
            <StepLiveContext.Provider value={i === index}>
              {step.panel}
            </StepLiveContext.Provider>
            {i === count - 1 && (
              <div ref={bannerRef} className={done ? 'congrats show' : 'congrats'}>{congrats}</div>
            )}
          </section>
        ))}
        <div className="nav">
          <button type="button" id="prevBtn" className={chapter.prevClass} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>{chapter.navPrev ?? '← 上一步'}</button>
          <button type="button" id="nextBtn" className="btn primary" onClick={() => { if (last) finish(); else setIndex((i) => Math.min(count - 1, i + 1)) }}>
            {last ? '完成 🎉' : (chapter.navNext ?? '下一步 →')}
          </button>
        </div>
      </div>
      <canvas id="confetti" ref={canvasRef} />
      <SiteFooter />
    </>
  )
}

function writeHash(kind: string, index: number) {
  const hash = `#${kind}-${index + 1}`
  if (window.location.hash !== hash) {
    window.history.replaceState(window.history.state, '', hash)
  }
}

/** 超出范围夹到最近的有效步。对不上 #kind-N 的 hash 归到第 1 步。 */
function clampIndex(hash: string, kind: string, count: number) {
  if (count <= 0) return 0
  const m = new RegExp(`^#${kind}-(\\d+)$`).exec(hash)
  if (!m) return 0
  const n = Number(m[1]) - 1
  if (n < 0) return 0
  if (n >= count) return count - 1
  return n
}
