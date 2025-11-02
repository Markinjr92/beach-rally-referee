import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useUserRoles = (user: User | null, authLoading: boolean) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(authLoading);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!user?.id) {
      console.log('[useUserRoles] No authenticated user found when fetching roles.');
      setRoles([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc("get_user_roles", {
      user_uuid: user.id,
    });

    console.log('[useUserRoles] Result from get_user_roles RPC', {
      userId: user.id,
      email: user.email,
      data,
      error,
    });

    if (error) {
      console.error('Failed to fetch user roles', error);
      setRoles([]);
      setError(error.message);
    } else {
      setRoles(Array.isArray(data) ? data : []);
      setError(null);
    }

    setLoading(false);
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    const loadRoles = async () => {
      await fetchRoles();
    };

    loadRoles();
  }, [authLoading, fetchRoles]);

  return {
    roles,
    loading,
    error,
    refresh: fetchRoles,
  };
};
