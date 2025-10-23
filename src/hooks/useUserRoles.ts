import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useUserRoles = (user: User | null, authLoading: boolean) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(authLoading);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!user?.id) {
      setRoles([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc<string[]>("get_user_roles", {
      user_uuid: user.id,
    });

    if (error) {
      console.error('Failed to fetch user roles', error);
      setRoles([]);
      setError(error.message);
    } else {
      setRoles(data ?? []);
      setError(null);
    }

    setLoading(false);
  }, [user?.id]);

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
