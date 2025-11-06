import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import {
  TournamentFormatId,
  TournamentMatch,
  TournamentStanding,
  TournamentTeam,
  TieBreakerCriterion,
} from '@/types/volleyball';
import { calculateGroupStandings } from './standings';
import { GroupStanding, computeStandingsByGroup } from '@/utils/tournamentStandings';
import { getMatchConfigFromFormat } from '@/utils/matchConfig';
import { isMatchCompleted } from '@/utils/matchStatus';

type Match = Tables<'matches'>;
type Team = Tables<'teams'>;
type MatchScore = Tables<'match_scores'>;

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
}

export interface AdvancePhaseResult {
  success: boolean;
  message: string;
  newMatches?: Match[];
  error?: string;
}

type PhaseHandlerContext = {
  options: AdvancePhaseOptions;
  teams: Team[];
  matches: Match[];
  matchScores: MatchScore[];
};

type PhaseHandler = (context: PhaseHandlerContext) => Promise<TablesInsert<'matches'>[]>;

/**
 * Verifica se a fase atual pode ser finalizada
 */
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

/**
 * Calcula os classificados de cada grupo
 */
const calculateGroupQualifiers = async (
  tournamentId: string,
  teams: Team[],
  matches: Match[],
  matchScores: MatchScore[],
  tieBreakerOrder: TieBreakerCriterion[],
): Promise<Map<string, { first: string; second: string }>> => {
  // Buscar grupos das equipes
  const { data: tournamentTeams } = await supabase
    .from('tournament_teams')
    .select('team_id, group_label')
    .eq('tournament_id', tournamentId);

  if (!tournamentTeams) {
    throw new Error('Não foi possível carregar os grupos das equipes');
  }

  // Agrupar equipes por grupo
  const groupTeams = new Map<string, string[]>();
  tournamentTeams.forEach((tt) => {
    if (tt.group_label) {
      if (!groupTeams.has(tt.group_label)) {
        groupTeams.set(tt.group_label, []);
      }
      groupTeams.get(tt.group_label)!.push(tt.team_id);
    }
  });

  // Calcular classificação de cada grupo
  const qualifiers = new Map<string, { first: string; second: string }>();

  for (const [groupLabel, teamIds] of groupTeams.entries()) {
    // Filtrar jogos do grupo
    const groupMatches = matches.filter((m) => {
      return teamIds.includes(m.team_a_id) && teamIds.includes(m.team_b_id);
    });

    // Converter para formato esperado pela função de standings
    const tournamentTeamObjects: TournamentTeam[] = teamIds
      .map((teamId) => {
        const team = teams.find((t) => t.id === teamId);
        if (!team) return null;
        return {
          id: `tt-${teamId}`,
          seed: 1,
          team: {
            name: team.name,
            players: [
              { name: team.player_a, number: 1 },
              { name: team.player_b, number: 2 },
            ],
          },
        };
      })
      .filter((t): t is TournamentTeam => t !== null);

    const tournamentMatchObjects: TournamentMatch[] = groupMatches.map((m) => {
      const teamA = teams.find((t) => t.id === m.team_a_id);
      const teamB = teams.find((t) => t.id === m.team_b_id);
      const matchScoresForMatch = matchScores.filter((ms) => ms.match_id === m.id);

      // Calcular resultado
      let result = undefined;
      if (isMatchCompleted(m.status) && matchScoresForMatch.length > 0) {
        const setsWonA = matchScoresForMatch.filter(
          (s) => s.team_a_points > s.team_b_points,
        ).length;
        const setsWonB = matchScoresForMatch.filter(
          (s) => s.team_b_points > s.team_a_points,
        ).length;

        result = {
          winner: (setsWonA > setsWonB ? 'A' : 'B') as 'A' | 'B',
          sets: matchScoresForMatch.map((s) => ({
            setNumber: s.set_number,
            teamAScore: s.team_a_points,
            teamBScore: s.team_b_points,
          })),
        };
      }

      return {
        id: m.id,
        gameId: m.id,
        tournamentId: m.tournament_id,
        title: `${teamA?.name || 'A'} vs ${teamB?.name || 'B'}`,
        category: 'Misto',
        modality: 'dupla' as const,
        format: 'melhorDe3' as const,
        teamA: {
          name: teamA?.name || 'A',
          players: [
            { name: teamA?.player_a || 'A1', number: 1 },
            { name: teamA?.player_b || 'A2', number: 2 },
          ],
        },
        teamB: {
          name: teamB?.name || 'B',
          players: [
            { name: teamB?.player_a || 'B1', number: 1 },
            { name: teamB?.player_b || 'B2', number: 2 },
          ],
        },
        phaseId: 'fase-grupos',
        phaseName: m.phase || 'Fase de Grupos',
        round: 1,
        groupId: groupLabel,
        groupName: groupLabel,
        teamAId: `tt-${m.team_a_id}`,
        teamBId: `tt-${m.team_b_id}`,
        result,
        pointsPerSet: [21, 21, 15],
        needTwoPointLead: true,
        sideSwitchSum: [7, 7, 5],
        hasTechnicalTimeout: false,
        technicalTimeoutSum: 0,
        teamTimeoutsPerSet: 2,
        teamTimeoutDurationSec: 30,
        coinTossMode: 'initialThenAlternate' as const,
        status: 'agendado' as const,
        createdAt: m.created_at || new Date().toISOString(),
        updatedAt: m.created_at || new Date().toISOString(),
        hasStatistics: true,
      };
    });

    const groupObj = {
      id: groupLabel,
      name: groupLabel,
      phaseId: 'fase-grupos',
      teamIds: tournamentTeamObjects.map((t) => t.id),
    };

    // Calcular standings
    const standings = calculateGroupStandings({
      matches: tournamentMatchObjects,
      teams: tournamentTeamObjects,
      group: groupObj,
      tieBreakerOrder,
    });

    if (standings.length >= 2) {
      // Pegar os team_ids originais (remover o prefixo 'tt-')
      const firstTeamId = standings[0].teamId.replace('tt-', '');
      const secondTeamId = standings[1].teamId.replace('tt-', '');

      qualifiers.set(groupLabel, {
        first: firstTeamId,
        second: secondTeamId,
      });
    }
  }

  return qualifiers;
};

