import { TournamentMatchResult } from '@/types/volleyball';

export interface MatchPoints {
  teamA: number;
  teamB: number;
}

const SINGLE_SET_POINTS: MatchPoints = { teamA: 3, teamB: 0 };

export const calculateMatchPoints = (result: TournamentMatchResult): MatchPoints => {
  const { setsWonA, setsWonB, isSingleSet } = summarizeSets(result);

  if (isSingleSet) {
    return result.winner === 'A' ? SINGLE_SET_POINTS : { teamA: 0, teamB: 3 };
  }

  if (result.winner === 'A') {
    if (setsWonA === 2 && setsWonB === 0) return { teamA: 3, teamB: 0 };
    if (setsWonA === 2 && setsWonB === 1) return { teamA: 2, teamB: 1 };
  } else {
    if (setsWonB === 2 && setsWonA === 0) return { teamA: 0, teamB: 3 };
    if (setsWonB === 2 && setsWonA === 1) return { teamA: 1, teamB: 2 };
  }

  // Default fallback for unexpected scores
  return result.winner === 'A' ? { teamA: 2, teamB: 0 } : { teamA: 0, teamB: 2 };
};

export const summarizeSets = (result: TournamentMatchResult) => {
  const setsWonA = result.sets.reduce((total, set) => total + (set.teamAScore > set.teamBScore ? 1 : 0), 0);
  const setsWonB = result.sets.length - setsWonA;
  const pointsScoredA = result.sets.reduce((total, set) => total + set.teamAScore, 0);
  const pointsScoredB = result.sets.reduce((total, set) => total + set.teamBScore, 0);
  const isSingleSet = result.sets.length === 1;

  return { setsWonA, setsWonB, pointsScoredA, pointsScoredB, isSingleSet };
};
