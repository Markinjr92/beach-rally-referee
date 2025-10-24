import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreButton } from "@/components/ui/score-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  RotateCcw,
  Clock,
  Trophy,
  Users,
  Flag,
  Zap,
  Pause,
  ArrowLeft,
  ArrowLeftRight,
  Coins,
  UserCheck,
  Stethoscope,
  Square
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import {
  CoinChoice,
  CourtSide,
  Game,
  GameState,
  PointCategory,
  SetConfiguration,
  Timer,
} from "@/types/volleyball";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { buildTimer, calculateRemainingSeconds, createDefaultGameState } from "@/lib/matchState";
import { loadMatchState, saveMatchState, subscribeToMatchState } from "@/lib/matchStateService";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

type CoinSide = "heads" | "tails";

const mainCategories = [
  { value: 'ATTACK', label: 'Ataque' },
  { value: 'BLOCK', label: 'Bloqueio' },
  { value: 'SERVE_POINT', label: 'Ponto de Saque' },
  { value: 'OPPONENT_ERROR', label: 'Erro adversário' }
];

const coinLabels: Record<CoinSide, string> = {
  heads: 'Cara',
  tails: 'Coroa'
};

export default function RefereeDesk() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showPointCategories, setShowPointCategories] = useState<'A' | 'B' | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [showSideSwitchAlert, setShowSideSwitchAlert] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [coinDialogOpen, setCoinDialogOpen] = useState(false);
  const [coinResult, setCoinResult] = useState<CoinSide | null>(null);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [usingMatchStateFallback, setUsingMatchStateFallback] = useState(false);
  const flipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCompletedTimeoutId = useRef<string | null>(null);
  const fallbackWarningDisplayed = useRef(false);
  const [setConfigDialogOpen, setSetConfigDialogOpen] = useState(false);
  const [teamSetupForm, setTeamSetupForm] = useState<Record<'A' | 'B', { jerseyAssignment: Record<string, number | null>; serviceOrder: number[] }>>({
    A: { jerseyAssignment: {}, serviceOrder: [] },
    B: { jerseyAssignment: {}, serviceOrder: [] },
  });
  const [coinWinnerSelection, setCoinWinnerSelection] = useState<'A' | 'B' | null>(null);
  const [firstChoiceTeamState, setFirstChoiceTeamState] = useState<'A' | 'B'>('A');
  const [firstChoiceOption, setFirstChoiceOption] = useState<CoinChoice>('serve');
  const [secondChoiceServeDecision, setSecondChoiceServeDecision] = useState<'serve' | 'receive' | null>(null);
  const [sideSelections, setSideSelections] = useState<{ A: CourtSide | null; B: CourtSide | null }>({ A: null, B: null });

  const getPlayersByTeam = useCallback(
    (team: 'A' | 'B') => {
      if (!game) return [];
      return team === 'A' ? game.teamA.players ?? [] : game.teamB.players ?? [];
    },
    [game]
  );

  const getDefaultJerseyAssignment = useCallback(
    (team: 'A' | 'B') => {
      const players = getPlayersByTeam(team);
      const assignment: Record<string, number> = {};
      players.forEach((_, index) => {
        assignment[String(index + 1)] = index;
      });
      return assignment;
    },
    [getPlayersByTeam]
  );

  const getDefaultServiceOrder = useCallback(
    (team: 'A' | 'B') => {
      const players = getPlayersByTeam(team);
      if (!players.length) {
        return [1, 2];
      }
      return players.map((_, index) => index + 1);
    },
    [getPlayersByTeam]
  );

  const getPlayerNameByJersey = useCallback(
    (team: 'A' | 'B', jersey: number) => {
      const players = getPlayersByTeam(team);
      const assignment = teamSetupForm[team].jerseyAssignment[String(jersey)];
      return players[assignment ?? 0]?.name ?? `Jogador ${jersey}`;
    },
    [getPlayersByTeam, teamSetupForm]
  );

  const currentSetIndex = Math.max(0, (gameState?.currentSet ?? 1) - 1);
  const currentSetNumber = gameState?.currentSet ?? 1;
  const currentSetConfig = gameState?.setConfigurations?.[currentSetIndex];
  const previousSetConfig = currentSetIndex > 0 ? gameState?.setConfigurations?.[currentSetIndex - 1] : undefined;
  const isCurrentSetConfigured = Boolean(currentSetConfig?.isConfigured);
  const previousCoinWinner = previousSetConfig?.coinToss?.winner;
  const previousCoinLoser = previousSetConfig?.coinToss?.loser ?? (previousCoinWinner ? (previousCoinWinner === 'A' ? 'B' : 'A') : undefined);
  const requiresCoinToss = currentSetNumber === 1 || currentSetNumber >= 3;

  const handleCoinWinnerChange = useCallback((team: 'A' | 'B') => {
    setCoinWinnerSelection(team);
    setFirstChoiceTeamState(team);
  }, []);

  const handleFirstChoiceOptionChange = useCallback((option: CoinChoice) => {
    setFirstChoiceOption(option);
    if (option !== 'side') {
      setSecondChoiceServeDecision(null);
    }
  }, []);

  const handleSecondChoiceDecisionChange = useCallback((decision: 'serve' | 'receive') => {
    setSecondChoiceServeDecision(decision);
  }, []);

  const handleSideSelectionChange = useCallback((team: 'A' | 'B', side: CourtSide) => {
    setSideSelections(prev => ({ ...prev, [team]: side }));
  }, []);

  const handleJerseyAssignmentChange = useCallback(
    (team: 'A' | 'B', jerseyNumber: number, playerIndex: number) => {
      setTeamSetupForm(prev => {
        const current = prev[team];
        const updatedAssignment: Record<string, number | null> = { ...current.jerseyAssignment };
        const jerseyKey = String(jerseyNumber);
        const otherEntry = Object.entries(updatedAssignment).find(([, value]) => value === playerIndex);
        if (otherEntry && otherEntry[0] !== jerseyKey) {
          updatedAssignment[otherEntry[0]] = updatedAssignment[jerseyKey] ?? null;
        }
        updatedAssignment[jerseyKey] = playerIndex;
        return {
          ...prev,
          [team]: {
            ...current,
            jerseyAssignment: updatedAssignment,
          },
        };
      });
    },
    []
  );

  const handleServiceOrderChange = useCallback(
    (team: 'A' | 'B', positionIndex: number, jerseyNumber: number) => {
      setTeamSetupForm(prev => {
        const current = prev[team];
        const order = [...current.serviceOrder];
        const existingIndex = order.findIndex(value => value === jerseyNumber);
        if (existingIndex !== -1 && existingIndex !== positionIndex) {
          const temp = order[positionIndex];
          order[existingIndex] = temp;
        }
        order[positionIndex] = jerseyNumber;
        return {
          ...prev,
          [team]: {
            ...current,
            serviceOrder: order,
          },
        };
      });
    },
    []
  );

  const isSetConfigurationValid = useMemo(() => {
    const validateTeam = (team: 'A' | 'B') => {
      const players = getPlayersByTeam(team);
      const defaultOrder = getDefaultServiceOrder(team);
      const playerCount = Math.max(players.length, defaultOrder.length);
      const assignment = teamSetupForm[team];
      const assignedPlayers = new Set<number>();

      for (let index = 1; index <= playerCount; index += 1) {
        const value = assignment.jerseyAssignment[String(index)];
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return false;
        }
        assignedPlayers.add(value);
      }

      if (assignedPlayers.size < playerCount) {
        return false;
      }

      const orderSource = assignment.serviceOrder.length ? [...assignment.serviceOrder] : [...defaultOrder];
      defaultOrder.forEach(num => {
        if (!orderSource.includes(num)) {
          orderSource.push(num);
        }
      });

      const orderSet = new Set<number>();
      for (let index = 0; index < playerCount; index += 1) {
        const value = orderSource[index];
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return false;
        }
        orderSet.add(value);
      }

      return orderSet.size >= playerCount;
    };

    const firstTeam = firstChoiceTeamState;
    const secondTeam = firstTeam === 'A' ? 'B' : 'A';
    const sideTeam = firstChoiceOption === 'side' ? firstTeam : secondTeam;
    const sideSelected = sideSelections[sideTeam] !== null;
    const secondChoiceValid = firstChoiceOption === 'side' ? secondChoiceServeDecision !== null : true;
    const coinValid = requiresCoinToss ? coinWinnerSelection !== null : true;

    return (
      coinValid &&
      secondChoiceValid &&
      sideSelected &&
      validateTeam('A') &&
      validateTeam('B')
    );
  }, [
    teamSetupForm,
    firstChoiceTeamState,
    firstChoiceOption,
    sideSelections,
    secondChoiceServeDecision,
    requiresCoinToss,
    coinWinnerSelection,
    getPlayersByTeam,
    getDefaultServiceOrder,
  ]);


  const notifyFallbackActivated = useCallback(() => {
    if (fallbackWarningDisplayed.current) return;
    fallbackWarningDisplayed.current = true;
    toast({
      title: 'Modo de compatibilidade ativado',
      description:
        'Não foi possível acessar a tabela de estados avançados. Apenas os placares básicos serão salvos remotamente.',
    });
  }, [toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close().catch(() => undefined);
      }
    };
  }, []);

  const playTone = useCallback((frequency: number, startOffset = 0, duration = 0.6) => {
    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume();
    }

    const startTime = context.currentTime + startOffset;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    const attack = 0.01;
    const release = Math.max(duration - attack, 0.2);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + release);

    oscillator.start(startTime);
    oscillator.stop(startTime + attack + release);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }, []);

  const playAlert = useCallback(
    (_type: 'timeout' | 'sideSwitch') => {
      playTone(1568, 0, 0.35);
      playTone(2093, 0.1, 0.35);
      playTone(2637, 0.2, 0.45);
    },
    [playTone]
  );

  const coinResultLabel = useMemo(() => (coinResult ? coinLabels[coinResult] : null), [coinResult]);

  const snapshotState = useCallback((state: GameState): GameState => {
    return JSON.parse(JSON.stringify(state)) as GameState;
  }, []);

  const persistState = useCallback(
    async (newState: GameState, options?: { skipLocalUpdate?: boolean }) => {
      const previousState = gameState ? snapshotState(gameState) : null;
      if (!options?.skipLocalUpdate) {
        setGameState(newState);
      }

      setIsSyncing(true);
      try {
        const { usedFallback } = await saveMatchState(newState);
        if (usedFallback) {
          notifyFallbackActivated();
        } else {
          fallbackWarningDisplayed.current = false;
        }
        setUsingMatchStateFallback(usedFallback);
      } catch (error) {
        console.error('Failed to persist match state', error);
        toast({
          title: 'Erro ao salvar estado do jogo',
          description: error instanceof Error ? error.message : 'Erro desconhecido ao salvar os dados.',
          variant: 'destructive',
        });
        if (previousState && !options?.skipLocalUpdate) {
          setGameState(previousState);
        }
        throw error;
      } finally {
        setIsSyncing(false);
      }
    },
    [gameState, notifyFallbackActivated, snapshotState, toast]
  );

  const logMatchEvent = useCallback(
    async (params: {
      eventType: string;
      team?: 'A' | 'B';
      pointCategory?: PointCategory;
      description?: string;
      metadata?: Record<string, unknown>;
      setNumber?: number;
    }) => {
      if (!gameId) return;
      const { eventType, team, pointCategory, description, metadata, setNumber } = params;
      const { error } = await supabase.from('match_events').insert({
        match_id: gameId,
        set_number: setNumber ?? gameState?.currentSet ?? null,
        event_type: eventType,
        team: team ?? null,
        point_category: pointCategory ?? null,
        description: description ?? null,
        metadata: metadata ?? null,
      });
      if (error) {
        console.error('Failed to log match event', error);
      }
    },
    [gameId, gameState?.currentSet]
  );

  const finalizeTimeout = useCallback(
    async (activeTimer: NonNullable<GameState['activeTimer']>) => {
      if (!gameState) return;
      if (lastCompletedTimeoutId.current === activeTimer.id) {
        return;
      }
      lastCompletedTimeoutId.current = activeTimer.id;

      if (gameState.activeTimer && gameState.activeTimer.id !== activeTimer.id) {
        return;
      }

      try {
        const { error } = await supabase
          .from('match_timeouts')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', activeTimer.id);
        if (error) {
          throw error;
        }
      } catch (error) {
        console.error('Failed to close timeout record', error);
      }

      const updatedState: GameState = {
        ...snapshotState(gameState),
        activeTimer: null,
      };

      try {
        await persistState(updatedState);
        await logMatchEvent({
          eventType: 'TIMEOUT_ENDED',
          team: activeTimer.team,
          metadata: {
            type: activeTimer.type,
            durationSec: activeTimer.durationSec,
          },
        });
      } catch (error) {
        // Errors already surfaced in persistState
      }
    },
    [gameState, logMatchEvent, persistState, snapshotState]
  );

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setGameHistory([]);
      setGameState(foundGame.gameState || createDefaultGameState(foundGame));
      setIsLoading(false);
      return;
    }

    const loadFromDB = async () => {
      if (!gameId) return;
      setIsLoading(true);
      setGameHistory([]);
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', gameId)
        .single();
      if (matchError || !match) {
        console.error('Match not found', matchError);
        setIsLoading(false);
        return;
      }

      const { data: teams } = await supabase
        .from('teams')
        .select('*')
        .in('id', [match.team_a_id, match.team_b_id]);
      const teamA = teams?.find(t => t.id === match.team_a_id);
      const teamB = teams?.find(t => t.id === match.team_b_id);
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('has_statistics')
        .eq('id', match.tournament_id)
        .maybeSingle();
      const hasStatistics = tournament?.has_statistics ?? true;
      const newGame: Game = {
        id: match.id,
        tournamentId: match.tournament_id,
        title: `${teamA?.name ?? 'Equipe A'} vs ${teamB?.name ?? 'Equipe B'}`,
        category: 'Misto',
        modality: (match.modality as any) || 'dupla',
        format: 'melhorDe3',
        teamA: { name: teamA?.name || 'Equipe A', players: [{ name: teamA?.player_a || 'A1', number: 1 }, { name: teamA?.player_b || 'A2', number: 2 }] },
        teamB: { name: teamB?.name || 'Equipe B', players: [{ name: teamB?.player_a || 'B1', number: 1 }, { name: teamB?.player_b || 'B2', number: 2 }] },
        pointsPerSet: (match.points_per_set as any) || [21, 21, 15],
        needTwoPointLead: true,
        sideSwitchSum: (match.side_switch_sum as any) || [7, 7, 5],
        hasTechnicalTimeout: false,
        technicalTimeoutSum: 0,
        teamTimeoutsPerSet: 2,
        teamTimeoutDurationSec: 30,
        coinTossMode: 'initialThenAlternate',
        status: match.status === 'in_progress' ? 'em_andamento' : match.status === 'completed' ? 'finalizado' : 'agendado',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasStatistics,
      };
      setGame(newGame);

      const { state, usedFallback } = await loadMatchState(match.id, newGame);
      setGameState(state);
      setUsingMatchStateFallback(usedFallback);
      if (usedFallback) {
        notifyFallbackActivated();
      } else {
        fallbackWarningDisplayed.current = false;
      }

      const updatePayload: Partial<Tables<'matches'>> = {};
      if (match.status === 'scheduled') {
        updatePayload.status = 'in_progress';
      }
      if (!match.referee_id && user?.id) {
        updatePayload.referee_id = user.id;
      }
      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('matches').update(updatePayload).eq('id', match.id);
      }

      setIsLoading(false);
    };

    void loadFromDB();
  }, [gameId, notifyFallbackActivated, user?.id]);

  useEffect(() => {
    if (!gameId || !game) return;

    const unsubscribe = subscribeToMatchState(gameId, game, newState => {
      setGameState(snapshotState(newState));
    });

    return () => {
      unsubscribe?.();
    };
  }, [gameId, game, snapshotState, usingMatchStateFallback]);

  useEffect(() => {
    if (!gameState?.activeTimer) {
      setTimer(null);
      lastCompletedTimeoutId.current = null;
      return;
    }

    if (lastCompletedTimeoutId.current && lastCompletedTimeoutId.current !== gameState.activeTimer.id) {
      lastCompletedTimeoutId.current = null;
    }

    const updateTimer = () => {
      const remaining = calculateRemainingSeconds(gameState.activeTimer);
      setTimer(remaining);
      if (remaining === 0 && lastCompletedTimeoutId.current !== gameState.activeTimer?.id) {
        lastCompletedTimeoutId.current = gameState.activeTimer?.id ?? null;
        playAlert('timeout');
        void finalizeTimeout(gameState.activeTimer);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [finalizeTimeout, gameState?.activeTimer, playAlert]);

  useEffect(() => {
    if (timer !== null) {
      setShowPointCategories(null);
    }
  }, [timer]);

  useEffect(() => {
    return () => {
      clearCoinAnimations();
    };
  }, []);

  useEffect(() => {
    if (showSideSwitchAlert) {
      playAlert('sideSwitch');
    }
  }, [playAlert, showSideSwitchAlert]);

  useEffect(() => {
    if (!setConfigDialogOpen || !game || !gameState) {
      return;
    }

    const buildTeamFormState = (
      team: 'A' | 'B',
      configTeam: SetConfiguration['teams']['teamA'] | SetConfiguration['teams']['teamB'] | undefined
    ) => {
      const defaultAssignment = getDefaultJerseyAssignment(team);
      const players = getPlayersByTeam(team);
      const playerCount = Math.max(players.length, getDefaultServiceOrder(team).length);
      const jerseyAssignment: Record<string, number | null> = {};
      const sourceAssignment = configTeam?.jerseyAssignment ?? defaultAssignment;
      for (let index = 1; index <= playerCount; index += 1) {
        const key = String(index);
        const rawValue = sourceAssignment?.[key];
        if (typeof rawValue === 'number') {
          jerseyAssignment[key] = rawValue;
        } else if (typeof rawValue === 'string') {
          const parsed = Number(rawValue);
          jerseyAssignment[key] = Number.isNaN(parsed) ? defaultAssignment[key] ?? index - 1 : parsed;
        } else {
          jerseyAssignment[key] = defaultAssignment[key] ?? index - 1;
        }
      }

      const fallbackOrder = getDefaultServiceOrder(team);
      const storedOrder = Array.isArray(configTeam?.serviceOrder) && configTeam.serviceOrder.length
        ? configTeam.serviceOrder.map(Number)
        : fallbackOrder;
      const normalizedOrder = [...storedOrder];
      fallbackOrder.forEach(number => {
        if (!normalizedOrder.includes(number)) {
          normalizedOrder.push(number);
        }
      });

      return {
        jerseyAssignment,
        serviceOrder: normalizedOrder.slice(0, playerCount),
      };
    };

    const nextFormState = {
      A: buildTeamFormState('A', currentSetConfig?.teams.teamA),
      B: buildTeamFormState('B', currentSetConfig?.teams.teamB),
    };
    setTeamSetupForm(nextFormState);

    const defaultFirstChoiceTeam = currentSetConfig?.isConfigured && currentSetConfig.firstChoiceTeam
      ? currentSetConfig.firstChoiceTeam
      : requiresCoinToss
        ? 'A'
        : previousCoinLoser ?? (previousCoinWinner === 'A' ? 'B' : 'A');

    if (requiresCoinToss) {
      const winner = currentSetConfig?.isConfigured ? currentSetConfig.coinToss?.winner ?? null : null;
      setCoinWinnerSelection(winner);
      setFirstChoiceTeamState(winner ?? defaultFirstChoiceTeam);
    } else {
      setCoinWinnerSelection(previousCoinWinner ?? null);
      setFirstChoiceTeamState(defaultFirstChoiceTeam);
    }

    const initialFirstChoiceOption = currentSetConfig?.isConfigured
      ? currentSetConfig.firstChoiceOption
      : 'serve';
    setFirstChoiceOption(initialFirstChoiceOption);

    if (initialFirstChoiceOption === 'side') {
      const decision =
        currentSetConfig?.isConfigured && (currentSetConfig.secondChoiceOption === 'serve' || currentSetConfig.secondChoiceOption === 'receive')
          ? (currentSetConfig.secondChoiceOption as 'serve' | 'receive')
          : null;
      setSecondChoiceServeDecision(decision);
    } else {
      setSecondChoiceServeDecision(null);
    }

    const initialSideSelections: { A: CourtSide | null; B: CourtSide | null } = { A: null, B: null };
    if (currentSetConfig?.isConfigured && currentSetConfig.sideChoiceTeam && currentSetConfig.sideSelection) {
      initialSideSelections[currentSetConfig.sideChoiceTeam] = currentSetConfig.sideSelection;
    }
    setSideSelections(initialSideSelections);
  }, [
    setConfigDialogOpen,
    game,
    gameState,
    currentSetConfig,
    requiresCoinToss,
    previousCoinLoser,
    previousCoinWinner,
    getDefaultJerseyAssignment,
    getPlayersByTeam,
    getDefaultServiceOrder,
  ]);

  const addPoint = async (team: 'A' | 'B', category?: PointCategory) => {
    if (!gameState || !game || timer !== null || isSyncing) return;
    if (!isCurrentSetConfigured) {
      toast({
        title: 'Configuração pendente',
        description: 'Defina o início do set antes de registrar pontos.',
        variant: 'destructive',
      });
      return;
    }
    if (gameState.isGameEnded) {
      toast({
        title: 'Partida já finalizada',
        description: 'Não é possível adicionar pontos após o término do jogo.',
        variant: 'destructive',
      });
      return;
    }

    const hypotheticalSetIndex = Math.max(gameState.currentSet - 1, 0);
    const currentScoreA = gameState.scores.teamA[hypotheticalSetIndex] ?? 0;
    const currentScoreB = gameState.scores.teamB[hypotheticalSetIndex] ?? 0;
    const prospectiveWinnerScore = team === 'A' ? currentScoreA + 1 : currentScoreB + 1;
    const prospectiveOpponentScore = team === 'A' ? currentScoreB : currentScoreA;
    const targetPoints =
      game.pointsPerSet?.[hypotheticalSetIndex] ??
      game.pointsPerSet?.[game.pointsPerSet.length - 1] ??
      21;
    const minimumLead = game.needTwoPointLead ? 2 : 1;
    const wouldFinishSet =
      prospectiveWinnerScore >= targetPoints &&
      prospectiveWinnerScore - prospectiveOpponentScore >= minimumLead;

    if (wouldFinishSet) {
      const winnerKey = team === 'A' ? 'teamA' : 'teamB';
      const updatedSetsWon = {
        teamA: gameState.setsWon.teamA + (winnerKey === 'teamA' ? 1 : 0),
        teamB: gameState.setsWon.teamB + (winnerKey === 'teamB' ? 1 : 0),
      };
      const totalSets = game.pointsPerSet?.length ?? gameState.scores.teamA.length;
      const setsToWin = Math.ceil(totalSets / 2);
      const wouldFinishMatch = updatedSetsWon[winnerKey] >= setsToWin;

      const confirmationMessage = wouldFinishMatch
        ? 'Este ponto finaliza o set e a partida. Tem certeza de que deseja prosseguir?'
        : 'Este ponto finaliza o set. Tem certeza de que deseja prosseguir?';
      if (typeof window !== 'undefined' && !window.confirm(confirmationMessage)) {
        return;
      }
    }

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const currentSet = previousState.currentSet - 1;
    const updatedScores = {
      teamA: [...previousState.scores.teamA],
      teamB: [...previousState.scores.teamB],
    };

    if (team === 'A') {
      updatedScores.teamA[currentSet]++;
    } else {
      updatedScores.teamB[currentSet]++;
    }

    const updatedState: GameState = {
      ...previousState,
      scores: updatedScores,
      serviceOrders: {
        teamA: [...previousState.serviceOrders.teamA],
        teamB: [...previousState.serviceOrders.teamB],
      },
      nextServerIndex: { ...previousState.nextServerIndex },
    };

    if (previousState.possession !== team) {
      const serviceKey: 'teamA' | 'teamB' = team === 'A' ? 'teamA' : 'teamB';
      const order = updatedState.serviceOrders[serviceKey]?.length
        ? updatedState.serviceOrders[serviceKey]
        : getDefaultServiceOrder(team);
      if (!updatedState.serviceOrders[serviceKey]?.length) {
        updatedState.serviceOrders[serviceKey] = order;
      }

      const rotationIndex = updatedState.nextServerIndex[serviceKey] ?? 0;
      const normalizedIndex = order.length > 0 ? rotationIndex % order.length : 0;
      updatedState.currentServerTeam = team;
      updatedState.currentServerPlayer = order[normalizedIndex] ?? 1;
      updatedState.possession = team;
      updatedState.nextServerIndex[serviceKey] = order.length > 0 ? (normalizedIndex + 1) % order.length : 0;
    } else {
      updatedState.possession = team;
    }

    const totalPoints = updatedScores.teamA[currentSet] + updatedScores.teamB[currentSet];
    const sideSwitchSum = game.sideSwitchSum[currentSet] ?? 0;
    const shouldSwitch = sideSwitchSum > 0 && totalPoints > 0 && totalPoints % sideSwitchSum === 0;

    if (shouldSwitch) {
      setShowSideSwitchAlert(true);
      setTimeout(() => setShowSideSwitchAlert(false), 3000);
      updatedState.leftIsTeamA = !previousState.leftIsTeamA;
      updatedState.sidesSwitched = previousState.sidesSwitched.map((count, index) =>
        index === currentSet ? count + 1 : count
      );
    }

    const targetPointsForCurrentSet =
      game.pointsPerSet?.[currentSet] ??
      game.pointsPerSet?.[game.pointsPerSet.length - 1] ??
      21;
    const winnerKey: 'teamA' | 'teamB' = team === 'A' ? 'teamA' : 'teamB';
    const opponentKey: 'teamA' | 'teamB' = team === 'A' ? 'teamB' : 'teamA';
    const winnerScore = updatedScores[winnerKey][currentSet];
    const opponentScore = updatedScores[opponentKey][currentSet];
    const setWon =
      winnerScore >= targetPointsForCurrentSet && winnerScore - opponentScore >= minimumLead;

    const eventsToLog: Array<Parameters<typeof logMatchEvent>[0]> = [
      {
        eventType: 'POINT_ADDED',
        team,
        pointCategory: category,
        metadata: {
          scoreA: updatedScores.teamA[currentSet],
          scoreB: updatedScores.teamB[currentSet],
          setNumber: previousState.currentSet,
        },
      },
    ];

    let shouldUpdateMatchRecord = false;
    if (setWon) {
      const updatedSetsWon = {
        teamA: previousState.setsWon.teamA + (team === 'A' ? 1 : 0),
        teamB: previousState.setsWon.teamB + (team === 'B' ? 1 : 0),
      };
      updatedState.setsWon = updatedSetsWon;
      updatedState.activeTimer = null;

      const setNumber = previousState.currentSet;
      eventsToLog.push({
        eventType: 'SET_COMPLETED',
        team,
        setNumber,
        metadata: {
          scoreA: updatedScores.teamA[currentSet],
          scoreB: updatedScores.teamB[currentSet],
        },
      });

      const totalSets = game.pointsPerSet?.length ?? updatedScores.teamA.length;
      const setsToWin = Math.ceil(totalSets / 2);
      const hasWonMatch = updatedSetsWon[winnerKey] >= setsToWin;

      if (hasWonMatch) {
        updatedState.isGameEnded = true;
        eventsToLog.push({
          eventType: 'MATCH_COMPLETED',
          team,
          setNumber,
          metadata: {
            finalSets: updatedSetsWon,
            finalScores: updatedState.scores,
          },
        });
        shouldUpdateMatchRecord = true;
      } else {
        updatedState.currentSet = previousState.currentSet + 1;
        updatedState.currentServerPlayer = 1;
        updatedState.currentServerTeam = 'A';
        updatedState.possession = 'A';
        updatedState.serviceOrders = {
          teamA: getDefaultServiceOrder('A'),
          teamB: getDefaultServiceOrder('B'),
        };
        updatedState.nextServerIndex = { teamA: 0, teamB: 0 };

        const nextSetIndex = previousState.currentSet;
        const defaultConfigurations = createDefaultGameState(game).setConfigurations;
        if (defaultConfigurations[nextSetIndex]) {
          updatedState.setConfigurations = previousState.setConfigurations.map((config, index) =>
            index === nextSetIndex ? defaultConfigurations[nextSetIndex] : config
          );
        }
      }
    }

    try {
      await persistState(updatedState);
      for (const event of eventsToLog) {
        await logMatchEvent(event);
      }

      if (shouldUpdateMatchRecord) {
        await supabase
          .from('matches')
          .update({ status: 'completed' })
          .eq('id', game.id);
        setGame(prev => (prev ? { ...prev, status: 'finalizado' } : prev));
      }
    } catch (error) {
      setGameHistory(prev => prev.slice(0, -1));
    }

    setShowPointCategories(null);
  };

  const handleCategorySelection = (team: 'A' | 'B', category: string) => {
    void addPoint(team, category as PointCategory);
  };

  const switchServerTeam = async () => {
    if (!gameState || isSyncing || gameState.isGameEnded) return;
    if (!isCurrentSetConfigured) {
      toast({
        title: 'Configuração pendente',
        description: 'Defina o início do set antes de ajustar a posse.',
        variant: 'destructive',
      });
      return;
    }

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const newTeam: 'A' | 'B' = previousState.currentServerTeam === 'A' ? 'B' : 'A';
    const serviceKey: 'teamA' | 'teamB' = newTeam === 'A' ? 'teamA' : 'teamB';
    const order = previousState.serviceOrders[serviceKey]?.length
      ? previousState.serviceOrders[serviceKey]
      : getDefaultServiceOrder(newTeam);
    const rotationIndex = previousState.nextServerIndex[serviceKey] ?? 0;
    const normalizedIndex = order.length > 0 ? rotationIndex % order.length : 0;
    const nextServerPlayer = order[normalizedIndex] ?? 1;

    const updatedState: GameState = {
      ...previousState,
      currentServerTeam: newTeam,
      currentServerPlayer: nextServerPlayer,
      serviceOrders: {
        teamA: [...previousState.serviceOrders.teamA],
        teamB: [...previousState.serviceOrders.teamB],
      },
      nextServerIndex: {
        ...previousState.nextServerIndex,
        [serviceKey]: order.length > 0 ? (normalizedIndex + 1) % order.length : 0,
      },
      possession: newTeam,
    };

    if (!updatedState.serviceOrders[serviceKey]?.length) {
      updatedState.serviceOrders[serviceKey] = order;
    }

    try {
      await persistState(updatedState);
      await logMatchEvent({
        eventType: 'SERVER_SWITCH',
        team: updatedState.currentServerTeam,
      });
    } catch (error) {
      setGameHistory(prev => prev.slice(0, -1));
    }
  };

  const changeCurrentServer = async () => {
    if (!gameState || !game || isSyncing || gameState.isGameEnded) return;
    if (!isCurrentSetConfigured) {
      toast({
        title: 'Configuração pendente',
        description: 'Defina o início do set antes de alternar o sacador.',
        variant: 'destructive',
      });
      return;
    }

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const team = previousState.currentServerTeam;
    const serviceKey: 'teamA' | 'teamB' = team === 'A' ? 'teamA' : 'teamB';
    const order = previousState.serviceOrders[serviceKey]?.length
      ? previousState.serviceOrders[serviceKey]
      : getDefaultServiceOrder(team);
    const currentIndex = order.findIndex(value => value === previousState.currentServerPlayer);
    const nextIndex = order.length > 0 ? (currentIndex === -1 ? 0 : (currentIndex + 1) % order.length) : 0;
    const nextPlayer = order[nextIndex] ?? previousState.currentServerPlayer;

    const updatedState: GameState = {
      ...previousState,
      currentServerPlayer: nextPlayer,
      serviceOrders: {
        teamA: [...previousState.serviceOrders.teamA],
        teamB: [...previousState.serviceOrders.teamB],
      },
      nextServerIndex: {
        ...previousState.nextServerIndex,
        [serviceKey]: order.length > 0 ? (nextIndex + 1) % order.length : 0,
      },
    };

    if (!updatedState.serviceOrders[serviceKey]?.length) {
      updatedState.serviceOrders[serviceKey] = order;
    }

    try {
      await persistState(updatedState);
      await logMatchEvent({
        eventType: 'SERVER_PLAYER_ROTATION',
        team: updatedState.currentServerTeam,
        metadata: { player: nextPlayer },
      });
    } catch (error) {
      setGameHistory(prev => prev.slice(0, -1));
    }
  };

  const applySetConfiguration = async () => {
    if (!gameState || !game || !isSetConfigurationValid) {
      return;
    }

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const firstTeam = firstChoiceTeamState;
    const secondTeam = firstTeam === 'A' ? 'B' : 'A';
    const sideTeam = firstChoiceOption === 'side' ? firstTeam : secondTeam;
    const sideSelection = sideSelections[sideTeam];
    const secondChoiceOption: CoinChoice =
      firstChoiceOption === 'side'
        ? (secondChoiceServeDecision ?? 'serve')
        : 'side';

    const normalizeJerseyAssignment = (team: 'A' | 'B') => {
      const defaultAssignment = getDefaultJerseyAssignment(team);
      const players = getPlayersByTeam(team);
      const playerCount = Math.max(players.length, getDefaultServiceOrder(team).length);
      const assignment: Record<string, number> = {};
      for (let index = 1; index <= playerCount; index += 1) {
        const key = String(index);
        const value = teamSetupForm[team].jerseyAssignment[key];
        const fallback = defaultAssignment[key] ?? index - 1;
        assignment[key] = typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
      }
      return assignment;
    };

    const normalizeServiceOrder = (team: 'A' | 'B') => {
      const defaultOrder = getDefaultServiceOrder(team);
      const source = teamSetupForm[team].serviceOrder.length
        ? [...teamSetupForm[team].serviceOrder]
        : [...defaultOrder];
      defaultOrder.forEach(num => {
        if (!source.includes(num)) {
          source.push(num);
        }
      });
      return source.slice(0, defaultOrder.length);
    };

    const serviceOrderA = normalizeServiceOrder('A');
    const serviceOrderB = normalizeServiceOrder('B');

    const startingServerTeam: 'A' | 'B' =
      firstChoiceOption === 'serve'
        ? firstTeam
        : firstChoiceOption === 'receive'
          ? secondTeam
          : secondChoiceOption === 'serve'
            ? secondTeam
            : firstTeam;

    const startingServerPlayer = (startingServerTeam === 'A' ? serviceOrderA : serviceOrderB)[0] ?? 1;
    const receivingTeam = startingServerTeam === 'A' ? 'B' : 'A';

    const coinWinner = requiresCoinToss
      ? coinWinnerSelection ?? firstTeam
      : previousCoinWinner ?? (firstTeam === 'A' ? 'B' : 'A');
    const coinLoser = requiresCoinToss
      ? (coinWinner === 'A' ? 'B' : 'A')
      : previousCoinLoser ?? (coinWinner === 'A' ? 'B' : 'A');

    const nextServerIndex = {
      teamA: startingServerTeam === 'A' && serviceOrderA.length > 1 ? 1 % serviceOrderA.length : 0,
      teamB: startingServerTeam === 'B' && serviceOrderB.length > 1 ? 1 % serviceOrderB.length : 0,
    };

    let leftIsTeamA = previousState.leftIsTeamA;
    if (sideSelection) {
      if (sideTeam === 'A') {
        leftIsTeamA = sideSelection === 'left';
      } else {
        leftIsTeamA = sideSelection !== 'left';
      }
    }

    const updatedConfigurations = previousState.setConfigurations.map((config, index) => {
      if (index !== currentSetIndex) {
        return config;
      }
      return {
        setNumber: currentSetNumber,
        isConfigured: true,
        firstChoiceTeam: firstTeam,
        firstChoiceOption,
        firstChoiceSide: firstChoiceOption === 'side' ? sideSelections[firstTeam] ?? undefined : undefined,
        secondChoiceOption,
        secondChoiceSide: secondChoiceOption === 'side' ? sideSelections[secondTeam] ?? undefined : undefined,
        sideChoiceTeam: sideTeam,
        sideSelection: sideSelection ?? 'left',
        startingServerTeam,
        startingReceiverTeam: receivingTeam,
        startingServerPlayer,
        coinToss: {
          performed: requiresCoinToss,
          winner: coinWinner,
          loser: coinLoser,
        },
        teams: {
          teamA: {
            jerseyAssignment: normalizeJerseyAssignment('A'),
            serviceOrder: serviceOrderA,
          },
          teamB: {
            jerseyAssignment: normalizeJerseyAssignment('B'),
            serviceOrder: serviceOrderB,
          },
        },
      };
    });

    const updatedState: GameState = {
      ...previousState,
      currentServerTeam: startingServerTeam,
      currentServerPlayer: startingServerPlayer,
      possession: startingServerTeam,
      leftIsTeamA,
      serviceOrders: {
        teamA: serviceOrderA,
        teamB: serviceOrderB,
      },
      nextServerIndex,
      setConfigurations: updatedConfigurations,
    };

    try {
      await persistState(updatedState);
      await logMatchEvent({
        eventType: 'SET_CONFIGURATION_APPLIED',
        setNumber: currentSetNumber,
        metadata: {
          startingServerTeam,
          startingServerPlayer,
          sideChoiceTeam: sideTeam,
          sideSelection: sideSelection ?? 'left',
          coinToss: {
            performed: requiresCoinToss,
            winner: coinWinner,
            loser: coinLoser,
          },
        },
      });
      setSetConfigDialogOpen(false);
    } catch (error) {
      setGameHistory(prev => prev.slice(0, -1));
      toast({
        title: 'Erro ao aplicar configuração',
        description: error instanceof Error ? error.message : 'Não foi possível salvar a configuração do set.',
        variant: 'destructive',
      });
    }
  };

  const undoLastAction = async () => {
    if (gameHistory.length === 0 || !gameState) return;

    const lastState = gameHistory[gameHistory.length - 1];
    setGameHistory(prev => prev.slice(0, -1));

    try {
      await persistState(lastState);
      await logMatchEvent({
        eventType: 'POINT_UNDONE',
        metadata: {
          reason: 'undo',
          restoredScores: lastState.scores,
          restoredSets: lastState.setsWon,
        },
        setNumber: lastState.currentSet,
      });
    } catch (error) {
      // Re-queue the state so the user can retry
      setGameHistory(prev => [...prev, lastState]);
    }
  };

  const clearCoinAnimations = () => {
    if (flipIntervalRef.current) {
      clearInterval(flipIntervalRef.current);
      flipIntervalRef.current = null;
    }
    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
  };

  const resetCoinState = () => {
    clearCoinAnimations();
    setCoinResult(null);
    setIsFlippingCoin(false);
  };

  const handleCoinFlip = () => {
    setIsFlippingCoin(true);
    setCoinResult(null);

    clearCoinAnimations();

    const interval = setInterval(() => {
      setCoinResult(prev => (prev === 'heads' ? 'tails' : 'heads'));
    }, 150);

    flipIntervalRef.current = interval;

    const timeout = setTimeout(() => {
      const finalResult: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
      setCoinResult(finalResult);
      setIsFlippingCoin(false);
      clearCoinAnimations();
    }, 1500);

    flipTimeoutRef.current = timeout;
  };

  const startTimeout = async (type: 'team' | 'technical' | 'medical', team?: 'A' | 'B') => {
    if (!gameState || !game || isSyncing) return;
    if (!isCurrentSetConfigured) {
      toast({
        title: 'Configuração pendente',
        description: 'Defina o início do set antes de controlar tempos.',
        variant: 'destructive',
      });
      return;
    }
    if (gameState.isGameEnded) {
      toast({
        title: 'Partida finalizada',
        description: 'Não é possível iniciar tempos após o fim do jogo.',
        variant: 'destructive',
      });
      return;
    }
    if (gameState.activeTimer) {
      toast({
        title: 'Já existe um tempo em andamento',
        description: 'Finalize o tempo atual antes de iniciar outro.',
        variant: 'destructive',
      });
      return;
    }

    const currentSetIndex = Math.max(gameState.currentSet - 1, 0);

    if (type === 'team' && team) {
      const key: 'teamA' | 'teamB' = team === 'A' ? 'teamA' : 'teamB';
      const usedTimeouts = gameState.timeoutsUsed[key]?.[currentSetIndex] ?? 0;
      if (usedTimeouts >= game.teamTimeoutsPerSet) {
        toast({
          title: 'Limite de timeouts atingido',
          description: `A equipe ${team === 'A' ? game.teamA.name : game.teamB.name} já utilizou todos os timeouts deste set.`,
          variant: 'destructive',
        });
        return;
      }
    }

    if (type === 'technical' && gameState.technicalTimeoutUsed[currentSetIndex]) {
      toast({
        title: 'Tempo técnico já utilizado',
        description: 'Este set já teve um tempo técnico registrado.',
        variant: 'destructive',
      });
      return;
    }

    const duration =
      type === 'medical'
        ? 300
        : type === 'team'
          ? game.teamTimeoutDurationSec ?? 30
          : 60;
    const timerType: Timer['type'] =
      type === 'team' ? 'TIMEOUT_TEAM' : type === 'technical' ? 'TIMEOUT_TECHNICAL' : 'MEDICAL';

    let timeoutRecord: { id: string; started_at: string } | null = null;
    try {
      const { data, error } = await supabase
        .from('match_timeouts')
        .insert({
          match_id: game.id,
          set_number: gameState.currentSet,
          team: team ?? null,
          timeout_type: type,
          duration_seconds: duration,
        })
        .select('id, started_at')
        .single();
      if (error || !data) {
        throw error ?? new Error('Falha ao registrar timeout');
      }
      timeoutRecord = data;
    } catch (error) {
      console.error('Failed to start timeout', error);
      toast({
        title: 'Erro ao iniciar tempo',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao iniciar o tempo.',
        variant: 'destructive',
      });
      return;
    }

    lastCompletedTimeoutId.current = null;

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const timerObject = buildTimer({
      id: timeoutRecord.id,
      type: timerType,
      startedAt: timeoutRecord.started_at,
      durationSec: duration,
      team,
    });

    const updatedState: GameState = {
      ...previousState,
      activeTimer: timerObject,
    };

    if (type === 'team' && team) {
      const key: 'teamA' | 'teamB' = team === 'A' ? 'teamA' : 'teamB';
      updatedState.timeoutsUsed = {
        teamA: [...previousState.timeoutsUsed.teamA],
        teamB: [...previousState.timeoutsUsed.teamB],
      };
      updatedState.timeoutsUsed[key][previousState.currentSet - 1] += 1;
    }

    if (type === 'technical') {
      updatedState.technicalTimeoutUsed = previousState.technicalTimeoutUsed.map((used, index) =>
        index === previousState.currentSet - 1 ? true : used
      );
    }

    try {
      await persistState(updatedState);
      await logMatchEvent({
        eventType: 'TIMEOUT_STARTED',
        team,
        metadata: {
          type: timerType,
          durationSec: duration,
        },
      });
    } catch (error) {
      setGameHistory(prev => prev.slice(0, -1));
      await supabase
        .from('match_timeouts')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', timeoutRecord.id);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const coinStatusMessage = useMemo(() => {
    if (isFlippingCoin) return 'Girando moeda...';
    if (coinResultLabel) return `Resultado: ${coinResultLabel}`;
    return 'Toque em "Jogar Moeda" para iniciar.';
  }, [coinResultLabel, isFlippingCoin]);

  if (!game || !gameState) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-ocean flex items-center justify-center text-white">
          <p className="text-xl text-white/80">Carregando dados do jogo...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center text-white">
        <p className="text-xl text-white/80">Jogo não encontrado</p>
      </div>
    );
  }

  const activeSetIndex = Math.max(0, Math.min(currentSetIndex, gameState.scores.teamA.length - 1));
  const scoreA = gameState.scores.teamA[activeSetIndex] ?? 0;
  const scoreB = gameState.scores.teamB[activeSetIndex] ?? 0;
  const leftTeam = gameState.leftIsTeamA ? 'A' : 'B';
  const rightTeam = gameState.leftIsTeamA ? 'B' : 'A';
  const leftTeamName = leftTeam === 'A' ? game.teamA.name : game.teamB.name;
  const rightTeamName = rightTeam === 'A' ? game.teamA.name : game.teamB.name;
  const leftTeamScores = leftTeam === 'A' ? gameState.scores.teamA : gameState.scores.teamB;
  const rightTeamScores = rightTeam === 'A' ? gameState.scores.teamA : gameState.scores.teamB;
  const serverTeamName = isCurrentSetConfigured
    ? gameState.currentServerTeam === 'A'
      ? game.teamA.name
      : game.teamB.name
    : 'Configuração pendente';
  const serverPlayerDisplay = isCurrentSetConfigured ? gameState.currentServerPlayer : '-';
  const leftTeamColorClass = leftTeam === 'A' ? 'bg-team-a' : 'bg-team-b';
  const rightTeamColorClass = rightTeam === 'A' ? 'bg-team-a' : 'bg-team-b';
  const leftScoreButtonVariant = leftTeam === 'A' ? 'team' : 'teamB';
  const rightScoreButtonVariant = rightTeam === 'A' ? 'team' : 'teamB';
  const leftHasPossession = isCurrentSetConfigured && gameState.possession === leftTeam;
  const rightHasPossession = isCurrentSetConfigured && gameState.possession === rightTeam;
  const possessionGlow = 'shadow-[0_0_35px_rgba(250,204,21,0.4)]';
  const possessionTeamName = isCurrentSetConfigured
    ? gameState.possession === 'A'
      ? game.teamA.name
      : game.teamB.name
    : 'Configuração pendente';
  const playersTeamA = getPlayersByTeam('A');
  const playersTeamB = getPlayersByTeam('B');
  const jerseyNumbersA = getDefaultServiceOrder('A');
  const jerseyNumbersB = getDefaultServiceOrder('B');
  const servicePositionsA = jerseyNumbersA;
  const servicePositionsB = jerseyNumbersB;
  const secondTeamForChoices = firstChoiceTeamState === 'A' ? 'B' : 'A';
  const firstChoiceTeamName = firstChoiceTeamState === 'A' ? game.teamA.name : game.teamB.name;
  const secondChoiceTeamName = secondTeamForChoices === 'A' ? game.teamA.name : game.teamB.name;
  const sideChoiceTeamForDisplay = firstChoiceOption === 'side' ? firstChoiceTeamState : secondTeamForChoices;
  const sideChoiceTeamName = sideChoiceTeamForDisplay === 'A' ? game.teamA.name : game.teamB.name;

  const coinFaceToShow = (coinResult ?? 'heads') as CoinSide;
  const gameIsEnded = gameState.isGameEnded;
  const isFirstSet = currentSetNumber === 1;
  const setConfigButtonLabel = isCurrentSetConfigured
    ? 'Editar início'
    : isFirstSet
      ? 'Início da partida'
      : 'Configurar início do set';
  const mobileControlButtons = [
    {
      icon: RotateCcw,
      label: 'Desfazer',
      onClick: () => void undoLastAction(),
      disabled: gameHistory.length === 0 || gameIsEnded,
    },
    {
      icon: Pause,
      label: 'Timeout A',
      onClick: () => void startTimeout('team', 'A'),
      disabled: !!gameState?.activeTimer || gameIsEnded || !isCurrentSetConfigured,
    },
    {
      icon: Pause,
      label: 'Timeout B',
      onClick: () => void startTimeout('team', 'B'),
      disabled: !!gameState?.activeTimer || gameIsEnded || !isCurrentSetConfigured,
    },
    {
      icon: Stethoscope,
      label: 'Tempo Médico',
      onClick: () => void startTimeout('medical'),
      disabled: !!gameState?.activeTimer || gameIsEnded || !isCurrentSetConfigured,
    },
    {
      icon: Square,
      label: 'Encerrar Tempo',
      onClick: () => {
        if (gameState?.activeTimer) {
          void finalizeTimeout(gameState.activeTimer);
        }
      },
      disabled: !gameState?.activeTimer || gameIsEnded,
    },
    {
      icon: ArrowLeftRight,
      label: 'Trocar Posse',
      onClick: () => void switchServerTeam(),
      disabled: gameIsEnded,
    },
    {
      icon: UserCheck,
      label: 'Trocar Sacador',
      onClick: () => void changeCurrentServer(),
      disabled: gameIsEnded,
    },
    {
      icon: Coins,
      label: 'Moeda',
      onClick: () => {
        resetCoinState();
        setCoinDialogOpen(true);
      },
      disabled: gameIsEnded,
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="w-fit bg-amber-400 text-slate-900 font-semibold border-transparent hover:bg-amber-300 md:border-white/30 md:bg-transparent md:text-white md:hover:bg-white/20"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button
                variant="outline"
                className={cn(
                  'w-fit border-transparent bg-white/15 text-white font-semibold hover:bg-white/25 md:bg-amber-400 md:text-slate-900 md:hover:bg-amber-300',
                  !isCurrentSetConfigured && 'animate-pulse'
                )}
                onClick={() => setSetConfigDialogOpen(true)}
                disabled={gameIsEnded}
              >
                {setConfigButtonLabel}
              </Button>
            </div>
            <div className="hidden md:block md:text-right">
              <h1 className="text-3xl font-bold">{game.title}</h1>
              <p className="text-white/70">{game.category} • {game.modality} • {game.format}</p>
            </div>
          </div>
          {gameIsEnded && (
            <Alert className="border-emerald-300/50 bg-emerald-500/10 text-emerald-100">
              <AlertTitle>Partida finalizada</AlertTitle>
              <AlertDescription>
                Os controles foram bloqueados e a partida está encerrada. Revise os resultados acima.
              </AlertDescription>
            </Alert>
          )}
          <div className="hidden flex-wrap gap-3 text-xs sm:text-sm text-white/80 md:flex">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Set atual: {gameState.currentSet}
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Parcial de sets {gameState.setsWon.teamA} - {gameState.setsWon.teamB}
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Sacando: {serverTeamName} ({serverPlayerDisplay})
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Posse: {possessionTeamName}
            </Badge>
            {!isCurrentSetConfigured && (
              <Badge variant="destructive" className="bg-amber-500 text-slate-900 border-transparent">
                Início do set pendente
              </Badge>
            )}
          </div>
        </div>

        {/* Mobile Scoreboard */}
        <div className="space-y-4 md:hidden">
          <div className="overflow-hidden rounded-3xl border border-white/20 text-white shadow-scoreboard">
            <div className="grid grid-cols-2">
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-3 p-4 text-center',
                  leftTeamColorClass,
                  leftHasPossession && possessionGlow
                )}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white/90">{leftTeamName}</h2>
                <div className="text-5xl font-black">
                  {leftTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {leftTeamScores.map((setScore, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-white/40 bg-white/20 text-white"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {isCurrentSetConfigured && gameState.currentServerTeam === leftTeam && (
                  <Badge className="border border-white/30 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({serverPlayerDisplay})
                  </Badge>
                )}
              </div>
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-3 p-4 text-center',
                  rightTeamColorClass,
                  rightHasPossession && possessionGlow
                )}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white/90">{rightTeamName}</h2>
                <div className="text-5xl font-black">
                  {rightTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {rightTeamScores.map((setScore, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-white/40 bg-white/20 text-white"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {isCurrentSetConfigured && gameState.currentServerTeam === rightTeam && (
                  <Badge className="border border-white/30 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({serverPlayerDisplay})
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2 bg-slate-900/80 px-4 py-3 text-center text-sm text-white/80">
              <div className="text-base font-semibold text-white">Set {gameState.currentSet}</div>
              <div>Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}</div>
              <div className="flex items-center justify-center gap-2 text-amber-200">
                <Zap className="h-4 w-4" />
                Sacando: {serverTeamName} ({serverPlayerDisplay})
              </div>
              {timer !== null && (
                <div className="mx-auto flex w-full max-w-[200px] items-center justify-center gap-2 rounded-full border border-amber-200/60 bg-amber-200/10 px-3 py-1 text-base font-semibold text-amber-100 shadow-inner">
                  <Clock className="h-4 w-4" />
                  {formatTime(timer)}
                </div>
              )}
              <div className="flex items-center justify-center gap-2 text-amber-200">
                <ArrowLeftRight className="h-4 w-4" />
                Posse: {possessionTeamName}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ScoreButton
              variant={leftScoreButtonVariant}
              size="score"
              onClick={() => {
                if (timer !== null || gameIsEnded || !isCurrentSetConfigured) return;
                if (game?.hasStatistics === false) {
                  void addPoint(leftTeam);
                  return;
                }
                setShowPointCategories(leftTeam);
              }}
              disabled={timer !== null || gameIsEnded || !isCurrentSetConfigured}
              className="h-20 w-full text-4xl"
            >
              <Plus size={24} />
            </ScoreButton>
            <ScoreButton
              variant={rightScoreButtonVariant}
              size="score"
              onClick={() => {
                if (timer !== null || gameIsEnded || !isCurrentSetConfigured) return;
                if (game?.hasStatistics === false) {
                  void addPoint(rightTeam);
                  return;
                }
                setShowPointCategories(rightTeam);
              }}
              disabled={timer !== null || gameIsEnded || !isCurrentSetConfigured}
              className="h-20 w-full text-4xl"
            >
              <Plus size={24} />
            </ScoreButton>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {mobileControlButtons.map(({ icon: Icon, label, onClick, disabled }) => (
              <Button
                key={label}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 rounded-xl border-white/30 bg-white/10 text-center text-xs font-semibold text-white hover:bg-white/20"
                onClick={onClick}
                disabled={disabled}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-tight">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Main Scoreboard */}
        <Card className="hidden border-none bg-transparent shadow-none backdrop-blur-xl md:block">
          <CardContent className="p-0">
            <div className="grid overflow-hidden rounded-3xl border border-white/20 text-white shadow-scoreboard md:grid-cols-[1fr_minmax(0,260px)_1fr]">
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-5 p-8 text-center',
                  leftTeamColorClass,
                  leftHasPossession && possessionGlow
                )}
              >
                <h2 className="text-3xl font-semibold text-white/90">{leftTeamName}</h2>
                <div className="text-7xl sm:text-8xl font-extrabold">
                  {leftTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {leftTeamScores.map((setScore, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-white/40 bg-white/20 text-white"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {isCurrentSetConfigured && gameState.currentServerTeam === leftTeam && (
                  <Badge className="border border-white/40 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({serverPlayerDisplay})
                  </Badge>
                )}
              </div>
              <div className="flex flex-col items-center justify-center gap-4 bg-slate-900/80 px-8 py-6 text-center text-white/80">
                <div className="text-lg font-semibold text-white">Set {gameState.currentSet}</div>
                <div className="text-sm">Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}</div>
                {timer !== null && (
                  <div className="flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-200/10 px-5 py-2 text-lg font-semibold text-amber-100 shadow-inner">
                    <Clock className="h-5 w-5" />
                    {formatTime(timer)}
                  </div>
                )}
                <div className="space-y-1 text-sm text-amber-200">
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" />
                    Sacando: {serverTeamName} ({gameState.currentServerPlayer})
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Posse: {possessionTeamName}
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-5 p-8 text-center',
                  rightTeamColorClass,
                  rightHasPossession && possessionGlow
                )}
              >
                <h2 className="text-3xl font-semibold text-white/90">{rightTeamName}</h2>
                <div className="text-7xl sm:text-8xl font-extrabold">
                  {rightTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {rightTeamScores.map((setScore, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-white/40 bg-white/20 text-white"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {isCurrentSetConfigured && gameState.currentServerTeam === rightTeam && (
                  <Badge className="border border-white/40 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({serverPlayerDisplay})
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Scoring Controls */}
          <Card className="hidden bg-white/10 border border-white/20 text-white backdrop-blur-lg md:block xl:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Trophy size={20} />
                Controle de Pontos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-white/90">{leftTeamName}</h4>
                  <ScoreButton
                    variant={leftScoreButtonVariant}
                    size="score"
                    onClick={() => {
                      if (timer !== null || gameIsEnded || !isCurrentSetConfigured) return;
                      if (game?.hasStatistics === false) {
                        void addPoint(leftTeam);
                        return;
                      }
                      setShowPointCategories(leftTeam);
                    }}
                    disabled={timer !== null || gameIsEnded || !isCurrentSetConfigured}
                    className="h-28 w-full text-5xl"
                  >
                    <Plus size={28} />
                  </ScoreButton>
                </div>
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-white/90">{rightTeamName}</h4>
                  <ScoreButton
                    variant={rightScoreButtonVariant}
                    size="score"
                    onClick={() => {
                      if (timer !== null || gameIsEnded || !isCurrentSetConfigured) return;
                      if (game?.hasStatistics === false) {
                        void addPoint(rightTeam);
                        return;
                      }
                      setShowPointCategories(rightTeam);
                    }}
                    disabled={timer !== null || gameIsEnded || !isCurrentSetConfigured}
                    className="h-28 w-full text-5xl"
                  >
                    <Plus size={28} />
                  </ScoreButton>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <p className="font-semibold text-white">Histórico rápido</p>
                <p>Desfazer últimas ações disponíveis: {gameHistory.length}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                  onClick={() => void undoLastAction()}
                  disabled={gameHistory.length === 0 || gameIsEnded}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Desfazer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeouts & Controles */}
          <Card className="hidden bg-white/10 border border-white/20 text-white backdrop-blur-lg md:block xl:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Clock size={20} />
                Timeouts & Controles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                  onClick={() => void startTimeout('team', 'A')}
                  disabled={!!gameState?.activeTimer || gameIsEnded}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Timeout A
                </Button>
                <Button
                  variant="outline"
                  className="border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                  onClick={() => void startTimeout('team', 'B')}
                  disabled={!!gameState?.activeTimer || gameIsEnded}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Timeout B
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                onClick={() => void startTimeout('technical')}
                disabled={!!gameState?.activeTimer || gameIsEnded}
              >
                <Clock className="mr-2 h-4 w-4" />
                Tempo Técnico
              </Button>
              <Button
                variant="outline"
                className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                onClick={() => void startTimeout('medical')}
                disabled={!!gameState?.activeTimer || gameIsEnded}
              >
                Tempo Médico (5min)
              </Button>
              <Button
                variant="outline"
                className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                onClick={() => {
                  if (gameState?.activeTimer) {
                    void finalizeTimeout(gameState.activeTimer);
                  }
                }}
                disabled={!gameState?.activeTimer}
              >
                <Square className="mr-2 h-4 w-4" />
                Encerrar Tempo
              </Button>
              <Button
                variant="outline"
                className="w-full border-transparent bg-amber-300 text-slate-900 font-semibold hover:bg-amber-200"
                onClick={() => {
                  resetCoinState();
                  setCoinDialogOpen(true);
                }}
              >
                <Coins className="mr-2 h-4 w-4" />
                Moeda
              </Button>
              <div className="space-y-3 border-t border-white/10 pt-3">
                <div className="text-sm font-medium text-white/80">Controles de Override:</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35"
                  onClick={() => void switchServerTeam()}
                  disabled={gameIsEnded}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Trocar Posse ({gameState.currentServerTeam === 'A' ? 'B' : 'A'})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35"
                  onClick={() => void changeCurrentServer()}
                  disabled={gameIsEnded}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  {isCurrentSetConfigured
                    ? `Próximo Sacador (${gameState.currentServerTeam} - ${((gameState.currentServerPlayer % (game.modality === 'dupla' ? 2 : 4)) + 1)})`
                    : 'Próximo Sacador (definir início)'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Game Info */}
          <Card className="hidden bg-white/10 border border-white/20 text-white backdrop-blur-lg md:block xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users size={20} />
                Informações do Jogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm text-white/80">
              <div className="flex justify-between">
                <span>Formato:</span>
                <span className="font-medium text-white">{game.format}</span>
              </div>
              <div className="flex justify-between">
                <span>Vantagem 2 pontos:</span>
                <span className="font-medium text-white">{game.needTwoPointLead ? 'Sim' : 'Não'}</span>
              </div>
              <div className="flex justify-between">
                <span>Troca aos:</span>
                <span className="font-medium text-white">{game.sideSwitchSum[currentSetIndex]} pontos</span>
              </div>
              <div className="flex justify-between">
                <span>Timeouts por set:</span>
                <span className="font-medium text-white">{game.teamTimeoutsPerSet}</span>
              </div>
              <div className="flex justify-between">
                <span>Modo da moeda:</span>
                <span className="font-medium text-white">{game.coinTossMode === 'initialThenAlternate' ? 'Inicial e alternado' : game.coinTossMode}</span>
              </div>
            </CardContent>
          </Card>

        </div>

        <Dialog open={setConfigDialogOpen} onOpenChange={setSetConfigDialogOpen}>
          <DialogContent
            className="w-[92vw] max-w-3xl md:w-[85vw] lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 text-slate-100 shadow-[0_40px_80px_rgba(15,23,42,0.45)] sm:p-8"
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-100">
                Configurar início do set {currentSetNumber}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                Defina as numerações e escolhas iniciais para liberar os controles deste set.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {isFirstSet && (
                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-100">Numeração das duplas</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(['A', 'B'] as const).map(teamKey => {
                      const teamName = teamKey === 'A' ? game.teamA.name : game.teamB.name;
                      const jerseyNumbers = teamKey === 'A' ? jerseyNumbersA : jerseyNumbersB;
                      const players = teamKey === 'A' ? playersTeamA : playersTeamB;
                      return (
                        <div key={teamKey} className="space-y-3">
                          <h4 className="text-sm font-semibold text-slate-100">{teamName}</h4>
                          <div className="space-y-3">
                            {jerseyNumbers.map(number => {
                              const value = teamSetupForm[teamKey].jerseyAssignment[String(number)];
                              return (
                                <div key={number} className="space-y-1">
                                  <Label className="text-xs font-medium text-slate-300">Jogador número {number}</Label>
                                  <Select
                                    value={typeof value === 'number' ? String(value) : undefined}
                                    onValueChange={val => handleJerseyAssignmentChange(teamKey, number, Number(val))}
                                  >
                                    <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                                      <SelectValue placeholder="Selecione um atleta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {players.map((player, index) => (
                                        <SelectItem key={player.name} value={String(index)}>
                                          {player.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h3 className="text-base font-semibold text-slate-100">Escolhas iniciais</h3>
                {requiresCoinToss ? (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Quem venceu o cara ou coroa?</Label>
                    <Select
                      value={coinWinnerSelection ?? undefined}
                      onValueChange={val => handleCoinWinnerChange(val as 'A' | 'B')}
                    >
                      <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                        <SelectValue placeholder="Selecione a dupla vencedora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">{game.teamA.name}</SelectItem>
                        <SelectItem value="B">{game.teamB.name}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="rounded-md bg-slate-800/60 px-3 py-2 text-xs text-slate-200">
                    A dupla {firstChoiceTeamName} inicia as escolhas por ter perdido o sorteio anterior.
                  </p>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Escolha da dupla {firstChoiceTeamName}</Label>
                  <Select
                    value={firstChoiceOption}
                    onValueChange={val => handleFirstChoiceOptionChange(val as CoinChoice)}
                  >
                    <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serve">Sacar primeiro</SelectItem>
                      <SelectItem value="receive">Receber primeiro</SelectItem>
                      <SelectItem value="side">Escolher lado da quadra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {firstChoiceOption === 'side' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-300">Lado escolhido por {firstChoiceTeamName}</Label>
                      <Select
                        value={sideSelections[firstChoiceTeamState] ?? undefined}
                        onValueChange={val => handleSideSelectionChange(firstChoiceTeamState, val as CourtSide)}
                      >
                        <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                          <SelectValue placeholder="Selecione o lado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Lado esquerdo</SelectItem>
                          <SelectItem value="right">Lado direito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-300">Escolha da dupla {secondChoiceTeamName}</Label>
                      <Select
                        value={secondChoiceServeDecision ?? undefined}
                        onValueChange={val => handleSecondChoiceDecisionChange(val as 'serve' | 'receive')}
                      >
                        <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                          <SelectValue placeholder="Selecione a opção" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="serve">Sacar primeiro</SelectItem>
                          <SelectItem value="receive">Receber primeiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Lado escolhido por {secondChoiceTeamName}</Label>
                    <Select
                      value={sideSelections[secondTeamForChoices] ?? undefined}
                      onValueChange={val => handleSideSelectionChange(secondTeamForChoices, val as CourtSide)}
                    >
                      <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                        <SelectValue placeholder="Selecione o lado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Lado esquerdo</SelectItem>
                        <SelectItem value="right">Lado direito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-semibold text-slate-100">Ordem de saque</h3>
                <p className="text-xs text-slate-300">
                  Defina a sequência de sacadores para cada dupla. A ordem será utilizada sempre que a dupla recuperar o saque.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {(['A', 'B'] as const).map(teamKey => {
                    const teamName = teamKey === 'A' ? game.teamA.name : game.teamB.name;
                    const positions = teamKey === 'A' ? servicePositionsA : servicePositionsB;
                    return (
                      <div key={teamKey} className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-100">{teamName}</h4>
                        {positions.map((_, index) => {
                          const currentValue = teamSetupForm[teamKey].serviceOrder[index] ?? positions[index];
                          return (
                            <div key={`${teamKey}-service-${index}`} className="space-y-1">
                              <Label className="text-xs font-medium text-slate-300">{index + 1}º sacador</Label>
                              <Select
                                value={currentValue ? String(currentValue) : undefined}
                                onValueChange={val => handleServiceOrderChange(teamKey, index, Number(val))}
                              >
                                <SelectTrigger className="border border-slate-600/70 bg-slate-800/80 text-slate-100 hover:bg-slate-800">
                                  <SelectValue placeholder="Selecione o atleta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {positions.map(number => (
                                    <SelectItem key={`${teamKey}-order-${number}`} value={String(number)}>
                                      Jogador nº {number} ({getPlayerNameByJersey(teamKey, number)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetConfigDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void applySetConfiguration()} disabled={!isSetConfigurationValid || isSyncing}>
                {isSyncing ? 'Salvando...' : 'Aplicar configuração'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Side Switch Alert */}
        {showSideSwitchAlert && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
            <Card className="bg-timeout text-white shadow-lg animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-lg font-bold">
                  <Flag size={24} />
                  TROCA DE QUADRA!
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Point Category Modal */}
        {showPointCategories && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>
                  Categoria do Ponto - {showPointCategories === 'A' ? game.teamA.name : game.teamB.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {mainCategories.map((category) => (
                    <Button
                      key={category.value}
                      variant="outline"
                      onClick={() => handleCategorySelection(showPointCategories, category.value)}
                      className="text-left justify-start"
                    >
                      {category.label}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setShowPointCategories(null)}
                >
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog
          open={coinDialogOpen}
          onOpenChange={(open) => {
            setCoinDialogOpen(open);
            if (!open) {
              resetCoinState();
            }
          }}
        >
          <DialogContent className="bg-slate-950/95 text-white border border-white/20">
            <DialogHeader>
              <DialogTitle>Sorteio de moeda</DialogTitle>
              <DialogDescription className="text-white/70">
                Simule o lançamento da moeda oficial de R$ 1 e defina quem começa.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-5">
                <div
                  className={cn(
                    "relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-[#f0f2f7] to-[#b5bcc6] shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-transform duration-500 ease-in-out",
                    isFlippingCoin && "animate-coin-flip"
                  )}
                >
                  <div
                    className={cn(
                      "relative flex h-[82%] w-[82%] flex-col items-center justify-center gap-2 rounded-full bg-gradient-to-br text-[#2c2416] font-bold uppercase tracking-[0.25em]",
                      coinFaceToShow === 'tails'
                        ? "from-[#d7dce3] to-[#9ea5b4] text-[#102539]"
                        : "from-[#f8d98f] to-[#c68c2d]"
                    )}
                  >
                    {coinFaceToShow === 'heads' ? (
                      <>
                        <span className="text-5xl leading-none tracking-normal">1</span>
                        <span className="text-lg font-semibold tracking-[0.4em]">REAL</span>
                        <span className="text-[0.7rem] tracking-[0.45em] text-[#3f3b2d]">BRASIL</span>
                        <div className="pointer-events-none absolute inset-1 rounded-full border border-white/40" />
                        <div className="pointer-events-none absolute -top-3 right-6 h-12 w-12 rounded-full border border-white/30 bg-white/20" />
                        <div className="pointer-events-none absolute -bottom-7 left-8 h-20 w-20 rotate-[-25deg] bg-white/10" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-semibold tracking-[0.4em] text-white/80">REPÚBLICA</span>
                        <span className="text-2xl font-black tracking-[0.2em] text-white">BRASIL</span>
                        <span className="text-[0.7rem] tracking-[0.45em] text-white/70">ORDEM E PROGRESSO</span>
                        <div className="pointer-events-none absolute inset-2 rounded-full border border-white/30" />
                        <div className="pointer-events-none absolute -bottom-6 right-7 h-16 w-16 rotate-12 rounded-full bg-gradient-to-br from-[#1f3d54]/25 to-transparent" />
                      </>
                    )}
                  </div>
                </div>
                <div className="w-full max-w-xs">
                  <Button
                    variant="outline"
                    className="w-full border-white/30 text-white hover:bg-white/20 disabled:opacity-70"
                    disabled={isFlippingCoin}
                    onClick={handleCoinFlip}
                  >
                    Jogar Moeda
                  </Button>
                </div>
              </div>
              <div className="text-center text-sm text-white/80 min-h-[1.5rem]">{coinStatusMessage}</div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/20"
                onClick={() => {
                  setCoinDialogOpen(false);
                  resetCoinState();
                }}
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
