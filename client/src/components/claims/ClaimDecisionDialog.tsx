import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Expense } from '../../api/types';
import type { ClaimCommand } from '../../app/claimQueries';
import { claimMutationMessage } from '../../app/claimQueries';
import { parseMoneyInput } from '../../utils/moneyInput';
import { formatMoneyMinor } from '../../utils/format';
import styles from './claims.module.css';
const reason = z
  .string()
  .trim()
  .min(1, 'A reason is required.')
  .max(2000, 'Use 2,000 characters or fewer.');
const exclusionSchema = z.object({ reason });
const amount = z
  .string()
  .max(32)
  .refine(
    (value) => parseMoneyInput(value) !== null,
    'Enter a non-negative amount with at most two decimal places.',
  );
function resolutionSchema(sourceMinor: number) {
  return z.object({ reimbursable: amount, disallowed: amount, reason }).refine(
    (values) => {
      const a = parseMoneyInput(values.reimbursable);
      const b = parseMoneyInput(values.disallowed);
      return (
        a === null ||
        b === null ||
        BigInt(a) + BigInt(b) === BigInt(sourceMinor)
      );
    },
    {
      message: 'Both allocations must total the source amount.',
      path: ['disallowed'],
    },
  );
}
export function ClaimDecisionDialog({
  expense,
  action,
  pending,
  error,
  onClose,
  onSave,
}: {
  expense: Expense;
  action: 'exclude' | 'resolve';
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (command: ClaimCommand) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();

    const first = dialog?.querySelector<HTMLElement>('textarea, input');
    first?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="decision-title"
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
      <h2 id="decision-title">
        {action === 'exclude' ? 'Exclude expense' : 'Resolve mixed hotel tax'}
      </h2>
      <p>
        {expense.merchant} ·{' '}
        {formatMoneyMinor(expense.amountMinor, expense.currency)}
      </p>
      <p>{expense.description}</p>
      {expense.sourceReviewNote && (
        <p className={styles.muted}>{expense.sourceReviewNote}</p>
      )}
      {action === 'exclude' ? (
        <ExcludeForm expenseId={expense.id} pending={pending} onSave={onSave} />
      ) : (
        <ResolveForm expense={expense} pending={pending} onSave={onSave} />
      )}
      {!!error && (
        <p role="alert" className={styles.error}>
          {claimMutationMessage(error)}
        </p>
      )}
      <button disabled={pending} className={styles.button} onClick={onClose}>
        Cancel
      </button>
    </dialog>
  );
}
function ExcludeForm({
  expenseId,
  pending,
  onSave,
}: {
  expenseId: string;
  pending: boolean;
  onSave: (command: ClaimCommand) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof exclusionSchema>>({
    resolver: zodResolver(exclusionSchema),
    defaultValues: { reason: '' },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit(({ reason }) =>
        onSave({ action: 'exclude', expenseId, reason }),
      )}
    >
      <label htmlFor="exclude-reason">Exclusion reason</label>
      <textarea
        id="exclude-reason"
        {...register('reason')}
        maxLength={2000}
        placeholder="Explain why this expense should not be reimbursed"
        aria-invalid={!!errors.reason}
        aria-describedby="exclude-reason-error"
        disabled={pending}
      />
      <p id="exclude-reason-error" className={styles.error}>
        {errors.reason?.message}
      </p>
      <p className={styles.muted}>
        The source expense and its evidence will remain visible.
      </p>
      <button className={styles.primary} disabled={pending || isSubmitting}>
        {pending ? 'Saving…' : 'Exclude from claim'}
      </button>
    </form>
  );
}
function ResolveForm({
  expense,
  pending,
  onSave,
}: {
  expense: Expense;
  pending: boolean;
  onSave: (command: ClaimCommand) => Promise<void>;
}) {
  const schema = resolutionSchema(expense.amountMinor);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reimbursable: '', disallowed: '', reason: '' },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        onSave({
          action: 'resolve',
          expenseId: expense.id,
          resolution: {
            reimbursableMinor: parseMoneyInput(values.reimbursable)!,
            disallowedMinor: parseMoneyInput(values.disallowed)!,
            reason: values.reason,
          },
        }),
      )}
    >
      <p>
        Enter an explicit allocation supported by your review. No split is
        assumed.
      </p>
      <div className={styles.formAmounts}>
        {(['reimbursable', 'disallowed'] as const).map((field) => (
          <div key={field}>
            <label htmlFor={`resolution-${field}`}>
              {field === 'reimbursable'
                ? 'Reimbursable (INR)'
                : 'Disallowed (INR)'}
            </label>
            <input
              id={`resolution-${field}`}
              inputMode="decimal"
              maxLength={32}
              {...register(field)}
              disabled={pending}
              aria-invalid={!!errors[field]}
              aria-describedby={`${field}-error`}
            />
            <p id={`${field}-error`} className={styles.error}>
              {errors[field]?.message}
            </p>
          </div>
        ))}
      </div>
      <label htmlFor="resolution-reason">Resolution reason</label>
      <textarea
        id="resolution-reason"
        {...register('reason')}
        maxLength={2000}
        disabled={pending}
        aria-invalid={!!errors.reason}
        aria-describedby="resolution-reason-error"
      />
      <p id="resolution-reason-error" className={styles.error}>
        {errors.reason?.message}
      </p>
      <button className={styles.primary} disabled={pending || isSubmitting}>
        {pending ? 'Saving…' : 'Save resolution'}
      </button>
    </form>
  );
}
