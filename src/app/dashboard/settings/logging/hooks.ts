import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLoggingStatus,
  getLoggingTargets,
  setLoggingLevel,
  type LogLevel,
} from './api';

export function useLoggingTargets() {
  return useQuery({
    queryKey: ['logging', 'targets'],
    queryFn: getLoggingTargets,
  });
}

export function useLoggingStatus(target: string) {
  return useQuery({
    queryKey: ['logging', 'status', target],
    queryFn: () => getLoggingStatus(target),
    enabled: !!target,
  });
}

export function useSetLoggingLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, level }: { target: string; level: LogLevel }) =>
      setLoggingLevel(target, level),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['logging', 'status', variables.target],
      });
    },
  });
}
