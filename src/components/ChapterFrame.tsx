import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { findChapter } from '../chapters'
import type { ChapterSpec } from '../content/specs'
import { expandTerms } from '../lib/expandTerms'
import { Filename } from './Filename'
import { HomeLink } from './HomeLink'
import { HpBar } from './HpBar'
import { SiteFooter } from './SiteFooter'
import { StepButtons } from './StepButtons'
import { StepNav } from './StepNav'

export const ChapterFrame = memo(function ChapterFrame({ spec }: { spec: ChapterSpec }) {
  const chapter = findChapter(spec.slug)
  const rootRef = useRef<HTMLDivElement>(null)
  const h1 = useMemo(() => expandTerms(chapter?.h1Html ?? ''), [chapter])
  const subtitle = useMemo(() => expandTerms(chapter?.subtitleHtml ?? ''), [chapter])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    return spec.boot(root)
  }, [spec])

  if (!chapter) return null

  return (
    <>
      <style>{spec.css}</style>
      <div ref={rootRef}>
        <div className="wrap">
          <HomeLink />
          <header>
            <Filename file={chapter.file} links={chapter.codeLinks} />
            <h1 dangerouslySetInnerHTML={{ __html: h1 }} />
            <p className="subtitle" dangerouslySetInnerHTML={{ __html: subtitle }} />
          </header>
          <StepNav chapter={chapter} />
          <HpBar html={spec.hpHtml} />
          <div className="shell-slot" dangerouslySetInnerHTML={{ __html: spec.panelsHtml }} />
          <StepButtons prevClass={chapter.prevClass} />
        </div>
        {chapter.confetti && (
          <div className="shell-slot" dangerouslySetInnerHTML={{ __html: '<canvas id="confetti"></canvas>' }} />
        )}
        <SiteFooter />
      </div>
    </>
  )
})
