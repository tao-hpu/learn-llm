import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandTerms } from '../lib/expandTerms'
import { glossaryById, glossaryEntries, glossaryToc } from '../glossary'

const root = join(import.meta.dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|json)$/.test(name)) out.push(p)
  }
  return out
}

describe('名词表', () => {
  it('每条 TOC 都有词条，每条词条都在 TOC 里', () => {
    const ids = new Set(glossaryEntries.map((e) => e.id))
    for (const item of glossaryToc) expect(ids.has(item.id), item.id).toBe(true)
    const toc = new Set(glossaryToc.map((t) => t.id))
    for (const id of ids) expect(toc.has(id), id).toBe(true)
  })

  it('源码里的 Term k 都能查到', () => {
    const re = /<Term\b[^>]*?\bk=\\?"([A-Za-z0-9_-]+)\\?"/g
    const missing: string[] = []
    for (const file of walk(root)) {
      if (file.includes('__tests__')) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(re)) {
        if (!glossaryById[m[1]]) missing.push(`${m[1]} @ ${file}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('expandTerms 用原文 def，缺 def 时回名词表，动态字符串也能展开', () => {
    const html = expandTerms('<Term k="ppo">PPO</Term>')
    expect(html).toContain('data-key="ppo"')
    expect(html).toContain('>PPO</span>')
    expect(html).toContain('data-def="')
    const custom = expandTerms('<Term k="ppo" name="近端" def="一句定义">PPO</Term>')
    expect(custom).toContain('data-term="近端"')
    expect(custom).toContain('data-def="一句定义"')
  })
})
