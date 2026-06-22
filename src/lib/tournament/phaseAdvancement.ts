import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { TournamentFormatId, TieBreakerCriterion } from '@/types/volleyball';
import { isMatchCompleted } from '@/utils/matchStatus';
import { getMatchConfigFromFormat } from '@/utils/matchConfig';
import { phaseSequences } from './phaseConfig';
import {
  buildBracketContext,
  resolveBracketMatches,
  syncTournamentBracket,
} from './bracket';

type Match = Tables<'matches'>;

export interface PhaseAdvancementCheck {
  canAdvance: boolean;
  currentPhase: string;
  totalMatches: number;
  completedMatches: number;
  pendingMatches: Match[];
  message: string;
}

export interface AdvancePhaseOptions {
  tournamentId: string;
  currentPhase: string;
  formatId: TournamentFormatId;
  includeThirdPlace: boolean;
  tieBreakerOrder?: TieBreakerCriterion[];
  pointsPerSet?: number[];
  sideSwitchSum?: number[];
  bestOf?: number;
  modality?: string;
  directWinFormat?: boolean;
}

export interface AdvancePhaseResult {
  success: boolean;
  message: string;
  newMatches?: Match[];
  error?: string;
}

export interface MatchSuggestion {
  teamAId: string | null;
  teamBId: string | null;
  teamALabel: string;
  teamBLabel: string;
}

export const checkPhaseCompletion = async (
  tournamentId: string,
  phase: string,
): Promise<PhaseAdvancementCheck> => {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('phase', phase);

  if (error || !matches) {
    return {
      canAdvance: false,
      currentPhase: phase,
      totalMatches: 0,
      completedMatches: 0,
      pendingMatches: [],
      message: 'Erro ao carregar jogos da fase',
    };
  }

  const completedMatches = matches.filter((m) => isMatchCompleted(m.status));
  const pendingMatches = matches.filter((m) => !isMatchCompleted(m.status));

  const canAdvance = pendingMatches.length === 0 && matches.length > 0;

  return {
    canAdvance,
    currentPhase: phase,
    totalMatches: matches.length,
    completedMatches: completedMatches.length,
    pendingMatches,
    message: canAdvance
      ? 'Todos os jogos foram finalizados'
      : `Ainda existem ${pendingMatches.length} jogo(s) pendente(s)`,
  };
};

export const getTournamentPhases = async (tournamentId: string): Promise<string[]> => {
  const { data: matches } = await supabase
    .from('matches')
    .select('phase')
    .eq('tournament_id', tournamentId);

  if (!matches) return [];

  const phases = Array.from(
    new Set(matches.map((m) => m.phase).filter((p): p is string => Boolean(p))),
  );

  const phaseOrder = [
    'Fase de Grupos',
    'Primeira Rodada',
    '32 avos de final',
    'Oitavas de final',
    'Chave de Vencedores - R1',
    'Chave de Vencedores - R2',
    'Repescagem',
    'Quartas de final',
    'Semifinal',
    'Série Ouro',
    'Série Prata',
    'Finais',
    'Disputa 3º lugar',
    'Disputa 3º lugar Ouro',
    'Disputa 3º lugar Prata',
    'Final Ouro',
    'Final Prata',
    'Final',
  ];

  return phases.sort((a, b) => {
    const indexA = phaseOrder.indexOf(a);
    const indexB = phaseOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'pt-BR');
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

const resolvedToInsert = async (
  options: AdvancePhaseOptions,
  resolved: ReturnType<typeof resolveBracketMatches>,
): Promise<TablesInsert<'matches'>[]> => {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', options.tournamentId)
    .single();

  if (!tournament) return [];

  const inserts: TablesInsert<'matches'>[] = [];

  for (const item of resolved) {
    const configKey = item.configType;
    const fieldMap: Record<string, string | null | undefined> = {
      groups: tournament.match_format_groups,
      quarterfinals: tournament.match_format_quarterfinals,
      semifinals: tournament.match_format_semifinals,
      final: tournament.match_format_final,
      thirdPlace: tournament.match_format_third_place,
    };
    const matchConfig = getMatchConfigFromFormat(fieldMap[configKey] ?? undefined);

    inserts.push({
      tournament_id: options.tournamentId,
      team_a_id: item.teamAId,
      team_b_id: item.teamBId,
      phase: item.phase,
      status: 'scheduled',
      match_key: item.key,
      points_per_set: options.pointsPerSet || matchConfig.pointsPerSet,
      side_switch_sum: options.sideSwitchSum || matchConfig.sideSwitchSum,
      best_of: options.bestOf || matchConfig.bestOf,
      modality: options.modality || tournament.modality || 'dupla',
      direct_win_format: options.directWinFormat ?? false,
    });
  }

  return inserts;
};

/**
 * Sugere confrontos resolvíveis pelo motor de bracket (sem persistir).
 */
export const suggestNextPhaseMatches = async (
  options: AdvancePhaseOptions,
): Promise<TablesInsert<'matches'>[]> => {
  const sequence = phaseSequences[options.formatId];
  if (!sequence) return [];

  const currentIndex = sequence.indexOf(options.currentPhase);
  if (currentIndex === -1 || currentIndex >= sequence.length - 1) return [];

  const ctx = await buildBracketContext(options.tournamentId, options.formatId, {
    tieBreakerOrder: options.tieBreakerOrder,
    includeThirdPlace: options.includeThirdPlace,
  });
  if (!ctx) return [];

  const resolved = resolveBracketMatches(ctx);
  const existingKeys = new Set(ctx.matchByKey.keys());

  const pending = resolved.filter((m) => !existingKeys.has(m.key));
  return resolvedToInsert(options, pending);
};

/**
 * Sincroniza confrontos automaticamente via motor de bracket.
 */
export const advanceToNextPhase = async (
  options: AdvancePhaseOptions,
): Promise<AdvancePhaseResult> => {
  try {
    const syncResult = await syncTournamentBracket(options.tournamentId);

    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', options.tournamentId)
      .order('created_at', { ascending: false })
      .limit(syncResult.created);

    return {
      success: true,
      message:
        syncResult.created > 0
          ? `${syncResult.created} confronto(s) gerado(s) automaticamente`
          : syncResult.updated > 0
            ? `${syncResult.updated} confronto(s) atualizado(s)`
            : 'Nenhum confronto novo disponível no momento',
      newMatches: matches ?? [],
    };
  } catch (error) {
    return {
      success: false,
      message: 'Erro ao avançar fase',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
};

/** Dispara sincronização do bracket após conclusão de um jogo */
export const onMatchCompleted = async (tournamentId: string): Promise<void> => {
  try {
    await syncTournamentBracket(tournamentId);
  } catch (error) {
    console.error('[onMatchCompleted] Falha ao sincronizar bracket:', error);
  }
};
