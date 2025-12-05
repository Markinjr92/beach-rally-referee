import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, ArrowLeftRight } from "lucide-react";
import { useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { trackPageView } from "@/utils/trackPageView";
import { Game, GameState, Timer } from "@/types/volleyball";
import { calculateRemainingSeconds, createDefaultGameState } from "@/lib/matchState";
import { loadMatchState, subscribeToMatchState } from "@/lib/matchStateService";
import { normalizeMatchStatus } from "@/utils/matchStatus";
import { cn } from "@/lib/utils";
import { inferMatchFormat, parseGameModality, parseNumberArray } from "@/utils/parsers";
import { buildPlayersFromTeam } from "@/utils/teamPlayers";

const buildTimerDescriptor = (game: Game, activeTimer: Timer | null | undefined): string | null => {
  if (!activeTimer) {
    return null;
  }

  const typeLabels: Record<Timer["type"], string> = {
    TIMEOUT_TEAM: "Tempo de Equipe",
    TIMEOUT_TECHNICAL: "Tempo Técnico",
    MEDICAL: "Tempo Médico",
    SET_INTERVAL: "Intervalo de Set",
  };

  const baseLabel = typeLabels[activeTimer.type] ?? "Tempo Oficial";
  const teamLabel = activeTimer.team
    ? activeTimer.team === "A"
      ? game.teamA.name
      : game.teamB.name
    : null;

  return teamLabel ? `${baseLabel} • ${teamLabel}` : baseLabel;
};

export default function PublicScoreboard() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState<number | null>(null);
  const [usingMatchStateFallback, setUsingMatchStateFallback] = useState(false);

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setGameState(foundGame.gameState || createDefaultGameState(foundGame));
      setUsingMatchStateFallback(false);
      setLoading(false);
      return;
    }

    const loadFromDB = async () => {
      if (!gameId) return;
      setLoading(true);
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', gameId)
        .single();
      if (matchError || !match) {
        console.error('Match not found', matchError);
        setLoading(false);
        return;
      }

      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .in('id', [match.team_a_id, match.team_b_id]);
      const teamA = teams?.find(t => t.id === match.team_a_id);
      const teamB = teams?.find(t => t.id === match.team_b_id);
      const pointsPerSet = parseNumberArray(match.points_per_set, [21, 21, 15]);
      const sideSwitchSum = parseNumberArray(match.side_switch_sum, [7, 7, 5]);
      const format = inferMatchFormat(match.best_of, pointsPerSet);

      const normalizedStatus = normalizeMatchStatus(match.status);
      const newGame: Game = {
        id: match.id,
        tournamentId: match.tournament_id,
        title: `${teamA?.name ?? 'Equipe A'} vs ${teamB?.name ?? 'Equipe B'}`,
        category: 'Misto',
        modality: parseGameModality(match.modality),
        format,
        teamA: { 
          name: teamA?.name || 'Equipe A', 
          players: teamA ? buildPlayersFromTeam(teamA, parseGameModality(match.modality)) : [{ name: 'A1', number: 1 }, { name: 'A2', number: 2 }] 
        },
        teamB: { 
          name: teamB?.name || 'Equipe B', 
          players: teamB ? buildPlayersFromTeam(teamB, parseGameModality(match.modality)) : [{ name: 'B1', number: 1 }, { name: 'B2', number: 2 }] 
        },
        pointsPerSet,
        needTwoPointLead: true,
        directWinFormat: match.direct_win_format ?? false,
        sideSwitchSum,
        hasTechnicalTimeout: false,
        technicalTimeoutSum: 0,
        teamTimeoutsPerSet: 2,
        teamTimeoutDurationSec: 30,
        coinTossMode: 'initialThenAlternate',
        status:
          normalizedStatus === 'in_progress'
            ? 'em_andamento'
            : normalizedStatus === 'completed'
              ? 'finalizado'
              : 'agendado',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setGame(newGame);

      const { state, usedFallback } = await loadMatchState(match.id, newGame);
      setGameState(state);
      setUsingMatchStateFallback(usedFallback);
      setLoading(false);
    };

    void loadFromDB();
  }, [gameId]);

  // Track page view when game is loaded
  useEffect(() => {
    if (gameId && game && !loading) {
      void trackPageView({
        pageType: 'scoreboard',
        resourceId: gameId,
        userId: user?.id,
      })
    }
  }, [gameId, game, loading, user?.id])

  useEffect(() => {
    if (!gameId || !game) return;

    const unsubscribe = subscribeToMatchState(gameId, game, setGameState);

    return () => {
      unsubscribe?.();
    };
  }, [gameId, game, usingMatchStateFallback]);

  useEffect(() => {
    if (!gameState?.activeTimer) {
      setTimer(null);
      return;
    }

    const updateTimer = () => {
      const remaining = calculateRemainingSeconds(gameState.activeTimer);
      setTimer(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState?.activeTimer]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-score-bg text-score-text flex items-center justify-center">
        <p className="text-3xl">Carregando placar...</p>
      </div>
    );
  }

  if (!game || !gameState) {
    return (
      <div className="min-h-screen bg-score-bg text-score-text flex items-center justify-center">
        <p className="text-3xl">Jogo não encontrado</p>
      </div>
    );
  }

  const currentSetIndex = gameState.currentSet - 1;
  const scoreA = gameState.scores.teamA[currentSetIndex] || 0;
  const scoreB = gameState.scores.teamB[currentSetIndex] || 0;
  const leftTeam = gameState.leftIsTeamA ? 'A' : 'B';
  const rightTeam = gameState.leftIsTeamA ? 'B' : 'A';
  const leftHasPossession = gameState.possession === leftTeam;
  const rightHasPossession = gameState.possession === rightTeam;
  const possessionGlow = 'shadow-[0_0_40px_rgba(250,204,21,0.35)]';
  const possessionTeamName = gameState.possession === 'A' ? game.teamA.name : game.teamB.name;

  const timerDescriptor = buildTimerDescriptor(game, gameState.activeTimer ?? null);

  return (
    <div className="min-h-screen bg-score-bg text-score-text flex flex-col">
      {/* Header */}
      <div className="text-center py-6 border-b border-score-text/20">
        <h1 className="text-2xl font-bold mb-2">{game.title}</h1>
        <p className="text-lg opacity-75">{game.category} • Set {gameState.currentSet}</p>
      </div>

      {/* Main Scoreboard - Horizontal Layout */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-5 gap-8 items-center">
            {/* Left Team */}
            <div
              className={cn(
                'col-span-2 text-center',
                leftHasPossession && possessionGlow
              )}
            >
              <div className="space-y-4">
                <h2 className="text-3xl font-bold">
                  {leftTeam === 'A' ? game.teamA.name : game.teamB.name}
                </h2>
                <div className="space-y-2">
                  {(leftTeam === 'A' ? game.teamA.players : game.teamB.players).map((player, index) => (
                    <div key={index} className="text-xl opacity-90">
                      {player.name}
                    </div>
                  ))}
                </div>
                {gameState.currentServerTeam === leftTeam && (
                  <div className="flex justify-center">
                    <Badge className="bg-serving text-white text-lg px-4 py-2">
                      <Zap className="mr-2" size={20} />
                      SACANDO #{gameState.currentServerPlayer}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Center - Scores */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-8">
                <div className="text-9xl font-bold font-mono animate-pulse">
                  {leftTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="text-4xl font-bold opacity-50">-</div>
                <div className="text-9xl font-bold font-mono animate-pulse">
                  {rightTeam === 'A' ? scoreA : scoreB}
                </div>
              </div>

              {/* Set History */}
              <div className="mt-8 space-y-4">
                <div className="text-lg font-semibold">
                  Sets Vencidos: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}
                </div>
                <div className="flex items-center justify-center gap-2 text-lg text-amber-200">
                  <ArrowLeftRight size={20} />
                  Posse: {possessionTeamName}
                </div>
                {gameState.activeTimer && (
                  <div className="flex justify-center">
                    <Badge className="bg-timeout text-white text-base px-4 py-2">
                      <Clock className="mr-2" size={18} />
                      {(timerDescriptor ?? 'Tempo Oficial')} • {formatTime(timer ?? calculateRemainingSeconds(gameState.activeTimer))}
                    </Badge>
                  </div>
                )}
                <div className="flex gap-4 justify-center">
                  {Array.from({
                    length: Math.max(
                      gameState.scores.teamA.length,
                      gameState.scores.teamB.length
                    )
                  }).map((_, index) => (
                    <div key={index} className="bg-score-text/10 rounded-lg p-3 min-w-[80px]">
                      <div className="text-sm mb-1">Set {index + 1}</div>
                      <div className="text-lg font-bold">
                        {gameState.scores.teamA[index] || 0} - {gameState.scores.teamB[index] || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Team */}
            <div
              className={cn(
                'col-span-2 text-center',
                rightHasPossession && possessionGlow
              )}
            >
              <div className="space-y-4">
                <h2 className="text-3xl font-bold">
                  {rightTeam === 'A' ? game.teamA.name : game.teamB.name}
                </h2>
                <div className="space-y-2">
                  {(rightTeam === 'A' ? game.teamA.players : game.teamB.players).map((player, index) => (
                    <div key={index} className="text-xl opacity-90">
                      {player.name}
                    </div>
                  ))}
                </div>
                {gameState.currentServerTeam === rightTeam && (
                  <div className="flex justify-center">
                    <Badge className="bg-serving text-white text-lg px-4 py-2">
                      <Zap className="mr-2" size={20} />
                      SACANDO #{gameState.currentServerPlayer}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-score-text/20">
        <div className="text-lg opacity-75">
          Placar Oficial • Tempo Real
        </div>
      </div>
    </div>
  );
}
