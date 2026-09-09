import type { ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import { ApiError, ConfigurationError, NetworkError } from '../api/errors';
import styles from './ui.module.css';
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={styles.pageHeader}>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <section className={styles.card}>{children}</section>;
}
export function StatusBadge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>
  );
}
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.state} role="status">
      <LoaderCircle aria-hidden="true" size={22} className={styles.spinner} />
      <span>{label}</span>
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <Inbox aria-hidden="true" size={30} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError ||
    error instanceof NetworkError ||
    error instanceof ConfigurationError
      ? error.message
      : 'Something went wrong. Please try again.';
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <AlertCircle aria-hidden="true" size={22} />
      <p>{message}</p>
      {onRetry && (
        <button className={styles.button} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
