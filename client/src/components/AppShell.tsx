import { useTrips, useClaims } from '../app/queries';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
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
  const trips = useTrips();
  const claims = useClaims();
  const routeTripId = useMatch('/trips/:travelRequestId/*')?.params
    .travelRequestId;
  const routeClaimId = useMatch('/claims/:claimId')?.params.claimId;
  const visibleClaims = claims.isError ? [] : (claims.data ?? []);
  const recentTripId =
    routeTripId ??
    visibleClaims.find((claim) => claim.id === routeClaimId)?.travelRequest ??
    (trips.isError ? undefined : trips.data?.[0]?.id);
  const relatedClaimId = visibleClaims.find(
    (claim) => claim.travelRequest === recentTripId,
  )?.id;
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
        <Sidebar recentTripId={recentTripId} relatedClaimId={relatedClaimId} />
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
        <Sidebar
          onNavigate={closeMenu}
          recentTripId={recentTripId}
          relatedClaimId={relatedClaimId}
        />
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
