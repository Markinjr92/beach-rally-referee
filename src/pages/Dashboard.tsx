import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users, Gamepad2, Trophy, Eye, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DashboardStats {
  totalUsers: number;
  totalTournaments: number;
  totalTournamentMatches: number;
  totalCasualMatches: number;
  activeUsers: number;
  topUsers: Array<{
    user_id: string;
    email: string | null;
    name: string | null;
    match_count: number;
  }>;
  totalPageViews: number;
  uniqueVisitors: number;
  pageViewsByType: {
    tournament_public: number;
    tournament_info: number;
    scoreboard: number;
    spectator: number;
  };
  topTournamentsByViews: Array<{
    tournament_id: string;
    tournament_name: string | null;
    view_count: number;
  }>;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles(user, loading);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = roles.includes("admin_sistema");

  useEffect(() => {
    const fetchStats = async () => {
      if (!isAdmin) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Buscar estatísticas em paralelo
        const [
          usersResult,
          tournamentsResult,
          matchesResult,
          casualMatchesResult,
          pageViewsResult,
        ] = await Promise.all([
          // Total de usuários
          supabase
            .from("users")
            .select("id", { count: "exact", head: true }),
          
          // Total de torneios
          supabase
            .from("tournaments")
            .select("id", { count: "exact", head: true }),
          
          // Total de jogos de torneio
          supabase
            .from("matches")
            .select("id", { count: "exact", head: true }),
          
          // Total de jogos avulsos
          supabase
            .from("casual_matches")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          
          // Total de acessos
          supabase
            .from("page_views")
            .select("id, page_type, resource_id, user_id, ip_address", { count: "exact" }),
        ]);

        // Buscar usuários ativos (com jogos ou torneios criados)
        const [activeCasualMatches, activeTournaments] = await Promise.all([
          supabase
            .from("casual_matches")
            .select("user_id")
            .is("deleted_at", null),
          supabase
            .from("tournaments")
            .select("created_by")
            .not("created_by", "is", null),
        ]);

        const uniqueActiveUsers = new Set<string>();
        activeCasualMatches.data?.forEach((m) => uniqueActiveUsers.add(m.user_id));
        activeTournaments.data?.forEach((t) => {
          if (t.created_by) uniqueActiveUsers.add(t.created_by);
        });

        // Buscar top usuários por quantidade de jogos criados
        const { data: topUsersData } = await supabase
          .from("casual_matches")
          .select("user_id")
          .is("deleted_at", null);

        // Contar jogos por usuário
        const userMatchCounts = new Map<string, number>();
        topUsersData?.forEach((match) => {
          const count = userMatchCounts.get(match.user_id) || 0;
          userMatchCounts.set(match.user_id, count + 1);
        });

        // Buscar informações dos top usuários
        const topUserIds = Array.from(userMatchCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([userId]) => userId);

        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, name")
          .in("id", topUserIds);

        const topUsers = topUserIds
          .map((userId) => {
            const user = usersData?.find((u) => u.id === userId);
            return {
              user_id: userId,
              email: user?.email || null,
              name: user?.name || null,
              match_count: userMatchCounts.get(userId) || 0,
            };
          })
          .sort((a, b) => b.match_count - a.match_count);

        // Processar estatísticas de acessos
        const pageViewsData = pageViewsResult.data || [];
        const totalPageViews = pageViewsResult.count || 0;
        
        // Contar visitantes únicos (por user_id ou ip_address)
        const uniqueVisitorsSet = new Set<string>();
        pageViewsData.forEach((view) => {
          if (view.user_id) {
            uniqueVisitorsSet.add(`user_${view.user_id}`);
          } else if (view.ip_address) {
            uniqueVisitorsSet.add(`ip_${view.ip_address}`);
          }
        });
        const uniqueVisitors = uniqueVisitorsSet.size;

        // Contar acessos por tipo
        const pageViewsByType = {
          tournament_public: pageViewsData.filter(v => v.page_type === 'tournament_public').length,
          tournament_info: pageViewsData.filter(v => v.page_type === 'tournament_info').length,
          scoreboard: pageViewsData.filter(v => v.page_type === 'scoreboard').length,
          spectator: pageViewsData.filter(v => v.page_type === 'spectator').length,
        };

        // Top torneios mais acessados (apenas tournament_public e tournament_info)
        const tournamentViews = new Map<string, number>();
        pageViewsData
          .filter(v => v.page_type === 'tournament_public' || v.page_type === 'tournament_info')
          .forEach((view) => {
            const count = tournamentViews.get(view.resource_id) || 0;
            tournamentViews.set(view.resource_id, count + 1);
          });

        const topTournamentIds = Array.from(tournamentViews.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tournamentId]) => tournamentId);

        const { data: topTournamentsData } = await supabase
          .from("tournaments")
          .select("id, name")
          .in("id", topTournamentIds);

        const topTournamentsByViews = topTournamentIds
          .map((tournamentId) => {
            const tournament = topTournamentsData?.find((t) => t.id === tournamentId);
            return {
              tournament_id: tournamentId,
              tournament_name: tournament?.name || null,
              view_count: tournamentViews.get(tournamentId) || 0,
            };
          })
          .sort((a, b) => b.view_count - a.view_count);

        setStats({
          totalUsers: usersResult.count || 0,
          totalTournaments: tournamentsResult.count || 0,
          totalTournamentMatches: matchesResult.count || 0,
          totalCasualMatches: casualMatchesResult.count || 0,
          activeUsers: uniqueActiveUsers.size,
          topUsers,
          totalPageViews,
          uniqueVisitors,
          pageViewsByType,
          topTournamentsByViews,
        });
      } catch (err: any) {
        console.error("Erro ao buscar estatísticas:", err);
        setError(err.message || "Erro ao carregar estatísticas");
      } finally {
        setIsLoading(false);
      }
    };

    if (!loading && !rolesLoading && isAdmin) {
      void fetchStats();
    }
  }, [isAdmin, loading, rolesLoading]);

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Faça login para acessar o dashboard</CardTitle>
            <CardDescription>
              É necessário estar autenticado com uma conta administrativa.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center px-4">
        <Card className="w-full max-w-lg bg-white/10 border-white/20 text-white">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription className="text-white/80">
              Você não possui permissão para acessar o dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-12 space-y-10">
        <div className="flex flex-col gap-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link to="/" className="w-fit">
              <Button
                variant="ghost"
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-md"
              >
                <ArrowLeft className="mr-2" size={18} />
                Voltar
              </Button>
            </Link>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">Dashboard</h1>
            <p className="text-white/80 text-lg mt-2">
              Visão geral e estatísticas do sistema
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 text-white border-red-400/40">
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : stats ? (
          <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Total de Usuários */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                <Users className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Usuários cadastrados
                </p>
              </CardContent>
            </Card>

            {/* Total de Torneios */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Torneios</CardTitle>
                <Trophy className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTournaments}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Torneios criados
                </p>
              </CardContent>
            </Card>

            {/* Jogos de Torneio */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jogos de Torneio</CardTitle>
                <Gamepad2 className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTournamentMatches}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Partidas registradas
                </p>
              </CardContent>
            </Card>

            {/* Jogos Avulsos */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Jogos Avulsos</CardTitle>
                <Gamepad2 className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCasualMatches}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Jogos criados
                </p>
              </CardContent>
            </Card>

            {/* Usuários Ativos */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <TrendingUp className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeUsers}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Com jogos criados
                </p>
              </CardContent>
            </Card>

            {/* Total de Acessos */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Acessos</CardTitle>
                <Eye className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPageViews}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Páginas visualizadas
                </p>
              </CardContent>
            </Card>

            {/* Visitantes Únicos */}
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Visitantes Únicos</CardTitle>
                <Users className="h-4 w-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.uniqueVisitors}</div>
                <p className="text-xs text-slate-400 mt-1">
                  Usuários/IPs distintos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Acessos por Tipo */}
          <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Acessos por Tipo de Página
              </CardTitle>
              <CardDescription className="text-slate-300">
                Distribuição de acessos nas páginas públicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <p className="text-sm text-slate-400">Torneio Público</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.pageViewsByType.tournament_public}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <p className="text-sm text-slate-400">Info do Torneio</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.pageViewsByType.tournament_info}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <p className="text-sm text-slate-400">Placar Público</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.pageViewsByType.scoreboard}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <p className="text-sm text-slate-400">Espectador</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.pageViewsByType.spectator}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Torneios Mais Acessados */}
          {stats.topTournamentsByViews.length > 0 && (
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Torneios Mais Acessados
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Ranking dos torneios com mais visualizações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topTournamentsByViews.map((tournament, index) => (
                    <div
                      key={tournament.tournament_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {tournament.tournament_name || "Torneio sem nome"}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID: {tournament.tournament_id.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-white">
                          {tournament.view_count} {tournament.view_count === 1 ? "acesso" : "acessos"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Usuários */}
          {stats.topUsers.length > 0 && (
            <Card className="bg-slate-900/60 border border-white/20 text-white backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários que mais criam jogos
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Ranking dos usuários com mais jogos avulsos criados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topUsers.map((user, index) => (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {user.name || user.email || "Usuário sem nome"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {user.email || "Sem email"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-white">
                          {user.match_count} {user.match_count === 1 ? "jogo" : "jogos"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          </>
        ) : null}
      </div>
    </div>
  );
}

