// 首页卡片和名词表里的行内排版。不是 HTML 字符串，渲染在 Rich.tsx。

export type Run =
  | string
  | { b: Run[] }
  | { code: Run[] }
  | { i: Run[] }
  | { sub: Run[] }
  | { sup: Run[] }
  | { br: true }
  | { a: { href: string; c: Run[] } }
  | { en: Run[] }
  | { dot: Run[] }
  | { mark: Run[] }
  | { p: { class: string; c: Run[] } }
  | { div: { class: string; c: Run[] } }
  | { term: { k: string; name: string; def: string; c: Run[] } }

export function runsToText(runs: Run[]): string {
  let out = ''
  for (const run of runs) {
    if (typeof run === 'string') out += run
    else if ('b' in run) out += runsToText(run.b)
    else if ('code' in run) out += runsToText(run.code)
    else if ('i' in run) out += runsToText(run.i)
    else if ('sub' in run) out += runsToText(run.sub)
    else if ('sup' in run) out += runsToText(run.sup)
    else if ('br' in run) out += '\n'
    else if ('a' in run) out += runsToText(run.a.c)
    else if ('en' in run) out += runsToText(run.en)
    else if ('dot' in run) out += runsToText(run.dot)
    else if ('mark' in run) out += runsToText(run.mark)
    else if ('p' in run) out += runsToText(run.p.c)
    else if ('div' in run) out += runsToText(run.div.c)
    else if ('term' in run) out += runsToText(run.term.c)
  }
  return out.replace(/\s+/g, ' ').trim()
}
