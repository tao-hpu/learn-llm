import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { findChapter } from './chapters'
import { ChapterFrame } from './components/ChapterFrame'
import { TermTip } from './components/TermTip'
import { specFor } from './content/specs'
import { GlossaryPage } from './pages/GlossaryPage'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { PendingChapter, PendingStatic } from './pages/Pending'
import './site.css'

function ChapterRoute() {
  const { slug = '' } = useParams()
  const chapter = findChapter(slug)
  if (!chapter) return <NotFound />
  const spec = specFor(slug)
  if (!spec || !chapter.ready) return <PendingChapter chapter={chapter} />
  return <ChapterFrame key={slug} spec={spec} />
}

export default function App() {
  return (
    <BrowserRouter>
      <TermTip />
      <Routes>
        <Route index element={<Home />} />
        <Route path="glossary" element={<GlossaryPage />} />
        <Route path="notes" element={<PendingStatic title="学习札记 · 彩蛋" description="正课之外的边角料:Transformer 的前世今生;12.75T token 的真实训练日志里出过什么岔子;Qwen3.8-Flash-Next 与 DeepSeek-V4-Flash 逐个零件对照本仓库章节。" />} />
        <Route path="about" element={<PendingStatic title="关于本项目 · 从零手写大语言模型" description="LLM from Scratch 是什么、页面怎么用、21 章分哪五个阶段、代码与硬件、致谢与许可。" />} />
        <Route path="ch/:slug" element={<ChapterRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
