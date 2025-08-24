import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreButton } from "@/components/ui/score-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  RotateCw, 
  Clock, 
  Trophy,
  Users,
  Flag,
  Zap,
  Pause,
  ArrowLeftRight,
  UserCheck
} from "lucide-react";
import { useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { Game, GameState, PointCategory } from "@/types/volleyball";

const mainCategories = [
  { value: 'ATTACK', label: 'Ataque' },
  { value: 'BLOCK_DIRECT', label: 'Bloqueio Direto' },
  { value: 'ACE', label: 'Ace' },
  { value: 'DEFENSE_DIRECT', label: 'Defesa Direta' },
  { value: 'ERROR_ATTACK', label: 'Erro Ataque Adversário' },
  { value: 'ERROR_SERVE', label: 'Erro Saque Adversário' }
];

const attackSubcategories: { value: PointCategory; label: string }[] = [
  { value: 'ATTACK_WINNER', label: 'Super Ataque' },
  { value: 'ATTACK_DROP', label: 'Largada/Cut' },
  { value: 'ATTACK_SECOND_BALL', label: 'Bola de 2ª' }
];

export default function RefereeDesk() {
  const { gameId } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showPointCategories, setShowPointCategories] = useState<'A' | 'B' | null>(null);
  const [showAttackSubcategories, setShowAttackSubcategories] = useState<'A' | 'B' | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [showSideSwitchAlert, setShowSideSwitchAlert] = useState(false);
  const [gameHistory, setGameHistory] = useState<GameState[]>([]);

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setGameState(foundGame.gameState || null);
    }
  }, [gameId]);

  useEffect(() => {
    if (timer && timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev ? prev - 1 : 0);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

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

    // Auto-rotate server after point (maintaining dynamic rotation)
    let newGameState = { ...gameState };
    if (gameState.currentServerTeam === team) {
      // Same team scored, rotate server within team
      const maxPlayers = game.modality === 'dupla' ? 2 : 4;
      newGameState.currentServerPlayer = (gameState.currentServerPlayer % maxPlayers) + 1;
    } else {
      // Different team scored, change server team and rotate to next player
      newGameState.currentServerTeam = team;
      // When switching teams, start with the next player in rotation for the new serving team
      const maxPlayers = game.modality === 'dupla' ? 2 : 4;
      newGameState.currentServerPlayer = 1; // Start rotation from player 1 for new serving team
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
    setShowAttackSubcategories(null);
  };

  const handleCategorySelection = (team: 'A' | 'B', category: string) => {
    if (category === 'ATTACK') {
      setShowPointCategories(null);
      setShowAttackSubcategories(team);
    } else {
      addPoint(team, category as PointCategory);
    }
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

  if (!game || !gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Jogo não encontrado</p>
      </div>
    );
  }

  const currentSetIndex = gameState.currentSet - 1;
  const scoreA = gameState.scores.teamA[currentSetIndex] || 0;
  const scoreB = gameState.scores.teamB[currentSetIndex] || 0;
  const leftTeam = gameState.leftIsTeamA ? 'A' : 'B';
  const rightTeam = gameState.leftIsTeamA ? 'B' : 'A';

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{game.title}</h1>
          <p className="text-muted-foreground">{game.category} • {game.modality} • {game.format}</p>
        </div>

        {/* Main Scoreboard */}
        <Card className="mb-8 bg-gradient-scoreboard text-score-text shadow-scoreboard">
          <CardContent className="p-8">
            <div className="grid grid-cols-3 gap-8 items-center">
              {/* Left Team */}
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  {leftTeam === 'A' ? game.teamA.name : game.teamB.name}
                </h2>
                <div className="text-8xl font-bold mb-4 animate-pulse">
                  {leftTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex gap-2 justify-center">
                  {gameState.scores[leftTeam === 'A' ? 'teamA' : 'teamB'].map((setScore, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="text-score-text border-score-text"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {gameState.currentServerTeam === leftTeam && (
                  <div className="mt-4">
                    <Badge className="bg-serving text-white">
                      <Zap className="mr-1" size={16} />
                      Sacando ({gameState.currentServerPlayer})
                    </Badge>
                  </div>
                )}
              </div>

              {/* Center - Set Info */}
              <div className="text-center">
                <div className="text-lg mb-2">Set {gameState.currentSet}</div>
                <div className="text-sm opacity-75">
                  Sets: {gameState.setsWon.teamA} - {gameState.setsWon.teamB}
                </div>
                {timer && (
                  <div className="mt-4 text-xl font-bold text-timeout">
                    <Clock className="inline mr-2" size={20} />
                    {formatTime(timer)}
                  </div>
                )}
              </div>

              {/* Right Team */}
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">
                  {rightTeam === 'A' ? game.teamA.name : game.teamB.name}
                </h2>
                <div className="text-8xl font-bold mb-4 animate-pulse">
                  {rightTeam === 'A' ? scoreA : scoreB}
                </div>
                <div className="flex gap-2 justify-center">
                  {gameState.scores[rightTeam === 'A' ? 'teamA' : 'teamB'].map((setScore, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="text-score-text border-score-text"
                    >
                      {setScore}
                    </Badge>
                  ))}
                </div>
                {gameState.currentServerTeam === rightTeam && (
                  <div className="mt-4">
                    <Badge className="bg-serving text-white">
                      <Zap className="mr-1" size={16} />
                      Sacando ({gameState.currentServerPlayer})
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scoring Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy size={20} />
                Controle de Pontos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">{leftTeam === 'A' ? game.teamA.name : game.teamB.name}</h4>
                  <ScoreButton
                    variant="team"
                    size="score"
                    onClick={() => setShowPointCategories(leftTeam)}
                    className="w-full"
                  >
                    <Plus size={24} />
                  </ScoreButton>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">{rightTeam === 'A' ? game.teamA.name : game.teamB.name}</h4>
                  <ScoreButton
                    variant="teamB"
                    size="score"
                    onClick={() => setShowPointCategories(rightTeam)}
                    className="w-full"
                  >
                    <Plus size={24} />
                  </ScoreButton>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeouts & Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} />
                Timeouts & Controles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => startTimeout('team', 'A')}
                  disabled={!!timer}
                >
                  <Pause className="mr-2" size={16} />
                  Timeout A
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => startTimeout('team', 'B')}
                  disabled={!!timer}
                >
                  <Pause className="mr-2" size={16} />
                  Timeout B
                </Button>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => startTimeout('technical')}
                disabled={!!timer}
              >
                <Clock className="mr-2" size={16} />
                Tempo Técnico
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => startTimeout('medical')}
                disabled={!!timer}
              >
                Tempo Médico (5min)
              </Button>
              <div className="space-y-2">
                <div className="text-sm font-medium mb-2">Controles de Override:</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={switchServerTeam}
                >
                  <ArrowLeftRight className="mr-2" size={16} />
                  Trocar Posse ({gameState.currentServerTeam === 'A' ? 'B' : 'A'})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={changeCurrentServer}
                >
                  <UserCheck className="mr-2" size={16} />
                  Próximo Sacador ({gameState.currentServerTeam} - {((gameState.currentServerPlayer % (game.modality === 'dupla' ? 2 : 4)) + 1)})
                </Button>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={undoLastAction}
                  disabled={gameHistory.length === 0}
                >
                  <RotateCcw className="mr-2" size={16} />
                  Desfazer ({gameHistory.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Game Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                Informações do Jogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Formato:</span>
                  <span className="font-medium">{game.format}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vantagem 2 pontos:</span>
                  <span className="font-medium">{game.needTwoPointLead ? 'Sim' : 'Não'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Troca aos:</span>
                  <span className="font-medium">{game.sideSwitchSum[currentSetIndex]} pontos</span>
                </div>
                <div className="flex justify-between">
                  <span>Timeouts por set:</span>
                  <span className="font-medium">{game.teamTimeoutsPerSet}</span>
                </div>
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

        {/* Attack Subcategory Modal */}
        {showAttackSubcategories && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>
                  Tipo de Ataque - {showAttackSubcategories === 'A' ? game.teamA.name : game.teamB.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {attackSubcategories.map((subcategory) => (
                    <Button
                      key={subcategory.value}
                      variant="outline"
                      onClick={() => addPoint(showAttackSubcategories, subcategory.value)}
                      className="text-left justify-start"
                    >
                      {subcategory.label}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setShowAttackSubcategories(null)}
                >
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}