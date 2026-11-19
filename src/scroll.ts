const nodes = new Map<string, HTMLElement>()

/** 给带 id 的区块登记，供首页 hash 滚动。 */
export function bindId(id: string) {
  return (el: HTMLElement | null) => {
    if (el) nodes.set(id, el)
    else nodes.delete(id)
  }
}

export function scrollToRegistered(id: string) {
  const el = nodes.get(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'auto', block: 'start' })
  return true
}
