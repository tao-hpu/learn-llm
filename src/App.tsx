import { useEffect, useRef, type ComponentType } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Layout } from './site/Layout'
import { findChapter } from './chapters'
import { TermTip } from './components/TermTip'
import { Attention } from './pages/Attention'
import { Bpe } from './pages/Bpe'
import { Bigram } from './pages/Bigram'
import { Dpo } from './pages/Dpo'
import { FlashAttention } from './pages/FlashAttention'
import { GlossaryPage } from './pages/GlossaryPage'
import { GptMachine } from './pages/GptMachine'
import { Home } from './pages/Home'
import { LinearAttention } from './pages/LinearAttention'
import { Llama } from './pages/Llama'
import { Lora } from './pages/Lora'
import { Moe } from './pages/Moe'
import { NgramMemory } from './pages/NgramMemory'
import { Sampling } from './pages/Sampling'
import { ScalingLaw } from './pages/ScalingLaw'
import { SparseAttention } from './pages/SparseAttention'
import { SpeculativeDecoding } from './pages/SpeculativeDecoding'
import { Transformer } from './pages/Transformer'
import { NotFound } from './pages/NotFound'
import { Notes } from './pages/Notes'
import { About } from './pages/About'
import { Posttraining } from './pages/Posttraining'
import { Pretraining } from './pages/Pretraining'
import { Quantization } from './pages/Quantization'
import { RlvrGrpo } from './pages/RlvrGrpo'
import { Sft } from './pages/Sft'
import { scrollContentToTop, scrollToRegistered } from './scroll'
import './site.css'

const pages: Record<string, ComponentType> = {
  bigram: Bigram,
  attention: Attention,
  transformer: Transformer,
  'gpt-machine': GptMachine,
  sampling: Sampling,
  pretraining: Pretraining,
  posttraining: Posttraining,
  sft: Sft,
  lora: Lora,
  dpo: Dpo,
  moe: Moe,
  llama: Llama,
  'linear-attention': LinearAttention,
  'sparse-attention': SparseAttention,
  'ngram-memory': NgramMemory,
  'speculative-decoding': SpeculativeDecoding,
  quantization: Quantization,
  bpe: Bpe,
  'flash-attention': FlashAttention,
  'scaling-law': ScalingLaw,
  'rlvr-grpo': RlvrGrpo,
}

function ChapterRoute() {
  const { slug = '' } = useParams()
  const chapter = findChapter(slug)
  if (!chapter) return <NotFound />
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
    if (pathChanged) scrollContentToTop('auto')
  }, [pathname, hash])
  return null
}

/** 路由表。外面套哪种 Router 由入口决定：浏览器用 BrowserRouter，构建期预渲染用 StaticRouter。 */
export default function App() {
  return (
    <>
      <TermTip />
      <ScrollManager />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="glossary" element={<GlossaryPage />} />
          <Route path="notes" element={<Notes />} />
          <Route path="about" element={<About />} />
          <Route path="ch/:slug" element={<ChapterRoute />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
