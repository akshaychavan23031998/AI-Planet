import { NavLink, useMatch } from 'react-router-dom';
import {
  LayoutDashboard,
  Plane,
  Files,
  Receipt,
  ClipboardCheck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './shell.module.css';
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const tripId = useMatch('/trips/:travelRequestId/*')?.params.travelRequestId;
  const claimId = useMatch('/claims/:claimId')?.params.claimId;
  const validId = (id: string | undefined) =>
    id && /^[a-fA-F0-9]{24}$/.test(id) ? id : null;
  const trip = validId(tripId);
  const claim = validId(claimId);
  function item(label: string, Icon: LucideIcon, to?: string) {
    const content = (
      <>
        <Icon size={18} aria-hidden="true" />
        <span>{label}</span>
      </>
    );
    return to ? (
      <NavLink
        to={to}
        end
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
        onClick={onNavigate}
      >
        {content}
      </NavLink>
    ) : (
      <span
        className={`${styles.navItem} ${styles.unavailable}`}
        aria-disabled="true"
        title="Open a specific record to use this navigation"
      >
        {content}
      </span>
    );
  }
  return (
    <div className={styles.sidebarContent}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          N
        </span>
        <div>
          <div className={styles.brandTitle}>Nortex Expense</div>
          <div className={styles.brandSubtitle}>
            Travel & expense settlement
          </div>
        </div>
      </div>
      <nav aria-label="Primary navigation">
        <div className={styles.navSection}>
          <div className={styles.navLabel}>Workspace</div>
          <div className={styles.navList}>
            {item('Overview', LayoutDashboard, '/')}
            {item('Trip request', Plane, trip ? `/trips/${trip}` : undefined)}
            {item(
              'Evidence inbox',
              Files,
              trip ? `/trips/${trip}/evidence` : undefined,
            )}
            {item(
              'Claim review',
              Receipt,
              claim ? `/claims/${claim}` : undefined,
            )}
          </div>
        </div>
        <div className={styles.navSection}>
          <div className={styles.navLabel}>Review & settlement</div>
          <div className={styles.navList}>
            {item('Approvals', ClipboardCheck, '/approvals')}
            {item('Finance', Wallet, '/finance')}
          </div>
        </div>
      </nav>
      <div className={styles.sidebarFooter}>
        <div className={styles.note}>
          <strong>Demo workspace</strong>Use the identity selector to explore
          employee perspectives. Backend permissions apply.
        </div>
      </div>
    </div>
  );
}
