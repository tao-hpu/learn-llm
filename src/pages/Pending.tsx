import { Link } from 'react-router-dom'
import type { Chapter } from '../chapters'
import { HomeLink } from '../components/HomeLink'

/** 本批还没迁入的页面。标题用目录里的原文，正文只有一句状态。 */
export function PendingChapter({ chapter }: { chapter: Chapter }) {
  return (
    <div className="pending">
      <HomeLink />
      <h1>{chapter.cardTitle}</h1>
      <p>这一章的交互页还没迁进新站。</p>
      <p><Link to="/">回首页</Link></p>
    </div>
  )
}

export function PendingStatic({ title, description }: { title: string; description: string }) {
  return (
    <div className="pending">
      <HomeLink />
      <h1>{title}</h1>
      <p>{description}</p>
      <p>这一页还没迁进新站。</p>
      <p><Link to="/">回首页</Link></p>
    </div>
  )
}
