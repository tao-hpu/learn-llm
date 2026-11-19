import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { HomeLink } from '../components/HomeLink'
import glossaryCss from '../content/glossary.css?raw'
import { glossaryGroups, glossaryMeta, glossaryToc } from '../glossary'

export function GlossaryPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    document.getElementById(id)?.scrollIntoView()
  }, [hash])

  return (
    <>
      <style>{glossaryCss}</style>
      <div className="wrap">
        <HomeLink />
        <header>
          <span className="eyebrow">{glossaryMeta.eyebrow}</span>
          <h1>{glossaryMeta.h1}</h1>
          <p className="subtitle" dangerouslySetInnerHTML={{ __html: glossaryMeta.subtitleHtml }} />
        </header>
        <div className="toc">
          {glossaryToc.map((item) => (
            <a key={item.id} href={`#${item.id}`}>{item.label}</a>
          ))}
        </div>
        {glossaryGroups.map((group) => (
          <section key={group.num + group.title}>
            <div className="sec-h"><span className="sh-num">{group.num}</span>{group.title}</div>
            {group.entries.map((entry) => (
              <div className="gentry" id={entry.id} key={entry.id}>
                <h3 dangerouslySetInnerHTML={{ __html: entry.titleHtml }} />
                <div dangerouslySetInnerHTML={{ __html: entry.bodyHtml }} />
              </div>
            ))}
          </section>
        ))}
        <footer dangerouslySetInnerHTML={{ __html: glossaryMeta.footerHtml }} />
      </div>
    </>
  )
}
