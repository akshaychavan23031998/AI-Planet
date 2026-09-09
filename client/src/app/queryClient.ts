import { QueryClient } from '@tanstack/react-query';
import { ApiError, ConfigurationError } from '../api/errors';
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          if (
            error instanceof ConfigurationError ||
            (error instanceof ApiError &&
              error.status >= 400 &&
              error.status < 500) ||
            error.name === 'AbortError'
          )
            return false;
          return count < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}
