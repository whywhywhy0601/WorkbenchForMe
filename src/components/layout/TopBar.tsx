import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../app/ThemeProvider';
import { findNavContext } from '../../lib/nav';
import { dateKey, formatDateCN } from '../../lib/format';

export function TopBar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const context = findNavContext(location.pathname);
  const isSettings = location.pathname === '/settings';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn topbar-menu"
          onClick={onOpenMobile}
          aria-label="打开导航栏"
          aria-controls="app-sidebar"
        >
          <Menu size={19} />
        </button>
        <nav className="breadcrumb" aria-label="面包屑">
          <Link to="/" className="breadcrumb-home">
            My Workspace
          </Link>
          <ChevronRight size={13} className="breadcrumb-sep" />
          {context ? (
            <>
              <span className="breadcrumb-module">{context.module.label}</span>
              <ChevronRight size={13} className="breadcrumb-sep" />
              <span className="breadcrumb-current">{context.item.label}</span>
            </>
          ) : (
            <span className="breadcrumb-current">{isSettings ? '设置' : '工作台'}</span>
          )}
        </nav>
      </div>

      <div className="topbar-right">
        <span className="topbar-date">{formatDateCN(dateKey(), { weekday: true })}</span>
        <span className="topbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="theme-toggle"
          onClick={toggle}
          aria-label={theme === 'dark' ? '切换到日间模式' : '切换到夜览模式'}
          title={theme === 'dark' ? '切换到日间模式' : '切换到夜览模式'}
        >
          <span className={`theme-toggle-icon ${theme === 'dark' ? 'is-dark' : ''}`}>
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </span>
        </button>
        <div className="topbar-avatar" title="个人工作台" aria-hidden="true">
          W
        </div>
      </div>
    </header>
  );
}
