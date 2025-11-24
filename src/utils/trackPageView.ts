import { supabase } from '@/integrations/supabase/client';

export type PageType = 'tournament_public' | 'tournament_info' | 'scoreboard' | 'spectator';

interface TrackPageViewParams {
  pageType: PageType;
  resourceId: string;
  userId?: string | null;
}

/**
 * Registra um acesso a uma página pública
 * Esta função é não-bloqueante e não lança erros para não afetar a experiência do usuário
 */
export async function trackPageView({ pageType, resourceId, userId }: TrackPageViewParams): Promise<void> {
  try {
    // Obter informações do navegador (se disponível)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    const referrer = typeof document !== 'undefined' ? document.referrer || null : null;

    // Inserir o acesso na tabela
    const { error } = await supabase
      .from('page_views')
      .insert({
        page_type: pageType,
        resource_id: resourceId,
        user_id: userId || null,
        user_agent: userAgent,
        referrer: referrer || null,
        // IP será capturado pelo Supabase automaticamente ou pode ser obtido via Edge Function se necessário
      });

    if (error) {
      // Log silencioso - não queremos que erros de tracking afetem a experiência do usuário
      console.warn('Erro ao registrar acesso:', error);
    }
  } catch (error) {
    // Captura qualquer erro inesperado e ignora silenciosamente
    console.warn('Erro inesperado ao registrar acesso:', error);
  }
}


