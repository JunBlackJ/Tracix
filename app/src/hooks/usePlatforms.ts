import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Platform } from '@/types';
import { api } from '@/lib/api';
import { useAuthStore } from './useAuthStore';

export function usePlatforms(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['platforms', params],
    queryFn: () => api.platforms.list(params),
    enabled: isAuthenticated,
  });
}

export function usePlatform(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['platforms', id],
    queryFn: () => api.platforms.get(id!),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreatePlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Platform>) => api.platforms.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
  });
}

export function useUpdatePlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Platform> }) => api.platforms.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
  });
}

export function useDeletePlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.platforms.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platforms'] });
    },
  });
}
