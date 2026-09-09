import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActorQuery } from './queries';
import { useDemoIdentity } from '../context/demoIdentity';
import * as api from '../api/claims';
import type {
  ManualResolution,
  Claim,
  WorkflowResult,
} from '../api/claimTypes';
import { ApiError, NetworkError } from '../api/errors';
export const useClaim = (id: string) =>
  useActorQuery(
    'claim',
    (actor, signal) => api.getClaim(actor, id, signal),
    id,
  );
export const useClaimValidation = (id: string) =>
  useActorQuery(
    'claimValidation',
    (actor, signal) => api.getClaimValidation(actor, id, signal),
    id,
  );
export const useClaimReadiness = (id: string) =>
  useActorQuery(
    'claimReadiness',
    (actor, signal) => api.getClaimReadiness(actor, id, signal),
    id,
  );
export const useClaimSettlement = (id: string) =>
  useActorQuery(
    'claimSettlement',
    (actor, signal) => api.getClaimSettlement(actor, id, signal),
    id,
  );
export type ClaimCommand =
  | { action: 'exclude'; expenseId: string; reason: string }
  | { action: 'restore'; expenseId: string }
  | { action: 'resolve'; expenseId: string; resolution: ManualResolution }
  | { action: 'submit' | 'resubmit' };
export function claimMutationMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'CLAIM_STATE_CONFLICT')
    return 'Claim changed while you were reviewing it. Refreshing the latest state. Review it before trying again.';
  if (error instanceof ApiError && error.code === 'POLICY_NOT_READY')
    return 'Claim is not ready to submit. Review the refreshed blocking findings.';
  if (error instanceof ApiError || error instanceof NetworkError)
    return error.message;
  return 'The claim could not be updated. Please try again.';
}
export function useClaimMutation(claimId: string) {
  const { selectedEmployeeCode } = useDemoIdentity();
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
      query.queryKey[0] === 'actor' &&
      query.queryKey[1] === selectedEmployeeCode &&
      (query.queryKey[2] === 'claims' ||
        ([
          'claim',
          'claimValidation',
          'claimReadiness',
          'claimSettlement',
        ].includes(String(query.queryKey[2])) &&
          query.queryKey[3] === claimId)),
  };
  return useMutation<Claim | WorkflowResult, Error, ClaimCommand>({
    retry: false,
    onMutate: async () => {
      await client.cancelQueries(affected);
    },
    mutationFn: (command: ClaimCommand) => {
      if (!selectedEmployeeCode)
        throw new Error('Select an employee identity.');
      switch (command.action) {
        case 'exclude':
          return api.excludeClaimExpense(
            selectedEmployeeCode,
            claimId,
            command.expenseId,
            command.reason,
          );
        case 'restore':
          return api.restoreClaimExpense(
            selectedEmployeeCode,
            claimId,
            command.expenseId,
          );
        case 'resolve':
          return api.resolveClaimExpense(
            selectedEmployeeCode,
            claimId,
            command.expenseId,
            command.resolution,
          );
        case 'submit':
          return api.submitClaim(selectedEmployeeCode, claimId);
        case 'resubmit':
          return api.resubmitClaim(selectedEmployeeCode, claimId);
      }
    },
    onSuccess: (_data, command) => {
      if (mounted.current)
        toast.success(
          {
            exclude: 'Expense excluded',
            restore: 'Expense restored',
            resolve: 'Resolution saved',
            submit: 'Claim submitted',
            resubmit: 'Claim resubmitted',
          }[command.action],
        );
    },
    onSettled: async () => {
      await client.invalidateQueries(affected);
    },
  });
}
