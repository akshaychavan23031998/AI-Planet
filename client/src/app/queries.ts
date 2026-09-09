import { useQuery } from '@tanstack/react-query';
import { useDemoIdentity } from '../context/demoIdentity';
import { queryKeys } from '../api/queryKeys';
import { getTravelRequests, getTravelRequest } from '../api/travelRequests';
import { getClaims } from '../api/claims';
import { getEvidence, getEvidenceDetail } from '../api/evidence';
import { getExpenses } from '../api/expenses';
export function useActorQuery<T>(
  resource: string,
  load: (actor: string, signal: AbortSignal) => Promise<T>,
  id?: string,
) {
  const { selectedEmployeeCode } = useDemoIdentity();
  return useQuery({
    queryKey: selectedEmployeeCode
      ? queryKeys.actor(selectedEmployeeCode, resource, id)
      : ['disabled', resource, id],
    queryFn: ({ signal }) => load(selectedEmployeeCode!, signal),
    enabled: !!selectedEmployeeCode,
    refetchOnMount: 'always',
  });
}
export const useTrips = () =>
  useActorQuery('travelRequests', getTravelRequests);
export const useClaims = () => useActorQuery('claims', getClaims);
export const useTrip = (id: string) =>
  useActorQuery(
    'travelRequest',
    (actor, signal) => getTravelRequest(actor, id, signal),
    id,
  );
export const useEvidence = (id: string) =>
  useActorQuery(
    'evidence',
    (actor, signal) => getEvidence(actor, id, {}, signal),
    id,
  );
export const useEvidenceDetail = (id: string) =>
  useActorQuery(
    'evidenceDetail',
    (actor, signal) => getEvidenceDetail(actor, id, signal),
    id,
  );
export const useExpenses = (id: string) =>
  useActorQuery(
    'expenses',
    (actor, signal) => getExpenses(actor, id, signal),
    id,
  );
