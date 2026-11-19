import { useEffect, useRef, type ComponentType } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { findChapter } from './chapters'
import { TermTip } from './components/TermTip'
import { Bpe } from './pages/Bpe'
import { Bigram } from './pages/Bigram'
import { Dpo } from './pages/Dpo'
import { GlossaryPage } from './pages/GlossaryPage'
import { Home } from './pages/Home'
import { Llama } from './pages/Llama'
import { Lora } from './pages/Lora'
import { Moe } from './pages/Moe'
import { NgramMemory } from './pages/NgramMemory'
import { NotFound } from './pages/NotFound'
import { PendingChapter, PendingStatic } from './pages/Pending'
import { Posttraining } from './pages/Posttraining'
import { Pretraining } from './pages/Pretraining'
import { Quantization } from './pages/Quantization'
import { RlvrGrpo } from './pages/RlvrGrpo'
import { Sft } from './pages/Sft'
import { scrollToRegistered } from './scroll'
import './site.css'

const pages: Record<string, ComponentType> = {
  bigram: Bigram,
  pretraining: Pretraining,
  posttraining: Posttraining,
  sft: Sft,
  lora: Lora,
  dpo: Dpo,
  moe: Moe,
  llama: Llama,
  'ngram-memory': NgramMemory,
  quantization: Quantization,
  bpe: Bpe,
  'rlvr-grpo': RlvrGrpo,
}

function ChapterRoute() {
  const { slug = '' } = useParams()
  const chapter = findChapter(slug)
  if (!chapter) return <NotFound />
  if (!chapter.ready) return <PendingChapter chapter={chapter} />
  const Page = pages[slug]
  if (Page) return <Page />
  return <NotFound />
}

function ScrollManager() {
  const { pathname, hash } = useLocation()
  const prevPath = useRef(pathname)
  useEffect(() => {
    const pathChanged = prevPath.current !== pathname
    prevPath.current = pathname
    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      if (!/^(step|part)-\d+$/.test(id)) scrollToRegistered(id)
      return
    }
    if (pathChanged) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <TermTip />
      <ScrollManager />
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
