import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AccessStatus {
  isExpired: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  loading: boolean;
}

/**
 * Hook para verificar se o acesso do usuário está expirado
 */
export const useAccessExpiration = (user: User | null, authLoading: boolean): AccessStatus => {
  const [isExpired, setIsExpired] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      setIsExpired(false);
      setExpiresAt(null);
      setDaysRemaining(null);
      return;
    }

    const checkAccess = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('access_expires_at')
          .eq('id', user.id)
          .maybeSingle();

        if (userError) {
          console.error('Erro ao buscar data de expiração de acesso:', userError);
          setIsExpired(false);
          setExpiresAt(null);
          setDaysRemaining(null);
          return;
        }

        const accessExpiresAt = userData?.access_expires_at ?? null;
        setExpiresAt(accessExpiresAt);

        if (!accessExpiresAt) {
          setIsExpired(false);
          setDaysRemaining(null);
          return;
        }

        const expires = new Date(accessExpiresAt);
        const now = new Date();
        const diffTime = expires.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        setDaysRemaining(diffDays);
        setIsExpired(diffTime < 0);
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, authLoading]);

  return {
    isExpired,
    expiresAt,
    daysRemaining,
    loading,
  };
};
