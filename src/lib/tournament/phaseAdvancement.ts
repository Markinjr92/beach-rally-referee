import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import {
  TournamentFormatId,
  TieBreakerCriterion,
} from '@/types/volleyball';
import { getMatchConfigFromFormat } from '@/utils/matchConfig';
import { isMatchCompleted } from '@/utils/matchStatus';
import { buildGroupAssignments, computeStandingsByGroup } from '@/utils/tournamentStandings';
import { phaseSequences } from './phaseConfig';

type Match = Tables<'matches'>;
type Team = Tables<'teams'>;
type MatchScore = Tables<'match_scores'>;
type EnrichedStanding = {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  matchPoints: number;
};

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
type GroupQualifierEntry = {
  first: string;
  second: string;
  third?: string;
  standings: EnrichedStanding[];
};

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
  _tieBreakerOrder: TieBreakerCriterion[],
): Promise<Map<string, GroupQualifierEntry>> => {
  const { data: tournamentTeams } = await supabase
    .from('tournament_teams')
    .select('team_id, group_label')
    .eq('tournament_id', tournamentId);

  if (!tournamentTeams) {
    throw new Error('Não foi possível carregar os grupos das equipes');
  }

  const teamGroups: Record<string, string | null> = {};
  tournamentTeams.forEach((tt) => {
    teamGroups[tt.team_id] = tt.group_label;
  });

  const groupAssignments = buildGroupAssignments(teams, teamGroups);

  const scoresByMatch = new Map<string, MatchScore[]>();
  matchScores.forEach((score) => {
    if (!scoresByMatch.has(score.match_id)) {
      scoresByMatch.set(score.match_id, []);
    }
    scoresByMatch.get(score.match_id)!.push(score);
  });
  scoresByMatch.forEach((scores) => {
    scores.sort((a, b) => a.set_number - b.set_number);
  });

  const teamNameMap = new Map<string, string>();
  teams.forEach((team) => {
    teamNameMap.set(team.id, team.name);
  });

  const standingsByGroup = computeStandingsByGroup({
    matches,
    scoresByMatch,
    groupAssignments,
    teamNameMap,
  });

  const qualifiers = new Map<string, GroupQualifierEntry>();

  standingsByGroup.forEach((group) => {
    if (group.standings.length < 2) return;
    const [first, second, third] = group.standings;

    qualifiers.set(group.key, {
      first: first.teamId,
      second: second.teamId,
      third: third?.teamId,
      standings: group.standings.map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        matchesPlayed: entry.matchesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        setsWon: entry.setsWon,
        setsLost: entry.setsLost,
        pointsFor: entry.pointsFor,
        pointsAgainst: entry.pointsAgainst,
        matchPoints: entry.matchPoints,
      })),
    });
  });

  return qualifiers;
};

/**
 * Cria os jogos da fase eliminatória baseado no formato "groups_and_knockout"
 */
const createKnockoutMatches = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, GroupQualifierEntry>,
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

type ThirdPlaceCandidate = {
  groupLabel: string;
  teamId: string;
  standing: EnrichedStanding;
};

const compareDesc = (a: number, b: number) => {
  if (a === b) return 0;
  if (a > b) return -1;
  return 1;
};

const computeRatio = (won: number, lost: number) => {
  if (won === 0 && lost === 0) return 0;
  if (lost === 0) return Number.POSITIVE_INFINITY;
  return won / lost;
};

const compareThirdStandings = (a: EnrichedStanding, b: EnrichedStanding) => {
  if (a.matchPoints !== b.matchPoints) {
    return compareDesc(a.matchPoints, b.matchPoints);
  }

  if (a.wins !== b.wins) {
    return compareDesc(a.wins, b.wins);
  }

  const setsRatioA = computeRatio(a.setsWon, a.setsLost);
  const setsRatioB = computeRatio(b.setsWon, b.setsLost);
  if (setsRatioA !== setsRatioB) {
    return compareDesc(setsRatioA, setsRatioB);
  }

  const pointsRatioA = computeRatio(a.pointsFor, a.pointsAgainst);
  const pointsRatioB = computeRatio(b.pointsFor, b.pointsAgainst);
  if (pointsRatioA !== pointsRatioB) {
    return compareDesc(pointsRatioA, pointsRatioB);
  }

  if (a.pointsFor !== b.pointsFor) {
    return compareDesc(a.pointsFor, b.pointsFor);
  }

  return a.teamName.localeCompare(b.teamName, 'pt-BR');
};

