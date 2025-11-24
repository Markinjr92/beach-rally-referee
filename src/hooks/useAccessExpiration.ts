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
        // Verificar se o acesso está expirado usando a função RPC
        const { data: isExpiredData, error: rpcError } = await supabase.rpc('is_user_access_expired', {
          user_uuid: user.id,
        });

        if (rpcError) {
          console.error('Erro ao verificar acesso:', rpcError);
          setLoading(false);
          return;
        }

        const expired = isExpiredData === true;

        if (error) {
          console.error('Erro ao verificar acesso:', error);
          setLoading(false);
          return;
        }

        // Buscar data de expiração
        const { data: userData } = await supabase
          .from('users')
          .select('access_expires_at')
          .eq('id', user.id)
          .single();

        if (userData) {
          setExpiresAt(userData.access_expires_at);
          
          if (userData.access_expires_at) {
            const expires = new Date(userData.access_expires_at);
            const now = new Date();
            const diffTime = expires.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays);
          } else {
            setDaysRemaining(null); // Acesso vitalício
          }
        }

        setIsExpired(expired);
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

