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
import { SponsorLogoGrid } from "@/components/SponsorLogoGrid";
import { calculateWinProbability } from "@/lib/wpa";

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
  const [showTimeline, setShowTimeline] = useState(true);

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
    const interval = setInterval(() => {
      setShowTimeline(prev => !prev);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

  const momentumSequence = useMemo(() => {
    if (currentSetHistory.length === 0) return [] as Array<'A' | 'B'>;

    let lastScoreA = 0;
    let lastScoreB = 0;
    const sequence: Array<'A' | 'B'> = [];

    for (const entry of currentSetHistory) {
      if (entry.teamA > lastScoreA) {
        sequence.push('A');
      } else if (entry.teamB > lastScoreB) {
        sequence.push('B');
      }

      lastScoreA = entry.teamA;
      lastScoreB = entry.teamB;
    }

    return sequence;
  }, [currentSetHistory]);

  const recentMomentum = useMemo(() => {
    const lastSeven = momentumSequence.slice(-7);
    return Array(Math.max(0, 7 - lastSeven.length)).fill(null).concat(lastSeven) as Array<'A' | 'B' | null>;
  }, [momentumSequence]);

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
  const possessionGlow = 'ring-2 ring-yellow-300/70 shadow-[0_0_40px_rgba(250,204,21,0.45)]';
  const possessionTeamName = gameState.possession === 'A' ? game.teamA.name : game.teamB.name;
  const leftTeamName = leftTeam === 'A' ? game.teamA.name : game.teamB.name;
  const rightTeamName = rightTeam === 'A' ? game.teamA.name : game.teamB.name;
  const maxPointsCurrentSet =
    game.pointsPerSet[currentSetIndex] ?? game.pointsPerSet[game.pointsPerSet.length - 1] ?? 21;
  const wpaTeamA = calculateWinProbability(scoreA, scoreB, maxPointsCurrentSet);
  const wpaTeamB = 100 - wpaTeamA;
  const wpaLeft = leftTeam === 'A' ? wpaTeamA : wpaTeamB;
  const wpaRight = rightTeam === 'A' ? wpaTeamA : wpaTeamB;
  const teamCardClasses: Record<'A' | 'B', string> = {
    A: 'bg-gradient-to-br from-team-a to-team-a/60',
    B: 'bg-gradient-to-br from-team-b to-team-b/60'
  };

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
    <div className="h-screen overflow-hidden bg-gradient-ocean text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/20 bg-white/5 flex-shrink-0">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{game.title}</h1>
            <p className="text-sm font-semibold uppercase tracking-wide text-white/70 truncate">
              {game.category}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tournamentLogo && (
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 shadow-lg backdrop-blur-sm">
                <img
                  src={tournamentLogo}
                  alt="Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                Set
              </span>
              <span className="rounded-xl border border-white/25 bg-white/10 px-3 py-1 text-base font-extrabold shadow-lg">
                {gameState.currentSet}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-3 py-3">
        <div className="h-full grid grid-rows-[auto_1fr] gap-3">
          {/* Scoreboard - Always Visible */}
          <div className="space-y-4">
            {sponsorLogos.length > 0 && (
              <div className="rounded-2xl border border-white/20 bg-white/5 p-3 shadow-lg shadow-black/10">
                <SponsorLogoGrid
                  logos={sponsorLogos}
                  title="Patrocinadores do evento"
                  layout="row"
                  className="gap-3 md:gap-6"
                  logoWrapperClassName="h-12 md:h-16 bg-white/10"
                  logoClassName="h-10"
                />
              </div>
            )}
            <Card className="border-white/20 bg-white/10 text-white">
              <CardContent className="relative space-y-4 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                    <Trophy className="h-5 w-5 text-yellow-300" />
                    {gameState.setsWon.teamA} x {gameState.setsWon.teamB} Sets
                  </div>
                  {sponsorLogos.length > 0 && (
                    <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 shadow-lg backdrop-blur-sm">
                      <img
                        src={sponsorLogos[currentSponsor]}
                        alt="Patrocinador"
                        className="h-8 w-auto object-contain"
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-3 items-stretch">
                  {/* Left Team */}
                  <div
                    className={cn(
                      'col-span-2 rounded-xl p-3 text-center border border-white/15 backdrop-blur-sm shadow-lg transition-all duration-300',
                      teamCardClasses[leftTeam],
                      leftHasPossession && possessionGlow
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-bold leading-tight drop-shadow-md truncate flex-1">
                        {leftTeamName}
                      </h2>
                      <div className="bg-white/20 text-white rounded-lg px-2 py-1 shadow-lg backdrop-blur-sm">
                        <span className="block text-[8px] font-semibold uppercase tracking-wide text-white/75">
                          % VENC
                        </span>
                        <span className="text-sm font-bold leading-none">{wpaLeft.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="text-5xl font-black drop-shadow-lg">
                        {leftTeam === 'A' ? scoreA : scoreB}
                      </div>
                      {gameState.currentServerTeam === leftTeam && (
                        <Badge className="bg-serving text-white text-xs px-2 py-1 shadow-lg">
                          <Zap className="mr-1" size={14} />
                          SAQUE #{gameState.currentServerPlayer}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Center */}
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/10 shadow-inner md:h-24 md:w-24">
                      <Trophy className="h-10 w-10 text-yellow-300 md:h-14 md:w-14" />
                    </div>
                    <div className="text-lg font-semibold md:text-xl">
                      Melhor de {game.pointsPerSet.length}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm md:text-base text-amber-200">
                      <ArrowLeftRight className="h-4 w-4 md:h-5 md:w-5" />
                      Posse: {possessionTeamName}
                    </div>
                    {gameState.activeTimer && (
                      <div className="mt-3 md:mt-4 flex flex-col items-center gap-2">
                        <Badge className="bg-timeout text-white text-sm md:text-base px-3 md:px-4 py-2">
                          <Clock className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                          {(timerDescriptor ?? 'Tempo Oficial')} • {formatTime(timer ?? calculateRemainingSeconds(gameState.activeTimer))}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Right Team */}
                  <div
                    className={cn(
                      'col-span-2 rounded-2xl p-4 md:p-6 text-center md:text-right border border-white/15 backdrop-blur-sm shadow-[0_20px_45px_rgba(0,0,0,0.35)] transition-all duration-300',
                      teamCardClasses[rightTeam],
                      rightHasPossession && possessionGlow
                    )}
                  >
                    <div className="flex flex-col-reverse items-center text-center gap-3 md:flex-row md:items-start md:justify-between md:text-right md:gap-4">
                      <div className="bg-white/20 text-white rounded-xl px-3 py-2 shadow-lg backdrop-blur-sm min-w-[96px] text-left md:text-left">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.26em] text-white/75">
                          % VENC
                        </span>
                        <span className="text-lg md:text-xl font-bold leading-none">{wpaRight.toFixed(1)}%</span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold leading-tight drop-shadow-md">
                        {rightTeamName}
                      </h2>
                    </div>
                    <div className="mt-6 flex flex-col items-center gap-4">
                      <div className="text-5xl md:text-7xl font-black drop-shadow-lg animate-bounce-in">
                        {rightTeam === 'A' ? scoreA : scoreB}
                      </div>
                      {gameState.currentServerTeam === rightTeam && (
                        <Badge className="bg-serving text-white text-sm md:text-base px-3 md:px-4 py-2 shadow-lg">
                          <Zap className="mr-2" size={18} />
                          SACANDO #{gameState.currentServerPlayer}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {sponsorLogos.length > 0 && (
                  <div className="border-t border-white/10 pt-4">
                    <SponsorLogoGrid
                      logos={sponsorLogos}
                      layout="row"
                      className="gap-2 md:gap-4"
                      logoWrapperClassName="h-10 md:h-12 bg-white/10"
                      logoClassName="h-8"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-6 md:mt-8 space-y-4">
              {showTimeline ? (
                <MatchLineChart
                  key="timeline"
                  teamAName={game.teamA.name}
                  teamBName={game.teamB.name}
                  pointsPerSet={game.pointsPerSet}
                  currentSet={gameState.currentSet}
                  scoresHistory={currentSetHistory}
                />
              ) : (
                <Card key="momentum" className="border-white/20 bg-white/10 text-white animate-bounce-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-center justify-center text-lg md:text-xl">
                      <TrendingUp className="h-6 w-6 md:h-7 md:w-7" />
                      Momento do Jogo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 md:space-y-5">
                      <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs uppercase tracking-wide text-white/70">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-team-a shadow-glow" />
                          {game.teamA.name}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-team-b shadow-glow" />
                          {game.teamB.name}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs md:text-sm font-semibold uppercase tracking-wide text-white/70">
                          Últimos 7 pontos
                        </h4>
                        <div className="mt-3 grid grid-cols-4 sm:grid-cols-7 gap-2">
                          {recentMomentum.map((point, index) => (
                            <div
                              key={index}
                              title={
                                point === 'A'
                                  ? `Ponto de ${game.teamA.name}`
                                  : point === 'B'
                                    ? `Ponto de ${game.teamB.name}`
                                    : 'Sem registro'
                              }
                              className={cn(
                                'flex h-14 items-center justify-center rounded-xl border bg-white/5 text-xs font-semibold shadow-lg backdrop-blur-sm',
                                point === 'A'
                                  ? 'border-team-a/60 text-team-a'
                                  : point === 'B'
                                    ? 'border-team-b/60 text-team-b'
                                    : 'border-white/10 text-white/50'
                              )}
                            >
                              {point ?? '—'}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 text-xs md:text-sm text-white/80 md:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="font-semibold text-white/90">Sequência atual</p>
                          <p className="text-lg font-bold text-white">
                            {momentumSequence[momentumSequence.length - 1] === 'A'
                              ? game.teamA.name
                              : momentumSequence[momentumSequence.length - 1] === 'B'
                                ? game.teamB.name
                                : 'Equilibrado'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="font-semibold text-white/90">Vantagem recente</p>
                          <p className="text-lg font-bold text-white">
                            {recentMomentum.filter(point => point === 'A').length} x
                            {recentMomentum.filter(point => point === 'B').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Statistics Panel - Shows intermittently */}
            {showStats && game.hasStatistics && (
              <Card className="mt-6 border-white/20 bg-white/10 text-white animate-bounce-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-center justify-center text-lg md:text-xl">
                    <TrendingUp className="h-6 w-6 md:h-7 md:w-7" />
                    Estatísticas do Set Atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team A Stats */}
                    <div>
                      <h3 className="text-lg md:text-xl font-bold mb-4 text-center">
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
                      <h3 className="text-lg md:text-xl font-bold mb-4 text-center">
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

          {/* Sidebar - Sponsors */}
          <div className="space-y-4 md:space-y-6">
            {sponsorLogos.length > 0 && (
              <Card className="border-white/20 bg-white/10 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Target className="h-5 w-5 md:h-6 md:w-6" />
                    Patrocinadores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex h-24 w-full items-center justify-center rounded-lg border border-white/10 bg-white/10 p-4">
                      <img
                        src={sponsorLogos[currentSponsor]}
                        alt={`Patrocinador ${currentSponsor + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    {sponsorLogos.length > 1 && (
                      <SponsorLogoGrid
                        logos={sponsorLogos}
                        layout="grid"
                        className="gap-2"
                        logoWrapperClassName="h-14 bg-white/5"
                        logoClassName="h-12"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
