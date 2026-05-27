import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Member } from '@/types';
import { api } from '@/lib/api';
import { useAuthStore } from './useAuthStore';

export function useMembers(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['members', params],
    queryFn: () => api.members.list(params),
    enabled: isAuthenticated,
  });
}

export function useMember(id: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['members', id],
    queryFn: () => api.members.get(id!),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Member>) => api.members.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Member> }) => api.members.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.members.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}
