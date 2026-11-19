// 构建期预渲染入口：scripts/prerender.mjs 对每个路由调用 render(url)，把正文写进静态 HTML。
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'

export function render(url: string): string {
  return renderToString(<StaticRouter location={url}><App /></StaticRouter>)
}
