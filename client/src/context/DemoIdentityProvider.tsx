import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDemoUsers } from '../api/demo';
import { queryKeys } from '../api/queryKeys';
import { DemoIdentityContext, identityStorageKey } from './demoIdentity';
function storedSelection() {
  try {
    return localStorage.getItem(identityStorageKey);
  } catch {
    return null;
  }
}
export function DemoIdentityProvider({ children }: { children: ReactNode }) {
  const [preferredCode, setPreferredCode] = useState(storedSelection);
  const users = useQuery({
    queryKey: queryKeys.demoUsers,
    queryFn: ({ signal }) => getDemoUsers(signal),
  });
  const availableUsers = users.data ?? [];
  const selectedEmployee =
    availableUsers.find((user) => user.employeeCode === preferredCode) ??
    availableUsers.find((user) => user.employeeCode === 'NX-4471') ??
    availableUsers[0] ??
    null;
  const selectedEmployeeCode = selectedEmployee?.employeeCode ?? null;
  useEffect(() => {
    if (!users.isSuccess) return;
    try {
      if (selectedEmployeeCode)
        localStorage.setItem(identityStorageKey, selectedEmployeeCode);
      else localStorage.removeItem(identityStorageKey);
    } catch {
      /* Browser storage may be unavailable; in-memory selection still works. */
    }
  }, [selectedEmployeeCode, users.isSuccess]);
  function setSelectedEmployeeCode(code: string) {
    if (availableUsers.some((user) => user.employeeCode === code))
      setPreferredCode(code);
  }
  return (
    <DemoIdentityContext.Provider
      value={{
        selectedEmployee,
        selectedEmployeeCode,
        setSelectedEmployeeCode,
        availableUsers,
        isLoadingUsers: users.isPending,
        usersError: users.error,
        retryUsers: () => {
          void users.refetch();
        },
      }}
    >
      {children}
    </DemoIdentityContext.Provider>
  );
}