/**
 * Cria os jogos da fase eliminatória baseado no formato "groups_and_knockout"
 */
const createKnockoutMatches = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, { first: string; second: string }>,
): Promise<TablesInsert<'matches'>[]> => {
  const newMatches: TablesInsert<'matches'>[] = [];

  const sortedGroups = Array.from(qualifiers.entries()).sort(([labelA], [labelB]) =>
    labelA.localeCompare(labelB, 'pt-BR'),
  );

  if (sortedGroups.length !== 4) {
    throw new Error('O formato de grupos + eliminatória requer exatamente 4 grupos.');
  }

  const [groupA, groupB, groupC, groupD] = sortedGroups.map(([, value]) => value);

  // Obter configurações do torneio
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('match_format_quarterfinals')
    .eq('id', options.tournamentId)
    .single();

  const matchConfig = getMatchConfigFromFormat(tournament?.match_format_quarterfinals);
  const pointsPerSet = options.pointsPerSet || matchConfig.pointsPerSet;
  const sideSwitchSum = options.sideSwitchSum || matchConfig.sideSwitchSum;
  const bestOf = options.bestOf || matchConfig.bestOf;
  const modality = options.modality || 'dupla';

  // Quartas de final
  newMatches.push(
    {
      tournament_id: options.tournamentId,
      team_a_id: groupA.first,
      team_b_id: groupD.second,
      phase: 'Quartas de final',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: groupB.first,
      team_b_id: groupC.second,
      phase: 'Quartas de final',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: groupC.first,
      team_b_id: groupB.second,
      phase: 'Quartas de final',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: groupD.first,
      team_b_id: groupA.second,
      phase: 'Quartas de final',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
  );

  return newMatches;
};

/**
 * Cria os jogos da semifinal baseado nos vencedores das quartas
 */
const createSemifinalMatches = async (
  options: AdvancePhaseOptions,
  quarterfinalsMatches: Match[],
): Promise<TablesInsert<'matches'>[]> => {
  if (quarterfinalsMatches.length !== 4) {
    throw new Error('É necessário ter exatamente 4 jogos de quartas finalizados');
  }

  const newMatches: TablesInsert<'matches'>[] = [];

  // Obter configurações do torneio
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('match_format_semifinals')
    .eq('id', options.tournamentId)
    .single();

  const matchConfig = getMatchConfigFromFormat(tournament?.match_format_semifinals);
  const pointsPerSet = options.pointsPerSet || matchConfig.pointsPerSet;
  const sideSwitchSum = options.sideSwitchSum || matchConfig.sideSwitchSum;
  const bestOf = options.bestOf || matchConfig.bestOf;
  const modality = options.modality || 'dupla';

  // Buscar os vencedores
  const winners: string[] = [];
  for (const match of quarterfinalsMatches) {
    const { data: scores } = await supabase
      .from('match_scores')
      .select('*')
      .eq('match_id', match.id);

    if (scores && scores.length > 0) {
      const setsWonA = scores.filter((s) => s.team_a_points > s.team_b_points).length;
      const setsWonB = scores.filter((s) => s.team_b_points > s.team_a_points).length;
      const winner = setsWonA > setsWonB ? match.team_a_id : match.team_b_id;
      winners.push(winner);
    }
  }

  if (winners.length !== 4) {
    throw new Error('Não foi possível identificar todos os vencedores das quartas');
  }

  // Semifinais: Vencedor Q1 x Vencedor Q2, Vencedor Q3 x Vencedor Q4
  newMatches.push(
    {
      tournament_id: options.tournamentId,
      team_a_id: winners[0],
      team_b_id: winners[1],
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: winners[2],
      team_b_id: winners[3],
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
  );

  return newMatches;
};

/**
 * Cria os jogos finais (final e 3º lugar) baseado nas semifinais
 */
const createFinalMatches = async (
  options: AdvancePhaseOptions,
  semifinalMatches: Match[],
): Promise<TablesInsert<'matches'>[]> => {
  if (semifinalMatches.length !== 2) {
    throw new Error('É necessário ter exatamente 2 jogos de semifinal finalizados');
  }

  const newMatches: TablesInsert<'matches'>[] = [];
  const pointsPerSet = options.pointsPerSet || [21, 21, 15];
  const sideSwitchSum = options.sideSwitchSum || [7, 7, 5];
  const bestOf = options.bestOf || 3;
  const modality = options.modality || 'dupla';

  // Buscar vencedores e perdedores
  const winners: string[] = [];
  const losers: string[] = [];

  for (const match of semifinalMatches) {
    const { data: scores } = await supabase
      .from('match_scores')
      .select('*')
      .eq('match_id', match.id);

    if (scores && scores.length > 0) {
      const setsWonA = scores.filter((s) => s.team_a_points > s.team_b_points).length;
      const setsWonB = scores.filter((s) => s.team_b_points > s.team_a_points).length;

      if (setsWonA > setsWonB) {
        winners.push(match.team_a_id);
        losers.push(match.team_b_id);
      } else {
        winners.push(match.team_b_id);
        losers.push(match.team_a_id);
      }
    }
  }

  if (winners.length !== 2 || losers.length !== 2) {
    throw new Error('Não foi possível identificar vencedores e perdedores das semifinais');
  }

  // Disputa de 3º lugar (se configurado)
  if (options.includeThirdPlace) {
    newMatches.push({
      tournament_id: options.tournamentId,
      team_a_id: losers[0],
      team_b_id: losers[1],
      phase: 'Disputa 3º lugar',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    });
  }

  // Final
  newMatches.push({
    tournament_id: options.tournamentId,
    team_a_id: winners[0],
    team_b_id: winners[1],
    phase: 'Final',
    status: 'scheduled',
    points_per_set: pointsPerSet,
    side_switch_sum: sideSwitchSum,
    best_of: bestOf,
    modality,
  });

  return newMatches;
};

/**
 * Avança para a próxima fase do torneio
 */
export const advanceToNextPhase = async (
  options: AdvancePhaseOptions,
): Promise<AdvancePhaseResult> => {
  try {
    const phaseSequences: Partial<Record<TournamentFormatId, string[]>> = {
      groups_and_knockout: ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
    };

    const formatHandlers: Partial<Record<TournamentFormatId, Record<string, PhaseHandler>>> = {
      groups_and_knockout: {
        'Fase de Grupos': async (context) => {
          const qualifiers = await calculateGroupQualifiers(
            context.options.tournamentId,
            context.teams,
            context.matches,
            context.matchScores,
            context.options.tieBreakerOrder || [],
          );
          return createKnockoutMatches(context.options, qualifiers);
        },
        'Quartas de final': async (context) => {
          const quarterfinalsMatches = context.matches.filter((m) => m.phase === 'Quartas de final');
          return createSemifinalMatches(context.options, quarterfinalsMatches);
        },
        Semifinal: async (context) => {
          const semifinalMatches = context.matches.filter((m) => m.phase === 'Semifinal');
          return createFinalMatches(context.options, semifinalMatches);
        },
      },
    };

    const formatPhases = phaseSequences[options.formatId];
    if (!formatPhases) {
      return {
        success: false,
        message: 'Formato de torneio não suportado para avanço automático.',
        error: `Formato ${options.formatId} não possui configuração de fases cadastrada.`,
      };
    }

    const currentPhaseIndex = formatPhases.indexOf(options.currentPhase);
    if (currentPhaseIndex === -1 || currentPhaseIndex === formatPhases.length - 1) {
      return {
        success: false,
        message: 'Fase atual não pode ser avançada',
        error: 'Fase não reconhecida ou já é a fase final',
      };
    }

    const nextPhase = formatPhases[currentPhaseIndex + 1];
    const handler = formatHandlers[options.formatId]?.[options.currentPhase];

    if (!handler) {
      return {
        success: false,
        message: 'Avanço automático não configurado para esta fase.',
        error: `Fase "${options.currentPhase}" não possui regra de transição no formato ${options.formatId}.`,
      };
    }

    // Buscar dados necessários
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .in(
        'id',
        (
          await supabase
            .from('tournament_teams')
            .select('team_id')
            .eq('tournament_id', options.tournamentId)
        ).data?.map((tt) => tt.team_id) || [],
      );

    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', options.tournamentId);

    const { data: matchScores } = await supabase
      .from('match_scores')
      .select('*')
      .in(
        'match_id',
        matches?.map((m) => m.id) || [],
      );

    if (!teams || !matches || !matchScores) {
      throw new Error('Erro ao carregar dados do torneio');
    }

    const handlerContext: PhaseHandlerContext = {
      options,
      teams,
      matches,
      matchScores,
    };

    const newMatchesPayload = await handler(handlerContext);

    // Inserir novos jogos
    const { data: createdMatches, error: insertError } = await supabase
      .from('matches')
      .insert(newMatchesPayload)
      .select();

    if (insertError) {
      throw insertError;
    }

    return {
      success: true,
      message: `Fase "${nextPhase}" criada com sucesso! ${createdMatches?.length || 0} jogo(s) adicionado(s).`,
      newMatches: createdMatches || [],
    };
  } catch (error) {
    console.error('Erro ao avançar fase:', error);
    return {
      success: false,
      message: 'Erro ao avançar para próxima fase',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
};

/**
 * Obtém a lista de fases disponíveis no torneio
 */
export const getTournamentPhases = async (
  tournamentId: string,
): Promise<string[]> => {
  const { data: matches } = await supabase
    .from('matches')
    .select('phase')
    .eq('tournament_id', tournamentId);

  if (!matches) return [];

  const phases = Array.from(new Set(matches.map((m) => m.phase).filter((p): p is string => Boolean(p))));
  
  // Ordenar fases na ordem lógica
  const phaseOrder = ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Disputa 3º lugar', 'Final'];
  return phases.sort((a, b) => {
    const indexA = phaseOrder.indexOf(a);
    const indexB = phaseOrder.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

