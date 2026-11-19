import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'

const root = [...document.body.children].find((el) => el.id === 'root')
if (!root) throw new Error('缺少挂载节点')
// #root 里是构建期预渲染的正文（给不跑脚本的爬虫看）。这里不做 hydrate，直接重新渲染：
// 深链 #step-N 在服务端无从得知，hydrate 会因步骤不同而对不上。
createRoot(root).render(<BrowserRouter><App /></BrowserRouter>)
