import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy } from "lucide-react";
import { useParams } from "react-router-dom";
import { mockGames } from "@/data/mockData";
import { Game, GameState } from "@/types/volleyball";

export default function PublicScoreboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const foundGame = mockGames.find(g => g.id === gameId);
    if (foundGame) {
      setGame(foundGame);
      setGameState(foundGame.gameState || null);
    }
  }, [gameId]);

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
            <div className="col-span-2 text-center">
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
                <div className="flex gap-4 justify-center">
                  {Array.from({ length: Math.max(
                    gameState.scores.teamA.length, 
                    gameState.scores.teamB.length
                  ) }).map((_, index) => (
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
            <div className="col-span-2 text-center">
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