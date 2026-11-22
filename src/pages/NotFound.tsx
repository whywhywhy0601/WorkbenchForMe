import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFound() {
  return (
    <div className="page not-found">
      <span className="not-found-icon">
        <Compass size={34} />
      </span>
      <h1>这个页面不在工作台里</h1>
      <p>链接可能已经失效，或者页面被移动到了其他文件夹。</p>
      <Link to="/" className="btn btn-primary">
        返回工作台
      </Link>
    </div>
  );
}