const selectBestThirdPlacedTeams = (
  sortedGroups: Array<[string, GroupQualifierEntry]>,
  count: number,
): ThirdPlaceCandidate[] => {
  const candidates: ThirdPlaceCandidate[] = [];

  sortedGroups.forEach(([label, entry]) => {
    if (!entry.third) return;
    const standing = entry.standings.find((item) => item.teamId === entry.third);
    if (!standing) return;
    candidates.push({
      groupLabel: label,
      teamId: entry.third,
      standing,
    });
  });

  candidates.sort((a, b) => compareThirdStandings(a.standing, b.standing));
  return candidates.slice(0, count);
};

const createThreeGroupQuarterfinalMatches = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, GroupQualifierEntry>,
): Promise<TablesInsert<'matches'>[]> => {
  const sortedGroups = Array.from(qualifiers.entries()).sort(([labelA], [labelB]) =>
    labelA.localeCompare(labelB, 'pt-BR'),
  );

  if (sortedGroups.length !== 3) {
    throw new Error('O formato 3 grupos + quartas requer exatamente 3 grupos configurados.');
  }

  const [groupA, groupB, groupC] = sortedGroups.map(([, value]) => value);

  const bestThirds = selectBestThirdPlacedTeams(sortedGroups, 2);
  if (bestThirds.length < 2) {
    throw new Error('Não foi possível determinar os dois melhores terceiros colocados.');
  }

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

  const newMatches: TablesInsert<'matches'>[] = [
    {
      tournament_id: options.tournamentId,
      team_a_id: groupA.first,
      team_b_id: bestThirds[0].teamId,
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
      team_a_id: groupA.second,
      team_b_id: bestThirds[1].teamId,
      phase: 'Quartas de final',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
  ];

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
 * Cria os jogos finais (final e 3º lugar) baseado na classificação do round-robin de 6 duplas
 */
const createRoundRobinFinals = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, GroupQualifierEntry>,
): Promise<TablesInsert<'matches'>[]> => {
  const newMatches: TablesInsert<'matches'>[] = [];

  // Obter configurações do torneio
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('match_format_final, match_format_third_place')
    .eq('id', options.tournamentId)
    .single();

  const finalConfig = getMatchConfigFromFormat(tournament?.match_format_final);
  const thirdPlaceConfig = getMatchConfigFromFormat(tournament?.match_format_third_place);

  const pointsPerSetFinal = options.pointsPerSet || finalConfig.pointsPerSet;
  const sideSwitchSumFinal = options.sideSwitchSum || finalConfig.sideSwitchSum;
  const bestOfFinal = options.bestOf || finalConfig.bestOf;
  const modality = options.modality || 'dupla';

  const pointsPerSetThird = options.pointsPerSet || thirdPlaceConfig.pointsPerSet;
  const sideSwitchSumThird = options.sideSwitchSum || thirdPlaceConfig.sideSwitchSum;
  const bestOfThird = options.bestOf || thirdPlaceConfig.bestOf;

  // Deve haver apenas um grupo (grupo único)
  if (qualifiers.size !== 1) {
    throw new Error('O formato round-robin de 6 duplas requer exatamente 1 grupo.');
  }

  const [groupKey, groupEntry] = Array.from(qualifiers.entries())[0];

  if (!groupEntry) {
    throw new Error('Grupo não encontrado');
  }

  // Verificar se há pelo menos 4 equipes classificadas
  if (groupEntry.standings.length < 4) {
    throw new Error('É necessário ter pelo menos 4 equipes classificadas para criar as finais.');
  }

  const [first, second, third, fourth] = groupEntry.standings;

  if (!first || !second) {
    throw new Error('É necessário ter pelo menos 2 equipes classificadas para criar a final.');
  }

  // Final: 1º vs 2º
  newMatches.push({
    tournament_id: options.tournamentId,
    team_a_id: first.teamId,
    team_b_id: second.teamId,
    phase: 'Final',
    status: 'scheduled',
    points_per_set: pointsPerSetFinal,
    side_switch_sum: sideSwitchSumFinal,
    best_of: bestOfFinal,
    modality,
  });

  // Disputa de 3º lugar (opcional): 3º vs 4º
  if (options.includeThirdPlace && third && fourth) {
    newMatches.push({
      tournament_id: options.tournamentId,
      team_a_id: third.teamId,
      team_b_id: fourth.teamId,
      phase: 'Disputa 3º lugar',
      status: 'scheduled',
      points_per_set: pointsPerSetThird,
      side_switch_sum: sideSwitchSumThird,
      best_of: bestOfThird,
      modality,
    });
  }

  return newMatches;
};

/**
 * Cria os jogos finais (final e 3º lugar) baseado nas semifinais
 */
const createFinalMatches = async (
  options: AdvancePhaseOptions,
  semifinalMatches: Match[],
): Promise<TablesInsert<'matches'>[]> => {
  // Filtrar apenas matches finalizados
  const completedSemifinals = semifinalMatches.filter((m) => isMatchCompleted(m.status));
  
  if (completedSemifinals.length !== 2) {
    throw new Error(
      `É necessário ter exatamente 2 jogos de semifinal finalizados. Encontrados ${completedSemifinals.length} de ${semifinalMatches.length} semifinais finalizadas.`
    );
  }

  // Buscar nomes das equipes para debug
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', [
      ...completedSemifinals.map(m => m.team_a_id).filter(Boolean),
      ...completedSemifinals.map(m => m.team_b_id).filter(Boolean),
    ]);

  const teamNameMap = new Map<string, string>();
  allTeams?.forEach((team) => {
    teamNameMap.set(team.id, team.name);
  });

  const newMatches: TablesInsert<'matches'>[] = [];
  const pointsPerSet = options.pointsPerSet || [21, 21, 15];
  const sideSwitchSum = options.sideSwitchSum || [7, 7, 5];
  const bestOf = options.bestOf || 3;
  const modality = options.modality || 'dupla';

  // Ordenar matches por ID para garantir ordem consistente
  const sortedSemifinals = [...completedSemifinals].sort((a, b) => 
    a.id.localeCompare(b.id)
  );

  // Buscar vencedores e perdedores
  const winners: string[] = [];
  const losers: string[] = [];

  for (const match of sortedSemifinals) {

    if (!match.team_a_id || !match.team_b_id) {
      console.warn(`Match ${match.id} não tem equipes definidas`);
      continue;
    }

    let setsWonA = 0;
    let setsWonB = 0;
    let matchState: { sets_won: unknown; scores: unknown; is_game_ended: boolean } | null = null;

    // Tentar obter resultados de match_scores primeiro
    const { data: scores } = await supabase
      .from('match_scores')
      .select('*')
      .eq('match_id', match.id)
      .order('set_number', { ascending: true });

    if (scores && scores.length > 0) {
      setsWonA = scores.filter((s) => s.team_a_points > s.team_b_points).length;
      setsWonB = scores.filter((s) => s.team_b_points > s.team_a_points).length;
    } else {
      // Se não encontrar em match_scores, tentar match_states
      const { data: stateData } = await supabase
        .from('match_states')
        .select('sets_won, scores, is_game_ended, left_is_team_a')
        .eq('match_id', match.id)
        .maybeSingle();

      matchState = stateData;

      if (matchState && matchState.is_game_ended) {
        const leftIsTeamA = matchState.left_is_team_a ?? true;
        const setsWon = matchState.sets_won as { teamA: number; teamB: number } | null;
        
        console.log(`[createFinalMatches] Match ${match.id} - match_states raw data:`, {
          left_is_team_a: leftIsTeamA,
          sets_won_raw: setsWon,
          team_a_id: match.team_a_id,
          team_b_id: match.team_b_id,
        });
        
        if (setsWon) {
          // No match_states, teamA/teamB referem-se à posição na tela (esquerda/direita)
          // Precisamos mapear para team_a_id/team_b_id do match
          if (leftIsTeamA) {
            // teamA na tela = team_a_id do match
            setsWonA = setsWon.teamA || 0;
            setsWonB = setsWon.teamB || 0;
            console.log(`[createFinalMatches] leftIsTeamA=true: setsWonA=${setsWonA} (teamA tela), setsWonB=${setsWonB} (teamB tela)`);
          } else {
            // teamA na tela = team_b_id do match (invertido)
            setsWonA = setsWon.teamB || 0;
            setsWonB = setsWon.teamA || 0;
            console.log(`[createFinalMatches] leftIsTeamA=false: INVERTENDO - setsWonA=${setsWonA} (teamB tela), setsWonB=${setsWonB} (teamA tela)`);
          }
        } else if (matchState.scores) {
          // Calcular sets ganhos a partir dos scores
          const stateScores = matchState.scores as { teamA: number[]; teamB: number[] } | null;
          if (stateScores && stateScores.teamA && stateScores.teamB) {
            for (let i = 0; i < Math.max(stateScores.teamA.length, stateScores.teamB.length); i++) {
              const scoreLeft = stateScores.teamA[i] || 0;
              const scoreRight = stateScores.teamB[i] || 0;
              
              // Mapear scores da tela para team_a_id/team_b_id
              if (leftIsTeamA) {
                // Esquerda = team_a_id, Direita = team_b_id
                if (scoreLeft > scoreRight) {
                  setsWonA++;
                } else if (scoreRight > scoreLeft) {
                  setsWonB++;
                }
              } else {
                // Esquerda = team_b_id, Direita = team_a_id (invertido)
                if (scoreLeft > scoreRight) {
                  setsWonB++;
                } else if (scoreRight > scoreLeft) {
                  setsWonA++;
                }
              }
            }
          }
        }
      }
    }

    // Verificar se conseguimos determinar um vencedor
    if (setsWonA === 0 && setsWonB === 0) {
      console.warn(`Match ${match.id} não tem sets definidos ou não está finalizado corretamente`);
      continue;
    }

    const teamAName = teamNameMap.get(match.team_a_id || '') || 'N/A';
    const teamBName = teamNameMap.get(match.team_b_id || '') || 'N/A';
    
    console.log(`[createFinalMatches] Processando semifinal ${match.id}:`, {
      teamA: `${teamAName} (${match.team_a_id})`,
      teamB: `${teamBName} (${match.team_b_id})`,
      setsWonA,
      setsWonB,
      scoresLength: scores?.length || 0,
      hasMatchState: !!matchState,
      leftIsTeamA: matchState?.left_is_team_a ?? true,
      setsWonFromState: matchState?.sets_won,
    });

    if (setsWonA > setsWonB) {
      winners.push(match.team_a_id);
      losers.push(match.team_b_id);
      console.log(`[createFinalMatches] Vencedor: Team A - ${teamAName} (${match.team_a_id}), Perdedor: Team B - ${teamBName} (${match.team_b_id})`);
    } else if (setsWonB > setsWonA) {
      winners.push(match.team_b_id);
      losers.push(match.team_a_id);
      console.log(`[createFinalMatches] Vencedor: Team B - ${teamBName} (${match.team_b_id}), Perdedor: Team A - ${teamAName} (${match.team_a_id})`);
    } else {
      console.warn(`Match ${match.id} terminou em empate (${setsWonA} x ${setsWonB}), não é possível determinar vencedor`);
      continue;
    }
  }

  if (winners.length !== 2 || losers.length !== 2) {
    const errorMsg = `Não foi possível identificar vencedores e perdedores das semifinais. Encontrados ${winners.length} vencedores e ${losers.length} perdedores de ${semifinalMatches.length} semifinais.`;
    console.error(errorMsg, {
      semifinalMatches: semifinalMatches.map(m => ({
        id: m.id,
        status: m.status,
        teamA: m.team_a_id,
        teamB: m.team_b_id,
      })),
    });
    throw new Error(errorMsg);
  }

  const winnersNames = winners.map(id => teamNameMap.get(id || '') || id || 'N/A');
  const losersNames = losers.map(id => teamNameMap.get(id || '') || id || 'N/A');
  
  console.log(`[createFinalMatches] Resumo final:`, {
    winners: winners.map((id, idx) => `${winnersNames[idx]} (${id})`),
    losers: losers.map((id, idx) => `${losersNames[idx]} (${id})`),
    includeThirdPlace: options.includeThirdPlace,
  });

  // Disputa de 3º lugar (se configurado) - PERDEDORES das semifinais
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
    console.log(`[createFinalMatches] Criando Disputa 3º lugar: ${losersNames[0]} (${losers[0]}) x ${losersNames[1]} (${losers[1]})`);
  }

  // Final - VENCEDORES das semifinais
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
  console.log(`[createFinalMatches] Criando Final: ${winnersNames[0]} (${winners[0]}) x ${winnersNames[1]} (${winners[1]})`);

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
      '3_groups_quarterfinals': ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
      '6_teams_round_robin': ['Fase de Grupos', 'Finais'],
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
      '3_groups_quarterfinals': {
        'Fase de Grupos': async (context) => {
          const qualifiers = await calculateGroupQualifiers(
            context.options.tournamentId,
            context.teams,
            context.matches,
            context.matchScores,
            context.options.tieBreakerOrder || [],
          );
          return createThreeGroupQuarterfinalMatches(context.options, qualifiers);
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
      '6_teams_round_robin': {
        'Fase de Grupos': async (context) => {
          const qualifiers = await calculateGroupQualifiers(
            context.options.tournamentId,
            context.teams,
            context.matches,
            context.matchScores,
            context.options.tieBreakerOrder || [],
          );
          return createRoundRobinFinals(context.options, qualifiers);
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

/**
 * Interface para sugestões de confrontos
 */
export interface MatchSuggestion {
  teamAId: string | null;
  teamBId: string | null;
  teamALabel: string;
  teamBLabel: string;
}

/**
 * Sugere confrontos para a próxima fase sem criar os jogos
 */
export const suggestNextPhaseMatches = async (
  options: AdvancePhaseOptions,
): Promise<TablesInsert<'matches'>[]> => {
  const phaseSequences: Partial<Record<TournamentFormatId, string[]>> = {
    groups_and_knockout: ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
    '3_groups_quarterfinals': ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
    '2_groups_5_quarterfinals': ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
    '2_groups_6_cross_semis': ['Fase de Grupos', 'Semifinal', 'Final'],
    '2_groups_3_cross_semis': ['Fase de Grupos', 'Semifinal', 'Final'],
    global_semis: ['Fase de Grupos', 'Semifinal', 'Final'],
    series_gold_silver: ['Fase de Grupos', 'Série Ouro', 'Série Prata'],
    single_elimination: ['Primeira Rodada', 'Quartas de final', 'Semifinal', 'Final'],
    double_elimination: ['Chave de Vencedores - R1', 'Chave de Vencedores - R2', 'Semifinal', 'Final'],
    '6_teams_round_robin': ['Fase de Grupos', 'Finais'],
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
    '3_groups_quarterfinals': {
      'Fase de Grupos': async (context) => {
        const qualifiers = await calculateGroupQualifiers(
          context.options.tournamentId,
          context.teams,
          context.matches,
          context.matchScores,
          context.options.tieBreakerOrder || [],
        );
        return createThreeGroupQuarterfinalMatches(context.options, qualifiers);
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
    '2_groups_5_quarterfinals': {
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
    '2_groups_6_cross_semis': {
      'Fase de Grupos': async (context) => {
        const qualifiers = await calculateGroupQualifiers(
          context.options.tournamentId,
          context.teams,
          context.matches,
          context.matchScores,
          context.options.tieBreakerOrder || [],
        );
        return createCrossGroupSemifinalMatches(context.options, qualifiers);
      },
      Semifinal: async (context) => {
        const semifinalMatches = context.matches.filter((m) => m.phase === 'Semifinal');
        return createFinalMatches(context.options, semifinalMatches);
      },
    },
    '2_groups_3_cross_semis': {
      'Fase de Grupos': async (context) => {
        const qualifiers = await calculateGroupQualifiers(
          context.options.tournamentId,
          context.teams,
          context.matches,
          context.matchScores,
          context.options.tieBreakerOrder || [],
        );
        return createSameGroupSemifinalMatches(context.options, qualifiers);
      },
      Semifinal: async (context) => {
        const semifinalMatches = context.matches.filter((m) => m.phase === 'Semifinal');
        return createFinalMatches(context.options, semifinalMatches);
      },
    },
    global_semis: {
      'Fase de Grupos': async (context) => {
        const qualifiers = await calculateGroupQualifiers(
          context.options.tournamentId,
          context.teams,
          context.matches,
          context.matchScores,
          context.options.tieBreakerOrder || [],
        );
        return createGlobalSemifinalMatches(context.options, qualifiers);
      },
      Semifinal: async (context) => {
        const semifinalMatches = context.matches.filter((m) => m.phase === 'Semifinal');
        return createFinalMatches(context.options, semifinalMatches);
      },
    },
    '6_teams_round_robin': {
      'Fase de Grupos': async (context) => {
        const qualifiers = await calculateGroupQualifiers(
          context.options.tournamentId,
          context.teams,
          context.matches,
          context.matchScores,
          context.options.tieBreakerOrder || [],
        );
        return createRoundRobinFinals(context.options, qualifiers);
      },
    },
  };

  const formatPhases = phaseSequences[options.formatId];
  if (!formatPhases) {
    return [];
  }

  const currentPhaseIndex = formatPhases.indexOf(options.currentPhase);
  if (currentPhaseIndex === -1 || currentPhaseIndex === formatPhases.length - 1) {
    return [];
  }

  const handler = formatHandlers[options.formatId]?.[options.currentPhase];
  if (!handler) {
    return [];
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
    return [];
  }

  // Criar mapa de nomes das equipes para debug
  const teamNameMap = new Map<string, string>();
  teams.forEach((team) => {
    teamNameMap.set(team.id, team.name);
  });

  const handlerContext: PhaseHandlerContext = {
    options,
    teams,
    matches,
    matchScores,
  };

  const result = await handler(handlerContext);
  
  // Log dos resultados com nomes das equipes
  if (result.length > 0) {
    console.log(`[suggestNextPhaseMatches] Sugestões geradas para ${options.currentPhase}:`, 
      result.map(m => ({
        phase: m.phase,
        teamA: m.team_a_id ? `${teamNameMap.get(m.team_a_id) || m.team_a_id} (${m.team_a_id})` : 'null',
        teamB: m.team_b_id ? `${teamNameMap.get(m.team_b_id) || m.team_b_id} (${m.team_b_id})` : 'null',
      }))
    );
  }

  return result;
};

/**
 * Cria sugestões de confrontos para semifinais em formato cruzado (2 grupos)
 */
const createCrossGroupSemifinalMatches = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, GroupQualifierEntry>,
): Promise<TablesInsert<'matches'>[]> => {
  const sortedGroups = Array.from(qualifiers.entries()).sort(([labelA], [labelB]) =>
    labelA.localeCompare(labelB, 'pt-BR'),
  );

  if (sortedGroups.length !== 2) {
    return [];
  }

  const [groupA, groupB] = sortedGroups.map(([, value]) => value);

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

  const newMatches: TablesInsert<'matches'>[] = [
    {
      tournament_id: options.tournamentId,
      team_a_id: groupA.first || null,
      team_b_id: groupB.second || null,
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: groupB.first || null,
      team_b_id: groupA.second || null,
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
  ];

  return newMatches;
};

/**
 * Cria semifinais dentro do mesmo grupo (1º A x 2º A e 1º B x 2º B)
 */
const createSameGroupSemifinalMatches = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, GroupQualifierEntry>,
): Promise<TablesInsert<'matches'>[]> => {
  const sortedGroups = Array.from(qualifiers.entries()).sort(([labelA], [labelB]) =>
    labelA.localeCompare(labelB, 'pt-BR'),
  );

  if (sortedGroups.length !== 2) {
    return [];
  }

  const [groupA, groupB] = sortedGroups.map(([, value]) => value);

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

  const newMatches: TablesInsert<'matches'>[] = [
    {
      tournament_id: options.tournamentId,
      team_a_id: groupA.first || null,
      team_b_id: groupA.second || null,
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: groupB.first || null,
      team_b_id: groupB.second || null,
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
  ];

  return newMatches;
};

/**
 * Cria sugestões de confrontos para semifinais globais (ranking geral)
 */
const createGlobalSemifinalMatches = async (
  options: AdvancePhaseOptions,
  qualifiers: Map<string, GroupQualifierEntry>,
): Promise<TablesInsert<'matches'>[]> => {
  // Para formato global, precisamos ordenar todos os classificados
  const allQualifiers: Array<{ teamId: string; standing: EnrichedStanding }> = [];
  
  qualifiers.forEach((entry) => {
    entry.standings.forEach((standing) => {
      allQualifiers.push({ teamId: standing.teamId, standing });
    });
  });

  // Ordenar por posição (matchPoints, wins, etc)
  allQualifiers.sort((a, b) => {
    if (a.standing.matchPoints !== b.standing.matchPoints) {
      return b.standing.matchPoints - a.standing.matchPoints;
    }
    if (a.standing.wins !== b.standing.wins) {
      return b.standing.wins - a.standing.wins;
    }
    return 0;
  });

  if (allQualifiers.length < 4) {
    return [];
  }

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

  const newMatches: TablesInsert<'matches'>[] = [
    {
      tournament_id: options.tournamentId,
      team_a_id: allQualifiers[0].teamId,
      team_b_id: allQualifiers[3].teamId,
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
    {
      tournament_id: options.tournamentId,
      team_a_id: allQualifiers[1].teamId,
      team_b_id: allQualifiers[2].teamId,
      phase: 'Semifinal',
      status: 'scheduled',
      points_per_set: pointsPerSet,
      side_switch_sum: sideSwitchSum,
      best_of: bestOf,
      modality,
    },
  ];

  return newMatches;
};

