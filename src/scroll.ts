const nodes = new Map<string, HTMLElement>()
let content: HTMLElement | null = null

/** 右边正文的滚动容器。外壳把 main 交过来。 */
export function bindContent(el: HTMLElement | null) {
  content = el
}

export function scrollContentToTop(behavior: ScrollBehavior = 'auto') {
  if (content) content.scrollTo({ top: 0, behavior })
  else window.scrollTo({ top: 0, behavior })
}

export function contentScroller() {
  return content
}

/** 给带 id 的区块登记，供首页 hash 滚动。 */
export function bindId(id: string) {
  return (el: HTMLElement | null) => {
    if (el) nodes.set(id, el)
    else nodes.delete(id)
  }
}

export function registeredNodes() {
  return [...nodes.values()]
}

export function scrollToRegistered(id: string) {
  const el = nodes.get(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'auto', block: 'start' })
  return true
}
