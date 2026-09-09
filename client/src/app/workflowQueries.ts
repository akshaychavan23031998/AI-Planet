import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDemoIdentity } from '../context/demoIdentity';
import { useActorQuery } from './queries';
import * as api from '../api/workflow';
import { ApiError } from '../api/errors';
import { claimMutationMessage } from './claimQueries';
export function reviewMutationMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'POLICY_NOT_READY')
    return 'Claim is not ready for this action. Review the refreshed policy findings.';
  return claimMutationMessage(error);
}
export type ReviewAction =
  'approve' | 'return' | 'verify' | 'schedule' | 'paid';
export type ReviewCommand = { action: ReviewAction; value: string };
export const actionLabels: Record<ReviewAction, string> = {
  approve: 'Approve claim',
  return: 'Return claim',
  verify: 'Verify claim',
  schedule: 'Schedule payment',
  paid: 'Mark payment as completed',
};
export function useReviewQueue(finance: boolean) {
  return useActorQuery(
    finance ? 'financeClaims' : 'approvals',
    finance ? api.getFinanceClaims : api.getApprovals,
  );
}
export function useReviewMutation(id: string) {
  const { selectedEmployeeCode: actor } = useDemoIdentity();
  const client = useQueryClient();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const affected = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === 'actor' && query.queryKey[1] === actor,
  };
  return useMutation({
    retry: false,
    onMutate: () => client.cancelQueries(affected),
    mutationFn: ({ action, value }: ReviewCommand) => {
      if (!actor) throw new Error('Select an employee identity.');
      switch (action) {
        case 'approve':
          return api.approveClaim(actor, id, value);
        case 'return':
          return api.returnClaim(actor, id, value);
        case 'verify':
          return api.verifyClaim(actor, id, value);
        case 'schedule':
          return api.schedulePayment(actor, id, value);
        case 'paid':
          return api.markPaid(actor, id, value);
      }
    },
    onSuccess: () => {
      if (mounted.current) toast.success('Claim updated');
    },
    onSettled: () => client.invalidateQueries(affected),
  });
}
