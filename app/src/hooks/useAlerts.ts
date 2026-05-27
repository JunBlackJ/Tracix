import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from './useAuthStore';

export function useAlerts(params?: { is_resolved?: boolean; severity?: string; page?: number; limit?: number }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => api.alerts.list(params),
    enabled: isAuthenticated,
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.alerts.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useResolveAllAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => api.alerts.resolveAll(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
