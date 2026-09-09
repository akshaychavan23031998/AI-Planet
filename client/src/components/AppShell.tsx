import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorState, LoadingState } from './ui';
import { useDemoIdentity } from '../context/demoIdentity';
import styles from './shell.module.css';
export function AppShell() {
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const {
    isLoadingUsers,
    usersError,
    retryUsers,
    selectedEmployeeCode,
    availableUsers,
  } = useDemoIdentity();
  useEffect(() => {
    main.current?.focus();
  }, [location.pathname]);
  function closeMenu() {
    dialog.current?.close();
  }
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <aside className={styles.desktopSidebar}>
        <Sidebar />
      </aside>
      <dialog
        id="mobile-navigation"
        ref={dialog}
        className={styles.drawer}
        aria-label="Navigation"
        onClose={() => setMenuOpen(false)}
      >
        <button
          className={styles.closeMenu}
          aria-label="Close navigation"
          onClick={closeMenu}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <Sidebar onNavigate={closeMenu} />
      </dialog>
      <div className={styles.mainWrap}>
        <Header
          menuOpen={menuOpen}
          onOpenMenu={() => {
            dialog.current?.showModal();
            setMenuOpen(true);
          }}
        />
        <main
          id="main-content"
          ref={main}
          tabIndex={-1}
          className={styles.content}
        >
          {isLoadingUsers && <LoadingState label="Loading demo identities…" />}
          {usersError && <ErrorState error={usersError} onRetry={retryUsers} />}
          {!isLoadingUsers && !usersError && !availableUsers.length && (
            <ErrorState
              error={new Error('No demo users available')}
              onRetry={retryUsers}
            />
          )}
          <Outlet key={selectedEmployeeCode ?? 'no-identity'} />
        </main>
      </div>
    </div>
  );
}
