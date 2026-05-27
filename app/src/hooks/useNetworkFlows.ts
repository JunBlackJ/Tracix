import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NetworkFlow } from '@/types';
import { api } from '@/lib/api';
import { useAuthStore } from './useAuthStore';

export function useNetworkFlows(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['networkFlows', params],
    queryFn: () => api.networkFlows.list(params),
    enabled: isAuthenticated,
  });
}

export function useNetworkFlow(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['networkFlows', id],
    queryFn: () => api.networkFlows.get(id!),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateNetworkFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<NetworkFlow>) => api.networkFlows.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkFlows'] });
    },
  });
}

export function useUpdateNetworkFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkFlow> }) => api.networkFlows.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkFlows'] });
    },
  });
}

export function useDeleteNetworkFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.networkFlows.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkFlows'] });
    },
  });
}
