import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Run } from '../runs'
import { Term } from './Term'

export function Rich({ runs }: { runs: Run[] }) {
  return <>{runs.map((run, i) => <Piece key={i} run={run} />)}</>
}

function Piece({ run }: { run: Run }): ReactNode {
  if (typeof run === 'string') return run
  if ('br' in run) return <br />
  if ('b' in run) return <b><Rich runs={run.b} /></b>
  if ('code' in run) return <code><Rich runs={run.code} /></code>
  if ('i' in run) return <i><Rich runs={run.i} /></i>
  if ('sub' in run) return <sub><Rich runs={run.sub} /></sub>
  if ('sup' in run) return <sup><Rich runs={run.sup} /></sup>
  if ('en' in run) return <span className="en"><Rich runs={run.en} /></span>
  if ('dot' in run) return <span className="dot"><Rich runs={run.dot} /></span>
  if ('mark' in run) return <span className="sample-term"><Rich runs={run.mark} /></span>
  if ('term' in run) {
    const t = run.term
    return <Term k={t.k} name={t.name} def={t.def}><Rich runs={t.c} /></Term>
  }
  if ('a' in run) return <RichLink href={run.a.href}><Rich runs={run.a.c} /></RichLink>
  if ('p' in run) {
    return <p className={run.p.class || undefined}><Rich runs={run.p.c} /></p>
  }
  if ('div' in run) {
    return <div className={run.div.class || undefined}><Rich runs={run.div.c} /></div>
  }
  return null
}

function RichLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith('/')) return <Link to={href}>{children}</Link>
  if (href.startsWith('#')) return <a href={href}>{children}</a>
  return <a href={href} target="_blank" rel="noopener">{children}</a>
}

export function Inline({ runs }: { runs: Run[] }) {
  return <Fragment>{runs.map((run, i) => <Piece key={i} run={run} />)}</Fragment>
}
