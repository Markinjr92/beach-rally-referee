import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { mockTournaments } from "@/data/mockData";

export default function TournamentList() {
  // Show only tournaments with active or scheduled games
  const activeTournaments = mockTournaments.filter(
    tournament => tournament.status === 'active' && 
    tournament.games.some(game => game.status === 'agendado' || game.status === 'em_andamento')
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <Trophy className="text-primary" size={40} />
            Torneios de Vôlei de Praia
          </h1>
          <p className="text-xl text-muted-foreground">
            Acompanhe os torneios e jogos em tempo real
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeTournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl mb-2">{tournament.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mb-2">
                      <MapPin size={16} />
                      {tournament.location}
                    </CardDescription>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar size={16} />
                      {new Date(tournament.startDate).toLocaleDateString('pt-BR')} - {' '}
                      {new Date(tournament.endDate).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                  <Badge 
                    variant={tournament.status === 'active' ? 'default' : 'secondary'}
                    className="bg-serving text-white"
                  >
                    {tournament.status === 'active' ? 'Ativo' : 'Em breve'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users size={16} />
                    <span>{tournament.games.length} jogos programados</span>
                  </div>
                  
                  <div className="space-y-2">
                    {tournament.games.slice(0, 3).map((game) => (
                      <div key={game.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{game.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {game.teamA.name} vs {game.teamB.name}
                          </p>
                        </div>
                        <Badge 
                          variant={game.status === 'em_andamento' ? 'destructive' : 'outline'}
                          className={game.status === 'em_andamento' ? 'bg-team-a text-white' : ''}
                        >
                          {game.status === 'em_andamento' ? 'Ao vivo' : 'Agendado'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <Link to={`/tournament/${tournament.id}`}>
                    <Button className="w-full" variant="default">
                      Ver Torneio
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {activeTournaments.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="mx-auto text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">
              Nenhum torneio ativo
            </h3>
            <p className="text-muted-foreground">
              Não há torneios com jogos em andamento no momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}