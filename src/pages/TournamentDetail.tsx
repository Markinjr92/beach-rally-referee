import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Trophy, Calendar, Settings, Plus, FileText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { mockTournaments, mockGames } from "@/data/mockData";
import { formatDateShortPtBr } from "@/utils/date";
import { useEffect, useMemo, useState } from "react";

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
  const [thirdPlaceFormat, setThirdPlaceFormat] = useState('');
  const [configStep, setConfigStep] = useState(0);

  const tournament = mockTournaments.find(t => t.id === tournamentId);

  const selectedTournamentFormat = useMemo(
    () => tournamentFormats.find(format => format.id === selectedFormat),
    [selectedFormat]
  );

  const hasThirdPlace = selectedTournamentFormat?.hasThirdPlace ?? false;

  useEffect(() => {
    if (!hasThirdPlace) {
      setThirdPlaceFormat('');
    }
  }, [hasThirdPlace]);

  const configSteps = useMemo(
    () => [
      { title: "Escolha o formato do torneio" },
      { title: "Configure os formatos de jogo das fases" },
      hasThirdPlace
        ? { title: "Defina o formato da disputa de 3º lugar" }
        : { title: "Revisão final" }
    ],
    [hasThirdPlace]
  );

  const totalSteps = configSteps.length;
  const safeStepIndex = Math.min(configStep, totalSteps - 1);
  const questionTitle = configSteps[safeStepIndex]?.title ?? "";
  const isCurrentStepValid = useMemo(() => {
    if (safeStepIndex === 0) {
      return selectedFormat.length > 0;
    }
    if (safeStepIndex === 1) {
      return regularPhaseFormat.length > 0 && finalPhaseFormat.length > 0;
    }
    if (safeStepIndex === 2) {
      return hasThirdPlace ? thirdPlaceFormat.length > 0 : true;
    }
    return true;
  }, [safeStepIndex, selectedFormat, regularPhaseFormat, finalPhaseFormat, hasThirdPlace, thirdPlaceFormat]);

  const isLastStep = safeStepIndex === totalSteps - 1;

  const resetConfiguration = () => {
    setSelectedFormat('');
    setRegularPhaseFormat('');
    setFinalPhaseFormat('');
    setThirdPlaceFormat('');
    setConfigStep(0);
  };

  const handleCloseConfigDialog = () => {
    setShowCreateDialog(false);
    resetConfiguration();
  };

  const renderConfigStepContent = () => {
    switch (safeStepIndex) {
      case 0:
        return (
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-blue-50/90">
              Formato do Torneio
            </Label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger className="border-white/30 bg-white/10 text-white hover:bg-white/20">
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
              <p className="text-sm font-semibold text-blue-50/80">
                {selectedTournamentFormat?.description}
              </p>
            )}
          </div>
        );
      case 1:
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-blue-50/90">
                Jogos da fase regular
              </Label>
              <Select value={regularPhaseFormat} onValueChange={setRegularPhaseFormat}>
                <SelectTrigger className="border-white/30 bg-white/10 text-white hover:bg-white/20">
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
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-blue-50/90">
                Jogos da fase final
              </Label>
              <Select value={finalPhaseFormat} onValueChange={setFinalPhaseFormat}>
                <SelectTrigger className="border-white/30 bg-white/10 text-white hover:bg-white/20">
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
        );
      case 2:
        return hasThirdPlace ? (
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-blue-50/90">
              Formato da disputa de 3º lugar
            </Label>
            <Select value={thirdPlaceFormat} onValueChange={setThirdPlaceFormat}>
              <SelectTrigger className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <SelectValue placeholder="Escolha o formato" />
              </SelectTrigger>
              <SelectContent>
                {gameFormats.map(format => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm font-semibold text-blue-50/80">
              Utilize esta etapa para definir um formato exclusivo, como 1 set único de 21 pontos.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4 text-sm font-semibold text-blue-50/80">
            Este formato de torneio não possui disputa de 3º lugar. Revise as escolhas anteriores e conclua a configuração.
          </div>
        );
      default:
        return null;
    }
  };

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
            <Dialog
              open={showCreateDialog}
              onOpenChange={open => {
                setShowCreateDialog(open);
                if (!open) {
                  resetConfiguration();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus size={20} />
                  Configurar Torneio
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[92vw] max-w-3xl md:w-[85vw] lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#0b4f91]/70 bg-gradient-to-br from-[#0a6fd8] via-[#0bb5ff] to-[#0580c9] p-6 text-white shadow-[0_40px_80px_rgba(15,23,42,0.45)] sm:p-8">
                <DialogHeader className="space-y-4">
                  <DialogTitle className="text-xl font-extrabold text-white">
                    Configurar Formato do Torneio
                  </DialogTitle>
                  <DialogDescription className="text-sm font-semibold text-blue-50/90">
                    Defina o formato de disputa e as configurações de cada etapa para liberar o planejamento do torneio.
                  </DialogDescription>
                  <div className="flex flex-col gap-1 rounded-2xl bg-white/10 p-3 text-xs font-semibold text-blue-50/90 sm:flex-row sm:items-center sm:justify-between">
                    <span>Pergunta {totalSteps > 0 ? safeStepIndex + 1 : 0} de {totalSteps}</span>
                    {questionTitle ? (
                      <span className="text-sm font-bold text-white sm:text-base">{questionTitle}</span>
                    ) : null}
                  </div>
                </DialogHeader>
                <div className="space-y-6">
                  {renderConfigStepContent()}
                </div>
                <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    onClick={handleCloseConfigDialog}
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Cancelar
                  </Button>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {safeStepIndex > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setConfigStep(prev => Math.max(prev - 1, 0))}
                        className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                      >
                        Voltar
                      </Button>
                    )}
                    {isLastStep ? (
                      <Button
                        onClick={handleCloseConfigDialog}
                        disabled={!isCurrentStepValid}
                        className="bg-white text-slate-900 hover:bg-white/90 disabled:bg-white/30 disabled:text-white/60"
                      >
                        Salvar Configuração
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setConfigStep(prev => Math.min(prev + 1, totalSteps - 1))}
                        disabled={!isCurrentStepValid}
                        className="bg-white text-slate-900 hover:bg-white/90 disabled:bg-white/30 disabled:text-white/60"
                      >
                        Próximo
                      </Button>
                    )}
                  </div>
                </DialogFooter>
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