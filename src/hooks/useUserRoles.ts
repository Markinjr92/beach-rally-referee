import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const rolesRequestCache = new Map<string, Promise<{ data: string[] | null; error: { message: string } | null }>>();
const rolesValueCache = new Map<string, string[]>();

const normalizeRoles = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const normalizedRoles = value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item) => item.length > 0);

  return [...new Set(normalizedRoles)];
};

const getUserRoles = async (userId: string) => {
  const cachedRequest = rolesRequestCache.get(userId);
  if (cachedRequest) return cachedRequest;

  const request = supabase
    .rpc('get_user_roles', { user_uuid: userId })
    .then(({ data, error }) => ({
      data: normalizeRoles(data),
      error: error ? { message: error.message } : null,
    }))
    .finally(() => {
      rolesRequestCache.delete(userId);
    });

  rolesRequestCache.set(userId, request);
  return request;
};

export const useUserRoles = (user: User | null, authLoading: boolean) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!user?.id) {
      setRoles([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cachedRoles = rolesValueCache.get(user.id);
    if (cachedRoles) {
      setRoles(cachedRoles);
      setError(null);
      setLoading(false);
      return;
    }

    const { data, error } = await getUserRoles(user.id);

    if (import.meta.env.DEV) {
      console.debug('[useUserRoles] Result from get_user_roles RPC', {
        userId: user.id,
        email: user.email,
        data,
        error,
      });
    }

    if (error) {
      console.error('Failed to fetch user roles', error);
      setRoles([]);
      setError(error.message);
    } else {
      const sanitizedRoles = normalizeRoles(data);
      rolesValueCache.set(user.id, sanitizedRoles);
      setRoles(sanitizedRoles);
      setError(null);
    }

    setLoading(false);
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user?.id) {
      setRoles([]);
      setError(null);
      setLoading(false);
      return;
    }

    void fetchRoles();
  }, [authLoading, fetchRoles, user?.id]);

  return {
    roles,
    loading,
    error,
    refresh: fetchRoles,
  };
};
