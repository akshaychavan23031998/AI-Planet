export const queryKeys = {
  demoUsers: ['public', 'demoUsers'] as const,
  actor: (employeeCode: string, resource: string, id?: string) => {
    if (!employeeCode)
      throw new Error('Protected queries require an employee code.');
    return ['actor', employeeCode, resource, ...(id ? [id] : [])] as const;
  },
};
