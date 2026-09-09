import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  actionLabels,
  reviewMutationMessage,
  type ReviewAction,
  type ReviewCommand,
} from '../../app/workflowQueries';
import styles from './claims.module.css';
export function ReviewActionDialog({
  action,
  pending,
  error,
  onSave,
  onClose,
}: {
  action: ReviewAction;
  pending: boolean;
  error: unknown;
  onSave: (command: ReviewCommand) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('textarea, input')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const required =
    action === 'return' || action === 'schedule' || action === 'paid';
  const label =
    action === 'schedule'
      ? 'Payment date'
      : action === 'paid'
        ? 'Payment reference'
        : action === 'return'
          ? 'Return remarks'
          : 'Remarks (optional)';
  const schema = z.object({
    value: z
      .string()
      .trim()
      .max(action === 'paid' ? 200 : 2000)
      .refine((value) => !required || value.length > 0, `${label} is required.`)
      .refine(
        (value) =>
          action !== 'schedule' ||
          (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
            !Number.isNaN(Date.parse(value)) &&
            new Date(value).toISOString().slice(0, 10) === value),
        'Enter a valid date in YYYY-MM-DD format.',
      ),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ value: string }>({
    resolver: zodResolver(schema),
    defaultValues: { value: '' },
  });
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="review-action-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!pending) onClose();
        }
      }}
    >
      <h2 id="review-action-title">{actionLabels[action]}</h2>
      {action === 'schedule' && (
        <p>
          Payment runs are on the 10th and 25th. The server validates the date
          against the current India business date.
        </p>
      )}
      {action === 'paid' && (
        <p>
          Record an actual completed payment. The server checks that the
          scheduled payment date has arrived.
        </p>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(({ value }) => onSave({ action, value }))}
      >
        <label htmlFor="review-action-value">{label}</label>
        {action === 'schedule' || action === 'paid' ? (
          <input
            id="review-action-value"
            {...register('value')}
            placeholder={action === 'schedule' ? 'YYYY-MM-DD' : undefined}
            disabled={pending}
            aria-invalid={!!errors.value || !!error}
            aria-describedby="review-action-error"
          />
        ) : (
          <textarea
            id="review-action-value"
            {...register('value')}
            disabled={pending}
            aria-invalid={!!errors.value || !!error}
            aria-describedby="review-action-error"
          />
        )}
        <p
          id="review-action-error"
          role={errors.value || error ? 'alert' : undefined}
          className={styles.error}
        >
          {errors.value?.message || (error ? reviewMutationMessage(error) : '')}
        </p>
        <button className={styles.primary} disabled={pending || isSubmitting}>
          {pending ? 'Updating...' : actionLabels[action]}
        </button>
      </form>
      <button className={styles.button} disabled={pending} onClick={onClose}>
        Cancel
      </button>
    </dialog>
  );
}
