import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const root = [...document.body.children].find((el) => el.id === 'root')
if (!root) throw new Error('缺少挂载节点')
createRoot(root).render(<App />)
