import { Link } from 'react-router-dom'
import { HomeLink } from '../components/HomeLink'
import { Rich } from '../components/Rich'
import { glossaryGroups, glossaryMeta, glossaryToc } from '../glossary'
import { bindId } from '../scroll'
import glossaryCss from './glossary.css?raw'

export function GlossaryPage() {
  return (
    <>
      <style>{glossaryCss}</style>
      <div className="wrap">
        <HomeLink />
        <header>
          <span className="eyebrow">{glossaryMeta.eyebrow}</span>
          <h1>{glossaryMeta.h1}</h1>
          <p className="subtitle"><Rich runs={glossaryMeta.subtitle} /></p>
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
              <div className="gentry" id={entry.id} key={entry.id} ref={bindId(entry.id)}>
                <h3><Rich runs={entry.title} /></h3>
                <Rich runs={entry.body} />
              </div>
            ))}
          </section>
        ))}
        <footer>
          名词表会随章节增加而扩充。回到 <Link to="/">首页</Link> · 或继续
          {' '}<Link to="/ch/bigram#step-1">第 1 章</Link> /
          {' '}<Link to="/ch/attention#step-1">第 2 章</Link> /
          {' '}<Link to="/ch/transformer#step-1">第 3 章</Link>。
          <div className="glossary-copy">
            © 2026 <a href="https://fim.ai" target="_blank" rel="noopener">FIM Labs</a> · 从零手写大语言模型 · MIT License
          </div>
        </footer>
      </div>
    </>
  )
}
