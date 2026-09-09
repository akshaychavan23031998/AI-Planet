import { createContext, useContext } from 'react';
import type { DemoEmployee } from '../api/demo';
export interface DemoIdentity {
  selectedEmployeeCode: string | null;
  selectedEmployee: DemoEmployee | null;
  setSelectedEmployeeCode: (code: string) => void;
  availableUsers: DemoEmployee[];
  isLoadingUsers: boolean;
  usersError: Error | null;
  retryUsers: () => void;
}
export const DemoIdentityContext = createContext<DemoIdentity | null>(null);
export function useDemoIdentity() {
  const context = useContext(DemoIdentityContext);
  if (!context) throw new Error('DemoIdentityProvider is required.');
  return context;
}
export const identityStorageKey = 'ai-planet-demo-employee-code';
