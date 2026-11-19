// 预渲染冒烟：每个路由都能在 Node 里渲染出正文，且两次输出一致（构建可复现）。
import { describe, expect, it } from 'vitest'
import { render } from '../entry-server'
import catalog from '../catalog.json'

const routes = ['/', '/glossary', '/notes', '/about', ...catalog.chapters.map((c: { slug: string }) => `/ch/${c.slug}`)]

describe('prerender', () => {
  it.each(routes)('%s 渲染出正文且可复现', (route) => {
    const a = render(route)
    expect(a.length).toBeGreaterThan(2000)
    expect(a).toContain('<h1')
    expect(render(route)).toBe(a)
  })
})
