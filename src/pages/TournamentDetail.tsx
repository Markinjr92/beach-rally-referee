import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft,
  Users,
  Trophy,
  Calendar,
  Settings,
  Plus,
  FileText,
  Menu,
  LayoutDashboard,
  Users2,
  ListOrdered,
  BarChart3,
  Pencil,
  Check,
  X
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { mockTournaments } from "@/data/mockData";
import { formatDateShortPtBr } from "@/utils/date";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type TournamentFormat = {
  id: string;
  name: string;
  description: string;
  groups: number;
  teamsPerGroup: number;
  totalTeams: number;
  hasThirdPlace: boolean;
  hasRepechage: boolean;
};

type Team = {
  id: string;
  name: string;
  group: string;
  wins: number;
  losses: number;
  points: number;
};

type Match = {
  id: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  phase: string;
};

const tournamentFormats: TournamentFormat[] = [
  {
    id: "format12_a",
    name: "3 grupos com 4 equipes - Semi/Final",
    description: "Semifinal entre os campeões de cada grupo e final decisiva",
    groups: 3,
    teamsPerGroup: 4,
    totalTeams: 12,
    hasThirdPlace: false,
    hasRepechage: false
  },
  {
    id: "format12_b",
    name: "3 grupos com 4 equipes - Semi/Final + 3º lugar",
    description: "Semifinais, final e disputa de 3º lugar entre os eliminados",
    groups: 3,
    teamsPerGroup: 4,
    totalTeams: 12,
    hasThirdPlace: true,
    hasRepechage: false
  },
  {
    id: "format12_c",
    name: "3 grupos com 4 equipes - Repescagem",
    description: "1º colocados avançam, 2º e 3º colocados disputam repescagem",
    groups: 3,
    teamsPerGroup: 4,
    totalTeams: 12,
    hasThirdPlace: false,
    hasRepechage: true
  },
  {
    id: "format12_d",
    name: "3 grupos com 4 equipes - Repescagem + 3º lugar",
    description: "Repescagem para vagas semifinais e decisão de 3º lugar",
    groups: 3,
    teamsPerGroup: 4,
    totalTeams: 12,
    hasThirdPlace: true,
    hasRepechage: true
  }
];

const gameFormats = [
  { value: 'melhor3_21_15', label: 'Melhor de 3 sets (21/21/15)' },
  { value: 'melhor3_15_15', label: 'Melhor de 3 sets (15/15/15)' },
  { value: 'set_unico_21', label: '1 set único de 21 pontos' }
];

const initialTeams: Team[] = [
  { id: "team-1", name: "Brasil A", group: "A", wins: 3, losses: 0, points: 9 },
  { id: "team-2", name: "Brasil B", group: "A", wins: 2, losses: 1, points: 6 },
  { id: "team-3", name: "Argentina A", group: "A", wins: 1, losses: 2, points: 3 },
  { id: "team-4", name: "Chile A", group: "A", wins: 0, losses: 3, points: 0 },
  { id: "team-5", name: "Uruguai A", group: "B", wins: 2, losses: 1, points: 6 },
  { id: "team-6", name: "Peru A", group: "B", wins: 2, losses: 1, points: 6 },
  { id: "team-7", name: "Colômbia A", group: "B", wins: 1, losses: 2, points: 3 },
  { id: "team-8", name: "Venezuela A", group: "B", wins: 1, losses: 2, points: 3 },
  { id: "team-9", name: "Paraguai A", group: "C", wins: 3, losses: 0, points: 9 },
  { id: "team-10", name: "Bolívia A", group: "C", wins: 1, losses: 2, points: 3 },
  { id: "team-11", name: "Equador A", group: "C", wins: 1, losses: 2, points: 3 },
  { id: "team-12", name: "México A", group: "C", wins: 1, losses: 2, points: 3 }
];

const initialMatches: Match[] = [
  { id: "match-1", teamAId: "team-1", teamBId: "team-2", scoreA: 2, scoreB: 0, phase: "Grupo A" },
  { id: "match-2", teamAId: "team-3", teamBId: "team-4", scoreA: 1, scoreB: 2, phase: "Grupo A" },
  { id: "match-3", teamAId: "team-5", teamBId: "team-6", scoreA: 2, scoreB: 1, phase: "Grupo B" },
  { id: "match-4", teamAId: "team-7", teamBId: "team-8", scoreA: 0, scoreB: 2, phase: "Grupo B" },
  { id: "match-5", teamAId: "team-9", teamBId: "team-10", scoreA: 2, scoreB: 1, phase: "Grupo C" },
  { id: "match-6", teamAId: "team-11", teamBId: "team-12", scoreA: 2, scoreB: 0, phase: "Grupo C" }
];

type EditableTeamNameProps = {
  team: Team;
  onSave: (teamId: string, newName: string) => void;
  className?: string;
  textClassName?: string;
};

