import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy, TrendingUp, Target, Clock, ArrowLeftRight } from "lucide-react";
import { useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { Game, GameState, PointCategory, Timer } from "@/types/volleyball";
import { calculateRemainingSeconds, createDefaultGameState } from "@/lib/matchState";
import { loadMatchState, subscribeToMatchState } from "@/lib/matchStateService";
import { normalizeMatchStatus } from "@/utils/matchStatus";
import { cn } from "@/lib/utils";
import { inferMatchFormat, parseGameModality, parseNumberArray } from "@/utils/parsers";
import { MatchLineChart } from "@/components/MatchLineChart";

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

const mockStatistics = {
  teamA: {
    ATTACK: 12,
    BLOCK: 3,
    SERVE_POINT: 4,
    OPPONENT_ERROR: 2
  },
  teamB: {
    ATTACK: 9,
    BLOCK: 2,
    SERVE_POINT: 3,
    OPPONENT_ERROR: 4
  }
};

type ScoreHistoryEntry = {
  teamA: number;
  teamB: number;
  server: 'A' | 'B';
  setNumber: number;
};

const parseScoreHistoryFromEvents = (events: unknown): ScoreHistoryEntry[] => {
  if (!Array.isArray(events)) return [];

  const history: ScoreHistoryEntry[] = [];

  for (const rawEvent of events) {
    if (!rawEvent) continue;
    const eventType = typeof rawEvent.event_type === 'string' ? rawEvent.event_type : rawEvent.type;
    if (eventType !== 'POINT_ADDED') continue;

    const metadataValue = rawEvent.metadata ?? rawEvent.data ?? null;
    const metadata =
      metadataValue && typeof metadataValue === 'object' && !Array.isArray(metadataValue)
        ? (metadataValue as Record<string, unknown>)
        : null;
    const parseScore = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const scoreA = parseScore(metadata ? (metadata['scoreA'] as unknown) : undefined);
    const scoreB = parseScore(metadata ? (metadata['scoreB'] as unknown) : undefined);

    const setNumberFromMetadata = metadata ? (metadata['setNumber'] as unknown) : undefined;
    const setNumberFromEvent = (rawEvent.set_number ?? rawEvent.setNumber) as unknown;
    const setNumber = (() => {
      if (typeof setNumberFromMetadata === 'number' && Number.isFinite(setNumberFromMetadata)) {
        return setNumberFromMetadata;
      }
      if (typeof setNumberFromEvent === 'number' && Number.isFinite(setNumberFromEvent)) {
        return setNumberFromEvent;
      }
      return 1;
    })();

    const teamRaw = rawEvent.team;
    const server: 'A' | 'B' = teamRaw === 'B' ? 'B' : 'A';

    history.push({
      teamA: scoreA,
      teamB: scoreB,
      server,
      setNumber,
    });
  }

  return history;
};

export default function SpectatorView() {
  const { gameId } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [currentSponsor, setCurrentSponsor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState<number | null>(null);
  const [usingMatchStateFallback, setUsingMatchStateFallback] = useState(false);
  const [sponsorLogos, setSponsorLogos] = useState<string[]>([]);
  const [tournamentLogo, setTournamentLogo] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);

  const fetchScoreTimeline = useCallback(async () => {
    if (!gameId) return;
    if (mockGames.some(game => game.id === gameId)) {
      return;
    }

    const { data, error } = await supabase
      .from('match_events')
      .select('id, event_type, team, metadata, set_number, created_at')
      .eq('match_id', gameId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load match events', error);
      return;
    }

    setScoreHistory(parseScoreHistoryFromEvents(data));
  }, [gameId]);

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setGameState(foundGame.gameState || createDefaultGameState(foundGame));
      setUsingMatchStateFallback(false);
      setScoreHistory(parseScoreHistoryFromEvents(foundGame.gameState?.events ?? []));
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
        teamA: { name: teamA?.name || 'Equipe A', players: [{ name: teamA?.player_a || 'A1', number: 1 }, { name: teamA?.player_b || 'A2', number: 2 }] },
        teamB: { name: teamB?.name || 'Equipe B', players: [{ name: teamB?.player_a || 'B1', number: 1 }, { name: teamB?.player_b || 'B2', number: 2 }] },
        pointsPerSet,
        needTwoPointLead: true,
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
      void fetchScoreTimeline();

      const { state, usedFallback } = await loadMatchState(match.id, newGame);
      setGameState(state);
      setUsingMatchStateFallback(usedFallback);

      // Load tournament logos
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('logo_url, sponsor_logos')
        .eq('id', match.tournament_id)
        .single();
      
      if (tournament) {
        if (tournament.logo_url) setTournamentLogo(tournament.logo_url);
        if (tournament.sponsor_logos && Array.isArray(tournament.sponsor_logos)) {
          setSponsorLogos(tournament.sponsor_logos as string[]);
        }
      }
      
      setLoading(false);
    };

    void loadFromDB();
  }, [fetchScoreTimeline, gameId]);

  useEffect(() => {
    if (!gameId || !game) return;

    const unsubscribe = subscribeToMatchState(gameId, game, setGameState);

    return () => {
      unsubscribe?.();
    };
  }, [gameId, game, usingMatchStateFallback]);

  // Auto-refresh data every 3 seconds
  useEffect(() => {
    if (!gameId || !game) return;

    const refreshInterval = setInterval(async () => {
      const { state } = await loadMatchState(gameId, game);
      setGameState(state);
      void fetchScoreTimeline();
    }, 3000);

    return () => clearInterval(refreshInterval);
  }, [fetchScoreTimeline, gameId, game]);

  // Rotate stats and sponsors every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (game?.hasStatistics) {
        setShowStats(prev => !prev);
      } else {
        setShowStats(true);
      }

      if (sponsorLogos.length > 0) {
        setCurrentSponsor(prev => (prev + 1) % sponsorLogos.length);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [game?.hasStatistics, sponsorLogos.length]);

  useEffect(() => {
    if (game && !game.hasStatistics) {
      setShowStats(true);
    }
  }, [game]);

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

  const currentSetHistory = useMemo(() => {
    if (!gameState) return [];
    return scoreHistory.filter(entry => entry.setNumber === gameState.currentSet);
  }, [gameState, scoreHistory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-ocean text-white flex items-center justify-center">
        <p className="text-xl">Carregando jogo ao vivo...</p>
      </div>
    );
  }

  if (!game || !gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-3xl text-muted-foreground">Jogo não encontrado</p>
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

  const getCategoryLabel = (category: PointCategory) => {
    const labels: Record<PointCategory, string> = {
      'ATTACK': 'Ataque',
      'BLOCK': 'Bloqueio',
      'SERVE_POINT': 'Ponto de Saque',
      'OPPONENT_ERROR': 'Erro adversário'
    };
    return labels[category];
  };

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      {/* Header */}
      <div className="text-center py-6 border-b border-white/20">
        {tournamentLogo && (
          <div className="flex justify-center mb-4">
            <img src={tournamentLogo} alt="Logo do torneio" className="h-16 object-contain" />
          </div>
        )}
        <h1 className="text-3xl font-bold mb-2">{game.title}</h1>
        <p className="text-xl opacity-90">{game.category} • Set {gameState.currentSet}</p>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Scoreboard - Always Visible */}
          <div className="lg:col-span-3">
            <Card className="bg-white/10 border-white/20 text-white">
              <CardContent className="p-8">
                <div className="grid grid-cols-5 gap-6 items-center">
                  {/* Left Team */}
                  <div
                    className={cn(
                      'col-span-2 text-center',
                      leftHasPossession && possessionGlow
                    )}
                  >
                    <h2 className="text-2xl font-bold mb-4">
                      {leftTeam === 'A' ? game.teamA.name : game.teamB.name}
                    </h2>
                    <div className="text-7xl font-bold mb-4 animate-bounce-in">
                      {leftTeam === 'A' ? scoreA : scoreB}
                    </div>
                    {gameState.currentServerTeam === leftTeam && (
                      <Badge className="bg-serving text-white text-lg px-4 py-2">
                        <Zap className="mr-2" size={20} />
                        SACANDO #{gameState.currentServerPlayer}
                      </Badge>
                    )}
                  </div>

                  {/* Center */}
                  <div className="text-center">
                    <Trophy className="mx-auto mb-4 text-yellow-300" size={40} />
                    <div className="text-lg font-semibold">
                      Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2 text-base text-amber-200">
                      <ArrowLeftRight size={18} />
                      Posse: {possessionTeamName}
                    </div>
                    {gameState.activeTimer && (
                      <div className="mt-4 flex flex-col items-center gap-2">
                        <Badge className="bg-timeout text-white text-base px-4 py-2">
                          <Clock className="mr-2" size={18} />
                          {(timerDescriptor ?? 'Tempo Oficial')} • {formatTime(timer ?? calculateRemainingSeconds(gameState.activeTimer))}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Right Team */}
                  <div
                    className={cn(
                      'col-span-2 text-center',
                      rightHasPossession && possessionGlow
                    )}
                  >
                    <h2 className="text-2xl font-bold mb-4">
                      {rightTeam === 'A' ? game.teamA.name : game.teamB.name}
                    </h2>
                    <div className="text-7xl font-bold mb-4 animate-bounce-in">
                      {rightTeam === 'A' ? scoreA : scoreB}
                    </div>
                    {gameState.currentServerTeam === rightTeam && (
                      <Badge className="bg-serving text-white text-lg px-4 py-2">
                        <Zap className="mr-2" size={20} />
                        SACANDO #{gameState.currentServerPlayer}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6">
              <MatchLineChart
                teamAName={game.teamA.name}
                teamBName={game.teamB.name}
                pointsPerSet={game.pointsPerSet}
                currentSet={gameState.currentSet}
                scoresHistory={currentSetHistory}
              />
            </div>

            {/* Statistics Panel - Shows intermittently */}
            {showStats && game.hasStatistics && (
              <Card className="mt-6 bg-white/10 border-white/20 text-white animate-bounce-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-center justify-center">
                    <TrendingUp size={24} />
                    Estatísticas do Set Atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team A Stats */}
                    <div>
                      <h3 className="text-xl font-bold mb-4 text-center">
                        {game.teamA.name}
                      </h3>
                      <div className="space-y-3">
                        {Object.keys(mockStatistics.teamA).map(key => (
                          <div key={key} className="flex justify-between">
                            <span>{getCategoryLabel(key as PointCategory)}</span>
                            <span className="font-bold">{mockStatistics.teamA[key as PointCategory]}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Team B Stats */}
                    <div>
                      <h3 className="text-xl font-bold mb-4 text-center">
                        {game.teamB.name}
                      </h3>
                      <div className="space-y-3">
                        {Object.keys(mockStatistics.teamB).map(key => (
                          <div key={key} className="flex justify-between">
                            <span>{getCategoryLabel(key as PointCategory)}</span>
                            <span className="font-bold">{mockStatistics.teamB[key as PointCategory]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Sponsors / Momentum */}
          <div className="space-y-6">
            {sponsorLogos.length > 0 && (
              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target size={20} />
                    Patrocinadores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full h-32 flex items-center justify-center rounded-lg bg-white/5 p-4">
                    <img
                      src={sponsorLogos[currentSponsor]}
                      alt={`Patrocinador ${currentSponsor + 1}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp size={20} />
                  Momento do Jogo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                      Últimos 5 pontos
                    </h4>
                    <div className="mt-2 flex gap-2">
                      {[...Array(5)].map((_, index) => (
                        <div
                          key={index}
                          className={`h-2 flex-1 rounded-full ${index < 3 ? 'bg-team-a' : 'bg-team-b/60'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
