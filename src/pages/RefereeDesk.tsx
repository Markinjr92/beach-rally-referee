import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreButton } from "@/components/ui/score-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Game, GameState, PointCategory, Timer } from "@/types/volleyball";
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

      if (match.status === 'scheduled') {
        await supabase.from('matches').update({ status: 'in_progress' }).eq('id', match.id);
      }

      setIsLoading(false);
    };

    void loadFromDB();
  }, [gameId, notifyFallbackActivated]);

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

  const addPoint = async (team: 'A' | 'B', category: PointCategory) => {
    if (!gameState || !game || timer !== null || isSyncing) return;
    if (gameState.isGameEnded) {
      toast({
        title: 'Partida já finalizada',
        description: 'Não é possível adicionar pontos após o término do jogo.',
        variant: 'destructive',
      });
      return;
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
    };

    if (previousState.possession !== team) {
      const previousServerTeam = previousState.currentServerTeam;
      updatedState.currentServerTeam = team;
      updatedState.possession = team;

      const maxPlayers = game.modality === 'dupla' ? 2 : 4;
      if (previousServerTeam === team) {
        updatedState.currentServerPlayer = (previousState.currentServerPlayer % maxPlayers) + 1;
      } else {
        updatedState.currentServerPlayer = 1;
      }
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

    const targetPoints =
      game.pointsPerSet?.[currentSet] ??
      game.pointsPerSet?.[game.pointsPerSet.length - 1] ??
      21;
    const winnerKey: 'teamA' | 'teamB' = team === 'A' ? 'teamA' : 'teamB';
    const opponentKey: 'teamA' | 'teamB' = team === 'A' ? 'teamB' : 'teamA';
    const winnerScore = updatedScores[winnerKey][currentSet];
    const opponentScore = updatedScores[opponentKey][currentSet];
    const minimumLead = game.needTwoPointLead ? 2 : 1;
    const setWon = winnerScore >= targetPoints && winnerScore - opponentScore >= minimumLead;

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
        updatedState.currentServerTeam = team;
        updatedState.possession = team;
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

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const updatedState: GameState = {
      ...previousState,
      currentServerTeam: previousState.currentServerTeam === 'A' ? 'B' : 'A',
      currentServerPlayer: 1,
    };

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

    const previousState = snapshotState(gameState);
    setGameHistory(prev => [...prev, previousState]);

    const maxPlayers = game.modality === 'dupla' ? 2 : 4;
    const nextPlayer = (previousState.currentServerPlayer % maxPlayers) + 1;

    const updatedState: GameState = {
      ...previousState,
      currentServerPlayer: nextPlayer,
    };

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

  const currentSetIndex = gameState.currentSet - 1;
  const scoreA = gameState.scores.teamA[currentSetIndex] || 0;
  const scoreB = gameState.scores.teamB[currentSetIndex] || 0;
  const leftTeam = gameState.leftIsTeamA ? 'A' : 'B';
  const rightTeam = gameState.leftIsTeamA ? 'B' : 'A';
  const leftTeamName = leftTeam === 'A' ? game.teamA.name : game.teamB.name;
  const rightTeamName = rightTeam === 'A' ? game.teamA.name : game.teamB.name;
  const leftTeamScores = leftTeam === 'A' ? gameState.scores.teamA : gameState.scores.teamB;
  const rightTeamScores = rightTeam === 'A' ? gameState.scores.teamA : gameState.scores.teamB;
  const serverTeamName = gameState.currentServerTeam === 'A' ? game.teamA.name : game.teamB.name;
  const leftTeamColorClass = leftTeam === 'A' ? 'bg-team-a' : 'bg-team-b';
  const rightTeamColorClass = rightTeam === 'A' ? 'bg-team-a' : 'bg-team-b';
  const leftScoreButtonVariant = leftTeam === 'A' ? 'team' : 'teamB';
  const rightScoreButtonVariant = rightTeam === 'A' ? 'team' : 'teamB';
  const leftHasPossession = gameState.possession === leftTeam;
  const rightHasPossession = gameState.possession === rightTeam;
  const possessionGlow = 'shadow-[0_0_35px_rgba(250,204,21,0.4)]';
  const possessionTeamName = gameState.possession === 'A' ? game.teamA.name : game.teamB.name;

  const coinFaceToShow = (coinResult ?? 'heads') as CoinSide;
  const gameIsEnded = gameState.isGameEnded;
  const mobileControlButtons = [
    {
      icon: RotateCcw,
      label: 'Desfazer',
      onClick: () => void undoLastAction(),
      disabled: gameHistory.length === 0,
    },
    {
      icon: Pause,
      label: 'Timeout A',
      onClick: () => void startTimeout('team', 'A'),
      disabled: !!gameState?.activeTimer || gameIsEnded,
    },
    {
      icon: Pause,
      label: 'Timeout B',
      onClick: () => void startTimeout('team', 'B'),
      disabled: !!gameState?.activeTimer || gameIsEnded,
    },
    {
      icon: Stethoscope,
      label: 'Tempo Médico',
      onClick: () => void startTimeout('medical'),
      disabled: !!gameState?.activeTimer || gameIsEnded,
    },
    {
      icon: Square,
      label: 'Encerrar Tempo',
      onClick: () => {
        if (gameState?.activeTimer) {
          void finalizeTimeout(gameState.activeTimer);
        }
      },
      disabled: !gameState?.activeTimer,
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
      disabled: false,
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-ocean text-white">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Button
              variant="outline"
              className="w-fit bg-amber-400 text-slate-900 font-semibold border-transparent hover:bg-amber-300 md:border-white/30 md:bg-transparent md:text-white md:hover:bg-white/20"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="hidden md:block md:text-right">
              <h1 className="text-3xl font-bold">{game.title}</h1>
              <p className="text-white/70">{game.category} • {game.modality} • {game.format}</p>
            </div>
          </div>
          <div className="hidden flex-wrap gap-3 text-xs sm:text-sm text-white/80 md:flex">
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Set atual: {gameState.currentSet}
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Parcial de sets {gameState.setsWon.teamA} - {gameState.setsWon.teamB}
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Sacando: {serverTeamName} ({gameState.currentServerPlayer})
            </Badge>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              Posse: {possessionTeamName}
            </Badge>
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
                {gameState.currentServerTeam === leftTeam && (
                  <Badge className="border border-white/30 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({gameState.currentServerPlayer})
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
                {gameState.currentServerTeam === rightTeam && (
                  <Badge className="border border-white/30 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({gameState.currentServerPlayer})
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2 bg-slate-900/80 px-4 py-3 text-center text-sm text-white/80">
              <div className="text-base font-semibold text-white">Set {gameState.currentSet}</div>
              <div>Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}</div>
              <div className="flex items-center justify-center gap-2 text-amber-200">
                <Zap className="h-4 w-4" />
                Sacando: {serverTeamName} ({gameState.currentServerPlayer})
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
                if (timer !== null || gameIsEnded) return;
                setShowPointCategories(leftTeam);
              }}
              disabled={timer !== null || gameIsEnded}
              className="h-20 w-full text-4xl"
            >
              <Plus size={24} />
            </ScoreButton>
            <ScoreButton
              variant={rightScoreButtonVariant}
              size="score"
              onClick={() => {
                if (timer !== null || gameIsEnded) return;
                setShowPointCategories(rightTeam);
              }}
              disabled={timer !== null || gameIsEnded}
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
                {gameState.currentServerTeam === leftTeam && (
                  <Badge className="border border-white/40 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({gameState.currentServerPlayer})
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
                {gameState.currentServerTeam === rightTeam && (
                  <Badge className="border border-white/40 bg-white/25 text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({gameState.currentServerPlayer})
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
                      if (timer !== null || gameIsEnded) return;
                      setShowPointCategories(leftTeam);
                    }}
                    disabled={timer !== null || gameIsEnded}
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
                      if (timer !== null || gameIsEnded) return;
                      setShowPointCategories(rightTeam);
                    }}
                    disabled={timer !== null || gameIsEnded}
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
                  disabled={gameHistory.length === 0}
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
                  Próximo Sacador ({gameState.currentServerTeam} - {((gameState.currentServerPlayer % (game.modality === 'dupla' ? 2 : 4)) + 1)})
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
