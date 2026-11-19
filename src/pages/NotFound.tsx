import { Link } from 'react-router-dom'
import { HomeLink } from '../components/HomeLink'

export function NotFound() {
  return (
    <div className="pending">
      <HomeLink />
      <h1>这个地址没有对应的页面</h1>
      <p><Link to="/">回首页</Link></p>
    </div>
  )
}
