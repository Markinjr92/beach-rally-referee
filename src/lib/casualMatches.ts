import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Game, Team } from "@/types/volleyball";
import { MATCH_FORMAT_PRESETS, type MatchFormatPresetKey } from "@/utils/matchConfig";

export type CasualMatch = Tables<'casual_matches'>;
export type CasualMatchInsert = TablesInsert<'casual_matches'>;

/**
 * Converte um casual_match do banco para o tipo Game
 */
export const casualMatchToGame = (casualMatch: CasualMatch): Game => {
  const preset = MATCH_FORMAT_PRESETS[casualMatch.format_preset as MatchFormatPresetKey];
  
  const teamA: Team = {
    name: casualMatch.team_a_name,
    players: [
      { name: casualMatch.team_a_player_1, number: 1 },
      { name: casualMatch.team_a_player_2, number: 2 },
    ],
  };

  const teamB: Team = {
    name: casualMatch.team_b_name,
    players: [
      { name: casualMatch.team_b_player_1, number: 1 },
      { name: casualMatch.team_b_player_2, number: 2 },
    ],
  };

  const normalizedStatus = 
    casualMatch.status === 'in_progress' ? 'em_andamento' :
    casualMatch.status === 'completed' ? 'finalizado' :
    casualMatch.status === 'canceled' ? 'cancelado' : 'agendado';

  return {
    id: casualMatch.id,
    tournamentId: '', // Jogos avulsos não têm torneio
    title: `${casualMatch.team_a_name} vs ${casualMatch.team_b_name}`,
    category: casualMatch.category,
    modality: casualMatch.modality as 'dupla' | 'quarteto',
    format: preset ? 'melhorDe3' : 'melhorDe3', // Mapear conforme necessário
    teamA,
    teamB,
    pointsPerSet: casualMatch.points_per_set,
    needTwoPointLead: true,
    directWinFormat: casualMatch.direct_win_format ?? false,
    sideSwitchSum: casualMatch.side_switch_sum,
    hasTechnicalTimeout: false,
    technicalTimeoutSum: 0,
    teamTimeoutsPerSet: 2,
    teamTimeoutDurationSec: 30,
    coinTossMode: 'initialThenAlternate',
    status: normalizedStatus,
    createdAt: casualMatch.created_at,
    updatedAt: casualMatch.updated_at,
    hasStatistics: false, // Jogos casuais nunca têm estatísticas
  };
};

/**
 * Garante que o usuário existe na tabela users
 * Se não existir, tenta criar usando as informações do auth
 */
const ensureUserExists = async (userId: string): Promise<void> => {
  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  // Se encontrou o usuário, tudo ok
  if (existingUser) {
    return;
  }

  // Se não encontrou, tentar criar
  // Buscar informações do usuário no auth
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser || authUser.id !== userId) {
    throw new Error('Usuário não autenticado ou ID não corresponde');
  }

  // Tentar criar registro na tabela users
  // Nota: Isso pode falhar por RLS, mas vamos tentar
  const { error: insertError } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email || '',
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
      is_active: true,
    });

  if (insertError) {
    // Se já existe (race condition ou código 23505), ignorar
    if (insertError.code === '23505') {
      return; // Usuário já existe, tudo ok
    }
    
    // Se for erro de permissão (RLS), tentar novamente após um pequeno delay
    // (pode ser race condition com o trigger)
    if (insertError.code === '42501') {
      // Aguardar um pouco e verificar novamente
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: retryCheck } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (!retryCheck) {
        throw new Error(
          'Seu usuário não está registrado no sistema. ' +
          'Por favor, entre em contato com o administrador ou faça logout e login novamente.'
        );
      }
      // Se agora existe, tudo ok
      return;
    }
    
    console.error('Erro ao criar usuário:', insertError);
    throw new Error(`Falha ao criar registro do usuário: ${insertError.message}`);
  }
};

/**
 * Cria um novo jogo avulso
 */
export const createCasualMatch = async (
  data: Omit<CasualMatchInsert, 'id' | 'created_at' | 'updated_at' | 'share_token'>
): Promise<CasualMatch> => {
  // Garantir que o usuário existe na tabela users
  await ensureUserExists(data.user_id);

  const { data: match, error } = await supabase
    .from('casual_matches')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  if (!match) throw new Error('Falha ao criar jogo avulso');

  return match;
};

/**
 * Lista jogos avulsos do usuário
 * Se isAdmin for true, lista todos os jogos independente do criador
 */
export const listCasualMatches = async (
  userId: string,
  filters?: {
    status?: 'scheduled' | 'in_progress' | 'completed' | 'canceled' | 'all';
    search?: string;
  },
  isAdmin: boolean = false
): Promise<CasualMatch[]> => {
  let query = supabase
    .from('casual_matches')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Se não for admin, filtrar apenas jogos do usuário
  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(
      `team_a_name.ilike.${searchTerm},team_b_name.ilike.${searchTerm},team_a_player_1.ilike.${searchTerm},team_a_player_2.ilike.${searchTerm},team_b_player_1.ilike.${searchTerm},team_b_player_2.ilike.${searchTerm}`
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

/**
 * Busca um jogo avulso por ID
 */
export const getCasualMatch = async (id: string, userId: string): Promise<CasualMatch | null> => {
  const { data, error } = await supabase
    .from('casual_matches')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error) {
    // PGRST116 = not found, 406 = not acceptable (pode ser ID inválido ou problema de query)
    // Ambos devem ser tratados como "não encontrado" para não quebrar o fluxo de matches normais
    if (error.code === 'PGRST116' || error.code === 'PGRST406') {
      return null;
    }
    // Para outros erros, logar mas retornar null (não quebrar o fluxo)
    console.log('Erro ao buscar casual match (tratado como não encontrado):', error);
    return null;
  }

  return data;
};

/**
 * Atualiza um jogo avulso
 */
export const updateCasualMatch = async (
  id: string,
  userId: string,
  updates: Partial<Omit<CasualMatchInsert, 'id' | 'user_id' | 'created_at' | 'share_token'>>
): Promise<CasualMatch> => {
  const { data, error } = await supabase
    .from('casual_matches')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Jogo avulso não encontrado');

  return data;
};

/**
 * Delete de um jogo avulso (hard delete)
 * Nota: Usa DELETE real ao invés de soft delete para evitar problemas com RLS
 */
export const deleteCasualMatch = async (id: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('casual_matches')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
};

/**
 * Busca jogo avulso por share_token (para compartilhamento)
 */
export const getCasualMatchByToken = async (token: string): Promise<CasualMatch | null> => {
  const { data, error } = await supabase
    .from('casual_matches')
    .select('*')
    .eq('share_token', token)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
};

