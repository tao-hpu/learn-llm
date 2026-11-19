import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { glossaryEntries } from '../glossary'

/**
 * 正文和 def 应是同一段话。旧站名词表里对不上的条目留在白名单，
 * 不在这里改文案。名单和出处见 docs/migration-notes.md。
 */
const allow = new Set<string>([])

function plain(node: ReactNode) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, node))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('名词表 def', () => {
  it('每条正文去掉标签后和 def 一致，白名单除外', () => {
    const bad = glossaryEntries
      .filter((entry) => !allow.has(entry.id))
      .map((entry) => ({ id: entry.id, got: plain(entry.body), def: entry.def }))
      .filter((row) => row.got !== row.def)
    expect(bad).toEqual([])
  })
})
