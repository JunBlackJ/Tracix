import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { System } from '@/types';
import { api } from '@/lib/api';
import { useAuthStore } from './useAuthStore';

export function useSystems(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['systems', params],
    queryFn: () => api.systems.list(params),
    enabled: isAuthenticated,
  });
}

export function useSystem(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['systems', id],
    queryFn: () => api.systems.get(id!),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<System>) => api.systems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
    },
  });
}

export function useUpdateSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<System> }) => api.systems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
    },
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.systems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
    },
  });
}
