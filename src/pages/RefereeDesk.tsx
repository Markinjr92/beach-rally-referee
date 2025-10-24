import { useState, useEffect, useMemo, useRef } from "react";
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
  UserCheck
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { Game, GameState, PointCategory } from "@/types/volleyball";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showPointCategories, setShowPointCategories] = useState<'A' | 'B' | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [showSideSwitchAlert, setShowSideSwitchAlert] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);
  const [coinDialogOpen, setCoinDialogOpen] = useState(false);
  const [selectedCoinSide, setSelectedCoinSide] = useState<CoinSide | null>(null);
  const [coinResult, setCoinResult] = useState<CoinSide | null>(null);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const flipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coinResultLabel = useMemo(() => (coinResult ? coinLabels[coinResult] : null), [coinResult]);

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setGameState(foundGame.gameState || null);
      return;
    }

    const loadFromDB = async () => {
      if (!gameId) return;
      const { data: match } = await supabase.from('matches').select('*').eq('id', gameId).single();
      if (!match) return;
      const { data: teams } = await supabase.from('teams').select('*').in('id', [match.team_a_id, match.team_b_id]);
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
      setGameState({
        id: `${match.id}-state`,
        gameId: match.id,
        currentSet: 1,
        setsWon: { teamA: 0, teamB: 0 },
        scores: { teamA: [0, 0, 0], teamB: [0, 0, 0] },
        currentServerTeam: 'A',
        currentServerPlayer: 1,
        possession: 'A',
        leftIsTeamA: true,
        timeoutsUsed: { teamA: [0, 0, 0], teamB: [0, 0, 0] },
        technicalTimeoutUsed: [false, false, false],
        sidesSwitched: [0, 0, 0],
        events: [],
        isGameEnded: false,
      });

      if (match.status === 'scheduled') {
        await supabase.from('matches').update({ status: 'in_progress' }).eq('id', match.id);
      }
    };
    loadFromDB();
  }, [gameId]);

  useEffect(() => {
    if (timer && timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev ? prev - 1 : 0);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  useEffect(() => {
    return () => {
      clearCoinAnimations();
    };
  }, []);

  const addPoint = (team: 'A' | 'B', category: PointCategory) => {
    if (!gameState || !game) return;

    const newScores = { ...gameState.scores };
    const currentSet = gameState.currentSet - 1;
    
    if (team === 'A') {
      newScores.teamA[currentSet]++;
    } else {
      newScores.teamB[currentSet]++;
    }

    // Save current state to history before making changes
    setGameHistory(prev => [...prev, { ...gameState }]);

    // Handle server rotation based on possession change
    const newGameState = { ...gameState };
    
    // Only change server if possession changes (different team scored)
    if (gameState.possession !== team) {
      // Store previous serving team for comparison
      const previousServerTeam = gameState.currentServerTeam;
      
      // Possession changes - new team gains serve
      newGameState.currentServerTeam = team;
      newGameState.possession = team;
      
      // When a team gains serve, rotate to next player in that team
      const maxPlayers = game.modality === 'dupla' ? 2 : 4;
      
      if (previousServerTeam === team) {
        // Same team regains serve - rotate to next player
        newGameState.currentServerPlayer = (gameState.currentServerPlayer % maxPlayers) + 1;
      } else {
        // Different team gains serve - start with player 1
        newGameState.currentServerPlayer = 1;
      }
    } else {
      // Same team continues scoring - no server change, just update possession
      newGameState.possession = team;
    }

    // Check for side switch
    const totalPoints = newScores.teamA[currentSet] + newScores.teamB[currentSet];
    const sideSwitchSum = game.sideSwitchSum[currentSet];
    const shouldSwitch = totalPoints > 0 && totalPoints % sideSwitchSum === 0;

    if (shouldSwitch) {
      setShowSideSwitchAlert(true);
      // Auto hide alert after 3 seconds
      setTimeout(() => setShowSideSwitchAlert(false), 3000);
    }

    setGameState({
      ...newGameState,
      scores: newScores,
      leftIsTeamA: shouldSwitch ? !gameState.leftIsTeamA : gameState.leftIsTeamA,
      sidesSwitched: shouldSwitch ? 
        gameState.sidesSwitched.map((count, i) => i === currentSet ? count + 1 : count) :
        gameState.sidesSwitched
    });

    setShowPointCategories(null);
  };

  const handleCategorySelection = (team: 'A' | 'B', category: string) => {
    addPoint(team, category as PointCategory);
  };

  const switchServerTeam = () => {
    if (!gameState) return;
    
    // Save current state to history
    setGameHistory(prev => [...prev, { ...gameState }]);
    
    setGameState({
      ...gameState,
      currentServerTeam: gameState.currentServerTeam === 'A' ? 'B' : 'A',
      currentServerPlayer: 1 // Reset to first player when switching teams
    });
  };

  const changeCurrentServer = () => {
    if (!gameState || !game) return;
    
    // Save current state to history
    setGameHistory(prev => [...prev, { ...gameState }]);
    
    const maxPlayers = game.modality === 'dupla' ? 2 : 4;
    const nextPlayer = (gameState.currentServerPlayer % maxPlayers) + 1;
    
    setGameState({
      ...gameState,
      currentServerPlayer: nextPlayer
    });
  };

  const undoLastAction = () => {
    if (gameHistory.length === 0) return;

    const lastState = gameHistory[gameHistory.length - 1];
    setGameState(lastState);
    setGameHistory(prev => prev.slice(0, -1));
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
    setSelectedCoinSide(null);
    setCoinResult(null);
    setIsFlippingCoin(false);
  };

  const handleCoinFlip = (side: CoinSide) => {
    setSelectedCoinSide(side);
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

  const startTimeout = (type: 'team' | 'technical' | 'medical', team?: 'A' | 'B') => {
    if (type === 'team') {
      setTimer(30);
    } else if (type === 'technical') {
      setTimer(30);
    } else if (type === 'medical') {
      setTimer(300); // 5 minutes
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const coinStatusMessage = useMemo(() => {
    if (!selectedCoinSide) return 'Selecione uma face para iniciar o sorteio.';
    if (isFlippingCoin) return 'Girando moeda...';
    if (coinResultLabel) return `Resultado: ${coinResultLabel}`;
    return 'Toque novamente para sortear.';
  }, [coinResultLabel, isFlippingCoin, selectedCoinSide]);

  const coinOutcomeMessage = useMemo(() => {
    if (!selectedCoinSide || !coinResult || isFlippingCoin) return null;
    return selectedCoinSide === coinResult
      ? 'Sua escolha venceu o sorteio!'
      : 'A outra equipe inicia com a escolha vencedora.';
  }, [coinResult, isFlippingCoin, selectedCoinSide]);

  if (!game || !gameState) {
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

  const coinFaceToShow = (coinResult ?? selectedCoinSide ?? 'heads') as CoinSide;

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
          </div>
        </div>

        {/* Mobile Scoreboard */}
        <div className="space-y-4 md:hidden">
          <div className="rounded-2xl border border-white/20 bg-slate-900/80 p-4 text-white shadow-scoreboard">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-base font-semibold">
              <span className="flex-1 text-left">{game.teamA.name}</span>
              <div className="flex items-center gap-2 text-2xl font-extrabold">
                <span>{scoreA}</span>
                <span className="text-lg font-semibold text-white/70">x</span>
                <span>{scoreB}</span>
              </div>
              <span className="flex-1 text-right">{game.teamB.name}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/70">
              <span>Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}</span>
              <span className="flex items-center gap-1 text-amber-200">
                <Zap className="h-4 w-4" />
                Sacando: {serverTeamName} ({gameState.currentServerPlayer})
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ScoreButton
              variant="team"
              size="score"
              onClick={() => setShowPointCategories('A')}
              className="h-20 w-full text-4xl"
            >
              <Plus size={24} />
            </ScoreButton>
            <ScoreButton
              variant="teamB"
              size="score"
              onClick={() => setShowPointCategories('B')}
              className="h-20 w-full text-4xl"
            >
              <Plus size={24} />
            </ScoreButton>
          </div>
        </div>

        {/* Main Scoreboard */}
        <Card className="hidden bg-slate-900/80 border border-white/20 text-score-text shadow-scoreboard backdrop-blur-xl md:block">
          <CardContent className="p-6 lg:p-10">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold text-white/90">{leftTeamName}</h2>
                <div className="text-7xl sm:text-8xl font-extrabold">
                  {leftTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {leftTeamScores.map((setScore, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-score-text/40 bg-white/10 text-score-text"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {gameState.currentServerTeam === leftTeam && (
                  <Badge className="bg-serving text-white">
                    <Zap className="mr-1 h-4 w-4" />
                    Sacando ({gameState.currentServerPlayer})
                  </Badge>
                )}
              </div>

              <div className="space-y-4 text-center">
                <div className="text-lg font-medium text-white/80">Set {gameState.currentSet}</div>
                <div className="text-sm text-white/70">
                  Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}
                </div>
                {timer !== null && (
                  <div className="mx-auto w-fit rounded-full border border-amber-200/60 bg-amber-200/10 px-5 py-2 text-lg font-semibold text-amber-100 shadow-inner">
                    <Clock className="mr-2 inline h-5 w-5" />
                    {formatTime(timer)}
                  </div>
                )}
              </div>

              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold text-white/90">{rightTeamName}</h2>
                <div className="text-7xl sm:text-8xl font-extrabold">
                  {rightTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {rightTeamScores.map((setScore, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-score-text/40 bg-white/10 text-score-text"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {gameState.currentServerTeam === rightTeam && (
                  <Badge className="bg-serving text-white">
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
          <Card className="xl:col-span-7 bg-white/10 border border-white/20 text-white backdrop-blur-lg">
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
                    variant="team"
                    size="score"
                    onClick={() => setShowPointCategories(leftTeam)}
                    className="h-28 w-full text-5xl"
                  >
                    <Plus size={28} />
                  </ScoreButton>
                </div>
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-white/90">{rightTeamName}</h4>
                  <ScoreButton
                    variant="teamB"
                    size="score"
                    onClick={() => setShowPointCategories(rightTeam)}
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
                  onClick={undoLastAction}
                  disabled={gameHistory.length === 0}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Desfazer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeouts & Controles */}
          <Card className="xl:col-span-3 bg-white/10 border border-white/20 text-white backdrop-blur-lg">
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
                  onClick={() => startTimeout('team', 'A')}
                  disabled={!!timer}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Timeout A
                </Button>
                <Button
                  variant="outline"
                  className="border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                  onClick={() => startTimeout('team', 'B')}
                  disabled={!!timer}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Timeout B
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                onClick={() => startTimeout('technical')}
                disabled={!!timer}
              >
                <Clock className="mr-2 h-4 w-4" />
                Tempo Técnico
              </Button>
              <Button
                variant="outline"
                className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35 disabled:opacity-60"
                onClick={() => startTimeout('medical')}
                disabled={!!timer}
              >
                Tempo Médico (5min)
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
                  onClick={switchServerTeam}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Trocar Posse ({gameState.currentServerTeam === 'A' ? 'B' : 'A'})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-transparent bg-white/25 text-white font-semibold hover:bg-white/35"
                  onClick={changeCurrentServer}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Próximo Sacador ({gameState.currentServerTeam} - {((gameState.currentServerPlayer % (game.modality === 'dupla' ? 2 : 4)) + 1)})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Game Info */}
          <Card className="xl:col-span-2 bg-white/10 border border-white/20 text-white backdrop-blur-lg">
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
                <div className="grid w-full max-w-xs grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className={cn(
                      "border-white/30 text-white hover:bg-white/20",
                      selectedCoinSide === 'heads' && !isFlippingCoin && "bg-white/20 border-white/60"
                    )}
                    disabled={isFlippingCoin}
                    onClick={() => handleCoinFlip('heads')}
                  >
                    Cara
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "border-white/30 text-white hover:bg-white/20",
                      selectedCoinSide === 'tails' && !isFlippingCoin && "bg-white/20 border-white/60"
                    )}
                    disabled={isFlippingCoin}
                    onClick={() => handleCoinFlip('tails')}
                  >
                    Coroa
                  </Button>
                </div>
              </div>
              <div className="text-center text-sm text-white/80 min-h-[1.5rem]">{coinStatusMessage}</div>
              {coinOutcomeMessage && (
                <div className="text-center text-base font-semibold text-amber-200">
                  {coinOutcomeMessage}
                </div>
              )}
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
