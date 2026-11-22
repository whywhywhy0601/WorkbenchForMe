import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { findNavContext } from '../../lib/nav';

const COLLAPSE_KEY = 'wb:sidebar-collapsed';

export function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(max-width: 960px)').matches
  );
  const contentRef = useRef<HTMLElement | null>(null);
  const isReader = location.pathname.startsWith('/research/reader');

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    const context = findNavContext(location.pathname);
    document.title = context
      ? `${context.item.label} · My Workspace`
      : location.pathname === '/settings'
        ? '设置 · My Workspace'
        : 'My Workspace';
  }, [location.pathname]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const listener = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (!event.matches) setMobileOpen(false);
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="ambient" aria-hidden="true">
        <span className="ambient-orb ambient-orb--blue" />
        <span className="ambient-orb ambient-orb--purple" />
        <span className="ambient-orb ambient-orb--pink" />
        <span className="ambient-grain" />
      </div>

      <Sidebar
        collapsed={collapsed && !isMobile}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="关闭导航"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-main">
        <TopBar onOpenMobile={() => setMobileOpen(true)} />
        <main ref={contentRef} className={`app-content ${isReader ? 'app-content--flush' : ''}`}>
          <div className="page-transition" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
