import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { findNavContext, navModules } from '../../lib/nav';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navModules.map((module) => [module.key, true]))
  );

  useEffect(() => {
    const context = findNavContext(location.pathname);
    if (context) {
      setExpanded((current) =>
        current[context.module.key] ? current : { ...current, [context.module.key]: true }
      );
    }
    onCloseMobile();
    // Only react to pathname changes; onCloseMobile is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
      aria-label="主导航"
    >
      <div className="sidebar-head">
        <Link to="/" className="brand" aria-label="My Workspace 首页">
          <span className="brand-mark">
            <FolderKanban size={20} />
          </span>
          {!collapsed && (
            <span className="brand-text">
              <strong>My Workspace</strong>
              <small>Personal workbench</small>
            </span>
          )}
        </Link>
        <button
          type="button"
          className="icon-btn sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? '展开导航栏' : '收起导航栏'}
          title={collapsed ? '展开导航栏' : '收起导航栏'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <button
          type="button"
          className="icon-btn sidebar-mobile-close"
          onClick={onCloseMobile}
          aria-label="关闭导航"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item nav-home ${isActive ? 'is-active' : ''}`}
          title={collapsed ? '工作台' : undefined}
        >
          <span className="nav-icon">
            <LayoutGrid size={17} />
          </span>
          {!collapsed && <span className="nav-label">工作台</span>}
        </NavLink>

        {navModules.map((module) => {
          const isOpen = expanded[module.key] ?? true;
          const ModuleIcon = module.icon;
          return (
            <div className={`nav-module accent-${module.accent}`} key={module.key}>
              {collapsed ? (
                <div className="nav-module-mini" title={module.label}>
                  <ModuleIcon size={14} />
                </div>
              ) : (
                <button
                  type="button"
                  className="nav-module-head"
                  onClick={() =>
                    setExpanded((current) => ({
                      ...current,
                      [module.key]: !current[module.key],
                    }))
                  }
                  aria-expanded={isOpen}
                >
                  <span className="nav-module-label">{module.label}</span>
                  <span className="nav-module-count">{module.items.length}</span>
                  <ChevronDown
                    size={14}
                    className={`nav-chevron ${isOpen ? 'is-open' : ''}`}
                  />
                </button>
              )}
              {(isOpen || collapsed) && (
                <div className={`nav-items ${collapsed ? 'nav-items--mini' : ''}`}>
                  {module.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `nav-item ${isActive ? 'is-active' : ''}`
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="nav-icon">
                          <ItemIcon size={16} />
                        </span>
                        {!collapsed && <span className="nav-label">{item.label}</span>}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
          title={collapsed ? '设置' : undefined}
        >
          <span className="nav-icon">
            <SettingsIcon size={16} />
          </span>
          {!collapsed && <span className="nav-label">设置</span>}
        </NavLink>
        {!collapsed && <div className="sidebar-meta">V1.0 · 本地数据</div>}
      </div>
    </aside>
  );
}
