import { useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Monitor, Eye, Settings, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { LoginForm } from "@/components/auth/LoginForm";
import { UserMenu } from "@/components/auth/UserMenu";

type Role = "atleta" | "publico" | "arbitro" | "admin_sistema" | "organizador";

type ModuleDefinition = {
  key: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  iconClass: string;
};

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "tournament-info",
    title: "Informações do Torneio",
    description: "Consulte jogos, placares e tabelas atualizadas",
    to: "/tournament-info",
    icon: Trophy,
    roles: ["atleta", "organizador", "admin_sistema"],
    iconClass: "text-yellow-300",
  },
  {
    key: "organizer-tools",
    title: "Gestão do Torneio",
    description: "Edite horários, duplas e detalhes das partidas",
    to: "/tournaments",
    icon: Settings,
    roles: ["organizador", "admin_sistema"],
    iconClass: "text-sky-300",
  },
  {
    key: "arbitration",
    title: "Mesa de Arbitragem",
    description: "Controle completo do jogo em tempo real",
    to: "/referee",
    icon: Users,
    roles: ["arbitro", "admin_sistema"],
    iconClass: "text-blue-200",
  },
  {
    key: "scoreboard",
    title: "Placar Oficial",
    description: "Visualização limpa para transmissões oficiais",
    to: "/scoreboard/game-1",
    icon: Monitor,
    roles: ["publico", "admin_sistema"],
    iconClass: "text-green-300",
  },
  {
    key: "spectator",
    title: "Visão da Torcida",
    description: "Experiência imersiva com estatísticas e patrocinadores",
    to: "/spectator/game-1",
    icon: Eye,
    roles: ["publico", "admin_sistema"],
    iconClass: "text-purple-300",
  },
  {
    key: "admin-users",
    title: "Gerenciar Usuários",
    description: "Acesse a administração e gerencie perfis do sistema",
    to: "/admin/users",
    icon: Shield,
    roles: ["admin_sistema"],
    iconClass: "text-rose-200",
  },
];

const Index = () => {
  const { user, loading } = useAuth();
  const { roles, loading: rolesLoading, error: rolesError } = useUserRoles(user, loading);

  const isAdmin = roles.includes("admin_sistema");
  const accessibleModules = useMemo(
    () =>
      MODULE_DEFINITIONS.filter((module) =>
        isAdmin || module.roles.some((role) => roles.includes(role))
      ),
    [isAdmin, roles]
  );

  useEffect(() => {
    if (!user) {
      console.log("[Index] Nenhum usuário autenticado - exibindo tela de login");
      return;
    }

    console.log("[Index] Perfis e módulos acessíveis para o usuário", {
      userId: user.id,
      email: user.email,
      roles,
      accessibleModules: accessibleModules.map((module) => module.key),
    });
  }, [user, roles, accessibleModules]);

  if (loading || (user && rolesLoading)) {
    return (
      <div className="min-h-screen bg-gradient-ocean flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-ocean">
      <div className="container mx-auto px-4 py-12">
        {/* Header with user menu */}
        <div className="flex justify-end mb-8">
          {user && <UserMenu />}
        </div>

        {!user ? (
          /* Login Section */
          <div className="max-w-md mx-auto mb-16">
            <div className="text-center text-white mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Trophy className="text-yellow-300" size={48} />
                <h1 className="text-4xl font-bold">VP Jukin</h1>
              </div>
              <p className="text-xl opacity-90">Plataforma completa para gestão e transmissão de jogos</p>
            </div>
            <LoginForm />
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="text-center text-white mb-16">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Trophy className="text-yellow-300" size={48} />
                <h1 className="text-5xl font-bold">VP Jukin</h1>
              </div>
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {roles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="bg-white/10 text-white border-white/20 uppercase tracking-wide"
                    >
                      {role.replace("_", " ").toUpperCase()}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-2xl mb-8 opacity-90">
                {isAdmin
                  ? "Selecione um módulo ou acesse as ferramentas administrativas."
                  : "Escolha um dos módulos disponíveis para o seu perfil."}
              </p>
              {accessibleModules.length === 0 && (
                <div className="text-white/80 text-lg">
                  Nenhum módulo disponível para o seu perfil no momento.
                </div>
              )}
            </div>

            {/* Roles error */}
            {rolesError && (
              <div className="max-w-2xl mx-auto mb-10">
                <Alert variant="destructive" className="bg-red-500/10 text-white border-red-400/40">
                  <AlertTitle>Não foi possível carregar os módulos</AlertTitle>
                  <AlertDescription>
                    {rolesError} — tente recarregar a página ou contacte o administrador.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Modules Grid */}
            {accessibleModules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-16">
                {accessibleModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link
                      to={module.to}
                      key={module.key}
                      className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-xl"
                    >
                      <Card className="bg-white/10 border-white/20 text-white transition-colors group-hover:bg-white/20">
                        <CardHeader className="text-center">
                          <Icon className={`mx-auto mb-4 ${module.iconClass}`} size={40} />
                          <CardTitle>{module.title}</CardTitle>
                          <CardDescription className="text-white/80">
                            {module.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/70">
                            Clique para abrir este módulo.
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              !rolesError && (
                <div className="mb-16">
                  <Card className="bg-white/10 border-white/20 text-white">
                    <CardHeader>
                      <CardTitle>Nenhum módulo habilitado</CardTitle>
                      <CardDescription className="text-white/80">
                        Seu perfil ainda não possui módulos liberados. Entre em contato com o administrador
                        do sistema para solicitar acesso.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              )
            )}
            {/* Features List */}
            <div className="text-center text-white">
              <h2 className="text-3xl font-bold mb-8">Funcionalidades Principais</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-4">🏐 Controle Completo</h3>
                  <ul className="space-y-2 opacity-90">
                    <li>• Pontuação em tempo real</li>
                    <li>• Sistema de rotação automática</li>
                    <li>• Controle de timeouts</li>
                    <li>• Troca de quadra automática</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">📊 Estatísticas Avançadas</h3>
                  <ul className="space-y-2 opacity-90">
                    <li>• Classificação de pontos</li>
                    <li>• Histórico de eventos</li>
                    <li>• Desfazer/Refazer ações</li>
                    <li>• Relatórios detalhados</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4">📺 Múltiplas Visualizações</h3>
                  <ul className="space-y-2 opacity-90">
                    <li>• Placar para atletas</li>
                    <li>• Tela para torcida</li>
                    <li>• Mesa de arbitragem</li>
                    <li>• Integração de patrocinadores</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;