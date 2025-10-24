import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Trophy, Calendar, Settings, Plus, FileText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { mockTournaments, mockGames } from "@/data/mockData";
import { formatDateShortPtBr } from "@/utils/date";
import { useState } from "react";

const tournamentFormats = [
  {
    id: 'format1',
    name: '2 grupos com 4 equipes - Semi/Final',
    description: 'Semifinal e final diretas',
    groups: 2,
    teamsPerGroup: 4,
    hasThirdPlace: false,
    hasRepechage: false
  },
  {
    id: 'format2', 
    name: '2 grupos com 4 equipes - Semi/Final + 3º lugar',
    description: 'Semifinal, final e disputa de 3º lugar',
    groups: 2,
    teamsPerGroup: 4,
    hasThirdPlace: true,
    hasRepechage: false
  },
  {
    id: 'format3',
    name: '2 grupos com 4 equipes - Repescagem',
    description: '1º colocados para semi, 2º e 3º fazem repescagem',
    groups: 2,
    teamsPerGroup: 4,
    hasThirdPlace: false,
    hasRepechage: true
  },
  {
    id: 'format4',
    name: '2 grupos com 4 equipes - Repescagem + 3º lugar',
    description: '1º colocados para semi, 2º e 3º fazem repescagem, disputa 3º lugar',
    groups: 2,
    teamsPerGroup: 4,
    hasThirdPlace: true,
    hasRepechage: true
  },
  {
    id: 'format5',
    name: '2 grupos com 3 equipes - Semi/Final',
    description: 'Semifinal e final diretas',
    groups: 2,
    teamsPerGroup: 3,
    hasThirdPlace: false,
    hasRepechage: false
  },
  {
    id: 'format6',
    name: '2 grupos com 3 equipes - Semi/Final + 3º lugar',
    description: 'Semifinal, final e disputa de 3º lugar',
    groups: 2,
    teamsPerGroup: 3,
    hasThirdPlace: true,
    hasRepechage: false
  },
  {
    id: 'format7',
    name: '3 grupos com 3 equipes - Repescagem especial',
    description: '2 melhores 1º para semi, 3º melhor 1º + 3 segundos fazem repescagem',
    groups: 3,
    teamsPerGroup: 3,
    hasThirdPlace: false,
    hasRepechage: true
  }
];

const gameFormats = [
  { value: 'melhor3_21_15', label: 'Melhor de 3 sets (21/21/15)' },
  { value: 'melhor3_15_15', label: 'Melhor de 3 sets (15/15/15)' },
  { value: 'set_unico_21', label: '1 set único de 21 pontos' }
];

export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [regularPhaseFormat, setRegularPhaseFormat] = useState('');
  const [finalPhaseFormat, setFinalPhaseFormat] = useState('');
  
  const tournament = mockTournaments.find(t => t.id === tournamentId);
  
  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Torneio não encontrado</p>
      </div>
    );
  }

  const mockTeams = [
    { id: '1', name: 'Brasil A', group: 'A', wins: 2, losses: 0, points: 6 },
    { id: '2', name: 'Brasil B', group: 'A', wins: 1, losses: 1, points: 3 },
    { id: '3', name: 'Argentina A', group: 'A', wins: 1, losses: 1, points: 3 },
    { id: '4', name: 'Chile A', group: 'A', wins: 0, losses: 2, points: 0 },
    { id: '5', name: 'Uruguai A', group: 'B', wins: 2, losses: 0, points: 6 },
    { id: '6', name: 'Peru A', group: 'B', wins: 1, losses: 1, points: 3 },
    { id: '7', name: 'Colômbia A', group: 'B', wins: 1, losses: 1, points: 3 },
    { id: '8', name: 'Venezuela A', group: 'B', wins: 0, losses: 2, points: 0 }
  ];

  const mockResults = [
    { teamA: 'Brasil A', teamB: 'Brasil B', scoreA: 2, scoreB: 0, phase: 'Grupo A' },
    { teamA: 'Argentina A', teamB: 'Chile A', scoreA: 2, scoreB: 1, phase: 'Grupo A' },
    { teamA: 'Uruguai A', teamB: 'Peru A', scoreA: 2, scoreB: 0, phase: 'Grupo B' },
    { teamA: 'Colômbia A', teamB: 'Venezuela A', scoreA: 2, scoreB: 1, phase: 'Grupo B' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/tournaments">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2" size={16} />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{tournament.name}</h1>
              <p className="text-muted-foreground flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar size={16} />
                  {formatDateShortPtBr(tournament.startDate)} - {formatDateShortPtBr(tournament.endDate)}
                </span>
                <span>📍 {tournament.location}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus size={20} />
                  Configurar Torneio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Configurar Formato do Torneio</DialogTitle>
                  <DialogDescription>
                    Defina o formato de disputa e configurações dos jogos
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div>
                    <Label>Formato do Torneio</Label>
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournamentFormats.map(format => (
                          <SelectItem key={format.id} value={format.id}>
                            {format.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedFormat && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {tournamentFormats.find(f => f.id === selectedFormat)?.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Jogos da Fase Regular</Label>
                      <Select value={regularPhaseFormat} onValueChange={setRegularPhaseFormat}>
                        <SelectTrigger>
                          <SelectValue placeholder="Formato dos jogos" />
                        </SelectTrigger>
                        <SelectContent>
                          {gameFormats.map(format => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Jogos da Fase Final</Label>
                      <Select value={finalPhaseFormat} onValueChange={setFinalPhaseFormat}>
                        <SelectTrigger>
                          <SelectValue placeholder="Formato dos jogos" />
                        </SelectTrigger>
                        <SelectContent>
                          {gameFormats.map(format => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => setShowCreateDialog(false)}>
                      Salvar Configuração
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" className="flex items-center gap-2">
              <Users size={20} />
              Gerenciar Equipes
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings size={20} />
              Editar Torneio
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <FileText size={20} />
              Relatórios
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="teams">Equipes</TabsTrigger>
            <TabsTrigger value="matches">Tabela de Jogos</TabsTrigger>
            <TabsTrigger value="standings">Classificação</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Equipes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Jogos Realizados</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Jogos Restantes</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fase Atual</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Grupos</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Grupo A</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mockTeams.filter(team => team.group === 'A').map(team => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-sm text-muted-foreground">{team.points} pts</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Grupo B</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mockTeams.filter(team => team.group === 'B').map(team => (
                      <div key={team.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-sm text-muted-foreground">{team.points} pts</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resultados dos Jogos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{result.phase}</Badge>
                        <span className="font-medium">{result.teamA}</span>
                        <span className="text-2xl font-bold">{result.scoreA} - {result.scoreB}</span>
                        <span className="font-medium">{result.teamB}</span>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver Detalhes
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Classificação - Grupo A</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mockTeams
                      .filter(team => team.group === 'A')
                      .sort((a, b) => b.points - a.points)
                      .map((team, index) => (
                        <div key={team.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{index + 1}º</span>
                            <span className="font-medium">{team.name}</span>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-bold">{team.points} pts</div>
                            <div className="text-muted-foreground">{team.wins}V - {team.losses}D</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Classificação - Grupo B</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mockTeams
                      .filter(team => team.group === 'B')
                      .sort((a, b) => b.points - a.points)
                      .map((team, index) => (
                        <div key={team.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{index + 1}º</span>
                            <span className="font-medium">{team.name}</span>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-bold">{team.points} pts</div>
                            <div className="text-muted-foreground">{team.wins}V - {team.losses}D</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}