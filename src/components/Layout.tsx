import { DatabaseZap, Menu, Play, Search, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { siteConfig } from '../config';
import { useSchema } from '../context/SchemaContext';
import { ConfigureModal } from './ConfigureModal';
import { SearchPalette } from './SearchPalette';
import { Sidebar } from './Sidebar';

export function Layout() {
  const { source, isLoading, error, clearError } = useSchema();
  const [searchOpen, setSearchOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isExplorer = location.pathname === '/explorer';
  const allowConfiguration = siteConfig.allowConfiguration;
  const siteName = siteConfig.title;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <NavLink to="/" className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="30 32 72 76"><polygon points="65.606 50.207 37.52 37.475 37.52 68.888 65.606 81.619 93.692 68.888 93.692 37.475 65.606 50.207" /><polygon points="65.606 87.404 54.852 82.529 37.52 90.386 65.606 103.118 93.692 90.386 76.36 82.529 65.606 87.404" /></svg>
          </span>
          <span>{siteName}</span>
          <span className="brand__version">GraphQL</span>
        </NavLink>

        <nav className="topnav" aria-label="Primary navigation">
          <NavLink to="/" end><DatabaseZap size={16} />Reference</NavLink>
          <NavLink to="/explorer"><Play size={15} fill="currentColor" />Explorer</NavLink>
        </nav>

        <div className="topbar__actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
            <span>Search queries & schema</span>
            <kbd>{navigator.platform?.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          {allowConfiguration && (
            <button className="source-button" onClick={() => setConfigOpen(true)} title={source.label}>
              <span className={`status-dot ${isLoading ? 'is-loading' : ''}`} />
              <span className="source-button__copy">
                <small>{isLoading ? 'Loading' : 'Schema'}</small>
                <strong>{source.kind === 'demo' ? 'Demo graph' : source.label}</strong>
              </span>
              <Settings2 size={16} />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="error-banner" role="status">
          <span>Schema update failed. The last working schema is still active. {error}</span>
          <button onClick={clearError} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      <div className={`app-body ${isExplorer ? 'app-body--explorer' : ''}`}>
        {!isExplorer && (
          <div className={`mobile-sidebar-wrap ${mobileNavOpen ? 'is-open' : ''}`}>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        )}
        <main className={isExplorer ? 'main main--explorer' : 'main'}>
          <Outlet />
        </main>
      </div>

      <SearchPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ConfigureModal isOpen={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}
