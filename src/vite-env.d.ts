/// <reference types="vite/client" />

declare module '*.css?raw' {
  const css: string
  export default css
}

declare module '*.boot.js' {
  export function boot(root: HTMLElement): () => void
}
