import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy, TrendingUp, Target } from "lucide-react";
import { useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { Game, GameState, PointCategory } from "@/types/volleyball";

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

const sponsorImages = [
  "https://via.placeholder.com/200x100/0066CC/FFFFFF?text=Sponsor+1",
  "https://via.placeholder.com/200x100/FF6600/FFFFFF?text=Sponsor+2", 
  "https://via.placeholder.com/200x100/00AA00/FFFFFF?text=Sponsor+3"
];

export default function SpectatorView() {
  const { gameId } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [currentSponsor, setCurrentSponsor] = useState(0);

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
    };
    loadFromDB();
  }, [gameId]);

  // Rotate stats and sponsors every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowStats(prev => !prev);
      setCurrentSponsor(prev => (prev + 1) % sponsorImages.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
                  <div className="col-span-2 text-center">
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
                  </div>

                  {/* Right Team */}
                  <div className="col-span-2 text-center">
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

            {/* Statistics Panel - Shows intermittently */}
            {showStats && (
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
                      <div className="space-y-2">
                        {Object.entries(mockStatistics.teamA).map(([category, count]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="text-sm">{getCategoryLabel(category as PointCategory)}</span>
                            <Badge variant="outline" className="text-white border-white">
                              {count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Team B Stats */}
                    <div>
                      <h3 className="text-xl font-bold mb-4 text-center">
                        {game.teamB.name}
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(mockStatistics.teamB).map(([category, count]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="text-sm">{getCategoryLabel(category as PointCategory)}</span>
                            <Badge variant="outline" className="text-white border-white">
                              {count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Set History */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-center">Histórico de Sets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: Math.max(
                    gameState.scores.teamA.length, 
                    gameState.scores.teamB.length
                  ) }).map((_, index) => (
                    <div key={index} className="text-center p-3 bg-white/5 rounded-lg">
                      <div className="text-sm mb-1">Set {index + 1}</div>
                      <div className="text-lg font-bold">
                        {gameState.scores.teamA[index] || 0} - {gameState.scores.teamB[index] || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sponsor Carousel */}
            <Card className="bg-white/10 border-white/20 text-white">
              <CardHeader>
                <CardTitle className="text-center">Patrocinadores</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <img 
                  src={sponsorImages[currentSponsor]} 
                  alt={`Patrocinador ${currentSponsor + 1}`}
                  className="w-full rounded-lg transition-all duration-1000"
                />
              </CardContent>
            </Card>

            {/* Live Indicator */}
            <div className="text-center">
              <Badge className="bg-red-500 text-white text-lg px-4 py-2 animate-pulse">
                🔴 AO VIVO
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