function EditableTeamName({ team, onSave, className, textClassName }: EditableTeamNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(team.name);

  useEffect(() => {
    setDraftName(team.name);
  }, [team.name]);

  const handleSave = () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed.length < 2) {
      return;
    }
    onSave(team.id, trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftName(team.name);
    setIsEditing(false);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isEditing ? (
        <>
          <Input
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSave();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 flex-1"
            aria-label={`Editar nome da dupla ${team.name}`}
          />
          <Button
            size="icon"
            variant="secondary"
            onClick={handleSave}
            className="h-8 w-8"
            disabled={draftName.trim().length < 2}
          >
            <Check className="h-4 w-4" />
            <span className="sr-only">Salvar nome da dupla</span>
          </Button>
          <Button size="icon" variant="outline" onClick={handleCancel} className="h-8 w-8">
            <X className="h-4 w-4" />
            <span className="sr-only">Cancelar edição</span>
          </Button>
        </>
      ) : (
        <>
          <span className={cn("font-medium", textClassName)}>{team.name}</span>
          <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="h-8 w-8">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Editar nome da dupla</span>
          </Button>
        </>
      )}
    </div>
  );
}

export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTeamsCount, setSelectedTeamsCount] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [regularPhaseFormat, setRegularPhaseFormat] = useState('');
  const [finalPhaseFormat, setFinalPhaseFormat] = useState('');
  const [thirdPlaceFormat, setThirdPlaceFormat] = useState('');
  const [configStep, setConfigStep] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [matches] = useState<Match[]>(initialMatches);

  const tournament = mockTournaments.find(t => t.id === tournamentId);

  const selectedTournamentFormat = useMemo(
    () => tournamentFormats.find(format => format.id === selectedFormat),
    [selectedFormat]
  );

  const availableTeamsCounts = useMemo(
    () =>
      Array.from(new Set(tournamentFormats.map(format => format.totalTeams)))
        .sort((a, b) => a - b)
        .map(count => count.toString()),
    []
  );

  const filteredFormats = useMemo(() => {
    if (!selectedTeamsCount) {
      return [];
    }
    return tournamentFormats.filter(format => format.totalTeams.toString() === selectedTeamsCount);
  }, [selectedTeamsCount]);

  const tabItems = useMemo(
    () => [
      { value: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
      { value: 'teams', label: 'Equipes', icon: Users2 },
      { value: 'matches', label: 'Tabela de Jogos', icon: ListOrdered },
      { value: 'standings', label: 'Classificação', icon: BarChart3 }
    ],
    []
  );

  const teamsById = useMemo(
    () => Object.fromEntries(teams.map(team => [team.id, team])) as Record<string, Team>,
    [teams]
  );

  const groupedTeams = useMemo(() => {
    return teams.reduce<Record<string, Team[]>>((groups, team) => {
      if (!groups[team.group]) {
        groups[team.group] = [];
      }
      groups[team.group].push(team);
      return groups;
    }, {});
  }, [teams]);

  const groupNames = useMemo(() => Object.keys(groupedTeams).sort(), [groupedTeams]);

  const matchesPlayed = matches.length;
  const totalPlannedMatches = useMemo(() => {
    return groupNames.reduce((acc, group) => {
      const teamsInGroup = groupedTeams[group]?.length ?? 0;
      return acc + (teamsInGroup * (teamsInGroup - 1)) / 2;
    }, 0);
  }, [groupNames, groupedTeams]);
  const matchesRemaining = Math.max(0, totalPlannedMatches - matchesPlayed);

  const hasThirdPlace = selectedTournamentFormat?.hasThirdPlace ?? false;

  const handleTeamNameUpdate = (teamId: string, newName: string) => {
    setTeams(prevTeams =>
      prevTeams.map(team => (team.id === teamId ? { ...team, name: newName } : team))
    );
  };

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
      return selectedTeamsCount.length > 0 && selectedFormat.length > 0;
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
    setSelectedTeamsCount('');
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
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-blue-50/90">Quantidade de duplas</Label>
              <Select
                value={selectedTeamsCount}
                onValueChange={value => {
                  setSelectedTeamsCount(value);
                  setSelectedFormat('');
                }}
              >
                <SelectTrigger className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  <SelectValue placeholder="Selecione a quantidade" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeamsCounts.map(count => (
                    <SelectItem key={count} value={count}>
                      {count} duplas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-blue-50/90">Formato do Torneio</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat} disabled={!selectedTeamsCount}>
                <SelectTrigger className="border-white/30 bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60">
                  <SelectValue placeholder={selectedTeamsCount ? "Selecione o formato" : "Escolha primeiro a quantidade de duplas"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredFormats.length > 0 ? (
                    filteredFormats.map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum formato disponível para esta quantidade.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedFormat && (
              <p className="rounded-xl bg-white/10 p-3 text-sm font-semibold text-blue-50/80">
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-screen bg-background">
      <header className="relative mb-10 overflow-hidden bg-gradient-to-br from-sky-900 via-sky-700 to-sky-500 text-white shadow-xl">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Link to="/tournaments">
                    <Button variant="secondary" size="sm" className="bg-white/20 text-white hover:bg-white/30">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar
                    </Button>
                  </Link>
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    TORNEIO
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tournament.name}</h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDateShortPtBr(tournament.startDate)} - {formatDateShortPtBr(tournament.endDate)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> {teams.length} duplas inscritas
                    </span>
                    <span className="flex items-center gap-1">📍 {tournament.location}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                    <Button className="flex items-center gap-2 bg-white text-sky-900 hover:bg-white/90">
                      <Plus className="h-4 w-4" />
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
                    <div className="space-y-6">{renderConfigStepContent()}</div>
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

                <Button variant="secondary" className="flex items-center gap-2 bg-white/15 text-white hover:bg-white/25">
                  <Users className="h-4 w-4" />
                  Gerenciar Equipes
                </Button>
                <Button variant="secondary" className="flex items-center gap-2 bg-white/15 text-white hover:bg-white/25">
                  <Settings className="h-4 w-4" />
                  Editar Torneio
                </Button>
                <Button variant="secondary" className="flex items-center gap-2 bg-white/15 text-white hover:bg-white/25">
                  <FileText className="h-4 w-4" />
                  Relatórios
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <TabsList className="hidden w-full items-center gap-1 overflow-x-auto rounded-full bg-white/10 p-1 shadow-lg backdrop-blur md:flex">
                {tabItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition-all data-[state=active]:bg-white data-[state=active]:text-sky-900 data-[state=active]:shadow"
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="flex items-center gap-2 bg-white/20 text-white hover:bg-white/30 md:hidden">
                    <Menu className="h-4 w-4" />
                    Navegar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {tabItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.value}
                        onSelect={() => setActiveTab(item.value)}
                        className={cn(
                          "flex items-center gap-2",
                          activeTab === item.value ? "bg-muted font-semibold" : undefined
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-12">
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Equipes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teams.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jogos Realizados</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchesPlayed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jogos Restantes</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchesRemaining}</div>
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
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groupNames.map(group => (
              <Card key={group} className="shadow-sm">
                <CardHeader>
                  <CardTitle>Grupo {group}</CardTitle>
                  <CardDescription>{groupedTeams[group]?.length ?? 0} duplas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {groupedTeams[group]
                      ?.slice()
                      .sort((a, b) => b.points - a.points)
                      .map(team => (
                        <div
                          key={team.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3"
                        >
                          <EditableTeamName
                            team={team}
                            onSave={handleTeamNameUpdate}
                            textClassName="truncate"
                          />
                          <span className="text-sm font-semibold text-muted-foreground">{team.points} pts</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Resultados dos Jogos</CardTitle>
              <CardDescription>
                Atualize os nomes das duplas para refletir imediatamente na tabela de jogos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matches.map(match => {
                  const teamA = teamsById[match.teamAId];
                  const teamB = teamsById[match.teamBId];
                  return (
                    <div
                      key={match.id}
                      className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <Badge variant="outline">{match.phase}</Badge>
                        <span className="font-semibold">{teamA?.name ?? 'Equipe A'}</span>
                        <span className="text-2xl font-bold">{match.scoreA} - {match.scoreB}</span>
                        <span className="font-semibold">{teamB?.name ?? 'Equipe B'}</span>
                      </div>
                      <Button variant="outline" size="sm" className="self-start md:self-auto">
                        Ver Detalhes
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groupNames.map(group => (
              <Card key={group} className="shadow-sm">
                <CardHeader>
                  <CardTitle>Classificação - Grupo {group}</CardTitle>
                  <CardDescription>Edite diretamente os nomes das duplas nesta tabela.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Pos</TableHead>
                        <TableHead>Dupla</TableHead>
                        <TableHead className="w-20 text-center">Vitórias</TableHead>
                        <TableHead className="w-20 text-center">Derrotas</TableHead>
                        <TableHead className="w-20 text-center">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedTeams[group]
                        ?.slice()
                        .sort((a, b) => b.points - a.points || b.wins - a.wins)
                        .map((team, index) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-semibold">{index + 1}º</TableCell>
                            <TableCell>
                              <EditableTeamName
                                team={team}
                                onSave={handleTeamNameUpdate}
                                className="justify-start"
                                textClassName="truncate"
                              />
                            </TableCell>
                            <TableCell className="text-center font-semibold">{team.wins}</TableCell>
                            <TableCell className="text-center">{team.losses}</TableCell>
                            <TableCell className="text-center font-semibold">{team.points}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </main>
    </Tabs>
  );
}