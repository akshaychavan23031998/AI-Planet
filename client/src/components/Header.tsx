import { Menu } from 'lucide-react';
import { useDemoIdentity } from '../context/demoIdentity';
import { StatusBadge } from './ui';
import styles from './shell.module.css';
export function Header({
  onOpenMenu,
  menuOpen,
}: {
  onOpenMenu: () => void;
  menuOpen: boolean;
}) {
  const {
    selectedEmployee,
    selectedEmployeeCode,
    availableUsers,
    setSelectedEmployeeCode,
    isLoadingUsers,
  } = useDemoIdentity();
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.mobileMenu}
        onClick={onOpenMenu}
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <div className={styles.context}>
        <div className={styles.eyebrow}>Travel & expense management</div>
        <div className={styles.contextTitle}>
          {selectedEmployee?.name ?? 'Expense workspace'}
        </div>
      </div>
      <div className={styles.headerActions}>
        <StatusBadge variant="info">Demo</StatusBadge>
        <div className={styles.identityControl}>
          <label htmlFor="demo-identity">Demo identity</label>
          <select
            id="demo-identity"
            value={selectedEmployeeCode ?? ''}
            disabled={!availableUsers.length}
            onChange={(event) => setSelectedEmployeeCode(event.target.value)}
          >
            {!availableUsers.length && (
              <option value="">
                {isLoadingUsers ? 'Loading people…' : 'No identity available'}
              </option>
            )}
            {availableUsers.map((user) => (
              <option key={user.id} value={user.employeeCode}>
                {user.name} ·{' '}
                {user.organizationalRole.replaceAll('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <span className={styles.avatar} aria-hidden="true">
          {selectedEmployee?.name
            .split(' ')
            .map((part) => part[0])
            .slice(0, 2)
            .join('') ?? '—'}
        </span>
      </div>
    </header>
  );
}
